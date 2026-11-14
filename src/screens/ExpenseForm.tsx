import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChevronDown, Plus } from 'lucide-react';
import { Avatar, CheckBox, Empty, Sheet, TopBar, usePeople, toast } from '../components/ui';
import { AddPersonSheet } from './People';
import { CATEGORIES, categoryOf, groupEmoji } from '../lib/categories';
import { CURRENCIES, formatMoney, parseMoney, toInput } from '../lib/money';
import { computeSplit } from '../lib/split';
import { saveExpense } from '../lib/store';
import { todayISO } from '../lib/util';
import type { ID, SplitType } from '../lib/types';

const SPLIT_LABEL: Record<SplitType, string> = {
  equal: 'equally',
  exact: 'by exact amounts',
  percent: 'by percentages',
  shares: 'by shares',
  adjust: 'by adjustment',
};

interface SplitState {
  type: SplitType;
  included: ID[]; // for equal
  vals: Record<ID, string>; // text inputs for the other types
}

const num = (s: string | undefined) => {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

export default function ExpenseForm() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const { data, meId, name, byId } = usePeople();
  const existing = id ? data.expenses.find((e) => e.id === id) : undefined;

  const initialGroup = existing ? existing.groupId : sp.get('group');
  const [groupId, setGroupId] = useState<ID | null>(initialGroup && data.groups.some((g) => g.id === initialGroup) ? initialGroup : null);
  const group = groupId ? data.groups.find((g) => g.id === groupId) : undefined;

  const [withIds, setWithIds] = useState<ID[]>(() => {
    if (existing && !existing.groupId) return [...new Set([...existing.payers, ...existing.owed].map((p) => p.personId))].filter((p) => p !== meId);
    const p = sp.get('person');
    return p && byId.has(p) ? [p] : [];
  });
  const [cur, setCur] = useState(existing?.currency ?? group?.currency ?? data.settings.defaultCurrency);
  const currency = group ? group.currency : cur;

  const [desc, setDesc] = useState(existing?.description ?? '');
  const [amountText, setAmountText] = useState(existing ? toInput(existing.amount, existing.currency) : '');
  const [date, setDate] = useState(existing?.date ?? todayISO());
  const [category, setCategory] = useState(existing?.category ?? 'general');
  const [note, setNote] = useState(existing?.note ?? '');

  const pool: ID[] = useMemo(
    () => (group ? group.memberIds : [...new Set([meId!, ...withIds])]),
    [group, withIds, meId],
  );

  // payers
  const [payerId, setPayerId] = useState<ID>(existing && existing.payers.length === 1 ? existing.payers[0].personId : meId!);
  const [multi, setMulti] = useState(!!existing && existing.payers.length > 1);
  const [payerVals, setPayerVals] = useState<Record<ID, string>>(
    existing && existing.payers.length > 1 ? Object.fromEntries(existing.payers.map((p) => [p.personId, toInput(p.amount, existing.currency)])) : {},
  );

  // split
  const [split, setSplit] = useState<SplitState>(() => {
    if (!existing) return { type: 'equal', included: [], vals: {} };
    const t = existing.splitType;
    const vals: Record<ID, string> = {};
    for (const [pid, v] of Object.entries(existing.splitInputs ?? {})) {
      vals[pid] = t === 'exact' || t === 'adjust' ? toInput(Math.round(v), existing.currency) : String(v);
    }
    return { type: t, included: existing.owed.map((o) => o.personId), vals };
  });
  const includedEqual = split.included.length ? split.included.filter((p) => pool.includes(p)) : pool;

  const [sheet, setSheet] = useState<null | 'group' | 'payer' | 'split' | 'category' | 'with' | 'newperson'>(null);

  const total = parseMoney(amountText, currency);
  const totalOk = Number.isFinite(total) && total > 0;

  // reset dependent state when the pool changes
  const resetForPool = () => {
    setSplit({ type: 'equal', included: [], vals: {} });
    setPayerId(meId!);
    setMulti(false);
    setPayerVals({});
  };

  const participants = split.type === 'equal' ? includedEqual : pool;
  const values = useMemo(() => {
    const out: Record<ID, number> = {};
    for (const p of participants) {
      const t = split.vals[p];
      out[p] = split.type === 'exact' || split.type === 'adjust' ? (Number.isFinite(parseMoney(t ?? '', currency)) ? parseMoney(t ?? '', currency) : 0) : num(t);
    }
    return out;
  }, [participants, split, currency]);
  const result = totalOk ? computeSplit({ type: split.type, total, participants, values }) : null;

  // payers validity
  const payerList = multi
    ? pool.map((p) => ({ personId: p, amount: Number.isFinite(parseMoney(payerVals[p] ?? '', currency)) ? parseMoney(payerVals[p] ?? '', currency) : 0 })).filter((p) => p.amount > 0)
    : [{ personId: pool.includes(payerId) ? payerId : pool[0], amount: totalOk ? total : 0 }];
  const paidSum = payerList.reduce((s, p) => s + p.amount, 0);
  const payersOk = totalOk && paidSum === total && payerList.length > 0;

  const needsOthers = !group && withIds.length === 0;
  const fmt = (m: number) => formatMoney(Math.abs(m), currency);
  let splitProblem: string | null = null;
  if (totalOk && result && !result.ok) {
    if (split.type === 'exact' && result.remaining !== undefined && result.error?.startsWith('Amounts must')) {
      const assigned = total - result.remaining;
      splitProblem = `Split adds up to ${fmt(assigned)}, which is ${fmt(result.remaining)} ${result.remaining > 0 ? 'less' : 'more'} than the bill of ${fmt(total)}. Tap the split to fix it.`;
    } else if (split.type === 'percent' && result.remaining !== undefined) {
      splitProblem = `Percentages add up to ${+(100 - result.remaining).toFixed(2)}%, not 100%. Tap the split to fix it.`;
    } else splitProblem = result.error ?? 'Check the split';
  }
  const problem = !desc.trim()
    ? 'Add a description'
    : !totalOk
      ? 'Enter an amount'
      : needsOthers
        ? 'Choose who you split with'
        : !payersOk
          ? `Paid amounts add up to ${fmt(paidSum)}, which is ${fmt(total - paidSum)} ${paidSum < total ? 'less' : 'more'} than the bill of ${fmt(total)}. Tap "Paid by" to fix it.`
          : splitProblem;
  const shareSum = split.type === 'shares' ? participants.reduce((a, p) => a + (values[p] || 0), 0) : 0;
  const shareSumMinor = parseMoney(String(shareSum), currency);
  const sharesLookLikeMoney =
    split.type === 'shares' && totalOk && Math.max(0, ...participants.map((p) => values[p] || 0)) >= 10 && shareSumMinor !== total;

  const save = () => {
    if (problem || !result) return;
    const inputs: Record<ID, number> | undefined = split.type === 'equal' ? undefined : values;
    saveExpense({
      id: existing?.id,
      groupId,
      kind: 'expense',
      description: desc.trim(),
      amount: total,
      currency,
      date,
      category,
      payers: payerList,
      owed: result.owed.filter((o) => o.amount > 0),
      splitType: split.type,
      splitInputs: inputs,
      note: note.trim() || undefined,
    });
    toast(existing ? 'Expense updated' : 'Expense added');
    nav(-1);
  };

  const payerLabel = multi ? `${payerList.length} people` : name(pool.includes(payerId) ? payerId : pool[0]);
  const cat = categoryOf(category);

  return (
    <>
      <TopBar title={existing ? 'Edit expense' : 'Add expense'} right={<button className="text-btn" disabled={!!problem} onClick={save}>Save</button>} />

      {/* with / group */}
      {!existing || existing.groupId === null ? (
        <div className="field" style={{ marginTop: 4 }}>
          <label>{group ? 'Group' : 'With you and'}</label>
          {existing ? null : (
            <button className="select" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left' }} onClick={() => setSheet('group')}>
              <span>{group ? `${groupEmoji(group.type)} ${group.name}` : '👤 No group (split with people)'}</span>
              <ChevronDown size={18} />
            </button>
          )}
          {!group && (
            <div className="pills" style={{ marginTop: existing ? 0 : 10 }}>
              {withIds.map((p) => (
                <button key={p} className="pill on" onClick={() => { if (!existing) { setWithIds(withIds.filter((x) => x !== p)); resetForPool(); } }}>{name(p)}{!existing && ' ✕'}</button>
              ))}
              {!existing && <button className="pill" onClick={() => setSheet('with')}><Plus size={16} /> Add people</button>}
            </div>
          )}
        </div>
      ) : (
        <div className="hint" style={{ marginTop: 0 }}>In group: {group?.name}</div>
      )}

      <div className="field">
        <label htmlFor="d">Description</label>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="tile" style={{ width: 50, height: 50 }} onClick={() => setSheet('category')} aria-label="Category">{cat.emoji}</button>
          <input id="d" className="input" placeholder="What was it for?" value={desc} onChange={(e) => setDesc(e.target.value)} autoFocus={!existing} />
        </div>
      </div>

      <div className="field">
        <label htmlFor="a">Amount</label>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {group ? (
            <div className="tile" style={{ width: 'auto', padding: '0 12px', height: 70, fontSize: 16, fontWeight: 700 }}>{currency}</div>
          ) : (
            <select className="select" style={{ width: 96, height: 70, fontWeight: 700 }} value={cur} onChange={(e) => setCur(e.target.value)} aria-label="Currency">
              {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
            </select>
          )}
          <input id="a" className="input amount-input" inputMode="decimal" placeholder="0.00" value={amountText} onChange={(e) => setAmountText(e.target.value.replace(/[^0-9.,]/g, ''))} />
        </div>
      </div>

      <div className="sentence">
        Paid by <button className="pill" onClick={() => setSheet('payer')}>{payerLabel}</button>
        and split <button className="pill" onClick={() => setSheet('split')}>{SPLIT_LABEL[split.type]}</button>
        {totalOk && result?.ok && split.type === 'equal' && participants.length > 0 && (
          <div className="hint" style={{ margin: '10px 0 0' }}>{formatMoney(Math.floor(total / participants.length), currency)} per person · {participants.length} {participants.length === 1 ? 'person' : 'people'}</div>
        )}
      </div>

      {problem && totalOk && desc.trim() && <div className="alert">{problem}</div>}
      {!problem && sharesLookLikeMoney && (
        <div className="alert warn">
          Your shares add up to {shareSum}, but the bill is {fmt(total)}. Shares are ratios, so everyone's part is scaled. If you typed rupee amounts, open the split and tap "Use as exact amounts".
        </div>
      )}
      <div className="field">
        <label htmlFor="dt">Date</label>
        <input id="dt" className="input" type="date" value={date} max="2100-12-31" onChange={(e) => setDate(e.target.value || todayISO())} />
      </div>
      <div className="field">
        <label htmlFor="nt">Notes (optional)</label>
        <textarea id="nt" className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add any details" />
      </div>

      <div className="actions" style={{ marginTop: 20 }}>
        <button className="btn block" disabled={!!problem} onClick={save}>{existing ? 'Save changes' : 'Add expense'}</button>
      </div>

      {/* ---- sheets ---- */}
      {sheet === 'group' && (
        <Sheet title="Choose group" onClose={() => setSheet(null)}>
          <div className="card">
            <button className="row" onClick={() => { setGroupId(null); setCur(data.settings.defaultCurrency); resetForPool(); setSheet(null); }}>
              <div className="tile">👤</div><div className="grow title">No group</div><CheckBox on={!group} />
            </button>
            {data.groups.map((g) => (
              <button key={g.id} className="row" onClick={() => { setGroupId(g.id); resetForPool(); setSheet(null); }}>
                <div className="tile">{groupEmoji(g.type)}</div><div className="grow title">{g.name}</div><CheckBox on={groupId === g.id} />
              </button>
            ))}
          </div>
        </Sheet>
      )}

      {sheet === 'with' && (
        <Sheet title="Split with" onClose={() => setSheet(null)}>
          <div className="card">
            {data.people.filter((p) => p.id !== meId).map((p) => (
              <button key={p.id} className="row" onClick={() => { setWithIds(withIds.includes(p.id) ? withIds.filter((x) => x !== p.id) : [...withIds, p.id]); resetForPool(); }}>
                <Avatar id={p.id} name={p.name} /><div className="grow title">{p.name}</div><CheckBox on={withIds.includes(p.id)} />
              </button>
            ))}
            <button className="row" onClick={() => setSheet('newperson')} style={{ color: 'var(--primary)', fontWeight: 700 }}>
              <div className="tile"><Plus size={22} /></div><div className="grow">Add someone by name</div>
            </button>
          </div>
          <div className="actions" style={{ marginTop: 14 }}><button className="btn block" onClick={() => setSheet(null)}>Done</button></div>
        </Sheet>
      )}
      {sheet === 'newperson' && (
        <AddPersonSheet onClose={() => setSheet('with')} onAdded={(pid) => { setWithIds((w) => [...w, pid]); resetForPool(); }} />
      )}

      {sheet === 'category' && (
        <Sheet title="Category" onClose={() => setSheet(null)}>
          <div className="emoji-grid" style={{ padding: '4px 16px 0' }}>
            {CATEGORIES.map((c) => (
              <button key={c.id} className={c.id === category ? 'on' : ''} onClick={() => { setCategory(c.id); setSheet(null); }}>
                <div>{c.emoji}<small>{c.label.split(' ')[0]}</small></div>
              </button>
            ))}
          </div>
        </Sheet>
      )}

      {sheet === 'payer' && (
        <PayerSheet
          pool={pool} name={name} currency={currency} total={totalOk ? total : 0}
          payerId={payerId} multi={multi} vals={payerVals}
          onDone={(m, pid, vals) => { setMulti(m); setPayerId(pid); setPayerVals(vals); setSheet(null); }}
          onSetTotal={(m) => setAmountText(toInput(m, currency))}
          onClose={() => setSheet(null)}
        />
      )}

      {sheet === 'split' && (
        pool.length < 2 && !group ? (
          <Sheet title="Split" onClose={() => setSheet(null)}><Empty emoji="👤" title="Add people first">Choose who you're splitting with.</Empty></Sheet>
        ) : (
          <SplitSheet
            pool={pool} name={name} currency={currency} total={totalOk ? total : 0}
            state={{ ...split, included: includedEqual }}
            onDone={(s) => { setSplit(s); setSheet(null); }}
            onSetTotal={(m) => setAmountText(toInput(m, currency))}
            onClose={() => setSheet(null)}
          />
        )
      )}
    </>
  );
}

/* ================= payer sheet ================= */
function PayerSheet({ pool, name, currency, total, payerId, multi, vals, onDone, onClose, onSetTotal }: {
  pool: ID[]; name: (id: ID) => string; currency: string; total: number;
  payerId: ID; multi: boolean; vals: Record<ID, string>;
  onDone: (multi: boolean, payerId: ID, vals: Record<ID, string>) => void; onClose: () => void;
  onSetTotal: (minor: number) => void;
}) {
  const [m, setM] = useState(multi);
  const [pid, setPid] = useState(payerId);
  const [v, setV] = useState(vals);
  const parsed = (p: ID) => { const n = parseMoney(v[p] ?? '', currency); return Number.isFinite(n) ? n : 0; };
  const sum = pool.reduce((s, p) => s + parsed(p), 0);
  const left = total - sum;
  const { byId } = usePeople();
  const nm = (p: ID) => byId.get(p)?.name ?? '?';
  const fmt = (x: number) => formatMoney(Math.abs(x), currency);
  return (
    <Sheet title="Who paid?" onClose={onClose}>
      <div className="seg" style={{ marginBottom: 12 }}>
        <button className={!m ? 'on' : ''} onClick={() => setM(false)}>One person</button>
        <button className={m ? 'on' : ''} onClick={() => setM(true)}>Multiple people</button>
      </div>
      <div className="card">
        {pool.map((p) =>
          m ? (
            <div className="row" key={p}>
              <Avatar id={p} name={nm(p)} /><div className="grow title">{name(p)}</div>
              <input className="mini-input" inputMode="decimal" placeholder="0.00" value={v[p] ?? ''} onChange={(e) => setV({ ...v, [p]: e.target.value.replace(/[^0-9.,]/g, '') })} />
            </div>
          ) : (
            <button className="row" key={p} onClick={() => setPid(p)}>
              <Avatar id={p} name={nm(p)} /><div className="grow title">{name(p)}</div><CheckBox on={pid === p} />
            </button>
          ),
        )}
      </div>
      {m && (
        left === 0 ? (
          <div className="ok-line">✓ {fmt(sum)} paid · matches the bill</div>
        ) : (
          <div className="alert">
            {total === 0
              ? `Paid amounts add up to ${fmt(sum)}. Enter the bill amount, or use this total.`
              : `Paid ${fmt(sum)} of ${fmt(total)} · ${fmt(left)} ${left > 0 ? 'still to add' : 'more than the bill'}`}
            {sum > 0 && <div><button className="btn sm ghost" style={{ marginTop: 8 }} onClick={() => onSetTotal(sum)}>Set bill to {fmt(sum)}</button></div>}
          </div>
        )
      )}
      <div className="actions" style={{ marginTop: 14 }}>
        <button className="btn block" disabled={m && left !== 0} onClick={() => onDone(m, pid, v)}>Done</button>
      </div>
    </Sheet>
  );
}

/* ================= split sheet ================= */
const TABS: { id: SplitType; label: string }[] = [
  { id: 'equal', label: 'Equal' },
  { id: 'exact', label: 'Amount' },
  { id: 'percent', label: '%' },
  { id: 'shares', label: 'Shares' },
  { id: 'adjust', label: '+/−' },
];
const TAB_HELP: Record<SplitType, string> = {
  equal: 'Tick who shares this bill. It is divided equally.',
  exact: 'Type the rupee amount each person owes. They must add up to the bill.',
  percent: 'Type the percentage each person owes. They must add up to 100%.',
  shares: 'Ratios, not rupees: e.g. 2 for a couple, 1 for a single person.',
  adjust: 'Add extra (+) or less (−) for some people. The rest is split equally.',
};

function SplitSheet({ pool, name, currency, total, state, onDone, onClose, onSetTotal }: {
  pool: ID[]; name: (id: ID) => string; currency: string; total: number;
  state: { type: SplitType; included: ID[]; vals: Record<ID, string> };
  onDone: (s: { type: SplitType; included: ID[]; vals: Record<ID, string> }) => void; onClose: () => void;
  onSetTotal: (minor: number) => void;
}) {
  const { byId } = usePeople();
  const [type, setType] = useState<SplitType>(state.type);
  const [included, setIncluded] = useState<ID[]>(state.included);
  const defaults = (t: SplitType): Record<ID, string> => (t === 'shares' ? Object.fromEntries(pool.map((p) => [p, '1'])) : {});
  const [byType, setByType] = useState<Partial<Record<SplitType, Record<ID, string>>>>({ [state.type]: Object.keys(state.vals).length ? state.vals : defaults(state.type) });
  const vals = byType[type] ?? defaults(type);
  const setVal = (p: ID, t: string) => setByType({ ...byType, [type]: { ...vals, [p]: t } });

  const participants = type === 'equal' ? included : pool;
  const numeric: Record<ID, number> = {};
  for (const p of participants) {
    const t = vals[p];
    if (type === 'exact' || type === 'adjust') { const n = parseMoney(t ?? '', currency); numeric[p] = Number.isFinite(n) ? n : 0; }
    else { const n = Number(t); numeric[p] = Number.isFinite(n) ? n : 0; }
  }
  const res = computeSplit({ type, total, participants, values: numeric });
  const amountOf = (p: ID) => res.owed.find((o) => o.personId === p)?.amount;
  const nm = (p: ID) => byId.get(p)?.name ?? '?';
  const fmt = (x: number) => formatMoney(Math.abs(x), currency);

  const assigned = type === 'exact' ? participants.reduce((a, p) => a + (numeric[p] || 0), 0) : 0;
  const shareSum = type === 'shares' ? participants.reduce((a, p) => a + (numeric[p] || 0), 0) : 0;
  const shareSumMinor = parseMoney(String(shareSum), currency);
  const sharesLookLikeMoney = type === 'shares' && total > 0 && Math.max(0, ...participants.map((p) => numeric[p] || 0)) >= 10 && shareSumMinor !== total;

  const useAsAmounts = () => {
    setByType({ ...byType, exact: { ...vals } });
    setType('exact');
  };

  let status: ReactNode;
  if (type === 'equal') {
    status = included.length
      ? <div className="ok-line">{total > 0 ? `${fmt(Math.floor(total / included.length))} each · ` : ''}{included.length} {included.length === 1 ? 'person' : 'people'}</div>
      : <div className="alert">Pick at least one person</div>;
  } else if (type === 'exact') {
    const rem = total - assigned;
    status = total > 0 && rem === 0 ? (
      <div className="ok-line">✓ {fmt(assigned)} assigned · matches the bill</div>
    ) : (
      <div className="alert">
        {total === 0
          ? `These add up to ${fmt(assigned)}. Enter the bill amount, or use this total.`
          : `${fmt(assigned)} of ${fmt(total)} assigned · ${fmt(rem)} ${rem > 0 ? 'still to assign' : 'more than the bill'}`}
        {assigned > 0 && <div><button className="btn sm ghost" style={{ marginTop: 8 }} onClick={() => onSetTotal(assigned)}>Set bill to {fmt(assigned)}</button></div>}
      </div>
    );
  } else if (type === 'percent') {
    const rem = res.remaining ?? 100;
    status = Math.abs(rem) < 0.001
      ? <div className="ok-line">✓ 100% assigned</div>
      : <div className="alert">{+(100 - rem).toFixed(2)}% of 100% · {Math.abs(+rem.toFixed(2))}% {rem > 0 ? 'still to assign' : 'too much'}</div>;
  } else if (type === 'shares') {
    status = sharesLookLikeMoney ? (
      <div className="alert warn">
        These look like rupee amounts. They add up to {shareSum}, but the bill is {fmt(total)}. Shares are ratios, so each person's part is scaled to the amount under their name.
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          <button className="btn sm ghost" onClick={useAsAmounts}>Use as exact amounts</button>
          {shareSumMinor > 0 && <button className="btn sm ghost" onClick={() => onSetTotal(shareSumMinor)}>Set bill to {fmt(shareSumMinor)}</button>}
        </div>
      </div>
    ) : res.ok ? (
      <div className="ok-line">{shareSum} {shareSum === 1 ? 'share' : 'shares'} in total</div>
    ) : <div className="alert">{res.error}</div>;
  } else {
    status = res.ok ? <div className="ok-line">✓ The rest is split equally</div> : <div className="alert">{res.error}</div>;
  }

  return (
    <Sheet title="Split options" onClose={onClose}>
      <div className="seg">
        {TABS.map((t) => <button key={t.id} className={type === t.id ? 'on' : ''} onClick={() => setType(t.id)}>{t.label}</button>)}
      </div>
      <div className="hint" style={{ marginBottom: 8 }}>{TAB_HELP[type]}</div>
      <div className="card">
        {pool.map((p) => {
          const amt = amountOf(p);
          if (type === 'equal') {
            const on = included.includes(p);
            return (
              <button className="row" key={p} onClick={() => setIncluded(on ? included.filter((x) => x !== p) : pool.filter((x) => x === p || included.includes(x)))}>
                <Avatar id={p} name={nm(p)} /><div className="grow title">{name(p)}</div>
                {on && total > 0 && amt !== undefined && <span className="muted">{formatMoney(amt, currency)}</span>}
                <CheckBox on={on} />
              </button>
            );
          }
          return (
            <div className="row" key={p}>
              <Avatar id={p} name={nm(p)} />
              <div className="grow">
                <div className="title">{name(p)}</div>
                {(type === 'shares' || type === 'percent' || type === 'adjust') && total > 0 && amt !== undefined && <div className="sub">owes {formatMoney(amt, currency)}</div>}
              </div>
              <input className="mini-input" inputMode="decimal"
                placeholder={type === 'percent' ? '0 %' : type === 'shares' ? '1' : '0.00'}
                value={vals[p] ?? ''}
                onChange={(e) => setVal(p, e.target.value.replace(type === 'adjust' ? /[^0-9.,-]/g : /[^0-9.,]/g, ''))} />
            </div>
          );
        })}
      </div>
      {status}
      <div className="actions" style={{ marginTop: 14 }}>
        <button className="btn block" disabled={total > 0 ? !res.ok : participants.length === 0} onClick={() => onDone({ type, included, vals })}>
          {sharesLookLikeMoney ? 'Keep as shares (scaled)' : 'Done'}
        </button>
      </div>
    </Sheet>
  );
}
