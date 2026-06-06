// ============================================================================
// models/activityLogModel.js — Model truy vấn bảng admin_activity_logs
// Trách nhiệm DUY NHẤT: Thực hiện các thao tác CRUD trên bảng admin_activity_logs.
// Schema: id, admin_id, action_type, target_type, target_id, description, metadata, created_at
// ============================================================================

import { supabaseAdmin } from '../config/supabase.js'

/**
 * Tạo bản ghi log hoạt động mới
 * @param {object} logData
 * @param {string} logData.adminId - UUID của admin thực hiện hành động
 * @param {string} logData.actionType - Loại hành động (vd: 'CREATE_PROFILE', 'LOCK_USER')
 * @param {string|null} [logData.targetType] - Loại đối tượng bị tác động ('user', 'class', 'subject')
 * @param {string|null} [logData.targetId] - UUID của đối tượng bị tác động
 * @param {string|null} [logData.description] - Mô tả chi tiết hành động
 * @param {object|null} [logData.metadata] - Dữ liệu phụ (JSONB)
 * @returns {object} - Dòng dữ liệu log vừa thêm
 */
export async function createLog({
  adminId,
  actionType,
  targetType = 'SYSTEM',
  targetId = null,
  description = 'Thao tác hệ thống',
  metadata = null
}) {
  const { data, error } = await supabaseAdmin
    .from('admin_activity_logs')
    .insert({
      admin_id: adminId,
      action_type: actionType,
      target_type: targetType,
      target_id: targetId,
      description,
      metadata
    })
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Lấy danh sách lịch sử hoạt động kèm thông tin admin
 * @param {object} params
 * @param {number} [params.limit] - Số bản ghi tối đa
 * @param {number} [params.offset] - Điểm bắt đầu lấy dữ liệu
 * @returns {Array} - Mảng logs kèm profiles
 */
export async function findAllLogs({ limit = 200, offset = 0 } = {}) {
  const { data, error } = await supabaseAdmin
    .from('admin_activity_logs')
    .select(`
      id,
      action_type,
      target_type,
      target_id,
      description,
      metadata,
      created_at,
      profiles!admin_activity_logs_admin_id_fkey (
        id,
        email,
        full_name,
        role
      )
    `)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw error
  return data || []
}
