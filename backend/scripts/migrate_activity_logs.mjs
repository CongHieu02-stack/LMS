/**
 * Script tạo bảng activity_logs trên Supabase
 * Chạy: node backend/scripts/migrate_activity_logs.mjs
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://vixdlfyidrlrjdegzeao.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpeGRsZnlpZHJscmpkZWd6ZWFvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTA4NDE4MCwiZXhwIjoyMDk0NjYwMTgwfQ.K7vuo4yhMDwj9mgfhRr7s2Rv-4_hef1Bp3xMTsm8sx0'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

async function migrate() {
  console.log('🔍 Kiểm tra bảng activity_logs...')

  // Kiểm tra bảng tồn tại chưa bằng cách thử SELECT
  const { data, error } = await supabase
    .from('activity_logs')
    .select('id')
    .limit(1)

  if (!error) {
    console.log('✅ Bảng activity_logs đã tồn tại, không cần tạo lại.')
    process.exit(0)
  }

  if (error && error.code !== '42P01') {
    // code 42P01 = table does not exist — other errors are real issues
    console.error('❌ Lỗi không mong muốn khi kiểm tra bảng:', error.message)
    process.exit(1)
  }

  console.log('📋 Bảng chưa tồn tại. Tiến hành tạo...')
  console.log('')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('⚠️  Không thể tự động tạo bảng qua supabase-js client.')
  console.log('    Vui lòng thực hiện THỦ CÔNG bằng cách:')
  console.log('')
  console.log('    1. Mở: https://supabase.com/dashboard/project/vixdlfyidrlrjdegzeao/sql/new')
  console.log('    2. Dán nội dung file: sql/09_add_activity_logs.sql')
  console.log('    3. Nhấn "Run" để tạo bảng')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  process.exit(1)
}

migrate().catch(console.error)
