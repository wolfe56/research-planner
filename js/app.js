import { html, render, useState, useEffect, useMemo, useRef } from './lib.js';
import { DEMO, initAuth, auth, openData } from './store.js';
import { makeActions } from './actions.js';
import { usePref } from './hooks.js';
import { byOrder, gkey, isPending, isSamplePending, todayStr, downloadFile } from './util.js';
import { Login } from './login.js';
import { PlanView } from './plan.js';
import { CalendarView } from './calendar.js';
import { ShoppingView } from './shopping.js';
import { TaskEditor } from './editor.js';

// Lookup tables shared by every view, rebuilt whenever the data changes.
// Goals live in the 'experiments' collection; task.experimentId is the task's goal.
function buildIndex(d) {
  const projects = [...d.projects].sort(byOrder);
  const projById = Object.fromEntries(projects.map(p => [p.id, p]));
  const goalById = Object.fromEntries(d.experiments.map(e => [e.id, e]));
  const goalsByProject = {};
  for (const e of [...d.experiments].sort(byOrder)) (goalsByProject[e.projectId] ||= []).push(e);
  const taskById = Object.fromEntries(d.tasks.map(t => [t.id, t]));
  const tasksByGroup = {};
  for (const t of [...d.tasks].sort(byOrder)) (tasksByGroup[gkey(t.projectId, t.experimentId)] ||= []).push(t);

  // Materials belong to one experiment item (taskId) or are shared by a whole goal.
  const byTask = list => { const o = {}; for (const m of list) if (m.taskId) (o[m.taskId] ||= []).push(m); return o; };
  const byGoal = list => { const o = {}; for (const m of list) if (!m.taskId && m.experimentId) (o[m.experimentId] ||= []).push(m); return o; };
  const reagentsByTask = byTask(d.reagents), samplesByTask = byTask(d.samples);
  const reagentsByGoal = byGoal(d.reagents), samplesByGoal = byGoal(d.samples);
  const placeOf = m => {
    const t = m.taskId ? taskById[m.taskId] : null;
    return { project: projById[t ? t.projectId : m.projectId], goal: goalById[t ? t.experimentId : m.experimentId], task: t };
  };
  const pending = [...d.reagents.filter(isPending), ...d.samples.filter(isSamplePending)];
  const waitTask = new Set(pending.filter(m => m.taskId).map(m => m.taskId));
  const waitGoal = new Set(pending.filter(m => !m.taskId).map(m => m.experimentId));
  // A task waits while its own materials, or its goal's shared ones, haven't arrived.
  const isWaiting = t => !t.done && (waitTask.has(t.id) || (!!t.experimentId && waitGoal.has(t.experimentId)));
  const pendingInGoal = gid => pending.filter(m => (placeOf(m).goal || {}).id === gid).length;

  // A project's tasks in display order: tasks outside goals first, then each goal.
  const projectTasks = pid => [null, ...(goalsByProject[pid] || []).map(e => e.id)]
    .flatMap(g => tasksByGroup[gkey(pid, g)] || []);
  const nextTask = Object.fromEntries(projects.map(p => [p.id, projectTasks(p.id).find(t => !t.done)]));
  const colorOf = t => (projById[t.projectId] || {}).color || '#868e96';
  const msById = Object.fromEntries(d.milestones.map(m => [m.id, m]));
  const milestonesOf = pid => d.milestones.filter(m => m.projectId === pid).sort((a, b) => a.date.localeCompare(b.date));
  return {
    projects, projById, goalById, goalsByProject, taskById, tasksByGroup,
    reagentsByTask, samplesByTask, reagentsByGoal, samplesByGoal, placeOf, isWaiting, pendingInGoal,
    projectTasks, nextTask, colorOf, msById, milestonesOf,
  };
}

function downloadBackup(data) {
  const { projects, experiments, tasks, reagents, samples, milestones } = data;
  const backup = { app: 'research-planner', exportedAt: new Date().toISOString(), projects, experiments, tasks, reagents, samples, milestones };
  downloadFile(`research-planner-backup-${todayStr()}.json`, JSON.stringify(backup, null, 2), 'application/json');
}

function friendlyDataError(e) {
  if (e && e.code === 'permission-denied')
    return 'Firebase refused access to your data. Check that the rules in firestore.rules are published (Firebase console > Firestore > Rules).';
  return (e && e.message) || String(e);
}

function Main({ user }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [actions, setActions] = useState(null);
  const dataRef = useRef(null);
  dataRef.current = data;
  useEffect(() => {
    const api = openData(user.uid, setData, e => setError(friendlyDataError(e)));
    setActions(makeActions(api, () => dataRef.current));
    return () => api.close();
  }, [user.uid]);
  const idx = useMemo(() => data && buildIndex(data), [data]);
  const [view, setView] = usePref('view', 'plan');
  const [calDate, setCalDate] = useState(todayStr);
  const [projectId, setProjectId] = usePref('project', null);
  const [editingId, setEditingId] = useState(null);

  if (!data || !actions) return html`<div class="boot">${error || 'Loading your planner…'}</div>`;

  const toDo = data.reagents.filter(r => r.status === 'need').length
    + data.samples.filter(s => s.status === 'need_order' || s.status === 'need_produce').length;
  const tabs = [['plan', 'Plan'], ['calendar', 'Calendar'], ['materials', toDo ? `Materials · ${toDo}` : 'Materials']];
  const wanted = view === 'reagents' ? 'materials' : view;
  const current = tabs.some(t => t[0] === wanted) ? wanted : 'plan';
  const editing = editingId && data.tasks.find(t => t.id === editingId);
  const props = { data, idx, actions, openTask: setEditingId };

  return html`
    ${DEMO && html`<div class="banner">
      Demo mode: example data saved only in this browser. Your real planner isn’t touched; remove <code>?demo</code> from the address to sign in.
    </div>`}
    <header class="topbar">
      <div class="brand">Research Planner</div>
      <nav class="tabs">
        ${tabs.map(([k, label]) => html`
          <button class=${'tab' + (current === k ? ' active' : '')} onClick=${() => setView(k)}>${label}</button>`)}
      </nav>
      <div class="account">
        <span class="muted email">${user.email}</span>
        <button class="btn ghost small" title="Download all your planner data as a file" onClick=${() => downloadBackup(data)}>Backup</button>
        ${!DEMO && html`<button class="btn ghost small" onClick=${() => auth.signOut()}>Sign out</button>`}
      </div>
    </header>
    ${error && html`<div class="error-bar"><span>${error}</span><button class="btn ghost small" onClick=${() => setError(null)}>Dismiss</button></div>`}
    <main class=${'view-' + current}>
      ${current === 'plan' && html`<${PlanView} ...${props} projectId=${projectId} setProjectId=${setProjectId} />`}
      ${current === 'calendar' && html`<${CalendarView} ...${props} anchor=${calDate} setAnchor=${setCalDate} />`}
      ${current === 'materials' && html`<${ShoppingView} ...${props} />`}
    </main>
    ${editing && html`<${TaskEditor} key=${editing.id} task=${editing} ...${props} onClose=${() => setEditingId(null)} />`}
  `;
}

function App() {
  const [user, setUser] = useState(undefined);
  const [fatal, setFatal] = useState(null);
  useEffect(() => { initAuth(setUser).catch(e => setFatal(e.message || String(e))); }, []);
  if (fatal) return html`<div class="boot">Could not start the planner: ${fatal}</div>`;
  if (user === undefined) return html`<div class="boot">Loading…</div>`;
  return user ? html`<${Main} key=${user.uid} user=${user} />` : html`<${Login} />`;
}

const root = document.getElementById('app');
root.textContent = '';
render(html`<${App} />`, root);
