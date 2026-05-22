import { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Space,
  Typography,
  Tag,
  Spin,
  Empty,
  Divider,
  Toast,
  Input,
} from '@douyinfe/semi-ui';
import { IconSearch, IconLink, IconPlay, IconTickCircle, IconClose, IconDownload } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { useStore, createGatewayClient } from '../lib';
import type { DiscoveredInstance } from '../lib';

const { Text } = Typography;

interface ConnectionWizardProps {
  onConnected: (instanceId: string) => void;
}

interface TestResult {
  success: boolean;
  version?: string;
  error?: string;
}

function deriveName(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return url;
  }
}

export default function ConnectionWizard({ onConnected }: ConnectionWizardProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'auto' | 'manual'>('auto');
  const [discovering, setDiscovering] = useState(false);
  const [discovered, setDiscovered] = useState<DiscoveredInstance[]>([]);
  const [discoverError, setDiscoverError] = useState<string | null>(null);

  const [manualUrl, setManualUrl] = useState('');
  const [manualToken, setManualToken] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [scannedOnce, setScannedOnce] = useState(false);

  const isElectron = typeof window !== 'undefined' && 'electronAPI' in window;

  useEffect(() => {
    if (isElectron) {
      handleScan();
    } else {
      setScannedOnce(true);
    }
  }, []);

  const handleScan = async () => {
    setDiscovering(true);
    setDiscoverError(null);
    setDiscovered([]);

    try {
      if (!isElectron) {
        setDiscoverError(t('connection.electronOnly'));
        setDiscovering(false);
        setScannedOnce(true);
        return;
      }
      const results = await window.electronAPI.discover.scan();
      setDiscovered(results);
    } catch (err) {
      const message = err instanceof Error ? err.message : t('connection.scanFailed');
      setDiscoverError(message);
    } finally {
      setDiscovering(false);
      setScannedOnce(true);
    }
  };

  const handleInstall = async () => {
    if (!isElectron) return;
    setInstalling(true);
    try {
      await window.electronAPI.install.run();
    } catch (err) {
      const message = err instanceof Error ? err.message : '安装启动失败';
      Toast.error(message);
    } finally {
      setInstalling(false);
    }
  };

  const handleTest = async () => {
    if (!manualUrl.trim() || !manualToken.trim()) {
      Toast.warning(t('connection.pleaseFillFields'));
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const client = createGatewayClient({
        url: manualUrl.trim(),
        token: manualToken.trim(),
      });
      const result = await client.testConnection();
      setTestResult(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : t('connection.testFailed');
      setTestResult({ success: false, error: message });
    } finally {
      setTesting(false);
    }
  };

  const doConnect = async (url: string, token: string, name?: string) => {
    console.log('[ConnectionWizard] doConnect called:', { url, hasToken: !!token, name });
    setConnecting(true);
    const fallbackName = name ?? deriveName(url);
    try {
      const client = createGatewayClient({
        url,
        token,
        onStatusChange: (status) => {
          useStore.getState().setConnectionStatus(status);
        },
      });

      const hello = await client.connect();
      const serverVersion = hello.server?.version;
      const methods = hello.features?.methods ?? [];
      let instanceName = serverVersion ? `OpenClaw v${serverVersion}` : fallbackName;
      let assistantName: string | undefined;
      let avatarUrl: string | undefined;

      console.log('[ConnectionWizard] connected, methods:', methods);

      try {
        if (methods.includes('assistant.info') || methods.includes('assistant.get')) {
          const method = methods.includes('assistant.info') ? 'assistant.info' : 'assistant.get';
          const info = await client.request<Record<string, unknown>>(method);
          console.log('[ConnectionWizard] assistant info:', info);
          assistantName = typeof info?.displayName === 'string' ? info.displayName
            : typeof info?.name === 'string' ? info.name : undefined;
          avatarUrl = typeof info?.avatarUrl === 'string' ? info.avatarUrl
            : typeof info?.avatar === 'string' ? info.avatar : undefined;
        }
      } catch {
        console.log('[ConnectionWizard] assistant info not available');
      }

      try {
        if (methods.includes('server.info') || methods.includes('meta')) {
          const method = methods.includes('server.info') ? 'server.info' : 'meta';
          const info = await client.request<Record<string, unknown>>(method);
          console.log('[ConnectionWizard] server info:', info);
          const nodeName = typeof info?.name === 'string' ? info.name
            : typeof info?.hostname === 'string' ? info.hostname : undefined;
          if (nodeName) instanceName = nodeName;
        }
      } catch {
        console.log('[ConnectionWizard] server info not available');
      }

      useStore.getState().addInstance({
        name: instanceName,
        gatewayUrl: url,
        token,
        serverVersion,
        assistantName,
        avatarUrl,
      });

      client.disconnect();

      const instance = useStore.getState().instances.find((i) => i.gatewayUrl === url);
      if (instance) {
        useStore.getState().setCurrentInstance(instance.id);
        onConnected(instance.id);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : t('connection.connectFailed');
      Toast.error(message);
    } finally {
      setConnecting(false);
    }
  };

  const handleConnectDiscovered = async (instance: DiscoveredInstance) => {
    console.log('[ConnectionWizard] handleConnectDiscovered instance:', {
      url: instance.url,
      hasToken: !!instance.token,
      tokenPreview: instance.token ? instance.token.slice(0, 8) + '...' : '(empty)',
      name: instance.name,
      version: instance.version,
    });
    const token = instance.token || '';
    await doConnect(instance.url, token, instance.name || instance.version);
  };

  const handleManualConnect = async () => {
    if (!manualUrl.trim() || !manualToken.trim()) {
      Toast.warning(t('connection.pleaseFillFields'));
      return;
    }
    await doConnect(manualUrl.trim(), manualToken.trim());
  };

  const cardStyle = {
    width: '100%',
    maxWidth: 480,
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
        width: '100%',
      }}
    >
      <Space style={{ alignSelf: 'center' }}>
        <Button
          theme={mode === 'auto' ? 'solid' : 'light'}
          type={mode === 'auto' ? 'primary' : 'tertiary'}
          onClick={() => {
            setMode('auto');
            setTestResult(null);
          }}
          size="small"
        >
          {t('connection.autoDiscover')}
        </Button>
        <Button
          theme={mode === 'manual' ? 'solid' : 'light'}
          type={mode === 'manual' ? 'primary' : 'tertiary'}
          onClick={() => setMode('manual')}
          size="small"
        >
          {t('connection.manualInput')}
        </Button>
      </Space>

      {mode === 'auto' && (
        <Card
          style={cardStyle}
          title={
            <Space>
              <IconSearch />
              <span>{t('connection.autoTitle')}</span>
            </Space>
          }
        >
          {!isElectron && (
            <Empty
              title={t('connection.electronOnly')}
              description={t('connection.electronOnlyDesc')}
            />
          )}

          {isElectron && !discovering && discovered.length === 0 && !discoverError && !scannedOnce && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
              <Spin size="large" />
            </div>
          )}

          {discovering && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12,
                padding: '24px 0',
              }}
            >
              <Spin size="large" />
              <Text type="secondary">{t('connection.scanning')}</Text>
            </div>
          )}

          {discoverError && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12,
                padding: '12px 0',
              }}
            >
              <Tag color="red" size="large" style={{ width: '100%', textAlign: 'center' }}>
                {discoverError}
              </Tag>
              <Button onClick={handleScan} size="small">
                {t('connection.rescan')}
              </Button>
            </div>
          )}

          {!discovering && discovered.length > 0 && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <Text type="secondary" size="small">
                {t('connection.foundInstances', { count: discovered.length })}
              </Text>
              <Divider margin="8px" />
              {discovered.map((inst) => (
                <div
                  key={inst.url}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 6,
                    backgroundColor: 'var(--semi-color-fill-0)',
                    border: '1px solid var(--semi-color-border)',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Text strong>{inst.name || inst.host || inst.url}</Text>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      <Text type="tertiary" size="small">
                        {inst.url}
                      </Text>
                      {inst.version && (
                        <Tag size="small" color="blue">
                          v{inst.version}
                        </Tag>
                      )}
                      {inst.ip && (
                        <Tag size="small" color="indigo">
                          {inst.ip}
                        </Tag>
                      )}
                      {inst.token && (
                        <Tag size="small" color="green">
                          Token
                        </Tag>
                      )}
                    </div>
                  </div>
                  <Button
                    icon={<IconLink />}
                    size="small"
                    theme="solid"
                    type="primary"
                    loading={connecting}
                    onClick={() => handleConnectDiscovered(inst)}
                  >
                    {t('connection.connect')}
                  </Button>
                </div>
              ))}
              <Button onClick={handleScan} size="small" style={{ alignSelf: 'center' }}>
                {t('connection.rescan')}
              </Button>
            </div>
          )}

          {!discovering && discovered.length === 0 && discoverError === null && isElectron && scannedOnce && (
            <Empty
              title={t('connection.noInstances')}
              description={
                <Space vertical align="center">
                  <Text type="secondary">{t('connection.noInstancesDesc')}</Text>
                  <Space>
                    <Button
                      icon={<IconDownload />}
                      theme="solid"
                      type="primary"
                      loading={installing}
                      onClick={handleInstall}
                    >
                      {t('connection.installOpenClaw')}
                    </Button>
                    <Button size="small" onClick={handleScan}>
                      {t('connection.rescan')}
                    </Button>
                  </Space>
                  <Button size="small" theme="borderless" onClick={() => setMode('manual')}>
                    {t('connection.manualInputAlt')}
                  </Button>
                </Space>
              }
            />
          )}
        </Card>
      )}

      {mode === 'manual' && (
        <Card
          style={cardStyle}
          title={
            <Space>
              <IconPlay />
              <span>{t('connection.manualTitle')}</span>
            </Space>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <Text type="tertiary" size="small" style={{ display: 'block', marginBottom: 4 }}>
                {t('connection.gatewayUrl')}
              </Text>
              <Input
                placeholder={t('connection.gatewayUrlPlaceholder')}
                value={manualUrl}
                onChange={(v: string) => {
                  setManualUrl(v);
                  setTestResult(null);
                }}
                disabled={testing || connecting}
                showClear
              />
            </div>

            <div>
              <Text type="tertiary" size="small" style={{ display: 'block', marginBottom: 4 }}>
                {t('connection.tokenKey')}
              </Text>
              <Input
                placeholder={t('connection.tokenPlaceholder')}
                value={manualToken}
                onChange={(v: string) => {
                  setManualToken(v);
                  setTestResult(null);
                }}
                disabled={testing || connecting}
                mode="password"
                showClear
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
              <Button
                icon={<IconPlay />}
                theme="light"
                onClick={handleTest}
                loading={testing}
                disabled={!manualUrl.trim() || !manualToken.trim() || connecting}
                block
              >
                {t('connection.testConnection')}
              </Button>

              {testResult && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 12px',
                    borderRadius: 6,
                    backgroundColor: testResult.success
                      ? 'var(--semi-color-success-light-default)'
                      : 'var(--semi-color-danger-light-default)',
                  }}
                >
                  {testResult.success ? (
                    <>
                      <IconTickCircle style={{ color: 'var(--semi-color-success)' }} />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Text style={{ color: 'var(--semi-color-success)' }}>{t('connection.testSuccess')}</Text>
                        {testResult.version && (
                          <Tag size="small" color="green">
                            v{testResult.version}
                          </Tag>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <IconClose style={{ color: 'var(--semi-color-danger)' }} />
                      <Text style={{ color: 'var(--semi-color-danger)' }}>
                        {testResult.error || t('connection.testFailed')}
                      </Text>
                    </>
                  )}
                </div>
              )}

              <Divider margin="8px" />

              <Button
                icon={<IconLink />}
                theme="solid"
                type="primary"
                size="large"
                loading={connecting}
                disabled={!manualUrl.trim() || !manualToken.trim()}
                onClick={handleManualConnect}
                block
              >
                {t('connection.connect')}
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
