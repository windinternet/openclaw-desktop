import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { createDefaultRepositoryBinding } from '../lib/agentic-repository';
import {
  archiveSkippedWorkspaceSessionSource,
  buildSkippedWorkspaceSessionSourceArchive,
  buildSkippedWorkspaceMatterCarryover,
  buildSkippedWorkspaceSessionMessage,
  buildSkippedWorkspaceSessionState,
  getWorkSystemOnboardingSessionState,
  isWorkSystemOnboardingSearch,
  loadSkippedWorkspaceSessionArchiveMessages,
  WORK_SYSTEM_ONBOARDING_ANCHOR,
  WORK_SYSTEM_ONBOARDING_ROUTE,
  WORK_SYSTEM_ONBOARDING_STATE_SOURCE,
} from '../lib/work-system-onboarding';

describe('work system onboarding route', () => {
  it('uses a stable setup route for connection-success workspace onboarding', () => {
    expect(WORK_SYSTEM_ONBOARDING_ROUTE).toBe('/setup?step=workspace');
    expect(WORK_SYSTEM_ONBOARDING_ANCHOR).toBe('work-system-onboarding');
    expect(isWorkSystemOnboardingSearch('?onboarding=work-system')).toBe(true);
    expect(isWorkSystemOnboardingSearch('?foo=bar&onboarding=work-system')).toBe(true);
    expect(isWorkSystemOnboardingSearch('?onboarding=dashboard')).toBe(false);
    expect(isWorkSystemOnboardingSearch('')).toBe(false);
  });

  it('connects Welcome and Setup routing to the setup workspace step', () => {
    const app = readFileSync('src/App.tsx', 'utf8');
    const welcome = readFileSync('src/pages/WelcomePage.tsx', 'utf8');
    const setup = readFileSync('src/pages/SetupPage.tsx', 'utf8');
    const dashboard = readFileSync('src/pages/DashboardPage.tsx', 'utf8');

    expect(app).not.toContain("import WorkspaceOnboardingPage from './pages/WorkspaceOnboardingPage'");
    expect(app).not.toContain('path="/onboarding/workspace"');
    expect(app).not.toContain('<WorkspaceOnboardingPage />');
    expect(app).not.toContain("import { isWorkSystemOnboardingSearch } from './lib/work-system-onboarding'");
    expect(app).not.toContain('isWorkSystemOnboardingSearch(location.search)');
    expect(welcome).toContain("import { WORK_SYSTEM_ONBOARDING_ROUTE } from '../lib/work-system-onboarding'");
    expect(welcome).toContain('navigate(WORK_SYSTEM_ONBOARDING_ROUTE');
    expect(setup).toContain('WORK_SYSTEM_ONBOARDING_ROUTE');
    expect(setup).toContain('step=workspace');
    expect(setup).toContain("<Steps.Step title={t('wizard.stepWorkspace')} />");
    expect(setup).toContain('setCurrentStep(3)');
    expect(setup).toContain('WORK_SYSTEM_ONBOARDING_ANCHOR');
    expect(setup).toContain('id={WORK_SYSTEM_ONBOARDING_ANCHOR}');
    expect(setup).toContain('<WorkSystemWorkspaceChoice');
    expect(dashboard).not.toContain('isWorkSystemOnboardingSearch');
    expect(dashboard).not.toContain('onboardingRequested');
  });

  it('creates a first matter and opens Workbench after the work repository is ready', () => {
    const setup = readFileSync('src/pages/SetupPage.tsx', 'utf8');
    const workspaceChoice = readFileSync('src/components/WorkSystemWorkspaceChoice.tsx', 'utf8');

    expect(setup).toContain('createFirstWorkbenchMatter');
    expect(setup).toContain('firstMatterDraft');
    expect(workspaceChoice).toContain('dashboard.firstMatterPlaceholder');
    expect(setup).toContain('`/workbench?view=tasks&workItemPath=${encodeURIComponent(matter.path)}`');
  });

  it('opens the newly created first matter in Workbench tasks preview', () => {
    const setup = readFileSync('src/pages/SetupPage.tsx', 'utf8');
    const workbench = readFileSync('src/pages/WorkbenchPage.tsx', 'utf8');
    const panel = readFileSync('src/components/WorkbenchRepositoryPanel.tsx', 'utf8');

    expect(setup).toContain('const matter = await createFirstWorkbenchMatter');
    expect(setup).toContain('encodeURIComponent(matter.path)');
    expect(setup).toContain('`/workbench?view=tasks&workItemPath=${encodeURIComponent(matter.path)}`');
    expect(workbench).toContain('getWorkbenchSearchWorkItemPath');
    expect(workbench).toContain('initialWorkItemPath={searchWorkItemPath}');
    expect(panel).toContain('initialWorkItemPath');
    expect(panel).toContain('openedInitialWorkItemPath');
    expect(panel).toContain('setSelectedPreviewPath(initialWorkItemPath)');
    expect(panel).toContain('selectedPreviewContent.trim()');
    expect(panel).toContain('selectedPreviewPath === initialWorkItemPath && selectedPreviewContent.trim()');
  });

  it('opens an approved matter plan in Workbench plans preview even when preview path was set first', () => {
    const workbench = readFileSync('src/pages/WorkbenchPage.tsx', 'utf8');
    const panel = readFileSync('src/components/WorkbenchRepositoryPanel.tsx', 'utf8');

    expect(workbench).toContain('getWorkbenchSearchPlanPath');
    expect(workbench).toContain('initialPlanPath={searchPlanPath}');
    expect(panel).toContain('initialPlanPath');
    expect(panel).toContain('openedInitialPlanPath');
    expect(panel).toContain('setSelectedPreviewPath(initialPlanPath)');
    expect(panel).toContain('selectedPreviewPath === initialPlanPath && selectedPreviewContent.trim()');
  });

  it('presents workspace choice instead of forcing local repository creation during onboarding', () => {
    const dashboard = readFileSync('src/pages/DashboardPage.tsx', 'utf8');
    const setup = readFileSync('src/pages/SetupPage.tsx', 'utf8');
    const workspaceChoice = readFileSync('src/components/WorkSystemWorkspaceChoice.tsx', 'utf8');
    const zh = JSON.parse(readFileSync('src/locales/zh.json', 'utf8'));
    const en = JSON.parse(readFileSync('src/locales/en.json', 'utf8'));

    expect(setup).toContain("import WorkSystemWorkspaceChoice from '../components/WorkSystemWorkspaceChoice'");
    expect(setup).toContain('<WorkSystemWorkspaceChoice');
    expect(setup).toContain("t('dashboard.onboardingTitle')");
    expect(setup).not.toContain("t('dashboard.onboardingGatewayDone')");
    expect(setup).not.toContain("t('dashboard.onboardingRepositoryNext')");
    expect(setup).not.toContain("t('dashboard.onboardingFirstThingNext')");
    expect(setup).not.toContain('dashboard-onboarding-steps');
    expect(dashboard).not.toContain("import WorkSystemWorkspaceChoice from '../components/WorkSystemWorkspaceChoice'");
    expect(dashboard).not.toContain('<WorkSystemWorkspaceChoice');
    expect(dashboard).not.toContain('<RepositoryGate area="workbench"');
    expect(zh.dashboard.onboardingRepositoryNext).toBe('选择工作空间');
    expect(en.dashboard.onboardingRepositoryNext).toBe('Choose workspace');
    expect(workspaceChoice).toContain("t('dashboard.workspaceChoiceSkip')");
    expect(workspaceChoice).toContain("t('dashboard.workspaceChoiceCreate')");
    expect(workspaceChoice).toContain("t('dashboard.workspaceChoiceBind')");
    expect(workspaceChoice).not.toContain("t('dashboard.workspaceChoiceMap')");
    expect(workspaceChoice).not.toContain("t('dashboard.workspaceChoiceProposal')");
    expect(workspaceChoice).toContain("type WorkspaceChoice = 'create' | 'existing'");
    expect(workspaceChoice).toContain('useState<WorkspaceChoice | null>(null)');
    expect(workspaceChoice).not.toContain('<RepositoryGate area="workbench"');
    expect(workspaceChoice).toContain('workspaceHostTarget');
    expect(workspaceChoice).toContain('bootstrapRepositoryBinding');
    expect(workspaceChoice).toContain('inspectRepositoryBinding');
    expect(workspaceChoice).toContain('handleSemanticWorkbenchMapping');
    expect(zh.dashboard.workspaceChoiceCreate).toBe('新建工作仓库');
    expect(zh.dashboard.workspaceChoiceCreateAction).toBe('选择仓库保存位置');
    expect(zh.dashboard.workspaceChoiceBindAction).toBe('选择已有仓库');
    expect(en.dashboard.workspaceChoiceCreateAction).toBe('Choose save location');
    expect(en.dashboard.workspaceChoiceBindAction).toBe('Choose existing repository');
  });

  it('carries skipped workspace onboarding into a lightweight new-session context', () => {
    const setup = readFileSync('src/pages/SetupPage.tsx', 'utf8');
    const newSession = readFileSync('src/pages/NewSessionPage.tsx', 'utf8');

    expect(buildSkippedWorkspaceSessionMessage('整理家庭账单')).toContain('整理家庭账单');
    expect(buildSkippedWorkspaceSessionMessage('整理家庭账单')).toContain('临时事项');
    expect(buildSkippedWorkspaceSessionMessage('   ')).toContain('轻量方式');
    expect(buildSkippedWorkspaceSessionMessage('   ')).toContain('绑定或创建工作空间');
    expect(buildSkippedWorkspaceSessionState('整理家庭账单', '继续体验')).toMatchObject({
      source: WORK_SYSTEM_ONBOARDING_STATE_SOURCE,
      starterLabel: '继续体验',
      firstThingTitle: '整理家庭账单',
    });
    expect(
      getWorkSystemOnboardingSessionState(buildSkippedWorkspaceSessionState('整理家庭账单', '继续体验')),
    ).toMatchObject({
      firstThingTitle: '整理家庭账单',
      starterLabel: '继续体验',
    });
    expect(setup).toContain('buildSkippedWorkspaceSessionState(firstMatterDraft');
    expect(setup).toContain("navigate('/new-session', {");
    expect(newSession).toContain('useLocation');
    expect(newSession).toContain('getWorkSystemOnboardingSessionState(location.state)');
    expect(newSession).toContain('useState(onboardingSessionState.initialMessage)');
    expect(newSession).toContain('useState(onboardingSessionState.starterLabel)');
  });

  it('lets a skipped temporary matter be preserved after a workspace becomes ready', () => {
    const newSession = readFileSync('src/pages/NewSessionPage.tsx', 'utf8');
    const sessionChat = readFileSync('src/pages/SessionChatPage.tsx', 'utf8');
    const zh = JSON.parse(readFileSync('src/locales/zh.json', 'utf8'));
    const en = JSON.parse(readFileSync('src/locales/en.json', 'utf8'));

    expect(newSession).toContain('onboardingSessionState.firstThingTitle');
    expect(newSession).toContain(
      'createFirstWorkbenchMatter(repositoryBinding, onboardingSessionState.firstThingTitle',
    );
    expect(newSession).toContain('buildSkippedWorkspaceMatterCarryover(onboardingSessionState)');
    expect(newSession).toContain('onboardingSessionState={onboardingSessionState}');
    expect(sessionChat).toContain('getWorkSystemOnboardingSessionState');
    expect(sessionChat).toContain('buildSkippedWorkspaceMatterCarryover(chatOnboardingSessionState, archiveMessages)');
    expect(sessionChat).toContain('const archive = await archiveSkippedWorkspaceSessionSource');
    expect(sessionChat).toContain('const archiveMessages = await loadSkippedWorkspaceSessionArchiveMessages');
    expect(sessionChat).toContain('activeClient');
    expect(sessionChat).toContain('archiveMessages');
    expect(sessionChat).toContain('repositoryBinding');
    expect(sessionChat).toContain('chatOnboardingSessionState');
    expect(sessionChat).toContain('linkedSources: [archive]');
    expect(sessionChat).toContain(
      'createFirstWorkbenchMatter(repositoryBinding, chatOnboardingSessionState.firstThingTitle',
    );
    expect(newSession).toContain("source: 'desktop-onboarding-skip'");
    expect(newSession).toContain('dashboard.temporaryMatterTitle');
    expect(newSession).toContain('dashboard.preserveTemporaryMatter');
    expect(newSession).toContain('WORK_SYSTEM_ONBOARDING_ROUTE');
    expect(zh.dashboard.temporaryMatterTitle).toBeTruthy();
    expect(zh.dashboard.preserveTemporaryMatter).toBeTruthy();
    expect(en.dashboard.temporaryMatterTitle).toBeTruthy();
    expect(en.dashboard.preserveTemporaryMatter).toBeTruthy();
  });

  it('extracts explicit temporary session output, knowledge, and review clues for preservation', () => {
    const state = buildSkippedWorkspaceSessionState('整理家庭账单', '继续体验');
    const carryover = buildSkippedWorkspaceMatterCarryover(state, [
      {
        role: 'assistant',
        content: ['## 成果', '- 输出：家庭预算表草案', '## 知识', '- 知识：水电账单通常每月 15 日前确认。'].join('\n'),
      },
      {
        role: 'assistant',
        content: [{ type: 'text', text: '复盘：本次先确认账单来源，风险：缺少物业票据。' }],
      },
      {
        role: 'assistant',
        content: '<artifact>{"title":"家庭账单预算表","type":"spreadsheet"}</artifact>',
      },
    ]);

    expect(carryover.note).toContain('临时会话明示线索');
    expect(carryover.checklist).toContain('沉淀成果线索：输出：家庭预算表草案');
    expect(carryover.checklist).toContain('沉淀成果线索：Artifact 候选：家庭账单预算表');
    expect(carryover.checklist).toContain('更新知识线索：知识：水电账单通常每月 15 日前确认。');
    expect(carryover.checklist).toContain('写入复盘线索：复盘：本次先确认账单来源，风险：缺少物业票据。');
  });

  it('archives the visible skipped workspace session as an imported source', async () => {
    const state = buildSkippedWorkspaceSessionState('整理家庭账单', '继续体验');
    const now = new Date('2026-06-28T02:10:24.000Z');
    const archive = buildSkippedWorkspaceSessionSourceArchive(
      state,
      [{ role: 'assistant', content: '成果：预算表草案' }],
      {
        now,
        sourceRoot: 'sources',
        sessionKey: 'agent:main:dashboard:abc',
      },
    );

    expect(archive.title).toBe('临时会话：整理家庭账单');
    expect(archive.path).toBe('sources/imported/2026-06-28-021024-temporary-session.md');
    expect(archive.markdown).toContain('source: desktop-onboarding-session');
    expect(archive.markdown).toContain('temporaryMatterTitle: "整理家庭账单"');
    expect(archive.markdown).toContain('sessionKey: "agent:main:dashboard:abc"');
    expect(archive.markdown).toContain('## 初始请求');
    expect(archive.markdown).toContain('## 会话摘录');
    expect(archive.markdown).toContain('成果：预算表草案');

    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal('window', {
      electronAPI: {
        repository: { writeText },
      },
    });

    const written = await archiveSkippedWorkspaceSessionSource(
      {
        ...createDefaultRepositoryBinding({ gatewayInstanceId: 'instance-1', repoPath: '/repo' }),
        status: 'repo_ready',
      },
      state,
      [{ role: 'assistant', content: '成果：预算表草案' }],
      { now, sessionKey: 'agent:main:dashboard:abc' },
    );

    expect(written.path).toBe(archive.path);
    expect(writeText).toHaveBeenCalledWith('/repo', archive.path, archive.markdown);
  });

  it('prefers full Gateway session history for skipped workspace archives', async () => {
    const request = vi.fn(async () => ({
      messages: [
        { role: 'user', content: '第一条完整消息' },
        { role: 'assistant', text: '成果：完整历史里的预算表' },
      ],
    }));
    const fallback = [{ role: 'assistant', content: '成果：当前可见消息' }];

    const messages = await loadSkippedWorkspaceSessionArchiveMessages(
      { request },
      'agent:main:dashboard:abc',
      fallback,
    );

    expect(request).toHaveBeenCalledWith('sessions.get', { key: 'agent:main:dashboard:abc' });
    expect(messages).toEqual([
      { role: 'user', content: { role: 'user', content: '第一条完整消息' } },
      { role: 'assistant', content: { role: 'assistant', text: '成果：完整历史里的预算表' } },
    ]);
  });

  it('falls back to visible messages when Gateway session history is unavailable', async () => {
    const request = vi.fn(async () => {
      throw new Error('offline');
    });
    const fallback = [{ role: 'assistant', content: '成果：当前可见消息' }];

    await expect(
      loadSkippedWorkspaceSessionArchiveMessages({ request }, 'agent:main:dashboard:abc', fallback),
    ).resolves.toBe(fallback);
  });
});
