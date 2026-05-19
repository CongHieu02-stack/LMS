// ============================================================================
// routes/classProposalRoutes.js — Đề xuất & duyệt SL lớp
// ============================================================================

import { Router } from 'express'
import { authMiddleware, requireRank } from '../middleware/authMiddleware.js'
import * as ctrl from '../controllers/classProposalController.js'

const router = Router()
router.use(authMiddleware)

// GET /api/class-proposals — Tất cả đề xuất
router.get('/', requireRank(60), ctrl.getAll)

// GET /api/class-proposals/pending — Chỉ lấy pending (PĐT duyệt)
router.get('/pending', requireRank(70), ctrl.getPending)

// POST /api/class-proposals — TBM đề xuất (rank >= 60)
router.post('/', requireRank(60), ctrl.create)

// PUT /api/class-proposals/:id/status — PĐT duyệt (rank >= 70)
router.put('/:id/status', requireRank(70), ctrl.approve)

export { router }
