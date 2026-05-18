// ============================================================================
// models/configModel.js — Model truy vấn bảng school_configs
// Trách nhiệm DUY NHẤT: Thao tác CRUD bảng school_configs kèm cơ chế dự phòng (Fallback).
// ============================================================================

import { supabaseAdmin } from '../config/supabase.js'

// Giá trị cấu hình mặc định (dự phòng khi bảng chưa được tạo hoặc lỗi)
const DEFAULT_CONFIGS = [
  { key: 'school_name', value: 'Frappe School', description: 'Tên trường học hiển thị chính' },
  { key: 'current_semester', 'value': 'Học kỳ 1 / 2026-2027', description: 'Học kỳ đào tạo hiện tại' },
  { key: 'school_status', 'value': 'active', description: 'Trạng thái hoạt động của trường (active/maintenance)' }
]

// Lưu trữ cấu hình trong bộ nhớ tạm thời nếu DB chưa sẵn sàng
let inMemoryConfigs = {}
DEFAULT_CONFIGS.forEach(c => {
  inMemoryConfigs[c.key] = { value: c.value, description: c.description }
})

/**
 * Lấy tất cả cấu hình trường học
 * @returns {Array} — Mảng cấu hình
 */
export async function findAll() {
  try {
    const { data, error } = await supabaseAdmin
      .from('school_configs')
      .select('*')
      .order('key', { ascending: true })

    if (error) {
      // Nếu lỗi do bảng chưa tồn tại hoặc lý do khác, dùng inMemory
      console.warn('[ConfigModel.findAll] Database error, falling back to memory:', error.message)
      return Object.keys(inMemoryConfigs).map(key => ({
        key,
        value: inMemoryConfigs[key].value,
        description: inMemoryConfigs[key].description
      }))
    }

    // Nếu dữ liệu trống trong DB, gieo dữ liệu mặc định vào DB
    if (!data || data.length === 0) {
      await seedDefaultConfigs()
      return DEFAULT_CONFIGS
    }

    return data
  } catch (err) {
    console.warn('[ConfigModel.findAll] Unexpected error, falling back to memory:', err.message)
    return Object.keys(inMemoryConfigs).map(key => ({
      key,
      value: inMemoryConfigs[key].value,
      description: inMemoryConfigs[key].description
    }))
  }
}

/**
 * Cập nhật cấu hình trường học
 * @param {string} key — Khóa cấu hình
 * @param {string} value — Giá trị mới
 * @returns {object} — Cấu hình sau khi cập nhật
 */
export async function update(key, value) {
  // Đồng thời cập nhật bộ nhớ tạm
  if (inMemoryConfigs[key]) {
    inMemoryConfigs[key].value = value
  } else {
    inMemoryConfigs[key] = { value, description: '' }
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('school_configs')
      .upsert({ key, value, updated_at: new Date().toISOString() })
      .select()
      .single()

    if (error) {
      console.warn(`[ConfigModel.update] Failed to upsert key ${key} to DB:`, error.message)
      return { key, value, description: inMemoryConfigs[key]?.description || '' }
    }

    return data
  } catch (err) {
    console.warn(`[ConfigModel.update] Unexpected error updating key ${key}:`, err.message)
    return { key, value, description: inMemoryConfigs[key]?.description || '' }
  }
}

/**
 * Gieo dữ liệu cấu hình mặc định vào DB
 */
async function seedDefaultConfigs() {
  try {
    await supabaseAdmin
      .from('school_configs')
      .insert(DEFAULT_CONFIGS)
  } catch (err) {
    console.warn('[ConfigModel.seedDefaultConfigs] Failed to seed configs:', err.message)
  }
}
