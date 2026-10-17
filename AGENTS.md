# Office Viewer Enhanced 项目 Agent 协作指南

本仓库是 [rjwang1982/vscode-office](https://github.com/rjwang1982/vscode-office.git) 的定制增强分支，重点赋能 Markdown 的 **Obsidian 风格双链 (`[[xxx|alias]]`)、别名渲染、自动补全与跨库联动**。

---

## 1. 仓库与分支拓扑

- **上游源头 (upstream)**: `https://github.com/rjwang1982/vscode-office.git`（唯一官方同步源）
- **开发发布 (origin)**: `https://github.com/chmzs/vscode-office-enhanced.git`
- **跟进上游更新 SOP**:
  ```bash
  git fetch upstream
  git merge upstream/main
  # 解决冲突后推送到 origin 自动触发 CI
  git push origin main
  ```

---

## 2. 核心架构与关键文件索引

```
vsc-office-viewer/
├── src/
│   ├── provider/markdownEditorProvider.ts   # VS Code CustomTextEditorProvider 主入口、Webview IPC 与文件打开定位
│   └── service/markdown/
│       └── wikilinkService.ts               # 双链单例服务：工作区与外部 Vault 扫描、frontmatter aliases 提取、文件监听
├── resource/vditor/
│   ├── lute.min.js                          # 支持 Obsidian 双链的 Lute 引擎（Go 编译产物，已开启 SetObsidian）
│   ├── vditor.js                            # Vditor 前端运行时（已补丁支持 [[ 输入联想、候选扩容与 DOM 自动注入）
│   ├── util.js                              # hotKeys (公式与双链联想)、openLink (点击/展开/跳转) 与工具栏事件
│   ├── index.js                             # 编辑器初始化胶水层、双链缓存同步、主题加载
│   └── vditor.css                           # 编辑器样式、双链链接蓝、行内公式防重叠修复、联想浮层样式
├── package.json                             # 扩展配置声明、vscode-office.obsidianVaultPath 配置项
└── .github/workflows/main.yml               # GitHub Actions 构建与 Release 自动化流水线
```

---

## 3. 构建、打包与版本规范

1. **版本号规则 (SemVer 严格约束)**:
   - 打包工具 `@vscode/vsce` 强制遵循 3 段式语义化版本。
   - 上游修补版本命名规范：`3.7.4-1`、`3.7.4-2`、`3.7.4-3`（严禁使用 4 段式如 `3.7.4.1`，否则打包报错）。
2. **自动化发布流程**:
   - 提交代码并推送至 `main`。
   - 打 Tag 并推送：`git tag v3.7.4-x && git push origin v3.7.4-x`。
   - GitHub Actions 会在 2 分钟内自动编译并在 Releases 中生成 `.vsix` 安装包。
3. **本地开发验证**:
   - Webview 源码修改多在 `resource/vditor/`，大部分修改无需重编 TypeScript，VS Code 调试直接 F5 或重载窗口即可见效。

---

## 4. 关键避坑与注意事项

0. **WYSIWYG DOM 手术红线**：编辑区（光标可能所在的块）内禁止一切旁路 DOM 结构手术（replaceWith 等）——Vditor 每键重解析 + wbr 还原光标，旁路手术=光标乱跳（历史事故：`[[]]` unwrap）。`[[]]` 的既定处理：CSS 显示为 `[[]]` 字面文本、由用户直接删除，文件层由 `normalizeWikilinkSoup` 收敛，不做 DOM 手术。唯一豁免：永不承载光标的空占位移除（`.vditor-cm-host`）走节点级守卫即时执行。

1. **行内公式重叠坑**:
   新版 Lute 引擎生成的 `<code data-type="math-inline">` 默认不带隐藏样式。必须在 `vditor.css` 中维持 `code[data-type="math-inline"] { display: none; }`，否则 LaTeX 源码与 KaTeX 渲染结果会重叠并排显示。
2. **表格内别名转义规则**:
   在 Markdown 表格内插入带别名的双链时，必须将管道符转义为 `[[文件名\|别名]]`，否则破坏 Markdown 表格列对齐；在普通文本段落中维持 `[[文件名|别名]]`。
3. **双链编辑展开与跳转解耦**:
   - 单击/光标移入双链：展开为 `[[目标|别名]]` 供原地打字修改；
   - `Ctrl/Cmd + 单击` 或 `双击`：触发 `openLink` 事件在 VS Code 中打开实体文件。
