import {headingCase} from './headingCase';
import { useEffect, useRef, useId, type ReactNode } from 'react';
import { X } from 'lucide-react';
import {createPortal} from 'react-dom';

export function IconButton({ label, children, onClick, className = '', disabled = false, pressed }: { label: string; children: ReactNode; onClick?: () => void; className?: string; disabled?: boolean; pressed?: boolean }) {
  return <button className={`icon-button ${className}`} type="button" title={label} aria-label={label} aria-pressed={pressed} onClick={onClick} disabled={disabled}>{children}</button>;
}
export function Modal({ title, children, onClose, leading, className = '' }: { title: string; children: ReactNode; onClose: () => void; leading?:ReactNode; className?:string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId=useId();
  useEffect(() => { ref.current?.showModal(); const dialog = ref.current; return () => dialog?.close(); }, []);
  const dialog = <dialog ref={ref} className={`modal ${className}`} onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) { const rect = e.currentTarget.getBoundingClientRect(); if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) onClose(); } }} aria-labelledby={titleId}>
    <header>{leading}
<h2 id={titleId}>{title}</h2>
<IconButton label="Close dialog" onClick={onClose}>
<X size={20}/>
</IconButton>
</header>{children}
  </dialog>;
  return typeof document==='undefined'?dialog:createPortal(dialog,document.body);
}
export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return <button className="toggle" type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}>
<span/>
</button>;
}
export function EmptyState({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  return <div className="empty-state">
<span className="empty-orbit"/>
<h2>{headingCase(title)}</h2>
<p>{description}</p>{children}</div>;
}
