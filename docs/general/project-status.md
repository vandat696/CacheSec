# Trạng thái CacheSec

Cập nhật 2026-11-18. Đây là bản tổng hợp hiện trạng, thay nhật ký thao tác chi tiết. [Phạm vi](overview.md) và [kế hoạch](implementation-plan.md) quản lý yêu cầu và việc tiếp theo.

## Hiện trạng đã kiểm chứng

| Thành phần | Đã có | Giới hạn |
| --- | --- | --- |
| App báo giá | API/PostgreSQL, UI, rule ngày được human duyệt và chạy thật | Chưa đóng băng fixture/oracle nghiên cứu |
| Workspace | Đọc ba file, editor/diff/revision, Ctrl+S ghi source thật, Docker test | Chỉ sửa quotation_validation.py; draft chưa lưu có thể mất khi reload |
| Agent | Gemini thật; controller ba lượt/mười phút, hai nhánh có proposal/revision/test riêng | Solo registry còn in-memory; comparison có checkpoint bền, không tự resume model |
| Gate runtime | Backend/worker duyệt và activate đúng artifact/evidence | Chưa hoàn thiện operator reconciliation tổng quát, distributed fencing hoặc audit nghiên cứu |
| Persistence | PostgreSQL/blob giữ pair/branch/events/usage/revision/test/assessment và journal source-write/approval/activation | Assessment nghiên cứu chưa khóa; in-flight có thể incomplete/null usage |
| Context Cache | Dexie, Gemini query embedding 768 chiều, exact/semantic, backend verifier/registry, TTL/LRU/invalidation/logout | Full-source profile, online và riêng principal; chưa summary/Answer Cache/offline |
| So sánh hai nhánh | UI/backend None/Local thật, lịch sử PostgreSQL mở lại sau reload/control restart | Cấu hình demo cố định; chưa benchmark hoặc thí nghiệm chính |
| UI cũ | Chat, metrics, setup, documents được giữ để tái sử dụng | Chat/metrics còn dữ liệu mô phỏng; setup chưa chạy benchmark; documents chưa ingest |

Lưu source không tự reload/deploy app. Chạy app cần human duyệt đúng artifact; cache không thay quyền, test hoặc gate. Trạng thái trên dựa trên bằng chứng gần nhất, không phải probe dịch vụ đang chạy ở thời điểm đọc.

## Bằng chứng luồng thật gần nhất

## 2026-11-18 — Mốc ban đầu để đối chiếu và khôi phục mã

- Workspace đưa mã gốc của đề xuất vào editor từ snapshot đã lưu. Ghi file vẫn qua thao tác Lưu và quyền ghi; bản nháp khác revision đã test giữ nút chạy app bị khóa. [Cách kiểm chứng](../system/context-comparison.md#về-mốc-ban-đầu).
- Edge kiểm draft khôi phục khớp baseline đóng riêng và không ghi source. Cùng báo giá giả `d3abb6c9-19b4-4143-a31e-24a20eed1a9e` thiếu ngày: baseline 18002 trả 0 cờ, app đã duyệt 18001 trả một cờ `expiration_review`. Typecheck và lint phần thay đổi đạt. Chưa có rollback runtime một chạm.

## 2026-11-18 — Xem hai bản sửa trên Workspace

- Nút **Xem hai bản sửa** mở hai diff cạnh nhau với file, số dòng gốc/sau, màu thêm/xóa và lựa chọn xem nguyên file hoặc bản sửa cũ. Trạng thái Agent hiện lượt sửa, test và lúc sửa theo phản hồi; chi tiết giữ số liệu, kiểm tra chưa đạt và bằng chứng. [Cách xem](../system/context-comparison.md).
- Edge trên demo 3100 đã mở lại cặp thật, đối chiếu diff và file gốc/sau, kiểm desktop/mobile. Lượt kiểm UI chỉ đọc lịch sử. 122 test frontend, lint/typecheck và 17 test vòng Agent dùng doubles đạt, gồm ca test thất bại rồi sửa theo phản hồi.

## 2026-11-18 — Khôi phục launcher dev khi demo riêng cùng chạy

- Sửa launcher lọc Docker theo artifact active mà control dev đăng ký, tránh nhận nhầm app demo 18001; lỗi runtime có mã riêng, vẫn chặn fallback baseline khi target pending hoặc app đã deploy đang dừng/không xác định duy nhất.
- App/gateway dev cũ đã dừng. Sau đối chiếu activation/approval/evidence, source, receipt, image và cấu hình, khởi động lại đúng deployment đã hoàn tất `1a28b675-f0df-496d-abe0-432837c9544c`; giữ target version 1/artifact `sha256:886461963bb20155cca3c02fbce593f8a4642296c2e99cf16640111c58221b23`. Không tạo approval/activation mới. Proof private: `backend/.local/launcher/approved-runtime-restart-20261118.json`.
- Bảy unit test launcher và Ruff theo cấu hình backend đạt; chạy thật `start-local.ps1 -Studio -NoBrowser` thành công với API 8000/8001, worker, frontend 3000 và Studio 5555. [Setup](setup.md) đã ghi mã lỗi và giới hạn: chưa tự phục hồi runtime đã dừng, chưa có reconciliation tổng quát.

## 2026-11-18 — Cache, hai nhánh và app demo đã được human duyệt

- Người dùng xác nhận cấu hình [Context Cache/comparison](../system/context-comparison.md): browser Dexie, TTL 30 phút/100 entry/LRU; Gemini chỉ embedding prompt, 768 chiều/cosine 0,85/top-3; full-source intent, online registry verification và retention tới khi owner dọn. Không coi là giảng viên đã duyệt protocol.
- Edge trên môi trường riêng đã chạy hai cặp thật: cold `8fa88002-55e3-4f37-86a5-78361573e66d`, warm/paraphrase `7811520c-68bf-4f66-b17e-b42fa0ac1c55`. Bốn nhánh Gemini đều tạo revision 1 và Docker test đạt; Local từ Miss sang semantic Verified Hit. None không lookup/admit/embedding cho cache. Không suy giảm LLM calls/tokens từ Hit.
- UI desktop/mobile và history sau reload/control restart đã kiểm chứng bằng dữ liệu đã commit, không gọi model/test lại. Raw results trong `backend/.local/comparison-demo-20261118/comparison-results.json`; source/diff/artifact/evidence theo digest trong store và PostgreSQL. Những lượt smoke đầu chưa ghi score/cache-write timing thì giữ unknown, không bổ sung số giả vào history.
- Backend đã chặn thử activation không có approval (404, target version 0/pending null). Sau khi người dùng duyệt tường minh đúng Local proposal `7039e7ec-1643-4f96-b86d-cbef54c86525`, revision 1, artifact `sha256:792c2d18628c3457715e0328dfacfb8e8913baeba7a62daeaa2b33ccf1547c07`, worker lưu nguyên bytes và activate thành công trên target demo 18001, version 1. Cùng báo giá thiếu ngày: baseline 18002 có 0 cờ, app đã duyệt có 1 cờ `expiration_review`. Không gọi model hoặc thay bytes của artifact đã duyệt sau approval; dev source/target được giữ. Proof private: `live-approved-result.json`, `human-approval.json`, `activation.json` trong root demo.
- Regression backend: **522 đạt, 2 baseline-only deselected, không skip**. Sau đó **9 comparison integration đạt** gồm hai ca bổ sung checkpoint failure/cache-write telemetry; PostgreSQL thật, model/worker doubles có nhãn. Frontend **121 test đạt**; 19 ca Agent/cache/comparison chạy lại sau các thay đổi cuối đạt. Ruff/ESLint/typecheck và production build đã đạt; live smoke bên trên dùng provider/Docker thật, không trộn với unit doubles.
- Nâng Next.js/eslint-config-next 16.4.3 lên **16.4.5** vì build/dev dừng do [advisory chính thức](https://github.com/vercel/next.js/security/advisories/GHSA-rhh4-g77r-r9qj). Build sau vá đạt. npm audit vẫn báo 15 cảnh báo dependency (6 moderate/9 high), chưa xử lý ngoài bản vá cần cho demo. Cảnh báo TestClient/httpx và Node module detection cũ còn.
- Live fault probe sau triển khai: snapshot source cũ bị chặn 409 `STALE_SNAPSHOT`; tạm revoke quyền đọc trên đúng principal demo bị chặn 403, sau đó CAS-khôi phục (epoch 6), target vẫn version 1/đúng artifact. Không gọi provider. UI Báo giá đã xác nhận cùng record có cờ trên app đã duyệt; helper chỉ đọc/validate, không approve/activate thêm. Proof: `live-stale-revoke-check.json`, ảnh `comparison-approved-app.png`.
- Giới hạn: identity fixture, full-source ba file và một host; chưa distributed execution, retention tự động hoặc acceptance/assessment nghiên cứu. Candidate đã duyệt giữ `validation_config_ref` nhãn baseline cũ và app trả `active_artifact=null`; xác minh runtime bằng control/worker/artifact, không dùng các nhãn app làm chứng thực. D5 đã có luồng thành công; diễn tập reset/fault đầy đủ và D6 vẫn theo điều kiện [kế hoạch](implementation-plan.md).

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

Tiếp tục D5 trong [kế hoạch](implementation-plan.md): diễn tập reset/fault/revoke/expired trên scope demo riêng và hoàn thiện hướng dẫn vận hành. D1–D4 đã có implementation và kiểm chứng kỹ thuật nêu trên; D6 chỉ bắt đầu khi fixture/oracle/acceptance/protocol được xác nhận.

Chưa có kết luận hiệu quả cache từ benchmark hoặc thực nghiệm chính; raw smoke telemetry không thay dữ liệu đánh giá theo protocol. Fixture/oracle/acceptance và baseline/số lặp còn phải xác nhận trước D6; không dùng 463 test kỹ thuật hoặc 21 nhóm harness làm ngưỡng nghiệm thu nghiên cứu.

Ngày 17/11 đã rút gọn tài liệu mục tiêu/kế hoạch/trạng thái/đánh giá và mục lục, bỏ mô tả trùng và hiện trạng lỗi thời. Không đổi code, database, quyền hoặc runtime.
