// ============================================================================
// models/classModel.js — Model truy vấn bảng classes + class_registrations
// Trách nhiệm DUY NHẤT: Thực hiện các thao tác truy vấn lớp học.
// KHÔNG chứa logic phân quyền hay format response.
// ============================================================================

import { supabaseAdmin } from '../config/supabase.js'

/**
 * Lấy danh sách tất cả lớp học đang hoạt động (kèm thông tin môn học)
 * @returns {Array} — Mảng class rows
 */
export async function findAll() {
  const { data, error } = await supabaseAdmin
    .from('classes')
    .select(
      `
      *,
      subject:subjects(id, code, name, credits, department, is_locked),
      instructor:profiles!instructor_id(id, full_name, email),
      manager:profiles!manager_id(id, full_name, email, is_locked)
    `,
    )
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

/**
 * Tìm lớp học theo ID
 * @param {string} id — UUID của class
 * @returns {object|null}
 */
export async function findById(id) {
  const { data, error } = await supabaseAdmin
    .from('classes')
    .select(
      `
      *,
      subject:subjects(id, code, name, credits, department, is_locked),
      instructor:profiles!instructor_id(id, full_name, email),
      manager:profiles!manager_id(id, full_name, email, is_locked)
    `,
    )
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

/**
 * Đăng ký sinh viên vào lớp — Gọi RPC Supabase (xử lý concurrency)
 * @param {string} classId — UUID lớp học
 * @param {string} studentId — UUID sinh viên
 * @returns {object} — Kết quả { success, message/error, remaining? }
 */
export async function registerStudent(classId, studentId) {
  const { data, error } = await supabaseAdmin.rpc('register_student_to_class', {
    target_class_id: classId,
    target_student_id: studentId,
  })

  if (error) throw error
  return data
}

/**
 * Lấy danh sách lớp đã đăng ký của một sinh viên
 * @param {string} studentId — UUID sinh viên
 * @returns {Array}
 */
export async function findRegistrationsByStudent(studentId) {
  const { data, error } = await supabaseAdmin
    .from('class_registrations')
    .select(
      `
      id,
      registered_at,
      class:classes(id, name, remaining_slots, max_slots,
        subject:subjects(code, name),
        instructor:profiles!instructor_id(id, full_name, email)
      )
    `,
    )
    .eq('student_id', studentId)
    .order('registered_at', { ascending: false })

  if (error) throw error
  return data || []
}

/**
 * Tạo lớp học mới
 */
export async function create(classData) {
  const { data, error } = await supabaseAdmin
    .from('classes')
    .insert(classData)
    .select(`*, subject:subjects(id, code, name)`)
    .single()
  if (error) throw error
  return data
}

/**
 * Phân công giảng viên vào lớp
 */
export async function assignInstructor(classId, instructorId) {
  const { data, error } = await supabaseAdmin
    .from('classes')
    .update({ instructor_id: instructorId })
    .eq('id', classId)
    .select(
      `*, subject:subjects(id, code, name, department, is_locked), instructor:profiles!instructor_id(id, full_name, email)`,
    )
    .single()
  if (error) throw error
  return data
}

/**
 * Duyệt lớp học và tự động xếp phòng ngẫu nhiên
 * @param {string} classId — UUID của class
 * @param {number} maxStudents — Số lượng sinh viên tối đa
 * @returns {object} — Kết quả từ RPC
 */
export async function approveClassAndRandomRoom(classId, maxStudents) {
  const { data, error } = await supabaseAdmin.rpc('approve_class_and_random_room', {
    p_class_id: classId,
    p_max_students: maxStudents,
  })
  if (error) throw error
  return data
}

/**
 * Xóa toàn bộ lớp học chưa hoàn thành theo ID môn học
 * @param {string} subjectId - UUID môn học
 */
export async function deleteActiveBySubjectId(subjectId) {
  const { data, error } = await supabaseAdmin
    .from('classes')
    .delete()
    .eq('subject_id', subjectId)
    .neq('status', 'completed')

  if (error) throw error
  return data
}
