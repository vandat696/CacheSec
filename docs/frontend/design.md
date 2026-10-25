# Thiết kế frontend

## Đã thống nhất

Ba màn hình; hai profile A/B có thể thay đổi, mặc định no cache và secure local cache.

## So sánh chatbot

Một câu hỏi chung, hai khung riêng; cùng người dùng và điều kiện so sánh. Hiển thị cấu hình, câu trả lời, nguồn, latency, token, chi phí ước tính, quyền; cache có hit/miss/lý do, similarity, lookup/auth time.

Đề xuất câu hỏi độc lập trước. Multi-turn cần thiết kế cache có ngữ cảnh.

## Thí nghiệm và kết quả

Chọn workload/profile, số lượt, cold/warm; lưu từng lượt/cấu hình, biểu đồ và xuất JSON/CSV. Demo đồng thời khác benchmark.

## Cấu hình và quyền

Chọn thuật toán đã triển khai và tham số; người dùng, tenant, role, phòng ban, quyền tài liệu. Chưa cần editor code hoặc ngôn ngữ rule tùy ý. Profile không chứa secrets.

## Demo đề xuất

Hỏi khi có quyền → tạo cache → hỏi gần nghĩa → hit → thu hồi quyền → hỏi lại → chặn reuse → xem lịch sử.

## Cần chốt

Quản trị tối thiểu; streaming; multi-turn; đối chứng unsafe giả lập có cần không?
