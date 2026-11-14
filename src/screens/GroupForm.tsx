import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Avatar, CheckBox, ConfirmSheet, Toggle, TopBar, usePeople, toast } from '../components/ui';
import { AddPersonSheet } from './People';
import { CURRENCIES } from '../lib/money';
import { GROUP_TYPES } from '../lib/categories';
import { deleteGroup, memberInUse, saveGroup } from '../lib/store';
import type { GroupType, ID } from '../lib/types';

export default function GroupForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const { data, meId } = usePeople();
  const existing = id ? data.groups.find((g) => g.id === id) : undefined;

  const [name, setName] = useState(existing?.name ?? '');
  const [type, setType] = useState<GroupType>(existing?.type ?? 'friends');
  const [currency, setCurrency] = useState(existing?.currency ?? data.settings.defaultCurrency);
  const [simplify, setSimplify] = useState(existing?.simplify ?? true);
  const [members, setMembers] = useState<ID[]>(existing?.memberIds ?? [meId!]);
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const toggle = (pid: ID) => {
    if (pid === meId) return;
    if (members.includes(pid)) {
      if (existing && memberInUse(existing.id, pid)) {
        toast("They have expenses in this group, so can't be removed");
        return;
      }
      setMembers(members.filter((m) => m !== pid));
    } else setMembers([...members, pid]);
  };

  const save = () => {
    const g = saveGroup({ id: existing?.id, name: name.trim(), type, currency, simplify, memberIds: members });
    if (existing) nav(-1);
    else nav(`/group/${g.id}`, { replace: true });
  };

  const hasExpenses = existing ? data.expenses.some((e) => e.groupId === existing.id) : false;
  const people = [...data.people].sort((a, b) => (a.id === meId ? -1 : b.id === meId ? 1 : a.name.localeCompare(b.name)));

  return (
    <>
      <TopBar title={existing ? 'Group settings' : 'New group'} right={
        <button className="text-btn" disabled={!name.trim() || members.length < 1} onClick={save}>Save</button>
      } />
      <div className="field">
        <label htmlFor="gn">Group name</label>
        <input id="gn" className="input" placeholder="e.g. Goa trip, Flat 4B" value={name} onChange={(e) => setName(e.target.value)} autoFocus={!existing} />
      </div>

      <div className="field">
        <label>Type</label>
        <div className="emoji-grid">
          {GROUP_TYPES.map((t) => (
            <button key={t.id} className={type === t.id ? 'on' : ''} onClick={() => setType(t.id)}>
              <div>{t.emoji}<small>{t.label}</small></div>
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label htmlFor="cur">Currency</label>
        <select id="cur" className="select" value={currency} onChange={(e) => setCurrency(e.target.value)} disabled={hasExpenses}>
          {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} · {c.label}</option>)}
        </select>
        {hasExpenses && <div className="hint">Currency is locked once the group has expenses.</div>}
      </div>

      <div className="section-title">Members</div>
      <div className="card">
        {people.map((p) => (
          <button key={p.id} className="row" onClick={() => toggle(p.id)}>
            <Avatar id={p.id} name={p.name} />
            <div className="grow"><div className="title">{p.id === meId ? `${p.name} (you)` : p.name}</div></div>
            <CheckBox on={members.includes(p.id)} />
          </button>
        ))}
        <button className="row" onClick={() => setAdding(true)} style={{ color: 'var(--primary)', fontWeight: 700 }}>
          <div className="tile"><Plus size={22} /></div>
          <div className="grow">Add someone new by name</div>
        </button>
      </div>

      <div className="section-title">Options</div>
      <div className="card">
        <div className="row">
          <div className="grow">
            <div className="title">Simplify group debts</div>
            <div className="sub" style={{ whiteSpace: 'normal' }}>Combine debts so fewer payments are needed. Example: if A owes B and B owes C, show A pays C.</div>
          </div>
          <Toggle on={simplify} onChange={setSimplify} label="Simplify group debts" />
        </div>
      </div>

      {existing && (
        <div className="actions" style={{ marginTop: 28 }}>
          <button className="btn danger" onClick={() => setConfirmDelete(true)}>Delete group</button>
        </div>
      )}

      {adding && <AddPersonSheet onClose={() => setAdding(false)} onAdded={(pid) => setMembers((m) => [...m, pid])} />}
      {confirmDelete && existing && (
        <ConfirmSheet
          title="Delete this group?"
          message="All expenses and payments in this group will be deleted. This can't be undone."
          confirmLabel="Delete"
          onClose={() => setConfirmDelete(false)}
          onConfirm={() => {
            deleteGroup(existing.id);
            nav('/', { replace: true });
          }}
        />
      )}
    </>
  );
}
