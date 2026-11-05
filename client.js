window.__ModuleLoader__.load({
  id: '@local/sticky-notes',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const PANEL_ID = 'sticky-notes';
    const NS = 'stickyNotes';
    const STORAGE_KEY = '@local/sticky-notes:data:v1';

    /* ------------------------------------------------------------------ */
    /* Localized strings — registered through the host locale service so   */
    /* visible UI text follows the active interface language.              */
    /* ------------------------------------------------------------------ */
    const zh = {
      'panel': '便签墙',
      'title': '便签墙',
      'subtitle': '记录 TODO、灵感与备忘录，数据保存在本机浏览器中。',
      'add': '新建便签',
      'kind.todo': 'TODO',
      'kind.idea': '灵感',
      'kind.memo': '备忘',
      'filter.all': '全部',
      'filter.todo': 'TODO',
      'filter.idea': '灵感',
      'filter.memo': '备忘',
      'filter.done': '已完成',
      'search.placeholder': '搜索便签…',
      'empty.title': '墙上一张便签都没有',
      'empty.hint': '点击「新建便签」，把第一件事写下来。',
      'empty.filtered': '没有匹配的便签',
      'note.placeholder': '写点什么…',
      'note.save': '保存',
      'note.cancel': '取消',
      'note.edit': '编辑',
      'note.delete': '删除',
      'note.deleteTitle': '删除这张便签？',
      'note.confirmDelete': '删除',
      'note.keep': '保留',
      'note.updated': '更新于',
      'note.created': '创建于',
      'note.doneBtn': '标记完成',
      'note.undoneBtn': '恢复未完成',
      'note.doneAt': '完成于',
      'note.pinBtn': '置顶',
      'note.unpinBtn': '取消置顶',
      'section.done': '已完成',
      'count': '{count} 张便签'
    };
    const en = {
      'panel': 'Sticky Notes',
      'title': 'Sticky Notes',
      'subtitle': 'Capture TODOs, ideas, and memos. Data is stored in this browser.',
      'add': 'New note',
      'kind.todo': 'TODO',
      'kind.idea': 'Idea',
      'kind.memo': 'Memo',
      'filter.all': 'All',
      'filter.todo': 'TODO',
      'filter.idea': 'Ideas',
      'filter.memo': 'Memos',
      'filter.done': 'Done',
      'search.placeholder': 'Search notes…',
      'empty.title': 'The wall is empty',
      'empty.hint': 'Click "New note" to write down the first thing.',
      'empty.filtered': 'No matching notes',
      'note.placeholder': 'Write something…',
      'note.save': 'Save',
      'note.cancel': 'Cancel',
      'note.edit': 'Edit',
      'note.delete': 'Delete',
      'note.deleteTitle': 'Delete this note?',
      'note.confirmDelete': 'Delete',
      'note.keep': 'Keep',
      'note.updated': 'Updated',
      'note.created': 'Created',
      'note.doneBtn': 'Mark done',
      'note.undoneBtn': 'Reopen',
      'note.doneAt': 'Done',
      'note.pinBtn': 'Pin to top',
      'note.unpinBtn': 'Unpin',
      'section.done': 'Done',
      'count': '{count} note(s)'
    };

    const KINDS = ['todo', 'idea', 'memo'];
    const KIND_COLORS = {
      todo: { bg: '#fde9c8', edge: '#f2c94c', ink: '#5a4210' },
      idea: { bg: '#dcebfd', edge: '#88b8f0', ink: '#1d3f6e' },
      memo: { bg: '#def0e2', edge: '#8fce9f', ink: '#1f4d2c' }
    };
    // A completed TODO keeps its place on the wall but is repainted in a
    // muted slate/green palette so finished work reads as "settled".
    const DONE_COLORS = { bg: '#e3e8e4', edge: '#9fb8a6', ink: '#33463a' };

    /* ------------------------------------------------------------------ */
    /* Persistence — same-origin localStorage, versioned key.             */
    /* ------------------------------------------------------------------ */
    function loadNotes() {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        let data = [];
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) data = parsed;
        }
        const notes = data
          .filter((n) => n && typeof n.id === 'string' && KINDS.includes(n.kind) && typeof n.text === 'string')
          .map((n) => {
            // Completion and pinning are independent flags, never deletions:
            // the note keeps its id, text and timestamps so both can be undone.
            const pinned = n.pinned === true;
            const base = pinned
              ? { ...n, pinned: true, pinnedAt: typeof n.pinnedAt === 'number' ? n.pinnedAt : (n.updatedAt ?? n.createdAt ?? 0) }
              : { ...n, pinned: false };
            return base.done === true
              ? { ...base, done: true, doneAt: typeof base.doneAt === 'number' ? base.doneAt : base.updatedAt }
              : { ...base, done: false };
          });
        return notes;
      } catch {
        return [];
      }
    }
    function saveNotes(notes) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
      } catch {
        /* storage full or unavailable: the wall keeps working in memory */
      }
    }
    function newId() {
      return 'n_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    }

    /* ------------------------------------------------------------------ */
    /* Styles — theme tokens only; artwork colors are the note surfaces.  */
    /* ------------------------------------------------------------------ */
    const css = `
.sn-panel{box-sizing:border-box;height:100%;display:flex;flex-direction:column;overflow:auto;
  color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1);
  padding:calc(24px + var(--dsh-frame-top-clearance,0px)) clamp(20px,4vw,44px) 40px;gap:16px}
.sn-head{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:12px;max-width:1120px;width:100%;margin:0 auto}
.sn-title{margin:0;font-size:20px;font-weight:500;line-height:28px}
.sn-subtitle{margin:4px 0 0;color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:20px}
.sn-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.sn-search{border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-md,8px);
  background:var(--dsw-alias-bg-layer-2);height:32px;font:inherit;color:var(--dsw-alias-label-primary);
  outline:none;padding:0 12px;font-size:13px;min-width:180px}
.sn-search:focus{border-color:var(--dsw-alias-state-business-primary);box-shadow:inset 0 0 0 .5px var(--dsw-alias-state-business-primary)}
.sn-add{border:0;border-radius:var(--dsw-radius-md,8px);background:var(--dsw-alias-brand-primary);
  color:var(--dsw-alias-label-primary-foreground);height:32px;padding:0 14px;font-size:13px;font-weight:500;cursor:pointer;font:inherit;font-size:13px}
.sn-add:hover{filter:brightness(1.06)}
.sn-filters{display:flex;gap:4px;max-width:1120px;width:100%;margin:0 auto}
.sn-chip{border:.5px solid var(--dsw-alias-border-l3);border-radius:999px;background:transparent;
  color:var(--dsw-alias-label-secondary);height:26px;padding:0 12px;font-size:12px;cursor:pointer;font:inherit}
.sn-chip:hover{color:var(--dsw-alias-label-primary)}
.sn-chip[data-active="true"]{background:var(--dsw-alias-interactive-bg-selected,var(--dsw-alias-bg-layer-3));
  color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l2);font-weight:500}
.sn-wall{columns:4 240px;column-gap:14px;max-width:1120px;width:100%;margin:0 auto}
.sn-card{break-inside:avoid;display:inline-block;width:100%;box-sizing:border-box;margin:0 0 14px;
  border-radius:10px;border:.5px solid var(--dsw-alias-border-l2);padding:12px 14px 10px;
  box-shadow:0 1px 3px rgba(0,0,0,.08);position:relative}
.sn-cardKind{display:inline-block;border-radius:999px;font-size:10px;line-height:1;padding:3px 8px;font-weight:600;letter-spacing:.04em;margin:0 0 8px}
.sn-cardText{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;font-size:13.5px;line-height:21px;cursor:pointer}
.sn-cardMeta{margin:10px 0 0;display:flex;align-items:center;justify-content:space-between;gap:8px}
.sn-cardTime{color:var(--dsw-alias-label-caption,var(--dsw-alias-label-tertiary));font-size:11px}
.sn-cardActions{display:flex;gap:2px;opacity:0;transition:opacity .15s}
.sn-card:hover .sn-cardActions,.sn-card:focus-within .sn-cardActions{opacity:1}
.sn-iconBtn{border:0;background:transparent;border-radius:var(--dsw-radius-sm,6px);cursor:pointer;
  color:var(--dsw-alias-label-tertiary);width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;padding:0;font:inherit;font-size:12px}
.sn-iconBtn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.sn-card[data-done="true"]{opacity:.92}
.sn-card[data-done="true"] .sn-cardText{text-decoration:line-through;text-decoration-thickness:1px;
  text-decoration-color:rgba(51,70,58,.45);color:#3d5044}
.sn-card[data-done="true"] .sn-cardKind{font-weight:600}
.sn-card[data-pinned="true"]{box-shadow:0 2px 10px rgba(0,0,0,.16)}
.sn-card[data-pinned="true"]::before{content:"";position:absolute;inset:0 auto 0 0;width:3px;border-radius:10px 0 0 10px;
  background:var(--dsw-alias-brand-primary,currentColor);opacity:.7}
.sn-sectionHead{max-width:1120px;width:100%;margin:8px auto 0;display:flex;align-items:center;gap:8px}
.sn-sectionTitle{margin:0;font-size:13px;font-weight:500;color:var(--dsw-alias-label-secondary);
  display:flex;align-items:center;gap:6px}
.sn-sectionRule{flex:1;height:1px;background:var(--dsw-alias-border-l3)}
.sn-sectionCount{color:var(--dsw-alias-label-caption,var(--dsw-alias-label-tertiary));font-size:12px}
.sn-textarea{width:100%;box-sizing:border-box;min-height:84px;resize:vertical;border:0;outline:none;background:transparent;
  color:var(--dsw-alias-label-primary);font:inherit;font-size:13.5px;line-height:21px}
.sn-editRow{display:flex;justify-content:flex-end;gap:8px;margin-top:8px}
.sn-btn{border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-md,8px);background:transparent;
  color:var(--dsw-alias-label-secondary);height:28px;padding:0 12px;font-size:12.5px;cursor:pointer;font:inherit}
.sn-btn:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}
.sn-btnPrimary{background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary-foreground);border:0;font-weight:500}
.sn-newCard{background:var(--dsw-alias-bg-layer-2)}
.sn-confirm{margin-top:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.sn-confirmText{font-size:12.5px;color:var(--dsw-alias-label-secondary);margin:0}
.sn-empty{max-width:1120px;width:100%;margin:48px auto 0;text-align:center;color:var(--dsw-alias-label-tertiary)}
.sn-emptyTitle{margin:0;font-size:15px;font-weight:500;color:var(--dsw-alias-label-secondary)}
.sn-emptyHint{margin:6px 0 0;font-size:13px}
.sn-count{color:var(--dsw-alias-label-caption,var(--dsw-alias-label-tertiary));font-size:12px;margin:0}
@media (prefers-reduced-motion:reduce){.sn-cardActions{transition:none}}
`;
    const injectedStyles = { current: null };

    /* ------------------------------------------------------------------ */
    /* Small helpers                                                       */
    /* ------------------------------------------------------------------ */
    function formatTime(ts, t) {
      try {
        return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(ts));
      } catch {
        return String(ts);
      }
    }

    /* ------------------------------------------------------------------ */
    /* Components                                                          */
    /* ------------------------------------------------------------------ */
    function PanelIcon({ size }) {
      // Decorative occupant for the sidebar entry; the sidebar owns the label.
      return h('svg', {
        viewBox: '0 0 64 64', width: size ?? 18, height: size ?? 18, 'aria-hidden': true,
        style: { display: 'block' }
      },
        h('rect', { x: 8, y: 8, width: 48, height: 44, rx: 7, fill: 'var(--dsw-alias-label-secondary, currentColor)', opacity: 0.9 }),
        h('path', { d: 'M8 52a7 7 0 0 0 7 7h22L8 30z', fill: 'var(--dsw-alias-label-secondary, currentColor)', opacity: 0.55 }),
        h('rect', { x: 18, y: 19, width: 28, height: 4.5, rx: 2.25, fill: 'var(--dsw-alias-bg-layer-1, #fff)' }),
        h('rect', { x: 18, y: 30, width: 19, height: 4.5, rx: 2.25, fill: 'var(--dsw-alias-bg-layer-1, #fff)', opacity: 0.75 }),
        h('rect', { x: 18, y: 41, width: 23, height: 4.5, rx: 2.25, fill: 'var(--dsw-alias-bg-layer-1, #fff)', opacity: 0.5 })
      );
    }

    function NewNoteCard({ t, onAdd }) {
      const [kind, setKind] = React.useState('todo');
      const [text, setText] = React.useState('');
      const submit = () => {
        const trimmed = text.trim();
        if (!trimmed) return;
        onAdd({ kind, text: trimmed });
        setText('');
      };
      return h('div', { className: 'sn-card sn-newCard' },
        h('div', { style: { display: 'flex', gap: 4, marginBottom: 8 } },
          KINDS.map((k) => h('button', {
            key: k, type: 'button', className: 'sn-chip', 'data-active': kind === k,
            onClick: () => setKind(k)
          }, t('kind.' + k))),
        ),
        h('textarea', {
          className: 'sn-textarea', value: text, placeholder: t('note.placeholder'),
          onChange: (e) => setText(e.target.value),
          onKeyDown: (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit(); }
          }
        }),
        h('div', { className: 'sn-editRow' },
          h('button', { type: 'button', className: 'sn-btn sn-btnPrimary', onClick: submit, disabled: !text.trim() }, t('note.save'))
        )
      );
    }

    function NoteCard({ t, note, onUpdate, onDelete }) {
      const [editing, setEditing] = React.useState(false);
      const [draft, setDraft] = React.useState(note.text);
      const [confirming, setConfirming] = React.useState(false);
      const isDone = note.done === true;
      const isPinned = note.pinned === true;
      const colors = isDone ? DONE_COLORS : (KIND_COLORS[note.kind] ?? KIND_COLORS.memo);
      const startEdit = () => { setDraft(note.text); setEditing(true); };
      const save = () => {
        const trimmed = draft.trim();
        if (!trimmed) return;
        onUpdate(note.id, { text: trimmed });
        setEditing(false);
      };
      // Completion is a flag, never a delete: the note keeps its id, text and
      // creation time, so it can always be reopened.
      const toggleDone = () => onUpdate(note.id, { done: !isDone, doneAt: !isDone ? Date.now() : null });
      // Pinning only reorders the wall; the note is untouched otherwise.
      const togglePin = () => onUpdate(note.id, { pinned: !isPinned, pinnedAt: !isPinned ? Date.now() : null });
      return h('div', {
        className: 'sn-card', tabIndex: 0,
        style: { background: colors.bg, borderColor: colors.edge },
        'data-kind': note.kind,
        'data-done': isDone ? 'true' : 'false',
        'data-pinned': isPinned ? 'true' : 'false',
        title: isDone ? t('note.undoneBtn') : undefined
      },
        h('span', { className: 'sn-cardKind', style: { background: colors.edge, color: colors.ink } },
          (isPinned ? '📌 ' : '') + (isDone ? '✓ ' : '') + t('kind.' + note.kind)),
        editing
          ? h(React.Fragment, null,
              h('textarea', {
                className: 'sn-textarea', value: draft, autoFocus: true,
                onChange: (e) => setDraft(e.target.value),
                onKeyDown: (e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save(); }
                  if (e.key === 'Escape') { e.preventDefault(); setEditing(false); }
                }
              }),
              h('div', { className: 'sn-editRow' },
                h('button', { type: 'button', className: 'sn-btn', onClick: () => setEditing(false) }, t('note.cancel')),
                h('button', { type: 'button', className: 'sn-btn sn-btnPrimary', onClick: save, disabled: !draft.trim() }, t('note.save'))
              )
            )
          : h(React.Fragment, null,
              h('p', { className: 'sn-cardText', onClick: startEdit, title: t('note.edit') }, note.text),
              h('div', { className: 'sn-cardMeta' },
                h('span', { className: 'sn-cardTime' },
                  isDone
                    ? t('note.doneAt') + ' ' + formatTime(note.doneAt ?? note.updatedAt ?? note.createdAt, t)
                    : (note.updatedAt && note.updatedAt !== note.createdAt ? t('note.updated') : t('note.created')) + ' ' + formatTime(note.updatedAt ?? note.createdAt, t)),
                confirming
                  ? h('div', { className: 'sn-confirm' },
                      h('span', { className: 'sn-confirmText' }, t('note.deleteTitle')),
                      h('button', { type: 'button', className: 'sn-btn', onClick: () => setConfirming(false) }, t('note.keep')),
                      h('button', { type: 'button', className: 'sn-btn sn-btnPrimary', onClick: () => onDelete(note.id) }, t('note.confirmDelete'))
                    )
                  : h('div', { className: 'sn-cardActions' },
                      h('button', {
                        type: 'button', className: 'sn-iconBtn',
                        onClick: togglePin, 'data-action': 'pin',
                        title: isPinned ? t('note.unpinBtn') : t('note.pinBtn'),
                        'aria-label': isPinned ? t('note.unpinBtn') : t('note.pinBtn'),
                        'aria-pressed': isPinned ? 'true' : 'false'
                      }, '📌'),
                      h('button', {
                        type: 'button', className: 'sn-iconBtn',
                        onClick: toggleDone, 'data-action': 'done',
                        title: isDone ? t('note.undoneBtn') : t('note.doneBtn'),
                        'aria-label': isDone ? t('note.undoneBtn') : t('note.doneBtn'),
                        'aria-pressed': isDone ? 'true' : 'false'
                      }, isDone ? '↺' : '✓'),
                      h('button', { type: 'button', className: 'sn-iconBtn', onClick: startEdit, title: t('note.edit'), 'aria-label': t('note.edit') }, '✎'),
                      h('button', { type: 'button', className: 'sn-iconBtn', onClick: () => setConfirming(true), title: t('note.delete'), 'aria-label': t('note.delete') }, '✕')
                    )
              )
            )
      );
    }

    function NotesPanel({ t }) {
      const [notes, setNotes] = React.useState(() => loadNotes());
      const [filter, setFilter] = React.useState('all');
      const [search, setSearch] = React.useState('');
      React.useEffect(() => { saveNotes(notes); }, [notes]);

      const add = ({ kind, text }) => {
        const now = Date.now();
        setNotes((prev) => [{ id: newId(), kind, text, createdAt: now, updatedAt: now, done: false, pinned: false }, ...prev]);
      };
      const update = (id, patch) => {
        setNotes((prev) => prev.map((n) => n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n));
      };
      const remove = (id) => setNotes((prev) => prev.filter((n) => n.id !== id));

      const query = search.trim().toLowerCase();
      const matchesQuery = (n) => !query || n.text.toLowerCase().includes(query);
      const inScope = notes.filter((n) => (filter === 'all' || filter === 'done' || n.kind === filter) && matchesQuery(n));
      // Pinned notes float to the front of whatever list they belong to; among
      // themselves the most recently pinned wins, then creation order (the
      // array is already newest-first, so a stable sort keeps it).
      const pinRank = (a, b) => {
        const pa = a.pinned === true ? 1 : 0;
        const pb = b.pinned === true ? 1 : 0;
        if (pa !== pb) return pb - pa;
        if (pa === 1) return (b.pinnedAt ?? 0) - (a.pinnedAt ?? 0);
        return 0;
      };
      // Completed TODOs leave the main wall but stay on screen: they get their
      // own section at the bottom, newest completion first.
      const active = (filter === 'done' ? [] : inScope.filter((n) => n.done !== true)).slice().sort(pinRank);
      const done = inScope.filter((n) => n.done === true)
        .slice()
        .sort((a, b) => pinRank(a, b) || ((b.doneAt ?? b.updatedAt ?? 0) - (a.doneAt ?? a.updatedAt ?? 0)));
      const visibleCount = active.length + done.length;
      const doneSection = done.length > 0
        ? [
            h('div', { className: 'sn-sectionHead', key: 'done-head' },
              h('p', { className: 'sn-sectionTitle' }, '✓ ' + t('section.done')),
              h('span', { className: 'sn-sectionCount' }, String(done.length)),
              h('span', { className: 'sn-sectionRule' })
            ),
            h('div', { className: 'sn-wall', key: 'done-wall' },
              done.map((n) => h(NoteCard, { key: n.id, t, note: n, onUpdate: update, onDelete: remove }))
            )
          ]
        : null;

      return h('section', { className: 'sn-panel', 'aria-label': t('title') },
        h('div', { className: 'sn-head' },
          h('div', null,
            h('h1', { className: 'sn-title' }, t('title')),
            h('p', { className: 'sn-subtitle' }, t('subtitle'))
          ),
          h('div', { className: 'sn-actions' },
            h('input', {
              className: 'sn-search', type: 'search', value: search,
              placeholder: t('search.placeholder'),
              onChange: (e) => setSearch(e.target.value),
              'aria-label': t('search.placeholder')
            }),
            h('button', { type: 'button', className: 'sn-add', onClick: () => {
              const first = document.querySelector('.sn-newCard textarea');
              if (first) { first.focus(); first.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
            } }, t('add'))
          )
        ),
        h('div', { className: 'sn-filters', role: 'tablist', 'aria-label': t('title') },
          ['all', ...KINDS, 'done'].map((f) => h('button', {
            key: f, type: 'button', className: 'sn-chip', 'data-active': filter === f,
            onClick: () => setFilter(f)
          }, t('filter.' + f))),
          h('span', { className: 'sn-count', style: { alignSelf: 'center', marginLeft: 'auto' } },
            t('count').replace('{count}', String(visibleCount)))
        ),
        h('div', { className: 'sn-wall' },
          h(NewNoteCard, { t, onAdd: add }),
          active.map((n) => h(NoteCard, { key: n.id, t, note: n, onUpdate: update, onDelete: remove }))
        ),
        doneSection,
        notes.length === 0
          ? h('div', { className: 'sn-empty' },
              h('p', { className: 'sn-emptyTitle' }, t('empty.title')),
              h('p', { className: 'sn-emptyHint' }, t('empty.hint')))
          : (visibleCount === 0
              ? h('div', { className: 'sn-empty' }, h('p', { className: 'sn-emptyHint' }, t('empty.filtered')))
              : null)
      );
    }

    /* ------------------------------------------------------------------ */
    /* Plugin registration                                                 */
    /* ------------------------------------------------------------------ */
    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        const localeService = ctx.locale;
        const t = localeService && typeof localeService.bind === 'function'
          ? localeService.bind(NS)
          : (key) => zh[key] ?? key;

        // Register the dictionaries for the active locale service, so label
        // resolution follows the interface language instead of falling back.
        if (localeService && typeof localeService.register === 'function') {
          ctx.effect(() => localeService.register(NS, { zh, en }), 'sticky-notes: dictionaries');
        }

        if (injectedStyles.current === null) {
          injectedStyles.current = document.createElement('style');
          injectedStyles.current.textContent = css;
          document.head.appendChild(injectedStyles.current);
        }
        ctx.effect(() => () => {
          injectedStyles.current?.remove();
          injectedStyles.current = null;
        }, 'sticky-notes: styles');

        // Sidebar entry: icon + localized label; clicking selects the panel.
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: PANEL_ID,
          order: 15,
          locale: NS,
          label: () => t('panel')
        }, PanelIcon));

        // Main panel body, dispatched with the same id. The panel component
        // receives its `t` through the registration's inject share.
        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: PANEL_ID,
          locale: NS,
          inject: () => ({ t })
        }, NotesPanel));
      }
    };
  }
});
