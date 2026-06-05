// ============================================================================
// models/gradeModel.js — Model truy vấn bảng grades (FIXED)
// ============================================================================

import { supabaseAdmin } from '../config/supabase.js'

/* =========================
   GET GRADES BY STUDENT
========================= */
export async function findByStudent(studentId) {
  const { data, error } = await supabaseAdmin
    .from('grades')
    .select(`
      id,
      score,
      graded_at,
      graded_by,
      class_id,
      exam_id,
      exam:exams(
        id,
        title,
        exam_type,
        class:classes(
          id,
          name,
          semester,
          subject:subjects(
            id,
            code,
            name,
            credits
          )
        )
      ),
      grader:profiles!graded_by(id, full_name)
    `)
    .eq('student_id', studentId)
    .order('graded_at', { ascending: false })

  if (error) throw error

  return (data || []).map(g => ({
    id: g.id,
    score: g.score,
    graded_at: g.graded_at,
    graded_by: g.graded_by,
    exam_type: g.exam?.exam_type || 'other',
    class_id: g.class_id,
    class: g.exam?.class || null,
    grader: g.grader
  }))
}

/* =========================
   GET BY CLASS
========================= */
export async function findByClass(classId) {
  const { data, error } = await supabaseAdmin
    .from('grades')
    .select(`
      *,
      student:profiles!student_id(id, full_name, email),
      exam:exams(id, title)
    `)
    .eq('class_id', classId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

/* =========================
   UPSERT (FIXED LOGIC)
   - 1 student + 1 exam = 1 record
========================= */
export async function upsert(gradeData) {
  // 🔥 FIX: dùng exam_id thay vì class_id
  const { data: existing, error: findError } = await supabaseAdmin
    .from('grades')
    .select('id')
    .eq('exam_id', gradeData.exam_id)
    .eq('student_id', gradeData.student_id)
    .maybeSingle()

  if (findError) throw findError

  // ======================
  // UPDATE
  // ======================
  if (existing) {
    const { data, error } = await supabaseAdmin
      .from('grades')
      .update({
        score: gradeData.score,
        graded_by: gradeData.graded_by,
        graded_at: new Date().toISOString()
      })
      .eq('id', existing.id)
      .select()
      .single()

    if (error) throw error
    return data
  }

  // ======================
  // INSERT
  // ======================
  const { data, error } = await supabaseAdmin
    .from('grades')
    .insert({
      exam_id: gradeData.exam_id,
      class_id: gradeData.class_id,
      student_id: gradeData.student_id,
      score: gradeData.score,
      graded_by: gradeData.graded_by
    })
    .select()
    .single()

  if (error) throw error
  return data
}