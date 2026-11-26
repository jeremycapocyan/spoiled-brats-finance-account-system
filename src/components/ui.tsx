"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { X, Plus, ArrowUpRight, Coffee } from "lucide-react";
export function Modal({ title, children, close, wide = false }: { title: string; children: ReactNode; close: () => void; wide?: boolean }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const active = document.activeElement as HTMLElement | null; const previous = document.body.style.overflow; document.body.style.overflow = "hidden";
    ref.current?.querySelector<HTMLElement>("input,select,textarea,button")?.focus();
    return () => { document.body.style.overflow = previous; active?.focus(); };
  }, []);
  return <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) close(); }}><section ref={ref} className={`modal ${wide ? "wide" : ""}`} role="dialog" aria-modal="true" aria-label={title} onKeyDown={e => {
    if (e.key === "Escape") close();
    if (e.key === "Tab") { const controls = Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]') || []).filter(el => el.getClientRects().length); const first = controls[0]; const last = controls.at(-1); if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); } }
  }}><header><h2>{title}</h2><button type="button" className="icon-button" aria-label="Close dialog" onClick={close}><X size={20} /></button></header>{children}</section></div>;
}
export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) { return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>; }
export function Empty({ title, description, action, onClick }: { title: string; description: string; action?: string; onClick?: () => void }) { return <div className="empty"><span className="empty-icon"><Coffee size={26} /></span><h3>{title}</h3><p>{description}</p>{action && <button className="button primary" onClick={onClick}><Plus size={16} />{action}</button>}</div>; }
export function Card({ title, detail, children, action }: { title?: string; detail?: string; children: ReactNode; action?: ReactNode }) { return <section className="card">{title && <header className="card-heading"><div><h2>{title}</h2>{detail && <p>{detail}</p>}</div>{action}</header>}{children}</section>; }
export function Stat({ label, value, note, icon, positive }: { label: string; value: string; note: string; icon: ReactNode; positive?: boolean }) { return <div className="stat"><div className="stat-top"><span>{label}</span><span className="stat-icon">{icon}</span></div><strong className={positive === false ? "negative" : ""}>{value}</strong><small>{positive && <ArrowUpRight size={13} />}{note}</small></div>; }
export function Table({ headers, children }: { headers: string[]; children: ReactNode }) { return <div className="table-scroll"><table><thead><tr>{headers.map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{children}</tbody></table></div>; }
