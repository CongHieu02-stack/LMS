// ============================================================================
// composables/useClassApproval.ts — Composable điều phối duyệt lớp học
// Trách nhiệm DUY NHẤT: Quản lý State Modal, Validate, và gọi API duyệt lớp.
// ============================================================================

import { ref } from 'vue'
import { apiPut } from '@/lib/api'

export function useClassApproval(onSuccess?: () => void) {
  const isApproveModalOpen = ref(false)
  const selectedClassId = ref<string | null>(null)
  const selectedSemester = ref<string>('')
  const maxStudentsInput = ref<number | null>(null)
  const scheduleInput = ref<string>('')
  const roomNameInput = ref<string>('auto')
  const startDateInput = ref<string>('')
  const endDateInput = ref<string>('')
  const submitting = ref(false)
  const errorMessage = ref<string | null>(null)

  function openApproveModal(
    classId: string,
    existingSchedule?: string,
    defaultMaxStudents?: number,
    existingRoom?: string,
    existingStartDate?: string,
    existingEndDate?: string,
    semester?: string
  ) {
    selectedClassId.value = classId
    selectedSemester.value = semester || ''
    maxStudentsInput.value = defaultMaxStudents || 50
    scheduleInput.value = existingSchedule || ''
    roomNameInput.value = existingRoom || 'auto'
    startDateInput.value = existingStartDate ? existingStartDate.substring(0, 10) : ''
    endDateInput.value = existingEndDate ? existingEndDate.substring(0, 10) : ''
    errorMessage.value = null
    isApproveModalOpen.value = true
  }

  function closeApproveModal() {
    isApproveModalOpen.value = false
    selectedClassId.value = null
    selectedSemester.value = ''
    maxStudentsInput.value = null
    scheduleInput.value = ''
    roomNameInput.value = 'auto'
    startDateInput.value = ''
    endDateInput.value = ''
    errorMessage.value = null
  }

  async function submitApproveClass() {
    if (!selectedClassId.value) return
    
    if (maxStudentsInput.value === null || maxStudentsInput.value === undefined || maxStudentsInput.value <= 0) {
      errorMessage.value = 'Số lượng sinh viên tối đa phải lớn hơn 0.'
      return
    }

    if (startDateInput.value && endDateInput.value) {
      const start = new Date(startDateInput.value)
      const end = new Date(endDateInput.value)
      if (end < start) {
        errorMessage.value = 'Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu.'
        return
      }
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const minStartDate = new Date(today)
      minStartDate.setDate(minStartDate.getDate() + 14)

      start.setHours(0, 0, 0, 0)
      if (start < minStartDate) {
        errorMessage.value = 'Ngày bắt đầu phải cách ngày hiện tại ít nhất 2 tuần (14 ngày).'
        return
      }
    }

    if (startDateInput.value && selectedSemester.value) {
      const semMatch = selectedSemester.value.trim().match(/^HK([1-3])-(\d{4})$/i)
      if (semMatch) {
        const semNum = parseInt(semMatch[1])
        const semYear = parseInt(semMatch[2])
        
        const start = new Date(startDateInput.value)
        const startYear = start.getFullYear()
        const startMonth = start.getMonth() + 1

        if (startYear !== semYear) {
          errorMessage.value = `Năm của ngày bắt đầu (${startYear}) phải khớp với năm của học kỳ (${semYear}).`
          return
        }

        if (semNum === 1) {
          if (startMonth < 8 || startMonth > 12) {
            errorMessage.value = `Ngày bắt đầu của Học kỳ 1 năm ${semYear} phải nằm trong khoảng từ tháng 8 đến tháng 12 năm ${semYear}.`
            return
          }
        } else if (semNum === 2) {
          if (startMonth < 1 || startMonth > 5) {
            errorMessage.value = `Ngày bắt đầu của Học kỳ 2 năm ${semYear} phải nằm trong khoảng từ tháng 1 đến tháng 5 năm ${semYear}.`
            return
          }
        } else if (semNum === 3) {
          if (startMonth < 6 || startMonth > 7) {
            errorMessage.value = `Ngày bắt đầu của Học kỳ 3 năm ${semYear} phải nằm trong khoảng từ tháng 6 đến tháng 7 năm ${semYear}.`
            return
          }
        }
      }
    }

    submitting.value = true
    errorMessage.value = null
    try {
      const res = await apiPut<any>(
        `/classes/${selectedClassId.value}/approve`,
        { 
          maxStudents: maxStudentsInput.value,
          schedule: scheduleInput.value.trim() || null,
          roomName: roomNameInput.value === 'auto' ? null : roomNameInput.value,
          startDate: startDateInput.value || null,
          endDate: endDateInput.value || null
        }
      )
      if (res && res.success) {
        closeApproveModal()
        if (onSuccess) onSuccess()
      } else {
        errorMessage.value = res.error || res.message || 'Lỗi khi duyệt lớp học.'
      }
    } catch (err: any) {
      errorMessage.value = err.message || 'Gặp lỗi trong quá trình thực thi giao dịch.'
    } finally {
      submitting.value = false
    }
  }

  return {
    isApproveModalOpen,
    selectedClassId,
    selectedSemester,
    maxStudentsInput,
    scheduleInput,
    roomNameInput,
    startDateInput,
    endDateInput,
    submitting,
    errorMessage,
    openApproveModal,
    closeApproveModal,
    submitApproveClass
  }
}

