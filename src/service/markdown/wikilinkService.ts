import * as vscode from 'vscode';
import { openSync, readSync, closeSync, existsSync, readdirSync, statSync, realpathSync, promises as fsp } from 'fs';
import { basename, extname, join, relative, resolve } from 'path';

export interface WikilinkNote {
    name: string;        // 笔记名（无 .md）
    relPath: string;     // 相对路径
    fsPath: string;      // 完整路径
    aliases: string[];   // frontmatter 中的 aliases
    source: 'workspace' | 'vault';
}

/** 把 wikiExclude 里的简单目录名合成单个 findFiles 排除模式；含通配/路径的复杂模式交给 JS 过滤 */
function buildFindExclude(list: string[]): string | null {
    const simple = list.filter(x => x && x.indexOf('/') < 0 && x.indexOf('*') < 0);
    return simple.length ? '**/{' + simple.join(',') + '}/**' : null;
}

interface PendingNote {
    name: string;
    relPath: string;
    fsPath: string;
    source: 'workspace' | 'vault';
}

/** 从 Markdown 头部文本解析 frontmatter aliases（纯函数） */
export function parseAliasesFromText(text: string): string[] {
    const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) return [];
    const fm = match[1];
    const aliases: string[] = [];

    // 1. 行内数组格式: aliases: [a, b]
    const inlineMatch = fm.match(/^(?:aliases|alias)\s*:\s*\[(.*?)\]/m);
    if (inlineMatch) {
        inlineMatch[1].split(',').forEach(s => {
            const trimmed = s.trim().replace(/^['"]|['"]$/g, '');
            if (trimmed) aliases.push(trimmed);
        });
        return aliases;
    }

    // 2. YAML 列表格式: aliases:\n  - a\n  - b
    const listMatch = fm.match(/^(?:aliases|alias)\s*:\s*\r?\n((?:[ \t]*-[ \t]+[^\r\n]+\r?\n?)+)/m);
    if (listMatch) {
        listMatch[1].split(/\r?\n/).forEach(line => {
            const item = line.replace(/^[ \t]*-[ \t]+/, '').trim().replace(/^['"]|['"]$/g, '');
            if (item) aliases.push(item);
        });
        return aliases;
    }

    // 3. 单值格式: alias: xxx
    const singleMatch = fm.match(/^(?:aliases|alias)\s*:\s*([^\r\n\[]+)/m);
    if (singleMatch) {
        const val = singleMatch[1].trim().replace(/^['"]|['"]$/g, '');
        if (val) aliases.push(val);
    }

    return aliases;
}

/** 读取文件头 1500 字节并解析 aliases（同步，仅用于单文件增量场景） */
export function extractFrontmatterAliases(filePath: string): string[] {
    let fd: number | undefined;
    try {
        fd = openSync(filePath, 'r');
        const buffer = Buffer.alloc(1500);
        const bytesRead = readSync(fd, buffer, 0, 1500, 0);
        return parseAliasesFromText(buffer.toString('utf8', 0, bytesRead));
    } catch {
        return [];
    } finally {
        if (fd !== undefined) {
            try { closeSync(fd); } catch { /* ignore */ }
        }
    }
}

/** 异步版：读文件头 1500 字节并解析 aliases，避免批量扫描阻塞扩展宿主事件循环 */
async function readAliasesAsync(filePath: string): Promise<string[]> {
    let fh: fsp.FileHandle | undefined;
    try {
        fh = await fsp.open(filePath, 'r');
        const buffer = Buffer.alloc(1500);
        const { bytesRead } = await fh.read(buffer, 0, 1500, 0);
        return parseAliasesFromText(buffer.toString('utf8', 0, bytesRead));
    } catch {
        return [];
    } finally {
        if (fh) {
            try { await fh.close(); } catch { /* ignore */ }
        }
    }
}

export class WikilinkService {
    private static instance: WikilinkService;
    private notesMap: Map<string, WikilinkNote> = new Map();
    private watchers: vscode.Disposable[] = [];
    private onDidChangeEmitter = new vscode.EventEmitter<WikilinkNote[]>();
    public readonly onDidChange = this.onDidChangeEmitter.event;

    private debounceTimer: NodeJS.Timeout | null = null;
    private customExcludes: string[] = [];
    private currentVaultPath: string | undefined;
    /** 首次扫描完成 Promise，供外部等待索引就绪 */
    public ready: Promise<void>;

    public static getInstance(): WikilinkService {
        if (!WikilinkService.instance) {
            WikilinkService.instance = new WikilinkService();
        }
        return WikilinkService.instance;
    }

    public async initialize(context?: vscode.ExtensionContext) {
        if (!this.ready) {
            this.ready = this.refresh();
        }
        await this.ready;

        // 监听工作区内的 Markdown 文件变动
        const watcher = vscode.workspace.createFileSystemWatcher('**/*.md');
        watcher.onDidCreate(uri => this.handleFileChange(uri));
        watcher.onDidChange(uri => this.handleFileChange(uri));
        watcher.onDidDelete(uri => this.handleFileDelete(uri));
        this.watchers.push(watcher);

        // 监听配置变动（如用户配置了外部 obsidianVaultPath）
        const configWatcher = vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('vscode-office.obsidianVaultPath') || e.affectsConfiguration('vscode-office.wikiExclude')) {
                this.refresh();
            }
        });
        this.watchers.push(configWatcher);

        if (context) {
            context.subscriptions.push(watcher, configWatcher);
        }
    }

    /**
     * 防抖分发更新事件，避免批量文件操作时高频重触发
     */
    private triggerDebouncedChange() {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        this.debounceTimer = setTimeout(() => {
            this.onDidChangeEmitter.fire(this.getNotes());
        }, 150);
    }

    /** 用户自定义排除（vscode-office.wikiExclude）：glob 模式转路径包含判断（无正则转义风险实现） */
    private isCustomExcluded(relPath: string): boolean {
        const bs = String.fromCharCode(92);
        const rp = relPath.split(bs).join('/').toLowerCase();
        for (let p of this.customExcludes) {
            if (p.startsWith('**/')) p = p.slice(3);
            if (p.endsWith('/**')) p = p.slice(0, -3);
            else if (p.endsWith('/*')) p = p.slice(0, -2);
            if (!p) continue;
            const specials = '.+^${}()|[]' + bs;
            const bodyEsc = p.split('').map(c => (c === '*' || c === '?') ? c : (specials.indexOf(c) >= 0 ? bs + c : c)).join('');
            const re = new RegExp('(^|/)' + bodyEsc.split('*').join('[^/]*').split('?').join('[^/]') + '($|/)');
            if (re.test(rp)) return true;
        }
        return false;
    }

    public getVaultPath(): string | undefined {
        return this.currentVaultPath;
    }

    public async refresh() {
        this.notesMap.clear();
        this.customExcludes = (vscode.workspace.getConfiguration('vscode-office').get<string[]>('wikiExclude', []) || [])
            .map(x => String(x).trim().toLowerCase()).filter(Boolean);
        const pending: PendingNote[] = [];

        // 1. 收集当前工作区所有 Markdown 文件（只收集路径，别名稍后异步批量读）
        const uris = await vscode.workspace.findFiles(
            '**/*.md',
            buildFindExclude(this.customExcludes),
            3000
        );
        for (const uri of uris) {
            const fsPath = uri.fsPath;
            const wsRel = vscode.workspace.asRelativePath(uri);
            if (this.isCustomExcluded(wsRel)) continue;
            pending.push({
                name: basename(fsPath, '.md'),
                relPath: wsRel,
                fsPath,
                source: 'workspace'
            });
        }

        // 2. 扫描外部配置的 Obsidian Vault 路径
        const config = vscode.workspace.getConfiguration('vscode-office');
        let vaultPath = config.get<string>('obsidianVaultPath', '').trim();

        // 如果未配置外部路径，但工作区根目录下有 .obsidian，则说明工作区本身就是 Vault
        if (!vaultPath && vscode.workspace.workspaceFolders) {
            for (const folder of vscode.workspace.workspaceFolders) {
                if (existsSync(join(folder.uri.fsPath, '.obsidian'))) {
                    vaultPath = folder.uri.fsPath;
                    break;
                }
            }
        }

        if (vaultPath && existsSync(vaultPath)) {
            this.currentVaultPath = vaultPath;
            const visited = new Set<string>();
            this.scanExternalVault(vaultPath, vaultPath, visited, 0, pending);
        } else {
            this.currentVaultPath = undefined;
        }

        // 3. 分块异步读取别名（并发 24，避免占满句柄/事件循环）
        const CHUNK = 24;
        const seen = new Set<string>();
        for (let i = 0; i < pending.length; i += CHUNK) {
            const chunk = pending.slice(i, i + CHUNK).filter(p => {
                if (seen.has(p.fsPath)) return false;
                seen.add(p.fsPath);
                return true;
            });
            const aliasLists = await Promise.all(chunk.map(p => readAliasesAsync(p.fsPath)));
            chunk.forEach((p, j) => this.notesMap.set(p.fsPath, { ...p, aliases: aliasLists[j] }));
        }

        this.triggerDebouncedChange();
    }

    /** 收集 Vault 目录树中的 md 文件（纯目录遍历，不做 IO 读取） */
    private scanExternalVault(dir: string, rootDir: string, visited: Set<string>, depth: number, out: PendingNote[]) {
        if (depth > 12) return; // 防止过深目录
        try {
            const realDir = realpathSync(dir);
            if (visited.has(realDir)) return; // 避免符号链接环路死循环
            visited.add(realDir);

            const entries = readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = join(dir, entry.name);
                if (entry.isDirectory()) {
                    const dirRel = join(basename(rootDir), relative(rootDir, fullPath)).split(String.fromCharCode(92)).join('/');
                    if (this.isCustomExcluded(entry.name) || this.isCustomExcluded(dirRel)) {
                        continue;
                    }
                    this.scanExternalVault(fullPath, rootDir, visited, depth + 1, out);
                } else if (entry.isFile() && extname(entry.name).toLowerCase() === '.md') {
                    const name = basename(entry.name, '.md');
                    const relPath = join(basename(rootDir), relative(rootDir, fullPath)).replace(/\\/g, '/');
                    if (this.isCustomExcluded(relPath)) continue;
                    out.push({ name, relPath, fsPath: fullPath, source: 'vault' });
                }
            }
        } catch {
            // 忽略无权限或已失效目录
        }
    }

    private handleFileChange(uri: vscode.Uri) {
        const fsPath = uri.fsPath;
        // 点号目录（.obsidian/.trash/.git/.smart-env 等）内的 md 不进索引，对齐 Obsidian 与库 .gitignore 忽略惯例
        if (this.isCustomExcluded(vscode.workspace.asRelativePath(uri))) { this.notesMap.delete(fsPath); return; }
        if (this.isCustomExcluded(vscode.workspace.asRelativePath(uri))) { this.notesMap.delete(fsPath); return; }
        const name = basename(fsPath, '.md');
        const relPath = vscode.workspace.asRelativePath(uri);
        const aliases = extractFrontmatterAliases(fsPath);
        this.notesMap.set(fsPath, {
            name,
            relPath,
            fsPath,
            aliases,
            source: 'workspace'
        });
        this.triggerDebouncedChange();
    }

    private handleFileDelete(uri: vscode.Uri) {
        this.notesMap.delete(uri.fsPath);
        this.triggerDebouncedChange();
    }

    /**
     * 获取所有可用于补全与断链校验的笔记列表
     */
    public getNotes(): WikilinkNote[] {
        return Array.from(this.notesMap.values());
    }

    /**
     * 根据双链 target 查找目标笔记文件 Uri（支持文件名、路径后缀以及别名匹配）
     */
    public async resolveFile(currentFolder: string, target: string): Promise<vscode.Uri | undefined> {
        const cleanTarget = target.endsWith('.md') ? target.slice(0, -3) : target;
        const targetFileName = `${cleanTarget}.md`;

        // 1. 优先尝试当前文档目录相对路径
        const candPath = resolve(currentFolder, targetFileName);
        if (existsSync(candPath)) {
            return vscode.Uri.file(candPath);
        }

        const targetLower = cleanTarget.toLowerCase();

        // 2. 在已缓存的索引表中按文件名精确或大小写匹配
        for (const note of this.notesMap.values()) {
            if (note.name === cleanTarget || note.name.toLowerCase() === targetLower) {
                return vscode.Uri.file(note.fsPath);
            }
        }

        // 3. 在已缓存的索引表中按路径后缀匹配 (例如 01_wiki/目标)
        for (const note of this.notesMap.values()) {
            const normPath = note.relPath.replace(/\\/g, '/');
            if (normPath.endsWith(`${cleanTarget}.md`) || normPath.toLowerCase().endsWith(`${targetLower}.md`)) {
                return vscode.Uri.file(note.fsPath);
            }
        }

        // 4. 按别名匹配 (如果双链只写了别名 [[别名]])
        for (const note of this.notesMap.values()) {
            if (note.aliases && note.aliases.some(a => a.toLowerCase() === targetLower)) {
                return vscode.Uri.file(note.fsPath);
            }
        }

        // 5. 工作区内 findFiles 兜底
        const base = basename(cleanTarget);
        const files = await vscode.workspace.findFiles(`**/${base}.md`, buildFindExclude(this.customExcludes), 5);
        if (files.length > 0) {
            return files[0];
        }

        return undefined;
    }

    public dispose() {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        this.watchers.forEach(w => w.dispose());
        this.notesMap.clear();
    }
}
