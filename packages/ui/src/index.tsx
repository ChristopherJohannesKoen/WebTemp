import * as React from 'react';
import { clsx } from 'clsx';

export function cn(...values: Array<string | false | null | undefined>) {
  return clsx(values);
}

export function buttonClassName({
  className,
  variant = 'primary'
}: {
  className?: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
}) {
  return cn(
    'inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition',
    variant === 'primary' && 'bg-slate-950 text-white hover:bg-slate-800',
    variant === 'secondary' && 'bg-slate-200 text-slate-950 hover:bg-slate-300',
    variant === 'ghost' && 'bg-transparent text-slate-700 hover:bg-slate-100',
    variant === 'danger' && 'bg-rose-600 text-white hover:bg-rose-500',
    className
  );
}

export function Button({
  className,
  variant = 'primary',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
}) {
  return <button className={buttonClassName({ className, variant })} {...props} />;
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.35)]',
        className
      )}
      {...props}
    />
  );
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none ring-0 transition placeholder:text-slate-400 focus:border-slate-950',
        className
      )}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'min-h-32 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none ring-0 transition placeholder:text-slate-400 focus:border-slate-950',
        className
      )}
      {...props}
    />
  );
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none ring-0 transition focus:border-slate-950',
        className
      )}
      {...props}
    />
  );
}

export function Badge({
  className,
  tone = 'slate',
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: 'slate' | 'emerald' | 'amber' | 'rose';
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]',
        tone === 'slate' && 'bg-slate-100 text-slate-700',
        tone === 'emerald' && 'bg-emerald-100 text-emerald-700',
        tone === 'amber' && 'bg-amber-100 text-amber-700',
        tone === 'rose' && 'bg-rose-100 text-rose-700',
        className
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  hint,
  children
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-semibold text-slate-800">{label}</span>
      {children}
      {hint ? <span className="text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

export function EmptyState({
  title,
  description,
  action
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col items-start gap-4 border-dashed">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-slate-950">{title}</h3>
        <p className="max-w-xl text-sm text-slate-600">{description}</p>
      </div>
      {action}
    </Card>
  );
}
