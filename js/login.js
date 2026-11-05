import { html, useState } from './lib.js';
import { auth } from './store.js';

const MESSAGES = {
  'auth/invalid-credential': 'Wrong email or password.',
  'auth/invalid-email': 'That email address doesn’t look right.',
  'auth/email-already-in-use': 'An account with this email already exists. Sign in instead.',
  'auth/weak-password': 'Use a password of at least 6 characters.',
  'auth/too-many-requests': 'Too many attempts. Wait a minute and try again.',
  'auth/popup-closed-by-user': 'The sign-in window was closed.',
  'auth/unauthorized-domain': 'This site’s address isn’t authorized in Firebase (Authentication > Settings > Authorized domains).',
  'auth/operation-not-allowed': 'This sign-in method isn’t enabled in Firebase Authentication.',
};

export function Login() {
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn, done) => {
    setBusy(true);
    setMsg(null);
    try { await fn(); if (done) setMsg(done); }
    catch (e) { setMsg(MESSAGES[e.code] || e.message); }
    finally { setBusy(false); }
  };
  const submit = e => {
    e.preventDefault();
    run(() => (mode === 'signin' ? auth.signIn(email, pw) : auth.signUp(email, pw)));
  };
  const reset = () => {
    if (!email) { setMsg('Enter your email first, then click “Forgot password”.'); return; }
    run(() => auth.reset(email), 'Password reset email sent.');
  };

  return html`<div class="login">
    <form class="card" onSubmit=${submit}>
      <h1>Research Planner</h1>
      <p class="muted">${mode === 'signin' ? 'Sign in to your planner.' : 'Create your private planner account.'}</p>
      <label class="field"><span>Email</span>
        <input type="email" autocomplete="email" required value=${email} onInput=${e => setEmail(e.target.value)} /></label>
      <label class="field"><span>Password</span>
        <input type="password" required minlength="6" autocomplete=${mode === 'signin' ? 'current-password' : 'new-password'}
          value=${pw} onInput=${e => setPw(e.target.value)} /></label>
      ${msg && html`<p class="small">${msg}</p>`}
      <button class="btn primary" disabled=${busy}>${mode === 'signin' ? 'Sign in' : 'Create account'}</button>
      <button type="button" class="btn ghost" disabled=${busy} onClick=${() => run(auth.google)}>Continue with Google</button>
      <div class="login-links small">
        <button type="button" class="link" onClick=${() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMsg(null); }}>
          ${mode === 'signin' ? 'Create an account' : 'I already have an account'}</button>
        ${mode === 'signin' && html`<button type="button" class="link" onClick=${reset}>Forgot password</button>`}
      </div>
    </form>
  </div>`;
}
