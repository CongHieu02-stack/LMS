// ============================================================================
// controllers/lessonController.js — CRUD bài học
// ============================================================================

import * as lessonModel from '../models/lessonModel.js'

export async function getByClass(req, res) {
  try {
    const lessons = await lessonModel.findByClass(req.params.classId)
    return res.json({ success: true, data: lessons })
  } catch (err) {
    console.error('[LessonController.getByClass]', err.message)
    return res.status(500).json({ error: 'Lỗi khi lấy danh sách bài học.' })
  }
}

export async function create(req, res) {
  try {
    const { classId, title, content, sortOrder } = req.body
    if (!classId || !title) {
      return res.status(400).json({ error: 'Thiếu classId hoặc title.' })
    }
    const lesson = await lessonModel.create({
      class_id: classId,
      title,
      content: content || '',
      sort_order: sortOrder || 0
    })
    return res.status(201).json({ success: true, message: 'Tạo bài học thành công.', data: lesson })
  } catch (err) {
    console.error('[LessonController.create]', err.message)
    return res.status(500).json({ error: 'Lỗi khi tạo bài học.' })
  }
}

export async function update(req, res) {
  try {
    const { title, content, sort_order } = req.body
    const updated = await lessonModel.update(req.params.id, { title, content, sort_order })
    return res.json({ success: true, data: updated })
  } catch (err) {
    console.error('[LessonController.update]', err.message)
    return res.status(500).json({ error: 'Lỗi khi cập nhật bài học.' })
  }
}

export async function remove(req, res) {
  try {
    await lessonModel.remove(req.params.id)
    return res.json({ success: true, message: 'Đã xóa bài học.' })
  } catch (err) {
    console.error('[LessonController.remove]', err.message)
    return res.status(500).json({ error: 'Lỗi khi xóa bài học.' })
  }
}
