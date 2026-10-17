# 项目交接卡 (Hot SSOT)

## 1. 停滞断点与当前状态
- **当前版本**: v3.7.4-4（全套功能与代码治理加固完毕）。
- **已交付功能**:
  1. Obsidian 双链语法 `[[目标|别名]]` 多模式渲染与原地所见即所得展开编辑；
  2. 行内数学公式源码重叠 bug 修复，双链经典链接蓝高亮；
  3. `[[` 输入实时联想补全（支持文件名、frontmatter aliases、表格自适应 `\|` 转义）；
  4. 跨工作区与外部 `obsidianVaultPath` 双向索引与跳转打开；
  5. 断链（未创建笔记）识别与置灰区分显示（灰色虚线下划线，悬停红）；
  6. 点击断链交互式引导一键新建笔记（支持当前目录或 Obsidian 知识库）。
- **代码治理**: WikilinkService 文件句柄 try-finally 保护、软链深度判重防死循环、文件变动 150ms 节流防抖、Set O(1) 状态匹配。
- **当前停滞断点**: 所有指定需求均已落地闭环。代码停留在发布后的 `main` 分支干净工作区。

## 2. 一键验证命令
```bash
# 1. 检查 GitHub Actions Release 构建与发布状态
gh run list -R chmzs/vscode-office-enhanced --limit 3
# 2. 检查本地工作区状态与远端对齐
git status && git remote -v
```

## 3. 试错黑名单（严禁踩坑）
- ❌ **版本号四段式**: `@vscode/vsce` 强制遵循 SemVer，写成 `3.7.4.1` 会直接导致打包报错退出，必须采用 `3.7.4-x`。
- ❌ **行内公式 CSS 取消**: 切勿移除 `code[data-type="math-inline"] { display: none; }`，新版 Lute 默认会漏显源码。
- ❌ **上游混淆**: 上游底座为 `rjwang1982/vscode-office`（远程名 `upstream`），开发仓为 `chmzs/vscode-office-enhanced`（远程名 `origin`），勿推向错的 remote。
- ❌ **输入前缀空格限制**: Vditor 原生 `getKey` 要求 splitChar 前必须带空格，已解除；修改 vditor.js 时勿还原该逻辑。

## 4. 下一步原子动作
新会话接手后若开启新特性：
1. 运行验证命令确认当前 Release 产物；
2. 在新功能分支或 `main` 上开发，遵循 `AGENTS.md` 约定的架构与规范。
