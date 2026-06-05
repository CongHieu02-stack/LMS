/**
 * Script chạy migration SQL lên Supabase bằng REST API
 * Sử dụng: node scripts/run_migration.mjs
 */

const SUPABASE_URL = 'https://vixdlfyidrlrjdegzeao.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpeGRsZnlpZHJscmpkZWd6ZWFvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTA4NDE4MCwiZXhwIjoyMDk0NjYwMTgwfQ.K7vuo4yhMDwj9mgfhRr7s2Rv-4_hef1Bp3xMTsm8sx0'

const sql = `
-- Tạo bảng lưu lịch sử hoạt động (activity_logs)
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  action      TEXT NOT NULL,
  details     TEXT,
  ip_address  TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index tăng tốc truy vấn
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at DESC);

-- Kích hoạt RLS
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Policy: chỉ ADMIN (rank 100) mới được SELECT
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'activity_logs' AND policyname = 'activity_logs_select_admin'
  ) THEN
    CREATE POLICY "activity_logs_select_admin" ON public.activity_logs
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.rank = 100
        )
      );
  END IF;
END $$;

-- Policy: cho phép Authenticated INSERT log của chính họ
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'activity_logs' AND policyname = 'activity_logs_insert_authenticated'
  ) THEN
    CREATE POLICY "activity_logs_insert_authenticated" ON public.activity_logs
      FOR INSERT TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- Policy: service_role có thể INSERT (cho backend dùng service role key)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'activity_logs' AND policyname = 'activity_logs_insert_service_role'
  ) THEN
    CREATE POLICY "activity_logs_insert_service_role" ON public.activity_logs
      FOR INSERT TO service_role WITH CHECK (true);
  END IF;
END $$;

-- Policy: service_role có thể SELECT (cho backend dùng service role key)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'activity_logs' AND policyname = 'activity_logs_select_service_role'
  ) THEN
    CREATE POLICY "activity_logs_select_service_role" ON public.activity_logs
      FOR SELECT TO service_role USING (true);
  END IF;
END $$;

COMMENT ON TABLE public.activity_logs IS 'Bảng lưu vết lịch sử hoạt động của người dùng trên hệ thống';
`

async function runMigration() {
  console.log('🚀 Đang chạy migration tạo bảng activity_logs...')

  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    }
  })

  // Supabase hỗ trợ execute SQL qua endpoint /rest/v1/rpc hoặc dùng pg-meta
  // Dùng supabase-js để chạy SQL trực tiếp
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  // Dùng rpc để chạy SQL (cần function exec_sql hoặc dùng pg-meta)
  // Thử qua pg-meta API
  const pgMetaUrl = `${SUPABASE_URL.replace('.supabase.co', '')}/pg-meta/v1/query`
  
  try {
    const res = await fetch(`https://vixdlfyidrlrjdegzeao.supabase.co/rest/v1/`, {
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      }
    })
    console.log('Supabase reachable:', res.status)
  } catch (e) {
    console.error('Cannot reach Supabase:', e.message)
  }

  // Thử dùng Supabase Management API để execute SQL
  try {
    const projectRef = 'vixdlfyidrlrjdegzeao'
    const managementRes = await fetch(
      `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ query: sql })
      }
    )
    const data = await managementRes.json()
    if (!managementRes.ok) {
      console.error('Management API error:', JSON.stringify(data, null, 2))
    } else {
      console.log('✅ Migration thành công qua Management API:', JSON.stringify(data, null, 2))
    }
  } catch (e) {
    console.error('Management API failed:', e.message)
  }
}

runMigration().catch(console.error)
