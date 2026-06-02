// ============================================================================
// controllers/examController.js — Controller nộp bài thi
// Trách nhiệm DUY NHẤT: Điều phối nghiệp vụ nộp bài (bình thường + bắt buộc).
// Gọi Model (examModel) để lưu, gọi View (examView) để format.
// ============================================================================

import * as examModel from '../models/examModel.js'
import * as examView from '../views/examView.js'
import { supabaseAdmin } from '../config/supabase.js'
import * as gradeModel from '../models/gradeModel.js'

/**
 * POST /api/exam/submit
 * Body:
 * {
 *   examId,
 *   examTitle,
 *   answers,
 *   isForced,
 *   violations
 * }
 */
export async function submitExam(req, res) {
  try {
    const { examId, examTitle, answers, isForced, violations } = req.body
    const studentId = req.user.id

    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({
        error: 'Dữ liệu bài làm không hợp lệ.',
      })
    }

    // ============================================================
    // Tìm bài thi
    // ============================================================
    let exam = null

    if (examId) {
      const { data, error } = await supabaseAdmin
        .from('exams')
        .select('*')
        .eq('id', examId)
        .single()

      if (!error) {
        exam = data
      }
    }

    // Fallback cũ
    if (!exam && examTitle) {
      const { data, error } = await supabaseAdmin
        .from('exams')
        .select('*')
        .eq('title', examTitle)
        .limit(1)

      if (!error && data?.length) {
        exam = data[0]
      }
    }

    // ============================================================
    // Chấm điểm tự động
    // ============================================================
    let calculatedScore = null
    let isGraded = false

    if (exam) {
      const questions = exam.questions || []

      const hasEssay = questions.some(
        (q) => q.type === 'essay' || q.type === 'textarea' || q.type === 'text',
      )

      if (questions.length > 0) {
        if (!hasEssay) {
          let correctCount = 0

          questions.forEach((q, idx) => {
            const studentAnswer = answers.find(
              (a) => a.question_id === idx || a.question_id === q.id,
            )

            if (studentAnswer && studentAnswer.selected_option === q.answer) {
              correctCount++
            }
          })

          calculatedScore = parseFloat(((correctCount / questions.length) * 10).toFixed(1))

          isGraded = true
        } else {
          calculatedScore = null
          isGraded = false
        }
      } else {
        calculatedScore = 0
        isGraded = true
      }
    }

    // ============================================================
    // Lưu bài nộp
    // ============================================================
    const submission = await examModel.saveSubmission({
      exam_id: exam?.id || null,
      student_id: studentId,
      exam_title: exam?.title || examTitle || 'Untitled Exam',
      answers,
      is_forced: isForced || false,
      violations: violations || 0,
      score: calculatedScore,
    })

    // ============================================================
    // Lưu bảng điểm
    // ============================================================
    if (isGraded && calculatedScore !== null && exam) {
      try {
        await gradeModel.upsert({
          exam_id: exam.id,
          student_id: studentId,
          score: calculatedScore,
          graded_by: null,
          graded_at: new Date().toISOString(),
        })

        console.log(
          `[AUTO-GRADE] Saved score ${calculatedScore} for student ${studentId} on exam ${exam.id}`,
        )
      } catch (err) {
        console.error('[AUTO-GRADE ERROR]', err.message)
      }
    }

    // ============================================================
    // Anti-cheat log
    // ============================================================
    if (isForced) {
      console.warn(
        `[ANTI-CHEAT] Nộp bài bắt buộc: student=${studentId}, violations=${violations}, exam="${exam?.title || examTitle}"`,
      )
    }

    // ============================================================
    // Response
    // ============================================================
    return res.json(
      examView.formatSubmissionResult({
        ...submission,
        score: calculatedScore,
      }),
    )
  } catch (err) {
    console.error('[ExamController.submitExam]', err.message)

    return res.status(500).json({
      error: 'Lỗi khi nộp bài thi.',
    })
  }
}

/**
 * GET /api/exam/my-submissions
 */
export async function getMySubmissions(req, res) {
  try {
    const submissions = await examModel.findByStudent(req.user.id)

    return res.json(examView.formatSubmissionList(submissions))
  } catch (err) {
    console.error('[ExamController.getMySubmissions]', err.message)

    return res.status(500).json({
      error: 'Lỗi khi lấy bài nộp.',
    })
  }
}

/**
 * POST /api/exam/upload
 */
export async function uploadSubmissionFile(req, res) {
  try {
    const { fileName, fileData } = req.body
    const studentId = req.user.id

    if (!fileName || !fileData) {
      return res.status(400).json({
        error: 'Thiếu tên file hoặc dữ liệu file.',
      })
    }

    const matches = fileData.match(/^data:([a-zA-Z0-9.-]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/)

    let buffer
    let contentType = 'application/octet-stream'

    if (matches && matches.length === 3) {
      contentType = matches[1]
      buffer = Buffer.from(matches[2], 'base64')
    } else {
      buffer = Buffer.from(fileData, 'base64')
    }

    if (buffer.length > 10 * 1024 * 1024) {
      return res.status(400).json({
        error: 'Kích thước file vượt quá giới hạn cho phép (10MB).',
      })
    }

    const fileExt = fileName.split('.').pop()

    const cleanFileName = `${studentId}_${Date.now()}.${fileExt}`

    const filePath = `exams/${cleanFileName}`

    const { error } = await supabaseAdmin.storage.from('submissions').upload(filePath, buffer, {
      contentType,
      upsert: true,
    })

    if (error) throw error

    const {
      data: { publicUrl },
    } = supabaseAdmin.storage.from('submissions').getPublicUrl(filePath)

    return res.json({
      success: true,
      message: 'Tải file lên thành công.',
      fileUrl: publicUrl,
      fileName,
    })
  } catch (err) {
    console.error('[ExamController.uploadSubmissionFile]', err.message)

    return res.status(500).json({
      error: 'Lỗi khi tải file lên hệ thống.',
    })
  }
}
