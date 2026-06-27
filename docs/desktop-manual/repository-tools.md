# Repository 工具边界

涉及当前仓库内容、路径、写入规则或项目目标时，必须以 Repository Context 和仓库 `AGENTS.md` 为准。

## 定位

Desktop Repository tools 让 Gateway Agent 可以通过 Desktop 读取、搜索、写入和提交当前绑定仓库。工具能力只是通道，不决定当前仓库的工作规则。

## 使用规则

1. 先确认 Repository Context 是否存在。
2. 先读取仓库 `AGENTS.md` 和相关文件。
3. 不要凭 Desktop Self-Knowledge Pack 猜测当前仓库目录、目标或写入规则。
4. 写入前列出计划、目标路径、风险和验证方式。
5. 需要用户批准后再写入或提交。

## 常见能力

- `desktop_repository_status`
- `desktop_repository_read`
- `desktop_repository_search`
- `desktop_repository_write`
- `desktop_repository_git_status`
- `desktop_repository_git_diff`
- `desktop_repository_git_log`
- `desktop_repository_git_commit`

## 与 Desktop Self-Knowledge 的关系

Desktop Self-Knowledge 只说明这些工具存在以及何时使用。当前仓库怎么写、写哪里、是否允许写，必须由 Repository Context 和仓库 `AGENTS.md` 决定。

