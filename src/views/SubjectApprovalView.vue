<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { apiGet, apiPut } from '@/lib/api'

interface CreatorProfile {
  id?: string;
  fullName?: string;
  full_name?: string;
}

interface Subject {
  id: string;
  code: string;
  name: string;
  credits: number;
  description?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string | null;
  creator?: CreatorProfile | null;
}

// State
const subjects = ref<Subject[]>([])
const loading = ref(false)
const errorMessage = ref<string | null>(null)
const successMessage = ref<string | null>(null)

// Custom Confirm Dialog State
const isConfirmModalOpen = ref(false)
const confirmTitle = ref('')
const confirmMessage = ref('')
const confirmOkText = ref('Xác nhận')
let onConfirmCallback: (() => void) | null = null

function showCustomConfirm(title: string, message: string, onConfirm: () => void, okText = 'Xác nhận') {
  confirmTitle.value = title
  confirmMessage.value = message
  confirmOkText.value = okText
  onConfirmCallback = onConfirm
  isConfirmModalOpen.value = true
}

function handleConfirmAccept() {
  if (onConfirmCallback) onConfirmCallback()
  isConfirmModalOpen.value = false
}

function handleConfirmCancel() {
  isConfirmModalOpen.value = false
}

// Modal State
const showRejectModal = ref(false)
const rejectReason = ref('')
const selectedSubject = ref<Subject | null>(null)
const submittingReject = ref(false)

// Fetch danh sách môn học
async function fetchSubjects() {
  loading.value = true
  errorMessage.value = null
  try {
    const res = await apiGet<{ success: boolean; data: Subject[] }>('/subjects')
    if (res.success && res.data) {
      subjects.value = res.data
    }
  } catch (err) {
    errorMessage.value = (err as Error).message || 'Không thể tải danh sách môn học.'
  } finally {
    loading.value = false
  }
}

// Xử lý phê duyệt
async function handleApprove(subject: Subject) {
  showCustomConfirm(
    'Xác nhận phê duyệt',
    `Bạn có chắc chắn muốn PHÊ DUYỆT môn học "${subject.name}" (${subject.code}) không?`,
    async () => {
      loading.value = true
      errorMessage.value = null
      successMessage.value = null

      try {
        const res = await apiPut<{ success: boolean }>(`/subjects/${subject.id}/status`, {
          status: 'approved'
        })

        if (res.success) {
          successMessage.value = `Đã phê duyệt thành công môn học "${subject.name}".`
          await fetchSubjects()
        }
      } catch (err) {
        errorMessage.value = (err as Error).message || `Gặp lỗi khi phê duyệt môn học.`
      } finally {
        loading.value = false
      }
    },
    'Phê duyệt'
  )
}

// Xử lý mở Modal từ chối
function openRejectModal(subject: Subject) {
  selectedSubject.value = subject
  rejectReason.value = ''
  showRejectModal.value = true
}

function closeRejectModal() {
  showRejectModal.value = false
  selectedSubject.value = null
  rejectReason.value = ''
}

// Gửi yêu cầu từ chối
async function submitReject() {
  if (!rejectReason.value.trim() || !selectedSubject.value) {
    errorMessage.value = 'Vui lòng nhập lý do từ chối môn học.'
    return
  }

  submittingReject.value = true
  errorMessage.value = null
  successMessage.value = null

  try {
    const res = await apiPut<{ success: boolean }>(`/subjects/${selectedSubject.value.id}/status`, {
      status: 'rejected',
      rejection_reason: rejectReason.value
    })

    if (res.success) {
      successMessage.value = `Đã từ chối môn học "${selectedSubject.value.name}".`
      closeRejectModal()
      await fetchSubjects()
    }
  } catch (err) {
    errorMessage.value = (err as Error).message || `Gặp lỗi khi từ chối môn học.`
  } finally {
    submittingReject.value = false
  }
}

onMounted(() => {
  fetchSubjects()
})
</script>

<template>
  <div class="mono-wrapper">
    <!-- Breadcrumb -->
    <div class="page-header">
      <div class="breadcrumb">
        Quản trị / <span>Xem & Duyệt môn học mới</span>
      </div>
      <h1 class="page-title">Duyệt Môn Học</h1>
      <div class="page-subtitle">Duyệt hoặc từ chối các môn học mới do các khoa bộ môn đề xuất.</div>
    </div>

    <!-- Alert thông báo -->
    <div v-if="errorMessage" class="mono-alert alert-error">
      <i class="pi pi-exclamation-triangle"></i> 
      <div><strong>LỖI:</strong> {{ errorMessage }}</div>
    </div>
    <div v-if="successMessage" class="mono-alert alert-success">
      <i class="pi pi-check"></i> 
      <div><strong>THÀNH CÔNG:</strong> {{ successMessage }}</div>
    </div>

    <!-- Danh sách môn học -->
    <div class="mono-card">
      <div class="card-header">
        <span>Danh sách chờ duyệt</span>
        <i class="pi pi-check-square"></i>
      </div>

      <div v-if="loading && subjects.length === 0" class="loading-state">
        <i class="pi pi-spin pi-spinner spinner"></i>
        <div>Đang tải danh sách...</div>
      </div>

      <div v-else-if="subjects.length === 0" class="empty-state">
        <i class="pi pi-book empty-icon"></i>
        <h2>Hộp thư rỗng</h2>
        <p>Hiện tại không có môn học nào đang chờ phê duyệt.</p>
      </div>

      <div v-else class="table-container">
        <table class="mono-table">
          <thead>
            <tr>
              <th>Mã môn học</th>
              <th>Tên & Mô tả</th>
              <th class="text-center">Số TC</th>
              <th>Người đề xuất</th>
              <th class="text-center">Trạng thái</th>
              <th class="text-right">Hành động</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="sub in subjects" :key="sub.id" class="table-row">
              <td class="code-cell">{{ sub.code }}</td>
              <td>
                <div class="subject-name">{{ sub.name }}</div>
                <div class="subject-desc">{{ sub.description || 'Không có mô tả.' }}</div>
              </td>
              <td class="text-center font-black">{{ sub.credits || 0 }}</td>
              <td class="user-cell">
                <i class="pi pi-user mr-1"></i> {{ sub.creator?.full_name || 'Hệ thống' }}
              </td>
              <td class="text-center">
                <span class="mono-badge" :class="`badge-${sub.status}`">
                  {{ sub.status === 'pending' ? 'Chờ duyệt' : sub.status === 'approved' ? 'Đã duyệt' : 'Từ chối' }}
                </span>
                <div v-if="sub.status === 'rejected' && sub.rejection_reason" class="reject-reason-text">
                  Lý do: {{ sub.rejection_reason }}
                </div>
              </td>
              <td class="text-right">
                <div v-if="sub.status === 'pending'" class="action-buttons">
                  <button 
                    class="btn-icon btn-approve"
                    title="Phê duyệt"
                    @click="handleApprove(sub)"
                  >
                    <i class="pi pi-check"></i>
                  </button>
                  <button 
                    class="btn-icon btn-reject"
                    title="Từ chối"
                    @click="openRejectModal(sub)"
                  >
                    <i class="pi pi-times"></i>
                  </button>
                </div>
                <span v-else class="status-done">Hoàn tất</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- MODAL TỪ CHỐI -->
    <div v-if="showRejectModal" class="modal-overlay">
      <div class="modal-content">
        <div class="modal-header">
          <h2>Từ chối đề xuất môn học</h2>
          <button class="btn-close" @click="closeRejectModal"><i class="pi pi-times"></i></button>
        </div>
        <div class="modal-body">
          <p>Vui lòng cho biết lý do từ chối môn học <strong>{{ selectedSubject?.name }} ({{ selectedSubject?.code }})</strong>. Lý do này sẽ được hiển thị cho người đề xuất.</p>
          <div class="form-group">
            <label>Lý do từ chối <span class="text-red-500">*</span></label>
            <textarea 
              v-model="rejectReason" 
              class="mono-input textarea-reason" 
              placeholder="Ví dụ: Đề cương chưa đạt chuẩn, số tín chỉ không phù hợp..."
              rows="4"
            ></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" @click="closeRejectModal" :disabled="submittingReject">Hủy bỏ</button>
          <button class="btn-danger" @click="submitReject" :disabled="submittingReject || !rejectReason.trim()">
            <i v-if="submittingReject" class="pi pi-spin pi-spinner"></i>
            Xác nhận từ chối
          </button>
        </div>
      </div>
    </div>

    <!-- Custom Confirm Dialog -->
    <div v-if="isConfirmModalOpen" class="modal-overlay" @click.self="handleConfirmCancel">
      <div class="modal-content" style="max-width: 400px;">
        <div class="modal-header">
          <h2>{{ confirmTitle }}</h2>
          <button class="btn-close" @click="handleConfirmCancel"><i class="pi pi-times"></i></button>
        </div>
        <div class="modal-body" style="padding: 1.5rem;">
          <p style="font-size: 0.95rem; color: #374151; margin: 0; white-space: pre-line; line-height: 1.6;">
            {{ confirmMessage }}
          </p>
        </div>
        <div class="modal-footer" style="background: #f9fafb;">
          <button class="btn-cancel" @click="handleConfirmCancel">Hủy bỏ</button>
          <button class="btn-danger" style="background: #9333ea; border-color: #9333ea;" @click="handleConfirmAccept">
            {{ confirmOkText }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mono-wrapper {
  display: flex;
  flex-direction: column;
  padding: 1rem 2rem;
  box-sizing: border-box;
  animation: fadeIn 0.3s ease-out;
}

/* Header */
.page-header { margin-bottom: 2rem; border-bottom: 1px solid #e5e7eb; padding-bottom: 1rem; }
.breadcrumb { font-size: 0.75rem; color: #9ca3af; font-weight: 600; margin-bottom: 0.5rem; }
.breadcrumb span { color: #111827; font-weight: 600; }
.page-title { font-size: 2rem; font-weight: 600; margin: 0 0 0.5rem 0; color: #111827; }
.page-subtitle { font-size: 0.875rem; color: #6b7280; }

/* Alerts */
.mono-alert { display: flex; align-items: center; gap: 1rem; padding: 1rem 1.5rem; margin-bottom: 1.5rem; font-size: 0.875rem; border-radius: 8px; }
.mono-alert i { font-size: 1.25rem; }
.alert-error { background-color: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; }
.alert-success { background-color: #f0fdf4; border: 1px solid #bbf7d0; color: #15803d; }

/* Card */
.mono-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; box-shadow: 0 1px 3px 0 rgba(0,0,0,0.05); display: flex; flex-direction: column; overflow: hidden; }
.card-header { background-color: #f9fafb; color: #111827; padding: 1rem 1.5rem; font-weight: 600; font-size: 0.875rem; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; }

/* Empty & Loading States */
.loading-state, .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4rem; }
.loading-state { color: #9333ea; }
.loading-state .spinner { font-size: 2.5rem; margin-bottom: 1rem; }
.empty-state .empty-icon { font-size: 3rem; color: #d1d5db; margin-bottom: 1rem; }
.empty-state h2 { font-size: 1.25rem; font-weight: 600; margin: 0 0 0.5rem 0; color: #111827; }
.empty-state p { font-size: 0.875rem; color: #6b7280; }

/* Table */
.table-container { overflow-x: auto; }
.mono-table { width: 100%; border-collapse: collapse; text-align: left; }
.mono-table th { background-color: #f9fafb; border-bottom: 1px solid #e5e7eb; padding: 1rem; font-size: 0.75rem; font-weight: 600; color: #111827; }
.mono-table td { padding: 1rem; border-bottom: 1px solid #e5e7eb; vertical-align: middle; }
.table-row:hover { background-color: #faf5ff; }

.code-cell { font-weight: 500; color: #9333ea; font-size: 0.875rem; }
.subject-name { font-weight: 600; color: #111827; font-size: 0.95rem; margin-bottom: 0.25rem; }
.subject-desc { font-size: 0.75rem; color: #6b7280; }
.user-cell { font-size: 0.875rem; color: #4b5563; font-weight: 500; }
.font-black { font-weight: 600; }
.text-center { text-align: center; }
.text-right { text-align: right; }

/* Badges */
.mono-badge { display: inline-block; font-size: 0.65rem; font-weight: 600; padding: 0.25rem 0.75rem; border-radius: 9999px; }
.badge-pending { background-color: #fef3c7; color: #92400e; }
.badge-approved { background-color: #dcfce7; color: #166534; }
.badge-rejected { background-color: #fee2e2; color: #991b1b; }
.reject-reason-text { font-size: 0.7rem; color: #ef4444; margin-top: 4px; font-style: italic; max-width: 150px; text-align: center; margin-left: auto; margin-right: auto; }

/* Action Buttons */
.action-buttons { display: flex; justify-content: flex-end; gap: 0.5rem; }
.btn-icon { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border: 1px solid #e5e7eb; border-radius: 8px; background-color: #fff; cursor: pointer; transition: all 0.2s; }
.btn-approve { color: #166534; }
.btn-approve:hover { background-color: #dcfce7; border-color: #166534; }
.btn-reject { color: #991b1b; }
.btn-reject:hover { background-color: #fee2e2; border-color: #991b1b; }
.status-done { font-size: 0.75rem; font-weight: 600; color: #9ca3af; }

/* Modal Styles */
.modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem; }
.modal-content { background: #fff; width: 100%; max-width: 500px; border-radius: 12px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); overflow: hidden; animation: slideUp 0.3s ease-out; }
.modal-header { display: flex; justify-content: space-between; align-items: center; padding: 1.25rem 1.5rem; border-bottom: 1px solid #e5e7eb; }
.modal-header h2 { font-size: 1.25rem; font-weight: 600; margin: 0; color: #111827; }
.btn-close { background: none; border: none; font-size: 1.25rem; color: #9ca3af; cursor: pointer; transition: color 0.2s; }
.btn-close:hover { color: #111827; }
.modal-body { padding: 1.5rem; }
.modal-body p { margin-top: 0; margin-bottom: 1rem; font-size: 0.9rem; color: #4b5563; line-height: 1.5; }
.form-group { display: flex; flex-direction: column; gap: 0.5rem; }
.form-group label { font-size: 0.875rem; font-weight: 600; color: #374151; }
.text-red-500 { color: #ef4444; }
.mono-input { width: 100%; padding: 0.75rem 1rem; border: 1px solid #d1d5db; border-radius: 8px; font-family: inherit; font-size: 0.95rem; outline: none; transition: all 0.2s; box-sizing: border-box; }
.mono-input:focus { border-color: #9333ea; box-shadow: 0 0 0 3px rgba(147, 51, 234, 0.1); }
.textarea-reason { resize: vertical; min-height: 100px; }
.modal-footer { padding: 1.25rem 1.5rem; border-top: 1px solid #e5e7eb; background: #f9fafb; display: flex; justify-content: flex-end; gap: 1rem; }
.btn-cancel { padding: 0.5rem 1rem; background: #fff; border: 1px solid #d1d5db; border-radius: 6px; font-weight: 500; color: #374151; cursor: pointer; transition: all 0.2s; }
.btn-cancel:hover:not(:disabled) { background: #f3f4f6; }
.btn-danger { padding: 0.5rem 1.25rem; background: #ef4444; border: 1px solid #ef4444; border-radius: 6px; font-weight: 500; color: #fff; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; transition: all 0.2s; }
.btn-danger:hover:not(:disabled) { background: #dc2626; border-color: #dc2626; }
.btn-danger:disabled, .btn-cancel:disabled { opacity: 0.6; cursor: not-allowed; }

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
</style>
