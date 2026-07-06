import workbenchSemanticMappingTemplate from '../prompts/repository/workbench-semantic-mapping.md?raw';
import type {
  RepositoryStatus,
  SemanticConfidence,
  SemanticSlot,
  WorkbenchSemanticMapping,
  WorkbenchSemanticSlots,
} from './agentic-repository';
import { parseModelJsonObjects } from './model-json';
import { renderPromptTemplate } from './prompt-template';

const MAX_SEMANTIC_SLOT_PATHS = 120;
const MAX_PATHS_PER_SLOT = 20;
const UNSAFE_PATH_PATTERN = new RegExp(String.raw`[\s\x00-\x1f\x7f]`);

export interface WorkbenchStructureSignal {
  path: string;
  hints: string[];
}

export interface WorkbenchSemanticMappingResponse {
  isWorkbenchRepository: boolean;
  confidence?: SemanticConfidence;
  reason?: string;
  mapping?: WorkbenchSemanticMapping;
}

export type WorkbenchRepositorySetupFeedbackKind =
  | 'unbound'
  | 'blocked'
  | 'recommended-ready'
  | 'semantic-mapped'
  | 'needs-adaptation';

export type WorkbenchRepositorySetupAction = 'none' | 'choose-folder' | 'map-workbench' | 'approve-adaptation';

export interface WorkbenchRepositorySetupFeedback {
  kind: WorkbenchRepositorySetupFeedbackKind;
  tone: 'success' | 'info' | 'warning' | 'danger';
  primaryAction: WorkbenchRepositorySetupAction;
  secondaryAction?: WorkbenchRepositorySetupAction;
  requiresApproval: boolean;
  missingRecommendedEntries: string[];
}

export function buildWorkbenchRepositorySetupFeedback(options: {
  status: RepositoryStatus;
  binding: Pick<{ workbench?: WorkbenchSemanticMapping }, 'workbench'> | null;
  missingRecommendedEntries?: string[];
}): WorkbenchRepositorySetupFeedback {
  const missingRecommendedEntries = options.missingRecommendedEntries ?? [];
  if (options.status === 'repo_ready') {
    return {
      kind: 'recommended-ready',
      tone: 'success',
      primaryAction: 'none',
      requiresApproval: false,
      missingRecommendedEntries,
    };
  }
  if (options.binding?.workbench?.isWorkbenchRepository) {
    return {
      kind: 'semantic-mapped',
      tone: 'success',
      primaryAction: 'none',
      requiresApproval: false,
      missingRecommendedEntries,
    };
  }
  if (
    options.status === 'repo_needs_bootstrap' ||
    options.status === 'repo_not_git' ||
    options.status === 'repo_empty'
  ) {
    return {
      kind: 'needs-adaptation',
      tone: options.status === 'repo_empty' ? 'info' : 'warning',
      primaryAction: options.status === 'repo_empty' ? 'approve-adaptation' : 'map-workbench',
      secondaryAction: options.status === 'repo_empty' ? undefined : 'approve-adaptation',
      requiresApproval: true,
      missingRecommendedEntries,
    };
  }
  if (options.status === 'repo_unbound') {
    return {
      kind: 'unbound',
      tone: 'info',
      primaryAction: 'choose-folder',
      requiresApproval: false,
      missingRecommendedEntries,
    };
  }
  return {
    kind: 'blocked',
    tone: 'danger',
    primaryAction: 'none',
    requiresApproval: false,
    missingRecommendedEntries,
  };
}

export function buildWorkbenchSemanticMappingPrompt(options: {
  repoPath: string;
  tree: string[];
  structureSignals: WorkbenchStructureSignal[];
}): string {
  return renderPromptTemplate(workbenchSemanticMappingTemplate, {
    repoPath: options.repoPath,
    tree: options.tree.map((item) => `- ${item}`).join('\n') || '- （空）',
    structureSignals:
      options.structureSignals.map((item) => `- ${item.path}: ${item.hints.join(', ')}`).join('\n') || '- （无）',
  });
}

export function buildWorkbenchStructureSignals(tree: string[]): WorkbenchStructureSignal[] {
  const signals = tree
    .map((path) => ({ path, hints: inferWorkbenchPathHints(path) }))
    .filter((item) => item.hints.length > 0);
  return signals.slice(0, 120);
}

function inferWorkbenchPathHints(path: string): string[] {
  const normalized = path.toLowerCase();
  const hints: string[] = [];
  if (
    /(^|\/)(inbox|capture|captures|input|inputs)(\/|\.md$)/.test(normalized) ||
    /(^|\/)(leads?|prospects?|intake)(\/|$)/.test(normalized) ||
    hasAny(normalized, ['收集', '收件', '捕获', '输入', '线索'])
  )
    hints.push('inbox');
  if (
    /(^|\/)(now|today|current|active|doing)\.md$/.test(normalized) ||
    /(^|\/)(current|active|doing|in-progress)(\/|$)/.test(normalized) ||
    /(^|\/)(issues?|tickets?|bugs?)\/(open|triage)\.md$/.test(normalized) ||
    /(^|\/)incidents?\/(open|active|current|triage)\.md$/.test(normalized) ||
    /(^|\/)risks?\/(open|active|current)\.md$/.test(normalized) ||
    /(^|\/)(sales|pipeline|opportunities|deals|support|escalations?|cases?)\/(open|active|current|triage)?\.md$/.test(
      normalized,
    ) ||
    /(^|\/)(sales|pipeline|opportunities|deals|support|escalations?|cases?)(\/|$)/.test(normalized) ||
    /(^|\/)(invoices?|bills?)\/(pending|open|unpaid|due)\.md$/.test(normalized) ||
    /(^|\/)(insurance|warranty|warranties)\/claims?\/(open|active|current|pending|review)\.md$/.test(normalized) ||
    /(^|\/)contracts?\/(review|pending|draft)\.md$/.test(normalized) ||
    /(^|\/)(recruiting|hiring|candidates?)\/(open|active|current|pipeline)?\.md$/.test(normalized) ||
    /(^|\/)(recruiting|hiring|candidates?)\/.+\/(open|active|current|pipeline)\.md$/.test(normalized) ||
    /(^|\/)(content|editorial)\/(drafts?\/)?(current|review|pending|active)\.md$/.test(normalized) ||
    /(^|\/)(courses?|assignments?)\/(active|current|due|pending|open)\.md$/.test(normalized) ||
    /(^|\/)experiments?\/(running|active|current|open|pending)\.md$/.test(normalized) ||
    /(^|\/)(compliance|audits?|controls?)\/.+\/(open|active|current|pending|review)\.md$/.test(normalized) ||
    /(^|\/)(compliance|audits?|controls?)\/(open|active|current|pending|review)\.md$/.test(normalized) ||
    /(^|\/)events?\/(upcoming|current|active|open|pending)\.md$/.test(normalized) ||
    /(^|\/)(episodes?|videos?|media)\/(in-production|production|editing|current|active|open|pending)\.md$/.test(
      normalized,
    ) ||
    /(^|\/)(restaurant|restaurants|cafe|cafes|retail|store|stores)\/(reservations?|bookings?|orders?|returns?|shifts?|staffing)\/?(upcoming|current|active|open|pending)?\.md$/.test(
      normalized,
    ) ||
    /(^|\/)(restaurant|restaurants|cafe|cafes|retail|store|stores)\/.+\/(upcoming|current|active|open|pending|review)\.md$/.test(
      normalized,
    ) ||
    /(^|\/)(localization|l10n|translations?)\/(pending|review|active|current|open)\.md$/.test(normalized) ||
    /(^|\/)subscriptions?\/(cancellations?\/)?(pending|review|active|current|open|cancel)\.md$/.test(normalized) ||
    /(^|\/)licenses?\/(expiring|pending|review|active|current|open)\.md$/.test(normalized) ||
    /(^|\/)(vehicles?|cars?)\/(repairs?\/)?(open|active|current|pending|review)\.md$/.test(normalized) ||
    /(^|\/)(pets?)\/(medications?|medicine)\/(current|active|open|pending|review)\.md$/.test(normalized) ||
    /(^|\/)(school|schools|childcare)\/(forms?|paperwork|tasks?)\/(due|pending|open|current)\.md$/.test(normalized) ||
    /(^|\/)(rent|utilities|utility)\/.+\/(due|pending|open|current|unpaid)\.md$/.test(normalized) ||
    /(^|\/)(rent|utilities|utility)\/(due|pending|open|current|unpaid)\.md$/.test(normalized) ||
    /(^|\/)visas?\/applications?\/(pending|open|active|current|review)\.md$/.test(normalized) ||
    /(^|\/)appointments?\/(upcoming|pending|open|active|current|due)\.md$/.test(normalized) ||
    /(^|\/)(banking|banks?|accounts?)\/transactions?\/(review|pending|current|open)\.md$/.test(normalized) ||
    /(^|\/)(grocer(y|ies)|shopping)\/(list|lists|pending|current|open|today)\.md$/.test(normalized) ||
    /(^|\/)(grocer(y|ies)|shopping)\/orders?\/(pending|current|open)\.md$/.test(normalized) ||
    /(^|\/)(orders?|deliveries|delivery|packages?|shipments?|returns?)\/(pending|open|current|tracking|in-transit|transit)\.md$/.test(
      normalized,
    ) ||
    /(^|\/)(job-search|jobs?|career)\/(applications?|offers?|interviews?)\/(open|pending|current|upcoming|review)\.md$/.test(
      normalized,
    ) ||
    /(^|\/)interviews?\/(upcoming|pending|open|current|prep|preparation)\.md$/.test(normalized) ||
    /(^|\/)(caregiving|care|eldercare|prescriptions?|medications?|doctors?|clinics?)\/.+\/(open|pending|current|upcoming|review|refill|refills)\.md$/.test(
      normalized,
    ) ||
    /(^|\/)(caregiving|care|eldercare|prescriptions?|medications?)\/(open|pending|current|upcoming|review|refill|refills)\.md$/.test(
      normalized,
    ) ||
    /(^|\/)(legal|law|lawsuits?|court|courts?|lawyer|lawyers?|attorney|attorneys?)\/.+\/(open|pending|current|upcoming|review|dates?)\.md$/.test(
      normalized,
    ) ||
    /(^|\/)(legal|law|lawsuits?|court|courts?)\/(open|pending|current|upcoming|review|dates?)\.md$/.test(normalized) ||
    /(^|\/)(wills?|testaments?)\/drafts?\/(current|open|pending|review)\.md$/.test(normalized) ||
    /(^|\/)(emergency|emergencies|disaster|disasters|evacuation|evacuations)\/(tasks?\/)?(open|pending|current|upcoming|review)\.md$/.test(
      normalized,
    ) ||
    /(^|\/)(reading|books?|photos?|albums?)\/(to-read|current|active|open|pending|review|to-sort|sort|sorting)\.md$/.test(
      normalized,
    ) ||
    /(^|\/)(habits?|routines?|chores?|errands?|gifts?|wishlist)\/(current|active|open|pending|today|due|review|todo)\.md$/.test(
      normalized,
    ) ||
    /(^|\/)(contacts?|relationships?|cards?)\/(follow-ups?|to-send|pending|current|today|due|open)\.md$/.test(
      normalized,
    ) ||
    /(^|\/)(writing|creative-writing|music|language)\/.+\/(pending|current|open|review|practice)\.md$/.test(
      normalized,
    ) ||
    /(^|\/)(inventory|stock|purchase-orders?|procurement)\/.+\/(pending|open|current|review|restock|requests?)\.md$/.test(
      normalized,
    ) ||
    /(^|\/)(inventory|stock)\/(restock-list|restock|low-stock|to-order|reorder)\.md$/.test(normalized) ||
    /(^|\/)(purchase-orders?|procurement)\/(open|pending|current|review|requests?)\.md$/.test(normalized) ||
    /(^|\/)(hobbies?|crafts?|garden|gardening|plants?|renovation|remodel|home-projects?|event-planning|party|parties)\/.+\/(open|pending|current|active|review|todo|tasks?)\.md$/.test(
      normalized,
    ) ||
    /(^|\/)grants?\/.+\/(open|active|current|pending|review)\.md$/.test(normalized) ||
    /(^|\/)grants?\/(open|active|current|pending|review)\.md$/.test(normalized) ||
    /(^|\/)volunteers?\/(recruiting|open|active|current|pending)\.md$/.test(normalized) ||
    /(^|\/)(travel|trips?)\/(bookings?|reservations?)\/(upcoming|current|pending)\.md$/.test(normalized) ||
    /(^|\/)(home|house|household)\/(repairs?|maintenance|fixes)\/?(open|active|current|pending)?\.md$/.test(
      normalized,
    ) ||
    hasAny(normalized, [
      '当前',
      '正在',
      '进行中',
      '活跃',
      '今天',
      '今日',
      '销售',
      '商机',
      '客服',
      '工单',
      '升级',
      '待处理发票',
      '待审核',
      '招聘',
      '候选人',
      '待提交作业',
      '维修待办',
      '实验',
      '合规',
      '审计待办',
      '申请中',
      '招募中',
      '翻译/待处理',
      '翻译/审核',
      '理赔中',
      '保修/申请中',
      '订阅/待取消',
      '待取消',
      '许可证/即将到期',
      '车辆/维修中',
      '学校/表格待交',
      '房租/待缴',
      '水电/账单待处理',
      '签证/申请中',
      '预约/待办理',
      '退休/缴费待确认',
      '购物/待买清单',
      '订单/待处理',
      '包裹/在途',
      '退货/待办理',
      '求职/投递中',
      '面试/待准备',
      '照护/待办',
      '处方/待续',
      '药物/当前',
      '法律/待处理',
      '法院/日期',
      '遗嘱/草稿',
      '应急/待办',
      '园艺/待办',
      '活动筹备/待办',
      '装修/待办',
      '阅读/在读',
      '照片/待整理',
      '习惯/当前',
      '家务/待办',
      '差事/待办',
      '联系人/待联系',
      '贺卡/待寄',
      '写作/投稿待处理',
      '库存/补货清单',
      '采购/待处理',
      '餐厅/预订待处理',
      '餐厅/预订',
      '门店/退货',
      '门店/当前',
    ])
  )
    hints.push('current-work');
  if (
    /(^|\/)(next|todo|backlog|someday|later)\.md$/.test(normalized) ||
    /(^|\/)(next|todo|backlog|someday|later|icebox)(\/|$)/.test(normalized) ||
    hasAny(normalized, ['待办', '待处理', '下一步', '以后', '稍后', '积压'])
  )
    hints.push('next-work');
  if (
    /(^|\/)(done|completed|archive|closed|finished|resolved)\.md$/.test(normalized) ||
    /(^|\/)(done|completed|archive|closed|finished|resolved)(\/|$)/.test(normalized) ||
    /(^|\/)(invoices?|bills?)\/(paid|settled)\.md$/.test(normalized) ||
    /(^|\/)contracts?\/(signed|executed)\.md$/.test(normalized) ||
    /(^|\/)(publishing|content|editorial)\/(published|shipped|released)\.md$/.test(normalized) ||
    /(^|\/)experiments?\/(results?|completed|finished|archive)(\/|\.md$)/.test(normalized) ||
    /(^|\/)(episodes?|videos?|media)\/(published|released|completed|finished|archive)\.md$/.test(normalized) ||
    /(^|\/)(localization|l10n|translations?)\/(completed|done|published|released|archive)\.md$/.test(normalized) ||
    /(^|\/)grants?\/(awarded|approved|won|closed|completed)\.md$/.test(normalized) ||
    hasAny(normalized, ['已完成', '完成', '归档', '已支付', '已签署', '已发布', '实验结果', '已获资助'])
  )
    hints.push('done-work');
  if (
    /(^|\/)(project|projects|initiative|initiatives|client|clients|customer|customers|crm|accounts?)(\/|$)/.test(
      normalized,
    ) ||
    /(^|\/)(design|designs?)\/(briefs?|projects?|initiatives?)(\/|\.md$)/.test(normalized) ||
    /(^|\/)(readme|brief|prd)\.md$/.test(normalized) ||
    hasAny(normalized, ['项目', '专题', '客户', '设计方案'])
  )
    hints.push('project-system');
  if (
    /(^|\/)(plan|test-plan|roadmap|milestone|timeline|release|launch|proposal|rfc|goal|goals|okr|spec|specs?|requirements?)\.md$/.test(
      normalized,
    ) ||
    /(^|\/)(plans|roadmaps?|milestones?|timelines?|releases?|launches?|proposals?|rfcs?|qa|quality|test-plans?|test-cases?|goals|okrs?|specs?|requirements?)(\/|$)/.test(
      normalized,
    ) ||
    /(^|\/)(finance|budget|budgets|renewal|renewals|forecast|forecasts|quota|quotas|customer-success)(\/|\.md$)/.test(
      normalized,
    ) ||
    /(^|\/)(fundraising|fundraise|investor-relations?|investors?)\/(strategy|plan|plans|roadmap|targets?)\.md$/.test(
      normalized,
    ) ||
    /(^|\/)(tax|taxes)\/(filing-plan|filing|return-plan|plan|plans|calendar|checklist)\.md$/.test(normalized) ||
    /(^|\/)(subscriptions?|memberships?|licenses?)\/(renewal-calendar|renewals?|renewal|calendar|plan|plans)\.md$/.test(
      normalized,
    ) ||
    /(^|\/)(vehicles?|cars?)\/(maintenance-plan|maintenance|service-plan|service|schedule|calendar|plan|plans)\.md$/.test(
      normalized,
    ) ||
    /(^|\/)(childcare|school|schools)\/(schedule|calendar|plan|plans)\.md$/.test(normalized) ||
    /(^|\/)(housing|lease|leases|rent)\/(lease-renewal|renewal|renewals|plan|plans|schedule|calendar)\.md$/.test(
      normalized,
    ) ||
    /(^|\/)(moving|move)\/(checklist|plan|plans|schedule|calendar)\.md$/.test(normalized) ||
    /(^|\/)(renovation|remodel|home-projects?|event-planning|party|parties|hobbies?|crafts?)\/(budget|budgets|plan|plans|schedule|calendar|timeline)\.md$/.test(
      normalized,
    ) ||
    /(^|\/)(memoir|memoirs|family-history|family-memories?)\/(outline|plan|plans|timeline|draft-plan|draft)\.md$/.test(
      normalized,
    ) ||
    /(^|\/)(habits?|routines?)\/(morning|evening|weekly|daily|routine|routines?|plan|plans|schedule|calendar)\.md$/.test(
      normalized,
    ) ||
    /(^|\/)(relationships?|birthdays?|contacts?)\/(check-ins?|calendar|calendars|schedule|plan|plans)\.md$/.test(
      normalized,
    ) ||
    /(^|\/)(writing|creative-writing|music|language)\/(practice-plan|study-plan|plan|plans|schedule|calendar)\.md$/.test(
      normalized,
    ) ||
    /(^|\/)(inventory|stock|purchase-orders?|procurement|suppliers?|vendors?)\/(plan|plans|strategy|calendar|schedule|forecast)\.md$/.test(
      normalized,
    ) ||
    /(^|\/)visas?\/(renewal-plan|renewal|renewals|plan|plans|schedule|calendar)\.md$/.test(normalized) ||
    /(^|\/)(loans?|mortgages?)\/(payoff-plan|repayment-plan|payment-plan|payments?|plan|plans|schedule|calendar)\.md$/.test(
      normalized,
    ) ||
    /(^|\/)(meal-planning|meal-plans?|meals?|menus?|nutrition)\/(week|weekly|plan|plans|calendar|goals?)\.md$/.test(
      normalized,
    ) ||
    /(^|\/)(restaurant|restaurants|cafe|cafes|retail|store|stores)\/(menus?|menu|promotions?|promo|shifts?|staffing|schedule|schedules|calendar|calendars|plan|plans|seasonal-plan)\.md$/.test(
      normalized,
    ) ||
    /(^|\/)(restaurant|restaurants|cafe|cafes|retail|store|stores)\/(menus?|menu|promotions?|promo)\/(seasonal-plan|calendar|calendars|schedule|schedules|plan|plans)\.md$/.test(
      normalized,
    ) ||
    /(^|\/)(staff|staffing)\/(schedule|schedules|calendar|calendars|plan|plans)\.md$/.test(normalized) ||
    /(^|\/)(caregiving|care|eldercare|therapy)\/(care-plan|plan|plans|schedule|calendar|goals?)\.md$/.test(
      normalized,
    ) ||
    /(^|\/)(estate|estates?|wills?|testaments?)\/(plan|plans|planning|规划|schedule|calendar)\.md$/.test(normalized) ||
    /(^|\/)(content|marketing)\/(calendar|calendars|schedule|schedules)\.md$/.test(normalized) ||
    /(^|\/)(media|podcast|newsletter|episodes?)\/(production-calendar|calendar|calendars|schedule|schedules|season-plan|plan|plans)\.md$/.test(
      normalized,
    ) ||
    /(^|\/)events?\/(calendar|calendars|schedule|schedules|plan|plans)\.md$/.test(normalized) ||
    /(^|\/)(donations?|campaigns?)\/(campaign-plan|plan|plans|strategy)\.md$/.test(normalized) ||
    /(^|\/)(learning|curriculum)\/(roadmap|plan|plans)\.md$/.test(normalized) ||
    /(^|\/)(travel|trips?)\/(itinerary|itineraries|plans?|schedule|schedules)\.md$/.test(normalized) ||
    hasAny(normalized, [
      '计划',
      '路线图',
      '里程碑',
      '时间线',
      '需求',
      '预算',
      '续约',
      '预测',
      '内容日历',
      '行程',
      '融资策略',
      '活动/日历',
      '活动日历',
      '筹款计划',
      '制作日历',
      '报税计划',
      '续费计划',
      '订阅/续费计划',
      '保养计划',
      '车辆/保养计划',
      '房屋/租约续签',
      '搬家/清单',
      '签证/续签计划',
      '贷款/还款计划',
      '餐食/本周计划',
      '营养/目标',
      '照护/计划',
      '遗产/规划',
      '装修/预算',
      '兴趣/项目计划',
      '活动筹备/计划',
      '回忆录/大纲',
      '家族史/时间线',
      '日常/晨间',
      '日常/晚间',
      '关系/近况',
      '生日/日历',
      '音乐/练习计划',
      '语言/学习计划',
      '采购/计划',
      '菜单计划',
      '餐厅/菜单计划',
      '门店/排班',
    ])
  )
    hints.push('planning');
  if (
    /(^|\/)(run|runs|log|logs|journal|journals)(\/|\.md$)/.test(normalized) ||
    /(^|\/)habits?\/(tracker|tracking|log|logs|streaks?|history)\.md$/.test(normalized) ||
    /(^|\/)(writing|creative-writing|music|language)\/(practice-log|log|logs|journal|journals|history)\.md$/.test(
      normalized,
    ) ||
    /(^|\/)(inventory|stock)\/(audits?|counts?|stock-counts|count-log|log|logs|history)(\/|\.md$)/.test(normalized) ||
    hasAny(normalized, ['执行记录', '运行记录', '执行', '日志', '日记', '习惯/打卡', '音乐/练习记录', '库存/盘点记录'])
  )
    hints.push('execution-record');
  if (
    /(^|\/)(output|outputs|deliverable|deliverables|artifact|artifacts|prototype|prototypes)(\/|$)/.test(normalized) ||
    /(^|\/)(investor-relations?|investors?|fundraising)\/(updates?|reports?)(\/|\.md$)/.test(normalized) ||
    /(^|\/)(analytics|analysis|metrics)\/(reports?|dashboards?|monthly|weekly)(\/|\.md$)/.test(normalized) ||
    /(^|\/)(portfolio|portfolios)\/(case-studies?|projects?|samples?|work|index)\.md$/.test(normalized) ||
    /(^|\/)(restaurant|restaurants|cafe|cafes|retail|store|stores)\/(daily-sales|sales|reports?|cash|register|pos)(\/|\.md$)/.test(
      normalized,
    ) ||
    hasAny(normalized, ['成果', '产物', '输出', '交付', '投资人更新', '月报', '数据分析', '作品集/案例', '每日收银'])
  )
    hints.push('output');
  if (
    /(^|\/)(review|reviews|retro|retrospective|postmortem|postmortems)(\/|\.md$)/.test(normalized) ||
    /(^|\/)(restaurant|restaurants|cafe|cafes|retail|store|stores)\/(health-inspections?|inspections?|audits?)(\/|\.md$)/.test(
      normalized,
    ) ||
    hasAny(normalized, ['复盘', '回顾', '总结', '评审', '卫生检查'])
  )
    hints.push('review');
  if (
    /(^|\/)(tool|tools|script|scripts|template|templates|sops?|playbooks?|runbooks?|procedures?|checklists?|prompts?)(\/|\.md$)/.test(
      normalized,
    ) ||
    /(^|\/)(event-planning|party|parties|birthday|birthdays)\/(checklist|checklists|list|lists)\.md$/.test(
      normalized,
    ) ||
    /(^|\/)(chores?|errands?)\/(checklist|checklists|list|lists|routine|routines)\.md$/.test(normalized) ||
    hasAny(normalized, [
      '工具',
      '脚本',
      '模板',
      '提示词',
      '检查清单',
      '流程',
      '生日/清单',
      '活动筹备/清单',
      '家务/清单',
    ])
  )
    hints.push('reusable-tool');
  if (
    /(^|\/)(knowledge|wiki|source|sources|note|notes|map|maps|meeting|meetings|decision|decisions|adr|research|interviews?|feedback|datasets?|data|data-room|dataroom|metrics|kpis?|policies?|handbook|handbooks|hr|lessons?|learning|community)(\/|$)/.test(
      normalized,
    ) ||
    /(^|\/)(brand|brands|styleguide|styleguides)\/(guidelines?|standards?|visual|assets?|identity)\.md$/.test(
      normalized,
    ) ||
    /(^|\/)(tax|taxes)\/(documents?|records?|receipts?|sources?|info|archive)\.md$/.test(normalized) ||
    /(^|\/)(insurance|warranty|warranties)\/(policies?|receipts?|documents?|records?|cards?|coverage|index)\.md$/.test(
      normalized,
    ) ||
    /(^|\/)(memberships?|licenses?)\/(cards?|keys?|receipts?|documents?|records?|index)\.md$/.test(normalized) ||
    /(^|\/)(pets?)\/(vaccinations?|vaccines?|records?|documents?|notes?|history)\.md$/.test(normalized) ||
    /(^|\/)(vehicles?|cars?)\/(records?|documents?|receipts?|registration|insurance|manuals?)\.md$/.test(normalized) ||
    /(^|\/)(utilities|utility|mortgage|housing|lease|leases|rent)\/(accounts?|documents?|records?|receipts?|statements?|index)\.md$/.test(
      normalized,
    ) ||
    /(^|\/)(identity|identities|ids?|documents?|passports?)\/(passports?|ids?|documents?|records?|cards?|index)\.md$/.test(
      normalized,
    ) ||
    /(^|\/)visas?\/(documents?|records?|notes?|history|index)\.md$/.test(normalized) ||
    /(^|\/)appointments?\/(records?|notes?|history|index)\.md$/.test(normalized) ||
    /(^|\/)(banking|banks?|accounts?)\/(accounts?|statements?|records?|documents?|cards?|index)\.md$/.test(
      normalized,
    ) ||
    /(^|\/)(loans?|mortgages?)\/(documents?|records?|statements?|index)\.md$/.test(normalized) ||
    /(^|\/)(investments?|brokerage|portfolio|portfolios|retirement)\/(portfolio|holdings?|accounts?|statements?|records?|documents?|index)\.md$/.test(
      normalized,
    ) ||
    /(^|\/)(recipes?|cookbook|pantry|ingredients?)\/(favorites?|recipes?|inventory|stock|records?|index)\.md$/.test(
      normalized,
    ) ||
    /(^|\/)(orders?|deliveries|delivery|packages?|shipments?|returns?|receipts?)\/(history|policies?|receipts?|purchases?|records?|documents?|index)\.md$/.test(
      normalized,
    ) ||
    /(^|\/)(resumes?|cv|cvs|career|job-search|jobs?|portfolio|portfolios)\/(current|versions?|documents?|records?|notes?|index)\.md$/.test(
      normalized,
    ) ||
    /(^|\/)(doctors?|clinics?|caregiving|care|eldercare|prescriptions?|medications?)\/(records?|documents?|notes?|history|list|lists|index)\.md$/.test(
      normalized,
    ) ||
    /(^|\/)(legal|law|lawsuits?|court|courts?|lawyer|lawyers?|attorney|attorneys?|estate|estates?|wills?|testaments?)\/(documents?|records?|notes?|history|index)\.md$/.test(
      normalized,
    ) ||
    /(^|\/)(emergency|emergencies|disaster|disasters|evacuation|evacuations|household)\/(contacts?|inventory|routes?|records?|documents?|notes?|index)\.md$/.test(
      normalized,
    ) ||
    /(^|\/)(hobbies?|crafts?|garden|gardening|plants?|renovation|remodel|home-projects?|event-planning|party|parties)\/(ideas?|notes?|records?|plants?|inventory|guest-list|guests?|vendors?|documents?|measurements?|inspiration|index)\.md$/.test(
      normalized,
    ) ||
    /(^|\/)(reading|books?|photos?|albums?|family-history|family-memories?|memoir|memoirs|journals?)\/(books?|reading-list|library|albums?|index|records?|notes?|archive|timeline|history)\.md$/.test(
      normalized,
    ) ||
    /(^|\/)(gifts?|wishlist|wishlists|habits?|routines?|chores?|errands?)\/(ideas?|items?|notes?|records?|index|history|templates?)\.md$/.test(
      normalized,
    ) ||
    /(^|\/)(contacts?|relationships?|birthdays?|cards?|thank-you)\/(address-book|contacts?|people|notes?|records?|history|index)\.md$/.test(
      normalized,
    ) ||
    /(^|\/)(writing|creative-writing|music|language)\/(ideas?|notes?|references?|repertoire|vocabulary|words?|records?|history|index)\.md$/.test(
      normalized,
    ) ||
    /(^|\/)(inventory|stock|vendors?|suppliers?|procurement|purchase-orders?)\/(directory|contacts?|contracts?|stock-counts|counts?|inventory|catalog|records?|documents?|index)\.md$/.test(
      normalized,
    ) ||
    /(^|\/)(restaurant|restaurants|cafe|cafes|retail|store|stores)\/(menus?|menu|recipes?|vendors?|suppliers?|policies?|procedures?|records?|documents?|index)\.md$/.test(
      normalized,
    ) ||
    /(^|\/)volunteers?\/(onboarding|guide|guides|handbook|handbooks)\.md$/.test(normalized) ||
    /(^|\/)(health|medical|wellness|fitness)\/(notes?|records?|history|metrics|checkups?)\.md$/.test(normalized) ||
    /(^|\/)(hiring|recruiting)\/interviews?\.md$/.test(normalized) ||
    /(^|\/)docs\/(architecture|architectures|decision|decisions|design|designs)\.md$/.test(normalized) ||
    hasAny(normalized, [
      '知识',
      '知识库',
      '资料',
      '素材',
      '来源',
      '笔记',
      '调研',
      '访谈',
      '反馈',
      '发现',
      '研究',
      '数据集',
      '人事',
      '体检记录',
      '视觉规范',
      '品牌规范',
      '保单',
      '保修/凭证',
      '税务/资料',
      '会员/卡片',
      '许可证/密钥',
      '宠物/疫苗记录',
      '车辆/资料',
      '证件/护照',
      '证件/身份证',
      '预约/记录',
      '银行/账户',
      '投资/组合',
      '食谱/收藏',
      '食材/库存',
      '收据/购物记录',
      '简历/当前版本',
      '医生/记录',
      '法律/资料',
      '应急/联系人',
      '家庭/物品清单',
      '园艺/植物记录',
      '活动筹备/宾客名单',
      '阅读/书单',
      '照片/相册',
      '家族史/记录',
      '礼物/想法',
      '愿望清单/物品',
      '联系人/通讯录',
      '感谢/记录',
      '创作/灵感',
      '语言/词汇',
      '供应商/名录',
      '供应商/合同',
      '餐厅/菜单',
      '餐厅/菜谱',
    ])
  )
    hints.push('knowledge-system');
  if (
    /(^|\/)(agent|agents|agentic|workflow|workflows)(\/|\.md$)/.test(normalized) ||
    hasAny(normalized, ['智能体', '工作流'])
  )
    hints.push('agent-workflow');
  return hints;
}

function hasAny(value: string, needles: string[]): boolean {
  return needles.some((needle) => value.includes(needle));
}

export function parseWorkbenchSemanticMappingResponse(text: string): WorkbenchSemanticMappingResponse | null {
  const objects = parseModelJsonObjects(text);
  const latest = objects.at(-1);
  return latest ? parseWorkbenchSemanticMappingResult(latest) : null;
}

function parseWorkbenchSemanticMappingResult(parsed: unknown): WorkbenchSemanticMappingResponse | null {
  if (!isRecord(parsed)) return null;
  const result = isRecord(parsed.result) ? parsed.result : parsed;
  const confidence = normalizeConfidence(result.confidence);
  const reason = stringValue(result.reason);
  if (result.isWorkbenchRepository === false) {
    return { isWorkbenchRepository: false, confidence, reason };
  }
  if (result.isWorkbenchRepository !== true || !isRecord(result.mapping)) return null;
  const mapping = normalizeMapping(result.mapping, confidence, reason);
  if (!mapping) return null;
  return {
    isWorkbenchRepository: true,
    confidence,
    reason,
    mapping,
  };
}

export function sanitizeWorkbenchSemanticMapping(options: {
  mapping: WorkbenchSemanticMapping;
  tree: string[];
}): WorkbenchSemanticMapping | null {
  const validPaths = buildValidPathSet(options.tree);
  const slots = sanitizeSlots(options.mapping.slots, validPaths);
  if (Object.keys(slots).length === 0) return null;
  return {
    ...options.mapping,
    slots,
  };
}

function normalizeMapping(
  value: Record<string, unknown>,
  confidence?: SemanticConfidence,
  reason?: string,
): WorkbenchSemanticMapping | null {
  if (value.mappingSource !== 'agent' || !isRecord(value.slots)) return null;
  const slots = normalizeSlots(value.slots);
  if (Object.keys(slots).length === 0) return null;
  return {
    isWorkbenchRepository: true,
    confidence,
    reason,
    mappingSource: 'agent',
    slots,
  };
}

function normalizeSlots(value: Record<string, unknown>): WorkbenchSemanticSlots {
  const plans = isRecord(value.plans)
    ? {
        active: normalizeSlot(value.plans.active),
        completed: normalizeSlot(value.plans.completed),
      }
    : undefined;
  const slots: WorkbenchSemanticSlots = {
    inbox: normalizeSlot(value.inbox),
    current: normalizeSlot(value.current),
    next: normalizeSlot(value.next),
    done: normalizeSlot(value.done),
    projects: normalizeSlot(value.projects),
    plans: plans && (plans.active || plans.completed) ? plans : undefined,
    runs: normalizeSlot(value.runs),
    outputs: normalizeSlot(value.outputs),
    reviews: normalizeSlot(value.reviews),
    tools: normalizeSlot(value.tools),
    logs: normalizeSlot(value.logs),
  };
  return Object.fromEntries(Object.entries(slots).filter(([, slot]) => Boolean(slot))) as WorkbenchSemanticSlots;
}

function normalizeSlot(value: unknown): SemanticSlot | undefined {
  if (!isRecord(value) || !Array.isArray(value.paths)) return undefined;
  const paths = value.paths
    .filter((item): item is string => typeof item === 'string' && isSafeSemanticSlotPath(item))
    .slice(0, MAX_PATHS_PER_SLOT);
  if (paths.length === 0) return undefined;
  return {
    label: stringValue(value.label)?.slice(0, 80) || 'Workbench section',
    paths,
    kind: value.kind === 'document' || value.kind === 'directory' || value.kind === 'mixed' ? value.kind : 'mixed',
    confidence: normalizeConfidence(value.confidence) ?? 'medium',
    reason: stringValue(value.reason)?.slice(0, 240) || 'Agent semantic mapping.',
  };
}

function sanitizeSlots(slots: WorkbenchSemanticSlots, validPaths: Set<string>): WorkbenchSemanticSlots {
  const budget = { remaining: MAX_SEMANTIC_SLOT_PATHS };
  const sanitized: WorkbenchSemanticSlots = {
    inbox: sanitizeSlot(slots.inbox, validPaths, budget),
    current: sanitizeSlot(slots.current, validPaths, budget),
    next: sanitizeSlot(slots.next, validPaths, budget),
    done: sanitizeSlot(slots.done, validPaths, budget),
    projects: sanitizeSlot(slots.projects, validPaths, budget),
    plans: sanitizePlanSlots(slots.plans, validPaths, budget),
    runs: sanitizeSlot(slots.runs, validPaths, budget),
    outputs: sanitizeSlot(slots.outputs, validPaths, budget),
    reviews: sanitizeSlot(slots.reviews, validPaths, budget),
    tools: sanitizeSlot(slots.tools, validPaths, budget),
    logs: sanitizeSlot(slots.logs, validPaths, budget),
  };
  return Object.fromEntries(Object.entries(sanitized).filter(([, slot]) => Boolean(slot))) as WorkbenchSemanticSlots;
}

function sanitizePlanSlots(
  plans: WorkbenchSemanticSlots['plans'],
  validPaths: Set<string>,
  budget: { remaining: number },
): WorkbenchSemanticSlots['plans'] | undefined {
  if (!plans) return undefined;
  const sanitized = {
    active: sanitizeSlot(plans.active, validPaths, budget),
    completed: sanitizeSlot(plans.completed, validPaths, budget),
  };
  return sanitized.active || sanitized.completed ? sanitized : undefined;
}

function sanitizeSlot(
  slot: SemanticSlot | undefined,
  validPaths: Set<string>,
  budget: { remaining: number },
): SemanticSlot | undefined {
  if (!slot) return undefined;
  if (budget.remaining <= 0) return undefined;
  const paths = slot.paths
    .map((item) => ({ raw: item, normalized: normalizeTreePath(item) }))
    .filter((item) => isSafeSemanticSlotPath(item.raw) && validPaths.has(item.normalized))
    .map((item) => item.normalized)
    .slice(0, Math.min(MAX_PATHS_PER_SLOT, budget.remaining));
  if (paths.length === 0) return undefined;
  budget.remaining -= paths.length;
  return { ...slot, paths };
}

function buildValidPathSet(tree: string[]): Set<string> {
  const values = new Set<string>();
  for (const item of tree) {
    const normalized = normalizeTreePath(item);
    if (!isSafeSemanticSlotPath(normalized)) continue;
    values.add(normalized);
    addParentPaths(values, normalized);
  }
  return values;
}

function addParentPaths(values: Set<string>, path: string): void {
  const parts = path.split('/').filter(Boolean);
  for (let index = 1; index < parts.length; index += 1) {
    values.add(parts.slice(0, index).join('/'));
  }
}

function normalizeTreePath(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

export function isSafeSemanticSlotPath(value: string): boolean {
  const trimmed = value.trim();
  const normalized = trimmed.replace(/\/+$/, '');
  const segments = normalized.split('/');
  return (
    normalized.length > 0 &&
    trimmed === value &&
    normalized !== '.' &&
    !normalized.startsWith('/') &&
    !normalized.startsWith('./') &&
    !UNSAFE_PATH_PATTERN.test(normalized) &&
    !normalized.includes('..') &&
    !normalized.includes('\\') &&
    segments.every((segment) => segment.length > 0 && segment !== '.')
  );
}

function normalizeConfidence(value: unknown): SemanticConfidence | undefined {
  return value === 'low' || value === 'medium' || value === 'high' ? value : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
