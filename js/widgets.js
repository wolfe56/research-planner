import { html, useState, useEffect } from './lib.js';

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

export const FlaskIcon = () => html`<svg class="flask" viewBox="0 0 16 16" aria-label="Experiment" role="img">
  <path d="M6 1.5h4M6.5 1.5v4.2L2.6 12.6a1.3 1.3 0 0 0 1.1 1.9h8.6a1.3 1.3 0 0 0 1.1-1.9L9.5 5.7V1.5M4.6 9.5h6.8"
    fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" /></svg>`;
