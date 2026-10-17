# 项目交接卡 (Hot SSOT)

## 1. 停滞断点与当前状态
- **当前版本**: v3.7.4-9（E2E 实测回归全绿后发布）。
- **已交付**: 双链渲染/别名/展开编辑、`[[` 联想补全、跨库联动、断链橙 #D39815/有效链蓝 #0050b3、断链引导新建、`[[]]` 可删、YAML 折叠徽章、Open With 去重、异步懒扫描提速。
- **v3.7.4-9 三个根因**（详见 DEVELOPMENT_LOG #16）：
  1. genHTML 补丁 `var r=e.html` 遮蔽外层 hint 实例 → 每次候选渲染抛 `splitChar of undefined`（补全/emoji 全灭）；
  2. 新 Lute 的 math-inline 内 `vditor-cm-host` 空 span 让 Vditor `ne()` 点击展开崩 null → 公式不可编辑 + YAML 展开连带失败；
  3. 公式 `<code>` 自身带 `data-type="math-inline"`，closest 命中自身致编辑态判断失效 → selectionchange 驱动 `syncMathInlineEdit` 修正。
- **排查资产（必须会用）**: `scripts/e2e/`（playwright-core 驱动本机 Edge 无头浏览器加载真实 webview 资源，含 6 组探针）。改 `resource/vditor/` 任何 JS 后，先跑 harness 再提交。
- **当前停滞断点**: 等待用户装机复验；通过后进入"重命名自动更新双链 → 悬浮预览卡片"计划。

## 2. 一键验证命令
```bash
node --check resource/vditor/vditor.js && node --check resource/vditor/util.js
"d:/Users/chmzs/Documents/Pixi_env/.pixi/envs/geo/python" -m http.server 8765 --bind 127.0.0.1 &
node scripts/e2e/e2e.cjs   # 期望: YAML active:true / HINT buttons:5→2 / ENTER 插入 / MATH inline-block / EMPTY false / 无 pageerror
```

## 3. 试错黑名单（严禁踩坑）
- ❌ 在压缩 JS 的 forEach 回调里用同名局部变量遮蔽外层实例（splitChar 事故根源）。
- ❌ 假设 Lute 输出结构 = 旧 Vditor 假设（cm-host、code 自带 data-type 都是新差异点）。
- ❌ 改完不跑 scripts/e2e 就发布（3.7.4-3~8 连续 6 版盲改全错）。
- ❌ 版本号四段式；❌ 单行 JS 注入原始换行字节；❌ 无条件 math-inline display:none。

## 4. 下一步原子动作
1. 用户装 `vscode-office-enhanced-3.7.4-9.vsix` 复验；
2. 通过后按 AGENTS.md 启动"重命名自动更新"（WorkspaceEdit 方案见日志/对话）。
