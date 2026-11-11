import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Compass,
  ArrowLeft,
  Home,
  Sparkles,
  HelpCircle,
  Search,
  Palette,
  Flame,
  Scissors,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { PageContainer } from '../components/layout/PageContainer';

const popularCategories = [
  {
    name: 'Gốm thủ công & Vuốt bàn xoay',
    href: '/kham-pha?category=gom',
    icon: Sparkles,
    desc: 'Tự tay nhào nặn bình hoa, cốc sứ',
  },
  {
    name: 'Nến thơm & Tinh dầu tự nhiên',
    href: '/kham-pha?category=nen-thom',
    icon: Flame,
    desc: 'Pha phối nốt hương riêng cho bạn',
  },
  {
    name: 'Tranh mosaic & Vẽ acrylic',
    href: '/kham-pha?category=hoi-hoa',
    icon: Palette,
    desc: 'Ghép mảnh màu sắc và sáng tạo tranh',
  },
  {
    name: 'Thêu may & Đan len Macrame',
    href: '/kham-pha?category=theu-det',
    icon: Scissors,
    desc: 'Chậm rãi từng đường kim mũi chỉ',
  },
];

export function NotFoundPage() {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = '404 - Không tìm thấy trang | Open Slot';
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  return (
    <main className="min-h-[75vh] flex items-center py-12 md:py-20 bg-gradient-to-b from-paper via-surface to-soft/40">
      <PageContainer className="max-w-4xl text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary uppercase tracking-widest mb-6">
          <Compass className="h-4 w-4 animate-spin [animation-duration:8s]" aria-hidden="true" />
          <span>Lỗi 404 · Lạc lối giữa các xưởng</span>
        </div>

        {/* 404 Large typography with artistic subtle touch */}
        <div className="relative mb-4 select-none">
          <span className="font-heading text-8xl sm:text-9xl font-black tracking-tight text-ink/10 block leading-none">
            404
          </span>
          <div className="absolute inset-0 flex items-center justify-center">
            <h1 className="font-heading text-2xl sm:text-4xl font-bold text-ink">
              Không tìm thấy trang bạn yêu cầu
            </h1>
          </div>
        </div>

        {/* Description */}
        <p className="mx-auto max-w-xl text-base sm:text-lg leading-relaxed text-muted mb-8">
          Có thể đường dẫn đã bị thay đổi, workshop đã kết thúc hoặc bạn vừa gõ nhầm một ký tự. Đừng lo lắng, còn rất nhiều trải nghiệm sáng tạo thú vị đang chờ bạn!
        </p>

        {/* Primary Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 mb-14">
          <Button
            type="button"
            variant="outline"
            className="gap-2 min-h-11 px-5"
            onClick={() => {
              if (window.history.length > 1) {
                navigate(-1);
              } else {
                navigate('/');
              }
            }}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Quay lại trang trước</span>
          </Button>

          <Button asChild className="gap-2 min-h-11 px-6 shadow-sm">
            <Link to="/">
              <Home className="h-4 w-4" aria-hidden="true" />
              <span>Về trang chủ</span>
            </Link>
          </Button>

          <Button asChild variant="secondary" className="gap-2 min-h-11 px-6">
            <Link to="/kham-pha">
              <Search className="h-4 w-4" aria-hidden="true" />
              <span>Khám phá workshop</span>
            </Link>
          </Button>
        </div>

        {/* Suggestions section */}
        <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8 text-left shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5 border-b border-line pb-4">
            <div>
              <h2 className="text-base sm:text-lg font-bold font-heading text-ink">
                Gợi ý các trải nghiệm thủ công được yêu thích
              </h2>
              <p className="text-xs sm:text-sm text-muted">
                Tìm một buổi chiều thảnh thơi và bắt đầu tạo ra tác phẩm của riêng bạn
              </p>
            </div>
            <Link
              to="/kham-pha"
              className="text-xs sm:text-sm font-semibold text-primary hover:underline underline-offset-4"
            >
              Xem tất cả →
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {popularCategories.map((cat) => {
              const Icon = cat.icon;
              return (
                <Link
                  key={cat.name}
                  to={cat.href}
                  className="group flex items-start gap-3.5 rounded-xl border border-line/70 bg-soft/40 p-4 transition-all duration-200 hover:border-primary/50 hover:bg-surface hover:shadow-sm"
                >
                  <div className="rounded-lg bg-surface p-2.5 text-primary shadow-xs group-hover:bg-primary group-hover:text-white transition-colors">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-ink group-hover:text-primary transition-colors">
                      {cat.name}
                    </h3>
                    <p className="mt-0.5 text-xs text-muted">{cat.desc}</p>
                  </div>
                </Link>
              );
            })}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line/70 pt-4 text-xs text-muted">
            <div className="flex items-center gap-1.5">
              <HelpCircle className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
              <span>Cần trợ giúp khẩn cấp để tìm lại thông tin đặt chỗ?</span>
            </div>
            <div className="flex items-center gap-3">
              <Link to="/tro-giup" className="font-semibold text-ink hover:text-primary underline-offset-4 hover:underline">
                Câu hỏi thường gặp
              </Link>
              <span>·</span>
              <Link to="/lien-he" className="font-semibold text-ink hover:text-primary underline-offset-4 hover:underline">
                Liên hệ hỗ trợ
              </Link>
            </div>
          </div>
        </div>
      </PageContainer>
    </main>
  );
}
