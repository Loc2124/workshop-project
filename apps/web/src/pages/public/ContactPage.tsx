import { useState, useEffect, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  Mail,
  Phone,
  Clock,
  MapPin,
  Send,
  MessageSquare,
  Sparkles,
  CheckCircle2,
  Building2,
  HeartHandshake,
} from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Button } from '@/components/ui/button';
import { useSiteInformation } from '@/hooks/useSiteInformation';
import { toast } from 'sonner';

export function ContactPage() {
  const { siteContact } = useSiteInformation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    topic: 'tu-van',
    message: '',
  });

  useEffect(() => {
    document.title = 'Liên hệ & Hỗ trợ | Open Slot';
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (
      !formData.fullName.trim() ||
      !formData.email.trim() ||
      !formData.message.trim()
    ) {
      toast.error('Vui lòng điền đầy đủ các thông tin bắt buộc.');
      return;
    }

    setIsSubmitting(true);
    // Simulate sending message with friendly feedback
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSuccess(true);
      toast.success(
        'Cảm ơn bạn đã liên hệ! Đội ngũ Open Slot sẽ phản hồi trong vòng 24 giờ.',
      );
    }, 800);
  };

  const handleReset = () => {
    setFormData({
      fullName: '',
      email: '',
      phone: '',
      topic: 'tu-van',
      message: '',
    });
    setIsSuccess(false);
  };

  return (
    <main className="min-h-screen py-8 md:py-14 bg-paper">
      <PageContainer className="max-w-5xl">
        <PageBreadcrumb
          className="mb-6"
          items={[{ label: 'Liên hệ & Hỗ trợ' }]}
        />

        {/* Section Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1 text-xs font-semibold text-primary uppercase tracking-wider mb-4">
            <HeartHandshake className="h-4 w-4" aria-hidden="true" />
            <span>Kết nối cùng Open Slot</span>
          </div>
          <h1 className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold text-ink">
            Chúng tôi luôn ở đây để lắng nghe bạn
          </h1>
          <p className="mt-3 text-base sm:text-lg text-muted max-w-xl mx-auto">
            Dù bạn cần tư vấn chọn workshop, hỗ trợ vé đặt hay muốn kết nối hợp
            tác mở studio thủ công, đừng ngần ngại nhắn tin cho chúng tôi.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-12 items-start">
          {/* Left Column: Contact Details Cards (5 cols) */}
          <div className="lg:col-span-5 space-y-5">
            <div className="rounded-3xl border border-line bg-surface p-6 sm:p-8 shadow-xs space-y-6">
              <h2 className="text-xl font-bold font-heading text-ink flex items-center gap-2.5">
                <Sparkles className="h-5 w-5 text-primary" />
                <span>Kênh liên lạc trực tiếp</span>
              </h2>

              <div className="space-y-4">
                {siteContact.hotline && (
                  <div className="flex items-start gap-3.5">
                    <div className="rounded-xl bg-primary/10 p-2.5 text-primary shrink-0">
                      <Phone className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                        Hotline hỗ trợ
                      </p>
                      <a
                        href={`tel:${siteContact.hotline.replace(/[^\d+]/g, '')}`}
                        className="text-base font-bold text-ink hover:text-primary transition-colors"
                      >
                        {siteContact.hotline}
                      </a>
                      <p className="text-xs text-muted mt-0.5">
                        Thời gian:{' '}
                        {siteContact.workingHours || '08:30 - 21:00 hàng ngày'}
                      </p>
                    </div>
                  </div>
                )}

                {siteContact.email && (
                  <div className="flex items-start gap-3.5">
                    <div className="rounded-xl bg-primary/10 p-2.5 text-primary shrink-0">
                      <Mail className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                        Hòm thư điện tử
                      </p>
                      <a
                        href={`mailto:${siteContact.email}`}
                        className="text-base font-bold text-ink hover:text-primary transition-colors break-all"
                      >
                        {siteContact.email}
                      </a>
                      <p className="text-xs text-muted mt-0.5">
                        Phản hồi trong vòng 24 giờ làm việc
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3.5">
                  <div className="rounded-xl bg-primary/10 p-2.5 text-primary shrink-0">
                    <Clock className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                      Thời gian làm việc
                    </p>
                    <p className="text-sm font-semibold text-ink">
                      Thứ Hai – Chủ Nhật
                    </p>
                    <p className="text-xs text-muted mt-0.5">
                      Kể cả các ngày nghỉ lễ và cuối tuần
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="rounded-xl bg-primary/10 p-2.5 text-primary shrink-0">
                    <MapPin className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                      Địa chỉ văn phòng
                    </p>
                    <p className="text-sm font-semibold text-ink">
                      Khu Công nghệ cao, TP. Thủ Đức, TP. Hồ Chí Minh
                    </p>
                    <p className="text-xs text-muted mt-0.5">Việt Nam</p>
                  </div>
                </div>
              </div>

              <div className="border-t border-line pt-6">
                <h3 className="text-sm font-bold text-ink mb-2">
                  Bạn là Nghệ nhân hoặc Studio?
                </h3>
                <p className="text-xs text-muted leading-relaxed mb-4">
                  Đăng ký tham gia mạng lưới studio thủ công để tiếp cận hàng
                  nghìn học viên yêu mến sáng tạo.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  asChild
                  className="w-full text-xs"
                >
                  <Link to="/dang-ky-studio">
                    <Building2 className="mr-1.5 h-3.5 w-3.5" />
                    Đăng ký mở Studio của bạn
                  </Link>
                </Button>
              </div>
            </div>
          </div>

          {/* Right Column: Contact Form (7 cols) */}
          <div className="lg:col-span-7">
            <div className="rounded-3xl border border-line bg-surface p-6 sm:p-8 shadow-xs">
              {isSuccess ? (
                <div className="py-12 text-center space-y-4">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <h3 className="text-2xl font-bold font-heading text-ink">
                    Lời nhắn đã được gửi thành công!
                  </h3>
                  <p className="text-sm text-muted max-w-md mx-auto leading-relaxed">
                    Cảm ơn bạn đã dành thời gian liên hệ. Chúng tôi đã nhận được
                    thông tin và sẽ gửi phản hồi chi tiết tới email{' '}
                    <strong className="text-ink">{formData.email}</strong> sớm
                    nhất.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-4"
                    onClick={handleReset}
                  >
                    Gửi thêm lời nhắn khác
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <h2 className="text-xl font-bold font-heading text-ink flex items-center gap-2">
                      <MessageSquare className="h-5 w-5 text-primary" />
                      <span>Gửi lời nhắn cho chúng tôi</span>
                    </h2>
                    <p className="text-xs text-muted mt-1">
                      Vui lòng điền thông tin bên dưới, chuyên viên hỗ trợ sẽ
                      phản hồi bạn trong thời gian sớm nhất.
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label
                        htmlFor="fullName"
                        className="text-xs font-semibold text-ink"
                      >
                        Họ và tên <span className="text-rose-500">*</span>
                      </label>
                      <input
                        id="fullName"
                        type="text"
                        required
                        value={formData.fullName}
                        onChange={(e) =>
                          setFormData({ ...formData, fullName: e.target.value })
                        }
                        placeholder="Ví dụ: Nguyễn Văn An"
                        className="w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label
                        htmlFor="phone"
                        className="text-xs font-semibold text-ink"
                      >
                        Số điện thoại
                      </label>
                      <input
                        id="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) =>
                          setFormData({ ...formData, phone: e.target.value })
                        }
                        placeholder="Ví dụ: 0901234567"
                        className="w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="email"
                      className="text-xs font-semibold text-ink"
                    >
                      Địa chỉ Email <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="email"
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      placeholder="ban@example.com"
                      className="w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="topic"
                      className="text-xs font-semibold text-ink"
                    >
                      Chủ đề hỗ trợ
                    </label>
                    <select
                      id="topic"
                      value={formData.topic}
                      onChange={(e) =>
                        setFormData({ ...formData, topic: e.target.value })
                      }
                      className="w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="tu-van">
                        Tư vấn thông tin workshop & Đặt chỗ
                      </option>
                      <option value="hoan-huy">
                        Hỗ trợ hủy vé, đổi lịch & Hoàn tiền
                      </option>
                      <option value="studio-partner">
                        Hợp tác mở Studio & Đăng tải workshop
                      </option>
                      <option value="ky-thuat">
                        Báo lỗi kỹ thuật hoặc sự cố tài khoản
                      </option>
                      <option value="khac">Nội dung khác</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="message"
                      className="text-xs font-semibold text-ink"
                    >
                      Nội dung tin nhắn <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      id="message"
                      rows={4}
                      required
                      value={formData.message}
                      onChange={(e) =>
                        setFormData({ ...formData, message: e.target.value })
                      }
                      placeholder="Mô tả chi tiết thắc mắc hoặc yêu cầu của bạn để chúng tôi hỗ trợ tốt nhất..."
                      className="w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full min-h-12 text-sm sm:text-base gap-2"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      'Đang gửi lời nhắn…'
                    ) : (
                      <>
                        <Send className="h-4 w-4" aria-hidden="true" />
                        <span>Gửi thông tin liên hệ</span>
                      </>
                    )}
                  </Button>
                </form>
              )}
            </div>
          </div>
        </div>
      </PageContainer>
    </main>
  );
}
