// ============================================================================
// controllers/gradeController.js — Xem bảng điểm
// ============================================================================

import * as gradeModel from '../models/gradeModel.js'

export async function getMyGrades(req, res) {
  try {
    const grades = await gradeModel.findByStudent(req.user.id)
    return res.json({ success: true, data: grades })
  } catch (err) {
    console.error('[GradeController.getMyGrades]', err.message)
    return res.status(500).json({ error: 'Lỗi khi lấy bảng điểm.' })
  }
}

export async function getByClass(req, res) {
  try {
    const grades = await gradeModel.findByClass(req.params.classId)
    return res.json({ success: true, data: grades })
  } catch (err) {
    console.error('[GradeController.getByClass]', err.message)
    return res.status(500).json({ error: 'Lỗi khi lấy bảng điểm lớp.' })
  }
}

export async function saveGrade(req, res) {
  try {
    const { classId, studentId, examId, score } = req.body
    if (!classId || !studentId || score === undefined) {
      return res.status(400).json({ error: 'Thiếu classId, studentId hoặc score.' })
    }
    const grade = await gradeModel.upsert({
      class_id: classId,
      student_id: studentId,
      exam_id: examId || null,
      score: parseFloat(score),
      graded_by: req.user.id
    })
    return res.json({ success: true, message: 'Cập nhật điểm thành công.', data: grade })
  } catch (err) {
    console.error('[GradeController.saveGrade]', err.message)
    return res.status(500).json({ error: 'Lỗi khi lưu điểm.' })
  }
}
