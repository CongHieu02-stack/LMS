// ============================================================================
// app.js — Express Application Factory
// Trách nhiệm DUY NHẤT: Cấu hình middleware toàn cục và mount route groups.
// KHÔNG chứa logic khởi động server, xử lý request, hay truy vấn database.
// ============================================================================

import express from 'express'
import cors from 'cors'
import { router as apiRoutes } from './routes/index.js'

const app = express()

// ─── Middleware toàn cục ───
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}))
app.use(express.json({ limit: '5mb' }))
app.use(express.urlencoded({ limit: '5mb', extended: true }))

// ─── Mount tất cả API routes dưới prefix /api ───
app.use('/api', apiRoutes)

// ─── Health check endpoint ───
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ─── Xử lý route không tồn tại ───
app.use((_req, res) => {
  res.status(404).json({ error: 'Endpoint không tồn tại.' })
})

// ─── Xử lý lỗi toàn cục ───
app.use((err, _req, res, _next) => {
  console.error('[LMS Error]', err.message)
  res.status(500).json({ error: 'Lỗi máy chủ nội bộ.' })
})

export { app }
