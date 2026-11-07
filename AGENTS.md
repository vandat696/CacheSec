# CacheSec — quy tắc làm việc

## 0. Bối cảnh lâu dài và giới hạn nghiên cứu
- CacheSec nghiên cứu **Secure Local Semantic Cache for AI-Assisted Software Development**. Kiến trúc cache là đóng góp chính; AI Coding Agent là bối cảnh ứng dụng, không thay thế mục tiêu nghiên cứu.
- Kịch bản giảng viên: tiếp nhận/validation báo giá nhà cung cấp giả lập; đúng một thay đổi phần mềm là thêm quy tắc đánh dấu báo giá thiếu ngày hết hạn hợp lệ để con người xem xét. Không mở rộng ERP, không nhầm duyệt code với duyệt báo giá.
- Đúng một safety property: không triển khai thay đổi quy tắc validation khi chưa có người có thẩm quyền phê duyệt tường minh chính xác thay đổi đó. Cache verification và approval gate riêng biệt; cache không cấp quyền, bỏ test hoặc duyệt mã đã đổi. Gate phải thực thi ở backend/deployment control, gắn phiên bản/hash và kiểm tra đúng artifact tại deployment.
- Giảng viên yêu cầu một repository, một fixture cố định, một approval-control implementation và một acceptance threshold định trước; so sánh Developer-guided/AI-assisted theo năm chiều: correctness, approval gate, reproducibility, trace completeness, engineering time/failures. Giá trị threshold và định nghĩa ngày hợp lệ chưa được xác nhận; không coi đề xuất là đã được giảng viên duyệt.
- Cache/No Cache trong AI workflow là phép thử phụ đề xuất; tách khỏi thí nghiệm chính và cold/warm. None/server, exact/semantic, TTL/eviction/invalidation, RBAC/ABAC, authorized RAG, provenance/version và model adapter vẫn giữ trong thiết kế; không buộc triển khai mọi biến thể trong PoC.
- Frontend cũ là nền tái sử dụng, không tự xóa/viết lại. Không đổi package/repository/path/định danh kỹ thuật chỉ để đổi bối cảnh. Tài liệu mục tiêu không chứng minh tính năng đã chạy; xem docs/general/project-status.md.
- Yêu cầu/câu hỏi mở thuộc docs/general/overview.md; kiến trúc thuộc docs/system/; đánh giá thuộc docs/evaluation/design.md; lộ trình thuộc docs/general/implementation-plan.md. Không tự chốt quyết định bảo mật/nghiên cứu còn mở hoặc chạy thực nghiệm trước khi khóa điều kiện cần thiết.

## 1. Đọc bối cảnh trước khi làm
- Đọc AGENTS.md, README.md, .github/copilot-instructions.md, docs/README.md và docs/general/project-status.md; theo hướng dẫn lồng trong thư mục nếu có.
- Đọc tài liệu và code liên quan đến phần bị ảnh hưởng; thay đổi xuyên phần cần xem kiến trúc, API, dữ liệu và quyền tương ứng.
- Docs chính: general/ cho mục tiêu/yêu cầu/trạng thái, system/ cho thiết kế, frontend/ cho UI, evaluation/ cho đánh giá. Đường dẫn đều nằm dưới docs/.
- File rỗng là chưa đặc tả; tài liệu cũ hoặc mâu thuẫn phải được nhận diện, không tự coi là quyết định đã chốt.

## 2. Giữ đúng phạm vi
- Trả lời tiếng Việt. Thảo luận thì không sửa file; cập nhật thiết kế thì không tự scaffold/code ứng dụng.
- Tự quyết lựa chọn nhỏ, dễ đảo ngược. Làm rõ quyết định chưa chốt nếu ảnh hưởng bảo mật, phạm vi hoặc tính đúng nghiên cứu.
- Kiểm tra working tree trước khi sửa, giữ thay đổi của người dùng; không ghi đè, hoàn tác hay sửa phần không liên quan.
- Không tự commit, push, xóa dữ liệu hoặc thay đổi môi trường bên ngoài khi chưa được yêu cầu.

## 3. Code đơn giản và rõ trách nhiệm
- Thiết kế giao diện phải tối giản chữ: bỏ mọi nội dung không cần thiết, mô tả lặp, lời giới thiệu và giải thích hiển nhiên. Chỉ giữ nhãn, dữ liệu, trạng thái và hướng dẫn ngắn cần để hiểu hoặc thao tác; chi tiết phụ chỉ mở khi cần. Không biến trang web thành tài liệu; thông báo lỗi, trạng thái mô phỏng và thông tin cần cho quyết định vẫn phải rõ, ngắn và không lặp.
- Theo convention và cấu trúc hiện có; tên rõ nghĩa, kiểu dữ liệu rõ ràng, hàm có trách nhiệm cụ thể.
- Tổ chức theo feature/domain sở hữu; bên trong tách domain, adapter và composition khi đã có trách nhiệm tương ứng. Không gom các feature vào một thư mục models/services/utils chung hoặc scaffold layer rỗng. Route/entrypoint chỉ lắp ghép, không chứa implementation nghiệp vụ hoặc UI dài.
- Mỗi file có một trách nhiệm chính có thể gọi tên; component UI công khai có file theo tên component, helper/type gắn chặt được để cùng file. Nhóm forms/charts/navigation theo thư mục, không gom nhiều component độc lập vào một file. File lớn vì nhiều trách nhiệm phải tách theo trách nhiệm, không chia máy móc theo số dòng.
- File component React .tsx dùng PascalCase khớp tên component chính (ChartFrame.tsx, AppShell.tsx); module chứa nhóm component liên quan dùng tên nhóm PascalCase. Hook/helper/model/data TypeScript .ts dùng camelCase (useField.ts, chartFormat.ts, chatState.ts), hook bắt đầu bằng use. Giữ tên đặc biệt của framework như page.tsx, layout.tsx và entry index.ts; thư mục feature vẫn kebab-case. Component/type/class dùng PascalCase, hàm/hook dùng camelCase. Python giữ module/hàm snake_case, class PascalCase; không áp cách đặt tên file React cho Python, JS DOM hoặc bundle CSS/JS. Tên adapter thể hiện công nghệ và đối tượng, tránh tên chung khó phân biệt khi module đã có nhiều vai trò.
- OOP phục vụ đóng gói trạng thái/phụ thuộc và phân trách nhiệm; dùng composition, class cho adapter/service có trạng thái khi phù hợp. React giữ function component/hooks, logic thuần giữ function; không chuyển mọi thứ thành class, thêm base class hoặc inheritance chỉ để gọi là chuẩn OOP.
- UI kit tách implementation tái sử dụng khỏi catalog, ví dụ và template tham chiếu. Source template phải đọc được, có file theo component và helper dùng chung; bundle sinh tự động phải ghi rõ nguồn/lệnh build, không sửa tay. Import trực tiếp module sở hữu; entry registry/barrel nếu có chỉ khai báo API, không nhét implementation.
- Refactor đường dẫn phải cập nhật toàn bộ imports, snippets sao chép, test, script và link tài liệu liên quan; giữ hành vi, public route, contract và định danh migration/checksum đã áp dụng. Test đặt theo module/feature sở hữu. Cấu trúc cụ thể và bản đồ vị trí ở docs/system/code-organization.md.
- Tách nghiệp vụ khỏi UI, HTTP và storage. Tái sử dụng code phù hợp; không tạo tầng rỗng, generic base class hoặc abstraction chưa cần.
- Tách source và trách nhiệm của ứng dụng báo giá, Agent/IDE và lõi cache thành các module độc lập trong cùng repository. App báo giá chạy độc lập; Agent coi source app là mục tiêu đọc/sửa qua công cụ có scope. Lõi cache không phụ thuộc nghiệp vụ báo giá hoặc một Agent/IDE cụ thể; tích hợp qua contract/adapter, giữ xác minh quyền/nguồn ở thành phần tin cậy. Chi tiết ranh giới thuộc docs/system/architecture.md.
- Thiết kế CacheSec để Developer tích hợp vào IDE/Agent qua contract chung có phiên bản, được tài liệu hóa và có thể cung cấp bằng SDK/API cùng adapter theo host. Web Workspace là một host tích hợp, không phải điều kiện sử dụng lõi cache. Chỉ công bố tương thích khi đã kiểm chứng adapter cụ thể; hỗ trợ nhiều IDE/Agent là hướng mở rộng, không tự thêm extension/SDK hoặc đổi phạm vi PoC.
- Không thêm dependency/dịch vụ ngoài nhu cầu. Xử lý lỗi rõ ràng, không che lỗi thật bằng fallback giả thành công.
- Stack dự kiến: Next.js/TypeScript, FastAPI/Python, PostgreSQL/pgvector; IndexedDB/Dexie cho browser cache. Server cache storage chưa chốt.
- LLM và embedding có adapter riêng, API trước/local sau; cache tách storage, matching, validation.
- Python cho backend/AI/nghiên cứu, TypeScript cho browser cache. Chia sẻ đặc tả/fixtures; backend không phụ thuộc script nghiên cứu.

## 4. Bảo mật và tính đúng thực nghiệm
- Similarity không phải quyền. Backend xác minh identity/tenant, mọi nguồn phụ thuộc, quyền hiện tại và tính hợp lệ trước khi trả cache; không tin metadata client tự khai.
- Kiểm tra scope, TTL, nguồn/policy/configuration và toàn vẹn nội dung. Không xác minh được thì không trả cache; offline cần policy riêng.
- Với repository, kiểm tra repo identity, intent/scope, mọi file phụ thuộc và revision/hash; cached context không chứng minh code hiện tại vẫn đúng. Không dùng cache lỗi thời làm căn cứ tin cậy sửa mã; deployment approval không thuộc answer/context cache.
- Thu hồi quyền ngăn reuse theo freshness đã công bố, không thu hồi nội dung đã đọc. Mã hóa browser không tự giải quyết XSS/thiết bị bị kiểm soát.
- Dùng dữ liệu giả lập; không commit secrets/log nội dung nhạy cảm. Unsafe cache chỉ là đối chứng giả lập tùy chọn.
- So sánh cùng điều kiện, tách vị trí cache với phạm vi chia sẻ, cold/warm và demo A/B với benchmark; tính cả mạng/auth.
- Lưu cấu hình có phiên bản và từng lượt; namespace cache theo cấu hình. Đổi embedding phải re-embed hoặc tách namespace, không trộn không gian vector.
- Đánh giá chất lượng và phân quyền riêng; ghi mẫu số, lỗi/timeout. Phân biệt mock, mô phỏng, đo thật và cost estimate; không bịa kết quả hoặc suy rộng zero disclosure thành bảo đảm tuyệt đối.

## 5. Kiểm chứng trước khi kết thúc
- Chạy lint/type-check/test liên quan nếu có. Thay đổi logic cần test hành vi đáng kể, ưu tiên quyền, tenant, cache và invalidation; sửa lỗi thêm ca tái hiện khi phù hợp.
- Chỉ sửa tài liệu thì kiểm tra nội dung, link và diff; không thêm test framework.
- Xem lại toàn bộ diff của tác vụ để phát hiện sai sót, thay đổi ngoài phạm vi và rò rỉ secrets.
- Không tuyên bố kiểm tra đã đạt khi chưa chạy; nêu rõ phần chưa kiểm chứng và lý do.

## 6. Ghi lại vừa đủ
- Khi hành vi/API/dữ liệu/cấu hình đổi, cập nhật tài liệu sở hữu chủ đề; liên kết thay vì chép lặp.
- Cập nhật docs/general/project-status.md khi chốt quyết định, hoàn thành mốc hoặc gặp blocker ảnh hưởng tiến độ. Ghi ngắn: thay đổi, lý do nếu quan trọng, kiểm chứng, việc còn mở/bước tiếp theo.
- Phân biệt đã thống nhất, đã triển khai và đã kiểm thử; chỉ ghi sự thật được xác nhận. Không ghi từng thao tác hoặc toàn bộ hội thoại.
- README chỉ tổng quan; AGENTS chứa luật; docs chứa thiết kế; project-status chứa trạng thái. Không đưa chi tiết triển khai vào AGENTS.
- Kết thúc bằng báo cáo ngắn: thay đổi, kiểm tra, tài liệu/trạng thái cập nhật và giới hạn còn lại.
