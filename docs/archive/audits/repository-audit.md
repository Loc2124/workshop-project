# Kiểm kê file và thư mục Open Slot

> **LƯU TRỮ — không dùng làm chính sách hoặc trạng thái hiện hành.** Giữ nguyên nội dung như bằng chứng/bản nháp lịch sử. Quy tắc hiện hành, phạm vi đã có và việc còn thiếu được dẫn từ [mục lục tài liệu](../../README.md).

Ngày rà soát: 30/10/2026. Đã dọn các mục xác nhận không dùng theo yêu cầu tiếp theo của người dùng; xem mục 9. Các bảng bên dưới giữ lại kết quả kiểm kê ban đầu để đối chiếu.

## Phạm vi và cách kiểm tra

Đã kiểm kê 341 file ngoài `.git`, thư viện cài đặt và thư mục build tại thời điểm quét, gồm mã nguồn, cấu hình, tài liệu, dữ liệu và sản phẩm kiểm thử. Không đọc nội dung `.env` chứa bí mật. Danh mục chi tiết và thống kê nằm ở `output/repository-audit/inventory.json`.

Đã đối chiếu import/re-export/import động dạng chuỗi trong TypeScript/JavaScript; xử lý cả import `.js` trỏ về source `.ts` của API; tìm file trùng nội dung, placeholder, script, cấu hình CI/deploy và dependency theo từng workspace. Đây là kiểm kê tĩnh, không phải chứng minh mọi nhánh nghiệp vụ đều đúng hoặc mọi file không có import đều có thể xóa: entrypoint, type declaration, script CLI và cấu hình được kiểm tra riêng.

## 1. File nguồn chưa dùng — có thể bỏ nếu không định dùng tiếp

| File                                    | Bằng chứng / điều kiện                                                                                                                                                              |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/components/ui/badge.tsx`  | Không có import từ phần source khác; các badge hiện dùng Tailwind trực tiếp.                                                                                                        |
| `apps/web/src/components/ui/card.tsx`   | Không có import; workshop/studio dùng TicketShell.                                                                                                                                  |
| `apps/web/src/components/ui/select.tsx` | Không có import; giao diện dùng native select hoặc combobox riêng. Nếu bỏ file này, cân nhắc gỡ `@radix-ui/react-select` cùng lúc.                                                  |
| `apps/web/src/constants/provinces.ts`   | Không có import và trùng từng byte với `apps/api/src/constants/vietnam-provinces.ts`. Web hiện lấy tỉnh từ API hoặc mock studios. Giữ bản API vì `scripts/seed-sample.ts` vẫn dùng. |
| `packages/shared/src/auth.ts`           | Chưa được import/re-export; schema đăng ký/đăng nhập lặp với `apps/api/src/modules/auth/auth.schemas.ts`. Nên chọn một nơi làm nguồn chuẩn, hoặc bỏ bản shared chưa dùng.           |

File thứ sáu không có import đến là `packages/shared/src/index.ts`, nhưng đây là entrypoint đang được khai báo trong manifest và chỉ chứa `export {}`. Không xóa riêng file này rồi để `main`/`types` trỏ tới đường dẫn hỏng. Nếu bỏ workspace shared phải cập nhật root workspaces, manifest, lockfile và cấu hình liên quan; hiện chưa làm.

## 2. File tạm, log và ảnh kiểm thử — không cần cho ứng dụng chạy

| Đường dẫn                                                                                            | Đề xuất                                                                                                                                                                                |
| ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.playwright-cli/`                                                                                   | Log/snapshot của công cụ; có thể dọn sau khi lưu bằng chứng cần dùng. 6 file tại thời điểm quét.                                                                                       |
| `.playwright-mcp/`                                                                                   | Ảnh/log/snapshot của công cụ; không được ứng dụng import. 12 file.                                                                                                                     |
| `.taste-skill/before/`, `after/`, `production/`                                                      | Ảnh và kết quả review thiết kế. Có thể lưu trữ ngoài source; giữ `direction.json` nếu muốn giữ quyết định thiết kế. Cả `.taste-skill/` khoảng 2.37 MiB, 24 file.                       |
| `output/logo-wordmark-path.json`                                                                     | Dữ liệu trung gian khi chuyển chữ thành path; SVG hoàn chỉnh không phụ thuộc file này.                                                                                                 |
| `output/open-slot-logo-preview.png`                                                                  | Bản xem trước raster; không cần cho logo SVG hoạt động.                                                                                                                                |
| Ảnh PNG, PDF, log, JSON kết quả trong `output/playwright/` và báo cáo cũ trong `output/code-review/` | Chỉ cần lưu khi dùng làm bằng chứng/đối chiếu; không dùng khi build ứng dụng. Các báo cáo cũ có thể mô tả giao diện đã thay đổi.                                                       |
| Các script `.py`/`.ts` trong `output/`                                                               | Một số vẫn hữu ích cho regression và được tài liệu dẫn tới. Nên chuyển script còn dùng sang `scripts/ui/` hoặc thư mục kiểm thử rồi cập nhật đường dẫn, thay vì xóa toàn bộ `output/`. |

`output/` có 117 file, khoảng 18.89 MiB trước khi tạo báo cáo kiểm kê này. Không đánh đồng toàn bộ thư mục với rác: nó chứa cả script kiểm tra và bằng chứng. Có thể bổ sung quy tắc ignore riêng cho ảnh/log sau khi thống nhất vị trí lưu script.

## 3. Script và tài liệu cũ — nên sửa hoặc lưu trữ

| File                                            | Vấn đề                                                                                                                                                                                         |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `homepage-responsive-check.py`                  | Script chạy thủ công, ghi ảnh vào đường dẫn tuyệt đối `.copilot/session-state/...` của máy cũ; không nằm trong package scripts hoặc CI. Nên bỏ hoặc chuyển thành script dùng output tương đối. |
| `scripts/filter-ui-smoke.py`                    | Có đường dẫn `.copilot/session-state/...` và cổng 5173 cố định; không được package scripts/CI gọi. Nên sửa trước khi dùng lại, hoặc bỏ nếu đã có bộ kiểm tra thay thế.                         |
| `docs/archive/design/marketnest-DESIGN.md`      | Tài liệu tham khảo MarketNest cũ, gọi màu cam là primary trong khi Open Slot hiện dùng xanh. Không cần khi chạy ứng dụng; nên đánh dấu tham khảo/lưu trữ để tránh chỉ dẫn nhận diện mâu thuẫn. |
| `.prettierignore`                               | Chỉ còn các mục Next.js (`next-env.d.ts`, `.next/`) dù web là Vite. Các dòng này không còn tác dụng với cấu trúc hiện tại; không cần xóa cả file để ứng dụng hoạt động.                        |
| `apps/web/public/brand/preview.html`            | Trang xem logo cho thiết kế, không phải route ứng dụng. Có thể chuyển ra thư mục thiết kế để không đưa vào public build.                                                                       |
| `docs/engineering/brand-assets.md`              | Hữu ích để hướng dẫn dùng logo, nhưng không cần public trên website; có thể chuyển vào docs.                                                                                                   |
| `apps/web/public/brand/open-slot-logo-mono.svg` | Biến thể một màu chưa được ứng dụng gọi. Giữ nếu dùng cho in/nhận diện; có thể chuyển sang tài sản thiết kế. Không xóa logo chính hoặc favicon.                                                |

## 4. Placeholder và dependency chưa cần ở phiên bản hiện tại

- `apps/web/src/components/workshops/.gitkeep`: thư mục chưa có implementation, có thể bỏ placeholder vì component hiện ở `catalog/` và `tickets/`.
- `apps/web/src/schemas/.gitkeep`: chưa có form schema. Có thể bỏ placeholder, hoặc giữ nếu sắp làm form.
- `services/ranker/.gitkeep`: hiện chưa có code Python, nhưng ranker là phần đã ghi trong mục tiêu đồ án. Đây là phần chưa triển khai, không kết luận là chức năng không cần.
- Web chưa trực tiếp import `@hookform/resolvers`, `@radix-ui/react-label`, `react-hook-form`, `zod`. Có thể gỡ nếu không làm form ngay; React Hook Form/Zod nằm trong tech stack dự kiến nên cần cân nhắc kế hoạch. Không gỡ `zod` của API: API đang dùng.
- `@radix-ui/react-select` chỉ được import bởi component `ui/select.tsx` chưa dùng; chỉ gỡ dependency sau khi bỏ component đó.

Sau bước kiểm kê, đã gỡ hai dependency Radix không dùng và cập nhật manifest/lockfile bằng npm; các thư viện form dự kiến vẫn được giữ. Xem mục 9.

## 5. Thư mục sinh tự động — tái tạo được, không phải mã thừa

- `node_modules/`, `apps/api/node_modules/`, `apps/web/node_modules/`: npm quản lý, cần khi phát triển/chạy lệnh; không chỉnh thủ công hay commit. Có thể tái tạo bằng `npm ci`.
- `apps/api/dist/`, `apps/web/dist/`: build output, được tạo lại bằng build; có thể cần khi chạy/deploy production. Không xóa khi ứng dụng đang phục vụ trực tiếp từ đó.
- `.git/`: dữ liệu lịch sử repository, giữ nguyên.

## 6. Những phần cần giữ

- `.env`, `.env.example`, `package-lock.json`, manifest, tsconfig, Vite/Tailwind/ESLint/Prettier, CI và cấu hình Render/Vercel: phục vụ môi trường, build, kiểm tra hoặc deploy.
- `db/migrations/`: lịch sử schema; không xóa migration cũ chỉ vì đã chạy.
- `scripts/migrate.ts`, `assert-safe-test-db.ts`, `seed-sample.ts`, `seed-admin.ts`: tác vụ CLI/quy trình an toàn; không đánh giá bằng import UI.
- Toàn bộ API modules đang được route/service/test gọi, bao gồm `bookings.repository.ts`: catalog dùng hàm giải phóng giữ chỗ hết hạn.
- `data/`, `apps/web/src/data/`, `/demo/ve` và component demo: có nơi sử dụng hoặc phục vụ phần mô phỏng của đồ án.
- Các file type, `vite-env.d.ts`, entrypoint web/API, CSS/Tailwind và `components.json` (cấu hình generator UI): không phải component thừa chỉ vì không có nơi import theo cách thông thường.
- `docs/00`–`06`, kiến trúc/deploy và tài liệu đồ án: tài liệu chức năng/triển khai, không cần được source import để có giá trị.

## 7. Logo đã sửa

`Logo.tsx` dùng `open-slot-logo.svg` chữ O mở khe, giữ kích thước/tỉ lệ, alt và đường dẫn theo BASE_URL. Header mọi trang dùng cùng component. `open-slot-symbol.svg` đã khôi phục đúng biểu tượng của logo để favicon không còn lệch mẫu; README nhận diện không còn ghi hai phương án đang được dùng đồng thời.

## 8. Kiểm tra đã thực hiện

- `npm run build`: API và web build thành công.
- `npx eslint apps packages scripts`: thành công.
- Logo trên trang chủ, khám phá, demo vé, nghệ nhân ở 1440/1024/768/360px: tải đúng SVG, không tràn ngang; menu mobile, link về trang chủ và favicon hoạt động; không lỗi runtime trong kiểm tra.
- Không chạy migration, seed hay integration test có ghi database trong lần kiểm kê này.

## 9. Đã dọn sau kiểm kê

Theo yêu cầu xóa các mục nên xóa, đã xóa **28 file** và bốn thư mục trống/tạm:

- Ba component `ui/badge.tsx`, `ui/card.tsx`, `ui/select.tsx` không có nơi dùng.
- `apps/web/src/constants/provinces.ts` trùng bản API và không có import; bản API phục vụ seed được giữ.
- `packages/shared/src/auth.ts` không được import/re-export; schema auth API và entrypoint shared được giữ.
- Hai script cũ `homepage-responsive-check.py`, `scripts/filter-ui-smoke.py` có đường dẫn tuyệt đối của máy cũ.
- Hai placeholder và thư mục rỗng `apps/web/src/components/workshops/`, `apps/web/src/schemas/`.
- `output/logo-wordmark-path.json`: dữ liệu dựng logo trung gian; SVG logo hoàn chỉnh được giữ.
- 18 file log/snapshot/ảnh cũ trong `.playwright-cli/`, `.playwright-mcp/`; xóa hai thư mục tạm và bổ sung ignore để không đưa lại vào Git.
- Gỡ `@radix-ui/react-select`, `@radix-ui/react-label` bằng npm; manifest và package-lock được cập nhật đồng bộ.

Giữ `services/ranker/`, workspace shared, React Hook Form/Zod, migration, dữ liệu demo, các script kiểm tra hiện dùng và bằng chứng review trong `output/`/`.taste-skill/`. Những phần này vẫn có mục đích sử dụng hoặc nằm trong kế hoạch đồ án. Không thay đổi database.

Danh sách chính xác từng file đã xóa: `output/repository-audit/deleted-files.json`. `inventory.json` là snapshot trước khi dọn, không phải danh mục trạng thái sau khi dọn.

Kiểm tra sau khi dọn: build API/web và ESLint đều đạt. Đã đối chiếu manifest với lockfile, xác nhận hai dependency gỡ bỏ không còn trong lockfile, toàn bộ 28 đường dẫn đã xóa không còn tồn tại và các file cần giữ vẫn còn.
