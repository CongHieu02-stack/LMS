<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { apiGet, apiPost } from '@/lib/api'
import { useToast } from 'primevue/usetoast'
import { useAuthStore } from '@/stores/auth'

interface ClassItem {
  id: string; code?: string; name: string; subjectName: string; subjectCode: string;
  instructor: string; schedule: string; room: string; enrolled: number; max: number; isRegistered: boolean;
  semester: string;
  credits: number;
}

const availableClasses = ref<ClassItem[]>([])
const myRegistrations = ref<string[]>([])
const registeredClassesData = ref<any[]>([])
const loading = ref(true)
const loadingId = ref<string | null>(null)
const successMessage = ref<string | null>(null)
const errorMessage = ref<string | null>(null)

const searchQuery = ref('')
const selectedStatuses = ref<string[]>([])
const hideConflicting = ref(false)

const statusOptions = [
  { value: 'registered', label: 'Đã đăng ký', icon: 'pi pi-check-circle' },
  { value: 'full', label: 'Đã đầy', icon: 'pi pi-ban' },
  { value: 'conflicting', label: 'Trùng lịch', icon: 'pi pi-exclamation-triangle' },
]

function toggleStatus(value: string) {
  const idx = selectedStatuses.value.indexOf(value)
  if (idx > -1) {
    selectedStatuses.value.splice(idx, 1)
  } else {
    selectedStatuses.value.push(value)
  }
}

const toast = useToast()
const authStore = useAuthStore()

async function loadData() {
  loading.value = true
  try {
    // Lấy lớp đã đăng ký
    const regRes = await apiGet<{ success: boolean; data: any[] }>('/classes/my-registrations')
    registeredClassesData.value = (regRes.data || []).map((r: any) => r.class).filter(Boolean)
    myRegistrations.value = registeredClassesData.value.map((c: any) => c.id)

    // Lấy tất cả lớp mở
    const classRes = await apiGet<{ success: boolean; data: any[] }>('/classes')
    const classes = classRes.data || []
    
    const isStudent = authStore.profile?.role === 'SINH_VIEN'
    const userDept = authStore.profile?.department

    availableClasses.value = (Array.isArray(classes) ? classes : [])
      .filter((c: any) => {
        const isStatusMatch = ['approved', 'APPROVED', 'open_for_reg', 'open'].includes(c.status)
        if (!isStatusMatch) return false
        if (isStudent && userDept) {
          return c.subject?.department === userDept
        }
        return true
      })
      .map((c: any) => {
        const subjectName = c.subject?.name || 'N/A'
        const subjectCode = c.subject?.code || ''
        const className = c.name || ''
        
        let displayName = className
        if (className && subjectName) {
          if (className.toLowerCase().includes(subjectName.toLowerCase())) {
            displayName = className
          } else {
            const parts = className.split(' - ')
            if (parts.length > 1) {
              const suffix = parts[parts.length - 1]
              if (suffix.toLowerCase().includes('lớp')) {
                displayName = `${subjectName} - ${suffix}`
              } else {
                displayName = `${subjectName} - ${className}`
              }
            } else {
              if (className.toUpperCase() === subjectCode.toUpperCase()) {
                displayName = subjectName
              } else {
                displayName = `${subjectName} - ${className}`
              }
            }
          }
        }

        return {
          id: c.id,
          name: displayName,
          subjectName,
          subjectCode,
          instructor: c.instructor?.fullName || c.instructor?.full_name || 'Chưa phân công',
          schedule: c.schedule || 'Chưa xếp lịch',
          room: c.room || 'Chưa xếp phòng',
          enrolled: (c.maxSlots || c.max_slots || 0) - (c.remainingSlots || c.remaining_slots || 0),
          max: c.maxSlots || c.max_slots || 0,
          isRegistered: myRegistrations.value.includes(c.id),
          semester: c.semester || 'N/A',
          credits: c.subject?.credits || 0
        }
      })
  } catch (err: any) {
    errorMessage.value = err.message
  }
  loading.value = false
}

onMounted(loadData)

const MAX_CREDITS_LIMIT = 24

function timeToMinutes(timeStr: string) {
  const [hh, mm] = timeStr.split(':').map(Number);
  return hh * 60 + mm;
}

function parseSchedule(scheduleStr: string) {
  if (!scheduleStr) return [];
  const parts = scheduleStr.split(',').map(p => p.trim());
  const sessions = [];
  for (const part of parts) {
    if (!part) continue;
    const match = part.match(/^([A-Z0-9]+)\((\d{2}:\d{2})-(\d{2}:\d{2})\)$/i);
    if (!match) continue;
    const day = match[1].toUpperCase();
    const startTime = match[2];
    const endTime = match[3];
    sessions.push({ day, startTime, endTime });
  }
  return sessions;
}

function schedulesOverlap(s1: string, s2: string) {
  if (!s1 || !s2) return false;
  const sessions1 = parseSchedule(s1);
  const sessions2 = parseSchedule(s2);
  for (const sess1 of sessions1) {
    for (const sess2 of sessions2) {
      if (sess1.day === sess2.day) {
        const m1_start = timeToMinutes(sess1.startTime);
        const m1_end = timeToMinutes(sess1.endTime);
        const m2_start = timeToMinutes(sess2.startTime);
        const m2_end = timeToMinutes(sess2.endTime);

        const [firstStart, firstEnd, secondStart, secondEnd] = m1_start <= m2_start
          ? [m1_start, m1_end, m2_start, m2_end]
          : [m2_start, m2_end, m1_start, m1_end];

        if (secondStart < firstEnd) {
          return true;
        }
      }
    }
  }
  return false;
}

const totalRegisteredCredits = computed(() => {
  return availableClasses.value
    .filter((c: ClassItem) => c.isRegistered)
    .reduce((sum: number, c: ClassItem) => sum + (c.credits || 0), 0)
})

function getConflictingClass(cls: ClassItem): any | null {
  if (cls.isRegistered) return null;
  for (const reg of registeredClassesData.value) {
    if (schedulesOverlap(cls.schedule, reg.schedule)) {
      return reg;
    }
  }
  return null;
}

function isConflicting(cls: ClassItem) {
  return !!getConflictingClass(cls);
}

function getClassStatus(cls: ClassItem): string {
  if (cls.isRegistered) return 'registered'
  if (cls.enrolled >= cls.max) return 'full'
  if (isConflicting(cls)) return 'conflicting'
  return 'open'
}

const filteredClasses = computed(() => {
  return availableClasses.value.filter((cls: ClassItem) => {
    // 1. Tìm kiếm theo từ khóa
    const query = searchQuery.value.trim().toLowerCase()
    const matchesQuery = !query || 
      cls.name.toLowerCase().includes(query) || 
      cls.subjectCode.toLowerCase().includes(query) || 
      cls.instructor.toLowerCase().includes(query)
    
    // 2. Lọc theo nhiều trạng thái cùng lúc
    const status = getClassStatus(cls)
    const matchesStatus = selectedStatuses.value.length === 0 || selectedStatuses.value.includes(status)
    
    // 3. Lọc trùng lịch học
    const matchesConflict = !hideConflicting.value || !isConflicting(cls)
    
    return matchesQuery && matchesStatus && matchesConflict
  })
})

// === GOM NHÓM THEO MÔN HỌC (ACCORDION) ===
const expandedSubjects = ref<Set<string>>(new Set())

interface SubjectGroup {
  subjectName: string
  subjectCode: string
  credits: number
  classes: ClassItem[]
  registeredCount: number
  totalCount: number
}

const groupedBySubject = computed<SubjectGroup[]>(() => {
  const map = new Map<string, ClassItem[]>()
  for (const cls of filteredClasses.value) {
    const key = cls.subjectCode || cls.subjectName
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(cls)
  }
  const groups: SubjectGroup[] = []
  for (const [key, classes] of map) {
    const first = classes[0]
    groups.push({
      subjectName: first.subjectName,
      subjectCode: first.subjectCode,
      credits: first.credits,
      classes,
      registeredCount: classes.filter(c => c.isRegistered).length,
      totalCount: classes.length,
    })
  }
  // Sắp xếp: môn có lớp đã đăng ký lên trước, sau đó theo tên
  groups.sort((a, b) => {
    if (a.registeredCount > 0 && b.registeredCount === 0) return -1
    if (a.registeredCount === 0 && b.registeredCount > 0) return 1
    return a.subjectName.localeCompare(b.subjectName, 'vi')
  })
  return groups
})

function toggleSubject(key: string) {
  if (expandedSubjects.value.has(key)) {
    expandedSubjects.value.delete(key)
  } else {
    expandedSubjects.value.add(key)
  }
  // Trigger reactivity
  expandedSubjects.value = new Set(expandedSubjects.value)
}

function expandAll() {
  expandedSubjects.value = new Set(groupedBySubject.value.map((g: SubjectGroup) => g.subjectCode || g.subjectName))
}

function collapseAll() {
  expandedSubjects.value = new Set()
}


function getCapacityPercent(enrolled: number, max: number) { return max > 0 ? (enrolled / max) * 100 : 0 }
function getProgressBarClass(enrolled: number, max: number) {
  const p = getCapacityPercent(enrolled, max)
  if (p >= 100) return 'bar-full'
  if (p >= 80) return 'bar-warning'
  return 'bar-safe'
}

async function handleRegister(cls: ClassItem) {
  if (cls.enrolled >= cls.max) return
  loadingId.value = cls.id
  try {
    const res = await apiPost<{ success: boolean; message?: string; error?: string }>('/classes/register', { classId: cls.id })
    if (res.success) {
      cls.enrolled += 1
      cls.isRegistered = true
      toast.add({
        severity: 'success',
        summary: 'Đăng ký thành công',
        detail: `Đăng ký thành công lớp ${cls.subjectCode} - ${cls.name}!`,
        life: 4000
      })
    } else {
      toast.add({
        severity: 'error',
        summary: 'Lỗi đăng ký',
        detail: res.error || 'Không thể đăng ký.',
        life: 5000
      })
    }
  } catch (err: any) {
    toast.add({
      severity: 'error',
      summary: 'Lỗi đăng ký',
      detail: err.message || 'Đã xảy ra lỗi khi đăng ký.',
      life: 5000
    })
  }
  loadingId.value = null
}
</script>

<template>
  <div class="mono-wrapper">
    <div class="page-header">
      <div>
        <div class="breadcrumb">Học vụ / <span>Đăng ký lớp học</span></div>
        <h1 class="page-title">Đăng ký Lớp học</h1>
        <div class="page-subtitle">Chọn lớp và đăng ký nhanh để giữ chỗ trong học kỳ này.</div>
      </div>
      <!-- Widget Thống kê Tín chỉ Học kỳ -->
      <div class="credit-stats-card">
        <div class="stats-label">Tín chỉ học kỳ này</div>
        <div class="stats-value">
          <span class="current-credits">{{ totalRegisteredCredits }}</span>
          <span class="max-credits">/ {{ MAX_CREDITS_LIMIT }} TC</span>
        </div>
        <div class="stats-progress-bg">
          <div class="stats-progress-fill" 
               :style="{ width: Math.min((totalRegisteredCredits / MAX_CREDITS_LIMIT) * 100, 100) + '%' }" 
               :class="{ 'progress-full': totalRegisteredCredits >= MAX_CREDITS_LIMIT, 'progress-warning': totalRegisteredCredits >= 18 && totalRegisteredCredits < MAX_CREDITS_LIMIT }">
          </div>
        </div>
      </div>
    </div>

    <div v-if="successMessage" class="mono-alert alert-success"><i class="pi pi-check-circle"></i><div><strong>THÀNH CÔNG:</strong> {{ successMessage }}</div></div>
    <div v-if="errorMessage" class="mono-alert alert-error"><i class="pi pi-times-circle"></i><div>{{ errorMessage }}</div></div>

    <div v-if="loading" class="loading-center"><i class="pi pi-spin pi-spinner" style="font-size:2rem;color:#6b7280"></i><div>Đang tải danh sách lớp...</div></div>

    <template v-else>
      <!-- Thanh Bộ lọc & Tìm kiếm -->
      <div v-if="availableClasses.length > 0" class="filter-bar-card">
        <div class="search-input-wrapper">
          <i class="pi pi-search search-icon"></i>
          <input v-model="searchQuery" type="text" placeholder="Tìm tên môn học, mã môn học, giảng viên..." class="filter-input search-input" />
        </div>
        
        <div class="filter-controls">
          <div class="status-pills">
            <button 
              type="button"
              class="status-pill"
              :class="{ 'pill-active': selectedStatuses.length === 0 }"
              @click="selectedStatuses = []"
            >
              <i class="pi pi-th-large"></i>
              <span>Tất cả</span>
            </button>
            <button 
              v-for="opt in statusOptions" 
              :key="opt.value" 
              type="button"
              class="status-pill"
              :class="{ 'pill-active': selectedStatuses.includes(opt.value) }"
              @click="toggleStatus(opt.value)"
            >
              <i :class="opt.icon"></i>
              <span>{{ opt.label }}</span>
            </button>
          </div>
          
          <label class="toggle-container">
            <input v-model="hideConflicting" type="checkbox" class="toggle-checkbox" />
            <span class="toggle-slider"></span>
            <span class="toggle-label">Ẩn lớp trùng lịch</span>
          </label>
        </div>
      </div>

      <!-- Hiển thị danh sách lớp -->
      <div v-if="availableClasses.length === 0" class="empty-state">
        <i class="pi pi-inbox" style="font-size:3rem;color:#9ca3af"></i>
        <h3>Chưa có lớp nào mở đăng ký</h3>
        <p>Vui lòng quay lại sau khi Phòng đào tạo mở lớp.</p>
      </div>

      <div v-else-if="filteredClasses.length === 0" class="empty-state">
        <i class="pi pi-search" style="font-size:3rem;color:#9ca3af"></i>
        <h3>Không tìm thấy lớp học phù hợp</h3>
        <p>Thử thay đổi từ khóa tìm kiếm hoặc tắt tùy chọn lọc trùng lịch học.</p>
      </div>

      <template v-else>
        <!-- Nút Mở rộng / Thu gọn tất cả -->
        <div class="accordion-toolbar">
          <span class="accordion-summary">
            <i class="pi pi-list"></i>
            {{ groupedBySubject.length }} môn học · {{ filteredClasses.length }} lớp
          </span>
          <div class="accordion-actions">
            <button class="btn-text" @click="expandAll">
              <i class="pi pi-angle-double-down"></i> Mở tất cả
            </button>
            <button class="btn-text" @click="collapseAll">
              <i class="pi pi-angle-double-up"></i> Thu gọn
            </button>
          </div>
        </div>

        <!-- Accordion: Gom nhóm theo môn học -->
        <div class="subject-accordion">
          <div 
            v-for="group in groupedBySubject" 
            :key="group.subjectCode || group.subjectName" 
            class="accordion-panel" 
            :class="{ 'panel-has-registered': group.registeredCount > 0 }"
          >
            <!-- Header của Accordion -->
            <button 
              class="accordion-header" 
              @click="toggleSubject(group.subjectCode || group.subjectName)"
              :class="{ 'header-expanded': expandedSubjects.has(group.subjectCode || group.subjectName) }"
            >
              <div class="accordion-header-left">
                <i 
                  class="pi accordion-chevron" 
                  :class="expandedSubjects.has(group.subjectCode || group.subjectName) ? 'pi-chevron-down' : 'pi-chevron-right'"
                ></i>
                <span class="accordion-subject-code">{{ group.subjectCode }}</span>
                <span class="accordion-subject-name">{{ group.subjectName }}</span>
              </div>
              <div class="accordion-header-right">
                <span class="accordion-credits">
                  <i class="pi pi-book"></i> {{ group.credits }} TC
                </span>
                <span v-if="group.registeredCount > 0" class="accordion-badge badge-registered-count">
                  <i class="pi pi-check"></i> Đã đăng ký
                </span>
                <span class="accordion-badge badge-class-count">
                  {{ group.totalCount }} lớp
                </span>
              </div>
            </button>

            <!-- Body của Accordion (danh sách lớp) -->
            <transition name="accordion-slide">
              <div 
                v-if="expandedSubjects.has(group.subjectCode || group.subjectName)" 
                class="accordion-body"
              >
                <div class="class-grid">
                  <div 
                    v-for="cls in group.classes" 
                    :key="cls.id" 
                    class="mono-card class-card" 
                    :class="{ 'card-registered': cls.isRegistered }"
                  >
                    <div class="card-header">
                      <span class="class-code">{{ cls.subjectCode }}</span>
                      <span v-if="cls.isRegistered" class="status-badge badge-registered">Đã đăng ký</span>
                      <span v-else-if="cls.enrolled >= cls.max" class="status-badge badge-full">Đã đầy</span>
                      <span v-else-if="isConflicting(cls)" class="status-badge badge-conflict">Trùng lịch</span>
                      <span v-else class="status-badge badge-open">Mở đăng ký</span>
                    </div>
                    <div class="card-body">
                      <h3 class="subject-name">{{ cls.name }}</h3>
                      <div class="info-row"><i class="pi pi-book"></i><span>Số tín chỉ: <strong>{{ cls.credits }}</strong></span></div>
                      <div class="info-row"><i class="pi pi-user"></i><span>{{ cls.instructor }}</span></div>
                      <div class="info-row"><i class="pi pi-calendar"></i><span>{{ cls.schedule }}</span></div>
                      <div class="info-row"><i class="pi pi-map-marker"></i><span>{{ cls.room }}</span></div>
                      <div class="info-row"><i class="pi pi-bookmark"></i><span>Học kỳ: {{ cls.semester }}</span></div>
                      
                      <!-- Chi tiết lịch trùng -->
                      <div v-if="isConflicting(cls)" class="conflict-detail-box">
                        <i class="pi pi-exclamation-triangle"></i>
                        <div class="conflict-detail-text">
                          Trùng lịch với: <strong>{{ getConflictingClass(cls)?.subjectCode ? getConflictingClass(cls)?.subjectCode + ' - ' + getConflictingClass(cls)?.name : getConflictingClass(cls)?.name }}</strong>
                          <div class="conflict-time">Lịch: {{ getConflictingClass(cls)?.schedule }}</div>
                        </div>
                      </div>

                      <div class="capacity-section">
                        <div class="capacity-labels"><span class="capacity-title">Sĩ số</span><span><strong>{{ cls.enrolled }}</strong> / {{ cls.max }}</span></div>
                        <div class="progress-bg"><div class="progress-fill" :class="getProgressBarClass(cls.enrolled, cls.max)" :style="{ width: getCapacityPercent(cls.enrolled, cls.max) + '%' }"></div></div>
                      </div>
                    </div>
                    <div class="card-footer">
                      <button v-if="!cls.isRegistered" 
                              class="btn-submit w-full" 
                              :disabled="cls.enrolled >= cls.max || isConflicting(cls) || totalRegisteredCredits + cls.credits > MAX_CREDITS_LIMIT || loadingId === cls.id" 
                              @click="handleRegister(cls)">
                        <i v-if="loadingId === cls.id" class="pi pi-spin pi-spinner"></i>
                        <i v-else-if="cls.enrolled >= cls.max" class="pi pi-ban"></i>
                        <i v-else-if="isConflicting(cls)" class="pi pi-exclamation-triangle"></i>
                        <i v-else-if="totalRegisteredCredits + cls.credits > MAX_CREDITS_LIMIT" class="pi pi-ban"></i>
                        <i v-else class="pi pi-bolt"></i>
                        
                        <span v-if="cls.enrolled >= cls.max">Hết chỗ</span>
                        <span v-else-if="isConflicting(cls)">Trùng lịch học</span>
                        <span v-else-if="totalRegisteredCredits + cls.credits > MAX_CREDITS_LIMIT">Vượt giới hạn TC</span>
                        <span v-else>Đăng ký ngay</span>
                      </button>
                      <div v-else class="registered-label"><i class="pi pi-check"></i> Đã đăng ký thành công</div>
                    </div>
                  </div>
                </div>
              </div>
            </transition>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped>
.mono-wrapper { display: flex; flex-direction: column; padding: 1.5rem 2rem; animation: fadeIn 0.3s ease-out; }
.page-header { margin-bottom: 2rem; border-bottom: 1px solid #e5e7eb; padding-bottom: 1rem; display: flex; justify-content: space-between; align-items: flex-end; }
.breadcrumb { font-size: 0.8rem; color: #6b7280; font-weight: 500; margin-bottom: 0.5rem; }
.breadcrumb span { color: #111827; font-weight: 600; }
.page-title { font-size: 1.75rem; font-weight: 600; margin: 0 0 0.5rem 0; color: #111827; }
.page-subtitle { font-size: 0.875rem; color: #6b7280; }
.mono-alert { display: flex; align-items: center; gap: 1rem; padding: 1rem 1.5rem; border-radius: 8px; font-size: 0.875rem; margin-bottom: 1.5rem; }
.alert-success { background-color: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; }
.alert-error { background-color: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }
.loading-center { display: flex; flex-direction: column; align-items: center; gap: 1rem; padding: 4rem; color: #6b7280; }
.empty-state { text-align: center; padding: 4rem; color: #6b7280; }
.empty-state h3 { margin: 1rem 0 0.5rem; color: #111827; }
.class-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1.5rem; }
.mono-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); display: flex; flex-direction: column; transition: all 0.2s; }
.mono-card:hover { box-shadow: 0 10px 15px -3px rgba(0,0,0,0.08); transform: translateY(-2px); }
.card-registered { border-color: #bbf7d0; background: #f0fdf4; }
.card-header { padding: 1rem 1.25rem; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; background: #f9fafb; border-radius: 12px 12px 0 0; }
.card-registered .card-header { background: #dcfce7; border-bottom-color: #bbf7d0; }
.class-code { font-weight: 600; color: #111827; font-family: monospace; font-size: 1.05rem; }
.status-badge { font-size: 0.7rem; font-weight: 600; padding: 0.25rem 0.6rem; border-radius: 9999px; }
.badge-open { background: #dbeafe; color: #1e40af; }
.badge-full { background: #fee2e2; color: #991b1b; }
.badge-registered { background: #166534; color: #fff; }
.card-body { padding: 1.25rem; display: flex; flex-direction: column; gap: 0.75rem; flex-grow: 1; }
.subject-name { font-size: 1.1rem; font-weight: 600; color: #111827; margin: 0 0 0.5rem 0; }
.info-row { display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; color: #4b5563; }
.info-row i { color: #9ca3af; }
.capacity-section { margin-top: 1rem; }
.capacity-labels { display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 0.4rem; color: #111827; }
.capacity-title { color: #6b7280; font-weight: 500; }
.progress-bg { height: 8px; background: #e5e7eb; border-radius: 9999px; overflow: hidden; }
.progress-fill { height: 100%; border-radius: 9999px; transition: width 0.5s ease-out; }
.bar-safe { background: #22c55e; } .bar-warning { background: #f59e0b; } .bar-full { background: #ef4444; }
.card-footer { padding: 1.25rem; border-top: 1px solid #e5e7eb; }
.card-registered .card-footer { border-top-color: #bbf7d0; }
.w-full { width: 100%; }
.btn-submit { padding: 0.75rem; border: 1px solid #111827; background: #111827; color: #fff; border-radius: 8px; font-weight: 500; font-size: 0.9rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.5rem; transition: all 0.2s; width: 100%; }
.btn-submit:hover:not(:disabled) { background: #374151; }
.btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }
.registered-label { text-align: center; color: #166534; font-weight: 600; font-size: 0.9rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

.credit-stats-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 0.75rem 1.25rem; min-width: 200px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); display: flex; flex-direction: column; gap: 0.25rem; }
.stats-label { font-size: 0.75rem; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
.stats-value { font-size: 1.5rem; font-weight: 700; color: #111827; display: flex; align-items: baseline; gap: 0.25rem; }
.max-credits { font-size: 0.875rem; color: #9ca3af; font-weight: 500; }
.stats-progress-bg { height: 6px; background: #e5e7eb; border-radius: 9999px; overflow: hidden; margin-top: 0.25rem; }
.stats-progress-fill { height: 100%; background: #3b82f6; border-radius: 9999px; transition: width 0.3s ease; }
.stats-progress-fill.progress-warning { background: #f59e0b; }
.stats-progress-fill.progress-full { background: #ef4444; }
.badge-conflict { background: #fee2e2; color: #dc2626; border: 1px solid #fca5a5; }

.filter-bar-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 1rem 1.25rem; margin-bottom: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05); display: flex; flex-wrap: wrap; gap: 1rem; align-items: center; justify-content: space-between; }
.search-input-wrapper { position: relative; flex: 1; min-width: 280px; }
.search-icon { position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); color: #9ca3af; }
.filter-input { width: 100%; padding: 0.625rem 0.75rem 0.625rem 2.25rem; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.875rem; outline: none; transition: all 0.2s; }
.filter-input:focus { border-color: #111827; box-shadow: 0 0 0 2px rgba(17,24,39,0.05); }
.filter-controls { display: flex; align-items: center; gap: 1.5rem; flex-wrap: wrap; }
.status-pills { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.status-pill { padding: 0.5rem 0.875rem; border-radius: 9999px; border: 1px solid #e5e7eb; background: #fff; color: #4b5563; font-size: 0.825rem; font-weight: 500; cursor: pointer; display: flex; align-items: center; gap: 0.375rem; transition: all 0.15s ease; user-select: none; outline: none; }
.status-pill:hover { background: #f9fafb; border-color: #d1d5db; color: #111827; }
.status-pill.pill-active { background: #111827; border-color: #111827; color: #fff; }
.toggle-container { display: flex; align-items: center; gap: 0.5rem; cursor: pointer; user-select: none; }
.toggle-checkbox { position: absolute; opacity: 0; width: 0; height: 0; }
.toggle-slider { position: relative; display: inline-block; width: 36px; height: 20px; background-color: #e5e7eb; border-radius: 9999px; transition: background-color 0.2s; }
.toggle-slider::before { position: absolute; content: ""; height: 16px; width: 16px; left: 2px; bottom: 2px; background-color: white; border-radius: 50%; transition: transform 0.2s; }
.toggle-checkbox:checked + .toggle-slider { background-color: #111827; }
.toggle-checkbox:checked + .toggle-slider::before { transform: translateX(16px); }
.toggle-label { font-size: 0.875rem; font-weight: 500; color: #374151; }

/* === ACCORDION STYLES === */
.accordion-toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; padding: 0.5rem 0; }
.accordion-summary { font-size: 0.875rem; color: #6b7280; font-weight: 500; display: flex; align-items: center; gap: 0.5rem; }
.accordion-summary i { color: #9ca3af; }
.accordion-actions { display: flex; gap: 0.5rem; }
.btn-text { background: none; border: 1px solid #e5e7eb; border-radius: 8px; padding: 0.4rem 0.75rem; font-size: 0.8rem; color: #4b5563; cursor: pointer; display: flex; align-items: center; gap: 0.35rem; transition: all 0.15s ease; font-weight: 500; }
.btn-text:hover { background: #f3f4f6; border-color: #d1d5db; color: #111827; }

.subject-accordion { display: flex; flex-direction: column; gap: 0.75rem; }

.accordion-panel { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.04); transition: box-shadow 0.2s ease; }
.accordion-panel:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.06); }
.accordion-panel.panel-has-registered { border-color: #bbf7d0; }

.accordion-header { width: 100%; background: #f9fafb; border: none; padding: 1rem 1.25rem; cursor: pointer; display: flex; justify-content: space-between; align-items: center; gap: 1rem; transition: all 0.15s ease; outline: none; }
.accordion-header:hover { background: #f3f4f6; }
.accordion-header.header-expanded { background: #f3f4f6; border-bottom: 1px solid #e5e7eb; }
.panel-has-registered .accordion-header { background: #f0fdf4; }
.panel-has-registered .accordion-header:hover { background: #dcfce7; }
.panel-has-registered .accordion-header.header-expanded { background: #dcfce7; border-bottom-color: #bbf7d0; }

.accordion-header-left { display: flex; align-items: center; gap: 0.75rem; }
.accordion-chevron { font-size: 0.85rem; color: #9ca3af; transition: transform 0.2s ease; }
.accordion-subject-code { font-family: monospace; font-weight: 700; font-size: 0.95rem; color: #111827; background: #e5e7eb; padding: 0.2rem 0.6rem; border-radius: 6px; }
.panel-has-registered .accordion-subject-code { background: #bbf7d0; color: #166534; }
.accordion-subject-name { font-weight: 600; font-size: 0.95rem; color: #374151; }

.accordion-header-right { display: flex; align-items: center; gap: 0.625rem; flex-shrink: 0; }
.accordion-credits { font-size: 0.8rem; color: #6b7280; display: flex; align-items: center; gap: 0.25rem; font-weight: 500; }
.accordion-credits i { font-size: 0.75rem; }
.accordion-badge { font-size: 0.7rem; font-weight: 600; padding: 0.2rem 0.55rem; border-radius: 9999px; }
.badge-class-count { background: #e5e7eb; color: #4b5563; }
.badge-registered-count { background: #166534; color: #fff; }

.accordion-body { padding: 1.25rem; background: #fafafa; }
.accordion-body .class-grid { gap: 1rem; }

/* Accordion transition */
.accordion-slide-enter-active { animation: accordionOpen 0.25s ease-out; }
.accordion-slide-leave-active { animation: accordionClose 0.2s ease-in; }
@keyframes accordionOpen { from { opacity: 0; max-height: 0; transform: translateY(-8px); } to { opacity: 1; max-height: 2000px; transform: translateY(0); } }
@keyframes accordionClose { from { opacity: 1; max-height: 2000px; } to { opacity: 0; max-height: 0; } }

/* Conflict Detail Alert Box */
.conflict-detail-box {
  display: flex;
  align-items: flex-start;
  gap: 0.625rem;
  font-size: 0.8rem;
  color: #b91c1c; /* Red 700 */
  background: #fef2f2; /* Red 50 */
  border: 1px solid #fecaca; /* Red 200 */
  padding: 0.625rem 0.75rem;
  border-radius: 8px;
  margin-top: 0.5rem;
}
.conflict-detail-box i {
  color: #dc2626; /* Red 600 */
  font-size: 0.9rem;
  margin-top: 0.1rem;
}
.conflict-detail-text {
  line-height: 1.35;
}
.conflict-time {
  font-size: 0.75rem;
  color: #7f1d1d; /* Red 900 */
  margin-top: 0.15rem;
  font-weight: 500;
}
</style>
