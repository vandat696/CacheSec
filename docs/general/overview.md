# Mục tiêu và phạm vi CacheSec

Cập nhật 2026-11-18. Hiện trạng chạy thật ở [project-status](project-status.md); công việc tiếp theo ở [kế hoạch](implementation-plan.md).

## Mục tiêu

Nghiên cứu **Secure Local Semantic Cache for AI-Assisted Software Development**: tái sử dụng context repository khi đúng ngữ nghĩa, đúng quyền và còn khớp nguồn. Coding Agent là ứng dụng kiểm chứng; đóng góp chính là cache và cơ chế xác minh reuse.

Demo dùng source, model, cache, test và runtime thật với dữ liệu báo giá mẫu. Đúng một thay đổi nghiệp vụ: thêm cờ `expiration_review` cho báo giá thiếu ngày hết hạn hợp lệ để con người xem xét. Reviewer duyệt code/artifact, không duyệt báo giá.

## Yêu cầu trực tiếp từ giảng viên

| Nội dung | Phạm vi |
| --- | --- |
| So sánh chính | Developer-guided / AI-assisted |
| Ràng buộc | Một repository, một fixture cố định, một approval-control implementation, một acceptance rule định trước |
| Safety property | Chỉ triển khai thay đổi validation sau khi người có quyền duyệt tường minh chính xác thay đổi đó |
| Năm chiều đánh giá | Correctness, approval gate, reproducibility, trace completeness, engineering time/failures |

Nguồn: yêu cầu người dùng cung cấp ngày 2026-11-02. Acceptance threshold và protocol cụ thể chưa được giảng viên xác nhận.

## Demo cuối đã thống nhất

Một prompt chung chạy **Không cache / Có Context Cache** song song trên Workspace. Hai nhánh dùng cùng source snapshot, model, prompt, quyền và test profile; tạo candidate/revision/test riêng. Hai bản sửa có thể giống nhau.

Người dùng xem diff, test, tokens, thời gian, kết quả cache và đánh giá của từng nhánh; chọn một bản để lưu source và duyệt chạy app. Hai nhánh không cùng ghi đè file repo hoặc tự triển khai. Cache Hit vẫn có thể cần gọi model và gửi cùng số tokens.

Cache đầu tiên lưu trong browser, hỗ trợ exact/semantic lookup và backend verification trước reuse. Demo phải cho thấy cả reuse hợp lệ lẫn từ chối context stale, bị sửa hoặc mất quyền. Cold/warm và chi phí chuẩn bị cache phải rõ ràng.

### Lịch sử và database

Lưu bền trong PostgreSQL theo **cặp so sánh → nhánh → turn/revision → test/đánh giá**:

- Prompt, source snapshot, model/config, trạng thái cold/warm/preload.
- Candidate source/diff và liên kết artifact/test/evidence có digest.
- Tokens input/output/total, generation/embedding calls, timing từng bước và end-to-end.
- Cache outcome/score/reason, lỗi/timeout/cancel và các tiêu chí đánh giá.

Bytes source/artifact có thể ở kho blob bền hiện có; database lưu metadata/kết quả và liên kết. Browser Context Cache vẫn local. Revision và assessment mới giữ nguyên lịch sử cũ; reload/restart mở lại kết quả đã commit mà không gọi model hoặc chạy test lại. Quyền đọc vẫn được kiểm tra; retention còn cần thiết kế. Số liệu thiếu ghi null/unknown kèm lý do, không tự coi là pass. Công thức và nguồn đo ở [thiết kế đánh giá](../evaluation/design.md).

## Các quyết định đã chốt

| Chủ đề | Quyết định |
| --- | --- |
| App mẫu | Sáu trường: id, supplier_name, description, total_amount, currency, expires_on; giữ contract validation nền hiện có |
| Rule ngày | Chuỗi đúng YYYY-MM-DD, ngày tồn tại, d >= R; fixture dùng R = 2026-11-07 |
| Parse | Không trim/ép kiểu/nhận timestamp; missing/null/rỗng/sai kiểu/sai định dạng/ngày sai hoặc trước R có cờ |
| Identity PoC | Fixture do backend quản lý, công bố giới hạn; quyền/gate thực thi thật |
| Human approval | Developer có quyền Reviewer được tự duyệt tường minh đúng artifact; Agent không được approve/deploy |
| Storage/control | PostgreSQL metadata, blob local theo digest; Docker test/runtime và backend gate hiện có |
| Tích hợp | Web Workspace trước; app báo giá, Agent/IDE và lõi cache độc lập trong cùng repo |
| UI | Nối backend đến đâu dùng được đến đó; ít chữ, chi tiết mở khi cần |

App local đã có rule được duyệt; source baseline dùng để tái hiện nhiệm vụ phải chưa có rule, được chuẩn bị riêng. Chi tiết schema/API ở [api.md](../system/api.md), gate ở [authorization.md](../system/authorization.md), runtime ở [workspace-runtime.md](../system/workspace-runtime.md).

## Giả định và câu hỏi mở

| Trước khi làm | Cần chốt |
| --- | --- |
| Mở rộng cache | Summary/selected chunks và calibration nghiên cứu; cấu hình full-source demo đã xác nhận ở [contract](../system/context-comparison.md) |
| Verification mở rộng | Offline/sharing ngoài principal và distributed execution; PoC online/full-source đã có registry/integrity/scope/epoch/source verification |
| Lịch sử bền | Schema 006–007 và retention tới khi owner dọn đã xác nhận; endpoint xóa/retention tự động và assessment nghiên cứu còn mở |
| Đóng băng fixture | Review từng nhãn oracle; cách một manifest liên kết ca báo giá/gate/reuse/trace; calibration/evaluation |
| Thực nghiệm | Acceptance do cô quy định; baseline tools/người thực hiện, số lặp/thứ tự, reset/preload và cách tính lỗi/timeout |

Các lựa chọn chưa chốt giữ trạng thái đề xuất và chặn phần phụ thuộc. Acceptance nghiên cứu khác similarity threshold; không mặc định acceptance 100%.

## Ngoài phạm vi demo đầu

Agent sửa toàn repo, extension IDE bên ngoài, Answer Cache, server payload cache, nhiều model/policy/eviction và fine-tune/FL để sau. Giữ code UI cũ để tái sử dụng. Contract cache có phiên bản và độc lập host; chưa công bố tương thích IDE/Agent chưa được kiểm chứng.

Cấu hình cache/retention ngày 18/11 do người dùng xác nhận; xem [contract thực thi](../system/context-comparison.md). Không coi là giảng viên đã duyệt protocol.
