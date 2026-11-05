# DSH-STICKY-NOTES · 便签墙

一个 DeepSeek Harness（DSH）Web 界面插件：在左侧栏加一个图标，点开就是一面便签墙，用来记录 **TODO**、**灵感** 和 **备忘录**。

三类便签各有配色，支持标记完成、搜索、分类筛选，数据只存在本机浏览器里，不上传任何服务器。

![便签墙](icon.svg)

## 功能

| 功能 | 说明 |
| --- | --- |
| 三类便签 | TODO（暖黄）、灵感（浅蓝）、备忘（浅绿），新建时选择类型 |
| 标记完成 | 不删除数据，只翻状态；卡片换成灰绿色并加删除线，从主墙移入底部「✓ 已完成」分区 |
| 置顶 | 点卡片上的 📌 把便签钉到最前，永远排在未置顶的便签之前；再点一次取消。置顶只改排序，不动内容 |
| 已完成分类 | 筛选栏的「已完成」只显示已办项，按完成时间倒序 |
| 搜索 | 输入即时过滤正文 |
| 分类筛选 | 全部 / TODO / 灵感 / 备忘 / 已完成，实时计数 |
| 编辑与删除 | 卡片内直接编辑，删除需二次确认 |
| 键盘操作 | 编辑框内 `Ctrl+Enter`（macOS 为 `Cmd+Enter`）保存，`Esc` 取消 |
| 本地持久化 | 写入 `localStorage`，刷新、重启后仍在 |
| 中英双语 | 跟随界面语言，通过宿主 locale 服务注册字典 |
| 主题适配 | 全部样式用 `--dsw-alias-*` 主题 token，随明暗主题变化 |

## 安装

插件以 workspace 内的本地 bundle 形式安装，不需要发布到 npm。

```bash
# 1. 把本仓库放进你的 DSH workspace，例如
git clone https://github.com/qiuleec/DSH-STICKY-NOTES.git sticky-notes-plugin
```

```text
# 2. 在 DSH 会话里安装（路径指向仓库根目录）
plugin_manager(install_bundle, target = "<workspace>/sticky-notes-plugin")
```

也可以在命令面板里打开「插件」界面，用「安装本地 bundle」选择该目录。

安装完成后**刷新一次页面**：Client 模块在页面加载时注册槽位，热载入不会立刻出现新图标。之后左侧栏会多一个黄色便签图标，点开即用。

### 手动登记（安装器不可用时）

在 profile 的 `package.json` 里加一条链接依赖，并把 bundle 名加入 `dsh.profile.bundles`：

```json
{
  "dependencies": {
    "@local/sticky-notes": "link:C:/path/to/sticky-notes-plugin"
  }
}
```

## 数据与隐私

- 所有便签存在浏览器 `localStorage` 的 `@local/sticky-notes:data:v1` 键下，插件不含网络请求，不上传、不同步。
- 清理浏览器站点数据会一并清空便签；换浏览器、换 profile 不共享。
- 仓库内的示例代码不含任何真实业务数据。

## 项目结构

```text
sticky-notes-plugin/
├── package.json        # bundle 清单：exports、dsh.bundle、dsh.client
├── cordis.patch.yml    # Cordis bundle patch，插入 sticky-notes 插件条目
├── index.js            # Host 侧入口（本插件无 Host 逻辑，apply 为空）
├── client.js           # Client 模块：样式、组件、槽位注册
├── locale/
│   ├── zh.json         # 插件元数据（中文）
│   └── en.json         # 插件元数据（英文）
├── icon.svg            # 侧栏图标与插件图标
├── test-done.mjs       # 完成后行为的桩环境测试
└── README.md
```

### 关键实现点

- **两个槽位**：`sidebar.panellist` 注册侧栏图标（`id` + `order` + `label`），`main` 注册同一 `key` 的面板主体。侧栏点击时调用 `ctx.layout.selectPanel(id)`，`main` 槽位按这个 key 分发。
- **不 require Harness Client 包**：只用 `require('react')`，locale 服务通过 `ctx.locale` 获取，样式用自己注入的 `<style>`。
- **副作用集中在 `apply`**：字典注册与样式注入都包在 `ctx.effect` 里并返回清理函数，模块工厂本身无副作用。
- **旧数据兼容**：`loadNotes()` 会补齐早期缺失的字段——没有 `done` 的置为 `done: false`，没有 `pinned` 的置为 `pinned: false`，升级不丢数据。

## 开发与测试

无需安装依赖，测试用 `node:vm` 与最小 React 替身直接执行 `client.js` 的模块工厂，把组件树展开成元素后断言：

```bash
node --check client.js
node test-done.mjs
# 全部用例通过 ✓  (20 组断言)
```

覆盖用例：空墙、旧数据兼容、多张卡片渲染、标记完成换色加 ✓、已完成分区与计数排序、数据不被删除且持久化、完成时间标签、恢复未完成、已完成筛选隔离、切回全部、跨重新挂载恢复、灵感与备忘同样可完成、置顶排到最前、多个置顶按时间倒序、取消置顶归位、置顶跨刷新保持、搜索下置顶仍优先、已完成分区内置顶优先、种子批次只合并一次并按正文去重。

修改插件代码后不需要重装——profile 里是 `link:` 目录链接，刷新页面即生效。

## 已知边界

- 只在 DSH Web 界面（`platform: web`）生效，桌面端其它渲染面未适配。
- 无云同步、无多设备共享、无导入导出。
- 便签正文是纯文本，不支持 Markdown 渲染。

## License

MIT
