# Validation form bằng Zod

Mọi form nhập liệu phải gọi `safeParse` trước khi gửi request hoặc điều hướng. Chỉ dùng dữ liệu từ `parsed.data` sau khi thành công. Thuộc tính HTML như `required`, `minLength` và `maxLength` hỗ trợ trải nghiệm nhập liệu; không thay thế schema. Các API nhận payload từ form vẫn phải kiểm tra Zod độc lập.

| Form hiện có       | Schema tại bước submit                                                                                                                        |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Đăng nhập          | `loginFormSchema` trong `apps/web/src/lib/auth-validation.ts`                                                                                 |
| Tạo tài khoản      | `registrationFormSchema`, mở rộng từ `registrationInputSchema` dùng chung với API                                                             |
| Đăng ký studio     | `studioProfileInputSchema`                                                                                                                    |
| Tạo/sửa workshop   | `studioWorkshopInputSchema` hoặc `studioWorkshopUpdateInputSchema`; giá nhập thô qua `requiredPriceFormSchema`                                |
| Tạo/sửa buổi       | `studioSessionInputSchema` hoặc `studioSessionUpdateInputSchema`; chọn workshop qua `workshopSelectionSchema` và danh sách workshop hiện hành |
| Tìm kiếm trang chủ | `homeSearchFormSchema` và tỉnh/thành trong danh mục hiện hành                                                                                 |
| Tìm kiếm header    | `searchQuerySchema`                                                                                                                           |
| Đặt chỗ workshop   | `bookingFormSchema`, kiểm tra số nguyên, tối đa 10 người và số chỗ còn lại                                                                    |

Thao tác duyệt workshop (gửi qua nút, không phải thẻ `<form>`) cũng kiểm tra `workshopDecisionSchema` tại trang và service. Bộ lọc Khám phá kiểm tra Zod khi đọc URL, gồm cả từ khóa tìm kiếm. Các schema quản lý nằm trong `apps/web/src/types/management.ts`; schema tìm kiếm/đặt chỗ nằm trong `apps/web/src/lib/form-validation.ts`.

Mật khẩu mới bắt buộc 12–128 ký tự, chữ hoa, chữ thường, số và ký tự đặc biệt; các quy tắc được định nghĩa ở `packages/shared/src/password-policy.ts`. Khoảng trắng không được tính là ký tự đặc biệt. Đăng nhập tài khoản cũ giữ mức tối thiểu 8 ký tự, không áp lại quy tắc tạo mới. Kiểm tra dữ liệu bị lộ là bước bất đồng bộ bổ sung phía API, không thay thế validation Zod.

## Điều hướng xác thực

Hai trang xác thực dùng `AuthLayout`: nút Quay lại, logo liên kết trang chủ và form giữa trang; không có header/footer toàn site. Nút Quay lại dùng chỉ số lịch sử React Router: có trang trước trong ứng dụng thì quay lại; mở trực tiếp (`idx = 0`) thì về `/`, kể cả khi trình duyệt còn một mục `about:blank` trong lịch sử.

`AuthLink` ghi địa chỉ hiện tại (gồm query/hash) vào tham số `redirect`, đồng thời giữ nó khi đổi giữa đăng nhập và tạo tài khoản. `auth-navigation.ts` kiểm tra redirect bằng Zod: chỉ cho phép đường dẫn nội bộ, không cho quay về trang xác thực, mặc định `/`. Sau đăng ký, web mở phiên bằng API đăng nhập rồi chuyển đến đích; nếu tạo tài khoản thành công nhưng mở phiên thất bại thì chuyển sang form đăng nhập, giữ redirect và thông báo tài khoản đã được tạo.
