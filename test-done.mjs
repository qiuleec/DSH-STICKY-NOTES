/**
 * 便签墙「标记完成」功能的桩环境测试。
 *
 * 不依赖真实浏览器或 React：用最小 React 替身（hook 状态按组件路径隔离）
 * 执行 client.js 的模块工厂，把函数组件递归展开成元素树后做断言。
 *
 * 覆盖：
 *  - 完成 / 恢复未完成的状态流转
 *  - 已完成卡片的配色与 ✓ 徽标
 *  - 已完成独立分区（标题 + 计数）
 *  - 「已完成」筛选项
 *  - 标记完成不删除数据，并持久化 done / doneAt
 *  - 旧数据（无 done 字段）兼容
 *  - 重新挂载后完成状态仍从 localStorage 恢复
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const source = fs.readFileSync(path.join(here, 'client.js'), 'utf8');

const STORAGE_KEY = '@local/sticky-notes:data:v1';

/* ---- 最小 React 替身：hook 状态按组件路径隔离 ------------------------ */
const stateMap = new Map();
let currentPath = '';
let hookCursor = 0;

const React = {
  Fragment: Symbol('Fragment'),
  createElement(type, props, ...children) {
    const flat = [];
    const push = (c) => {
      if (c === null || c === undefined || c === false || c === true) return;
      if (Array.isArray(c)) { c.forEach(push); return; }
      flat.push(c);
    };
    push(children);
    return { type, props: props ?? {}, children: flat };
  },
  useState(initial) {
    const frame = stateMap.get(currentPath) ?? [];
    stateMap.set(currentPath, frame);
    const i = hookCursor++;
    if (!(i in frame)) frame[i] = typeof initial === 'function' ? initial() : initial;
    const set = (next) => { frame[i] = typeof next === 'function' ? next(frame[i]) : next; };
    return [frame[i], set];
  },
  useEffect(fn) {
    hookCursor++;
    fn();
  }
};

function renderComponent(comp, props, pathKey) {
  const savedPath = currentPath;
  const savedCursor = hookCursor;
  currentPath = pathKey;
  hookCursor = 0;
  try {
    return comp(props);
  } finally {
    currentPath = savedPath;
    hookCursor = savedCursor;
  }
}

/* ---- 浏览器环境替身 -------------------------------------------------- */
const store = new Map();
const localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k)
};
const documentStub = {
  createElement: () => ({ textContent: '', remove() {} }),
  head: { appendChild() {} },
  querySelector: () => null
};

let loaded = null;
const sandbox = {
  window: { localStorage, __ModuleLoader__: { load: (mod) => { loaded = mod; } } },
  document: documentStub,
  console, Intl, Date, Math, JSON, Set, Symbol, String, Object, Array, Error
};
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: 'client.js' });

assert.ok(loaded, '模块未注册到 __ModuleLoader__');
assert.equal(loaded.id, '@local/sticky-notes');

const mod = loaded.factory((name) => {
  if (name === 'react') return React;
  throw new Error('unexpected require: ' + name);
});

/* ---- 槽位 / 语言服务替身 --------------------------------------------- */
const registrations = [];
const ctx = {
  locale: { bind: () => (key) => key, register: () => {} },
  effect: (fn) => fn(),
  slots: {
    inject: (_name, fn) => fn(),
    register: (opts, comp) => { registrations.push({ opts, comp }); return () => {}; }
  }
};
mod.apply(ctx);

assert.equal(registrations.length, 2, '应注册侧栏入口与主面板两个槽位');
assert.ok(registrations.some((r) => r.opts.id === 'sticky-notes'), '侧栏入口应有 id');
const panelReg = registrations.find((r) => r.opts.name === 'main');
assert.ok(panelReg, '缺少 main 槽位注册');
assert.equal(panelReg.opts.key, 'sticky-notes', 'main 槽位 key 必须与侧栏 id 一致');

const NotesPanel = panelReg.comp;
const t = panelReg.opts.inject().t;

/* ---- 渲染与树工具 ---------------------------------------------------- */
function expand(node, pathKey) {
  if (node === null || node === undefined || node === false || node === true) return [];
  if (Array.isArray(node)) return node.flatMap((n, i) => expand(n, pathKey + '.' + i));
  if (typeof node === 'string' || typeof node === 'number') return [node];
  if (!node.type) return [node];
  if (node.type === React.Fragment) {
    return node.children.flatMap((c, i) => expand(c, pathKey + '/f' + i));
  }
  if (typeof node.type === 'function') {
    const name = node.type.name || 'C';
    const key = node.props && node.props.key != null ? '#' + node.props.key : '';
    const childPath = pathKey + '>' + name + key;
    return expand(renderComponent(node.type, node.props, childPath), childPath);
  }
  return [{ ...node, children: node.children.flatMap((c, i) => expand(c, pathKey + '/' + i)) }];
}

/** 重新渲染：保留 hook 状态，相当于 React 的重渲染。 */
function render() {
  return { type: 'root', props: {}, children: expand(React.createElement(NotesPanel, { t }), 'root') };
}

/** 重新挂载：丢弃全部 hook 状态，相当于刷新页面 / 重新打开面板。 */
function remount() {
  stateMap.clear();
  hookCursor = 0;
  return render();
}

function walk(node, visit) {
  if (!node || typeof node !== 'object' || !node.type) return;
  visit(node);
  for (const c of node.children) if (c && typeof c === 'object') walk(c, visit);
}
function findAll(tree, pred) {
  const out = [];
  walk(tree, (n) => { if (pred(n)) out.push(n); });
  return out;
}
const byClass = (tree, cls) => findAll(tree, (n) => n.props.className === cls);
const noteCards = (tree) => byClass(tree, 'sn-card');
const doneCards = (tree) => noteCards(tree).filter((n) => n.props['data-done'] === 'true');
const activeCards = (tree) => noteCards(tree).filter((n) => n.props['data-done'] === 'false');
const textOf = (card) => byClass(card, 'sn-cardText').map((n) => n.children.join('')).join('');
const findByText = (tree, needle) => noteCards(tree).find((c) => textOf(c).includes(needle));
const doneToggle = (card) => {
  const btn = findAll(card, (n) => n.props.className === 'sn-iconBtn' && n.props['aria-pressed'] !== undefined)[0];
  assert.ok(btn, '卡片上找不到完成切换按钮');
  return btn;
};
const chip = (tree, f) => findAll(tree, (n) => n.props.className === 'sn-chip' && n.children.includes('filter.' + f))[0];

/* ==================================================================== */
/* 用例                                                                  */
/* ==================================================================== */

// 1. 空墙
store.clear();
let tree = remount();
assert.equal(noteCards(tree).length, 0, '初始不应有任何便签卡片');
assert.equal(byClass(tree, 'sn-sectionTitle').length, 0, '空墙不应有已完成分区');

// 2. 旧数据兼容：没有 done 字段的便签按未完成处理，配色不变
localStorage.setItem(STORAGE_KEY, JSON.stringify([
  { id: 'old1', kind: 'memo', text: '旧数据无 done 字段', createdAt: 1, updatedAt: 1 }
]));
tree = remount();
const oldCard = findByText(tree, '旧数据无 done 字段');
assert.ok(oldCard, '旧数据应正常渲染');
assert.equal(oldCard.props['data-done'], 'false', '旧数据默认未完成');
assert.equal(oldCard.props.style.background, '#def0e2', '备忘录保持原配色');

// 3. 两条未完成 TODO
localStorage.setItem(STORAGE_KEY, JSON.stringify([
  { id: 'a1', kind: 'todo', text: '待办A要完成', done: false, createdAt: 1700000000000, updatedAt: 1700000000000 },
  { id: 'a2', kind: 'todo', text: '待办B先留着', done: false, createdAt: 1700000001000, updatedAt: 1700000001000 }
]));
tree = remount();
assert.equal(activeCards(tree).length, 2, '应有 2 张未完成卡片');
assert.equal(doneCards(tree).length, 0, '此时无已完成');
assert.equal(findByText(tree, '待办A要完成').props.style.background, '#fde9c8', 'TODO 未完成时用黄色');

// 4. 标记完成：卡片保留、换色、加 ✓ 前缀
doneToggle(findByText(tree, '待办A要完成')).props.onClick();
tree = render();
assert.equal(doneCards(tree).length, 1, '应出现 1 张已完成卡片');
assert.equal(activeCards(tree).length, 1, '未完成只剩 1 张');
const doneCard = doneCards(tree)[0];
assert.equal(textOf(doneCard), '待办A要完成', '已完成卡片文本应保持原样');
assert.equal(doneCard.props.style.background, '#e3e8e4', '已完成应换成灰绿配色');
assert.notEqual(doneCard.props.style.background, '#fde9c8', '已完成不应再是 TODO 黄色');
assert.equal(byClass(doneCard, 'sn-cardKind').map((n) => n.children.join('')).join(''), '✓ kind.todo',
  '已完成徽标应带 ✓ 前缀');

// 5. 已完成独占分区，带标题与计数
const sectionTitles = byClass(tree, 'sn-sectionTitle');
assert.equal(sectionTitles.length, 1, '应有一个「已完成」分区标题');
assert.equal(sectionTitles[0].children.join(''), '✓ section.done');
assert.equal(byClass(tree, 'sn-sectionCount').map((n) => n.children.join('')).join(''), '1', '分区计数应为 1');
const order = [];
walk(tree, (n) => { if (n.props.className === 'sn-sectionTitle' || n.props.className === 'sn-card') order.push(n.props.className); });
assert.equal(order.lastIndexOf('sn-card') > order.indexOf('sn-sectionTitle'), true, '已完成卡片应排在分区标题之后');

// 6. 标记完成不删除数据，并记录完成时间
const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY));
assert.equal(persisted.length, 2, '标记完成不应删除便签');
const a1 = persisted.find((n) => n.id === 'a1');
assert.equal(a1.text, '待办A要完成', '文本应保留');
assert.equal(a1.done, true, '应持久化 done=true');
assert.ok(typeof a1.doneAt === 'number' && a1.doneAt > 0, '应记录完成时间 doneAt');
assert.equal(persisted.find((n) => n.id === 'a2').done, false, '另一条不受影响');

// 7. 已完成卡片的元信息显示「完成于」
assert.ok(byClass(doneCard, 'sn-cardTime').map((n) => n.children.join('')).join('').startsWith('note.doneAt'),
  '已完成卡片应显示完成时间标签');

// 8. 恢复未完成：回到原分类与原配色
doneToggle(findByText(tree, '待办A要完成')).props.onClick();
tree = render();
assert.equal(doneCards(tree).length, 0, '恢复后不应再有已完成卡片');
assert.equal(activeCards(tree).length, 2, '恢复后应回到未完成');
assert.equal(findByText(tree, '待办A要完成').props.style.background, '#fde9c8', '恢复后回到 TODO 黄色');
const reopened = JSON.parse(localStorage.getItem(STORAGE_KEY)).find((n) => n.id === 'a1');
assert.equal(reopened.done, false, '恢复应持久化 done=false');
assert.equal(reopened.doneAt, null, '恢复应清空完成时间');

// 9. 「已完成」筛选项
doneToggle(findByText(tree, '待办B先留着')).props.onClick();
tree = render();
assert.ok(chip(tree, 'done'), '筛选栏应有「已完成」项');
chip(tree, 'done').props.onClick();
tree = render();
assert.equal(doneCards(tree).length, 1, '已完成筛选下只显示已完成卡片');
assert.equal(textOf(doneCards(tree)[0]), '待办B先留着');
assert.equal(activeCards(tree).length, 0, '已完成筛选下不应出现未完成卡片');

// 10. 切回「全部」后两条都回到未完成
chip(tree, 'all').props.onClick();
tree = render();
doneToggle(findByText(tree, '待办B先留着')).props.onClick();
tree = render();
assert.equal(activeCards(tree).length, 2, '全部恢复为未完成');

// 11. 完成状态跨重新挂载保持
doneToggle(findByText(tree, '待办A要完成')).props.onClick();
tree = render(); // 先重渲染一次，让 useEffect 把新状态写回 localStorage
tree = remount();
assert.equal(doneCards(tree).length, 1, '重新挂载后完成状态应从 localStorage 恢复');
assert.equal(textOf(doneCards(tree)[0]), '待办A要完成');

// 12. 灵感 / 备忘同样可标记完成（不限于 TODO）
localStorage.setItem(STORAGE_KEY, JSON.stringify([
  { id: 'i1', kind: 'idea', text: '一个灵感', done: false, createdAt: 1, updatedAt: 1 }
]));
tree = remount();
doneToggle(findByText(tree, '一个灵感')).props.onClick();
tree = render();
assert.equal(doneCards(tree).length, 1, '灵感卡片也应可标记完成');
assert.equal(doneCards(tree)[0].props.style.background, '#e3e8e4', '完成后统一使用已完成配色');

console.log('全部用例通过 ✓  (12 组断言)');
