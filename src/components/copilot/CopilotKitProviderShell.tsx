import { useEffect } from 'react';
import type React from 'react';
import { CopilotKitProvider } from '@copilotkit/react-core/v2';
import '@copilotkit/react-core/v2/styles.css';

export function CopilotKitProviderShell({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Force dark mode on html element
    document.documentElement.classList.add('dark');
  }, []);

  return (
    <CopilotKitProvider
      runtimeUrl="/api/copilotkit"
      publicApiKey={import.meta.env.VITE_COPILOT_CLOUD_PUBLIC_API_KEY || undefined}
      openGenerativeUI={{}}
    >
      {children}
    </CopilotKitProvider>
  );
}
