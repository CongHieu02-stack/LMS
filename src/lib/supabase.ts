// ============================================================================
// lib/supabase.ts — Supabase Client (Frontend)
// Trách nhiệm DUY NHẤT: Khởi tạo và export Supabase client dùng anon key.
// Client này tuân thủ RLS — an toàn cho frontend.
// Dùng cho: Auth (login/logout) + Realtime subscriptions.
// ============================================================================

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '[LMS] Thiếu VITE_SUPABASE_URL hoặc VITE_SUPABASE_ANON_KEY trong .env'
  )
}

/**
 * Supabase Client — dùng anon key (tuân thủ RLS)
 * Sử dụng cho: Auth operations + Realtime channel subscriptions
 * Cấu hình sử dụng sessionStorage để cô lập phiên đăng nhập giữa các tab khác nhau
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: window.sessionStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})
