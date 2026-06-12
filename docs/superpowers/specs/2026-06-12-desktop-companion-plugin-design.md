# OpenClaw Desktop Companion 插件设计

## 目标

OpenClaw Desktop 需要一个官方形态的 OpenClaw native plugin，作为 Desktop
能力进入 Gateway / Agent 运行时的扩展入口。

这个插件不只服务“产物”功能。产物只是第一个实际能力，用来验证完整链路：
Agent 工具调用 -> Gateway 插件 -> 官方 `node.invoke` -> 本地 Desktop 执行 ->
会话详情页识别和展示。

设计必须默认支持远程 Gateway。Desktop 和 Gateway 不应被假设运行在同一台机器
上，否则 Desktop 的价值会退化成本机 CLI 包装。

## 核心原则

- Desktop 是本地化 Electron 应用，只通过 Gateway 官方协议连接一个或多个
  OpenClaw 实例。
- Desktop 不假设自己能读写 Gateway 主机文件系统。
- Desktop 不依赖 CLI 完成正式业务逻辑。
- CLI 只允许用于“快捷扫描本机 OpenClaw 实例”这类本机发现/诊断场景。
- 插件 RPC 是控制面：状态、安装检测、能力目录、任务目录、版本协商。
- 官方 `node.invoke` 是执行面：真正需要 Desktop 本地执行的动作，通过 Desktop
  node 命令完成。
- Skill 只能教 Agent 怎么使用能力，不能替代真实 Gateway tool 注册。
- 插件缺失或不可用时，Desktop 必须优雅降级到会话解析和本地 UI 能力。

## 仓库布局

Companion 插件使用独立公开仓库：

```text
https://github.com/windinternet/openclaw-desktop-companion.git
```

本地开发时，把插件仓库 clone 到 Desktop 工作区下：

```text
plugins/openclaw-desktop-companion/
```

这个目录是独立 Git 仓库。`openclaw-desktop` 父仓库忽略该目录，避免把插件代码
误提交到 Desktop 主仓。Desktop 主仓只保留协议设计、集成代码和必要文档。

## 分发与安装

第一阶段不走 ClawHub，也不走 npm。插件通过 Git 仓库安装：

```bash
openclaw plugins install git:github.com/windinternet/openclaw-desktop-companion@main
openclaw plugins enable openclaw-desktop-companion
openclaw gateway restart
openclaw plugins inspect openclaw-desktop-companion --runtime --json
```

Desktop 不应在远程实例上直接执行这些命令。远程 Gateway 缺少插件时，Desktop 提供
一个“会话兜底安装”入口：创建或准备一条 OpenClaw 会话，让 Gateway 侧 Agent 在
Gateway 主机上完成 clone/install/enable/restart/inspect。

这样权限和文件系统访问都留在 Gateway 侧，Desktop 只负责发起明确的、用户确认过
的安装意图。

本机快速扫描场景可以尝试 CLI，例如探测本机 OpenClaw 是否安装、版本是多少、是否
有本机 Gateway 运行。除此之外，正式功能都不依赖 CLI。

## 插件形态

插件 ID：

```text
openclaw-desktop-companion
```

插件是 OpenClaw native plugin，至少包含：

- `openclaw.plugin.json`
- `package.json` 中的 `openclaw.extensions`
- TypeScript 源码和编译后的 JavaScript 入口
- 通过 Plugin SDK 注册的 Agent tools
- 通过 Plugin SDK 注册的 Gateway RPC methods
- 随插件发布的 skills，用来教 Agent 何时使用 Desktop 增强能力

第一批能力组是：

```text
artifacts
```

后续能力组可以继续扩展，例如通知、本地文件选择、本地展示窗口、导出、桌面状态、
可视化审阅等，但都必须经过同样的控制面/执行面协议。

## 控制面：插件 RPC

插件在 Gateway 内注册自己的 RPC namespace：

```text
desktopCompanion.status
desktopCompanion.capabilities
desktopCompanion.tasks.list
desktopCompanion.tasks.get
desktopCompanion.tasks.submitResult
```

控制面负责：

- 判断插件是否安装、启用、runtime 已加载。
- 返回插件版本、协议版本、最低 Desktop 版本要求。
- 返回插件支持的能力组，例如 `artifacts`。
- 发现当前在线的 Desktop node。
- 暴露待 Desktop 处理的任务目录，作为事件丢失或重连后的补偿机制。
- 对任务 payload schema 做版本协商。

Desktop 连接 Gateway 后优先调用这些 RPC。若 RPC method 不存在，Desktop 认为
Companion 插件未安装、未启用，或当前 Gateway 版本不支持该插件。

## 执行面：官方 node invoke

Desktop 额外以 Gateway node 身份连接，并声明 Desktop 自己能执行的本地命令。

插件不调用 Desktop 的 localhost，不假设同机网络，也不让 Gateway 直接访问
Desktop 文件系统。Gateway 永远是插件与 Desktop 之间的 rendezvous 点。

初始 Desktop node command：

```text
desktop.artifacts.create
desktop.artifacts.open
desktop.artifacts.update
desktop.artifacts.append
desktop.notify
```

插件的 Agent tool 被调用后，插件通过 Gateway node invoke 能力把任务转发给在线
Desktop node。Desktop 收到 node invoke 请求后，在本地执行动作并返回结构化结果。

如果没有兼容的 Desktop node 在线，插件工具返回结构化、可恢复错误，让 Agent 可以
明确告诉用户：需要打开或连接 OpenClaw Desktop。

## 第一个能力：产物 artifacts

产物是 Companion 插件的第一个完整能力闭环。

插件注册模型可见的 Agent tools，例如：

```text
desktop_artifact_create
desktop_artifact_update
desktop_artifact_append
desktop_artifact_open
```

模型可见 tool 使用稳定的 snake_case 名称。Desktop node command 使用 dotted
命名，贴合 OpenClaw node command 习惯。

创建产物流：

1. Agent 判断用户需要富 HTML 产物，例如报告、仪表盘、分析、清单、文档。
2. Agent 调用 `desktop_artifact_create`，传入标题、类型、元数据和 HTML。
3. 插件校验输入，并解析目标 Desktop node。
4. 插件通过 `node.invoke` 转发到 `desktop.artifacts.create`。
5. Desktop 在本地保存产物，并根据用户偏好打开窗口或写入产物索引。
6. Desktop 返回 artifact id、标题、版本、展示状态。
7. 插件把结构化结果返回给 Agent。
8. 会话详情页继续识别并展示该产物。

降级路径：

- 插件缺失时，Desktop 仍然可以解析会话里的 `<artifact>` 块并保存本地产物。
- 插件存在但 Desktop node 离线时，Agent 收到明确的可恢复错误。
- node invoke 已创建任务但结果未返回时，Desktop 重连后可通过控制面任务目录补偿。

## Desktop 体验

Desktop 连接 Gateway 后，需要评估 Companion 状态：

```text
missing        插件 RPC 不存在，视为未安装或未加载
disabled       配置里可见插件，但 runtime 未加载
incompatible   插件版本、协议版本或 Desktop 版本不兼容
ready          插件 RPC 可用，Desktop node 也被接受
degraded       插件可用，但某个能力组不可用
```

Desktop UI 应提供：

- 实例连接区域里的简短插件状态。
- 缺失时的安装引导。
- 未启用时的启用/重启引导。
- 每个能力组的诊断状态。
- 会话兜底安装入口。

Desktop 不应静默安装或启用插件。插件安装属于供应链动作，必须由用户明确确认。

## 会话兜底安装

当 Desktop 检测到插件缺失时，可以生成一条 OpenClaw 会话任务：

```text
请在当前 Gateway 主机上安装并启用 OpenClaw Desktop Companion 插件：
git:github.com/windinternet/openclaw-desktop-companion@main。
安装后如有需要请重启 Gateway，并用 runtime inspect 验证插件已注册 tools 和 RPC。
```

会话完成后应报告：

- 实际执行的安装命令。
- 插件启用结果。
- Gateway 重启结果，或无法自动重启时的人工操作提示。
- `openclaw plugins inspect openclaw-desktop-companion --runtime --json` 的关键证据。
- 最终插件版本和注册 tool 列表。

Desktop 不能仅凭会话文本判断成功。最终仍要通过 Gateway RPC 确认插件 ready。

## 安全边界

- Desktop node command 必须明确、窄小，不提供泛化 shell 能力。
- 插件 tool 在调用 node invoke 前必须校验 payload schema 和大小。
- 未来任何涉及本地文件、系统状态、导出、执行、剪贴板、浏览器控制的能力，都必须
  先设计权限模型。
- Desktop 执行动作前应能展示请求来自哪个 Gateway 实例。
- 敏感信息不应进入任务日志，除非用户明确把它作为输入提供。
- 插件安装、启用、升级都必须用户确认，不做静默供应链变更。

## 测试策略

插件测试：

- `openclaw.plugin.json` manifest 有效。
- runtime inspect 能看到注册的 tools 和 RPC methods。
- artifact tool 能校验必填字段。
- Desktop node 缺失时返回可恢复错误。
- node invoke 成功时返回 artifact 元数据。

Desktop 测试：

- RPC 缺失时能识别插件 missing。
- `desktopCompanion.status` 可用时能识别 ready。
- 插件缺失时，会话 `<artifact>` 解析降级仍然工作。
- Desktop node command 能保存本地产物。
- 远程安装提示不会执行本地 CLI。

集成验证：

- 用 Git 安装插件到测试 Gateway。
- Desktop 以 node 身份连接 Gateway。
- 发起一条会话请求，让 Agent 创建产物。
- 验证 Desktop 本地保存并展示产物。
- 验证会话详情页能识别该产物。

