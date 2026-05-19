// ============================================================================
// models/gradeModel.js — Model truy vấn bảng grades
// ============================================================================

import { supabaseAdmin } from '../config/supabase.js'

export async function findByStudent(studentId) {
  const { data, error } = await supabaseAdmin
    .from('grades')
    .select(`
      id,
      score,
      graded_at,
      graded_by,
      exam:exams(
        id,
        title,
        class:classes(
          id,
          name,
          subject:subjects(id, code, name, credits)
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
    class: g.exam?.class || null,
    grader: g.grader
  }))
}

export async function findByClass(classId) {
  const { data, error } = await supabaseAdmin
    .from('grades')
    .select('*, student:profiles!student_id(id, full_name, email)')
    .eq('class_id', classId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function upsert(gradeData) {
  const { data, error } = await supabaseAdmin
    .from('grades')
    .upsert(gradeData, { onConflict: 'class_id,student_id,exam_id' })
    .select()
    .single()
  if (error) throw error
  return data
}
