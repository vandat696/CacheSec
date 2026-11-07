# Thiết kế Secure Local Semantic Cache

## Hiện trạng và thành phần giữ lại

**Chưa có cache hoạt động trong code.** Chat gọi phản hồi mẫu; dashboard dùng fixture giả; model Thiết lập chỉ mô tả cấu hình. Chưa có storage IndexedDB/Dexie, embedding adapter, semantic lookup, verifier hoặc admission/invalidation. Vì vậy không có local cache hiện có để sửa hay kết quả hit để tái sử dụng.

Giữ kiến trúc storage/matching/validation; embedding và semantic similarity/threshold; authorization; authorized RAG; admission, TTL, capacity, eviction và invalidation; metadata, source provenance, version tracking; logging và evaluation. None/local/server và exact/semantic là các lựa chọn thiết kế, không phải mọi biến thể đều cần có trong PoC. Backend giữ quyết định quyền đáng tin cậy.

Lõi cache phải tuân thủ [quy tắc độc lập ứng dụng/Agent/IDE/cache](architecture.md#quy-tắc-độc-lập-giữa-ứng-dụng-agentide-và-cache): không phụ thuộc nghiệp vụ báo giá hoặc host cụ thể; tích hợp qua contract/adapter với xác minh nguồn/quyền tin cậy. Quy tắc áp dụng cho cả Answer Cache và Context Cache; lựa chọn lát cắt cụ thể được ghi bên dưới, không ràng buộc lõi với một storage/host.

## Answer Cache và Repository Context Cache

| Loại | Nội dung | Hiệu quả có thể đo | Trạng thái thiết kế |
| --- | --- | --- | --- |
| Answer Cache | Câu hỏi, answer hoàn chỉnh, nguồn hỗ trợ và context/intent đủ xác minh | Safe Hit có thể tránh LLM sinh lại answer; vẫn tốn lookup/embedding/verification/mạng | Giữ để mở rộng; không phải lát cắt PoC đầu tiên đã chọn |
| Repository Context Cache | Kết quả truy xuất/phân tích, source excerpts/symbol map/context gắn snapshot và dependency manifest | Giảm retrieval/chuẩn bị ngữ cảnh lặp; LLM vẫn xử lý yêu cầu/tạo patch | Người dùng chọn cho PoC đầu tiên ngày 2026-11-07; lưu trong trình duyệt cho web Workspace trước |

Lựa chọn Context Cache thay đề xuất Answer Cache đầu tiên; đây là quyết định thiết kế của người dùng, **chưa triển khai và chưa phải giảng viên xác nhận phương pháp**. Hai yêu cầu tìm vị trí validation tương đương có thể dùng chung context nếu intent/scope/dependencies/quyền phù hợp. Yêu cầu tìm riêng quy tắc hết hạn có thể cần context khác dù câu chữ gần nghĩa; score không đủ quyết định reuse.

Payload đầu tiên là ngữ cảnh repo có provenance, không phải câu trả lời cuối, patch, approval hoặc model KV/prompt cache. Trình duyệt lưu/tìm candidate; backend xác minh payload và mọi nguồn/quyền hiện tại trước khi cung cấp ngữ cảnh cho Agent/LLM. Không tin hash/metadata/quyết định Hit do browser tự khai; registry/chứng thực và transport cụ thể chốt ở T02–T04. Không tự dùng payload local rồi xác minh sau. Miss/Rejected truy xuất lại nguồn được phép; verifier/auth lỗi vẫn theo quy tắc fail closed bên dưới.

Một Context Cache Hit không bảo đảm giảm số LLM calls hoặc tokens: nếu vẫn gửi cùng ngữ cảnh, input tokens có thể tương đương. Đo thời gian context sẵn sàng, phần retrieval tránh được và chi phí lookup/embedding/verification/mạng; có thể không có lợi ích ròng. Adapter IDE làm sau, dùng cùng contract với storage phù hợp được chọn riêng.

Bản [contract T02 v0.2](api.md#chuẩn-bị-context-và-chạy-agent) đề xuất ContextRequest do backend chuẩn bị trước browser lookup, lookup report không tin cậy và bước verified resolution trước generation. Dữ liệu/request/response và retry/error do api.md sở hữu; tài liệu này sở hữu điều kiện reuse và lifecycle, không mặc định một report no_candidate là bằng chứng trusted hoặc một HTTP 200 là Safe Hit.

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

Local là vị trí lưu, user/tenant sharing là phạm vi chia sẻ; tách hai trục khi so sánh server. Lát cắt đầu đã chọn browser local; IndexedDB/Dexie là hướng storage dự kiến, chưa chốt engine/schema hoặc thêm dependency. Chọn agent-side storage cho adapter khác vẫn cần quyết định riêng; lifecycle khi logout/account switch và offline policy chưa chốt. Đề xuất không reuse khi không thể xác minh trực tuyến.

Backend verification có chi phí mạng/auth; local không miễn phí. Chặn reuse không xóa được plaintext đã đọc/sao chép hoặc bảo vệ trước XSS/người kiểm soát thiết bị. [Bảo mật](authorization.md) sở hữu threat model; [đánh giá](../evaluation/design.md) sở hữu mẫu số, oracle reuse, latency và failure accounting.
