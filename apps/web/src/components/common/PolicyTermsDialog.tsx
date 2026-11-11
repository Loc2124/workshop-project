import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '../ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { FileText, ShieldCheck, CalendarCheck } from 'lucide-react';
import { Button } from '../ui/button';

export type PolicyTabKey = 'terms' | 'booking' | 'privacy';

export interface PolicyTermsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: PolicyTabKey;
}

export function PolicyTermsDialog({
  open,
  onOpenChange,
  defaultTab = 'terms',
}: PolicyTermsDialogProps) {
  const [activeTab, setActiveTab] = useState<PolicyTabKey>(defaultTab);

  // Synchronize when dialog re-opens with a different tab
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen && defaultTab) {
      setActiveTab(defaultTab);
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[88vh] w-[calc(100%-2rem)] max-w-3xl overflow-hidden p-0 sm:rounded-2xl flex flex-col bg-surface border border-line shadow-2xl">
        <div className="border-b border-line px-6 py-4 bg-soft/50 shrink-0">
          <div className="flex items-center gap-2 text-primary">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            <span className="text-xs font-semibold uppercase tracking-wider">
              Trung tâm pháp lý & Quy định Open Slot
            </span>
          </div>
          <DialogTitle className="text-xl sm:text-2xl font-bold font-heading text-ink mt-1">
            Điều khoản dịch vụ & Chính sách
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-muted">
            Quy định minh bạch nhằm bảo vệ quyền lợi của học viên, người trải
            nghiệm và studio đối tác.
          </DialogDescription>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as PolicyTabKey)}
          className="flex flex-col flex-1 overflow-hidden"
        >
          <div className="border-b border-line px-6 pt-3 pb-1 bg-surface shrink-0">
            <TabsList className="grid w-full grid-cols-3 bg-soft p-1 rounded-xl">
              <TabsTrigger
                value="terms"
                className="flex items-center justify-center gap-1.5 text-xs sm:text-sm py-2"
              >
                <FileText className="h-4 w-4 shrink-0 hidden xs:inline" />
                <span>Điều khoản dịch vụ</span>
              </TabsTrigger>
              <TabsTrigger
                value="booking"
                className="flex items-center justify-center gap-1.5 text-xs sm:text-sm py-2"
              >
                <CalendarCheck className="h-4 w-4 shrink-0 hidden xs:inline" />
                <span>Đặt chỗ & Hoàn huỷ</span>
              </TabsTrigger>
              <TabsTrigger
                value="privacy"
                className="flex items-center justify-center gap-1.5 text-xs sm:text-sm py-2"
              >
                <ShieldCheck className="h-4 w-4 shrink-0 hidden xs:inline" />
                <span>Chính sách bảo mật</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5 text-sm leading-relaxed text-ink/90 space-y-6">
            {/* TAB 1: ĐIỀU KHOẢN DỊCH VỤ */}
            <TabsContent
              value="terms"
              className="mt-0 space-y-5 focus-visible:outline-none"
            >
              <section className="space-y-2">
                <h3 className="text-base font-semibold text-ink flex items-center gap-2">
                  1. Giới thiệu và vai trò của Open Slot
                </h3>
                <p className="text-stone-700">
                  Open Slot là nền tảng công nghệ kết nối những người yêu thích
                  nghệ thuật thủ công (học viên/người trải nghiệm) với các nghệ
                  nhân và studio sáng tạo độc lập. Open Slot cung cấp giải pháp
                  đặt chỗ, thanh toán an toàn, xác thực thông tin và hỗ trợ tổ
                  chức lớp học chuyên nghiệp.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-semibold text-ink flex items-center gap-2">
                  2. Trách nhiệm của người tham gia workshop
                </h3>
                <ul className="list-disc pl-5 space-y-1.5 text-stone-700">
                  <li>
                    <strong>Cung cấp thông tin chuẩn xác:</strong> Cung cấp họ
                    tên, số điện thoại và email chính xác để nhận mã vé điện tử
                    và thông báo cập nhật buổi học.
                  </li>
                  <li>
                    <strong>Đúng giờ & chuẩn bị trang phục:</strong> Đến trước
                    giờ bắt đầu từ 10 - 15 phút. Khuyến khích mang trang phục
                    gọn gàng, phù hợp với đặc thù bộ môn (ví dụ làm gốm, nhuộm
                    vải, cắm hoa, làm mộc).
                  </li>
                  <li>
                    <strong>Tuân thủ quy định an toàn tại studio:</strong> Lắng
                    nghe và làm theo hướng dẫn an toàn của nghệ nhân khi thao
                    tác với các thiết bị nhiệt độ cao (lò nung, súng bắn keo),
                    dụng cụ sắc nhọn hoặc hoá chất nhuộm/sáp.
                  </li>
                  <li>
                    <strong>Tôn trọng không gian chung:</strong> Giữ gìn vệ sinh
                    chung, tôn trọng các học viên cùng ca và cơ sở vật chất của
                    studio.
                  </li>
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-semibold text-ink flex items-center gap-2">
                  3. Quyền sở hữu thành phẩm sáng tạo
                </h3>
                <p className="text-stone-700">
                  Mọi sản phẩm thủ công (bình gốm, tranh mosaic, nến thơm, sản
                  phẩm thêu tay, v.v.) do bạn tự tay tạo ra trong suốt buổi
                  workshop hoàn toàn thuộc quyền sở hữu của bạn.
                </p>
                <p className="text-stone-700">
                  Đối với các bộ môn cần xử lý sau buổi học (như gốm cần phơi,
                  tráng men và nung 2 lần từ 7 - 14 ngày), studio sẽ thông báo
                  lịch nhận cụ thể và hỗ trợ nhận tại xưởng hoặc gửi ship tận
                  nơi (chi phí vận chuyển do học viên tự thanh toán nếu có).
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-semibold text-ink flex items-center gap-2">
                  4. Quyền và trách nhiệm của Studio đối tác
                </h3>
                <p className="text-stone-700">
                  Studio cam kết chuẩn bị đầy đủ không gian, nguyên vật liệu đạt
                  chuẩn và bố trí nghệ nhân hướng dẫn có chuyên môn theo đúng
                  nội dung mô tả của workshop. Studio có quyền từ chối phục vụ
                  học viên có hành vi quấy rối, thiếu tôn trọng hoặc không tuân
                  thủ chỉ dẫn an toàn lao động.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-semibold text-ink flex items-center gap-2">
                  5. Giải quyết sự cố & Tranh chấp
                </h3>
                <p className="text-stone-700">
                  Khi phát sinh sự cố hoặc bất đồng trong quá trình tham gia,
                  các bên ưu tiên thương lượng thiện chí trên tinh thần tôn
                  trọng lẫn nhau. Open Slot đóng vai trò là đơn vị trung gian
                  tiếp nhận phản hồi, kiểm tra chứng cứ và hỗ trợ đưa ra phán
                  quyết công bằng nhất theo quy chế hoạt động.
                </p>
              </section>
            </TabsContent>

            {/* TAB 2: ĐẶT CHỖ & HOÀN HUỶ */}
            <TabsContent
              value="booking"
              className="mt-0 space-y-5 focus-visible:outline-none"
            >
              <section className="space-y-2">
                <h3 className="text-base font-semibold text-ink flex items-center gap-2">
                  1. Xác nhận đặt chỗ & Vé tham dự
                </h3>
                <p className="text-stone-700">
                  Chỗ tham dự của bạn chỉ được bảo lưu chính thức sau khi hệ
                  thống ghi nhận thanh toán thành công (hoặc duyệt đơn từ studio
                  đối với hình thức thanh toán tại xưởng). Mã QR check-in và
                  thông tin vé sẽ được hiển thị trong mục{' '}
                  <strong>Lịch đặt của tôi</strong> và gửi qua email.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-semibold text-ink flex items-center gap-2">
                  2. Khung thời gian và điều kiện hoàn huỷ
                </h3>
                <div className="rounded-xl border border-line overflow-hidden">
                  <div className="grid grid-cols-1 divide-y divide-line sm:grid-cols-3 sm:divide-y-0 sm:divide-x bg-soft/30">
                    <div className="p-4 space-y-1">
                      <span className="inline-block rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-0.5 text-xs font-semibold">
                        Hủy trước 48 giờ
                      </span>
                      <h4 className="font-semibold text-ink text-sm">
                        Hoàn 100% học phí
                      </h4>
                      <p className="text-xs text-muted">
                        Hoàn toàn bộ số tiền đã thanh toán hoặc đổi sang buổi
                        học khác miễn phí.
                      </p>
                    </div>

                    <div className="p-4 space-y-1">
                      <span className="inline-block rounded-full bg-amber-100 text-amber-800 px-2.5 py-0.5 text-xs font-semibold">
                        Hủy từ 24h - 48 giờ
                      </span>
                      <h4 className="font-semibold text-ink text-sm">
                        Hoàn 50% hoặc bảo lưu
                      </h4>
                      <p className="text-xs text-muted">
                        Khấu trừ 50% chi phí chuẩn bị nguyên vật liệu hoặc hỗ
                        trợ đổi buổi học theo thỏa thuận với studio.
                      </p>
                    </div>

                    <div className="p-4 space-y-1">
                      <span className="inline-block rounded-full bg-rose-100 text-rose-800 px-2.5 py-0.5 text-xs font-semibold">
                        Hủy dưới 24 giờ / Vắng mặt
                      </span>
                      <h4 className="font-semibold text-ink text-sm">
                        Không hoàn phí
                      </h4>
                      <p className="text-xs text-muted">
                        Do studio đã khoá slot và chuẩn bị vật liệu chuyên biệt
                        nên không thể hoàn phí. Bạn có thể nhờ người khác đi
                        thay.
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-semibold text-ink flex items-center gap-2">
                  3. Trường hợp Studio đổi lịch hoặc huỷ ca học
                </h3>
                <p className="text-stone-700">
                  Nếu studio buộc phải hoãn hoặc huỷ buổi học vì lý do bất khả
                  kháng (sự cố nghệ nhân, thời tiết xấu, cơ sở vật chất gặp sự
                  cố), bạn sẽ được:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-stone-700">
                  <li>Hoàn 100% toàn bộ chi phí đã thanh toán; hoặc</li>
                  <li>
                    Chuyển sang ca học tiếp theo với quà tặng hoặc voucher ưu
                    đãi từ studio.
                  </li>
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-semibold text-ink flex items-center gap-2">
                  4. Quy trình và thời gian nhận tiền hoàn
                </h3>
                <p className="text-stone-700">
                  Yêu cầu hủy chỗ hợp lệ sẽ được hệ thống xử lý tự động. Tiền
                  hoàn sẽ được chuyển về tài khoản ngân hàng của bạn trong vòng{' '}
                  <strong>3 - 5 ngày làm việc</strong> (tuỳ thuộc vào ngân hàng
                  thụ hưởng). Bạn có thể kiểm tra danh sách tài khoản nhận tiền
                  hoàn trong phần tài khoản cá nhân.
                </p>
              </section>
            </TabsContent>

            {/* TAB 3: CHÍNH SÁCH BẢO MẬT */}
            <TabsContent
              value="privacy"
              className="mt-0 space-y-5 focus-visible:outline-none"
            >
              <section className="space-y-2">
                <h3 className="text-base font-semibold text-ink flex items-center gap-2">
                  1. Thông tin cá nhân thu thập
                </h3>
                <p className="text-stone-700">
                  Để phục vụ việc xác thực tài khoản và tổ chức buổi học an
                  toàn, Open Slot thu thập các thông tin cơ bản:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-stone-700">
                  <li>Họ tên, địa chỉ email, số điện thoại liên lạc.</li>
                  <li>Lịch sử đặt vé và trạng thái thanh toán.</li>
                  <li>
                    Thông tin tài khoản ngân hàng (chỉ thu thập khi bạn yêu cầu
                    nhận tiền hoàn huỷ vé).
                  </li>
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-semibold text-ink flex items-center gap-2">
                  2. Mục đích sử dụng dữ liệu
                </h3>
                <p className="text-stone-700">
                  Chúng tôi cam kết dữ liệu chỉ được sử dụng cho các mục đích
                  chính đáng:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-stone-700">
                  <li>
                    Gửi vé điện tử, thông báo xác nhận và nhắc lịch học trước
                    giờ khởi hành.
                  </li>
                  <li>
                    Cung cấp danh sách học viên cho studio tổ chức để check-in
                    và chuẩn bị thiết bị.
                  </li>
                  <li>
                    Hỗ trợ xử lý khiếu nại, sự cố kỹ thuật hoặc tranh chấp nếu
                    có.
                  </li>
                  <li>
                    <strong>
                      Tuyệt đối không bán hoặc chia sẻ thông tin cho bên thứ ba
                      vì mục đích quảng cáo rác.
                    </strong>
                  </li>
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-semibold text-ink flex items-center gap-2">
                  3. An toàn thông tin thanh toán
                </h3>
                <p className="text-stone-700">
                  Open Slot không trực tiếp lưu trữ mã bảo mật thẻ hoặc mật khẩu
                  ngân hàng của người dùng. Mọi giao dịch tài chính đều được mã
                  hóa và xử lý thông qua các cổng thanh toán uy tín đã được Ngân
                  hàng Nhà nước cấp phép.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-semibold text-ink flex items-center gap-2">
                  4. Quyền của người dùng đối với dữ liệu
                </h3>
                <p className="text-stone-700">
                  Bạn có toàn quyền xem, cập nhật, điều chỉnh thông tin cá nhân
                  trong trang cài đặt tài khoản, hoặc gửi yêu cầu xóa tài khoản
                  và dữ liệu liên quan qua email hỗ trợ của Open Slot bất kỳ lúc
                  nào.
                </p>
              </section>
            </TabsContent>
          </div>
        </Tabs>

        <div className="border-t border-line px-6 py-3.5 bg-soft/40 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <p className="text-xs text-muted">
            Cập nhật lần cuối: Tháng 11/2026 · Phiên bản 2.4
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Tôi đã hiểu & Đóng cửa sổ
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
