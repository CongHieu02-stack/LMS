-- ============================================================================
-- HỆ THỐNG LMS — SQL MIGRATION #01
-- Mục đích: Tạo bảng school_configs và chuẩn bị dữ liệu test môn học
-- ============================================================================

-- 1. TẠO BẢNG CẤU HÌNH TRƯỜNG
CREATE TABLE IF NOT EXISTS public.school_configs (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  description TEXT DEFAULT '',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bật RLS
ALTER TABLE public.school_configs ENABLE ROW LEVEL SECURITY;

-- Cấp quyền SELECT cho tất cả người dùng authenticated
CREATE POLICY "configs_select_all"
  ON public.school_configs FOR SELECT
  TO authenticated
  USING (true);

-- Cấp quyền UPDATE cho Admin (rank >= 90: Hiệu trưởng & Admin)
CREATE POLICY "configs_update_admin"
  ON public.school_configs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.rank >= 90
    )
  );

-- Chèn dữ liệu cấu hình mẫu
INSERT INTO public.school_configs (key, value, description)
VALUES 
  ('school_name', 'Frappe School', 'Tên trường học hiển thị chính'),
  ('current_semester', 'Học kỳ 1 / 2026-2027', 'Học kỳ đào tạo hiện tại'),
  ('school_status', 'active', 'Trạng thái hoạt động của trường (active/maintenance)')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    description = EXCLUDED.description;


-- 2. CHÈN MỘT SỐ MÔN HỌC MẪU ĐỂ TEST TÍNH NĂNG DUYỆT MÔN
-- (Môn học có status = 'pending' để Hiệu trưởng và Admin có thể duyệt)
INSERT INTO public.subjects (code, name, description, credits, status)
VALUES
  ('CS102', 'Lập trình hướng đối tượng với Java', 'Môn học tiếp theo của CS101, giới thiệu OOP', 3, 'pending'),
  ('MATH202', 'Đại số tuyến tính nâng cao', 'Giải quyết các vấn đề không gian Vector và Ma trận', 4, 'pending'),
  ('ENG101', 'Tiếng Anh giao tiếp cơ bản', 'Kỹ năng nghe nói đọc viết cơ bản', 2, 'pending')
ON CONFLICT (code) DO NOTHING;
