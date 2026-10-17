# 项目交接卡 (Hot SSOT)

## 1. 停滞断点与当前状态
- **当前版本**: v3.7.4-22。双链点击/断链新建改走 vscode.open（showTextDocument 按设计只开内置文本编辑器，是"点双链落原生"根因）；锚点跳转由 webview revealHeading 实现，P15 守护。
- **刚闭环（勿回退）**：①双链颜色被主题 `.vditor-content :not(){color!important}`(0,2,1) 级联压制 → 配色规则已提级到 0,3,1/0,4,1 并覆盖全部子 span（-20，P14 计算色探针守护）；②远程浏览器/隧道窗口 md 是 `vscode-vfs:` scheme，主注册 selector 只有 `file:` → 打开方式缺席、双击双链/双击文件都回落原生 → 主注册已扩 `vscode-vfs:` 双形态（-21）。
- **待用户确认（唯一悬项）**：远程装 -21 后点双链是否进我们的编辑器。若仍是原生：取该 md 的 URI 前缀（命令"文件: 复制 URI"）→ 精准补 scheme；一行兜底：openLink 的 `showTextDocument` 改 `executeCommand('vscode.openWith', uri, 'cweijan.markdownViewer')`。
- **已知限制（明示过，暂不修）**：整体预览面板里单 `~x~` 仍渲染 `<del>`；harness 跨探针偶发顺序污染（P6 的 soup 字段为残体假阳性）。
- **未来计划（用户已排期）**：重命名自动更新双链 → 悬浮预览卡片 → PDF 导出走 zotword 思路。

## 2. 一键验证命令
```bash
node --check resource/vditor/util.js && node --check resource/vditor/index.js
node -e "const e=require('./node_modules/esbuild');['src/extension.ts','src/provider/markdownEditorProvider.ts','src/service/markdown/wikilinkService.ts'].forEach(f=>e.buildSync({entryPoints:[f],bundle:false,write:false,logLevel:'silent'}))"
python -m http.server 8765 --bind 127.0.0.1 & node scripts/e2e/e2e.cjs   # 期望 P1-P14 全绿（P14 八项计算色必须蓝/橙）
gh release view v3.7.4-21 -R chmzs/vscode-office-enhanced
```

## 3. 试错黑名单（严禁重复踩坑）
- ❌ 上游"重复"注册（markdownViewer.optional）= scheme 兼容层，-8 误删曾致远程回归；删前先问另一条为何存在。
- ❌ 编辑区（光标可能在的块）做异步 DOM 结构手术（unwrap/replaceWith）；`[[]]` 处理 = CSS 字面显示 + 用户手删 + 保存层 normalizeWikilinkSoup。
- ❌ 压缩 JS 里同名 var 遮蔽、原始 `\n` 字节泄漏；改 vditor.js 必过 node --check。
- ❌ python 脚本内直接写反斜杠/`\\n` 字面量（JSON→py→file 三层各吞一次）；用 chr(92)/chr(10) 构造。
- ❌ 与 `!important` 全局规则对赌特异度时靠猜——先 styleSheets dump 命中规则链再定选择器。
- ❌ 四段式版本号；发版只认 `3.7.4-x` + 打 tag 触发 CI 自动出 Release。

## 4. 下一步原子动作
接新会话先跑第 2 节命令确认现场；等用户远程实测 -21 反馈——通过则开"重命名自动更新双链"（provider 挂 `workspace.onDidRenameFiles`，全库 md 替换 `[[旧名` 前缀，WorkspaceEdit 一步可撤销）。
