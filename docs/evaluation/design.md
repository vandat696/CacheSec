# Thiết kế đánh giá

## Câu hỏi nghiên cứu

Khi nào cache nhanh/tiết kiệm? Local khác server ra sao? Semantic hit đúng không? Quyền còn đúng khi nguồn/chính sách thay đổi không?

## Quy trình so sánh

- Cùng model/prompt/corpus/RAG/user/quyền/workload, trừ biến đang nghiên cứu.
- Đổi một yếu tố trước; tách vị trí lưu với scope chia sẻ.
- Tách cold/warm, quy định reset/preload và thứ tự query.
- Chạy lặp, kiểm soát seed/tải/môi trường/thứ tự; demo A/B đồng thời không thay benchmark.
- Phân biệt cache ứng dụng và provider cache; nêu giới hạn quan sát.

## Dataset và nhãn

Dữ liệu giả lập: tài liệu, user/quyền, query, nguồn/ý trả lời kỳ vọng, quyền và khả năng reuse kỳ vọng.

Ca thử: exact repeat, paraphrase, gần nghĩa khác đáp án, đổi thực thể/thời gian/phủ định, cross-tenant, revoked role, changed attributes, expiry, stale source/policy, auth unavailable.

Tách tập chọn ngưỡng và tập đánh giá cuối.

## Chỉ số cần đặc tả

| Nhóm | Nội dung |
| --- | --- |
| Tốc độ | End-to-end, TTFT nếu stream, embedding/lookup/auth/retrieval/generation, P50/P95 |
| Tiết kiệm | Model calls, token, cost assumptions |
| Cache | Hit/miss hợp lệ, semantic false hit, mẫu số rõ |
| Chất lượng | Đúng tài liệu/câu hỏi, đủ ý, nguồn hỗ trợ |
| Quyền | Disclosure trên ca đáng ra bị chặn; false denial trên ca đáng ra được phép |

Chưa chốt công thức chi tiết. Không gọi model thì usage zero; không biết usage ghi unknown. Không cộng timing chồng lấp như khoảng độc lập.

## Dữ liệu mỗi run

Run/query ID, profile bất biến/phiên bản, model/embedding/prompt/corpus/RAG/cache/policy, seed, môi trường/phần cứng, thứ tự, cold/warm, concurrency, outcome/lý do, timings, usage, cost assumptions và đánh giá.

Xuất JSON/CSV đã loại secrets/dữ liệu nhạy cảm. Báo lỗi/timeout, không âm thầm loại khỏi kết quả.

## Cần chốt và giới hạn

Cỡ mẫu, số lượt, rubric chất lượng, công thức và thống kê. Local không miễn phí; cần giả định tài nguyên. Zero disclosure chỉ là kết quả bộ thử, không chứng minh an toàn tuyệt đối.
