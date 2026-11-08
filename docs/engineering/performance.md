# Hướng dẫn đọc và kiểm tra hiệu năng

Đồng bộ 07/11/2026. [Mục lục](../README.md) · [Cấu trúc frontend](frontend-structure.md).

Mã có tải route/thành phần theo nhu cầu, font tự host, ảnh nhiều kích thước và cache truy vấn/phiên. Việc có các tối ưu này không chứng minh đạt chỉ số trên mọi thiết bị.

Khi kiểm tra, ghi commit/trạng thái mã, URL hoặc bản build, viewport, cấu hình mạng/CPU, cache lạnh/nóng và thời điểm. So sánh cùng điều kiện; không lấy số build cũ làm số hiện tại. Giữ kết quả raw cạnh báo cáo để tái kiểm tra.

Báo cáo theo từng đợt đã chuyển vào [archive/performance](../archive/README.md), gồm web-performance, mobile-performance, performance-client/server/diagnosis/results và hai file JSON đi kèm. Không cần đọc chúng để hiểu nghiệp vụ cọc/hoàn; chỉ dùng khi điều tra hiệu năng hoặc cần bằng chứng lịch sử.
