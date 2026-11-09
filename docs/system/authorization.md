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

Theo lựa chọn người dùng, [FixtureIdentityRegistry](../../backend/app/quotation_demo/auth/fixture_identity.py) có hai principal trong scope cố định quotation_demo:

| Principal | Capability |
| --- | --- |
| quotation-reader | quotation.read: danh sách và chi tiết |
| quotation-operator | quotation.read, quotation.create và quotation.validate |

Client gửi Bearer token ngẫu nhiên cấu hình riêng qua QUOTATION_FIXTURE_READER_TOKEN / QUOTATION_FIXTURE_OPERATOR_TOKEN; không có token/tài khoản mặc định. Hai token phải khác nhau và ít nhất 32 ký tự; hướng dẫn local sinh bằng nguồn ngẫu nhiên mật mã. Backend giữ digest để đối chiếu constant-time; không nhận role/tenant/capability từ body hoặc header làm authority. Thiếu/sai/thu hồi token trả 401; đúng identity nhưng thiếu capability trả 403. Không có quyền Reviewer, approve hoặc deploy trong các grants này.

Ngày 2026-11-09 người dùng chọn chỉ operator được validate, reader giữ quyền chỉ đọc. Validation cần đồng thời quotation.read và quotation.validate trước đọc storage, kể cả gọi lại; ID không tồn tại không làm lộ khác biệt cho reader không có quyền validate. Quyền này chỉ chạy validator của app, không duyệt báo giá, sửa code, tạo test evidence hoặc cấp approval. [Contract validation nền](api.md#validation-nền-đã-triển-khai) công bố tập quy tắc hiện tại và phần runtime/artifact chưa có.

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

### Bản nháp gate T04 để review — 2026-11-09

Phần này cụ thể hóa đường thực thi để review; **chưa chọn implementation, chưa có code gate và chưa cấp quyền activation**. Hai workflow đi qua cùng một đường test/review/activation. Endpoint validate báo giá không thay cho bước test bản sửa hoặc gate này. App nền hiện trả active_artifact = null; trước baseline nghiên cứu phải nối metadata runtime từ launcher tin cậy và kiểm chứng khớp bytes được test/kích hoạt.

| Bước control đề xuất | Nguồn tin cậy và ràng buộc cần thực thi | Khi thiếu/sai/lỗi |
| --- | --- | --- |
| 1. Chụp source | Backend tạo snapshot gồm repo identity, base revision và mọi bytes/phụ thuộc cần build/run; working tree chưa commit cần manifest hash, không chỉ branch/commit | Không tạo binding từ source chưa xác minh |
| 2. Chuẩn bị artifact | Executor theo scope tạo gói bất biến của source, dependencies/lock, entrypoint và runtime config; toàn bộ nội dung ảnh hưởng validation nằm trong binding. Chỉ hash file validator không chứng minh cả artifact | Không đánh dấu artifact sẵn sàng; không rebuild sau review |
| 3. Chạy test | Test trên chính artifact bất biến, gắn suite/config/fixture và evidence; thu đủ exit/outcome/error/timeout. Test kỹ thuật khác acceptance nghiên cứu còn chờ cô | Không cho tạo approval dùng evidence thiếu/lỗi/sai artifact; không giả pass |
| 4. Tạo change binding | Backend liên kết repo/base/source/patch/artifact/test/evidence/fixture/config/target; client chỉ chọn resource refs đã có quyền, không tự cấp digest hoặc evidence đáng tin | Binding thiếu thành phần hoặc nguồn đổi không được approve |
| 5. Nhận duyệt tường minh | Human Reviewer xem đúng diff/evidence/binding, gửi quyết định gắn binding; kiểm quyền hiện tại theo repo. Self-approval chỉ khi human thực sự có Reviewer; Agent không được nhận quyền này | Không lưu approval hợp lệ do test pass/cache hit/chọn role ở UI |
| 6. Lưu approval và quyết định | Bản ghi approval tham chiếu binding bất biến và authority/policy; đề xuất lưu cùng event trong transaction của control | Lỗi commit không trả Approved; không dùng bản ghi trong bộ nhớ làm bằng chứng thay thế |
| 7. Kiểm tra trước activation | Đọc lại approval/binding/evidence/artifact và authority reviewer/deployer; xác minh bytes và expected_target_version. Đề xuất serialize theo target và compare-and-set version để hai request không cùng thắng | Stale/revoked/sai target/version/bytes hoặc dependency unavailable đều block, có reason |
| 8. Kích hoạt và đối soát | Launcher chỉ nhận artifact ref bất biến đã qua gate; ghi intent bền vững trước side effect, xác nhận digest/version thực sự active rồi mới báo Deployed | ACK mất/timeout là unknown cần đối soát, không báo thành công hoặc kích hoạt lại mù; khóa đường activation tiếp theo khi trạng thái target chưa xác định |

Transaction DB và thay process/artifact tại launcher không mặc nhiên là một transaction nguyên tử. T03–T04 phải chọn cơ chế reservation/activation/reconciliation và điểm có hiệu lực của revoke/version check. Một lock trong process control không đủ nếu có nhiều worker hoặc launcher có đường gọi ngoài gate. Thất bại ghi kết quả sau activation cần đối soát trạng thái thực tế, không ghi Blocked như thể chưa có side effect. Không tự thêm rollback sang artifact khác: rollback cũng là activation và phải có contract riêng.

Các lựa chọn cần khóa trước triển khai, không coi bảng trên là đã được người dùng duyệt:

| Nhóm quyết định | Phương án để review và đầu ra cần chốt |
| --- | --- |
| Authority/scope/freshness | Registry fixture control riêng, mapping principal/tenant/repo và delegation; kiểm ở approve và activation, định nghĩa revoke đang xảy ra đồng thời. Grants app báo giá không được dùng thay |
| Bytes/binding/storage | Manifest đóng gói bao phủ dependency/config; đề xuất SHA-256 cho bytes và biểu diễn binding có version. Chọn canonicalization, nơi lưu bytes bất biến, quyền ghi và retention; hash không phải chữ ký hoặc authority |
| Test và thời điểm tham chiếu | Danh sách suite kỹ thuật bắt buộc, nguồn R/config do runtime tin cậy cấp, fixture refs; acceptance vẫn chờ cô, không mặc định 100% |
| Approval lifecycle | Thời hạn/revoke/supersede/redeploy cùng artifact; authority/policy/source/evidence đổi thì đánh giá lại hoặc block theo policy được chọn |
| Executor/target/threat boundary | Cơ chế sandbox và giới hạn tài nguyên/lệnh; launcher local giả lập có gate thật, khóa bypass thuộc PoC; nêu rõ giới hạn trước host/admin bị kiểm soát |
| Atomicity/audit | Storage approval/events, khóa/CAS target, recovery khi crash giữa lưu intent/activation/ACK; nếu chưa xác định trạng thái thì không tiếp tục activation |

Ma trận kiểm chứng khi có implementation phải thêm ca tranh chấp hai activation cùng expected version, đổi bytes sau test/approval, revoke trong lúc chờ activation, crash trước/sau side effect và ACK mất. Kết quả cần phân biệt denied/blocked/failed/unknown/deployed bằng bằng chứng tại đúng điểm thực thi. Đây là kiểm chứng cùng một safety property, không thêm thay đổi nghiệp vụ hoặc chạy thực nghiệm ở bước thiết kế.

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
