// ============================================================================
// models/subjectModel.js — Model truy vấn bảng subjects
// Trách nhiệm DUY NHẤT: Thực hiện các thao tác CRUD trên bảng subjects.
// KHÔNG chứa logic phê duyệt hay phân quyền.
// ============================================================================

import { supabaseAdmin } from '../config/supabase.js'

/**
 * Lấy tất cả môn học
 * @returns {Array}
 */
export async function findAll() {
  const { data, error } = await supabaseAdmin
    .from('subjects')
    .select('*, creator:profiles!creator_id(id, full_name)')
    .order('code', { ascending: true })

  if (error) throw error
  return data || []
}

/**
 * Tìm môn học bằng mã hoặc tên (không phân biệt hoa thường)
 * @param {string} code 
 * @param {string} name 
 * @returns {Array}
 */
export async function findByCodeOrName(code, name) {
  const { data, error } = await supabaseAdmin
    .from('subjects')
    .select('id, code, name')
    .or(`code.eq.${code.trim().toUpperCase()},name.ilike.${name.trim()}`)

  if (error) throw error
  return data || []
}

/**
 * Tạo môn học mới
 * @param {object} subjectData — { code, name, description?, credits?, created_by }
 * @returns {object} — Subject vừa tạo
 */
export async function create(subjectData) {
  const { data, error } = await supabaseAdmin.from('subjects').insert(subjectData).select().single()

  if (error) throw error
  return data
}

/**
 * Cập nhật trạng thái phê duyệt môn học
 * @param {string} id — UUID môn học
 * @param {string} status — 'approved' | 'rejected'
 * @param {string} rejection_reason — Lý do từ chối (nếu có)
 * @returns {object} — Subject sau khi cập nhật
 */
export async function updateApproval(id, status, rejection_reason = null) {
  const updateData = { status, updated_at: new Date().toISOString() }
  if (status === 'rejected' && rejection_reason) {
    updateData.rejection_reason = rejection_reason
  } else if (status === 'approved') {
    // Nếu được duyệt thì xóa lý do từ chối cũ nếu có
    updateData.rejection_reason = null
  }

  const { data, error } = await supabaseAdmin
    .from('subjects')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Khóa môn học (không cho mở lớp mới)
 * @param {string} id — UUID môn học
 * @param {string} lock_reason — Lý do khóa
 * @returns {object} — Subject sau khi cập nhật
 */
export async function lockSubject(id, lock_reason) {
  const { data, error } = await supabaseAdmin
    .from('subjects')
    .update({
      is_locked: true,
      lock_reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Mở khóa môn học
 * @param {string} id — UUID môn học
 * @returns {object} — Subject sau khi cập nhật
 */
export async function unlockSubject(id) {
  const { data, error } = await supabaseAdmin
    .from('subjects')
    .update({
      is_locked: false,
      lock_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

