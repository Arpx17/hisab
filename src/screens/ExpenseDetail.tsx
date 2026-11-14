import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Pencil, Trash2 } from 'lucide-react';
import { Avatar, ConfirmSheet, Empty, TopBar, usePeople, toast } from '../components/ui';
import { categoryOf } from '../lib/categories';
import { formatMoney } from '../lib/money';
import { deleteExpense } from '../lib/store';
import { formatDate } from '../lib/util';

export default function ExpenseDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { data, name, byId } = usePeople();
  const [confirm, setConfirm] = useState(false);
  const e = data.expenses.find((x) => x.id === id);
  if (!e) return (<><TopBar title="Expense" /><Empty emoji="🤷" title="Expense not found" /></>);

  const group = e.groupId ? data.groups.find((g) => g.id === e.groupId) : null;
  const isPayment = e.kind === 'payment';
  const nm = (p: string) => byId.get(p)?.name ?? '?';

  return (
    <>
      <TopBar title={isPayment ? 'Payment' : 'Expense'} right={
        <>
          {!isPayment && <button className="icon-btn" onClick={() => nav(`/expense/${e.id}/edit`)} aria-label="Edit"><Pencil size={20} /></button>}
          <button className="icon-btn" onClick={() => setConfirm(true)} aria-label="Delete"><Trash2 size={20} /></button>
        </>
      } />

      <div style={{ textAlign: 'center', padding: '4px 16px 8px' }}>
        <div className="tile lg" style={{ margin: '0 auto' }}>{categoryOf(isPayment ? 'payment' : e.category).emoji}</div>
        <div style={{ fontSize: 22, fontWeight: 800, marginTop: 10 }}>{isPayment ? `${name(e.payers[0].personId)} paid ${name(e.owed[0].personId)}` : e.description}</div>
        <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.02em' }}>{formatMoney(e.amount, e.currency)}</div>
        <div className="muted">{formatDate(e.date, true)}{group ? ` · ${group.name}` : ' · Non-group'}</div>
      </div>

      {!isPayment && (
        <>
          <div className="section-title">Paid by</div>
          <div className="card">
            {e.payers.map((p) => (
              <div className="row" key={p.personId}>
                <Avatar id={p.personId} name={nm(p.personId)} size="sm" />
                <div className="grow title">{name(p.personId)}</div>
                <b>{formatMoney(p.amount, e.currency)}</b>
              </div>
            ))}
          </div>
          <div className="section-title">Split {e.splitType === 'equal' ? 'equally' : e.splitType === 'exact' ? 'by exact amounts' : e.splitType === 'percent' ? 'by percentage' : e.splitType === 'shares' ? 'by shares' : 'by adjustment'}</div>
          <div className="card">
            {e.owed.map((p) => (
              <div className="row" key={p.personId}>
                <Avatar id={p.personId} name={nm(p.personId)} size="sm" />
                <div className="grow title">{name(p.personId)}</div>
                <span>{formatMoney(p.amount, e.currency)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {e.note && (<><div className="section-title">Notes</div><div className="card"><div className="row" style={{ whiteSpace: 'pre-wrap' }}>{e.note}</div></div></>)}
      <div className="hint" style={{ textAlign: 'center', marginTop: 20 }}>Added {new Date(e.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</div>

      {confirm && (
        <ConfirmSheet title={isPayment ? 'Delete payment?' : 'Delete expense?'} message="Balances will be recalculated. This can't be undone." confirmLabel="Delete" onClose={() => setConfirm(false)}
          onConfirm={() => { deleteExpense(e.id); toast('Deleted'); nav(-1); }} />
      )}
    </>
  );
}
