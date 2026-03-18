import React from 'react';
import { createRoot } from 'react-dom/client';
import { AppProvider } from './store/AppContext';
import App from './App';
import './styles/global.css';

// Default theme
document.body.className = 'dark';

const container = document.getElementById('root');
if (!container) throw new Error('Root element not found');

const root = createRoot(container);
root.render(
  <AppProvider>
    <App />
  </AppProvider>
);
