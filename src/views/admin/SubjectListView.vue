<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { apiGet, apiPut } from '@/lib/api'

// State danh sách
const subjects = ref<any[]>([])
const loading = ref(false)
const errorMessage = ref<string | null>(null)
const successMessage = ref<string | null>(null)

// State Chi tiết môn học
const selectedSubject = ref<any>(null)
const showDetails = ref(false)

// State Khóa môn học
const showLockModal = ref(false)
const lockReason = ref('')
const submittingLock = ref(false)
const submittingUnlock = ref(false)
const modalError = ref<string | null>(null)

// Lọc hiển thị (Tất cả / Đang hoạt động / Bị khóa / Từ chối)
const currentFilter = ref('all') // all, active, locked, rejected

const searchQuery = ref('')
const selectedDeptFilter = ref('')

function getDeptBadgeStyle(dept: string) {
  if (!dept) return { color: '#4b5563', backgroundColor: '#f3f4f6' }
  const d = dept.toLowerCase()
  if (d.includes('công nghệ thông tin')) {
    return { color: '#2563eb', backgroundColor: '#eff6ff' }
  }
  if (d.includes('sức khỏe') || d.includes('sức khoẻ')) {
    return { color: '#7c3aed', backgroundColor: '#f5f3ff' }
  }
  if (d.includes('quản trị') || d.includes('marketing')) {
    return { color: '#ea580c', backgroundColor: '#fff7ed' }
  }
  if (d.includes('tài chính') || d.includes('thương mại')) {
    return { color: '#0d9488', backgroundColor: '#f0fdfa' }
  }
  return { color: '#059669', backgroundColor: '#ecfdf5' }
}

const deptStats = computed(() => {
  const counts: Record<string, number> = {}
  for (const sub of subjects.value) {
    const dept = sub.department || 'Khoa Công nghệ thông tin'
    counts[dept] = (counts[dept] || 0) + 1
  }
  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
})

function getDeptCardStyle(dept: string) {
  const style = getDeptBadgeStyle(dept)
  return {
    borderLeft: `4px solid ${style.color}`,
  }
}

const filteredSubjects = computed(() => {
  return subjects.value.filter((sub: any) => {
    if (currentFilter.value === 'active') {
      if (sub.is_locked || sub.status !== 'approved') return false
    } else if (currentFilter.value === 'locked') {
      if (!sub.is_locked) return false
    } else if (currentFilter.value === 'rejected') {
      if (sub.status !== 'rejected') return false
    }

    if (selectedDeptFilter.value) {
      const subDept = sub.department || 'Khoa Công nghệ thông tin'
      if (subDept !== selectedDeptFilter.value) return false
    }

    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase()
      const codeMatch = sub.code && sub.code.toLowerCase().includes(q)
      const nameMatch = sub.name && sub.name.toLowerCase().includes(q)
      const descMatch = sub.description && sub.description.toLowerCase().includes(q)
      const deptMatch = sub.department && sub.department.toLowerCase().includes(q)
      if (!codeMatch && !nameMatch && !descMatch && !deptMatch) return false
    }

    return true
  })
})

async function fetchSubjects() {
  loading.value = true
  errorMessage.value = null
  try {
    const res = await apiGet<any>('/subjects')
    if (res.success) {
      subjects.value = res.data
    }
  } catch (err) {
    errorMessage.value = (err as Error).message || 'Không thể tải danh sách môn học.'
  } finally {
    loading.value = false
  }
}

// Mở chi tiết
function openDetails(subject: any) {
  selectedSubject.value = subject
  showDetails.value = true
}

function closeDetails() {
  showDetails.value = false
  selectedSubject.value = null
}

// Xử lý Khóa môn học
function openLockModal(subject: any) {
  selectedSubject.value = subject
  lockReason.value = ''
  modalError.value = null
  showLockModal.value = true
}

function closeLockModal() {
  showLockModal.value = false
  lockReason.value = ''
}

async function submitLock() {
  if (!lockReason.value.trim()) {
    modalError.value = 'Vui lòng nhập lý do khóa môn học.'
    return
  }

  submittingLock.value = true
  errorMessage.value = null
  successMessage.value = null
  modalError.value = null

  try {
    const res = await apiPut<any>(`/subjects/${selectedSubject.value.id}/lock`, {
      lock_reason: lockReason.value,
    })

    if (res.success) {
      successMessage.value = `Đã khóa môn học "${selectedSubject.value.name}".`
      closeLockModal()

      // Nếu đang xem chi tiết, update lại data
      if (showDetails.value) {
        selectedSubject.value.is_locked = true
        selectedSubject.value.lock_reason = lockReason.value
      }

      await fetchSubjects()
    }
  } catch (err) {
    modalError.value = (err as Error).message || `Gặp lỗi khi khóa môn học.`
  } finally {
    submittingLock.value = false
  }
}

async function handleUnlock(subject: any) {
  submittingUnlock.value = true
  errorMessage.value = null
  successMessage.value = null

  try {
    const res = await apiPut<any>(`/subjects/${subject.id}/unlock`, {})
    if (res.success) {
      successMessage.value = `Đã mở khóa môn học "${subject.name}".`
      
      // Cập nhật lại state cục bộ
      subject.is_locked = false
      subject.lock_reason = null

      await fetchSubjects()
    }
  } catch (err) {
    errorMessage.value = (err as Error).message || `Gặp lỗi khi mở khóa môn học.`
  } finally {
    submittingUnlock.value = false
  }
}

onMounted(() => {
  fetchSubjects()
})
</script>

<template>
  <div class="mono-wrapper">
    <!-- Header -->
    <div class="page-header">
      <div class="breadcrumb">Quản trị / <span>Danh sách học phần</span></div>
      <h1 class="page-title">Quản Lý Học Phần</h1>
      <div class="page-subtitle">
        Xem danh sách, chi tiết và vô hiệu hóa (khóa) học phần nếu cần thiết.
      </div>
    </div>

    <!-- Alert -->
    <div v-if="errorMessage" class="mono-alert alert-error">
      <i class="pi pi-exclamation-triangle"></i>
      <div><strong>LỖI:</strong> {{ errorMessage }}</div>
    </div>
    <div v-if="successMessage" class="mono-alert alert-success">
      <i class="pi pi-check"></i>
      <div><strong>THÀNH CÔNG:</strong> {{ successMessage }}</div>
    </div>

    <!-- Search and Filter Bar -->
    <div class="search-filter-row mb-6" v-if="!loading && subjects.length > 0">
      <div class="search-box-wrapper">
        <i class="pi pi-search search-icon"></i>
        <input
          type="text"
          v-model="searchQuery"
          placeholder="Tìm mã môn, tên môn học, khoa..."
          class="search-input"
        />
      </div>
      
      <div class="filter-select-wrapper">
        <i class="pi pi-filter filter-icon"></i>
        <select v-model="selectedDeptFilter" class="dept-select">
          <option value="">Tất cả các khoa ({{ subjects.length }} môn)</option>
          <option 
            v-for="dept in deptStats" 
            :key="dept.name" 
            :value="dept.name"
          >
            {{ dept.name }} ({{ dept.count }} môn)
          </option>
        </select>
      </div>
    </div>

    <!-- Main Content Split Layout -->
    <div class="split-layout" :class="{ 'has-panel': showDetails }">
      <!-- Bảng danh sách -->
      <div class="mono-card list-panel">
        <div class="card-header">
          <div class="header-left">
            <span>Danh sách môn học</span>
            <span class="badge-count">{{ filteredSubjects.length }}</span>
          </div>
          <div class="filter-group">
            <button
              class="filter-btn"
              :class="{ active: currentFilter === 'all' }"
              @click="currentFilter = 'all'"
            >
              Tất cả
            </button>
            <button
              class="filter-btn"
              :class="{ active: currentFilter === 'active' }"
              @click="currentFilter = 'active'"
            >
              Đang HĐ
            </button>
            <button
              class="filter-btn"
              :class="{ active: currentFilter === 'locked' }"
              @click="currentFilter = 'locked'"
            >
              Đã Khóa
            </button>
            <button
              class="filter-btn"
              :class="{ active: currentFilter === 'rejected' }"
              @click="currentFilter = 'rejected'"
            >
              Từ chối
            </button>
          </div>
        </div>

        <div v-if="loading && subjects.length === 0" class="loading-state">
          <i class="pi pi-spin pi-spinner spinner"></i>
          <div>Đang tải dữ liệu...</div>
        </div>

        <div v-else-if="filteredSubjects.length === 0" class="empty-state">
          <i class="pi pi-folder-open empty-icon"></i>
          <h2>Không tìm thấy dữ liệu</h2>
          <p>Chưa có môn học nào khớp với bộ lọc hiện tại.</p>
        </div>

        <div v-else class="table-container">
          <table class="mono-table">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Tên môn học</th>
                <th>Khoa</th>
                <th class="text-center">Số TC</th>
                <th>Tình trạng</th>
                <th class="text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="sub in filteredSubjects"
                :key="sub.id"
                class="table-row"
                :class="{ 'row-selected': selectedSubject?.id === sub.id }"
                @click="openDetails(sub)"
              >
                <td class="code-cell">{{ sub.code }}</td>
                <td class="subject-name">{{ sub.name }}</td>
                <td>
                  <span class="dep-badge" :style="getDeptBadgeStyle(sub.department)">
                    {{ sub.department || 'Khoa Công nghệ thông tin' }}
                  </span>
                </td>
                <td class="text-center">{{ sub.credits }}</td>
                <td>
                  <span v-if="sub.is_locked" class="mono-badge badge-locked"
                    ><i class="pi pi-lock"></i> Đã khóa</span
                  >
                  <span v-else-if="sub.status === 'approved'" class="mono-badge badge-approved"
                    >Đang HĐ</span
                  >
                  <span v-else-if="sub.status === 'rejected'" class="mono-badge badge-rejected"
                    >Từ chối</span
                  >
                  <span v-else class="mono-badge badge-pending">Chờ duyệt</span>
                </td>
                <td class="text-right">
                  <button class="btn-text" @click.stop="openDetails(sub)">Chi tiết</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Panel Chi tiết (Slide-over / Fixed Right Panel) -->
      <div v-if="showDetails" class="details-panel mono-card">
        <div class="details-header">
          <h3>Chi tiết môn học</h3>
          <button class="btn-close" @click="closeDetails"><i class="pi pi-times"></i></button>
        </div>

        <div class="details-body" v-if="selectedSubject">
          <div class="detail-hero">
            <div class="hero-code">{{ selectedSubject.code }}</div>
            <h2 class="hero-name">{{ selectedSubject.name }}</h2>
            <div class="hero-tags">
              <span v-if="selectedSubject.is_locked" class="mono-badge badge-locked">
                <i class="pi pi-lock"></i> Đã khóa
              </span>
              <span v-else-if="selectedSubject.status === 'approved'" class="mono-badge badge-approved">
                Đang hoạt động
              </span>
              <span v-else-if="selectedSubject.status === 'rejected'" class="mono-badge badge-rejected">
                Từ chối
              </span>
              <span v-else class="mono-badge badge-pending">
                Chờ duyệt
              </span>
              <span class="tc-badge">{{ selectedSubject.credits }} Tín chỉ</span>
            </div>
          </div>

          <div class="detail-section">
            <h4 class="section-title">Mô tả</h4>
            <p class="section-text">
              {{ selectedSubject.description || 'Chưa có mô tả chi tiết cho môn học này.' }}
            </p>
          </div>

          <div class="detail-section">
            <h4 class="section-title">Thông tin quản lý</h4>
            <ul class="info-list">
              <li>
                <span>Trạng thái duyệt:</span>
                <strong>{{ selectedSubject.status.toUpperCase() }}</strong>
              </li>
              <li>
                <span>Khoa phụ trách:</span>
                <strong>{{ selectedSubject.department || 'Khoa Công nghệ thông tin' }}</strong>
              </li>
              <li v-if="selectedSubject.rejection_reason">
                <span>Lý do từ chối:</span>
                <strong class="text-red-500">{{ selectedSubject.rejection_reason }}</strong>
              </li>
              <li>
                <span>Người đề xuất:</span>
                <strong>{{ selectedSubject.creator?.full_name || 'N/A' }}</strong>
              </li>
              <li>
                <span>Ngày tạo:</span>
                <strong>{{
                  new Date(selectedSubject.created_at).toLocaleDateString('vi-VN')
                }}</strong>
              </li>
            </ul>
          </div>

          <div v-if="selectedSubject.is_locked" class="detail-section warning-section">
            <h4 class="section-title text-red-500"><i class="pi pi-lock"></i> Thông tin Khóa</h4>
            <p class="section-text text-red-500 font-medium">
              Lý do khóa: {{ selectedSubject.lock_reason }}
            </p>
          </div>
        </div>

        <div
          class="details-footer"
          v-if="selectedSubject && selectedSubject.status === 'approved'"
        >
          <button
            v-if="!selectedSubject.is_locked"
            class="btn-danger w-full"
            @click="openLockModal(selectedSubject)"
          >
            <i class="pi pi-lock"></i> Khóa môn học
          </button>
          <button
            v-else
            class="btn-success w-full"
            @click="handleUnlock(selectedSubject)"
            :disabled="submittingUnlock"
          >
            <i class="pi pi-spin pi-spinner mr-1" v-if="submittingUnlock"></i>
            <i class="pi pi-lock-open" v-else></i> Mở khóa môn học
          </button>
        </div>
      </div>
    </div>

    <!-- MODAL KHÓA MÔN HỌC -->
    <div v-if="showLockModal" class="modal-overlay">
      <div class="modal-content">
        <div class="modal-header">
          <h2><i class="pi pi-lock text-red-500"></i> Khóa học phần</h2>
          <button class="btn-close" @click="closeLockModal"><i class="pi pi-times"></i></button>
        </div>
        <div class="modal-body">
          <div v-if="modalError" class="mono-alert alert-error" style="margin-bottom: 1rem; padding: 0.5rem 1rem; border-radius: 6px;">
            <i class="pi pi-exclamation-triangle"></i>
            <div>{{ modalError }}</div>
          </div>
          <p>
            Khi khóa môn học <strong>{{ selectedSubject?.name }}</strong
            >, các lớp học mới sẽ không thể được mở thêm cho môn này. Các lớp đang diễn ra vẫn hoạt
            động bình thường.
          </p>
          <div class="form-group">
            <label>Lý do khóa <span class="text-red-500">*</span></label>
            <textarea
              v-model="lockReason"
              class="mono-input textarea-reason"
              placeholder="VD: Môn học đã lỗi thời, tạm ngưng đào tạo..."
              rows="3"
            ></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" @click="closeLockModal" :disabled="submittingLock">
            Hủy bỏ
          </button>
          <button
            class="btn-danger"
            @click="submitLock"
            :disabled="submittingLock || !lockReason.trim()"
          >
            <i v-if="submittingLock" class="pi pi-spin pi-spinner"></i>
            Xác nhận khóa
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
  height: 100vh;
  overflow: hidden;
}

/* Header */
.page-header {
  flex-shrink: 0;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 1rem;
}
.breadcrumb {
  font-size: 0.75rem;
  color: #9ca3af;
  font-weight: 600;
  margin-bottom: 0.5rem;
}
.breadcrumb span {
  color: #111827;
  font-weight: 600;
}
.page-title {
  font-size: 2rem;
  font-weight: 600;
  margin: 0 0 0.5rem 0;
  color: #111827;
}
.page-subtitle {
  font-size: 0.875rem;
  color: #6b7280;
}

/* Alerts */
.mono-alert {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.5rem;
  margin-bottom: 1rem;
  font-size: 0.875rem;
  border-radius: 8px;
}
.mono-alert i {
  font-size: 1.25rem;
}
.alert-error {
  background-color: #fef2f2;
  border: 1px solid #fecaca;
  color: #b91c1c;
}
.alert-success {
  background-color: #f0fdf4;
  border: 1px solid #bbf7d0;
  color: #15803d;
}

/* Split Layout */
.split-layout {
  display: flex;
  gap: 1.5rem;
  flex: 1;
  min-height: 0;
}

.list-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  transition: all 0.3s ease;
}

.details-panel {
  width: 400px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  animation: slideLeft 0.3s ease-out;
  border-left: 4px solid #111827;
}

/* Card */
.mono-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);
  overflow: hidden;
}
.card-header {
  background-color: #f9fafb;
  color: #111827;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.header-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  font-size: 0.95rem;
}
.badge-count {
  background: #e5e7eb;
  color: #374151;
  font-size: 0.75rem;
  padding: 2px 8px;
  border-radius: 99px;
}

/* Filters */
.filter-group {
  display: flex;
  background: #e5e7eb;
  padding: 2px;
  border-radius: 6px;
}
.filter-btn {
  background: transparent;
  border: none;
  padding: 0.4rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: #6b7280;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}
.filter-btn.active {
  background: #fff;
  color: #111827;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

/* Table */
.table-container {
  flex: 1;
  overflow-y: auto;
}
.mono-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}
.mono-table th {
  position: sticky;
  top: 0;
  background-color: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
  padding: 1rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: #111827;
  z-index: 10;
}
.mono-table td {
  padding: 1rem;
  border-bottom: 1px solid #e5e7eb;
  vertical-align: middle;
  cursor: pointer;
}
.table-row {
  transition: all 0.2s;
}
.table-row:hover {
  background-color: #f3f4f6;
}
.row-selected {
  background-color: #e0e7ff !important;
  border-left: 3px solid #4f46e5;
}

.code-cell {
  font-family: monospace;
  font-weight: 600;
  color: #4f46e5;
  font-size: 0.9rem;
}
.subject-name {
  font-weight: 600;
  color: #111827;
  font-size: 0.9rem;
}
.text-center {
  text-align: center;
}
.text-right {
  text-align: right;
}
.btn-text {
  background: none;
  border: none;
  color: #4f46e5;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  transition: background 0.2s;
  border-radius: 4px;
}
.btn-text:hover {
  background: #e0e7ff;
}

/* Badges */
.mono-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.65rem;
  font-weight: 600;
  padding: 0.25rem 0.6rem;
  border-radius: 9999px;
}
.badge-pending {
  background-color: #fef3c7;
  color: #92400e;
}
.badge-approved {
  background-color: #dcfce7;
  color: #166534;
}
.badge-rejected {
  background-color: #fee2e2;
  color: #991b1b;
}
.badge-locked {
  background-color: #f3f4f6;
  color: #374151;
  border: 1px solid #d1d5db;
}
.tc-badge {
  font-size: 0.75rem;
  font-weight: 600;
  color: #4b5563;
  background: #e5e7eb;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
}
.dep-badge {
  font-size: 0.72rem;
  font-weight: 600;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  display: inline-block;
}

/* Empty State */
.empty-state,
.loading-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem;
}
.loading-state {
  color: #4f46e5;
}
.loading-state .spinner {
  font-size: 2.5rem;
  margin-bottom: 1rem;
}
.empty-icon {
  font-size: 3rem;
  color: #d1d5db;
  margin-bottom: 1rem;
}
.empty-state h2 {
  font-size: 1.25rem;
  font-weight: 600;
  color: #111827;
  margin: 0 0 0.5rem 0;
}
.empty-state p {
  font-size: 0.875rem;
  color: #6b7280;
}

/* Details Panel */
.details-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
}
.details-header h3 {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0;
  color: #111827;
}
.btn-close {
  background: none;
  border: none;
  font-size: 1.1rem;
  color: #9ca3af;
  cursor: pointer;
}
.btn-close:hover {
  color: #111827;
}

.details-body {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}
.detail-hero {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
}
.hero-code {
  font-family: monospace;
  color: #4f46e5;
  font-weight: 700;
  font-size: 0.9rem;
}
.hero-name {
  font-size: 1.25rem;
  font-weight: 700;
  color: #111827;
  margin: 0;
  line-height: 1.3;
}
.hero-tags {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.detail-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.section-title {
  font-size: 0.85rem;
  font-weight: 700;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0;
}
.section-text {
  font-size: 0.9rem;
  color: #374151;
  line-height: 1.6;
  margin: 0;
}

.info-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.info-list li {
  display: flex;
  justify-content: space-between;
  font-size: 0.875rem;
  border-bottom: 1px dashed #e5e7eb;
  padding-bottom: 0.25rem;
}
.info-list li span {
  color: #6b7280;
}
.info-list li strong {
  color: #111827;
  font-weight: 600;
  text-align: right;
  max-width: 60%;
  word-break: break-word;
}

.warning-section {
  background: #fef2f2;
  padding: 1rem;
  border-radius: 8px;
  border: 1px dashed #fca5a5;
}

.details-footer {
  padding: 1.25rem 1.5rem;
  border-top: 1px solid #e5e7eb;
  background: #f9fafb;
}
.w-full {
  width: 100%;
}

/* Modal Khóa Môn Học */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}
.modal-content {
  background: #fff;
  width: 100%;
  max-width: 500px;
  border-radius: 12px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  animation: slideUp 0.3s ease-out;
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid #e5e7eb;
}
.modal-header h2 {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
  color: #111827;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.modal-body {
  padding: 1.5rem;
}
.modal-body p {
  margin-top: 0;
  margin-bottom: 1rem;
  font-size: 0.9rem;
  color: #4b5563;
  line-height: 1.5;
}
.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.form-group label {
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
}
.text-red-500 {
  color: #ef4444;
}
.font-medium {
  font-weight: 500;
}
.mono-input {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-family: inherit;
  font-size: 0.95rem;
  outline: none;
  transition: all 0.2s;
  box-sizing: border-box;
}
.mono-input:focus {
  border-color: #ef4444;
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
}
.textarea-reason {
  resize: vertical;
  min-height: 80px;
}
.modal-footer {
  padding: 1.25rem 1.5rem;
  border-top: 1px solid #e5e7eb;
  background: #f9fafb;
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
}
.btn-cancel {
  padding: 0.5rem 1rem;
  background: #fff;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-weight: 500;
  color: #374151;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-cancel:hover:not(:disabled) {
  background: #f3f4f6;
}
.btn-danger {
  padding: 0.5rem 1.25rem;
  background: #ef4444;
  border: 1px solid #ef4444;
  border-radius: 6px;
  font-weight: 500;
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.2s;
}
.btn-danger:hover:not(:disabled) {
  background: #dc2626;
  border-color: #dc2626;
}
.btn-success {
  padding: 0.5rem 1.25rem;
  background: #10b981;
  border: 1px solid #10b981;
  border-radius: 6px;
  font-weight: 500;
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition: all 0.2s;
}
.btn-success:hover:not(:disabled) {
  background: #059669;
  border-color: #059669;
}
.btn-danger:disabled,
.btn-success:disabled,
.btn-cancel:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@keyframes slideLeft {
  from {
    opacity: 0;
    transform: translateX(20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.search-container {
  width: 100%;
  flex-shrink: 0;
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
.search-filter-row {
  display: flex;
  gap: 1rem;
  width: 100%;
  flex-shrink: 0;
}
.search-box-wrapper {
  position: relative;
  flex: 1;
}
.filter-select-wrapper {
  position: relative;
  width: 280px;
  flex-shrink: 0;
}
.filter-icon {
  position: absolute;
  left: 1rem;
  top: 50%;
  transform: translateY(-50%);
  color: #9ca3af;
  pointer-events: none;
}
.dept-select {
  width: 100%;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 0.6rem 2.5rem 0.6rem 2.5rem;
  font-size: 0.875rem;
  outline: none;
  background-color: #fff;
  font-weight: 500;
  color: #374151;
  transition: border-color 0.2s, box-shadow 0.2s;
  box-sizing: border-box;
  appearance: none;
  cursor: pointer;
}
.dept-select:focus {
  border-color: #7c3aed;
  box-shadow: 0 0 0 3px rgba(124,58,237,0.1);
}
.filter-select-wrapper::after {
  content: '\e902';
  font-family: 'primeicons';
  position: absolute;
  right: 1rem;
  top: 50%;
  transform: translateY(-50%);
  color: #9ca3af;
  pointer-events: none;
  font-size: 0.8rem;
}
</style>
