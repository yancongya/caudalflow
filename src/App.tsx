import { StrictMode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactFlowProvider } from '@xyflow/react';
import { CopilotChatConfigurationProvider, CopilotSidebar } from '@copilotkit/react-core/v2';
import { Canvas } from './components/canvas/Canvas';
import { CanvasCopilotBridge } from './components/copilot/CanvasCopilotBridge';
import { CopilotKitProviderShell } from './components/copilot/CopilotKitProviderShell';
import { usePersistence } from './hooks/usePersistence';

function AppInner() {
  const { t } = useTranslation();
  usePersistence();
  // A fresh UUID per React mount (resets on page reload) prevents the "Message not found"
  // error that occurs when the LangGraph thread's in-memory message history diverges from
  // the CopilotKit frontend's in-memory message history after a page refresh.
  const [threadId] = useState(() => crypto.randomUUID());

  return (
    <CopilotChatConfigurationProvider agentId="default" threadId={threadId}>
      <StrictMode>
        <Canvas />
        <CanvasCopilotBridge />
      </StrictMode>
      <CopilotSidebar
        defaultOpen={false}
        width={420}
        input={{ disclaimer: () => null }}
        labels={{
          modalHeaderTitle: t('copilot.chat.modalHeaderTitle'),
          welcomeMessageText: t('copilot.chat.welcomeMessageText'),
          chatInputPlaceholder: t('copilot.chat.chatInputPlaceholder'),
          chatDisclaimerText: t('copilot.chat.chatDisclaimerText'),
          chatToggleOpenLabel: t('copilot.chat.chatToggleOpenLabel'),
          chatToggleCloseLabel: t('copilot.chat.chatToggleCloseLabel'),
          assistantMessageToolbarCopyMessageLabel: t('copilot.chat.assistantMessageToolbarCopyMessageLabel'),
          assistantMessageToolbarThumbsUpLabel: t('copilot.chat.assistantMessageToolbarThumbsUpLabel'),
          assistantMessageToolbarThumbsDownLabel: t('copilot.chat.assistantMessageToolbarThumbsDownLabel'),
          assistantMessageToolbarReadAloudLabel: t('copilot.chat.assistantMessageToolbarReadAloudLabel'),
          assistantMessageToolbarRegenerateLabel: t('copilot.chat.assistantMessageToolbarRegenerateLabel'),
          userMessageToolbarCopyMessageLabel: t('copilot.chat.userMessageToolbarCopyMessageLabel'),
          userMessageToolbarEditMessageLabel: t('copilot.chat.userMessageToolbarEditMessageLabel'),
        }}
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
