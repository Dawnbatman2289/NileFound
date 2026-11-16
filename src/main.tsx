import '@fontsource/dm-sans/latin-400.css';
import '@fontsource/dm-sans/latin-500.css';
import '@fontsource/dm-sans/latin-700.css';
import '@fontsource/fraunces/latin-600.css';
import '@fontsource/fraunces/latin-700.css';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { installGlobalErrorHandlers, reportError } from './components/ErrorBoundary.tsx';
import './index.css';

installGlobalErrorHandlers();

createRoot(document.getElementById('root')!).render(<App />);

if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js', { updateViaCache: 'none' })
        .then((registration) => registration.update())
        .catch((err) => reportError('Service worker registration failed', err));
    });
  } else {
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
      .catch((err) => reportError('Service worker cleanup failed', err));
  }
}
