-- ============================================================================
-- 10_add_dates_to_classes_and_proposals.sql — Bổ sung cột Ngày bắt đầu & Ngày kết thúc
-- ============================================================================

-- 1. Bổ sung cột cho bảng class_proposals
ALTER TABLE public.class_proposals ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE public.class_proposals ADD COLUMN IF NOT EXISTS end_date DATE;

-- 2. Bổ sung cột cho bảng classes
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS end_date DATE;
