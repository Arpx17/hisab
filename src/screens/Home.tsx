import { useNavigate } from 'react-router-dom';
import { Plus, Users } from 'lucide-react';
import { Empty, TopBar, usePeople } from '../components/ui';
import { Balance } from '../components/money';
import { formatMoney } from '../lib/money';
import { overall, myGroupNet } from '../lib/summary';
import { groupEmoji } from '../lib/categories';

export default function Home() {
  const { data, meId, fullName } = usePeople();
  const nav = useNavigate();
  const ov = overall(data, meId!);

  return (
    <>
      <TopBar title="Groups" back={false} right={
        <button className="icon-btn" onClick={() => nav('/group/new')} aria-label="New group">
          <Users size={22} />
        </button>
      } />

      <div className="hero">
        {ov.length === 0 ? (
          <>
            <div className="label">Overall balance</div>
            <div className="big">All settled up 🎉</div>
          </>
        ) : (
          ov.map((o, i) => {
            const net = o.owed - o.owe;
            return (
              <div key={o.currency} style={i > 0 ? { marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,.25)' } : undefined}>
                <div className="label">{net >= 0 ? 'Overall, you are owed' : 'Overall, you owe'}</div>
                <div className="big">{formatMoney(Math.abs(net), o.currency)}</div>
                <div className="split">
                  <div><span style={{ opacity: .8 }}>You are owed</span><b>{formatMoney(o.owed, o.currency)}</b></div>
                  <div><span style={{ opacity: .8 }}>You owe</span><b>{formatMoney(o.owe, o.currency)}</b></div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {data.groups.length === 0 ? (
        <Empty emoji="👥" title="No groups yet">
          Create a group for a trip, your flat or a night out, then add friends by name.
          <div style={{ marginTop: 18 }}>
            <button className="btn" onClick={() => nav('/group/new')}>
              <Plus size={20} /> Create a group
            </button>
          </div>
        </Empty>
      ) : (
        <>
          <div className="section-title">Your groups</div>
          <div className="card">
            {data.groups.map((g) => {
              const net = myGroupNet(data.expenses.filter((e) => e.groupId === g.id), meId!);
              const others = g.memberIds.filter((m) => m !== meId).map(fullName);
              return (
                <button key={g.id} className="row" onClick={() => nav(`/group/${g.id}`)}>
                  <div className="tile">{groupEmoji(g.type)}</div>
                  <div className="grow">
                    <div className="title">{g.name}</div>
                    <div className="sub">{others.length ? others.join(', ') : 'Just you so far'}</div>
                  </div>
                  <div className="end">
                    {net === 0 ? (
                      <div className="tiny">settled up</div>
                    ) : (
                      <>
                        <div className="tiny">{net > 0 ? 'you are owed' : 'you owe'}</div>
                        <div className="amt"><Balance amount={net} currency={g.currency} /></div>
                      </>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      <button className="fab" onClick={() => nav('/expense/new')}>
        <Plus size={22} /> Add expense
      </button>
    </>
  );
}
