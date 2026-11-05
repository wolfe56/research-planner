import { useState, useEffect } from './lib.js';

// A per-device UI preference (current tab, filters) remembered in localStorage.
export function usePref(key, initial) {
  const [value, setValue] = useState(() => {
    try { return JSON.parse(localStorage.getItem('rp_' + key)) ?? initial; } catch { return initial; }
  });
  const set = v => {
    try { localStorage.setItem('rp_' + key, JSON.stringify(v)); } catch {}
    setValue(v);
  };
  return [value, set];
}

export function useWidth() {
  const [w, setW] = useState(window.innerWidth);
  useEffect(() => {
    const f = () => setW(window.innerWidth);
    addEventListener('resize', f);
    return () => removeEventListener('resize', f);
  }, []);
  return w;
}

export function useNow(ms = 60000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}
