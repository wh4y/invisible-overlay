import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Show immediate feedback
const rootElement = document.getElementById('root');
if (rootElement) {
  rootElement.innerHTML = '<div style="padding: 20px; color: white; background: rgba(0,0,0,0.8);">Loading React app...</div>';
}

console.log('[overlay-react] Starting React app...');
console.log('[overlay-react] Protocol:', window.location.protocol);
console.log('[overlay-react] Path:', window.location.pathname);

try {
  if (!rootElement) {
    console.error('[overlay-react] Root element not found!');
    document.body.innerHTML = '<div style="padding: 20px; color: red;">Error: Root element not found!</div>';
  } else {
    console.log('[overlay-react] Root element found, rendering app...');
    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    console.log('[overlay-react] React app rendered');
  }
} catch (error) {
  console.error('[overlay-react] Error rendering app:', error);
  if (rootElement) {
    rootElement.innerHTML = `<div style="padding: 20px; color: red; background: rgba(0,0,0,0.8);">
      <h2>Error Loading App</h2>
      <p>${error.message}</p>
      <pre style="font-size: 12px; overflow: auto;">${error.stack}</pre>
    </div>`;
  }
}

