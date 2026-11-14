# Agent sửa và test bản riêng

Lát cắt local do người dùng yêu cầu ngày 2026-11-14. Backend điều phối thật: đọc source được phép → gọi model → lưu revision riêng → yêu cầu test T12 → đọc evidence → sửa tiếp nếu test thất bại. Đây là vòng coding Agent có giới hạn; chưa hoàn thành toàn bộ T14 với Context Cache, fixture/oracle, review và activation.

## Phạm vi và quyền

Một run gắn requester, credential version/digest, tenant/repo và snapshot gốc. Người dùng khởi tạo run với prompt và chấp thuận gửi source tới provider đã cấu hình. Quyền cần có là `repository.read`, `workflow.run`, `workflow.read`, `proposal.create`, `test.run`; GET/cancel cần read và workflow.read, cùng đúng requester/version. Model không nhận token người dùng, API key trong prompt hoặc worker credential. Không có Agent principal mới hay delegation token bền vững; controller chỉ thực hiện allowlist dưới một operation được requester khởi tạo, không kế thừa khả năng review/deploy của họ.

Backend kiểm quyền hiện tại trước mỗi bước và sau model; các thao tác lưu revision/queue test kiểm thêm workflow.run/read trong chính authority transaction của T12. Thu hồi chặn bước tiếp theo, không thu hồi dữ liệu đã gửi provider hoặc hủy chắc chắn thao tác đã được nhận. Job test đã queue vẫn đi qua kiểm quyền requester/profile/source/artifact tại worker permit như T12. Không thêm hoặc tự đồng bộ grants ở startup. Cấp quyền dev phải là thao tác administration tường minh, giữ nguyên principal/credential và dùng epoch CAS; bản code tự nó không cấp quyền.

Scope đọc giữ đúng ba file của source profile đã đăng ký. Chỉ `quotation_validation.py` được sửa trong candidate riêng; không ghi working tree, sửa harness/policy hoặc chạy command do model/client gửi. Provider nhận ba file và prompt; từ vòng hai, source validation là candidate đã đọc lại qua proposal service và feedback chỉ là kết quả/checks kỹ thuật đã gắn job/revision/artifact. Không gửi stdout hoặc coi nội dung candidate là chỉ thị có thẩm quyền.

## Vòng thực thi

1. POST tạo run có idempotency key; backend xác thực quyền và cấu hình model. Cùng requester/key/payload trả cùng run trong đời process; đổi payload trả conflict. Một run đang hoạt động cho mỗi control process, không có hàng đợi không giới hạn.
2. Đọc/kiểm snapshot gốc. Mỗi lượt model vẫn kiểm freshness của toàn source gốc trước/sau response. Model trả answer và source nullable qua generation contract hiện có; không được tự chọn tool/path/image/provider.
3. Nếu content=null, dừng `needs_input`. Nếu có source, lưu revision CAS qua T12 với key cố định theo run/turn/action. Run mới luôn tạo proposal riêng; Agent không nhận proposal ID tùy ý để sửa bản của người khác.
4. Queue test cho đúng revision/artifact/profile; đợi job terminal và kiểm mọi binding trước dùng kết quả. Chỉ evidence passed đúng job được ghi run `passed`. Đây là **test kỹ thuật**, không chứng minh rule ngày đúng oracle hoặc acceptance nghiên cứu.
5. `failed` mới được gửi lại model cùng candidate hiện hành để sửa. Lỗi hạ tầng, blocked, unknown hoặc timeout của job dừng run; không gọi model để che lỗi. Revision đã bị sửa ngoài run thì dừng. Không tự retry model; lỗi mutation/storage giữ trace action đã bắt đầu và trạng thái effect_unknown thay vì giả thành công.

Giới hạn cố định: ba lượt model, tối đa ba revision/test mới, mười phút; mỗi model call vẫn có output cap/timeout của adapter và mỗi job có sandbox/deadline T12. Kiểm deadline/hủy ở ranh giới bước và sau response. Cancel yêu cầu dừng vòng; model request hoặc test đã được nhận có thể tiếp tục theo giới hạn riêng. Slot chỉ giải phóng khi controller thực sự kết thúc; response model sau cancel/deadline không được dùng để tạo bước mới.

## State và vòng đời local

`queued → generating → saving → testing`; test thất bại quay lại generating trong budget. Các terminal là `passed`, `needs_input`, `exhausted`, `cancelled`, `timed_out`, `error`. Terminal không nhận thêm action/event. Progress có thứ tự, timestamp, turn, tool, model/usage và liên kết revision/job/evidence; không log prompt/source/secret.

Run registry nằm trong bộ nhớ một process, tối đa 100 run, token chỉ giữ trong lúc run và xóa tham chiếu khi terminal. Config trả active run ID của đúng requester để UI nối lại polling sau reload. Đóng tab/logout chỉ dừng polling, không bảo đảm hủy run backend; dùng nút Dừng hoặc chờ budget. Khởi động lại control mất run/progress/idempotency registry; không tự resume hoặc báo test pass. Revision và evidence T12 đã commit vẫn ở PostgreSQL/blob store. Đây chưa phải audit/runner nghiên cứu bền vững hoặc distributed worker coordination; triển khai local một control process.

## Thành phần và kiểm chứng

`run_models.py` sở hữu state/ports/limits; `run_service.py` là vòng điều phối; `run_store.py` là registry local có khóa; `workflow_run_tools.py` nối authority và các thao tác T12; `run_http.py` chỉ nhận create/get/cancel. Control entrypoint lắp ghép executor một thread và hủy run khi shutdown. [API](api.md#agent-assistance) sở hữu wire contract; [authorization](authorization.md#agent-assistance-do-người-dùng-khởi-tạo) sở hữu quyền/provider boundary.

UI dùng `useAgentRun`, `AgentRunStatus`, decoder/client riêng của feature Agent. Lựa chọn Tự sửa và test gửi consent tường minh; tiến trình có Dừng và Xem bản sửa sau terminal, mở bản sửa vẫn bảo vệ draft editor. Hỏi đáp/áp dụng thủ công giữ nguyên.

Test vòng lặp dùng model/tool doubles có nhãn; integration dùng PostgreSQL thật và worker double để kiểm revision/evidence/transaction. Browser `--agent-runs` giả lập toàn bộ config/run/model/executor, không phải lượt Agent/Docker/model thật. `--agent` trước đó vẫn chỉ giả generation và chạy workflow Docker thật. Lượt `--agent-run-live` quan sát response thật, kiểm candidate chỉ thêm comment, đối chiếu AST/hash host và binding revision/job/evidence; có chế độ chỉ đọc run cũ bằng CACHESEC_AGENT_RUN_ID. Source egress/quyền automation cần được cho phép rõ trước chạy. Một run kỹ thuật thật đã đạt sau khi người dùng xác nhận, xem [project-status](../general/project-status.md) cho bằng chứng và giới hạn; không suy ra correctness rule ngày hoặc toàn bộ T14.
