// ============================================================================
// controllers/classProposalController.js — Đề xuất & duyệt số lượng lớp
// ============================================================================

import * as classProposalModel from '../models/classProposalModel.js'

const dayLabels = {
  'T2': 'Thứ 2',
  'T3': 'Thứ 3',
  'T4': 'Thứ 4',
  'T5': 'Thứ 5',
  'T6': 'Thứ 6',
  'T7': 'Thứ 7',
  'CN': 'Chủ nhật'
}

function timeToMinutes(timeStr) {
  const [hh, mm] = timeStr.split(':').map(Number);
  return hh * 60 + mm;
}

function validateSchedule(scheduleStr) {
  if (!scheduleStr) return { valid: true };
  const parts = scheduleStr.split(',').map(p => p.trim());
  const sessions = [];
  
  for (const part of parts) {
    if (!part) continue;
    const match = part.match(/^([A-Z0-9]+)\((\d{2}:\d{2})-(\d{2}:\d{2})\)$/i);
    if (!match) {
      return { valid: false, error: `Định dạng lịch học không hợp lệ: ${part}` };
    }
    const day = match[1].toUpperCase();
    const startTime = match[2];
    const endTime = match[3];
    if (startTime >= endTime) {
      return { valid: false, error: `Giờ bắt đầu (${startTime}) phải nhỏ hơn giờ kết thúc (${endTime}).` };
    }
    sessions.push({ day, startTime, endTime });
  }

  for (let i = 0; i < sessions.length; i++) {
    for (let j = i + 1; j < sessions.length; j++) {
      const s1 = sessions[i];
      const s2 = sessions[j];
      if (s1.day === s2.day) {
        const m1_start = timeToMinutes(s1.startTime);
        const m1_end = timeToMinutes(s1.endTime);
        const m2_start = timeToMinutes(s2.startTime);
        const m2_end = timeToMinutes(s2.endTime);

        const [firstStart, firstEnd, secondStart, secondEnd] = m1_start <= m2_start
          ? [m1_start, m1_end, m2_start, m2_end]
          : [m2_start, m2_end, m1_start, m1_end];

        // Kiểm tra xem có trùng nhau không
        if (secondStart < firstEnd) {
          const dayText = dayLabels[s1.day] || s1.day;
          return {
            valid: false,
            error: `Lịch học vào ${dayText} (${s1.startTime}-${s1.endTime} và ${s2.startTime}-${s2.endTime}) bị trùng lịch (chồng chéo thời gian).`
          };
        }
        // Kiểm tra xem có cách nhau ít nhất 5 phút không
        if (secondStart < firstEnd + 5) {
          const dayText = dayLabels[s1.day] || s1.day;
          return {
            valid: false,
            error: `Lịch học vào ${dayText} (${s1.startTime}-${s1.endTime} và ${s2.startTime}-${s2.endTime}) phải cách nhau ít nhất 5 phút để sinh viên kịp di chuyển giữa các phòng học.`
          };
        }
      }
    }
  }
  return { valid: true, sessions };
}

export async function getAll(req, res) {
  try {
    const proposals = await classProposalModel.findAll()
    return res.json({ success: true, data: proposals })
  } catch (err) {
    console.error('[ClassProposalController.getAll]', err.message)
    return res.status(500).json({ error: 'Lỗi khi lấy danh sách đề xuất.' })
  }
}

export async function getPending(req, res) {
  try {
    const proposals = await classProposalModel.findByStatus('pending')
    return res.json({ success: true, data: proposals })
  } catch (err) {
    console.error('[ClassProposalController.getPending]', err.message)
    return res.status(500).json({ error: 'Lỗi khi lấy đề xuất chờ duyệt.' })
  }
}

export async function create(req, res) {
  try {
    const { subjectId, quantity, semester, reason, maxStudents, schedule, startDate, endDate } = req.body
    if (!subjectId || !quantity || !semester) {
      return res.status(400).json({ error: 'Thiếu thông tin: subjectId, quantity, semester.' })
    }

    const { supabaseAdmin } = await import('../config/supabase.js')
    const { data: subj, error: subjErr } = await supabaseAdmin
      .from('subjects')
      .select('id, is_locked')
      .eq('id', subjectId)
      .single()

    if (subjErr || !subj) {
      return res.status(404).json({ error: 'Môn học không tồn tại.' })
    }

    if (subj.is_locked) {
      return res.status(400).json({ error: 'Môn học này hiện đang bị khóa, không thể tạo đề xuất lớp học.' })
    }

    if (schedule) {
      const schedValidation = validateSchedule(schedule)
      if (!schedValidation.valid) {
        return res.status(400).json({ error: schedValidation.error })
      }
    }

    // Kiểm tra định dạng học kỳ: HK[1-3]-[Năm]
    const semesterRegex = /^HK([1-3])-(\d{4})$/i
    const semMatch = semester.trim().match(semesterRegex)
    if (!semMatch) {
      return res.status(400).json({ error: 'Học kỳ không đúng định dạng. Vui lòng nhập theo dạng HK[1-3]-[Năm] (ví dụ: HK1-2026).' })
    }
    const semYear = parseInt(semMatch[2])
    const currentYear = new Date().getFullYear()
    if (semYear < currentYear) {
      return res.status(400).json({ error: `Năm của học kỳ đề xuất không được trước năm ${currentYear}.` })
    }

    // Kiểm tra ràng buộc ngày tháng học vụ
    if (startDate && endDate) {
      const start = new Date(startDate)
      const end = new Date(endDate)
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ error: 'Định dạng ngày tháng không hợp lệ.' })
      }

      if (end < start) {
        return res.status(400).json({ error: 'Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu.' })
      }

      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const minStartDate = new Date(today)
      minStartDate.setDate(minStartDate.getDate() + 14)

      start.setHours(0, 0, 0, 0)
      if (start < minStartDate) {
        return res.status(400).json({ error: 'Ngày bắt đầu phải cách ngày hiện tại ít nhất 2 tuần (14 ngày).' })
      }
    }

    const proposal = await classProposalModel.create({
      subject_id: subjectId,
      proposed_by: req.user.id,
      quantity: parseInt(quantity),
      semester,
      reason: reason || '',
      max_students: maxStudents ? parseInt(maxStudents) : 50,
      schedule: schedule || '',
      start_date: startDate || null,
      end_date: endDate || null
    })
    return res
      .status(201)
      .json({ success: true, message: 'Đề xuất đã được gửi thành công.', data: proposal })
  } catch (err) {
    console.error('[ClassProposalController.create]', err.message)
    return res.status(500).json({ error: 'Lỗi khi tạo đề xuất.' })
  }
}

export async function approve(req, res) {
  try {
    const { id } = req.params
    const { status } = req.body
    if (!['approved', 'rejected'].includes(status)) {
      return res
        .status(400)
        .json({ error: 'Status không hợp lệ. Chỉ chấp nhận: approved, rejected.' })
    }

    if (status === 'approved') {
      const { supabaseAdmin } = await import('../config/supabase.js')
      const { data: proposal } = await supabaseAdmin
        .from('class_proposals')
        .select('subject_id, subject:subjects(is_locked)')
        .eq('id', id)
        .single()

      if (proposal?.subject?.is_locked) {
        return res.status(400).json({ error: 'Môn học thuộc đề xuất này hiện đang bị khóa, không thể phê duyệt mở lớp.' })
      }
    }

    const updated = await classProposalModel.updateStatus(id, status, req.user.id)
    return res.json({
      success: true,
      message: `Đề xuất đã được ${status === 'approved' ? 'phê duyệt' : 'từ chối'}.`,
      data: updated,
    })
  } catch (err) {
    console.error('[ClassProposalController.approve]', err.message)
    return res.status(500).json({ error: 'Lỗi khi xử lý đề xuất.' })
  }
}
