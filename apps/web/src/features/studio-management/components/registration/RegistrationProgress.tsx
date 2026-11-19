import { Check } from 'lucide-react';

export interface RegistrationProgressProps {
  currentStep: number;
  hasReceipt: boolean;
}

const steps = ['Thông tin studio', 'Kiểm tra và gửi', 'Hoàn tất'];

export function RegistrationProgress({
  currentStep,
  hasReceipt,
}: RegistrationProgressProps) {
  const activeStep = hasReceipt ? 2 : currentStep;

  return (
    <ol
      aria-label="Tiến trình đăng ký"
      className="mb-8 grid grid-cols-3 text-center text-sm"
    >
      {steps.map((label, index) => (
        <li
          key={label}
          aria-current={activeStep === index ? 'step' : undefined}
          className="relative flex min-w-0 flex-col items-center gap-2 px-1"
        >
          {index < steps.length - 1 && (
            <span
              aria-hidden="true"
              className={`absolute left-1/2 top-4 h-px w-full ${
                activeStep > index ? 'bg-primary' : 'bg-line'
              }`}
            />
          )}
          <span
            aria-hidden="true"
            className={`relative z-10 flex size-8 items-center justify-center rounded-full border ${
              activeStep >= index
                ? 'border-primary bg-primary font-bold text-white'
                : 'border-line bg-paper text-muted'
            }`}
          >
            {activeStep > index ? <Check size={16} /> : index + 1}
          </span>
          <span
            className={
              activeStep === index
                ? 'font-bold text-ink'
                : activeStep > index
                  ? 'font-semibold text-primary'
                  : 'text-muted'
            }
          >
            {label}
          </span>
        </li>
      ))}
    </ol>
  );
}
