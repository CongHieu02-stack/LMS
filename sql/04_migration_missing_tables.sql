-- ============================================================================
-- MIGRATION #04: Bổ sung bảng & cột còn thiếu cho LMS
-- Chạy trong Supabase SQL Editor
-- ============================================================================

-- 1. BẢNG ĐỀ XUẤT SỐ LƯỢNG LỚP
CREATE TABLE IF NOT EXISTS public.class_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  proposed_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  semester TEXT NOT NULL DEFAULT '',
  reason TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.class_proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "class_proposals_all_authenticated" ON public.class_proposals FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. THÊM CỘT manager_id cho classes
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 3. THÊM CỘT created_by cho subjects (nếu chưa có alias)
-- (Đã có created_by trong 00_init.sql)

-- 4. BỔ SUNG CÁC CỘT THIẾU CHO BẢNG classes ĐỂ PHÙ HỢP VỚI MVC
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS max_slots INTEGER DEFAULT 50;
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS remaining_slots INTEGER DEFAULT 50;
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS schedule TEXT;
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS room TEXT;

-- 5. KHIÊN KHÓA NGOẠI CHO class_registrations (VÌ BẢNG classes BỊ RE-CREATE LÀM MẤT KHÓA NGOẠI)
ALTER TABLE public.class_registrations 
  DROP CONSTRAINT IF EXISTS class_registrations_class_id_fkey,
  ADD CONSTRAINT class_registrations_class_id_fkey 
  FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE;
