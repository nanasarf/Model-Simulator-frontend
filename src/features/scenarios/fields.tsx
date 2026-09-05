import type { ChangeEvent, ReactNode } from 'react';

export function TextField({ id, label, value, onChange, required, multiline, help }: { id: string; label: string; value: string; onChange(value: string): void; required?: boolean; multiline?: boolean; help?: ReactNode }) {
  return <div className="form-field"><label htmlFor={id}>{label}</label>{help && <div className="field-help" id={`${id}-help`}>{help}</div>}{multiline ? <textarea id={id} value={value} required={required} aria-describedby={help ? `${id}-help` : undefined} onChange={e => onChange(e.target.value)}/> : <input id={id} value={value} required={required} aria-describedby={help ? `${id}-help` : undefined} onChange={e => onChange(e.target.value)}/>}</div>;
}
export function NumberField({ id, label, value, onChange, min, max, help }: { id: string; label: string; value: number; onChange(value: number): void; min?: number; max?: number; help?: ReactNode }) {
  return <div className="form-field"><label htmlFor={id}>{label}</label>{help && <div className="field-help" id={`${id}-help`}>{help}</div>}<input id={id} type="number" value={value} min={min} max={max} step="any" aria-describedby={help ? `${id}-help` : undefined} onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.valueAsNumber)}/></div>;
}
export function LinesField(props: { id: string; label: string; value: string[]; onChange(value: string[]): void; help?: ReactNode }) {
  return <TextField {...props} multiline value={props.value.join('\n')} onChange={value => props.onChange(value.split('\n').map(x => x.trim()).filter(Boolean))}/>;
}
export function Check({ label, checked, onChange, help }: { label: string; checked: boolean; onChange(value: boolean): void; help?: string }) {
  return <label className="check-field"><input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}/><span>{label}{help && <small>{help}</small>}</span></label>;
}
