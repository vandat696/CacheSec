# Thiết kế đánh giá

## Trạng thái và nguồn yêu cầu

Ngày 2026-11-02 đổi bối cảnh sang Secure Local Semantic Cache for AI-Assisted Software Development. **Chưa có run hoặc kết quả thực nghiệm mới.** Số liệu 24 truy vấn trên dashboard hiện tại là fixture xem UI, không phải bộ báo giá đóng băng hoặc bằng chứng hiệu quả cache.

Các câu hỏi nghiên cứu: thông tin repository nào có thể reuse đúng ngữ nghĩa/quyền/phiên bản; workflow AI-assisted hoàn thành thay đổi có giữ approval gate và trace không; và khi có xử lý lặp thực tế, cache giảm thời gian/calls/tokens bao nhiêu sau khi tính overhead? Kịch bản hẹp này chỉ kiểm chứng các điều kiện trong bộ thử, không chứng minh cache có lợi cho mọi tác vụ phát triển phần mềm.

[Yêu cầu giảng viên](../general/overview.md#yêu-cầu-trực-tiếp-từ-giảng-viên) gồm một thay đổi rule, một safety property, một repo, một fixture, một gate implementation và một acceptance threshold định trước. Năm chiều đo ở phần chính là yêu cầu trực tiếp. Công thức, protocol, threshold và phép thử cache dưới đây là **đề xuất kỹ thuật cần thống nhất**, không được gắn nhãn giảng viên đã phê duyệt.

## Thí nghiệm chính: Developer-guided / AI-assisted

| Nhánh | Thực hiện cùng một yêu cầu |
| --- | --- |
| A — Developer-guided baseline | Developer tìm hiểu code, thêm rule đánh dấu báo giá thiếu ngày hết hạn hợp lệ, chạy test và xin duyệt theo quy trình thông thường. Công cụ được phép và việc dùng AI trong baseline còn phải chốt trước run |
| B — AI-assisted | Developer dùng AI Coding Agent; CacheSec hỗ trợ truy xuất/reuse thông tin hợp lệ, tạo diff, test và xin duyệt qua cùng control. Trạng thái cache ban đầu phải ghi rõ, không coi warm là mặc định không tốn chi phí |

Khóa cùng repo/trạng thái source gốc, đúng yêu cầu thay đổi, fixture báo giá và oracle, gate implementation/policy, acceptance threshold, môi trường và quy tắc đo. Một implementation gate dùng chung, không viết gate yếu riêng cho baseline hoặc gate mạnh riêng cho Agent. Mỗi lượt khởi đầu từ trạng thái gốc chưa có rule mới, proposal/approval/deployed state được reset có kiểm soát. Lặp cùng thay đổi không phải thêm bài toán nghiệp vụ.

Baseline ở đây là **workflow Developer-guided**, khác với No Cache của phép thử phụ; không suy đóng góp riêng cache từ chênh lệch A/B vì B còn thay đổi công cụ và mức hỗ trợ AI. B phải ghi thực tế có bao nhiêu Hit/Miss/Rejected; có thể không có safe hit.

## Một fixture và định nghĩa rule trước run

Đề xuất một fixture manifest phiên bản, có digest, chứa tập báo giá giả lập có nhãn flag/not-flag và các ca kiểm soát liên kết cho gate, reuse, trace. Đây là cách diễn giải **cần xác nhận** cho “one test fixture”, không tự tạo thêm tập thực nghiệm độc lập. Fixture UI cũ không được dùng làm fixture thực nghiệm mới.

Trước đóng băng cần xác nhận định nghĩa “valid expiration date”: field, kiểu/format, null/rỗng, ngày không tồn tại, đã hết hạn hay chỉ parse được, timezone, ngày bằng mốc và tương quan với ngày phát hành. Dùng thời điểm tham chiếu cố định được ghi trong manifest nếu quy tắc phụ thuộc thời gian. Nhãn do oracle đã duyệt xác định, không lấy output Agent làm ground truth.

Đề xuất ca báo giá: thiếu field, null, rỗng, sai định dạng, ngày không tồn tại, ngày hợp lệ và các ca biên theo nghĩa ngày đã chốt. Expected flag của ca phụ thuộc định nghĩa chưa được tự chốt. App gốc phải pass test hành vi cũ nhưng **chưa đáp ứng** acceptance rule mới; test tái hiện thiếu rule không được tính như failure của workflow đã hoàn thành. Khi đánh giá kết quả patch mới phải chạy đầy đủ fixture bắt buộc và hồi quy.

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

## Acceptance threshold định trước — chưa được duyệt

Đề xuất **một điều kiện tổng hợp**: run đạt khi 100% ca validation bắt buộc và 100% ca approval gate bắt buộc đều pass trên cùng fixture. Thiếu bằng chứng/test hoặc lỗi/timeout không được tính pass. Phải xác nhận giá trị, danh sách ca bắt buộc và version của acceptance rule trước thu thập dữ liệu. Đây không phải similarity threshold của cache.

Năm chiều vẫn được báo đầy đủ; thời gian nhanh không bù được gate bypass, và số liệu cache không được dùng để thay acceptance. Nếu chọn thêm điều kiện về trace, phải sửa và khóa **cùng một** acceptance rule trước run, không thêm threshold hậu nghiệm.

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
