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
