# 项目交接卡 (Hot SSOT)

## 1. 停滞断点与当前状态
- **当前版本**: v3.7.4-13。空双链 Backspace 乱跳已修（保存层括号汤归一化 + 块级光标守卫 + 手术延迟到光标离块）；wikiExclude 默认值已进设置面板可编辑。
- **已交付**: 双链渲染/别名/原地编辑、`[[` 三模式补全（名称/`#`章节/`|`别名，↑↓/Tab/Enter 确认）、跨库联动与 Obsidian 跳转按钮（obsidian://）、断链橙/有效链蓝、`[[]]` 可删、YAML 原生 Properties 面板（默认表格、点击展开源码、失焦收回）、单波浪 `~x~` 视觉修正（仅 `~~` 显删除线）、光标乱跳修复（DOM 手术 cursorInside 守卫）、懒扫描+异步分批索引。
- **当前断点**: E2E P1-P7 全绿后已提交；待用户装机复验：①`[[名#` 与 `[[名|` 在真实 Vault 的行为（harness 中 `|` 探针受光标放置限制未验证，逻辑已单测，别名可在基础弹层直接选）；②预览面板 `<del>` 单波浪为已知限制。
- **未来计划（用户已排期）**: 重命名自动更新双链（WorkspaceEdit+可撤销）→ 悬浮预览卡片 → 导出 zotword 模式。

## 2. 一键验证命令
```bash
node --check resource/vditor/vditor.js && node --check resource/vditor/util.js
"d:/Users/chmzs/Documents/Pixi_env/.pixi/envs/geo/python" -m http.server 8765 --bind 127.0.0.1 &
node scripts/e2e/e2e.cjs   # 期望 P1-P7 全 true/正常值
gh run list -R chmzs/vscode-office-enhanced --limit 2
```

## 3. 试错黑名单（严禁踩坑）
- ❌ 压缩 JS 内 forEach 回调同名 var 遮蔽外层实例（splitChar 事故）；原始 `\n` 字节泄漏（白屏）。
- ❌ 改 `resource/vditor/` 后不跑 scripts/e2e 直接发版。
- ❌ harness 里用 collapsed Range 的 rect 定位点击（返回 0 → 假 bug）；用元素 rect。
- ❌ 对 Lute 假设旧版结构：cm-host 空 span、`code` 自带 data-type、properties 面板均为新差异。
- ❌ 四段式版本号；math-inline 无条件 display:none；`\|` 在 python 中转义链（JSON→py→file 三层各吞一次，写文件后用字节断言验证）。

## 4. 下一步原子动作
1. CI 绿 → 下载 `vscode-office-enhanced-3.7.4-10.vsix` 交用户实测；
2. 反馈通过后开"重命名自动更新双链"分支（provider 加 `onDidRenameFiles`）。
