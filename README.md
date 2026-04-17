# config-sync

跨设备同步 Vibe Coding 工具配置的 CLI 工具。通过 Git 私有仓库安全同步 OpenCode、Claude Code、skill.sh 的配置文件，敏感字段自动脱敏。

## 功能

- **多工具支持** — OpenCode、Claude Code、skill.sh 配置一键同步
- **敏感字段保护** — API Key、Token 等自动脱敏为 `{{SENSITIVE:path}}` 占位符，pull 时从本地回填
- **冲突交互** — push/pull 遇到冲突时交互式选择处理方式
- **自定义文件** — 通过 `add` 命令追加任意文件到同步范围
- **符号链接** — 自动检测并跨平台还原符号链接（Windows 使用 junction）
- **Provider 插件体系** — 默认 Git Provider，可扩展其他存储后端

## 快速开始

### 前置条件

- Node.js >= 18
- Git
- 一个可访问的 Git 私有仓库（GitHub / GitLab / Gitea 等）

### 安装

```bash
cd scripts/config-sync
npm install
npm run build
```

全局链接（可选）：

```bash
npm link
# 之后可在任意目录使用 config-sync 命令
```

### 初始化

```bash
config-sync init
```

交互式引导填写：
1. Git 仓库地址（SSH 或 HTTPS）
2. 分支名（默认 `main`）
3. 认证方式（SSH Key / HTTPS Token）
4. 要同步的工具（OpenCode / Claude Code / skill.sh）

配置文件保存至 `~/.config/config-sync/config.json`（Windows: `%APPDATA%/config-sync/config.json`）。

### 日常使用

```bash
# 上传本地配置到远程仓库
config-sync push

# 从远程仓库拉取配置到本地
config-sync pull

# 查看本地与远程的差异概览
config-sync status

# 查看具体文件差异
config-sync diff
config-sync diff opencode/rules/obsidian.md

# 添加自定义文件到同步
config-sync add ~/.tmux.conf

# 移除自定义文件
config-sync remove ~/.tmux.conf

# 查看可用的同步后端
config-sync providers
```

### 命令选项

| 命令 | 选项 | 说明 |
|------|------|------|
| `push` | `-v, --verbose` | 详细输出 |
| `push` | `-f, --force` | 强制推送（跳过冲突检测） |
| `pull` | `-v, --verbose` | 详细输出 |
| `status` | `-v, --verbose` | 详细输出 |
| `diff` | `-v, --verbose` | 详细输出 |

## 同步范围

### OpenCode

| 路径 | 说明 |
|------|------|
| `rules/**/*` | 规则文件 |
| `agents/**/*` | Agent 定义 |
| `skills/**/*` | 技能文件 |
| `superpowers/**/*` | Superpowers 技能集 |
| `opencode.json` | 主配置 |
| `oh-my-opencode.json` | Oh My OpenCode 配置 |
| `oh-my-opencode-slim.json` | 精简配置 |
| `dcp.jsonc` | 每日配置提示 |

排除：`node_modules/`、`plugins/`、`*.bak`

### Claude Code

| 路径 | 说明 |
|------|------|
| `CLAUDE.md` | Claude 规则文件 |
| `settings.json` | 设置文件 |
| `agents/**/*` | Agent 定义 |
| `skills/**/*` | 技能文件 |
| `commands/**/*` | 自定义命令 |
| `hooks/**/*` | 钩子脚本 |
| `output-styles/**/*` | 输出样式 |

排除：`transcripts/`、`debug/`、`file-history/`、`projects/` 等

### skill.sh

| 路径 | 说明 |
|------|------|
| `skills/**/*` | 技能文件 |
| `.skill-lock.json` | 技能锁定文件 |

排除：`.obsidian-zettelkasten-note-rc/`

### 自定义文件

通过 `config-sync add <path>` 添加的任意文件，归入 `custom/` 分区。

## 敏感字段处理

config-sync 自动检测并脱敏配置中的敏感信息：

**检测规则：**
1. **预定义路径规则** — 每个工具配置中定义的敏感字段路径（如 `env.*`、`mcpServers.*.env.*`）
2. **关键词扫描** — 包含 `API_KEY`、`SECRET`、`TOKEN`、`PASSWORD` 等关键词的字段

**脱敏格式：** `{{SENSITIVE:json.path.to.field}}`

**工作流：**
- **push**：原始内容 → 脱敏 → 计算 hash → 推送到远程
- **pull**：拉取远程内容 → 检测本地是否有对应文件 → 有则回填敏感字段 → 写入本地

首次 pull 时如果本地没有对应文件，敏感字段保留为占位符，需要手动填写。

## 配置文件

路径：`~/.config/config-sync/config.json`（Windows: `%APPDATA%/config-sync/config.json`）

```json
{
  "version": "1.0",
  "device_id": "device-xxxxxxxx",
  "provider": {
    "type": "git",
    "repo_url": "git@github.com:user/config-sync-repo.git",
    "branch": "main",
    "auth": {
      "type": "ssh"
    }
  },
  "tools": {
    "opencode": { "enabled": true, "enable_mcp_sync": false },
    "claude-code": { "enabled": true },
    "skill-sh": { "enabled": true }
  },
  "sensitive_patterns": ["API_KEY", "api_key", "SECRET", "TOKEN", "PASSWORD"],
  "extra_files": [],
  "exclude_patterns": []
}
```

| 字段 | 说明 |
|------|------|
| `device_id` | 设备唯一标识，用于冲突检测 |
| `provider.type` | 同步后端类型，目前仅 `git` |
| `provider.repo_url` | Git 仓库地址 |
| `provider.auth.type` | `ssh` 或 `https` |
| `provider.auth.token` | HTTPS 认证 Token（可选） |
| `tools.*.enabled` | 是否同步该工具 |
| `sensitive_patterns` | 额外的敏感字段关键词 |
| `extra_files` | 自定义同步文件的绝对路径列表 |
| `exclude_patterns` | 额外的排除模式 |

## 远程仓库结构

```
config-sync-repo/
├── manifest.json          # 同步清单（文件列表、hash、元数据）
├── opencode/              # OpenCode 配置
│   ├── rules/
│   ├── agents/
│   ├── skills/
│   └── opencode.json
├── claude-code/           # Claude Code 配置
│   ├── CLAUDE.md
│   ├── settings.json
│   ├── agents/
│   └── skills/
├── skill-sh/              # skill.sh 配置
│   ├── skills/
│   └── .skill-lock.json
└── custom/                # 自定义文件
```

## 开发

### 构建

```bash
npm run build          # TypeScript 编译到 dist/
```

### 开发模式

```bash
npm run dev -- push    # 使用 tsx 直接运行，无需构建
```

### 测试

```bash
npm test               # 运行全部测试
npm run test:watch     # 监听模式
```

### 项目结构

```
scripts/config-sync/
├── src/
│   ├── cli.ts                  # CLI 入口（Commander）
│   ├── commands/               # 命令实现
│   │   ├── init.ts             #   init — 交互式初始化
│   │   ├── push.ts             #   push — 扫描→脱敏→推送
│   │   ├── pull.ts             #   pull — 拉取→回填→写入
│   │   ├── status.ts           #   status — 本地 vs 远程概览
│   │   ├── diff.ts             #   diff — 文件级差异展示
│   │   └── manage.ts           #   add/remove/providers
│   ├── core/                   # 核心模块
│   │   ├── scanner.ts          #   本地文件扫描（glob + hash）
│   │   ├── sanitizer.ts        #   敏感字段脱敏/恢复
│   │   ├── manifest.ts         #   Manifest 读写与差异检测
│   │   ├── differ.ts           #   Diff 格式化输出
│   │   └── linker.ts           #   符号链接检测与还原
│   ├── providers/              # 同步后端
│   │   ├── provider.ts         #   ProviderConstructor 接口
│   │   ├── git-provider.ts     #   Git 实现（simple-git）
│   │   └── index.ts            #   工厂函数
│   ├── tools/                  # 工具配置定义
│   │   ├── opencode.ts         #   OpenCode 纳管范围
│   │   ├── claude-code.ts      #   Claude Code 纳管范围
│   │   ├── skill-sh.ts         #   skill.sh 纳管范围
│   │   └── index.ts            #   getEnabledTools()
│   ├── types/                  # TypeScript 类型定义
│   │   └── index.ts
│   └── utils/                  # 工具函数
│       ├── logger.ts           #   彩色日志输出
│       ├── platform.ts         #   跨平台路径与符号链接
│       └── config.ts           #   配置文件读写
├── tests/                      # 测试文件
│   ├── core/
│   ├── providers/
│   ├── utils/
│   └── fixtures/
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

### 技术栈

| 类别 | 技术 |
|------|------|
| 语言 | TypeScript 5.4+ (ESM) |
| 运行时 | Node.js 18+ |
| CLI 框架 | Commander.js |
| Git 操作 | simple-git |
| 文件匹配 | glob |
| 差异展示 | diff |
| 交互提示 | inquirer |
| 测试 | Vitest |
| Hash | Node.js crypto (SHA-256) |

### 扩展 Provider

实现 `SyncProvider` 接口即可添加新的同步后端：

```typescript
// src/providers/my-provider.ts
import type { SyncProvider, ProviderConfig, SyncFile, Manifest } from '../types/index.js';

export class MyProvider implements SyncProvider {
  name = 'my-provider';

  async init(config: ProviderConfig): Promise<void> { /* ... */ }
  async push(files: SyncFile[], manifest: Manifest): Promise<void> { /* ... */ }
  async pull(manifest: Manifest): Promise<SyncFile[]> { /* ... */ }
  async getRemoteManifest(): Promise<Manifest | null> { /* ... */ }
  async dispose(): Promise<void> { /* ... */ }
}
```

然后在 `src/providers/index.ts` 的 `createProvider` 中注册。

### 同步流程

```
push: scan → sanitize → hash(脱敏后内容) → diff → conflict check → git push
pull: git pull → diff(本地先脱敏) → conflict check → restore links → restore sensitive → write
```

关键设计：**hash 始终对脱敏后内容计算**，确保本地与远程使用相同基准比较。

### 添加新工具支持

1. 在 `src/tools/` 下创建新文件，导出 `getXxxConfig(): ToolConfig`
2. 在 `src/types/index.ts` 的 `Manifest.tools` 和 `UserConfig.tools` 中添加对应字段
3. 在 `src/tools/index.ts` 的 `getEnabledTools` 中注册
4. 在 `src/commands/init.ts` 的工具选择列表中添加

## 常见问题

**Q: Windows 上符号链接失败？**
A: Windows 创建符号链接需要管理员权限或开发者模式。config-sync 会自动使用 junction 替代目录符号链接。如果仍有问题，文件类型会降级为普通文件同步。

**Q: 敏感字段没有自动回填？**
A: pull 时需要本地已存在对应文件才能回填。首次同步时敏感字段会保留为占位符，需手动填写。填写后再次 push 会更新远程的脱敏版本。

**Q: 如何在多台设备间同步？**
A: 每台设备运行 `config-sync init` 生成各自的 `device_id`，然后正常使用 push/pull。manifest 中记录了每个文件的来源设备，冲突时会提示交互选择。

**Q: 如何同步 MCP 服务器配置？**
A: MCP 配置默认排除（通常包含 API Key）。如需同步，在 init 时或在配置文件中设置 `tools.opencode.enable_mcp_sync: true`，敏感字段仍会被脱敏。
