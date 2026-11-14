import { useSyncExternalStore } from 'react';
import type { Activity, ActivityKind, AppData, Expense, Group, ID, Person } from './types';
import { uid } from './util';
import { formatMoney } from './money';

const KEY = 'hisab.data.v1';

const emptyData = (): AppData => ({
  version: 1,
  people: [],
  groups: [],
  expenses: [],
  activity: [],
  settings: { meId: null, defaultCurrency: 'INR', theme: 'system' },
});

function load(): AppData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return migrate(JSON.parse(raw));
  } catch {
    /* fall through */
  }
  return emptyData();
}

function migrate(d: Partial<AppData>): AppData {
  const base = emptyData();
  return {
    version: 1,
    people: d.people ?? base.people,
    groups: d.groups ?? base.groups,
    expenses: d.expenses ?? base.expenses,
    activity: d.activity ?? base.activity,
    settings: { ...base.settings, ...(d.settings ?? {}) },
  };
}

let state: AppData = load();
const listeners = new Set<() => void>();

function commit(next: AppData) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Could not save', e);
  }
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const getState = () => state;
export function useData(): AppData {
  return useSyncExternalStore(subscribe, getState, getState);
}

const log = (s: AppData, kind: ActivityKind, text: string, groupId?: ID | null): AppData => {
  const a: Activity = { id: uid(), kind, at: Date.now(), text, groupId };
  return { ...s, activity: [a, ...s.activity].slice(0, 500) };
};

const nameOf = (s: AppData, id: ID) => (id === s.settings.meId ? 'You' : s.people.find((p) => p.id === id)?.name ?? 'Someone');

/* ---------- people ---------- */
export function addPerson(name: string): Person {
  const p: Person = { id: uid(), name: name.trim(), createdAt: Date.now() };
  commit({ ...state, people: [...state.people, p] });
  return p;
}

export function setupMe(name: string) {
  const p: Person = { id: uid(), name: name.trim(), createdAt: Date.now() };
  commit({ ...state, people: [...state.people, p], settings: { ...state.settings, meId: p.id } });
}

export function renamePerson(id: ID, name: string) {
  commit({ ...state, people: state.people.map((p) => (p.id === id ? { ...p, name: name.trim() } : p)) });
}

/** A person can only be deleted if no expenses reference them. */
export function personInUse(id: ID): boolean {
  return state.expenses.some((e) => e.payers.some((p) => p.personId === id) || e.owed.some((p) => p.personId === id));
}

export function deletePerson(id: ID): boolean {
  if (id === state.settings.meId || personInUse(id)) return false;
  commit({
    ...state,
    people: state.people.filter((p) => p.id !== id),
    groups: state.groups.map((g) => ({ ...g, memberIds: g.memberIds.filter((m) => m !== id) })),
  });
  return true;
}

/* ---------- groups ---------- */
export function saveGroup(g: Omit<Group, 'id' | 'createdAt'> & { id?: ID }): Group {
  if (g.id) {
    const existing = state.groups.find((x) => x.id === g.id)!;
    const updated: Group = { ...existing, ...g, id: g.id };
    commit({ ...state, groups: state.groups.map((x) => (x.id === g.id ? updated : x)) });
    return updated;
  }
  const created: Group = { ...g, id: uid(), createdAt: Date.now() };
  commit(log({ ...state, groups: [created, ...state.groups] }, 'group_created', `You created the group "${created.name}"`, created.id));
  return created;
}

export function deleteGroup(id: ID) {
  const g = state.groups.find((x) => x.id === id);
  if (!g) return;
  commit(
    log(
      { ...state, groups: state.groups.filter((x) => x.id !== id), expenses: state.expenses.filter((e) => e.groupId !== id) },
      'group_deleted',
      `You deleted the group "${g.name}"`,
      null,
    ),
  );
}

export function addMember(groupId: ID, personId: ID) {
  const g = state.groups.find((x) => x.id === groupId);
  if (!g || g.memberIds.includes(personId)) return;
  commit(
    log(
      { ...state, groups: state.groups.map((x) => (x.id === groupId ? { ...x, memberIds: [...x.memberIds, personId] } : x)) },
      'member_added',
      `${nameOf(state, personId)} added to "${g.name}"`,
      groupId,
    ),
  );
}

/** Remove a member from a group — only allowed once they have no expenses in it. */
export function removeMember(groupId: ID, personId: ID): boolean {
  const g = state.groups.find((x) => x.id === groupId);
  if (!g) return false;
  const used = state.expenses.some(
    (e) => e.groupId === groupId && (e.payers.some((p) => p.personId === personId) || e.owed.some((p) => p.personId === personId)),
  );
  if (used) return false;
  commit(
    log(
      { ...state, groups: state.groups.map((x) => (x.id === groupId ? { ...x, memberIds: x.memberIds.filter((m) => m !== personId) } : x)) },
      'member_removed',
      `${nameOf(state, personId)} removed from "${g.name}"`,
      groupId,
    ),
  );
  return true;
}

/* ---------- expenses ---------- */
export type ExpenseDraft = Omit<Expense, 'id' | 'createdAt' | 'updatedAt'> & { id?: ID };

export function saveExpense(d: ExpenseDraft): Expense {
  const now = Date.now();
  const where = d.groupId ? ` in "${state.groups.find((g) => g.id === d.groupId)?.name ?? ''}"` : '';
  if (d.id) {
    const old = state.expenses.find((e) => e.id === d.id)!;
    const updated: Expense = { ...old, ...d, id: d.id, updatedAt: now };
    commit(
      log(
        { ...state, expenses: state.expenses.map((e) => (e.id === d.id ? updated : e)) },
        updated.kind === 'payment' ? 'payment_added' : 'expense_edited',
        updated.kind === 'payment' ? `You updated a payment${where}` : `You edited "${updated.description}"${where}`,
        updated.groupId,
      ),
    );
    return updated;
  }
  const created: Expense = { ...d, id: uid(), createdAt: now, updatedAt: now };
  const text =
    created.kind === 'payment'
      ? `${nameOf(state, created.payers[0].personId)} paid ${nameOf(state, created.owed[0].personId)} ${formatMoney(created.amount, created.currency)}${where}`
      : `You added "${created.description}" (${formatMoney(created.amount, created.currency)})${where}`;
  commit(log({ ...state, expenses: [created, ...state.expenses] }, created.kind === 'payment' ? 'payment_added' : 'expense_added', text, created.groupId));
  return created;
}

export function deleteExpense(id: ID) {
  const e = state.expenses.find((x) => x.id === id);
  if (!e) return;
  commit(
    log(
      { ...state, expenses: state.expenses.filter((x) => x.id !== id) },
      e.kind === 'payment' ? 'payment_deleted' : 'expense_deleted',
      e.kind === 'payment' ? `You deleted a payment of ${formatMoney(e.amount, e.currency)}` : `You deleted "${e.description}"`,
      e.groupId,
    ),
  );
}

/* ---------- settings & backup ---------- */
export function updateSettings(patch: Partial<AppData['settings']>) {
  commit({ ...state, settings: { ...state.settings, ...patch } });
}

export function exportJSON(): string {
  return JSON.stringify(state, null, 2);
}

export function importJSON(text: string): boolean {
  try {
    const parsed = JSON.parse(text);
    if (!parsed || !Array.isArray(parsed.people) || !Array.isArray(parsed.expenses) || !Array.isArray(parsed.groups)) return false;
    commit(migrate(parsed));
    return true;
  } catch {
    return false;
  }
}

export function resetAll() {
  commit(emptyData());
}

/** True when the person appears in any expense of the group (so they cannot be removed). */
export function memberInUse(groupId: ID, personId: ID): boolean {
  return state.expenses.some(
    (e) => e.groupId === groupId && (e.payers.some((p) => p.personId === personId) || e.owed.some((p) => p.personId === personId)),
  );
}
