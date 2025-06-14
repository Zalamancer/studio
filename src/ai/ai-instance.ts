// src/ai/ai-instance.ts
// This module should NOT be marked with 'use server'; it exports an object instance.
// Individual AI flow files that USE this instance are marked 'use server'.

import { genkit as coreGenkitFunction } from '@genkit-ai/core';
import { googleAI } from '@genkit-ai/googleai';

console.log('[ai-instance.ts] Module loaded.');
console.log('[ai-instance.ts] Type of imported "coreGenkitFunction":', typeof coreGenkitFunction);

let aiInstance: any;

try {
  if (typeof coreGenkitFunction !== 'function') {
    const errorMsg = `[ai-instance.ts] FATAL: Imported 'genkit' (as coreGenkitFunction) from '@genkit-ai/core' is NOT a function! Received type: ${typeof coreGenkitFunction}. Genkit will not be initialized.`;
    console.error(errorMsg);
    // Fallback to a dummy instance to prevent hard crash if possible,
    // allowing other parts of the app to load and this error to be visible.
    aiInstance = {
      defineFlow: (config: any, fn: any) => { console.error("Genkit not initialized due to import error. DefineFlow called for:", config?.name); return () => Promise.resolve(null); },
      definePrompt: (config: any) => { console.error("Genkit not initialized due to import error. DefinePrompt called for:", config?.name); return () => Promise.resolve({ output: null }); },
      generate: (config: any) => { console.error("Genkit not initialized due to import error. Generate called."); return Promise.resolve({ output: null }); },
      // Add other Genkit methods if their absence causes immediate downstream errors
    };
    // Optionally, re-throw to make sure the build fails loudly if preferred
    // throw new TypeError(errorMsg); 
  } else {
    console.log('[ai-instance.ts] Initializing Genkit with googleAI plugin...');
    aiInstance = coreGenkitFunction({
      plugins: [
        googleAI(),
      ],
      // You can also set a default log level or other options here if needed
      // logLevel: 'debug', 
    });
    console.log('[ai-instance.ts] Genkit initialized successfully. Type of aiInstance:', typeof aiInstance);
  }
} catch (e: any) {
  console.error('[ai-instance.ts] Error during Genkit coreGenkitFunction() call:', e.message, e.stack);
  // Fallback to a dummy instance in case of runtime error during initialization
  aiInstance = {
    defineFlow: (config: any, fn: any) => { console.error("Genkit failed to initialize during core function call.", e); return () => Promise.resolve(null); },
    definePrompt: (config: any) => { console.error("Genkit failed to initialize during core function call.", e); return () => Promise.resolve({ output: null }); },
    generate: (config: any) => { console.error("Genkit failed to initialize during core function call.", e); return Promise.resolve({ output: null }); },
  };
}

export const ai = aiInstance;
