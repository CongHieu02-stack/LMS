<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { apiGet, apiPut } from '@/lib/api'

const authStore = useAuthStore()

// State
const subjects = ref<any[]>([])
const loading = ref(false)
const errorMessage = ref<string | null>(null)
const successMessage = ref<string | null>(null)

// Fetch danh sách môn học
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

// Xử lý phê duyệt / từ chối môn học
async function handleApproval(subject: any, newStatus: 'approved' | 'rejected') {
  const actionText = newStatus === 'approved' ? 'Phê duyệt' : 'Từ chối'
  const confirmAction = confirm(`Bạn có chắc chắn muốn ${actionText} môn học "${subject.name}" (${subject.code}) không?`)
  if (!confirmAction) return

  loading.value = true
  errorMessage.value = null
  successMessage.value = null

  try {
    const res = await apiPut<any>(`/subjects/${subject.id}/status`, {
      status: newStatus
    })

    if (res.success) {
      successMessage.value = `Đã ${actionText} thành công môn học "${subject.name}".`
      await fetchSubjects()
    }
  } catch (err) {
    errorMessage.value = (err as Error).message || `Gặp lỗi khi ${actionText} môn học.`
  } finally {
    loading.value = false
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
              </td>
              <td class="text-right">
                <div v-if="sub.status === 'pending'" class="action-buttons">
                  <button 
                    class="btn-icon btn-approve"
                    title="Phê duyệt"
                    @click="handleApproval(sub, 'approved')"
                  >
                    <i class="pi pi-check"></i>
                  </button>
                  <button 
                    class="btn-icon btn-reject"
                    title="Từ chối"
                    @click="handleApproval(sub, 'rejected')"
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
  margin-bottom: 2rem;
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 1rem;
}
.breadcrumb {
  font-size: 0.75rem;
  /* text-transform: removed */
  letter-spacing: normal;
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
  letter-spacing: normal;
  /* text-transform: removed */
  margin: 0 0 0.5rem 0;
  color: #111827;
}
.page-subtitle {
  font-size: 0.875rem;
  color: #6b7280;
}

/* Alerts */
.mono-alert {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.5rem;
  margin-bottom: 1.5rem;
  font-size: 0.875rem;
  border-radius: 0;
}
.mono-alert i {
  font-size: 1.25rem;
}
.alert-error {
  background-color: #fef2f2;
  border: 2px solid #ef4444;
  color: #b91c1c;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.03);
}
.alert-success {
  background-color: #f0fdf4;
  border: 2px solid #22c55e;
  color: #15803d;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.03);
}

/* Card */
.mono-card {
  background: #fff;
  border: 1px solid #e5e7eb; border-radius: 8px;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.03);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.card-header {
  background-color: #f9fafb; color: #111827; border-top-left-radius: 8px; border-top-right-radius: 8px;
  padding: 1rem 1.5rem;
  font-weight: 600;
  /* text-transform: removed */
  font-size: 0.875rem;
  letter-spacing: normal;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.card-header i {
  color: #9ca3af;
}

/* Empty & Loading States */
.loading-state, .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem;
}
.loading-state { color: #9333ea; }
.loading-state .spinner { font-size: 2.5rem; margin-bottom: 1rem; }
.loading-state div {
  font-weight: 600;
  /* text-transform: removed */
  letter-spacing: normal;
  font-size: 0.75rem;
  color: #111827;
}
.empty-state .empty-icon {
  font-size: 3rem;
  color: #d1d5db;
  margin-bottom: 1rem;
}
.empty-state h2 {
  font-size: 1.25rem;
  font-weight: 600;
  /* text-transform: removed */
  margin: 0 0 0.5rem 0;
  color: #111827;
}
.empty-state p {
  font-size: 0.875rem;
  color: #6b7280;
}

/* Table */
.table-container {
  overflow-x: auto;
}
.mono-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}
.mono-table th {
  background-color: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
  padding: 1rem;
  font-size: 0.75rem;
  font-weight: 600;
  /* text-transform: removed */
  letter-spacing: normal;
  color: #111827;
}
.mono-table td {
  padding: 1rem;
  border-bottom: 1px solid #e5e7eb;
  vertical-align: middle;
}
.table-row {
  transition: background-color 0.2s;
}
.table-row:hover {
  background-color: #faf5ff; /* purple-50 */
}
.table-row:last-child td {
  border-bottom: none;
}

/* Table Cells Typography */
.code-cell {
  
  font-weight: 500;
  color: #9333ea;
  font-size: 0.875rem;
}
.subject-name {
  font-weight: 600;
  color: #111827;
  font-size: 0.95rem;
  margin-bottom: 0.25rem;
}
.subject-desc {
  font-size: 0.75rem;
  color: #6b7280;
}
.user-cell {
  font-size: 0.875rem;
  color: #4b5563;
  font-weight: 500;
}
.font-black {
  font-weight: 600;
}
.text-center { text-align: center; }
.text-right { text-align: right; }

/* Badges */
.mono-badge {
  display: inline-block;
  font-size: 0.65rem;
  font-weight: 600;
  /* text-transform: removed */
  letter-spacing: normal;
  padding: 0.25rem 0.75rem;
  border: 1px solid #000;
}
.badge-pending {
  background-color: #fef08a; /* yellow-200 */
  color: #854d0e;
  border-color: #854d0e;
}
.badge-approved {
  background-color: #dcfce7; /* green-100 */
  color: #166534;
  border-color: #166534;
}
.badge-rejected {
  background-color: #fee2e2; /* red-100 */
  color: #991b1b;
  border-color: #991b1b;
}

/* Action Buttons */
.action-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}
.btn-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #e5e7eb; border-radius: 8px;
  background-color: #fff;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-approve { color: #166534; }
.btn-approve:hover {
  background-color: #dcfce7;
  border-color: #166534;
  transform: translateY(-2px); box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.04);
}
.btn-reject { color: #991b1b; }
.btn-reject:hover {
  background-color: #fee2e2;
  border-color: #991b1b;
  transform: translateY(-2px); box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.04);
}
.status-done {
  font-size: 0.75rem;
  font-weight: 600;
  color: #9ca3af;
  /* text-transform: removed */
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
