export interface RegistrationSidebarProps {
  storageAvailable: boolean;
  userEmail?: string;
}

export function RegistrationSidebar({
  storageAvailable,
  userEmail,
}: RegistrationSidebarProps) {
  return (
    <aside className="rounded-xl bg-soft p-5 md:p-6">
      <h2 className="font-heading text-xl font-semibold">Sau khi gửi hồ sơ</h2>
      <ul className="mt-4 space-y-4 text-sm leading-6">
        <li>Open Slot xem xét thông tin nghề và địa điểm của studio.</li>
        <li>Bạn theo dõi trạng thái trong mục Quản lý studio.</li>
        <li>Sau khi được duyệt, bạn có thể chia sẻ trang studio công khai.</li>
      </ul>
      <p className="mt-5 text-sm text-muted">
        {storageAvailable
          ? 'Bản nháp được giữ trong phiên trình duyệt này.'
          : 'Trình duyệt đang chặn lưu bản nháp; thông tin sẽ mất khi bạn rời trang.'}{' '}
        Chỉ bấm gửi mới chuyển hồ sơ đến bước xét duyệt.
      </p>
      {userEmail && (
        <p className="mt-4 break-all text-sm">
          Tài khoản chủ studio:
          <br />
          <strong>{userEmail}</strong>
        </p>
      )}
    </aside>
  );
}
