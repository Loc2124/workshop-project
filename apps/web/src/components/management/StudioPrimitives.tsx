import { forwardRef, useId, type ComponentProps, type ReactNode } from 'react';
import { LoaderCircle, type LucideIcon } from 'lucide-react';
import { Button, type ButtonProps } from '../ui/button';
import { cn } from '@/lib/utils';

const focus =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-primary focus-visible:ring-offset-2';

export function StudioCard({ className, ...props }: ComponentProps<'section'>) {
  return (
    <section
      className={cn(
        'rounded-studio-card border border-studio-border bg-studio-surface p-5 text-studio-ink shadow-studio-card sm:p-studio-card',
        className,
      )}
      {...props}
    />
  );
}

export function StudioButton({
  variant = 'primary',
  loading = false,
  disabled,
  children,
  className,
  ...props
}: Omit<ButtonProps, 'variant'> & {
  variant?: 'primary' | 'secondary' | 'ghost';
  loading?: boolean;
}) {
  return (
    <Button
      {...props}
      variant="ghost"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'min-h-studio-control rounded-studio-control px-4 text-sm font-semibold transition-colors duration-studio motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-50',
        focus,
        {
          'bg-studio-primary text-white hover:bg-studio-primary-hover':
            variant === 'primary',
          'border border-studio-border bg-studio-surface text-studio-primary hover:bg-studio-selected':
            variant === 'secondary',
          'text-studio-muted hover:bg-studio-subtle hover:text-studio-ink':
            variant === 'ghost',
        },
        className,
      )}
    >
      {props.asChild ? (
        children
      ) : (
        <>
          {loading && (
            <LoaderCircle
              aria-hidden="true"
              className="size-4 motion-safe:animate-spin"
            />
          )}
          {children}
        </>
      )}
    </Button>
  );
}

export function StudioBadge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: 'success' | 'warning' | 'danger' | 'neutral';
  children: ReactNode;
  className?: string;
}) {
  const tones = {
    success: 'bg-studio-success-soft text-studio-success',
    warning: 'bg-studio-warning-soft text-studio-warning',
    danger: 'bg-studio-danger-soft text-studio-danger',
    neutral: 'bg-studio-neutral-soft text-studio-neutral',
  };
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-2 rounded-full px-3 py-1 text-sm font-medium',
        tones[tone],
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="size-1.5 shrink-0 rounded-full bg-current"
      />
      {children}
    </span>
  );
}

export const StudioInput = forwardRef<
  HTMLInputElement,
  ComponentProps<'input'>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      'min-h-studio-control w-full rounded-studio-control border border-studio-input-border bg-studio-surface px-3 py-2 text-base text-studio-ink placeholder:text-studio-muted disabled:cursor-not-allowed disabled:bg-studio-subtle disabled:opacity-60 aria-invalid:border-studio-danger aria-invalid:focus-visible:ring-studio-danger',
      focus,
      'transition-colors duration-studio motion-reduce:transition-none',
      className,
    )}
    {...props}
  />
));
StudioInput.displayName = 'StudioInput';

export function StudioField({
  label,
  error,
  hint,
  id,
  className,
  ...props
}: ComponentProps<typeof StudioInput> & {
  label: string;
  error?: string;
  hint?: string;
}) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const description =
    [
      hint && `${fieldId}-hint`,
      error && `${fieldId}-error`,
      props['aria-describedby'],
    ]
      .filter(Boolean)
      .join(' ') || undefined;
  return (
    <div className={cn('space-y-studio-field', className)}>
      <label
        htmlFor={fieldId}
        className="block text-sm font-semibold text-studio-ink"
      >
        {label}
      </label>
      <StudioInput
        {...props}
        id={fieldId}
        aria-invalid={error ? true : props['aria-invalid']}
        aria-describedby={description}
      />
      {hint && (
        <p
          id={`${fieldId}-hint`}
          className="text-sm leading-6 text-studio-muted"
        >
          {hint}
        </p>
      )}
      {error && (
        <p
          id={`${fieldId}-error`}
          role="alert"
          className="text-sm text-studio-danger"
        >
          {error}
        </p>
      )}
    </div>
  );
}

export function StudioFormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="min-w-0 space-y-studio-group border-t border-studio-border pt-studio-card">
      <legend className="float-left mb-studio-group w-full font-heading text-lg font-bold text-studio-ink">
        {title}
      </legend>
      {description && (
        <p className="clear-both text-sm leading-6 text-studio-muted">
          {description}
        </p>
      )}
      <div className="clear-both grid gap-studio-group">{children}</div>
    </fieldset>
  );
}

export function StudioEmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <StudioCard className="flex flex-col items-center gap-studio-group py-10 text-center">
      <Icon aria-hidden="true" className="size-8 text-studio-primary" />
      <h2 className="font-heading text-xl font-bold">{title}</h2>
      <p className="max-w-md text-sm leading-6 text-studio-muted">
        {description}
      </p>
      {action}
    </StudioCard>
  );
}

export function StudioSkeleton({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-label={label}
      className={cn(
        'space-y-studio-group rounded-studio-card border border-studio-border bg-studio-surface p-studio-card',
        className,
      )}
    >
      <span className="sr-only">{label}</span>
      {['w-1/3', 'w-full', 'w-2/3'].map((width) => (
        <div
          key={width}
          aria-hidden="true"
          className={cn(
            'h-5 rounded-studio-control bg-studio-subtle motion-safe:animate-pulse',
            width,
          )}
        />
      ))}
    </div>
  );
}
