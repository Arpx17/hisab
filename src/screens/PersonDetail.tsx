import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MoreVertical, Plus, HandCoins } from 'lucide-react';
import { Avatar, ConfirmSheet, Empty, Sheet, TopBar, usePeople, toast } from '../components/ui';
import { Balance } from '../components/money';
import { ExpenseRow } from '../components/rows';
import { allScopes, pairBalance } from '../lib/summary';
import { deletePerson, personInUse, renamePerson } from '../lib/store';
import { monthLabel } from '../lib/util';

export default function PersonDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { data, meId } = usePeople();
  const person = data.people.find((p) => p.id === id);
  const [menu, setMenu] = useState(false);
  const [newName, setNewName] = useState(person?.name ?? '');
  const [confirmDel, setConfirmDel] = useState(false);
  if (!person || !meId) return (<><TopBar title="Person" /><Empty emoji="🤷" title="Not found" /></>);

  const shared = data.expenses
    .filter((e) => [...e.payers, ...e.owed].some((p) => p.personId === person.id) && [...e.payers, ...e.owed].some((p) => p.personId === meId))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);

  // balances come from the same debts the group screens show
  const cur = new Map<string, number>();
  const buckets: { label: string; cur: string; v: number }[] = [];
  for (const sc of allScopes(data)) {
    const v = pairBalance(sc.transfers, meId, person.id);
    const hasShared = shared.some((e) => e.groupId === sc.groupId && e.currency === sc.currency);
    if (!hasShared && v === 0) continue;
    buckets.push({ label: sc.groupId ? data.groups.find((g) => g.id === sc.groupId)?.name ?? 'Group' : 'Non-group expenses', cur: sc.currency, v });
    if (v !== 0) cur.set(sc.currency, (cur.get(sc.currency) ?? 0) + v);
  }

  const months: { label: string; items: typeof shared }[] = [];
  for (const e of shared) {
    const label = monthLabel(e.date);
    const last = months[months.length - 1];
    if (last && last.label === label) last.items.push(e);
    else months.push({ label, items: [e] });
  }

  const settle = () => nav(`/settle?person=${person.id}`);

  return (
    <>
      <TopBar title={person.name} right={<button className="icon-btn" onClick={() => setMenu(true)} aria-label="More"><MoreVertical size={22} /></button>} />
      <div style={{ textAlign: 'center', padding: '4px 16px 0' }}>
        <div style={{ display: 'inline-block' }}><Avatar id={person.id} name={person.name} size="lg" /></div>
        <div style={{ marginTop: 10, fontWeight: 700, fontSize: 18 }}>
          {cur.size === 0 ? <span className="muted">You are settled up</span> : [...cur].map(([c, v]) => (
            <div key={c}>
              <span className="muted" style={{ fontWeight: 500, fontSize: 15 }}>{v > 0 ? `${person.name} owes you ` : `You owe ${person.name} `}</span>
              <Balance amount={v} currency={c} />
            </div>
          ))}
        </div>
      </div>

      <div className="actions">
        <button className="btn" onClick={() => nav(`/expense/new?person=${person.id}`)}><Plus size={20} /> Add expense</button>
        <button className="btn soft" onClick={settle}><HandCoins size={20} /> Settle up</button>
      </div>

      {buckets.length > 0 && (
        <>
          <div className="section-title">Breakdown</div>
          <div className="card">
            {buckets.map((b) => (
              <div className="row" key={b.label + b.cur}>
                <div className="grow title">{b.label}</div>
                <div className="end">
                  {b.v === 0 ? <div className="tiny">settled up</div> : (
                    <>
                      <div className="tiny">{b.v > 0 ? 'owes you' : 'you owe'}</div>
                      <div className="amt"><Balance amount={b.v} currency={b.cur} /></div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {months.length === 0 ? (
        <Empty emoji="🧾" title="Nothing shared yet">Expenses you split with {person.name} appear here.</Empty>
      ) : (
        months.map((m) => (
          <div key={m.label}>
            <div className="month">{m.label}</div>
            <div className="card">{m.items.map((e) => <ExpenseRow key={e.id} e={e} showGroup />)}</div>
          </div>
        ))
      )}

      {menu && (
        <Sheet title={person.name} onClose={() => setMenu(false)}>
          <div className="field" style={{ marginTop: 4 }}>
            <label htmlFor="rn">Rename</label>
            <input id="rn" className="input" value={newName} onChange={(e) => setNewName(e.target.value)} />
          </div>
          <div className="actions">
            <button className="btn block" disabled={!newName.trim()} onClick={() => { renamePerson(person.id, newName); setMenu(false); toast('Renamed'); }}>Save name</button>
          </div>
          <div className="actions">
            <button className="btn danger block" onClick={() => {
              if (personInUse(person.id)) { toast("Can't remove: they have expenses. Delete those first."); return; }
              setConfirmDel(true);
            }}>Remove person</button>
          </div>
        </Sheet>
      )}
      {confirmDel && (
        <ConfirmSheet title={`Remove ${person.name}?`} message="They will also be removed from any groups." confirmLabel="Remove" onClose={() => setConfirmDel(false)}
          onConfirm={() => { deletePerson(person.id); setMenu(false); nav('/people', { replace: true }); }} />
      )}
    </>
  );
}
