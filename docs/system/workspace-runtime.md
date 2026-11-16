# Workspace ghi file và chạy ứng dụng local

Triển khai ngày 2026-11-15 theo yêu cầu Workspace làm việc với project thật. Phạm vi ghi vẫn là `backend/app/quotation_demo/business/quotation_validation.py`; hai file model/service trong source profile chỉ đọc. Không có terminal hay API nhận command/path/image tùy ý. Frontend cũ được giữ nguyên.

## Lưu source

Khi principal có `repository.write`, Ctrl+S lưu revision bất biến rồi yêu cầu worker ghi đúng nội dung vào file host. Chạy test cũng lưu phần đang sửa vào source trước khi queue đúng revision, tránh test stale sau các lần sửa/lưu liên tiếp. Nếu chỉ có `proposal.create`, nút ghi rõ **Lưu revision** và không ghi working tree. Agent tạo revision/test như trước; mở bản sửa rồi Lưu mới đưa candidate vào project.

Request ghi gắn proposal/revision/artifact và `expected_snapshot_id` mà editor đã quan sát. Backend kiểm identity/scope/profile, revision hiện tại, mọi file phụ thuộc và source freshness. Worker nhận bundle từ control, không nhận đường dẫn client; chỉ thay file validation tại root do owner cấu hình. Worker kiểm alias/symlink/hard link/case, hai lượt đọc và toàn bộ ba file; file đã đổi ngoài editor bị conflict. Ghi temporary file cùng thư mục, fsync, đối chiếu lại rồi atomic replace; đọc lại đúng bytes trước báo thành công. Undo trong editor rồi Ctrl+S là một revision/source write mới, không xóa lịch sử.

Control mount thư mục business **read-only** để quan sát file mới sau atomic replace; HTTP chỉ đọc đúng ba file của profile. Worker host mới có khả năng ghi file. Không mount working tree vào app đang chạy; lưu source không tự triển khai rule hoặc reload app. Browser cập nhật context snapshot cho Agent sau khi source write được xác nhận, giữ editor và undo.

## Test hành vi

`TechnicalTestProfile.validation_task` mặc định `regression`, giữ metadata/digest của recipe cũ. Recipe `expiration-review-v1` bổ sung 16 nhóm check hành vi vào năm check HTTP/quyền/storage, ghim suite/image và R=2026-11-07. Nhóm strict format hiện thử bốn chuỗi `2026-1-7`, `20261107`, `2026-W46-1`, `2028-W09-2`: tổng 19 đầu vào ngày, vẫn 21 nhóm kết quả. Bổ sung đầu vào đổi digest suite/image/profile; evidence cũ không được coi là đã chạy harness mới.

Harness bên ngoài candidate tạo dữ liệu giả qua HTTP và so flags với nhãn tường minh; stdout candidate không cấp verdict. App nhận ngày tham chiếu qua cấu hình backend, truyền vào validator bằng keyword `reference_date`. Source working tree đã nhận rule Gemini qua Ctrl+S ngày 2026-11-16, sau đó human phê duyệt chính xác revision 4/artifact và app local đã kích hoạt target v1. Image baseline giữ nguyên; không rebuild baseline từ source đã sửa rồi bỏ qua gate.

Các check nằm trong `app/testing/expiration_checks.py`. Đây là kiểm chứng kỹ thuật local từ nghĩa ngày đã chọn, không phải fixture/oracle nghiên cứu đã freeze, acceptance của giảng viên hoặc một kết quả benchmark. Cần hoàn thành review/one-fixture contract và protocol trước nghiên cứu. Không chỉnh nhãn bằng output model.

## Phê duyệt và chạy thật

`Chạy ứng dụng` yêu cầu revision hiện tại có evidence passed đúng artifact/profile/job, source không stale và quyền backend tương ứng. Hộp thoại hiển thị diff và artifact; chỉ click **Phê duyệt và chạy bản này** mới tạo approval rồi yêu cầu activation. Agent không có tool/credential review hoặc activate. Source write và test pass không cấp quyền triển khai.

Approval gắn reviewer/credential, proposal/revision/artifact/profile, job/evidence và target configuration digest. TTL 30 phút theo giờ DB; chỉ dùng cho một activation ID. Backend kiểm toàn vẹn evidence thật, không tin verdict từ client. Target có version CAS và reservation bền vững; mọi thao tác cùng scope lấy authority lock. Tại dispatch permit backend kiểm lại quyền requester/reviewer hiện tại, credential, approval expiry/single use, binding và source. Revoke commit trước permit chặn dispatch. Permit không được phát nếu transaction lỗi.

Một worker host giữ file lock hiện có cho cả test/source write/activation. Worker chuẩn bị bản source riêng, kiểm immutable image/inventory/staging và cấu hình mount/sandbox trước permit; sau permit mới stop process cũ và start candidate. Candidate non-root, read-only, drop ALL, no-new-privileges, 1 CPU/512 MiB/128 pids; không có key/model/control credential/Docker socket. DB role `cachesec_workspace_app` chỉ có USAGE schema báo giá và SELECT/INSERT, không owner/superuser/DDL.

Target configuration ghim thêm `baseline_image` theo digest, độc lập với runtime image trong test profile. Khi profile test được nâng nhưng app vẫn chạy bootstrap cũ, worker đối chiếu baseline với image owner đã đăng ký, không suy từ image candidate hoặc nhận mutable tag. CLI owner lấy digest từ bootstrap-runtime-image.txt hiện có (lần đầu lấy profile trước), giữ nó trong worker config và config digest; đổi binding yêu cầu approval mới. Worker kiểm baseline trước permit, kiểm lại sau permit và lưu receipt trước bước đối chiếu/stop/start. CLI vẫn từ chối thay cấu hình target đang active/pending.

Candidate chỉ ở network `internal`. Trên Docker Desktop, published port trực tiếp của network này không truy cập được từ host trong lượt kiểm chứng. Một ingress Python stdlib tin cậy, không source/DB credentials, nối bridge và network nội bộ, publish loopback 8001. Nó chỉ relay GET/POST và OPTIONS preflight của API báo giá tới container ID cố định; không nhận upstream URL/CONNECT, không redirect và giới hạn body/response/timeouts. Source script ingress được hash trong target configuration; worker xác minh cả container app và ingress. Chỉ ingress có đường mạng ngoài; candidate không được cấp outbound route.

Đổi target thành công tăng version và lưu actual artifact/container sau quan sát Docker/mount bytes và HTTP thật. Launcher không mở lại baseline nếu target đã có activation hoặc đang pending/unknown. Nó xác minh app hiện hành, không lấy HTTP health đơn lẻ làm bằng chứng artifact.

## Persistence và lỗi

Migration control 005 thêm `repository.write` vào tập capability hợp lệ và bảng scoped `workspace_operations`, không seed quyền/target/approval. Bảng giữ write/approval/activation/target document; service sở hữu schema/state và kiểm liên kết revision/evidence, scope FK và unique index chặn hai activation chưa giải quyết. Event trạng thái cùng transaction với control metadata. Đây chưa phải event envelope/audit nghiên cứu đầy đủ.

Queue/claim/permit/result được lưu PostgreSQL. Retry cùng actor/key/payload trả cùng operation; payload khác conflict. Worker không ghi đè/chạy lại khi mất ACK. Receipt private ghi trước side effect; recovery chỉ đối soát bytes/container đã có, không tự start lại. Kết quả chưa xác minh được giữ `unknown`; activation giữ reservation để chặn deployment mới. Thiếu operator reconciliation đầy đủ có thể cần can thiệp owner; không tự giải phóng theo timeout hoặc tự rollback. Candidate/ingress được tạo nhưng chưa chạy khi dispatch bị chặn có thể còn để kiểm tra/GC sau.

Giới hạn: một worker/root/target trên host tin cậy, không chống host owner/Docker daemon bị kiểm soát hoặc race của process có đặc quyền; không distributed fencing. Không có atomic transaction giữa DB và filesystem/Docker; journal/unknown phản ánh giới hạn đó. Source/profile đổi có thể chặn đọc lại revision/evidence cũ qua API hiện hành. Run Agent vẫn ở bộ nhớ process; revision/test/operation đã commit bền vững.

Đây là runtime phát triển local và gate thực thi thật trên recipe kỹ thuật đã đăng ký; không đánh dấu hoàn thành toàn T07/T12/T13–T17 hoặc artifact-ready nghiên cứu. Context Cache, embedding, semantic verification và so sánh cache vẫn chưa triển khai. [Setup](../general/setup.md#workspace-ghi-file-và-chạy-bản-đã-duyệt) sở hữu cách chạy; [API](api.md#workspace-source-và-local-runtime) sở hữu HTTP contract.
