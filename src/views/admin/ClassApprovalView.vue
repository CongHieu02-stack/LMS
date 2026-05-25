<!-- ============================================================================
  ClassApprovalView.vue — Giao diện Phê duyệt lớp học (Automation Random Room)
  Quy trình: PĐT duyệt lớp -> Hiển thị Modal nhập sĩ số tối đa -> Tự động tìm & gán phòng
  Thiết kế: Monochrome (Trắng-Đen, vuông vức, lật màu hover)
  ============================================================================ -->

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

// Load cả đề xuất số lượng và lớp học chờ duyệt
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

// Xử lý phê duyệt/từ chối đề xuất số lượng lớp
async function handleProposalAction(id: string, status: 'approved' | 'rejected') {
  if (status === 'approved') {
    if (!confirm('Bạn có chắc chắn muốn DUYỆT đề xuất số lượng lớp này không?\nHệ thống sẽ tự động khởi tạo các khung lớp tương ứng.')) return
  } else {
    if (!confirm('Bạn có chắc chắn muốn TỪ CHỐI đề xuất này không?')) return
  }

  processing.value = id
  msg.value = null
  try {
    const res = await apiPut<{ success: boolean; message: string }>(
      `/class-proposals/${id}/status`,
      { status }
    )
    if (res && res.success) {
      toast.add({
        severity: 'success',
        summary: 'Thành công',
        detail: res.message || 'Đã cập nhật trạng thái đề xuất thành công.',
        life: 4000
      })
      await loadData()
      // Nếu vừa duyệt thành công, chuyển sang tab classes để xếp phòng
      if (status === 'approved') {
        activeTab.value = 'classes'
      }
    }
  } catch (err: any) {
    toast.add({
      severity: 'error',
      summary: 'Lỗi xử lý',
      detail: err.message || 'Lỗi khi cập nhật trạng thái đề xuất.',
      life: 5000
    })
  } finally {
    processing.value = null
  }
}

// Load các lớp học đang ở trạng thái 'draft' (chờ duyệt)
async function loadDraftClasses() {
  await loadData()
}

// Khởi tạo controller cho Modal duyệt lớp (Random Room)
const {
  isApproveModalOpen,
  maxStudentsInput,
  scheduleInput,
  submitting,
  errorMessage,
  openApproveModal,
  closeApproveModal,
  submitApproveClass
} = useClassApproval(async () => {
  toast.add({
    severity: 'success',
    summary: 'Thành công',
    detail: 'Lớp học đã được duyệt mở và tự động xếp phòng thành công!',
    life: 4000
  })
  await loadDraftClasses()
})

// Xử lý nút xác nhận duyệt từ Modal
async function handleApproveSubmit() {
  await submitApproveClass()
  if (errorMessage.value) {
    toast.add({
      severity: 'error',
      summary: 'Lỗi duyệt lớp',
      detail: errorMessage.value,
      life: 5000
    })
  }
}

// Xử lý từ chối lớp
async function handleReject(id: string) {
  if (!confirm('Bạn có chắc chắn muốn từ chối mở lớp học này không?')) return
  
  processing.value = id
  msg.value = null
  try {
    const res = await apiPut<{ success: boolean; message: string }>(`/classes/${id}/reject`, {})
    if (res && res.success) {
      toast.add({
        severity: 'success',
        summary: 'Đã từ chối',
        detail: 'Đã cập nhật trạng thái lớp học thành từ chối (rejected).',
        life: 4000
      })
      await loadData()
    }
  } catch (err: any) {
    toast.add({
      severity: 'error',
      summary: 'Lỗi hệ thống',
      detail: err.message || 'Lỗi khi từ chối lớp học.',
      life: 5000
    })
  } finally {
    processing.value = null
  }
}

onMounted(loadData)
</script>

<template>
  <pv-toast />
  
  <div class="mono-wrapper">
    <div class="page-header">
      <div>
        <div class="breadcrumb">Quản lý Lớp học / <span>Phê duyệt lớp</span></div>
        <h1 class="page-title">Phê Duyệt & Mở Lớp Học</h1>
        <div class="page-subtitle">
          Phòng đào tạo xem xét đề xuất mở lớp từ bộ môn và tự động xếp phòng ngẫu nhiên cho các lớp học.
        </div>
      </div>
    </div>

    <!-- Tab Navigation -->
    <div class="tabs-container">
      <button 
        class="tab-btn" 
        :class="{ active: activeTab === 'proposals' }" 
        @click="activeTab = 'proposals'"
      >
        Đề xuất số lượng lớp <span class="tab-badge" v-if="proposals.length > 0">{{ proposals.length }}</span>
      </button>
      <button 
        class="tab-btn" 
        :class="{ active: activeTab === 'classes' }" 
        @click="activeTab = 'classes'"
      >
        Lớp học chờ xếp phòng <span class="tab-badge" v-if="classes.length > 0">{{ classes.length }}</span>
      </button>
    </div>

    <!-- Thông báo lỗi / trạng thái -->
    <div v-if="msg" class="alert"><i class="pi pi-info-circle"></i> {{ msg }}</div>
    <div v-if="loading" class="loading"><i class="pi pi-spin pi-spinner"></i></div>

    <div v-else>
      <!-- TAB 1: ĐỀ XUẤT SỐ LƯỢNG LỚP -->
      <div v-if="activeTab === 'proposals'">
        <!-- Empty State -->
        <div v-if="proposals.length === 0" class="empty">
          <i class="pi pi-check-circle" style="font-size: 3rem; color: #000"></i>
          <h3>Không có đề xuất số lượng lớp nào chờ duyệt</h3>
          <p>Tất cả đề xuất mở lớp học từ Trưởng bộ môn đã được xử lý.</p>
        </div>

        <!-- Bảng danh sách đề xuất số lượng lớp -->
        <div v-else class="table-card">
          <table class="mono-table">
            <thead>
              <tr>
                <th>Môn học</th>
                <th class="tc">Số lượng lớp</th>
                <th>Học kỳ</th>
                <th>Người đề xuất</th>
                <th>Lý do đề xuất</th>
                <th class="tc">Hành động</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in proposals" :key="p.id">
                <td>
                  <strong>{{ p.subject?.code }}</strong> — {{ p.subject?.name }}
                </td>
                <td class="tc fw-700">{{ p.quantity }}</td>
                <td>{{ p.semester }}</td>
                <td>{{ p.proposer?.full_name || '—' }}</td>
                <td class="reason">{{ p.reason || '—' }}</td>
                <td class="tc actions">
                  <button
                    class="btn-approve"
                    @click="handleProposalAction(p.id, 'approved')"
                    :disabled="processing === p.id"
                  >
                    <i class="pi pi-check"></i> Duyệt đề xuất
                  </button>
                  <button
                    class="btn-reject"
                    @click="handleProposalAction(p.id, 'rejected')"
                    :disabled="processing === p.id"
                  >
                    <i class="pi pi-times"></i> Từ chối
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- TAB 2: LỚP HỌC CHỜ XẾP PHÒNG -->
      <div v-if="activeTab === 'classes'">
        <!-- Empty State -->
        <div v-if="classes.length === 0" class="empty">
          <i class="pi pi-check-circle" style="font-size: 3rem; color: #000"></i>
          <h3>Không có lớp học nào đang chờ xếp phòng</h3>
          <p>Hãy duyệt các đề xuất lớp học ở Tab 1 để tạo khung lớp mới trước.</p>
        </div>

        <!-- Bảng danh sách lớp chờ duyệt -->
        <div v-else class="table-card">
          <table class="mono-table">
            <thead>
              <tr>
                <th>Môn học</th>
                <th>Mã lớp</th>
                <th>Học kỳ</th>
                <th>Lịch học</th>
                <th>TBM phụ trách</th>
                <th class="tc">Hành động</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in classes" :key="c.id">
                <td>
                  <strong>{{ c.subject?.code }}</strong> — {{ c.subject?.name }}
                </td>
                <td><strong>{{ c.code }}</strong></td>
                <td>{{ c.semester }}</td>
                <td>{{ c.schedule || '—' }}</td>
                <td>{{ c.manager?.fullName || '—' }}</td>
                <td class="tc actions">
                  <button
                    class="btn-approve"
                    @click="openApproveModal(c.id, c.schedule)"
                    :disabled="processing === c.id"
                  >
                    <i class="pi pi-check"></i> Duyệt mở
                  </button>
                  <button
                    class="btn-reject"
                    @click="handleReject(c.id)"
                    :disabled="processing === c.id"
                  >
                    <i class="pi pi-times"></i> Từ chối
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Modal Duyệt mở lớp & Tìm phòng học -->
    <div v-if="isApproveModalOpen" class="modal-overlay" @click.self="closeApproveModal">
      <div class="modal-card">
        <div class="modal-header">
          <h3>Xác Nhận Duyệt & Xếp Phòng</h3>
          <button class="btn-close" @click="closeApproveModal"><i class="pi pi-times"></i></button>
        </div>
        <div class="modal-body">
          <p class="modal-desc">
            Vui lòng nhập sĩ số tối đa dự kiến của lớp học. Hệ thống sẽ tự động tìm kiếm một phòng trống ngẫu nhiên có sức chứa đáp ứng tốt sĩ số này.
          </p>

          <div v-if="errorMessage" class="error-alert">
            <i class="pi pi-exclamation-triangle"></i> {{ errorMessage }}
          </div>

          <div class="fg">
            <label class="form-label">Lịch học <span class="label-hint">(Ví dụ: T2(T1-3), T5(T4-6))</span></label>
            <input
              v-model="scheduleInput"
              type="text"
              class="mono-input-text"
              placeholder="T2(T1-3), T5(T4-6) — để trống nếu chưa xác định"
            />
          </div>
          <div class="fg">
            <label class="form-label">Sĩ số sinh viên tối đa <span class="label-required">*</span></label>
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
          <button class="btn-cancel" @click="closeApproveModal" :disabled="submitting">
            Hủy
          </button>
          <button class="btn-confirm" @click="handleApproveSubmit" :disabled="submitting">
            <i v-if="submitting" class="pi pi-spin pi-spinner"></i>
            <span v-else>XÁC NHẬN DUYỆT & TÌM PHÒNG</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mono-wrapper {
  padding: 1.5rem 2rem;
  animation: fadeIn 0.3s ease-out;
}
/* Tabs Container */
.tabs-container {
  display: flex;
  gap: 1rem;
  border-bottom: 2px solid #000;
  margin-bottom: 1.5rem;
}
.tab-btn {
  padding: 0.75rem 1.5rem;
  background: transparent;
  border: none;
  font-size: 0.95rem;
  font-weight: 700;
  color: #6b7280;
  cursor: pointer;
  position: relative;
  transition: all 0.2s;
  text-transform: uppercase;
}
.tab-btn:hover {
  color: #000;
}
.tab-btn.active {
  color: #fff;
  background: #000;
}
.tab-badge {
  display: inline-block;
  background: #f3f4f6;
  color: #000;
  font-size: 0.75rem;
  padding: 0.1rem 0.5rem;
  margin-left: 0.5rem;
  font-weight: 700;
}
.tab-btn.active .tab-badge {
  background: #fff;
  color: #000;
}
.page-header {
  margin-bottom: 2rem;
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 1rem;
}
.breadcrumb {
  font-size: 0.8rem;
  color: #6b7280;
  margin-bottom: 0.5rem;
}
.breadcrumb span {
  color: #111827;
  font-weight: 600;
}
.page-title {
  font-size: 1.75rem;
  font-weight: 600;
  margin: 0 0 0.5rem 0;
  color: #111827;
}
.page-subtitle {
  font-size: 0.875rem;
  color: #6b7280;
}
.alert {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1.25rem;
  border-radius: 0px;
  font-size: 0.875rem;
  margin-bottom: 1.5rem;
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  color: #1f2937;
}
.loading {
  display: flex;
  justify-content: center;
  padding: 4rem;
  font-size: 2rem;
  color: #111827;
}
.empty {
  text-align: center;
  padding: 4rem;
  color: #6b7280;
}
.empty h3 {
  margin: 1rem 0;
  color: #111827;
  font-weight: 700;
  text-transform: uppercase;
}
.table-card {
  background: #fff;
  border: 1px solid #000;
  border-radius: 0px;
  overflow: hidden;
}
.mono-table {
  width: 100%;
  border-collapse: collapse;
}
.mono-table th {
  background: #f9fafb;
  border-bottom: 1px solid #000;
  padding: 1rem;
  font-size: 0.8rem;
  font-weight: 700;
  color: #000;
  text-transform: uppercase;
  text-align: left;
}
.mono-table td {
  padding: 1rem;
  border-bottom: 1px solid #e5e7eb;
  font-size: 0.9rem;
}
.mono-table tr:hover {
  background: #fafafa;
}
.tc {
  text-align: center;
}
.actions {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
}

/* Approve & Reject Buttons */
.btn-approve {
  padding: 0.5rem 1rem;
  background: #000;
  color: #fff;
  border: 1px solid #000;
  border-radius: 0px;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  transition: all 0.2s;
}
.btn-approve:hover:not(:disabled) {
  background: #fff;
  color: #000;
}
.btn-reject {
  padding: 0.5rem 1rem;
  background: #fff;
  color: #000;
  border: 1px solid #000;
  border-radius: 0px;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  transition: all 0.2s;
}
.btn-reject:hover:not(:disabled) {
  background: #000;
  color: #fff;
}
button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Modal Styling (Monochrome Style) */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease-out;
}
.modal-card {
  background: #fff;
  border: 1px solid #000;
  border-radius: 0px;
  width: 480px;
  max-width: 90%;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
}
.modal-header {
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid #000;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.modal-header h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: normal;
}
.btn-close {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  color: #6b7280;
  transition: color 0.2s;
}
.btn-close:hover {
  color: #000;
}
.modal-body {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}
.modal-desc {
  font-size: 0.85rem;
  color: #4b5563;
  line-height: 1.5;
  margin: 0;
}
.error-alert {
  padding: 0.75rem 1rem;
  background: #fef2f2;
  border: 1px solid #f87171;
  color: #b91c1c;
  font-size: 0.875rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.fg {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.form-label {
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  color: #000;
}

/* Custom styling for PrimeVue InputNumber to match Monochrome theme */
:deep(.mono-input-number) {
  width: 100%;
}
:deep(.mono-input-number .p-inputnumber-input) {
  width: 100%;
  padding: 0.75rem 1rem;
  font-family: inherit;
  font-size: 1rem;
  font-weight: 500;
  color: #111827;
  background: #fff;
  border: 1px solid #000;
  border-radius: 0px;
  box-shadow: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
}
:deep(.mono-input-number .p-inputnumber-input:focus) {
  border-color: #000;
  outline: none;
}

/* Text input for schedule */
.mono-input-text {
  width: 100%;
  padding: 0.75rem 1rem;
  font-family: inherit;
  font-size: 0.95rem;
  color: #111827;
  background: #fff;
  border: 1px solid #000;
  border-radius: 0px;
  box-shadow: none;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
}
.mono-input-text:focus {
  border-color: #000;
  box-shadow: 0 0 0 2px rgba(0,0,0,0.1);
}
.mono-input-text::placeholder {
  color: #9ca3af;
  font-size: 0.85rem;
}

/* Label helpers */
.label-hint {
  font-weight: 400;
  color: #6b7280;
  font-size: 0.75rem;
  text-transform: none;
}
.label-required {
  color: #dc2626;
  font-weight: 700;
}

.modal-footer {
  padding: 1.25rem 1.5rem;
  border-top: 1px solid #e5e7eb;
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}
.btn-cancel {
  padding: 0.75rem 1.5rem;
  background: #fff;
  color: #000;
  border: 1px solid #000;
  border-radius: 0px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-cancel:hover:not(:disabled) {
  background: #000;
  color: #fff;
}
.btn-confirm {
  padding: 0.75rem 1.5rem;
  background: #000;
  color: #fff;
  border: 1px solid #000;
  border-radius: 0px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.btn-confirm:hover:not(:disabled) {
  background: #fff;
  color: #000;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
</style>
