# Báo Cáo Phát Triển Tính Năng, Sửa Lỗi & Dọn Dẹp Database (Ngày 08/06/2026)

Báo cáo chi tiết toàn bộ các hạng mục công việc đã thực hiện thành công trong ngày hôm nay để nâng cấp hệ thống LMS, bao gồm sửa lỗi 502, tối ưu phân quyền API, hiệu chỉnh giao diện Thời khóa biểu và dọn dẹp dữ liệu thử nghiệm.

---

## 1. Khắc Phục Triệt Để Lỗi 502 Bad Gateway (Reset Socket)
- **Vấn đề cũ**: Lần đầu nhấp chuột vào trang web hoặc chuyển trang ngẫu nhiên thường gặp lỗi `502 Bad Gateway`. Nguyên nhân do backend Express lắng nghe mặc định (`localhost` hoặc `0.0.0.0`) dẫn tới cơ chế phân giải DNS/reset socket không ổn định khi Vite proxy gọi sang trên môi trường Windows.
- **Cách xử lý**:
  - Cập nhật [server.js](file:///d:/cot/thuc%20tap/pj3/LMS/backend/src/server.js) để chỉ định rõ ràng địa chỉ IPv4 cục bộ:
    ```javascript
    app.listen(PORT, '127.0.0.1', () => { ... })
    ```
- **Kết quả**: Đồng bộ hóa hoàn hảo với proxy target `127.0.0.1:3000` của Vite frontend, giải quyết triệt để lỗi 502 khi tải trang đầu tiên.

---

## 2. Nâng Cấp Phân Quyền Động & Cơ Chế Bypass Admin
- **Vấn đề cũ**: Kiểm tra phân quyền tĩnh dựa trên trọng số rank (`requireRank(X)`) thiếu linh hoạt, đồng thời các tài khoản quản lý như Hiệu trưởng bị hiển thị quá nhiều chức năng nâng cao (Phân quyền nhân sự, Lịch sử hoạt động) mặc dù không có quyền thực tế.
- **Cách xử lý**:
  - **Backend Middleware ([authMiddleware.js](file:///d:/cot/thuc%20tap/pj3/LMS/backend/src/middleware/authMiddleware.js))**: Sửa đổi logic để chỉ vai trò **ADMIN (Rank 100)** được bypass tất cả các kiểm tra. Các vai trò khác (kể cả Hiệu trưởng) bắt buộc phải sở hữu mã quyền tương ứng trong danh sách `permissions` của mình.
  - **Frontend Store ([auth.ts](file:///d:/cot/thuc%20tap/pj3/LMS/src/stores/auth.ts))**: Đồng bộ logic `hasPermission()` để chỉ bypass kiểm tra quyền cho `ADMIN`.
- **Kết quả**: Các menu nhạy cảm như "Phân quyền", "Lịch sử hoạt động" đã tự động ẩn hoàn toàn trên Sidebar đối với Hiệu trưởng và các vai trò khác không được cấp phép.

---

## 3. Cấp Quyền Mặc Định & Đồng Bộ Cho Vai Trò Hiệu Trưởng
- **Cách xử lý**:
  - Cập nhật script SQL [02_user_permissions.sql](file:///d:/cot/thuc%20tap/pj3/LMS/sql/02_user_permissions.sql) để gán quyền `user_manage_staff` (xem danh sách & thêm nhân viên) làm quyền mặc định cho vai trò **Hiệu trưởng**.
  - Tiến hành reset và đồng bộ lại quyền cho tất cả tài khoản Hiệu trưởng hiện có dưới DB.
- **Kết quả**: Hiệu trưởng chỉ nhìn thấy danh sách người dùng và thêm nhân viên mới, không còn quyền thao tác phân quyền nâng cao, khớp chính xác yêu cầu nghiệp vụ bảo mật.

---

## 4. Tích Hợp Kiểm Tra Quyền Động Cho Toàn Bộ API
Đã chuyển đổi toàn bộ kiểm tra cấp bậc thô (`requireRank`) sang kiểm tra mã quyền động (`requirePermissionOrRank`) trên các tuyến endpoint quan trọng:
- **API Môn học ([subjectRoutes.js](file:///d:/cot/thuc%20tap/pj3/LMS/backend/src/routes/subjectRoutes.js))**: Kiểm tra quyền `subject_propose` (đề xuất) và `subject_approve` (duyệt).
- **API Đề xuất số lượng lớp ([classProposalRoutes.js](file:///d:/cot/thuc%20tap/pj3/LMS/backend/src/routes/classProposalRoutes.js))**: Kiểm tra quyền `class_quantity_propose` (đề xuất lớp) và `class_quantity_approve` (phê duyệt lớp).
- **API Lớp học ([classRoutes.js](file:///d:/cot/thuc%20tap/pj3/LMS/backend/src/routes/classRoutes.js))**: Kiểm tra quyền `class_create` (tạo lớp), `instructor_assign` (gán giảng viên) và `class_quantity_approve`.
- **API Đề thi & Bài học ([examManageRoutes.js](file:///d:/cot/thuc%20tap/pj3/LMS/backend/src/routes/examManageRoutes.js), [lessonRoutes.js](file:///d:/cot/thuc%20tap/pj3/LMS/backend/src/routes/lessonRoutes.js))**: Kiểm tra quyền quản lý bài giảng/đề thi `lesson_exam_manage`.

---

## 5. Hạn Chế Quyền Truy Cập Trang Thời Khóa Biểu
- **Frontend Router ([index.ts](file:///d:/cot/thuc%20tap/pj3/LMS/src/router/index.ts))**: Định cấu hình trường `allowedRoles: ['SINH_VIEN', 'GIANG_VIEN']` cho route `/timetable`. Nếu các tài khoản khác (như Trưởng bộ môn, Hiệu trưởng, Nhân sự) cố tình gõ link trực tiếp, hệ thống sẽ chặn và chuyển hướng về Dashboard.
- **Frontend Sidebar ([AppSidebar.vue](file:///d:/cot/thuc%20tap/pj3/LMS/src/components/AppSidebar.vue))**: Ẩn hoàn toàn menu "Thời khoá biểu" khỏi tầm nhìn của các vai trò không thuộc diện được phép.
- **Backend Controller ([timetableController.js](file:///d:/cot/thuc%20tap/pj3/LMS/backend/src/controllers/timetableController.js))**: Chặn lấy dữ liệu thời khóa biểu đối với `TRUONG_BO_MON`, chỉ cấp phép cho Sinh viên và Giảng viên, trả về mã lỗi `403 Forbidden` đối với các vai trò khác.

---

## 6. Hiệu Chỉnh Toàn Diện Giao Diện Lịch Trình (Học Sinh & Giảng Viên)
Cải tiến toàn bộ giao diện lịch biểu tại [TimetableView.vue](file:///d:/cot/thuc%20tap/pj3/LMS/src/views/TimetableView.vue) và [AppSidebar.vue](file:///d:/cot/thuc%20tap/pj3/LMS/src/components/AppSidebar.vue):
- **Tối ưu lịch giảng dạy của Giảng viên**:
  - Tự động thay đổi tên hiển thị trên Sidebar menu, Breadcrumbs và Tiêu đề trang thành **"Lịch giảng dạy"** khi vai trò đăng nhập là Giảng viên.
  - Ẩn thông tin tên giảng viên trùng lặp trên lịch cá nhân (GV: ...).
  - Lấy sĩ số thực tế từ DB và hiển thị sinh động dưới dạng `Sĩ số: X sinh viên` trên từng thẻ học phần để Giảng viên dễ nắm bắt.
- **Đơn giản hóa phân loại & màu sắc theo quy định mới**:
  - Rút gọn 5 loại lịch cũ xuống chỉ còn **02 loại chính**:
    1. **Lịch học** (Study): Định dạng màu nền xanh dương nhạt dịu mắt (`#eff6ff`), viền trái xanh dương đậm (`#2563eb`).
    2. **Lịch thi** (Exam): Định dạng màu vàng hổ phách nhạt (`#fffbeb`), viền trái vàng cam đậm (`#d97706`).
  - Đồng bộ hóa toàn bộ bảng màu nền này lên cả giao diện Grid/List View và thanh chú thích Legend.
  - Cải tiến thuật toán hàm `getClassType` so khớp từ khóa chính xác độc lập (ví dụ: `thi`, `kiểm tra`, `exam`, `test`) để tránh nhận diện sai các môn học có chữ trùng lặp (ví dụ: *Môn Học Kiểm Tra Tự Động*, *Thiết kế phần mềm*,...).
- **Cân chỉnh thẩm mỹ bảng biểu (Grid Table)**:
  - Chuyển màu nền các cột ca học (`.row-shift`) và hàng tiêu đề ngày (`th`) sang màu xám trung tính sạch sẽ (`#f8fafc`).
  - Làm nổi bật cột ngày hiện tại bằng tông màu tím chủ đạo (`#7c3aed`) đồng bộ với hệ thống.

---

## 7. Dọn Dẹp Sạch Sẽ Toàn Bộ Dữ Liệu TEST Trên Database
- **Thực trạng**: DB tích lũy nhiều môn học, lớp học và đề xuất rác có tên/mã chứa ký tự "TEST", "test" trong quá trình kiểm thử tự động.
- **Giải pháp**:
  - Phát triển script chuyên dụng [cleanup_test_data.js](file:///d:/cot/thuc%20tap/pj3/LMS/backend/cleanup_test_data.js) kết nối trực tiếp Supabase Admin để thực hiện quét và xóa an toàn.
  - **Kết quả thực thi**:
    - Xóa sạch **15 môn học** rác (mã TEST... hoặc tên test).
    - Xóa sạch **8 lớp học** rác có tên hoặc mã liên quan.
    - Xóa sạch **5 đề xuất lớp học** (class proposals) có liên quan.
    - Nhờ cơ chế liên kết khóa ngoại `ON DELETE CASCADE`, toàn bộ dữ liệu bài học, bài kiểm tra, điểm số và đăng ký lớp liên quan đến các dữ liệu TEST trên đã được giải phóng hoàn toàn và làm sạch 100% khỏi DB.
