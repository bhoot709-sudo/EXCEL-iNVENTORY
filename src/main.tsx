// Ensure window.fetch is writable and has setter across iframe sandboxes and browser environments
try {
  const _fetch = typeof window !== 'undefined' && window.fetch ? window.fetch.bind(window) : null;
  const defineWritableFetch = (target: any) => {
    if (!target) return;
    try {
      Object.defineProperty(target, 'fetch', {
        get() {
          return _fetch;
        },
        set(fn) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (target as any)._customFetch = fn;
        },
        configurable: true,
        enumerable: true,
      });
    } catch {
      // Ignore if non-configurable
    }
  };

  if (typeof window !== 'undefined') {
    defineWritableFetch(window);
    if (typeof Window !== 'undefined' && Window.prototype) {
      defineWritableFetch(Window.prototype);
    }
    if ((window as any).__proto__) {
      defineWritableFetch((window as any).__proto__);
    }
  }
  if (typeof globalThis !== 'undefined' && globalThis !== window) {
    defineWritableFetch(globalThis);
  }
} catch {
  // Fail-safe
}

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
