import type { ComponentProps, ReactNode } from 'react';
import { Input } from './input';
import { PasswordInput } from './password-input';

type Props = ComponentProps<'input'> & {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  labelAction?: ReactNode;
};

export function AuthField({
  id,
  label,
  error,
  hint,
  labelAction,
  type,
  ...props
}: Props) {
  const Field = type === 'password' ? PasswordInput : Input;
  const description =
    [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') ||
    undefined;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <label htmlFor={id} className="text-sm font-semibold">
          {label}
        </label>
        {labelAction}
      </div>
      <Field
        {...props}
        {...(type !== 'password' ? { type } : {})}
        id={id}
        name={props.name ?? id}
        className="min-h-12 aria-invalid:border-brick"
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={description}
      />
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-brick">
          {error}
        </p>
      )}
      {hint && (
        <div id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </div>
      )}
    </div>
  );
}
