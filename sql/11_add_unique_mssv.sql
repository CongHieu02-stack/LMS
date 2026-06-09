-- ============================================================================
-- HỆ THỐNG LMS — SCRIPT DI CƯ (MIGRATION)
-- Thêm ràng buộc UNIQUE cho cột Mssv trong bảng profiles
-- ============================================================================

ALTER TABLE public.profiles ADD CONSTRAINT unique_mssv UNIQUE ("Mssv");
