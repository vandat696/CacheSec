# Trạng thái CacheSec

Cập nhật 2026-11-17. Đây là bản tổng hợp hiện trạng, thay nhật ký thao tác chi tiết. [Phạm vi](overview.md) và [kế hoạch](implementation-plan.md) quản lý yêu cầu và việc tiếp theo.

## Hiện trạng đã kiểm chứng

| Thành phần | Đã có | Giới hạn |
| --- | --- | --- |
| App báo giá | API/PostgreSQL, UI, rule ngày được human duyệt và chạy thật | Chưa đóng băng fixture/oracle nghiên cứu |
| Workspace | Đọc ba file, editor/diff/revision, Ctrl+S ghi source thật, Docker test | Chỉ sửa quotation_validation.py; draft chưa lưu có thể mất khi reload |
| Agent | Gemini thật; tạo bản sửa và vòng sửa/test giới hạn ba lượt/mười phút | Agent tạo revision riêng; mở và Lưu mới ghi vào project; run registry còn in-memory |
| Gate runtime | Backend/worker duyệt và activate đúng artifact/evidence | Chưa hoàn thiện operator reconciliation tổng quát, distributed fencing hoặc audit nghiên cứu |
| Persistence | PostgreSQL/blob giữ snapshot, revision/test và journal source-write/approval/activation đã commit | Chưa có lịch sử cặp so sánh/metrics/assessment đầy đủ |
| Context Cache | Đã chọn browser Context Cache | Chưa storage/embedding/matching/verifier/admission/invalidation |
| So sánh hai nhánh | Yêu cầu một prompt, None/Local, revision/test và lịch sử riêng đã xác nhận | Chưa triển khai |
| UI cũ | Chat, metrics, setup, documents được giữ để tái sử dụng | Chat/metrics còn dữ liệu mô phỏng; setup chưa chạy benchmark; documents chưa ingest |

Lưu source không tự reload/deploy app. Chạy app cần human duyệt đúng artifact; cache không thay quyền, test hoặc gate. Trạng thái trên dựa trên bằng chứng gần nhất, không phải probe dịch vụ đang chạy ở thời điểm đọc.

## Bằng chứng luồng thật gần nhất

## 2026-11-16 — Bản Gemini đã được human duyệt và chạy trên app local

- Người dùng phê duyệt tường minh **đúng revision 4** của proposal `6b91b377-ee89-4b5b-b049-dc12366cff98` và artifact `sha256:886461963bb20155cca3c02fbce593f8a4642296c2e99cf16640111c58221b23`. Gate backend đã lưu approval, worker chạy đúng artifact đã test; không gọi model thêm và không đổi code validation sau phê duyệt.
- Activation đầu `aacf452f-5d0c-48d3-a3c8-025569c556f4` gặp TARGET_MISMATCH vì image bootstrap cũ khác image test. Giữ unknown/reservation; không retry mù. Owner dừng đúng worker, giữ singleton lock, xác minh app/gateway mới vẫn created/never-started, baseline khỏe với StartedAt trước operation và permit đã hết hạn. Đối soát scoped/CAS dưới authority lock ghi blocked/OPERATOR_CONFIRMED_NO_DISPATCH, lưu proof/journal rồi giải phóng reservation; chỉ dọn hai container chưa từng chạy. Đây là can thiệp owner hẹp, chưa có operator reconciliation tổng quát/endpoint mới.
- Sửa worker đối chiếu bootstrap digest riêng (`baseline_image`) trong target config, kiểm baseline trước permit và ghi receipt trước kiểm lại/stop/start. Owner đăng ký config đúng, giữ epoch 13/profile/artifact/grants; approval cũ đã consumed không tái dùng. Approval mới `b8added9-aba0-4fc6-92f4-427339a3ea83` gắn config đã sửa; activation `1a28b675-f0df-496d-abe0-432837c9544c` **succeeded**. Target hiện **version 1**, active_artifact đúng digest trên, pending null; app/gateway chạy, baseline đã dừng. Không coi lần lỗi trước là pass.
- HTTP thật trên cùng báo giá thiếu ngày: trước có 0 cờ, sau có 1 cờ expiration_review. Hai báo giá giả bổ sung có nhãn được giữ để demo: `2026-11-08` có 0 cờ; `2026-W46-1` có 1 cờ. Backend R=2026-11-07; control/Docker xác minh artifact, response app vẫn active_artifact=null theo contract hiện tại. Báo cáo private: backend/.local/workspace-rule-live-validation-20261116.json và backend/.local/workspace-rule-activation-bootstrap-fixed-20261116.json.
- **463 test backend đạt, 2 baseline-only deselected, không skip**, PostgreSQL test riêng; thêm sáu ca image mismatch/preflight/receipt với Docker double có nhãn. Ruff lint/format đạt, syntax/ESLint helper đạt. Edge đọc target/artifact thật, kiểm diff/evidence rồi Hủy gate, xác nhận ba báo giá qua UI và mobile; không model/approval/activation thêm. Launcher chạy lại giữ đúng app active, không mở baseline đè lên; DB/network test tạm đã dọn. Cảnh báo TestClient/httpx và Node module detection có sẵn còn; không chạy lại toàn frontend suite/build vì chỉ đổi script kiểm chứng.
- Luồng **Gemini → source thật → Docker test → human approval → app thật đổi hành vi** đã được kiểm chứng kỹ thuật. Chưa Context Cache, semantic verification, so sánh Cache/No Cache hoặc thực nghiệm chính; fixture/oracle/acceptance/protocol nghiên cứu vẫn cần khóa. Không đánh dấu hoàn thành toàn T14 hoặc công bố kết quả cache.

## Các mốc nền

| Ngày | Kết quả đã ghi nhận |
| --- | --- |
| 07–09/11 | PostgreSQL/schema/API báo giá, quyền fixture, idempotency; registry/blob/snapshot control có kiểm quyền |
| 11–12/11 | Workspace đọc source thật, revision/diff và Docker test; launcher/phiên local nối Workspace với Báo giá |
| 14/11 | Agent Gemini và vòng sửa/test có giới hạn; UI điều chỉnh pane/sidebar |
| 15/11 | Source write thật, journal migration 005 và human gate runtime local; kiểm chứng trên môi trường riêng |
| 16/11 | Gemini tạo rule, sửa theo feedback, test artifact cuối và human activation app local thành công |
| 17/11 | Chốt yêu cầu demo hai nhánh, lịch sử PostgreSQL theo revision và tokens/timing/đánh giá; mới cập nhật tài liệu |

Các thay đổi UI nhỏ và lỗi tooling đã xử lý không còn là đầu việc hiện hành. Cảnh báo TestClient/httpx và Node module detection được ghi nhận trong lượt kiểm chứng gần nhất.

## Việc tiếp theo

Bắt đầu **D1** trong [kế hoạch](implementation-plan.md): rà context flow, chuẩn bị quyết định cache/embedding/verification và schema lịch sử. Sau đó D2–D5 triển khai cache, hai nhánh, persistence và demo tái hiện được.

Chưa có số liệu hiệu quả cache hoặc thực nghiệm chính. Fixture/oracle/acceptance và baseline/số lặp còn phải xác nhận trước D6; không dùng 463 test kỹ thuật hoặc 21 nhóm harness làm ngưỡng nghiệm thu nghiên cứu.

Ngày 17/11 đã rút gọn tài liệu mục tiêu/kế hoạch/trạng thái/đánh giá và mục lục, bỏ mô tả trùng và hiện trạng lỗi thời. Không đổi code, database, quyền hoặc runtime.
