-- ============================================================================
-- HỆ THỐNG LMS — SQL MIGRATION #02 (Phân Quyền Động Cấp Người Dùng)
-- Tuân thủ SRP: Mỗi bảng, trigger và hàm chỉ thực hiện DUY NHẤT một nhiệm vụ.
-- ============================================================================

-- 1. BẢNG DANH MỤC QUYỀN CHỨC NĂNG (PERMISSIONS)
CREATE TABLE IF NOT EXISTS public.permissions (
  id          BIGSERIAL PRIMARY KEY,
  code        TEXT NOT NULL UNIQUE,          -- Ví dụ: 'subject_create', 'class_create'
  name        TEXT NOT NULL,                 -- Tên hiển thị: 'Tạo môn học mới'
  group_name  TEXT NOT NULL,                 -- Tên nhóm: 'Quản lý Môn học'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index tăng tốc lọc theo nhóm quyền và mã quyền
CREATE INDEX IF NOT EXISTS idx_permissions_code ON public.permissions(code);
CREATE INDEX IF NOT EXISTS idx_permissions_group ON public.permissions(group_name);

COMMENT ON TABLE public.permissions IS 'Bảng danh mục các quyền chức năng hệ thống';


-- 2. BẢNG KHUÔN MẪU QUYỀN MẶC ĐỊNH THEO VAI TRÒ (ROLE_DEFAULT_PERMISSIONS)
CREATE TABLE IF NOT EXISTS public.role_default_permissions (
  role          public.user_role NOT NULL,
  permission_id BIGINT NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_role_default_role ON public.role_default_permissions(role);

COMMENT ON TABLE public.role_default_permissions IS 'Bảng lưu khuôn mẫu quyền mặc định của từng Role gốc';


-- 3. BẢNG QUYỀN TÙY CHỈNH THỰC TẾ CỦA TỪNG NGƯỜI DÙNG (USER_PERMISSIONS)
CREATE TABLE IF NOT EXISTS public.user_permissions (
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  permission_id BIGINT NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON public.user_permissions(user_id);

COMMENT ON TABLE public.user_permissions IS 'Bảng lưu trữ danh sách quyền thực tế (sau khi override) của từng nhân sự';


-- ============================================================================
-- PHẦN RLS (ROW LEVEL SECURITY) - CHÍNH SÁCH BẢO MẬT CƠ BẢN
-- ============================================================================
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_default_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Cho phép SELECT đối với tất cả người dùng đã xác thực (Authenticated)
DROP POLICY IF EXISTS "permissions_select_authenticated" ON public.permissions;
CREATE POLICY "permissions_select_authenticated"
  ON public.permissions FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "role_default_permissions_select_authenticated" ON public.role_default_permissions;
CREATE POLICY "role_default_permissions_select_authenticated"
  ON public.role_default_permissions FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "user_permissions_select_authenticated" ON public.user_permissions;
CREATE POLICY "user_permissions_select_authenticated"
  ON public.user_permissions FOR SELECT
  TO authenticated
  USING (true);


-- ============================================================================
-- PHẦN SEED DATA — DANH MỤC QUYỀN & MẪU QUYỀN CHO CÁC ROLE GỐC
-- ============================================================================

-- Chèn danh mục các quyền cốt lõi dựa trên yêu cầu nghiệp vụ
INSERT INTO public.permissions (code, name, group_name) VALUES
  ('user_manage_senior', 'Quản lý TK Hiệu trưởng & HR', '1. Chức năng Admin'),
  ('user_manage_staff', 'Quản lý TK Nhân sự & Sinh viên', '2. Chức năng HR'),
  
  ('subject_approve', 'Phê duyệt môn học', '3. Chức năng Hiệu trưởng'),
  
  ('class_quantity_approve', 'Duyệt đề xuất số lượng lớp', '4. Chức năng Phòng Đào Tạo'),
  ('class_create', 'Tạo lớp học và gán quản lý', '4. Chức năng Phòng Đào Tạo'),
  
  ('class_quantity_propose', 'Đề xuất số lượng lớp', '5. Chức năng Trưởng Bộ Môn'),
  ('instructor_assign', 'Phân công giảng viên vào lớp', '5. Chức năng Trưởng Bộ Môn'),
  
  ('subject_propose', 'Đề xuất môn học mới', 'Chức năng Chung (PĐT & TBM)'),
  ('lesson_exam_manage', 'Tạo bài học và bài kiểm tra', 'Chức năng Chung (TBM & Giảng viên)'),
  
  ('class_register', 'Đăng ký lớp học', '7. Chức năng Sinh viên'),
  ('exam_take', 'Tham gia làm bài kiểm tra', '7. Chức năng Sinh viên'),
  ('grade_view', 'Xem bảng điểm', '7. Chức năng Sinh viên')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    group_name = EXCLUDED.group_name;

-- Reset và gán mẫu quyền mặc định cho từng Role
TRUNCATE public.role_default_permissions CASCADE;

-- 1. ADMIN: 
INSERT INTO public.role_default_permissions (role, permission_id)
SELECT 'ADMIN'::public.user_role, id FROM public.permissions
WHERE code IN ('user_manage_senior');

-- 2. HIEU_TRUONG (Hiệu trưởng): 
INSERT INTO public.role_default_permissions (role, permission_id)
SELECT 'HIEU_TRUONG'::public.user_role, id FROM public.permissions
WHERE code IN ('subject_approve');

-- 3. HR (Nhân sự):
INSERT INTO public.role_default_permissions (role, permission_id)
SELECT 'HR'::public.user_role, id FROM public.permissions
WHERE code IN ('user_manage_staff');

-- 4. PHONG_DAO_TAO (Phòng đào tạo):
INSERT INTO public.role_default_permissions (role, permission_id)
SELECT 'PHONG_DAO_TAO'::public.user_role, id FROM public.permissions
WHERE code IN ('subject_propose', 'class_quantity_approve', 'class_create');

-- 5. TRUONG_BO_MON (Trưởng bộ môn):
INSERT INTO public.role_default_permissions (role, permission_id)
SELECT 'TRUONG_BO_MON'::public.user_role, id FROM public.permissions
WHERE code IN ('subject_propose', 'class_quantity_propose', 'instructor_assign', 'lesson_exam_manage');

-- 6. GIANG_VIEN:
INSERT INTO public.role_default_permissions (role, permission_id)
SELECT 'GIANG_VIEN'::public.user_role, id FROM public.permissions
WHERE code IN ('lesson_exam_manage');

-- 7. SINH_VIEN:
INSERT INTO public.role_default_permissions (role, permission_id)
SELECT 'SINH_VIEN'::public.user_role, id FROM public.permissions
WHERE code IN ('class_register', 'exam_take', 'grade_view');


-- Đồng bộ phân quyền mặc định ban đầu cho tài khoản Super Admin ngconghieu2005@gmail.com
INSERT INTO public.user_permissions (user_id, permission_id)
SELECT p.id, dp.permission_id
FROM public.profiles p
JOIN public.role_default_permissions dp ON p.role = dp.role
WHERE p.email = 'ngconghieu2005@gmail.com'
ON CONFLICT DO NOTHING;


-- ============================================================================
-- PHẦN HÀM RPC BẢO MẬT — public.save_user_custom_permissions()
-- Trách nhiệm DUY NHẤT: Đồng bộ phân quyền tùy biến cho người dùng trong một transaction.
-- Validate bảo vệ phân tầng và kiểm soát ràng buộc vai trò gốc bắt buộc.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.save_user_custom_permissions(
  target_user_id             UUID,
  assigned_permission_ids    BIGINT[]
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER -- Chạy dưới quyền hệ thống để ghi đè dữ liệu tuân thủ RLS
AS $$
DECLARE
  actor_uid                 UUID;
  actor_rank                INTEGER;
  target_role               public.user_role;
  target_rank               INTEGER;
  intersect_count           INTEGER;
BEGIN
  -- 1. Xác định ID người đang thao tác
  actor_uid := auth.uid();
  
  -- Nếu có context actor (gọi từ frontend client) thì thực hiện kiểm soát quyền hạn
  IF actor_uid IS NOT NULL THEN
    -- Tra cứu cấp bậc người thao tác
    SELECT rank INTO actor_rank FROM public.profiles WHERE id = actor_uid;
    IF NOT FOUND THEN
      RAISE EXCEPTION '[LMS_PERMISSIONS] Không tìm thấy hồ sơ của người thao tác (uid: %).', actor_uid;
    END IF;

    -- Đảm bảo người thao tác phải có rank từ 80 trở lên (HR hoặc ADMIN/HIEU_TRUONG)
    IF actor_rank < 80 THEN
      RAISE EXCEPTION '[LMS_PERMISSIONS] Quyền hạn không hợp lệ. Bạn phải là Nhân sự (HR) trở lên mới được phân quyền.';
    END IF;
  END IF;

  -- 2. Tra cứu hồ sơ và vai trò gốc của tài khoản đối tượng cần sửa
  SELECT role, rank INTO target_role, target_rank FROM public.profiles WHERE id = target_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION '[LMS_PERMISSIONS] Không tìm thấy thông tin tài khoản đối tượng cần phân quyền.';
  END IF;

  -- 3. Đảm bảo phân tầng quyền lực: actor_rank > target_rank (chống gán quyền chéo hoặc vượt cấp)
  IF actor_uid IS NOT NULL AND actor_rank <= target_rank THEN
    RAISE EXCEPTION '[LMS_PERMISSIONS] Từ chối thao tác: Cấp bậc của bạn (rank %) không đủ cao để tác động lên tài khoản (rank %).', actor_rank, target_rank;
  END IF;

  -- 4. RÀNG BUỘC VAI TRÒ GỐC (Bắt buộc giữ ít nhất 1 quyền thuộc vai trò mặc định)
  -- Sử dụng toán tử INTERSECT để tìm giao lộ giữa mảng ID truyền lên và mảng ID mặc định của vai trò gốc.
  SELECT COUNT(*)
  INTO intersect_count
  FROM (
    SELECT unnest(assigned_permission_ids) AS perm_id
    INTERSECT
    SELECT permission_id FROM public.role_default_permissions WHERE role = target_role
  ) AS intersection;

  -- Nếu không tìm thấy quyền gốc nào thuộc vai trò mặc định, chặn giao dịch ngay lập tức
  IF intersect_count = 0 THEN
    RAISE EXCEPTION '[LMS_PERMISSIONS] Người dùng phải giữ ít nhất một chức năng thuộc vai trò mặc định của họ!';
  END IF;

  -- 5. ĐỒNG BỘ TRONG TRANSACTION (PostgreSQL tự động cô lập thành 1 Transaction nguyên tử)
  -- Xóa bỏ toàn bộ cấu hình cũ của user này
  DELETE FROM public.user_permissions WHERE user_id = target_user_id;

  -- Chèn danh sách các quyền mới được tùy chỉnh
  IF cardinality(assigned_permission_ids) > 0 THEN
    INSERT INTO public.user_permissions (user_id, permission_id)
    SELECT target_user_id, unnest(assigned_permission_ids)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION public.save_user_custom_permissions(UUID, BIGINT[]) IS
  '[SRP] Hàm bảo mật cập nhật quyền tùy chỉnh cấp người dùng và kiểm tra tính giao thoa của vai trò gốc.';
