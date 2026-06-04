// ============================================================================
// composables/useAdminActions.ts — Composable điều khiển Modal/Dialog nhập lý do dùng chung
// ============================================================================

import { ref } from 'vue'
import { apiPost, apiPut } from '@/lib/api'

export function useAdminActions(onSuccess?: () => void) {
  const showModal = ref(false)
  const targetId = ref<string | null>(null)
  const entity = ref<'subject' | 'class' | 'department' | 'user' | null>(null)
  const actionType = ref<'DUYET' | 'TU_CHOI' | 'KHOA' | null>(null)
  const reason = ref('')
  const password = ref('')
  const submitting = ref(false)
  const errorMsg = ref<string | null>(null)
  const successMsg = ref<string | null>(null)

  function openReasonModal(
    id: string,
    ent: 'subject' | 'class' | 'department' | 'user',
    action: 'DUYET' | 'TU_CHOI' | 'KHOA'
  ) {
    targetId.value = id
    entity.value = ent
    actionType.value = action
    reason.value = ''
    password.value = ''
    errorMsg.value = null
    successMsg.value = null
    showModal.value = true
  }

  function closeReasonModal() {
    showModal.value = false
    targetId.value = null
    entity.value = null
    actionType.value = null
    reason.value = ''
    password.value = ''
    errorMsg.value = null
  }

  async function submitAction() {
    if (!targetId.value || !entity.value || !actionType.value) return

    if (['TU_CHOI', 'KHOA'].includes(actionType.value) && !reason.value.trim()) {
      errorMsg.value = 'Lý do bắt buộc phải nhập.'
      return
    }

    submitting.value = true
    errorMsg.value = null
    try {
      let res: any

      // Nếu thực thể là 'user', gọi API quản lý profiles riêng biệt
      if (entity.value === 'user') {
        if (actionType.value === 'KHOA') {
          res = await apiPut<any>(`/profiles/${targetId.value}/lock`, {
            isLocked: true,
            reason: reason.value.trim()
          })
        }
      } else {
        // Gọi RPC handle_admin_action tập trung ở backend
        res = await apiPost<{ success: boolean; message: string }>('/admin/action', {
          entity: entity.value,
          targetId: targetId.value,
          action: actionType.value,
          reason: reason.value.trim() || null
        })
      }

      if (res && res.success) {
        successMsg.value = res.message || 'Thao tác thành công.'
        closeReasonModal()
        if (onSuccess) onSuccess()
      } else {
        errorMsg.value = res?.error || 'Lỗi khi thực hiện hành động.'
      }
    } catch (err: any) {
      errorMsg.value = err.message || 'Lỗi khi thực hiện hành động quản trị.'
    } finally {
      submitting.value = false
    }
  }

  return {
    showModal,
    targetId,
    entity,
    actionType,
    reason,
    password,
    submitting,
    errorMsg,
    successMsg,
    openReasonModal,
    closeReasonModal,
    submitAction
  }
}
