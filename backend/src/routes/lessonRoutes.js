// ============================================================================
// routes/lessonRoutes.js — CRUD bài học
// ============================================================================

import { Router } from 'express'
import { authMiddleware, requireRank } from '../middleware/authMiddleware.js'
import * as ctrl from '../controllers/lessonController.js'

const router = Router()
router.use(authMiddleware)

// GET /api/lessons/class/:classId — Lấy bài học theo lớp
router.get('/class/:classId', ctrl.getByClass)

// POST /api/lessons — Tạo bài học (GV trở lên, rank >= 50)
router.post('/', requireRank(50), ctrl.create)

// PUT /api/lessons/:id — Sửa bài học
router.put('/:id', requireRank(50), ctrl.update)

// DELETE /api/lessons/:id — Xóa bài học
router.delete('/:id', requireRank(50), ctrl.remove)

export { router }
