# Kế hoạch hoàn thiện demo CacheSec

Cập nhật 2026-11-18. [Mục tiêu và yêu cầu](overview.md) là phạm vi chuẩn; [trạng thái](project-status.md) ghi phần đã kiểm chứng. Kế hoạch này thay danh sách T01–T17 cũ; mã T trong tài liệu kỹ thuật chỉ còn là tham chiếu các gói lịch sử.

## Điểm xuất phát

Đã có Gemini đọc source, tạo revision, Docker test, Workspace lưu file thật và human approval/activation đúng artifact. Đã có implementation cache, hai nhánh và checkpoint/history kỹ thuật theo [contract](../system/context-comparison.md). Bằng chứng D1–D5 ở [project-status](project-status.md); D6 vẫn chờ khóa điều kiện nghiên cứu.

## Thứ tự thực hiện

| Gói | Công việc cốt lõi | Điều kiện hoàn thành |
| --- | --- | --- |
| D1 — Khóa thiết kế | Rà đường context của assistance/Agent; chốt cache verification, embedding/storage/lifecycle và schema lịch sử; soạn oracle/ca demo để review | Contract và quyết định đủ cho phần triển khai tương ứng; câu hỏi nghiên cứu còn chờ được ghi riêng |
| D2 — Context và verifier | Tách context preparation khỏi generation; authorized retrieval, bundle/provenance, admit/verify; ghi trace tại điểm thực thi | Backend chặn tamper, sai scope/quyền, stale/expired/config mismatch; authority lỗi không cấp context |
| D3 — Browser semantic cache | Storage local, embedding adapter thật, exact/semantic lookup, namespace, TTL/capacity/eviction/invalidation | Browser cold Miss → admit → verified Hit; paraphrase có semantic candidate thật; khác intent không reuse |
| D4 — Hai nhánh và lịch sử | Một prompt chạy None/Local, candidate/test riêng; PostgreSQL lưu kết quả/metrics/assessment; UI đối chiếu theo revision và export | Reload/restart giữ kết quả đã commit; lịch sử không gọi model lại; hai nhánh không ghi đè repo hoặc dùng approval của nhau |
| D5 — Demo chạy lại được | Môi trường demo riêng, reset, diễn tập thành công và bị chặn, export evidence, hướng dẫn ngắn | Tái hiện toàn luồng cache → Agent → test → human gate → app thật và mở lại từng phiên bản |
| D6 — Đánh giá | Khóa fixture/oracle/acceptance/protocol rồi chạy so sánh chính; phép thử riêng cache theo protocol được thống nhất | Dữ liệu/báo cáo có nguồn, mẫu số, lỗi và giới hạn; chấm theo tiêu chí đã khóa |

D2 phụ thuộc các quyết định kỹ thuật D1; D3 dùng contract D2; D4 dùng D2–D3; D5 dùng D4. Thiết kế persistence của D4 thực hiện từ D1 để instrumentation không bị bổ sung muộn.

Ước lượng **10–17 ngày công tới D5**, thêm **2–4 ngày chuẩn bị/phân tích D6** và thời gian chạy theo số lặp được chọn. Chưa tính chờ quyết định/provider hoặc sửa sau review; không cam kết lịch hoàn thành.

## Ràng buộc khi triển khai

- Cả assistance và Agent loop đi qua cùng context resolution; backend kiểm quyền mọi dependency, source/intent/config và toàn vẹn trước reuse. Browser chỉ đề xuất candidate.
- Miss/Rejected fallback bằng retrieval có quyền. Verifier/authority lỗi trả lỗi/deny; không dùng context local để né kiểm tra. Source đổi giữa verify và dùng phải phát hiện.
- None không lookup/admit vào namespace Local. Cold/warm/preload ghi trước chạy; không để một nhánh làm ấm nhánh kia ngoài thiết lập.
- Database lưu cặp/nhánh/turn/model call/revision/test/metrics/assessment, liên kết blob/evidence hiện có. Assessment gắn artifact và phiên bản tiêu chí; đánh giá lại thêm record.
- Lưu cả failed/cancelled/timed_out/incomplete; retry không nhân bản thao tác. Restart không tự resume hoặc biến trạng thái thiếu bằng chứng thành pass.
- Hai bản sửa giữ riêng. Khi chọn ghi source phải kiểm freshness; app chỉ chạy đúng artifact đã test và được human duyệt. Cache không cấp quyền, bỏ test hoặc thay approval.
- Chốt schema/contract và policy tại tài liệu sở hữu trước phần phụ thuộc; không scaffold mọi API hay biến thể mở rộng.

## Kịch bản nghiệm thu demo

| Bước | Thao tác | Bằng chứng cần xem |
| --- | --- | --- |
| 1 | Mở baseline riêng chưa có rule, cache rỗng | Source/config digest, HTTP trước thay đổi, Miss và retrieval/admission thật |
| 2 | Chuẩn bị warm hợp lệ, nhập prompt chung chạy hai nhánh | Cùng snapshot/model/config; diff/test/usage/timing riêng; cache outcome và lý do |
| 3 | Hỏi paraphrase; thử stale source, tamper, expired, revoke và authority lỗi riêng từng ca | Semantic candidate thật; verifier chấp nhận/từ chối đúng ca; context bị chặn không vào model |
| 4 | Chọn bản sửa đã test; thử chạy khi chưa duyệt, rồi human duyệt đúng artifact | Block trước approval; activation đúng artifact và báo giá đổi hành vi |
| 5 | Mở lịch sử sau reload/restart; tạo cặp mới từ baseline | Source/diff/test/metrics/assessment cũ còn nguyên; cặp mới không dùng lại approval hoặc state ngoài thiết lập |

Fault/revoke/reset chỉ tác động tài nguyên test/demo có scope, giữ app dev đang chạy. Source đổi có thể làm cache cũ hết hiệu lực; sau reset không hứa warm Hit nếu provenance không còn khớp. Hai bản sửa có thể giống nhau; demo không đòi cache phải nhanh hơn.

## Kiểm chứng và kết thúc mỗi gói

Chạy test phù hợp thay đổi: authority/integrity/source race, PostgreSQL persistence/retry/restart, browser storage và integration; lint/typecheck/build khi ảnh hưởng frontend. Smoke generation/embedding dùng provider thật trong phạm vi đã được phép; test double có nhãn riêng.

Chỉ sửa docs thì kiểm nội dung, link và diff. Cập nhật [trạng thái](project-status.md) bằng đầu ra/kiểm chứng/giới hạn ngắn; không chép nhật ký từng thao tác. D5 hoàn thành demo kỹ thuật; D6 chỉ bắt đầu khi [điều kiện đánh giá](../evaluation/design.md) đủ.
