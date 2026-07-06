import { useState } from 'react';
import { Button, Toast, Typography } from '@douyinfe/semi-ui';
import { IconBolt, IconBranch, IconHome, IconTickCircle } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import WorkSystemWorkspaceChoice from '../components/WorkSystemWorkspaceChoice';
import type { RepositoryBinding } from '../lib/agentic-repository';
import { buildSkippedWorkspaceSessionState, WORK_SYSTEM_ONBOARDING_ANCHOR } from '../lib/work-system-onboarding';
import { createFirstWorkbenchMatter } from '../lib/workbench-first-matter';

const { Title, Text } = Typography;

export default function WorkspaceOnboardingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [firstMatterDraft, setFirstMatterDraft] = useState('');
  const [firstMatterCreating, setFirstMatterCreating] = useState(false);

  const handleCreateFirstMatter = async (binding: RepositoryBinding) => {
    const title = firstMatterDraft.trim();
    if (!title) {
      Toast.warning(t('dashboard.firstMatterRequired'));
      return;
    }

    setFirstMatterCreating(true);
    try {
      const matter = await createFirstWorkbenchMatter(binding, title);
      setFirstMatterDraft('');
      Toast.success(t('dashboard.firstMatterCreated'));
      navigate(`/workbench?view=tasks&workItemPath=${encodeURIComponent(matter.path)}`);
    } catch (err) {
      Toast.error(err instanceof Error ? err.message : t('dashboard.firstMatterCreateFailed'));
    } finally {
      setFirstMatterCreating(false);
    }
  };

  const handleSkipWorkspaceSetup = () => {
    Toast.info(t('dashboard.workspaceChoiceSkipToast'));
    navigate('/new-session', {
      state: buildSkippedWorkspaceSessionState(firstMatterDraft, t('dashboard.workspaceChoiceSkip')),
    });
  };

  return (
    <div className="dashboard-page" id={WORK_SYSTEM_ONBOARDING_ANCHOR}>
      <div className="dashboard-main">
        <div className="dashboard-title-row">
          <div>
            <Title heading={3} style={{ margin: 0 }}>
              {t('dashboard.onboardingTitle')}
            </Title>
            <Text type="tertiary">{t('dashboard.onboardingDesc')}</Text>
          </div>
          <Button icon={<IconHome />} theme="borderless" onClick={() => navigate('/')} />
        </div>

        <section className="dashboard-section">
          <div className="dashboard-onboarding-steps">
            <div className="dashboard-onboarding-step dashboard-onboarding-step-done">
              <span className="dashboard-onboarding-step-icon">
                <IconTickCircle />
              </span>
              <span>
                <Text strong>{t('dashboard.onboardingGatewayDone')}</Text>
                <Text type="tertiary" size="small">
                  {t('dashboard.onboardingGatewayDoneDesc')}
                </Text>
              </span>
            </div>
            <div className="dashboard-onboarding-step dashboard-onboarding-step-active">
              <span className="dashboard-onboarding-step-icon">
                <IconBranch />
              </span>
              <span>
                <Text strong>{t('dashboard.onboardingRepositoryNext')}</Text>
                <Text type="tertiary" size="small">
                  {t('dashboard.onboardingRepositoryNextDesc')}
                </Text>
              </span>
            </div>
            <div className="dashboard-onboarding-step">
              <span className="dashboard-onboarding-step-icon">
                <IconBolt />
              </span>
              <span>
                <Text strong>{t('dashboard.onboardingFirstThingNext')}</Text>
                <Text type="tertiary" size="small">
                  {t('dashboard.onboardingFirstThingNextDesc')}
                </Text>
              </span>
            </div>
          </div>
          <WorkSystemWorkspaceChoice
            firstMatterDraft={firstMatterDraft}
            firstMatterCreating={firstMatterCreating}
            onFirstMatterDraftChange={setFirstMatterDraft}
            onCreateFirstMatter={(binding) => {
              void handleCreateFirstMatter(binding);
            }}
            onSkipWorkspace={handleSkipWorkspaceSetup}
          />
        </section>
      </div>
    </div>
  );
}
