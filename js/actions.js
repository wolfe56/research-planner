import { PALETTE, byOrder } from './util.js';

// Planner operations on top of the store api. `get` returns the latest data snapshot.
export function makeActions(api, get) {
  const nextOrder = list => (list.length ? Math.max(...list.map(x => x.order ?? 0)) + 1 : 0);
  const cascade = (field, id, colls) => {
    const d = get();
    return colls.flatMap(c => d[c].filter(x => x[field] === id).map(x => ({ op: 'delete', c, id: x.id })));
  };
  const group = (projectId, experimentId, exceptId) => get().tasks
    .filter(t => t.id !== exceptId && t.projectId === projectId && (t.experimentId || null) === experimentId)
    .sort(byOrder);

  return {
    addProject(name) {
      const { projects } = get();
      return api.add('projects', { name, role: 'lead', color: PALETTE[projects.length % PALETTE.length], order: nextOrder(projects) });
    },
    updateProject: (id, patch) => api.update('projects', id, patch),
    deleteProject(id) {
      api.batch([{ op: 'delete', c: 'projects', id }, ...cascade('projectId', id, ['experiments', 'tasks', 'reagents', 'milestones'])]);
    },

    addExperiment(projectId, name) {
      const exps = get().experiments.filter(e => e.projectId === projectId);
      return api.add('experiments', { projectId, name, notes: '', order: nextOrder(exps) });
    },
    updateExperiment: (id, patch) => api.update('experiments', id, patch),
    deleteExperiment(id) {
      api.batch([{ op: 'delete', c: 'experiments', id }, ...cascade('experimentId', id, ['tasks', 'reagents'])]);
    },

    addTask(projectId, experimentId, title, durationMin = 60) {
      return api.add('tasks', {
        projectId, experimentId, title, durationMin, dueDate: null, notes: '', done: false, start: null,
        order: nextOrder(group(projectId, experimentId)),
      });
    },
    updateTask: (id, patch) => api.update('tasks', id, patch),
    deleteTask: id => api.remove('tasks', id),
    // Moves a task into a group (experimentId null = not in an experiment), before beforeId or at the end.
    moveTask(id, projectId, experimentId, beforeId) {
      if (beforeId === id) return;
      const list = group(projectId, experimentId, id);
      const i = beforeId ? list.findIndex(t => t.id === beforeId) : -1;
      const o = k => list[k].order ?? 0;
      const order = i < 0 ? (list.length ? o(list.length - 1) + 1 : 0) : i === 0 ? o(0) - 1 : (o(i - 1) + o(i)) / 2;
      api.update('tasks', id, { projectId, experimentId, order });
    },
    schedule: (id, start) => api.update('tasks', id, { start }),
    unschedule: id => api.update('tasks', id, { start: null }),

    addReagent: (projectId, experimentId, name, vendor) =>
      api.add('reagents', { projectId, experimentId, name, vendor: vendor || '', catalog: '', status: 'need', notes: '' }),
    updateReagent: (id, patch) => api.update('reagents', id, patch),
    deleteReagent: id => api.remove('reagents', id),

    addMilestone: (projectId, title, date) => api.add('milestones', { projectId, title, date }),
    deleteMilestone: id => api.remove('milestones', id),
  };
}
