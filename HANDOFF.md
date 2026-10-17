# 项目交接卡 (Hot SSOT)

## 1. 停滞断点与当前状态
- **当前版本**: v3.7.4-3（已在 GitHub 成功构建并发布 Release）。
- **完成功能**:
  1. Obsidian 双链语法 `[[目标|别名]]` 渲染与所见即所得展开编辑；
  2. 修复行内公式重叠 bug，双链标准蓝色高亮；
  3. `[[` 输入实时联想补全（支持文件名、frontmatter aliases、表格内 `\|` 转义）；
  4. 支持工作区与外部 `obsidianVaultPath` 跨库索引与文件跳转打开。
- **当前待办断点**: 待规划后续特性（断链识别与灰色虚线区分显示，点击断链询问新建笔记）。代码停留在 `resource/vditor/util.js:160` 及 `src/service/markdown/wikilinkService.ts:180`。

## 2. 一键验证命令
```bash
# 1. 验证构建流水线正常（或通过 GitHub Actions 云端打包）
gh run list -R chmzs/vscode-office-enhanced --limit 3
# 2. 检查本地 git 状态与分支对齐
git status && git remote -v
```

## 3. 试错黑名单（严禁踩坑）
- ❌ **版本号四段式**: `@vscode/vsce` 强制遵循 SemVer，写成 `3.7.4.1` 会直接导致打包报错退出，必须采用 `3.7.4-x`。
- ❌ **行内公式 CSS 取消**: 切勿移除 `code[data-type="math-inline"] { display: none; }`，新版 Lute 默认会漏显源码。
- ❌ **上游混淆**: 上游底座为 `rjwang1982/vscode-office`（远程名 `upstream`），开发仓为 `chmzs/vscode-office-enhanced`（远程名 `origin`），勿推向错的 remote。
- ❌ **输入前缀空格限制**: Vditor 原生 `getKey` 要求 splitChar 前必须带空格，已解除；修改 vditor.js 时勿还原该逻辑。

## 4. 下一步原子动作
新会话接手后，若继续做“断链识别与置灰”：
1. 在 `resource/vditor/util.js` 中对比 `cachedWikilinks`，为未命中的双链节点追加 `vditor-wikilink--unresolved` 类名；
2. 在 `resource/vditor/vditor.css` 中增加灰色虚线样式；
3. 升级版本至 `3.7.4-4` 并打 tag 推送触发发布。
