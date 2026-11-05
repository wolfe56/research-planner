import { newId, dateStr, addDays, startOfWeek, PALETTE } from './util.js';

// Placeholder data for demo mode only, so the views aren't empty before Firebase is connected.
export function demoSeed() {
  const now = Date.now();
  const mon = startOfWeek(new Date());
  const at = (day, hhmm) => `${dateStr(addDays(mon, day))}T${hhmm}`;
  const inDays = n => dateStr(addDays(new Date(), n));
  const ago = (n, hhmm) => `${inDays(-n)}T${hhmm}`;
  let order = 0;

  const P = (name, role, color) => ({ id: newId(), name, role, color, order: order++, createdAt: now });
  const main = P('Example: main project', 'lead', PALETTE[0]);
  const darpa = P('Example: DARPA project', 'subpi', PALETTE[1]);
  const help = P('Example: helping a colleague', 'support', PALETTE[2]);

  // Goals (stored in the 'experiments' collection).
  const G = (p, name) => ({ id: newId(), projectId: p.id, name, notes: '', order: order++, createdAt: now });
  const expr = G(main, 'Express and purify the protein');
  const bind = G(main, 'Binding data for figure 2');
  const q4 = G(darpa, 'Q4 deliverable data');
  const perm = G(help, 'Get data for the permutants');

  const T = (p, g, title, durationMin, extra = {}) => ({
    id: newId(), projectId: p.id, experimentId: g ? g.id : null, title, durationMin, kind: 'experiment',
    high: false, milestoneId: null, dueDate: null, notes: '', done: false, start: null, order: order++, createdAt: now, ...extra,
  });
  const task = { kind: 'task' };
  const sds = T(main, expr, 'Run SDS-PAGE', 120);
  const assay = T(main, bind, 'Run binding assay', 240, { high: true });
  const ch1 = T(help, perm, 'Single channel: Protein 1', 240);
  const tasks = [
    T(main, null, 'Outline paper figures', 90, task),
    T(main, expr, 'Pour LB plates', 45, { start: at(0, '09:00'), done: true }),
    T(main, expr, 'Transform E. coli', 60, { start: ago(1, '09:00') }),
    T(main, expr, 'Induce and harvest', 180, { start: at(2, '10:00') }),
    sds,
    T(main, bind, 'Design titration plate layout', 30, task),
    assay,
    T(darpa, null, 'Create PROSE budget', 120, { ...task, high: true }),
    T(darpa, null, 'Email program manager', 15, task),
    T(darpa, q4, 'Analyze run data', 180, { ...task, dueDate: inDays(10) }),
    T(help, perm, 'Grow and express permutant cells', 180, { start: at(3, '13:00') }),
    ch1,
    T(help, perm, 'Single channel: Protein 2', 240),
    T(help, null, 'Send protocol comments to co-author', 30, { ...task, start: at(4, '11:00') }),
  ];

  const R = (g, t, name, vendor, status, kind = 'reagent') => ({
    id: newId(), projectId: g.projectId, experimentId: g.id, taskId: t ? t.id : null, kind, name, vendor, catalog: '', status, notes: '', createdAt: now,
  });
  const reagents = [
    R(expr, sds, 'Precast gels', 'Example vendor', 'have'),
    R(expr, null, 'Ni-NTA resin', 'Example vendor', 'arrived'),
    R(bind, assay, 'Fluorescent ligand', 'Example vendor', 'need'),
    R(bind, assay, 'Plate reader time', '', 'have', 'equipment'),
    R(perm, ch1, 'DPhPC lipid', 'Example vendor', 'ordered'),
  ];
  const S = (g, t, name, status) => ({ id: newId(), projectId: g.projectId, experimentId: g.id, taskId: t.id, name, status, notes: '', createdAt: now });
  const samples = [
    S(bind, assay, 'Purified protein, 2 mg', 'need_produce'),
    S(perm, ch1, 'Protein 1 prep', 'available'),
  ];

  const milestones = [
    { id: newId(), projectId: darpa.id, title: 'Example milestone report', date: inDays(21), createdAt: now },
    { id: newId(), projectId: main.id, title: 'Committee meeting', date: dateStr(addDays(mon, 4)), createdAt: now },
  ];

  return { projects: [main, darpa, help], experiments: [expr, bind, q4, perm], tasks, reagents, samples, milestones };
}
