/**
 * Tạo bảng activity_logs trực tiếp qua Supabase Management API
 * Chạy: node backend/scripts/create_activity_logs_table.mjs
 */

const PROJECT_REF = 'vixdlfyidrlrjdegzeao'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpeGRsZnlpZHJscmpkZWd6ZWFvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTA4NDE4MCwiZXhwIjoyMDk0NjYwMTgwfQ.K7vuo4yhMDwj9mgfhRr7s2Rv-4_hef1Bp3xMTsm8sx0'

// Supabase pg-meta endpoint (available internally via service role)
const PG_META_URL = `https://${PROJECT_REF}.supabase.co/pg-meta/v1/query`

const sql = `
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  action      TEXT NOT NULL,
  details     TEXT,
  ip_address  TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at DESC);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'activity_logs' AND policyname = 'activity_logs_select_service_role') THEN
    CREATE POLICY "activity_logs_select_service_role" ON public.activity_logs FOR SELECT TO service_role USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'activity_logs' AND policyname = 'activity_logs_insert_service_role') THEN
    CREATE POLICY "activity_logs_insert_service_role" ON public.activity_logs FOR INSERT TO service_role WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'activity_logs' AND policyname = 'activity_logs_select_admin') THEN
    CREATE POLICY "activity_logs_select_admin" ON public.activity_logs FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.rank = 100));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'activity_logs' AND policyname = 'activity_logs_insert_authenticated') THEN
    CREATE POLICY "activity_logs_insert_authenticated" ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
`

async function run() {
  console.log('🚀 Gửi SQL tạo bảng activity_logs đến Supabase pg-meta...')

  const res = await fetch(PG_META_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ query: sql })
  })

  const text = await res.text()
  console.log(`Status: ${res.status}`)
  console.log('Response:', text)

  if (res.ok) {
    console.log('\n✅ Bảng activity_logs đã được tạo thành công!')
  } else {
    console.log('\n⚠️  pg-meta không khả dụng. Vui lòng chạy SQL thủ công:')
    console.log('   👉 https://supabase.com/dashboard/project/vixdlfyidrlrjdegzeao/sql/new')
    console.log('   Dán nội dung file: sql/09_add_activity_logs.sql rồi nhấn Run')
  }
}

run().catch(console.error)
