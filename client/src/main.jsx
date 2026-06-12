import React from 'react';
import ReactDOM from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: '#1a1a3e',
          color: '#f1f5f9',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '10px',
        },
        success: { iconTheme: { primary: '#10b981', secondary: '#1a1a3e' } },
        error: { iconTheme: { primary: '#ef4444', secondary: '#1a1a3e' } },
      }}
    />
  </React.StrictMode>
);
