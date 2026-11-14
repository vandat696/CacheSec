# Tài liệu CacheSec

Hồ sơ thiết kế và trạng thái hệ thống. Nội dung dự kiến không đồng nghĩa đã triển khai; xem project-status để biết kiểm chứng thực tế.

Định hướng hiện hành từ 2026-11-02: **Secure Local Semantic Cache for AI-Assisted Software Development**, kiểm chứng bằng đúng một thay đổi validation ngày hết hạn báo giá. Có thêm Workspace xem trước tại `/workspace`; UI chatbot nội bộ cũ vẫn được giữ để tái sử dụng. Yêu cầu giảng viên, đề xuất kỹ thuật và hiện trạng được ghi riêng; lịch sử trong project-status không thay phạm vi mới.

| Nhóm | Tài liệu | Nội dung |
| --- | --- | --- |
| General | [Tổng quan](general/overview.md) | Problem statement, yêu cầu giảng viên, FR/NFR, acceptance chưa chốt, giả định/câu hỏi mở |
| General | [Trạng thái](general/project-status.md) | Đã làm, quyết định, còn mở, bước tiếp theo |
| General | [Kế hoạch PoC](general/implementation-plan.md) | T01–T17 tuần tự: thiết kế, database/backend, app/cache/Agent/gate, UI, runner và đánh giá; mở rộng X01–X03 riêng |
| General | [Cài đặt](general/setup.md) | Môi trường, lệnh chạy và kiểm tra |
| System | [Kiến trúc](system/architecture.md) | As-Is, ba ranh giới, storage báo giá/blob, registry và HTTP snapshot; thiết kế T03 v0.1 cho artifact |
| System | [Tổ chức source](system/code-organization.md) | Đặt tên/module frontend/backend, UI kit/catalog, template source và bundle |
| System | [Contract backend và cache](system/api.md) | T02 v0.2; API tạo/đọc/validate nền báo giá và health/readiness đã triển khai, HTTP snapshot/file và revision/test kỹ thuật đã có, Agent/cache/gate còn là thiết kế |
| System | [Workflow sửa/test T12](system/change-workflow.md) | Revision/diff/evidence, quyền, profile image, worker Docker và sandbox kỹ thuật đã triển khai |
| System | [Agent tự sửa/test local](system/agent-workflow.md) | Run có giới hạn, quyền workflow riêng, vòng sửa/test, cancel và registry trong một process |
| System | [Cache](system/cache.md) | Answer/Context Cache, Hit/Miss/Rejected, verification, metadata và lifecycle |
| System | [Phân quyền](system/authorization.md) | Quyền app, registry control và HTTP repository đã có; gate local v0.1/dispatch/recovery chưa triển khai, threat model |
| Frontend | [Thiết kế](frontend/design.md) | Báo giá nối API thật, Workspace snapshot/revision/diff/test Docker thật, review/approval mô phỏng và các màn cũ |
| Evaluation | [Thiết kế đánh giá](evaluation/design.md) | So sánh chính năm chiều, phép thử cache phụ, mẫu số/nguồn đo, fixture và threshold |

## Cách đọc và cập nhật

Đọc tổng quan và trạng thái trước, sau đó tài liệu liên quan đến tác vụ. Mỗi chủ đề có một nơi chính; dùng liên kết thay vì chép lặp. Chỉ tách thêm file khi nội dung thực sự khó đọc. Phân biệt định hướng đã thống nhất, đề xuất, chi tiết chưa chốt và tính năng đã kiểm chứng.

Repository chưa có research notes/bản tóm tắt bài báo được tìm thấy trong đợt khảo sát. Không suy diễn tài liệu kiến trúc là bằng chứng đã đọc paper hoặc đã kiểm nghiệm. Kế hoạch PoC là file mới duy nhất để tránh trộn mốc lịch sử với công việc tương lai; yêu cầu, thiết kế và công thức vẫn ở tài liệu sở hữu chủ đề.
