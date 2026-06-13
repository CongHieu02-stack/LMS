// ============================================================================
// controllers/examController.js — Controller nộp bài thi
// ============================================================================

import * as examModel from '../models/examModel.js'
import * as examView from '../views/examView.js'
import * as examManageModel from '../models/examManageModel.js'
import * as gradeModel from '../models/gradeModel.js'
import { logActivity } from '../utils/activityLogger.js'

export async function submitExam(req, res) {
  try {
    const {
      examTitle,
      examId,
      classId,
      answers,
      isForced,
      violations,
      startedAt
    } = req.body

    const studentId = req.user.id

    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({
        error: 'Dữ liệu bài làm không hợp lệ.'
      })
    }

    if (isForced) {
      console.warn(
        `[ANTI-CHEAT] Nộp bài bắt buộc: student=${studentId}, violations=${violations}, exam="${examTitle}"`
      )
    }

    // ==========================
    // AUTO GRADE (PRE-CALCULATE)
    // ==========================
    let score = 0
    let exam = null

    if (examId && !isForced) {
      try {
        exam = await examManageModel.findById(examId)

        if (exam && Array.isArray(exam.questions)) {
          let correct = 0

          exam.questions.forEach((q, index) => {
            const studentAnswer = answers?.[index]

            if (!studentAnswer) return

            const selected =
              studentAnswer.selected_option ??
              studentAnswer.answer ??
              studentAnswer

            if (Number(selected) === Number(q.answer)) {
              correct++
            }
          })

          score =
            exam.questions.length > 0
              ? parseFloat(
                  ((correct / exam.questions.length) * 10).toFixed(1)
                )
              : 0

          console.log(
            '[AUTO-GRADE] Calculated score:',
            score,
            'correct:',
            correct,
            'total:',
            exam.questions.length
          )
        }
      } catch (gradeErr) {
        console.error('[AUTO-GRADE ERROR]', gradeErr.message)
      }
    }

    // ==========================
    // SAVE SUBMISSION WITH SCORE
    // ==========================
    const submission = await examModel.saveSubmission({
      student_id: studentId,
      exam_id: examId || null,
      exam_title: examTitle,
      answers,
      score: score,
      is_forced: isForced || false,
      violations: violations || 0,
      started_at: startedAt || null
    })

    // ==========================
    // SAVE TO GRADES TABLE
    // ==========================
    if (examId && !isForced && exam) {
      try {
        const gradeResult = await gradeModel.upsert({
          exam_id: examId,
          class_id: classId,
          student_id: studentId,
          score,
          graded_by: studentId
        })
        console.log('[AUTO-GRADE] Grade saved to database:', gradeResult)
      } catch (gradeErr) {
        console.error('[GRADE UPSERT ERROR]', gradeErr.message)
      }
    }

    const response = examView.formatSubmissionResult(submission)
    response.score = score

    await logActivity(req, 'SUBMIT_EXAM', `Nộp bài thi: ${examTitle}. Điểm số: ${score}, Số lần vi phạm: ${violations}`)

    return res.json(response)
  } catch (err) {
    console.error('[submitExam]', err.message)

    return res.status(500).json({
      error: 'Lỗi khi nộp bài thi.'
    })
  }
}

export async function getMySubmissions(req, res) {
  try {
    const submissions = await examModel.findByStudent(req.user.id)

    return res.json(
      examView.formatSubmissionList(submissions)
    )
  } catch (err) {
    console.error('[getMySubmissions]', err.message)

    return res.status(500).json({
      error: 'Lỗi khi lấy bài nộp.'
    })
  }
}

export async function getSubmissionDetail(req, res) {
  try {
    const submissionId = req.params.id
    const studentId = req.user.id
    const { supabaseAdmin } = await import('../config/supabase.js')

    // Lấy bài nộp
    const { data: submission, error: subErr } = await supabaseAdmin
      .from('exam_submissions')
      .select('*')
      .eq('id', submissionId)
      .single()

    if (subErr || !submission) {
      return res.status(404).json({ error: 'Bài nộp không tồn tại.' })
    }

    // Bảo mật: Chỉ sinh viên đã nộp bài mới xem được bài của mình
    if (submission.student_id !== studentId) {
      return res.status(403).json({ error: 'Bạn không có quyền xem bài nộp này.' })
    }

    let questions = []
    let showAnswers = true

    if (submission.exam_id) {
      // Lấy chi tiết đề thi
      const { data: exam, error: examErr } = await supabaseAdmin
        .from('exams')
        .select('questions, show_answers_to_students')
        .eq('id', submission.exam_id)
        .single()

      if (exam) {
        showAnswers = exam.show_answers_to_students !== false
        questions = exam.questions || []
        
        // Nếu giảng viên tắt quyền xem đáp án đúng, xóa trường answer khỏi câu hỏi trả về
        if (!showAnswers) {
          questions = questions.map(q => {
            const { answer, ...rest } = q
            return rest
          })
        }
      }
    }

    return res.json({
      success: true,
      submission: {
        id: submission.id,
        examTitle: submission.exam_title,
        score: submission.score,
        isForced: submission.is_forced,
        violations: submission.violations,
        submittedAt: submission.submitted_at,
        startedAt: submission.started_at,
        answers: submission.answers || []
      },
      questions,
      showAnswers
    })
  } catch (err) {
    console.error('[getSubmissionDetail]', err.message)
    return res.status(500).json({ error: 'Lỗi khi lấy chi tiết bài nộp.' })
  }
}