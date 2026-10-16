import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Workshop',
  description: 'Nền tảng đặt chỗ workshop thủ công',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
