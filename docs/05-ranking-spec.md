# Đặc tả phần AI: xếp hạng workshop theo nhu cầu

## Bài toán
- Đầu vào: một câu nhu cầu (`need_text`) và tập workshop ứng viên **đã qua lọc cứng**.
- Đầu ra: danh sách ứng viên sắp theo mức phù hợp giảm dần.
- Điều kiện cứng (ngày, giá, khu vực, chỗ trống) do database kiểm tra, mô hình KHÔNG quyết định. Mô hình chỉ đánh giá mức phù hợp về nội dung và trải nghiệm (trình độ, đối tượng, sản phẩm mang về, thời lượng, không khí).

## Câu hỏi nghiên cứu
Mô hình xếp hạng fine-tune có cho kết quả phù hợp nằm ở đầu danh sách tốt hơn BM25 và embedding có sẵn hay không?

## Dữ liệu
**Danh mục workshop** (`data/workshops.sample.json`): mô phỏng, ghi rõ. Bắt đầu 30-40, mở rộng 100-200. Trường: `id, title, description, category, level, audience, takeaway, duration_minutes, price_hint, requirements, district`.

**Câu nhu cầu** (`data/queries.sample.jsonl`): viết tay + sinh bằng LLM rồi tự rà từng câu. Gồm các kiểu: rõ ràng; mơ hồ; nhiều ý; không dấu; có ràng buộc mâu thuẫn; chỉ mô tả cảm xúc/mục đích.

**Nhãn** (`data/labels.sample.jsonl`): mỗi dòng `{"query_id": "...", "workshop_id": "...", "label": 0-3}`. Quy tắc ở `data/labeling-guideline.md`. Không dùng số sao đánh giá của khách làm nhãn.

**Độ đồng thuận:** hai người cùng gán khoảng 20% cặp; tính Cohen's kappa (hoặc kappa có trọng số). Kappa thấp → sửa quy tắc, gán lại trước khi mở rộng.

## Chia dữ liệu (chống rò rỉ)
- Tập kiểm tra **tách theo workshop**: workshop trong tập kiểm tra không xuất hiện ở huấn luyện/kiểm định.
- Các câu nhu cầu diễn đạt lại từ cùng một ý gốc phải nằm cùng một phía (nhóm theo `query_group`).
- Tập kiểm tra chỉ dùng một lần ở cuối để báo cáo.

## Mô hình và so sánh
| Hệ | Vai trò |
|---|---|
| BM25 trên văn bản workshop | Baseline 1 |
| Embedding đa ngôn ngữ có sẵn, chưa fine-tune (cosine) | Baseline 2 |
| Embedding hoặc cross-encoder hỗ trợ tiếng Việt, fine-tune trên dữ liệu của đề tài | **Mô hình chính** |
| Bộ xếp hạng nhỏ (Gradient Boosting) train từ đầu trên đặc trưng tự thiết kế, có thể kết hợp điểm ngữ nghĩa | Phương án bổ sung nếu giảng viên đòi phần tự train nhiều hơn |

Mô hình cụ thể chọn sau khi thử trên Colab. Ghi lại cấu hình, hạt giống ngẫu nhiên, số lần chạy.

## Chỉ số đánh giá
NDCG@5, NDCG@10, MRR, và tỷ lệ có ít nhất một workshop nhãn 3 trong top-k. Báo cáo cùng phân tích lỗi theo kiểu nhu cầu. Nếu bản fine-tune không vượt baseline mạnh, vẫn báo cáo trung thực kèm phân tích.

## Hợp đồng dịch vụ ranker
`POST /rank`
```json
{
  "need_text": "Hai người mới bắt đầu, muốn làm quà mang về ngay",
  "candidates": [
    { "workshop_id": "uuid", "text": "văn bản ghép từ các trường của workshop" }
  ],
  "top_k": 10
}
```
Trả về:
```json
{
  "model_version": "ft-2026-11-01",
  "ranked": [ { "workshop_id": "uuid", "score": 0.83 } ]
}
```
- `GET /health` trả 200 khi sẵn sàng.
- Dịch vụ phải trả lời trong `RANKER_TIMEOUT_MS`; quá hạn thì API dùng dự phòng.
- Lưu sẵn vector của workshop (cache) để giảm độ trễ; chỉ xếp hạng tập ứng viên nhỏ sau lọc cứng.

## Dự phòng trong API
Nếu ranker lỗi hoặc chậm: xếp hạng bằng BM25 (hoặc tìm kiếm văn bản của PostgreSQL) trên cùng tập ứng viên; ghi `search_logs.fallback_used = true`.

## Phần tùy chọn (mức 3)
Trích xuất nhu cầu bằng Gemini ra JSON (số người, ngân sách, thời gian, khu vực) và **cho khách xem lại các điều kiện đã hiểu để sửa** trước khi lọc, vì lỗi trích xuất làm mất kết quả đúng. Đây là thành phần dùng mô hình có sẵn, không thuộc phần tự train.
