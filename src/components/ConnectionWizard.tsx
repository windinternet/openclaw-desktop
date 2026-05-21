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
        setDiscoverError('自动发现仅 Electron 环境可用');
        setDiscovering(false);
        setScannedOnce(true);
        return;
      }
      const results = await window.electronAPI.discover.scan();
      setDiscovered(results);
    } catch (err) {
      const message = err instanceof Error ? err.message : '扫描失败';
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
      Toast.warning('请填写网关地址和 Token');
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
      const message = err instanceof Error ? err.message : '测试失败';
      setTestResult({ success: false, error: message });
    } finally {
      setTesting(false);
    }
  };

  const doConnect = async (url: string, token: string, name?: string) => {
    console.log('[ConnectionWizard] doConnect called:', {
      url,
      hasToken: !!token,
      tokenLength: token.length,
      tokenPreview: token ? token.slice(0, 8) + '...' : '(empty)',
      name,
    });
    setConnecting(true);
    const instanceName = name ?? deriveName(url);
    try {
      const client = createGatewayClient({
        url,
        token,
        onStatusChange: (status) => {
          useStore.getState().setConnectionStatus(status);
        },
      });

      await client.connect();

      useStore.getState().addInstance({
        name: instanceName,
        gatewayUrl: url,
        token,
      });

      const state = useStore.getState();
      const instances = state.instances;
      const newInstance = instances[instances.length - 1];

      useStore.getState().setCurrentInstance(newInstance.id);

      onConnected(newInstance.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : '连接失败';
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
      Toast.warning('请填写网关地址和 Token');
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
          自动发现
        </Button>
        <Button
          theme={mode === 'manual' ? 'solid' : 'light'}
          type={mode === 'manual' ? 'primary' : 'tertiary'}
          onClick={() => setMode('manual')}
          size="small"
        >
          手动输入
        </Button>
      </Space>

      {mode === 'auto' && (
        <Card
          style={cardStyle}
          title={
            <Space>
              <IconSearch />
              <span>自动发现</span>
            </Space>
          }
        >
          {!isElectron && (
            <Empty
              title="仅 Electron 环境可用"
              description="自动发现功能需要在 Electron 桌面应用中运行。"
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
              <Text type="secondary">正在扫描本地实例…</Text>
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
                重新扫描
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
                发现 {discovered.length} 个本地实例
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
                    连接
                  </Button>
                </div>
              ))}
              <Button onClick={handleScan} size="small" style={{ alignSelf: 'center' }}>
                重新扫描
              </Button>
            </div>
          )}

          {!discovering && discovered.length === 0 && discoverError === null && isElectron && scannedOnce && (
            <Empty
              title="未发现 OpenClaw 实例"
              description={
                <Space vertical align="center">
                  <Text type="secondary">本机未安装 OpenClaw 或 Gateway 未启动。</Text>
                  <Space>
                    <Button
                      icon={<IconDownload />}
                      theme="solid"
                      type="primary"
                      loading={installing}
                      onClick={handleInstall}
                    >
                      安装 OpenClaw
                    </Button>
                    <Button size="small" onClick={handleScan}>
                      重新扫描
                    </Button>
                  </Space>
                  <Button size="small" theme="borderless" onClick={() => setMode('manual')}>
                    手动输入
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
              <span>手动连接</span>
            </Space>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <Text type="tertiary" size="small" style={{ display: 'block', marginBottom: 4 }}>
                网关地址
              </Text>
              <Input
                placeholder="例如 http://localhost:8080"
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
                Token / API Key
              </Text>
              <Input
                placeholder="输入 Token 或 API Key"
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
                测试连接
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
                        <Text style={{ color: 'var(--semi-color-success)' }}>连接成功</Text>
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
                        {testResult.error || '连接失败'}
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
                连接
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
