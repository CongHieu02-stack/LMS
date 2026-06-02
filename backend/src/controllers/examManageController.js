// ============================================================================
// controllers/examManageController.js — CRUD quản lý bài kiểm tra (GV)
// ============================================================================

import * as examManageModel from '../models/examManageModel.js'
import { supabaseAdmin } from '../config/supabase.js'
import * as gradeModel from '../models/gradeModel.js'

export async function getByClass(req, res) {
  try {
    const exams = await examManageModel.findByClass(req.params.classId)
    return res.json({ success: true, data: exams })
  } catch (err) {
    console.error('[ExamManageController.getByClass]', err.message)
    return res.status(500).json({ error: 'Lỗi khi lấy danh sách bài kiểm tra.' })
  }
}

export async function getById(req, res) {
  try {
    const exam = await examManageModel.findById(req.params.id)
    if (!exam) return res.status(404).json({ error: 'Không tìm thấy bài kiểm tra.' })
    return res.json({ success: true, data: exam })
  } catch (err) {
    console.error('[ExamManageController.getById]', err.message)
    return res.status(500).json({ error: 'Lỗi khi lấy bài kiểm tra.' })
  }
}

export async function getPublishedByClass(req, res) {
  try {
    const exams = await examManageModel.findPublishedByClass(req.params.classId)
    return res.json({ success: true, data: exams })
  } catch (err) {
    console.error('[ExamManageController.getPublishedByClass]', err.message)
    return res.status(500).json({ error: 'Lỗi.' })
  }
}

export async function create(req, res) {
  try {
    const { classId, title, durationMinutes, questions } = req.body
    if (!classId || !title) {
      return res.status(400).json({ error: 'Thiếu classId hoặc title.' })
    }
    const exam = await examManageModel.create({
      class_id: classId,
      title,
      duration_minutes: durationMinutes || 60,
      questions: questions || []
    })
    return res.status(201).json({ success: true, message: 'Tạo bài kiểm tra thành công.', data: exam })
  } catch (err) {
    console.error('[ExamManageController.create]', err.message)
    return res.status(500).json({ error: 'Lỗi khi tạo bài kiểm tra.' })
  }
}

export async function update(req, res) {
  try {
    const { title, duration_minutes, questions, status } = req.body
    const updated = await examManageModel.update(req.params.id, { title, duration_minutes, questions, status })
    return res.json({ success: true, data: updated })
  } catch (err) {
    console.error('[ExamManageController.update]', err.message)
    return res.status(500).json({ error: 'Lỗi khi cập nhật bài kiểm tra.' })
  }
}

export async function remove(req, res) {
  try {
    await examManageModel.remove(req.params.id)
    return res.json({ success: true, message: 'Đã xóa bài kiểm tra.' })
  } catch (err) {
    console.error('[ExamManageController.remove]', err.message)
    return res.status(500).json({ error: 'Lỗi khi xóa.' })
  }
}

export async function getSubmissionsForClass(req, res) {
  try {
    const { classId } = req.params

    // 1. Lấy tất cả bài thi thuộc lớp
    const { data: exams, error: examsError } = await supabaseAdmin
      .from('exams')
      .select('*')
      .eq('class_id', classId)
    if (examsError) throw examsError

    if (!exams || exams.length === 0) {
      return res.json({ success: true, data: [] })
    }

    // 2. Lấy danh sách SV đã đăng ký lớp
    const { data: registrations, error: regError } = await supabaseAdmin
      .from('class_registrations')
      .select('student_id')
      .eq('class_id', classId)
    if (regError) throw regError

    const studentIds = registrations.map(r => r.student_id)
    if (studentIds.length === 0) {
      return res.json({ success: true, data: [] })
    }

    // 3. Lấy tất cả bài nộp của các sinh viên này
    const { data: submissions, error: subError } = await supabaseAdmin
      .from('exam_submissions')
      .select('*, student:profiles!student_id(id, full_name, email)')
      .in('student_id', studentIds)
      .order('submitted_at', { ascending: false })
    if (subError) throw subError

    // 4. Lọc bài nộp có tên khớp với tên bài thi của lớp
    const examTitles = exams.map(e => e.title)
    const filteredSubmissions = submissions.filter(sub => examTitles.includes(sub.exam_title))

    // 5. Mapped kèm theo exam_id và questions cấu trúc bài thi
    const mapped = filteredSubmissions.map(sub => {
      const matchExam = exams.find(e => e.title === sub.exam_title)
      return {
        ...sub,
        exam_id: matchExam ? matchExam.id : null,
        questions: matchExam ? matchExam.questions : []
      }
    })

    return res.json({ success: true, data: mapped })
  } catch (err) {
    console.error('[ExamManageController.getSubmissionsForClass]', err.message)
    return res.status(500).json({ error: 'Lỗi khi lấy danh sách bài nộp.' })
  }
}

export async function gradeSubmission(req, res) {
  try {
    const { submissionId, score } = req.body
    if (!submissionId || score === undefined) {
      return res.status(400).json({ error: 'Thiếu submissionId hoặc score.' })
    }

    // 1. Tìm bài nộp
    const { data: submission, error: subError } = await supabaseAdmin
      .from('exam_submissions')
      .select('*')
      .eq('id', submissionId)
      .single()
    
    if (subError || !submission) {
      return res.status(404).json({ error: 'Không tìm thấy bài nộp thi.' })
    }

    // 2. Tìm bài thi tương ứng để có exam_id
    const { data: exam, error: examError } = await supabaseAdmin
      .from('exams')
      .select('*')
      .eq('title', submission.exam_title)
      .limit(1)
      .single()

    if (examError || !exam) {
      return res.status(404).json({ error: 'Không tìm thấy bài kiểm tra liên quan.' })
    }

    const numericScore = parseFloat(score)

    // 3. Cập nhật điểm trong bảng exam_submissions
    const { error: updateSubError } = await supabaseAdmin
      .from('exam_submissions')
      .update({ score: numericScore })
      .eq('id', submissionId)
    if (updateSubError) throw updateSubError

    // 4. Lưu/Cập nhật vào bảng grades (bảng điểm)
    const grade = await gradeModel.upsert({
      exam_id: exam.id,
      student_id: submission.student_id,
      score: numericScore,
      graded_by: req.user.id,
      graded_at: new Date().toISOString()
    })

    return res.json({
      success: true,
      message: 'Chấm điểm bài nộp thành công.',
      data: {
        submission_id: submissionId,
        score: numericScore,
        grade
      }
    })
  } catch (err) {
    console.error('[ExamManageController.gradeSubmission]', err.message)
    return res.status(500).json({ error: 'Lỗi khi chấm điểm bài nộp.' })
  }
}
