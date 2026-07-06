import { useState } from 'react';
import type { ReactNode } from 'react';
import { Button, Input, Typography } from '@douyinfe/semi-ui';
import { IconFolderOpen, IconForward, IconPlusCircle } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import type { RepositoryBinding } from '../lib/agentic-repository';
import RepositoryGate from './RepositoryGate';

const { Text } = Typography;

interface WorkspaceChoiceProps {
  firstMatterDraft: string;
  firstMatterCreating: boolean;
  onFirstMatterDraftChange: (value: string) => void;
  onCreateFirstMatter: (binding: RepositoryBinding) => void;
  onSkipWorkspace: () => void;
}

export default function WorkSystemWorkspaceChoice({
  firstMatterDraft,
  firstMatterCreating,
  onFirstMatterDraftChange,
  onCreateFirstMatter,
  onSkipWorkspace,
}: WorkspaceChoiceProps) {
  const { t } = useTranslation();
  const [activeChoice, setActiveChoice] = useState<'create' | 'existing' | null>(null);

  return (
    <div className="dashboard-workspace-choice">
      <div className="dashboard-workspace-choice-grid">
        <WorkspaceChoiceCard
          icon={<IconForward />}
          title={t('dashboard.workspaceChoiceSkip')}
          description={t('dashboard.workspaceChoiceSkipDesc')}
          actionLabel={t('dashboard.workspaceChoiceSkipAction')}
          onAction={onSkipWorkspace}
        />
        <WorkspaceChoiceCard
          icon={<IconPlusCircle />}
          title={t('dashboard.workspaceChoiceCreate')}
          description={t('dashboard.workspaceChoiceCreateDesc')}
          actionLabel={t('dashboard.workspaceChoiceUseRepositoryGate')}
          selected={activeChoice === 'create'}
          onAction={() => setActiveChoice('create')}
        />
        <WorkspaceChoiceCard
          icon={<IconFolderOpen />}
          title={t('dashboard.workspaceChoiceBind')}
          description={t('dashboard.workspaceChoiceBindDesc')}
          actionLabel={t('dashboard.workspaceChoiceUseRepositoryGate')}
          selected={activeChoice === 'existing'}
          onAction={() => setActiveChoice('existing')}
        />
      </div>
      {activeChoice ? (
        <div className="dashboard-onboarding-repository">
          <RepositoryGate area="workbench">
            {(binding) => (
              <div className="dashboard-onboarding-ready">
                <div>
                  <Text strong>{t('dashboard.onboardingRepositoryReady')}</Text>
                  <Text type="tertiary" size="small">
                    {t('dashboard.onboardingRepositoryReadyDesc')}
                  </Text>
                </div>
                <div className="dashboard-first-matter-form">
                  <Input
                    value={firstMatterDraft}
                    placeholder={t('dashboard.firstMatterPlaceholder')}
                    onChange={onFirstMatterDraftChange}
                    onEnterPress={() => onCreateFirstMatter(binding)}
                    disabled={firstMatterCreating}
                  />
                  <Button
                    theme="solid"
                    type="primary"
                    loading={firstMatterCreating}
                    disabled={!firstMatterDraft.trim()}
                    onClick={() => onCreateFirstMatter(binding)}
                  >
                    {t('dashboard.createFirstMatter')}
                  </Button>
                </div>
              </div>
            )}
          </RepositoryGate>
        </div>
      ) : null}
    </div>
  );
}

function WorkspaceChoiceCard({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  selected,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  selected?: boolean;
}) {
  return (
    <div
      className={`dashboard-workspace-choice-card${selected ? ' dashboard-workspace-choice-card-active' : ''}`}
      role="button"
      tabIndex={0}
      onClick={onAction}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onAction();
        }
      }}
    >
      <span className="dashboard-onboarding-step-icon">{icon}</span>
      <div className="dashboard-workspace-choice-body">
        <div className="dashboard-workspace-choice-title">
          <Text strong>{title}</Text>
        </div>
        <Text type="tertiary" size="small">
          {description}
        </Text>
        <Button size="small" theme="borderless" onClick={onAction}>
          {actionLabel}
        </Button>
      </div>
    </div>
  );
}
