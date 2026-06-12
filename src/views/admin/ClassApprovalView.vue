<!-- ClassApprovalView.vue — Phê duyệt lớp học -->
<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { apiGet, apiPut } from '@/lib/api'
import { useClassApproval } from '@/composables/useClassApproval'
import { useToast } from 'primevue/usetoast'
import pvToast from 'primevue/toast'
import InputNumber from 'primevue/inputnumber'

const toast = useToast()
const activeTab = ref<'proposals' | 'classes'>('proposals')
const classes = ref<any[]>([])
const proposals = ref<any[]>([])
const rooms = ref<any[]>([])
const loading = ref(true)
const processing = ref<string | null>(null)
const msg = ref<string | null>(null)
const minStartDateStr = ref('')
const searchQuery = ref('')

const filteredProposals = computed(() => {
  if (!searchQuery.value) return proposals.value
  const q = searchQuery.value.toLowerCase()
  return proposals.value.filter((p: any) => {
    return (
      (p.subject?.code && p.subject.code.toLowerCase().includes(q)) ||
      (p.subject?.name && p.subject.name.toLowerCase().includes(q)) ||
      (p.semester && p.semester.toLowerCase().includes(q)) ||
      (p.proposer?.full_name && p.proposer.full_name.toLowerCase().includes(q)) ||
      (p.reason && p.reason.toLowerCase().includes(q))
    )
  })
})

const filteredClasses = computed(() => {
  if (!searchQuery.value) return classes.value
  const q = searchQuery.value.toLowerCase()
  return classes.value.filter((c: any) => {
    return (
      (c.subject?.code && c.subject.code.toLowerCase().includes(q)) ||
      (c.subject?.name && c.subject.name.toLowerCase().includes(q)) ||
      (c.code && c.code.toLowerCase().includes(q)) ||
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.semester && c.semester.toLowerCase().includes(q)) ||
      (c.room && c.room.toLowerCase().includes(q)) ||
      (c.manager?.fullName && c.manager.fullName.toLowerCase().includes(q))
    )
  })
})

// Custom Confirm Modal State
const isConfirmModalOpen = ref(false)
const confirmTitle = ref('')
const confirmMessage = ref('')
const confirmOkText = ref('Xác nhận')
const confirmCancelText = ref('Hủy bỏ')
let onConfirmCallback: (() => void) | null = null

function showCustomConfirm(title: string, message: string, onConfirm: () => void, okText = 'Xác nhận', cancelText = 'Hủy bỏ') {
  confirmTitle.value = title
  confirmMessage.value = message
  confirmOkText.value = okText
  confirmCancelText.value = cancelText
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

async function loadData() {
  loading.value = true
  msg.value = null
  try {
    const [propRes, classRes, roomRes] = await Promise.all([
      apiGet<{ success: boolean; data: any[] }>('/class-proposals/pending'),
      apiGet<any>('/classes'),
      apiGet<{ success: boolean; data: any[] }>('/classes/rooms')
    ])
    proposals.value = propRes.data || []
    rooms.value = roomRes.data || []
    const allClasses = classRes.data || classRes || []
    // Hiển thị cả các lớp nháp chờ duyệt lẫn lớp đã duyệt trong học kỳ này
    classes.value = allClasses.filter((c: any) => c.status === 'draft' || c.status === 'approved' || c.status === 'APPROVED')
  } catch (err: any) {
    msg.value = err.message || 'Không thể tải dữ liệu từ máy chủ.'
  } finally {
    loading.value = false
  }
}

async function handleProposalAction(id: string, status: 'approved' | 'rejected') {
  const title = status === 'approved' ? 'Xác nhận duyệt đề xuất' : 'Xác nhận từ chối đề xuất'
  const confirmMsg = status === 'approved'
    ? 'Bạn có chắc chắn muốn DUYỆT đề xuất này không?\nHệ thống sẽ tự động khởi tạo các khung lớp.'
    : 'Bạn có chắc chắn muốn TỪ CHỐI đề xuất này không?'

  showCustomConfirm(title, confirmMsg, async () => {
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
  }, status === 'approved' ? 'Phê duyệt' : 'Từ chối')
}

const approvalSessions = ref<any[]>([
  { day: 'T2', startTime: '07:30', endTime: '10:00' }
])

function addApprovalSession() {
  approvalSessions.value.push({ day: 'T2', startTime: '07:30', endTime: '10:00' })
}

function removeApprovalSession(index: number) {
  approvalSessions.value.splice(index, 1)
}

function openApprovalModalWithSessions(
  classId: string,
  semester: string,
  existingSchedule?: string,
  defaultMaxStudents?: number,
  existingRoom?: string,
  existingStartDate?: string,
  existingEndDate?: string
) {
  if (!existingSchedule || !existingSchedule.trim()) {
    approvalSessions.value = [{ day: 'T2', startTime: '07:30', endTime: '10:00' }]
  } else {
    const list: any[] = []
    const parts = existingSchedule.split(',')
    for (const part of parts) {
      const match = part.trim().match(/^([A-Z0-9]+)\((\d{2}:\d{2})-(\d{2}:\d{2})\)$/i)
      if (match) {
        list.push({
          day: match[1],
          startTime: match[2],
          endTime: match[3]
        })
      }
    }
    if (list.length === 0) {
      approvalSessions.value = [{ day: 'T2', startTime: '07:30', endTime: '10:00' }]
    } else {
      approvalSessions.value = list
    }
  }

  openApproveModal(classId, existingSchedule, defaultMaxStudents, existingRoom, existingStartDate, existingEndDate, semester)
}

const {
  isApproveModalOpen, maxStudentsInput, scheduleInput, roomNameInput, startDateInput, endDateInput,
  selectedSemester, submitting, errorMessage, openApproveModal, closeApproveModal, submitApproveClass
} = useClassApproval(async () => {
  toast.add({ severity: 'success', summary: 'Thành công', detail: 'Lớp đã được duyệt và gán phòng học!', life: 4000 })
  await loadData()
})

function formatDate(d?: string) {
  if (!d) return '—'
  const dateObj = new Date(d)
  if (isNaN(dateObj.getTime())) return d
  const dd = String(dateObj.getDate()).padStart(2, '0')
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0')
  const yyyy = dateObj.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

const dayLabels: Record<string, string> = {
  'T2': 'Thứ 2',
  'T3': 'Thứ 3',
  'T4': 'Thứ 4',
  'T5': 'Thứ 5',
  'T6': 'Thứ 6',
  'T7': 'Thứ 7',
  'CN': 'Chủ nhật'
}

function timeToMinutes(timeStr: string): number {
  const [hh, mm] = timeStr.split(':').map(Number)
  return hh * 60 + mm
}

async function handleApproveSubmit() {
  for (const s of approvalSessions.value) {
    if (!s.startTime || !s.endTime) {
      toast.add({ severity: 'error', summary: 'Lỗi lịch học', detail: 'Vui lòng nhập đầy đủ giờ học cho tất cả các buổi.', life: 5000 })
      return
    }
    if (s.startTime >= s.endTime) {
      toast.add({ severity: 'error', summary: 'Lỗi lịch học', detail: `Giờ bắt đầu (${s.startTime}) phải nhỏ hơn giờ kết thúc (${s.endTime}).`, life: 5000 })
      return
    }
  }

  // Kiểm tra trùng hoặc chồng chéo thời gian giữa các buổi học trong cùng lịch phê duyệt (yêu cầu cách nhau ít nhất 5 phút)
  for (let i = 0; i < approvalSessions.value.length; i++) {
    for (let j = i + 1; j < approvalSessions.value.length; j++) {
      const s1 = approvalSessions.value[i]
      const s2 = approvalSessions.value[j]
      if (s1.day === s2.day) {
        const m1_start = timeToMinutes(s1.startTime)
        const m1_end = timeToMinutes(s1.endTime)
        const m2_start = timeToMinutes(s2.startTime)
        const m2_end = timeToMinutes(s2.endTime)

        const [firstStart, firstEnd, secondStart, secondEnd] = m1_start <= m2_start
          ? [m1_start, m1_end, m2_start, m2_end]
          : [m2_start, m2_end, m1_start, m1_end]

        if (secondStart < firstEnd) {
          const dayText = dayLabels[s1.day] || s1.day
          toast.add({ severity: 'error', summary: 'Trùng lịch học', detail: `Lịch học vào ${dayText} (${s1.startTime}-${s1.endTime} và ${s2.startTime}-${s2.endTime}) bị trùng lịch (chồng chéo thời gian).`, life: 5000 })
          return
        } else if (secondStart < firstEnd + 5) {
          const dayText = dayLabels[s1.day] || s1.day
          toast.add({ severity: 'error', summary: 'Khoảng cách lịch học quá ngắn', detail: `Lịch học vào ${dayText} (${s1.startTime}-${s1.endTime} và ${s2.startTime}-${s2.endTime}) phải cách nhau ít nhất 5 phút để sinh viên kịp di chuyển giữa các phòng học.`, life: 5000 })
          return
        }
      }
    }
  }

  scheduleInput.value = approvalSessions.value.map((s: any) => `${s.day}(${s.startTime}-${s.endTime})`).join(', ')

  await submitApproveClass()
  if (errorMessage.value) {
    toast.add({ severity: 'error', summary: 'Lỗi duyệt lớp', detail: errorMessage.value, life: 5000 })
  }
}

async function handleReject(id: string) {
  showCustomConfirm('Xác nhận từ chối mở lớp', 'Bạn có chắc chắn muốn từ chối mở lớp học này không?', async () => {
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
  }, 'Từ chối mở')
}

onMounted(async () => {
  await loadData()
  const today = new Date()
  today.setDate(today.getDate() + 14)
  const yyyy = today.getFullYear()
  const mm = String(today.getMonth() + 1).padStart(2, '0')
  const dd = String(today.getDate()).padStart(2, '0')
  minStartDateStr.value = `${yyyy}-${mm}-${dd}`
})
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

    <!-- Search Bar -->
    <div class="search-container mb-6" v-if="!loading && (proposals.length > 0 || classes.length > 0)">
      <div class="search-box">
        <i class="pi pi-search search-icon"></i>
        <input
          type="text"
          v-model="searchQuery"
          placeholder="Tìm kiếm môn học, mã lớp, học kỳ, người quản lý/đề xuất..."
          class="search-input"
        />
      </div>
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
        <div v-else-if="filteredProposals.length === 0" class="empty-state">
          <i class="pi pi-search empty-icon"></i>
          <h3>Không tìm thấy đề xuất phù hợp</h3>
          <p>Hãy thử tìm kiếm với từ khóa khác.</p>
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
                  <th class="text-center">Sĩ số/Lớp</th>
                  <th>Học kỳ</th>
                  <th>Người đề xuất</th>
                  <th>Lý do</th>
                  <th class="text-center">Hành động</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="p in filteredProposals" :key="p.id" class="table-row">
                  <td>
                    <span class="code-cell">{{ p.subject?.code }}</span>
                    <span class="subject-name"> — {{ p.subject?.name }}</span>
                  </td>
                  <td class="text-center font-bold">{{ p.quantity }}</td>
                  <td class="text-center">{{ p.max_students || 50 }}</td>
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
        <div v-else-if="filteredClasses.length === 0" class="empty-state">
          <i class="pi pi-search empty-icon"></i>
          <h3>Không tìm thấy lớp học phù hợp</h3>
          <p>Hãy thử tìm kiếm với từ khóa khác.</p>
        </div>
        <div v-else class="mono-card">
          <div class="card-header">
            <span>Danh sách lớp học và phòng học</span>
            <i class="pi pi-building"></i>
          </div>
          <div class="table-container">
            <table class="mono-table">
              <thead>
                <tr>
                  <th>Môn học</th>
                  <th>Tên lớp</th>
                  <th>Học kỳ</th>
                  <th>Phòng học / Lịch học</th>
                  <th>TBM phụ trách</th>
                  <th class="text-center">Hành động</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="c in filteredClasses" :key="c.id" class="table-row">
                  <td>
                    <span class="code-cell">{{ c.subject?.code }}</span>
                    <span class="subject-name"> — {{ c.subject?.name }}</span>
                  </td>
                  <td><strong>{{ c.name }}</strong></td>
                  <td class="semester-cell">{{ c.semester }}</td>
                  <td>
                    <div>
                      <span v-if="c.room" style="font-weight: 600; color: #166534;"><i class="pi pi-home mr-1"></i>{{ c.room }}</span>
                      <span v-else style="color: #9ca3af; font-style: italic; font-size: 0.85rem;"><i class="pi pi-question-circle mr-1"></i>Chờ xếp phòng</span>
                    </div>
                    <div v-if="c.schedule" style="margin-top: 0.25rem; font-size: 0.8rem; color: #7c3aed; font-weight: 500;">
                      <i class="pi pi-calendar mr-1"></i>Lịch: {{ c.schedule }}
                    </div>
                    <div v-if="c.startDate || c.endDate" style="margin-top: 0.25rem; font-size: 0.75rem; color: #4b5563;">
                      <i class="pi pi-clock mr-1"></i>Thời gian: {{ formatDate(c.startDate) }} - {{ formatDate(c.endDate) }}
                    </div>
                  </td>
                  <td class="user-cell">
                    <i class="pi pi-user mr-1"></i>{{ c.manager?.fullName || '—' }}
                  </td>
                  <td class="text-center">
                    <div v-if="c.status === 'draft'" class="action-buttons">
                      <button class="btn-approve" @click="openApprovalModalWithSessions(c.id, c.semester, c.schedule, c.maxStudents, 'auto', c.startDate, c.endDate)" :disabled="processing === c.id">
                        <i class="pi pi-check"></i> Duyệt mở
                      </button>
                      <button class="btn-reject" @click="handleReject(c.id)" :disabled="processing === c.id">
                        <i class="pi pi-times"></i> Từ chối
                      </button>
                    </div>
                    <div v-else-if="c.status === 'approved' || c.status === 'APPROVED'">
                      <span class="badge-status badge-status-approved">
                        <i class="pi pi-check-circle"></i> Đã duyệt
                      </span>
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
            Vui lòng xác nhận sĩ số tối đa và khung lịch học của lớp. Bạn có thể chọn chỉ định một phòng học hoặc để hệ thống tự động tìm phòng trống.
          </p>
          <div v-if="errorMessage" class="mono-alert alert-error" style="margin-bottom:0">
            <i class="pi pi-exclamation-triangle"></i>
            <div>{{ errorMessage }}</div>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem;">
            <div class="form-group">
              <label class="form-label">Ngày bắt đầu <span class="required">*</span></label>
              <input v-model="startDateInput" type="date" :min="minStartDateStr" class="mono-input" required />
            </div>
            <div class="form-group">
              <label class="form-label">Ngày kết thúc <span class="required">*</span></label>
              <input v-model="endDateInput" type="date" class="mono-input" required />
            </div>
          </div>
          <div class="form-group">
            <div class="form-label" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
              <span>Thời khóa biểu hàng tuần <span class="required">*</span></span>
              <button type="button" @click="addApprovalSession" class="btn-add-session"><i class="pi pi-plus"></i> Thêm buổi học</button>
            </div>
            <div v-for="(session, index) in approvalSessions" :key="index" class="session-row">
              <select v-model="session.day" class="mono-input" style="flex: 2;" required>
                <option value="T2">Thứ 2</option>
                <option value="T3">Thứ 3</option>
                <option value="T4">Thứ 4</option>
                <option value="T5">Thứ 5</option>
                <option value="T6">Thứ 6</option>
                <option value="T7">Thứ 7</option>
                <option value="CN">Chủ nhật</option>
              </select>
              <input v-model="session.startTime" type="time" class="mono-input" style="flex: 2;" required />
              <span class="session-separator">đến</span>
              <input v-model="session.endTime" type="time" class="mono-input" style="flex: 2;" required />
              <button type="button" @click="removeApprovalSession(index)" class="btn-remove-session" :disabled="approvalSessions.length <= 1">
                <i class="pi pi-trash"></i>
              </button>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Phòng học</label>
            <select v-model="roomNameInput" class="mono-input">
              <option value="auto">-- Tự động xếp phòng trống phù hợp --</option>
              <option v-for="r in rooms" :key="r.id" :value="r.name">
                Phòng {{ r.name }} (Sức chứa: {{ r.capacity }} chỗ)
              </option>
            </select>
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
            Xác nhận duyệt mở lớp
          </button>
        </div>
      </div>
    </div>
    <!-- Custom Confirm Dialog -->
    <div v-if="isConfirmModalOpen" class="modal-overlay" @click.self="handleConfirmCancel">
      <div class="mono-modal" style="max-width: 400px;">
        <div class="modal-header">
          <span>{{ confirmTitle }}</span>
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

.badge-status {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.35rem 0.8rem;
  border-radius: 9999px;
  white-space: nowrap;
}
.badge-status-approved {
  background: #dcfce7;
  color: #166534;
  border: 1px solid #bbf7d0;
}

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

.btn-add-session {
  background: transparent;
  border: none;
  color: #7c3aed;
  font-weight: 600;
  font-size: 0.8rem;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-family: inherit;
}
.btn-add-session:hover {
  background: #faf5ff;
}
.session-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
  animation: fadeIn 0.2s ease-out;
}
.session-separator {
  font-size: 0.85rem;
  color: #6b7280;
  flex-shrink: 0;
}
.btn-remove-session {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #ef4444;
  border-radius: 8px;
  padding: 0.6rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}
.btn-remove-session:hover:not(:disabled) {
  background: #fee2e2;
  color: #b91c1c;
}
.btn-remove-session:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.search-container {
  width: 100%;
}
.search-box {
  position: relative;
  width: 100%;
}
.search-icon {
  position: absolute;
  left: 1rem;
  top: 50%;
  transform: translateY(-50%);
  color: #9ca3af;
}
.search-input {
  width: 100%;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 0.6rem 1rem 0.6rem 2.5rem;
  font-size: 0.875rem;
  outline: none;
  background-color: #fff;
  font-weight: 500;
  transition: border-color 0.2s, box-shadow 0.2s;
  box-sizing: border-box;
}
.search-input:focus {
  border-color: #7c3aed;
  box-shadow: 0 0 0 3px rgba(124,58,237,0.1);
}
.mb-6 {
  margin-bottom: 1.5rem;
}
</style>
