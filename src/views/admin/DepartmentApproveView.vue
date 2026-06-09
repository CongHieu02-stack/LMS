<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { apiGet, apiPost } from '@/lib/api'
import { useAdminActions } from '@/composables/useAdminActions'
import ReasonDialog from '@/components/ReasonDialog.vue'

// State
const subjects = ref<any[]>([])
const loading = ref(false)
const successMessage = ref<string | null>(null)
const errorMessage = ref<string | null>(null)

// Filters
const selectedDepartment = ref('')
const selectedStatus = ref('pending') // default to show pending first

const departments = [
  'Khoa Công nghệ thông tin',
  'Khoa Quản trị - Marketing',
  'Khoa Tài chính - Thương mại',
  'Khoa Khoa học Xã hội & Ngôn ngữ Quốc tế',
  'Khoa Truyền thông số',
  'Khoa Khoa học Sức khỏe'
]

// Modal & Actions Composables
const {
  showModal,
  actionType,
  reason,
  submitting,
  errorMsg,
  openReasonModal,
  closeReasonModal,
  submitAction
} = useAdminActions(async (action) => {
  successMessage.value = action === 'TU_CHOI' 
    ? 'Đã từ chối môn học thành công.' 
    : 'Đã khóa môn học thành công.'
  await fetchSubjects()
})

async function fetchSubjects() {
  loading.value = true
  errorMessage.value = null
  try {
    const res = await apiGet<any>('/subjects')
    subjects.value = res.data || []
  } catch (err: any) {
    errorMessage.value = err.message || 'Không thể tải danh sách môn học.'
  } finally {
    loading.value = false
  }
}

onMounted(fetchSubjects)

// Filtered subjects
const filteredSubjects = computed(() => {
  return subjects.value.filter((s) => {
    const matchesDept = !selectedDepartment.value || s.department === selectedDepartment.value
    const matchesStatus = !selectedStatus.value || s.status === selectedStatus.value
    return matchesDept && matchesStatus
  })
})

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

// Action handlers
async function handleApprove(subject: any) {
  showCustomConfirm(
    'Xác nhận duyệt môn học',
    `Bạn có chắc chắn muốn DUYỆT môn học "${subject.name}" (${subject.code})?`,
    async () => {
      loading.value = true
      errorMessage.value = null
      successMessage.value = null

      try {
        const res = await apiPost<{ success: boolean; message: string }>('/admin/action', {
          entity: 'department',
          targetId: subject.id,
          action: 'DUYET',
          reason: null
        })
        if (res && res.success) {
          successMessage.value = `Đã duyệt thành công môn học "${subject.name}".`
          await fetchSubjects()
        }
      } catch (err: any) {
        errorMessage.value = err.message || 'Gặp lỗi khi phê duyệt môn học.'
      } finally {
        loading.value = false
      }
    },
    'Duyệt môn'
  )
}

function handleReject(subject: any) {
  openReasonModal(subject.id, 'department', 'TU_CHOI')
}

function handleLock(subject: any) {
  openReasonModal(subject.id, 'department', 'KHOA')
}

function getStatusBadge(s: any) {
  if (s.is_locked) return { text: 'Đã khóa', cls: 'badge-locked' }
  if (s.status === 'approved') return { text: 'Đã duyệt', cls: 'badge-approved' }
  if (s.status === 'rejected') return { text: 'Bị từ chối', cls: 'badge-rejected' }
  return { text: 'Chờ duyệt', cls: 'badge-pending' }
}
</script>

<template>
  <div class="mono-wrapper">
    <!-- Header -->
    <div class="page-header">
      <div>
        <div class="breadcrumb">Quản lý Bộ môn / <span>Phê duyệt môn học</span></div>
        <h1 class="page-title">Phê Duyệt & Khóa Môn Học</h1>
        <div class="page-subtitle">Xem xét các đề xuất môn học từ Khoa/Bộ môn, duyệt hoặc khóa môn học kèm lý do.</div>
      </div>
      <button class="btn-refresh" @click="fetchSubjects" :disabled="loading">
        <i class="pi pi-refresh" :class="{ 'pi-spin': loading }"></i> Tải lại
      </button>
    </div>

    <!-- Alert Notifications -->
    <div v-if="successMessage" class="mono-alert alert-success mb-6">
      <i class="pi pi-check-circle"></i>
      <div><strong>Thành công:</strong> {{ successMessage }}</div>
    </div>
    <div v-if="errorMessage" class="mono-alert alert-error mb-6">
      <i class="pi pi-times-circle"></i>
      <div><strong>Lỗi:</strong> {{ errorMessage }}</div>
    </div>

    <!-- Filter Card -->
    <div class="filter-card mb-6">
      <div class="filter-row">
        <div class="fg">
          <label>Khoa / Bộ môn</label>
          <select v-model="selectedDepartment" class="mono-input">
            <option value="">-- Tất cả bộ môn --</option>
            <option v-for="d in departments" :key="d" :value="d">{{ d }}</option>
          </select>
        </div>
        <div class="fg">
          <label>Trạng thái</label>
          <select v-model="selectedStatus" class="mono-input">
            <option value="">-- Tất cả trạng thái --</option>
            <option value="pending">Chờ duyệt</option>
            <option value="approved">Đã duyệt</option>
            <option value="rejected">Bị từ chối</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Table content -->
    <div class="mono-card">
      <div class="card-header">
        <span>Danh sách môn học bộ môn</span>
        <span class="count-badge">Tổng số: {{ filteredSubjects.length }}</span>
      </div>

      <div class="card-body no-padding">
        <div v-if="loading" class="loading-state">
          <i class="pi pi-spin pi-spinner spinner-icon"></i>
          <span>Đang tải danh sách môn học...</span>
        </div>

        <div v-else-if="filteredSubjects.length === 0" class="empty-state">
          <i class="pi pi-folder-open empty-icon"></i>
          <p>Không tìm thấy môn học nào phù hợp với bộ lọc.</p>
        </div>

        <div v-else class="table-responsive">
          <table class="mono-table">
            <thead>
              <tr>
                <th>Mã môn</th>
                <th>Tên môn học</th>
                <th>Tín chỉ</th>
                <th>Khoa/Bộ môn</th>
                <th>Trạng thái</th>
                <th>Mô tả/Đề cương</th>
                <th class="actions-col">Hành động</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in filteredSubjects" :key="s.id">
                <td class="code-cell">{{ s.code }}</td>
                <td class="name-cell">
                  <strong>{{ s.name }}</strong>
                  <div v-if="s.rejection_reason" class="reason-text">Lý do từ chối: {{ s.rejection_reason }}</div>
                  <div v-if="s.is_locked" class="reason-text text-red">Lý do khóa: {{ s.lock_reason }}</div>
                </td>
                <td>{{ s.credits }} TC</td>
                <td><span class="dept-tag">{{ s.department || 'Công nghệ thông tin' }}</span></td>
                <td>
                  <span class="status-badge" :class="getStatusBadge(s).cls">
                    {{ getStatusBadge(s).text }}
                  </span>
                </td>
                <td class="desc-cell">{{ s.description }}</td>
                <td class="actions-cell">
                  <!-- Actions for Pending -->
                  <div class="btn-group" v-if="s.status === 'pending' && !s.is_locked">
                    <button class="action-btn btn-approve" @click="handleApprove(s)" title="Phê duyệt">
                      <i class="pi pi-check"></i> Duyệt
                    </button>
                    <button class="action-btn btn-reject" @click="handleReject(s)" title="Từ chối">
                      <i class="pi pi-times"></i> Từ chối
                    </button>
                  </div>

                  <!-- Actions for Approved / Rejected (Can lock or unlock) -->
                  <div class="btn-group" v-else>
                    <button v-if="!s.is_locked" class="action-btn btn-lock" @click="handleLock(s)" title="Khóa môn học">
                      <i class="pi pi-lock"></i> Khóa môn
                    </button>
                    <span v-else class="text-muted"><i class="pi pi-lock"></i> Đã bị khóa</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Unified Dialog Component -->
    <ReasonDialog
      :visible="showModal"
      :title="actionType === 'KHOA' ? 'Khóa môn học' : 'Từ chối môn học'"
      :action-type="actionType"
      v-model="reason"
      :submitting="submitting"
      :error="errorMsg"
      @submit="submitAction"
      @close="closeReasonModal"
    />
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
          <button class="btn-save" @click="handleConfirmAccept">
            {{ confirmOkText }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mono-wrapper { display: flex; flex-direction: column; padding: 1.5rem 2rem; animation: fadeIn 0.3s ease-out; }
.page-header { margin-bottom: 2rem; border-bottom: 1px solid #e5e7eb; padding-bottom: 1rem; display: flex; justify-content: space-between; align-items: flex-end; }
.breadcrumb { font-size: 0.8rem; color: #6b7280; margin-bottom: 0.5rem; }
.breadcrumb span { color: #111827; font-weight: 600; }
.page-title { font-size: 1.75rem; font-weight: 600; margin: 0 0 0.5rem 0; color: #111827; }
.page-subtitle { font-size: 0.875rem; color: #6b7280; }

.btn-refresh { padding: 0.6rem 1.2rem; background-color: #fff; border: 1px solid #d1d5db; border-radius: 8px; color: #374151; font-weight: 500; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; transition: all 0.2s; }
.btn-refresh:hover:not(:disabled) { background-color: #f9fafb; border-color: #9ca3af; }

.mono-alert { display: flex; align-items: center; gap: 1rem; padding: 1rem 1.5rem; border-radius: 8px; font-size: 0.875rem; }
.alert-success { background-color: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; }
.alert-error { background-color: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }
.mb-6 { margin-bottom: 1.5rem; }

.filter-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 1.25rem 1.5rem; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05); }
.filter-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
.fg { display: flex; flex-direction: column; gap: 0.4rem; }
.fg label { font-size: 0.85rem; font-weight: 600; color: #374151; }

.mono-input { width: 100%; padding: 0.6rem 1rem; border: 1px solid #d1d5db; border-radius: 8px; font-family: inherit; font-size: 0.95rem; outline: none; box-sizing: border-box; background-color: #fff; color: #1f2937; }
.mono-input:focus { border-color: #7c3aed; box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.1); }

.mono-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); overflow: hidden; }
.card-header { background-color: #f9fafb; color: #111827; padding: 1rem 1.5rem; font-weight: 600; font-size: 0.9rem; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; }
.count-badge { font-size: 0.75rem; background-color: #e5e7eb; padding: 0.2rem 0.6rem; border-radius: 999px; font-weight: 500; }
.card-body.no-padding { padding: 0; }

.loading-state, .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4rem 0; color: #6b7280; gap: 0.75rem; }
.spinner-icon { font-size: 2rem; }
.empty-icon { font-size: 2.5rem; color: #9ca3af; }

.table-responsive { width: 100%; overflow-x: auto; }
.mono-table { width: 100%; border-collapse: collapse; text-align: left; font-size: 0.9rem; }
.mono-table th { background: #f9fafb; color: #4b5563; font-weight: 600; padding: 0.75rem 1.25rem; border-bottom: 1px solid #e5e7eb; }
.mono-table td { padding: 1rem 1.25rem; border-bottom: 1px solid #f3f4f6; color: #111827; vertical-align: middle; }

.code-cell { font-family: monospace; font-weight: 700; color: #111827; }
.name-cell { max-width: 250px; }
.desc-cell { max-width: 250px; font-size: 0.8rem; color: #6b7280; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.reason-text { font-size: 0.75rem; color: #b45309; margin-top: 0.25rem; font-style: italic; }
.reason-text.text-red { color: #b91c1c; }
.dept-tag { font-size: 0.75rem; background-color: #f3f4f6; padding: 0.15rem 0.5rem; border-radius: 4px; color: #4b5563; }

.status-badge { font-size: 0.72rem; font-weight: 600; padding: 0.25rem 0.6rem; border-radius: 9999px; white-space: nowrap; }
.badge-pending { background: #fef3c7; color: #92400e; }
.badge-approved { background: #dcfce7; color: #166534; }
.badge-rejected { background: #fee2e2; color: #991b1b; }
.badge-locked { background: #f3f4f6; color: #374151; border: 1px solid #d1d5db; }

.actions-col { text-align: right; width: 180px; }
.actions-cell { display: flex; justify-content: flex-end; }
.btn-group { display: flex; gap: 0.5rem; }
.action-btn { padding: 0.4rem 0.8rem; font-size: 0.8rem; font-weight: 500; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 0.35rem; border: 1px solid transparent; transition: all 0.2s; }

.btn-approve { background-color: #111827; color: #fff; }
.btn-approve:hover { background-color: #374151; }
.btn-reject { background-color: #fff; border-color: #d1d5db; color: #374151; }
.btn-reject:hover { background-color: #f9fafb; border-color: #9ca3af; }
.btn-lock { background-color: #fff; border-color: #fca5a5; color: #b91c1c; }
.btn-lock:hover { background-color: #fef2f2; }

.text-muted { font-size: 0.8rem; color: #9ca3af; }

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

/* Custom Modal Styles for Confirm Dialog */
.modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem; }
.modal-content { background: #fff; width: 100%; max-width: 500px; border-radius: 12px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); overflow: hidden; animation: slideUp 0.3s ease-out; }
.modal-header { display: flex; justify-content: space-between; align-items: center; padding: 1.25rem 1.5rem; border-bottom: 1px solid #e5e7eb; }
.modal-header h2 { font-size: 1.1rem; font-weight: 600; margin: 0; color: #111827; }
.btn-close { background: none; border: none; font-size: 1.25rem; color: #9ca3af; cursor: pointer; transition: color 0.2s; }
.btn-close:hover { color: #111827; }
.modal-body { padding: 1.5rem; }
.modal-footer { padding: 1.25rem 1.5rem; border-top: 1px solid #e5e7eb; background: #f9fafb; display: flex; justify-content: flex-end; gap: 1rem; }
.btn-cancel { padding: 0.5rem 1rem; background: #fff; border: 1px solid #d1d5db; border-radius: 6px; font-weight: 500; color: #374151; cursor: pointer; transition: all 0.2s; }
.btn-cancel:hover:not(:disabled) { background: #f3f4f6; }
.btn-save { padding: 0.5rem 1.25rem; background: #7c3aed; border: 1px solid #7c3aed; border-radius: 6px; font-weight: 500; color: #fff; cursor: pointer; transition: all 0.2s; }
.btn-save:hover:not(:disabled) { background: #6d28d9; border-color: #6d28d9; }
@keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
</style>
