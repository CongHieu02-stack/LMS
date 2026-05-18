// ============================================================================
// models/examModel.js — Model truy vấn bảng exam_submissions
// Trách nhiệm DUY NHẤT: Lưu và truy vấn bài nộp thi.
// KHÔNG chứa logic chấm điểm hay kiểm tra gian lận.
// ============================================================================

import { supabaseAdmin } from '../config/supabase.js'

/**
 * Lưu bài nộp thi
 * @param {object} submission — { student_id, exam_title, answers, is_forced, violations }
 * @returns {object} — Submission vừa tạo
 */
export async function saveSubmission(submission) {
  const { data, error } = await supabaseAdmin
    .from('exam_submissions')
    .insert({
      student_id: submission.student_id,
      exam_title: submission.exam_title || 'Untitled Exam',
      answers: submission.answers || [],
      is_forced: submission.is_forced || false,
      violations: submission.violations || 0
    })
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Lấy tất cả bài nộp của một sinh viên
 * @param {string} studentId — UUID sinh viên
 * @returns {Array}
 */
export async function findByStudent(studentId) {
  const { data, error } = await supabaseAdmin
    .from('exam_submissions')
    .select('*')
    .eq('student_id', studentId)
    .order('submitted_at', { ascending: false })

  if (error) throw error
  return data || []
}

/**
 * Lấy tất cả bài nộp (dành cho giảng viên/admin xem)
 * @returns {Array}
 */
export async function findAll() {
  const { data, error } = await supabaseAdmin
    .from('exam_submissions')
    .select('*, student:profiles!student_id(id, full_name, email)')
    .order('submitted_at', { ascending: false })

  if (error) throw error
  return data || []
}
