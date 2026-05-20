-- ============================================================================
-- MIGRATION #05: Bổ sung các cột phục vụ nâng cấp 4 phân hệ Admin
-- Chạy script này trong Supabase SQL Editor
-- ============================================================================

-- 1. Bổ sung các cột cho bảng profiles (Quản lý Người dùng nâng cao)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_number TEXT DEFAULT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS lock_reason TEXT DEFAULT NULL;

-- 2. Bổ sung cột lý do từ chối cho bảng class_proposals (Duyệt đề xuất lớp học)
ALTER TABLE public.class_proposals ADD COLUMN IF NOT EXISTS rejection_reason TEXT DEFAULT NULL;
ALTER TABLE public.class_proposals ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.class_proposals ADD COLUMN IF NOT EXISTS lock_reason TEXT DEFAULT NULL;

-- 3. Bổ sung cột Khoa/Bộ môn cho bảng subjects (Quản lý Bộ môn)
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS department TEXT DEFAULT 'Công nghệ thông tin';

COMMENT ON COLUMN public.profiles.phone_number IS 'Số điện thoại liên lạc của người dùng';
COMMENT ON COLUMN public.profiles.is_locked IS 'Trạng thái khóa tài khoản (true = bị khóa, cấm đăng nhập)';
COMMENT ON COLUMN public.profiles.lock_reason IS 'Lý do khóa tài khoản';
COMMENT ON COLUMN public.class_proposals.rejection_reason IS 'Lý do từ chối duyệt đề xuất số lượng lớp';
COMMENT ON COLUMN public.subjects.department IS 'Tên Khoa hoặc Bộ môn quản lý môn học này';

-- 4. Tạo hàm RPC handle_admin_action xử lý tập trung tất cả hành động: DUYET, TU_CHOI, KHOA
CREATE OR REPLACE FUNCTION public.handle_admin_action(
  p_entity TEXT,        -- 'subject', 'class', 'department'
  p_target_id UUID,     -- ID của môn học, lớp học hoặc bộ môn
  p_action TEXT,        -- 'DUYET', 'TU_CHOI', 'KHOA'
  p_reason TEXT DEFAULT NULL -- Lý do từ chối hoặc lý do khóa
) RETURNS BOOLEAN AS $$
DECLARE
  v_authorized BOOLEAN := false;
BEGIN
  -- Kiểm tra dữ liệu lý do bắt buộc khi TU_CHOI hoặc KHOA
  IF p_action IN ('TU_CHOI', 'KHOA') AND (p_reason IS NULL OR trim(p_reason) = '') THEN
    RAISE EXCEPTION 'Lý do từ chối hoặc lý do khóa bắt buộc phải có.';
  END IF;

  -- 1. Xử lý cho học phần (subject)
  IF p_entity = 'subject' THEN
    IF p_action = 'DUYET' THEN
      UPDATE public.subjects 
      SET status = 'approved', rejection_reason = NULL, updated_at = now()
      WHERE id = p_target_id;
    ELSIF p_action = 'TU_CHOI' THEN
      UPDATE public.subjects 
      SET status = 'rejected', rejection_reason = p_reason, updated_at = now()
      WHERE id = p_target_id;
    ELSIF p_action = 'KHOA' THEN
      UPDATE public.subjects 
      SET is_locked = true, lock_reason = p_reason, updated_at = now()
      WHERE id = p_target_id;
    ELSE
      RAISE EXCEPTION 'Hành động không hợp lệ cho môn học.';
    END IF;
    RETURN true;

  -- 2. Xử lý cho lớp học (class)
  ELSIF p_entity = 'class' THEN
    IF p_action = 'DUYET' THEN
      UPDATE public.class_proposals 
      SET status = 'approved', rejection_reason = NULL, updated_at = now()
      WHERE id = p_target_id;
    ELSIF p_action = 'TU_CHOI' THEN
      UPDATE public.class_proposals 
      SET status = 'rejected', rejection_reason = p_reason, updated_at = now()
      WHERE id = p_target_id;
    ELSIF p_action = 'KHOA' THEN
      UPDATE public.class_proposals 
      SET is_locked = true, lock_reason = p_reason, updated_at = now()
      WHERE id = p_target_id;
    ELSE
      RAISE EXCEPTION 'Hành động không hợp lệ cho lớp học.';
    END IF;
    RETURN true;

  -- 3. Xử lý cho bộ môn (department)
  ELSIF p_entity = 'department' THEN
    IF p_action = 'DUYET' THEN
      UPDATE public.subjects
      SET status = 'approved', rejection_reason = NULL, updated_at = now()
      WHERE id = p_target_id;
    ELSIF p_action = 'TU_CHOI' THEN
      UPDATE public.subjects
      SET status = 'rejected', rejection_reason = p_reason, updated_at = now()
      WHERE id = p_target_id;
    ELSIF p_action = 'KHOA' THEN
      UPDATE public.subjects
      SET is_locked = true, lock_reason = p_reason, updated_at = now()
      WHERE id = p_target_id;
    ELSE
      RAISE EXCEPTION 'Hành động không hợp lệ cho bộ môn.';
    END IF;
    RETURN true;

  ELSE
    RAISE EXCEPTION 'Thực thể không hợp lệ.';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
