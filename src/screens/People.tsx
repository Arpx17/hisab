import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { Avatar, Empty, Sheet, TopBar, usePeople, toast } from '../components/ui';
import { Balance } from '../components/money';
import { addPerson } from '../lib/store';
import { friendBalances } from '../lib/summary';

export function BalanceLines({ map }: { map?: Map<string, number> }) {
  if (!map || map.size === 0) return <div className="tiny">settled up</div>;
  return (
    <>
      {[...map].map(([cur, v]) => (
        <div key={cur}>
          <div className="tiny">{v > 0 ? 'owes you' : 'you owe'}</div>
          <div className="amt"><Balance amount={v} currency={cur} /></div>
        </div>
      ))}
    </>
  );
}

export function AddPersonSheet({ onClose, onAdded }: { onClose: () => void; onAdded?: (id: string) => void }) {
  const [name, setName] = useState('');
  const { data } = usePeople();
  const dupe = data.people.some((p) => p.name.trim().toLowerCase() === name.trim().toLowerCase());
  const save = () => {
    if (!name.trim()) return;
    const p = addPerson(name);
    toast(`${p.name} added`);
    onAdded?.(p.id);
    onClose();
  };
  return (
    <Sheet title="Add a person" onClose={onClose}>
      <div className="field" style={{ marginTop: 4 }}>
        <label htmlFor="pn">Name</label>
        <input id="pn" className="input" autoFocus placeholder="e.g. Rahul" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} />
        {dupe && <div className="hint">Someone with this name already exists. You can still add another.</div>}
        <div className="hint">Just a name is enough. No phone number or email needed.</div>
      </div>
      <div className="actions" style={{ marginTop: 18 }}>
        <button className="btn block" disabled={!name.trim()} onClick={save}>Add</button>
      </div>
    </Sheet>
  );
}

export default function People() {
  const { data, meId } = usePeople();
  const nav = useNavigate();
  const [adding, setAdding] = useState(false);
  const bal = friendBalances(data, meId!);
  const others = data.people
    .filter((p) => p.id !== meId)
    .sort((a, b) => {
      const sa = Math.max(0, ...[...(bal.get(a.id)?.values() ?? [])].map(Math.abs));
      const sb = Math.max(0, ...[...(bal.get(b.id)?.values() ?? [])].map(Math.abs));
      return sb - sa || a.name.localeCompare(b.name);
    });

  return (
    <>
      <TopBar title="People" back={false} right={
        <button className="icon-btn" onClick={() => setAdding(true)} aria-label="Add person"><UserPlus size={22} /></button>
      } />
      {others.length === 0 ? (
        <Empty emoji="🙋" title="No people yet">
          Add friends by name. They don't need the app, a phone number or an email.
          <div style={{ marginTop: 18 }}>
            <button className="btn" onClick={() => setAdding(true)}><UserPlus size={20} /> Add a person</button>
          </div>
        </Empty>
      ) : (
        <div className="card">
          {others.map((p) => (
            <button key={p.id} className="row" onClick={() => nav(`/person/${p.id}`)}>
              <Avatar id={p.id} name={p.name} />
              <div className="grow"><div className="title">{p.name}</div></div>
              <div className="end"><BalanceLines map={bal.get(p.id)} /></div>
            </button>
          ))}
        </div>
      )}
      {adding && <AddPersonSheet onClose={() => setAdding(false)} />}
    </>
  );
}
