// ============================================================================
// routes/classRoutes.js — Route definitions cho Class management
// ============================================================================

import { Router } from 'express'
import { authMiddleware, requireRank, requirePermissionOrRank } from '../middleware/authMiddleware.js'
import * as classController from '../controllers/classController.js'

const router = Router()
router.use(authMiddleware)

// GET /api/classes — Danh sách lớp học
router.get('/', classController.listClasses)

// GET /api/classes/rooms — Danh sách phòng học
router.get('/rooms', classController.listRooms)

// GET /api/classes/my-registrations — Lớp đã đăng ký của SV
router.get('/my-registrations', classController.getMyRegistrations)

// GET /api/classes/:id — Chi tiết lớp
router.get('/:id', classController.getClassById)

// POST /api/classes — Tạo lớp mới (PĐT, rank >= 70)
router.post('/', requirePermissionOrRank('class_create', 70), classController.createClass)

// PUT /api/classes/:id/instructor — Phân công GV (TBM, rank >= 60)
router.put('/:id/instructor', requirePermissionOrRank('instructor_assign', 60), classController.assignInstructor)

// PUT /api/classes/:id/approve — Duyệt mở lớp (PĐT, rank >= 70)
router.put('/:id/approve', requirePermissionOrRank('class_quantity_approve', 70), classController.approveClass)

// PUT /api/classes/:id/reject — Từ chối mở lớp (PĐT, rank >= 70)
router.put('/:id/reject', requirePermissionOrRank('class_quantity_approve', 70), classController.rejectClass)

// POST /api/classes/register — Đăng ký vào lớp (SV)
router.post('/register', classController.registerToClass)

export { router }
