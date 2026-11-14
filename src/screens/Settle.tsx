import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Avatar, TopBar, usePeople, toast } from '../components/ui';
import { pairBalance, scopeTransfers } from '../lib/summary';
import { CURRENCIES, formatMoney, parseMoney, toInput } from '../lib/money';
import { saveExpense } from '../lib/store';
import { todayISO } from '../lib/util';
import type { ID } from '../lib/types';

export default function Settle() {
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const { data, meId, name, byId } = usePeople();
  const person = sp.get('person');
  const fixedGroup = sp.get('group');

  const groupsForPerson = person ? data.groups.filter((g) => g.memberIds.includes(person) && g.memberIds.includes(meId!)) : [];
  const scopeBalance = (gid: ID | null) => {
    if (!person) return 0;
    const cur = gid ? data.groups.find((g) => g.id === gid)!.currency : data.settings.defaultCurrency;
    return pairBalance(scopeTransfers(data, gid, cur), meId!, person);
  };
  const initialGroup: ID | null = fixedGroup ?? (person ? (groupsForPerson.find((g) => scopeBalance(g.id) !== 0)?.id ?? (scopeBalance(null) !== 0 ? null : groupsForPerson[0]?.id ?? null)) : null);

  const [groupId, setGroupId] = useState<ID | null>(initialGroup);
  const group = groupId ? data.groups.find((g) => g.id === groupId) : undefined;
  const [cur, setCur] = useState(data.settings.defaultCurrency);
  const currency = group ? group.currency : cur;

  const pool: ID[] = group ? group.memberIds : person ? [meId!, person] : data.people.map((p) => p.id);

  const suggestion = useMemo(() => {
    if (!person) return null;
    const v = pairBalance(scopeTransfers(data, groupId, currency), meId!, person);
    if (v === 0) return null;
    return v > 0 ? { from: person, to: meId!, amount: v } : { from: meId!, to: person, amount: -v };
  }, [data, groupId, currency, person, meId]);

  const [from, setFrom] = useState<ID>(sp.get('from') ?? suggestion?.from ?? meId!);
  const [to, setTo] = useState<ID>(sp.get('to') ?? suggestion?.to ?? (person ?? pool.find((p) => p !== meId) ?? ''));
  const paramAmount = Number(sp.get('amount'));
  const [amountText, setAmountText] = useState(paramAmount > 0 ? toInput(paramAmount, currency) : suggestion ? toInput(suggestion.amount, currency) : '');
  const [date, setDate] = useState(todayISO());

  const pick = (nf: ID, nt: ID, amt: number) => { setFrom(nf); setTo(nt); setAmountText(toInput(amt, currency)); };
  const changeGroup = (gid: ID | null) => {
    setGroupId(gid);
    const g = gid ? data.groups.find((x) => x.id === gid) : undefined;
    const c = g ? g.currency : cur;
    const v = pairBalance(scopeTransfers(data, gid, c), meId!, person!);
    if (v > 0) { setFrom(person!); setTo(meId!); setAmountText(toInput(v, c)); }
    else if (v < 0) { setFrom(meId!); setTo(person!); setAmountText(toInput(-v, c)); }
    else { setFrom(meId!); setTo(person!); setAmountText(''); }
  };

  const groupSuggestions = group ? scopeTransfers(data, group.id) : [];
  const amount = parseMoney(amountText, currency);
  const valid = Number.isFinite(amount) && amount > 0 && from && to && from !== to && pool.includes(from) && pool.includes(to);

  const save = () => {
    if (!valid) return;
    saveExpense({
      groupId, kind: 'payment', description: 'Payment', amount, currency, date, category: 'payment',
      payers: [{ personId: from, amount }], owed: [{ personId: to, amount }], splitType: 'exact',
    });
    toast('Payment recorded');
    nav(-1);
  };

  const nm = (p: ID) => byId.get(p)?.name ?? '?';

  return (
    <>
      <TopBar title="Settle up" right={<button className="text-btn" disabled={!valid} onClick={save}>Save</button>} />

      {person && !fixedGroup && (
        <div className="field" style={{ marginTop: 4 }}>
          <label htmlFor="sg">Settle in</label>
          <select id="sg" className="select" value={groupId ?? ''} onChange={(e) => changeGroup(e.target.value || null)}>
            <option value="">Non-group expenses</option>
            {groupsForPerson.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
      )}

      {group && groupSuggestions.length > 0 && !sp.get('from') && (
        <>
          <div className="section-title">Suggested payments</div>
          <div className="card">
            {groupSuggestions.map((t) => (
              <button className="row" key={`${t.from}${t.to}`} onClick={() => pick(t.from, t.to, t.amount)}>
                <div className="grow" style={{ whiteSpace: 'normal' }}><b>{name(t.from)}</b> → <b>{name(t.to)}</b></div>
                <b>{formatMoney(t.amount, currency)}</b>
              </button>
            ))}
          </div>
        </>
      )}

      <div className="field">
        <label>Who paid whom?</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <select className="select" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Payer">
              {pool.map((p) => <option key={p} value={p}>{name(p)}</option>)}
            </select>
          </div>
          <ArrowRight size={22} className="muted" />
          <div style={{ flex: 1 }}>
            <select className="select" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Receiver">
              {!pool.includes(to) && <option value="">Choose…</option>}
              {pool.map((p) => <option key={p} value={p}>{name(p)}</option>)}
            </select>
          </div>
        </div>
        {from && to && from !== to && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginTop: 14 }}>
            <Avatar id={from} name={nm(from)} /><ArrowRight size={22} className="muted" style={{ alignSelf: 'center' }} /><Avatar id={to} name={nm(to)} />
          </div>
        )}
      </div>

      <div className="field">
        <label htmlFor="sa">Amount</label>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {group ? (
            <div className="tile" style={{ width: 'auto', padding: '0 12px', height: 70, fontSize: 16, fontWeight: 700 }}>{currency}</div>
          ) : (
            <select className="select" style={{ width: 96, height: 70, fontWeight: 700 }} value={cur} onChange={(e) => setCur(e.target.value)} aria-label="Currency">
              {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
            </select>
          )}
          <input id="sa" className="input amount-input" inputMode="decimal" placeholder="0.00" value={amountText} onChange={(e) => setAmountText(e.target.value.replace(/[^0-9.,]/g, ''))} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="sd">Date</label>
        <input id="sd" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value || todayISO())} />
      </div>
      {from && from === to && <div className="err">Payer and receiver must be different people</div>}
      <div className="actions" style={{ marginTop: 20 }}>
        <button className="btn block" disabled={!valid} onClick={save}>Record payment</button>
      </div>
    </>
  );
}
