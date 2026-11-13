import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  HelpCircle,
  Search,
  ChevronDown,
  MessageCircle,
  Phone,
  Mail,
} from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Button } from '@/components/ui/button';
import { useSiteInformation } from '@/hooks/useSiteInformation';

interface FaqItem {
  id: string;
  category: 'hoc-vien' | 'thanh-toan' | 'studio' | 'tai-khoan';
  question: string;
  answer: string | React.ReactNode;
}

const faqs: FaqItem[] = [
  // 1. Học viên
  {
    id: 'hv-1',
    category: 'hoc-vien',
    question:
      'Tôi chưa từng làm đồ thủ công bao giờ thì có tham gia workshop được không?',
    answer:
      'Hoàn toàn được! Đại đa số các workshop trên Open Slot đều được thiết kế thân thiện cho người mới bắt đầu (Beginner-friendly). Nghệ nhân tại studio sẽ hướng dẫn bạn tỉ mỉ từng bước từ khâu làm quen dụng cụ, tạo hình đến hoàn thiện sản phẩm. Bạn chỉ cần mang theo sự cởi mở và sẵn sàng trải nghiệm.',
  },
  {
    id: 'hv-2',
    category: 'hoc-vien',
    question: 'Tôi cần chuẩn bị những gì trước khi đến buổi workshop?',
    answer:
      'Mọi nguyên vật liệu chính, tạp dề và trang thiết bị chuyên dụng đã được studio chuẩn bị sẵn sàng. Bạn chỉ cần mặc trang phục thoải mái, gọn gàng (với bộ môn làm gốm vuốt bàn xoay nên cắt tỉa móng tay gọn gàng và tránh mặc đồ trắng tinh). Hãy đến sớm 10 - 15 phút trước giờ bắt đầu để ổn định chỗ ngồi nhé.',
  },
  {
    id: 'hv-3',
    category: 'hoc-vien',
    question: 'Thành phẩm sau buổi học tôi có được mang về không?',
    answer:
      'Tất cả sản phẩm do bạn tự tay tạo ra đều thuộc quyền sở hữu của bạn! Với các bộ môn như làm nến thơm, tranh canvas, thêu may hoặc cắm hoa, bạn có thể mang về ngay sau buổi học. Riêng với gốm thủ công, sản phẩm cần trải qua giai đoạn hong khô, tráng men và nung ở nhiệt độ cao (thường mất 7 - 14 ngày), studio sẽ hẹn bạn đến lấy hoặc hỗ trợ gửi chuyển phát nhanh về tận nhà.',
  },
  {
    id: 'hv-4',
    category: 'hoc-vien',
    question: 'Nếu tôi đến muộn thì có được vào lớp không?',
    answer:
      'Nếu bạn có khả năng đến muộn, vui lòng liên hệ ngay với hotline của studio để thông báo. Studio vẫn sẽ đón tiếp bạn nếu trễ dưới 20 phút, tuy nhiên bạn có thể bị lỡ phần hướng dẫn lý thuyết ban đầu và buổi học vẫn sẽ kết thúc đúng giờ theo lịch trình chung.',
  },

  // 2. Thanh toán & Hoàn hủy
  {
    id: 'tt-1',
    category: 'thanh-toan',
    question: 'Quy định hủy buổi học và hoàn tiền như thế nào?',
    answer:
      'Open Slot áp dụng chính sách hoàn hủy minh bạch:\n• Hủy trước 48 giờ: Hoàn 100% học phí hoặc đổi buổi học khác miễn phí.\n• Hủy từ 24h - 48 giờ: Hoàn 50% chi phí (do studio đã giữ chỗ và chuẩn bị nguyên vật liệu).\n• Hủy dưới 24 giờ hoặc vắng mặt: Rất tiếc không thể hoàn phí, tuy nhiên bạn có thể nhờ bạn bè hoặc người thân đi thay bằng cách gửi mã vé check-in cho họ.',
  },
  {
    id: 'tt-2',
    category: 'thanh-toan',
    question: 'Sau khi yêu cầu hủy vé thì bao lâu tôi nhận được tiền hoàn?',
    answer:
      'Sau khi yêu cầu hoàn vé được chấp thuận, hệ thống sẽ thực hiện lệnh hoàn tiền tự động về tài khoản ngân hàng của bạn trong vòng từ 3 - 5 ngày làm việc (không tính Thứ 7, Chủ Nhật và ngày lễ). Bạn có thể thêm số tài khoản nhận tiền hoàn trong trang "Tài khoản nhận tiền hoàn" của mình.',
  },
  {
    id: 'tt-3',
    category: 'thanh-toan',
    question: 'Open Slot hỗ trợ những phương thức thanh toán nào?',
    answer:
      'Hệ thống hỗ trợ thanh toán trực tuyến qua quét mã VietQR ngân hàng, thẻ ATM nội địa, thẻ quốc tế (Visa / Mastercard), cũng như thanh toán tại studio đối với một số studio có hỗ trợ đặt cọc linh hoạt.',
  },

  // 3. Studio & Nghệ nhân
  {
    id: 'st-1',
    category: 'studio',
    question: 'Làm thế nào để tôi có thể mở bán workshop trên Open Slot?',
    answer:
      'Rất đơn giản! Bạn chỉ cần vào trang "Mở studio trên Open Slot" và bấm "Đăng ký mở Studio". Điền các thông tin về tên studio, địa chỉ, hình ảnh không gian và các minh chứng chuyên môn/giấy phép kinh doanh nếu có. Đội ngũ kiểm duyệt của Open Slot sẽ liên hệ xác minh và kích hoạt tài khoản quản lý studio trong vòng 24 - 48 giờ làm việc.',
  },
  {
    id: 'st-2',
    category: 'studio',
    question: 'Studio điểm danh học viên tại buổi học bằng cách nào?',
    answer:
      'Open Slot cung cấp công cụ Check-in QR trực tiếp trên giao diện Studio. Mỗi học viên khi đặt chỗ thành công sẽ có một mã vé QR riêng. Khi học viên đến, người phụ trách chỉ cần mở trang Check-in trên điện thoại hoặc máy tính bảng để quét mã hoặc nhập mã vé là hệ thống tự động cập nhật trạng thái đã tham gia.',
  },
  {
    id: 'st-3',
    category: 'studio',
    question: 'Doanh thu từ các buổi workshop được quyết toán như thế nào?',
    answer:
      'Doanh thu từ các buổi học đã diễn ra thành công sẽ được đối soát tự động theo chu kỳ tuần hoặc tháng. Studio có thể theo dõi doanh thu chi tiết trong mục Tài chính của Studio Dashboard và nhận chuyển khoản về tài khoản ngân hàng doanh nghiệp/cá nhân đã đăng ký.',
  },

  // 4. Tài khoản & Bảo mật
  {
    id: 'tk-1',
    category: 'tai-khoan',
    question: 'Tôi bị quên mật khẩu thì lấy lại bằng cách nào?',
    answer:
      'Bạn chỉ cần truy cập trang Đăng nhập và chọn "Quên mật khẩu", sau đó nhập địa chỉ email đã đăng ký. Hệ thống sẽ gửi cho bạn một liên kết an toàn để thiết lập mật khẩu mới trong vài phút.',
  },
  {
    id: 'tk-2',
    category: 'tai-khoan',
    question: 'Thông tin cá nhân của tôi có được bảo mật không?',
    answer:
      'Open Slot cam kết tuân thủ nghiêm ngặt các tiêu chuẩn bảo mật dữ liệu. Thông tin cá nhân (email, số điện thoại) chỉ được dùng để gửi mã vé, thông báo lịch học và hỗ trợ kỹ thuật. Chúng tôi tuyệt đối không cung cấp dữ liệu cho bất kỳ bên thứ ba nào vì mục đích quảng cáo rác.',
  },
];

const categoryTabs = [
  { key: 'all', label: 'Tất cả câu hỏi' },
  { key: 'hoc-vien', label: 'Dành cho Học viên' },
  { key: 'thanh-toan', label: 'Thanh toán & Vé' },
  { key: 'studio', label: 'Dành cho Studio' },
  { key: 'tai-khoan', label: 'Tài khoản & Bảo mật' },
];

export function FaqPage() {
  const { siteContact } = useSiteInformation();
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({
    'hv-1': true,
    'tt-1': true,
  });

  useEffect(() => {
    document.title = 'Câu hỏi thường gặp & Trợ giúp | Open Slot';
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const toggleItem = (id: string) => {
    setOpenItems((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const filteredFaqs = useMemo(() => {
    return faqs.filter((item) => {
      const matchCategory =
        activeCategory === 'all' || item.category === activeCategory;
      const matchSearch =
        searchQuery.trim() === '' ||
        item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (typeof item.answer === 'string' &&
          item.answer.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchCategory && matchSearch;
    });
  }, [activeCategory, searchQuery]);

  return (
    <main className="min-h-screen py-8 md:py-14 bg-paper">
      <PageContainer className="max-w-4xl">
        <PageBreadcrumb
          className="mb-6"
          items={[{ label: 'Trợ giúp & Câu hỏi thường gặp' }]}
        />

        {/* Hero Header */}
        <div className="text-center mb-10 md:mb-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1 text-xs font-semibold text-primary uppercase tracking-wider mb-4">
            <HelpCircle className="h-4 w-4" aria-hidden="true" />
            <span>Trung tâm trợ giúp Open Slot</span>
          </div>
          <h1 className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold text-ink">
            Câu hỏi thường gặp
          </h1>
          <p className="mt-3 text-base sm:text-lg text-muted max-w-xl mx-auto">
            Mọi thông tin bạn cần về cách chọn workshop, thanh toán, tham gia
            lớp học và mở không gian sáng tạo.
          </p>

          {/* Search Bar */}
          <div className="relative mt-8 max-w-xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm câu hỏi (ví dụ: hoàn tiền, làm gốm, trễ giờ, mở studio...)"
              className="w-full rounded-2xl border border-line bg-surface pl-12 pr-4 py-3.5 text-sm sm:text-base text-ink placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-xs"
            />
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-6 scrollbar-none">
          {categoryTabs.map((cat) => {
            const isActive = activeCategory === cat.key;
            return (
              <button
                key={cat.key}
                type="button"
                onClick={() => setActiveCategory(cat.key)}
                className={`whitespace-nowrap rounded-xl px-4 py-2 text-xs sm:text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-primary text-white shadow-xs'
                    : 'bg-surface text-ink border border-line hover:bg-soft'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* FAQs List */}
        {filteredFaqs.length === 0 ? (
          <div className="rounded-2xl border border-line bg-surface p-12 text-center shadow-xs">
            <HelpCircle className="mx-auto h-12 w-12 text-muted mb-3" />
            <h2 className="text-lg font-semibold text-ink">
              Không tìm thấy câu trả lời phù hợp
            </h2>
            <p className="mt-1 text-sm text-muted">
              Thử tìm kiếm với từ khóa khác hoặc liên hệ trực tiếp với chúng tôi
              để được giải đáp.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => {
                setSearchQuery('');
                setActiveCategory('all');
              }}
            >
              Xem tất cả câu hỏi
            </Button>
          </div>
        ) : (
          <div className="space-y-3.5">
            {filteredFaqs.map((faq) => {
              const isOpen = Boolean(openItems[faq.id]);
              return (
                <div
                  key={faq.id}
                  className="rounded-2xl border border-line bg-surface transition-shadow hover:shadow-xs overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => toggleItem(faq.id)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between gap-4 p-5 sm:p-6 text-left transition-colors hover:bg-soft/40"
                  >
                    <span className="text-base sm:text-lg font-semibold text-ink font-heading leading-snug">
                      {faq.question}
                    </span>
                    <span
                      className={`shrink-0 rounded-full p-1.5 transition-transform duration-200 ${
                        isOpen
                          ? 'rotate-180 bg-primary/10 text-primary'
                          : 'bg-soft text-muted'
                      }`}
                    >
                      <ChevronDown className="h-4 w-4" aria-hidden="true" />
                    </span>
                  </button>

                  {isOpen && (
                    <div className="border-t border-line/60 px-5 sm:px-6 py-4 bg-soft/20 text-sm sm:text-base leading-relaxed text-stone-700 whitespace-pre-line animate-in fade-in-50 duration-200">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Still need help banner */}
        <div className="mt-12 sm:mt-16 rounded-3xl border border-line bg-gradient-to-br from-soft via-surface to-paper p-6 sm:p-8 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <h2 className="text-xl sm:text-2xl font-bold font-heading text-ink">
              Vẫn còn câu hỏi chưa được giải đáp?
            </h2>
            <p className="text-sm text-muted max-w-md">
              Đội ngũ hỗ trợ của Open Slot luôn túc trực để hỗ trợ bạn từ việc
              đặt lịch, thanh toán đến chuẩn bị cho buổi trải nghiệm.
            </p>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 pt-2 text-xs text-ink">
              {siteContact.hotline && (
                <div className="flex items-center gap-1.5">
                  <Phone className="h-4 w-4 text-primary" />
                  <span>
                    Hotline: <strong>{siteContact.hotline}</strong>
                  </span>
                </div>
              )}
              {siteContact.email && (
                <div className="flex items-center gap-1.5">
                  <Mail className="h-4 w-4 text-primary" />
                  <span>
                    Email: <strong>{siteContact.email}</strong>
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto shrink-0">
            <Button asChild variant="default" className="gap-2 min-h-11">
              <Link to="/lien-he">
                <MessageCircle className="h-4 w-4" />
                <span>Gửi lời nhắn cho chúng tôi</span>
              </Link>
            </Button>
          </div>
        </div>
      </PageContainer>
    </main>
  );
}
