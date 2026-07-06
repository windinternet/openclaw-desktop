import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildWorkbenchStructureSignals,
  buildWorkbenchRepositorySetupFeedback,
  buildWorkbenchSemanticMappingPrompt,
  isSafeSemanticSlotPath,
  parseWorkbenchSemanticMappingResponse,
  sanitizeWorkbenchSemanticMapping,
} from '../lib/repository-workbench-mapping';

describe('repository workbench semantic mapping', () => {
  it('explains recommended, mapped, and adaptable repository setup states for onboarding', () => {
    expect(
      buildWorkbenchRepositorySetupFeedback({
        status: 'repo_ready',
        binding: null,
      }),
    ).toMatchObject({
      kind: 'recommended-ready',
      primaryAction: 'none',
      requiresApproval: false,
    });

    expect(
      buildWorkbenchRepositorySetupFeedback({
        status: 'repo_needs_bootstrap',
        binding: {
          workbench: {
            isWorkbenchRepository: true,
            mappingSource: 'agent',
            slots: {
              current: createSlot(['10-ops/tasks/now.md']),
            },
          },
        },
        missingRecommendedEntries: ['work', 'plans', 'runs/action-runs'],
      }),
    ).toMatchObject({
      kind: 'semantic-mapped',
      primaryAction: 'none',
      requiresApproval: false,
      missingRecommendedEntries: ['work', 'plans', 'runs/action-runs'],
    });

    expect(
      buildWorkbenchRepositorySetupFeedback({
        status: 'repo_needs_bootstrap',
        binding: null,
        missingRecommendedEntries: ['work', 'plans', 'runs/action-runs'],
      }),
    ).toMatchObject({
      kind: 'needs-adaptation',
      primaryAction: 'map-workbench',
      secondaryAction: 'approve-adaptation',
      requiresApproval: true,
      missingRecommendedEntries: ['work', 'plans', 'runs/action-runs'],
    });
  });

  it('keeps the Workbench mapping prompt in a packaged markdown template', () => {
    const template = readFileSync('src/prompts/repository/workbench-semantic-mapping.md', 'utf8');
    const source = readFileSync('src/lib/repository-workbench-mapping.ts', 'utf8');

    expect(template).toContain('只读结构识别');
    expect(template).toContain('{{tree}}');
    expect(template).toContain('{{structureSignals}}');
    expect(source).toContain('workbench-semantic-mapping.md?raw');
    expect(source).toContain('renderPromptTemplate');
  });

  it('builds an Agent prompt focused on method roles instead of directory names', () => {
    const prompt = buildWorkbenchSemanticMappingPrompt({
      repoPath: '/repo',
      tree: ['AGENTS.md', '10-ops/tasks/now.md', '20-projects/demo/README.md'],
      structureSignals: [
        { path: '10-ops/tasks/now.md', hints: ['current-work'] },
        { path: '40-tools/templates/task-template.md', hints: ['reusable-tool'] },
      ],
    });

    expect(prompt).toContain('Workbench 语义映射助手');
    expect(prompt).toContain('方法论角色');
    expect(prompt).toContain('项目可视化');
    expect(prompt).toContain('Markdown 是事实源');
    expect(prompt).toContain('项目实体');
    expect(prompt).toContain('项目实体 -> 计划/任务 -> 执行记录 -> 产出/复盘 -> 知识/工具复用');
    expect(prompt).toContain('工程方法论');
    expect(prompt).toContain('日常事务推进');
    expect(prompt).toContain('可复用工具');
    expect(prompt).toContain('只读结构识别');
    expect(prompt).toContain('不要要求用户新增、重命名、迁移或修改任何文件');
    expect(prompt).not.toContain('文件摘录');
    expect(prompt).not.toContain('用软件工程的思路管理日常任务');
    expect(prompt).toContain('isWorkbenchRepository');
    expect(prompt).toContain('current');
    expect(prompt).toContain('projects');
    expect(prompt).toContain('```ai-action');
  });

  it('recognizes Chinese work-system folder profiles before asking the Agent to map them', () => {
    const signals = buildWorkbenchStructureSignals([
      '事项/当前.md',
      '事项/待办.md',
      '事项/已完成.md',
      '项目/家庭账单/README.md',
      '计划/家庭账单-月度计划.md',
      '执行记录/2026-06-28.md',
      '成果/家庭预算表.md',
      '复盘/周复盘.md',
      '工具/检查清单.md',
      '知识库/账单规则.md',
    ]);

    expect(signals).toEqual(
      expect.arrayContaining([
        { path: '事项/当前.md', hints: expect.arrayContaining(['current-work']) },
        { path: '事项/待办.md', hints: expect.arrayContaining(['next-work']) },
        { path: '事项/已完成.md', hints: expect.arrayContaining(['done-work']) },
        { path: '项目/家庭账单/README.md', hints: expect.arrayContaining(['project-system']) },
        { path: '计划/家庭账单-月度计划.md', hints: expect.arrayContaining(['planning']) },
        { path: '执行记录/2026-06-28.md', hints: expect.arrayContaining(['execution-record']) },
        { path: '成果/家庭预算表.md', hints: expect.arrayContaining(['output']) },
        { path: '复盘/周复盘.md', hints: expect.arrayContaining(['review']) },
        { path: '工具/检查清单.md', hints: expect.arrayContaining(['reusable-tool']) },
        { path: '知识库/账单规则.md', hints: expect.arrayContaining(['knowledge-system']) },
      ]),
    );
  });

  it('recognizes ordinary Chinese task and deliverable repository profiles before mapping', () => {
    const signals = buildWorkbenchStructureSignals([
      '任务/今天.md',
      '任务/待处理.md',
      '任务/已归档.md',
      '执行/2026-06-30.md',
      '交付物/家庭预算表.md',
      '周报/本周复盘.md',
    ]);

    expect(signals).toEqual(
      expect.arrayContaining([
        { path: '任务/今天.md', hints: expect.arrayContaining(['current-work']) },
        { path: '任务/待处理.md', hints: expect.arrayContaining(['next-work']) },
        { path: '任务/已归档.md', hints: expect.arrayContaining(['done-work']) },
        { path: '执行/2026-06-30.md', hints: expect.arrayContaining(['execution-record']) },
        { path: '交付物/家庭预算表.md', hints: expect.arrayContaining(['output']) },
        { path: '周报/本周复盘.md', hints: expect.arrayContaining(['review']) },
      ]),
    );
  });

  it('recognizes notebook-style repository profiles as knowledge systems before mapping', () => {
    const signals = buildWorkbenchStructureSignals(['笔记/会议纪要.md', 'notes/customer-interview.md']);

    expect(signals).toEqual(
      expect.arrayContaining([
        { path: '笔记/会议纪要.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: 'notes/customer-interview.md', hints: expect.arrayContaining(['knowledge-system']) },
      ]),
    );
  });

  it('recognizes lightweight English task repository profiles before mapping', () => {
    const signals = buildWorkbenchStructureSignals(['tasks/today.md', 'archive/2026-q2.md']);

    expect(signals).toEqual(
      expect.arrayContaining([
        { path: 'tasks/today.md', hints: expect.arrayContaining(['current-work']) },
        { path: 'archive/2026-q2.md', hints: expect.arrayContaining(['done-work']) },
      ]),
    );
  });

  it('recognizes ordinary team product repository profiles before mapping', () => {
    const signals = buildWorkbenchStructureSignals([
      'kanban/doing.md',
      'kanban/later.md',
      'kanban/closed.md',
      'meetings/weekly-sync.md',
      'decisions/adr-001.md',
      'goals/q3-okr.md',
    ]);

    expect(signals).toEqual(
      expect.arrayContaining([
        { path: 'kanban/doing.md', hints: expect.arrayContaining(['current-work']) },
        { path: 'kanban/later.md', hints: expect.arrayContaining(['next-work']) },
        { path: 'kanban/closed.md', hints: expect.arrayContaining(['done-work']) },
        { path: 'meetings/weekly-sync.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: 'decisions/adr-001.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: 'goals/q3-okr.md', hints: expect.arrayContaining(['planning']) },
      ]),
    );
  });

  it('recognizes issue tracker and research repository profiles before mapping', () => {
    const signals = buildWorkbenchStructureSignals([
      'issues/open.md',
      'tickets/resolved.md',
      'research/interviews/customer-a.md',
      'specs/product-requirements.md',
    ]);

    expect(signals).toEqual(
      expect.arrayContaining([
        { path: 'issues/open.md', hints: expect.arrayContaining(['current-work']) },
        { path: 'tickets/resolved.md', hints: expect.arrayContaining(['done-work']) },
        { path: 'research/interviews/customer-a.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: 'specs/product-requirements.md', hints: expect.arrayContaining(['planning']) },
      ]),
    );
  });

  it('recognizes roadmap feedback and risk repository profiles before mapping', () => {
    const signals = buildWorkbenchStructureSignals([
      'roadmaps/desktop-2026.md',
      'milestones/q3-launch.md',
      'feedback/customer-requests.md',
      'risks/open.md',
    ]);

    expect(signals).toEqual(
      expect.arrayContaining([
        { path: 'roadmaps/desktop-2026.md', hints: expect.arrayContaining(['planning']) },
        { path: 'milestones/q3-launch.md', hints: expect.arrayContaining(['planning']) },
        { path: 'feedback/customer-requests.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: 'risks/open.md', hints: expect.arrayContaining(['current-work']) },
      ]),
    );
  });

  it('recognizes release QA and operations playbook repository profiles before mapping', () => {
    const signals = buildWorkbenchStructureSignals([
      'releases/q3-launch.md',
      'qa/test-plan.md',
      'playbooks/oncall.md',
      'runbooks/deploy.md',
    ]);

    expect(signals).toEqual(
      expect.arrayContaining([
        { path: 'releases/q3-launch.md', hints: expect.arrayContaining(['planning']) },
        { path: 'qa/test-plan.md', hints: expect.arrayContaining(['planning']) },
        { path: 'playbooks/oncall.md', hints: expect.arrayContaining(['reusable-tool']) },
        { path: 'runbooks/deploy.md', hints: expect.arrayContaining(['reusable-tool']) },
      ]),
    );
  });

  it('recognizes RFC proposal and architecture documentation profiles before mapping', () => {
    const signals = buildWorkbenchStructureSignals([
      'rfcs/desktop-card-protocol.md',
      'proposals/onboarding-flow.md',
      'docs/architecture.md',
      'docs/decisions.md',
    ]);

    expect(signals).toEqual(
      expect.arrayContaining([
        { path: 'rfcs/desktop-card-protocol.md', hints: expect.arrayContaining(['planning']) },
        { path: 'proposals/onboarding-flow.md', hints: expect.arrayContaining(['planning']) },
        { path: 'docs/architecture.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: 'docs/decisions.md', hints: expect.arrayContaining(['knowledge-system']) },
      ]),
    );
  });

  it('recognizes incident SOP policy and handbook repository profiles before mapping', () => {
    const signals = buildWorkbenchStructureSignals([
      'incidents/open.md',
      'postmortems/2026-06-outage.md',
      'sops/deploy.md',
      'policies/security.md',
      'handbook/onboarding.md',
    ]);

    expect(signals).toEqual(
      expect.arrayContaining([
        { path: 'incidents/open.md', hints: expect.arrayContaining(['current-work']) },
        { path: 'postmortems/2026-06-outage.md', hints: expect.arrayContaining(['review']) },
        { path: 'sops/deploy.md', hints: expect.arrayContaining(['reusable-tool']) },
        { path: 'policies/security.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: 'handbook/onboarding.md', hints: expect.arrayContaining(['knowledge-system']) },
      ]),
    );
  });

  it('recognizes CRM sales support and customer success profiles before mapping', () => {
    const signals = buildWorkbenchStructureSignals([
      'crm/accounts/acme.md',
      'sales/pipeline.md',
      'leads/new.md',
      'opportunities/open.md',
      'support/escalations.md',
      'customer-success/renewals.md',
      '销售/商机/open.md',
      '客服/工单/open.md',
    ]);

    expect(signals).toEqual(
      expect.arrayContaining([
        { path: 'crm/accounts/acme.md', hints: expect.arrayContaining(['project-system']) },
        { path: 'sales/pipeline.md', hints: expect.arrayContaining(['current-work']) },
        { path: 'leads/new.md', hints: expect.arrayContaining(['inbox']) },
        { path: 'opportunities/open.md', hints: expect.arrayContaining(['current-work']) },
        { path: 'support/escalations.md', hints: expect.arrayContaining(['current-work']) },
        { path: 'customer-success/renewals.md', hints: expect.arrayContaining(['planning']) },
        { path: '销售/商机/open.md', hints: expect.arrayContaining(['current-work']) },
        { path: '客服/工单/open.md', hints: expect.arrayContaining(['current-work']) },
      ]),
    );
  });

  it('recognizes finance legal recruiting and HR profiles before mapping', () => {
    const signals = buildWorkbenchStructureSignals([
      'finance/budget.md',
      'invoices/pending.md',
      'invoices/paid.md',
      'contracts/review.md',
      'contracts/signed.md',
      'recruiting/candidates/open.md',
      'hiring/interviews.md',
      'hr/onboarding.md',
      '财务/待处理发票.md',
      '合同/待审核.md',
      '招聘/候选人/open.md',
    ]);

    expect(signals).toEqual(
      expect.arrayContaining([
        { path: 'finance/budget.md', hints: expect.arrayContaining(['planning']) },
        { path: 'invoices/pending.md', hints: expect.arrayContaining(['current-work']) },
        { path: 'invoices/paid.md', hints: expect.arrayContaining(['done-work']) },
        { path: 'contracts/review.md', hints: expect.arrayContaining(['current-work']) },
        { path: 'contracts/signed.md', hints: expect.arrayContaining(['done-work']) },
        { path: 'recruiting/candidates/open.md', hints: expect.arrayContaining(['current-work']) },
        { path: 'hiring/interviews.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: 'hr/onboarding.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: '财务/待处理发票.md', hints: expect.arrayContaining(['current-work']) },
        { path: '合同/待审核.md', hints: expect.arrayContaining(['current-work']) },
        { path: '招聘/候选人/open.md', hints: expect.arrayContaining(['current-work']) },
      ]),
    );
  });

  it('recognizes content learning and education profiles before mapping', () => {
    const signals = buildWorkbenchStructureSignals([
      'content/calendar.md',
      'content/drafts/current.md',
      'publishing/published.md',
      'editorial/review.md',
      'courses/active.md',
      'assignments/due.md',
      'lessons/notes.md',
      'learning/roadmap.md',
      '营销/内容日历.md',
      '课程/待提交作业.md',
      '学习/笔记.md',
    ]);

    expect(signals).toEqual(
      expect.arrayContaining([
        { path: 'content/calendar.md', hints: expect.arrayContaining(['planning']) },
        { path: 'content/drafts/current.md', hints: expect.arrayContaining(['current-work']) },
        { path: 'publishing/published.md', hints: expect.arrayContaining(['done-work']) },
        { path: 'editorial/review.md', hints: expect.arrayContaining(['current-work']) },
        { path: 'courses/active.md', hints: expect.arrayContaining(['current-work']) },
        { path: 'assignments/due.md', hints: expect.arrayContaining(['current-work']) },
        { path: 'lessons/notes.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: 'learning/roadmap.md', hints: expect.arrayContaining(['planning']) },
        { path: '营销/内容日历.md', hints: expect.arrayContaining(['planning']) },
        { path: '课程/待提交作业.md', hints: expect.arrayContaining(['current-work']) },
        { path: '学习/笔记.md', hints: expect.arrayContaining(['knowledge-system']) },
      ]),
    );
  });

  it('recognizes personal health travel and home maintenance profiles before mapping', () => {
    const signals = buildWorkbenchStructureSignals([
      'health/goals.md',
      'workouts/current.md',
      'medical/notes.md',
      'travel/itinerary.md',
      'travel/bookings/upcoming.md',
      'home/repairs/open.md',
      'maintenance/checklist.md',
      'household/budget.md',
      '健康/体检记录.md',
      '旅行/行程计划.md',
      '家庭/维修待办.md',
    ]);

    expect(signals).toEqual(
      expect.arrayContaining([
        { path: 'health/goals.md', hints: expect.arrayContaining(['planning']) },
        { path: 'workouts/current.md', hints: expect.arrayContaining(['current-work']) },
        { path: 'medical/notes.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: 'travel/itinerary.md', hints: expect.arrayContaining(['planning']) },
        { path: 'travel/bookings/upcoming.md', hints: expect.arrayContaining(['current-work']) },
        { path: 'home/repairs/open.md', hints: expect.arrayContaining(['current-work']) },
        { path: 'maintenance/checklist.md', hints: expect.arrayContaining(['reusable-tool']) },
        { path: 'household/budget.md', hints: expect.arrayContaining(['planning']) },
        { path: '健康/体检记录.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: '旅行/行程计划.md', hints: expect.arrayContaining(['planning']) },
        { path: '家庭/维修待办.md', hints: expect.arrayContaining(['current-work']) },
      ]),
    );
  });

  it('recognizes design research and experiment profiles before mapping', () => {
    const signals = buildWorkbenchStructureSignals([
      'design/briefs/q3-redesign.md',
      'prototypes/dashboard-clickthrough.md',
      'experiments/running.md',
      'experiments/results/q3.md',
      'datasets/customer-feedback.md',
      '设计/方案评审.md',
      '实验/进行中.md',
      '研究/发现.md',
    ]);

    expect(signals).toEqual(
      expect.arrayContaining([
        { path: 'design/briefs/q3-redesign.md', hints: expect.arrayContaining(['project-system']) },
        { path: 'prototypes/dashboard-clickthrough.md', hints: expect.arrayContaining(['output']) },
        { path: 'experiments/running.md', hints: expect.arrayContaining(['current-work']) },
        { path: 'experiments/results/q3.md', hints: expect.arrayContaining(['done-work']) },
        { path: 'datasets/customer-feedback.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: '设计/方案评审.md', hints: expect.arrayContaining(['review']) },
        { path: '实验/进行中.md', hints: expect.arrayContaining(['current-work']) },
        { path: '研究/发现.md', hints: expect.arrayContaining(['knowledge-system']) },
      ]),
    );
  });

  it('recognizes fundraising compliance and analytics profiles before mapping', () => {
    const signals = buildWorkbenchStructureSignals([
      'fundraising/strategy.md',
      'investor-relations/updates/june.md',
      'data-room/index.md',
      'compliance/audits/open.md',
      'analytics/reports/monthly.md',
      'metrics/kpi.md',
      '融资/投资人更新.md',
      '合规/审计待办.md',
      '数据分析/月报.md',
    ]);

    expect(signals).toEqual(
      expect.arrayContaining([
        { path: 'fundraising/strategy.md', hints: expect.arrayContaining(['planning']) },
        { path: 'investor-relations/updates/june.md', hints: expect.arrayContaining(['output']) },
        { path: 'data-room/index.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: 'compliance/audits/open.md', hints: expect.arrayContaining(['current-work']) },
        { path: 'analytics/reports/monthly.md', hints: expect.arrayContaining(['output']) },
        { path: 'metrics/kpi.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: '融资/投资人更新.md', hints: expect.arrayContaining(['output']) },
        { path: '合规/审计待办.md', hints: expect.arrayContaining(['current-work']) },
        { path: '数据分析/月报.md', hints: expect.arrayContaining(['output']) },
      ]),
    );
  });

  it('recognizes nonprofit community event grant and volunteer profiles before mapping', () => {
    const signals = buildWorkbenchStructureSignals([
      'events/calendar.md',
      'events/upcoming.md',
      'grants/applications/open.md',
      'grants/awarded.md',
      'donations/campaign-plan.md',
      'volunteers/onboarding.md',
      'community/feedback.md',
      '活动/日历.md',
      '资助/申请中.md',
      '志愿者/招募中.md',
    ]);

    expect(signals).toEqual(
      expect.arrayContaining([
        { path: 'events/calendar.md', hints: expect.arrayContaining(['planning']) },
        { path: 'events/upcoming.md', hints: expect.arrayContaining(['current-work']) },
        { path: 'grants/applications/open.md', hints: expect.arrayContaining(['current-work']) },
        { path: 'grants/awarded.md', hints: expect.arrayContaining(['done-work']) },
        { path: 'donations/campaign-plan.md', hints: expect.arrayContaining(['planning']) },
        { path: 'volunteers/onboarding.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: 'community/feedback.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: '活动/日历.md', hints: expect.arrayContaining(['planning']) },
        { path: '资助/申请中.md', hints: expect.arrayContaining(['current-work']) },
        { path: '志愿者/招募中.md', hints: expect.arrayContaining(['current-work']) },
      ]),
    );
  });

  it('recognizes media production brand and localization profiles before mapping', () => {
    const signals = buildWorkbenchStructureSignals([
      'media/production-calendar.md',
      'episodes/in-production.md',
      'episodes/published.md',
      'brand/guidelines.md',
      'localization/pending.md',
      'translations/review.md',
      'translations/completed.md',
      '媒体/制作日历.md',
      '翻译/待处理.md',
      '品牌/视觉规范.md',
    ]);

    expect(signals).toEqual(
      expect.arrayContaining([
        { path: 'media/production-calendar.md', hints: expect.arrayContaining(['planning']) },
        { path: 'episodes/in-production.md', hints: expect.arrayContaining(['current-work']) },
        { path: 'episodes/published.md', hints: expect.arrayContaining(['done-work']) },
        { path: 'brand/guidelines.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: 'localization/pending.md', hints: expect.arrayContaining(['current-work']) },
        { path: 'translations/review.md', hints: expect.arrayContaining(['current-work']) },
        { path: 'translations/completed.md', hints: expect.arrayContaining(['done-work']) },
        { path: '媒体/制作日历.md', hints: expect.arrayContaining(['planning']) },
        { path: '翻译/待处理.md', hints: expect.arrayContaining(['current-work']) },
        { path: '品牌/视觉规范.md', hints: expect.arrayContaining(['knowledge-system']) },
      ]),
    );
  });

  it('recognizes personal tax insurance and warranty profiles before mapping', () => {
    const signals = buildWorkbenchStructureSignals([
      'taxes/filing-plan.md',
      'taxes/documents.md',
      'insurance/claims/open.md',
      'insurance/policies/home.md',
      'warranty/claims/pending.md',
      'warranties/receipts.md',
      '税务/报税计划.md',
      '保险/理赔中.md',
      '保单/家庭保险.md',
      '保修/凭证.md',
    ]);

    expect(signals).toEqual(
      expect.arrayContaining([
        { path: 'taxes/filing-plan.md', hints: expect.arrayContaining(['planning']) },
        { path: 'taxes/documents.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: 'insurance/claims/open.md', hints: expect.arrayContaining(['current-work']) },
        { path: 'insurance/policies/home.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: 'warranty/claims/pending.md', hints: expect.arrayContaining(['current-work']) },
        { path: 'warranties/receipts.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: '税务/报税计划.md', hints: expect.arrayContaining(['planning']) },
        { path: '保险/理赔中.md', hints: expect.arrayContaining(['current-work']) },
        { path: '保单/家庭保险.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: '保修/凭证.md', hints: expect.arrayContaining(['knowledge-system']) },
      ]),
    );
  });

  it('recognizes subscriptions memberships and license profiles before mapping', () => {
    const signals = buildWorkbenchStructureSignals([
      'subscriptions/renewal-calendar.md',
      'subscriptions/cancellations/pending.md',
      'memberships/renewals.md',
      'memberships/cards.md',
      'licenses/keys.md',
      'licenses/expiring.md',
      '订阅/续费计划.md',
      '订阅/待取消.md',
      '会员/卡片.md',
      '许可证/密钥.md',
    ]);

    expect(signals).toEqual(
      expect.arrayContaining([
        { path: 'subscriptions/renewal-calendar.md', hints: expect.arrayContaining(['planning']) },
        { path: 'subscriptions/cancellations/pending.md', hints: expect.arrayContaining(['current-work']) },
        { path: 'memberships/renewals.md', hints: expect.arrayContaining(['planning']) },
        { path: 'memberships/cards.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: 'licenses/keys.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: 'licenses/expiring.md', hints: expect.arrayContaining(['current-work']) },
        { path: '订阅/续费计划.md', hints: expect.arrayContaining(['planning']) },
        { path: '订阅/待取消.md', hints: expect.arrayContaining(['current-work']) },
        { path: '会员/卡片.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: '许可证/密钥.md', hints: expect.arrayContaining(['knowledge-system']) },
      ]),
    );
  });

  it('recognizes vehicle pet childcare and school profiles before mapping', () => {
    const signals = buildWorkbenchStructureSignals([
      'vehicles/maintenance-plan.md',
      'vehicles/repairs/open.md',
      'pets/vaccinations.md',
      'pets/medications/current.md',
      'childcare/schedule.md',
      'school/forms/due.md',
      '车辆/保养计划.md',
      '车辆/维修中.md',
      '宠物/疫苗记录.md',
      '学校/表格待交.md',
    ]);

    expect(signals).toEqual(
      expect.arrayContaining([
        { path: 'vehicles/maintenance-plan.md', hints: expect.arrayContaining(['planning']) },
        { path: 'vehicles/repairs/open.md', hints: expect.arrayContaining(['current-work']) },
        { path: 'pets/vaccinations.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: 'pets/medications/current.md', hints: expect.arrayContaining(['current-work']) },
        { path: 'childcare/schedule.md', hints: expect.arrayContaining(['planning']) },
        { path: 'school/forms/due.md', hints: expect.arrayContaining(['current-work']) },
        { path: '车辆/保养计划.md', hints: expect.arrayContaining(['planning']) },
        { path: '车辆/维修中.md', hints: expect.arrayContaining(['current-work']) },
        { path: '宠物/疫苗记录.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: '学校/表格待交.md', hints: expect.arrayContaining(['current-work']) },
      ]),
    );
  });

  it('recognizes housing rent utilities mortgage and moving profiles before mapping', () => {
    const signals = buildWorkbenchStructureSignals([
      'housing/lease-renewal.md',
      'rent/payments/due.md',
      'utilities/bills/pending.md',
      'utilities/accounts.md',
      'mortgage/documents.md',
      'moving/checklist.md',
      '房屋/租约续签.md',
      '房租/待缴.md',
      '水电/账单待处理.md',
      '搬家/清单.md',
    ]);

    expect(signals).toEqual(
      expect.arrayContaining([
        { path: 'housing/lease-renewal.md', hints: expect.arrayContaining(['planning']) },
        { path: 'rent/payments/due.md', hints: expect.arrayContaining(['current-work']) },
        { path: 'utilities/bills/pending.md', hints: expect.arrayContaining(['current-work']) },
        { path: 'utilities/accounts.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: 'mortgage/documents.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: 'moving/checklist.md', hints: expect.arrayContaining(['planning']) },
        { path: '房屋/租约续签.md', hints: expect.arrayContaining(['planning']) },
        { path: '房租/待缴.md', hints: expect.arrayContaining(['current-work']) },
        { path: '水电/账单待处理.md', hints: expect.arrayContaining(['current-work']) },
        { path: '搬家/清单.md', hints: expect.arrayContaining(['planning']) },
      ]),
    );
  });

  it('recognizes identity documents visa and appointment profiles before mapping', () => {
    const signals = buildWorkbenchStructureSignals([
      'identity/passports.md',
      'documents/ids.md',
      'visas/renewal-plan.md',
      'visas/applications/pending.md',
      'appointments/upcoming.md',
      'appointments/records.md',
      '证件/护照.md',
      '证件/身份证.md',
      '签证/续签计划.md',
      '预约/待办理.md',
    ]);

    expect(signals).toEqual(
      expect.arrayContaining([
        { path: 'identity/passports.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: 'documents/ids.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: 'visas/renewal-plan.md', hints: expect.arrayContaining(['planning']) },
        { path: 'visas/applications/pending.md', hints: expect.arrayContaining(['current-work']) },
        { path: 'appointments/upcoming.md', hints: expect.arrayContaining(['current-work']) },
        { path: 'appointments/records.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: '证件/护照.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: '证件/身份证.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: '签证/续签计划.md', hints: expect.arrayContaining(['planning']) },
        { path: '预约/待办理.md', hints: expect.arrayContaining(['current-work']) },
      ]),
    );
  });

  it('recognizes banking loan investment and retirement profiles before mapping', () => {
    const signals = buildWorkbenchStructureSignals([
      'banking/accounts.md',
      'banking/transactions/review.md',
      'loans/payoff-plan.md',
      'loans/documents.md',
      'investments/portfolio.md',
      'retirement/plan.md',
      'retirement/contributions/current.md',
      '银行/账户.md',
      '贷款/还款计划.md',
      '投资/组合.md',
      '退休/缴费待确认.md',
    ]);

    expect(signals).toEqual(
      expect.arrayContaining([
        { path: 'banking/accounts.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: 'banking/transactions/review.md', hints: expect.arrayContaining(['current-work']) },
        { path: 'loans/payoff-plan.md', hints: expect.arrayContaining(['planning']) },
        { path: 'loans/documents.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: 'investments/portfolio.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: 'retirement/plan.md', hints: expect.arrayContaining(['planning']) },
        { path: 'retirement/contributions/current.md', hints: expect.arrayContaining(['current-work']) },
        { path: '银行/账户.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: '贷款/还款计划.md', hints: expect.arrayContaining(['planning']) },
        { path: '投资/组合.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: '退休/缴费待确认.md', hints: expect.arrayContaining(['current-work']) },
      ]),
    );
  });

  it('recognizes recipes meal planning groceries and pantry profiles before mapping', () => {
    const signals = buildWorkbenchStructureSignals([
      'recipes/favorites.md',
      'meal-planning/week.md',
      'groceries/list.md',
      'grocery/orders/pending.md',
      'pantry/inventory.md',
      'nutrition/goals.md',
      '食谱/收藏.md',
      '餐食/本周计划.md',
      '购物/待买清单.md',
      '食材/库存.md',
      '营养/目标.md',
    ]);

    expect(signals).toEqual(
      expect.arrayContaining([
        { path: 'recipes/favorites.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: 'meal-planning/week.md', hints: expect.arrayContaining(['planning']) },
        { path: 'groceries/list.md', hints: expect.arrayContaining(['current-work']) },
        { path: 'grocery/orders/pending.md', hints: expect.arrayContaining(['current-work']) },
        { path: 'pantry/inventory.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: 'nutrition/goals.md', hints: expect.arrayContaining(['planning']) },
        { path: '食谱/收藏.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: '餐食/本周计划.md', hints: expect.arrayContaining(['planning']) },
        { path: '购物/待买清单.md', hints: expect.arrayContaining(['current-work']) },
        { path: '食材/库存.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: '营养/目标.md', hints: expect.arrayContaining(['planning']) },
      ]),
    );
  });

  it('recognizes orders deliveries returns and receipts profiles before mapping', () => {
    const signals = buildWorkbenchStructureSignals([
      'orders/pending.md',
      'orders/history.md',
      'deliveries/tracking.md',
      'packages/in-transit.md',
      'returns/open.md',
      'returns/policies.md',
      'receipts/purchases.md',
      '订单/待处理.md',
      '包裹/在途.md',
      '退货/待办理.md',
      '收据/购物记录.md',
    ]);

    expect(signals).toEqual(
      expect.arrayContaining([
        { path: 'orders/pending.md', hints: expect.arrayContaining(['current-work']) },
        { path: 'orders/history.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: 'deliveries/tracking.md', hints: expect.arrayContaining(['current-work']) },
        { path: 'packages/in-transit.md', hints: expect.arrayContaining(['current-work']) },
        { path: 'returns/open.md', hints: expect.arrayContaining(['current-work']) },
        { path: 'returns/policies.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: 'receipts/purchases.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: '订单/待处理.md', hints: expect.arrayContaining(['current-work']) },
        { path: '包裹/在途.md', hints: expect.arrayContaining(['current-work']) },
        { path: '退货/待办理.md', hints: expect.arrayContaining(['current-work']) },
        { path: '收据/购物记录.md', hints: expect.arrayContaining(['knowledge-system']) },
      ]),
    );
  });

  it('recognizes job search career resume and portfolio profiles before mapping', () => {
    const signals = buildWorkbenchStructureSignals([
      'job-search/applications/open.md',
      'job-search/offers/pending.md',
      'interviews/upcoming.md',
      'resumes/current.md',
      'portfolio/case-studies.md',
      'career/plan.md',
      '求职/投递中.md',
      '面试/待准备.md',
      '简历/当前版本.md',
      '作品集/案例.md',
      '职业/发展计划.md',
    ]);

    expect(signals).toEqual(
      expect.arrayContaining([
        { path: 'job-search/applications/open.md', hints: expect.arrayContaining(['current-work']) },
        { path: 'job-search/offers/pending.md', hints: expect.arrayContaining(['current-work']) },
        { path: 'interviews/upcoming.md', hints: expect.arrayContaining(['current-work']) },
        { path: 'resumes/current.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: 'portfolio/case-studies.md', hints: expect.arrayContaining(['output']) },
        { path: 'career/plan.md', hints: expect.arrayContaining(['planning']) },
        { path: '求职/投递中.md', hints: expect.arrayContaining(['current-work']) },
        { path: '面试/待准备.md', hints: expect.arrayContaining(['current-work']) },
        { path: '简历/当前版本.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: '作品集/案例.md', hints: expect.arrayContaining(['output']) },
        { path: '职业/发展计划.md', hints: expect.arrayContaining(['planning']) },
      ]),
    );
  });

  it('recognizes caregiving prescriptions doctors and medication profiles before mapping', () => {
    const signals = buildWorkbenchStructureSignals([
      'caregiving/care-plan.md',
      'caregiving/tasks/open.md',
      'prescriptions/refills/pending.md',
      'medications/current.md',
      'doctors/records.md',
      'therapy/plan.md',
      '照护/待办.md',
      '照护/计划.md',
      '处方/待续.md',
      '药物/当前.md',
      '医生/记录.md',
    ]);

    expect(signals).toEqual(
      expect.arrayContaining([
        { path: 'caregiving/care-plan.md', hints: expect.arrayContaining(['planning']) },
        { path: 'caregiving/tasks/open.md', hints: expect.arrayContaining(['current-work']) },
        { path: 'prescriptions/refills/pending.md', hints: expect.arrayContaining(['current-work']) },
        { path: 'medications/current.md', hints: expect.arrayContaining(['current-work']) },
        { path: 'doctors/records.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: 'therapy/plan.md', hints: expect.arrayContaining(['planning']) },
        { path: '照护/待办.md', hints: expect.arrayContaining(['current-work']) },
        { path: '照护/计划.md', hints: expect.arrayContaining(['planning']) },
        { path: '处方/待续.md', hints: expect.arrayContaining(['current-work']) },
        { path: '药物/当前.md', hints: expect.arrayContaining(['current-work']) },
        { path: '医生/记录.md', hints: expect.arrayContaining(['knowledge-system']) },
      ]),
    );
  });

  it('recognizes legal court estate and will profiles before mapping', () => {
    const signals = buildWorkbenchStructureSignals([
      'legal/cases/open.md',
      'legal/documents.md',
      'court/dates/upcoming.md',
      'estate/plan.md',
      'wills/drafts/current.md',
      'lawyer/notes.md',
      '法律/待处理.md',
      '法律/资料.md',
      '法院/日期.md',
      '遗产/规划.md',
      '遗嘱/草稿.md',
    ]);

    expect(signals).toEqual(
      expect.arrayContaining([
        { path: 'legal/cases/open.md', hints: expect.arrayContaining(['current-work']) },
        { path: 'legal/documents.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: 'court/dates/upcoming.md', hints: expect.arrayContaining(['current-work']) },
        { path: 'estate/plan.md', hints: expect.arrayContaining(['planning']) },
        { path: 'wills/drafts/current.md', hints: expect.arrayContaining(['current-work']) },
        { path: 'lawyer/notes.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: '法律/待处理.md', hints: expect.arrayContaining(['current-work']) },
        { path: '法律/资料.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: '法院/日期.md', hints: expect.arrayContaining(['current-work']) },
        { path: '遗产/规划.md', hints: expect.arrayContaining(['planning']) },
        { path: '遗嘱/草稿.md', hints: expect.arrayContaining(['current-work']) },
      ]),
    );
  });

  it('recognizes emergency contacts household inventory and disaster profiles before mapping', () => {
    const signals = buildWorkbenchStructureSignals([
      'emergency/plan.md',
      'emergency/contacts.md',
      'emergency/tasks/open.md',
      'household/inventory.md',
      'disaster/checklist.md',
      'evacuation/routes.md',
      '应急/计划.md',
      '应急/联系人.md',
      '应急/待办.md',
      '家庭/物品清单.md',
      '灾备/检查清单.md',
    ]);

    expect(signals).toEqual(
      expect.arrayContaining([
        { path: 'emergency/plan.md', hints: expect.arrayContaining(['planning']) },
        { path: 'emergency/contacts.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: 'emergency/tasks/open.md', hints: expect.arrayContaining(['current-work']) },
        { path: 'household/inventory.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: 'disaster/checklist.md', hints: expect.arrayContaining(['reusable-tool']) },
        { path: 'evacuation/routes.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: '应急/计划.md', hints: expect.arrayContaining(['planning']) },
        { path: '应急/联系人.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: '应急/待办.md', hints: expect.arrayContaining(['current-work']) },
        { path: '家庭/物品清单.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: '灾备/检查清单.md', hints: expect.arrayContaining(['reusable-tool']) },
      ]),
    );
  });

  it('recognizes hobby garden home project and event planning profiles before mapping', () => {
    const signals = buildWorkbenchStructureSignals([
      'hobbies/projects/current.md',
      'garden/plants.md',
      'garden/tasks/open.md',
      'renovation/plan.md',
      'renovation/budget.md',
      'event-planning/guest-list.md',
      'party/tasks/pending.md',
      '兴趣/项目计划.md',
      '园艺/植物记录.md',
      '园艺/待办.md',
      '装修/预算.md',
      '活动筹备/宾客名单.md',
      '生日/清单.md',
    ]);

    expect(signals).toEqual(
      expect.arrayContaining([
        { path: 'hobbies/projects/current.md', hints: expect.arrayContaining(['current-work']) },
        { path: 'garden/plants.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: 'garden/tasks/open.md', hints: expect.arrayContaining(['current-work']) },
        { path: 'renovation/plan.md', hints: expect.arrayContaining(['planning']) },
        { path: 'renovation/budget.md', hints: expect.arrayContaining(['planning']) },
        { path: 'event-planning/guest-list.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: 'party/tasks/pending.md', hints: expect.arrayContaining(['current-work']) },
        { path: '兴趣/项目计划.md', hints: expect.arrayContaining(['planning']) },
        { path: '园艺/植物记录.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: '园艺/待办.md', hints: expect.arrayContaining(['current-work']) },
        { path: '装修/预算.md', hints: expect.arrayContaining(['planning']) },
        { path: '活动筹备/宾客名单.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: '生日/清单.md', hints: expect.arrayContaining(['reusable-tool']) },
      ]),
    );
  });

  it('recognizes reading photo family memory and journal profiles before mapping', () => {
    const signals = buildWorkbenchStructureSignals([
      'reading/books.md',
      'reading/current.md',
      'books/to-read.md',
      'photos/albums.md',
      'photos/to-sort.md',
      'family-history/records.md',
      'journals/2026-07.md',
      'memoir/outline.md',
      '阅读/书单.md',
      '阅读/在读.md',
      '照片/相册.md',
      '照片/待整理.md',
      '家族史/记录.md',
      '日记/2026-07.md',
    ]);

    expect(signals).toEqual(
      expect.arrayContaining([
        { path: 'reading/books.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: 'reading/current.md', hints: expect.arrayContaining(['current-work']) },
        { path: 'books/to-read.md', hints: expect.arrayContaining(['current-work']) },
        { path: 'photos/albums.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: 'photos/to-sort.md', hints: expect.arrayContaining(['current-work']) },
        { path: 'family-history/records.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: 'journals/2026-07.md', hints: expect.arrayContaining(['execution-record']) },
        { path: 'memoir/outline.md', hints: expect.arrayContaining(['planning']) },
        { path: '阅读/书单.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: '阅读/在读.md', hints: expect.arrayContaining(['current-work']) },
        { path: '照片/相册.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: '照片/待整理.md', hints: expect.arrayContaining(['current-work']) },
        { path: '家族史/记录.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: '日记/2026-07.md', hints: expect.arrayContaining(['execution-record']) },
      ]),
    );
  });

  it('recognizes habit routine chores errands and gift profiles before mapping', () => {
    const signals = buildWorkbenchStructureSignals([
      'habits/tracker.md',
      'habits/current.md',
      'routines/morning.md',
      'chores/today.md',
      'chores/checklist.md',
      'errands/pending.md',
      'gifts/ideas.md',
      'wishlist/items.md',
      '习惯/打卡.md',
      '习惯/当前.md',
      '日常/晨间.md',
      '家务/待办.md',
      '家务/清单.md',
      '差事/待办.md',
      '礼物/想法.md',
      '愿望清单/物品.md',
    ]);

    expect(signals).toEqual(
      expect.arrayContaining([
        { path: 'habits/tracker.md', hints: expect.arrayContaining(['execution-record']) },
        { path: 'habits/current.md', hints: expect.arrayContaining(['current-work']) },
        { path: 'routines/morning.md', hints: expect.arrayContaining(['planning']) },
        { path: 'chores/today.md', hints: expect.arrayContaining(['current-work']) },
        { path: 'chores/checklist.md', hints: expect.arrayContaining(['reusable-tool']) },
        { path: 'errands/pending.md', hints: expect.arrayContaining(['current-work']) },
        { path: 'gifts/ideas.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: 'wishlist/items.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: '习惯/打卡.md', hints: expect.arrayContaining(['execution-record']) },
        { path: '习惯/当前.md', hints: expect.arrayContaining(['current-work']) },
        { path: '日常/晨间.md', hints: expect.arrayContaining(['planning']) },
        { path: '家务/待办.md', hints: expect.arrayContaining(['current-work']) },
        { path: '家务/清单.md', hints: expect.arrayContaining(['reusable-tool']) },
        { path: '差事/待办.md', hints: expect.arrayContaining(['current-work']) },
        { path: '礼物/想法.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: '愿望清单/物品.md', hints: expect.arrayContaining(['knowledge-system']) },
      ]),
    );
  });

  it('recognizes contacts relationship birthday and card profiles before mapping', () => {
    const signals = buildWorkbenchStructureSignals([
      'contacts/address-book.md',
      'contacts/follow-ups.md',
      'relationships/check-ins.md',
      'birthdays/calendar.md',
      'cards/to-send.md',
      'thank-you/notes.md',
      '联系人/通讯录.md',
      '联系人/待联系.md',
      '关系/近况.md',
      '生日/日历.md',
      '贺卡/待寄.md',
      '感谢/记录.md',
    ]);

    expect(signals).toEqual(
      expect.arrayContaining([
        { path: 'contacts/address-book.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: 'contacts/follow-ups.md', hints: expect.arrayContaining(['current-work']) },
        { path: 'relationships/check-ins.md', hints: expect.arrayContaining(['planning']) },
        { path: 'birthdays/calendar.md', hints: expect.arrayContaining(['planning']) },
        { path: 'cards/to-send.md', hints: expect.arrayContaining(['current-work']) },
        { path: 'thank-you/notes.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: '联系人/通讯录.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: '联系人/待联系.md', hints: expect.arrayContaining(['current-work']) },
        { path: '关系/近况.md', hints: expect.arrayContaining(['planning']) },
        { path: '生日/日历.md', hints: expect.arrayContaining(['planning']) },
        { path: '贺卡/待寄.md', hints: expect.arrayContaining(['current-work']) },
        { path: '感谢/记录.md', hints: expect.arrayContaining(['knowledge-system']) },
      ]),
    );
  });

  it('recognizes creative writing music and language learning profiles before mapping', () => {
    const signals = buildWorkbenchStructureSignals([
      'writing/drafts/current.md',
      'writing/submissions/pending.md',
      'writing/ideas.md',
      'music/practice-plan.md',
      'music/practice-log.md',
      'music/repertoire.md',
      'language/study-plan.md',
      'language/vocabulary.md',
      'language/practice/current.md',
      '创作/灵感.md',
      '写作/投稿待处理.md',
      '音乐/练习计划.md',
      '音乐/练习记录.md',
      '语言/学习计划.md',
      '语言/词汇.md',
    ]);

    expect(signals).toEqual(
      expect.arrayContaining([
        { path: 'writing/drafts/current.md', hints: expect.arrayContaining(['current-work']) },
        { path: 'writing/submissions/pending.md', hints: expect.arrayContaining(['current-work']) },
        { path: 'writing/ideas.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: 'music/practice-plan.md', hints: expect.arrayContaining(['planning']) },
        { path: 'music/practice-log.md', hints: expect.arrayContaining(['execution-record']) },
        { path: 'music/repertoire.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: 'language/study-plan.md', hints: expect.arrayContaining(['planning']) },
        { path: 'language/vocabulary.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: 'language/practice/current.md', hints: expect.arrayContaining(['current-work']) },
        { path: '创作/灵感.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: '写作/投稿待处理.md', hints: expect.arrayContaining(['current-work']) },
        { path: '音乐/练习计划.md', hints: expect.arrayContaining(['planning']) },
        { path: '音乐/练习记录.md', hints: expect.arrayContaining(['execution-record']) },
        { path: '语言/学习计划.md', hints: expect.arrayContaining(['planning']) },
        { path: '语言/词汇.md', hints: expect.arrayContaining(['knowledge-system']) },
      ]),
    );
  });

  it('recognizes small business inventory vendor and procurement profiles before mapping', () => {
    const signals = buildWorkbenchStructureSignals([
      'inventory/restock-list.md',
      'inventory/stock-counts.md',
      'inventory/audits/2026-07.md',
      'vendors/directory.md',
      'vendors/contracts.md',
      'suppliers/contacts.md',
      'purchase-orders/open.md',
      'procurement/plan.md',
      'procurement/requests/pending.md',
      '库存/补货清单.md',
      '库存/盘点记录.md',
      '供应商/名录.md',
      '供应商/合同.md',
      '采购/计划.md',
      '采购/待处理.md',
    ]);

    expect(signals).toEqual(
      expect.arrayContaining([
        { path: 'inventory/restock-list.md', hints: expect.arrayContaining(['current-work']) },
        { path: 'inventory/stock-counts.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: 'inventory/audits/2026-07.md', hints: expect.arrayContaining(['execution-record']) },
        { path: 'vendors/directory.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: 'vendors/contracts.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: 'suppliers/contacts.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: 'purchase-orders/open.md', hints: expect.arrayContaining(['current-work']) },
        { path: 'procurement/plan.md', hints: expect.arrayContaining(['planning']) },
        { path: 'procurement/requests/pending.md', hints: expect.arrayContaining(['current-work']) },
        { path: '库存/补货清单.md', hints: expect.arrayContaining(['current-work']) },
        { path: '库存/盘点记录.md', hints: expect.arrayContaining(['execution-record']) },
        { path: '供应商/名录.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: '供应商/合同.md', hints: expect.arrayContaining(['knowledge-system']) },
        { path: '采购/计划.md', hints: expect.arrayContaining(['planning']) },
        { path: '采购/待处理.md', hints: expect.arrayContaining(['current-work']) },
      ]),
    );
  });

  it('recognizes restaurant retail schedule menu reservation and inspection profiles before mapping', () => {
    const signals = buildWorkbenchStructureSignals([
      'restaurant/menu/seasonal-plan.md',
      'restaurant/reservations/upcoming.md',
      'restaurant/shifts/current.md',
      'restaurant/health-inspections/2026-07.md',
      'restaurant/daily-sales/reports.md',
      'retail/promotions/calendar.md',
      'retail/returns/open.md',
      'staff/schedule.md',
      '门店/排班.md',
      '餐厅/菜单计划.md',
      '餐厅/预订待处理.md',
      '餐厅/卫生检查记录.md',
      '门店/每日收银.md',
    ]);

    expect(signals).toEqual(
      expect.arrayContaining([
        { path: 'restaurant/menu/seasonal-plan.md', hints: expect.arrayContaining(['planning']) },
        { path: 'restaurant/reservations/upcoming.md', hints: expect.arrayContaining(['current-work']) },
        { path: 'restaurant/shifts/current.md', hints: expect.arrayContaining(['current-work']) },
        { path: 'restaurant/health-inspections/2026-07.md', hints: expect.arrayContaining(['review']) },
        { path: 'restaurant/daily-sales/reports.md', hints: expect.arrayContaining(['output']) },
        { path: 'retail/promotions/calendar.md', hints: expect.arrayContaining(['planning']) },
        { path: 'retail/returns/open.md', hints: expect.arrayContaining(['current-work']) },
        { path: 'staff/schedule.md', hints: expect.arrayContaining(['planning']) },
        { path: '门店/排班.md', hints: expect.arrayContaining(['planning']) },
        { path: '餐厅/菜单计划.md', hints: expect.arrayContaining(['planning']) },
        { path: '餐厅/预订待处理.md', hints: expect.arrayContaining(['current-work']) },
        { path: '餐厅/卫生检查记录.md', hints: expect.arrayContaining(['review']) },
        { path: '门店/每日收银.md', hints: expect.arrayContaining(['output']) },
      ]),
    );
  });

  it('parses a completed mapping response', () => {
    const parsed = parseWorkbenchSemanticMappingResponse(
      [
        '```ai-action',
        JSON.stringify({
          version: 1,
          kind: 'completed',
          result: {
            isWorkbenchRepository: true,
            confidence: 'high',
            reason: 'Has work system.',
            mapping: {
              mappingSource: 'agent',
              slots: {
                current: {
                  label: 'Current',
                  paths: ['10-ops/tasks/now.md'],
                  kind: 'document',
                  confidence: 'high',
                  reason: 'Current work.',
                },
              },
            },
          },
        }),
        '```',
      ].join('\n'),
    );

    expect(parsed).toEqual({
      isWorkbenchRepository: true,
      confidence: 'high',
      reason: 'Has work system.',
      mapping: {
        isWorkbenchRepository: true,
        confidence: 'high',
        reason: 'Has work system.',
        mappingSource: 'agent',
        slots: {
          current: {
            label: 'Current',
            paths: ['10-ops/tasks/now.md'],
            kind: 'document',
            confidence: 'high',
            reason: 'Current work.',
          },
        },
      },
    });
  });

  it('parses completed mapping from a json fenced block when models ignore the ai-action fence label', () => {
    const parsed = parseWorkbenchSemanticMappingResponse(
      [
        '识别完成。',
        '```json',
        JSON.stringify({
          version: 1,
          kind: 'completed',
          summary: '已识别工作台语义映射',
          result: {
            isWorkbenchRepository: true,
            confidence: 'high',
            reason: 'Has work system.',
            mapping: {
              mappingSource: 'agent',
              slots: {
                current: createSlot(['10-ops/tasks/now.md']),
              },
            },
          },
        }),
        '```',
      ].join('\n'),
    );

    expect(parsed?.isWorkbenchRepository).toBe(true);
    expect(parsed?.mapping?.slots.current?.paths).toEqual(['10-ops/tasks/now.md']);
  });

  it('parses completed mapping when model output has unescaped quotes inside string values', () => {
    const parsed = parseWorkbenchSemanticMappingResponse(
      [
        '```ai-action',
        '{"version":1,"kind":"completed","summary":"已识别工作台语义映射","result":{"isWorkbenchRepository":true,"confidence":"high","reason":"ok","mapping":{"mappingSource":"agent","slots":{"current":{"label":"正在做","paths":["10-ops/tasks/now.md"],"kind":"document","confidence":"high","reason":"now.md 是标准工程看板中的"当前任务"文件"}}}}}',
        '```',
      ].join('\n'),
    );

    expect(parsed?.isWorkbenchRepository).toBe(true);
    expect(parsed?.mapping?.slots.current?.reason).toContain('"当前任务"');
  });

  it('parses a negative mapping response without a mapping object', () => {
    const parsed = parseWorkbenchSemanticMappingResponse(
      [
        '```ai-action',
        JSON.stringify({
          version: 1,
          kind: 'completed',
          result: {
            isWorkbenchRepository: false,
            confidence: 'low',
            reason: 'Plain code repository.',
          },
        }),
        '```',
      ].join('\n'),
    );

    expect(parsed).toEqual({
      isWorkbenchRepository: false,
      confidence: 'low',
      reason: 'Plain code repository.',
    });
  });

  it('does not fall back to older blocks when the latest parsable block has an invalid mapping', () => {
    const parsed = parseWorkbenchSemanticMappingResponse(
      [
        '```ai-action',
        JSON.stringify({
          version: 1,
          kind: 'completed',
          result: {
            isWorkbenchRepository: true,
            confidence: 'high',
            reason: 'Older valid mapping.',
            mapping: {
              mappingSource: 'agent',
              slots: {
                current: createSlot(['10-ops/tasks/now.md']),
              },
            },
          },
        }),
        '```',
        '```ai-action',
        JSON.stringify({
          version: 1,
          kind: 'completed',
          result: {
            isWorkbenchRepository: true,
            confidence: 'high',
            reason: 'Latest block is structurally invalid.',
            mapping: {
              mappingSource: 'agent',
            },
          },
        }),
        '```',
      ].join('\n'),
    );

    expect(parsed).toBeNull();
  });

  it('returns null when the latest parsable block omits isWorkbenchRepository', () => {
    const parsed = parseWorkbenchSemanticMappingResponse(
      [
        '```ai-action',
        JSON.stringify({
          version: 1,
          kind: 'completed',
          result: {
            confidence: 'low',
            reason: 'Missing repository classification.',
          },
        }),
        '```',
      ].join('\n'),
    );

    expect(parsed).toBeNull();
  });

  it('parses the latest valid block when older ai-action blocks are negative or invalid', () => {
    const parsed = parseWorkbenchSemanticMappingResponse(
      [
        '```ai-action',
        JSON.stringify({
          version: 1,
          kind: 'completed',
          result: {
            isWorkbenchRepository: false,
            confidence: 'low',
            reason: 'Older negative result.',
          },
        }),
        '```',
        '```ai-action',
        JSON.stringify({
          version: 1,
          kind: 'completed',
          result: {
            isWorkbenchRepository: true,
            confidence: 'medium',
            reason: 'Latest valid result.',
            mapping: {
              mappingSource: 'agent',
              slots: {
                current: createSlot(['20-projects/demo/README.md']),
              },
            },
          },
        }),
        '```',
      ].join('\n'),
    );

    expect(parsed?.isWorkbenchRepository).toBe(true);
    expect(parsed?.reason).toBe('Latest valid result.');
    expect(parsed?.mapping?.slots.current?.paths).toEqual(['20-projects/demo/README.md']);
  });

  it('sanitizes paths against sampled repository tree entries', () => {
    const sanitized = sanitizeWorkbenchSemanticMapping({
      mapping: {
        isWorkbenchRepository: true,
        confidence: 'high',
        mappingSource: 'agent',
        slots: {
          current: {
            label: 'Current',
            paths: ['10-ops/tasks/now.md', '/bad.md', '../bad.md', 'missing.md'],
            kind: 'document',
            confidence: 'high',
            reason: 'Mixed paths.',
          },
          projects: {
            label: 'Projects',
            paths: ['20-projects'],
            kind: 'directory',
            confidence: 'high',
            reason: 'Project folder.',
          },
        },
      },
      tree: ['10-ops/', '10-ops/tasks/', '10-ops/tasks/now.md', '20-projects/'],
    });

    expect(sanitized?.slots.current?.paths).toEqual(['10-ops/tasks/now.md']);
    expect(sanitized?.slots.projects?.paths).toEqual(['20-projects']);
  });

  it('normalizes directory paths returned with trailing slashes', () => {
    const sanitized = sanitizeWorkbenchSemanticMapping({
      mapping: {
        isWorkbenchRepository: true,
        mappingSource: 'agent',
        slots: {
          inbox: {
            label: 'Inbox',
            paths: ['00-inbox/'],
            kind: 'directory',
            confidence: 'high',
            reason: 'Inbox directory.',
          },
          projects: {
            label: 'Projects',
            paths: ['20-projects/'],
            kind: 'directory',
            confidence: 'high',
            reason: 'Project folder.',
          },
        },
      },
      tree: ['00-inbox/', '00-inbox/README.md', '20-projects/', '20-projects/index.md'],
    });

    expect(sanitized?.slots.inbox?.paths).toEqual(['00-inbox']);
    expect(sanitized?.slots.projects?.paths).toEqual(['20-projects']);
  });

  it('does not preserve unsafe whitespace-wrapped semantic slot paths', () => {
    const sanitized = sanitizeWorkbenchSemanticMapping({
      mapping: {
        isWorkbenchRepository: true,
        mappingSource: 'agent',
        slots: {
          current: {
            label: 'Current',
            paths: ['10-ops/tasks/now.md', ' 10-ops/tasks/now.md '],
            kind: 'document',
            confidence: 'high',
            reason: 'Whitespace variant should not be saved.',
          },
        },
      },
      tree: ['10-ops/tasks/now.md'],
    });

    expect(sanitized?.slots.current?.paths).toEqual(['10-ops/tasks/now.md']);
  });

  it('keeps inferred parent directories from sampled file paths', () => {
    const sanitized = sanitizeWorkbenchSemanticMapping({
      mapping: {
        isWorkbenchRepository: true,
        mappingSource: 'agent',
        slots: {
          projects: {
            label: 'Projects',
            paths: ['20-projects'],
            kind: 'directory',
            confidence: 'high',
            reason: 'Parent project directory.',
          },
        },
      },
      tree: ['20-projects/demo/README.md'],
    });

    expect(sanitized?.slots.projects?.paths).toEqual(['20-projects']);
  });

  it('limits sanitized paths to 120 entries across all slots', () => {
    const paths = Array.from({ length: 130 }, (_, index) => `work/item-${index}.md`);
    const sanitized = sanitizeWorkbenchSemanticMapping({
      mapping: {
        isWorkbenchRepository: true,
        mappingSource: 'agent',
        slots: {
          inbox: createSlot(paths.slice(0, 20)),
          current: createSlot(paths.slice(20, 40)),
          next: createSlot(paths.slice(40, 60)),
          done: createSlot(paths.slice(60, 80)),
          projects: createSlot(paths.slice(80, 100)),
          plans: {
            active: createSlot(paths.slice(100, 120)),
            completed: createSlot(paths.slice(120, 130)),
          },
        },
      },
      tree: paths,
    });

    const sanitizedPaths = [
      ...(sanitized?.slots.inbox?.paths ?? []),
      ...(sanitized?.slots.current?.paths ?? []),
      ...(sanitized?.slots.next?.paths ?? []),
      ...(sanitized?.slots.done?.paths ?? []),
      ...(sanitized?.slots.projects?.paths ?? []),
      ...(sanitized?.slots.plans?.active?.paths ?? []),
      ...(sanitized?.slots.plans?.completed?.paths ?? []),
    ];

    expect(sanitizedPaths).toHaveLength(120);
    expect(sanitized?.slots.plans?.completed).toBeUndefined();
  });

  it('exports safe semantic slot path checks', () => {
    expect(isSafeSemanticSlotPath('20-projects/demo')).toBe(true);
    expect(isSafeSemanticSlotPath('/20-projects')).toBe(false);
    expect(isSafeSemanticSlotPath('../secret.md')).toBe(false);
    expect(isSafeSemanticSlotPath('.')).toBe(false);
    expect(isSafeSemanticSlotPath('./20-projects')).toBe(false);
    expect(isSafeSemanticSlotPath('20-projects/./demo')).toBe(false);
    expect(isSafeSemanticSlotPath('20-projects//demo')).toBe(false);
    expect(isSafeSemanticSlotPath(' 20-projects/demo')).toBe(false);
    expect(isSafeSemanticSlotPath('20-projects/demo ')).toBe(false);
    expect(isSafeSemanticSlotPath('20-projects/\tdemo')).toBe(false);
    expect(isSafeSemanticSlotPath('20-projects\\demo')).toBe(false);
    expect(isSafeSemanticSlotPath('')).toBe(false);
  });
});

function createSlot(paths: string[]) {
  return {
    label: 'Slot',
    paths,
    kind: 'mixed' as const,
    confidence: 'high' as const,
    reason: 'Many paths.',
  };
}
