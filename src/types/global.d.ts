
// src/types/global.d.ts
export {}; // Ensures this file is treated as a module.

declare global {
  interface Window {
    grecaptcha?: { // For reCAPTCHA v2 and general use
      ready: (callback: () => void) => void;
      render: (
        container: string | HTMLElement,
        parameters: {
          sitekey: string;
          theme?: 'light' | 'dark';
          size?: 'normal' | 'compact' | 'invisible';
          callback?: (token: string) => void;
          'expired-callback'?: () => void;
          'error-callback'?: () => void;
        }
      ) => number; // Returns widget ID
      getResponse: (widgetId?: number) => string;
      reset: (widgetId?: number) => void;
      execute?: (siteKeyOrWidgetId?: string | number, options?: { action: string }) => Promise<string>; // For v3 or explicit v2 invisible
    } & { // For reCAPTCHA Enterprise specifically
      enterprise?: {
        ready: (callback: () => void) => void;
        render: (
          container: string | HTMLElement,
          parameters: {
            sitekey: string;
            theme?: 'light' | 'dark';
            size?: 'normal' | 'compact'; // Enterprise typically doesn't have 'invisible' size for checkbox
            action?: string; // Action name for Enterprise
            callback?: (token: string) => void;
            'expired-callback'?: () => void;
            'error-callback'?: () => void;
            // Add other Enterprise-specific parameters if needed
          }
        ) => number; // Returns widget ID
        getResponse: (widgetId?: number) => string;
        reset: (widgetId?: number) => void;
        execute: (siteKeyOrWidgetId: string | number, options: { action: string }) => Promise<string>;
      };
    };
    // Add other global window properties here if needed
  }
}
