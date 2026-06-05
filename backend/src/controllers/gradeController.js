// ============================================================================
// controllers/gradeController.js — Xem bảng điểm
// ============================================================================

import * as gradeModel from '../models/gradeModel.js'

export async function getMyGrades(req, res) {
  try {
    const grades = await gradeModel.findByStudent(req.user.id)
    
    // Group by subject and calculate midterm/final/average
    const subjectMap = new Map()
    
    for (const grade of grades) {
      if (!grade.class?.subject?.code) continue
      
      const subjectCode = grade.class.subject.code
      if (!subjectMap.has(subjectCode)) {
        subjectMap.set(subjectCode, {
          subjectCode,
          subjectName: grade.class.subject.name || 'N/A',
          credits: grade.class.subject.credits || 0,
          semester: grade.class.semester || 'N/A',
          className: grade.class.name || '',
          midtermScore: null,
          finalScore: null,
          scores: []
        })
      }
      
      const subject = subjectMap.get(subjectCode)
      subject.scores.push(grade.score)
      
      if (grade.exam_type === 'midterm') {
        subject.midtermScore = grade.score
      } else if (grade.exam_type === 'final') {
        subject.finalScore = grade.score
      }
    }
    
    // Calculate average for each subject: midterm 40%, final 60%
    // Only calculate average when both midterm and final scores exist
    const processedGrades = Array.from(subjectMap.values()).map(subject => {
      let avgScore = null
      let pass = null
      
      if (subject.midtermScore !== null && subject.finalScore !== null) {
        avgScore = (subject.midtermScore * 0.4) + (subject.finalScore * 0.6)
        avgScore = Math.round(avgScore * 10) / 10 // Round to 1 decimal place
        pass = avgScore >= 5.0
      }
      
      return {
        ...subject,
        averageScore: avgScore,
        pass
      }
    })
    
    return res.json({ success: true, data: processedGrades })
  } catch (err) {
    console.error('[GradeController.getMyGrades]', err.message)
    return res.status(500).json({ error: 'Lỗi khi lấy bảng điểm.' })
  }
}

export async function getByClass(req, res) {
  try {
    const grades = await gradeModel.findByClass(req.params.classId)
    return res.json({ success: true, data: grades })
  } catch (err) {
    console.error('[GradeController.getByClass]', err.message)
    return res.status(500).json({ error: 'Lỗi khi lấy bảng điểm lớp.' })
  }
}

export async function saveGrade(req, res) {
  try {
    const { classId, studentId, examId, score } = req.body
    if (!classId || !studentId || score === undefined) {
      return res.status(400).json({ error: 'Thiếu classId, studentId hoặc score.' })
    }
    const grade = await gradeModel.upsert({
      class_id: classId,
      student_id: studentId,
      exam_id: examId || null,
      score: parseFloat(score),
      graded_by: req.user.id
    })
    return res.json({ success: true, message: 'Cập nhật điểm thành công.', data: grade })
  } catch (err) {
    console.error('[GradeController.saveGrade]', err.message)
    return res.status(500).json({ error: 'Lỗi khi lưu điểm.' })
  }
}
