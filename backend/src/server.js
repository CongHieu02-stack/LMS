// ============================================================================
// server.js — Entry Point
// Trách nhiệm DUY NHẤT: Khởi động HTTP server trên port được chỉ định.
// KHÔNG chứa logic cấu hình app, routes, hay middleware.
// ============================================================================

import 'dotenv/config'
import { app } from './app.js'

const PORT = process.env.PORT || 3000

app.listen(PORT, '127.0.0.1', () => {
  console.log(`[LMS Backend] Server đang chạy tại http://127.0.0.1:${PORT}`)
  console.log(`[LMS Backend] Môi trường: ${process.env.NODE_ENV || 'development'}`)
})

// Ngăn server crash khi gặp lỗi mạng/kết nối không mong muốn (như ECONNRESET)
process.on('uncaughtException', (err) => {
  console.error('[LMS Uncaught Exception]', err)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('[LMS Unhandled Rejection] Tại:', promise, 'Lý do:', reason)
})

// Watch reload trigger - syntax fixed
