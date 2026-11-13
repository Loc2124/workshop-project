import { Toaster } from 'sonner';

export function AppToaster() {
  return (
    <Toaster
      richColors
      position="top-right"
      closeButton
      offset={{ top: 88 }}
      mobileOffset={{ top: 88 }}
    />
  );
}
