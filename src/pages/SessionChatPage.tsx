import { useParams } from 'react-router-dom';
import ChatView from '../components/ChatView';
import { useStore } from '../lib';

export default function SessionChatPage() {
  const { sessionKey } = useParams<{ sessionKey: string }>();
  const currentId = useStore((s) => s.currentInstanceId);

  if (!currentId || !sessionKey) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        No session selected
      </div>
    );
  }

  return <ChatView instanceId={currentId} sessionKey={sessionKey} />;
}
