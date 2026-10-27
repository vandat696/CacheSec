# Tổng quan và yêu cầu

CacheSec hướng tới chatbot AI nội bộ dùng RAG + LLM và cache có kiểm soát quyền. Mục tiêu nghiên cứu dài hạn là đánh giá tốc độ, chi phí, chất lượng câu trả lời và tính đúng phân quyền; local semantic cache là trọng tâm, none/server là đối chiếu.

## Ưu tiên sản phẩm hiện tại

Theo yêu cầu ngày 2026-10-27, tập trung trước vào hai phần:

- **Chat nội bộ:** hỏi đáp về thông tin công ty, lịch sử và hội thoại mới; nút bánh răng chọn không cache, có cache hoặc so sánh hai khung với prompt chung.
- **Tài liệu:** có nơi chọn/tải tệp và phân loại để chuẩn bị nguồn dữ liệu cho chatbot.

Giữ giao diện tối giản. So sánh đơn giản nằm trong Chat theo yêu cầu bổ sung ngày 2026-10-27; cả hai nhánh vẫn trả lời mẫu, chưa có cache thật. Benchmark, runner, editor profile/cache, model và tham số kỹ thuật được hoãn. Không cần một màn thiết lập riêng cho những chức năng chưa triển khai.

## Phạm vi đã có và còn thiếu

Frontend hiện có chat mô phỏng, chọn/thả tệp, danh sách và phân loại trong phiên. Chưa có API upload, lưu trữ, xử lý tài liệu, xác thực hoặc AI/RAG thật. Tệp chưa tải lên không được trình bày như dữ liệu chatbot đã đọc.

Cần chốt hợp đồng tài liệu/ingestion, nguồn identity/tenant, quyền nạp/đọc và giới hạn tệp trước khi nối backend. Phân loại tài liệu chỉ phục vụ sắp xếp, không tự cấp quyền.

## Hướng nghiên cứu sau nền tảng

- Thay thế LLM, embedding, RAG và cache qua các ranh giới đơn giản.
- Xác minh quyền hiện tại khi retrieval/generation và cache reuse.
- Thiết kế workload, cấu hình có phiên bản và số liệu; phân biệt đo thật, mô phỏng và chi phí ước tính.
- So sánh cache none/local/server và exact/semantic trong cùng điều kiện sau khi baseline hoạt động.
- Hai tầng cache, nhiều provider, fine-tune và editor rule/code tùy ý để sau.

Chi tiết hiện trạng ở [project-status](project-status.md); luồng giao diện ở [frontend/design](../frontend/design.md).
