// ============================================================================
// stores/auth.ts — Pinia Store xác thực (Authentication)
// Trách nhiệm DUY NHẤT: Quản lý trạng thái đăng nhập, session, profile.
// KHÔNG chứa logic nghiệp vụ của lớp học, môn học, hay bài thi.
// ============================================================================

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import { apiGet } from '@/lib/api'

/**
 * Interface mô tả profile từ bảng public.profiles
 */
export interface UserProfile {
  id: string
  email: string
  fullName: string
  role: string
  rank: number
  displayRole: string
  avatarUrl: string | null
  createdAt: string
  updatedAt: string
  permissions: string[]
}

export const useAuthStore = defineStore('auth', () => {
  // ─── STATE ───
  /** Supabase Auth User object */
  const user = ref<Record<string, unknown> | null>(null)

  /** Profile từ bảng public.profiles (gồm role + rank) */
  const profile = ref<UserProfile | null>(null)

  /** Trạng thái đang tải */
  const loading = ref(false)

  /** Lỗi gần nhất */
  const error = ref<string | null>(null)

  // ─── GETTERS (Computed) ───

  /** Đã đăng nhập chưa */
  const isAuthenticated = computed(() => !!user.value && !!profile.value)

  /** Có phải Admin không (rank 100) */
  const isAdmin = computed(() => profile.value?.rank === 100)

  /** Có phải Hiệu trưởng không (rank 90) */
  const isHieuTruong = computed(() => profile.value?.rank === 90)

  /** Có phải HR không (rank 80) */
  const isHR = computed(() => profile.value?.rank === 80)

  /** Role hiển thị tiếng Việt */
  const displayRole = computed(() => profile.value?.displayRole || '')

  /** Kiểm tra user có sở hữu quyền cụ thể không */
  function hasPermission(code: string): boolean {
    // Admin và Hiệu trưởng (Rank >= 90) có toàn quyền truy cập chức năng (Super User)
    if (profile.value && profile.value.rank >= 90) {
      return true
    }
    return profile.value?.permissions?.includes(code) || false
  }

  /**
   * Kiểm tra rank của user hiện tại có CAO HƠN targetRank không.
   * Dùng để ẩn/hiện UI elements dựa trên quyền.
   * @param targetRank — Rank cần so sánh
   * @returns boolean
   */
  function hasHigherRankThan(targetRank: number): boolean {
    return (profile.value?.rank ?? 0) > targetRank
  }

  /**
   * Kiểm tra rank >= minRank (bằng hoặc cao hơn)
   * @param minRank — Rank tối thiểu
   */
  function hasMinRank(minRank: number): boolean {
    return (profile.value?.rank ?? 0) >= minRank
  }

  // ─── ACTIONS ───

  /**
   * Đăng nhập bằng email + password qua Supabase Auth.
   * Sau khi đăng nhập thành công, tự động fetch profile từ backend.
   */
  async function login(email: string, password: string): Promise<boolean> {
    loading.value = true
    error.value = null

    try {
      // Bước 1: Xác thực qua Supabase Auth
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (authError) {
        error.value = authError.message
        return false
      }

      user.value = data.user as unknown as Record<string, unknown>

      // Bước 2: Fetch profile từ backend API
      await fetchCurrentProfile()

      return true
    } catch (err) {
      error.value = (err as Error).message
      return false
    } finally {
      loading.value = false
    }
  }

  /**
   * Đăng xuất — Xóa session Supabase và reset state.
   */
  async function logout(): Promise<void> {
    loading.value = true
    try {
      await supabase.auth.signOut()
    } finally {
      user.value = null
      profile.value = null
      error.value = null
      loading.value = false
    }
  }

  /**
   * Lấy profile hiện tại từ backend API /api/auth/me.
   * Gọi sau khi đăng nhập hoặc khi app khởi động (nếu có session).
   */
  async function fetchCurrentProfile(): Promise<void> {
    try {
      const response = await apiGet<{ success: boolean; profile: UserProfile }>('/auth/me')
      if (response.success && response.profile) {
        profile.value = response.profile
      }
    } catch (err) {
      console.error('[AuthStore] Không thể lấy profile:', (err as Error).message)
      profile.value = null
    }
  }

  /**
   * Khởi tạo auth state từ session Supabase hiện tại (nếu có).
   * Gọi một lần khi app mount.
   */
  async function initialize(): Promise<void> {
    loading.value = true
    try {
      const { data: { session } } = await supabase.auth.getSession()

      if (session?.user) {
        user.value = session.user as unknown as Record<string, unknown>
        await fetchCurrentProfile()
      }
    } catch (err) {
      console.error('[AuthStore] Lỗi khởi tạo:', (err as Error).message)
    } finally {
      loading.value = false
    }

    // Lắng nghe thay đổi auth state (token refresh, logout từ tab khác, ...)
    supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        user.value = session.user as unknown as Record<string, unknown>
      } else {
        user.value = null
        profile.value = null
      }
    })
  }

  return {
    // State
    user,
    profile,
    loading,
    error,

    // Getters
    isAuthenticated,
    isAdmin,
    isHieuTruong,
    isHR,
    displayRole,

    // Methods
    hasPermission,
    hasHigherRankThan,
    hasMinRank,
    login,
    logout,
    fetchCurrentProfile,
    initialize
  }
})
