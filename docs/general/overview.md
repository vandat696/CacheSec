# Tổng quan và yêu cầu

CacheSec nghiên cứu chatbot AI nội bộ sử dụng RAG + LLM và cache có kiểm soát quyền. Local Semantic Cache là trọng tâm; no cache và server cache dùng để so sánh.

## Mục tiêu

Đánh giá tốc độ, chi phí xử lý, chất lượng câu trả lời và tính đúng phân quyền. Không mặc định cache luôn nhanh hơn hoặc tiết kiệm hơn.

## Phạm vi và yêu cầu

- Ba màn hình: so sánh chatbot A/B, thí nghiệm/kết quả, cấu hình/phân quyền.
- Chọn profile cache/model/thuật toán/tham số để thử nghiệm, lưu cấu hình và số liệu.
- Cho phép thay thế LLM, embedding, RAG và cache qua ranh giới đơn giản.
- Kiểm tra quyền hiện tại khi reuse và khi retrieval/generation; dùng dữ liệu giả lập.
- Lưu kết quả có thể đối chiếu, phân biệt đo thật, mô phỏng và chi phí ước tính.

## Phạm vi bản đầu đề xuất, chưa chốt triển khai

No cache/local/server, exact/semantic, một LLM và embedding provider thật, mock để test, quyền tối thiểu và thu hồi quyền, profile và xuất kết quả.

Cache hai tầng, nhiều provider, fine-tune và editor rule/code tùy ý để sau. Chi tiết còn mở được ghi tại tài liệu chủ đề và project-status.
