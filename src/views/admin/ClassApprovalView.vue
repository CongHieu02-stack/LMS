<!-- ClassApprovalView.vue — Phê duyệt lớp học -->
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { apiGet, apiPut } from '@/lib/api'
import { useClassApproval } from '@/composables/useClassApproval'
import { useToast } from 'primevue/usetoast'
import pvToast from 'primevue/toast'
import InputNumber from 'primevue/inputnumber'

const toast = useToast()
const activeTab = ref<'proposals' | 'classes'>('proposals')
const classes = ref<any[]>([])
const proposals = ref<any[]>([])
const loading = ref(true)
const processing = ref<string | null>(null)
const msg = ref<string | null>(null)

async function loadData() {
  loading.value = true
  msg.value = null
  try {
    const [propRes, classRes] = await Promise.all([
      apiGet<{ success: boolean; data: any[] }>('/class-proposals/pending'),
      apiGet<any>('/classes')
    ])
    proposals.value = propRes.data || []
    const allClasses = classRes.data || classRes || []
    classes.value = allClasses.filter((c: any) => c.status === 'draft')
  } catch (err: any) {
    msg.value = err.message || 'Không thể tải dữ liệu từ máy chủ.'
  } finally {
    loading.value = false
  }
}

async function handleProposalAction(id: string, status: 'approved' | 'rejected') {
  const confirmMsg = status === 'approved'
    ? 'Bạn có chắc chắn muốn DUYỆT đề xuất này không?\nHệ thống sẽ tự động khởi tạo các khung lớp.'
    : 'Bạn có chắc chắn muốn TỪ CHỐI đề xuất này không?'
  if (!confirm(confirmMsg)) return

  processing.value = id
  try {
    const res = await apiPut<{ success: boolean; message: string }>(`/class-proposals/${id}/status`, { status })
    if (res?.success) {
      toast.add({ severity: 'success', summary: 'Thành công', detail: res.message || 'Đã cập nhật.', life: 4000 })
      await loadData()
      if (status === 'approved') activeTab.value = 'classes'
    }
  } catch (err: any) {
    toast.add({ severity: 'error', summary: 'Lỗi', detail: err.message, life: 5000 })
  } finally {
    processing.value = null
  }
}

const {
  isApproveModalOpen, maxStudentsInput, scheduleInput,
  submitting, errorMessage, openApproveModal, closeApproveModal, submitApproveClass
} = useClassApproval(async () => {
  toast.add({ severity: 'success', summary: 'Thành công', detail: 'Lớp đã được duyệt và tự động xếp phòng!', life: 4000 })
  await loadData()
})

async function handleApproveSubmit() {
  await submitApproveClass()
  if (errorMessage.value) {
    toast.add({ severity: 'error', summary: 'Lỗi duyệt lớp', detail: errorMessage.value, life: 5000 })
  }
}

async function handleReject(id: string) {
  if (!confirm('Bạn có chắc chắn muốn từ chối mở lớp học này không?')) return
  processing.value = id
  try {
    const res = await apiPut<{ success: boolean; message: string }>(`/classes/${id}/reject`, {})
    if (res?.success) {
      toast.add({ severity: 'success', summary: 'Đã từ chối', detail: 'Cập nhật trạng thái lớp thành công.', life: 4000 })
      await loadData()
    }
  } catch (err: any) {
    toast.add({ severity: 'error', summary: 'Lỗi', detail: err.message, life: 5000 })
  } finally {
    processing.value = null
  }
}

onMounted(loadData)
</script>

<template>
  <pv-toast />
  <div class="mono-wrapper">
    <!-- Header -->
    <div class="page-header">
      <div>
        <div class="breadcrumb">Quản lý Lớp học / <span>Phê duyệt lớp</span></div>
        <h1 class="page-title">Phê Duyệt &amp; Mở Lớp Học</h1>
        <div class="page-subtitle">Phòng đào tạo xem xét đề xuất mở lớp từ bộ môn và tự động xếp phòng ngẫu nhiên.</div>
      </div>
    </div>

    <!-- Alert -->
    <div v-if="msg" class="mono-alert alert-info">
      <i class="pi pi-info-circle"></i>
      <div>{{ msg }}</div>
    </div>

    <!-- Tab Navigation -->
    <div class="tabs-container">
      <button class="tab-btn" :class="{ active: activeTab === 'proposals' }" @click="activeTab = 'proposals'">
        <i class="pi pi-list"></i>
        Đề xuất số lượng lớp
        <span class="tab-badge" v-if="proposals.length > 0">{{ proposals.length }}</span>
      </button>
      <button class="tab-btn" :class="{ active: activeTab === 'classes' }" @click="activeTab = 'classes'">
        <i class="pi pi-building"></i>
        Lớp học chờ xếp phòng
        <span class="tab-badge" v-if="classes.length > 0">{{ classes.length }}</span>
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="loading-state">
      <i class="pi pi-spin pi-spinner spinner"></i>
      <div>Đang tải dữ liệu...</div>
    </div>

    <div v-else>
      <!-- TAB 1: ĐỀ XUẤT SỐ LƯỢNG LỚP -->
      <div v-if="activeTab === 'proposals'">
        <div v-if="proposals.length === 0" class="empty-state">
          <i class="pi pi-check-circle empty-icon"></i>
          <h3>Không có đề xuất số lượng lớp nào chờ duyệt</h3>
          <p>Tất cả đề xuất mở lớp học từ Trưởng bộ môn đã được xử lý.</p>
        </div>
        <div v-else class="mono-card">
          <div class="card-header">
            <span>Danh sách đề xuất chờ duyệt</span>
            <i class="pi pi-check-square"></i>
          </div>
          <div class="table-container">
            <table class="mono-table">
              <thead>
                <tr>
                  <th>Môn học</th>
                  <th class="text-center">SL lớp</th>
                  <th>Học kỳ</th>
                  <th>Người đề xuất</th>
                  <th>Lý do</th>
                  <th class="text-center">Hành động</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="p in proposals" :key="p.id" class="table-row">
                  <td>
                    <span class="code-cell">{{ p.subject?.code }}</span>
                    <span class="subject-name"> — {{ p.subject?.name }}</span>
                  </td>
                  <td class="text-center font-bold">{{ p.quantity }}</td>
                  <td class="semester-cell">{{ p.semester }}</td>
                  <td class="user-cell">
                    <i class="pi pi-user mr-1"></i>{{ p.proposer?.full_name || '—' }}
                  </td>
                  <td class="reason-cell">{{ p.reason || '—' }}</td>
                  <td class="text-center">
                    <div class="action-buttons">
                      <button class="btn-approve" @click="handleProposalAction(p.id, 'approved')" :disabled="processing === p.id">
                        <i class="pi pi-check"></i> Duyệt đề xuất
                      </button>
                      <button class="btn-reject" @click="handleProposalAction(p.id, 'rejected')" :disabled="processing === p.id">
                        <i class="pi pi-times"></i> Từ chối
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- TAB 2: LỚP HỌC CHỜ XẾP PHÒNG -->
      <div v-if="activeTab === 'classes'">
        <div v-if="classes.length === 0" class="empty-state">
          <i class="pi pi-check-circle empty-icon"></i>
          <h3>Không có lớp học nào đang chờ xếp phòng</h3>
          <p>Hãy duyệt các đề xuất lớp học ở Tab 1 để tạo khung lớp mới trước.</p>
        </div>
        <div v-else class="mono-card">
          <div class="card-header">
            <span>Lớp học chờ duyệt mở &amp; xếp phòng</span>
            <i class="pi pi-building"></i>
          </div>
          <div class="table-container">
            <table class="mono-table">
              <thead>
                <tr>
                  <th>Môn học</th>
                  <th>Mã lớp</th>
                  <th>Học kỳ</th>
                  <th>Lịch học</th>
                  <th>TBM phụ trách</th>
                  <th class="text-center">Hành động</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="c in classes" :key="c.id" class="table-row">
                  <td>
                    <span class="code-cell">{{ c.subject?.code }}</span>
                    <span class="subject-name"> — {{ c.subject?.name }}</span>
                  </td>
                  <td><strong>{{ c.code }}</strong></td>
                  <td class="semester-cell">{{ c.semester }}</td>
                  <td class="schedule-cell">{{ c.schedule || '—' }}</td>
                  <td class="user-cell">
                    <i class="pi pi-user mr-1"></i>{{ c.manager?.fullName || '—' }}
                  </td>
                  <td class="text-center">
                    <div class="action-buttons">
                      <button class="btn-approve" @click="openApproveModal(c.id, c.schedule)" :disabled="processing === c.id">
                        <i class="pi pi-check"></i> Duyệt mở
                      </button>
                      <button class="btn-reject" @click="handleReject(c.id)" :disabled="processing === c.id">
                        <i class="pi pi-times"></i> Từ chối
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Duyệt mở lớp & Tìm phòng -->
    <div v-if="isApproveModalOpen" class="modal-overlay" @click.self="closeApproveModal">
      <div class="mono-modal">
        <div class="modal-header">
          <span>Xác Nhận Duyệt &amp; Xếp Phòng</span>
          <button class="btn-close" @click="closeApproveModal"><i class="pi pi-times"></i></button>
        </div>
        <div class="modal-body">
          <p class="modal-desc">
            Nhập sĩ số tối đa dự kiến. Hệ thống sẽ tự động tìm một phòng trống ngẫu nhiên có sức chứa phù hợp.
          </p>
          <div v-if="errorMessage" class="mono-alert alert-error" style="margin-bottom:0">
            <i class="pi pi-exclamation-triangle"></i>
            <div>{{ errorMessage }}</div>
          </div>
          <div class="form-group">
            <label class="form-label">Lịch học <span class="form-hint">(Ví dụ: T2(T1-3), T5(T4-6))</span></label>
            <input v-model="scheduleInput" type="text" class="mono-input" placeholder="Để trống nếu chưa xác định" />
          </div>
          <div class="form-group">
            <label class="form-label">Sĩ số tối đa <span class="required">*</span></label>
            <InputNumber
              v-model="maxStudentsInput"
              :min="1"
              placeholder="Ví dụ: 40"
              class="mono-input-number"
              :useGrouping="false"
              required
            />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" @click="closeApproveModal" :disabled="submitting">Hủy</button>
          <button class="btn-save" @click="handleApproveSubmit" :disabled="submitting">
            <i v-if="submitting" class="pi pi-spin pi-spinner"></i>
            <i v-else class="pi pi-send"></i>
            Xác nhận duyệt &amp; tìm phòng
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

/* ── Header ── */
.page-header {
  margin-bottom: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 1rem;
}
.breadcrumb { font-size: 0.75rem; color: #9ca3af; font-weight: 600; margin-bottom: 0.5rem; }
.breadcrumb span { color: #111827; font-weight: 600; }
.page-title { font-size: 2rem; font-weight: 600; margin: 0 0 0.5rem 0; color: #111827; }
.page-subtitle { font-size: 0.875rem; color: #6b7280; }

/* ── Alerts ── */
.mono-alert {
  display: flex; align-items: center; gap: 1rem;
  padding: 0.875rem 1.25rem; margin-bottom: 1.25rem;
  font-size: 0.875rem; border-radius: 8px;
}
.mono-alert i { font-size: 1.1rem; flex-shrink: 0; }
.alert-info  { background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; }
.alert-error { background: #fef2f2; border: 2px solid #ef4444; color: #b91c1c; }

/* ── Tabs ── */
.tabs-container {
  display: flex;
  gap: 0.25rem;
  border-bottom: 2px solid #e5e7eb;
  margin-bottom: 1.5rem;
}
.tab-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  font-size: 0.875rem;
  font-weight: 600;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s;
  border-radius: 0;
}
.tab-btn:hover { color: #111827; }
.tab-btn.active {
  color: #7c3aed;
  border-bottom-color: #7c3aed;
  background: #faf5ff;
}
.tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #7c3aed;
  color: #fff;
  font-size: 0.7rem;
  font-weight: 700;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 9999px;
}
.tab-btn:not(.active) .tab-badge {
  background: #e5e7eb;
  color: #374151;
}

/* ── Loading / Empty ── */
.loading-state {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; padding: 5rem; color: #7c3aed; gap: 1rem;
}
.spinner { font-size: 2.5rem; }
.loading-state div { font-size: 0.85rem; color: #6b7280; font-weight: 600; }
.empty-state {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; padding: 5rem; text-align: center;
}
.empty-icon { font-size: 3rem; color: #d1d5db; margin-bottom: 1rem; }
.empty-state h3 { font-size: 1.1rem; font-weight: 600; color: #374151; margin: 0 0 0.5rem 0; }
.empty-state p  { font-size: 0.875rem; color: #9ca3af; margin: 0; }

/* ── Card ── */
.mono-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05), 0 1px 2px -1px rgba(0,0,0,0.03);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.card-header {
  background: #f9fafb; color: #111827;
  padding: 1rem 1.5rem; font-weight: 600;
  font-size: 0.875rem; border-bottom: 1px solid #e5e7eb;
  display: flex; justify-content: space-between; align-items: center;
}
.card-header i { color: #9ca3af; }

/* ── Table ── */
.table-container { overflow-x: auto; }
.mono-table { width: 100%; border-collapse: collapse; text-align: left; }
.mono-table th {
  background: #f9fafb; border-bottom: 1px solid #e5e7eb;
  padding: 0.875rem 1rem; font-size: 0.75rem; font-weight: 600; color: #374151;
}
.mono-table td {
  padding: 0.875rem 1rem;
  border-bottom: 1px solid #f3f4f6;
  vertical-align: middle; font-size: 0.875rem;
}
.table-row:last-child td { border-bottom: none; }
.table-row:hover { background: #faf5ff; }

.code-cell    { font-weight: 700; color: #7c3aed; }
.subject-name { color: #374151; }
.semester-cell { color: #4b5563; font-weight: 500; }
.schedule-cell { color: #6b7280; font-size: 0.8rem; }
.user-cell    { color: #4b5563; }
.reason-cell  { color: #6b7280; font-size: 0.8rem; max-width: 180px; }
.font-bold    { font-weight: 700; }
.text-center  { text-align: center; }
.mr-1         { margin-right: 0.25rem; }

/* ── Action Buttons ── */
.action-buttons { display: flex; gap: 0.5rem; justify-content: center; }
.btn-approve {
  padding: 0.45rem 0.9rem;
  background: #7c3aed; color: #fff;
  border: 1px solid #7c3aed; border-radius: 6px;
  font-size: 0.78rem; font-weight: 600;
  cursor: pointer; display: flex; align-items: center; gap: 0.3rem;
  transition: all 0.2s; font-family: inherit;
}
.btn-approve:hover:not(:disabled) { background: #6d28d9; border-color: #6d28d9; }
.btn-reject {
  padding: 0.45rem 0.9rem;
  background: #fff; color: #374151;
  border: 1px solid #e5e7eb; border-radius: 6px;
  font-size: 0.78rem; font-weight: 600;
  cursor: pointer; display: flex; align-items: center; gap: 0.3rem;
  transition: all 0.2s; font-family: inherit;
}
.btn-reject:hover:not(:disabled) { background: #fee2e2; border-color: #fca5a5; color: #991b1b; }
button:disabled { opacity: 0.5; cursor: not-allowed; }

/* ── Modal ── */
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.45);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000; padding: 1rem;
  animation: fadeIn 0.2s ease-out;
}
.mono-modal {
  background: #fff;
  border-radius: 12px;
  width: 100%; max-width: 500px;
  box-shadow: 0 20px 25px -5px rgba(0,0,0,0.15), 0 8px 10px -6px rgba(0,0,0,0.1);
  display: flex; flex-direction: column;
  animation: slideUp 0.25s ease-out;
  overflow: hidden;
}
.modal-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  font-size: 1rem; font-weight: 600; color: #111827;
}
.btn-close {
  background: none; border: none; color: #9ca3af;
  font-size: 1.1rem; cursor: pointer; transition: color 0.2s;
}
.btn-close:hover { color: #111827; }
.modal-body {
  padding: 1.5rem;
  display: flex; flex-direction: column; gap: 1.25rem;
}
.modal-desc { font-size: 0.875rem; color: #4b5563; line-height: 1.6; margin: 0; }
.form-group { display: flex; flex-direction: column; gap: 0.4rem; }
.form-label { font-size: 0.875rem; font-weight: 600; color: #111827; }
.form-hint  { font-weight: 400; color: #6b7280; font-size: 0.75rem; }
.required   { color: #ef4444; }
.mono-input {
  width: 100%; padding: 0.7rem 1rem;
  border: 1px solid #e5e7eb; border-radius: 8px;
  font-family: inherit; font-size: 0.9rem; color: #111827;
  outline: none; background: #fff; box-sizing: border-box;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.mono-input:focus { border-color: #7c3aed; box-shadow: 0 0 0 3px rgba(124,58,237,0.1); }
:deep(.mono-input-number) { width: 100%; }
:deep(.mono-input-number .p-inputnumber-input) {
  width: 100%; padding: 0.7rem 1rem; font-family: inherit;
  font-size: 0.9rem; color: #111827; background: #fff;
  border: 1px solid #e5e7eb; border-radius: 8px;
  box-shadow: none; transition: border-color 0.2s; box-sizing: border-box;
}
:deep(.mono-input-number .p-inputnumber-input:focus) {
  border-color: #7c3aed; box-shadow: 0 0 0 3px rgba(124,58,237,0.1); outline: none;
}
.modal-footer {
  padding: 1.25rem 1.5rem;
  border-top: 1px solid #e5e7eb;
  background: #f9fafb;
  display: flex; justify-content: flex-end; gap: 0.75rem;
}
.btn-cancel {
  padding: 0.7rem 1.25rem; background: #fff; color: #374151;
  border: 1px solid #e5e7eb; border-radius: 8px;
  font-size: 0.875rem; font-weight: 600; cursor: pointer;
  transition: all 0.2s; font-family: inherit;
}
.btn-cancel:hover:not(:disabled) { background: #f3f4f6; }
.btn-save {
  padding: 0.7rem 1.5rem; background: #7c3aed; color: #fff;
  border: 1px solid #7c3aed; border-radius: 8px;
  font-size: 0.875rem; font-weight: 600; cursor: pointer;
  display: flex; align-items: center; gap: 0.5rem;
  transition: all 0.2s; font-family: inherit;
}
.btn-save:hover:not(:disabled) { background: #6d28d9; border-color: #6d28d9; }
.btn-save:disabled, .btn-cancel:disabled { opacity: 0.55; cursor: not-allowed; }

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
</style>
