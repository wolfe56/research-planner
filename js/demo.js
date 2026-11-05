import { newId, dateStr, addDays, startOfWeek, PALETTE } from './util.js';

// Placeholder data for demo mode only, so the views aren't empty before Firebase is connected.
export function demoSeed() {
  const now = Date.now();
  const mon = startOfWeek(new Date());
  const at = (day, hhmm) => `${dateStr(addDays(mon, day))}T${hhmm}`;
  const inDays = n => dateStr(addDays(new Date(), n));
  let order = 0;

  const P = (name, role, color) => ({ id: newId(), name, role, color, order: order++, createdAt: now });
  const main = P('Example: main project', 'lead', PALETTE[0]);
  const darpa = P('Example: DARPA project', 'subpi', PALETTE[1]);
  const help = P('Example: helping a colleague', 'support', PALETTE[2]);

  const E = (p, name) => ({ id: newId(), projectId: p.id, name, notes: '', order: order++, createdAt: now });
  const expr = E(main, 'Exp 1 · Protein expression');
  const bind = E(main, 'Exp 2 · Binding assay');
  const q4 = E(darpa, 'Q4 deliverable data');

  const T = (p, e, title, durationMin, extra = {}) => ({
    id: newId(), projectId: p.id, experimentId: e ? e.id : null, title, durationMin,
    dueDate: null, notes: '', done: false, start: null, order: order++, createdAt: now, ...extra,
  });
  const tasks = [
    T(main, null, 'Outline paper figures', 90),
    T(main, expr, 'Pour LB plates', 45, { start: at(0, '09:00'), done: true }),
    T(main, expr, 'Transform E. coli', 60, { start: at(1, '09:00') }),
    T(main, expr, 'Start overnight culture', 30, { start: at(1, '16:00') }),
    T(main, expr, 'Induce and harvest', 180, { start: at(2, '10:00') }),
    T(main, expr, 'Run SDS-PAGE', 120),
    T(main, bind, 'Design titration plate layout', 60),
    T(main, bind, 'Run binding assay', 240),
    T(darpa, null, 'Prepare monthly data summary', 120, { start: at(3, '13:00') }),
    T(darpa, q4, 'Analyze run data', 180, { dueDate: inDays(10) }),
    T(help, null, 'Send protocol comments to co-author', 30, { start: at(4, '11:00') }),
    T(help, null, 'Review draft figure 3', 60, { dueDate: inDays(3) }),
  ];

  const R = (e, name, vendor, status) => ({
    id: newId(), projectId: e.projectId, experimentId: e.id, name, vendor, catalog: '', status, notes: '', createdAt: now,
  });
  const reagents = [
    R(expr, 'IPTG', '', 'have'),
    R(expr, 'Ni-NTA resin', 'Example vendor', 'arrived'),
    R(bind, 'Fluorescent ligand', 'Example vendor', 'need'),
    R(bind, '384-well assay plates', 'Example vendor', 'ordered'),
  ];

  const milestones = [
    { id: newId(), projectId: darpa.id, title: 'Example milestone report', date: inDays(21), createdAt: now },
    { id: newId(), projectId: main.id, title: 'Committee meeting', date: dateStr(addDays(mon, 4)), createdAt: now },
  ];

  return { projects: [main, darpa, help], experiments: [expr, bind, q4], tasks, reagents, milestones };
}
