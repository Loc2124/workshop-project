# Open Slot — khám phá và đặt chỗ workshop

Đồ án marketplace workshop thủ công tại Việt Nam. Giao diện tiếng Việt, giờ Asia/Ho_Chi_Minh, tiền VND số nguyên. Đồng bộ tài liệu 07/11/2026; chưa xác nhận phát hành production.

**Bắt đầu đọc:** [Mục lục toàn bộ tài liệu](docs/README.md) · [Tổng quan](docs/project/overview.md) · [Mã hiện tại](docs/project/current-status.md) · [Chính sách](docs/policy/README.md) · [Roadmap](docs/project/roadmap.md).

## Chạy dự án

1. Dùng hai DB/Supabase project tách biệt cho dev/demo và test. Sao chép .env.example thành .env, điền đúng DATABASE_URL/DATABASE_URL_TEST và secret; không commit giá trị thật.
2. Chạy npm ci, sau đó npm run migrate cho DB dev/demo đã xác minh đúng đích. Migration có checksum, không sửa SQL đã áp.
3. Chạy npm run dev. Web http://localhost:3000 (Vite strictPort), API http://localhost:4000, GET /health. Xem [deploy](docs/operations/deploy.md) cho biến môi trường và hosting.
4. npm run build kiểm tra/build các workspace; npm run lint kiểm tra mã và định dạng. npm run test --workspace @workshop/web chỉ chạy web.
5. Chỉ khi DB test đã tách biệt và được phép sửa dữ liệu test: bật ALLOW_DESTRUCTIVE_TESTS=true rồi npm run migrate:test và npm run test --workspace @workshop/api. Guard từ chối cấu hình không an toàn; không bật cờ để vượt kiểm tra đích DB.

Dùng Direct hoặc Session pooler 5432, không Transaction pooler 6543 cho API/migration. Máy phát triển không cần PostgreSQL/Docker local; CI dùng PostgreSQL service riêng. API phân quyền bằng phiên/membership, không dùng Supabase Auth hoặc kết nối PostgreSQL từ trình duyệt.

## Phạm vi hiện tại và mục tiêu

Có khám phá/chi tiết, đăng nhập, studio/admin, lịch từng buổi, ba chế độ cọc 1–50%, giữ chỗ, thu cọc/webhook, vé, hủy theo cọc gốc và ghi nhận hoàn thủ công. Đặt sau mốc nhả được miễn xác nhận sẽ đến. **Chưa có hoàn tự động, chi trả studio, ví Bảo Kim hoặc hủy/điểm danh từng vé**; các phần này đã vào phạm vi cần triển khai theo tài liệu mới. Có mã không đồng nghĩa đã kiểm chứng với nhà cung cấp hoặc trên production.

Kết quả kiểm tra và sai lệch còn mở chỉ ghi ở [trạng thái mã](docs/project/current-status.md). Đừng dùng số đo/audit cũ trong archive làm bằng chứng hiện tại. Hướng dẫn AI vẫn ở [CLAUDE.md](CLAUDE.md); tài liệu còn lại đã gom vào docs, trừ file giấy phép cần giữ cạnh tài sản.

Kiểm tra cấu trúc/liên kết tài liệu: node scripts/check-docs.mjs. [Danh mục giữ/lưu trữ và tài liệu không cần đọc thường ngày](docs/danh-muc-tai-lieu.md).
