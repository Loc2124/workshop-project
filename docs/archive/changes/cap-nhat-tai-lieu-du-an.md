# Nội dung thay thế cho "Open Slot — Tài liệu dự án"

> **LƯU TRỮ — không dùng làm chính sách hoặc trạng thái hiện hành.** Giữ nguyên nội dung như bằng chứng/bản nháp lịch sử. Quy tắc hiện hành, phạm vi đã có và việc còn thiếu được dẫn từ [mục lục tài liệu](../../README.md).

Bản nháp · 07/11/2026. Dán đè lên các mục tương ứng. Lý do chính: Open Slot nay thu tiền khách rồi payout cho studio, nên mọi câu "không giữ, không chuyển tiền" và "Open Slot chỉ hiển thị, không xử lý hoàn tiền" không còn đúng.

> **Dòng tiền hiện tại:** thu qua payOS (liên kết VietQR Pro) vào tài khoản ngân hàng **cá nhân**; chi (hoàn và payout) qua ví Bảo Kim bằng chi hộ payOS. **Phạm vi đồ án:** chấp nhận rủi ro tài khoản cá nhân; nếu triển khai thực tế phải xử lý các rủi ro ở mục cuối.

---

## Mục 1.3: Phạm vi (thay câu cuối đoạn "Ngoài phạm vi")

Ngoài phạm vi bản đầu: ứng dụng di động native, chat trực tiếp, mã giảm giá, chương trình thành viên, đa ngôn ngữ, mở rộng ra ngoài Việt Nam. Thanh toán trước được thu qua payOS (VietQR) và chi trả cho studio sau buổi học qua chi hộ; xử lý theo mục 4.6. Phần tiền còn lại sau cọc được trả trực tiếp tại studio.

## Mục 4.6: Thanh toán (thay toàn bộ)

### Ba chế độ

Mỗi workshop thuộc một trong ba chế độ (kế thừa từ studio hoặc ghi đè):

- **Không cọc:** xác nhận ngay, trả toàn bộ tại studio.
- **Cọc tùy chọn:** khách chọn trả cọc trước hoặc trả tại studio.
- **Cọc bắt buộc:** chỉ xác nhận sau khi thanh toán cọc thành công.

Mức cọc do studio tự nhập, số nguyên 1–50%, không có tỷ lệ mặc định. Studio chưa đủ điều kiện xác minh chỉ nhận trả tại studio. Mỗi đặt chỗ lưu chế độ, tỷ lệ và số tiền tại lúc tạo; đổi cấu hình không tính lại đặt chỗ cũ.

### Dòng tiền

1. Khách thanh toán cọc bằng chuyển khoản/VietQR qua payOS (VietQR Pro: mỗi đơn có tài khoản ảo riêng theo đơn và số tiền; chuyển sai số tiền bị ngân hàng từ chối hoặc hoàn lại). Tiền vào tài khoản ngân hàng liên kết với payOS (hiện là tài khoản cá nhân, phạm vi đồ án).
2. Tiền chi (hoàn và payout) lấy từ **số dư ví Bảo Kim** kết nối với kênh chi payOS. Số dư ví được nạp từ tài khoản ngân hàng theo quy trình vận hành (mục J trong `bang-chuyen-trang-thai.md`).
3. Open Slot payout cho studio vào **tài khoản ngân hàng của studio** trong **1–3 ngày làm việc** sau khi buổi kết thúc, trừ các khoản hoàn và điều chỉnh.
4. Hoàn tiền là **lệnh chi chuyển khoản vào tài khoản ngân hàng của khách**, tối đa **7 ngày làm việc** kể từ lúc hủy (thứ 2–6, trừ lễ theo lịch nhà nước). Tài khoản nhận là tài khoản khách đã dùng để thanh toán hoặc tài khoản khách cung cấp khi hủy.
5. Khoản hoàn được ưu tiên trước payout khi số dư ví không đủ. **[đề xuất]**
6. Giai đoạn đầu Open Slot chịu phí cổng thanh toán và phí lệnh chi; khách được hoàn đúng số đã trả, studio nhận đủ cọc không bị khấu trừ phí.

### Giữ chỗ và nhận tiền

- Giữ chỗ 15 phút theo hạn đã lưu; hệ thống chỉ nhả chỗ sau thêm 3 phút đệm và sau khi kiểm tra cổng thanh toán.
- Mốc "đúng hạn" tính theo **giờ giao dịch đã xác minh**, không theo giờ nhận thông báo.
- Chuyển thiếu: hoàn lại, không cộng dồn. Chuyển thừa: xác nhận theo đúng số cọc, hoàn phần thừa.
- Tiền đúng hạn nhưng chỗ đã nhả: nếu người khác mới giữ chỗ chưa trả thì người trả đúng hạn được chỗ; nếu người khác đã xác nhận thì hoàn toàn bộ cho người trả đúng hạn.
- Tiền về sau hạn thật: xác nhận lại nếu buổi còn nhận đăng ký và còn đủ chỗ cho toàn bộ đặt chỗ; không thì hoàn toàn bộ. Đặt chỗ đã hủy không tự khôi phục.

### Hủy và hoàn

| Tình huống                                                  | Kết quả                                                                                                                                 |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Chưa thanh toán                                             | Hủy miễn phí, mọi mốc giờ                                                                                                               |
| Đã thanh toán, hủy trước giờ học ≥ 24 giờ (gồm đúng 24 giờ) | Hoàn toàn bộ                                                                                                                            |
| Đã thanh toán, hủy < 24 giờ                                 | Giữ cọc gốc tại lúc đặt, hoàn phần vượt cọc                                                                                             |
| Không cọc nhưng đã trả                                      | Hoàn toàn bộ, kể cả < 24 giờ                                                                                                            |
| Studio hủy buổi, hoặc admin hủy/khóa studio                 | Hoàn toàn bộ (ngoại lệ gian lận khách do admin quyết định, có lý do)                                                                    |
| Studio đổi giờ                                              | Khách chọn giữ hoặc hủy và hoàn toàn bộ; không phản hồi trong 48 giờ (hoặc 12 giờ trước giờ mới nếu sát hơn) thì tự hủy và hoàn toàn bộ |

Hủy và điểm danh được thực hiện **theo từng chỗ/vé**. Tiền chia đều theo vé, phần dư dồn vào vé cuối.

Chính sách hủy cố định 24 giờ cho mọi studio ở bản đầu; không cho studio tùy chỉnh.

### Tham dự và khoản còn nợ

- Studio đánh dấu đã đến hoặc vắng. Chỉ đánh dấu vắng từ 30 phút sau giờ bắt đầu. Vắng: không hoàn cọc, phần đã trả vượt cọc xử lý như hủy < 24 giờ.
- Buổi kết thúc không tự ghi nhận đã đến, hoàn thành hay trả hết tiền.
- Khoản còn nợ sau buổi là khoản phải thu của studio; studio chọn thu hoặc miễn, mọi thao tác có nhật ký.

### Khiếu nại

Khách và studio gửi khiếu nại trong 7 ngày sau buổi học. Admin Open Slot quyết định. Mọi điều chỉnh là bút toán mới, không sửa hoặc xóa lịch sử.

### Chưa hỗ trợ

Đổi buổi, đổi địa điểm, chuyển tên người tham gia.

## Mục 3.3: Chức năng liên quan (sửa FR-31 đến FR-34)

| Mã    | Chức năng                                                                                                                                      | Ưu tiên             |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| FR-31 | Khách chọn thanh toán theo chế độ của workshop (không cọc / cọc tùy chọn / cọc bắt buộc)                                                       | P0                  |
| FR-32 | Studio cấu hình chế độ cọc và tỷ lệ 1–50% (khi đủ điều kiện xác minh); tài khoản nhận payout; chính sách hủy cố định 24 giờ hiển thị cho khách | P0                  |
| FR-33 | Studio xác nhận đã thu phần còn lại tại studio; ghi nhận khoản phải thu hoặc miễn                                                              | P0                  |
| FR-34 | Đối soát thanh toán tự động, hoàn tiền tự động và payout sau buổi                                                                              | **P0 (nâng từ P1)** |

## Mục 9: Quy tắc nghiệp vụ và bảo mật (thay phần "Thanh toán")

- **Thanh toán:** Open Slot thu tiền thanh toán trước qua payOS và payout cho studio sau buổi học qua chi hộ; tiền trả tại studio đi trực tiếp.
- Thông tin tài khoản nhận payout chỉ chủ studio được sửa; mỗi lần đổi cần xác thực lại, ghi nhật ký, thông báo chủ studio; payout tạm giữ đến khi xác minh lại.
- Mọi thao tác tiền (thu, hủy, hoàn, miễn nợ, điều chỉnh, payout) ghi nhật ký người thao tác, số tiền, trước-sau, lý do.
- Khóa chống tạo đặt chỗ trùng bằng khóa idempotency từ giao diện.
- Giới hạn tần suất kiểm tra thanh toán thủ công; xử lý khi cổng thanh toán không phản hồi.
- Trước khi khách xác nhận, hiển thị rõ: số tiền cọc, phần trả tại studio, chính sách hủy, ai thu tiền, cách liên hệ; nhắc chỉ thanh toán theo thông tin trên Open Slot.
- Giám sát: tiền chưa đối soát, số dư ví Bảo Kim so với khoản hoàn và payout sắp đến hạn, khoản hoàn sắp quá hạn, lệnh chi lỗi, hàng đợi email, số chỗ không khớp.

## Mục 13.1 và 13.3: Quyết định

Bỏ dòng "Chính sách hủy: chưa quyết định" khỏi 13.1. Thêm vào 13.3 (**07/11/2026**):

| Vấn đề                              | Quyết định                                                                                                               |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Chính sách hủy                      | Cố định 24 giờ; chi tiết ở mục 4.6                                                                                       |
| Thiếu/thừa tiền                     | Thiếu hoàn lại (không cộng dồn); thừa hoàn phần thừa                                                                     |
| Tiền đến muộn                       | Xét theo giờ giao dịch xác minh; đệm 3 phút; kiểm tra cổng trước khi nhả                                                 |
| Chỗ đã nhả khi tiền đến muộn        | Người trả đúng hạn được chỗ nếu người kia chưa trả; nếu người kia đã xác nhận thì hoàn toàn bộ cho người trả đúng hạn    |
| Admin hủy/khóa studio               | Coi như studio hủy, hoàn toàn bộ                                                                                         |
| Đổi giờ khi đang chờ cọc            | Hủy yêu cầu cũ, khách đặt lại                                                                                            |
| Hạn phản hồi đổi giờ                | 48 giờ, hoặc 12 giờ trước giờ mới nếu sát hơn                                                                            |
| Hoàn tiền                           | Chuyển khoản vào tài khoản ngân hàng khách bằng chi hộ payOS (nguồn ví Bảo Kim), tối đa 7 ngày làm việc (thứ 2–6 trừ lễ) |
| Payout                              | 1–3 ngày làm việc sau khi buổi kết thúc                                                                                  |
| Phí cổng thanh toán và phí lệnh chi | Open Slot chịu giai đoạn đầu                                                                                             |
| Dòng tiền                           | Thu qua payOS (VietQR Pro) vào tài khoản ngân hàng cá nhân; chi qua ví Bảo Kim. Chấp nhận ở phạm vi đồ án                |
| Hủy/điểm danh nhóm                  | Theo từng chỗ; chia đều, dư vào vé cuối                                                                                  |
| Khoản nợ sau buổi                   | Giữ phải thu; studio thu hoặc miễn; có nhật ký                                                                           |
| Đổi buổi/địa điểm/chuyển tên        | Chưa hỗ trợ                                                                                                              |
| Đến muộn                            | Studio quyết định; đánh dấu vắng từ 30 phút sau giờ bắt đầu                                                              |
| Khiếu nại                           | 7 ngày sau buổi; admin quyết định; bút toán điều chỉnh                                                                   |

Giữ trong 13.1 (còn mở): thời điểm áp dụng thu phí, cách xác nhận booking thủ công/tự động (nếu còn dùng); bên nhận tiền về pháp lý (chỉ cần khi triển khai thực tế).

## Mục 14: Định vị (sửa hai dòng trong bảng so sánh)

|         | SlotBetter                                                          | Open Slot                                                                                                  |
| ------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Tiền    | Khách chuyển thẳng vào tài khoản tổ chức, SlotBetter không giữ tiền | Thanh toán trước thu qua payOS, payout cho studio sau buổi học qua ví Bảo Kim; phần còn lại trả tại studio |
| Thu phí | (giữ nguyên)                                                        | Miễn phí giai đoạn đầu; Open Slot chịu phí cổng thanh toán và phí lệnh chi                                 |

Thêm vào "Điều học được": hoàn tiền tự động và payout sau buổi tạo niềm tin cho khách, đồng thời tạo nghĩa vụ vận hành mà SlotBetter không phải gánh.

## Phạm vi đồ án và rủi ro nếu triển khai thực tế

Dự án chạy ở phạm vi đồ án, chủ dự án chấp nhận rủi ro khi dùng tài khoản ngân hàng cá nhân. Nếu sau này chạy thật với khách và studio thật, cần xử lý:

1. Quy định trung gian thanh toán khi thu hộ rồi chi trả cho bên khác.
2. Thuế và hóa đơn cho khoản thu hộ.
3. Điều khoản ngân hàng và payOS về dòng tiền lớn và thu hộ bên thứ ba.
4. Hiển thị rõ tên người nhận trước khi khách thanh toán.
5. Chuyển kênh thu/chi sang hộ kinh doanh hoặc công ty.

Với đồ án, nên dùng số tiền nhỏ, ghi rõ trong giao diện đây là bản thử nghiệm và lưu sổ đối soát để chứng minh luồng tiền chạy đúng.
