// ============================================================================
// models/examManageModel.js — Model truy vấn bảng exams (CRUD quản lý)
// ============================================================================

import { supabaseAdmin } from '../config/supabase.js'

export async function findByClass(classId) {
  const { data, error } = await supabaseAdmin
    .from('exams')
    .select('*')
    .eq('class_id', classId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function findById(id) {
  const { data, error } = await supabaseAdmin
    .from('exams')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function findPublishedByClass(classId) {
  const { data, error } = await supabaseAdmin
    .from('exams')
    .select('id, title, duration_minutes, questions, status, class_id')
    .eq('class_id', classId)
    .eq('status', 'published')
  if (error) throw error
  return data || []
}

export async function create(examData) {
  const { data, error } = await supabaseAdmin
    .from('exams')
    .insert(examData)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function update(id, updates) {
  const cleanUpdates = {}
  for (const key in updates) {
    if (updates[key] !== undefined) {
      cleanUpdates[key] = updates[key]
    }
  }
  const { data, error } = await supabaseAdmin
    .from('exams')
    .update({ ...cleanUpdates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function remove(id) {
  const { data, error } = await supabaseAdmin
    .from('exams')
    .delete()
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}
