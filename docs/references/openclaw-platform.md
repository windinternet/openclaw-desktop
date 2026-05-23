# OpenClaw Platform — 全面参考资料

> **来源**: [docs.openclaw.ai](https://docs.openclaw.ai) · [GitHub: openclaw/openclaw](https://github.com/openclaw/openclaw) (374k+ stars, MIT License)
>
> **最后更新**: 2026-05-23
>
> **用途**: 为 OpenClaw Desktop 项目的 AI Agent 提供完整的平台背景知识，涵盖体系结构、核心概念、API 协议及生态。

---

## 目录

1. [概述](#1-概述)
2. [体系结构](#2-体系结构)
3. [Gateway（网关）](#3-gateway网关)
4. [Agent（智能体）](#4-agent智能体)
5. [Session（会话）](#5-session会话)
6. [Channels（消息渠道）](#6-channels消息渠道)
7. [Tools & Skills（工具与技能）](#7-tools--skills工具与技能)
8. [Nodes（节点）](#8-nodes节点)
9. [Web 界面](#9-web-界面)
10. [OpenClaw App SDK](#10-openclaw-app-sdk)
11. [Multi-Agent 系统](#11-multi-agent-系统)
12. [3D Office / Kanban / Hub（生态项目）](#12-3d-office--kanban--hub生态项目)
13. [安全模型](#13-安全模型)
14. [文件系统布局](#14-文件系统布局)
15. [Wire Protocol（有线协议）](#15-wire-protocol有线协议)
16. [提供者/模型支持](#16-提供者模型支持)
17. [平台应用](#17-平台应用)
18. [自动化](#18-自动化)
19. [插件系统](#19-插件系统)
20. [开发者参考](#20-开发者参考)

---

## 1. 概述

**OpenClaw** 是一个自托管的**个人 AI 助手**，你可以在自己的设备上运行它。它在你已有的消息渠道上回复你，支持语音输入输出，并能渲染一个实时的 Canvas。Gateway 是控制面，产品是助手本身。

**核心理念**：
- **本地优先**：单个 Gateway 进程拥有所有消息面（WhatsApp, Telegram, Slack, Discord, Signal, iMessage 等）
- **多渠道收件箱**：支持 20+ 消息平台
- **多 Agent 路由**：按渠道/账户/联系人路由到独立的 Agent
- **语音唤醒 + 对话模式**：macOS/iOS/Android
- **Live Canvas**：Agent 驱动的可视化工作区
- **常驻运行**：设计为 always-on 的守护进程

**标语**: "Your own personal AI assistant. Any OS. Any Platform. The lobster way. 🦞"

---

## 2. 体系结构

### 2.1 高层架构

OpenClaw 采用 **Gateway 中心化** 架构：

```
Messaging Channels → Gateway (WebSocket :18789) → AI Agent Runtime (Pi Agent)
                         ↕
                    Platform Apps (macOS/iOS/Android/CLI/Web UI)
                         ↕
                    Nodes (camera/screen/canvas/location)
```

### 2.2 核心组件

| 组件 | 描述 |
|------|------|
| **Gateway（守护进程）** | 中央控制面，单个长生命周期进程，拥有所有消息面 |
| **Clients（客户端）** | macOS 应用、CLI、Web UI、自动化脚本，通过 WebSocket 连接 |
| **Nodes（节点）** | macOS/iOS/Android/headless，声明 `role: node`，提供设备能力 |
| **Channels（渠道）** | 消息平台集成（WhatsApp, Telegram, Slack, Discord 等） |
| **Agent Runtime** | 基于 Pi Agent Core 的嵌入式运行时 |
| **WebChat** | 静态 UI，使用 Gateway WS API |

### 2.3 数据流

```
用户消息 → Channel → Gateway Router → Session Manager → Pi Agent → 
  → 模型调用 → 工具调用 → 响应生成 → Channel 发送 → 用户
```

### 2.4 端口

- **WebSocket 控制面**: `ws://127.0.0.1:18789`（默认）
- **HTTP API**: `/v1/models`, `/v1/chat/completions`, `/v1/embeddings`, `/v1/responses`
- **Control UI**: `http://<host>:18789/`
- **Canvas**: `/__openclaw__/canvas/`, `/__openclaw__/a2ui/`
- **Health probes**: `/health`, `/healthz`, `/ready`, `/readyz`

---

## 3. Gateway（网关）

Gateway 是 OpenClaw 的中央控制面——**单一 WebSocket 服务器**同时服务于控制面客户端、节点和渠道连接。

### 3.1 关键职责

- 维护模型提供者连接
- 暴露类型化 WS API（请求、响应、服务器推送事件）
- 使用 JSON Schema 验证入站帧
- 发射事件：`agent`, `chat`, `presence`, `health`, `heartbeat`, `cron`
- 拥有渠道连接（WhatsApp Web 会话、Telegram 长轮询等）
- 拥有本地状态（配置、凭证、会话记录）

### 3.2 运行时模型

- **一个常驻进程** 用于路由、控制面和渠道连接
- **单一多路复用端口** 用于 WS 控制/RPC、HTTP API、Control UI、插件 HTTP 路由
- **默认绑定模式**: `loopback`（仅本地）
- **Auth 默认必需**: shared-secret（token/password）或 `trusted-proxy`
- **监管**: launchd（macOS）/ systemd（Linux）/ schtasks（Windows）自动重启

### 3.3 绑定模式

| 模式 | 描述 |
|------|------|
| `loopback` | 仅本地访问（默认），最安全 |
| `lan` | 局域网访问 |
| `tailnet` | Tailscale 网络访问 |
| 自定义 host:port | 通过 `gateway.bind` 配置 |

### 3.4 OpenAI 兼容端点

OpenClaw 提供与 OpenAI API 兼容的 HTTP 端点：

- `GET /v1/models` — Agent 优先的模型列表，返回 `openclaw`, `openclaw/default`
- `GET /v1/models/{id}`
- `POST /v1/chat/completions` — 聊天补全
- `POST /v1/embeddings` — 嵌入向量
- `POST /v1/responses` — 响应 API
- `POST /tools/invoke` — 工具调用

`openclaw/default` 始终映射到配置的默认 Agent。使用 `x-openclaw-model` header 覆盖后端提供者/模型。

### 3.5 Admin HTTP RPC

`POST /api/v1/admin/rpc` — 默认禁用，需启用 `admin-http-rpc` 插件。

---

## 4. Agent（智能体）

### 4.1 Agent Runtime

OpenClaw 运行**单一嵌入式 Agent 运行时**——每个 Gateway 一个 Agent 进程，拥有自己的工作区、引导文件和会话存储。

**Agent = 完整的人设范围**：
- 工作区文件（AGENTS.md, SOUL.md, USER.md）
- 状态目录（auth profiles, model registry）
- 会话存储（聊天历史 + 路由状态）

### 4.2 引导文件（Bootstrap Files）

在 `agents.defaults.workspace` 中，OpenClaw 期望以下用户可编辑文件：

| 文件 | 用途 |
|------|------|
| `AGENTS.md` | 操作指令 + "记忆"（日常个性、工具偏好） |
| `SOUL.md` | 人设、边界、语气 |
| `TOOLS.md` | 用户维护的工具笔记（如 imsg、sag、约定） |
| `BOOTSTRAP.md` | 一次性首次运行仪式（完成后自动删除） |
| `IDENTITY.md` | Agent 名称/氛围/emoji |
| `USER.md` | 用户资料 + 偏好称呼 |

新会话的首个回合时，这些文件的内容被注入到系统提示词的 "Project Context" 中。

### 4.3 Agent 循环

```
1. Gateway RPC: agent/agent.wait 验证参数，解析会话
2. agentCommand: 运行 Agent，解析模型，加载技能快照
3. runEmbeddedPiAgent: 通过 per-session + 全局队列序列化运行
4. subscribeEmbeddedPiSession: 将 pi-agent-core 事件桥接到 OpenClaw stream
5. agent.wait: 等待运行完成，返回终端快照
```

**Stream 类型**:
- `lifecycle` — 阶段：start/end/error
- `assistant` — 流式增量
- `tool` — 工具事件

### 4.4 Hook 系统

**插件钩子**（Agent + Gateway 生命周期）：
- `before_model_resolve`: 模型解析前覆盖
- `before_prompt_build`: 注入上下文/系统提示词
- `before_agent_reply`: 声明此回合，返回合成回复
- `agent_end`: 检查最终消息列表和运行元数据
- `before/after_compaction`: 观察压缩周期
- `before/after_tool_call`: 拦截工具参数/结果
- `tool_result_persist`: 转换工具结果后再写入
- `message_received/sending/sent`: 入站/出站消息钩子
- `session_start/end`: 会话生命周期
- `gateway_start/stop`: 网关生命周期

### 4.5 Agent 类型

- **Main Agent**: 默认 Agent，处理直接消息
- **Multi-Agent**: 按渠道/群组路由到专业 Agent
- **Sub-Agents**: 由会话生成的委托 Agent

---

## 5. Session（会话）

### 5.1 会话路由

| 来源 | 行为 |
|------|------|
| 直接消息（DM） | 默认共享一个会话 |
| 群聊 | 每个群组隔离 |
| 房间/频道 | 每个房间隔离 |
| Cron 任务 | 每次运行新会话 |
| Webhooks | 每个 hook 隔离 |

### 5.2 DM 隔离

- `main`（默认）— 所有 DM 共享一个会话
- `per-peer` — 按发送者隔离（跨渠道）
- `per-channel-peer` — 按渠道+发送者隔离（**推荐**）
- `per-account-channel-peer` — 按账户+渠道+发送者隔离

### 5.3 会话生命周期

- **每日重置**（默认）— 网关主机当地时间凌晨 4:00 新会话
- **空闲重置**（可选）— 不活跃后新会话（`session.reset.idleMinutes`）
- **手动重置** — `/new` 或 `/reset` 聊天命令

### 5.4 会话存储位置

- 存储：`~/.openclaw/agents/<agentId>/sessions/sessions.json`
- 转录：`~/.openclaw/agents/<agentId>/sessions/<sessionId>.jsonl`

### 5.5 会话工具

Agent 可用于跨会话工作的工具：

| 工具 | 功能 |
|------|------|
| `sessions_list` | 列出会话（支持筛选：kind, label, agent, recency） |
| `sessions_history` | 读取特定会话的对话转录 |
| `sessions_send` | 向另一个会话发送消息，可选等待回复 |
| `sessions_spawn` | 生成隔离的子 Agent 会话用于后台工作 |
| `sessions_yield` | 结束当前回合，等待子 Agent 后续结果 |
| `subagents` | 列出/操纵/终止生成的子 Agent |
| `session_status` | 展示 `/status` 风格卡片，设置 per-session 模型覆盖 |

**可见性作用域**: `self` → `tree` → `agent` → `all`（默认: `tree`）

---

## 6. Channels（消息渠道）

### 6.1 支持的渠道

OpenClaw 支持 **24+ 消息平台**：

| 渠道 | 库/技术 |
|------|---------|
| **WhatsApp** | Baileys（WebSocket 多设备） |
| **Telegram** | grammY（Bot API + 用户客户端） |
| **Discord** | discord.js |
| **Slack** | Bolt SDK |
| **Signal** | signal-cli |
| **iMessage** | macOS 原生（AppleScript bridge） |
| **Google Chat** | Google Chat API |
| **Microsoft Teams** | Bot Framework |
| **Matrix** | Matrix SDK |
| **IRC** | 内置 IRC 客户端 |
| **Feishu（飞书）** | 飞书开放平台 |
| **LINE** | LINE Messaging API |
| **Mattermost** | Mattermost API |
| **Nextcloud Talk** | Nextcloud Talk API |
| **Nostr** | Nostr 协议 |
| **Synology Chat** | Synology Chat API |
| **Tlon** | Tlon API |
| **Twitch** | Twitch IRC/API |
| **Zalo** | Zalo API |
| **Zalo Personal** | 个人账户模式 |
| **WeChat（微信）** | 微信机器人 |
| **QQ** | QQ Bot |
| **WebChat** | 内置 Web UI |
| **Yuanbao（元宝）** | 元宝 API |

### 6.2 渠道生命周期

1. Channel 初始化并认证
2. Channel 向 Gateway 注册
3. 入站消息路由到会话
4. 出站消息通过 Channel 发送

### 6.3 DM 安全

- 默认 `dmPolicy="pairing"`：未知发送者需要配对码，Agent 不处理其消息
- 批准：`openclaw pairing approve <channel> <code>`
- 公开 DM 需显式选择加入：`dmPolicy="open"` + allowlist

---

## 7. Tools & Skills（工具与技能）

### 7.1 内置工具

核心工具（始终可用，受工具策略限制）：

| 类别 | 工具 |
|------|------|
| **系统** | `read`, `write`, `edit`, `exec`, `apply_patch` |
| **浏览器** | Playwright 驱动的浏览器自动化 |
| **Canvas** | Agent 驱动的可视化工作区控制 |
| **Nodes** | 设备特定操作（camera, screen, location） |
| **Cron** | 定时任务 |
| **搜索** | Brave, DuckDuckGo, Exa, Tavily, SearXNG, Gemini, Grok, Kimi, Perplexity |
| **媒体** | 图像生成、视频生成、音乐生成、TTS |
| **会话** | `sessions_*`（跨会话通信） |
| **Gateway** | 网关控制 |
| **ACP** | Agent Communication Protocol（子 Agent 生成/管理） |

### 7.2 Skills（技能）

技能加载位置（优先级从高到低）：

1. 工作区：`<workspace>/skills/`
2. 项目 Agent 技能：`<workspace>/.agents/skills/`
3. 个人 Agent 技能：`~/.agents/skills/`
4. 托管/本地：`~/.openclaw/skills/`
5. 捆绑（随安装附带）
6. 额外目录：`skills.load.extraDirs`

技能市场：[ClawHub](https://clawhub.ai)

### 7.3 Slash Commands（聊天命令）

Chat commands available in conversations:
`/status`, `/new`, `/reset`, `/compact`, `/think <level>`, `/verbose on|off`, `/trace on|off`, `/usage off|tokens|full`, `/restart`, `/activation mention|always`

---

## 8. Nodes（节点）

### 8.1 节点概念

Nodes 是连接到 Gateway 的**能力主机**，声明 `role: node` 并提供设备能力：

- 暴露命令：`canvas.*`, `camera.*`, `screen.record`, `location.get`
- 设备配对：基于设备身份，配对准入存储在设备配对存储中
- 连接方式：与 Gateway 相同的 WS 端点（`ws://127.0.0.1:18789`）

### 8.2 节点类型

| 平台 | 能力 |
|------|------|
| **macOS** | 菜单栏控制、Voice Wake、Push-to-Talk、Canvas、WebChat、远程 SSH 网关控制 |
| **iOS** | Voice trigger forwarding、Canvas surface、通过 WS 配对 |
| **Android** | Connect/Chat/Voice tabs、Canvas、Camera、Screen capture、Android 设备命令 |
| **Headless** | 无 GUI 能力主机 |

### 8.3 Voice & Talk

- **Voice Wake**: macOS/iOS 唤醒词检测
- **Talk Mode**: macOS/iOS/Android 持续语音对话（ElevenLabs + 系统 TTS fallback）
- **Voice Overlay**: macOS 语音叠加层
- **Google Meet Plugin**: 通过 Chrome/Twilio 加入 Meet 会议

---

## 9. Web 界面

### 9.1 Control UI

Gateway 在同一端口提供内置 Web UI（Vite + Lit）：
- 默认：`http://<host>:18789/`
- 启用 TLS：`https://<host>:18789/`
- 可自定义 basePath：`gateway.controlUi.basePath`

### 9.2 WebChat

- 静态 UI，使用 Gateway WS API 进行聊天历史和发送
- 支持 SSH/Tailscale 隧道远程连接
- 可通过 `gateway.controlUi.root` 挂载自定义构建

### 9.3 Dashboard

提供：
- Agent 状态概览
- 渠道状态卡片
- 技能管理
- 会话浏览
- 日志查看

### 9.4 TUI

基于终端的 UI（`openclaw tui`），提供终端内的完整控制台体验。

---

## 10. OpenClaw App SDK

### 10.1 概述

`@openclaw/sdk` 是为 **OpenClaw 进程之外** 的应用提供的公共客户端 API。用途：
- 脚本、仪表板、CI 任务、IDE 扩展等
- 不同于 Plugin SDK（`openclaw/plugin-sdk/*` 仅在 OpenClaw 内部使用）

### 10.2 核心 API 面

| 面 | 状态 | 功能 |
|------|------|------|
| `OpenClaw` | Ready | 主客户端入口，拥有传输、连接、请求和事件 |
| `oc.agents` | Ready | 列出、创建、更新、删除 Agent 句柄 |
| `Agent.run()` | Ready | 启动网关 agent 运行，返回 `Run` |
| `oc.runs` | Ready | 创建、获取、等待、取消、流式传输运行 |
| `Run.events()` | Ready | 流式传输规范化的 per-run 事件 |
| `Run.wait()` | Ready | 调用 `agent.wait` 返回 `RunResult` |
| `oc.sessions` | Ready | 创建、解析、发送、修补、压缩会话 |
| `oc.tasks` | Ready | 任务账本操作 |
| `oc.models` | Ready | 模型列表和认证状态 |
| `oc.tools` | Ready | 工具目录和调用 |
| `oc.approvals` | Ready | 审批列表和决策 |
| `oc.rawEvents()` | Ready | 原始 Gateway 事件 |

### 10.3 基本用法

```typescript
import { OpenClaw } from "@openclaw/sdk";

const oc = new OpenClaw({
  url: "ws://127.0.0.1:18789",
  token: process.env.OPENCLAW_GATEWAY_TOKEN,
});
await oc.connect();

const agent = await oc.agents.get("main");
const run = await agent.run({ input: "Hello!" });

for await (const event of run.events()) {
  if (event.type === "assistant.delta") {
    process.stdout.write(event.data.delta);
  }
}
const result = await run.wait();
```

### 10.4 SDK 事件类型

| 事件类型 | 来源 Gateway 事件 |
|----------|-------------------|
| `run.started` | `agent` lifecycle start |
| `run.completed` | `agent` lifecycle end |
| `run.failed` | `agent` lifecycle error |
| `assistant.delta` | Assistant streaming delta |
| `thinking.delta` | Thinking/plan stream |
| `tool.call.started/completed/failed` | 工具调用生命周期 |
| `approval.requested/resolved` | 审批请求/决策 |
| `session.created/updated` | 会话变更事件 |

---

## 11. Multi-Agent 系统

### 11.1 概念

在**一个 Gateway** 中运行多个隔离的 Agent：
- 每个 Agent 有自己的工作区、状态目录（`agentDir`）、会话历史
- **绑定（Binding）** 将渠道账户映射到 Agent
- 入站消息通过绑定路由到正确的 Agent

### 11.2 关键标识符

| 标识符 | 含义 |
|--------|------|
| `agentId` | 一个 "大脑"（工作区、per-agent auth、per-agent session store） |
| `accountId` | 一个渠道账户实例（如 WhatsApp 账户 "personal" vs "biz"） |
| `binding` | 按 `(channel, accountId, peer)` 路由入站消息到 `agentId` |

### 11.3 路由规则

- 绑定是**确定性的**，**最具体匹配赢**
- 直接聊天折叠为 `agent:<agentId>:<peerKey>`（per-agent "main"）
- `peer` 匹配始终优于 `channel` 范围匹配

### 11.4 沙箱配置

Per-agent sandbox 配置：
```json5
{
  agents: {
    list: [
      {
        id: "family",
        sandbox: { mode: "non-main" },
        tools: { deny: ["exec"] },
        groupChat: { requireMention: true }
      }
    ]
  }
}
```

### 11.5 子 Agent（Sub-Agents）/ ACP

- **ACP（Agent Communication Protocol）**: 用于生成和管理子 Agent 会话
- `sessions_spawn`: 在隔离会话中执行后台任务
- **深度限制**: `maxSpawnDepth >= 2` 时，深度-1 协调子 Agent 获得递归协调工具
- **Runtime 选项**: `"subagent"`（默认）或 `"acp"`（外部 harness agent）

---

## 12. 3D Office / Kanban / Hub（生态项目）

### 12.1 OpenClaw Office（3D 办公室）

**仓库**: [WW-AI-Lab/openclaw-office](https://github.com/WW-AI-Lab/openclaw-office)

OpenClaw Multi-Agent 系统的可视化监控与管理前端：
- **等距投影（Isometric）** 虚拟办公室场景
- **核心隐喻**: Agent = 数字员工 | 办公室 = Agent 运行时 | 工位 = Session | 会议室 = 协作上下文
- **功能**: 2D 等距办公室、Agent 头像动画、协作连线可视化、气泡面板、Token 统计、事件时间轴
- **技术栈**: Vite 6 + React 19 + Zustand 5 + Tailwind CSS 4 + Recharts
- **WebSocket 直连** Gateway 实现实时同步

### 12.2 Claw3D

**仓库**: [iamlukethedev/Claw3D](https://github.com/iamlukethedev/Claw3D/)

- 基于 Three.js/React Three Fiber 的 **3D 引擎**
- 3D 复古办公室环境
- Agent 可作为工作人员在共享 3D 世界中移动
- 支持沉浸式操作空间（standups、GitHub review、分析）
- **双跳架构**: Browser → Studio WebSocket Proxy → OpenClaw Gateway

### 12.3 wickedapp/openclaw-office

**仓库**: [wickedapp/openclaw-office](https://github.com/wickedapp/openclaw-office)

- 使用 Gemini 生成的等距办公室场景（可选）
- Claude Vision 自动检测桌面位置
- SQLite 活动日志和成本追踪
- SSE 事件系统 + REST API

### 12.4 Kanban Board

Multi-Agent 工作的看板方法：
- Agent 状态列：running, idle, blocked, completed
- 卡片自动分配 Agent
- Agent 完成后自动移动卡片
- 定时执行（cron 集成）
- 与 OpenClaw Sessions 直接映射

### 12.5 OpenClaw Hub

内部门户概念：
- Second Brain（快速捕获可搜索笔记）
- Kanban backlog → ready → in progress → PR ready → done
- Agent status（运行中/任务/最后输出）
- Artifacts（PR 链接、报告、导出文件）
- "Morning Briefing" 布局

---

## 13. 安全模型

### 13.1 核心原则

- **默认最小权限**: 工具运行在主机上，但仅限 `main` 会话
- **群组/频道安全**: `agents.defaults.sandbox.mode: "non-main"` 将非 main 会话运行在沙箱内
- **沙箱后端**: Docker（默认）、SSH、OpenShell
- **DM 配对**: 默认 `dmPolicy="pairing"`，未知发送者需批准

### 13.2 认证模式

| 模式 | 描述 |
|------|------|
| `token` | 共享密钥 token（默认） |
| `password` | 共享密码 |
| `trusted-proxy` | 信任的反向代理（通过请求头） |
| `none` | 无认证（仅限私有入口，危险） |

### 13.3 设备配对

- 所有 WS 客户端（operators + nodes）在 `connect` 时提供**设备身份**
- 新设备 ID 需要**配对批准**，Gateway 签发**设备令牌**
- 本地 loopback 连接可**自动批准**
- 所有连接必须签名 `connect.challenge` nonce
- 签名负载 `v3` 绑定 `platform` + `deviceFamily`

### 13.4 远程安全

- 推荐：Tailscale 或 VPN
- 替代方案：SSH 隧道 `ssh -N -L 18789:127.0.0.1:18789 user@host`
- TLS + 可选的证书固定
- 非 loopback 绑定**需要**共享密钥认证

### 13.5 工具安全策略

典型沙箱默认：
- **允许**: `bash`, `process`, `read`, `write`, `edit`, `sessions_list`, `sessions_history`, `sessions_send`, `sessions_spawn`
- **拒绝**: `browser`, `canvas`, `nodes`, `cron`, `discord`, `gateway`

---

## 14. 文件系统布局

```
~/.openclaw/
├── openclaw.json              # Gateway 配置文件
├── workspace/                 # Agent 工作区（默认）
│   ├── AGENTS.md              # 操作指令
│   ├── SOUL.md                # 人设文件
│   ├── TOOLS.md               # 工具笔记
│   ├── USER.md                # 用户资料
│   ├── BOOTSTRAP.md           # 首次运行仪式
│   ├── IDENTITY.md            # Agent 名称/氛围
│   └── skills/                # 工作区技能
│       └── <skill>/SKILL.md
├── agents/                    # 多 Agent 状态
│   └── <agentId>/
│       ├── agent/             # Agent 配置
│       └── sessions/          # 会话存储
│           ├── sessions.json  # 会话索引
│           └── <sessionId>.jsonl  # 转录文件
├── skills/                    # 托管/本地技能
├── control-ui-custom/         # 可选自定义 UI
└── office-cache/              # Office 缓存（如果使用）
    └── chat/                  # 按天分片缓存聊天记录
```

**环境变量**:
- `OPENCLAW_HOME` — 内部路径解析的主目录
- `OPENCLAW_STATE_DIR` — 覆盖状态目录
- `OPENCLAW_CONFIG_PATH` — 覆盖配置文件路径
- `OPENCLAW_GATEWAY_PORT` — 覆盖 Gateway 端口
- `OPENCLAW_GATEWAY_TOKEN` — Gateway token
- `OPENCLAW_GATEWAY_PASSWORD` — Gateway 密码

---

## 15. Wire Protocol（有线协议）

### 15.1 WebSocket 协议

- **传输**: WebSocket，文本帧，JSON 负载
- **首帧**: **必须** 是 `connect`
- **帧大小上限**: 64 KiB

### 15.2 握手

```
Client → Gateway: connect (with auth, device identity)
Gateway → Client: hello-ok {
  server, features, snapshot (presence + health + stateVersion + uptimeMs),
  policy, auth (negotiated role/scopes)
}
```

### 15.3 请求/响应格式

```json
// 请求
{ "type": "req", "id": 1, "method": "agent", "params": { ... } }

// 响应
{ "type": "res", "id": 1, "ok": true, "payload": { ... } }
// 或错误
{ "type": "res", "id": 1, "ok": false, "error": { ... } }
```

### 15.4 事件

```json
{ "type": "event", "event": "agent", "payload": { ... }, "seq": 42, "stateVersion": 3 }
```

### 15.5 Agent 运行流程

```
1. Client → req:agent → res:agent (ack { runId, status: "accepted" })
2. Gateway → event:agent (streaming) × N
3. Gateway → res:agent (final { runId, status, summary })
```

### 15.6 幂等性

副作用方法（`send`, `agent`）需要幂等键；服务器保留短期去重缓存。

### 15.7 发现

- **mDNS（Bonjour）**: `_openclaw-gw._tcp` 服务类型
- **DNS-SD**: 支持广域发现
- TXT 记录：`role`, `transport`, `gatewayPort`, `sshPort`, `tailnetDns`, `gatewayTls`

---

## 16. 提供者/模型支持

### 16.1 支持的模型提供者

OpenClaw 支持 **50+ 模型提供者**：

| 类别 | 提供者 |
|------|--------|
| **主要** | Anthropic, OpenAI, Google (Gemini), xAI, DeepSeek, Mistral, Groq |
| **本地** | Ollama, LM Studio, vLLM, SGLang, LocalAI |
| **代理** | OpenRouter, LiteLLM, Cloudflare AI Gateway, Vercel AI Gateway |
| **云** | Amazon Bedrock, Azure, NVIDIA, Together AI, Fireworks, Cerebras |
| **中国** | Alibaba Model Studio, GLM (Zhipu), Moonshot, Qwen, Qianfan, StepFun, Tencent, Volcengine |
| **媒体** | ElevenLabs, Deepgram, Azure Speech, Runway, Fal, ComfyUI |
| **代码** | GitHub Copilot, OpenCode, Kilo Gateway |

### 16.2 模型故障转移

OpenClaw 支持：
- 多认证配置文件轮换（API key 轮换）
- 模型提供商故障转移
- `models.authStatus` RPC 检查认证状态

---

## 17. 平台应用

### 17.1 macOS 应用

- 菜单栏控制和 Gateway 健康监控
- Voice Wake + Push-to-Talk 覆盖层
- WebChat + 调试工具
- 远程 SSH 网关控制
- Canvas 支持 + A2UI
- Peekaboo bridge（屏幕共享）

### 17.2 iOS 节点

- 通过 Gateway WebSocket 配对
- Voice trigger forwarding + Canvas surface
- 通过 `openclaw nodes …` 控制

### 17.3 Android 节点

- WS 节点通过设备配对
- Connect/Chat/Voice tabs
- Canvas、Camera、Screen capture
- Android 设备命令

### 17.4 Windows

- 原生 Windows + WSL2 支持
- WSL2 推荐（更稳定）

---

## 18. 自动化

### 18.1 Cron Jobs（定时任务）

- 定时执行 Agent 任务
- 每次运行新会话或持久会话
- 可配置失败通知目标

### 18.2 Background Tasks（后台任务）

- `openclaw tasks` 命令管理
- 任务账本（task ledger）跨 Gateway 重启持久化
- SDK 通过 `oc.tasks` 暴露

### 18.3 Task Flow（任务流）

- 持久多步骤流编排
- 自有状态和修订追踪
- 托管控模式（创建并驱动任务）
- 镜像模式（观察外部创建的任务）

### 18.4 Hooks（钩子）

- 事件驱动脚本，用于命令和生命周期事件
- 通过 `hooks.enabled=true` 启用
- Webhook 端点也在同一 HTTP 服务器上暴露

### 18.5 Standing Orders（常驻指令）

- Agent 定期检查的持续指令
- 用于维护状态、检查目标达成等

---

## 19. 插件系统

### 19.1 插件类型

| 类型 | 用途 |
|------|------|
| **Provider 插件** | 添加新模型提供者 |
| **Channel 插件** | 添加新消息平台 |
| **Tool 插件** | 添加新工具能力 |
| **Hook 插件** | 添加生命周期钩子（before/after） |
| **Agent Harness 插件** | 添加 Agent 运行时 |

### 19.2 插件生命周期

```
openclaw plugins install <spec> → 验证 → 安装依赖 → 启用
openclaw plugins list --enabled → 查看已启用
openclaw plugins doctor → 诊断加载失败
```

### 19.3 插件 SDK

`openclaw/plugin-sdk/*` 子路径（仅在 OpenClaw 内部使用）：
- SDK 入口点
- 渠道入口 API
- 渠道消息 API
- 渠道回合内核
- 提供者插件
- 运行时辅助

### 19.4 社区插件

- Google Meet 插件
- Voice Call 插件
- Webhooks 插件
- Zalo Personal 插件
- Memory LanceDB 插件
- Memory Wiki 插件
- Skill Workshop 插件

---

## 20. 开发者参考

### 20.1 仓库信息

- **GitHub**: [openclaw/openclaw](https://github.com/openclaw/openclaw)
- **许可证**: MIT
- **Stars**: 374k+
- **语言**: TypeScript（pnpm workspace monorepo）
- **运行时**: Node.js 24（推荐）或 Node 22.19+
- **测试**: Vitest（unit/integration/e2e/live）

### 20.2 关键目录结构

```
openclaw/
├── src/
│   ├── gateway/          # Gateway 核心运行时
│   │   ├── server.impl.ts         # 启动 + 配置验证 + auth bootstrap
│   │   ├── server-runtime-config.ts  # 绑定/auth 运行时执行
│   │   ├── server-methods/        # WS RPC 方法实现
│   │   └── protocol/              # 协议模式（TypeBox）
│   ├── auto-reply/
│   │   └── reply/
│   │       ├── agent-runner.ts    # Agent 回合执行
│   │       └── reply-delivery.ts  # Block reply pipeline
│   ├── daemon/                    # 跨平台服务管理
│   ├── acp/                       # Agent Communication Protocol
│   └── chat-sanitize.ts           # 输入清理
├── apps/                          # 平台应用
├── packages/                      # 共享包
├── extensions/                    # 捆绑插件
├── skills/                        # 捆绑技能
├── ui/                            # Control UI（Vite + Lit）
├── docs/                          # 文档（与 docs.openclaw.ai 同步）
├── test/                          # 测试
└── qa/                            # QA 场景
```

### 20.3 开发命令

```bash
# 开发环境设置
git clone https://github.com/openclaw/openclaw.git
cd openclaw
pnpm install
pnpm openclaw setup

# 开发循环
pnpm ui:build        # 构建 Control UI
pnpm gateway:watch   # 自动重载开发模式

# 构建
pnpm build           # 完整构建

# 测试
pnpm test            # 运行测试
```

### 20.4 发布渠道

| 渠道 | 描述 | npm dist-tag |
|------|------|-------------|
| **stable** | 标记版本 `vYYYY.M.D` | `latest` |
| **beta** | 预发布 `vYYYY.M.D-beta.N` | `beta` |
| **dev** | `main` 分支动态头 | `dev` |

### 20.5 相关链接

| 资源 | URL |
|------|-----|
| 官网 | https://openclaw.ai |
| 文档 | https://docs.openclaw.ai |
| GitHub | https://github.com/openclaw/openclaw |
| Discord | https://discord.gg/clawd |
| ClawHub | https://clawhub.ai |
| DeepWiki | https://deepwiki.com/openclaw/openclaw |
| X/Twitter | https://x.com/openclaw |

---

## 对 OpenClaw Desktop 开发者的关键要点

1. **Gateway 是单一真相源** — 所有状态由 Gateway 拥有，UI 客户端通过 WebSocket 查询
2. **WebSocket 协议是必需的** — 第一帧必须是 `connect`，包含认证和设备身份
3. **App SDK (`@openclaw/sdk`)** 是外部应用连接 Gateway 的推荐方式
4. **Agent 事件流** — `agent` RPC 返回两阶段：立即 ack → 流式事件 → 最终响应
5. **会话模型** — 每个会话有 `sessionKey`（格式：`agent:<agentId>:<peerKey>`）
6. **多 Agent 路由** — 绑定按 `(channel, accountId, peer)` 匹配，最具体优先
7. **安全默认** — 默认 loopback 绑定 + token/password 认证；远程访问需显式配置
8. **设备配对** — 所有客户端必须签名 `connect.challenge` nonce，新设备需批准
9. **OpenAI 兼容 API** — Gateway 暴露 `/v1/chat/completions`, `/v1/models` 等端点
10. **事件不重放** — 客户端必须在断连后刷新状态
