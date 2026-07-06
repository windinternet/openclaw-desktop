# 安全规范

> 最后更新: 2026-07-02
> 参考：OWASP Desktop App Security、Electron Security 最佳实践

## Electron 安全

### 当前配置

| 配置项 | 状态 | 说明 |
|--------|------|------|
| `contextIsolation: true` | ✅ 已启用 | 渲染进程与 Electron API 隔离，防止原型污染攻击 |
| `nodeIntegration: false` | ✅ 已禁用 | 渲染进程无法直接访问 Node.js API |
| `contextBridge` | ✅ 已使用 | 通过 preload.ts 暴露受控 API（platform、versions、storage、repository、artifact、device、connect、pet 等） |
| `sandbox` | ⚠️ 未显式设置 | 需要在 preload 中进一步评估 |
| `nodeIntegrationInWorker` | ✅ 默认禁用 | 未显式开启 |

### preload 层安全

当前 preload.ts 通过 `contextBridge.exposeInMainWorld` 暴露：

- `electronAPI.platform` — 操作系统类型
- `electronAPI.versions` — Node.js 和 Electron 版本
- `electronAPI.storage` — 主进程受控的设置、实例和实例数据读写
- `electronAPI.repository` — 主进程受控的仓库选择、读写、搜索、Git 和知识导入工具
- `electronAPI.artifact` — Artifact storage、导入副本、只读预览、授权请求和 Skill 写入工具
- `electronAPI.device.signChallenge` — Gateway device challenge 签名入口
- `electronAPI.connect` / `electronAPI.discover` — 本地 Gateway 探测和本机自动批准辅助
- `electronAPI.pet` — 桌宠状态与事件桥

**原则**：preload 层只能暴露受控 IPC 包装；仓库、Artifact、本地文件、Git、授权、安装和日志类能力必须在主进程 handler 中做路径、能力和审批边界校验。新增暴露方法需经过安全评审。

### 渲染进程约束

- 渲染进程使用 React + TypeScript 沙箱环境
- 不直接调用 `require()` 或 Node.js 模块
- 与主进程通信通过 `contextBridge` + `ipcRenderer` 受控通道

## 网络安全

### Gateway WebSocket 通信

当前通过 WebSocket 连接 OpenClaw Gateway，并已接入 token auth 与 device challenge：

| 阶段 | 机制 | 安全要点 |
|------|------|---------|
| 握手 | Gateway `connect.challenge` + `device.signChallenge` | 防止设备挑战被静默绕过 |
| 传输 | WSS (WebSocket Secure) | 仅在 TLS 下建立连接 |
| 鉴权 | `auth.token` + 可选 device signature | token 由实例配置或本机 OpenClaw config 发现流程提供 |
| 重连 | 自动重连 + Token 刷新 | 避免长期有效 Token 泄露 |

仍需补充或收口的细节：

- 签名算法的选择与密钥管理方案
- Token 在本地存储的加密方式
- 重连期间的认证状态保持策略
- Gateway 诊断日志中的 token preview / token 长度等字段需要继续脱敏审计

### CSP (Content Security Policy)

Artifact HTML 预览、Artifact Bridge 和 `artifact-file://` 已有局部 CSP / sandbox 边界：AI 创建保存前 HTML 预览会注入受限 `Content-Security-Policy` 并使用 sandbox iframe，Artifact Bridge 的普通浏览器 `fetch()` 仍被 CSP 阻止，导入 PDF / audio / video 副本通过只读 `artifact-file://<artifactId>/imported` 协议提供预览，协议响应会带 CSP header。

应用级生产 CSP 仍未完整收口。Electron 应用中 CSP 是防御 XSS 的核心手段，优先级高。

建议在生产构建中启用以下策略：

```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data:;
connect-src 'self' wss://*.openclaw.ai;
```

## 认证模型

### 当前状态

Gateway token auth 与 device challenge 已接入。当前模型：

```
实例 token / 本机 OpenClaw config → WebSocket connect → Gateway Challenge → device.signChallenge → connect ok
```

### 设计要点

- 无密码本地存储（Token 后续迁移到系统密钥链）
- 会话过期自动刷新，不打断用户体验
- 登出时清除所有本地认证凭证

## 数据安全

### 本地存储

| 数据类型 | 存储方式 | 安全要求 |
|---------|---------|---------|
| Token / 凭证 | 当前由 Electron 主进程受控文件保存，后续迁移到系统密钥链 | 不进入渲染进程 localStorage，不输出日志 |
| 会话历史 | Gateway 为事实源，Desktop 仅做实例级本地缓存 | 不含敏感认证信息 |
| 配置 | Electron 主进程 JSON 文件 | 默认值不含密钥，按实例命名空间隔离 |

### 日志安全

- 不将 Token 或认证凭证输出到控制台；当前 Gateway / main 诊断日志中仍需继续审计并移除 token preview 类字段
- 日志中不记录密码、密钥等敏感字段
- 调试日志仅在开发环境启用

## 依赖安全

### 当前措施

- 依赖仍使用 npm semver 范围版本，缺少 npm audit / Dependabot / Renovate 的 CI 阻断门禁
- TypeScript strict 模式减少类型相关安全风险
- Electron 已配置在 `package.json`，版本新旧以当前 lockfile / install 状态为准

### 待实施

| 措施 | 优先级 | 说明 |
|------|--------|------|
| Dependabot / Renovate | 高 | 自动检测依赖漏洞 |
| npm audit 集成到 CI | 高 | 阻止含已知漏洞的依赖合并 |
| SCA (软件组成分析) | 中 | 更全面的依赖安全扫描 |
| 锁定 electron-builder 输出签名 | 低 | 确保发布包完整性 |

## PR 安全审查清单

每个 PR 合入前应确认：

- [ ] 不引入新的 `nodeIntegration` 或禁用 `contextIsolation` 的修改
- [ ] preload 层未暴露未授权的 IPC 通道
- [ ] 渲染进程不直接访问 `process`、`require` 等 Node.js 全局
- [ ] 新的外部通信使用 WSS 而不是 WS
- [ ] 不将 Token、密钥等敏感信息写入日志
- [ ] 不引入已知存在漏洞的依赖（需通过 npm audit）
- [ ] 用户输入经过正确转义或校验，不直接拼接为 HTML/URL

## 参考

- [Electron Security 文档](https://www.electronjs.org/docs/latest/tutorial/security)
- [OWASP Desktop App 安全指南](https://cheatsheetseries.owasp.org/cheatsheets/Desktop_Application_Security_Cheat_Sheet.html)
- [OWASP WebSocket 安全](https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html)
- [CSP 参考](https://content-security-policy.com/)
