import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Settings, Share2, HandCoins } from 'lucide-react';
import { Avatar, Empty, TopBar, usePeople, toast } from '../components/ui';
import { Balance } from '../components/money';
import { ExpenseRow } from '../components/rows';
import { formatMoney } from '../lib/money';
import { groupTransfers, netBalances } from '../lib/balances';
import { groupEmoji } from '../lib/categories';
import { groupSummaryText } from '../lib/summary';
import { shareText } from '../lib/share';
import { monthLabel } from '../lib/util';

export default function GroupDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { data, meId, name } = usePeople();
  const [tab, setTab] = useState<'expenses' | 'balances'>('expenses');
  const group = data.groups.find((g) => g.id === id);
  if (!group) return (<><TopBar title="Group" /><Empty emoji="🤷" title="Group not found" /></>);

  const expenses = data.expenses
    .filter((e) => e.groupId === group.id)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  const nets = netBalances(expenses);
  const myNet = nets.get(meId!) ?? 0;
  const transfers = groupTransfers(expenses, group.simplify);
  const spent = expenses.filter((e) => e.kind === 'expense');
  const total = spent.reduce((s, e) => s + e.amount, 0);
  const myPaid = spent.reduce((s, e) => s + (e.payers.find((p) => p.personId === meId)?.amount ?? 0), 0);
  const myShare = spent.reduce((s, e) => s + (e.owed.find((p) => p.personId === meId)?.amount ?? 0), 0);

  const months: { label: string; items: typeof expenses }[] = [];
  for (const e of expenses) {
    const label = monthLabel(e.date);
    const last = months[months.length - 1];
    if (last && last.label === label) last.items.push(e);
    else months.push({ label, items: [e] });
  }

  const share = async () => {
    const r = await shareText(group.name, groupSummaryText(group, expenses, data.people, meId));
    if (r === 'copied') toast('Summary copied');
    if (r === 'failed') toast("Couldn't share");
  };

  const settle = (from?: string, to?: string, amount?: number) => {
    const q = new URLSearchParams({ group: group.id });
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    if (amount) q.set('amount', String(amount));
    nav(`/settle?${q}`);
  };

  return (
    <>
      <TopBar title={group.name} right={
        <>
          <button className="icon-btn" onClick={share} aria-label="Share summary"><Share2 size={21} /></button>
          <button className="icon-btn" onClick={() => nav(`/group/${group.id}/edit`)} aria-label="Group settings"><Settings size={22} /></button>
        </>
      } />

      <div className="hero group">
        <div className="tile lg" style={{ background: 'rgba(255,255,255,.2)' }}>{groupEmoji(group.type)}</div>
        <div>
          <div className="label">
            {myNet === 0 ? (expenses.length ? 'You are settled up' : 'No expenses yet') : myNet > 0 ? 'You are owed' : 'You owe'}
          </div>
          {myNet !== 0 && <div className="big" style={{ margin: 0 }}>{formatMoney(Math.abs(myNet), group.currency)}</div>}
          <div className="label">{group.memberIds.length} {group.memberIds.length === 1 ? 'member' : 'members'}</div>
        </div>
      </div>

      <div className="actions">
        <button className="btn" onClick={() => nav(`/expense/new?group=${group.id}`)}><Plus size={20} /> Add expense</button>
        <button className="btn soft" onClick={() => settle()}><HandCoins size={20} /> Settle up</button>
      </div>

      <div className="seg" style={{ marginTop: 18 }}>
        <button className={tab === 'expenses' ? 'on' : ''} onClick={() => setTab('expenses')}>Expenses</button>
        <button className={tab === 'balances' ? 'on' : ''} onClick={() => setTab('balances')}>Balances</button>
      </div>

      {tab === 'expenses' ? (
        expenses.length === 0 ? (
          <Empty emoji="🧾" title="No expenses yet">Tap "Add expense" to log the first bill.</Empty>
        ) : (
          months.map((m) => (
            <div key={m.label}>
              <div className="month">{m.label}</div>
              <div className="card">{m.items.map((e) => <ExpenseRow key={e.id} e={e} />)}</div>
            </div>
          ))
        )
      ) : (
        <>
          <div className="section-title">{group.simplify ? 'Simplified debts' : 'Who owes whom'}</div>
          {transfers.length === 0 ? (
            <div className="card"><div className="row"><div className="tile">✅</div><div className="grow title">Everyone is settled up</div></div></div>
          ) : (
            <div className="card">
              {transfers.map((t) => (
                <div className="row" key={`${t.from}-${t.to}`}>
                  <Avatar id={t.from} name={data.people.find((p) => p.id === t.from)?.name ?? '?'} size="sm" />
                  <div className="grow" style={{ whiteSpace: 'normal' }}>
                    <b>{name(t.from)}</b> {t.from === meId ? 'owe' : 'owes'} <b>{name(t.to)}</b>
                    <div className={t.from === meId ? 'neg' : t.to === meId ? 'pos' : 'muted'} style={{ fontWeight: 700 }}>
                      {formatMoney(t.amount, group.currency)}
                    </div>
                  </div>
                  <button className="btn soft sm" onClick={() => settle(t.from, t.to, t.amount)}>Settle</button>
                </div>
              ))}
            </div>
          )}

          <div className="section-title">Each person's balance</div>
          <div className="card">
            {group.memberIds.map((pid) => {
              const v = nets.get(pid) ?? 0;
              return (
                <div className="row" key={pid}>
                  <Avatar id={pid} name={data.people.find((p) => p.id === pid)?.name ?? '?'} size="sm" />
                  <div className="grow title">{name(pid)}</div>
                  <div className="end">
                    <div className="tiny">{v > 0 ? 'gets back' : v < 0 ? 'owes' : 'settled up'}</div>
                    {v !== 0 && <div className="amt"><Balance amount={v} currency={group.currency} /></div>}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="section-title">Totals</div>
          <div className="stat-grid">
            <div className="stat"><div className="k">Group spending</div><div className="v">{formatMoney(total, group.currency)}</div></div>
            <div className="stat"><div className="k">Your share</div><div className="v">{formatMoney(myShare, group.currency)}</div></div>
            <div className="stat"><div className="k">You paid</div><div className="v">{formatMoney(myPaid, group.currency)}</div></div>
            <div className="stat"><div className="k">Expenses</div><div className="v">{spent.length}</div></div>
          </div>
          <div className="actions"><button className="btn ghost" onClick={share}><Share2 size={18} /> Share summary</button></div>
        </>
      )}
    </>
  );
}
