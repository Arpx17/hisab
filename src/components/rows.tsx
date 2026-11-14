import { useNavigate } from 'react-router-dom';
import type { Expense } from '../lib/types';
import { categoryOf } from '../lib/categories';
import { formatMoney } from '../lib/money';
import { myPosition } from '../lib/balances';
import { usePeople } from './ui';

export function ExpenseRow({ e, showGroup }: { e: Expense; showGroup?: boolean }) {
  const nav = useNavigate();
  const { name, meId, data } = usePeople();
  const [, m, d] = e.date.split('-');
  const month = new Date(2000, Number(m) - 1, 1).toLocaleString('en', { month: 'short' });
  const mine = meId ? myPosition(e, meId) : 0;
  const involved = e.payers.some((p) => p.personId === meId) || e.owed.some((p) => p.personId === meId);
  const cat = categoryOf(e.kind === 'payment' ? 'payment' : e.category);
  const groupName = showGroup ? (e.groupId ? data.groups.find((g) => g.id === e.groupId)?.name : 'Non-group') : null;

  let sub: string;
  if (e.kind === 'payment') {
    sub = `${name(e.payers[0].personId)} paid ${name(e.owed[0].personId)}`;
  } else if (e.payers.length === 1) {
    const p = e.payers[0].personId;
    sub = `${name(p)} paid ${formatMoney(e.amount, e.currency, { compact: true })}`;
  } else {
    sub = `${e.payers.length} people paid ${formatMoney(e.amount, e.currency, { compact: true })}`;
  }
  if (groupName) sub += ` · ${groupName}`;

  return (
    <button className="row" onClick={() => nav(`/expense/${e.id}`)}>
      <div className="date-chip">
        <span>{month}</span>
        <b>{Number(d)}</b>
      </div>
      <div className="tile">{cat.emoji}</div>
      <div className="grow">
        <div className="title">{e.kind === 'payment' ? 'Payment' : e.description}</div>
        <div className="sub">{sub}</div>
      </div>
      <div className="end">
        {!involved ? (
          <div className="tiny">not involved</div>
        ) : mine === 0 ? (
          <div className="tiny">no balance</div>
        ) : (
          <>
            <div className="tiny">{mine > 0 ? 'you lent' : 'you borrowed'}</div>
            <div className={`amt ${mine > 0 ? 'pos' : 'neg'}`}>{formatMoney(Math.abs(mine), e.currency)}</div>
          </>
        )}
      </div>
    </button>
  );
}
