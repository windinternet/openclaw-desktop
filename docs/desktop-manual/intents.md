# 用户意图路由

涉及当前仓库内容、路径、写入规则或项目目标时，必须以 Repository Context 和仓库 `AGENTS.md` 为准。

| 用户意图                     | 推荐路径                                                                                                                                                                   |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| “把这段文字加入资料库”       | 先确认 Repository Context；通过 Knowledge 导入文本入口或 Desktop repository write 写入 `sources/imported/`；导入后进入未消化资料队列，不自动改写 Wiki。                    |
| “导入这个 Markdown/TXT 文件” | 先确认 Repository Context；通过 Knowledge 导入文件入口或拖拽导入读取本地文本文件，写入 `sources/imported/` 并进入未消化资料队列；Office/PDF/二进制内容仍需走后续专门能力。   |
| “导入这个资料文件夹”         | 先确认 Repository Context；通过 Knowledge 导入文件夹入口读取目录中的 Markdown / TXT / text 文件，写入 `sources/imported/` 并保留相对路径；Office/PDF/二进制内容仍需后续专门能力。 |
| “收藏/剪藏这个网页”          | 先确认 Repository Context；通过 Knowledge 剪藏 URL 入口把 URL、标题和摘录/备注写入 `sources/imported/`；当前不后台抓网页正文，后续消化再走 ActionRun 审批。                |
| “帮我整理这份资料到知识库”   | 先确认 Repository Context；读取 `sources/` 和 `wiki/` 规则；必要时发起 Knowledge ActionRun。                                                                               |
| “有哪些资料还没整理”         | 打开 Knowledge 未消化资料队列 `/knowledge?section=digest`；选择资料后发起消化 ActionRun，写入前请求审批。                                                                  |
| “检查知识库健康”             | 查看 Knowledge 健康检查或 Dashboard 知识动态；关注孤立资料、陈旧索引、断链、无来源引用 Wiki、长期未复盘事项和相互矛盾记录；修复前先请求审批。                                |
| “把知识库健康检查写入复盘”   | 打开 Knowledge 健康检查 `/knowledge?section=health`，使用“写入周复盘”把当前报告写入 `reviews/weekly/`；这只归档事实，不自动修复问题。                                      |
| “处理这个知识库收尾动作”     | 从 Dashboard 进入 Knowledge 的 `tailAction=knowledge` 上下文，发起携带 `workItemPath` / `tailActionId` 的 `knowledge_rewrite` ActionRun；先读取来源事项、关联执行记录、关联成果和现有知识库，写入前请求审批，不直接勾选尾动作。 |
| “处理这次计划执行里的知识更新” | 从 Workbench 活跃计划预览进入“更新知识 / Update Knowledge”，打开 Knowledge 的 `tailAction=knowledge`、`tailActionId=action-run-knowledge:<runId>`、`workItemPath` 上下文；发起 `knowledge_rewrite`，写入前请求审批，不显示或勾选事项 checklist 尾动作。 |
| “生成一个可交互报告”         | 使用 Artifact 协议生成自包含 HTML；如需写入仓库 outputs，先请求审批。                                                                                                      |
| “检查我的工作系统状态”       | 汇总 Workbench、Knowledge、ActionRun、Artifacts 和待审批项，不只回答 Gateway 健康状态。                                                                                    |
| “继续上次那件事”             | 查 Workbench 当前事项、active plans、recent ActionRuns，再决定进入普通聊天或 ActionRun。                                                                                   |
| “帮我改仓库文件”             | 先读 Repository Context 和仓库 `AGENTS.md`；列计划和风险；写入前请求审批。                                                                                                 |
| “这个技能是怎么工作的”       | 解释 Skill 的目标、步骤、输入、输出、权限和审批点；流程可视化属于后续增强。                                                                                                |
| “创建一个产物”               | 判断产物类型；HTML 优先用于需要可视化和交互的结果；保存后记录来源和版本。                                                                                                  |
| “执行本地脚本或命令”         | 必须走 Desktop Bridge 或受控工具；执行前说明命令、目录、输入输出和风险并请求审批。                                                                                         |
