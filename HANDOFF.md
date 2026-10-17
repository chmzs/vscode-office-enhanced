# 项目交接卡 (Hot SSOT)

## 1. 停滞断点与当前状态
- **当前版本**: v3.7.4-5（保持 `3.7.4-x` 与上游及 publisher 严格对齐；白屏 SyntaxError 彻底修复）。
- **已交付功能**:
  1. Obsidian 双链语法 `[[目标|别名]]` 多模式渲染与原地所见即所得展开编辑；
  2. 行内数学公式源码重叠 bug 修复，双链经典链接蓝高亮；
  3. `[[` 输入实时联想补全（支持文件名、frontmatter aliases、表格自适应 `\|` 转义）；
  4. 跨工作区与外部 `obsidianVaultPath` 双向索引与跳转打开；
  5. 断链（未创建笔记）识别与置灰区分显示（灰色虚线下划线，悬停红）；
  6. 点击断链交互式引导一键新建笔记（支持当前目录或 Obsidian 知识库）。
- **关键问题修复**:
  - **白屏根因**: `vditor.js` 中字符串字面量错误漏出 `0x0A` 换行字节触发词法 `SyntaxError`，已用 `\\n` 修复并通过 `node --check` 机械验证；
  - **版本与防覆盖**: 依指示保持 `3.7.4-5`，防商店更新只需在扩展列表中点击齿轮禁用自动更新。
- **当前停滞断点**: 核心功能全部闭环，等待 Tag 构建验证。

## 2. 一键验证命令
```bash
# 1. 验证所有 Webview JS 语法无报错
node --check resource/vditor/vditor.js && node --check resource/vditor/util.js
# 2. 检查 GitHub Actions Release 构建与发布状态
gh run list -R chmzs/vscode-office-enhanced --limit 3
```

## 3. 试错黑名单（严禁踩坑）
- ❌ **版本号四段式**: `@vscode/vsce` 强制遵循 SemVer（拒绝 `3.7.4.4`），修补统一用 `3.7.4-x`。
- ❌ **JS 注入字面量换行**: 在单行 JS 中替换代码严禁漏出原始 `\n` 换行符，必须使用转义符 `\\n`，否则引发解析失败白屏。
- ❌ **行内公式 CSS 取消**: 切勿移除 `code[data-type="math-inline"] { display: none; }`。

## 4. 下一步原子动作
新会话接手后若开启新特性：
1. 从 GitHub Releases 下载 `vscode-office-enhanced-3.7.4-5.vsix` 安装并在插件设置禁用自动更新；
2. 遵循 `AGENTS.md` 约定的架构与规范继续迭代。
