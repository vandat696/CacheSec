# Thiết kế Secure Local Semantic Cache

## Hiện trạng và thành phần giữ lại

**Chưa có cache hoạt động trong code.** Chat gọi phản hồi mẫu; dashboard dùng fixture giả; model Thiết lập chỉ mô tả cấu hình. Chưa có storage IndexedDB/Dexie, embedding adapter, semantic lookup, verifier hoặc admission/invalidation. Vì vậy không có local cache hiện có để sửa hay kết quả hit để tái sử dụng.

Giữ kiến trúc storage/matching/validation; embedding và semantic similarity/threshold; authorization; authorized RAG; admission, TTL, capacity, eviction và invalidation; metadata, source provenance, version tracking; logging và evaluation. None/local/server và exact/semantic là các lựa chọn thiết kế, không phải mọi biến thể đều cần có trong PoC. Backend giữ quyết định quyền đáng tin cậy.

## Answer Cache và Repository Context Cache

| Loại | Nội dung | Hiệu quả có thể đo | Đề xuất |
| --- | --- | --- | --- |
| Answer Cache | Câu hỏi, answer hoàn chỉnh, nguồn hỗ trợ và context/intent đủ xác minh | Safe Hit có thể tránh LLM sinh lại answer; vẫn tốn lookup/embedding/verification/mạng | PoC đầu tiên: câu hỏi tìm hiểu repository, gần nhất với thiết kế hỏi đáp hiện tại |
| Repository Context Cache | Kết quả phân tích, source excerpts/symbol map/context gắn snapshot | Giảm retrieval/phân tích lặp; Agent vẫn có thể gọi LLM tạo patch | Mở rộng sau nếu trace cho thấy reuse có ích và dependency tracking đủ tin cậy |

Lựa chọn Answer Cache là **đề xuất ít thay đổi nhất**, không phải implementation đã có hoặc giải pháp đã được giảng viên phê duyệt. Cache cho câu hỏi “Where is supplier quotation validation implemented?” có thể phục vụ “Which function handles quotation validation?” nếu đáp án, repo snapshot, scope và quyền tương đương. “Which rule checks expiration?” có thể gần nghĩa nhưng khác intent/đáp án; phải reject nếu không đủ bằng chứng.

Không cache approval để cấp phép deployment; không coi cached patch, test pass hoặc context là chứng nhận code hiện tại đúng. Safe Hit của một câu hỏi không tự hoàn thành tác vụ sửa code hoặc bảo đảm không còn LLM calls cho cả workflow.

## Lookup, verification và fallback mục tiêu

1. Nhận identity/tenant/repository tin cậy và request context; xác định query intent, snapshot và namespace. Local lookup chỉ tìm candidate trong phạm vi được phép, không đưa plaintext vào log.
2. Exact match giữ khác biệt ngữ nghĩa quan trọng; semantic matching dùng cùng embedding model/revision/dimension/normalization/metric. Score vượt threshold chỉ tạo candidate. Metric/top-k/threshold còn cần chọn trên tập hiệu chỉnh được quy định trước.
3. Backend xác minh entry qua metadata/provenance đáng tin cậy, không tin source ID/hash/quyền do client tự khai. Kiểm tra toàn vẹn answer/context; source ID đúng không chứng minh payload local chưa bị sửa.
4. Kiểm tra quyền hiện tại trên **mọi** nguồn phụ thuộc, tenant/repo/scope, intent và ngữ cảnh câu hỏi; không reuse “được xem ở lần trước” như quyền hiện tại.
5. Kiểm tra base/source revision và hash mọi file/chunk phụ thuộc, TTL/freshness, policy/configuration, model/prompt/RAG và chính sách cho lưu/reuse. Không có dependency manifest đủ tin cậy thì không admit/reuse.
6. Chỉ khi tất cả đạt mới ghi **Safe Hit** và cung cấp payload cho answer/Agent. Trước Agent sửa code, source thực tế phải còn khớp snapshot được xác minh; thay đổi thì đọc lại. Chứng thực reuse cần ràng buộc request/snapshot, không thành quyền vô thời hạn.
7. Không candidate đủ điều kiện similarity là **Miss**. Có candidate nhưng verification thất bại là **Rejected**, lưu lý do (scope, stale, expired, integrity, auth, intent...), không trả payload đó. Nếu có nhiều candidate, chỉ kết luận Hit khi một candidate vượt toàn bộ kiểm tra; ghi từng quyết định candidate riêng.
8. Miss/Rejected có thể fallback **authorized retrieval/RAG → LLM/Agent**, vẫn kiểm tra quyền. Verifier/auth lỗi không phải lý do truy xuất không hạn chế; không xác minh được thì trả lỗi/deny rõ ràng. Admission chỉ sau khi provenance và policy được xác nhận; không lưu lỗi như answer thành công.

Phân loại terminal của một lookup là Hit/Miss/Rejected; **Error/Timeout** riêng khi không kết luận được. Candidate reject rồi candidate khác pass có terminal Hit và candidate rejection trace. Quy ước này là đặc tả đề xuất cho số liệu mới, không thay định nghĩa fixture UI cũ.

## Metadata và phiên bản đề xuất

Chưa phải schema/API chốt:

| Nhóm | Metadata cần thiết |
| --- | --- |
| Identity và scope | Entry ID/type, tenant, principal/scope chia sẻ, repo ID, path/symbol/context scope; không lưu token/credential |
| Semantics | Query/intent/context fingerprint, answer/context payload hash, loại candidate, score/threshold/metric |
| Nguồn | Snapshot/base revision, dependency manifest với path/source ID và content hash/version, provenance của nguồn hỗ trợ |
| Cấu hình | Embedding provider/model/revision/dimension/normalization, prompt/LLM/RAG/config version và namespace |
| Policy và thời gian | Admission/reuse policy version, sensitivity, created/verified/expires timestamps, TTL và freshness |
| Toàn vẹn | Backend registry reference hoặc chứng thực payload/provenance; thuật toán/kho khóa còn mở, hash client đơn thuần không đủ |

Namespace tối thiểu phân biệt tenant/repo/scope, source snapshot và cấu hình vector/reuse liên quan. Đổi embedding phải re-embed hoặc tách namespace; không so vector thuộc không gian khác. Exact key normalization không được bỏ phủ định, thời gian, thực thể hoặc context làm đổi đáp án.

## Lifecycle, local và giới hạn

Admission chỉ cho thông tin được phép lưu và đủ nguồn kiểm chứng; loại secrets, credentials, code ngoài scope và thông tin không có provenance. TTL là giới hạn thời gian, không thay source/policy validation. Eviction FIFO/LRU/LFU và capacity là lựa chọn còn mở; UI mặc định không quyết định policy thực thi.

Source/dependency, quyền/role/ABAC hoặc policy/config đổi phải chặn reuse entry không còn hợp lệ, bằng invalidation/version namespace và kiểm tra lúc dùng. Invalidation chủ động là tối ưu, verifier vẫn phải xử lý sự kiện invalidation bị bỏ lỡ. Phương án bảo thủ đầu tiên có thể invalidate theo toàn repo snapshot; giảm hit rate nhưng dễ kiểm chứng hơn dependency tracking thiếu nguồn. Freshness khi thu hồi quyền cần công bố trước run.

Local là vị trí lưu, user/tenant sharing là phạm vi chia sẻ; tách hai trục khi so sánh server. Browser IndexedDB/Dexie là dự kiến từ kiến trúc cũ; chọn agent-side storage nếu cần là quyết định phải xác nhận, chưa tự thay. Offline chưa có policy; đề xuất không reuse khi không thể xác minh trực tuyến.

Backend verification có chi phí mạng/auth; local không miễn phí. Chặn reuse không xóa được plaintext đã đọc/sao chép hoặc bảo vệ trước XSS/người kiểm soát thiết bị. [Bảo mật](authorization.md) sở hữu threat model; [đánh giá](../evaluation/design.md) sở hữu mẫu số, oracle reuse, latency và failure accounting.
