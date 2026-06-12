export interface Capability {
  key: string;
  name: string;
  description: string;
  risk: 'low' | 'medium' | 'high';
}

export const CAPABILITIES: Capability[] = [
  { key: 'network.fetch', name: '网络请求', description: '向外部发送 HTTP 请求', risk: 'medium' },
  { key: 'file.read', name: '读取文件', description: '读取本地文件系统内容', risk: 'high' },
  { key: 'file.write', name: '写入文件', description: '向本地文件系统写入内容', risk: 'high' },
  { key: 'export', name: '导出产物', description: '保存/导出产物文件', risk: 'low' },
  { key: 'notification', name: '系统通知', description: '发送桌面系统通知', risk: 'low' },
  { key: 'shell.exec', name: '执行命令', description: '执行系统 Shell 命令', risk: 'high' },
  { key: 'clipboard.write', name: '写入剪贴板', description: '向系统剪贴板写入内容', risk: 'low' },
];

export function getCapability(key: string): Capability | undefined {
  return CAPABILITIES.find((c) => c.key === key);
}
