
// Self-hosted fonts — eliminates Google Fonts external request
import '@fontsource/cormorant-garamond/300.css';
import '@fontsource/cormorant-garamond/400.css';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/300-italic.css';
import '@fontsource/cormorant-garamond/400-italic.css';
import '@fontsource/karla/300.css';
import '@fontsource/karla/400.css';
import '@fontsource/karla/500.css';
import '@fontsource/karla/600.css';
import '@fontsource/lora/400.css';
import '@fontsource/lora/500.css';
import '@fontsource/lora/600.css';
import '@fontsource/lora/400-italic.css';

import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ClerkProvider } from '@clerk/clerk-react';
import './src/index.css';
import App from './App';

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;

const statusEl = document.getElementById('loader-status');
if (statusEl) statusEl.innerText = "Loading Modules...";


interface ErrorBoundaryProps {
  children?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("React Error Boundary Caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px', fontFamily: 'monospace', color: '#7f1d1d', background: '#fef2f2', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <h1 style={{ fontSize: '24px', marginBottom: '20px' }}>System Error</h1>
          <p style={{marginBottom: '20px'}}>The application encountered an unexpected state. Please reload the page.</p>
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: '20px', padding: '10px 20px', background: '#262321', color: '#f5f4f0', border: 'none', cursor: 'pointer', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '2px' }}
          >
            Reload Interface
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const mountApp = () => {
    if (statusEl) statusEl.innerText = "Mounting Interface...";
    const rootElement = document.getElementById('root');

    if (!rootElement) {
        console.error("Fatal: No root element found.");
        return;
    }

    try {
        rootElement.innerHTML = '';

        const root = createRoot(rootElement);
        // Clerk is required only for /admin and /atlas/{claim,edit}. If the
        // publishable key is missing (local dev without env), render without
        // ClerkProvider so the public oracle/atlas pages still work. Admin
        // and steward routes will show "Clerk not configured" copy.
        const tree = CLERK_PUBLISHABLE_KEY ? (
            <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
                <BrowserRouter>
                    <App />
                </BrowserRouter>
            </ClerkProvider>
        ) : (
            <BrowserRouter>
                <App />
            </BrowserRouter>
        );
        root.render(<ErrorBoundary>{tree}</ErrorBoundary>);
    } catch (e) {
        console.error("Fatal: React failed to mount.", e);
        rootElement.innerHTML = `<div style="padding:40px; color:red; font-family:monospace;">Fatal: Failed to mount application.<br/><br/>${e}</div>`;
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountApp);
} else {
    mountApp();
}
