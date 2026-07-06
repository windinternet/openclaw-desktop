import { useRef } from 'react';
import type { ReactNode } from 'react';
import { Button, Input, Tag, Typography } from '@douyinfe/semi-ui';
import { IconFolderOpen, IconForward, IconPlusCircle, IconSearch } from '@douyinfe/semi-icons';
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
  const repositoryRef = useRef<HTMLDivElement | null>(null);

  const focusRepositorySetup = () => {
    repositoryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

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
          onAction={focusRepositorySetup}
        />
        <WorkspaceChoiceCard
          icon={<IconFolderOpen />}
          title={t('dashboard.workspaceChoiceBind')}
          description={t('dashboard.workspaceChoiceBindDesc')}
          actionLabel={t('dashboard.workspaceChoiceUseRepositoryGate')}
          onAction={focusRepositorySetup}
        />
        <WorkspaceChoiceCard
          icon={<IconSearch />}
          title={t('dashboard.workspaceChoiceMap')}
          description={t('dashboard.workspaceChoiceMapDesc')}
          actionLabel={t('dashboard.workspaceChoiceUseRepositoryGate')}
          onAction={focusRepositorySetup}
          tag={t('dashboard.workspaceChoiceProposal')}
        />
      </div>
      <div ref={repositoryRef} className="dashboard-onboarding-repository">
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
    </div>
  );
}

function WorkspaceChoiceCard({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  tag,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  tag?: string;
}) {
  return (
    <div className="dashboard-workspace-choice-card">
      <span className="dashboard-onboarding-step-icon">{icon}</span>
      <div className="dashboard-workspace-choice-body">
        <div className="dashboard-workspace-choice-title">
          <Text strong>{title}</Text>
          {tag ? (
            <Tag color="blue" size="small">
              {tag}
            </Tag>
          ) : null}
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
