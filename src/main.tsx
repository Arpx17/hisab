import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import App from './App';
import { popCloser } from './components/ui';
import './styles.css';

const TABS = ['', '#/', '#/people', '#/activity', '#/settings'];

if (Capacitor.isNativePlatform()) {
  // Hardware back: close an open sheet first, then go back, and exit from a top-level tab.
  CapApp.addListener('backButton', () => {
    if (popCloser()) return;
    if (TABS.includes(window.location.hash)) CapApp.exitApp();
    else window.history.back();
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
