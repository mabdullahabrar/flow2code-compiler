/**
 * CRITICAL: Global Error Guard
 * This must be at the top to catch and hide the ResizeObserver error 
 * overlay before it interrupts the development experience.
 */
const hideResizeError = (e) => {
  if (e.message && e.message.includes('ResizeObserver loop completed')) {
    // This stops the error from propagating to the browser's UI
    e.stopImmediatePropagation();
    
    // Specifically target the Webpack/React error overlay to hide it
    const overlays = [
      'webpack-dev-server-client-overlay',
      'webpack-dev-server-client-overlay-div',
      'nextjs-portal'
    ];
    
    overlays.forEach(id => {
      const el = document.getElementById(id) || document.querySelector(id);
      if (el) el.style.display = 'none';
    });
  }
};

window.addEventListener('error', hideResizeError);

// Standard React Imports
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);