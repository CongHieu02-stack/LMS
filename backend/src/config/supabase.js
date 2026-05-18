// ============================================================================
// config/supabase.js — Supabase Admin Client
// Trách nhiệm DUY NHẤT: Khởi tạo và export Supabase client dùng service_role.
// Client này bypass RLS — chỉ dùng trong backend, KHÔNG BAO GIỜ lộ ra FE.
// ============================================================================

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    '[LMS Config] Thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY trong .env'
  )
}

/**
 * Supabase Admin Client — dùng service_role key
 * Bypass Row Level Security, dùng cho các thao tác backend cần full access.
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})
