// ============================================================================
// models/profileModel.js — Model truy vấn bảng profiles
// Trách nhiệm DUY NHẤT: Thực hiện các thao tác CRUD trên bảng profiles.
// KHÔNG chứa logic nghiệp vụ, không validate input, không format output.
// ============================================================================

import { supabaseAdmin } from '../config/supabase.js'

/**
 * Tìm profile theo ID
 * @param {string} id — UUID của user
 * @returns {object|null} — Profile row hoặc null
 */
export async function findById(id) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

/**
 * Lấy danh sách tất cả profiles
 * @returns {Array} — Mảng profile rows
 */
export async function findAll() {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .order('rank', { ascending: false })

  if (error) throw error
  return data || []
}

/**
 * Cập nhật role của một profile
 * @param {string} id — UUID của user
 * @param {string} role — Giá trị user_role mới
 * @returns {object} — Profile sau khi cập nhật
 */
export async function updateRole(id, role) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update({ role })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Cập nhật thông tin cơ bản của profile (full_name, avatar_url)
 * @param {string} id — UUID của user
 * @param {object} updates — { full_name?, avatar_url? }
 * @returns {object} — Profile sau khi cập nhật
 */
export async function updateInfo(id, updates) {
  const allowedFields = {}
  if (updates.full_name !== undefined) allowedFields.full_name = updates.full_name
  if (updates.avatar_url !== undefined) allowedFields.avatar_url = updates.avatar_url

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update(allowedFields)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Xóa profile theo ID
 * @param {string} id — UUID của user
 * @returns {object} — Profile đã bị xóa
 */
export async function deleteById(id) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .delete()
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Tạo mới một profile (đồng bộ từ auth.users)
 * @param {string} id — UUID của user vừa tạo ở auth
 * @param {string} email — Email
 * @param {string} fullName — Họ tên
 * @param {string} role — Vai trò (ADMIN, HIEU_TRUONG, HR, ...)
 * @returns {object} — Profile vừa tạo
 */
export async function createProfile(id, email, fullName, role) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .insert({
      id,
      email,
      full_name: fullName,
      role
    })
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Lấy danh sách mã quyền của user (có fallback về quyền mặc định của role)
 * @param {string} userId - UUID của user
 * @param {string} role - user_role của user
 * @returns {Array<string>} - Mảng các permission code
 */
export async function findPermissionsByUserId(userId, role) {
  // 1. Lấy quyền ghi đè từ bảng user_permissions
  const { data: userPerms, error: err1 } = await supabaseAdmin
    .from('user_permissions')
    .select('permissions ( code )')
    .eq('user_id', userId)

  if (err1) throw err1

  // Nếu có cấu hình ghi đè quyền cá nhân, trả về luôn
  if (userPerms && userPerms.length > 0) {
    return userPerms.map(p => p.permissions.code)
  }

  // 2. Nếu bảng user_permissions trống (chưa cấu hình), lấy khuôn mẫu mặc định của role
  const { data: rolePerms, error: err2 } = await supabaseAdmin
    .from('role_default_permissions')
    .select('permissions ( code )')
    .eq('role', role)

  if (err2) throw err2
  return rolePerms.map(p => p.permissions.code)
}

