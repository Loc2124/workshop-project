import { createHash } from 'node:crypto';
import { AppError } from '../../errors/app-error.js';

// SHA-1 is used only for the HIBP range lookup. Stored credentials still use Argon2.
export async function assertPasswordNotCompromised(
  password: string,
): Promise<void> {
  const hash = createHash('sha1')
    .update(password, 'utf8')
    .digest('hex')
    .toUpperCase();
  let body: string;
  try {
    const response = await fetch(
      `https://api.pwnedpasswords.com/range/${hash.slice(0, 5)}`,
      {
        headers: {
          'Add-Padding': 'true',
          'User-Agent': 'OpenSlot-PasswordCheck',
        },
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!response.ok) throw new Error('Password check failed');
    body = await response.text();
    const lines = body.trim().split(/\r?\n/);
    if (
      !lines.length ||
      !lines.every((line) => /^[0-9A-F]{35}:\d+$/i.test(line))
    )
      throw new Error('Invalid password check response');
  } catch {
    throw new AppError(
      503,
      'SERVICE_UNAVAILABLE',
      'Chưa thể kiểm tra độ an toàn của mật khẩu. Vui lòng thử lại sau.',
    );
  }
  const compromised = body
    .trim()
    .split(/\r?\n/)
    .some((line) => {
      const [suffix, count] = line.split(':');
      return suffix.toUpperCase() === hash.slice(5) && Number(count) > 0;
    });
  if (compromised)
    throw new AppError(
      422,
      'PASSWORD_COMPROMISED',
      'Mật khẩu này đã xuất hiện trong dữ liệu bị lộ. Hãy chọn mật khẩu khác.',
    );
}
