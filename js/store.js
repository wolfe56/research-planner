import { firebaseConfig } from './firebase-config.js';
import { newId } from './util.js';
import { demoSeed } from './demo.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.14.1';
// 'experiments' holds what the UI calls goals; the collection name is kept so existing data still loads.
export const COLLS = ['projects', 'experiments', 'tasks', 'reagents', 'samples', 'milestones'];
// Demo mode keeps example data in this browser only. Adding ?demo to the address forces it, for trying changes safely.
export const DEMO = !firebaseConfig.apiKey || firebaseConfig.apiKey.startsWith('PASTE') || new URLSearchParams(location.search).has('demo');

let fb = null;

export async function initAuth(onUser) {
  if (DEMO) { onUser({ uid: 'demo', email: 'Demo mode' }); return; }
  const [{ initializeApp }, A, F] = await Promise.all([
    import(`${SDK}/firebase-app.js`),
    import(`${SDK}/firebase-auth.js`),
    import(`${SDK}/firebase-firestore.js`),
  ]);
  const app = initializeApp(firebaseConfig);
  const auth = A.getAuth(app);
  // The local cache keeps the planner usable with poor signal and syncs when the connection returns.
  const db = F.initializeFirestore(app, {
    localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }),
  });
  fb = { A, F, auth, db };
  A.onAuthStateChanged(auth, u => onUser(u ? { uid: u.uid, email: u.email } : null));
}

export const auth = {
  signIn: (email, pw) => fb.A.signInWithEmailAndPassword(fb.auth, email, pw),
  signUp: (email, pw) => fb.A.createUserWithEmailAndPassword(fb.auth, email, pw),
  google: () => fb.A.signInWithPopup(fb.auth, new fb.A.GoogleAuthProvider()),
  reset: email => fb.A.sendPasswordResetEmail(fb.auth, email),
  signOut: () => (DEMO ? Promise.resolve() : fb.A.signOut(fb.auth)),
};

const clean = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

// Opens the signed-in user's data. onData receives all collections whenever any of them changes.
// The returned api writes through `apply`, which takes ops of the form { op: 'set' | 'update' | 'delete', c, id, data }.
export function openData(uid, onData, onError) {
  return DEMO ? openDemo(onData) : openFirestore(uid, onData, onError);
}

function makeApi(apply) {
  return {
    add(c, data) {
      const id = newId();
      apply([{ op: 'set', c, id, data: { ...data, createdAt: Date.now() } }]);
      return id;
    },
    update(c, id, data) { apply([{ op: 'update', c, id, data }]); },
    remove(c, id) { apply([{ op: 'delete', c, id }]); },
    batch(ops) { if (ops.length) apply(ops); },
  };
}

function openFirestore(uid, onData, onError) {
  const { F, db } = fb;
  const state = Object.fromEntries(COLLS.map(c => [c, []]));
  const loaded = new Set();
  const unsubs = COLLS.map(c => F.onSnapshot(F.collection(db, 'users', uid, c), snap => {
    state[c] = snap.docs.map(d => ({ ...d.data(), id: d.id }));
    loaded.add(c);
    if (loaded.size === COLLS.length) onData({ ...state });
  }, onError));
  const ref = (c, id) => F.doc(db, 'users', uid, c, id);
  const api = makeApi(ops => {
    // Firestore batches hold at most 500 writes.
    for (let i = 0; i < ops.length; i += 450) {
      const b = F.writeBatch(db);
      for (const { op, c, id, data } of ops.slice(i, i + 450)) {
        if (op === 'set') b.set(ref(c, id), clean(data));
        else if (op === 'update') b.update(ref(c, id), clean(data));
        else b.delete(ref(c, id));
      }
      b.commit().catch(onError);
    }
  });
  api.close = () => unsubs.forEach(u => u());
  return api;
}

const DEMO_KEY = 'rp_demo_v1';

function openDemo(onData) {
  let state = null;
  try { state = JSON.parse(localStorage.getItem(DEMO_KEY)); } catch {}
  if (!state) state = demoSeed();
  for (const c of COLLS) state[c] ||= [];
  const emit = () => {
    try { localStorage.setItem(DEMO_KEY, JSON.stringify(state)); } catch {}
    onData({ ...state });
  };
  const api = makeApi(ops => {
    for (const { op, c, id, data } of ops) {
      const list = (state[c] = [...state[c]]);
      const i = list.findIndex(x => x.id === id);
      if (op === 'set') list.splice(i < 0 ? list.length : i, i < 0 ? 0 : 1, { ...clean(data), id });
      else if (op === 'update') { if (i >= 0) list[i] = { ...list[i], ...clean(data) }; }
      else if (i >= 0) list.splice(i, 1);
    }
    emit();
  });
  api.close = () => {};
  setTimeout(emit, 0);
  return api;
}
