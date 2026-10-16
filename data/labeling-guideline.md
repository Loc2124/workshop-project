# Quy tắc gán nhãn mức phù hợp (thang 0-3)

Gán cho từng cặp (câu nhu cầu, workshop). Chỉ xét **nội dung và trải nghiệm**; ngày, giá, khu vực, chỗ trống do bộ lọc cứng xử lý, không dùng để chấm.

| Nhãn | Ý nghĩa | Dấu hiệu |
|---|---|---|
| **3 — Rất phù hợp** | Đáp ứng hầu hết hoặc toàn bộ ý chính của nhu cầu | Đúng trình độ, đúng đối tượng, đúng điều khách muốn mang về/trải nghiệm |
| **2 — Phù hợp** | Đáp ứng phần lớn, thiếu hoặc lệch một ý phụ | Đúng ý chính, lệch chi tiết nhỏ |
| **1 — Phù hợp thấp** | Chỉ đáp ứng một phần, thiếu điểm quan trọng | Cùng chủ đề rộng nhưng không hợp mục đích |
| **0 — Không phù hợp** | Mâu thuẫn với nhu cầu hoặc không liên quan | Ví dụ: khách là người mới nhưng workshop đòi kinh nghiệm; khách muốn mang về ngay nhưng sản phẩm phải chờ nung |

## Nguyên tắc
1. Ưu tiên **ý chính** của câu nhu cầu (mục đích, trình độ, đối tượng đi cùng, sản phẩm mang về). Ý phụ chỉ phân biệt giữa 2 và 3.
2. Mâu thuẫn với một ràng buộc rõ ràng của khách → tối đa nhãn 1, thường là 0.
3. Câu mơ hồ: chấm theo cách hiểu hợp lý nhất; nếu nhiều cách hiểu, ghi chú ở cột `note`.
4. Không chấm theo cảm giác "workshop này hay". Chấm theo mức khớp với câu hỏi.
5. Gán nhãn không nhìn điểm của mô hình.

## Ví dụ
| Câu nhu cầu | Workshop | Nhãn | Lý do |
|---|---|---|---|
| "Mới bắt đầu, muốn làm quà mang về ngay" | Làm vòng tay hạt cho người mới, mang về cuối buổi | 3 | Đúng người mới, mang về ngay |
| "Mới bắt đầu, muốn làm quà mang về ngay" | Làm gốm trên bàn xoay, cần chờ nung 2 tuần | 0 | Không mang về ngay |
| "Mới bắt đầu, muốn làm quà mang về ngay" | Vẽ tranh sơn dầu cơ bản, tranh khô nhiều ngày | 1 | Hợp người mới, nhưng mang về ngay khó |
| "Đi cùng người yêu, muốn chuyện trò thoải mái" | Làm nến thơm theo cặp, không khí nhẹ nhàng | 3 | Hợp cặp đôi và không khí |
| "Đi cùng người yêu, muốn chuyện trò thoải mái" | Lớp điêu khắc đá cường độ cao, cần tập trung | 1 | Khó trò chuyện, không hướng cặp đôi |

## Quy trình
1. Hai người cùng gán khoảng 20% cặp, tính kappa.
2. Kappa thấp → họp, sửa quy tắc và thêm ví dụ, gán lại phần đó.
3. Một người gán phần còn lại. Ghi ngày gán và phiên bản quy tắc (`guideline_version`).
