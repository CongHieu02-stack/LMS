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
 * Tạo môn học mới
 * @param {object} subjectData — { code, name, description?, credits?, created_by }
 * @returns {object} — Subject vừa tạo
 */
export async function create(subjectData) {
  const { data, error } = await supabaseAdmin
    .from('subjects')
    .insert(subjectData)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Cập nhật trạng thái phê duyệt môn học
 * @param {string} id — UUID môn học
 * @param {string} status — 'approved' | 'rejected'
 * @returns {object} — Subject sau khi cập nhật
 */
export async function updateApproval(id, status) {
  const { data, error } = await supabaseAdmin
    .from('subjects')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}
