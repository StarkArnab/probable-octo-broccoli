'use client';

import { useId, useRef, useState } from 'react';
import { X } from 'lucide-react';
import './label-picker.css';

export function uniqueLabels(labels: string[]) {
  const seen = new Set<string>();
  return labels.map(label => label.trim()).filter(label => {
    const key = label.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

type Props = {
  labels: string[];
  options: string[];
  text: string;
  onTextChange: (text: string) => void;
  onChange: (labels: string[]) => void;
  disabled?: boolean;
};

export function LabelPicker({ labels, options, text, onTextChange, onChange, disabled }: Props) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const suggestions = uniqueLabels(options).filter(option =>
    !labels.some(label => label.toLowerCase() === option.toLowerCase()) &&
    option.toLowerCase().includes(text.trim().toLowerCase()));
  function add(label: string) {
    onChange(uniqueLabels([...labels, label]));
    onTextChange('');
    setActive(-1);
    input.current?.focus();
  }
  return <div className="label-picker" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) { setOpen(false); setActive(-1); }
  }}>
    <label htmlFor={id}>Labels</label>
    {labels.length > 0 && <ul className="selected-labels" aria-label="Selected labels">{labels.map(label =>
      <li key={label}><span>{label}</span><button type="button" aria-label={`Remove ${label}`} disabled={disabled}
        onClick={() => onChange(labels.filter(value => value !== label))}><X size={14} aria-hidden="true" /></button></li>)}</ul>}
    <div className="label-entry"><input ref={input} id={id} role="combobox" autoComplete="off" value={text} disabled={disabled}
      aria-expanded={open && suggestions.length > 0} aria-autocomplete="list" aria-controls={`${id}-options`}
      aria-activedescendant={open && active >= 0 && suggestions[active] ? `${id}-option-${active}` : undefined}
      aria-describedby={`${id}-help`} placeholder="Find or create a label"
      onFocus={() => setOpen(true)} onChange={event => { onTextChange(event.target.value); setOpen(true); setActive(-1); }}
      onKeyDown={event => {
        if (event.nativeEvent.isComposing) return;
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault(); setOpen(true);
          setActive(index => suggestions.length ? (index + (event.key === 'ArrowDown' ? 1 : -1) + suggestions.length) % suggestions.length : -1);
        } else if (event.key === 'Enter') {
          event.preventDefault(); add(open && active >= 0 ? suggestions[active] ?? text : text);
        } else if (event.key === 'Escape' && open) {
          event.preventDefault(); event.stopPropagation(); setOpen(false); setActive(-1);
        }
      }} />
      <button type="button" className="secondary" disabled={disabled || !text.trim()} onClick={() => add(text)}>Add label</button>
    </div>
    <p id={`${id}-help`} className="label-help">Search existing labels or type a new one. Press Enter or Add label.</p>
    {open && suggestions.length > 0 && <ul id={`${id}-options`} role="listbox" aria-label="Existing labels" className="label-options">
      {suggestions.map((label, index) => <li key={label} id={`${id}-option-${index}`} role="option" aria-selected={active === index}
        onPointerDown={event => event.preventDefault()} onClick={() => add(label)}>{label}</li>)}
    </ul>}
  </div>;
}
