import { Check, Circle } from 'lucide-react';
import { passwordRequirements } from '@workshop/shared';

export function PasswordChecklist({ password }: { password: string }) {
  const checks = passwordRequirements(password);
  const items = [
    { met: checks.length, label: 'Từ 12 đến 128 ký tự' },
    { met: checks.letters, label: 'Có chữ hoa và chữ thường' },
    { met: checks.digit, label: 'Có ít nhất một chữ số' },
    { met: checks.special, label: 'Có ít nhất một ký tự đặc biệt' },
  ];
  return (
    <div className="space-y-2">
      <ul className="space-y-1" aria-label="Yêu cầu mật khẩu">
        {items.map(({ met, label }) => (
          <li
            key={label}
            className={`flex items-center gap-2 ${met ? 'text-primary' : 'text-muted'}`}
          >
            {met ? (
              <Check size={15} aria-hidden="true" />
            ) : (
              <Circle size={12} aria-hidden="true" />
            )}
            <span className="sr-only">{met ? 'Đã đạt: ' : 'Chưa đạt: '}</span>
            {label}
          </li>
        ))}
      </ul>
      <p>Không dùng email, tên đăng nhập hoặc họ tên trong mật khẩu.</p>
    </div>
  );
}
