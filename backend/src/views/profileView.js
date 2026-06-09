// ============================================================================
// views/profileView.js — View formatter cho Profile
// Trách nhiệm DUY NHẤT: Biến đổi raw data từ DB thành JSON response chuẩn.
// KHÔNG chứa logic nghiệp vụ, không truy vấn DB.
// ============================================================================

/**
 * Bảng ánh xạ role → tên hiển thị tiếng Việt
 */
const ROLE_DISPLAY = {
  ADMIN: 'Quản trị viên',
  HIEU_TRUONG: 'Hiệu trưởng',
  HR: 'Nhân sự',
  PHONG_DAO_TAO: 'Phòng Đào tạo',
  TRUONG_BO_MON: 'Trưởng Bộ môn',
  GIANG_VIEN: 'Giảng viên',
  SINH_VIEN: 'Sinh viên',
}

/**
 * Format một profile đơn lẻ
 * @param {object} raw — Profile row từ database
 * @param {Array} permissions — Mảng mã quyền của user
 * @returns {object} — JSON response chuẩn hóa
 */
export function formatProfile(raw, permissions = []) {
  if (!raw) return null
  return {
    id: raw.id,
    email: raw.email,
    fullName: raw.full_name,
    role: raw.role,
    rank: raw.rank,
    displayRole: ROLE_DISPLAY[raw.role] || raw.role,
    avatarUrl: raw.avatar_url,
    isLocked: raw.is_locked || false,
    lockReason: raw.lock_reason || null,
    department: raw.department || null,
    mssv: raw.Mssv || null,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    permissions: permissions,
  }
}

/**
 * Format danh sách profiles
 * @param {Array} rawList — Mảng profile rows
 * @returns {object} — { data: [...], total: number }
 */
export function formatProfileList(rawList) {
  return {
    data: (rawList || []).map(formatProfile),
    total: rawList?.length || 0,
  }
}

/**
 * Format kết quả xóa profile
 * @param {object} deletedProfile — Profile đã bị xóa
 * @returns {object}
 */
export function formatDeleteResult(deletedProfile) {
  return {
    success: true,
    message: `Đã xóa hồ sơ "${deletedProfile.full_name}" thành công.`,
    deletedId: deletedProfile.id,
  }
}
