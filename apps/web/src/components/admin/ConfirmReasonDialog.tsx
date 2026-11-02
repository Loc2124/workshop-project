import { useState } from 'react';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
} from '../ui/form';
import { Button } from '../ui/button';

export type ConfirmReasonDialogProps = {
  children?: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  requireReason?: boolean;
  minLength?: number;
  maxLength?: number;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: (reason: string) => void | Promise<void>;
};
export function confirmationReasonSchema(
  requireReason = true,
  minLength = 10,
  maxLength = 1000,
) {
  return z.object({
    reason: z
      .string()
      .trim()
      .max(maxLength, `Lý do tối đa ${maxLength} ký tự.`)
      .refine(
        (value) => !requireReason || value.length >= minLength,
        `Lý do cần ít nhất ${minLength} ký tự.`,
      ),
  });
}
export function ConfirmReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  requireReason = true,
  minLength = 10,
  maxLength = 1000,
  confirmLabel = 'Xác nhận',
  destructive = false,
  onConfirm,
  children,
}: ConfirmReasonDialogProps) {
  const [pending, setPending] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!pending) onOpenChange(value);
      }}
    >
      <DialogContent closeDisabled={pending} className="rounded-md">
        <DialogTitle className="pr-10">{title}</DialogTitle>
        <DialogDescription className="mt-2">{description}</DialogDescription>
        {children}
        {open && (
          <ReasonForm
            requireReason={requireReason}
            minLength={minLength}
            maxLength={maxLength}
            pending={pending}
            confirmLabel={confirmLabel}
            destructive={destructive}
            onCancel={() => onOpenChange(false)}
            onConfirm={async (reason) => {
              setPending(true);
              try {
                await onConfirm(reason);
                onOpenChange(false);
              } finally {
                setPending(false);
              }
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
function ReasonForm({
  requireReason,
  minLength,
  maxLength,
  pending,
  confirmLabel,
  destructive,
  onCancel,
  onConfirm,
}: {
  requireReason: boolean;
  minLength: number;
  maxLength: number;
  pending: boolean;
  confirmLabel: string;
  destructive: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const form = useForm<{ reason: string }>({
    resolver: zodResolver(
      confirmationReasonSchema(requireReason, minLength, maxLength),
    ),
    defaultValues: { reason: '' },
    mode: 'onChange',
  });
  const reasonLength = form.watch('reason').trim().length;
  return (
    <Form {...form}>
      <form
        noValidate
        className="mt-4 space-y-4"
        onSubmit={form.handleSubmit(async ({ reason }) => {
          form.clearErrors('root');
          try {
            await onConfirm(reason);
          } catch (error) {
            form.setError('root', {
              message:
                error instanceof Error
                  ? error.message
                  : 'Chưa thực hiện được. Vui lòng thử lại.',
            });
          }
        })}
      >
        {requireReason && (
          <FormField
            control={form.control}
            name="reason"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Lý do</FormLabel>
                <FormControl>
                  <textarea
                    {...field}
                    required
                    minLength={minLength}
                    maxLength={maxLength}
                    rows={5}
                    disabled={pending}
                    className="w-full rounded-md border border-line bg-surface p-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  />
                </FormControl>
                <FormDescription>
                  Tối thiểu {minLength} ký tự · {field.value.trim().length}/
                  {maxLength}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        {form.formState.errors.root && (
          <p role="alert" className="text-sm text-brick">
            {form.formState.errors.root.message}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={onCancel}
          >
            Hủy
          </Button>
          <Button
            type="submit"
            variant={destructive ? 'destructive' : 'default'}
            disabled={
              pending ||
              (requireReason && reasonLength < minLength) ||
              reasonLength > maxLength
            }
          >
            {pending ? 'Đang xử lý…' : confirmLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
}
