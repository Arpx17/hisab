import { useEffect } from 'react';
import { HashRouter, Route, Routes, useLocation } from 'react-router-dom';
import { BottomNav, ToastHost } from './components/ui';
import { useData } from './lib/store';
import Onboarding from './screens/Onboarding';
import Home from './screens/Home';
import People from './screens/People';
import ActivityScreen from './screens/Activity';
import SettingsScreen from './screens/SettingsScreen';
import GroupForm from './screens/GroupForm';
import GroupDetail from './screens/GroupDetail';
import ExpenseForm from './screens/ExpenseForm';
import ExpenseDetail from './screens/ExpenseDetail';
import PersonDetail from './screens/PersonDetail';
import Settle from './screens/Settle';

const TABS = ['/', '/people', '/activity', '/settings'];

function Shell() {
  const loc = useLocation();
  const isTab = TABS.includes(loc.pathname);
  return (
    <div className="app">
      <div className={`screen ${isTab ? '' : 'no-nav'}`} key={loc.pathname}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/people" element={<People />} />
          <Route path="/activity" element={<ActivityScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="/group/new" element={<GroupForm />} />
          <Route path="/group/:id" element={<GroupDetail />} />
          <Route path="/group/:id/edit" element={<GroupForm />} />
          <Route path="/expense/new" element={<ExpenseForm />} />
          <Route path="/expense/:id" element={<ExpenseDetail />} />
          <Route path="/expense/:id/edit" element={<ExpenseForm />} />
          <Route path="/person/:id" element={<PersonDetail />} />
          <Route path="/settle" element={<Settle />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </div>
      {isTab && <BottomNav />}
      <ToastHost />
    </div>
  );
}

export default function App() {
  const data = useData();
  const theme = data.settings.theme;
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      root.dataset.theme = dark ? 'dark' : 'light';
      document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#0d1117' : '#f5f6f8');
    };
    apply();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);

  if (!data.settings.meId) return <div className="app"><div className="screen no-nav"><Onboarding /></div></div>;
  return (
    <HashRouter>
      <Shell />
    </HashRouter>
  );
}
