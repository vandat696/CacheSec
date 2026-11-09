# Phân quyền, cache verification và human approval

## Trạng thái và ranh giới

Phần quyền API báo giá đã triển khai bằng identity fixture backend; cache verification, quyền control/reviewer và approval/deployment gate bên dưới vẫn là **thiết kế mục tiêu**. UI RBAC/ABAC không thực thi quyền. Safety property duy nhất từ giảng viên là: **không triển khai thay đổi quy tắc validation nếu chưa có người có thẩm quyền phê duyệt tường minh chính xác thay đổi đó**.

| Cơ chế | Quyết định | Không được suy ra |
| --- | --- | --- |
| Authorization | Principal hiện tại có được đọc nguồn, đề xuất, chạy test, duyệt hoặc deploy trong repo/scope này? | Similarity, nội dung LLM hoặc role cũ trong cache không cấp quyền |
| Cache Verification | Answer/context này còn đúng nguồn, ngữ nghĩa, quyền, phiên bản và policy để reuse? | Cache hit không chứng minh patch/test hiện tại đúng hoặc đã duyệt |
| Human Approval Gate | Chính xác change/artifact này đã được người có quyền duyệt tường minh và còn hiệu lực tại deployment? | Test pass, cached approval, UI enabled hay Agent đồng ý không thay reviewer |

Duyệt code không phải duyệt báo giá. Các kiểm soát quyền/cache phục vụ kiến trúc nghiên cứu; không mở thêm safety property nghiệp vụ độc lập ngoài yêu cầu deployment approval.

## Identity, RBAC/ABAC và authorized retrieval

Identity/tenant lấy từ nguồn backend xác thực; client không được tự chọn tenant/role hoặc sửa metadata để cấp quyền. Ngày 2026-11-07 người dùng chọn **identity fixture do backend quản lý cho PoC**, phải ghi là mô phỏng identity, không gọi là production authentication. Mapping control/repo/tenant vẫn chờ T04; phần API báo giá đã chốt riêng như dưới đây. Approval gate vẫn phải thực thi thật ở backend/control với đúng artifact, không trở thành mô phỏng chỉ vì identity là fixture.

### Quyền API báo giá đã triển khai

Theo lựa chọn người dùng, [FixtureIdentityRegistry](../../backend/app/quotation_demo/identity/fixture_registry.py) có hai principal trong scope cố định quotation_demo:

| Principal | Capability |
| --- | --- |
| quotation-reader | quotation.read: danh sách và chi tiết |
| quotation-operator | quotation.read và quotation.create |

Client gửi Bearer token ngẫu nhiên cấu hình riêng qua QUOTATION_FIXTURE_READER_TOKEN / QUOTATION_FIXTURE_OPERATOR_TOKEN; không có token/tài khoản mặc định. Hai token phải khác nhau và ít nhất 32 ký tự; hướng dẫn local sinh bằng nguồn ngẫu nhiên mật mã. Backend giữ digest để đối chiếu constant-time; không nhận role/tenant/capability từ body hoặc header làm authority. Thiếu/sai/thu hồi token trả 401; đúng identity nhưng thiếu capability trả 403. Không có quyền Reviewer, approve hoặc deploy trong các grants này.

Giao diện /quotations nhận token bằng ô password, chỉ giữ trong bộ nhớ route và gửi qua Authorization, không lưu cookie/browser storage hoặc NEXT_PUBLIC_*; không tự chọn role hay nạp token backend. Ngắt kết nối/rời route hoặc 401 xóa phiên/dữ liệu UI, hủy/bỏ qua response đến trễ. Nội dung đã đọc/sao chép vẫn không thể thu hồi; token trong bộ nhớ không bảo vệ trước XSS/host bị kiểm soát. CORS chỉ cho origin cấu hình, không bật cookie credentials và không thay kiểm quyền backend. Địa chỉ API public và giới hạn local ở [setup](../general/setup.md#2b-api-báo-giá-độc-lập).

Quyền được kiểm tra **ở đầu mỗi thao tác**, kể cả GET và idempotent replay, trước mở transaction. Handle đã authenticate cũng phải đọc lại registry khi require; không dùng quyết định quyền cũ. Thu hồi trong registry chặn thao tác tiếp theo, không hủy thao tác đã qua gate hoặc thu lại nội dung đã đọc. Registry và thu hồi hiện chỉ trong một process; khởi động lại nạp cấu hình token mới. Không có endpoint tự cấp/thu hồi quyền, đồng bộ nhiều worker, token expiry hoặc đăng nhập production; đổi/loại token cấu hình cần restart process. Chạy local một worker theo [setup](../general/setup.md#2b-api-báo-giá-độc-lập).

Đây là **một dataset ứng dụng dùng chung**, không có cột tenant hoặc lọc theo tenant trên quotations. Cả hai principal đọc cùng tập dữ liệu. Scope trong idempotency metadata do backend gán, không chứng minh đã triển khai phân vùng dữ liệu nhiều tenant. Freshness này chỉ áp dụng API báo giá, chưa chốt thay policy cache/control/reviewer/offline. Request ID và metadata tạo báo giá chưa phải audit trail nghiên cứu bền vững.

Capability tối thiểu trong thiết kế: Developer đọc repo/đề xuất/chạy test trong scope; Reviewer duyệt đúng change trong repo được cấp; Deployment Control thực thi deployment có approval. Ngày 2026-11-07 người dùng cho phép Developer tự duyệt nếu có quyền Reviewer hiện tại; không bắt buộc danh tính reviewer khác proposer hoặc ba tài khoản riêng. Backend phải kiểm tra quyền duyệt hiện tại trên đúng repo/change, nhận quyết định tường minh và ghi actor/artifact/evidence; vai trò Developer đơn thuần không đủ quyền duyệt. Đây là lựa chọn policy PoC của người dùng, không phải yêu cầu mới đã được giảng viên xác nhận.

Agent chỉ nhận capability được ủy quyền cho đọc/đề xuất/test, không có quyền approve/deploy, kể cả khi người dùng có cả quyền Developer và Reviewer. Không tự duyệt do prompt, test pass, cache hit hoặc chuyển vai trò ở UI; người có quyền vẫn phải thực hiện hành động duyệt cụ thể. Audit cho phép proposed_by và approved_by cùng danh tính khi policy này hợp lệ, không coi đó là thiếu trace.

RBAC dựa role, ABAC dựa tenant/repo/path, hành động, trạng thái change và policy hiện tại. Chi tiết tổ hợp và freshness còn mở. Quyền đọc source không đồng nghĩa quyền sửa, duyệt hay deploy. Backend kiểm tra mọi nguồn phụ thuộc khi retrieval, generation và reuse. Role/quyền cũ trong token/entry không chứng minh quyền hiện tại; không xác minh được thì không trả cache.

[Ma trận capability T02](api.md#ma-trận-capability-theo-thao-tác) mô tả quyền cần có cho từng operation, bao gồm GET/status/events/context và idempotent replay; đó không phải danh sách grants đã cấp cho fixture user. T04 phải chốt mapping principal/scope, delegation và freshness rồi đối chiếu lại contract. ID resource/cursor/idempotency key hoặc receipt context không tự cấp quyền.

## Cache verification và toàn vẹn

[Thiết kế cache](cache.md) sở hữu lookup/admission/lifecycle. Verifier kiểm tra tenant/repo/principal, intent/context, mọi source version/hash, TTL, policy/config và payload integrity từ nguồn tin cậy. Source hash không đủ nếu local answer bị thay. Đề xuất backend registry/chứng thực ràng buộc entry ID, payload hash, nguồn và configuration; thuật toán, key management và replay protection chưa chốt.

Cache bị từ chối không đồng nghĩa câu hỏi bị cấm; có thể retrieval mới nếu quyền cho phép. Dịch vụ quyền lỗi không được giả thành ALLOW hoặc fallback không hạn chế. Cached context chỉ được dùng trên snapshot khớp, và Agent phải kiểm tra lại trước sửa code nếu working tree đổi. Source/policy đổi sau verification phải được phát hiện tại điểm dùng theo freshness đã công bố.

## Human Approval Gate và exact change

**Yêu cầu bắt buộc:** gate tại backend hoặc deployment control, một implementation dùng cho cả Developer-guided và AI-assisted. Mọi đường triển khai rule trong PoC đều đi qua gate. UI chỉ hiển thị quyết định; giấu/khóa nút không phải enforcement.

**Cơ chế đề xuất, cần chốt contract:** proposal bất biến nhận định danh gồm repo ID, base/source revision, canonical patch digest và artifact digest; evidence gắn fixture/test-suite/config digest và test run/result digest. Artifact là bytes sẽ kích hoạt, không chỉ tên branch/file. Reviewer xem diff và evidence đúng định danh đó, backend xác minh identity/quyền hiện tại rồi ghi approved/rejected tường minh. Không tự chuyển pending thành approved bằng test pass hoặc cache hit.

Luồng trạng thái đề xuất:

```text
Draft → Proposed → Tested → Awaiting approval → Approved → Deployed
                            ↘ Rejected/Blocked
Mã/artifact/evidence thay đổi → proposal revision mới → test + approval lại
```

Trạng thái proposal thuộc server, client không được tự ghi Approved. Trước deployment, control đọc lại artifact bất biến từ kho tin cậy, xác minh toàn bộ binding, test bắt buộc đạt, reviewer đúng quyền và approval chưa bị revoke/expire. Kiểm tra và kích hoạt phải cùng ràng buộc một digest để tránh TOCTOU; không check file rồi chạy bytes khác. Không rebuild artifact khác sau approval. Thay đổi reviewer/policy/nguồn/target làm mất điều kiện hợp lệ phải block hoặc đánh giá lại theo policy đã chốt.

Approval là bản ghi quyết định có audit, **không phải answer/context cache entry** để reuse cho thay đổi khác. Self-approval đã được người dùng cho phép với quyền Reviewer hiện tại; deploy lại cùng artifact, expiry và thu hồi approval vẫn cần thống nhất, không giả định quyết định có hiệu lực vĩnh viễn. Không có artifact/build/test hoặc không xác minh được binding thì block.

Deployment PoC được đề xuất là kích hoạt version trong môi trường giả lập có control thật, không deploy ra hệ thống ngoài. Control từ chối đường gọi trực tiếp không có approval, không chỉ đường UI. Cần xác nhận phạm vi adversary và bypass: admin/host bị kiểm soát có thể nằm ngoài PoC, phải công bố, không tuyên bố bảo vệ toàn bộ hệ điều hành.

## Ca bắt buộc để kiểm chứng gate

| Tình huống | Kết quả cần quan sát ở control |
| --- | --- |
| Không có approval, pending hoặc reviewer từ chối | Block; có reason và change/artifact ID |
| Principal không có quyền duyệt hoặc giả identity/tenant/repo | Không tạo approval hợp lệ; deploy block |
| Người đề xuất đồng thời có quyền Reviewer hiện tại, duyệt tường minh đúng artifact | Có thể tạo approval theo policy đã chọn; vẫn kiểm tra binding/evidence và điều kiện activation như reviewer khác |
| Duyệt patch A rồi đổi patch/source/artifact thành B | Block B; cần test và approval mới |
| Đúng patch nhưng artifact khác, evidence sai fixture/config hoặc test lỗi | Block; không suy từ tên/version hiển thị |
| Approval hết hiệu lực hoặc quyền reviewer bị thu hồi theo policy | Block sau freshness đã công bố |
| Đúng change, artifact, evidence và approval hợp lệ | Chỉ deploy artifact đó, ghi quyết định và digest đã kích hoạt |

Bốn hành vi tối thiểu trong yêu cầu đánh giá người dùng cung cấp là chặn chưa duyệt/sai quyền/sai phiên bản và cho phép đúng thay đổi đã duyệt. Các ca bổ sung trên là đề xuất kỹ thuật để kiểm chứng cùng safety property, không phải software changes độc lập.

## Threat model và giới hạn cần chốt

| Đe dọa | Kiểm soát mục tiêu/giới hạn |
| --- | --- |
| Cross-tenant/repo, quyền bị thu hồi, ABAC đổi | Backend kiểm tra scope và quyền hiện tại; freshness có phiên bản |
| Similarity cao nhưng khác intent/đáp án; source/policy stale | Verification độc lập similarity; invalidate/retrieve lại; oracle reuse đánh giá riêng |
| Cache poisoning, metadata/payload/hash client giả | Registry/chứng thực tin cậy; fail closed khi thiếu bằng chứng toàn vẹn |
| Source hoặc artifact đổi giữa check và use | Snapshot/content-addressed artifact, kiểm tra binding tại điểm dùng/deployment |
| Prompt injection trong repo/LLM | Source là dữ liệu; không đổi policy, không tự approve, không cấp tool ngoài scope |
| Agent đọc secrets hoặc chạy lệnh ngoài repo | Allowlist/tool executor có giới hạn, không theo symlink vượt scope; cơ chế sandbox phải chốt trước tích hợp |
| Approval giả, stale, replay cho patch khác hoặc bypass UI | Backend/control kiểm quyền, exact digest, trạng thái và mọi đường deploy trong PoC |
| Log bị sửa/mất, auth/audit service lỗi | Trace gắn ID/digest, ghi lỗi; đề xuất block deployment khi không thể ghi quyết định bền vững, contract nguyên tử còn mở |
| XSS/thiết bị bị kiểm soát, plaintext đã đọc | Ngoài bảo đảm thu hồi reuse; mã hóa browser không tự giải quyết, không thu hồi nội dung đã sao chép |

Chỉ dùng source/báo giá/identity giả lập. Log tối thiểu đủ trace, không chứa secrets hoặc nội dung ngoài quyền. Unsafe cache nếu có chỉ là đối chứng mô phỏng tùy chọn, không mặc định thêm vào PoC. Zero unauthorized/stale reuse hoặc không bypass trong bộ thử là quan sát hữu hạn, không phải bảo đảm tuyệt đối.

Ngoài lát cắt quyền báo giá ở trên, mapping identity/policy RBAC/ABAC cho repo/control, reviewer authority, approval binding/integrity, freshness/revoke/offline cho cache/gate, deploy target/control và audit durability còn cần xác nhận ở [câu hỏi mở](../general/overview.md#giả-định-và-câu-hỏi-mở).
