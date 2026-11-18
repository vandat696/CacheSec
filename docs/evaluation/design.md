# Thiết kế đánh giá

Cập nhật 2026-11-17. Chưa có kết quả thực nghiệm CacheSec. Test kỹ thuật, dashboard mẫu và demo hai nhánh không tự trở thành benchmark. [Overview](../general/overview.md) sở hữu yêu cầu; tài liệu này sở hữu oracle, nguồn đo và protocol.

## Hai phép so sánh

| Mục đích | Nhánh | Điều kiện |
| --- | --- | --- |
| Nghiên cứu chính theo giảng viên | Developer-guided / AI-assisted | Cùng repo gốc, một thay đổi rule, fixture/oracle, gate và acceptance |
| Demo đã được người dùng chọn | AI Không cache / Có Context Cache, một prompt chạy song song | Cùng immutable snapshot/model/config/quyền/test profile; candidate/test riêng |
| Đo đóng góp riêng cache | Cùng AI, None / Local cold / Local warm | Protocol cần thống nhất; chỉ thay cache, kiểm soát thứ tự/tài nguyên và preload |

Timing song song chịu queue, test serialization và provider limits; không đủ để kết luận cache tăng tốc. Nhánh None không làm ấm Local. Hai diff giống hoặc khác đều được chấm bằng oracle. Context Hit không mặc nhiên giảm model calls/tokens.

## Fixture và oracle

Đề xuất một manifest có version/digest liên kết báo giá có nhãn với ca gate/reuse/trace; cách diễn giải này và từng nhãn còn phải review trước đóng băng. Dùng R = 2026-11-07 và rule parse đã chốt ở [overview](../general/overview.md#các-quyết-định-đã-chốt); không dùng output Agent làm oracle.

### Bảng oracle T07 để review

Giữ các ID để truy vết; đây là nhãn dự kiến sau khi thêm rule, chưa phải fixture đã duyệt. Mỗi biến thể phân cách bằng / là ca riêng; giữ nguyên missing/null và kiểu JSON.


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


Cần bổ sung ca ISO week date `"2026-W46-1"` → có cờ, theo lỗi harness đã phát hiện ngày 16/11. Các validation nền giữ nguyên; ngày hợp lệ không xóa cờ khác.

Baseline nghiên cứu phải chưa có rule mới. Test marker `baseline_only` chỉ kiểm trạng thái xuất phát; hồi quy sau thay đổi dùng `-m "not baseline_only"` cùng fixture/rule suite đã khóa. Harness kỹ thuật hiện có không thay acceptance nghiên cứu. Nếu cần calibration threshold, khóa phân vùng calibration/evaluation trong cùng manifest; không chọn threshold bằng nhãn evaluation.

## Năm chiều đo chính


| Chiều đo | Định nghĩa/phương pháp đề xuất | Nguồn dữ liệu |
| --- | --- | --- |
| Correctness of Flags | Positive = báo giá đáng ra phải được flag theo oracle. TP/FP/FN/TN trên toàn tập đóng băng; precision = TP/(TP+FP), recall = TP/(TP+FN), F1 = 2TP/(2TP+FP+FN); báo cả số flag sai/bỏ sót và case IDs | Kết quả chạy validation thật của artifact, expected labels và fixture digest |
| Preservation of Approval Gate | Đếm pass/total cho block chưa duyệt, reviewer sai quyền, bản khác với đã duyệt; allow đúng artifact đã duyệt. Ghi mọi bypass/false block riêng; tỷ lệ không thay cho bảng ca cụ thể | Yêu cầu trực tiếp tới backend/control, approval/policy snapshot, artifact digest và quyết định deploy |
| Reproducibility | Số run đạt acceptance / **tất cả run đã lên lịch**; run không khởi chạy/lỗi/timeout ghi lý do và không tự loại. Báo thêm completed/attempted/planned, vector flags, test outcomes, hash artifact và bất nhất giữa run độc lập | Run manifest, seeds/config/model revision, source/fixture/gate hashes và outcomes |
| Trace Completeness | Số event bắt buộc có đủ trường + liên kết xác minh được / tổng event bắt buộc **theo đường thực thi mong đợi**; báo thiếu log, thiếu field, broken link/digest, không chỉ đếm dòng | Expected-event schema theo workflow và event records; run thiếu trace vẫn nằm trong mẫu số |
| Engineering Time & Observed Failure Cases | Đo wall-clock từ bắt đầu task tới artifact được deploy hợp lệ hoặc terminal failure/timeout; tách thời gian Developer thao tác, chờ AI/test/approval, sửa lỗi và can thiệp thủ công; không cộng các khoảng chồng lấp | Timestamp đơn điệu cho durations, nhật ký thao tác, executor/Agent/gate events và failure taxonomy |


Mẫu số 0 hoặc thiếu nhãn ghi N/A/unknown và counts. Run validation thiếu predictions không được chấm như tập hoàn chỉnh. Tái lập hành vi không đồng nghĩa code byte-identical; seed không bảo đảm API model deterministic.

## Gate và trace

Trace tối thiểu: request/actor/repo → context/provenance/cache decision nếu áp dụng → proposal/revision/diff → test/fixture/config/artifact → human decision/authority → activation hoặc terminal blocked/failed/unknown. Mỗi event có ID/resource sequence, request/run/attempt refs, actor/scope đã xác minh, outcome/reason, digest/config refs và thời điểm/clock origin. Không tạo resource/event giả để lấp trace.

State/event cùng DB commit trong cùng transaction khi phù hợp. Side effect runtime phải có observation; thiếu ACK giữ unknown để đối soát. Quyền/gate và recovery chi tiết ở [authorization](../system/authorization.md) và [workspace-runtime](../system/workspace-runtime.md).

### Ma trận gate cần đối chiếu

Các ca sau là checklist kỹ thuật, không phải fixture nghiên cứu đã duyệt hoặc toàn bộ đều đã kiểm chứng. Hiện trạng bằng chứng ở [project-status](../general/project-status.md).


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


Mỗi ca lưu fault point, before/after observation, outcome và evidence refs. Chỉ tác động tài nguyên test có scope. Test double có nhãn riêng; không dùng health/app self-report hoặc candidate stdout làm bằng chứng độc lập artifact đã test/deploy.

## Chỉ số cache và nguồn đo

Hit/Miss/Rejected là terminal lookup outcomes, Error/Timeout riêng; candidate outcomes ghi riêng. Safe reuse cho đánh giá cần cả verifier pass và oracle độc lập, không chỉ UI hoặc verifier tự báo.


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


Không có opportunity stale/unauthorized thì tỷ lệ N/A; reject an toàn không tính vi phạm. Báo unsafe false hit và false denial riêng. Zero vi phạm trong tập hữu hạn không chứng minh bảo đảm tuyệt đối.

## Lưu kết quả theo phiên bản

PostgreSQL lưu cặp/nhánh/turn/revision/model call/test/metrics/assessment và liên kết source/artifact/evidence bền. Mỗi measurement có đơn vị, nguồn event/span/provider và missing reason. Mỗi assessment gắn revision/artifact, criterion/formula version, fixture/oracle/acceptance refs khi áp dụng, evaluator và thời điểm. Đánh giá lại thêm record, giữ kết luận cũ.

Lưu cả failure/cancel/timeout/incomplete. Generation/embedding usage tách riêng; tokens thiếu ghi null, không suy từ ký tự. Cost nếu có là estimate kèm bảng giá/version trừ khi có dữ liệu phí thực. Duration dùng monotonic span cùng clock origin; end-to-end cặp song song không bằng tổng hai nhánh. Context-ready latency tính lookup/embedding/verify/network/fallback; báo lỗi và overhead, không điền 0 cho thiếu dữ liệu.

## Protocol và acceptance trước run

Trước nghiên cứu phải khóa:

- Source baseline, fixture/oracle digest, gate/config version và một acceptance rule.
- Actor/quyền/policy, model/embedding/prompt/tool config, môi trường, namespace/TTL/eviction.
- Baseline tools/người thực hiện, số lặp/thứ tự, concurrency, timeout, reset và cold/warm/preload.
- Expected trace, nguồn đo, mẫu số và cách xử lý missing/error/timeout.

**Acceptance chờ cô quy định**, không mặc định 100% và không thay bằng similarity threshold. Chưa đủ đầu vào thì assessment pending/unknown; chưa kết luận đạt nghiệm thu. Không đổi tiêu chí sau khi xem kết quả.

Ghi planned/attempted/completed; không bỏ lượt lỗi hoặc chạy lại đến khi đẹp. Tách nỗ lực chuẩn bị/preload, thao tác người và chờ model/test/approval; không cộng span chồng lấp. Scripted paraphrase là probe kiểm chứng, không đại diện tần suất lặp tự nhiên.

Export JSON/CSV có provenance và linked IDs, loại credentials/source ngoài quyền. Báo cỡ mẫu, coverage, P50/P95 khi đủ quan sát và giới hạn của một nhiệm vụ. Không gán chênh lệch Developer-guided/AI-assisted riêng cho cache; báo đúng cả trường hợp cache không có lợi.

## Nguồn kỹ thuật từ comparison Workspace (2026-11-18)

[Contract thực thi](../system/context-comparison.md#lịch-sử-và-số-đo) xác định nguồn/span tokens, generation/embedding/preparation/resolution/server workflow và lookup client-reported. Migration 007 giữ revision/assessment gắn artifact/evidence; tiêu chí nghiên cứu chưa khóa ghi null với lý do. Cold/warm live smoke là kiểm chứng tích hợp, chưa benchmark hoặc thí nghiệm chính.
