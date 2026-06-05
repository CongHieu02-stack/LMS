// ============================================================================
// server.js — Entry Point
// Trách nhiệm DUY NHẤT: Khởi động HTTP server trên port được chỉ định.
// KHÔNG chứa logic cấu hình app, routes, hay middleware.
// ============================================================================

import 'dotenv/config'
import { app } from './app.js'

const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log(`[LMS Backend] Server đang chạy tại http://localhost:${PORT}`)
  console.log(`[LMS Backend] Môi trường: ${process.env.NODE_ENV || 'development'}`)
})

// Watch reload trigger
