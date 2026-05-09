import { ReactFlowProvider } from '@xyflow/react';
import { CopilotChatConfigurationProvider, CopilotSidebar } from '@copilotkit/react-core/v2';
import { Canvas } from './components/canvas/Canvas';
import { CanvasCopilotBridge } from './components/copilot/CanvasCopilotBridge';
import { CopilotKitProviderShell } from './components/copilot/CopilotKitProviderShell';
import { usePersistence } from './hooks/usePersistence';
import { useWorkspaceStore } from './stores/workspaceStore';

function AppInner() {
  usePersistence();
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  return (
    <CopilotChatConfigurationProvider agentId="default" threadId={activeWorkspaceId ?? undefined}>
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
