<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { apiGet } from '@/lib/api'

// States
const classes = ref<any[]>([])
const subjects = ref<any[]>([])
const loading = ref(true)
const errMsg = ref<string | null>(null)

// Filters State
const searchQuery = ref('')
const selectedSubjectId = ref('')
const statusFilter = ref('')

// Detail Modal State
const selectedClass = ref<any>(null)
const showDetailModal = ref(false)

async function loadData() {
  loading.value = true
  errMsg.value = null
  try {
    const [classRes, subRes] = await Promise.all([
      apiGet<any>('/classes'),
      apiGet<{ success: boolean; data: any[] }>('/subjects'),
    ])
    
    const classData = classRes.data || classRes
    classes.value = Array.isArray(classData) ? classData : []
    subjects.value = (subRes.data || []).filter((s: any) => s.status === 'approved')
  } catch (err: any) {
    errMsg.value = err.message || 'Không thể tải dữ liệu lớp học.'
  } finally {
    loading.value = false
  }
}

// Computed filtered list
const filteredClasses = computed(() => {
  return classes.value.filter((c) => {
    // 1. Search name/code
    const className = (c.name || '').toLowerCase()
    const subjectCode = (c.subject?.code || '').toLowerCase()
    const matchesSearch =
      !searchQuery.value.trim() ||
      className.includes(searchQuery.value.toLowerCase()) ||
      subjectCode.includes(searchQuery.value.toLowerCase())

    // 2. Filter by subject
    const matchesSubject =
      !selectedSubjectId.value ||
      c.subject?.id === selectedSubjectId.value

    // 3. Filter by instructor status — dùng c.instructorId hoặc c.instructor?.id
    const isAssigned = !!(c.instructorId || c.instructor?.id)
    const matchesStatus =
      !statusFilter.value ||
      (statusFilter.value === 'assigned' && isAssigned) ||
      (statusFilter.value === 'unassigned' && !isAssigned)

    return matchesSearch && matchesSubject && matchesStatus
  })
})

function openDetail(cls: any) {
  selectedClass.value = cls
  showDetailModal.value = true
}

function closeDetail() {
  showDetailModal.value = false
  selectedClass.value = null
}

onMounted(loadData)
</script>

<template>
  <div class="mono-wrapper">
    <!-- Header -->
    <div class="page-header">
      <div>
        <div class="breadcrumb">Quản lý Lớp học / <span>Tra cứu lớp học</span></div>
        <h1 class="page-title">Tra Cứu Lớp Học</h1>
        <div class="page-subtitle">
          Tìm kiếm lớp học, lọc theo môn học và trạng thái phân công giảng viên.
        </div>
      </div>
      <button class="btn-refresh" @click="loadData" :disabled="loading">
        <i class="pi pi-refresh" :class="{ 'pi-spin': loading }"></i> Tải lại
      </button>
    </div>

    <!-- Error Alert -->
    <div v-if="errMsg" class="alert alert-e">
      <i class="pi pi-times-circle"></i> {{ errMsg }}
    </div>

    <!-- Filters Section -->
    <div class="filters-card">
      <div class="filter-grid">
        <div class="fg">
          <label>Tìm kiếm lớp học</label>
          <div class="input-icon-wrapper">
            <i class="pi pi-search input-icon"></i>
            <input
              v-model="searchQuery"
              type="text"
              class="mono-input has-icon"
              placeholder="Nhập tên lớp hoặc mã môn..."
            />
          </div>
        </div>

        <div class="fg">
          <label>Môn học</label>
          <select v-model="selectedSubjectId" class="mono-input">
            <option value="">-- Tất cả môn học --</option>
            <option v-for="s in subjects" :key="s.id" :value="s.id">
              {{ s.code }} — {{ s.name }}
            </option>
          </select>
        </div>

        <div class="fg">
          <label>Trạng thái giảng viên</label>
          <select v-model="statusFilter" class="mono-input">
            <option value="">-- Tất cả trạng thái --</option>
            <option value="assigned">Đã gán giảng viên</option>
            <option value="unassigned">Chưa gán giảng viên</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Loading Spinner -->
    <div v-if="loading" class="loading-wrapper">
      <i class="pi pi-spin pi-spinner spinner-icon"></i>
      <span>Đang tải danh sách lớp học...</span>
    </div>

    <!-- Classes Grid List -->
    <div v-else>
      <div v-if="filteredClasses.length === 0" class="empty-state">
        <i class="pi pi-folder-open empty-icon"></i>
        <h3>Không tìm thấy lớp học nào</h3>
        <p>Vui lòng thử thay đổi từ khóa hoặc bộ lọc lớp học.</p>
      </div>

      <div v-else>
        <div class="result-summary">
          Tìm thấy <strong>{{ filteredClasses.length }}</strong> lớp học
        </div>
        <div class="classes-grid">
          <div
            v-for="c in filteredClasses"
            :key="c.id"
            class="class-card"
            @click="openDetail(c)"
            title="Click để xem chi tiết lớp học"
          >
            <div class="card-top">
              <div class="subject-info">
                <span class="subject-code">{{ c.subject?.code }}</span>
                <span class="subject-name">{{ c.subject?.name }}</span>
              </div>
              <span
                class="badge-status"
                :class="(c.instructorId || c.instructor?.id) ? 'status-assigned' : 'status-unassigned'"
              >
                {{ (c.instructorId || c.instructor?.id) ? 'Đã gán GV' : 'Chưa gán GV' }}
              </span>
            </div>

            <h3 class="class-name">{{ c.name }}</h3>

            <div class="card-details">
              <div class="detail-item">
                <i class="pi pi-users icon-detail"></i>
                <span>Sĩ số: <strong>{{ c.maxSlots }}</strong> học viên</span>
              </div>
              <div class="detail-item" v-if="c.schedule">
                <i class="pi pi-calendar icon-detail"></i>
                <span>Lịch học: {{ c.schedule }}</span>
              </div>
              <div class="detail-item" v-if="c.room">
                <i class="pi pi-map-marker icon-detail"></i>
                <span>Phòng học: {{ c.room }}</span>
              </div>
              <div class="detail-item">
                <i class="pi pi-bookmark icon-detail"></i>
                <span>Học kỳ: {{ c.semester }}</span>
              </div>
              <div class="detail-item" v-if="c.instructor">
                <i class="pi pi-user icon-detail" style="color:#166534"></i>
                <span style="color:#166534; font-weight:600;">GV: {{ c.instructor.fullName }}</span>
              </div>
            </div>

            <div class="card-footer">
              <span class="view-detail-hint"><i class="pi pi-eye"></i> Xem chi tiết</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== MODAL CHI TIẾT LỚP HỌC ===== -->
    <Teleport to="body">
      <div v-if="showDetailModal && selectedClass" class="modal-overlay" @click.self="closeDetail">
        <div class="detail-modal">
          <!-- Modal Header -->
          <div class="modal-header">
            <div>
              <span class="modal-subject-code">{{ selectedClass.subject?.code }}</span>
              <h2 class="modal-title">{{ selectedClass.name }}</h2>
            </div>
            <button class="btn-close-modal" @click="closeDetail">
              <i class="pi pi-times"></i>
            </button>
          </div>

          <!-- Instructor Status Banner -->
          <div
            class="instructor-banner"
            :class="(selectedClass.instructorId || selectedClass.instructor?.id) ? 'banner-assigned' : 'banner-unassigned'"
          >
            <i :class="(selectedClass.instructorId || selectedClass.instructor?.id) ? 'pi pi-user-edit' : 'pi pi-user-minus'"></i>
            <span v-if="selectedClass.instructor">
              Giảng viên phụ trách: <strong>{{ selectedClass.instructor.fullName }}</strong>
              <span v-if="selectedClass.instructor.email" class="instructor-email">
                ({{ selectedClass.instructor.email }})
              </span>
            </span>
            <span v-else>Lớp học chưa được phân công giảng viên</span>
          </div>

          <!-- Modal Body: info grid -->
          <div class="modal-body">
            <div class="info-grid">
              <div class="info-block">
                <div class="info-label"><i class="pi pi-book"></i> Môn học</div>
                <div class="info-value">{{ selectedClass.subject?.name }}</div>
              </div>
              <div class="info-block">
                <div class="info-label"><i class="pi pi-hashtag"></i> Tín chỉ</div>
                <div class="info-value">{{ selectedClass.subject?.credits ?? '—' }} TC</div>
              </div>
              <div class="info-block">
                <div class="info-label"><i class="pi pi-users"></i> Sĩ số tối đa</div>
                <div class="info-value">{{ selectedClass.maxSlots }} học viên</div>
              </div>
              <div class="info-block">
                <div class="info-label"><i class="pi pi-check-square"></i> Còn trống</div>
                <div class="info-value">{{ selectedClass.remainingSlots ?? '—' }} chỗ</div>
              </div>
              <div class="info-block">
                <div class="info-label"><i class="pi pi-calendar"></i> Lịch học</div>
                <div class="info-value">{{ selectedClass.schedule || '—' }}</div>
              </div>
              <div class="info-block">
                <div class="info-label"><i class="pi pi-map-marker"></i> Phòng học</div>
                <div class="info-value">{{ selectedClass.room || '—' }}</div>
              </div>
              <div class="info-block">
                <div class="info-label"><i class="pi pi-bookmark"></i> Học kỳ</div>
                <div class="info-value">{{ selectedClass.semester || '—' }}</div>
              </div>
              <div class="info-block">
                <div class="info-label"><i class="pi pi-circle"></i> Trạng thái</div>
                <div class="info-value">
                  <span v-if="selectedClass.isActive !== false" class="chip chip-active">Đang hoạt động</span>
                  <span v-else class="chip chip-inactive">Không hoạt động</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Modal Footer -->
          <div class="modal-footer">
            <button class="btn-secondary" @click="closeDetail">
              <i class="pi pi-times"></i> Đóng
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.mono-wrapper {
  padding: 1.5rem 2rem;
  animation: fadeIn 0.3s ease-out;
}

/* Header */
.page-header {
  margin-bottom: 2rem;
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
}
.breadcrumb { font-size: 0.8rem; color: #6b7280; margin-bottom: 0.5rem; }
.breadcrumb span { color: #111827; font-weight: 600; }
.page-title { font-size: 1.75rem; font-weight: 600; margin: 0 0 0.5rem 0; color: #111827; }
.page-subtitle { font-size: 0.875rem; color: #6b7280; }
.btn-refresh {
  padding: 0.6rem 1.2rem;
  background-color: #fff;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  color: #374151;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.2s;
}
.btn-refresh:hover:not(:disabled) { background-color: #f9fafb; border-color: #9ca3af; }

/* Alert */
.alert { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1.25rem; border-radius: 8px; font-size: 0.875rem; margin-bottom: 1.5rem; }
.alert-e { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }

/* Filters Card */
.filters-card {
  background: #fff; border: 1px solid #e5e7eb; border-radius: 12px;
  padding: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05); margin-bottom: 2rem;
}
.filter-grid { display: grid; grid-template-columns: 1.5fr 1fr 1fr; gap: 1.5rem; }
.fg { display: flex; flex-direction: column; gap: 0.5rem; }
.fg label { font-size: 0.85rem; font-weight: 600; color: #374151; }
.mono-input {
  width: 100%; padding: 0.6rem 1rem; border: 1px solid #d1d5db; border-radius: 8px;
  font-family: inherit; font-size: 0.95rem; outline: none; box-sizing: border-box;
  background-color: #fff; height: 42px;
}
.mono-input:focus { border-color: #7c3aed; box-shadow: 0 0 0 3px rgba(124,58,237,0.1); }
.input-icon-wrapper { position: relative; width: 100%; }
.input-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #9ca3af; }
.mono-input.has-icon { padding-left: 2.2rem; }

/* Loading & Empty State */
.loading-wrapper { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 5rem 0; color: #6b7280; gap: 1rem; }
.spinner-icon { font-size: 2.5rem; }
.empty-state {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 5rem 0; border: 1px dashed #d1d5db; border-radius: 12px; background: #f9fafb; text-align: center;
}
.empty-icon { font-size: 3rem; color: #9ca3af; margin-bottom: 1rem; }
.empty-state h3 { font-size: 1.2rem; font-weight: 600; color: #374151; margin: 0 0 0.5rem 0; }
.empty-state p { color: #6b7280; margin: 0; font-size: 0.9rem; }

.result-summary { font-size: 0.875rem; color: #6b7280; margin-bottom: 1rem; }

/* Grid Lớp học */
.classes-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1.5rem; }
.class-card {
  background: #fff; border: 1px solid #e5e7eb; border-radius: 12px;
  padding: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  transition: all 0.2s ease; display: flex; flex-direction: column;
  gap: 1rem; cursor: pointer; position: relative;
}
.class-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 10px 20px -5px rgba(124,58,237,0.12), 0 4px 6px -2px rgba(0,0,0,0.04);
  border-color: #c4b5fd;
}
.card-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; }
.subject-info { display: flex; flex-direction: column; gap: 0.25rem; }
.subject-code {
  font-size: 0.75rem; font-weight: 700; color: #7c3aed;
  background-color: #f5f3ff; padding: 0.15rem 0.5rem; border-radius: 4px; width: fit-content;
}
.subject-name { font-size: 0.85rem; color: #4b5563; font-weight: 500; line-height: 1.3; }
.class-name { font-size: 1.25rem; font-weight: 700; color: #111827; margin: 0; }
.badge-status { font-size: 0.72rem; font-weight: 600; padding: 0.25rem 0.6rem; border-radius: 9999px; white-space: nowrap; }
.status-assigned { background: #dcfce7; color: #166534; }
.status-unassigned { background: #fef3c7; color: #92400e; }

.card-details { display: flex; flex-direction: column; gap: 0.6rem; border-top: 1px solid #f3f4f6; padding-top: 0.8rem; }
.detail-item { display: flex; align-items: center; gap: 0.75rem; font-size: 0.85rem; color: #4b5563; }
.icon-detail { color: #9ca3af; width: 14px; font-size: 0.85rem; }

.card-footer {
  display: flex; justify-content: flex-end;
  border-top: 1px solid #f3f4f6; padding-top: 0.75rem;
}
.view-detail-hint {
  font-size: 0.8rem; color: #7c3aed; font-weight: 500;
  display: flex; align-items: center; gap: 0.4rem; opacity: 0.7;
  transition: opacity 0.2s;
}
.class-card:hover .view-detail-hint { opacity: 1; }

/* ========== MODAL CHI TIẾT ========== */
.modal-overlay {
  position: fixed; inset: 0; background: rgba(17,24,39,0.5);
  display: flex; align-items: center; justify-content: center;
  z-index: 9999; padding: 1rem;
  animation: fadeIn 0.15s ease-out;
}
.detail-modal {
  background: #fff; border-radius: 16px; width: 100%; max-width: 600px;
  max-height: 90vh; overflow-y: auto;
  box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
  animation: slideUp 0.2s ease-out;
}
.modal-header {
  display: flex; justify-content: space-between; align-items: flex-start;
  padding: 1.5rem 1.5rem 1rem; border-bottom: 1px solid #e5e7eb;
}
.modal-subject-code {
  font-size: 0.75rem; font-weight: 700; color: #7c3aed;
  background: #f5f3ff; padding: 0.15rem 0.5rem; border-radius: 4px;
  display: inline-block; margin-bottom: 0.5rem;
}
.modal-title { font-size: 1.5rem; font-weight: 700; color: #111827; margin: 0; }
.btn-close-modal {
  background: #f3f4f6; border: none; border-radius: 8px;
  width: 36px; height: 36px; cursor: pointer; display: flex;
  align-items: center; justify-content: center; color: #6b7280;
  flex-shrink: 0; transition: all 0.2s;
}
.btn-close-modal:hover { background: #e5e7eb; color: #111827; }

.instructor-banner {
  margin: 1rem 1.5rem; padding: 0.875rem 1rem;
  border-radius: 10px; display: flex; align-items: center;
  gap: 0.75rem; font-size: 0.9rem;
}
.banner-assigned { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; }
.banner-unassigned { background: #fef3c7; border: 1px solid #fde68a; color: #92400e; }
.instructor-email { font-weight: 400; opacity: 0.8; margin-left: 0.25rem; }

.modal-body { padding: 0 1.5rem 1rem; }
.info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.info-block {
  background: #f9fafb; border: 1px solid #f3f4f6;
  border-radius: 10px; padding: 0.875rem 1rem;
}
.info-label { font-size: 0.78rem; color: #6b7280; font-weight: 600; display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0.4rem; }
.info-value { font-size: 0.95rem; color: #111827; font-weight: 500; }

.chip { font-size: 0.75rem; font-weight: 600; padding: 0.2rem 0.6rem; border-radius: 9999px; }
.chip-active { background: #dcfce7; color: #166534; }
.chip-inactive { background: #f3f4f6; color: #6b7280; }

.modal-footer {
  padding: 1rem 1.5rem; border-top: 1px solid #e5e7eb;
  display: flex; justify-content: flex-end;
}
.btn-secondary {
  padding: 0.6rem 1.2rem; background: #fff; border: 1px solid #d1d5db;
  border-radius: 8px; color: #374151; font-weight: 500; cursor: pointer;
  display: flex; align-items: center; gap: 0.5rem; transition: all 0.2s;
}
.btn-secondary:hover { background: #f9fafb; }

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

@media (max-width: 768px) {
  .filter-grid { grid-template-columns: 1fr; gap: 1rem; }
  .info-grid { grid-template-columns: 1fr; }
}
</style>
