# Office Viewer Enhanced 开发日志

**维护者**: RJ.Wang <wangrenjun@gmail.com>
**创建时间**: 2026-04-24
**项目**: Fork from [cweijan/vscode-office](https://github.com/cweijan/vscode-office)

---

## 架构要点

### 核心依赖关系

```
vscode-office (插件主体)
├── resource/vditor/vditor.js    ← 从 vditor/ submodule 源码构建
├── resource/vditor/lute.min.js  ← Vditor 自带的 Markdown 解析引擎（Go→JS）
├── resource/vditor/dist/js/mermaid/mermaid.min.js  ← Mermaid v11.14.0（独立文件，非 Vditor 构建产物）
├── resource/vditor/index.js     ← 编辑器初始化逻辑（我们直接修改）
├── resource/vditor/util.js      ← 工具栏配置（我们直接修改）
└── src/provider/markdownEditorProvider.ts  ← 扩展端 Markdown 编辑器提供者
```

### Vditor 构建流程

```bash
cd vditor/                          # git submodule (vscode-ext-studio/vditor)
npm install
npm run build                       # webpack 构建
cp dist/index.min.js ../resource/vditor/vditor.js   # 只复制这一个文件！
# 注意：不要复制 dist/js/mermaid/mermaid.min.js，那是旧版本（833KB）
# resource/vditor/dist/js/mermaid/mermaid.min.js 是我们自己放的 v11.14.0（3.1MB）
```

**⚠️ 关键注意事项**：
- Vditor 构建会在 `vditor/dist/` 下生成完整产物，包括旧版 mermaid
- 只取 `dist/index.min.js` → `resource/vditor/vditor.js`
- `resource/vditor/dist/` 目录下的文件是插件自己管理的，不要被 Vditor 构建覆盖

### 文件修改权限

| 文件 | 修改方式 | 说明 |
|------|----------|------|
| `resource/vditor/index.js` | 直接编辑 | 编辑器初始化、emoji 注入、editorMode |
| `resource/vditor/util.js` | 直接编辑 | 工具栏按钮配置 |
| `resource/vditor/vditor.js` | 从源码构建 | 修改 `vditor/src/` 后重新构建 |
| `resource/vditor/lute.min.js` | 不可修改 | Go 编译产物，需要 Go 环境重新编译 |
| `resource/vditor/dist/js/mermaid/mermaid.min.js` | 独立替换 | 当前 v11.14.0 |
| `src/provider/markdownEditorProvider.ts` | 直接编辑 | 扩展端逻辑 |

---

## 修改记录

### 1. Mermaid 渲染修复（v3.6.5 → v3.7.1）

**问题**：Vditor 原始代码使用 `mermaid.init()`（已废弃 API），在 Mermaid v11 下：
- 预览模式：多个图表互相串（图表内容混在一起）
- 编辑模式：部分图表类型报 "Syntax error"

**修改文件**：`vditor/src/ts/markdown/mermaidRender.ts`

**最终方案**：统一使用 `mermaid.run()` API，失败时 fallback 到 `mermaid.init()`

```typescript
// 修改前
mermaid.init(undefined, item);

// 修改后
mermaid.run({ nodes: pendingElements }).then(() => {
    // 标记已处理
}).catch(() => {
    // fallback 到 mermaid.init()
});
```

**踩过的坑**：
- ❌ 预览模式用 `mermaid.run()`、编辑模式用 `mermaid.init()` → 编辑模式还是有问题
- ❌ 自动点击预览按钮实现 preview 模式 → 会破坏 mermaid 渲染状态
- ✅ 统一用 `mermaid.run()` + fallback → 两种模式都正常


### 2. 预览模式大纲不完整（v3.7.2）

**问题**：大文档（800 行、15 个 mermaid 图表）在预览模式下，左侧大纲只显示前几个标题。

**原因**：`outlineRender.ts` 只遍历 `contentElement.children`（直接子元素），且 `outline.render()` 在预览按钮点击后 1 秒就执行，mermaid 异步渲染还没完成。

**修改文件**：
- `vditor/src/ts/markdown/outlineRender.ts` — 改用 `querySelectorAll("h1,h2,h3,h4,h5,h6")` 查找所有标题
- `vditor/src/ts/toolbar/Preview.ts` — 增加 3.5 秒后的二次大纲刷新

### 3. Unicode 12.0+ Emoji 支持（v3.6.6）

**问题**：🟡🟢🟥⬜ 等几何 emoji 在 Vditor 编辑器中不显示。

**原因**：Lute 解析引擎内置的 emoji 字典基于较旧的 Unicode 标准，缺少 Unicode 12.0（2019）新增的彩色几何 emoji。

**修改文件**：`resource/vditor/index.js`

**方案**：通过 Vditor 的 `hint.emoji` 配置注入缺失的 emoji 映射，Lute 初始化时会调用 `PutEmojis()` 将它们加入字典。

```javascript
emoji: {
    "yellow_circle": "🟡",
    "green_circle": "🟢",
    // ... 共 16 个
}
```

**不可行的方案**：
- 替换 Lute → 不可能，Lute 和 Vditor 深度耦合（83 处引用，27 个专用 API）
- 修改 lute.min.js → Go 编译产物，无法直接修改

### 4. 编辑器模式配置（v3.6.4）

**修改文件**：
- `package.json` — 新增 `vscode-office.editorMode` 配置项（wysiwyg/ir/sv）
- `resource/vditor/index.js` — 读取配置设置 Vditor 的 `mode`

**已移除的功能**：`preview` 模式选项。自动点击预览按钮会破坏 mermaid 渲染状态，无法修复。

### 5. Reload 按钮（v3.6.7）

**修改文件**：
- `resource/vditor/util.js` — 工具栏添加刷新按钮
- `resource/vditor/icon/refresh.svg` — 刷新图标
- `src/provider/markdownEditorProvider.ts` — 处理 `reload` 事件

**实现**：点击按钮 → WebView 发送 `reload` 事件 → 扩展端从磁盘读取文件 → 更新 VS Code document → 重新发送 `open` 事件完全重新初始化 Vditor。

**踩过的坑**：
- ❌ `handler.emit("update", content)` → 预览模式下不生效（只更新编辑器内容，不重新渲染预览）
- ✅ `handler.emit("open", buildOpenPayload())` → 完全重新初始化，两种模式都生效

### 6. Edit Mode 切换按钮（v3.6.4）

**修改文件**：`resource/vditor/util.js`

原始代码中 `"edit-mode"` 按钮被注释掉了（`// 屏蔽掉, 现版本都是针对一种模式优化`），恢复后用户可以在 wysiwyg/ir/sv 三种模式间切换。

### 7. 致谢章节（v3.6.4）

**修改文件**：`README.md`、`README-CN.md`

在 Credits 上方新增 Acknowledgements/致谢 章节，感谢两位上游作者：
- **cweijan** — 原始 vscode-office 作者 + Vditor 定制版维护者
- **Vanessa219 (Liyuan Li)** — Vditor 原始作者 / B3log 开源社区

### 8. 代码重构（v3.7.1）

**修改文件**：`src/provider/markdownEditorProvider.ts`

- 提取 `buildOpenPayload()` — `init` 和 `reload` 共用
- 提取 `reloadFromDisk()` — `fileChange` 和 `reload` 共用
- 重写 `getLocalResourceRoots()` — 默认只开放扩展/文档/工作区目录，仅在 `viewAbsoluteLocal` 开启时才开放整个文件系统
- 移除未使用的 `writeFile` import

### 9. 包体积优化（v3.7.3）

**修改文件**：`.vscodeignore`、`.gitignore`

从 vsix 包中排除：测试文件、临时截图、推广素材、旧 logo、SVG 源文件、开发配置文件。

从 git 中排除：`test/`、`image/`、`promo/`

将 `image/README-CN/screenshot.png` 移至 `images/screenshot.png`，删除 `image/` 目录。

包体积：8.6MB → 5.25MB

### 10. Obsidian 双链语法与别名显示支持（v3.7.4-1）

**需求**：支持 Obsidian 风格的双向链接语法 `[[笔记名]]` 与别名语法 `[[笔记名|别名显示]]`，且在所有模式（所见即所得 WYSIWYG、即时渲染 IR、预览 Preview）下均能正确解析并点击跳转。

**修改文件**：
- `resource/vditor/lute.min.js` — 替换为具备 Obsidian AST 支持的 Lute 引擎（支持 `SetObsidian(true)`）
- `resource/vditor/vditor.js` — 在 Lute 初始化工厂中调用 `t.SetObsidian&&t.SetObsidian(!0)` 全局启用 Obsidian 语法
- `resource/vditor/index.js` — 在 `after()` 初始化回调中补全启用
- `resource/vditor/util.js` — 拦截双链点击事件并发送 `wiki:` 前缀 IPC
- `src/provider/markdownEditorProvider.ts` — 处理 `wiki:` 前缀链接并在 VS Code 中打开实体文件，支持 `#标题` 锚点跳转

### 11. 行内公式重叠修复、双链编辑解耦与链接蓝（v3.7.4-2）

**问题**：
1. 升级 Lute 后，行内公式的 `<code data-type="math-inline">` 默认不带隐藏属性，导致未激活时灰色的 LaTeX 源码块与 KaTeX 渲染结果并排重复显示。
2. 双链颜色原为紫色，希望采用与传统超链接一致的经典链接蓝。
3. 双链点击事件截断过强，在所见即所得模式下无法直接原地光标展开原始语法打字编辑。

**修改文件**：
- `resource/vditor/vditor.css` — 
  - 添加 `code[data-type="math-inline"] { display: none; }` 彻底修复行内公式源码与渲染并排重叠的问题
  - 将双链颜色定义为标准链接蓝（浅色 `#0969da`、深色 `#58a6ff`）
  - 完善 `.vditor-ir__node--expand` 展开规则：激活时隐藏别名展示并展开原始 `[[目标|别名]]` 供打字修改，失焦时自动收起为别名
- `resource/vditor/util.js` —
  - 调整点击事件逻辑：普通单击移入展开原地编辑，仅在 `Ctrl/Cmd + 单击` 或 `双击` 时才触发外跳打开文件

### 12. Obsidian 风格 [[ 输入实时联想与跨库联动（v3.7.4-3）

**需求**：在编辑器中输入 `[[` 时，自动弹出类似 Obsidian 的下拉候选列表；支持按文件名和 frontmatter aliases 智能匹配；支持当前工作区及外部配置的 Obsidian Vault 跨库联动。

**修改文件**：
- `src/service/markdown/wikilinkService.ts`（新增）—
  - 双链核心单例服务：通过 `vscode.workspace.findFiles` 快速扫描工作区文件
  - 解析外部配置项 `vscode-office.obsidianVaultPath`（或自动侦测 `.obsidian` 目录），扫描外部 Vault
  - 超轻量解析 frontmatter aliases（仅读前 1500 字节，0 内存浪费）
  - 文件变动监听 (`FileSystemWatcher`)，实时更新内存索引
- `package.json` — 新增 `vscode-office.obsidianVaultPath` 配置项
- `resource/vditor/vditor.js` —
  - 修复 `getKey` 逻辑：解除原有 `:emoji` 必须前面带空格的限制，允许中文字符/标点后直接键入 `[[` 触发联想
  - 扩展 `fillEmoji`：当 `splitChar === "[["` 时自动将选中的双链转换为正确的 rich DOM 节点插入，保持所见即所得
  - 扩充候选容量上限至 16 项
- `resource/vditor/util.js` —
  - 在 `hotKeys` 中注册 `[[` 规则，支持文件名与 aliases 多维度模糊搜索
  - 自动识别光标是否处于表格环境：表格内自动将管道符转义为 `[[文件名\|别名]]`，避免破坏 Markdown 表格排版
- `resource/vditor/index.js` — 在 `open` 及 `wikilinksUpdated` 事件中与前端缓存表保持实时同步
- `resource/vditor/vditor.css` — 优化 `.vditor-hint` 联想菜单视觉层级、图标展示与最大滚动高度

### 13. 断链识别置灰、点击引导新建笔记与代码全面治理（v3.7.4-4）

**需求**：
1. 识别断链（未创建或不存在的笔记链接），在渲染时与有效链区分（断链呈灰色虚线下划线，悬浮提示并显示警告红）；
2. 点击断链时提供交互式引导，询问用户在当前目录或外部 Obsidian Vault 中一键新建该笔记；
3. 对新模块全面做可维护性与性能治理。

**修改文件**：
- `src/service/markdown/wikilinkService.ts` —
  - **文件句柄防泄漏**：`extractFrontmatterAliases` 采用 `try...finally` 严格保证 `closeSync(fd)` 释放；
  - **防死循环与软链环路**：`scanExternalVault` 引入真实路径 Set 判重与递归深度上限（depth $\le$ 12）；
  - **防抖节流**：文件变动监听引入 150ms 节流，防止 Git 切分支或批量操作引发高频重复扫描；
  - **多维解析增强**：`resolveFile` 增加对 frontmatter 别名的直接反查；暴露 `getVaultPath` 接口。
- `src/provider/markdownEditorProvider.ts` —
  - 监听注销清理：Webview 面板销毁时联动 `wikilinkSub.dispose()`；
  - 交互式新建笔记：未命中文件时弹窗询问并在指定目录初始化 `# 笔记名`，自动打开并同步索引。
- `resource/vditor/util.js` —
  - 维护快速哈希索引 `validTargetSet`，以 $O(1)$ 复杂度判定断链；
  - 增设 `syncWikilinksStatus` 与防抖监听，实时动态打上 `.vditor-wikilink--unresolved` 状态与提示气泡。
- `resource/vditor/index.js` — 启动 DOM 变动监听器 `initWikilinkObserver()`。
- `resource/vditor/vditor.css` — 增加暗色与浅色自适应的 `.vditor-wikilink--unresolved` 灰色虚线和悬停红色报警样式。

### 14. 白屏修复、版本对齐、配色简化与补全竞态修复（v3.7.4-5 → 3.7.4-7）

**问题与需求**：
1. **白屏重大 Bug**：`[[` 补丁在 `getKey` 中引入了字面换行符（`\n` 被展开成 0x0A），触发 `SyntaxError` → Vditor 未定义 → 编辑器全白（3.7.4-4 及之前受影响，3.7.4-2 正常）；
2. **版本策略**：`3.7.4.4` 违反 SemVer 无法打包；`-x` 预发布号低于正式版 `3.7.4`，会被商店检测降级更新。按用户决定统一 `3.7.4-x` + publisher `rjwang`，对齐上游版本，方便后续 merge 上游更新；防商店覆盖通过扩展面板禁用自动更新解决；
3. **配色简化**：有效链纯蓝 `#0050b3`、断链纯橙 `#D39815`，去下划线/半透明/hover 背景（hover 仅显示下划线）；此前编辑模式下双链显示黑色的根因：display 别名 span 未从父节点继承颜色，颜色只加在外层 span 上；
4. **行内公式无法编辑**：CSS 修复把 math-inline 源码 `display:none` 写成了无条件规则，覆盖掉 Vditor 点击展开时 JS 设置的 `style.display="inline"`，导致永远不可编辑；改为仅在非展开状态隐藏（`:not([style*="display: inline"])` + IR `:not(.vditor-ir__node--expand)`）；
5. **`[[` 补全不显示**：webview `open` 事件与扩展端异步 `refresh()` 存在竞态——索引未扫完就发送 open，后续 `wikilinksUpdated` 推送又早于 webview 监听器注册而丢失，候选表永远为空。三重修复：webview `after()` 主动 `emit("getWikilinks")`；`getWikilinks` 响应方 `await` 首次扫描 Promise（service 新增 `ready` 字段）；hint 回调发现空表时再触发一次拉取；
6. **`[[]]` 空双链不可删除**：Lute 把 `[[]]` 解析成 `data-href=""` 的空节点（标记隐藏、display 为空）→ 不可见且无法删除。修复：`syncWikilinksStatus` 将空节点 unwrap 回纯文本 `[[]]`（已验证 `VditorDOM2Md` 往返稳定），并加 CSS 兜底让空节点在清理前显示原始标记可删除。

**修改文件**：
- `resource/vditor/vditor.js` — 换行符转义修复（白屏根因）
- `resource/vditor/util.js` — 空 `[[]]` unwrap 清理；`[[` hint 空表兜底拉取
- `resource/vditor/index.js` — `after()` 内 `handler.emit("getWikilinks")`
- `resource/vditor/vditor.css` — 蓝/橙纯色配色（含 display span 继承）、行内公式可编辑条件、空双链兜底显示
- `src/service/markdown/wikilinkService.ts` — 新增 `ready` Promise
- `src/provider/markdownEditorProvider.ts` — `getWikilinks` 响应等待首次扫描
- `package.json` — 版本 `3.7.4-7`，publisher 恢复 `rjwang`

### 15. YAML 折叠卡片、编辑器去重与加载性能治理（v3.7.4-8）

**问题与需求**：
1. **YAML frontmatter 显示不优雅**：WYSIWYG 下只显示一个孤零零的 "F" 徽章（Lute 的默认样式），无法折叠/展开；
2. **打开方式出现两个本扩展编辑器**：`cweijan.markdownViewer` 与 `cweijan.markdownViewer.optional` 双注册导致 .md 右键"打开方式"重复；
3. **md 打开变慢**：索引扫描在扩展激活时即启动，且 `extractFrontmatterAliases` 对最多 3000 个文件逐个同步 `openSync/readSync`，阻塞扩展宿主事件循环。

**修复**：
- `resource/vditor/vditor.css` — YAML 块改为折叠卡片：默认收成 "YAML" 徽章（隐藏 pre），点击展开编辑（"YAML ▾" + 源码可见），光标离开自动收起；
- `resource/vditor/util.js` — `selectionchange` 新增 `syncYamlCollapse`；click 监听中点击 yaml 块 → 加 `yaml-collapse--active` 并把光标定位进 code；
- `package.json` + `src/extension.ts` — 删除 `cweijan.markdownViewer.optional` 注册，Open With 只剩一个；
- `src/service/markdown/wikilinkService.ts` — 全量扫描改为两阶段：先收集文件列表（目录遍历不读文件），再按 24 个一组 `fs.promises` 异步批量读别名（`readAliasesAsync`），事件循环不再被卡住；
- `src/provider/markdownEditorProvider.ts` — 索引初始化从构造函数移到首次 `resolveCustomTextEditor`（懒加载 + 不阻塞，`void initialize()`）。

**遗留说明（非本扩展问题）**：若"打开方式"仍有多个 Office Viewer 条目，是因为同时装了 `cweijan.vscode-office`（市场版）与本扩展，两者都会注册 md 编辑器，卸载其一即可。

### 16. E2E 排查体系建立与三大顽疾根治（v3.7.4-9）

**背景**：3.7.4-8 用户实测反馈"YAML 没折叠、`[[` 补全没弹、公式点不开"。教训：对压缩产物 vditor.js 盲改无法验证，必须建立可复现的浏览器级 E2E 环境。

**新增排查资产**：`scripts/e2e/e2e.html + e2e.cjs`（playwright-core 驱动本机 Edge 无头浏览器，加载真实 `resource/vditor/` 资源，桩 `events.open` 模拟 webview 打开文档；`python -m http.server 8765` 起服务）。探针覆盖：YAML 折叠/点击展开、`[[` 候选弹出/过滤/Enter 插入、公式点击编辑/连续输入/失焦收起、`[[]]` 空节点清理、pageerror 捕获。

**三个根因（全部经 harness 复现 → 修复 → 回归绿）**：
1. **补全从未弹出**：3.7.4-3 的 genHTML 补丁 `if(!(n>(r.splitChar==="[["?15:7)))` 中，回调内 `var r=e.html` 把外层 `r=this`（hint 实例）**变量遮蔽**成 undefined → 每次任何 hint 渲染都抛 `Cannot read properties of undefined (reading 'splitChar')`（连原生 emoji `:` 补全一起打死）。修复：把 `__max` 提升到 forEach 之前求值。
2. **公式点击编辑崩溃**：新 Lute 在 math-inline 的 `<code>` 与 `.vditor-wysiwyg__preview` 之间插入旧版 Vditor 不认识的 `<span class="vditor-cm-host">`；`ne()` 把"preview 的前一个兄弟"当源码容器 → 对空 cm-host 读 `.firstChild.firstChild` 抛 null 异常，点击展开链路整体炸断。修复：`syncWikilinksStatus` 每次渲染后移除 `.vditor-cm-host`，还原 code+preview 结构。
3. **公式编辑态保持与 YAML 展开竞态**：a) `<code>` 自身也带 `data-type="math-inline"`，`closest()` 命中 code 本身导致按父级比较的判断失效 → 键入一个字符即被 SpinVditorDOM 重渲染折叠；修复为 `activeMath===code || code.contains(activeMath)` 并新增 `syncMathInlineEdit`（selectionchange 驱动源码可见性，编辑不被重渲染打断）。b) YAML 点击展开被紧随的 selectionchange 立即收回：改捕获阶段监听 + `data-yamlHold` 600ms 宽限期 + 展开后 `void offsetWidth` 强制重排再定位光标。

**验证结果（headless Edge 实测）**：YAML 默认 `display:none`+徽章、点击展开 `block`；`[[` 弹 5 候选、`[[全新` 过滤到 2、Enter 插入 `[[全新世温度]]`；公式点击 `inline-block` 可连输、离开收起；`[[]]` 无残留；pageerror 清零。

**回归命令**：
```bash
python -m http.server 8765 --bind 127.0.0.1 &
node scripts/e2e/e2e.cjs
```

---

### 17. 双链补全增强 + YAML 原生属性面板 + 单波浪修正（v3.7.4-10）

1. **补全三模式**（util.js 回调解析 + vditor.js 配套补丁）：`[[名称`（文件名/别名）、`[[名称#片段`（目标笔记章节，经 `getHeadings` IPC 由扩展端实时读标题）、`[[名称|片段`（别名+章节作显示文本），并支持闭合节点续写 `[[名]]#`/`[[名]]|`。配套：render 改块级文本定位（Range.toString）、fillEmoji 经 `window.__wlSetBlockOffset` 做块偏移→(节点,偏移)映射、getKey 放行续写模式；候选扩容 16。
2. **候选确认键**：↑/↓ 原生支持；**Tab 确认**经 util.js capture 阶段 keydown 拦截（Vditor 的 `tab:'	'` 处理在目标阶段会吞 preventDefault，必须 capture + 直接 click 当前候选按钮）；Enter 原生。
3. **YAML**：发现新版 Lute **原生输出 `.vditor-properties` 属性面板 + hidden 源码 pre**，弃用自造卡片方案，仅从 4.x 移植/重写面板 CSS：默认显示属性表格（源码 hidden），点击展开 raw 源码编辑、光标离开自动收回；写回经实测零污染（properties 节点被 Lute 识别跳过）。
4. **单波浪 `~x~` 误删除线**：新 Lute 无 `SetGFMStrikethrough1` 独立开关（只有总开关，关掉会连 `~~` 一起失效）→ 纯 CSS 修正 WYSIWYG：`s[data-marker="~"]` 去删除线并以 ::before/::after 补显 `~` 标记（IR 模式 marker 本就显式，无需处理）。已知限制：整体预览面板 `<del>` 无属性可区分。
5. **光标乱跳修复**：根因 = `[[]]` 清理/cm-host 移除的 DOM 手术与光标竞态（replaceWith 销毁光标所在节点 → 浏览器重置 caret 到段首）。新增 `cursorInside` 守卫：光标在手术节点内则本轮跳过、300ms 后重试。
6. **工具栏 Obsidian 按钮**：`icon/obsidian.svg`（simple-icons 官方 logo 路径），点击发 `openInObsidian` → 扩展端拼 `obsidian://open?vault=&file=`（文件在已配置/检测 Vault 内）或 `obsidian://open?path=`（外部路径兜底）。
7. E2E 补 P1-P7 探针全绿；关键教训：harness 点击段落末尾必须用元素 rect，collapsed Range 的 getBoundingClientRect 是 0 导致"假 bug"两轮。

---

### 18. 索引排除对齐 Obsidian 惯例 + README 特性章节（v3.7.4-11）

1. **排除加固**（`wikilinkService.ts`）：此前仅排除 `.obsidian/.git/.vscode/node_modules/dist/out/build`，会漏掉 Vault 内其它点目录（PaperBell 实测存在 `.trash`、`.claude`、`.smart-env` 类、`.ruff_cache`、`.consensus-research`、`.playwright-cli` 等）与 `resolveFile` 兜底 findFiles 只排 `node_modules` 的问题。现统一为：
   - 工作区扫描与兜底搜索：排除 `**/{.*,node_modules,dist,out,build,target,__pycache__}/**`（一切点号目录）；
   - 外部 Vault 遍历：跳过 `startsWith('.')` 的全部目录 + node_modules/venv/构建目录；
   - 文件监听增量：点号目录内新建/修改的 md 不进索引；
   - 对齐 Obsidian 自身（忽略一切点目录）与 PaperBell `.gitignore` 口径。
2. **README**：新增《Obsidian 双链增强（本分支）》中英双语章节，收录相对 upstream 的全部特性、`3.7.4-x` 版本约定与 `git merge upstream/main` 跟进流程。

---

### 19. wikiExclude 自定义排除 + .obsidian 显式排除（v3.7.4-12）

1. **`.obsidian` 排除核实**：`-11` 曾用 `**/{.*,...}/**` 通配点目录，但 `.*` 段在 VS Code glob 引擎下对隐藏目录语义不够直白。现基础排除改回**显式列表**：`{node_modules,dist,out,build,target,__pycache__,.git,.vscode,.obsidian,.trash}`（工作区扫描 + resolveFile 兜底两处），外部 Vault 遍历维持"一切点开头目录跳过"，监听增量同守卫。
2. **新增 `vscode-office.wikiExclude`（string[]）**：用户自定义排除目录/文件（支持裸名如 `02_输出`、glob 如 `drafts/**`、`*.private.md`）。实现为零正则风险的"路径段包含"匹配（`isCustomExcluded`），应用于工作区扫描、Vault 遍历、文件监听增量三处；配置变更即时触发重扫。
3. README 双语章节同步补文档。

---

### 20. [[]] Backspace 光标乱跳与括号汤根治（v3.7.4-13）

**现象**：从尾部 Backspace 删除 `[[花粉]]` 时光标跳到句首；空链保存往返膨胀为 `[[[[]]]]`。
**根因（架构对比）**：Obsidian Live Preview（CodeMirror6）在原文之上画装饰，编辑永远作用于原始文本；Vditor WYSIWYG 是"重写 contenteditable DOM + wbr 还原光标"，任何旁路 DOM 手术（`[[]]` unwrap、cm-host 移除）打在光标所在块都会重置选区。叠加 Lute 自身缺陷：`[[]]`→空节点→`VditorDOM2Md` 输出 `[[[[]]]]`（实测，且循环稳定）。
**修复三层**：
1. `resource/vditor/index.js` 保存层 `normalizeWikilinkSoup`：任何只含方括号/竖线/空白的"括号汤"在每次 save 前归一为 `[[]]`，文件稳定收敛（Obsidian 语义一致）；
2. `resource/vditor/util.js` 光标守卫升级为**块级** `cursorNear`（节点与光标所在块有任何包含关系即跳过手术）；
3. 移除 300ms 重试定时器（打字中途动 DOM 的元凶），改由 selectionchange 去抖触发——手术只在光标离开块后进行；空节点在清理前由 CSS 显式渲染 `[[ ]]` 标记，视觉即纯文本，无闪变。
**E2E P8**：连续 12 次 Backspace：光标零逃逸、保存 md 零括号汤 ✓

---

### 21. 采纳"零手术"方案：彻底移除 [[]] DOM unwrap（v3.7.4-15）

**决策背景**：块级光标守卫虽非破坏性修改（纯 fork 本地防御，upstream 无此代码路径，merging 零冲突），但按"更保守"方针进一步收敛——**编辑区 DOM 彻底不做结构手术**，与上游行为差异更小。

**新方案（三层，全绿验证于历轮 E2E）**：
1. 实测确认：正文中的 `[[]]` Lute 本就不解析成节点（P6 emptyNodeCount=0），"空节点"仅是编辑瞬时中间态；
2. 删除 unwrap 手术及其重试——光标乱跳的根源（DOM 结构变更摧毁 Vditor wbr 光标还原）从机制上消除；空链内容由 CSS 显示 `[[]]` 字面标记，用户直接 Backspace 删除即可；
3. 文件层由保存时 `normalizeWikilinkSoup` 收敛括号汤（P8 SAVED-MD soup-free=true）。
`.vditor-cm-host` 移除保留（空占位永不承载光标，节点级守卫，非结构性、无选区风险——首点即开公式 P7b=inline-block 依赖它）。

**E2E 已知局限**：探针共用文档+clickPEnd"末段落"定位，相互有污染（# 与 | 模式各在某轮全绿过），逐探针独立 fixture 属后续改进项。

---

### 21. 采纳"零手术"方案：[[]] 以字面文本呈现、用户直接删除（v3.7.4-15）

响应"是否破坏性"的质疑做的收敛决策：块级光标守卫虽是 fork 本地逻辑（与上游零冲突），但它服务的 `[[]]` unwrap 手术本身已无存在必要——CSS（`[data-href=""] .vditor-ir__marker{display:inline}` + ::before/::after 补显）已让空链接**视觉即字面 `[[]]` 文本**，用户可用 Backspace 像普通字符一样删除；文件层 `normalizeWikilinkSoup` 收敛闭合括号汤。因此：
- **移除 `[[]]` unwrap DOM 手术**（编辑区结构性手术归零，光标乱跳隐患从根上消失，不再依赖任何守卫时机）；
- 块级守卫随之撤销，仅保留 `.vditor-cm-host`（永不承载光标的空占位）的节点级守卫即时移除；
- selectionchange 撤销为 unwrap 加的额外触发；
- AGENTS.md 第 0 条改写为"编辑区禁结构性手术"红线。
E2E：P6 字面文本存在 ✓；P8 连续 Backspace 光标零逃逸、闭合汤保存归一 ✓。

---

### 22. YAML 改源码常显（去折叠）+ 双链退格全面接管（v3.7.4-16）

1. **YAML 按用户定案移除折叠/属性面板切换**：状态机（forceExpandYaml/syncYamlCollapse/yaml-collapse--active）整体删除——Vditor 每键重解析所在块会丢失自定义展开类导致"打字弹回+光标丢"，与状态机搏斗不如消灭状态机。CSS 改为源码（含 `---` 围栏伪元素）常显、属性面板隐藏，编辑=原生打字。E2E P1/P10：编辑持久、失焦不变、文件同步 ✓。
2. **双链 Backspace 同步接管（`wlBackspace` capture keydown）**：逐字删从 ]] 外啃入产生的残缺双链是光标跳段的根因（Lute 每键重解析+wbr 还原对残缺态失效）。方案：一律接管不放行原生，删光标左侧字符并**同步 data-href/title**（关键！stale href 会让 Lute 重解析按旧目标重铸 atom → 括号汤爆炸，实测 step4 转折定位）；内容删空即整节点原子摘除+块级标记延迟 unwrap。E2E P9：`[[全新世温度]]` 14 次连退全程 no-jump/no-soup/final='' ✓。
3. `openLink(editor)` 传参修复，接管后主动 getValue+保存层归一推 save（preventDefault 吞原生 input）。

---

### 23. 表格内退格致整表塌陷修复 + 双链边界光标泛化（v3.7.4-17）

**症状（用户 GIF 逐帧取证）**：表格单元格内 `[[全新世温度]]` 光标置于 `]]` 之后退格 → 单个 `]` 被啃 → 残缺双链 → 列数失衡 → 整表塌成一行纯文本（用户看到的"无色断链"实为塌陷后的残体文本，不再是链接；裸/断链颜色规则本身在容器级、正常）。
**根因**：`wlBackspace` 的"光标紧邻 atom 左侧"识别只覆盖了 `文本节点起点→previousSibling 即 atom` 一种形态；单元格内光标与 atom 之间常隔着 `]]` marker span（prev 是 marker 非 atom）→ 识别失败 → 放行原生啃括号。
**修复**：泛化邻接识别——文本起点回溯（跳过空文本）与元素容器取前一子节点两种入口；marker 经 `closest(WL_SEL)` 归位到 atom。E2E P11 新增：表格 fixture + 单元格内点击→End→7 连退：行数稳定 ✓、单元格清空 ✓。
**E2E 治理（用户点单"不复杂就处理"）**：探针组间重载 fixture（P4/P8/P11 前 __openDoc 重置）——上轮 # 模式"时好时坏"的跨探针段落污染即此因；重载后 P4 #/| 双模式同轮全绿（§×3 候选+插入、PollenDB 候选+插入），P8 saved soup-free=true。

---

### 24. 别名双链复制损坏 + 表格转义误判断链修复（v3.7.4-18）

**用户报告**：①复制 `[[KEY|Shakun, 2012, Nat]]` 粘贴得到"显示名+隐藏源码"粘连团；②表格内按规范写 `\|` 转义的双链被标成橙色断链。
**取证**：lute.min.js 直测：`[[A\|B]]`（表内/表外同构）→ `data-href="A\"`（**尾反斜杠残留**，判链必失配→断链）；display=B、source=`A\|B`、往返无损。复制损坏=浏览器对 contenteditable 选区取 textContent，把 display 与 hidden source 两段文本拼成非法串。
**修复（util.js）**：
1. `cleanWikilinkHref()`：判链与 openLink 跳转前剥反斜杠（表格转义链不再误判、跳转解析正确目标）；
2. `copy` capture 拦截：选区含双链节点时剪贴板按 `[[源码]]` 形态序列化（源码 span 优先，保留 `\|`，表内粘贴不坏）；
3. `paste` capture 拦截：表格单元内粘贴含 `|` 双链自动转义 `|]]`→`\|]]` 再插入。
**E2E**：P12 clipboard=`[[花粉数据集\|PollenDB]]` ✓；P13 转义链 not-broken ✓；P9 修正探针键数(6)后 no-jump/no-soup/final='' 全绿；P11 表格 tr 稳定+单元格清空 ✓；P8 saved 零括号汤且表格行保持 ✓。
**Obsidian 跨机原理澄清**：`vscode.env.openExternal` 恒在**本机 OS** 执行（remote-SSH 下也代理回本地客户端），"Open in Obsidian"天然打开本机 Obsidian，无需开关；两台机器路径一致+库同步时 vault+file 与 path 寻址都命中本机副本。

---

### 25. 远程编辑器回归修复（恢复 -8 误删的 optional 注册）+ 展开态源码着色（v3.7.4-19）

1. **远程（浏览器/code-server 连集群）md 不再用自定义编辑器打开**：用户实测 -5 远程正常、之后失效。定位：v3.7.4-8 把 `cweijan.markdownViewer.optional`（selector `*.md` 全 scheme）当作"重复注册"删除，但主条目 `cweijan.markdownViewer` 的 selector 是 `file:/**/*.md`（仅匹配标准 file scheme）——远程窗口的 md URI 形态不匹配主条目，-5 时代实际生效的正是 optional。恢复双注册（package.json + extension.ts），与 -5 行为对齐。教训：上游的"重复"注册往往是 scheme 兼容层，删除前必须先问"另一条为什么存在"。
2. **展开态源码颜色**：`--expand .vditor-wikilink__source` 的蓝色规则只有 `.vditor-ir` 作用域（橙色断链规则两种模式都写了），导致"点击展开后正常链黑字、断链有色"的不对称观感。补 `.vditor-wysiwyg` 作用域同款蓝色。

---

## 发布流程

```bash
# 1. 构建
npm run build

# 2. 如果修改了 vditor 源码
cd vditor && npm run build && cd ..
cp vditor/dist/index.min.js resource/vditor/vditor.js
# ⚠️ 不要复制 vditor/dist/js/mermaid/

# 3. 打包
npx vsce package --no-dependencies

# 4. 发布
npx vsce publish --no-dependencies          # VS Code Marketplace
npx ovsx publish *.vsix                      # Open VSX (需要 OVSX_PAT 环境变量)
gh release create vX.Y.Z *.vsix --title "vX.Y.Z" --notes "..."  # GitHub Releases
```

---

## 已知限制

1. **Lute 不可替换** — 与 Vditor 深度耦合，83 处引用，27 个专用 API
2. **Lute emoji 字典不完整** — 只能通过 `PutEmojis` 注入缺失项，无法修改 lute.min.js
3. **预览模式自动切换不可用** — 自动点击预览按钮会破坏 mermaid 渲染状态
4. **Vditor 不再活跃维护** — 最后有意义的更新在 2022-2023 年
