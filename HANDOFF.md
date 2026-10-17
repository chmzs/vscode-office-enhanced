# 项目交接卡 (Hot SSOT)

## 1. 停滞断点与当前状态
- **当前版本**: v3.7.5（发布者已改为 `chmzs`，彻底脱离市场版本覆盖；白屏 SyntaxError 修复完毕）。
- **已交付功能**:
  1. Obsidian 双链语法 `[[目标|别名]]` 多模式渲染与原地所见即所得展开编辑；
  2. 行内数学公式源码重叠 bug 修复，双链经典链接蓝高亮；
  3. `[[` 输入实时联想补全（支持文件名、frontmatter aliases、表格自适应 `\|` 转义）；
  4. 跨工作区与外部 `obsidianVaultPath` 双向索引与跳转打开；
  5. 断链（未创建笔记）识别与置灰区分显示（灰色虚线下划线，悬停红）；
  6. 点击断链交互式引导一键新建笔记（支持当前目录或 Obsidian 知识库）。
- **关键问题修复**:
  - 修复 `vditor.js` 字符串中字面量换行导致的 `SyntaxError`（导致白屏的根因）；
  - 修复 SemVer 预发布负权导致的 VS Code 商店自动检测更新（改为 `3.7.5` + `publisher: chmzs`）。
- **当前停滞断点**: 所有功能交付且白屏根因修复，等待 GitHub Release 构建完成。

## 2. 一键验证命令
```bash
# 1. 验证 JS 语法无报错
node --check resource/vditor/vditor.js && node --check resource/vditor/util.js
# 2. 检查 GitHub Actions Release 构建与发布状态
gh run list -R chmzs/vscode-office-enhanced --limit 3
```

## 3. 试错黑名单（严禁踩坑）
- ❌ **版本号四段式与负权前缀**: `@vscode/vsce` 强制遵循 SemVer（拒绝 `3.7.4.4`）；且 `-4` 被判为预发布版导致 VS Code 提示升级商店 `3.7.4`。必须使用正向非负权版本（`3.7.5`）并改 publisher 为 `chmzs`。
- ❌ **JS 注入字面量换行**: 在压缩的单行 JS 里替换代码切勿漏出原始 `\n` 字节，必须使用转义符 `\\n`，否则引发词法解析 SyntaxError 白屏。
- ❌ **行内公式 CSS 取消**: 切勿移除 `code[data-type="math-inline"] { display: none; }`。

## 4. 下一步原子动作
新会话接手后若开启新特性：
1. 从 GitHub Releases 下载 `vscode-office-enhanced-3.7.5.vsix` 验证安装；
2. 遵循 `AGENTS.md` 约定的架构与规范继续迭代。
