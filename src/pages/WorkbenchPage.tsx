import { Typography } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import RepositoryGate from '../components/RepositoryGate';
import WorkbenchRepositoryPanel from '../components/WorkbenchRepositoryPanel';

const { Title, Text } = Typography;

export default function WorkbenchPage() {
  const { t } = useTranslation();

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 24 }}>
      <Title heading={3} style={{ marginTop: 0 }}>{t('nav.workbench')}</Title>
      <Text type="tertiary">{t('workbench.pageDesc')}</Text>
      <RepositoryGate area="workbench">
        {(binding) => <WorkbenchRepositoryPanel binding={binding} />}
      </RepositoryGate>
    </div>
  );
}
