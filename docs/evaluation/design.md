# Thiết kế đánh giá

## Trạng thái và nguồn yêu cầu

Ngày 2026-11-02 đổi bối cảnh sang Secure Local Semantic Cache for AI-Assisted Software Development. **Chưa có run hoặc kết quả thực nghiệm mới.** Số liệu 24 truy vấn trên dashboard hiện tại là fixture xem UI, không phải bộ báo giá đóng băng hoặc bằng chứng hiệu quả cache.

Các câu hỏi nghiên cứu: thông tin repository nào có thể reuse đúng ngữ nghĩa/quyền/phiên bản; workflow AI-assisted hoàn thành thay đổi có giữ approval gate và trace không; và khi có xử lý lặp thực tế, cache giảm thời gian/calls/tokens bao nhiêu sau khi tính overhead? Kịch bản hẹp này chỉ kiểm chứng các điều kiện trong bộ thử, không chứng minh cache có lợi cho mọi tác vụ phát triển phần mềm.

[Yêu cầu giảng viên](../general/overview.md#yêu-cầu-trực-tiếp-từ-giảng-viên) gồm một thay đổi rule, một safety property, một repo, một fixture, một gate implementation và một acceptance threshold định trước. Năm chiều đo ở phần chính là yêu cầu trực tiếp. Công thức, protocol, threshold và phép thử cache dưới đây là **đề xuất kỹ thuật cần thống nhất**, không được gắn nhãn giảng viên đã phê duyệt.

## Thí nghiệm chính: Developer-guided / AI-assisted

T01 đang thực hiện ngày 2026-11-07 theo [hồ sơ đầu vào](../general/overview.md#hồ-sơ-đầu-vào-t01--đang-thực-hiện). Người dùng chọn Context Cache trong trình duyệt/web Workspace trước; ngày hết hạn theo YYYY-MM-DD, tồn tại theo lịch và không trước mốc fixture cố định 2026-11-07. Identity PoC dùng fixture backend quản lý, gate vẫn thực thi thật. Khung protocol bên dưới dùng để review, chưa phải run manifest hoặc cho phép bắt đầu thực nghiệm:

| Đầu vào protocol | Trạng thái trước khi khóa |
| --- | --- |
| Đơn vị đo | Một lượt thực hiện cùng một thay đổi code từ source gốc tới terminal outcome; query/context lookup là số quan sát thành phần, không phải Developer hoặc workflow độc lập |
| Nhánh chính | Developer-guided / AI-assisted, cùng fixture/gate/acceptance; công cụ baseline, người thực hiện, số lặp và thứ tự chưa chọn |
| Cache trong nhánh AI | Context Cache/browser đã chọn; namespace, trạng thái khởi đầu và preload cần ghi và chốt. LLM vẫn xử lý; calls/tokens có thể không giảm, không gán 0 calls cho Context Hit |
| Fixture/oracle | Người dùng đã xác nhận parse nghiêm ngặt ngày 2026-11-09; bảng oracle T07 bên dưới còn là bản nháp review. Cách diễn giải một manifest gồm báo giá/nhãn và ca control liên kết vẫn cần xác nhận, oracle phải review trước tạo/đóng băng |
| Acceptance | Người dùng chưa chọn, chờ cô quy định ngưỡng/danh sách ca bắt buộc; không lấy đề xuất 100% trước đây làm mặc định |
| Bằng chứng và reset | Ghi phiên bản source/config/fixture/gate, planned/attempted/completed, trace và mọi failure/timeout; cơ chế reset và lịch chạy phải khóa trước T17 |

Đây là protocol nháp theo phạm vi đã có; không tự ấn định cỡ mẫu/seed/ngưỡng hay dùng output Agent làm oracle. Kiểm chứng kỹ thuật T05–T16 không được trộn vào các lượt nghiên cứu đã lên lịch.

| Nhánh | Thực hiện cùng một yêu cầu |
| --- | --- |
| A — Developer-guided baseline | Developer tìm hiểu code, thêm rule đánh dấu báo giá thiếu ngày hết hạn hợp lệ, chạy test và xin duyệt theo quy trình thông thường. Công cụ được phép và việc dùng AI trong baseline còn phải chốt trước run |
| B — AI-assisted | Developer dùng AI Coding Agent; CacheSec hỗ trợ truy xuất/reuse thông tin hợp lệ, tạo diff, test và xin duyệt qua cùng control. Trạng thái cache ban đầu phải ghi rõ, không coi warm là mặc định không tốn chi phí |

Khóa cùng repo/trạng thái source gốc, đúng yêu cầu thay đổi, fixture báo giá và oracle, gate implementation/policy, acceptance threshold, môi trường và quy tắc đo. Một implementation gate dùng chung, không viết gate yếu riêng cho baseline hoặc gate mạnh riêng cho Agent. Mỗi lượt khởi đầu từ trạng thái gốc chưa có rule mới, proposal/approval/deployed state được reset có kiểm soát. Lặp cùng thay đổi không phải thêm bài toán nghiệp vụ.

Baseline ở đây là **workflow Developer-guided**, khác với No Cache của phép thử phụ; không suy đóng góp riêng cache từ chênh lệch A/B vì B còn thay đổi công cụ và mức hỗ trợ AI. B phải ghi thực tế có bao nhiêu Hit/Miss/Rejected; có thể không có safe hit.

## Một fixture và định nghĩa rule trước run

Đề xuất một fixture manifest phiên bản, có digest, chứa tập báo giá giả lập có nhãn flag/not-flag và các ca kiểm soát liên kết cho gate, reuse, trace. Đây là cách diễn giải **cần xác nhận** cho “one test fixture”, không tự tạo thêm tập thực nghiệm độc lập. Fixture UI cũ không được dùng làm fixture thực nghiệm mới.

Người dùng đã chọn ngày có thật, định dạng YYYY-MM-DD và d >= R; **R = 2026-11-07** là mốc fixture cố định, không lấy đồng hồ máy. Ngày bằng mốc là hợp lệ đối với rule mới. Ngày 2026-11-09 người dùng xác nhận giữ validation nền hiện tại và parse ngày nghiêm ngặt: không trim/ép kiểu/nhận timestamp; missing/null/rỗng/sai kiểu hoặc ngày sai/trước R cần cờ. Đây là xác nhận đặc tả từ người dùng, không phải duyệt nhãn oracle hoặc nghiệm thu của giảng viên. Trước đóng băng còn phải review oracle; không tự thêm điều kiện ngày phát hành hay giờ/múi giờ. Nhãn cuối do oracle đã review xác định, không lấy output Agent làm ground truth.

Ma trận kỳ vọng theo lựa chọn người dùng, chưa phải fixture đã tạo hoặc nghiệm thu giảng viên:

| Đầu vào expires_on dự kiến | Kỳ vọng riêng cờ cần xem xét sau khi có rule mới |
| --- | --- |
| Thiếu trường, null hoặc rỗng | Có cờ |
| Sai định dạng đã chốt hoặc ngày không tồn tại, ví dụ 2026-02-30 | Có cờ |
| 2026-11-06 — trước mốc | Có cờ |
| 2026-11-07 — bằng mốc | Không thêm cờ này |
| 2026-11-08 — sau mốc | Không thêm cờ này |

Các cờ validation khác không bị xóa bởi ngày hợp lệ; ma trận này không bổ sung rule vào app gốc hoặc tạo thêm fixture độc lập. Tất cả lượt và hai workflow phải dùng cùng R/fixture version. Các trường hợp năm nhuận, sai kiểu và khoảng trắng được thêm theo contract parse đã chốt trước freeze.

### Bảng oracle T07 để review

Đây là **bản nháp review**, không phải manifest đã tạo, oracle đã được duyệt hoặc fixture đã đóng băng. Các ID dưới đây chỉ để trao đổi và truy vết quyết định; chưa phải danh sách ca bắt buộc hay acceptance threshold. Cột kỳ vọng áp dụng sau khi artifact có rule mới; app gốc vẫn tiếp nhận đầu vào mà chưa kiểm tra ngày. Mọi ca dùng cùng các trường ngoài ngày hợp lệ theo contract nền và R = 2026-11-07.

| ID review | Đầu vào expires_on | Kỳ vọng riêng expiration_review | Căn cứ/trạng thái |
| --- | --- | --- | --- |
| Q01 | Không có key | Có cờ | Thiếu ngày, theo ma trận hiện có |
| Q02 | JSON null | Có cờ | Null, theo ma trận hiện có; khác Q01 trên wire/storage |
| Q03 | `""` | Có cờ | Rỗng, theo ma trận hiện có |
| Q04 | `"2026-11-06"` | Có cờ | Ngày trước R |
| Q05 | `"2026-11-07"` | Không thêm cờ | Ngày bằng R |
| Q06 | `"2026-11-08"` | Không thêm cờ | Ngày sau R |
| Q07 | `"2026-02-30"` | Có cờ | Ngày không tồn tại |
| Q08 | `"2027-02-29"` | Có cờ | Ngày nhuận không tồn tại, sau R để tách lỗi lịch khỏi ngày quá hạn |
| Q09 | `"2028-02-29"` | Không thêm cờ | Ngày nhuận có thật, sau R |
| Q10 | `"2100-02-29"` | Có cờ | Năm tròn thế kỷ không chia hết cho 400; cần review ca biên lịch |
| Q11 | `"2000-02-29"` | Có cờ | Ngày có thật nhưng trước R; không diễn giải thành lỗi ngày nhuận |
| Q12 | `"2026-13-01"` / `"2026-00-01"` / `"2026-11-00"` | Có cờ | Tháng/ngày ngoài lịch; tách thành ca riêng khi khóa manifest |
| Q13 | `"2026-1-7"` / `"20261107"` / `"07/11/2026"` | Có cờ | Parse nghiêm ngặt đã được người dùng xác nhận; nhãn chờ review |
| Q14 | `" 2026-11-07"` / `"2026-11-07 "` / `"2026-11-07\n"` | Có cờ | Không trim đã được xác nhận; nhãn chờ review |
| Q15 | `"2026-11-07T00:00:00Z"` | Có cờ | Không nhận timestamp đã được xác nhận; nhãn chờ review |
| Q16 | `20261107` / `false` / `[]` / `{}` | Có cờ | Không ép kiểu JSON đã được xác nhận; nhãn chờ review, tách ca riêng khi khóa manifest |

Mỗi biến thể được ngăn bởi `/` ở bảng trên là đầu vào riêng, không phải một giá trị chuỗi ghép. JSON false phải giữ kiểu boolean, không đổi thành chuỗi; key vắng mặt không được thay bằng null. Kỳ vọng ghi trực tiếp để người review kiểm tra, không sinh nhãn bằng implementation rule của Agent. Parse nghiêm ngặt đã được xác nhận nhưng bảng nhãn chưa được duyệt; chưa tạo parser/oracle thực thi hoặc manifest đóng băng.

Trước tạo/đóng băng fixture: review từng đầu vào/nhãn; chốt cách một manifest liên kết ca báo giá với ca gate/reuse/trace; sau đó chọn version/digest và ghi source gốc chưa có rule. Acceptance và protocol baseline/số lặp tiếp tục là điều kiện riêng trước thực nghiệm, không suy từ số dòng trong bảng. Phần kiểm thử kỹ thuật HTTP/storage hiện tại chỉ xác nhận khả năng giữ dữ liệu đầu vào và quyền, không trở thành một fixture nghiên cứu khác.

Đề xuất ca báo giá: thiếu field, null, rỗng, sai định dạng, ngày không tồn tại, ngày hợp lệ và các ca biên theo nghĩa ngày đã chốt. Expected flag của ca phụ thuộc định nghĩa chưa được tự chốt. App gốc phải pass test hành vi cũ nhưng **chưa đáp ứng** acceptance rule mới; test tái hiện thiếu rule không được tính như failure của workflow đã hoàn thành. Khi đánh giá kết quả patch mới phải chạy đầy đủ fixture bắt buộc và hồi quy.

Kiểm chứng source nền hiện có dùng marker pytest **baseline_only** cho các ca khẳng định app gốc chưa có rule mới, gồm kết quả validator rỗng và browser smoke nền. Các ca này chỉ kiểm tra trạng thái xuất phát, không là yêu cầu hồi quy sau khi thêm đúng rule. Hồi quy chung chạy với `-m "not baseline_only"` vẫn kiểm quyền, lỗi, giữ dữ liệu và contract; không yêu cầu flags luôn rỗng. Marker này phân loại test kỹ thuật, không tạo fixture nghiên cứu thứ hai hoặc thay acceptance. Runner nghiên cứu sau này phải chạy hồi quy chung cùng fixture/rule suite đã được khóa; chưa có fixture đó thì chưa thể kết luận bản sửa đạt yêu cầu chỉ từ test nền.

Nếu cần hiệu chỉnh similarity threshold, khóa trước phân vùng calibration/evaluation trong cùng manifest, không lấy nhãn evaluation để chọn threshold. Cách phân vùng phải nằm trong protocol được xác nhận, không phá ràng buộc một fixture. Chưa đủ dữ liệu để phân vùng thì công bố giới hạn và không tuyên bố tổng quát hóa.

## Năm chiều đo chính

| Chiều đo | Định nghĩa/phương pháp đề xuất | Nguồn dữ liệu |
| --- | --- | --- |
| Correctness of Flags | Positive = báo giá đáng ra phải được flag theo oracle. TP/FP/FN/TN trên toàn tập đóng băng; precision = TP/(TP+FP), recall = TP/(TP+FN), F1 = 2TP/(2TP+FP+FN); báo cả số flag sai/bỏ sót và case IDs | Kết quả chạy validation thật của artifact, expected labels và fixture digest |
| Preservation of Approval Gate | Đếm pass/total cho block chưa duyệt, reviewer sai quyền, bản khác với đã duyệt; allow đúng artifact đã duyệt. Ghi mọi bypass/false block riêng; tỷ lệ không thay cho bảng ca cụ thể | Yêu cầu trực tiếp tới backend/control, approval/policy snapshot, artifact digest và quyết định deploy |
| Reproducibility | Số run đạt acceptance / **tất cả run đã lên lịch**; run không khởi chạy/lỗi/timeout ghi lý do và không tự loại. Báo thêm completed/attempted/planned, vector flags, test outcomes, hash artifact và bất nhất giữa run độc lập | Run manifest, seeds/config/model revision, source/fixture/gate hashes và outcomes |
| Trace Completeness | Số event bắt buộc có đủ trường + liên kết xác minh được / tổng event bắt buộc **theo đường thực thi mong đợi**; báo thiếu log, thiếu field, broken link/digest, không chỉ đếm dòng | Expected-event schema theo workflow và event records; run thiếu trace vẫn nằm trong mẫu số |
| Engineering Time & Observed Failure Cases | Đo wall-clock từ bắt đầu task tới artifact được deploy hợp lệ hoặc terminal failure/timeout; tách thời gian Developer thao tác, chờ AI/test/approval, sửa lỗi và can thiệp thủ công; không cộng các khoảng chồng lấp | Timestamp đơn điệu cho durations, nhật ký thao tác, executor/Agent/gate events và failure taxonomy |

Mẫu số 0/không đủ nhãn ghi **N/A/unknown**, kèm counts, không gán 100% hoặc 0% giả. Run lỗi validation không có đủ flags không được chấm như tập hoàn chỉnh; báo missing predictions và thất bại run. Reproducibility không yêu cầu code sinh ra byte-identical khi chưa quy định; phân biệt tương đương hành vi với hash giống nhau. Seed không bảo đảm model API deterministic.

Expected trace tối thiểu: request/actor/repo → context sources và cache decision (nếu có) → proposal/diff/base/version → test/fixture/config/artifact evidence → reviewer identity/authority và approval decision → deployed/blocked/failed + artifact. Nhánh block vẫn cần terminal decision, không đòi event deployment thành công; baseline không có cache lookup thì ghi không áp dụng, không sinh log lookup giả.

Failure taxonomy đề xuất: hiểu sai rule, sai vị trí sửa, regression, patch ngoài phạm vi, Agent/tool/model error, test timeout, thiếu trace, verifier reject/error, stale/unauthorized reuse, approval bypass hoặc false block. Lưu case/run IDs và cách phục hồi, không chỉ báo run thành công.

### Trace và ma trận gate local v0.1 — đề xuất kiểm chứng kỹ thuật

Phần này cụ thể hóa [phương án local](../system/authorization.md#phương-án-gate-local-v01-để-chốt), thuộc gói local đã chọn nhưng chưa phải run manifest, fixture thứ hai hoặc kết quả thực nghiệm; gate/harness chưa được triển khai/kiểm chứng. Bốn ca G01–G04 đối chiếu trực tiếp cùng safety property; các ca còn lại kiểm tra failure/race/recovery của cùng implementation. Chỉ chạy kiểm chứng khi implementation và profile liên quan đã đủ điều kiện; chưa dùng bộ test import app trực tiếp làm bằng chứng sandbox cho code do Agent sửa.

Envelope event đề xuất: schema_version/event_id; resource ID và sequence tăng trong resource; request/operation/deployment/attempt/run refs khi có; actor principal/delegation và scope do backend xác định; event_type, phase, outcome/reason_code; binding/artifact/config/fixture/policy/authority refs phù hợp với bước; recorded_at/observed_at và clock origin. Duration dùng monotonic span trong cùng process/host; không suy thời gian thực từ phép trừ timestamp khác máy. Resource refs chưa tồn tại ghi null và reason, không dựng fake run/test/approval để lấp trace.

| Điểm thực thi thật | Event tối thiểu đề xuất | Evidence/link cần kiểm tra |
| --- | --- | --- |
| Snapshot/artifact publish | snapshot.ready, artifact.ready hoặc preparation.failed | Snapshot/manifest/blob refs, source/lock/runtime/config versions; ready chỉ sau publish kiểm tra được |
| Test thực thi | test.started, test.finished hoặc test.failed/timed_out | Artifact/suite/harness/fixture/config refs, observation/exit/outcome, counts và output truncation; expected labels không do Agent ghi |
| Quyết định con người | review.approved / review.request_changes / review.denied | Actor, authority/policy, acknowledged binding hoặc patch digest; decision/approval ref nếu được tạo |
| Nhận activation | deployment.reserved hoặc deployment.denied | Requester, binding/approval, expected target version, reservation/fence; denial có reason trước side effect |
| Cho phép dispatch | deployment.permitted hoặc deployment.blocked | Permit ID/epoch và binding/target refs đúng transaction R3, expiry/grants đã được kiểm tra |
| Launcher thực thi | activation.started, activation.observed hoặc activation.unknown | Operation/container/image/mount/config refs do launcher quan sát, không chỉ app health hoặc self-report |
| Kết thúc/đối soát | deployment.succeeded/failed/unknown và reconciliation.observed/resolved | Target version/actual artifact/status, side effect đã biết/unknown và reason; không bịa succeeded khi mất ACK |

Control state/event cùng transaction khi thuộc cùng DB; event về side effect ghi thời điểm quan sát thật, không gọi DB event là bằng chứng process đã start. Khi DB/audit lỗi trước permit thì block; nếu mất ghi nhận sau side effect phải giữ discrepancy/unknown để đối soát. Trace completeness dùng expected path tương ứng, không đòi success event cho nhánh deny hoặc coi thiếu event do lỗi là đạt. Deny attempt có outcome riêng, không mặc nhiên kết thúc cả workflow đang chờ.

| ID review | Thiết lập/lỗi được tiêm khi có implementation | Kết quả cần quan sát |
| --- | --- | --- |
| G01 | Gọi activation không approval, pending hoặc request_changes | Block trước permit/side effect; reason và attempt event |
| G02 | Thiếu review/deploy capability, app token gọi control, giả role/scope hoặc Agent nhận nhiệm vụ từ Reviewer | Không tạo approval/permit hợp lệ; không lộ nội dung resource ngoài quyền |
| G03 | Duyệt A rồi gửi B, đổi source/revision/bytes/config/evidence hoặc target | Block trước dispatch; cần binding/test/review tương ứng mới, không tự chuyển approval |
| G04 | Đúng immutable artifact/evidence/binding, human approval hiện tại và target version | Chỉ artifact đó được start; observation thực và target/event commit khớp digest |
| G05 | Sửa blob/mount/image sau test hoặc sau duyệt | Phát hiện mismatch; không dùng tên file/tag/label/health để coi hợp lệ |
| G06 | Revoke requester/reviewer/credential/policy đua với dispatch | Commit revoke trước R3 thì block; commit sau permit không hủy hồi tố, báo thứ tự/epoch thật |
| G07 | Approval hết hạn trong queue hoặc sau permit khi đang khởi động | Trước R3 block; sau R3 báo theo observation của operation đã được phép, không giả rollback |
| G08 | Hai activation khác key cùng expected target version; cùng key được retry song song | Tối đa một reservation; key cũ trả cùng operation, request khác busy/conflict, không double dispatch |
| G09 | Pre-commit failure tại review/reservation; ACK commit mất tại R1/R3 | Lỗi trước commit không phát side effect; ACK không rõ phải tra lại cùng ID/key/permit, không tự cho rằng DB chưa ghi |
| G10 | Mất ACK Docker sau start hoặc crash sau start trước target/event commit | Target reconciling/unknown; đối soát container/image/config/operation rồi mới kết luận, không start thêm |
| G11 | Restart launcher/control khi operation pending, worker cũ còn có thể chạy lệnh | Không giải phóng target theo timeout/lease; xác minh single-writer/quiescence hoặc tiếp tục unknown |
| G12 | Stop cũ thành công nhưng start mới lỗi; target khác actual source hoặc không có process | Báo failed/unavailable hoặc unknown theo bằng chứng; không tự rollback hoặc viết Deployed từ health cũ |
| G13 | Artifact/test container đọc control store, Docker socket, reviewer token hoặc DB admin; chạy ra ngoài scope/network | Bị chặn theo profile đã chọn; ghi thử nghiệm cụ thể và giới hạn, chưa kiểm chứng thì chưa công bố isolation |
| G14 | App giả active_artifact/test_passed, stdout/JUnit hoặc self-report trái launcher | Không đủ để approve/succeed; trusted harness/launcher và binding mới là nguồn đối chiếu |

Mỗi ca phải lưu fault point, planned/attempted/completed, before/after target observation, permit/event refs và cleanup thuộc test resources; không reset app DB hoặc volume phát triển. Test dữ liệu quyền/target giả chỉ là unit/integration cases, không tạo thêm repo/fixture nghiên cứu. Khi đưa các ca vào nghiên cứu, liên kết ID với **một fixture manifest đã được review**; chưa tự chọn mẫu số/acceptance hoặc dùng 14 dòng này làm threshold.

Log/payload dùng allowlist fields, không token/secret DSN, raw command, home path hoặc toàn bộ source/dữ liệu báo giá. Event deny trước authenticate không có actor đã xác minh; ghi request ID và reason đã rút gọn, không gán actor từ header client. Evidence output được giới hạn/lọc trước lưu; phần bị cắt/thiếu phải có coverage, không loại failure/timeout khỏi báo cáo.

## Acceptance threshold định trước — chờ cô quy định

Người dùng chọn **chờ cô quy định**, chưa chọn ngưỡng nghiệm thu. Phương án 100% validation/gate trước đây không được dùng làm cấu hình mặc định hoặc ground truth về acceptance. Phải xác nhận giá trị/đơn vị, danh sách ca bắt buộc, mẫu số, cách xử lý thiếu bằng chứng/lỗi/timeout và version của một acceptance rule trước thu thập dữ liệu. Đây không phải similarity threshold của cache.

Thiếu bằng chứng/test hoặc lỗi/timeout không được giả thành pass; chưa có rule đã khóa thì không kết luận run đạt acceptance. Năm chiều vẫn được báo đầy đủ; thời gian nhanh không bù được gate bypass, và số liệu cache không được dùng để thay acceptance. Nếu thêm điều kiện về trace, phải xác nhận và khóa **cùng một** acceptance rule trước run, không thêm threshold hậu nghiệm.

## Phép thử phụ đề xuất: đóng góp riêng của cache

So sánh **B0 — AI Agent No Cache** và **B1 — cùng AI Agent + Secure Local Semantic Cache** trên chính nhiệm vụ/fixture/gate đó. Đây chưa phải yêu cầu giảng viên đã xác nhận. Giữ model/revision, prompt/tool policy, retrieval/index/snapshot, quyền, môi trường, query order và acceptance rule; chỉ thay cache. Không thay đồng thời RBAC/ABAC, embedding, eviction rồi gán toàn bộ khác biệt cho cache.

Chạy cold từ cache rỗng; warm dùng preload hợp lệ được ghi ID/nguồn/quyền/config và tính chi phí chuẩn bị riêng. Dùng câu hỏi thật trong workflow; nếu thêm scripted paraphrase probes để kiểm tra cơ chế, gắn nhãn **probe kiểm chứng**, tách khỏi kết luận engineering time của workflow tự nhiên. Không tạo hit giả, lặp nhân tạo rồi trình bày như hành vi doanh nghiệp. Sau reset source/namespace, chỉ entry còn đúng provenance mới đủ điều kiện warm.

Có thể đối chiếu thành phần tra cứu bằng query script cố định và đối chiếu end-to-end qua run độc lập, nhưng không trộn hai đơn vị đo. Report cả số lookup và số workflow run; không coi nhiều query của một run là nhiều Developer độc lập.

## Chỉ số cache bổ sung và nguồn đo

Quy ước [cache flow](../system/cache.md): terminal Hit/Miss/Rejected, Error/Timeout riêng; candidate decisions có trace riêng. Một terminal Hit phải có verifier pass **và oracle reuse độc lập** xác nhận tương đương/nguồn/quyền tại thời điểm dùng để được tính safe cho đánh giá.

| Chỉ số | Công thức/phạm vi đề xuất | Nguồn |
| --- | --- | --- |
| Safe Cache Hit Rate | Safe reuse lookups / tất cả lookup được thử trong nhánh cache; mẫu số gồm Error/Timeout, không gồm No Cache. Hit thiếu oracle là unverified, không tính safe | Lookup events + verifier evidence + nhãn reuse oracle |
| Hit/Miss/Rejected | Số terminal lookup từng loại; thêm Error/Timeout và candidate rejection reason counts riêng để tổng không giấu lỗi | Lookup/candidate events liên kết request |
| Context Retrieval Latency | ms từ bắt đầu context request tới context được phép sẵn sàng; gồm lookup/embedding/verification/network hoặc fallback retrieval; báo theo outcome và cold/warm | Đồng hồ đơn điệu phía điều phối; client end-to-end ghi riêng |
| LLM Calls Saved | Tổng calls B0 − tổng calls B1 trên workload/cặp điều kiện tương đương; có thể âm, gồm calls fallback/verification nếu dùng model | Adapter call/usage events; liệt kê missing usage và error calls |
| Tokens Saved | Tổng input+output tokens B0 − B1, tách input/output; cache không loại calls tạo patch thì không coi chúng là saved | Usage provider; không biết ghi unknown, embedding tokens và provider prompt cache báo riêng |
| Cache Verification Overhead | Duration ms verifier thực tế, gồm quyền/provenance/integrity và mạng theo ranh giới instrument đã công bố; báo P50/P95 và mẫu số | Verifier spans; không cộng double-count span chồng lấp |
| Stale Cache Reuse | Số reuse thực tế có nguồn/TTL/policy/config lỗi thời theo oracle / số lookup có stale candidate theo fixture; thêm total reuse và candidate counts | Time/source/policy snapshots, candidate và consumption events |
| Unauthorized Cache Reuse | Số reuse thực tế chứa bất kỳ nguồn ngoài quyền hiện tại / số lookup đáng ra phải chặn reuse theo oracle; thêm false denial riêng | Identity/policy snapshots và source provenance, không suy ALLOW từ UI |

Một hit verifier pass nhưng oracle fail phải ghi unsafe/semantic false hit hoặc unauthorized/stale reuse đúng nguyên nhân, không được báo Safe Hit. Lookup reject an toàn không tính như vi phạm; fallback retrieval cũng phải kiểm quyền. Không có stale/unauthorized opportunity thì rate N/A, không suy “zero disclosure” tuyệt đối. Cache reuse metrics không thay correctness của flags hoặc gate metrics.

Không gọi model thật thì calls/tokens có thể zero theo instrumentation; demo hiện tại zero chỉ vì không gọi AI, không chứng minh tiết kiệm. Nếu usage provider không đầy đủ, tiết kiệm tokens là unknown/partial với coverage, không tự suy từ ký tự. Cost chỉ estimate có bảng giá/version/giả định, không gán observed cost khi chưa đo.

Latency chỉ có giá trị hoàn tất context khi context thực sự sẵn sàng; lỗi/timeout báo riêng với thời gian đã quan sát và coverage, không điền 0 hoặc âm thầm bỏ khỏi báo cáo. Warm preload phải báo cả chi phí tạo cache và số lần reuse để tránh che overhead ban đầu.

## Protocol, trace và báo cáo từng run

Khóa manifest trước run: source/base và gate revision, fixture/acceptance hash, actor/tenant/quyền/policy, Agent/model/embedding/prompt/tool config, namespace/TTL/eviction, seed, môi trường/phần cứng, query order, concurrency, cold/warm/preload và timeout. Lưu run/task/query/proposal/test/approval/artifact/deployment IDs, timestamps, outcome/reason, spans và usage thực tế.

Đề xuất chạy tuần tự/counterbalance thứ tự A/B và B0/B1, số lặp được thống nhất trước; giảm learning effect của Developer bằng protocol và công bố phần không kiểm soát được. Không âm thầm bỏ lỗi/timeout hoặc “chạy lại đến khi đẹp”. Warm cache state không được rò từ một nhánh sang nhánh khác ngoài preload được phép; approval của run trước không được cấp phép artifact mới.

Xuất JSON/CSV loại secrets/code ngoài quyền, vẫn giữ provenance/digests đủ truy vết. Ghi preparation/index/preload effort riêng với quy tắc áp dụng như nhau; engineering time và model latency có đơn vị khác nhau. P50/P95/cỡ mẫu và biến động chỉ có ý nghĩa với số quan sát được công bố; không suy tổng quát từ một nhiệm vụ nhỏ. Demo hai nhánh chạy song song hiện có không phải benchmark kiểm soát.

## UI cấu hình cũ và giới hạn kế thừa

Trang [Thiết lập](../frontend/design.md#thiết-lập-thí-nghiệm) đã có bản nháp chọn nhiều mode, embedding, threshold, FIFO/LRU/LFU và RBAC/ABAC/kết hợp; fine-tuning cục bộ/FL mô phỏng chỉ là ý định. Số lượt từ ma trận cấu hình là dự kiến, chưa có runner, huấn luyện, log hoặc kết quả. Ma trận không tự chứng minh các cặp đo tương đương; mỗi phép so sánh vẫn phải giữ cố định các yếu tố ngoài biến nghiên cứu. Cần chốt model/revision, namespace vector, bộ nhãn quyền tương ứng từng policy và tách train/chọn ngưỡng/đánh giá trước khi thực thi. Xuất cấu hình JSON không phải xuất số liệu thực nghiệm.

Đoạn trên mô tả khả năng UI cũ được giữ lại, không phải protocol mới được chốt. Với PoC mới ưu tiên một cấu hình cố định, một gate và một fixture; chưa mở sweep model/eviction/policy/training. So sánh vị trí local/server và exact/semantic vẫn là hướng mở rộng, tách vị trí lưu khỏi sharing scope. Local không miễn phí; zero vi phạm trong fixture chỉ là kết quả hữu hạn.

Các quyết định chưa chốt được quản lý ở [tổng quan](../general/overview.md#giả-định-và-câu-hỏi-mở); công việc triển khai/kiểm chứng ở [kế hoạch](../general/implementation-plan.md).
