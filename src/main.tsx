import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary, performCleanReload } from './components/ErrorBoundary.tsx';
import './index.css';

// Recover cleanly if a browser has stale cached HTML referencing old hashed asset filenames
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  void performCleanReload();
});

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
