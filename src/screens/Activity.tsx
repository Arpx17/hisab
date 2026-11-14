import { useNavigate } from 'react-router-dom';
import { Empty, TopBar, usePeople } from '../components/ui';
import { timeAgo } from '../lib/util';
import type { ActivityKind } from '../lib/types';

const ICON: Record<ActivityKind, string> = {
  expense_added: '🧾',
  expense_edited: '✏️',
  expense_deleted: '🗑️',
  payment_added: '💸',
  payment_deleted: '🗑️',
  group_created: '👥',
  group_deleted: '🗑️',
  member_added: '➕',
  member_removed: '➖',
};

export default function ActivityScreen() {
  const { data } = usePeople();
  const nav = useNavigate();
  return (
    <>
      <TopBar title="Activity" back={false} />
      {data.activity.length === 0 ? (
        <Empty emoji="🕘" title="Nothing yet">Everything you add, edit or settle shows up here.</Empty>
      ) : (
        <div className="card">
          {data.activity.map((a) => {
            const exists = a.groupId && data.groups.some((g) => g.id === a.groupId);
            return (
              <button key={a.id} className="row" onClick={() => exists && nav(`/group/${a.groupId}`)}>
                <div className="tile">{ICON[a.kind]}</div>
                <div className="grow">
                  <div style={{ whiteSpace: 'normal' }}>{a.text}</div>
                  <div className="sub">{timeAgo(a.at)}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
