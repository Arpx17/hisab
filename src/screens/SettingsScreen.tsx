import { useRef, useState } from 'react';
import { Download, FileSpreadsheet, Upload, Trash2 } from 'lucide-react';
import { ConfirmSheet, TopBar, usePeople, toast } from '../components/ui';
import { CURRENCIES } from '../lib/money';
import { exportJSON, importJSON, renamePerson, resetAll, updateSettings } from '../lib/store';
import { shareFile } from '../lib/share';
import { expensesCSV } from '../lib/csv';
import { todayISO } from '../lib/util';

export default function SettingsScreen() {
  const { data, meId, fullName } = usePeople();
  const [name, setName] = useState(fullName(meId!));
  const [confirmReset, setConfirmReset] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const onImport = async (f?: File) => {
    if (!f) return;
    const ok = importJSON(await f.text());
    toast(ok ? 'Backup restored' : "That file isn't a valid Hisab backup");
    if (file.current) file.current.value = '';
  };

  return (
    <>
      <TopBar title="Account" back={false} />

      <div className="field" style={{ marginTop: 4 }}>
        <label htmlFor="mn">Your name</label>
        <div style={{ display: 'flex', gap: 10 }}>
          <input id="mn" className="input" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn" disabled={!name.trim() || name.trim() === fullName(meId!)} onClick={() => { renamePerson(meId!, name); toast('Name updated'); }}>Save</button>
        </div>
      </div>

      <div className="field">
        <label htmlFor="dc">Default currency</label>
        <select id="dc" className="select" value={data.settings.defaultCurrency} onChange={(e) => updateSettings({ defaultCurrency: e.target.value })}>
          {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} · {c.label}</option>)}
        </select>
      </div>

      <div className="field">
        <label>Theme</label>
        <div className="seg" style={{ margin: 0 }}>
          {(['system', 'light', 'dark'] as const).map((t) => (
            <button key={t} className={data.settings.theme === t ? 'on' : ''} onClick={() => updateSettings({ theme: t })}>{t[0].toUpperCase() + t.slice(1)}</button>
          ))}
        </div>
      </div>

      <div className="section-title">Your data</div>
      <div className="card">
        <button className="row" onClick={async () => toast((await shareFile(`hisab-backup-${todayISO()}.json`, exportJSON(), 'application/json')) ? 'Backup ready' : "Couldn't export")}>
          <div className="tile"><Download size={22} /></div>
          <div className="grow"><div className="title">Back up data</div><div className="sub">Save a JSON file to keep or move to a new phone</div></div>
        </button>
        <button className="row" onClick={() => file.current?.click()}>
          <div className="tile"><Upload size={22} /></div>
          <div className="grow"><div className="title">Restore from backup</div><div className="sub">Replaces everything currently on this phone</div></div>
        </button>
        <button className="row" onClick={async () => toast((await shareFile(`hisab-expenses-${todayISO()}.csv`, expensesCSV(data), 'text/csv')) ? 'Export ready' : "Couldn't export")}>
          <div className="tile"><FileSpreadsheet size={22} /></div>
          <div className="grow"><div className="title">Export expenses (CSV)</div><div className="sub">Open in Excel or Google Sheets</div></div>
        </button>
        <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => onImport(e.target.files?.[0])} />
      </div>

      <div className="actions" style={{ marginTop: 24 }}>
        <button className="btn danger" onClick={() => setConfirmReset(true)}><Trash2 size={18} /> Delete all data</button>
      </div>
      <p className="hint" style={{ textAlign: 'center', marginTop: 24 }}>Hisab v0.2 · all data stays on this device</p>

      {confirmReset && (
        <ConfirmSheet title="Delete everything?" message="All groups, people and expenses on this phone will be erased. Back up first if you may need them." confirmLabel="Delete all" onClose={() => setConfirmReset(false)}
          onConfirm={() => { resetAll(); toast('All data deleted'); }} />
      )}
    </>
  );
}
