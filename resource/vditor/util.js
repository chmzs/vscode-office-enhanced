const latexSymbols = [
    // 运算符
    { name: 'log', value: "\\log" },
    // 关系运算符
    { name: 'pm', value: "\\pm" },
    { name: 'times', value: "\\times" },
    { name: 'leq', value: "\\leq" },
    { name: 'eq', value: "\\eq" },
    { name: 'geq', value: "\\geq" },
    { name: 'neq', value: "\\neq" },
    { name: 'approx', value: "\\approx" },
    { name: 'prod', value: "\\prod" },
    { name: 'bigodot', value: "\\bigodot" },
    // 逻辑符号
    { name: 'exists', value: "\\exists" },
    { name: 'forall', value: "\\forall" },
    { name: 'rightarrow', value: "\\rightarrow" },
    { name: 'leftarrow', value: "\\leftarrow" },
    // 三角函数符号
    { name: 'sin', value: "\\sin" },
    { name: 'cos', value: "\\cos" },
    { name: 'tan', value: "\\tan" },
    // 函数
    { name: 'fraction', value: "\\frac{}{}" },
    { name: 'sqrt', value: "\\sqrt{}" },
    { name: 'sum', value: "\\sum_{i=0}^n" },
    // 希腊数字
    { name: 'alpha', value: "\\alpha" },
    { name: 'beta', value: "\\beta" },
    { name: 'Delta', value: "\\Delta" },
    { name: 'delta', value: "\\delta" },
    { name: 'epsilon', value: "\\epsilon" },
    { name: 'theta', value: "\\theta" },
    { name: 'lambda', value: "\\lambda" },
    { name: 'Lambda', value: "\\Lambda" },
    { name: 'phi', value: "\\phi" },
    { name: 'Phi', value: "\\Phi" },
    { name: 'omega', value: "\\omega" },
    { name: 'Omega', value: "\\Omega" },
];

// 空双链保存层净化：Lute 会把 `[[]]` 解析为空节点且 VditorDOM2Md 往返会膨胀成
// `[[[[]]]]` 类括号汤（Obsidian 语义：空链即普通文本）。在每次 save 前归一为 `[[]]`。
const _bs = String.fromCharCode(92);
const WIKI_SOUP_RE = new RegExp(_bs + '[' + _bs + '[' + '[' + _bs + '[' + _bs + ']' + '|' + _bs + 't' + ' ' + ']' + '*' + _bs + ']' + _bs + ']', 'g');
export function normalizeWikilinkSoup(md) {
    return String(md == null ? '' : md).replace(WIKI_SOUP_RE, '[[]]');
}

// 标题锚点定位：在编辑区 DOM 里找匹配标题并滚动到视口中部
export function revealHeading(anchor) {
    if (!anchor) return false;
    const slug = (t) => String(t || '').trim().toLowerCase().split('\u200b').join('').replace(/\s+/g, '-').replace(/[^\w一-鿿-]/g, '');
    const want = slug(anchor);
    if (!want) return false;
    const els = document.querySelectorAll('.vditor-wysiwyg h1, .vditor-wysiwyg h2, .vditor-wysiwyg h3, .vditor-wysiwyg h4, .vditor-wysiwyg h5, .vditor-wysiwyg h6, .vditor-ir h1, .vditor-ir h2, .vditor-ir h3, .vditor-ir h4, .vditor-ir h5, .vditor-ir h6');
    for (const el of els) {
        const txt = slug((el.textContent || '').replace(/[\[\]()]/g, ''));
        if (txt === want || (txt && txt.startsWith(want))) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return true;
        }
    }
    return false;
}

/** 表格内 \| 转义双链：Lute 会把反斜杠留在 data-href 上，判链/跳转前需还原 */
export function cleanWikilinkHref(href) {
    const bs = String.fromCharCode(92);
    return String(href == null ? '' : href).split(bs).join('');
}

let cachedWikilinks = [];
let validTargetSet = new Set();
let syncTimer = null;

export function setWikilinksCache(list) {
    cachedWikilinks = list || [];
    headingCache.clear();
    validTargetSet = new Set();
    for (const item of cachedWikilinks) {
        if (item.name) {
            validTargetSet.add(item.name.toLowerCase());
            validTargetSet.add(`${item.name}.md`.toLowerCase());
        }
        if (item.relPath) {
            validTargetSet.add(item.relPath.toLowerCase());
            validTargetSet.add(item.relPath.replace(/\\/g, '/').toLowerCase());
        }
        if (item.aliases && item.aliases.length > 0) {
            for (const alias of item.aliases) {
                validTargetSet.add(alias.toLowerCase());
            }
        }
    }
    debouncedSyncWikilinksStatus();
}

export function debouncedSyncWikilinksStatus() {
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(syncWikilinksStatus, 100);
}

export function syncWikilinksStatus() {
    // 节点级守卫：空占位 span（.vditor-cm-host）永不承载光标，可安全即时移除；
    // 除它以外，本函数对编辑区零 DOM 手术（历史教训：[[]] unwrap 手术引发光标乱跳）
    const sel = window.getSelection();
    const focus = sel && sel.anchorNode;
    const cursorInNode = (node) => {
        if (!focus) return false;
        const el = focus.nodeType === 1 ? focus : focus.parentElement;
        return !!el && node.contains(el);
    };

    // 新版 Lute 在行内公式里渲染 vditor-cm-host 空占位 span，旧版 Vditor 的 ne() 点击
    // 展开逻辑会把"前一个兄弟节点"当源码容器（r.firstChild 为 null 直接抛错），
    // 统一移除以还原 code+preview 结构
    document.querySelectorAll('.vditor-cm-host').forEach(el => {
        if (cursorInNode(el)) return;
        el.remove();
    });

    // 空双链 [[]]：不做任何 DOM 手术——CSS 已令其显示为 `[[]]` 字面文本，
    // 用户按普通文字直接删除即可；文件层由 normalizeWikilinkSoup 收敛括号汤。

    const links = document.querySelectorAll('[data-type="wikilink"], .obsidian-wikilink');
    if (!links || links.length === 0) return;
    links.forEach(link => {
        const rawHref = cleanWikilinkHref(link.dataset?.href);
        const page = rawHref.split('#')[0].trim().toLowerCase();
        if (!page) {
            // 页内纯锚点链接，不判定为断链
            link.classList.remove('vditor-wikilink--unresolved');
            return;
        }
        const isResolved = validTargetSet.has(page) || validTargetSet.has(`${page}.md`);
        if (isResolved) {
            link.classList.remove('vditor-wikilink--unresolved');
            link.title = rawHref;
        } else {
            link.classList.add('vditor-wikilink--unresolved');
            link.title = `未创建的笔记: ${rawHref} (点击可新建)`;
        }
    });
}

export function initWikilinkObserver() {
    const editorEl = document.getElementById('vditor');
    if (!editorEl) return;
    const observer = new MutationObserver(() => {
        debouncedSyncWikilinksStatus();
    });
    observer.observe(editorEl, { childList: true, subtree: true });
    debouncedSyncWikilinksStatus();
}

export const hotKeys = [
    {
        key: '\\',
        hint: (key) => {
            if (document.getSelection()?.anchorNode?.parentElement?.getAttribute('data-type') != "math-inline") {
                return []
            }
            const results = !key ? latexSymbols : latexSymbols.filter((symbol) => symbol.name.toLowerCase().startsWith(key.toLowerCase()));
            return results.map(com => ({
                html: com.name, value: com.value
            }));
        },
    },
    {
        key: '[[',
        hint: async (key) => {
            // 索引未就绪时主动拉取一次（解决插件启动扫描与 open 事件的竞态）
            if (!cachedWikilinks.length) {
                handler.emit('getWikilinks');
            }
            const raw = key || '';

            // 光标是否在表格内（表格内管道符转义为 \|）
            const anchor = window.getSelection()?.anchorNode;
            const anchorEl = anchor?.nodeType === 1 ? anchor : anchor?.parentElement;
            const inTable = !!(anchorEl?.closest?.('table, tr, td, th'));
            const pipe = inTable ? '\\|' : '|';

            // 解析三种模式：
            //   [[名称片段            → 文件名/别名候选
            //   [[名称#片段 / [[名]]#片段 → 目标笔记章节候选
            //   [[名称|片段 / [[名]]|片段 → 显示文本（别名+章节）候选
            const m = raw.match(/^([^\[\]\|]*?)\]\]\s*([#\|])([^#\[\]\|]*)$/)
                || raw.match(/^([^\[\]\|]*?)([#\|])([^#\[\]\|]*)$/);
            const page = m ? m[1].trim() : raw.trim();
            const mode = m ? m[2] : '';
            const frag = (m ? m[3] : '').toLowerCase();
            const fragRaw = m ? m[3] : '';
            const ql = page.toLowerCase();
            const results = [];
            const push = (value, html) => results.push({ value, html });

            // 找到 page 对应的笔记（先精确名，再路径后缀，再大小写）
            const findNote = (name) => {
                const n = name.toLowerCase();
                return cachedWikilinks.find(x => x.name.toLowerCase() === n)
                    || cachedWikilinks.find(x => (x.relPath || '').toLowerCase().replace(/\\/g, '/').endsWith('/' + n + '.md'))
                    || cachedWikilinks.find(x => (x.relPath || '').toLowerCase().replace(/\\/g, '/').endsWith(n + '.md'));
            };

            if (mode === '#' || mode === '|') {
                const note = findNote(page);
                const target = note ? note.name : page;
                if (!target) return [];
                const headings = await requestHeadings(target);
                if (mode === '#') {
                    for (const h of headings) {
                        if (!frag || h.toLowerCase().includes(frag)) {
                            push(`[[${target}#${h}]]`,
                                `<span class="vditor-hint__doc-icon">§</span> <span class="vditor-hint__title">${h}</span><span class="vditor-hint__sub">→ ${target}</span>`);
                        }
                        if (results.length >= 16) break;
                    }
                    if (!results.length && !headings.length) {
                        push(`[[${target}]]`, `<span class="vditor-hint__doc-icon">📄</span> <span class="vditor-hint__title">（无章节）${target}</span>`);
                    }
                } else {
                    const aliases = (note && note.aliases) || [];
                    for (const a of [...aliases, ...headings]) {
                        if (!frag || a.toLowerCase().includes(frag)) {
                            push(`[[${target}${pipe}${a}]]`,
                                `<span class="vditor-hint__doc-icon">🔗</span> <span class="vditor-hint__title">${a}</span><span class="vditor-hint__sub">显示为 · ${target}</span>`);
                        }
                        if (results.length >= 16) break;
                    }
                }
                return results;
            }

            // 默认模式：文件名 + 别名候选
            for (const item of cachedWikilinks) {
                const nameMatches = !ql || item.name.toLowerCase().includes(ql);
                if (nameMatches) {
                    push(`[[${item.name}]]`,
                        `<span class="vditor-hint__doc-icon">📄</span> <span class="vditor-hint__title">${item.name}</span>${item.relPath ? `<span class="vditor-hint__sub">${item.relPath}</span>` : ''}`);
                }
                if (item.aliases && item.aliases.length > 0) {
                    for (const alias of item.aliases) {
                        if (!ql || alias.toLowerCase().includes(ql)) {
                            push(`[[${item.name}${pipe}${alias}]]`,
                                `<span class="vditor-hint__doc-icon">🔗</span> <span class="vditor-hint__title">${alias}</span> <span class="vditor-hint__sub">→ ${item.name}</span>`);
                        }
                    }
                }
                if (results.length >= 16) break;
            }
            return results;
        }
    }
]

// ===== 章节标题按需检索（扩展端往返 + 缓存） =====
const headingCache = new Map();
const pendingHeadings = {};
let headingReqId = 0;

export function requestHeadings(page) {
    const k = page.toLowerCase();
    if (headingCache.has(k)) return Promise.resolve(headingCache.get(k));
    const id = ++headingReqId;
    return new Promise(res => {
        pendingHeadings[id] = res;
        handler.emit('getHeadings', { id, page });
        setTimeout(() => {
            if (pendingHeadings[id]) { delete pendingHeadings[id]; res([]); }
        }, 1500);
    });
}

export function feedHeadings(data) {
    const resolve = pendingHeadings[data && data.id];
    if (!resolve) return;
    delete pendingHeadings[data.id];
    const headings = (data.headings || []).filter(h => h && !h.includes('#'));
    headingCache.set(String(data.page || '').toLowerCase(), headings);
    resolve(headings);
}

// 块级文本偏移 → (文本节点, 偏移) 映射：供 fillEmoji 在跨 span 的双链节点/续写场景中正确定位删除起点
window.__wlSetBlockOffset = (range, blockOffset) => {
    try {
        let node = range.startContainer;
        if (node.nodeType === 3) {
            if (blockOffset <= node.length) { range.setStart(node, blockOffset); return true; }
        }
        // 找到块容器
        let block = node.nodeType === 1 ? node : node.parentElement;
        while (block && block.nodeType === 1) {
            if (block.hasAttribute && (block.hasAttribute('data-block') || block.classList.contains('vditor-reset'))) break;
            block = block.parentElement;
        }
        if (!block) return false;
        let remain = blockOffset;
        const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, null);
        for (let tn = walker.nextNode(); tn; tn = walker.nextNode()) {
            const len = tn.textContent.length;
            if (remain <= len) { range.setStart(tn, remain); return true; }
            remain -= len;
        }
        return false;
    } catch (_) { return false; }
};

function loadRes(url) {
    return fetch(url).then(r => r.text())
}

const isMac = navigator.userAgent.includes('Mac OS');
const shortcutTip = isMac ? '⌘ ^ E' : 'Ctrl Alt E';

export async function getToolbar(resPath) {
    return [
        'outline',
        "headings",
        "bold",
        "italic",
        "strike",
        "link",
        "|",
        {
            tipPosition: 's',
            tip: 'Reload file from disk',
            className: 'right',
            icon: await loadRes(`${resPath}/icon/refresh.svg`),
            click() {
                handler.emit("reload")
            }
        },
        {
            tipPosition: 's',
            tip: `Edit In VSCode (${shortcutTip})`,
            className: 'right',
            icon: await loadRes(`${resPath}/icon/vscode.svg`),
            click() {
                handler.emit("editInVSCode", true)
            }
        },
        {
            tipPosition: 's',
            tip: `Quick open`,
            className: 'right',
            icon: await loadRes(`${resPath}/icon/codicon-files.svg`),
            click() {
                handler.emit("quickOpen", true)
            }
        },
        {
            tipPosition: 's',
            tip: 'Export To Pdf',
            className: 'right',
            icon: await loadRes(`${resPath}/icon/pdf.svg`),
            click() {
                handler.emit("export")
            }
        },
        {
            tipPosition: 's',
            tip: 'Open in Obsidian',
            className: 'right',
            icon: await loadRes(`${resPath}/icon/obsidian.svg`),
            click() {
                handler.emit("openInObsidian")
            }
        },
        { name: 'upload', tipPosition: 'e' },
        "|",
        {
            name: 'selectTheme',
            tipPosition: 's', tip: 'Select Theme',
            icon: 'Theme:',
            click() {
                handler.emit("theme")
            }
        },
        {
            tipPosition: 's', tip: 'Select Theme',
            icon: await loadRes(`${resPath}/icon/theme.svg`),
            click() {
                handler.emit("theme")
            }
        },
        "|",
        "edit-mode",
        "code-theme",
        // "|",
        "list",
        "ordered-list",
        "check",
        "table",
        "|",
        "quote",
        "line",
        "code",
        "inline-code",
        "|",
        "undo",
        "redo",
        "|",
        "preview",
        "help",
    ]
}

/**
 * 针对wysiwyg和ir两种模式对超链接做不同的处理
 */
export const openLink = (editor) => {
    const clickCallback = e => {
        let ele = e.target;
        const isSpecial = ['dblclick', 'auxclick'].includes(e.type);
        // 只有按住 Ctrl/Cmd 单击，或者双击/中键时，才触发链接跳转
        if (!isCompose(e) && !isSpecial) {
            return;
        }

        // 处理 Obsidian wikilink (预览模式下的 a 标签)
        if (ele.classList.contains('obsidian-wikilink') || ele.dataset?.href) {
            const href = cleanWikilinkHref(ele.dataset?.href);
            if (href) {
                e.preventDefault();
                e.stopPropagation();
                handler.emit("openLink", `wiki:${href}`);
                return;
            }
        }
        // 处理 Obsidian wikilink (WYSIWYG/IR 模式下的 span 节点)
        const wikilink = ele.closest?.('[data-type="wikilink"], [data-type="wikilink-embed"]');
        if (wikilink) {
            const href = cleanWikilinkHref(wikilink.dataset?.href);
            if (href) {
                e.preventDefault();
                e.stopPropagation();
                handler.emit("openLink", `wiki:${href}`);
                return;
            }
        }
        if (ele.tagName == 'A') {
            e.preventDefault();
            e.stopPropagation();
            handler.emit("openLink", ele.href);
        } else if (ele.tagName == 'IMG') {
            const parent = ele.parentElement;
            if (parent?.tagName == 'A' && parent.href) {
                e.preventDefault();
                e.stopPropagation();
                handler.emit("openLink", parent.href);
                return;
            }
            const src = ele.src;
            if (src?.match(/http/)) {
                e.preventDefault();
                e.stopPropagation();
                handler.emit("openLink", src);
            }
        }
    }

    const wysiwyg = document.querySelector(".vditor-wysiwyg");
    if (wysiwyg) {
        wysiwyg.addEventListener('dblclick', clickCallback);
        wysiwyg.addEventListener('click', clickCallback);
        wysiwyg.addEventListener('auxclick', clickCallback);
    }
    const reset = document.querySelector(".vditor-reset");
    if (reset) {
        reset.addEventListener("scroll", e => {
            // 滚动有偏差
            handler.emit("scroll", { scrollTop: e.target.scrollTop - 70 })
        });
    }
    const ir = document.querySelector(".vditor-ir");
    if (ir) {
        ir.addEventListener('dblclick', clickCallback);
        ir.addEventListener('click', clickCallback);
        ir.addEventListener('auxclick', clickCallback);
        ir.addEventListener('click', e => {
            let ele = e.target;
            if (ele.classList.contains('vditor-ir__link')) {
                ele = e.target.nextElementSibling?.nextElementSibling?.nextElementSibling
            }
            if (ele.classList.contains('vditor-ir__marker--link')) {
                handler.emit("openLink", ele.textContent)
            }
        });
    }
    const preview = document.querySelector(".vditor-preview");
    if (preview) {
        preview.addEventListener('dblclick', clickCallback);
        preview.addEventListener('click', clickCallback);
        preview.addEventListener('auxclick', clickCallback);
    }

    // 监听光标选区与点击：进入双链时展开原始 [[xxx|display]] 源码供直接编辑；离开时自动收起为别名
    const syncWikilinkExpand = () => {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;
        const range = selection.getRangeAt(0);
        const container = range.startContainer;
        const currentWikilink = container.nodeType === 1 
            ? container.closest?.('[data-type="wikilink"]') 
            : container.parentElement?.closest?.('[data-type="wikilink"]');

        document.querySelectorAll('.vditor-ir__node--expand[data-type="wikilink"]').forEach(node => {
            if (node !== currentWikilink) {
                node.classList.remove('vditor-ir__node--expand');
            }
        });

        if (currentWikilink) {
            currentWikilink.classList.add('vditor-ir__node--expand');
        }
    };

    document.addEventListener('selectionchange', () => {
        syncWikilinkExpand();
        syncMathInlineEdit();
    });

    // 行内公式编辑态：新 Lute 不再给 math-inline 的 code 打 style="display:none"，
    // 我们的 CSS 会把它藏起来；而每次键入 SpinVditorDOM 都会重建节点。这里在每次
    // 选区变化时按"光标是否在公式源码内"强制同步源码可见性，保证连续打字不被折叠打断。
    const syncMathInlineEdit = () => {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;
        const container = selection.getRangeAt(0).startContainer;
        const anchorEl = container.nodeType === 1 ? container : container.parentElement;
        const activeMath = anchorEl?.closest?.('[data-type="math-inline"]');
        document.querySelectorAll('.vditor-wysiwyg [data-type="math-inline"] > code').forEach(code => {
            // 注意：code 自身也带 data-type="math-inline"，closest() 会命中它本身
            const keep = !!activeMath && (activeMath === code || code.contains(activeMath));
            const target = keep ? 'inline-block' : '';
            if (code.style.display !== target) code.style.display = target;
        });
    };

    // Tab 确认候选：capture 阶段先于 Vditor 的 tab 插入与 hint.select，直接触发当前高亮项。
    // （select() 对 Tab 的 preventDefault 不足以阻止 tab:'\t' 功能自身的 insertText）
    document.addEventListener('keydown', e => {
        if (e.key !== 'Tab' || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey || e.isComposing) return;
        const hint = [...document.querySelectorAll('.vditor-hint')]
            .find(h => !h.closest('.vditor-toolbar') && h.style.display === 'block' && h.querySelector('button'));
        if (!hint) return; // 无候选弹层时不拦截，保留正常缩进
        e.preventDefault();
        e.stopPropagation();
        const cur = hint.querySelector('.vditor-hint--current') || hint.querySelector('button');
        cur && cur.click(); // 复用 Vditor 绑定的按钮 click → fillEmoji 插入
    }, true);

    // —— YAML 编辑：不做折叠/面板切换状态机（源码由 CSS 常显，编辑即原生行为）——

    // —— 双链节点 Backspace 确定性接管（同步按键路径，非异步旁路手术）——
    // 症状：逐字退格啃到 ]] 标记外 → 出现 [[x] 残缺双链 → Vditor 每键全段重解析
    // 且 wbr 光标还原失效 → 光标跳段首。方案：光标在节点内且左侧尚有正文字符时
    // 放行原生（删除正文不破坏闭合括号，安全）；其余贴边场景接管——从内容/别名
    // 尾部逐字缩进，删空即整节点原子摘除（=用户验证无问题的"整节点删除"路径）。
    // 删除后主动 editor.getValue() 推送保存（preventDefault 会吞掉原生 input 事件）。
    const WL_SEL = '.vditor-ir__node[data-type=\"wikilink\"], .vditor-ir__node[data-type=\"wikilink-embed\"]';
    const wlAtomDelete = (node) => {
        const sel = window.getSelection();
        const keep = document.createRange();
        keep.setStartBefore(node);
        keep.collapse(true);
        const kill = document.createRange();
        kill.selectNode(node);
        kill.deleteContents();
        if (sel) { sel.removeAllRanges(); sel.addRange(keep); }
    };
    const wlBackspace = (e) => {
        if (e.key !== 'Backspace' || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey || e.isComposing) return;
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return;
        const range = sel.getRangeAt(0);
        const el = range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement;
        let node = el && el.closest ? el.closest(WL_SEL) : null;
        if (!node) {
            // 泛化"光标紧邻 atom 左侧"识别：容器文本起点回溯、元素容器取前一子节点；
            // 表格单元格内光标与 atom 之间常隔着 ]] marker span（此前漏识别 → 原生
            // 啃掉一个 ] → 残缺双链 → 列数失衡 → 整表塌成纯文本），marker 经 closest 归位
            let cand = null;
            const sc = range.startContainer;
            const so = range.startOffset;
            if (sc.nodeType === 3 && so === 0) {
                let pr = sc.previousSibling;
                while (pr && pr.nodeType === 3 && !(pr.textContent || '').length) pr = pr.previousSibling;
                cand = pr;
            } else if (sc.nodeType === 1 && so > 0) {
                cand = sc.childNodes[so - 1] || null;
            }
            if (cand && cand.nodeType === 1) {
                node = cand.matches && cand.matches(WL_SEL) ? cand : (cand.closest ? cand.closest(WL_SEL) : null);
            }
        }
        if (!node || node.closest('.vditor-properties')) return;
        // 一律接管（不放行原生）：原生删到最后一个字符会把内容清空而 data-href 仍是旧目标，
        // Lute 重解析按 stale href 重铸 atom → 括号汤。删光标左侧字符并同步 href/title。
        e.preventDefault();
        e.stopPropagation();
        const spans = [...node.children].filter(x => !x.classList.contains('vditor-ir__marker'));
        const target = spans[spans.length - 1];
        const t = target && target.firstChild;
        if (t && (t.textContent || '').length > 0) {
            const txt = t.textContent || '';
            const at = (t === range.startContainer)
                ? Math.max(0, Math.min(range.startOffset, txt.length) - 1)
                : txt.length - 1;
            t.textContent = txt.slice(0, at) + txt.slice(at + 1);
            const r = document.createRange();
            r.setStart(t, Math.min(at, t.textContent.length));
            r.collapse(true);
            sel.removeAllRanges();
            sel.addRange(r);
            if (spans.length === 1) {
                const ph = (t.textContent || '').replace(/​/g, '');
                node.dataset.href = ph;
                node.title = ph;
            }
        } else {
            wlAtomDelete(node);
            const holder = node.closest('[data-block]') || (node.parentElement && node.parentElement.closest('.vditor-reset') ? node.parentElement : null);
            if (holder) holder.dataset.wlJustAtomDeleted = '1';
        }
        try {
            if (editor && typeof editor.getValue === 'function') {
                handler.emit('save', normalizeWikilinkSoup(editor.getValue()));
            }
        } catch { /* ignore */ }
    };
    ['.vditor-wysiwyg', '.vditor-ir'].forEach(hostSel => {
        const host = document.querySelector(hostSel);
        if (host) host.addEventListener('keydown', wlBackspace, true);
    });

    // —— 复制序列化：选区含双链节点时，剪贴板文本按 [[页面|别名]] 源码形态输出。
    // 否则浏览器取 DOM 纯文本 = 显示名+隐藏源码 的粘连团（用户实测粘贴损坏）。
    const onWlCopy = (e) => {
        if (!e.clipboardData) return;
        const selNow = window.getSelection();
        if (!selNow || selNow.rangeCount === 0 || selNow.isCollapsed) return;
        const frag = selNow.getRangeAt(0).cloneContents();
        const nodes = frag.querySelectorAll ? frag.querySelectorAll('[data-type="wikilink"], [data-type="wikilink-embed"]') : [];
        if (!nodes.length) return;
        nodes.forEach(n => {
            const spans = [...n.children].filter(x => x.className.indexOf('marker') < 0);
            const src = spans[spans.length - 1];
            const href = cleanWikilinkHref(n.getAttribute('data-href'));
            let text = src ? (src.textContent || '').split('​').join('') : href;
            if (!text) text = href;
            n.textContent = (n.getAttribute('data-type') === 'wikilink-embed' ? '!' : '') + '[[' + text + ']]';
        });
        const box = document.createElement('div');
        box.appendChild(frag);
        e.clipboardData.setData('text/plain', box.textContent || '');
        e.preventDefault();
    };
    // —— 粘贴防护：表格单元格里粘贴含别名的双链，自动转义为 \|，防止竖线截断表格 ——
    const onWlPaste = (e) => {
        if (!e.clipboardData) return;
        const text = e.clipboardData.getData('text/plain') || '';
        if (text.indexOf('[[') < 0 || text.indexOf('|') < 0) return;
        const selNow = window.getSelection();
        const f = selNow && selNow.anchorNode;
        const el = f && (f.nodeType === 1 ? f : f.parentElement);
        if (!el || !el.closest || !el.closest('table')) return;
        const bs = String.fromCharCode(92);
        const esc = text.split('|]]').join(bs + '|]]');
        if (esc === text) return;
        e.preventDefault();
        document.execCommand('insertText', false, esc);
    };
    ['.vditor-wysiwyg', '.vditor-ir'].forEach(hostSel => {
        const host = document.querySelector(hostSel);
        if (host) {
            host.addEventListener('copy', onWlCopy, true);
            host.addEventListener('paste', onWlPaste, true);
        }
    });

    const wlUnwrapEmpty = () => {
        document.querySelectorAll('[data-type="wikilink"][data-href=""], [data-type="wikilink-embed"][data-href=""]').forEach(node => {
            const holder = node.closest('[data-block]');
            if (!holder || !holder.dataset.wlJustAtomDeleted) return;
            const selNow = window.getSelection();
            const f = selNow && selNow.anchorNode;
            const el = f && (f.nodeType === 1 ? f : f.parentElement);
            if (el && node.contains(el)) return; // 光标已回 atom 内则不动它
            const keep = document.createRange();
            keep.setStartBefore(node);
            keep.collapse(true);
            const txt = document.createTextNode(node.textContent || '[[]]');
            node.replaceWith(txt);
            if (selNow) { selNow.removeAllRanges(); selNow.addRange(keep); }
        });
    };
    ['.vditor-wysiwyg', '.vditor-ir'].forEach(hostSel => {
        const host = document.querySelector(hostSel);
        if (host) host.addEventListener('keyup', wlUnwrapEmpty, true);
    });
    document.addEventListener('click', (e) => {
        const wikilink = e.target.closest?.('[data-type="wikilink"]');
        if (wikilink && !isCompose(e)) {
            wikilink.classList.add('vditor-ir__node--expand');
        }
    });
}

export function scrollEditor(top) {
    const scrollHack = setInterval(() => {
        const editorContainer = document.querySelector(".vditor-reset");
        if (!editorContainer) return;
        editorContainer.scrollTo({ top })
        clearInterval(scrollHack)
    }, 10);
}


//监听选项改变事件
export function onToolbarClick(editor) {
    document.querySelector('.vditor-toolbar').addEventListener("click", (e) => {
        let target = e.target, type;
        for (let i = 0; i < 3; i++) {
            if (type = target.dataset.type) break;
            target = target.parentElement;
        }
        if (type == 'outline') {
            handler.emit("saveOutline", editor.vditor.options.outline.enable)
        }
    })
}

export const createContextMenu = (editor) => {
    const menu = document.getElementById('context-menu')
    document.addEventListener("mousedown", e => {
        if (!e.target?.classList?.contains('dropdown-item')) {
            menu.classList.remove('show')
            menu.style.display = 'none'
        }
    });
    document.oncontextmenu = e => {
        e.stopPropagation();
        var top = e.pageY;
        var left = e.pageX + 10;
        menu.style.display = 'block'
        menu.style.top = top + "px";
        menu.style.left = left + "px";
        menu.classList.add('show')
    }
    menu.onclick = e => {
        menu.style.display = 'none'
        menu.classList.remove('show')
        const id = e.target.getAttribute("id");
        switch (id) {
            case "copy":
                document.execCommand("copy")
                break;
            case "paste":
                if (document.getSelection()?.toString()) { document.execCommand("delete") }
                vscodeEvent.emit('command', 'office.markdown.paste')
                break;
            case "exportPdf":
                vscodeEvent.emit('export', { type: 'pdf' })
                break;
            case "exportPdfWithoutOutline":
                vscodeEvent.emit('export', { type: 'pdf', withoutOutline: true })
                break;
            case "exportDocx":
                vscodeEvent.emit('export', { type: 'docx' })
                break;
            case "exportHtml":
                vscodeEvent.emit('export', { type: 'html' })
                break;
        }
    }
}

export const imageParser = (viewAbsoluteLocal) => {
    if (!viewAbsoluteLocal) return;
    var observer = new MutationObserver(mutationList => {
        for (var mutation of mutationList) {
            for (var node of mutation.addedNodes) {
                if (!node.querySelector) continue;
                const imgs = node.querySelectorAll('img')
                for (const img of imgs) {
                    const url = img.src;
                    if (url.startsWith("http")) { continue; }
                    if (url.startsWith("vscode-webview-resource") || url.includes("file:///")) {
                        img.src = `https://file+.vscode-resource.vscode-cdn.net/${url.split("file:///")[1]}`
                    }
                }
            }
        }
    });
    observer.observe(document, {
        childList: true,
        subtree: true
    });
}

function matchShortcut(hotkey, event) {

    const matchAlt = hotkey.match(/!/) != null == event.altKey
    const matchMeta = hotkey.match(/⌘/) != null == event.metaKey
    const matchCtrl = hotkey.match(/\^/) != null == event.ctrlKey
    const matchShifter = hotkey.match(/\+/) != null == event.shiftKey

    if (matchAlt && matchCtrl && matchShifter && matchMeta) {
        return hotkey.match(new RegExp(`\\b${event.key}\\b`, "i"))
    }

}


/**
 * 自动补全符号
 */
// const keys = ['"', "{", "("];
const keyCodes = [222, 219, 57];
export const autoSymbol = (handler, editor, config) => {
    let _exec = document.execCommand.bind(document)
    document.execCommand = (cmd, ...args) => {
        if (cmd === 'delete') {
            setTimeout(() => {
                return _exec(cmd, ...args)
            })
        } else {
            return _exec(cmd, ...args)
        }
    }
    window.addEventListener('keydown', async e => {
        if (matchShortcut('^⌘e', e) || matchShortcut('^!e', e)) {
            e.stopPropagation();
            e.preventDefault();
            return handler.emit("editInVSCode", true);
        }

        if (isMac && config.preventMacOptionKey && e.altKey && e.shiftKey && ['Digit1', 'Digit2', 'KeyW'].includes(e.code)) {
            return e.preventDefault();
        }
        if (e.code == 'F12') return handler.emit('developerTool')
        if (isCompose(e)) {
            if (e.altKey && isMac) {
                e.preventDefault()
            }
            switch (e.code) {
                case 'KeyS':
                    vscodeEvent.emit("doSave", editor.getValue());
                    e.stopPropagation();
                    e.preventDefault();
                    break;
                case 'KeyV':
                    if (e.shiftKey) {
                        const text = await navigator.clipboard.readText();
                        if (text) document.execCommand('insertText', false, text.trim());
                        e.stopPropagation();
                    }
                    else if (document.getSelection()?.toString()) {
                        // 修复剪切后选中文本没有被清除
                        document.execCommand("delete")
                    }
                    e.preventDefault();
                    break;
            }
        }
        if (!keyCodes.includes(e.keyCode)) return;
        const selectText = document.getSelection().toString();
        if (selectText != "") { return; }
        if (e.key == '(') {
            document.execCommand('insertText', false, ')');
            document.getSelection().modify('move', 'left', 'character')
        } else if (e.key == '{') {
            document.execCommand('insertText', false, '}');
            document.getSelection().modify('move', 'left', 'character')
        } else if (e.key == '"') {
            document.execCommand('insertText', false, e.key);
            document.getSelection().modify('move', 'left', 'character')
        }
    }, isMac ? true : undefined)

    window.onresize = () => {
        document.getElementById('vditor').style.height = `${document.documentElement.clientHeight}px`
    }
    let app;
    let needFocus = false;
    window.onblur = () => {
        if (!app) { app = document.querySelector('.vditor-reset'); }
        // 纯文本没有offsetTop, 所以需要拿父节点
        const targetNode = document.getSelection()?.baseNode?.parentNode;
        // 如果编辑器现在没有获得焦点, 则无需重获焦点
        if (!app?.contains(targetNode)) {
            needFocus = false;
            return;
        }
        // 判断是否需要聚焦
        const curPosition = targetNode?.offsetTop ?? 0;
        const appPosition = app?.scrollTop ?? 0;
        if (appPosition - curPosition < window.innerHeight) {
            needFocus = true;
        }
    }
    window.onfocus = () => {
        if (!app) { app = document.querySelector('.vditor-reset'); }
        if (needFocus) {
            app.focus()
            needFocus = false;
        }
    }
}