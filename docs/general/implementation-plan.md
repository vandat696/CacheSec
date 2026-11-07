# Kế hoạch triển khai Proof of Concept

## Trạng thái và nguyên tắc

Lập ngày 2026-11-02; **chưa thực hiện các bước lập trình dưới đây**. Chỉ khảo sát và cập nhật tài liệu trong đợt này. Lộ trình thay thứ tự cũ “upload tài liệu nội bộ → chatbot baseline → cache”; không dựng lại app trước khi xác nhận nghiệp vụ, fixture và acceptance. Phạm vi và câu hỏi mở do [tổng quan](overview.md) sở hữu, protocol do [đánh giá](../evaluation/design.md) sở hữu.

Cập nhật cùng ngày sau yêu cầu xem web: đã dựng UI preview `/workspace` theo [thiết kế frontend](../frontend/design.md). Đây là công việc xem thử giao diện, chưa hoàn thành bước app báo giá/cache/Agent/gate của lộ trình; nghiệp vụ và các quyết định nghiên cứu vẫn chưa chốt.

Giữ một repo, một fixture được đóng băng trước run, một gate implementation chung và một acceptance rule định trước. Đúng một feature change là flag báo giá thiếu ngày hết hạn hợp lệ. Gate, cache và trace là hạ tầng nghiên cứu dùng chung, được chuẩn bị trước và không tính như các feature changes khác mà Agent được giao trong thí nghiệm. Không tự commit, push hoặc deploy.

Từ yêu cầu ngày 2026-11-07, mọi bước lập trình phải tuân thủ [ba ranh giới ứng dụng/Agent/IDE/cache](../system/architecture.md#quy-tắc-độc-lập-giữa-ứng-dụng-agentide-và-cache). App báo giá có source/entrypoint chạy độc lập; host Agent/IDE thao tác qua repository/tools có scope; lõi cache không phụ thuộc nghiệp vụ hoặc host. Kiểm tra hướng import và contract khi thực hiện bước 1, 3–5; runtime bản sửa/test tách khỏi control. Đây là quy tắc đã thống nhất, chưa phải module/service/database đã được tạo hoặc quyết định chốt API/storage/sandbox.

## Giữ, điều chỉnh và bổ sung

| Nhóm | Thành phần | Cách xử lý |
| --- | --- | --- |
| Giữ | Next.js/TypeScript, FastAPI/Python, Compose PostgreSQL/pgvector, UI kit/tokens, state/model/test helpers | Tái sử dụng, không đổi package/path/định danh vì đổi bối cảnh |
| Giữ thiết kế | Local Semantic Cache; embedding/matching/threshold; validation/authorization; authorized RAG; admission/TTL/eviction/invalidation; provenance/version; logging/evaluation | Triển khai lát cắt nhỏ đủ kiểm chứng, không tuyên bố đã có code |
| Điều chỉnh sau | Chat → Developer Workspace; Số liệu → hai nhóm workflow/cache evaluation; Thiết lập → cấu hình protocol; Tài liệu → nguồn repo/provenance | Giữ UI và dữ liệu mẫu cũ đến khi có adapter thật; không gán nhãn đã chuyển đổi |
| Bổ sung | App báo giá, fixture/oracle, repository reader/index, model/Agent adapter, cache/verifier, patch/test executor | Module nhỏ, tách nghiệp vụ khỏi HTTP/UI/storage; không thêm ERP/SDK/dịch vụ khi chưa cần |
| Bổ sung | Change Review, Approval Center/control, artifact binding, trace/runner | Một gate dùng chung; backend/control là nguồn quyết định, UI chỉ trình bày |
| Để sau | Context Cache, server cache benchmark, hai tầng, sweep embedding/eviction/RBAC-ABAC, fine-tune/FL, nhiều agent/provider | Chỉ mở khi cần trả lời câu hỏi nghiên cứu và không phá kịch bản duy nhất |

## Lộ trình theo thứ tự ưu tiên

| Bước | Ưu tiên và phụ thuộc | Việc cần triển khai | Mốc kiểm chứng trước khi đi tiếp |
| --- | --- | --- | --- |
| 1. App báo giá giả lập | P0, đầu tiên sau thống nhất contract tối thiểu | Source tiếp nhận/hàng đợi/validation tối giản trong repo; trạng thái gốc chưa có rule mới, không ERP | Test hành vi cũ pass; lưu source revision; minh chứng rule mới chưa tồn tại |
| 2. Fixture và nghĩa ngày | P0, phải chốt nghĩa/threshold trước đóng băng hoặc chạy thực nghiệm | Một manifest giả lập với nhãn, mốc thời gian, ca validation/gate/reuse được thống nhất; acceptance rule định trước | Hash/manifest bất biến; oracle review; test tái hiện thiếu rule trên trạng thái gốc, phân biệt expected failure với baseline đã hoàn thành |
| 3. Kiểm tra và dựng lát cắt cache | P0, sau contract fixture/identity/reuse; khảo sát đã xác nhận chưa có implementation | Answer Cache local, storage/matching/verification; exact trước để kiểm tra luồng, thêm semantic sau khi khóa model/threshold | Hit thật cho câu tương đương; reject sai intent, tenant/repo/quyền, source/hash/policy/TTL/integrity; Miss không sinh số giả. Chưa benchmark với mock |
| 4. Authorized repository retrieval | P0, cần snapshot/scope/trusted metadata | Reader/index/RAG cho source app mẫu được phép, provenance; thay mock retrieval dùng khi phát triển bước 3 | Tìm đúng validation với quyền đúng, deny nguồn ngoài scope/symlink, source đổi khiến cache không reuse; nối fallback thật |
| 5. AI Coding Agent integration | P1, sau 3–4 và chốt adapter/executor | Adapter model/Agent/tool scope; request và context có provenance, không có quyền approve/deploy | Agent tìm được vị trí, usage/error thực, không vượt scope; không dùng fixture answer giả làm output Agent |
| 6. Đúng một patch và test | P1, sau 5 | Đề xuất patch rule ngày hết hạn, diff/source/artifact/evidence; executor chạy fixture và hồi quy thật | Flags đúng theo oracle và test evidence khớp artifact; patch ngoài scope bị đánh dấu thất bại; chưa deploy trước gate |
| 7. Approval Gate gắn phiên bản | P0 về an toàn, phải hoàn tất trước mọi deployment; có thể thiết kế contract sớm | Một control chung cho hai workflow, reviewer authority, exact binding, block mọi đường deploy không hợp lệ trong PoC | Chưa duyệt/sai quyền/sai artifact/mã đổi sau duyệt bị block qua API/control; đúng artifact được duyệt mới được kích hoạt trong thử nghiệm kiểm soát |
| 8. Execution trace đầy đủ | P1, instrumentation tối thiểu chuẩn bị từ bước 3 | Hoàn thiện request/context/cache/diff/test/approval/deploy IDs, hashes và expected event schema | Truy vết được cả success/blocked/error/timeout; thiếu event/field/link được phát hiện, không tạo log bù giả |
| 9. So sánh chính hai workflow | P2, chỉ sau 1–8 đạt và protocol/threshold được xác nhận | Freeze source/fixture/gate/config, reset và chạy Developer-guided/AI-assisted theo protocol | Báo năm chiều, số planned/attempted/completed, mọi failures và thời gian sửa; lưu artifacts, không suy nguyên nhân riêng cache |
| 10. Kiểm chứng riêng cache | P2, đề xuất bổ sung cần thống nhất | Cùng AI Agent No Cache/Secure Local Cache; cold/warm, preload và query reuse minh bạch | Calls/tokens/timing/verification/reuse thật; nếu không có reuse hữu ích ghi không đủ lợi ích; tách scripted probes khỏi workflow tự nhiên |

Thứ tự trên là đường triển khai PoC, không cho phép deployment trước bước 7. Trace/gate contract cần thiết kế sớm để không gắn evidence muộn; chỉ baseline tính năng báo giá được đặt ở trạng thái chưa có rule, gate và hạ tầng đo phải giống nhau trước bắt đầu thí nghiệm chính. Cache bước 3 có thể kiểm tra bằng adapter giả để phát triển, nhưng chỉ nghiệm thu end-to-end sau retrieval/model thực và phải ghi rõ mock/test double.

## Bước lập trình nhỏ nhất tiếp theo — chưa thực hiện

Ưu tiên P0: sau khi xác nhận schema báo giá và nghĩa ngày hợp lệ, tạo app báo giá nền tối giản **chưa có rule mới** cùng một fixture có nhãn. Không cần sửa frontend để có giá trị kiểm chứng ban đầu.

Đường dẫn dự kiến, chưa tạo và chưa phải cấu trúc chốt:

- `backend/app/quotation_demo/models.py`: dữ liệu báo giá và kết quả validation tối thiểu.
- `backend/app/quotation_demo/service.py`: tiếp nhận/hàng đợi trong bộ nhớ cho PoC, validation nền; storage thật để sau nếu chưa cần.
- `backend/tests/test_quotation_demo.py`: test hành vi nền và ca tái hiện rule thiếu; tổ chức expected-failure có chủ đích để không giấu lỗi thật.
- `research/datasets/quotation_fixture_v1.json`: **một** fixture manifest với báo giá/nhãn/mốc thời gian và nhóm ca control đã thống nhất; test tiếp theo cùng đọc contract này, không tạo benchmark fixture thứ hai.

Chưa nối API vào `backend/app/main.py` cho đến khi cần một contract đã chốt. Backend không import script `research`; chỉ đọc fixture theo schema dùng chung. Nếu ngôn ngữ/source app mẫu khác Python được lựa chọn, cần ghi lý do và cập nhật kế hoạch trước tạo đường dẫn khác.

Nghiệm thu lát cắt này: source nền chạy độc lập mà không import code Agent/IDE/cache; fixture có nhãn và hash; test nền pass; test rule mới chứng minh đúng thiếu sót cần Agent bổ sung; không có patch rule mới, approval UI hay deploy được tuyên bố đã hoàn thành. Sau đó mới tiếp tục cache/retrieval theo bảng.

## Điều kiện cần xác nhận

Các quyết định chặn bước phụ thuộc: nghĩa ngày hợp lệ và one-fixture contract (1–2), acceptance rule/protocol lặp (trước 9), identity/authority/freshness và exact artifact binding/deploy target (3–7), vị trí local và model/Agent/tool scope (3–5). Danh sách đầy đủ ở [câu hỏi mở](overview.md#giả-định-và-câu-hỏi-mở).

UI cũ vẫn có manifest tài liệu nội bộ, threshold/TTL và training intent nháp; không tự coi là thông số PoC mới. Không bắt đầu sweep, fine-tune hoặc phép thử phụ trước khi so sánh chính đủ điều kiện kiểm chứng.
