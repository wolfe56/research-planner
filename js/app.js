import { html, render, useState, useEffect, useMemo, useRef } from './lib.js';
import { DEMO, initAuth, auth, openData } from './store.js';
import { makeActions } from './actions.js';
import { usePref } from './hooks.js';
import { byOrder, gkey, isPending } from './util.js';
import { Login } from './login.js';
import { PlanView } from './plan.js';
import { CalendarView } from './calendar.js';
import { ShoppingView } from './shopping.js';
import { TaskEditor } from './editor.js';

// Lookup tables shared by every view, rebuilt whenever the data changes.
function buildIndex(d) {
  const projects = [...d.projects].sort(byOrder);
  const projById = Object.fromEntries(projects.map(p => [p.id, p]));
  const expById = Object.fromEntries(d.experiments.map(e => [e.id, e]));
  const expsByProject = {};
  for (const e of [...d.experiments].sort(byOrder)) (expsByProject[e.projectId] ||= []).push(e);
  const tasksByGroup = {};
  for (const t of [...d.tasks].sort(byOrder)) (tasksByGroup[gkey(t.projectId, t.experimentId)] ||= []).push(t);
  const reagentsByExp = {};
  for (const r of d.reagents) (reagentsByExp[r.experimentId] ||= []).push(r);
  // Experiments still waiting on reagents.
  const blocked = new Set(d.reagents.filter(isPending).map(r => r.experimentId));
  // A project's tasks in display order: tasks outside experiments first, then each experiment.
  const projectTasks = pid => [null, ...(expsByProject[pid] || []).map(e => e.id)]
    .flatMap(g => tasksByGroup[gkey(pid, g)] || []);
  const nextTask = Object.fromEntries(projects.map(p => [p.id, projectTasks(p.id).find(t => !t.done)]));
  const colorOf = t => (projById[t.projectId] || {}).color || '#868e96';
  return { projects, projById, expById, expsByProject, tasksByGroup, reagentsByExp, blocked, projectTasks, nextTask, colorOf };
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
  const [projectId, setProjectId] = usePref('project', null);
  const [editingId, setEditingId] = useState(null);

  if (!data || !actions) return html`<div class="boot">${error || 'Loading your planner…'}</div>`;

  const toOrder = data.reagents.filter(r => r.status === 'need').length;
  const tabs = [['plan', 'Plan'], ['calendar', 'Calendar'], ['reagents', toOrder ? `Reagents · ${toOrder}` : 'Reagents']];
  const current = tabs.some(t => t[0] === view) ? view : 'plan';
  const editing = editingId && data.tasks.find(t => t.id === editingId);
  const props = { data, idx, actions, openTask: setEditingId };

  return html`
    ${DEMO && html`<div class="banner">
      Demo mode: data is saved only in this browser. Add your Firebase settings to <code>js/firebase-config.js</code> to sign in and sync (see README).
    </div>`}
    <header class="topbar">
      <div class="brand">Research Planner</div>
      <nav class="tabs">
        ${tabs.map(([k, label]) => html`
          <button class=${'tab' + (current === k ? ' active' : '')} onClick=${() => setView(k)}>${label}</button>`)}
      </nav>
      <div class="account">
        <span class="muted email">${user.email}</span>
        ${!DEMO && html`<button class="btn ghost small" onClick=${() => auth.signOut()}>Sign out</button>`}
      </div>
    </header>
    ${error && html`<div class="error-bar"><span>${error}</span><button class="btn ghost small" onClick=${() => setError(null)}>Dismiss</button></div>`}
    <main class=${'view-' + current}>
      ${current === 'plan' && html`<${PlanView} ...${props} projectId=${projectId} setProjectId=${setProjectId} />`}
      ${current === 'calendar' && html`<${CalendarView} ...${props} />`}
      ${current === 'reagents' && html`<${ShoppingView} ...${props} />`}
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
