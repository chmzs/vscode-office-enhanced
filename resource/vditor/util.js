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
]

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
export const openLink = () => {
    const clickCallback = e => {
        let ele = e.target;
        const isSpecial = ['dblclick', 'auxclick'].includes(e.type);
        // 只有按住 Ctrl/Cmd 单击，或者双击/中键时，才触发链接跳转
        if (!isCompose(e) && !isSpecial) {
            return;
        }

        // 处理 Obsidian wikilink (预览模式下的 a 标签)
        if (ele.classList.contains('obsidian-wikilink') || ele.dataset?.href) {
            const href = ele.dataset?.href;
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
            const href = wikilink.dataset?.href;
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

    document.addEventListener('selectionchange', syncWikilinkExpand);
    document.addEventListener('click', (e) => {
        const target = e.target;
        const wikilink = target.closest?.('[data-type="wikilink"]');
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