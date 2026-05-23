import { Typography } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';

const { Title, Text } = Typography;

export default function SearchPage() {
  const { t } = useTranslation();
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 8 }}>
      <Title heading={3}>{t('nav.search')}</Title>
      <Text type="tertiary">{t('page.searchDesc')}</Text>
    </div>
  );
}
