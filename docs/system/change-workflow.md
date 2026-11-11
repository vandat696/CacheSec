# Bản sửa và test kỹ thuật T12

Mốc tích hợp local được người dùng cho phép ngày 2026-11-11: Workspace đọc snapshot → sửa bản riêng → lưu revision/diff → chạy test Docker → xem kết quả đúng revision. Đây là kiểm thử hạ tầng, chưa phải oracle/fixture/acceptance nghiên cứu hoặc artifact đủ điều kiện triển khai. Quy tắc ngày hết hạn trong working tree vẫn là baseline.

## Source và revision

Chỉ sửa `backend/app/quotation_demo/business/quotation_validation.py`; API nhận toàn bộ nội dung UTF-8 tối đa 64 KiB, không nhận đường dẫn, command, image hoặc mount. Request JSON cũng bị giới hạn 64 KiB, nên phần encoding/envelope tính trong giới hạn transport. Hai file model/service phải giữ bytes snapshot và khớp inventory runtime đã đăng ký. Profile đọc ba file, repository identity và source gốc giữ nguyên.

Runtime riêng chứa app báo giá, shared dependencies và lockfile; không chứa control. `TechnicalTestProfile` ghim image ID/platform của runtime, harness và DB, inventory/lock/suite digest, protected overlay và giới hạn. Profile canonical được đăng ký qua administration với expected epoch; startup chỉ đọc, không tự provision. Thay runtime/suite/profile cần đăng ký lại; phiên bản cũ bị chặn reuse, không sửa bytes revision/evidence cũ.

Mỗi lần lưu tạo candidate snapshot, patch manifest và artifact manifest bất biến. Manifest gắn scope, base/candidate manifests, patch và test profile; profile bao gồm cấu hình launcher cố định. CAS `expected_revision` chặn ghi đè revision đã đổi. So sánh hai lượt source hiện tại với base trước lưu và trước dispatch; đây là freshness quan sát trên host tin cậy, không bảo vệ trước host owner có đặc quyền sửa file đúng lúc.

## HTTP đã triển khai

Envelope `data/meta` và lỗi dùng contract `v0.2`, request ID do backend tạo và `Cache-Control: no-store`. Scope lấy từ identity hiện tại, không từ browser. Mọi thao tác giữ authority lock cùng transaction snapshot/blob/workflow đến commit. Các lỗi 401/403/404/409/413/503 không giả thành kết quả test đạt.

| Route dưới `/api/v1/changes` | Input | Quyền ngoài `repository.read` |
| --- | --- | --- |
| GET `/config` | Không có | Không; trả editable path, profile digest, khả năng propose/test |
| POST `/proposals` | `base_snapshot_id`, `content` | `proposal.create` |
| POST `/proposals/{id}/revisions` | `expected_revision`, `content` | `proposal.create` |
| GET `/proposals/{id}` | Proposal ID | Không; trả revision hiện tại, content/diff và tối đa 20 job gần nhất |
| POST `/proposals/{id}/tests` | `revision` | `test.run`; chỉ nhận head revision hiện tại |
| GET `/tests/{job_id}` | Job ID | Không |

POST public cần `Idempotency-Key` ASCII 1–128 ký tự không whitespace. Backend lưu hash key/payload theo scope/actor trong cùng transaction. Retry cùng nội dung trả cùng resource; dùng lại key cho nội dung khác trả 409. Replay vẫn kiểm identity/quyền/profile hiện tại. Client giữ cùng key khi chưa nhận ACK, không tự tạo revision/job khác để thử lại.

Job: `queued → preparing → running → passed/failed/error/timed_out`; cũng có `blocked` khi quyền/source/profile đổi và `unknown` khi worker gián đoạn hoặc cleanup chưa xác minh. Terminal result bất biến, evidence canonical gắn worker/job/proposal/revision/artifact/profile và các check. Token/hash credential, worker ID/ticket nội bộ không trả qua API public. Thời gian là wall time của lượt kỹ thuật, chưa phải engineering time hoặc benchmark.

## Worker và sandbox

Worker host là thành phần tin cậy riêng, dùng Python stdlib và Docker CLI, không import psycopg. Private channel `/_internal/test-worker` có claim/owned/bundle/permit/result, credential riêng và claim ticket; không có admin route hoặc public report-result. Không đưa credential này vào browser/app/harness. Backend xác minh lại principal active, credential version/hash, grants hiện tại, profile, source và artifact tại permit trước thực thi. Permit chỉ cho test.

Mỗi job có network `--internal`, PostgreSQL mới trên tmpfs, app và harness riêng; không publish port. Probe tin cậy kiểm không nối được Internet/control host/DB host trước khi chạy candidate. App có đúng ba bind file read-only, user 10001, read-only rootfs, drop ALL, no-new-privileges, 1 CPU, 512 MiB RAM, 128 pids, tmpfs `/tmp` 64 MiB, cap output 1 MiB/stream và deadline 120 giây. Cleanup ngoài deadline có thể kéo dài thời gian trả kết quả; cleanup chưa xác minh trả unknown và dừng nhận job.

DB test dùng tài khoản riêng chỉ USAGE schema, SELECT/INSERT các bảng báo giá, không owner/superuser/DDL hoặc CONNECT database khác. App chỉ nhận DSN DB test và hai credential fixture giả; không nhận dev DB/control store/home/Docker socket. Harness cố định chạy bên ngoài app, không mount candidate. Năm check: identity, round-trip/precision/missing-null, reader không được ghi, idempotency và contract validation. Check cuối không phán quyết tính hợp lệ ngày. Stdout candidate không phải verdict và không được lưu như nguồn evidence.

Worker giữ file lock trên một root host; đây không phải distributed lock. Sau restart hoặc mất claim ACK, đối soát owned job, dọn đúng resource có cả worker/job labels rồi ghi unknown, không chạy lại candidate. Mất report ACK chỉ gửi lại cùng result/ticket. Cleanup không tự xóa staging/credential test; dữ liệu giả nằm trong private root và cần retention/GC sau này. Không tuyên bố sandbox chống được host/Docker daemon bị kiểm soát hoặc mọi kỹ thuật container escape.

## Chạy local và kiểm chứng

Workspace hiện tự chụp snapshot và mở editor sau khi người dùng nhập token; nút Lưu và kiểm thử thực hiện hai POST tuần tự dưới các quyền hiện có. Save ACK được giữ ngay để lỗi test request không làm mất revision, retry giữ key đúng thao tác. Chỉ lưu và mở nguồn/bản sửa cũ vẫn có, ID/hash nằm trong details. Xem [thiết kế frontend](../frontend/design.md#workspace--bản-sửa-và-test-thật-ngày-2026-11-12) cho cách hiển thị; không thay contract/permission hoặc cấp quyền từ UI.

Xem [setup](../general/setup.md#2f-bản-sửa-và-test-docker-t12) cho môi trường đã provisioning. Tạo profile từ image đã build:

```powershell
cd backend
docker build -f Dockerfile.quotation-test --target runtime -t cachesec-quotation-test:local .
docker build -f Dockerfile.quotation-test --target harness -t cachesec-test-harness:local .
.\.venv\Scripts\python.exe -m app.testing.build_test_profile --runtime cachesec-quotation-test:local --harness cachesec-test-harness:local --database pgvector/pgvector:0.8.7-pg17-trixie --output C:\absolute\private\test-profile.json
```

Lệnh profile ghi exclusive, chưa cấp quyền/đăng ký DB. Administration tin cậy dùng `PostgresTestProfileAdministration.set_profile` và `PostgresAuthorityAdministration.configure_principal` trong một transaction, giữ credential/version hiện tại và epoch CAS. Chỉ cấp read/propose/test như đã duyệt; không gọi lại CLI read-only cho cùng principal vì CLI đó thay tập grants.

Kiểm executor độc lập, chỉ dùng các bản riêng có comment/lỗi có kiểm soát:

```powershell
cd backend
.\.venv\Scripts\python.exe tests/testing/manual_docker_smoke.py C:\absolute\private\test-profile.json C:\absolute\private\test-workspaces
```

Lệnh này chạy pass/fail/timeout/output/isolation, không tạo nhãn nghiên cứu hoặc sửa source gốc. API/DB/worker unit và integration thuộc pytest; browser smoke `--code-changes` kiểm luồng thật trên dev, tạo snapshot/proposal/revision/job kỹ thuật có lưu trace. Xem [trạng thái](../general/project-status.md) cho kết quả đã chạy.

## Giới hạn còn lại

Chưa Agent tạo patch, cache retrieval hoặc approval/deployment gate. Artifact ở đây chỉ là test candidate, không `binding ready` cho triển khai. Chưa đóng băng oracle/fixture/trusted R và acceptance nghiên cứu; T12 toàn bộ theo điều kiện nghiên cứu còn phụ thuộc các mốc đó. T13 cần thực thi approval gắn đúng artifact tại backend/target, không suy quyền từ test pass hoặc cache.
