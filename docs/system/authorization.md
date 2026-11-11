# Phân quyền, cache verification và human approval

## Trạng thái và ranh giới

Phần quyền API báo giá, registry control và snapshot có kiểm quyền đã có implementation nội bộ; cache verification, reviewer workflow và approval/deployment gate bên dưới vẫn là **thiết kế mục tiêu**. UI RBAC/ABAC không thực thi quyền. Safety property duy nhất từ giảng viên là: **không triển khai thay đổi quy tắc validation nếu chưa có người có thẩm quyền phê duyệt tường minh chính xác thay đổi đó**.

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

**Cơ chế mục tiêu; phương án local đã chọn được cụ thể hóa bên dưới:** proposal bất biến nhận định danh gồm repo ID, base/source revision, canonical patch digest và artifact digest; evidence gắn fixture/test-suite/config digest và test run/result digest. Artifact là bytes sẽ kích hoạt, không chỉ tên branch/file. Reviewer xem diff và evidence đúng định danh đó, backend xác minh identity/quyền hiện tại rồi ghi approved/rejected tường minh. Không tự chuyển pending thành approved bằng test pass hoặc cache hit.

Luồng trạng thái đề xuất:

```text
Draft → Proposed → Tested → Awaiting approval → Approved → Deployed
                            ↘ Rejected/Blocked
Mã/artifact/evidence thay đổi → proposal revision mới → test + approval lại
```

Trạng thái proposal thuộc server, client không được tự ghi Approved. Trước deployment, control đọc lại artifact bất biến từ kho tin cậy, xác minh toàn bộ binding, test bắt buộc đạt, reviewer đúng quyền và approval chưa bị revoke/expire. Kiểm tra và kích hoạt phải cùng ràng buộc một digest để tránh TOCTOU; không check file rồi chạy bytes khác. Không rebuild artifact khác sau approval. Thay đổi reviewer/policy/nguồn/target làm mất điều kiện hợp lệ phải block hoặc đánh giá lại theo policy đã chốt.

Approval là bản ghi quyết định có audit, **không phải answer/context cache entry** để reuse cho thay đổi khác. Self-approval đã được người dùng cho phép với quyền Reviewer hiện tại; policy local v0.1 bên dưới định nghĩa expiry/revoke và một deployment cho mỗi approval, không có hiệu lực vĩnh viễn. Không có artifact/build/test hoặc không xác minh được binding thì block.

Deployment PoC được đề xuất là kích hoạt version trong môi trường giả lập có control thật, không deploy ra hệ thống ngoài. Control từ chối đường gọi trực tiếp không có approval, không chỉ đường UI. Cần xác nhận phạm vi adversary và bypass: admin/host bị kiểm soát có thể nằm ngoài PoC, phải công bố, không tuyên bố bảo vệ toàn bộ hệ điều hành.

### Bản nháp gate T04 để review — 2026-11-09

Đây là bản nháp ban đầu, đã được cụ thể hóa thành **gói local v0.1 được chọn bên dưới; gate chưa có code hoặc quyền activation**. Hai workflow đi qua cùng một đường test/review/activation. Endpoint validate báo giá không thay cho bước test bản sửa hoặc gate này. App nền hiện trả active_artifact = null; trước baseline nghiên cứu phải nối metadata runtime từ launcher tin cậy và kiểm chứng khớp bytes được test/kích hoạt.

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

Các nhóm quyết định của bản nháp; local v0.1 bên dưới sở hữu lựa chọn hiện hành, còn nguồn/profile cụ thể phải đăng ký và kiểm chứng:

| Nhóm quyết định | Phương án để review và đầu ra cần chốt |
| --- | --- |
| Authority/scope/freshness | Registry fixture control riêng, mapping principal/tenant/repo và delegation; kiểm ở approve và activation, định nghĩa revoke đang xảy ra đồng thời. Grants app báo giá không được dùng thay |
| Bytes/binding/storage | Manifest đóng gói bao phủ dependency/config; đề xuất SHA-256 cho bytes và biểu diễn binding có version. Chọn canonicalization, nơi lưu bytes bất biến, quyền ghi và retention; hash không phải chữ ký hoặc authority |
| Test và thời điểm tham chiếu | Danh sách suite kỹ thuật bắt buộc, nguồn R/config do runtime tin cậy cấp, fixture refs; acceptance vẫn chờ cô, không mặc định 100% |
| Approval lifecycle | Thời hạn/revoke/supersede/redeploy cùng artifact; authority/policy/source/evidence đổi thì đánh giá lại hoặc block theo policy được chọn |
| Executor/target/threat boundary | Cơ chế sandbox và giới hạn tài nguyên/lệnh; launcher local giả lập có gate thật, khóa bypass thuộc PoC; nêu rõ giới hạn trước host/admin bị kiểm soát |
| Atomicity/audit | Storage approval/events, khóa/CAS target, recovery khi crash giữa lưu intent/activation/ACK; nếu chưa xác định trạng thái thì không tiếp tục activation |

Ma trận kiểm chứng khi có implementation phải thêm ca tranh chấp hai activation cùng expected version, đổi bytes sau test/approval, revoke trong lúc chờ activation, crash trước/sau side effect và ACK mất. Kết quả cần phân biệt denied/blocked/failed/unknown/deployed bằng bằng chứng tại đúng điểm thực thi. Đây là kiểm chứng cùng một safety property, không thêm thay đổi nghiệp vụ hoặc chạy thực nghiệm ở bước thiết kế.

### Phương án gate local v0.1 để chốt

**Trạng thái: người dùng đã chọn gói local v0.1 để triển khai ngày 2026-11-09; registry quyền nội bộ đã có code, gate/launcher chưa triển khai.** Registry chưa được nối vào HTTP/UI hoặc cấp principals/grants local. Một repo đăng ký, một target báo giá local, cùng một implementation cho hai workflow. Đây là phương án PoC trên host phát triển tin cậy; không đưa ra bảo đảm trước host/Docker/DB administrator bị kiểm soát. T03 sở hữu [data dictionary và artifact store](architecture.md#đề-xuất-t03-lưu-trữ-control-và-artifact-v01); T02 sở hữu [binding bytes và status](api.md#binding-và-deployment-local-v01--đề-xuất).

#### Registry control nội bộ đã triển khai

[ControlAuthorizer](../../backend/app/identity/control_authority.py) dùng PostgreSQL làm nguồn identity/grants hiện tại. Token human fixture được thành phần backend tin cậy cung cấp; DB chỉ giữ SHA-256 của token. Token cần được sinh ngẫu nhiên độc lập với token báo giá; helper kiểm chuỗi ASCII in được, không khoảng trắng, dài 32–65.536 ký tự nhưng không chứng minh entropy. Không token mặc định, role dropdown, role từ request hoặc tự cấp quyền Reviewer. Các principal hiện tại đều là human fixture; chưa có Agent credential/delegation.

Authenticate tra token digest, lấy scope từ record backend, khóa hàng scope_authorities rồi đọc lại principal/token/active để bắt credential đổi giữa lookup và lock. Require so tenant/repo trước đọc resource, khóa cùng hàng authority và kiểm lại credential version/digest/active cùng toàn bộ capability cần thiết. Không cache ALLOW hoặc capabilities trong caller. Caller là đối tượng nội bộ được xác thực, không nhận từ JSON/header. Scope khác trả ControlResourceUnavailable; identity hết hiệu lực trả ControlIdentityRequired; thiếu quyền trong scope trả ControlAccessDenied. HTTP repository hiện ánh xạ 401/403/404/503 theo [contract snapshot](api.md#http-snapshot-đã-triển-khai); không lộ existence của snapshot ngoài scope.

PostgresAuthorityAdministration chỉ dành cho backend tin cậy: đăng ký repository identity (opaque ASCII tối đa 128 ký tự, không phải path), cấu hình principal/grants hoặc disable principal. Mọi thay đổi principal/grants khóa cùng authority row, kiểm expected_epoch rồi ghi principal, grants và epoch trong transaction caller sở hữu. Cấu hình cũ conflict thay vì hồi sinh quyền sau revoke; token rotation cần version tăng. Không tự đồng bộ cấu hình từ worker vào DB lúc startup; CLI host configure_repository áp cấu hình tường minh với expected_epoch; worker chỉ đọc registry hiện tại, không replay grant từ cấu hình startup. Không expose administration hoặc DB credentials cho Agent/browser.

Đã kiểm thử cấp/thu hồi capability, disable/rotation, recheck caller cũ, scope/FK, cấu hình song song và lock giữ đến commit. Hai capability change.review/deployment.activate được biểu diễn để kiểm quyền, chưa có thao tác duyệt/triển khai. Chưa có policy epoch riêng, trace/audit bền vững, principal local được cấp thật hoặc gate; các nội dung bên dưới vẫn là thiết kế cho bước tiếp theo.

#### Quyền snapshot nội bộ đã triển khai

Capture/get/read_file đều xác thực và kiểm repository.read trước truy cập nguồn/bytes. Authority, snapshot records và blob index dùng chung PostgreSQL connection/transaction; khóa scope_authorities giữ đến commit. Revoke commit trước khi thao tác lấy lock sẽ block; revoke chờ thao tác đã lấy lock thì có hiệu lực sau đó, không thu hồi bytes đã đọc. Không dùng quyền reader/operator báo giá làm quyền repository.

Root và exact-file profile chỉ do cấu hình backend tin cậy cung cấp. Active profile digest nằm ở repository_source_profiles trong DB; PostgresSourceProfileAdministration.set_profile kiểm registry identity, expected_epoch và cùng scope lock, thay digest/tăng authority epoch nguyên tử. Capture/read đối chiếu digest cấu hình worker và snapshot với active digest mỗi lần; worker cấu hình cũ hoặc profile chưa đăng ký bị chặn trước đọc source/blob. Không tự reload/overwrite active policy từ worker startup; đã có CLI host cấu hình read-only; không có admin HTTP, chưa cấp cấu hình nguồn dev thật hoặc đường Agent sửa policy.

Snapshot/file ID của scope khác trả ControlResourceUnavailable; profile đổi chặn đọc snapshot cũ qua service này, kể cả grant repository.read vẫn còn. Get chỉ xác minh metadata/profile/manifest; read_file xác minh cả payload file. Kiểm đường dẫn và hai lượt đọc không phát hiện mọi secret hoặc chứng minh capture nguyên tử trước host race. [Snapshot architecture](architecture.md#snapshot-repository-đã-triển-khai) sở hữu giới hạn này. Chưa có quyền source write, delegation hoặc approval/deployment từ snapshot.

#### Authority, scope và thời hạn đề xuất

| Quyết định v0.1 đã chọn | Nội dung cụ thể |
| --- | --- |
| Realm control riêng | Token ngẫu nhiên do backend cấu hình, map vào principal và credential version; không dùng token reader/operator app để gọi control. Không tài khoản/token mặc định hoặc role dropdown cấp quyền |
| Scope PoC | Một tenant giả lập, một repo identity đăng ký và một target local. Mọi ref phải thuộc scope hiện tại; ID của resource không thay kiểm quyền |
| Human Developer | repository.read, workflow.run/read, proposal.create, test.run và deployment.read trong scope; không có change.review/deployment.activate chỉ vì là Developer |
| Human có Reviewer và deploy authority | Cấp thêm change.review và deployment.activate bằng grant backend. Có thể cùng principal Developer như lựa chọn self-approval đã thống nhất; không bắt buộc ba tài khoản. Test sai quyền dùng principal thiếu capability cần thiết |
| Agent delegation | Tập con đọc/đề xuất/test cho đúng run/repo/path, hết hạn theo deadline run đã đăng ký; không kế thừa token hoặc capability review/activate của người khởi tạo |
| Freshness gate | Không cache ALLOW. Kiểm identity/scope/quyền hiện tại lúc nhận request, lúc approve và tại transaction phát dispatch permit. Cả requester deployment và reviewer của approval phải còn đúng quyền ở điểm phát permit |
| Thu hồi đang tranh chấp | Grant/revoke, credential/policy epoch và dispatch dùng cùng hàng authority của scope và thứ tự lock. Revoke commit trước permit thì block; revoke commit sau permit không hủy hồi tố activation đã được cho phép, kể cả ACK còn đang chờ. Không diễn giải thời điểm process healthy là thời điểm kiểm quyền |
| Approval lifetime | Đề xuất expires_at = approved_at + 30 phút, so theo giờ DB tại phát permit; revoke/supersede/policy đổi chặn trước permit. Đây là TTL approval, không phải similarity/acceptance threshold |
| Tái sử dụng approval | Một approval gắn tối đa một deployment ID ngay khi reservation hợp lệ commit; retry cùng operation giữ ID đó. Sau thất bại/unknown không tạo deployment mới bằng approval cũ; cần review/approval mới nếu muốn một operation khác |
| Lỗi authority/audit | Không xác minh được authority, binding hoặc không lưu được decision/intent bền vững thì không phát lệnh activation. Đã có side effect nhưng mất kết quả lưu thì chuyển sang đối soát, không báo block như chưa từng chạy |

Authority/grants ở PostgreSQL là nguồn quyết định cho control; cấu hình credential/profile được áp tường minh qua CLI dưới scope lock và expected_epoch trước sử dụng. Worker không tự ghi lại registry lúc startup; mỗi request dùng trạng thái DB hiện tại. Không dùng registry trong một worker làm freshness toàn hệ thống. Agent không có API đổi authority/policy hoặc ghi control tables. Chính sách 403/404 đề xuất: ID ngoài scope trả RESOURCE_UNAVAILABLE không lộ existence; identity cùng scope nhưng thiếu capability trả ACCESS_DENIED trước trả nội dung. Các grants này **chưa được cấp**.

#### Executor và target local đề xuất

Artifact đề xuất là source bundle bất biến mount read-only trên Docker runtime image tin cậy có digest/platform cố định, như T03; không chạy app/test bằng import trong process control. Container không nhận Docker socket, thư mục control/kho artifact, credential quản trị DB, token reviewer hoặc thư mục home. Entrypoint/argv và mounts do launcher profile cố định; request/Agent không được truyền raw command, image tag hoặc bind path tùy ý.

Đề xuất chạy non-root, drop toàn bộ capabilities, no-new-privileges, root filesystem read-only, tmpfs riêng và seccomp mặc định; network test thuần dùng none. Ca HTTP/DB dùng mạng nội bộ chỉ nối DB test hoặc DB app theo profile, không route Internet/host network; cần kiểm chứng cấu hình mạng và khả năng truy cập thực tế trên Docker Desktop trước cấp quyền chạy code. Runtime DB role chỉ có quyền app, DB test do trusted harness tạo bên ngoài container; không đưa CREATEDB/superuser vào môi trường code đang test. Docker cung cấp các cơ chế cấu hình này, nhưng chúng không tự chứng minh sandbox đầy đủ: [tùy chọn container](https://docs.docker.com/reference/cli/docker/container/run/), [seccomp](https://docs.docker.com/engine/security/seccomp/).

Profile giới hạn **đề xuất để review**: 1 CPU, RAM 512 MiB, 128 process, tmpfs 64 MiB, tối đa 1 MiB output mỗi stream; test deadline 120 giây, activation/health deadline 60 giây. Control JSON tối đa 64 KiB, source bundle tối đa 20 MiB/256 file và 1 MiB mỗi file, chưa tính runtime image đã đăng ký riêng. Chạm giới hạn phải có outcome/error/truncation coverage; không gán pass hoặc coi kill là rollback. Các cap thuộc launcher/control profile riêng có version, không tự áp vào Context Cache hoặc sửa cap API báo giá đã chọn; chưa dùng các con số này làm cấu hình máy hoặc ngưỡng nghiên cứu.

Target đề xuất là thay process/container của app báo giá ở một endpoint loopback đã đăng ký, không zero-downtime: stop bản cũ rồi start đúng bundle/image/config đã duyệt. Test dùng target và DB tạm tách biệt, không expose bản chưa duyệt ở endpoint app. Không cho app tự chọn active version hoặc tự gọi launcher. Chỉ launcher tin cậy được giữ quyền Docker; control gọi launcher qua port nội bộ có operation ID và scope kiểm tra, không expose API Docker ra browser/Agent. Bootstrap artifact nền và rollback cũng đi qua approval/gate; không có cờ bypass kiểu bootstrap/force cho rule mới. Khi hạ tầng/fixture refs cần thiết chưa đăng ký, binding chưa ready và activation bị chặn.

Trusted harness đo hành vi qua HTTP của app trong container và tự ghi evidence từ fixture/suite đã đăng ký. Source/test output của app không được quyền tự ghi test_passed, approval hoặc sửa nhãn oracle. Những test hiện import app trực tiếp hoặc đòi CREATEDB chỉ là kiểm chứng phát triển tin cậy; cần adapter harness quản lý DB và thực thi tách biệt trước dùng làm evidence cho code do Agent sửa. Stdout/JUnit do code đang test có thể ảnh hưởng chỉ là dữ liệu chẩn đoán, không đủ một mình để cấp approval. Phiên bản suite/harness và image của nó phải được khóa cùng test profile.

#### Protocol reservation, dispatch và reconciliation

Đề xuất một launcher có quyền side effect trên host; singleton phải được thực thi ở host, không chỉ bằng biến trong Python. Target reservation/fence bền vững trong DB, dùng cả khi restart; không dùng TTL lease hết hạn để cho launcher thứ hai chạy khi launcher cũ có thể còn tác động Docker. Nếu chưa chứng minh cơ chế single-writer và thu hồi worker cũ thì chưa mở activation. Row locks chỉ bảo vệ transaction metadata, không thay fencing/ownership của launcher; xem [PostgreSQL explicit locking](https://www.postgresql.org/docs/17/explicit-locking.html).

Trên host Windows hiện tại, đề xuất launcher giữ handle khóa byte 0 dài 1 byte bằng msvcrt.locking/LK_NBLCK trên một lock file private cố định của host/target, từ trước recovery đến hết vòng đời process; không lấy được lock thì không dispatch. File/đường dẫn do registry backend quản lý, không cho Agent thay hoặc xóa/recreate để mở khóa thứ hai. Khi đổi root/profile phải xác minh launcher cũ đã dừng, không tạo lock path mới để vượt pending state. [Python msvcrt](https://docs.python.org/3.12/library/msvcrt.html) mô tả cơ chế byte-range lock; tính tương tác giữa process/ACL và crash phải kiểm chứng thật. Lock này không hủy request đã gửi vào Docker daemon; reservation unknown vẫn giữ nguyên cho đến khi đối soát, kể cả process cũ đã chết. Host Linux hoặc launcher nhiều máy nằm ngoài implementation v0.1 được đề xuất.

Thứ tự lock chung đề xuất: scope authority → proposal revision/current pointer → approval → target → deployment; cùng loại lock lấy theo ID tăng dần. Dùng transaction READ COMMITTED và SELECT FOR UPDATE cho hàng có thể đổi; đọc lại điều kiện sau khi có lock, không dùng kết quả kiểm tra trước lúc chờ lock. Deadlock/lock-timeout là lỗi retry có kiểm soát theo operation ID, chưa được gọi launcher trước commit permit.

| Pha | Transaction/side effect được phép | Ràng buộc và kết quả |
| --- | --- | --- |
| R1 — nhận activation | Kiểm quyền; lock authority/proposal/approval/target; kiểm binding/evidence/expiry và expected_target_version; lưu deployment, reservation/fence, idempotency ref và event rồi commit | Target phải stable, chưa pending. Approval chỉ gắn deployment này. 202 trả reference, chưa phải đã triển khai; commit lỗi không trả operation thành công |
| R2 — chuẩn bị | Launcher single-writer vật hóa/xác minh bundle/image/public config, target hiện tại và pending fence; chưa stop/start process | Mismatch trước dispatch trả blocked và kết thúc reservation bằng transaction nếu chứng minh chưa có side effect; không sửa artifact để cố khớp |
| R3 — phát permit | Kiểm tra lại authority reviewer/requester, credential/policy, approval expiry/revoke, revision/binding, target version/fence dưới cùng thứ tự lock; ghi permit và event rồi commit | Đây là điểm quyết định authorization của activation. Commit chưa xác định thì launcher đọc lại permit theo operation ID; không đoán commit thành công và không phát lệnh khi chưa xác minh |
| R4 — áp dụng | Launcher dùng permit gắn deployment/fence và operation ID cố định, stop/start đúng nguồn read-only/image ID/config; không rebuild, không lookup tag latest | Container name/operation ref cố định để đối soát. Không có đường dispatch raw command hoặc dùng permit cho artifact/target khác; kiểm tra ownership khi gọi |
| R5 — ghi nhận | Xác minh qua Docker/launcher state: container, image, mounts/config, endpoint/health và artifact manifest khớp; lưu succeeded, observed refs/digest, target version mới và event trong transaction | Self-report của app hoặc health 200 không đủ. Chỉ sau commit này API báo succeeded; lỗi sau side effect là unknown cần reconcile |
| R6 — đối soát | Khi timeout/restart/ACK mất, giữ target unknown/pending và dùng launcher-owned operation refs kiểm tra trạng thái thật | Không có phép retry bằng key/operation mới, không tự mở reservation hoặc chạy lại theo đồng hồ. Kết quả đối soát phải lưu observation và reason |

R1 chỉ được coi target stable sau khi actual target state đã được biết; active source/base phải phù hợp change binding, không âm thầm triển khai patch trên baseline khác. Worker chỉ nhận resource IDs; phải đọc trusted binding/permit, không tin job payload chứa hash/quyền. Đề xuất source/proposal supersede trước R3 làm approval không còn hiệu lực; sau R3 quyết định đó không hủy hồi tố operation đã cho phép, thay đổi tiếp theo phải chờ target được đối soát rồi xin approval mới. Approval có thể hết hạn trong lúc app khởi động; hiệu lực được xác định tại R3 như freshness đã công bố.

| Quan sát khi recovery | Kết quả được phép ghi |
| --- | --- |
| Chưa có permit bền vững, launcher chứng minh chưa phát side effect | Có thể tiếp tục cùng deployment từ pre-dispatch sau kiểm quyền mới, hoặc blocked/failed; không sinh permit từ client echo |
| Có đúng container/operation và bundle/image/config đã cho phép đang active, observation đầy đủ | Commit succeeded/target version và recovery event; không start thêm container |
| Chỉ còn bản cũ hoặc không có process, đồng thời chứng minh mọi lệnh cũ đã kết thúc và không thể chạy muộn | Failed với trạng thái active cũ/unavailable quan sát được; muốn operation mới cần approval mới |
| Cả hai process, khác bytes/config/fence, không xác minh được hoặc lệnh Docker cũ có thể còn chạy | Giữ unknown, chặn activation tiếp; recovery có kiểm soát và bằng chứng mới, không tự chọn bản thuận tiện |

Không coi inspect thấy container cũ tại một thời điểm là bằng chứng lệnh start trước đó sẽ không chạy muộn. Cơ chế xác nhận command quiescence và singleton/fencing phải được kiểm chứng bằng crash/fault injection trên host. Khi chưa làm được thì fail closed ở unknown; không tuyên bố exactly-once hoặc DB transaction bao trùm Docker. Không tự rollback khi startup lỗi vì bản rollback cũng là artifact/operation cần được duyệt.

Người dùng đã chọn gói authority/freshness, approval lifetime/single-use, local storage, Docker isolation/limits và target/recovery boundary để triển khai; cần kiểm chứng các cơ chế thực tế trước mở runtime gate. Nền raw blob hiện chỉ có index/storage nội bộ, chưa có grant/review/approval hoặc launcher. Acceptance, oracle/one-fixture contract và protocol nghiên cứu giữ trạng thái riêng, chưa được gói v0.1 chốt thay. Giới hạn phải công bố: host/DB/Docker admin có thể bypass, runtime image/harness phải tin cậy; PoC không chống sandbox escape hoặc mã cố ý giả mọi hành vi ngoài bộ thử hữu hạn.

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
