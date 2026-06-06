<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { apiGet } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()

// State
const logs = ref<any[]>([])
const loading = ref(false)
const errorMessage = ref<string | null>(null)

// Search & Filter State
const searchQuery = ref('')
const selectedCategory = ref('ALL') // ALL, USER, CLASS, EXAM, ADMIN

// Categories definition
const categories = [
  { label: 'Tất cả hoạt động', value: 'ALL', icon: 'pi pi-list' },
  { label: 'Người dùng & Auth', value: 'USER', icon: 'pi pi-user' },
  { label: 'Lớp học & Phân công', value: 'CLASS', icon: 'pi pi-sitemap' },
  { label: 'Thi cử & Điểm', value: 'EXAM', icon: 'pi pi-file-edit' },
  { label: 'Thao tác Admin', value: 'ADMIN', icon: 'pi pi-shield' },
]

// Mapping action types to categories
function getActionCategory(action: string): string {
  const userActions = ['CREATE_PROFILE', 'UPDATE_ROLE', 'DELETE_PROFILE', 'LOCK_USER', 'RESET_PASSWORD']
  const classActions = [
    'REGISTER_CLASS', 'CREATE_CLASS', 'APPROVE_CLASS', 'REJECT_CLASS', 'ASSIGN_INSTRUCTOR',
    'PROPOSE_SUBJECT', 'APPROVE_SUBJECT', 'REJECT_SUBJECT', 'LOCK_SUBJECT'
  ]
  const examActions = ['SUBMIT_EXAM']
  const adminActions = ['ADMIN_ACTION']

  if (userActions.includes(action)) return 'USER'
  if (classActions.includes(action)) return 'CLASS'
  if (examActions.includes(action)) return 'EXAM'
  if (adminActions.includes(action)) return 'ADMIN'
  return 'OTHER'
}

// Translate role keys
function translateRole(role: string): string {
  const roles: Record<string, string> = {
    ADMIN: 'Quản trị viên',
    HIEU_TRUONG: 'Hiệu trưởng',
    HR: 'Nhân sự (HR)',
    PHONG_DAO_TAO: 'Phòng đào tạo',
    TRUONG_BO_MON: 'Trưởng bộ môn',
    GIANG_VIEN: 'Giảng viên',
    SINH_VIEN: 'Sinh viên'
  }
  return roles[role] || role
}

// Action label and styles mapping
function getActionBadgeConfig(action: string) {
  const configs: Record<string, { label: string; class: string }> = {
    CREATE_PROFILE: { label: 'Tạo tài khoản', class: 'badge-success' },
    UPDATE_ROLE: { label: 'Cấp quyền', class: 'badge-purple' },
    DELETE_PROFILE: { label: 'Xóa tài khoản', class: 'badge-danger' },
    LOCK_USER: { label: 'Khóa/Mở khóa', class: 'badge-warn' },
    RESET_PASSWORD: { label: 'Đặt lại MK', class: 'badge-orange' },
    REGISTER_CLASS: { label: 'Đăng ký lớp', class: 'badge-info' },
    CREATE_CLASS: { label: 'Tạo lớp học', class: 'badge-indigo' },
    APPROVE_CLASS: { label: 'Duyệt lớp', class: 'badge-success-outline' },
    REJECT_CLASS: { label: 'Từ chối lớp', class: 'badge-danger-outline' },
    ASSIGN_INSTRUCTOR: { label: 'Phân giảng viên', class: 'badge-teal' },
    SUBMIT_EXAM: { label: 'Nộp bài thi', class: 'badge-teal-solid' },
    ADMIN_ACTION: { label: 'Duyệt/Khóa hệ thống', class: 'badge-primary' },
    PROPOSE_SUBJECT: { label: 'Đề xuất học phần', class: 'badge-indigo' },
    APPROVE_SUBJECT: { label: 'Duyệt học phần', class: 'badge-success-outline' },
    REJECT_SUBJECT: { label: 'Từ chối học phần', class: 'badge-danger-outline' },
    LOCK_SUBJECT: { label: 'Khóa học phần', class: 'badge-danger' }
  }
  return configs[action] || { label: action, class: 'badge-gray' }
}

// Fetch logs from API
async function fetchLogs() {
  loading.value = true
  errorMessage.value = null
  try {
    const res = await apiGet<any>('/admin/activity-logs')
    logs.value = res.data || []
  } catch (err) {
    errorMessage.value = (err as Error).message || 'Không thể tải lịch sử hoạt động.'
  } finally {
    loading.value = false
  }
}

// Filter logs locally based on search query and category
const filteredLogs = computed(() => {
  return logs.value.filter((log: any) => {
    // 1. Filter by category
    if (selectedCategory.value !== 'ALL') {
      const cat = getActionCategory(log.action)
      if (cat !== selectedCategory.value) return false
    }

    // 2. Filter by search query (Email, Full Name, Action type, or Details)
    const query = searchQuery.value.trim().toLowerCase()
    if (!query) return true

    return (
      log.email.toLowerCase().includes(query) ||
      log.fullName.toLowerCase().includes(query) ||
      log.action.toLowerCase().includes(query) ||
      (log.details && log.details.toLowerCase().includes(query))
    )
  })
})

// Format time
function formatDateTime(timeStr: string) {
  const d = new Date(timeStr)
  return d.toLocaleString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

// Helper to simplify User Agent display
function parseUserAgent(ua: string): string {
  if (!ua) return 'Không rõ'
  if (ua.includes('PostmanRuntime')) return 'Postman Client'
  
  const browsers = [
    { name: 'Chrome', reg: /Chrome\/([0-9\.]+)/ },
    { name: 'Safari', reg: /Version\/([0-9\.]+).*Safari/ },
    { name: 'Firefox', reg: /Firefox\/([0-9\.]+)/ },
    { name: 'Edge', reg: /Edg\/([0-9\.]+)/ }
  ]
  const os = [
    { name: 'Windows', reg: /Windows NT/ },
    { name: 'Macintosh', reg: /Macintosh/ },
    { name: 'Linux', reg: /Linux/ },
    { name: 'iPhone/iPad', reg: /iPhone|iPad/ },
    { name: 'Android', reg: /Android/ }
  ]

  let clientOS = 'OS'
  for (const item of os) {
    if (item.reg.test(ua)) {
      clientOS = item.name
      break
    }
  }

  let clientBrowser = 'Browser'
  for (const item of browsers) {
    if (item.reg.test(ua)) {
      clientBrowser = item.name
      break
    }
  }

  return `${clientBrowser} (${clientOS})`
}

onMounted(() => {
  fetchLogs()
})
</script>

<template>
  <div class="mono-wrapper">
    <!-- Header -->
    <div class="page-header">
      <div>
        <div class="breadcrumb">Quản trị / <span>Lịch sử hoạt động</span></div>
        <h1 class="page-title">Lịch sử hoạt động</h1>
        <div class="page-subtitle">Giám sát các thao tác tương tác của nhân viên, giảng viên và sinh viên với hệ thống.</div>
      </div>
      <button class="btn-refresh" @click="fetchLogs" :disabled="loading">
        <i class="pi pi-refresh" :class="{ 'pi-spin': loading }"></i> Tải lại dữ liệu
      </button>
    </div>

    <!-- Alert thông báo lỗi -->
    <div v-if="errorMessage" class="mono-alert alert-error">
      <i class="pi pi-exclamation-triangle"></i>
      <div><strong>LỖI:</strong> {{ errorMessage }}</div>
    </div>

    <!-- Category Filter Bar (Vibrant Soft UI Cards) -->
    <div class="category-tabs">
      <button
        v-for="cat in categories"
        :key="cat.value"
        class="category-tab-btn"
        :class="{ active: selectedCategory === cat.value }"
        @click="selectedCategory = cat.value"
      >
        <i :class="cat.icon" class="tab-icon"></i>
        <span>{{ cat.label }}</span>
      </button>
    </div>

    <!-- Bảng danh sách logs -->
    <div class="mono-card">
      <!-- Search bar -->
      <div class="filter-bar">
        <div class="search-input-wrapper">
          <i class="pi pi-search search-icon"></i>
          <input
            v-model="searchQuery"
            type="text"
            class="mono-input search-input"
            placeholder="Tìm kiếm theo họ tên, email, hành động hoặc mô tả chi tiết..."
          />
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading && logs.length === 0" class="loading-state">
        <i class="pi pi-spin pi-spinner spinner"></i>
        <div>Đang tải lịch sử hoạt động...</div>
      </div>

      <!-- Empty State -->
      <div v-else-if="filteredLogs.length === 0" class="empty-state">
        <i class="pi pi-inbox empty-icon"></i>
        <div>Không tìm thấy hoạt động nào phù hợp.</div>
      </div>

      <!-- Data Table -->
      <div v-else class="table-container">
        <table class="mono-table">
          <thead>
            <tr>
              <th style="width: 170px">Thời gian</th>
              <th style="width: 250px">Người thực hiện</th>
              <th style="width: 180px">Loại hành động</th>
              <th>Mô tả chi tiết</th>
              <th style="width: 200px">Địa chỉ IP & Thiết bị</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="log in filteredLogs" :key="log.id" class="table-row">
              <td class="time-cell">
                <i class="pi pi-clock time-icon"></i>
                {{ formatDateTime(log.createdAt) }}
              </td>
              <td>
                <div class="user-fullname">{{ log.fullName }}</div>
                <div class="user-email">{{ log.email }}</div>
                <span class="user-role-badge badge-rank">{{ translateRole(log.role) }}</span>
              </td>
              <td>
                <span class="action-badge" :class="getActionBadgeConfig(log.action).class">
                  {{ getActionBadgeConfig(log.action).label }}
                </span>
              </td>
              <td class="details-cell">
                <span class="details-text">{{ log.details || 'Không có mô tả chi tiết.' }}</span>
              </td>
              <td>
                <div class="ip-address">
                  <i class="pi pi-desktop client-icon"></i>
                  <code>{{ log.ipAddress || 'N/A' }}</code>
                </div>
                <div class="user-agent" :title="log.userAgent">
                  {{ parseUserAgent(log.userAgent) }}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Summary count footer -->
      <div class="card-footer">
        Hiển thị <strong>{{ filteredLogs.length }}</strong> trên tổng số <strong>{{ logs.length }}</strong> hoạt động được tải.
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
.page-header {
  margin-bottom: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
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

.btn-refresh {
  background: #fff;
  color: #374151;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 0.75rem 1.25rem;
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.2s;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}
.btn-refresh:hover:not(:disabled) {
  background: #f9fafb;
  border-color: #9ca3af;
}
.btn-refresh:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Category Tabs */
.category-tabs {
  display: flex;
  gap: 10px;
  margin-bottom: 1.5rem;
  overflow-x: auto;
  padding-bottom: 5px;
}
.category-tab-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 20px;
  padding: 8px 16px;
  font-size: 0.875rem;
  font-weight: 500;
  color: #4b5563;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}
.category-tab-btn:hover {
  background: #f3f4f6;
  color: #1f2937;
}
.category-tab-btn.active {
  background: #7c3aed;
  color: #fff;
  border-color: #7c3aed;
  box-shadow: 0 4px 6px -1px rgba(124, 58, 237, 0.2), 0 2px 4px -1px rgba(124, 58, 237, 0.1);
}
.tab-icon {
  font-size: 0.9rem;
}

/* Alerts */
.mono-alert {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.5rem;
  margin-bottom: 1.5rem;
  font-size: 0.875rem;
  border-radius: 8px;
}
.alert-error {
  background: #fef2f2;
  color: #991b1b;
  border: 1px solid #fee2e2;
}

/* Card layout */
.mono-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
}

.filter-bar {
  padding: 16px;
  border-bottom: 1px solid #e5e7eb;
  background-color: #fafafa;
  border-radius: 12px 12px 0 0;
}
.search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}
.search-icon {
  position: absolute;
  left: 12px;
  color: #9ca3af;
}
.search-input {
  width: 100%;
  padding: 10px 12px 10px 36px !important;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.9rem;
}

/* Loading & Empty States */
.loading-state, .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  gap: 1rem;
  color: #6b7280;
}
.spinner {
  font-size: 2rem;
  color: #7c3aed;
}
.empty-icon {
  font-size: 3rem;
  color: #d1d5db;
}

/* Table */
.table-container {
  overflow-x: auto;
}
.mono-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 0.875rem;
}
.mono-table th {
  background: #f9fafb;
  padding: 12px 16px;
  font-weight: 600;
  color: #374151;
  border-bottom: 1px solid #e5e7eb;
  text-transform: uppercase;
  font-size: 0.75rem;
  letter-spacing: 0.05em;
}
.mono-table td {
  padding: 16px;
  border-bottom: 1px solid #f3f4f6;
  vertical-align: top;
}
.table-row:hover {
  background-color: #f9fafb;
}

/* Cells */
.time-cell {
  color: #4b5563;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}
.time-icon {
  color: #9ca3af;
  font-size: 0.85rem;
}

.user-fullname {
  font-weight: 600;
  color: #111827;
}
.user-email {
  font-size: 0.75rem;
  color: #6b7280;
  margin-bottom: 4px;
}
.user-role-badge {
  display: inline-block;
  font-size: 0.7rem;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  background: #f3f4f6;
  color: #4b5563;
}

/* Action badges styling */
.action-badge {
  display: inline-block;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 6px;
  white-space: nowrap;
}
.badge-success { background-color: #d1fae5; color: #065f46; }
.badge-success-outline { background-color: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }
.badge-purple { background-color: #f3e8ff; color: #5b21b6; }
.badge-danger { background-color: #fee2e2; color: #991b1b; }
.badge-danger-outline { background-color: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
.badge-warn { background-color: #fef3c7; color: #92400e; }
.badge-orange { background-color: #ffedd5; color: #c2410c; }
.badge-info { background-color: #e0f2fe; color: #075985; }
.badge-indigo { background-color: #e0e7ff; color: #3730a3; }
.badge-teal { background-color: #ccfbf1; color: #0f766e; }
.badge-teal-solid { background-color: #0d9488; color: #ffffff; }
.badge-primary { background-color: #f5f3ff; color: #6d28d9; border: 1px solid #ddd6fe; }
.badge-gray { background-color: #f3f4f6; color: #374151; }

.details-cell {
  line-height: 1.5;
}
.details-text {
  color: #1f2937;
  word-break: break-word;
}

.ip-address {
  font-family: monospace;
  font-size: 0.8rem;
  color: #374151;
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}
.client-icon {
  color: #9ca3af;
  font-size: 0.8rem;
}
.user-agent {
  font-size: 0.72rem;
  color: #6b7280;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-footer {
  padding: 12px 16px;
  background: #f9fafb;
  border-top: 1px solid #e5e7eb;
  border-radius: 0 0 12px 12px;
  font-size: 0.8rem;
  color: #6b7280;
}

/* Animations */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
