// ============================================================================
// controllers/profileController.js — Controller quản lý profiles
// Trách nhiệm DUY NHẤT: Điều phối nghiệp vụ CRUD profile.
// Kiểm tra rank hierarchy trước khi cho phép update/delete.
// Gọi Model để truy vấn, gọi View để format response.
// ============================================================================

import * as profileModel from '../models/profileModel.js'
import * as profileView from '../views/profileView.js'
import { supabaseAdmin } from '../config/supabase.js'

/**
 * GET /api/profiles — Lấy danh sách tất cả profiles.
 * Yêu cầu: rank >= 50 (Giảng viên trở lên).
 */
export async function getAll(req, res) {
  try {
    const profiles = await profileModel.findAll()
    return res.json(profileView.formatProfileList(profiles))
  } catch (err) {
    console.error('[ProfileController.getAll]', err.message)
    return res.status(500).json({ error: 'Lỗi khi lấy danh sách hồ sơ.' })
  }
}

/**
 * GET /api/profiles/:id — Lấy profile theo ID.
 */
export async function getById(req, res) {
  try {
    const profile = await profileModel.findById(req.params.id)
    if (!profile) {
      return res.status(404).json({ error: 'Không tìm thấy hồ sơ.' })
    }
    return res.json({ success: true, profile: profileView.formatProfile(profile) })
  } catch (err) {
    console.error('[ProfileController.getById]', err.message)
    return res.status(500).json({ error: 'Lỗi khi lấy hồ sơ.' })
  }
}

/**
 * PUT /api/profiles/:id/role — Cập nhật role (phân quyền).
 * Business rule: Actor phải có rank CAO HƠN target.
 */
export async function updateRole(req, res) {
  try {
    const { role } = req.body
    const targetId = req.params.id

    let effectiveRank = req.profile.rank
    const perms = req.permissions || []
    if (perms.includes('user_manage_senior')) effectiveRank = Math.max(effectiveRank, 90)
    else if (perms.includes('user_manage_staff')) effectiveRank = Math.max(effectiveRank, 80)

    // Kiểm tra role hợp lệ
    const validRoles = [
      'ADMIN',
      'HIEU_TRUONG',
      'HR',
      'PHONG_DAO_TAO',
      'TRUONG_BO_MON',
      'GIANG_VIEN',
      'SINH_VIEN',
    ]
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: `Role không hợp lệ: ${role}` })
    }

    // Lấy profile đối tượng để kiểm tra rank
    const targetProfile = await profileModel.findById(targetId)
    if (!targetProfile) {
      return res.status(404).json({ error: 'Không tìm thấy hồ sơ đối tượng.' })
    }

    // Bảo vệ phân tầng: actor phải có rank CAO HƠN target
    if (effectiveRank <= targetProfile.rank) {
      return res.status(403).json({
        error: `Quyền của bạn (hiệu lực rank ${effectiveRank}) không đủ tác động đối tượng có rank (${targetProfile.rank}).`,
      })
    }

    // Không cho phép tạo user có rank >= actor
    const RANK_MAP = {
      ADMIN: 100,
      HIEU_TRUONG: 90,
      HR: 80,
      PHONG_DAO_TAO: 70,
      TRUONG_BO_MON: 60,
      GIANG_VIEN: 50,
      SINH_VIEN: 10,
    }
    if (RANK_MAP[role] >= effectiveRank) {
      return res.status(403).json({
        error: `Bạn không thể gán role ${role} (rank ${RANK_MAP[role]}) vì quyền của bạn chỉ giới hạn ở rank ${effectiveRank}.`,
      })
    }

    const updated = await profileModel.updateRole(targetId, role)
    return res.json({
      success: true,
      message: `Đã cập nhật role thành ${role}.`,
      profile: profileView.formatProfile(updated),
    })
  } catch (err) {
    console.error('[ProfileController.updateRole]', err.message)
    return res.status(500).json({ error: 'Lỗi khi cập nhật quyền.' })
  }
}

/**
 * PUT /api/profiles/:id — Cập nhật thông tin cá nhân (full_name, avatar_url).
 * Chỉ chính chủ hoặc admin mới được phép.
 */
export async function updateInfo(req, res) {
  try {
    const targetId = req.params.id
    const actorId = req.user.id

    let effectiveRank = req.profile.rank
    const perms = req.permissions || []
    if (perms.includes('user_manage_senior')) effectiveRank = Math.max(effectiveRank, 90)
    else if (perms.includes('user_manage_staff')) effectiveRank = Math.max(effectiveRank, 80)

    // Chỉ chính chủ hoặc rank >= 80 mới được sửa
    if (targetId !== actorId && effectiveRank < 80) {
      return res.status(403).json({ error: 'Bạn không có quyền sửa hồ sơ này.' })
    }

    const updated = await profileModel.updateInfo(targetId, req.body)
    return res.json({
      success: true,
      profile: profileView.formatProfile(updated),
    })
  } catch (err) {
    console.error('[ProfileController.updateInfo]', err.message)
    return res.status(500).json({ error: 'Lỗi khi cập nhật hồ sơ.' })
  }
}

/**
 * POST /api/profiles — Admin hoặc Hiệu trưởng tạo tài khoản mới.
 * Yêu cầu: rank >= 90 (ADMIN hoặc HIEU_TRUONG).
 */
export async function createProfile(req, res) {
  try {
    const { email, password, fullName, role } = req.body
    let effectiveRank = req.profile.rank
    const perms = req.permissions || []
    if (perms.includes('user_manage_senior')) effectiveRank = Math.max(effectiveRank, 90)
    else if (perms.includes('user_manage_staff')) effectiveRank = Math.max(effectiveRank, 80)

    const validRoles = [
      'ADMIN',
      'HIEU_TRUONG',
      'HR',
      'PHONG_DAO_TAO',
      'TRUONG_BO_MON',
      'GIANG_VIEN',
      'SINH_VIEN',
    ]
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: `Role không hợp lệ: ${role}` })
    }

    // Bảo vệ nghiêm ngặt: Không được phép tạo tài khoản có rank >= actor
    const RANK_MAP = {
      ADMIN: 100,
      HIEU_TRUONG: 90,
      HR: 80,
      PHONG_DAO_TAO: 70,
      TRUONG_BO_MON: 60,
      GIANG_VIEN: 50,
      SINH_VIEN: 10,
    }
    if (RANK_MAP[role] > effectiveRank) {
      return res.status(403).json({
        error: `Bạn không thể tạo tài khoản có vai trò ${role} (rank ${RANK_MAP[role]}) vì quyền của bạn giới hạn ở rank ${effectiveRank}.`,
      })
    }

    // 1. Tạo tài khoản trong auth.users bằng Admin API (tự xác thực email)
    const { data, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    })

    if (authError) {
      return res.status(400).json({ error: authError.message })
    }

    const newUser = data.user

    // 2. Tạo profile row tương ứng
    const profile = await profileModel.createProfile(newUser.id, email, fullName, role)

    return res.status(201).json({
      success: true,
      message: `Tạo tài khoản "${fullName}" với vai trò ${role} thành công.`,
      profile: profileView.formatProfile(profile),
    })
  } catch (err) {
    console.error('[ProfileController.createProfile]', err.message)
    return res.status(500).json({ error: 'Lỗi khi tạo tài khoản nhân sự.' })
  }
}

/**
 * DELETE /api/profiles/:id — Xóa profile.
 * Business rule: Actor phải có rank CAO HƠN target. Admin không thể bị xóa.
 * HIEU_TRUONG (90) có thể xóa HR (80) trở xuống, nhưng không thể xóa HIEU_TRUONG khác hoặc ADMIN.
 */
export async function deleteProfile(req, res) {
  try {
    const targetId = req.params.id

    let effectiveRank = req.profile.rank
    const perms = req.permissions || []
    if (perms.includes('user_manage_senior')) effectiveRank = Math.max(effectiveRank, 90)
    else if (perms.includes('user_manage_staff')) effectiveRank = Math.max(effectiveRank, 80)

    const targetProfile = await profileModel.findById(targetId)
    if (!targetProfile) {
      return res.status(404).json({ error: 'Không tìm thấy hồ sơ.' })
    }

    // ADMIN được bảo vệ tuyệt đối
    if (targetProfile.rank === 100 || targetProfile.role === 'ADMIN') {
      return res
        .status(403)
        .json({ error: 'Tài khoản ADMIN được bảo vệ tuyệt đối, không thể xóa.' })
    }

    // Kiểm tra phân tầng: actor phải có rank CAO HƠN target
    if (effectiveRank <= targetProfile.rank) {
      return res.status(403).json({
        error: `Quyền hạn của bạn (rank hiệu lực ${effectiveRank}) không đủ để xóa tài khoản này (rank ${targetProfile.rank}).`,
      })
    }

    // 1. Xóa tài khoản trong auth.users bằng Admin API
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(targetId)
    if (authError) {
      console.warn(
        '[ProfileController.deleteProfile] Không thể xóa ở Supabase Auth:',
        authError.message,
      )
      if (
        !authError.message.toLowerCase().includes('user not found') &&
        !authError.message.toLowerCase().includes('does not exist')
      ) {
        return res.status(400).json({ error: `Lỗi xóa tài khoản Auth: ${authError.message}` })
      }
    }

    // 2. Xóa profile tương ứng trong database
    // Do có ON DELETE CASCADE, dòng trong profiles có thể đã bị xóa tự động khi xóa Auth.
    // Vì vậy nếu không tìm thấy để xóa nữa, ta vẫn dùng targetProfile đã có để trả về kết quả thành công.
    let deleted
    try {
      deleted = await profileModel.deleteById(targetId)
    } catch (dbErr) {
      console.log(
        '[ProfileController.deleteProfile] Profile đã được cascade delete hoặc lỗi db:',
        dbErr.message,
      )
      deleted = targetProfile
    }
    return res.json(profileView.formatDeleteResult(deleted))
  } catch (err) {
    console.error('[ProfileController.deleteProfile]', err.message)
    return res.status(500).json({ error: 'Lỗi khi xóa hồ sơ.' })
  }
}

/**
 * POST /api/profiles/:id/avatar — Tải lên avatar dạng base64
 * Chỉ chính chủ hoặc admin (rank >= 80) mới được phép.
 */
export async function uploadAvatar(req, res) {
  try {
    const targetId = req.params.id
    const actorId = req.user.id
    const { avatarData } = req.body

    if (!avatarData) {
      return res.status(400).json({ error: 'Thiếu dữ liệu ảnh (avatarData dạng base64).' })
    }

    let effectiveRank = req.profile.rank
    const perms = req.permissions || []
    if (perms.includes('user_manage_senior')) effectiveRank = Math.max(effectiveRank, 90)
    else if (perms.includes('user_manage_staff')) effectiveRank = Math.max(effectiveRank, 80)

    // Chỉ chính chủ hoặc rank >= 80 mới được sửa
    if (targetId !== actorId && effectiveRank < 80) {
      return res
        .status(403)
        .json({ error: 'Bạn không có quyền cập nhật ảnh đại diện của hồ sơ này.' })
    }

    // 1. Giải mã base64
    const matches = avatarData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/)
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ error: 'Định dạng ảnh Base64 không hợp lệ.' })
    }

    const contentType = matches[1]
    const buffer = Buffer.from(matches[2], 'base64')

    // Lấy phần mở rộng của file dựa trên content type
    let extension = 'png'
    if (contentType.includes('jpeg') || contentType.includes('jpg')) extension = 'jpg'
    else if (contentType.includes('gif')) extension = 'gif'
    else if (contentType.includes('webp')) extension = 'webp'

    const fileName = `${targetId}-${Date.now()}.${extension}`

    // 2. Kiểm tra/Tạo bucket 'avatars' public nếu chưa có
    try {
      await supabaseAdmin.storage.createBucket('avatars', { public: true })
    } catch (e) {
      // Bỏ qua lỗi nếu đã tồn tại
    }

    // 3. Upload file lên bucket
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('avatars')
      .upload(fileName, buffer, {
        contentType,
        upsert: true,
      })

    if (uploadError) {
      console.error('[ProfileController.uploadAvatar] Upload error:', uploadError)
      return res.status(500).json({ error: 'Lỗi khi tải ảnh lên storage.' })
    }

    // 4. Lấy public URL
    const { data: publicUrlData } = supabaseAdmin.storage.from('avatars').getPublicUrl(fileName)

    const avatarUrl = publicUrlData.publicUrl

    // 5. Cập nhật avatar_url trong CSDL
    const updated = await profileModel.updateInfo(targetId, { avatar_url: avatarUrl })

    return res.json({
      success: true,
      message: 'Tải lên ảnh đại diện thành công.',
      avatarUrl,
      profile: profileView.formatProfile(updated),
    })
  } catch (err) {
    console.error('[ProfileController.uploadAvatar]', err.message)
    return res.status(500).json({ error: 'Lỗi máy chủ khi cập nhật ảnh đại diện.' })
  }
}

/**
 * PUT /api/profiles/:id/lock — Khóa hoặc mở khóa tài khoản người dùng
 */
export async function lockProfile(req, res) {
  try {
    const targetId = req.params.id
    const { isLocked, reason } = req.body

    let effectiveRank = req.profile.rank
    const perms = req.permissions || []
    if (perms.includes('user_manage_senior')) effectiveRank = Math.max(effectiveRank, 90)
    else if (perms.includes('user_manage_staff')) effectiveRank = Math.max(effectiveRank, 80)

    const targetProfile = await profileModel.findById(targetId)
    if (!targetProfile) {
      return res.status(404).json({ error: 'Không tìm thấy hồ sơ người dùng.' })
    }

    if (effectiveRank <= targetProfile.rank) {
      return res.status(403).json({
        error: `Quyền của bạn không đủ để khóa/mở khóa tài khoản này.`
      })
    }

    if (isLocked && (!reason || reason.trim() === '')) {
      return res.status(400).json({ error: 'Khóa tài khoản bắt buộc phải nhập lý do.' })
    }

    const updated = await profileModel.updateLockStatus(targetId, !!isLocked, isLocked ? reason.trim() : null)

    return res.json({
      success: true,
      message: isLocked ? 'Đã khóa tài khoản thành công.' : 'Đã mở khóa tài khoản thành công.',
      profile: profileView.formatProfile(updated)
    })
  } catch (err) {
    console.error('[ProfileController.lockProfile]', err.message)
    return res.status(500).json({ error: 'Lỗi khi cập nhật trạng thái khóa.' })
  }
}

/**
 * POST /api/profiles/:id/reset-password — Reset mật khẩu người dùng
 */
export async function resetPassword(req, res) {
  try {
    const targetId = req.params.id

    let effectiveRank = req.profile.rank
    const perms = req.permissions || []
    if (perms.includes('user_manage_senior')) effectiveRank = Math.max(effectiveRank, 90)
    else if (perms.includes('user_manage_staff')) effectiveRank = Math.max(effectiveRank, 80)

    const targetProfile = await profileModel.findById(targetId)
    if (!targetProfile) {
      return res.status(404).json({ error: 'Không tìm thấy hồ sơ người dùng.' })
    }

    if (effectiveRank <= targetProfile.rank) {
      return res.status(403).json({
        error: `Quyền của bạn không đủ để gửi email đặt lại mật khẩu cho tài khoản này.`
      })
    }

    // Gửi email khôi phục mật khẩu từ Supabase GoTrue
    const redirectToUrl = `${req.headers.origin || 'http://localhost:5173'}/reset-password`
    const { error: authError } = await supabaseAdmin.auth.resetPasswordForEmail(targetProfile.email, {
      redirectTo: redirectToUrl,
    })

    if (authError) {
      return res.status(400).json({ error: authError.message })
    }

    return res.json({
      success: true,
      message: `Đã gửi liên kết đặt lại mật khẩu đến email "${targetProfile.email}" thành công.`
    })
  } catch (err) {
    console.error('[ProfileController.resetPassword]', err.message)
    return res.status(500).json({ error: 'Lỗi khi gửi email đặt lại mật khẩu.' })
  }
}

