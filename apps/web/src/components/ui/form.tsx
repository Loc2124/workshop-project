import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import * as LabelPrimitive from '@radix-ui/react-label';
import {
  Controller,
  FormProvider,
  useFormContext,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
} from 'react-hook-form';
import { cn } from '../../lib/utils';
export const Form = FormProvider;
const FieldContext = React.createContext<{ name: string } | null>(null);
const ItemContext = React.createContext<{ id: string } | null>(null);
export function FormField<T extends FieldValues, N extends FieldPath<T>>(
  props: ControllerProps<T, N>,
) {
  return (
    <FieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FieldContext.Provider>
  );
}
function useFormField() {
  const field = React.useContext(FieldContext);
  const item = React.useContext(ItemContext);
  const { getFieldState, formState } = useFormContext();
  if (!field || !item)
    throw new Error('Form fields require FormField and FormItem.');
  return {
    ...getFieldState(field.name, formState),
    inputId: `${item.id}-input`,
    descriptionId: `${item.id}-description`,
    messageId: `${item.id}-message`,
  };
}
export function FormItem({ className, ...props }: React.ComponentProps<'div'>) {
  const id = React.useId();
  return (
    <ItemContext.Provider value={{ id }}>
      <div className={cn('space-y-2', className)} {...props} />
    </ItemContext.Provider>
  );
}
export function FormLabel({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
  const { inputId, error } = useFormField();
  return (
    <LabelPrimitive.Root
      htmlFor={inputId}
      className={cn('text-sm font-medium', error && 'text-brick', className)}
      {...props}
    />
  );
}
export function FormControl(props: React.ComponentProps<typeof Slot>) {
  const { inputId, descriptionId, messageId, error } = useFormField();
  return (
    <Slot
      id={inputId}
      aria-invalid={!!error}
      aria-describedby={error ? `${descriptionId} ${messageId}` : descriptionId}
      {...props}
    />
  );
}
export function FormDescription({
  className,
  ...props
}: React.ComponentProps<'p'>) {
  const { descriptionId } = useFormField();
  return (
    <p
      id={descriptionId}
      className={cn('text-xs text-muted', className)}
      {...props}
    />
  );
}
export function FormMessage({
  className,
  children,
  ...props
}: React.ComponentProps<'p'>) {
  const { messageId, error } = useFormField();
  const message = error?.message ? String(error.message) : children;
  return message ? (
    <p
      role="alert"
      id={messageId}
      className={cn('text-sm text-brick', className)}
      {...props}
    >
      {message}
    </p>
  ) : null;
}
