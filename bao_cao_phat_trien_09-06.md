# Báo Cáo Phát Triển Tính Năng, Tách Phân Quyền & Sửa Lỗi Hệ Thống (Ngày 09/06/2026)

Báo cáo chi tiết toàn bộ các hạng mục công việc đã thực hiện thành công trong ngày hôm qua (09/06/2026) nhằm phân rã quyền quản lý lớp học, sửa lỗi ẩn menu Quản lý Môn học đối với các vai trò nhân sự/quản lý, mở rộng quyền truy cập API danh sách môn học, và đồng bộ code lên nhánh main sau khi giải quyết các xung đột.

---

## 1. Phân Tách Quyền Quản Lý Lớp Học & Tách Biệt Menu "Tạo Lớp" / "Tra Cứu Lớp"
- **Vấn đề**: Quyền `class_create` trước đây đảm nhận cả việc tạo lớp học lẫn tra cứu lớp. Theo nghiệp vụ thực tế, một số vai trò cần tra cứu lớp (như Hiệu trưởng) nhưng không trực tiếp tham gia tạo lớp học, việc gộp chung quyền gây khó khăn cho kiểm soát phân quyền.
- **Cách xử lý**:
  - **Database SQL ([02_user_permissions.sql](file:///d:/cot/thuc%20tap/pj3/LMS/sql/02_user_permissions.sql))**:
    - Đổi mô tả mã quyền `class_create` từ "Tạo lớp học và gán quản lý" thành "Tạo lớp học".
    - Khởi tạo mã quyền mới `class_view` với mô tả "Tra cứu lớp" (nằm trong nhóm "4. Chức năng Phòng Đào Tạo").
    - Gán quyền mặc định `class_view` cho vai trò `HIEU_TRUONG` và `PHONG_DAO_TAO`.
  - **Frontend Sidebar ([AppSidebar.vue](file:///d:/cot/thuc%20tap/pj3/LMS/src/components/AppSidebar.vue))**: Cập nhật menu "Tra cứu lớp (Bộ lọc)" (`/admin/classes/search`) để yêu cầu quyền truy cập mới là `class_view` thay vì `class_create`.
  - **Frontend Router ([index.ts](file:///d:/cot/thuc%20tap/pj3/LMS/src/router/index.ts))**: Cập nhật thuộc tính `requirePermission` của route `/admin/classes/search` thành `class_view`.
  - **Dashboard View ([DashboardView.vue](file:///d:/cot/thuc%20tap/pj3/LMS/src/views/DashboardView.vue))**: Cập nhật computed `classLink` để nếu người dùng chỉ có quyền `class_view` (mà không có quyền `class_create`), nút điều hướng nhanh của Quản lý lớp học trên Dashboard sẽ tự động dẫn họ tới trang tìm kiếm lớp `/admin/classes/search`.
- **Kết quả**: Phân rã quyền chi tiết và hợp lý hơn. Hiệu trưởng và Phòng Đào Tạo giờ đây có thể truy cập trang Tra cứu lớp một cách độc lập mà không cần phải nắm giữ quyền Tạo lớp học.

---

## 2. Khắc Phục Lỗi Ẩn Giao Diện "Quản Lý Môn Học" Đối Với Các Vai Trò Quản Lý (Hiệu Trưởng, Phòng Đào Tạo, Trưởng Bộ Môn)
- **Vấn đề**: Ngoài tài khoản `ADMIN` (được bypass tất cả các kiểm tra quyền nhờ rank = 100), các tài khoản Staff khác (Hiệu trưởng, Phòng Đào Tạo, Trưởng bộ môn) đều bị mất hoàn toàn mục "Quản lý Môn học" trên Sidebar. Nguyên nhân do mã quyền được kiểm tra trong code là `department_manage` không tồn tại trong danh sách quyền của Database.
- **Cách xử lý**:
  - **Phát triển Script Kiểm Tra ([inspect_db_perms.js](file:///d:/cot/thuc%20tap/pj3/LMS/backend/scripts/inspect_db_perms.js))**: Viết script NodeJS truy vấn trực tiếp cơ sở dữ liệu Supabase để liệt kê toàn bộ permissions thực tế và khẳng định `department_manage` hoàn toàn không tồn tại trong DB.
  - **Ánh xạ lại quyền hợp lệ trên Giao diện ([AppSidebar.vue](file:///d:/cot/thuc%20tap/pj3/LMS/src/components/AppSidebar.vue))**:
    - Thay đổi menu "Thêm môn học" yêu cầu quyền `subject_propose` (Đề xuất môn học - có sẵn trong DB).
    - Thay đổi menu "Phê duyệt môn" yêu cầu quyền `subject_approve` (Phê duyệt môn học - có sẵn trong DB).
    - Loại bỏ hoàn toàn mục menu "Phê duyệt học phần" theo yêu cầu nghiệp vụ của người dùng.
  - **Cập nhật Router ([index.ts](file:///d:/cot/thuc%20tap/pj3/LMS/src/router/index.ts))**: Thay đổi `requirePermission` cho các route tương ứng thành `subject_propose` và `subject_approve`.
  - **Cập nhật Dashboard ([DashboardView.vue](file:///d:/cot/thuc%20tap/pj3/LMS/src/views/DashboardView.vue))**: Thay đổi kiểm tra quyền trong computed `departmentLink` từ `department_manage` sang `subject_approve`.
- **Kết quả**: Khắc phục triệt để lỗi ẩn menu. Các tài khoản Hiệu trưởng, Phòng Đào Tạo, Trưởng bộ môn hiển thị chính xác các chức năng quản lý môn học dựa trên các quyền thực tế mà họ được cấp.

---

## 3. Mở Rộng Quyền Truy Cập API Danh Sách Môn Học (`GET /api/subjects`)
- **Vấn đề**: API lấy danh sách môn học (`GET /api/subjects`) trước đó yêu cầu quyền `lesson_exam_manage` hoặc tài khoản có rank >= 50. Các vai trò thuộc ban quản lý (Nhân sự, Phòng Đào Tạo, Trưởng bộ môn) tuy có rank >= 50 nhưng do thiếu quyền `lesson_exam_manage` nên đôi khi gặp lỗi phân quyền khi tải dữ liệu trang liên quan đến môn học.
- **Cách xử lý**:
  - Cập nhật file định nghĩa tuyến đường backend [subjectRoutes.js](file:///d:/cot/thuc%20tap/pj3/LMS/backend/src/routes/subjectRoutes.js):
    ```javascript
    // GET /api/subjects — Danh sách (Giảng viên/Nhân sự/Phòng Đào Tạo/Trưởng bộ môn trở lên)
    router.get('/', requireRank(50), subjectController.getAll)
    ```
- **Kết quả**: Cho phép tất cả các tài khoản nhân sự/quản lý có cấp bậc từ Giảng viên trở lên (rank >= 50) tải danh sách môn học một cách trơn tru, hỗ trợ vận hành chính xác các bộ lọc và biểu mẫu.

---

## 4. Giải Quyết Xung Đột Code & Đồng Bộ Lên Nhánh `main`
- **Vấn đề**: Khi gộp mã nguồn từ nhánh phát triển khác (`feature/van-tinh`), hệ thống phát sinh xung đột (conflict) ở file `package-lock.json` và một số file logic backend.
- **Cách xử lý**:
  - Tiến hành giải quyết xung đột thủ công, đảm bảo các thư viện và code logic của cả hai bên được tích hợp đầy đủ và chính xác.
  - Chạy thử nghiệm hệ thống ở cả frontend và backend để đảm bảo không phát sinh lỗi runtime.
  - Commit thay đổi: `10c06ba sửa lỗi mất sidebar phần quản lý môn` và thực hiện push code trực tiếp lên nhánh `main` của repo từ xa (`origin/main`).
- **Kết quả**: Mã nguồn trên nhánh `main` được cập nhật đồng bộ, các tính năng hoạt động ổn định và không bị ảnh hưởng bởi quá trình merge code.
