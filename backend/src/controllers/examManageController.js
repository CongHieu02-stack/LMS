// ============================================================================
// controllers/examManageController.js — CRUD quản lý bài kiểm tra (GV)
// ============================================================================

import * as examManageModel from '../models/examManageModel.js'

export async function getByClass(req, res) {
  try {
    const exams = await examManageModel.findByClass(req.params.classId)
    return res.json({ success: true, data: exams })
  } catch (err) {
    console.error('[ExamManageController.getByClass]', err.message)
    return res.status(500).json({ error: 'Lỗi khi lấy danh sách bài kiểm tra.' })
  }
}

export async function getById(req, res) {
  try {
    const exam = await examManageModel.findById(req.params.id)
    if (!exam) return res.status(404).json({ error: 'Không tìm thấy bài kiểm tra.' })
    return res.json({ success: true, data: exam })
  } catch (err) {
    console.error('[ExamManageController.getById]', err.message)
    return res.status(500).json({ error: 'Lỗi khi lấy bài kiểm tra.' })
  }
}

export async function getPublishedByClass(req, res) {
  try {
    const exams = await examManageModel.findPublishedByClass(req.params.classId)
    return res.json({ success: true, data: exams })
  } catch (err) {
    console.error('[ExamManageController.getPublishedByClass]', err.message)
    return res.status(500).json({ error: 'Lỗi.' })
  }
}

export async function create(req, res) {
  try {
    const { classId, title, durationMinutes, examType, questions } = req.body
    if (!classId || !title) {
      return res.status(400).json({ error: 'Thiếu classId hoặc title.' })
    }
    const exam = await examManageModel.create({
      class_id: classId,
      title,
      duration_minutes: durationMinutes || 60,
      exam_type: examType || 'midterm',
      questions: questions || [],
      status: 'published'
    })
    return res.status(201).json({ success: true, message: 'Tạo bài kiểm tra thành công.', data: exam })
  } catch (err) {
    console.error('[ExamManageController.create]', err.message)
    return res.status(500).json({ error: 'Lỗi khi tạo bài kiểm tra.' })
  }
}

export async function update(req, res) {
  try {
    const { title, duration_minutes, examType, questions, status } = req.body
    const updated = await examManageModel.update(req.params.id, { title, duration_minutes, exam_type: examType, questions, status })
    return res.json({ success: true, data: updated })
  } catch (err) {
    console.error('[ExamManageController.update]', err.message)
    return res.status(500).json({ error: 'Lỗi khi cập nhật bài kiểm tra.' })
  }
}

export async function remove(req, res) {
  try {
    await examManageModel.remove(req.params.id)
    return res.json({ success: true, message: 'Đã xóa bài kiểm tra.' })
  } catch (err) {
    console.error('[ExamManageController.remove]', err.message)
    return res.status(500).json({ error: 'Lỗi khi xóa.' })
  }
}
