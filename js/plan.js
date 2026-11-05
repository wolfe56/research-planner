import { html, useState, useEffect } from './lib.js';
import { usePref } from './hooks.js';
import { startDrag, justDragged } from './drag.js';
import {
  PALETTE, ROLES, roleLabel, DURATIONS, REAGENT_STATUS, gkey, isPending,
  fmtDur, fmtShortDate, fmtWhen, todayStr, parseDate,
} from './util.js';

// A text input styled as plain text; saves on Enter or blur, Escape reverts.
export function EditableText({ value, onSave, placeholder = '', className = '', allowEmpty = false }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const commit = raw => {
    const t = raw.trim();
    if (t !== value && (t || allowEmpty)) onSave(t);
    else setV(value);
  };
  return html`<input class=${'inline-edit ' + className} value=${v} placeholder=${placeholder}
    onInput=${e => setV(e.target.value)}
    onBlur=${e => commit(e.target.value)}
    onKeyDown=${e => {
      if (e.key === 'Enter') e.target.blur();
      if (e.key === 'Escape') { e.target.value = value; setV(value); e.target.blur(); }
    }} />`;
}

export function PlanView({ data, idx, actions, openTask, projectId, setProjectId }) {
  const project = idx.projById[projectId] || idx.projects[0] || null;
  const [hideDone, setHideDone] = usePref('hideDone', false);
  const shared = { data, idx, actions, openTask, hideDone };
  return html`<div class="plan">
    <${ProjectList} idx=${idx} actions=${actions} current=${project && project.id} onSelect=${setProjectId} />
    ${project
      ? html`<${ProjectDetail} key=${project.id} project=${project} ...${shared} setHideDone=${setHideDone} />`
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
  return html`<aside class="proj-list">
    <div class="section-label">Projects</div>
    ${idx.projects.map(p => {
      const next = idx.nextTask[p.id];
      return html`<button key=${p.id} class=${'proj-item' + (p.id === current ? ' active' : '')} style=${{ '--c': p.color }} onClick=${() => onSelect(p.id)}>
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
  const exps = idx.expsByProject[project.id] || [];
  const [expName, setExpName] = useState('');
  const open = idx.projectTasks(project.id).filter(t => !t.done);
  const addExp = e => {
    e.preventDefault();
    const n = expName.trim();
    if (!n) return;
    actions.addExperiment(project.id, n);
    setExpName('');
  };
  const remove = () => {
    if (confirm(`Delete “${project.name}” with all its experiments, tasks, reagents and milestones?`)) actions.deleteProject(project.id);
  };
  const shared = { project, data, idx, actions, openTask, hideDone };

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
        <span class="muted">${open.length} open task${open.length === 1 ? '' : 's'} · ${fmtDur(open.reduce((s, t) => s + (t.durationMin || 0), 0))} of work left</span>
        <span class="spacer"></span>
        <label class="check"><input type="checkbox" checked=${hideDone} onChange=${e => setHideDone(e.target.checked)} /> Hide completed</label>
      </div>
    </div>

    <${Milestones} project=${project} data=${data} actions=${actions} />

    <div class="card">
      <div class="card-head"><h3>Project tasks</h3><span class="muted small">not tied to an experiment</span></div>
      <${TaskList} ...${shared} experimentId=${null} />
      <${AddTask} onAdd=${(title, dur) => actions.addTask(project.id, null, title, dur)} />
    </div>

    ${exps.map(e => html`<${ExperimentCard} key=${e.id} exp=${e} ...${shared} />`)}

    <form class="card add-row" onSubmit=${addExp}>
      <input placeholder="New experiment…" value=${expName} onInput=${e => setExpName(e.target.value)} />
      <button class="btn">Add experiment</button>
    </form>
  </section>`;
}

function Milestones({ project, data, actions }) {
  const list = data.milestones.filter(m => m.projectId === project.id).sort((a, b) => a.date.localeCompare(b.date));
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
          return html`<li key=${m.id} class=${days < 0 ? 'past' : ''}>
            <span class="diamond">◆</span>
            <span class="ms-date">${fmtShortDate(m.date)}</span>
            <span class="ms-title">${m.title}</span>
            <span class="muted small nowrap">${days === 0 ? 'today' : days > 0 ? `in ${days} d` : `${-days} d ago`}</span>
            <button class="icon-btn" aria-label="Delete milestone" onClick=${() => actions.deleteMilestone(m.id)}>×</button>
          </li>`;
        })}</ul>`
      : html`<p class="muted small">Fixed dates such as DARPA milestones or report deadlines. They show on the calendar.</p>`}
    <form class="add-row" onSubmit=${add}>
      <input placeholder="Milestone…" value=${title} onInput=${e => setTitle(e.target.value)} />
      <input type="date" value=${date} onInput=${e => setDate(e.target.value)} aria-label="Milestone date" />
      <button class="btn">Add</button>
    </form>
  </div>`;
}

function ExperimentCard({ exp, project, data, idx, actions, openTask, hideDone }) {
  const tasks = idx.tasksByGroup[gkey(project.id, exp.id)] || [];
  const reagents = idx.reagentsByExp[exp.id] || [];
  const pending = reagents.filter(isPending);
  const [open, setOpen] = useState(true);
  const [showReagents, setShowReagents] = useState(pending.length > 0);
  const done = tasks.filter(t => t.done).length;
  const left = tasks.filter(t => !t.done).reduce((s, t) => s + (t.durationMin || 0), 0);
  const remove = () => {
    if (confirm(`Delete experiment “${exp.name}” with its ${tasks.length} tasks and ${reagents.length} reagents?`)) actions.deleteExperiment(exp.id);
  };
  return html`<div class="card exp">
    <div class="card-head">
      <button class="icon-btn" onClick=${() => setOpen(!open)} aria-label=${open ? 'Collapse' : 'Expand'}>${open ? '▾' : '▸'}</button>
      <${EditableText} className="h3" value=${exp.name} onSave=${name => actions.updateExperiment(exp.id, { name })} />
      <span class="muted small nowrap">${done}/${tasks.length} done · ${fmtDur(left)} left</span>
      ${pending.length > 0 && html`<span class="chip warn" title="Tasks in this experiment wait until these reagents arrive">
        ${pending.length} reagent${pending.length > 1 ? 's' : ''} pending</span>`}
      <button class="icon-btn" onClick=${remove} aria-label="Delete experiment">×</button>
    </div>
    ${open && html`
      <${TaskList} project=${project} idx=${idx} actions=${actions} openTask=${openTask} hideDone=${hideDone} experimentId=${exp.id} />
      <${AddTask} onAdd=${(title, dur) => actions.addTask(project.id, exp.id, title, dur)} />
      <button class="link small reagent-toggle" onClick=${() => setShowReagents(!showReagents)}>
        ${showReagents ? 'Hide' : 'Show'} reagents (${reagents.length})</button>
      ${showReagents && html`<${Reagents} project=${project} experimentId=${exp.id} reagents=${reagents} actions=${actions} />`}
    `}
  </div>`;
}

function TaskList({ project, experimentId, idx, actions, openTask, hideDone }) {
  const all = idx.tasksByGroup[gkey(project.id, experimentId)] || [];
  const tasks = hideDone ? all.filter(t => !t.done) : all;
  const waiting = !!experimentId && idx.blocked.has(experimentId);

  const drag = (e, t) => startDrag(e, {
    label: t.title,
    color: project.color,
    resolve: (el, pt) => {
      if (el.dataset.drop === 'task') {
        if (el.dataset.id === t.id) return null;
        const r = el.getBoundingClientRect();
        const after = pt.y > r.top + r.height / 2;
        return { exp: el.dataset.exp || null, before: after ? el.dataset.next || null : el.dataset.id, cls: after ? 'drop-after' : 'drop-before' };
      }
      if (el.dataset.drop === 'group') return { exp: el.dataset.exp || null, before: null, label: 'Move here' };
      return null;
    },
    onDrop: d => actions.moveTask(t.id, project.id, d.exp, d.before),
  });

  return html`<ul class="tasks" data-drop="group" data-exp=${experimentId || ''}>
    ${tasks.map((t, i) => html`<${TaskRow} key=${t.id} t=${t} next=${tasks[i + 1] && tasks[i + 1].id}
      waiting=${waiting} actions=${actions} openTask=${openTask} onGrip=${e => drag(e, t)} />`)}
    ${!tasks.length && html`<li class="tasks-empty muted">No tasks yet. Add one below or drag one here.</li>`}
  </ul>`;
}

function TaskRow({ t, next, waiting, actions, openTask, onGrip }) {
  const overdue = !t.done && t.dueDate && t.dueDate < todayStr();
  return html`<li class=${'task' + (t.done ? ' done' : '')} data-drop="task" data-id=${t.id} data-exp=${t.experimentId || ''} data-next=${next || ''}>
    <span class="grip" title="Drag to reorder or move" onPointerDown=${onGrip}>⠿</span>
    <input type="checkbox" checked=${!!t.done} aria-label="Done" onChange=${e => actions.updateTask(t.id, { done: e.target.checked })} />
    <button class="task-title" onClick=${() => !justDragged() && openTask(t.id)}>${t.title}</button>
    <span class="chips">
      ${waiting && !t.done && html`<span class="chip warn" title="Waiting on reagents">reagents</span>`}
      ${t.dueDate && html`<span class=${'chip' + (overdue ? ' danger' : '')}>due ${fmtShortDate(t.dueDate)}</span>`}
      ${t.start && html`<span class="chip sched">${fmtWhen(t.start)}</span>`}
      <span class="chip">${fmtDur(t.durationMin)}</span>
    </span>
  </li>`;
}

function AddTask({ onAdd }) {
  const [title, setTitle] = useState('');
  const [dur, setDur] = useState(60);
  const submit = e => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    onAdd(t, dur);
    setTitle('');
  };
  return html`<form class="add-row" onSubmit=${submit}>
    <input placeholder="Add a task…" value=${title} onInput=${e => setTitle(e.target.value)} />
    <select value=${dur} onChange=${e => setDur(+e.target.value)} aria-label="Duration">
      ${DURATIONS.map(d => html`<option value=${d}>${fmtDur(d)}</option>`)}
    </select>
    <button class="btn">Add</button>
  </form>`;
}

function Reagents({ project, experimentId, reagents, actions }) {
  const [name, setName] = useState('');
  const [vendor, setVendor] = useState('');
  const add = e => {
    e.preventDefault();
    if (!name.trim()) return;
    actions.addReagent(project.id, experimentId, name.trim(), vendor.trim());
    setName('');
    setVendor('');
  };
  const set = (r, k) => v => actions.updateReagent(r.id, { [k]: v });
  return html`<div class="reagents">
    ${reagents.map(r => html`<div class="reagent" key=${r.id}>
      <${EditableText} value=${r.name} onSave=${set(r, 'name')} />
      <${EditableText} className="small" value=${r.vendor || ''} placeholder="Vendor" allowEmpty onSave=${set(r, 'vendor')} />
      <${EditableText} className="small" value=${r.catalog || ''} placeholder="Cat. #" allowEmpty onSave=${set(r, 'catalog')} />
      <select class=${'status s-' + r.status} value=${r.status} onChange=${e => actions.updateReagent(r.id, { status: e.target.value })} aria-label="Status">
        ${Object.entries(REAGENT_STATUS).map(([v, l]) => html`<option value=${v}>${l}</option>`)}
      </select>
      <button class="icon-btn" aria-label="Remove reagent" onClick=${() => actions.deleteReagent(r.id)}>×</button>
    </div>`)}
    <form class="add-row" onSubmit=${add}>
      <input placeholder="Reagent or consumable…" value=${name} onInput=${e => setName(e.target.value)} />
      <input placeholder="Vendor (optional)" value=${vendor} onInput=${e => setVendor(e.target.value)} />
      <button class="btn">Add</button>
    </form>
  </div>`;
}
