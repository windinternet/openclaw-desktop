# 用户意图路由

涉及当前仓库内容、路径、写入规则或项目目标时，必须以 Repository Context 和仓库 `AGENTS.md` 为准。

| 用户意图                     | 推荐路径                                                                                                                                                                   |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| “把这段文字加入资料库”       | 先确认 Repository Context；通过 Knowledge 导入文本入口或 Desktop repository write 写入 `sources/imported/`；导入后进入未消化资料队列，不自动改写 Wiki。                    |
| “导入这个 Markdown/TXT/PDF/Office 文件” | 先确认 Repository Context；通过 Knowledge 导入文件入口或拖拽导入读取本地 Markdown / TXT，或对 PDF / Word / Excel / PowerPoint 做 best-effort 抽取文本，写入 `sources/imported/` 并进入未消化资料队列；旧版 Word .doc 会在 macOS 上尝试 textutil best-effort，旧版 Excel 会尝试 BIFF8 结构化/printable-text best-effort，旧版 PowerPoint 会尝试 TextHeaderAtom text atom/printable-text best-effort，并在存在 SlideContainer/NotesContainer 时按 # Slide N / # Notes N 小节分节，SVG 图片会 best-effort 抽取显式文本；栅格图片 OCR、音视频转写和 Office 结构化版式恢复仍需后续专门能力。 |
| “导入这个资料文件夹”         | 先确认 Repository Context；通过 Knowledge 导入文件夹入口读取目录中的 Markdown / TXT / PDF / Word / Excel / PowerPoint / SVG 图片文件，写入 `sources/imported/` 并保留相对路径；旧版 Word .doc 会在 macOS 上尝试 textutil best-effort，旧版 Excel 会尝试 BIFF8 结构化/printable-text best-effort，旧版 PowerPoint 会尝试 TextHeaderAtom text atom/printable-text best-effort，并在存在 SlideContainer/NotesContainer 时按 # Slide N / # Notes N 小节分节，SVG 图片会 best-effort 抽取显式文本；栅格图片 OCR、音视频转写和 Office 结构化版式恢复仍需后续专门能力。 |
| “收藏/剪藏这个网页”          | 先确认 Repository Context；通过 Knowledge 剪藏 URL 入口把 URL、标题和摘录/备注写入 `sources/imported/`；无手填摘录且 Electron URL fetching 可用时，会 best-effort 抓取网页标题和正文片段，并记录 `urlFetchStatus`、`## 网页抓取内容` 和 `## 抓取边界`；后续消化仍走 ActionRun 审批。                |
| “帮我整理这份资料到知识库”   | 先确认 Repository Context；读取 `sources/` 和 `wiki/` 规则；必要时发起 Knowledge ActionRun。                                                                               |
| “有哪些资料还没整理”         | 打开 Knowledge 未消化资料队列 `/knowledge?section=digest`；选择资料后发起消化 ActionRun，写入前请求审批。                                                                  |
| “检查知识库健康”             | 查看 Knowledge 健康检查或 Dashboard 知识动态；关注孤立资料、陈旧索引、断链、无来源引用 Wiki、长期未复盘事项和相互矛盾记录；修复前先请求审批。                                |
| “把知识库健康检查写入复盘”   | 打开 Knowledge 健康检查 `/knowledge?section=health`，使用“写入周复盘”把当前报告写入 `reviews/weekly/`；这只归档事实，不自动修复问题。                                      |
| “处理这个知识库收尾动作”     | 从 Dashboard 进入 Knowledge 的 `tailAction=knowledge` 上下文，发起携带 `workItemPath` / `tailActionId` 的 `knowledge_rewrite` ActionRun；先读取来源事项、关联执行记录、关联成果和现有知识库，写入前请求审批，不直接勾选尾动作。 |
| “处理这次计划执行里的知识更新” | 从 Workbench 活跃计划预览进入“更新知识 / Update Knowledge”，打开 Knowledge 的 `tailAction=knowledge`、`tailActionId=action-run-knowledge:<runId>`、`workItemPath` 上下文；发起 `knowledge_rewrite`，写入前请求审批，不显示或勾选事项 checklist 尾动作。 |
| “给这次计划执行写复盘”       | 从 Workbench 活跃计划预览进入“写复盘 / Write Review”，打开 Workbench reviews 的 `tailAction=review`、`tailActionId=action-run-review:<runId>`、`workItemPath` 上下文；创建 `reviews/weekly/` 复盘草稿，并把链接写回来源事项 `## 复盘`；不自动确认复盘或勾选事项 checklist 尾动作。 |
| “生成一个可交互报告”         | 使用 Artifact 协议生成自包含 HTML；可按 `artifactWriteChannel` 选择 `auto-direct-with-fallback`、`preview-first` 或 `conversation-only`。插件可用且策略允许时优先用 `desktop.artifacts.create` / `desktop.outputs.create` 直写 Artifact 或 Repository output，失败或禁用直写时降级 `<artifact> fallback` 和保存前预览；HTML 保存后会记录 `htmlAudit`。直写不等于静默执行，写 Repository、导入本地文件、执行命令或授予 Bridge 权限仍需审批或用户确认。 |
| “检查我的工作系统状态”       | 汇总 Workbench、Knowledge、ActionRun、Artifacts 和待审批项，不只回答 Gateway 健康状态。                                                                                    |
| “继续上次那件事”             | 查 Workbench 当前事项、active plans、recent ActionRuns，再决定进入普通聊天或 ActionRun。                                                                                   |
| “帮我改仓库文件”             | 先读 Repository Context 和仓库 `AGENTS.md`；列计划和风险；写入前请求审批。                                                                                                 |
| “这个技能是怎么工作的”       | 解释 Skill 的目标、步骤、输入、输出、权限和审批点；流程可视化属于后续增强。                                                                                                |
| “创建一个产物”               | 先判断产物类型、复用分类和安全边界；遵守 `artifactWriteChannel`：`auto-direct-with-fallback` 优先 `desktop.artifacts.create` / `desktop.outputs.create`，`preview-first` 返回 `<artifact> fallback` 供预览保存，`conversation-only` 不调用直写命令。保存后记录来源、版本、Repository output 线索和价值健康；直写不等于静默执行。 |
| “执行本地脚本或命令”         | `artifactBridge.exec` 只提出命令执行审批意图；执行型 Artifact 应先用 `desktop.artifacts.execution.prepare` 记录审批锚点，仓库本地脚本/工作流用 `desktop.repository.assets.execution.record` 记录审批、运行或结果事实；真正运行交给外部 runner，Desktop 不执行命令、不授予权限。 |
