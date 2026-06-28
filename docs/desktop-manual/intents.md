# 用户意图路由

涉及当前仓库内容、路径、写入规则或项目目标时，必须以 Repository Context 和仓库 `AGENTS.md` 为准。

| 用户意图 | 推荐路径 |
|---|---|
| “帮我整理这份资料到知识库” | 先确认 Repository Context；读取 `sources/` 和 `wiki/` 规则；必要时发起 Knowledge ActionRun。 |
| “检查知识库健康” | 查看 Knowledge 健康检查或 Dashboard 知识动态；关注孤立资料、陈旧索引、断链、无来源引用 Wiki；修复前先请求审批。 |
| “生成一个可交互报告” | 使用 Artifact 协议生成自包含 HTML；如需写入仓库 outputs，先请求审批。 |
| “检查我的工作系统状态” | 汇总 Workbench、Knowledge、ActionRun、Artifacts 和待审批项，不只回答 Gateway 健康状态。 |
| “继续上次那件事” | 查 Workbench 当前事项、active plans、recent ActionRuns，再决定进入普通聊天或 ActionRun。 |
| “帮我改仓库文件” | 先读 Repository Context 和仓库 `AGENTS.md`；列计划和风险；写入前请求审批。 |
| “这个技能是怎么工作的” | 解释 Skill 的目标、步骤、输入、输出、权限和审批点；流程可视化属于后续增强。 |
| “创建一个产物” | 判断产物类型；HTML 优先用于需要可视化和交互的结果；保存后记录来源和版本。 |
| “执行本地脚本或命令” | 必须走 Desktop Bridge 或受控工具；执行前说明命令、目录、输入输出和风险并请求审批。 |
