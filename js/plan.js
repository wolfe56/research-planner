import { html, useState } from './lib.js';
import { usePref } from './hooks.js';
import { startDrag, justDragged } from './drag.js';
import { EditableText, FlaskIcon } from './widgets.js';
import { MaterialsPanel } from './materials.js';
import {
  PALETTE, ROLES, roleLabel, DURATIONS, gkey, isPending, isSamplePending,
  fmtDur, fmtShortDate, fmtWhen, todayStr, parseDate,
} from './util.js';

// True when the pointer is in the first half of el (left half for horizontal lists).
function inFirstHalf(el, pt, horizontal = false) {
  const r = el.getBoundingClientRect();
  return horizontal ? pt.x < r.left + r.width / 2 : pt.y < r.top + r.height / 2;
}

export function PlanView({ data, idx, actions, openTask, projectId, setProjectId }) {
  const project = idx.projById[projectId] || idx.projects[0] || null;
  const [hideDone, setHideDone] = usePref('hideDone', false);
  return html`<div class="plan">
    <${ProjectList} idx=${idx} actions=${actions} current=${project && project.id} onSelect=${setProjectId} />
    ${project
      ? html`<${ProjectDetail} key=${project.id} project=${project} data=${data} idx=${idx} actions=${actions}
          openTask=${openTask} hideDone=${hideDone} setHideDone=${setHideDone} />`
      : html`<div class="card empty">
          <h2>Start with a project</h2>
          <p class="muted">Add your first project on the left: your main project, DARPA PROSE, or a paper you’re supporting.</p>
        </div>`}
  </div>`;
}

function ProjectList({ idx, actions, current, onSelect }) {
  const [name, setName] = useState('');
  const add = e => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    onSelect(actions.addProject(n));
    setName('');
  };
  const drag = (e, p) => startDrag(e, {
    label: p.name,
    color: p.color,
    resolve: (el, pt) => {
      if (el.dataset.drop !== 'project' || el.dataset.id === p.id) return null;
      const horizontal = getComputedStyle(el.parentElement).flexDirection === 'row';
      const first = inFirstHalf(el, pt, horizontal);
      return {
        before: first ? el.dataset.id : el.dataset.next || null,
        cls: horizontal ? (first ? 'drop-left' : 'drop-right') : first ? 'drop-before' : 'drop-after',
      };
    },
    onDrop: d => actions.moveProject(p.id, d.before),
  });
  return html`<aside class="proj-list">
    <div class="section-label">Projects</div>
    ${idx.projects.map((p, i) => {
      const next = idx.nextTask[p.id];
      return html`<button key=${p.id} class=${'proj-item' + (p.id === current ? ' active' : '')} style=${{ '--c': p.color }}
        data-drop="project" data-id=${p.id} data-next=${(idx.projects[i + 1] || {}).id || ''} data-name=${p.name}
        onClick=${() => !justDragged() && onSelect(p.id)}>
        <span class="grip" title="Drag to reorder" onPointerDown=${e => drag(e, p)}>⠿</span>
        <span class="dot"></span>
        <span class="proj-text">
          <span class="proj-name">${p.name}</span>
          <span class="proj-next">${next ? 'Next: ' + next.title : 'No open tasks'}</span>
        </span>
        <span class="role">${roleLabel(p.role)}</span>
      </button>`;
    })}
    <form class="add-row" onSubmit=${add}>
      <input placeholder="New project…" value=${name} onInput=${e => setName(e.target.value)} />
      <button class="btn">Add</button>
    </form>
  </aside>`;
}

function ProjectDetail({ project, data, idx, actions, openTask, hideDone, setHideDone }) {
  const goals = idx.goalsByProject[project.id] || [];
  const [goalName, setGoalName] = useState('');
  const open = idx.projectTasks(project.id).filter(t => !t.done);
  const addGoal = e => {
    e.preventDefault();
    const n = goalName.trim();
    if (!n) return;
    actions.addGoal(project.id, n);
    setGoalName('');
  };
  const remove = () => {
    if (confirm(`Delete “${project.name}” with all its goals, tasks, materials and milestones?`)) actions.deleteProject(project.id);
  };
  const shared = { project, idx, actions, openTask, hideDone };

  return html`<section class="proj-detail" style=${{ '--c': project.color }}>
    <div class="card proj-head">
      <div class="proj-head-row">
        <${EditableText} className="h1" value=${project.name} onSave=${name => actions.updateProject(project.id, { name })} />
        <select value=${project.role} onChange=${e => actions.updateProject(project.id, { role: e.target.value })} aria-label="Your role">
          ${ROLES.map(([v, l]) => html`<option value=${v}>${l}</option>`)}
        </select>
        <button class="btn ghost small danger" onClick=${remove}>Delete project</button>
      </div>
      <div class="swatches">
        ${PALETTE.map(c => html`<button class=${'swatch' + (c === project.color ? ' on' : '')} style=${{ background: c }}
          aria-label="Project colour" onClick=${() => actions.updateProject(project.id, { color: c })}></button>`)}
      </div>
      <div class="proj-head-row small">
        <span class="muted">${open.length} open item${open.length === 1 ? '' : 's'} · ${fmtDur(open.reduce((s, t) => s + (t.durationMin || 0), 0))} of work left</span>
        <span class="spacer"></span>
        <label class="check"><input type="checkbox" checked=${hideDone} onChange=${e => setHideDone(e.target.checked)} /> Hide completed</label>
      </div>
    </div>

    <${Milestones} project=${project} data=${data} idx=${idx} actions=${actions} />

    <div class="card">
      <div class="card-head"><h3>Project tasks</h3><span class="muted small">not under a goal</span></div>
      <${TaskList} ...${shared} goalId=${null} />
      <${AddTask} defaultKind="task" onAdd=${(title, dur, kind) => actions.addTask(project.id, null, title, dur, kind)} />
    </div>

    ${goals.map((g, i) => html`<${GoalCard} key=${g.id} goal=${g} next=${goals[i + 1] && goals[i + 1].id} ...${shared} />`)}

    <form class="card add-row" onSubmit=${addGoal}>
      <input placeholder="New goal, e.g. Get data for the permutants…" value=${goalName} onInput=${e => setGoalName(e.target.value)} />
      <button class="btn">Add goal</button>
    </form>
  </section>`;
}

function Milestones({ project, data, idx, actions }) {
  const list = idx.milestonesOf(project.id);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const today = parseDate(todayStr());
  const add = e => {
    e.preventDefault();
    if (!title.trim() || !date) return;
    actions.addMilestone(project.id, title.trim(), date);
    setTitle('');
    setDate('');
  };
  return html`<div class="card">
    <div class="card-head"><h3>Milestones and deadlines</h3></div>
    ${list.length
      ? html`<ul class="milestones">${list.map(m => {
          const days = Math.round((parseDate(m.date) - today) / 864e5);
          const linked = data.tasks.filter(t => t.milestoneId === m.id && !t.done);
          const unscheduled = linked.filter(t => !t.start).length;
          const late = linked.filter(t => t.start && t.start.slice(0, 10) > m.date).length;
          return html`<li key=${m.id} class=${days < 0 ? 'past' : ''}>
            <span class="diamond">◆</span>
            <span class="ms-date">${fmtShortDate(m.date)}</span>
            <span class="ms-title">${m.title}</span>
            <span class="chips">
              ${linked.length > 0 && html`<span class="chip">${linked.length} open</span>`}
              ${unscheduled > 0 && html`<span class="chip warn">${unscheduled} not scheduled</span>`}
              ${late > 0 && html`<span class="chip danger">${late} after deadline</span>`}
            </span>
            <span class="muted small nowrap">${days === 0 ? 'today' : days > 0 ? `in ${days} d` : `${-days} d ago`}</span>
            <button class="icon-btn" aria-label="Delete milestone" onClick=${() => actions.deleteMilestone(m.id)}>×</button>
          </li>`;
        })}</ul>`
      : html`<p class="muted small">Fixed dates such as DARPA milestones or report deadlines. They show on the calendar,
          and you can link tasks to them from a task’s editor.</p>`}
    <form class="add-row" onSubmit=${add}>
      <input placeholder="Milestone…" value=${title} onInput=${e => setTitle(e.target.value)} />
      <input type="date" value=${date} onInput=${e => setDate(e.target.value)} aria-label="Milestone date" />
      <button class="btn">Add</button>
    </form>
  </div>`;
}

function GoalCard({ goal, next, project, idx, actions, openTask, hideDone }) {
  const tasks = idx.tasksByGroup[gkey(project.id, goal.id)] || [];
  const sharedReagents = idx.reagentsByGoal[goal.id] || [];
  const sharedSamples = idx.samplesByGoal[goal.id] || [];
  const pending = idx.pendingInGoal(goal.id);
  const [open, setOpen] = useState(true);
  const [showShared, setShowShared] = useState(false);
  const done = tasks.filter(t => t.done).length;
  const left = tasks.filter(t => !t.done).reduce((s, t) => s + (t.durationMin || 0), 0);
  const remove = () => {
    if (confirm(`Delete goal “${goal.name}” with its ${tasks.length} items and their materials?`)) actions.deleteGoal(goal.id);
  };
  const drag = e => startDrag(e, {
    label: goal.name,
    color: project.color,
    resolve: (el, pt) => {
      const card = el.closest('[data-drop="goal"]');
      if (!card || card.dataset.id === goal.id) return null;
      const first = inFirstHalf(card, pt);
      return { before: first ? card.dataset.id : card.dataset.next || null, cls: first ? 'drop-before' : 'drop-after', el: card };
    },
    onDrop: d => actions.moveGoal(goal.id, d.before),
  });
  const sharedCount = sharedReagents.length + sharedSamples.length;

  return html`<div class="card goal" data-drop="goal" data-id=${goal.id} data-next=${next || ''}>
    <div class="card-head">
      <span class="grip" title="Drag to reorder goals" onPointerDown=${drag}>⠿</span>
      <button class="icon-btn" onClick=${() => setOpen(!open)} aria-label=${open ? 'Collapse' : 'Expand'}>${open ? '▾' : '▸'}</button>
      <span class="goal-label">Goal</span>
      <${EditableText} className="h3" value=${goal.name} onSave=${name => actions.updateGoal(goal.id, { name })} />
      <span class="muted small nowrap">${done}/${tasks.length} done · ${fmtDur(left)} left</span>
      ${pending > 0 && html`<span class="chip warn" title="Items wait until these arrive or are produced">${pending} material${pending > 1 ? 's' : ''} pending</span>`}
      <button class="icon-btn" onClick=${remove} aria-label="Delete goal">×</button>
    </div>
    ${open && html`
      <${TaskList} project=${project} idx=${idx} actions=${actions} openTask=${openTask} hideDone=${hideDone} goalId=${goal.id} />
      <${AddTask} defaultKind="experiment" onAdd=${(title, dur, kind) => actions.addTask(project.id, goal.id, title, dur, kind)} />
      <button class="link small shared-toggle" onClick=${() => setShowShared(!showShared)}>
        ${showShared ? 'Hide' : 'Show'} materials shared by the whole goal (${sharedCount})</button>
      ${showShared && html`<${MaterialsPanel} projectId=${project.id} goalId=${goal.id} taskId=${null}
        reagents=${sharedReagents} samples=${sharedSamples} actions=${actions} />`}
    `}
  </div>`;
}

function TaskList({ project, goalId, idx, actions, openTask, hideDone }) {
  const all = idx.tasksByGroup[gkey(project.id, goalId)] || [];
  const tasks = hideDone ? all.filter(t => !t.done) : all;

  const drag = (e, t) => startDrag(e, {
    label: t.title,
    color: project.color,
    resolve: (el, pt) => {
      const kind = el.dataset.drop;
      if (kind === 'task') {
        if (el.dataset.id === t.id) return null;
        const first = inFirstHalf(el, pt);
        return { project: project.id, goal: el.dataset.goal || null, before: first ? el.dataset.id : el.dataset.next || null, cls: first ? 'drop-before' : 'drop-after' };
      }
      if (kind === 'group') return { project: project.id, goal: el.dataset.goal || null, before: null, label: 'Move here' };
      if (kind === 'goal') return { project: project.id, goal: el.dataset.id, before: null, label: 'Move into this goal' };
      if (kind === 'project' && el.dataset.id !== project.id) return { project: el.dataset.id, goal: null, before: null, label: 'Move to ' + el.dataset.name };
      return null;
    },
    onDrop: d => actions.moveTask(t.id, d.project, d.goal, d.before),
  });

  return html`<ul class="tasks" data-drop="group" data-goal=${goalId || ''}>
    ${tasks.map((t, i) => html`<${TaskRow} key=${t.id} t=${t} next=${tasks[i + 1] && tasks[i + 1].id} project=${project}
      idx=${idx} actions=${actions} openTask=${openTask} onGrip=${e => drag(e, t)} />`)}
    ${!tasks.length && html`<li class="tasks-empty muted">Nothing here yet. Add an item below or drag one here.</li>`}
  </ul>`;
}

function TaskRow({ t, next, project, idx, actions, openTask, onGrip }) {
  const [showMaterials, setShowMaterials] = useState(false);
  const today = todayStr();
  const isExp = t.kind === 'experiment';
  const reagents = idx.reagentsByTask[t.id] || [];
  const samples = idx.samplesByTask[t.id] || [];
  const pending = reagents.filter(isPending).length + samples.filter(isSamplePending).length;
  const ms = t.milestoneId && idx.msById[t.milestoneId];
  const late = ms && t.start && t.start.slice(0, 10) > ms.date;
  const overdue = !t.done && t.dueDate && t.dueDate < today;

  const row = html`<li class=${'task' + (t.done ? ' done' : '')} data-drop="task" data-id=${t.id} data-goal=${t.experimentId || ''} data-next=${next || ''}>
    <span class="grip" title="Drag to reorder or move" onPointerDown=${onGrip}>⠿</span>
    <input type="checkbox" checked=${!!t.done} aria-label="Done" onChange=${e => actions.updateTask(t.id, { done: e.target.checked })} />
    ${isExp && html`<${FlaskIcon} />`}
    <button class="task-title" onClick=${() => !justDragged() && openTask(t.id)}>${t.title}</button>
    <button class=${'prio' + (t.high ? ' on' : '')} title=${t.high ? 'High priority (click to clear)' : 'Mark as high priority'}
      aria-pressed=${!!t.high} onClick=${() => actions.toggleHigh(t.id)}>!</button>
    <span class="chips">
      ${isExp && html`<button class=${'chip chip-btn' + (pending ? ' warn' : '')} onClick=${() => setShowMaterials(!showMaterials)}>
        ${pending ? `${pending} pending` : 'Materials'} (${reagents.length + samples.length}) ${showMaterials ? '▴' : '▾'}</button>`}
      ${!isExp && idx.isWaiting(t) && html`<span class="chip warn" title="Waiting on the goal’s shared materials">waiting</span>`}
      ${!t.done && t.slipped > 0 && html`<span class="chip warn" title="Times this was rescheduled after being missed">slipped ${t.slipped}×</span>`}
      ${ms && html`<span class=${'chip' + (late ? ' danger' : '')} title=${'Counts toward: ' + ms.title}>◆ ${fmtShortDate(ms.date)}</span>`}
      ${t.dueDate && html`<span class=${'chip' + (overdue ? ' danger' : '')}>due ${fmtShortDate(t.dueDate)}</span>`}
      ${t.start && html`<span class="chip sched">${fmtWhen(t.start)}</span>`}
      <span class="chip">${fmtDur(t.durationMin)}</span>
    </span>
  </li>`;
  if (!(isExp && showMaterials)) return row;
  return [row, html`<li class="task-materials" key=${t.id + '-m'}>
    <${MaterialsPanel} projectId=${project.id} goalId=${t.experimentId || null} taskId=${t.id}
      reagents=${reagents} samples=${samples} actions=${actions} />
  </li>`];
}

function AddTask({ onAdd, defaultKind }) {
  const [title, setTitle] = useState('');
  const [dur, setDur] = useState(60);
  const [kind, setKind] = useState(defaultKind);
  const submit = e => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    onAdd(t, dur, kind);
    setTitle('');
  };
  return html`<form class="add-row" onSubmit=${submit}>
    <select value=${kind} onChange=${e => setKind(e.target.value)} aria-label="Type">
      <option value="experiment">Experiment</option>
      <option value="task">Task</option>
    </select>
    <input placeholder=${kind === 'experiment' ? 'Add an experiment…' : 'Add a task…'} value=${title} onInput=${e => setTitle(e.target.value)} />
    <select value=${dur} onChange=${e => setDur(+e.target.value)} aria-label="Duration">
      ${DURATIONS.map(d => html`<option value=${d}>${fmtDur(d)}</option>`)}
    </select>
    <button class="btn">Add</button>
  </form>`;
}
