// ============================================================================
// controllers/authController.js — Controller xác thực
// Trách nhiệm DUY NHẤT: Điều phối xác minh session và trả thông tin user.
// KHÔNG truy vấn DB trực tiếp — gọi qua Model. KHÔNG format — gọi qua View.
// ============================================================================

import * as profileModel from '../models/profileModel.js'
import * as profileView from '../views/profileView.js'

/**
 * GET /api/auth/me — Trả thông tin profile của user đang đăng nhập.
 * Middleware authMiddleware đã gắn req.profile sẵn.
 */
export async function getMe(req, res) {
  try {
    // Profile đã được middleware gắn sẵn, nhưng lấy fresh data từ DB
    const profile = await profileModel.findById(req.user.id)

    if (!profile) {
      return res.status(404).json({ error: 'Không tìm thấy hồ sơ.' })
    }

    // Lấy danh sách mã quyền thực tế của user (có fallback về role mặc định)
    const permissions = await profileModel.findPermissionsByUserId(req.user.id, profile.role)

    return res.json({
      success: true,
      profile: profileView.formatProfile(profile, permissions)
    })
  } catch (err) {
    console.error('[AuthController.getMe]', err.message)
    return res.status(500).json({ error: 'Lỗi khi lấy thông tin tài khoản.' })
  }
}
