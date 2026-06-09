// ============================================================================
// controllers/lessonController.js — CRUD bài học
// ============================================================================

import * as lessonModel from '../models/lessonModel.js'
import multer from 'multer'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../../uploads')
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    cb(null, uploadDir)
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, uniqueSuffix + path.extname(file.originalname))
  }
})

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|mp4|webm|mkv/
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase())
    const mimetype = allowedTypes.test(file.mimetype)

    if (extname || mimetype) {
      return cb(null, true)
    } else {
      cb(new Error('Chỉ chấp nhận file ảnh, PDF, Word và video.'))
    }
  }
})

export async function uploadFile(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Không có file được tải lên.' })
    }

    const fileUrl = `/uploads/${req.file.filename}`
    return res.json({ success: true, fileUrl })
  } catch (err) {
    console.error('[LessonController.uploadFile]', err.message)
    return res.status(500).json({ error: 'Lỗi khi tải lên file.' })
  }
}

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
    console.log('[LessonController.create] Request body received:', req.body)
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
    console.log('[LessonController.create] Lesson created successfully:', lesson)
    return res.status(201).json({ success: true, message: 'Tạo bài học thành công.', data: lesson })
  } catch (err) {
    console.error('[LessonController.create] Detailed Error:', err)
    return res.status(500).json({ error: 'Lỗi khi tạo bài học: ' + err.message })
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

export { upload }
