import { openLink, hotKeys, setWikilinksCache, feedHeadings, normalizeWikilinkSoup, revealHeading, initWikilinkObserver, imageParser, getToolbar, autoSymbol, onToolbarClick, createContextMenu, scrollEditor } from "./util.js";

let state;
function loadConfigs() {
  const elem = document.getElementById('configs')
  try {
    state = JSON.parse(elem.getAttribute('data-config'));
    const { platform } = state;
    document.getElementById('vditor').classList.add(platform)
  } catch (error) {
    console.log('loadConfigFail')
  }
  return state;
}
loadConfigs()

handler.on("open", async (md) => {
  const { config, language, wikilinks, revealAnchor } = md;
  if (wikilinks) {
    setWikilinksCache(wikilinks);
  }
  handler.on("wikilinksUpdated", (list) => {
    setWikilinksCache(list);
  });
  // 章节标题按需检索结果的回传入口
  handler.on("headingsResult", (data) => feedHeadings(data));
  handler.on('revealHeading', (a) => revealHeading(a));
  window.__revealHeading = revealHeading; // E2E 测试钩子（P15 探针）
  addAutoTheme(md.rootPath, config.editorTheme)
  handler.on('theme', theme => {
    loadTheme(md.rootPath, theme)
  })
  const editor = new Vditor('vditor', {
    value: md.content,
    _lutePath: md.rootPath + '/lute.min.js',
    cdn: md.rootPath,
    height: document.documentElement.clientHeight,
    outline: {
      enable: config.openOutline,
      position: 'left',
    },
    toolbarConfig: {
      hide: config.hideToolbar
    },
    cache: {
      enable: false,
    },
    mode: config.editorMode || 'wysiwyg',
    lang: language == 'zh-cn' ? 'zh_CN' : config.editorLanguage,
    icon: "material",
    tab: '\t',
    preview: {
      theme: {
        path: `${md.rootPath}/css/content-theme`
      },
      markdown: {
        toc: true,
        codeBlockPreview: config.previewCode,
      },
      hljs: {
        style: config.previewCodeHighlight.style,
        lineNumber: config.previewCodeHighlight.showLineNumber
      },
      extPath: md.rootPath,
      math: {
        engine: 'KaTeX',
        "inlineDigit": true
      }
    },
    toolbar: await getToolbar(md.rootPath),
    extPath: md.rootPath,
    input(content) {
      handler.emit("save", normalizeWikilinkSoup(content))
    },
    upload: {
      url: '/image',
      accept: 'image/*',
      handler(files) {
        let reader = new FileReader();
        reader.readAsBinaryString(files[0]);
        reader.onloadend = () => {
          handler.emit("img", reader.result)
        };
      }
    },
    hint: {
      delay: 50,
      emoji: {
        // Unicode 12.0+ geometric emoji missing from Lute's built-in dict
        "orange_circle": "🟠",
        "yellow_circle": "🟡",
        "green_circle": "🟢",
        "purple_circle": "🟣",
        "brown_circle": "🟤",
        "red_square": "🟥",
        "blue_square": "🟦",
        "orange_square": "🟧",
        "yellow_square": "🟨",
        "green_square": "🟩",
        "purple_square": "🟪",
        "brown_square": "🟫",
        "white_large_square": "⬜",
        "black_large_square": "⬛",
        "speech_balloon": "💬",
        "star": "⭐",
      },
      extend: hotKeys
    }, after() {
      // 启用 Obsidian 双链语法支持
      if (editor.vditor && editor.vditor.lute) {
        editor.vditor.lute.SetObsidian(true);
      }
      // 编辑器就绪后拉取最新双链索引（扩展端扫描是异步的，open 事件可能早于扫描完成）
      handler.emit("getWikilinks");
      if (revealAnchor) {
        const t = (n) => { if (n <= 0 || !revealHeading(revealAnchor)) { if (n > 0) setTimeout(() => t(n - 1), 400); } };
        setTimeout(() => t(6), 400);
      }
      handler.on("update", content => {
        editor.setValue(content);
      })
      openLink(editor)
      onToolbarClick(editor)
    }
  })
  autoSymbol(handler, editor, config);
  createContextMenu(editor)
  imageParser(config.viewAbsoluteLocal)
  initWikilinkObserver()
  scrollEditor(md.scrollTop)
  zoomElement('.vditor-content')
}).emit("init")


function addAutoTheme(rootPath, theme) {
  loadCSS(rootPath, 'base.css')
  loadTheme(rootPath, theme)
}

function loadTheme(rootPath, theme) {
  loadCSS(rootPath, `theme/${theme}.css`)
  document.getElementById('vditor').setAttribute('data-editor-theme', theme)
}

function loadCSS(rootPath, path) {
  const style = document.createElement('link');
  style.rel = "stylesheet";
  style.type = "text/css";
  style.href = `${rootPath}/css/${path}`;
  document.documentElement.appendChild(style)
}