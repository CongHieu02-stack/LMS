-- ============================================================================
-- HỆ THỐNG LMS — SCRIPT DI CƯ (MIGRATION)
-- Tự động sinh mã MSSV cho các sinh viên đã tồn tại trước đó mà chưa có mã.
-- Định dạng: 'SV26' + số thứ tự được đệm 5 chữ số (Ví dụ: SV2600001, SV2600002)
-- Dải số bắt đầu từ 00001 sẽ không trùng với mã sinh viên tạo mới ngẫu nhiên 
-- từ giao diện (bắt đầu từ 10000 đến 99999).
-- ============================================================================

WITH numbered_students AS (
  SELECT 
    id, 
    ROW_NUMBER() OVER (ORDER BY created_at ASC) AS rn
  FROM public.profiles
  WHERE role = 'SINH_VIEN'::public.user_role 
    AND ("Mssv" IS NULL OR "Mssv" = '')
)
UPDATE public.profiles p
SET "Mssv" = 'SV' 
             || to_char(COALESCE(p.created_at, now()), 'YY') 
             || lpad(numbered_students.rn::text, 5, '0')
FROM numbered_students
WHERE p.id = numbered_students.id;
