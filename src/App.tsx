import { useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { CopilotChatConfigurationProvider, CopilotSidebar } from '@copilotkit/react-core/v2';
import { Canvas } from './components/canvas/Canvas';
import { CanvasCopilotBridge } from './components/copilot/CanvasCopilotBridge';
import { CopilotKitProviderShell } from './components/copilot/CopilotKitProviderShell';
import { usePersistence } from './hooks/usePersistence';

function AppInner() {
  usePersistence();
  // A fresh UUID per React mount (resets on page reload) prevents the "Message not found"
  // error that occurs when the LangGraph thread's in-memory message history diverges from
  // the CopilotKit frontend's in-memory message history after a page refresh.
  const [threadId] = useState(() => crypto.randomUUID());

  return (
    <CopilotChatConfigurationProvider agentId="default" threadId={threadId}>
      <Canvas />
      <CanvasCopilotBridge />
      <CopilotSidebar
        defaultOpen={false}
        width={420}
        input={{ disclaimer: () => null }}
      />
    </CopilotChatConfigurationProvider>
  );
}

export default function App() {
  return (
    <CopilotKitProviderShell>
      <ReactFlowProvider>
        <AppInner />
      </ReactFlowProvider>
    </CopilotKitProviderShell>
  );
}
