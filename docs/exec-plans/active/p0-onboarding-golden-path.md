# 开箱金线独立推进设计与实施文档

> 状态：活跃
> 优先级：P0
> 适用线程：可由新的 Codex 会话并行推进
> 关联路线图：`docs/design-docs/product-goal-roadmap.md` 的 P0-0 与 P0-6
> 并行契约：`docs/exec-plans/active/p0-parallel-shared-contract.md`

## 1. 核心修正

开箱金线不能把用户拖进复杂初始化。用户第一天打开 Desktop，目标应该是尽快开始管理资料、推进事项、留下成果，而不是被迫理解或创建仓库。

新的金线口径：

```text
打开应用 -> 选择语言/主题 -> 自动发现或安装 Gateway -> 选择工作空间 -> 输入第一件事或先体验 -> 进入工作台
```

关键原则：

- Gateway 是基础设施，不是用户目标。
- 不要把仓库初始化做成强制门槛。
- “创建本地工作仓库”只是一个推荐选项，不是唯一入口。
- 用户可以先跳过工作空间配置，进入轻量体验；等要沉淀长期事实时再选择仓库。
- 如果用户已有仓库，应该能绑定已有仓库，而不是被要求新建。
- 如果已有仓库符合推荐结构，Desktop 可以生成映射并直接开始。
- 如果已有仓库不符合推荐结构，Desktop 可以提供可审批的改造建议，而不是直接拒绝或强制迁移。

## 2. 工作空间选择模型

开箱中的“工作空间”应提供四条路径，按低摩擦优先：

1. **跳过仓库初始化**
   - 适合只想先试用、聊天、生成临时成果、看 Desktop 能力的用户。
   - Desktop 明确提示：跳过后仍可使用 Gateway 和部分 Desktop 功能，但长期知识、事项、计划、执行记录、成果和复盘不会完整沉淀到仓库。
   - 后续任何需要长期沉淀的动作，再引导用户绑定或创建工作空间。

2. **新建推荐结构仓库**
   - 适合没有现成工作仓库的用户。
   - Desktop 创建推荐目录结构，例如 `sources/`、`wiki/`、`work/`、`plans/`、`runs/`、`outputs/`、`reviews/`。
   - 这是推荐路径，但不能是强制路径。

3. **绑定已有仓库**
   - 适合已经有项目、资料库、笔记库或工作仓库的用户。
   - Desktop 先做只读检查，识别是否已有推荐目录、`AGENTS.md`、工作事项、知识库或输出目录。
   - 如果符合推荐结构，直接生成映射，进入工作台。

4. **映射或改造已有仓库**
   - 适合仓库不符合推荐结构，但用户不想迁移的情况。
   - Desktop 可以生成映射，把用户现有目录对应到资料、知识、事项、计划、执行记录、成果、复盘。
   - 如果缺目录或协议，Desktop 提供改造建议和可审批写入，不自动改造。
   - 用户可以选择只映射不改造，或者逐步接受改造。

## 3. 当前代码事实

当前代码事实摘要：

- `src/lib/work-system-onboarding.ts` 定义 `/?onboarding=work-system` 和 `work-system-onboarding` 锚点。
- `WelcomePage` / `SetupPage` 连接成功后会进入 `/?onboarding=work-system`。
- `App` 会让该 query 绕过默认首页偏好，进入 Dashboard。
- Dashboard 在 Gateway 已连接但当前实例没有可用工作仓库时，会显示“创建你的工作系统”引导。
- Dashboard 开箱引导已通过 `WorkSystemWorkspaceChoice` 把下一步改成“选择工作空间”：继续体验、新建推荐结构、绑定已有仓库、映射或改造已有仓库。
- `WorkSystemWorkspaceChoice` 仍复用 `RepositoryGate area="workbench"` 承接新建推荐仓库、选择已有目录、绑定、Workbench 语义映射和审批式安全改造，不另起一套仓库绑定逻辑。
- “继续体验”当前会把第一件事草稿构造成新会话初始消息，作为临时事项/轻量上下文进入新会话，避免仓库初始化成为第一天的强制门槛；如果后续已有 ready 工作空间，New Session 和具体聊天页的临时事项卡片都可把该事项写入当前绑定工作根下的 active 事项（默认如 `work/active/*.md`，语义映射如 `10-ops/tasks/active/*.md`）并进入 Workbench 预览。具体聊天页会先通过 `sessions.get` 拉取完整 Gateway 会话历史，失败或为空时回退当前可见消息，然后归档为 `sources/imported/*-temporary-session.md`，frontmatter 标记 `source: desktop-onboarding-session`，再把该 source 链入事项 `## 关联资料`；写入的事项也会包含“临时会话承接”段落、资料/成果/知识/复盘后续核对清单，以及归档消息里的明示成果、知识和复盘线索。
- 绑定已有仓库后，RepositoryGate 已显示开箱状态反馈：推荐结构就绪、语义映射已接入、缺少推荐结构、未绑定或路径/权限/Git 阻塞都会用普通语言解释；只读检查会把缺失的推荐目录/协议文件展示为“推荐结构缺口”。语义映射前的本地结构线索也覆盖 `releases/q3-launch.md`、`qa/test-plan.md`、`playbooks/oncall.md`、`runbooks/deploy.md`、`rfcs/desktop-card-protocol.md`、`proposals/onboarding-flow.md`、`docs/architecture.md`、`docs/decisions.md`、`incidents/open.md`、`postmortems/2026-06-outage.md`、`sops/deploy.md`、`policies/security.md`、`handbook/onboarding.md`、`crm/accounts/acme.md`、`sales/pipeline.md`、`leads/new.md`、`opportunities/open.md`、`support/escalations.md`、`customer-success/renewals.md`、`finance/budget.md`、`invoices/pending.md`、`invoices/paid.md`、`contracts/review.md`、`contracts/signed.md`、`recruiting/candidates/open.md`、`hiring/interviews.md`、`hr/onboarding.md`、`财务/待处理发票.md`、`合同/待审核.md`、`招聘/候选人/open.md`、`销售/商机/open.md` 和 `客服/工单/open.md` 这类发布、QA、运维手册、RFC/proposal、架构文档、事故、复盘、SOP、政策、手册、CRM、销售、客服、客户成功、财务、合同、招聘和 HR profile。
- 内容、学习和教育培训类已有仓库也继续走同一只读语义映射前置识别：`content/calendar.md`、`content/drafts/current.md`、`publishing/published.md`、`editorial/review.md`、`courses/active.md`、`assignments/due.md`、`lessons/notes.md`、`learning/roadmap.md`、`营销/内容日历.md`、`课程/待提交作业.md` 和 `学习/笔记.md` 可作为计划、当前工作、已完成或知识系统线索。该能力只帮助开箱金线理解已有仓库结构，不自动发布内容、不提交作业、不写课程计划、不改写学习笔记。
- 个人健康、运动、旅行和家庭维护类已有仓库也继续走同一只读语义映射前置识别：`health/goals.md`、`workouts/current.md`、`medical/notes.md`、`travel/itinerary.md`、`travel/bookings/upcoming.md`、`home/repairs/open.md`、`maintenance/checklist.md`、`household/budget.md`、`健康/体检记录.md`、`旅行/行程计划.md` 和 `家庭/维修待办.md` 可作为计划、当前工作、知识系统或可复用工具线索。该能力只帮助开箱金线理解已有生活资料库结构，不自动生成健康建议、不预订旅行、不安排维修、不改写体检记录。
- 设计、研究、实验、数据集和原型类已有仓库也继续走同一只读语义映射前置识别：`design/briefs/q3-redesign.md`、`prototypes/dashboard-clickthrough.md`、`experiments/running.md`、`experiments/results/q3.md`、`datasets/customer-feedback.md`、`设计/方案评审.md`、`实验/进行中.md` 和 `研究/发现.md` 可作为项目、成果、当前工作、已完成、知识系统或复盘线索。该能力只帮助开箱金线理解已有设计研究资料库结构，不自动做设计评审、不执行实验、不分析数据集、不生成原型。
- 融资、投资人关系、data room、合规审计、数据分析和指标类已有仓库也继续走同一只读语义映射前置识别：`fundraising/strategy.md`、`investor-relations/updates/june.md`、`data-room/index.md`、`compliance/audits/open.md`、`analytics/reports/monthly.md`、`metrics/kpi.md`、`融资/投资人更新.md`、`合规/审计待办.md` 和 `数据分析/月报.md` 可作为计划、成果、知识系统、当前工作或输出线索。该能力只帮助开箱金线理解已有融资合规数据资料库结构，不自动融资、不联系投资人、不做合规判断、不执行审计、不生成数据分析报告。
- 公益、社群、活动、资助、捐赠和志愿者类已有仓库也继续走同一只读语义映射前置识别：`events/calendar.md`、`events/upcoming.md`、`grants/applications/open.md`、`grants/awarded.md`、`donations/campaign-plan.md`、`volunteers/onboarding.md`、`community/feedback.md`、`活动/日历.md`、`资助/申请中.md` 和 `志愿者/招募中.md` 可作为计划、当前工作、已完成或知识系统线索。该能力只帮助开箱金线理解已有公益社群资料库结构，不自动组织活动、不提交资助申请、不招募志愿者、不发起捐赠活动、不改写社群反馈。
- 媒体制作、节目、品牌规范、本地化和翻译类已有仓库也继续走同一只读语义映射前置识别：`media/production-calendar.md`、`episodes/in-production.md`、`episodes/published.md`、`brand/guidelines.md`、`localization/pending.md`、`translations/review.md`、`translations/completed.md`、`媒体/制作日历.md`、`翻译/待处理.md` 和 `品牌/视觉规范.md` 可作为计划、当前工作、已完成或知识系统线索。该能力只帮助开箱金线理解已有媒体和本地化资料库结构，不自动发布媒体、不翻译内容、不编辑视频、不改写品牌规范。
- 税务、保险和保修类已有仓库也继续走同一只读语义映射前置识别：`taxes/filing-plan.md`、`taxes/documents.md`、`insurance/claims/open.md`、`insurance/policies/home.md`、`warranty/claims/pending.md`、`warranties/receipts.md`、`税务/报税计划.md`、`保险/理赔中.md`、`保单/家庭保险.md` 和 `保修/凭证.md` 可作为计划、当前工作或知识系统线索。该能力只帮助开箱金线理解已有税务保险资料库结构，不自动报税、不提交理赔或保修申请、不做税务/保险/法律判断、不改写保单或凭证。
- 订阅、会员和许可证类已有仓库也继续走同一只读语义映射前置识别：`subscriptions/renewal-calendar.md`、`subscriptions/cancellations/pending.md`、`memberships/renewals.md`、`memberships/cards.md`、`licenses/keys.md`、`licenses/expiring.md`、`订阅/续费计划.md`、`订阅/待取消.md`、`会员/卡片.md` 和 `许可证/密钥.md` 可作为计划、当前工作或知识系统线索。该能力只帮助开箱金线理解已有订阅会员资料库结构，不自动续费或取消订阅、不管理会员、不激活许可证、不读取或处理账号密钥/凭证。
- 车辆、宠物、托育和学校类已有仓库也继续走同一只读语义映射前置识别：`vehicles/maintenance-plan.md`、`vehicles/repairs/open.md`、`pets/vaccinations.md`、`pets/medications/current.md`、`childcare/schedule.md`、`school/forms/due.md`、`车辆/保养计划.md`、`车辆/维修中.md`、`宠物/疫苗记录.md` 和 `学校/表格待交.md` 可作为计划、当前工作或知识系统线索。该能力只帮助开箱金线理解已有生活资料库结构，不自动安排车辆维修、不提供宠物医疗建议、不管理托育、不提交学校表格。
- 住房、租赁、账单、抵押贷款和搬家类已有仓库也继续走同一只读语义映射前置识别：`housing/lease-renewal.md`、`rent/payments/due.md`、`utilities/bills/pending.md`、`utilities/accounts.md`、`mortgage/documents.md`、`moving/checklist.md`、`房屋/租约续签.md`、`房租/待缴.md`、`水电/账单待处理.md` 和 `搬家/清单.md` 可作为计划、当前工作或知识系统线索。该能力只帮助开箱金线理解已有住房生活资料库结构，不自动缴费、不签署租约、不提供抵押贷款建议、不安排搬家服务。
- 证件、签证和预约类已有仓库也继续走同一只读语义映射前置识别：`identity/passports.md`、`documents/ids.md`、`visas/renewal-plan.md`、`visas/applications/pending.md`、`appointments/upcoming.md`、`appointments/records.md`、`证件/护照.md`、`证件/身份证.md`、`签证/续签计划.md` 和 `预约/待办理.md` 可作为计划、当前工作或知识系统线索。该能力只帮助开箱金线理解已有证件签证资料库结构，不自动办理证件、护照或签证，不提供法律或移民建议，不预约，不读取或处理敏感身份凭证。
- 银行、贷款、投资和退休账户类已有仓库也继续走同一只读语义映射前置识别：`banking/accounts.md`、`banking/transactions/review.md`、`loans/payoff-plan.md`、`loans/documents.md`、`investments/portfolio.md`、`retirement/plan.md`、`retirement/contributions/current.md`、`银行/账户.md`、`贷款/还款计划.md`、`投资/组合.md` 和 `退休/缴费待确认.md` 可作为计划、当前工作或知识系统线索。该能力只帮助开箱金线理解已有金融资料库结构，不自动转账、还款或交易，不提供投资或贷款建议，不读取或处理银行账号凭证。
- 食谱、餐食计划、购物清单、食材库存和营养目标类已有仓库也继续走同一只读语义映射前置识别：`recipes/favorites.md`、`meal-planning/week.md`、`groceries/list.md`、`grocery/orders/pending.md`、`pantry/inventory.md`、`nutrition/goals.md`、`食谱/收藏.md`、`餐食/本周计划.md`、`购物/待买清单.md`、`食材/库存.md` 和 `营养/目标.md` 可作为计划、当前工作或知识系统线索。该能力只帮助开箱金线理解已有餐食生活资料库结构，不提供营养或医疗建议、不自动下单、不改写餐食计划或食材库存。
- 订单、包裹、退货和收据类已有仓库也继续走同一只读语义映射前置识别：`orders/pending.md`、`orders/history.md`、`deliveries/tracking.md`、`packages/in-transit.md`、`returns/open.md`、`returns/policies.md`、`receipts/purchases.md`、`订单/待处理.md`、`包裹/在途.md`、`退货/待办理.md` 和 `收据/购物记录.md` 可作为当前工作或知识系统线索。该能力只帮助开箱金线理解已有购物资料库结构，不自动下单、不联系商家、不发起退货、不调用物流查询。
- 求职、职业发展、简历、作品集和面试类已有仓库也继续走同一只读语义映射前置识别：`job-search/applications/open.md`、`job-search/offers/pending.md`、`interviews/upcoming.md`、`resumes/current.md`、`portfolio/case-studies.md`、`career/plan.md`、`求职/投递中.md`、`面试/待准备.md`、`简历/当前版本.md`、`作品集/案例.md` 和 `职业/发展计划.md` 可作为当前工作、知识系统、成果或计划线索。该能力只帮助开箱金线理解已有求职职业资料库结构，不自动投递职位、不联系雇主或招聘方、不改写简历或作品集、不提供职业建议。
- 照护、处方、医生记录和药物类已有仓库也继续走同一只读语义映射前置识别：`caregiving/care-plan.md`、`caregiving/tasks/open.md`、`prescriptions/refills/pending.md`、`medications/current.md`、`doctors/records.md`、`therapy/plan.md`、`照护/待办.md`、`照护/计划.md`、`处方/待续.md`、`药物/当前.md` 和 `医生/记录.md` 可作为计划、当前工作或知识系统线索。该能力只帮助开箱金线理解已有照护医疗资料库结构，不提供医疗建议、不改药、不续处方、不联系医生或诊所、不预约。
- 法律、法院、遗产规划和遗嘱类已有仓库也继续走同一只读语义映射前置识别：`legal/cases/open.md`、`legal/documents.md`、`court/dates/upcoming.md`、`estate/plan.md`、`wills/drafts/current.md`、`lawyer/notes.md`、`法律/待处理.md`、`法律/资料.md`、`法院/日期.md`、`遗产/规划.md` 和 `遗嘱/草稿.md` 可作为当前工作、知识系统或计划线索。该能力只帮助开箱金线理解已有法律遗产资料库结构，不提供法律建议、不提交法院文件、不联系律师或法院、不改写遗嘱或法律文书。
- 兴趣、园艺、家庭项目和活动筹备类已有仓库也继续走同一只读语义映射前置识别：`hobbies/projects/current.md`、`garden/plants.md`、`garden/tasks/open.md`、`renovation/plan.md`、`renovation/budget.md`、`event-planning/guest-list.md`、`party/tasks/pending.md`、`兴趣/项目计划.md`、`园艺/植物记录.md`、`园艺/待办.md`、`装修/预算.md`、`活动筹备/宾客名单.md` 和 `生日/清单.md` 可作为当前工作、计划、知识系统或可复用工具线索。该能力只帮助开箱金线理解已有兴趣园艺和活动筹备资料库结构，不购买项目材料、不预约承包商、不邀请宾客、不预订场地、不改写植物照护记录。
- 阅读、照片、家庭记忆和日记类已有仓库也继续走同一只读语义映射前置识别：`reading/books.md`、`reading/current.md`、`books/to-read.md`、`photos/albums.md`、`photos/to-sort.md`、`family-history/records.md`、`journals/2026-07.md`、`memoir/outline.md`、`阅读/书单.md`、`阅读/在读.md`、`照片/相册.md`、`照片/待整理.md`、`家族史/记录.md` 和 `日记/2026-07.md` 可作为当前工作、计划、知识系统或执行记录线索。该能力只帮助开箱金线理解已有阅读照片家庭记忆资料库结构，不整理或删除照片、不改写相册、不发布家庭记忆、不改写日记。
- 习惯、日常例程、家务、差事和礼物类已有仓库也继续走同一只读语义映射前置识别：`habits/tracker.md`、`habits/current.md`、`routines/morning.md`、`chores/today.md`、`chores/checklist.md`、`errands/pending.md`、`gifts/ideas.md`、`wishlist/items.md`、`习惯/打卡.md`、`习惯/当前.md`、`日常/晨间.md`、`家务/待办.md`、`家务/清单.md`、`差事/待办.md`、`礼物/想法.md` 和 `愿望清单/物品.md` 可作为当前工作、计划、知识系统、执行记录或可复用工具线索。该能力只帮助开箱金线理解已有日常生活资料库结构，不完成家务、不跑差事、不购买礼物、不改写习惯打卡。
- 联系人、关系维护、生日和贺卡类已有仓库也继续走同一只读语义映射前置识别：`contacts/address-book.md`、`contacts/follow-ups.md`、`relationships/check-ins.md`、`birthdays/calendar.md`、`cards/to-send.md`、`thank-you/notes.md`、`联系人/通讯录.md`、`联系人/待联系.md`、`关系/近况.md`、`生日/日历.md`、`贺卡/待寄.md` 和 `感谢/记录.md` 可作为当前工作、计划或知识系统线索。该能力只帮助开箱金线理解已有人际关系资料库结构，不联系人、不发消息或贺卡、不改写通讯录。
- 创作、写作、音乐练习和语言学习类已有仓库也继续走同一只读语义映射前置识别：`writing/drafts/current.md`、`writing/submissions/pending.md`、`writing/ideas.md`、`music/practice-plan.md`、`music/practice-log.md`、`music/repertoire.md`、`language/study-plan.md`、`language/vocabulary.md`、`language/practice/current.md`、`创作/灵感.md`、`写作/投稿待处理.md`、`音乐/练习计划.md`、`音乐/练习记录.md`、`语言/学习计划.md` 和 `语言/词汇.md` 可作为当前工作、计划、执行记录或知识系统线索。该能力只帮助开箱金线理解已有创作学习资料库结构，不自动写作、不投稿、不生成练习安排、不改写词汇或曲目记录。
- 小生意、库存、供应商和采购类已有仓库也继续走同一只读语义映射前置识别：`inventory/restock-list.md`、`inventory/stock-counts.md`、`inventory/audits/2026-07.md`、`vendors/directory.md`、`vendors/contracts.md`、`suppliers/contacts.md`、`purchase-orders/open.md`、`procurement/plan.md`、`procurement/requests/pending.md`、`库存/补货清单.md`、`库存/盘点记录.md`、`供应商/名录.md`、`供应商/合同.md`、`采购/计划.md` 和 `采购/待处理.md` 可作为当前工作、计划、执行记录或知识系统线索。该能力只帮助开箱金线理解已有小生意资料库结构，不自动采购、不联系供应商、不下采购单、不改写库存或合同记录。
- 小餐饮、零售门店、排班、菜单、预订、检查、收银和退货类已有仓库也继续走同一只读语义映射前置识别：`restaurant/menu/seasonal-plan.md`、`restaurant/reservations/upcoming.md`、`restaurant/shifts/current.md`、`restaurant/health-inspections/2026-07.md`、`restaurant/daily-sales/reports.md`、`retail/promotions/calendar.md`、`retail/returns/open.md`、`staff/schedule.md`、`门店/排班.md`、`餐厅/菜单计划.md`、`餐厅/预订待处理.md`、`餐厅/卫生检查记录.md` 和 `门店/每日收银.md` 可作为计划、当前工作、复盘/检查或输出线索。该能力只帮助开箱金线理解已有 restaurant/retail/staff operations 资料库结构，不管理预订、菜单、排班、卫生检查、POS/收银、退货或员工日程。
- 对不符合推荐结构的已有仓库，Desktop 已提供审批式安全改造入口：用户确认后才调用 `repository:adapt`，只用模板补齐缺失目录或协议文件，`force: false` / `errorOnExist: false`，不移动用户已有文件，不覆盖已有 `AGENTS.md`、README、Wiki 或项目文件。
- 仓库就绪后，用户输入第一件事会通过 `createFirstWorkbenchMatter()` 写入当前绑定工作根下的 active 事项；默认仓库如 `work/active/YYYY-MM-DD-HHmmss-*.md`，语义映射仓库如 `10-ops/tasks/active/YYYY-MM-DD-HHmmss-*.md`。
- 写入成功后会进入 `/workbench?view=tasks&workItemPath=<matter>`，打开 Workbench 事项预览。
- Workbench 事项预览已接入“第一件事金线”下一步卡：`buildWorkbenchMatterGoldenPathState()` 复用计划元数据、ActionRun、Artifact 和复盘文档来判断计划、执行、成果、知识、复盘五步状态，并把用户带到现有生成计划、计划预览、Action Center、Artifacts、Knowledge 或 Review 入口，不另起一套计划/执行/产物逻辑。
- 下一步卡已接入原因解释：同一个状态函数会给下一步动作写入 reason key，事项预览会解释当前为什么该生成计划、查看执行、沉淀成果、更新知识或写复盘；执行失败或取消时会指回 Action Center，而不是把金线显示为已闭合。
- Desktop message card 已接入 `open-workbench` 和 `open-plan` 本地导航动作，Gateway 首事项/计划卡片可以把安全事项路径带到 Workbench tasks 预览，或把安全 `plans/active/*.md` 带到 plans 预览；`open-workbench` 越界路径只回退到 `/workbench`，`open-plan` 缺失或越界路径只回退到 `/workbench?view=plans`。
- Desktop Self-Knowledge 已补充 Gateway first-matter 卡片模板：使用 `kind: "inquiry"`、`open-workbench` action 打开明确事项，并用 `open-plan` action 打开明确活跃计划，让 Gateway 首事项建议复用 Workbench 金线状态卡，而不是自建另一套步骤。
- 开箱金线与剩余 P0 的并行共享契约已仓库化到 `docs/exec-plans/active/p0-parallel-shared-contract.md`：新会话可以分工推进，但工作事项、RepositoryGate、语义映射、ActionRun 归属事项、金线状态、成果/知识/复盘尾动作和资产运行后处理必须复用共享模块，不得各自实现一套。
- Desktop message card 点击决策已有可执行验证：`resolveDesktopCardActionInteraction()` 覆盖首事项 `open-workbench` 点击，确认本地导航返回 Workbench 事项路径、缺 required 字段会阻断、普通 submit 才进入审计回调。
- Desktop message card 尾动作事项路径安全校验已接入：`preserve-output`、`update-knowledge`、`write-review` 只会把通过 `isSafeWorkbenchTailActionWorkItemPath()` 的 `workItemPath` 传给 Artifacts、Knowledge 或 Workbench reviews；越界、绝对路径、默认 `plans/`、`runs/`、`outputs/`、`wiki/`、`sources/`、`reviews/` 等非事项来源会回退安全页面入口，Dashboard tail-action URL 解析也复用同一规则；安全 `runs/assets/*.md` 资产运行上下文仍可单独保留，但会拒绝 `runs/assets/../secret.md` 这类路径。
- Desktop message card 已做真实 Electron/CDP 点击验证：Playwright 连接 `http://127.0.0.1:9222`，临时注入 first-matter 卡片历史，真实 DOM 出现 `.desktop-message-card`，点击“打开事项 CDP”后进入 `#/workbench?view=tasks&workItemPath=work%2Factive%2Fexample.md`，并确认 `callbackTextPresent: false`。
- 开箱工作系统入口已做真实 Electron/CDP 验证：Playwright 连接 `http://127.0.0.1:9222`，临时注入已连接但无工作仓库的实例并进入 `#/?onboarding=work-system`，真实 DOM 显示“创建你的工作系统”位于 Gateway 状况前，`onboardingBeforeGateway: true`，四条工作空间路径完整，普通语言覆盖资料、知识、事项、计划、执行记录、成果和复盘，且 `forcedLocalRepositoryCopy: false`；点击“先体验”后进入 `#/new-session`，临时事项卡和非长期事实源说明可见，富文本 composer 带入继续体验初始请求，记录为 `hasTemporaryMatterCard: true`、`hasInitialMessage: true`、`stillNotWorkbench: true`。
- 继续体验会话写回工作空间已做真实 Electron/CDP 验证：Playwright 连接 `http://127.0.0.1:9222`，把当前真实连接实例临时绑定到系统临时 Git 推荐结构仓库，打开带 onboarding state 的真实聊天页 `#/chat/agent%3Amain%3Adashboard%3Acdp-skipped-session`，仅 patch `sessions.get` 返回完整会话历史；真实 `.session-temporary-matter` 卡显示临时事项，点击“写入工作空间”后进入 `#/workbench?view=tasks&workItemPath=work%2Factive%2F...first-thing.md`。临时仓库写入 `sources/imported/*-temporary-session.md`，frontmatter 包含 `source: desktop-onboarding-session` 与 sessionKey；新事项 `source: desktop-onboarding-skip`，包含“临时会话承接”、链接归档 source，并带入 `成果：家庭预算表草案`、`Artifact 候选：家庭账单预算表`、`知识：水电账单通常每月 15 日前确认。`、`复盘：缺少物业票据，需要下次补齐。` 四类明示线索。验证结束后恢复原 binding 和 ActionRun storage。
- ready 工作空间首事项写入已做真实 Electron/CDP 验证：Playwright 连接 `http://127.0.0.1:9222`，创建临时 Git 推荐结构仓库并把 fake instance 绑定为 `repo_ready`；当前已修正显式 `?onboarding=work-system` 在仓库已就绪时会隐藏开箱段落的问题，复验确认真实 UI 显示“工作空间已就绪”，输入第一件事后进入 `#/workbench?view=tasks&workItemPath=work%2Factive%2F...`，`routeHasTasksView: true`、`workItemPathSafe: true`；真实 Markdown 写入 `source: desktop-onboarding`、唯一 id、验收标准、执行记录、关联成果和复盘占位，证据为 `markdownHasSource: true`、`markdownHasAcceptance: true`、`markdownHasExecutionRecord: true`；Workbench 预览显示事项标题、第一件事金线、无计划原因和“生成计划”按钮。
- 开箱第一事项连续金线已做真实 Electron/CDP 验证：Playwright 连接 `http://127.0.0.1:9222`，把当前真实连接实例临时绑定到系统临时 Git 推荐结构仓库，真实 Dashboard 开箱 route 显示“工作空间已就绪”，输入第一件事后进入 `#/workbench?view=tasks&workItemPath=work%2Factive%2F...first-thing.md`；点击“生成计划”后 Action Center 从 Gateway raw `approval_required` 回复恢复为 `awaiting_approval`，审批块包含 `repositoryWrite.path=plans/active/cdp-integrated-golden-plan.md` 与来源事项；点击“批准并继续”后写入计划、补 `source: work_matter_plan` / `workItemPath` 元数据、回链事项并自动打开计划预览；点击“执行计划”后 `plan_execute` 为 `done`，`workItemPath` 和 `planPath` 保留，计划预览显示“沉淀成果 / 更新知识 / 写复盘”。本片同时修复已落 raw `lastAssistantResponse` 时 ActionRun 重新加载仍停在 `running` 的边界：`normalizeAiActionRuns()` 会把结构化 raw response 回灌为审批或完成状态，`parseAiActionAssistantResponse()` 增加 loose fallback，避免用户卡在执行中。
- 计划执行后沉淀成果保存已做真实 Electron/CDP 验证：Playwright 连接 `http://127.0.0.1:9222`，把当前真实连接实例临时绑定到系统临时 Git 推荐结构仓库，写入默认 `work/active/*.md` 来源事项、`plans/active/*.md` 计划和一个本地 `done` 的 `plan_execute`；真实计划预览点击“沉淀成果”进入 `#/artifacts?tailAction=output&tailActionId=action-run-output%3A...&workItemPath=work%2Factive%2F...`，Artifacts 抽屉显示来源事项，点击“AI 魔法生成”得到 `<artifact>` 候选，点击“保存产物”后只创建 1 个 Repository output，`outputs/index.md` 包含成果标题，来源事项 `## 关联成果` 写入成果链接并移除 `- 暂无`，`artifact_create` ActionRun 和源 `plan_execute` ActionRun 都记录同一个 artifact id。该片同时修复两个重复提醒/重复保存边界：保存 action-run-output 成果时会把 artifact id 回写到来源 ActionRun；`artifact_create` 的 `<artifact>` 回复只作为保存前候选，不再在预览阶段自动保存一份重复产物。
- 计划执行后知识写入审批已做默认路径真实 Electron/CDP 验证：Playwright 连接 `http://127.0.0.1:9222`，当前真实连接实例临时绑定到系统临时 Git 推荐结构仓库，真实计划预览从“更新知识”进入 `#/knowledge?tailAction=knowledge&tailActionId=action-run-knowledge%3A...&workItemPath=work%2Factive%2F...`；Knowledge 页面保留来源事项和来源执行记录，发起 source-bound `knowledge_rewrite` 后 Action Center 批准 `repositoryWrite.writes`，真实写入 `wiki/topics/cdp-knowledge-golden-path.md`、`wiki/index.md`、`wiki/log.md`。CDP 证据包含 `knowledgeRunStatus: done`、`approvalStatus: approved`、`promptHasSourceMatter: true`、`approvalDecisionSent: true`、`topicHasSource: true`、`indexHasTopic: true`、`logHasEntry: true`，且验证结束后恢复原 binding 和 ActionRun storage。该片同时修复知识写入审批已落盘但 ActionRun 仍停在 `running` 的边界：Action Center 和桌面卡片授权 handler 在 `applyKnowledgeRewriteApproval()` 成功后会把 `knowledge_rewrite` 标为 `done`，让 Workbench 后续复盘建议能识别“知识已更新”。
- 计划执行后复盘草稿创建与确认已做默认路径真实 Electron/CDP 验证：Playwright 连接 `http://127.0.0.1:9222`，当前真实连接实例临时绑定到系统临时 Git 推荐结构仓库，写入默认 `work/active/*.md` 来源事项、`plans/active/*.md` 计划、本地 `done` 的 `plan_execute` 和同源 `knowledge_rewrite`；真实计划预览显示“复盘知识写入”，点击后进入 `#/workbench?tailAction=review&tailActionId=action-run-review%3A...&workItemPath=work%2Factive%2F...`，Workbench reviews 显示来源事项和来源执行记录。点击“创建复盘草稿”后写入 `reviews/weekly/*-action-run-review-*-review.md`，草稿包含 `sourceExecutionId: action-run-review:<runId>`、同源知识更新 ActionRun 和 Wiki/index/log 写入路径，并回链来源事项 `## 复盘`；点击“确认计划执行复盘”后复盘文档写成 `status: confirmed` 并写入 `reviewedAt`，回到计划预览可见“已复盘”。该片确认 `action-run-review:<runId>` 不是事项 checklist 尾动作，不自动勾选事项 `## 收尾动作`、不更新事项状态、不移动事项文件。
- Workbench 第一件事金线下一步卡已做真实 Electron/CDP 验证：Playwright 连接 `http://127.0.0.1:9222`，创建临时 Git 推荐结构仓库并写入 `work/active/*-golden-path.md`，fake 实例绑定该仓库后直接进入 `#/workbench?view=tasks&workItemPath=...`；当前已修正初始事项路径已设置但预览内容为空时跳过读取 Markdown 的问题，复验确认真实 UI 会自动打开事项正文和“第一件事金线”卡，`goldenPathCardText` 包含五步状态、原因“还没有关联计划，先把这件事拆成可执行步骤。”，`goldenPathButtonText: 生成计划`，且 `callbackTextPresent: false`。
- Workbench 活跃计划预览已做真实 Electron/CDP 验证：Playwright 连接 `http://127.0.0.1:9222`，创建临时 Git 推荐结构仓库并写入互链的 `work/active/*-plan-preview-matter.md` 与 `plans/active/*-plan-preview.md`，fake 实例通过真实 storage 绑定仓库后直接进入 `#/workbench?view=plans&planPath=plans%2Factive%2F...`；当前已修正初始计划路径已设置但预览内容为空时跳过读取 Markdown 的问题，复验确认真实 UI 会自动打开计划正文、来源事项路径和“执行计划”入口，证据为 `planPreviewText: true`、`executePlanButtonText: 执行计划`、`hasMatterPath: true`、`callbackTextPresent: false`。
- Workbench 计划执行后续入口已做真实 Electron/CDP 验证：Playwright 连接 `http://127.0.0.1:9222`，创建临时 Git 推荐结构仓库、互链事项/计划和一个本地 `done` 的 `plan_execute` ActionRun，fake 实例通过真实 storage 读取 `ai-action-runs` 后，真实计划预览显示最近执行摘要和“沉淀成果 / 更新知识 / 写复盘”按钮；点击后分别进入 Artifacts、Knowledge 和 Workbench reviews 的 tail-action 路由，携带 `action-run-output:*`、`action-run-knowledge:*`、`action-run-review:*` 与来源事项路径。
- 语义映射工作事项路径进入 Workbench 金线第一片已接入：已有仓库如果把工作事项映射到 `10-ops/tasks/active/*.md` 这类非默认路径，Workbench 现在会基于当前 `loadWorkbenchSnapshot()` 里的 active/completed/someday 事项集合识别该路径，而不是只认 `work/active/*.md`；因此开箱首事项写入语义映射工作根后，`/workbench?view=tasks&workItemPath=...` 也能打开事项预览、显示第一件事金线，并把生成计划和计划执行的 `workItemPath` 继续带到现有 ActionRun 链路。
- 语义映射首事项写入到 Workbench 金线已做真实 Electron/CDP 验证：Playwright 连接 `http://127.0.0.1:9222`，创建临时 Git 推荐结构仓库并把工作根映射为 `10-ops/tasks`、计划根映射为 `10-ops/plans`；真实 UI 显示“工作空间已就绪”，输入第一件事后进入 `#/workbench?view=tasks&workItemPath=10-ops%2Ftasks%2Factive%2F...`，真实 Markdown 写入 `source: desktop-onboarding`、验收标准和执行记录，Workbench 自动打开事项正文、“第一件事金线”、原因“还没有关联计划，先把这件事拆成可执行步骤。”和“生成计划”。本片同时修正两处运行态边界：语义 snapshot 会并入 `paths.work/{active,completed,someday}` 与 `paths.plans/{active,completed}`，`WorkbenchPage` / Desktop card `open-workbench` 使用 `isSafeWorkbenchMarkdownPath()` 放行安全的映射 Markdown 路径，再由 snapshot 判断真实归属。
- 语义映射计划执行后续入口已做真实 Electron/CDP 验证：Playwright 连接 `http://127.0.0.1:9222`，创建临时 Git 仓库并映射 `10-ops/tasks` 与 `10-ops/plans`，写入互链的 `10-ops/tasks/active/mapped-release.md`、`10-ops/plans/active/mapped-release-plan.md` 和本地 `done` 的 `plan_execute` ActionRun；真实计划预览显示最近执行摘要和“沉淀成果 / 更新知识 / 写复盘”按钮，点击后分别进入 Artifacts、Knowledge 和 Workbench reviews，URL 保留 `action-run-output%3Acdp-mapped-plan-run`、`action-run-knowledge%3Acdp-mapped-plan-run`、`action-run-review%3Acdp-mapped-plan-run` 与 `workItemPath=10-ops%2Ftasks%2Factive%2Fmapped-release.md`。本片修正 `shouldOfferPlanExecution*` 只认默认 `work/` 根的问题，改用 `isSafeWorkbenchMatterLikePath()` 接受安全且含 active/completed/someday 事项段的映射路径，同时仍拒绝 `outputs/release.md` 和越界路径。
- 语义映射首事项生成计划 Prompt 已做真实 Electron/CDP 验证：Playwright 连接 `http://127.0.0.1:9222`，复制推荐仓库模板到临时 Git 仓库并映射 `10-ops/tasks` / `10-ops/plans`，用 `window.__store` 临时替换 `activeClient.request`，点击真实 Workbench 中 `10-ops/tasks/active/mapped-generate.md` 事项的“生成计划”按钮但不触发真实 Gateway 执行；拦截到的 `chat.send.message` 记录 `hasMappedPlanRoot: true`、`hasMappedPlanPathJson: true`、`hasDefaultPlanPathJson: false`、`hasMappedWorkItem: true`、`hasApprovalRequired: true`、`hasRepositoryWrite: true`、`hasDefaultPlanRootInstruction: false`，证明真实 UI 发出的 prompt 使用 `10-ops/plans/active/<slug>.md` 而不是默认 `plans/active/<slug>.md`。探查结束后已恢复真实实例绑定到 `/Users/deepin/Desktop/Company/any-thing`，清理本次 fake run 的 storage 和 `runs/action-runs/` 测试记录，并确认用户仓库无 `mapped-generate` / `cdp-mapped-generate` 残留。
- 语义映射事项计划审批写入已做真实 Electron/CDP 验证：Playwright 连接 `http://127.0.0.1:9222`，创建映射 `10-ops/tasks` / `10-ops/plans` 的临时 Git 仓库和一个 `awaiting_approval` 的 `work_matter_plan` ActionRun，审批块写入 `10-ops/plans/active/mapped-approval-plan.md` 并关联 `10-ops/tasks/active/mapped-approval.md`；真实 Action Center 显示“写入映射事项计划”，点击“批准并继续”后，fake Gateway 收到审批继续 `chat.send`，本地 `applyWorkbenchMatterPlanApproval()` 写入映射计划根、给计划补 `source: work_matter_plan` 元数据、把计划链接回来源事项，并跳转到 `#/workbench?view=plans&planPath=10-ops%2Fplans%2Factive%2Fmapped-approval-plan.md`。CDP 证据包含 `chatSendHasApprovalDecision: true`、`approvalStatus: approved`、`resultSummary: 已写入事项计划：10-ops/plans/active/mapped-approval-plan.md`、`routeHasMappedPlan: true`、`bodyHasPlanTitle: true`、`bodyHasMatterPath: true`、`planContentHasMetadata: true`、`matterLinked: true`。验证结束后已恢复真实实例绑定并确认用户仓库无 `mapped-approval` / `cdp-mapped-approval` 残留。
- 语义映射计划执行 Prompt 已做真实 Electron/CDP 验证：Playwright 连接 `http://127.0.0.1:9222`，创建映射 `10-ops/tasks` / `10-ops/plans` 的临时 Git 仓库，写入 `10-ops/tasks/active/mapped-execute.md` 和 `10-ops/plans/active/mapped-execute-plan.md`；真实 Workbench 打开映射计划并点击“执行计划”，用原地 patch 的 fake `activeClient.request` 拦截 `plan_execute`，证据包含 `chatSendHasMappedPlanPath: true`、`chatSendHasMappedWorkItemPath: true`、`chatSendHasPlanTitle: true`、`chatSendHasMatterTitle: true`、`inputHasMappedPlanPath: true`、`inputHasMappedWorkItemPath: true`、`runWorkItemPath: 10-ops/tasks/active/mapped-execute.md`、`routeHasActionRun: true`、`routeRunIdMatchesStored: true`。本片修正 `parsePlanMetadata()` 被正文 `来源事项: \`...\``覆盖 frontmatter`workItemPath` 的问题，确保映射计划执行会结构化携带来源事项。
- 语义映射计划执行显式保存成果回写已做真实 Electron/CDP 验证：Playwright 连接 `http://127.0.0.1:9222`，创建映射 `10-ops/tasks` / `10-ops/plans` 的临时 Git 仓库和本地 `done` 的 `plan_execute` ActionRun；真实进入 `#/artifacts?tailAction=output&tailActionId=action-run-output%3Acdp-mapped-output-run&workItemPath=10-ops%2Ftasks%2Factive%2Fmapped-output.md` 后，Artifacts AI 创建抽屉显示来源事项，点击“AI 魔法生成”得到 `<artifact>` 候选，点击“保存产物”后创建 `source.type=action_run` 的 Artifact、记录 `artifact_create.artifactIds`，并把镜像后的 `outputs/reports/<artifact>.md` 相对链接写回映射事项 `## 关联成果`，同时移除 `- 暂无` 占位。
- 语义映射知识写入审批已做真实 Electron/CDP 验证：Playwright 连接 `http://127.0.0.1:9222`，创建映射 `10-ops/tasks` / `10-ops/plans` 的临时 Git 仓库和一个 `awaiting_approval` 的 `knowledge_rewrite` ActionRun；真实 Action Center 显示“写入映射知识库”审批卡，点击“批准并继续”后 fake Gateway 收到审批继续 `chat.send`，本地 `applyKnowledgeRewriteApproval()` 把 `wiki/topics/mapped-knowledge.md`、`wiki/index.md` 和 `wiki/log.md` 写入临时仓库，ActionRun 审批状态变为 `approved`，`resultSummary` 记录三条写入路径，且来源 `workItemPath=10-ops/tasks/active/mapped-knowledge.md` 保留。
- 语义映射生成计划与计划执行已完成真实 Gateway 自然返回验证：Playwright 连接 `http://127.0.0.1:9222`，把当前真实连接实例临时绑定到系统临时 Git 推荐结构仓库，映射 `10-ops/tasks` / `10-ops/plans`，并通过真实 Workbench 按钮触发真实 `activeClient`。点击 `10-ops/tasks/active/real-gateway-plan.md` 的“生成计划”后，真实 Gateway/model 自然返回 `kind: approval_required`，本地 ActionRun 进入 `awaiting_approval`，审批块包含 `repositoryWrite.path=10-ops/plans/active/real-gateway-plan-probe.md` 与 `repositoryWrite.workItemPath=10-ops/tasks/active/real-gateway-plan.md`；点击 `10-ops/plans/active/real-gateway-execute-plan.md` 的“执行计划”后，真实 Gateway/model 自然返回 `kind: completed`，ActionRun 状态为 `done`，`summary` 说明已读取计划和来源事项且未写入文件/调用工具/创建产物。验证结束后恢复原 repository binding 和 `ai-action-runs`，`bindingRestoredToOriginal: true`、`runCountRestoredToOriginal: true`。
- 语义映射计划执行复盘草稿创建与确认已做真实 Electron/CDP 验证：`writeWorkbenchReviewDraft()` 和 `confirmWorkbenchReviewDraft()` 使用当前绑定的 `binding.paths.work` 判断来源事项；单元验证覆盖 `10-ops/tasks/active/release.md` 的 `action-run-review:<runId>` 复盘草稿创建和确认。真实 UI 验证覆盖映射来源事项 `10-ops/tasks/active/mapped-review.md` 和 `tailActionId=action-run-review:cdp-mapped-review-run`：Workbench reviews 的复盘收尾动作卡片可创建 `reviews/weekly/*-mapped-review-*-review.md` 草稿，草稿 frontmatter 包含映射 `workItemPath`、`tailActionId` 和 `sourceExecutionId`，来源事项 `## 复盘` 链接到草稿；点击“确认计划执行复盘”后，复盘文档写成 `status: confirmed` 并写入 `reviewedAt`，不假装勾选不存在的 checklist 尾动作。该验证只写临时仓库，不写用户仓库、不自动沉淀成果、不写 Wiki/index/log。
- 语义映射状态尾动作与完成归档已做真实 Electron/CDP 验证：Playwright 连接 `http://127.0.0.1:9222`，创建映射工作根为 `10-ops/tasks` 的临时 Git 仓库并绑定 fake instance；真实进入 `#/workbench?view=tasks&tailAction=status&tailActionId=10-ops%2Ftasks%2Factive%2Fmapped-status.md%3Atail-action%3A0&workItemPath=10-ops%2Ftasks%2Factive%2Fmapped-status.md` 后，状态收尾动作卡片显示来源事项，用户选择“已完成”并点击“更新事项状态并完成尾动作”会把 Markdown 写成 `status: done`，并只勾选匹配状态尾动作；随后点击“归档完成事项”会把文件移动到 `10-ops/tasks/completed/mapped-status.md`，active 原路径不可读，真实 UI 显示归档后的映射路径。状态收尾卡语义映射工作根显示已补齐：卡片标签从当前 `binding.paths.work` 派生，默认仓库显示 `work/`，映射仓库显示如 `10-ops/tasks/`。该验证只写临时仓库，不写用户仓库、不自动沉淀成果、不写 Wiki/index/log、不写复盘。

剩余打磨方向：

- 进入临时体验本身不依赖仓库就绪；只有把临时事项沉淀为长期事实时才需要 ready 工作空间。当前已有会话内临时事项承接和写回工作空间入口，并会优先从 Gateway 拉取完整会话历史归档为可引用资料源、链回事项、写入临时承接说明、后续沉淀清单和归档消息中的明示成果/知识/复盘线索。
- 开箱金线剩余打磨方向表述：本段只记录剩余体验打磨与更深验证方向，不再把已完成的继续体验、写回工作空间、映射工作根、计划/执行/成果/知识/复盘首片闭环放在“需要修正”的标题下。
- Phase 3/4 已有首片：绑定已有仓库后的映射反馈、缺口说明和审批式安全改造已经接入。后续如果继续打磨，应聚焦真实 UI 验证、更多仓库 profile 识别，以及把“生成映射后进入工作台”的引导做得更顺滑。
- 第一件事金线下一步卡已有首片并完成真实 Electron/CDP 验证：事项预览已经能把开始事项后的计划、执行、成果、知识、复盘入口串成一个只显示下一步的状态卡，并能从 `workItemPath` 路由自动打开事项正文与金线卡。开箱 ready 工作空间首事项写入到 Workbench 预览也已完成真实 Electron/CDP 验证，Gateway 卡片化建议已完成首事项模板、点击决策和真实 Electron/CDP 点击验证。后续仍需要继续打磨整体布局、文案密度、更多真实仓库 profile、运行后处理和更自然的完整端到端体验。
- 活跃计划预览已有真实 Electron/CDP 验证：`planPath` 路由已经能自动打开 `plans/active/*.md` 正文和“执行计划”入口，审批写入计划后的下一步不再停留在空预览。
- 计划执行后的成果/知识/复盘入口已有真实 Electron/CDP 验证：计划预览会在最近 `plan_execute` 完成后露出三颗后续按钮，并把用户带到既有 Artifacts、Knowledge 和 reviews tail-action 路由。
- “为什么现在该做这一步”已有第一片并完成真实 Electron/CDP 验证：下一步原因文案已随状态机落到事项预览，并在无计划事项上显示“还没有关联计划，先把这件事拆成可执行步骤。”。从开箱首事项继续生成计划、批准计划、执行计划并露出沉淀成果/更新知识/写复盘入口的连续 UI 链路也已完成真实 Electron/CDP 验证；Gateway 卡片化建议已完成首事项模板、点击决策和真实 Electron/CDP 点击验证，计划执行后的成果保存、知识写入和复盘确认也已有默认路径真实 Electron/CDP 验证。后续主要继续打磨整体布局、文案密度、运行后处理和完整顺滑体验。
- 开箱工作系统入口、继续体验支路和 ready 工作空间首事项写入支路已有真实 Electron/CDP 验证：Dashboard 开箱卡位于 Gateway 状况前，四条路径完整，点击“先体验”后进入 New Session 临时事项，不写仓库也不直接跳 Workbench；后续已有 ready 工作空间时，聊天页临时事项卡能优先从 Gateway `sessions.get` 拉完整历史，归档为 `sources/imported/*-temporary-session.md`，再写入当前绑定工作根下的 active 事项（默认如 `work/active/*.md`，语义映射如 `10-ops/tasks/active/*.md`）并链接归档 source；已有 ready 工作空间时，显式开箱 route 也会显示首事项输入，写入临时仓库当前绑定工作根下的 active 事项（默认如 `work/active/*.md`，语义映射如 `10-ops/tasks/active/*.md`）后进入 Workbench 金线卡。
- Gateway 卡片化建议已有 Workbench 本地导航底座、首事项卡片模板、点击决策单元验证、真实 Electron/CDP 点击验证、开箱入口/继续体验真实 Electron/CDP 验证、ready 首事项写入真实 Electron/CDP 验证、Workbench 金线卡真实 Electron/CDP 验证、活跃计划预览真实 Electron/CDP 验证、计划执行后续入口真实 Electron/CDP 验证、开箱第一事项连续进入计划审批、计划执行和后续入口的真实 Electron/CDP 验证、计划执行后沉淀成果保存的真实 Electron/CDP 验证、计划执行后默认路径知识写入审批的真实 Electron/CDP 验证，以及计划执行后默认路径复盘创建/确认的真实 Electron/CDP 验证。Artifacts 详情页也已接入基于 `contentExtract` 的 PDF/Office/Text/Code 只读文本原生预览、旧版 Word `.doc` macOS textutil best-effort contentExtract、旧版 Excel/PowerPoint `.xls/.ppt` printable-text best-effort contentExtract、基于 `contentFacts` 的只读文件事实预览、小尺寸导入 PDF `documentPreview` 的浏览器 PDF 查看器预览、已导入 PDF/音视频副本 `artifact-file://` 只读协议预览与 Range 分段加载首片、显式 URL PDF 的浏览器内建 PDF 查看器预览、PDF viewer 默认第 1 页/适合宽度、页码/缩放控件与 PDF 版本页数显示、显式 URL/导入预览/已导入协议 PDF 的 `previewPlan` 的 `browser_pdf_viewer` 详情页查看器策略、显式 URL/已导入音视频 `previewPlan` 的 `browser_media_controls` 详情页控件策略、显式 URL audio/video 的浏览器内建媒体控件预览、已导入音视频媒体控件旁的 `contentFacts` 文件事实标签，已导入 PDF/Office/音视频副本在 macOS 上通过 Quick Look 生成的只读文件缩略图、非 macOS 原生缩略图缺口 `native-thumbnail-platform-unsupported` 不可用审计与安全格式 fallback thumbnail、普通文件/未知格式导入副本安全 fallback thumbnail，以及 `valueHealth` 对 `native-thumbnail-platform-unsupported` / `legacy-binary-office` 最新不可用原因的 gaps/nextActions 透出；既有本地文件 Artifact 也可通过 `desktop.artifacts.file.import` 显式复制到 Artifact storage 后复用同一条增强管线。后续仍需继续观察整体布局、文案密度、运行后处理，并推进更深入 PDF/Office 版式渲染、PDF/媒体更深性能体验、更广真实缩略图和更广媒体体验等更深入多格式预览体验。
- 资产运行后处理入口已有真实 Electron/CDP 验证：Playwright 连接 `http://127.0.0.1:9222`，创建系统临时 Git 推荐结构仓库并写入 `runs/assets/*.md` 资产运行、`runs/assets/index.md` 和引用该运行的 `work/active/*.md` 尾动作；真实进入 `#/workbench?view=outputs&assetRunPath=...` 后，Workbench outputs 自动打开来源资产运行详情，显示“成果待沉淀”和“运行后续”，点击“沉淀成果 / 更新知识 / 写复盘”分别进入 Artifacts、Knowledge 和 Workbench review tail-action 路由，三条 URL 都保留同一个 `assetRunPath` 与 `asset-run-output:*` / `asset-run-knowledge:*` / `asset-run-review:*` 来源执行 ID。资产运行成果保存已完成真实 Electron/CDP 验证：从 `asset-run-output:*` 路由打开 Artifacts，AI 创建抽屉保留来源事项和来源资产运行，用户显式保存后创建 Artifact、镜像 `outputs/reports/*.md` 与 `outputs/html/*.html`、更新 `outputs/index.md`、把成果链接回来源事项 `## 关联成果`，并把 Artifact id 记录到本地 `artifact_create` ActionRun；该来源 ID 不是 checklist 尾动作，因此不会误勾选事项 `## 收尾动作`。资产运行知识写入审批已完成真实 Electron/CDP 验证：从 `asset-run-knowledge:*` 路由打开 Knowledge，页面保留来源事项和来源资产运行，发起 `knowledge_rewrite` 后 Action Center 批准 `repositoryWrite.writes`，真实写入 `wiki/topics/cdp-asset-knowledge.md`、`wiki/index.md` 和 `wiki/log.md`，ActionRun 最终为 `done` 且审批为 `approved`。资产运行复盘草稿/确认也已完成真实 Electron/CDP 验证：从 `asset-run-review:*` 路由创建 `desktop-repository-asset-execution-review` 草稿，UI 露出“确认资产运行复盘”，确认后 review Markdown 写入 `status: confirmed` 与 `reviewedAt`，并保留 `assetRunPath`、执行结果摘要和来源事项回链；资产运行复盘草稿语义映射事项回链已补单元验证，`binding.paths.work = 10-ops/tasks` 时 `10-ops/tasks/active/*.md` 会保留在 review frontmatter 并写回来源事项 `## 复盘`。本片同时修正资产运行初始预览路径已设置但正文为空时不再读取 Markdown、以及创建复盘草稿后 URL 中的 `assetRunPath` effect 抢回预览路径导致确认按钮不出现的时序边界。
- 语义映射工作事项路径已补到 Workbench 金线判断，并已完成“映射工作根 -> 首事项写入 `10-ops/tasks/active/*.md` -> 自动打开金线卡”、“点击生成计划 -> prompt 使用 `10-ops/plans/active/<slug>.md` 映射计划根”、“真实 Gateway 自然返回 `approval_required.repositoryWrite` 映射计划审批块”、“批准计划审批块 -> 写入映射计划根 -> 自动打开计划预览”、“点击执行计划 -> `plan_execute` prompt/input 结构化携带映射计划与来源事项”、“真实 Gateway 自然执行无副作用计划 -> 返回 `completed`”、“映射计划 `10-ops/plans/active/*.md` -> 已完成 `plan_execute` -> 成果/知识/复盘后续入口路由”、“Artifacts UI 显式保存成果 -> 镜像 `outputs/reports/*.md` -> 回写映射事项 `## 关联成果`”、“Action Center 批准知识写入 -> 写入 `wiki/topics/*.md` / `wiki/index.md` / `wiki/log.md`”、“映射事项状态尾动作 -> 显式更新为 done -> 归档到 `10-ops/tasks/completed/*.md`”以及“映射事项计划执行复盘 -> 创建草稿 -> 确认复盘”的真实 UI/CDP 验证。后续主要是继续打磨开箱第一事项到成果/知识/复盘的完整顺滑体验、文案密度和更多真实仓库 profile。

## 4. 推荐首版实现范围

首版不要做复杂初始化向导。最小可交付是一个轻量的“工作空间选择”卡片或面板。

必须有：

- 继续体验：跳过仓库初始化。
- 新建推荐仓库：复用现有 `RepositoryGate` 创建能力。
- 绑定已有仓库：复用现有仓库选择/绑定能力。
- 检查已有仓库：只读识别推荐结构是否存在。
- 生成映射：对符合推荐结构的仓库生成 Desktop 可理解的映射。
- 改造建议：对不符合推荐结构的仓库给出可审批写入建议。

不要在首版做：

- 多屏复杂向导。
- 强制用户填写大量元数据。
- 自动迁移、自动改造或自动写入已有仓库。
- 不以产物系统为主线；产物是后续承接价值，不是开箱初始化的入口负担。
- 把完整“开始一件事闭环”塞进开箱初始化。
- 让用户必须先理解 Repository、runs、schemas、protocol。

## 5. 实施切片

### Phase 1：文案与入口降复杂度

目标：把开箱入口从“创建本地工作仓库”改成“选择工作空间”。

状态：已落第一片。Dashboard 引导已使用 `WorkSystemWorkspaceChoice` 展示继续体验、新建、绑定、映射/改造四条路径，旧的“创建本地工作仓库”不再是唯一下一步。

涉及文件：

- `src/pages/DashboardPage.tsx`
- `src/locales/zh.json`
- `src/locales/en.json`
- `src/__tests__/dashboard-redesign.test.ts`
- `src/__tests__/work-system-onboarding.test.ts`

验收命令：

```bash
npm test -- src/__tests__/dashboard-redesign.test.ts src/__tests__/work-system-onboarding.test.ts -- --reporter=dot
```

### Phase 2：跳过仓库初始化

目标：用户可以先进入 Desktop，而不是被仓库选择挡住。

状态：已落第五片。“继续体验”会使用 `buildSkippedWorkspaceSessionState()` 把第一件事草稿作为临时事项上下文传给 `/new-session`，New Session 读取 route state 后预填 composer，并把同一份 onboarding state 继续传到具体聊天页；该路径不写仓库、不伪装成长期事实源。若后续已有 ready 工作空间，New Session 和具体聊天页的临时事项卡片都可调用 `createFirstWorkbenchMatter(..., { source: 'desktop-onboarding-skip', carryover })` 写入当前绑定工作根下的 active 事项（默认如 `work/active/*.md`，语义映射如 `10-ops/tasks/active/*.md`）并进入 Workbench 事项预览。具体聊天页会先调用 `loadSkippedWorkspaceSessionArchiveMessages()` 通过 `sessions.get` 拉完整 Gateway 会话历史，失败或为空时才回退当前可见消息；随后调用 `archiveSkippedWorkspaceSessionSource()` 写入 `sources/imported/*-temporary-session.md`，并把归档 source 链入新事项 `## 关联资料`。同时会把归档消息中带明确标签的成果/产物/输出、知识/结论、复盘/风险/下一步线索，以及 `<artifact>` 标题，摘入事项 Markdown 的“临时会话承接”段落；无明确标签时仍只写后续核对清单，不做语义猜测。

设计要求：

- 跳过后要清楚说明哪些能力是临时的。
- 用户仍能进入 Dashboard / New Session / Workbench 的轻量入口。
- 需要沉淀资料、知识、事项、计划、执行记录、成果或复盘时，再引导选择工作空间。
- 不要静默创建仓库，也不要把临时数据伪装成长期事实源。

验收命令：

```bash
npm test -- src/__tests__/work-system-onboarding.test.ts src/__tests__/dashboard-redesign.test.ts -- --reporter=dot
```

### Phase 3：绑定已有仓库与生成映射

目标：已有仓库可以直接成为工作空间。

状态：已落第二片。RepositoryGate 会保存检查详情中的 `missingTemplateEntries`，在 Workbench 仓库卡片里展示推荐结构就绪、语义映射已接入、缺少推荐结构或阻塞状态；缺失项会以“推荐结构缺口”展示。已有 `workbench_repository_map` 语义映射仍是只读 ActionRun，保存后可让 `repo_needs_bootstrap` 的已有仓库作为语义工作台使用。语义映射前的本地结构线索已支持常见中文目录（事项、项目、计划、执行记录、成果、复盘、工具、知识库等），并补充 `任务/今天`、`任务/待处理`、`执行/`、`交付物/`、`笔记/会议纪要`、`notes/customer-interview`、`tasks/today`、`archive/2026-q2`、`kanban/doing.md`、`meetings/weekly-sync.md`、`decisions/adr-001.md`、`goals/q3-okr.md`、`issues/open.md`、`tickets/resolved.md`、`research/interviews/customer-a.md`、`specs/product-requirements.md`、`roadmaps/desktop-2026.md`、`milestones/q3-launch.md`、`feedback/customer-requests.md`、`risks/open.md`、`releases/q3-launch.md`、`qa/test-plan.md`、`playbooks/oncall.md`、`runbooks/deploy.md`、`rfcs/desktop-card-protocol.md`、`proposals/onboarding-flow.md`、`docs/architecture.md`、`docs/decisions.md`、`incidents/open.md`、`postmortems/2026-06-outage.md`、`sops/deploy.md`、`policies/security.md`、`handbook/onboarding.md`、`crm/accounts/acme.md`、`sales/pipeline.md`、`leads/new.md`、`opportunities/open.md`、`support/escalations.md`、`customer-success/renewals.md`、`finance/budget.md`、`invoices/pending.md`、`invoices/paid.md`、`contracts/review.md`、`contracts/signed.md`、`recruiting/candidates/open.md`、`hiring/interviews.md`、`hr/onboarding.md`、`财务/待处理发票.md`、`合同/待审核.md`、`招聘/候选人/open.md`、`销售/商机/open.md` 和 `客服/工单/open.md` 这类普通个人、团队、产品、运维、客户运营、财务法务或招聘人事仓库 profile，让普通中文资料库、笔记型资料库、轻量英文任务仓库、看板、会议纪要、决策记录、OKR、issue tracker、用户调研、需求规格、路线图、里程碑、用户反馈、风险目录、发布目录、QA 验证计划、playbook、runbook、RFC/proposal、架构文档、incident、postmortem、SOP、policy、handbook、CRM、销售漏斗、客服工单、客户成功、预算、发票、合同、招聘候选人、面试和 HR 入职目录更容易被识别为可映射的工作空间；这些信号不执行财务、法务、招聘或 HR 工作流。Workbench 语义映射保存成功提示也已明确“工作台语义映射已保存，可以从第一件事进入工作台继续”，让生成映射后的下一步更清楚。语义映射状态反馈卡也已接回开箱下一步：RepositoryGate 的 `semantic-mapped` 描述会提示用户可从第一件事进入工作台继续；该提示只做导航引导，不自动创建事项、不生成计划、不写仓库。

 家庭应急、联系人、家庭物品清单和灾备仓库 profile 已补入同一只读映射线索：`emergency/plan.md`、`emergency/contacts.md`、`emergency/tasks/open.md`、`household/inventory.md`、`disaster/checklist.md`、`evacuation/routes.md`、`应急/计划.md`、`应急/联系人.md`、`应急/待办.md`、`家庭/物品清单.md` 和 `灾备/检查清单.md` 会在语义映射前提供计划、当前工作、知识系统或可复用工具提示；该能力只帮助开箱绑定已有仓库时识别 ordinary emergency/contact/household-inventory/disaster 资料结构，不呼叫紧急服务、不联系紧急联系人、不提交保险或公共服务请求、不改写应急计划。

设计要求：

- 只读扫描已有仓库。
- 识别推荐目录是否存在。
- 符合推荐结构时生成映射并进入工作台。
- 不符合推荐结构时展示缺口，不阻塞用户继续。
- 映射结果要可解释，让 Gateway / Desktop 知道资料、知识、事项、计划、运行、成果、复盘分别在哪里。

建议测试：

```bash
npm test -- src/__tests__/repository-workbench-mapping.test.ts src/__tests__/repository-context.test.ts -- --reporter=dot
```

### Phase 4：可审批改造已有仓库

目标：已有仓库不符合推荐结构时，可以选择逐步改造。

状态：已落首片。新增 `repository:adapt` / `adaptRepositoryBinding()`，用户点击“审批改造建议”并确认后才执行；实现只把推荐模板中缺失的目录和协议文件复制到仓库，使用不覆盖语义，不移动、不迁移、不覆盖用户已有文件。空仓库或已有仓库的默认模板初始化仍与新建推荐仓库路径区分。

设计要求：

- 改造必须是建议，不是默认动作。
- 写入必须经用户确认。
- 只创建必要目录或协议文件。
- 不移动用户已有文件。
- 不覆盖已有 `AGENTS.md`、README、Wiki 或项目文件。

建议测试：

```bash
npm test -- src/__tests__/repository-path-safety.test.ts src/__tests__/repository-workbench.test.ts -- --reporter=dot
```

## 6. 并行新会话启动提示

可以把下面这段直接发给新的 Codex 会话：

```text
请阅读 AGENTS.md，并以 docs/exec-plans/active/p0-onboarding-golden-path.md 为主线推进 P0 开箱金线。

这份文档刚被修正：不要把开箱做成强制“创建本地工作仓库”。新的目标是“选择工作空间”：跳过仓库初始化、新建推荐结构仓库、绑定已有仓库、对已有仓库生成映射或提供可审批改造建议。

必须保留的产品判断：Gateway 是基础设施，不是用户目标；不要把仓库初始化做成强制门槛；复杂初始化会让普通用户直接放弃。首版优先降低摩擦，让用户能尽快进入 Desktop 和 Workbench。

当前代码事实：开箱入口、继续体验、ready 工作空间首事项写入、Workbench 金线卡、活跃计划预览、计划执行后续入口，以及默认路径和语义映射路径的计划、成果、知识、复盘真实验证都已落地。新会话必须复用 `WorkSystemWorkspaceChoice`、`RepositoryGate area="workbench"`、`createFirstWorkbenchMatter()`、`buildWorkbenchMatterGoldenPathState()`、Action Center、Artifacts、Knowledge、Workbench reviews 和 `docs/exec-plans/active/p0-parallel-shared-contract.md` 里的共享协议；继续体验会话可归档完整 Gateway 历史并写回当前绑定工作根，语义映射路径如 `10-ops/tasks/active/*.md` / `10-ops/plans/active/*.md` 已进入生成计划、执行计划、成果沉淀、知识写入、复盘确认、状态尾动作和完成归档链路。请继续用测试推进布局、文案密度、更多真实仓库 profile 和端到端顺滑体验，不要把仓库初始化恢复成强制门槛，也不要另起一套事项、ActionRun、成果、知识或复盘闭环。
```

并行新会话启动提示当前事实校准：上面的提示必须跟随第 3 节当前代码事实摘要更新，明确默认路径和语义映射路径的计划、成果、知识、复盘真实验证已经存在，避免新会话从早期“只完成工作空间选择”的旧上下文重新实现共享链路。

## 7. 维护规则

- 新线程如果改开箱路径，必须同步更新本文。
- 新线程如果与剩余 P0 并行推进，必须先阅读 `docs/exec-plans/active/p0-parallel-shared-contract.md`，并复用其中列出的共享能力。
- 如果实现支持跳过、绑定已有仓库或映射已有仓库，应同步更新 `docs/PLANS.md` 和 `docs/design-docs/product-goal-roadmap.md`。
- 不允许再把“创建本地工作仓库”写成开箱唯一必经路径。
