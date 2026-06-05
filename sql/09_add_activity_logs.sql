-- ============================================================================
-- MIGRATION #09: Tạo bảng lưu lịch sử hoạt động (activity_logs)
-- Chạy script này trong Supabase SQL Editor
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  action      TEXT NOT NULL,          -- Ví dụ: 'CREATE_PROFILE', 'LOCK_USER', 'REGISTER_CLASS', 'SUBMIT_EXAM', etc.
  details     TEXT,                   -- Mô tả chi tiết hành động
  ip_address  TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index tăng tốc truy vấn tìm kiếm logs theo user và thời gian
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at);

-- Kích hoạt RLS (Row Level Security) cho bảng activity_logs
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- 1. Chỉ cho phép ADMIN (rank 100) truy vấn (SELECT) lịch sử hoạt động
CREATE POLICY "activity_logs_select_admin" ON public.activity_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.rank = 100
    )
  );

-- 2. Cho phép người dùng đã xác thực (Authenticated) tự thêm mới (INSERT) log của chính họ
CREATE POLICY "activity_logs_insert_authenticated" ON public.activity_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
  );

COMMENT ON TABLE public.activity_logs IS 'Bảng lưu vết lịch sử hoạt động của người dùng trên hệ thống';
COMMENT ON COLUMN public.activity_logs.action IS 'Loại hành động của người dùng';
COMMENT ON COLUMN public.activity_logs.details IS 'Mô tả chi tiết hành động thực hiện';
