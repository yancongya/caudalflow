import { useEffect } from 'react';
import type React from 'react';
import { CopilotKitProvider } from '@copilotkit/react-core/v2';
import '@copilotkit/react-core/v2/styles.css';

export function CopilotKitProviderShell({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Suppress CopilotKit runtime errors when BFF is not running
    const originalError = console.error;
    console.error = (...args: any[]) => {
      const message = args[0]?.toString?.() ?? '';
      if (message.includes('runtime_info_fetch_failed') || message.includes('502')) {
        return; // Suppress runtime connection errors
      }
      originalError.apply(console, args);
    };

    return () => {
      console.error = originalError;
    };
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
