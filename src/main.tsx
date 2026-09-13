import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {ErrorBoundary} from './components/ErrorBoundary';
import {AuthProvider} from './providers/AuthProvider';
import {installGestureAutoplayUnlock} from './lib/mediaPlayback';
import './index.css';

/*
  Global autoplay unlock.

  Browsers only permit unmuted — and sometimes even muted — autoplay after a
  real user gesture. Registering one page-level listener at boot means every
  reel surface benefits without each having to wire its own, and `safePlay`'s
  blocked-autoplay retries get a gesture to land on instead of never firing.
  It is idempotent and passive, so it costs nothing until the first input.
*/
installGestureAutoplayUnlock();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      {/* Nexora universal auth: single provider, single listener, single client. */}
      <AuthProvider>
        <App />
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
);
