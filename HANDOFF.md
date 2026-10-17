# 项目交接卡 (Hot SSOT)

## 1. 停滞断点与当前状态
- **当前版本**: v3.7.4-8（YAML 折叠卡片 + 编辑器去重 + 加载性能治理）。
- **已交付**: 双链渲染/别名/展开编辑、`[[` 联想补全、跨库联动、断链橙 #D39815/有效链蓝 #0050b3、断链引导新建、`[[]]` 空链可删、YAML 默认收成"YAML"徽章点击展开编辑。
- **v3.7.4-8 三项**:
  1. 删除 `cweijan.markdownViewer.optional` 重复注册（Open With 只剩一个）；
  2. 索引扫描：构造函数激活时启动 → 改为首次打开 md 懒启动；3000 文件同步 readSync → 收集列表 + 24 个/批 fs.promises 异步读；
  3. YAML frontmatter：CSS 徽章折叠 + util.js selectionchange/click 展开定位光标。
- **当前停滞断点**: 已提交推送 + tag v3.7.4-8，等 CI 出 .vsix；待用户实测补全弹层、YAML 折叠、打开速度。

## 2. 一键验证命令
```bash
node --check resource/vditor/util.js && node --check resource/vditor/index.js   # JS 语法
python -c "import json; json.load(open('package.json',encoding='utf-8'))"       # JSON 有效
gh run list -R chmzs/vscode-office-enhanced --limit 3                            # CI 状态
```

## 3. 试错黑名单（严禁踩坑）
- ❌ 版本号四段式（vsce 拒绝）；统一 `3.7.4-x`，publisher `rjwang`。
- ❌ 在单行压缩 JS 里注入原始 `\n` 字节（SyntaxError→白屏）。
- ❌ math-inline 无条件 `display:none`（毁掉公式点击编辑），须 `:not([style*="display: inline"])`。
- ❌ 扩展激活即同步扫盘（卡打开速度）；必须懒启动 + 分批异步。
- ❌ 恢复 `markdownViewer.optional` 注册（会在 Open With 出现重复项）。

## 4. 下一步原子动作
1. CI 绿后安装 `vscode-office-enhanced-3.7.4-8.vsix` 实测三处修复；
2. 通过后进入未来计划：重命名自动更新双链 → 悬浮预览卡片（见 DEVELOPMENT_LOG.md）。
