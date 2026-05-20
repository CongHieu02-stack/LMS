// ============================================================================
// middleware/authMiddleware.js — JWT Authentication Middleware
// Trách nhiệm DUY NHẤT: Xác thực JWT token từ header Authorization.
// Gắn req.user (auth user) và req.profile (profiles row) vào request.
// KHÔNG chứa logic phân quyền hay business rules.
// ============================================================================

import { supabaseAdmin } from '../config/supabase.js'
import * as profileModel from '../models/profileModel.js'

/**
 * Middleware xác thực — Verify Bearer token và gắn user info vào request.
 * Sử dụng: router.get('/protected', authMiddleware, controller.handler)
 */
export async function authMiddleware(req, res, next) {
  try {
    // Bước 1: Trích xuất token từ header
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Thiếu token xác thực. Vui lòng đăng nhập.',
      })
    }

    const token = authHeader.replace('Bearer ', '')

    // Bước 2: Verify token với Supabase
    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      console.warn(
        '[authMiddleware] Supabase auth.getUser failed:',
        authError?.message || 'No user',
      )
      return res.status(401).json({
        error: 'Token không hợp lệ hoặc đã hết hạn.',
      })
    }

    // Bước 3: Lấy profile kèm role + rank
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, role, rank, avatar_url')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return res.status(403).json({
        error: 'Không tìm thấy hồ sơ người dùng.',
      })
    }

    // Bước 4: Gắn thông tin vào request object
    req.user = user
    req.profile = profile

    next()
  } catch (err) {
    console.error('[Auth Middleware]', err.message)
    return res.status(500).json({ error: 'Lỗi xác thực nội bộ.' })
  }
}

/**
 * Middleware kiểm tra rank tối thiểu — Factory function.
 * Sử dụng: router.post('/admin', authMiddleware, requireRank(80), controller)
 * Trách nhiệm DUY NHẤT: Kiểm tra rank >= minRank. Không làm gì khác.
 */
export function requireRank(minRank) {
  return (req, res, next) => {
    if (!req.profile || req.profile.rank < minRank) {
      return res.status(403).json({
        error: `Yêu cầu rank tối thiểu ${minRank}. Rank hiện tại: ${req.profile?.rank || 0}.`,
      })
    }
    next()
  }
}

/**
 * Middleware kiểm tra permission hoặc rank tối thiểu.
 * Cho phép truy cập nếu user có rank >= minRank HOẶC có permissionCode.
 */
export function requirePermissionOrRank(permissionCode, minRank = 100) {
  return async (req, res, next) => {
    if (!req.profile) {
      return res.status(403).json({ error: 'Không tìm thấy hồ sơ người dùng.' })
    }

    try {
      // Lấy quyền cụ thể của user
      const permissions = await profileModel.findPermissionsByUserId(
        req.profile.id,
        req.profile.role,
      )
      req.permissions = permissions // Gắn vào request để controller dùng

      // Nếu đạt yêu cầu về Rank HOẶC có quyền -> Cho qua
      if (req.profile.rank >= minRank || permissions.includes(permissionCode)) {
        return next()
      }

      return res.status(403).json({
        error: `Bạn không có quyền thực hiện chức năng này. Yêu cầu quyền: ${permissionCode}`,
      })
    } catch (err) {
      console.error('[requirePermissionOrRank]', err.message)
      return res.status(500).json({ error: 'Lỗi khi kiểm tra quyền truy cập.' })
    }
  }
}
