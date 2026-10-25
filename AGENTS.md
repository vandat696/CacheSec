# CacheSec — quy tắc làm việc

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
- Theo convention và cấu trúc hiện có; tên rõ nghĩa, kiểu dữ liệu rõ ràng, hàm có trách nhiệm cụ thể.
- Tách nghiệp vụ khỏi UI, HTTP và storage. Tái sử dụng code phù hợp; không tạo tầng rỗng, generic base class hoặc abstraction chưa cần.
- Không thêm dependency/dịch vụ ngoài nhu cầu. Xử lý lỗi rõ ràng, không che lỗi thật bằng fallback giả thành công.
- Stack dự kiến: Next.js/TypeScript, FastAPI/Python, PostgreSQL/pgvector; IndexedDB/Dexie cho browser cache. Server cache storage chưa chốt.
- LLM và embedding có adapter riêng, API trước/local sau; cache tách storage, matching, validation.
- Python cho backend/AI/nghiên cứu, TypeScript cho browser cache. Chia sẻ đặc tả/fixtures; backend không phụ thuộc script nghiên cứu.

## 4. Bảo mật và tính đúng thực nghiệm
- Similarity không phải quyền. Backend xác minh identity/tenant, mọi nguồn phụ thuộc, quyền hiện tại và tính hợp lệ trước khi trả cache; không tin metadata client tự khai.
- Kiểm tra scope, TTL, nguồn/policy/configuration và toàn vẹn nội dung. Không xác minh được thì không trả cache; offline cần policy riêng.
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
