// ============================================================================
// composables/useClassApproval.ts — Composable điều phối duyệt lớp học
// Trách nhiệm DUY NHẤT: Quản lý State Modal, Validate, và gọi API duyệt lớp.
// ============================================================================

import { ref } from 'vue'
import { apiPut } from '@/lib/api'

export function useClassApproval(onSuccess?: () => void) {
  const isApproveModalOpen = ref(false)
  const selectedClassId = ref<string | null>(null)
  const maxStudentsInput = ref<number | null>(null)
  const scheduleInput = ref<string>('')
  const submitting = ref(false)
  const errorMessage = ref<string | null>(null)

  function openApproveModal(classId: string, existingSchedule?: string) {
    selectedClassId.value = classId
    maxStudentsInput.value = null
    scheduleInput.value = existingSchedule || ''
    errorMessage.value = null
    isApproveModalOpen.value = true
  }

  function closeApproveModal() {
    isApproveModalOpen.value = false
    selectedClassId.value = null
    maxStudentsInput.value = null
    scheduleInput.value = ''
    errorMessage.value = null
  }

  async function submitApproveClass() {
    if (!selectedClassId.value) return
    
    if (maxStudentsInput.value === null || maxStudentsInput.value === undefined || maxStudentsInput.value <= 0) {
      errorMessage.value = 'Số lượng sinh viên tối đa phải lớn hơn 0.'
      return
    }

    submitting.value = true
    errorMessage.value = null
    try {
      const res = await apiPut<any>(
        `/classes/${selectedClassId.value}/approve`,
        { 
          maxStudents: maxStudentsInput.value,
          schedule: scheduleInput.value.trim() || null
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
    maxStudentsInput,
    scheduleInput,
    submitting,
    errorMessage,
    openApproveModal,
    closeApproveModal,
    submitApproveClass
  }
}

