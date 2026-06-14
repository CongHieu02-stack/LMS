// ============================================================================
// models/lessonModel.js — Model truy vấn bảng lessons
// ============================================================================

import { supabaseAdmin } from '../config/supabase.js'

export async function findByClass(classId) {
  const { data, error } = await supabaseAdmin
    .from('lessons')
    .select('*')
    .eq('class_id', classId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

export async function create(lessonData) {
  const { data, error } = await supabaseAdmin
    .from('lessons')
    .insert(lessonData)
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
    .from('lessons')
    .update({ ...cleanUpdates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function remove(id) {
  const { data, error } = await supabaseAdmin
    .from('lessons')
    .delete()
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}
