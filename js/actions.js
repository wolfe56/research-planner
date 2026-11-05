import { PALETTE, byOrder, orderAt, isMissed, todayStr } from './util.js';

// Planner operations on top of the store api. `get` returns the latest data snapshot.
// Goals are stored in the 'experiments' collection (task.experimentId is the task's goal).
// Reagents, equipment and samples ("materials") belong either to one experiment item (taskId)
// or are shared by a whole goal (taskId null).
const MATERIALS = ['reagents', 'samples'];

export function makeActions(api, get) {
  const nextOrder = list => (list.length ? Math.max(...list.map(x => x.order ?? 0)) + 1 : 0);
  const del = (c, id) => ({ op: 'delete', c, id });
  const group = (projectId, goalId, exceptId) => get().tasks
    .filter(t => t.id !== exceptId && t.projectId === projectId && (t.experimentId || null) === goalId)
    .sort(byOrder);
  // Deletes every doc in `colls` matching `pred`, plus the materials of any task deleted.
  const cascade = (colls, pred) => {
    const d = get();
    const ops = colls.flatMap(c => d[c].filter(pred).map(x => del(c, x.id)));
    const taskIds = new Set(ops.filter(o => o.c === 'tasks').map(o => o.id));
    const seen = new Set(ops.map(o => o.id));
    for (const c of MATERIALS)
      for (const m of d[c]) if (taskIds.has(m.taskId) && !seen.has(m.id)) ops.push(del(c, m.id));
    return ops;
  };

  const updateTask = (id, patch) => {
    const ops = [{ op: 'update', c: 'tasks', id, data: patch }];
    // Keep a task's materials filed under the task's current project and goal.
    if ('projectId' in patch || 'experimentId' in patch) {
      const d = get();
      const t = d.tasks.find(x => x.id === id) || {};
      const where = {
        projectId: patch.projectId ?? t.projectId,
        experimentId: 'experimentId' in patch ? patch.experimentId : t.experimentId || null,
      };
      for (const c of MATERIALS)
        for (const m of d[c]) if (m.taskId === id) ops.push({ op: 'update', c, id: m.id, data: where });
    }
    api.batch(ops);
  };
  // Rescheduling a missed task counts as a slip, so tasks that keep getting pushed back stand out.
  const slipPatch = id => {
    const t = get().tasks.find(x => x.id === id);
    return t && isMissed(t, todayStr()) ? { slipped: (t.slipped || 0) + 1 } : {};
  };

  return {
    addProject(name) {
      const { projects } = get();
      return api.add('projects', { name, role: 'lead', color: PALETTE[projects.length % PALETTE.length], order: nextOrder(projects) });
    },
    updateProject: (id, patch) => api.update('projects', id, patch),
    moveProject(id, beforeId) {
      if (beforeId === id) return;
      api.update('projects', id, { order: orderAt(get().projects.filter(p => p.id !== id).sort(byOrder), beforeId) });
    },
    deleteProject(id) {
      api.batch([del('projects', id), ...cascade(['experiments', 'tasks', 'reagents', 'samples', 'milestones'], x => x.projectId === id)]);
    },

    addGoal(projectId, name) {
      return api.add('experiments', { projectId, name, notes: '', order: nextOrder(get().experiments.filter(e => e.projectId === projectId)) });
    },
    updateGoal: (id, patch) => api.update('experiments', id, patch),
    moveGoal(id, beforeId) {
      if (beforeId === id) return;
      const g = get().experiments.find(e => e.id === id);
      const list = get().experiments.filter(e => e.id !== id && e.projectId === g.projectId).sort(byOrder);
      api.update('experiments', id, { order: orderAt(list, beforeId) });
    },
    deleteGoal(id) {
      api.batch([del('experiments', id), ...cascade(['tasks', 'reagents', 'samples'], x => x.experimentId === id)]);
    },

    addTask(projectId, goalId, title, durationMin = 60, kind = 'task') {
      return api.add('tasks', {
        projectId, experimentId: goalId, title, durationMin, kind, high: false, milestoneId: null,
        dueDate: null, notes: '', done: false, start: null, order: nextOrder(group(projectId, goalId)),
      });
    },
    updateTask,
    deleteTask: id => api.batch([del('tasks', id), ...cascade(MATERIALS, m => m.taskId === id)]),
    // Moves a task into a project's goal (goalId null = not under a goal), before beforeId or at the end.
    moveTask(id, projectId, goalId, beforeId) {
      if (beforeId === id) return;
      updateTask(id, { projectId, experimentId: goalId, order: orderAt(group(projectId, goalId, id), beforeId) });
    },
    toggleHigh: id => {
      const t = get().tasks.find(x => x.id === id);
      if (t) api.update('tasks', id, { high: !t.high });
    },
    schedule: (id, start) => api.update('tasks', id, { start, ...slipPatch(id) }),
    unschedule: id => api.update('tasks', id, { start: null, ...slipPatch(id) }),

    addReagent: (projectId, goalId, taskId, name, vendor, kind = 'reagent') =>
      api.add('reagents', { projectId, experimentId: goalId, taskId, kind, name, vendor: vendor || '', catalog: '', status: 'need', notes: '' }),
    updateReagent: (id, patch) => api.update('reagents', id, patch),
    deleteReagent: id => api.remove('reagents', id),

    addSample: (projectId, goalId, taskId, name, status = 'need_produce') =>
      api.add('samples', { projectId, experimentId: goalId, taskId, name, status, notes: '' }),
    updateSample: (id, patch) => api.update('samples', id, patch),
    deleteSample: id => api.remove('samples', id),

    addMilestone: (projectId, title, date) => api.add('milestones', { projectId, title, date }),
    deleteMilestone(id) {
      const unlink = get().tasks.filter(t => t.milestoneId === id).map(t => ({ op: 'update', c: 'tasks', id: t.id, data: { milestoneId: null } }));
      api.batch([del('milestones', id), ...unlink]);
    },
  };
}
