# Thiết kế cache

## Đã thống nhất

Tách storage/matching/validation; so none/local/server, exact/semantic. Backend giữ quyết định quyền đáng tin cậy.

## Thuật toán cần thiết kế

- Exact key và chuẩn hóa không mất khác biệt quan trọng.
- Semantic metric, ngưỡng, top-k và chọn ứng viên.
- TTL, dung lượng, eviction, invalidation theo nguồn/policy.
- Namespace cấu hình; re-embed khi đổi embedding.

## Metadata cần đặc tả

Entry ID, tenant, scope, câu hỏi/ngữ cảnh, câu trả lời, embedding/model, nguồn/phiên bản, policy, sensitivity, timestamps/TTL, cấu hình LLM/prompt/RAG.

Chưa phải schema chốt. Metadata client phải đối chiếu dữ liệu hoặc chứng thực đáng tin cậy, không tự cấp quyền.


## Vị trí lưu và phạm vi chia sẻ

Local/server là vị trí lưu; riêng từng người hoặc dùng chung tenant là phạm vi chia sẻ. Hai trục này phải tách riêng khi so sánh. Storage server chưa chốt, cache hai tầng để sau.

## Cần chốt

Metric/ngưỡng, top-k, schema, TTL, eviction, namespace và phạm vi chia sẻ. Cơ chế xác minh/toàn vẹn được mô tả trong [phân quyền](authorization.md).
