# Tổ chức source và quy ước đặt tên

Áp dụng từ refactor 2026-11-07. [AGENTS.md](../../AGENTS.md) chứa luật; tài liệu này là bản đồ source hiện tại. Tổ chức theo feature/domain và trách nhiệm, không áp một cây OOP cố định cho cả React và Python.

## Tooling local

Launcher local ở `scripts/start-local.ps1`, helper cấu hình private ở `scripts/local_configuration.py`, unit test tại `scripts/tests/`. Đây là tooling phát triển, không phải dependency của backend hoặc runner nghiên cứu. `infra/quotation.compose.yaml` chỉ chạy runtime baseline đã đăng ký với DB local; không mount candidate hoặc source working tree.

## Frontend

File component React dùng PascalCase khớp component chính (ChartFrame.tsx, AppShell.tsx); module nhóm component dùng tên nhóm PascalCase. File hook/helper/model/data TypeScript dùng camelCase (useField.ts, chartFormat.ts, chatState.ts), thư mục feature dùng kebab-case. Giữ tên entry/framework như index.ts, page.tsx và layout.tsx. TypeScript kiểm tra casing import nhất quán; tên JS DOM, bundle JS/CSS và Python giữ quy ước riêng, không đổi theo tên component React.

```text
frontend/src/
  app/                         route, metadata, composition provider
  components/
    layout/                    khung ứng dụng
    ui/
      forms/                   TextInput.tsx, NumberInput.tsx, Select.tsx...
      charts/                  LineChart.tsx, ChartFrame.tsx, chartFormat.ts...
      navigation/              Tabs.tsx, Dropdown.tsx
      feedback/                Badge.tsx, Alert.tsx, Dialog.tsx, ToastProvider.tsx
      data/                    DataTable.tsx, StatCard.tsx, ProgressBar.tsx
      diagrams/                FlowDiagram.tsx
      Button.tsx               component đơn lẻ đã có tên rõ
      CopyButton.tsx
      Icon.tsx
  features/
    developer/                 lắp ghép Workspace, workflow IDE mô phỏng
    agent/                     panel/client assistance, dùng proposal/test hiện có
    repositories/              HTTP snapshot/file, phiên đọc và UI Repository thật
    workbench/                 layout giữ hai màn và UUID điều hướng, không lưu source/token
    local-workspace/           phiên local private, proxy allowlist và bootstrap browser
    quotations/                form/danh sách/chi tiết nối API, hook phiên và HTTP adapter
    experiment-config/         profile, comparison, experiment-plan, setup-plan
    ui-library/
      catalog/                 definition + snippet theo từng template
      previews/                tương tác demo theo từng template
      TemplatePreview.tsx      dispatch đến preview tương ứng
      UiLibrary.tsx            bố cục và bộ lọc catalog
```

experiment-config thay tên workspace cũ vì module đó giữ cấu hình thí nghiệm, không phải IDE. ExperimentConfigProvider/useExperimentConfig giữ state phiên; model thuần tách theo profile/comparison/plan/setup. Import .ts giữa các model cho phép Node test runner dùng cùng source; tsconfig cho phép extension này với noEmit.

`local-workspace/localSessionStore.ts` sở hữu capability/session file private và credential digest; `localWorkspaceServer.ts` kiểm request browser, exchange/logout và proxy allowlist tới backend cố định. `localWorkspaceRuntime.ts` có server-only boundary và lắp ghép path host, `localWorkspaceClient.ts` chỉ biết bootstrap/session cùng origin. Route `/api/local-control` mỏng, không chứa auth implementation. `scripts/open-workspace.mjs` là helper host dùng chung store để mở browser, gọi qua npm workspace hoặc launcher PowerShell; token backend không import vào client. Test bảo mật nằm ở `frontend/scripts/local-workspace.test.mjs`, browser smoke `--local-workspace` kiểm trên dev thật.

Một file chứa component chính, props/helper cục bộ liên quan; helper dùng chung có file rõ tên trong cùng nhóm (Field/useField, ChartFrame/CartesianPlot/DonutPlot). Import trực tiếp module, ví dụ `@/components/ui/forms/Select`. Registry catalog chỉ lắp ghép definitions/previews, không chứa implementation. React giữ function component/hooks và composition; CSS app giữ selector/token hiện có.

Trong quotations: quotationModel.ts sở hữu wire types/draft và bảo toàn missing/null/raw; quotationApi.ts là adapter HTTP kiểm response/lỗi, nhận fetch qua constructor. useQuotations.ts quản lý request/abort/phiên trong bộ nhớ; QuotationConnection/Form/List/Details mỗi file một component, QuotationWorkspace chỉ lắp ghép. Form giữ body/key cho retry khi kết quả chưa rõ; không nhét token/nghiệp vụ vào AppShell hoặc route.

## Backend

`app/agent_assistance` tách generation contract/validation kết quả (`generation.py`), adapter Gemini (`gemini_generation.py`) và OpenAI Responses (`openai_generation.py`), prompt/schema dùng chung (`assistance_prompt.py`), HTTP/key loading giới hạn (`generation_transport.py`), use case có quyền/nguồn (`assistance_service.py`) và HTTP (`assistance_http.py`). Control entrypoint chỉ lắp ghép. Adapter nhận cấu hình private, không import quotation domain/cache hoặc tự ghi/chạy source. Test hành vi/HTTP/adapter nằm ở `tests/control/test_agent_assistance.py` và `test_gemini_generation.py`, dùng provider double có nhãn; không biến unit/integration thành kết quả model thật. `infra/agent.compose.yaml` chỉ mount cấu hình provider vào control.

Runtime dev control có backend/Dockerfile.control và backend/.dockerignore; infra/control.compose.yaml chỉ lắp ghép image, private config/store và ba source file read-only với PostgreSQL hiện có. Không đưa bootstrap/provisioning vào control_api hoặc chạy app báo giá trong process control. [Setup Docker dev](../general/setup.md#2e-control-dev-trong-docker-khi-python-windows-bị-chặn) sở hữu cách chạy và giới hạn. Browser smoke opt-in --repository-dev ở frontend/scripts/repository-dev-browser-check.mjs đọc riêng token dev local, tạo snapshot thật và đối chiếu UI với source host; --repository-only vẫn dành cho test server/database tạm.

Công cụ xem DB local ở frontend/prisma.config.ts và script npm db:studio để dùng lại npm workspace hiện có. Đây là dev tooling, không import vào React/backend; nó chọn QUOTATION_DATABASE_URL của app, còn SQL migrations bên dưới tiếp tục do Python sở hữu. Cách chạy và ranh giới quyền ở [setup](../general/setup.md#xem-database-bằng-prisma-studio).

```text
backend/app/
  control/
    control_api.py                             lắp ghép health/readiness và HTTP repository
    api/repository_routes.py                    HTTP describe/capture/get/file; schema response
    api/repository_http_app.py                  ánh xạ lỗi HTTP snapshot
    api/repository_request_middleware.py        body rỗng/cap, request ID/no-store, lỗi 500
    repository_configuration.py                tải JSON binding host tin cậy, không ghi authority
    configure_repository.py                     CLI host cấp read-only với expected_epoch
    control_settings.py                        cấu hình control
    health_routes.py                           các endpoint health/readiness
    control_storage.py                         lắp ghép blob service, filesystem và PostgreSQL
    control_snapshots.py                       lắp ghép snapshot với binding/root tường minh
    migrate_control.py                         CLI migration control
    database/control_migrations.py              schema/history/lock control riêng
    database/migrations/001_artifact_blobs.sql   index bytes thô, không artifact-ready/approval
    database/migrations/002_control_authority.sql registry repository/authority/principal/grants
    database/migrations/003_repository_snapshots.sql active source profile, snapshot và file refs
  shared/postgres_connection.py                PostgresDatabase, vòng đời connection
  shared/postgres_migrations.py                mechanics migration dùng chung, không sở hữu schema
  repositories/
    source_profiles.py                        exact-file path policy, caps và canonical profile
    snapshot_models.py                        snapshot/file refs và manifest content
    snapshot_bundles.py                       canonical profile và complete snapshot bytes
    filesystem_snapshot_workspace.py          prepare/verify source staging, không chạy code
    filesystem_repository_source.py           đọc giới hạn, kiểm path/alias, hai lượt capture
    repository_snapshots.py                    ports/use case capture/get/read_file có quyền
    postgres_repository_snapshots.py           snapshot/index/authority chung connection
    postgres_source_profiles.py                active profile digest/epoch CAS cho backend tin cậy
  identity/
    control_authority.py                       types/ports, authenticate/require, repository read service
    postgres_control_authority.py              authority repository và transaction adapter
    postgres_authority_administration.py       cấu hình tin cậy, epoch CAS và scope lock
  artifacts/
    blob_models.py                             digest/ref, cap và lỗi storage
    blob_storage_service.py                    publish/register/read và các port do service dùng
    filesystem_blob_store.py                   staging/publish no-overwrite, kiểm bytes/file path
    postgres_blob_metadata.py                  index repository và transaction adapter
    metadata_encoding.py                       cachesec-json-v1, không schema validator/attestation
  quotation_demo/
    quotation_api.py                           nối config, quyền, DB, HTTP/CORS (--factory)
    quotation_settings.py                      cấu hình QUOTATION_ riêng
    migrate_quotations.py                       lệnh chạy migration báo giá
    api/
      quotation_http_app.py                    cấu hình FastAPI và ánh xạ lỗi HTTP
      quotation_routes.py                      endpoint tạo/danh sách/chi tiết/validate
      quotation_responses.py                   model response/envelope HTTP
      quotation_request_middleware.py          cap body và request ID
      quotation_service_factory.py             tạo service gắn identity đã xác minh
    business/
      quotation_models.py                      QuotationCreate/Record/Page
      quotation_service.py                     thao tác nghiệp vụ, quyền và transaction
      quotation_validation.py                  điểm vào validator nền, flags và kết quả/rules
      quotation_permissions.py                 capability, caller, interface kiểm quyền
      quotation_repository_interface.py        interface lưu trữ/transaction, lỗi và retry
    auth/fixture_identity.py                   kiểm token/quyền fixture hiện tại
    database/
      postgres_quotation_repository.py          các truy vấn SQL báo giá
      postgres_quotation_transactions.py        commit/rollback và lỗi persistence
      quotation_migrations.py                  đọc/chạy SQL, history/checksum/lock
      migrations/001_create_quotations.sql       SQL đã version hóa
      migrations/002_creation_requests.sql      metadata idempotency
```

Luồng đọc code: quotation_routes nhận request → quotation_service kiểm quyền và điều phối → postgres_quotation_repository truy vấn SQL trong postgres_quotation_transactions → PostgreSQL. quotation_api chỉ nối các thành phần; quotation_http_app giữ cấu hình/response lỗi thuộc HTTP, tách khỏi nghiệp vụ. Hai phần tạo/cấp service cũ đã gom vào quotation_service_factory, gồm interface nhỏ và implementation fixture cùng trách nhiệm.

Với validate, service yêu cầu cả read và validate trước đọc record rồi gọi function thuần validate_quotation trong business/quotation_validation.py. Đây là điểm sửa code cho nhiệm vụ sau này; baseline công bố evaluated_rules rỗng, không parse ngày hoặc sinh cờ. Kết quả có quotation_id, profile nền và metadata runtime null, không cấp approval hoặc chứng minh đã test artifact. Không tạo rule registry/plug-in/interface validator khi chỉ có một implementation. UI thuộc QuotationValidationPanel.tsx, HTTP decoder ở quotationApi.ts và state/hủy request ở useQuotations.ts.

business không nhập api/database/auth/control, FastAPI hoặc Psycopg. Nó sở hữu các Protocol nhỏ cho quyền và lưu trữ/transaction. QuotationService nhận dependencies qua constructor, kiểm quyền trước mở transaction và chỉ trả thành công sau commit; adapter chuyển lỗi driver sang lỗi nghiệp vụ lưu trữ, không che lỗi lập trình. Repository nhận connection, không tự cấp quyền hoặc commit. Factory app không import control/Agent/cache. tests/control, tests/shared và tests/quotation_demo đi theo module sở hữu.

Đây là cách áp dụng OOP/SOLID theo trách nhiệm thực tế: capability port nhỏ, thay authority/storage qua composition, không kế thừa base class chung. Test double và PostgreSQL cùng được kiểm tra commit/rollback/retry; fake không được giả thành công khi contract yêu cầu lỗi. Không tạo interface cho từng function hoặc tầng service/controller rỗng.

OOP dùng cho đối tượng có trạng thái/phụ thuộc; logic thuần giữ function. Điểm khởi động đặt theo ứng dụng, không bắt buộc main.py. Từ refactor ngày 2026-11-09: control chạy uvicorn app.control.control_api:app, báo giá chạy uvicorn app.quotation_demo.quotation_api:create_app --factory, migration chạy python -m app.quotation_demo.migrate_quotations. Các path import/CLI cũ được thay bằng tên mới, không giữ module alias làm khó phân biệt. HTTP route, env QUOTATION_, schema và định danh/bytes/checksum SQL giữ nguyên; schema mới dùng migration forward.

Blob storage không import HTTP, model báo giá, cache hoặc research; các adapter cùng thực hiện contract bytes/metadata và giữ lỗi thật. Wrapper quotation_migrations giữ các import Migration/MigrationError và load/apply_migrations hiện có, dùng shared mechanics cho đúng hai owner đã có; không thêm generic base repository hoặc layer trống. Migration control chạy python -m app.control.migrate_control; 002_control_authority.sql thêm registry quyền/repository, không seed principal/grants. tests/artifacts kiểm bytes/service/encoder; tests/identity kiểm quyền qua adapter thay thế; tests/control kiểm wiring/migration/DB thật, scope/rotation/epoch/lock. tests/conftest.py cấp DB ngẫu nhiên qua helper dùng chung, mỗi feature giữ fixture tên/scope riêng; không dọn DB từ URL nguồn.

Registry domain không import FastAPI/Psycopg; RepositoryAccessService nhận transaction port rồi xác thực/kiểm repository.read trước trả metadata đã commit. Authorizer có thể dùng ngay authority repository của transaction control hiện tại, không tự mở connection tách biệt. Administration là adapter backend tin cậy, caller chịu trách nhiệm commit/rollback; không phải Agent tool hoặc route public. Registry metadata vẫn tách khỏi đọc source; snapshot use case do repositories sở hữu, control/api làm transport. describe_current lấy scope từ principal; snapshot service kiểm lại quyền trong transaction của thao tác. Frontend features/repositories dùng HTTP, không nhận source/token từ workflow mô phỏng.

RepositorySnapshotService nhận source, bytes store và SnapshotTransactions. Session chứa authority/blob index/snapshot ports cùng connection; không gọi ArtifactBlobStorage mở transaction riêng trong capture. PostgresSourceProfileAdministration đổi active profile cùng lock/epoch authority; worker chỉ đọc policy, không tự provision từ config. tests/repositories kiểm path/capture và adapter thay thế; tests/control/test_repository_snapshots_integration.py kiểm DB/commit/constraint/profile freshness. Không có shell/Git/test executor trong adapter đọc source.

read_bundle tái sử dụng transaction ports hiện có và giữ authority lock cho mọi payload đến commit. snapshot_bundles sở hữu decode profile/canonical validation dùng chung với get/read_file; filesystem_snapshot_workspace chỉ vật hóa/verify bytes trong root tường minh, không import HTTP/Psycopg/app báo giá. Test filesystem Windows không cần driver DB; test integration kiểm COMMIT failure thật, lock và revoke. Không thêm migration, factory tự provision hoặc lớp executor rỗng.

## Workflow sửa và test kỹ thuật

`backend/app/change_workflow/` sở hữu proposal revision, job/evidence, transaction ports và adapters PostgreSQL, strict HTTP inputs/routes/middleware. `app/testing/` sở hữu profile image inventory, trusted HTTP harness và worker Docker host; không import driver PostgreSQL. Worker dùng snapshot materializer của repositories, không chuyển nghiệp vụ báo giá vào control hoặc cache. Dockerfile.quotation-test tạo runtime app và harness riêng, không chạy candidate trong image control.

`frontend/src/features/code-changes/` sở hữu API client/hook, editor/diff và TestRunPanel; RepositoryPanel lắp ghép, useRepository chỉ cấp client theo phiên hiện tại. Tests thuộc `backend/tests/control/test_change_workflow_integration.py`, `backend/tests/testing/` và `frontend/scripts/code-changes*`; script Docker thủ công tách khỏi pytest/research. [Workflow T12](change-workflow.md) sở hữu behavior và cấu hình.

## UI template tham chiếu

React dùng components/ui; JS DOM độc lập dùng design-reference/templates/src. Hai implementation theo host, catalog/demo tách khỏi implementation.

| Muốn sửa | Mở file dưới frontend/ |
| --- | --- |
| Select React | src/components/ui/forms/Select.tsx |
| Ví dụ/options Select | src/features/ui-library/catalog/select.ts |
| Preview tương tác Select | src/features/ui-library/previews/SelectPreview.tsx |
| Select JS element/destroy | design-reference/templates/src/controls/select.js |
| Lifecycle DOM | design-reference/templates/src/core/lifecycle.js |
| Catalog JS | design-reference/catalog/data.js và page.js |
| Shell/chat minh họa | design-reference/demo-shell.js |
| Prototype cũ, không tải trong index | design-reference/legacy/extended-kit-prototype.js |

manifest.json khai báo source từng template và thứ tự bundle. Sửa source rồi chạy npm run templates:build; templates:check phát hiện bundle lệch source. components.js là bundle sinh tự động để giữ script defer và API NoiUI v2.0.0, không sửa tay; app nhúng không cần TypeScript/catalog. CSS template được định dạng dễ đọc, giữ thứ tự cascade. Lỗi có sẵn $$let đã sửa trong demo-shell; browser smoke phục vụ file thật, không vá response.

[Hướng dẫn template](../../frontend/design-reference/templates/README.md) sở hữu cách nhúng; [setup](../general/setup.md#kiểm-tra) sở hữu kiểm chứng. Khi đổi path phải cập nhật imports, snippets, test, manifest/script và link docs cùng lúc, không đổi hành vi hoặc dữ liệu nghiên cứu chỉ để thay cấu trúc.

Hai route `/workspace` và `/quotations` nằm trong route group `app/(workbench)` dùng `LocalWorkbench` chung để giữ trạng thái khi điều hướng. Page chỉ giữ metadata; `viewReferences.ts` sở hữu UUID trong URL, hook feature tự tải và kiểm quyền lại khi reload. Browser smoke `--workbench` kiểm phiên chung, draft, khôi phục ID và logout hai màn.
