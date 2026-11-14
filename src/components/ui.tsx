import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Home, Users, Activity as ActivityIcon, Settings as SettingsIcon, X } from 'lucide-react';
import { colorFor, initials } from '../lib/util';
import { useData } from '../lib/store';

/* ---------- back button stack (Android hardware back closes sheets first) ---------- */
const closers: (() => void)[] = [];
export const pushCloser = (fn: () => void) => {
  closers.push(fn);
  return () => {
    const i = closers.lastIndexOf(fn);
    if (i >= 0) closers.splice(i, 1);
  };
};
export const popCloser = (): boolean => {
  const fn = closers.pop();
  if (!fn) return false;
  fn();
  return true;
};

/* ---------- toast ---------- */
let toastSet: ((m: string | null) => void) | null = null;
let toastTimer: number | undefined;
export function toast(message: string) {
  toastSet?.(message);
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastSet?.(null), 2200);
}
export function ToastHost() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    toastSet = setMsg;
    return () => {
      toastSet = null;
    };
  }, []);
  return msg ? <div className="toast">{msg}</div> : null;
}

/* ---------- basics ---------- */
export function Avatar({ id, name, size }: { id: string; name: string; size?: 'sm' | 'lg' }) {
  return (
    <div className={`avatar ${size ?? ''}`} style={{ background: colorFor(id) }} aria-hidden>
      {initials(name)}
    </div>
  );
}

export function TopBar({
  title,
  back = true,
  right,
}: {
  title: ReactNode;
  back?: boolean;
  right?: ReactNode;
}) {
  const nav = useNavigate();
  return (
    <div className="topbar">
      {back && (
        <button className="icon-btn" onClick={() => nav(-1)} aria-label="Back">
          <ArrowLeft size={24} />
        </button>
      )}
      <h1 style={back ? undefined : { paddingLeft: 12 }}>{title}</h1>
      {right}
    </div>
  );
}

export function Empty({ emoji, title, children }: { emoji: string; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="big-emoji">{emoji}</div>
      <h3>{title}</h3>
      <div>{children}</div>
    </div>
  );
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => pushCloser(onClose), [onClose]);
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="grab" />
        <header>
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={22} />
          </button>
        </header>
        <div className="body">{children}</div>
      </div>
    </div>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button className={`switch ${on ? 'on' : ''}`} onClick={() => onChange(!on)} role="switch" aria-checked={on} aria-label={label} />
  );
}

export function CheckBox({ on }: { on: boolean }) {
  return <span className={`check ${on ? 'on' : ''}`}>{on && <Check size={16} strokeWidth={3} />}</span>;
}

export function ConfirmSheet({
  title,
  message,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet title={title} onClose={onClose}>
      <p className="muted" style={{ margin: '4px 20px 16px' }}>
        {message}
      </p>
      <div className="actions" style={{ marginBottom: 12 }}>
        <button className="btn ghost" onClick={onClose}>
          Cancel
        </button>
        <button
          className="btn"
          style={{ background: 'var(--danger)' }}
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </Sheet>
  );
}

/* ---------- bottom nav ---------- */
export function BottomNav() {
  const tabs = [
    { to: '/', label: 'Groups', icon: Home },
    { to: '/people', label: 'People', icon: Users },
    { to: '/activity', label: 'Activity', icon: ActivityIcon },
    { to: '/settings', label: 'Account', icon: SettingsIcon },
  ];
  return (
    <nav className="bottom-nav">
      {tabs.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} end className={({ isActive }) => (isActive ? 'active' : '')}>
          <Icon size={24} />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

/* ---------- people helpers ---------- */
export function usePeople() {
  const d = useData();
  const byId = new Map(d.people.map((p) => [p.id, p]));
  const meId = d.settings.meId;
  const name = (id: string) => (id === meId ? 'You' : byId.get(id)?.name ?? 'Unknown');
  const fullName = (id: string) => byId.get(id)?.name ?? 'Unknown';
  return { data: d, byId, meId, name, fullName };
}
