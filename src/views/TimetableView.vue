<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { apiGet } from '@/lib/api'
import html2pdf from 'html2pdf.js'

// ─── Types ───
interface SessionItem {
  day: string
  startTime: string
  endTime: string
}

interface TimetableClass {
  classId: string
  className: string
  subjectCode: string
  subjectName: string
  credits: number
  schedule: string
  sessions: SessionItem[]
  room: string
  semester: string
  startDate: string | null
  endDate: string | null
  instructor?: { id: string; fullName: string; email: string } | null
  enrolledCount?: number
}

// ─── State ───
const loading = ref(true)
const errMsg = ref<string | null>(null)
const role = ref('')
const classes = ref<TimetableClass[]>([])
const viewMode = ref<'grid' | 'list'>('grid')
const timetableRef = ref<HTMLElement | null>(null)
const exportingPdf = ref(false)

// ─── Responsive ───
const windowWidth = ref(window.innerWidth)
function onResize() { windowWidth.value = window.innerWidth }
onMounted(() => window.addEventListener('resize', onResize))
onUnmounted(() => window.removeEventListener('resize', onResize))
const isMobile = computed(() => windowWidth.value < 768)
const effectiveView = computed(() => isMobile.value ? 'list' : viewMode.value)

// ─── Constants ───
const DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'] as const
const DAY_LABELS: Record<string, string> = {
  T2: 'Thứ 2', T3: 'Thứ 3', T4: 'Thứ 4',
  T5: 'Thứ 5', T6: 'Thứ 6', T7: 'Thứ 7', CN: 'Chủ nhật'
}
const START_HOUR = 7
const END_HOUR = 21
const SLOT_HEIGHT = 60 // px per hour

// ─── Color palette ───
const COLORS = [
  { bg: '#ede9fe', border: '#8b5cf6', text: '#5b21b6' },
  { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' },
  { bg: '#d1fae5', border: '#10b981', text: '#065f46' },
  { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
  { bg: '#fce7f3', border: '#ec4899', text: '#9d174d' },
  { bg: '#e0e7ff', border: '#6366f1', text: '#3730a3' },
  { bg: '#ccfbf1', border: '#14b8a6', text: '#134e4a' },
  { bg: '#fee2e2', border: '#ef4444', text: '#991b1b' },
  { bg: '#f3e8ff', border: '#a855f7', text: '#6b21a8' },
  { bg: '#cffafe', border: '#06b6d4', text: '#155e75' },
]

function getColorForSubject(subjectCode: string) {
  let hash = 0
  for (let i = 0; i < subjectCode.length; i++) {
    hash = subjectCode.charCodeAt(i) + ((hash << 5) - hash)
  }
  return COLORS[Math.abs(hash) % COLORS.length]
}

// ─── Time helpers ───
function timeToMinutes(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function todayDayCode() {
  const jsDay = new Date().getDay() // 0=Sun
  const map: Record<number, string> = { 0: 'CN', 1: 'T2', 2: 'T3', 3: 'T4', 4: 'T5', 5: 'T6', 6: 'T7' }
  return map[jsDay]
}

// ─── Grid blocks ───
interface GridBlock {
  cls: TimetableClass
  session: SessionItem
  color: ReturnType<typeof getColorForSubject>
  topPx: number
  heightPx: number
}

interface VisualBlock extends GridBlock {
  left: string
  width: string
}

// ─── Overlap Layout Algorithm ───
function computeDayLayout(blocks: GridBlock[]): VisualBlock[] {
  if (blocks.length === 0) return []
  
  // Sort blocks by start time (topPx)
  const sorted = [...blocks].sort((a, b) => a.topPx - b.topPx)
  
  // Group overlapping events together (connected components)
  const groups: GridBlock[][] = []
  let currentGroup: GridBlock[] = []
  let groupEnd = 0
  
  for (const block of sorted) {
    const blockEnd = block.topPx + block.heightPx
    if (currentGroup.length === 0) {
      currentGroup.push(block)
      groupEnd = blockEnd
    } else if (block.topPx < groupEnd) {
      currentGroup.push(block)
      groupEnd = Math.max(groupEnd, blockEnd)
    } else {
      groups.push(currentGroup)
      currentGroup = [block]
      groupEnd = blockEnd
    }
  }
  if (currentGroup.length > 0) {
    groups.push(currentGroup)
  }
  
  const visualBlocks: VisualBlock[] = []
  
  // Distribute into columns
  for (const group of groups) {
    const columns: GridBlock[][] = []
    
    for (const block of group) {
      let placed = false
      for (let i = 0; i < columns.length; i++) {
        const lastInCol = columns[i][columns[i].length - 1]
        if (block.topPx >= lastInCol.topPx + lastInCol.heightPx) {
          columns[i].push(block)
          placed = true
          break
        }
      }
      if (!placed) {
        columns.push([block])
      }
    }
    
    const colCount = columns.length
    for (let colIndex = 0; colIndex < colCount; colIndex++) {
      const colWidth = 100 / colCount
      const colLeft = colIndex * colWidth
      for (const block of columns[colIndex]) {
        visualBlocks.push({
          ...block,
          left: `${colLeft}%`,
          width: `${colWidth}%`
        })
      }
    }
  }
  
  return visualBlocks
}

// ─── Week navigation state ───
const currentDate = ref(new Date())

function getMonday(d: Date) {
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(d.setDate(diff))
  monday.setHours(0, 0, 0, 0)
  return monday
}

const currentMonday = computed(() => getMonday(new Date(currentDate.value)))

const weekDays = computed(() => {
  const start = currentMonday.value
  const days: { dayCode: typeof DAYS[number]; date: Date; dateStr: string; label: string }[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const dayCode = DAYS[i]
    const dateStr = d.toISOString().split('T')[0]
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const label = `${DAY_LABELS[dayCode]} (${dd}/${mm})`
    days.push({ dayCode, date: d, dateStr, label })
  }
  return days
})

function prevWeek() {
  const newDate = new Date(currentDate.value)
  newDate.setDate(newDate.getDate() - 7)
  currentDate.value = newDate
}

function nextWeek() {
  const newDate = new Date(currentDate.value)
  newDate.setDate(newDate.getDate() + 7)
  currentDate.value = newDate
}

function goToday() {
  currentDate.value = new Date()
}

function formatWeekRange(monday: Date) {
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const format = (d: Date) => {
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const yyyy = d.getFullYear()
    return `${dd}/${mm}/${yyyy}`
  }
  return `${format(monday)} - ${format(sunday)}`
}

function onDateInput(e: Event) {
  const val = (e.target as HTMLInputElement).value
  if (val) {
    currentDate.value = new Date(val)
  }
}

function isCurrentWeek(date: Date) {
  const todayDate = new Date()
  return date.getDate() === todayDate.getDate() &&
         date.getMonth() === todayDate.getMonth() &&
         date.getFullYear() === todayDate.getFullYear()
}

function formatDateDDMM(d: Date) {
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}`
}

function isSessionActiveOnDate(date: Date, startDateStr: string | null, endDateStr: string | null) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  
  if (startDateStr) {
    const start = new Date(startDateStr)
    start.setHours(0, 0, 0, 0)
    if (d < start) return false
  }
  
  if (endDateStr) {
    const end = new Date(endDateStr)
    end.setHours(0, 0, 0, 0)
    if (d > end) return false
  }
  
  return true
}

// ─── Grid blocks ───
const gridBlocks = computed(() => {
  const rawBlocks: Record<string, GridBlock[]> = {}
  for (const day of DAYS) rawBlocks[day] = []

  const dayDates = weekDays.value.reduce((acc: Record<string, Date>, wd: any) => {
    acc[wd.dayCode] = wd.date
    return acc
  }, {} as Record<string, Date>)

  for (const cls of classes.value) {
    const color = getColorForSubject(cls.subjectCode)
    for (const session of cls.sessions) {
      const sessionDate = dayDates[session.day]
      if (!sessionDate) continue
      if (!isSessionActiveOnDate(sessionDate, cls.startDate, cls.endDate)) {
        continue
      }

      const startMin = timeToMinutes(session.startTime)
      const endMin = timeToMinutes(session.endTime)
      const topPx = ((startMin - START_HOUR * 60) / 60) * SLOT_HEIGHT
      const heightPx = ((endMin - startMin) / 60) * SLOT_HEIGHT
      if (rawBlocks[session.day]) {
        rawBlocks[session.day].push({ cls, session, color, topPx, heightPx })
      }
    }
  }

  const blocksWithLayout: Record<string, VisualBlock[]> = {}
  for (const day of DAYS) {
    blocksWithLayout[day] = computeDayLayout(rawBlocks[day])
  }
  return blocksWithLayout
})

// ─── List view: group by day ───
const listByDay = computed(() => {
  const result: { day: string; label: string; dateLabel: string; items: { cls: TimetableClass; session: SessionItem; color: ReturnType<typeof getColorForSubject>; type: string; periods: string }[] }[] = []
  for (const wd of weekDays.value) {
    const items: typeof result[0]['items'] = []
    for (const cls of classes.value) {
      const color = getColorForSubject(cls.subjectCode)
      for (const session of cls.sessions) {
        if (session.day === wd.dayCode) {
          if (isSessionActiveOnDate(wd.date, cls.startDate, cls.endDate)) {
            const type = getClassType(cls.subjectName, cls.className)
            const periods = getTimePeriods(session.startTime, session.endTime)
            items.push({ cls, session, color, type, periods })
          }
        }
      }
    }
    if (items.length > 0) {
      items.sort((a, b) => a.session.startTime.localeCompare(b.session.startTime))
      result.push({
        day: wd.dayCode,
        label: DAY_LABELS[wd.dayCode],
        dateLabel: wd.label,
        items
      })
    }
  }
  return result
})

// ─── Today highlight ───
const today = todayDayCode()

function getClassType(subjectName: string, className: string): 'study' | 'exam' {
  const name = (subjectName + ' ' + className).toLowerCase()
  const words = name.split(/[\s,.\-\/()]+/)
  
  // Phân loại là lịch thi nếu chứa từ đứng độc lập "thi" hoặc các từ khóa thi cử cụ thể
  if (
    words.includes('thi') || 
    name.includes('kiểm tra giữa kỳ') || 
    name.includes('kiểm tra cuối kỳ') || 
    name.includes('final exam') || 
    name.includes('midterm exam')
  ) {
    return 'exam'
  }
  return 'study'
}

function getSessionShift(startTime: string): 'Sáng' | 'Chiều' | 'Tối' {
  const hour = Number(startTime.split(':')[0])
  if (hour < 12) return 'Sáng'
  if (hour < 18) return 'Chiều'
  return 'Tối'
}

function getTimePeriods(startTime: string, endTime: string): string {
  const parse = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
  }
  const startMin = parse(startTime)
  const endMin = parse(endTime)
  
  let startPeriod = 1
  if (startMin <= 7 * 60 + 15) startPeriod = 1
  else if (startMin <= 8 * 60 + 10) startPeriod = 2
  else if (startMin <= 9 * 60 + 5) startPeriod = 3
  else if (startMin <= 10 * 60) startPeriod = 4
  else if (startMin <= 11 * 60) startPeriod = 5
  else if (startMin <= 12 * 60 + 30) startPeriod = 7
  else if (startMin <= 13 * 60 + 30) startPeriod = 8
  else if (startMin <= 14 * 60 + 30) startPeriod = 9
  else if (startMin <= 15 * 60 + 30) startPeriod = 10
  else if (startMin <= 16 * 60 + 30) startPeriod = 11
  else if (startMin <= 17 * 60 + 30) startPeriod = 12
  else startPeriod = 13
  
  let endPeriod = startPeriod
  if (endMin <= 7 * 60 + 35) endPeriod = 1
  else if (endMin <= 8 * 60 + 25) endPeriod = 2
  else if (endMin <= 9 * 60 + 15) endPeriod = 3
  else if (endMin <= 10 * 60 + 15) endPeriod = 4
  else if (endMin <= 11 * 60 + 15) endPeriod = 5
  else if (endMin <= 12 * 60 + 15) endPeriod = 6
  else if (endMin <= 13 * 60 + 15) endPeriod = 7
  else if (endMin <= 14 * 60 + 15) endPeriod = 8
  else if (endMin <= 15 * 60 + 15) endPeriod = 9
  else if (endMin <= 16 * 60 + 15) endPeriod = 10
  else if (endMin <= 17 * 60 + 15) endPeriod = 11
  else if (endMin <= 18 * 60 + 15) endPeriod = 12
  else endPeriod = 13
  
  if (startPeriod === endPeriod) return `Tiết: ${startPeriod}`
  return `Tiết: ${startPeriod} - ${endPeriod}`
}

function getShiftBlocks(dayCode: string, shift: 'Sáng' | 'Chiều' | 'Tối') {
  const blocks = gridBlocks.value[dayCode] || []
  return blocks
    .map((block: any) => {
      const startTime = block.session.startTime
      const s = getSessionShift(startTime)
      const type = getClassType(block.cls.subjectName, block.cls.className)
      const periods = getTimePeriods(startTime, block.session.endTime)
      return {
        ...block,
        shift: s,
        type,
        periods
      }
    })
    .filter((b: any) => b.shift === shift)
}

function formatDateDDMMYYYY(d: Date) {
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

// ─── Fetch data ───
async function loadTimetable() {
  loading.value = true
  errMsg.value = null
  try {
    const res = await apiGet<{
      success: boolean
      role: string
      data: TimetableClass[]
    }>('/timetable/me')
    role.value = res.role
    
    classes.value = (res.data || []).map((c: any) => {
      const subjectName = c.subjectName || ''
      const subjectCode = c.subjectCode || ''
      const className = c.className || ''
      
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
        ...c,
        className: displayName
      }
    })
  } catch (err: any) {
    errMsg.value = err.message
  }
  loading.value = false
}

onMounted(loadTimetable)

// ─── Export PDF ───
async function exportPDF() {
  if (!timetableRef.value) return
  exportingPdf.value = true
  try {
    const opt = {
      margin: [10, 10, 10, 10] as [number, number, number, number],
      filename: `thoi-khoa-bieu-${new Date().toISOString().split('T')[0]}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' as const }
    }
    await html2pdf().set(opt).from(timetableRef.value).save()
  } catch (e) {
    console.error('PDF export error:', e)
  }
  exportingPdf.value = false
}

// ─── Hour labels ───
const hourLabels = computed(() => {
  const labels = []
  for (let h = START_HOUR; h <= END_HOUR; h++) {
    labels.push(`${String(h).padStart(2, '0')}:00`)
  }
  return labels
})

// ─── Total classes + credits ───
const totalCredits = computed(() => classes.value.reduce((sum: number, c: TimetableClass) => sum + (c.credits || 0), 0))

const isAdminView = computed(() => !['SINH_VIEN', 'GIANG_VIEN', 'TRUONG_BO_MON'].includes(role.value))
</script>

<template>
  <div class="tt-wrapper">
    <!-- Header -->
    <div class="tt-header">
      <div>
        <div class="breadcrumb">Học tập / <span>{{ role === 'GIANG_VIEN' ? 'Lịch giảng dạy' : 'Thời khoá biểu' }}</span></div>
        <h1 class="tt-title">{{ role === 'GIANG_VIEN' ? 'Lịch Giảng Dạy' : 'Thời Khoá Biểu' }}</h1>
        <p class="tt-subtitle" v-if="role === 'SINH_VIEN'">Lịch học cá nhân của bạn dựa trên các lớp đã đăng ký.</p>
        <p class="tt-subtitle" v-else-if="isAdminView">Tổng quan lịch giảng dạy & học tập toàn bộ lớp học trong hệ thống.</p>
        <p class="tt-subtitle" v-else>Lịch giảng dạy của bạn dựa trên các lớp được phân công.</p>
      </div>
      <div class="tt-actions" v-if="!loading">
        <div class="view-toggle" v-if="!isMobile">
          <button :class="{ active: viewMode === 'grid' }" @click="viewMode = 'grid'" title="Xem dạng lưới">
            <i class="pi pi-th-large"></i>
          </button>
          <button :class="{ active: viewMode === 'list' }" @click="viewMode = 'list'" title="Xem dạng danh sách">
            <i class="pi pi-list"></i>
          </button>
        </div>
        <button class="btn-pdf" @click="exportPDF" :disabled="exportingPdf || classes.length === 0">
          <i v-if="exportingPdf" class="pi pi-spin pi-spinner"></i>
          <i v-else class="pi pi-file-pdf"></i> Xuất PDF
        </button>
      </div>
    </div>

    <!-- Week Navigation Bar -->
    <div class="week-navigator-bar" v-if="!loading && classes.length > 0">
      <div class="nav-controls">
        <button class="nav-btn" @click="prevWeek" title="Tuần trước">
          <i class="pi pi-chevron-left"></i>
        </button>
        <button class="nav-today-btn" @click="goToday">
          <i class="pi pi-calendar"></i> Tuần này
        </button>
        <button class="nav-btn" @click="nextWeek" title="Tuần sau">
          <i class="pi pi-chevron-right"></i>
        </button>
      </div>
      <div class="current-week-label">
        <i class="pi pi-calendar"></i>
        <span>{{ formatWeekRange(currentMonday) }}</span>
      </div>
      <div class="date-picker-wrapper">
        <span class="picker-label">Chọn ngày:</span>
        <input 
          type="date" 
          class="date-input" 
          :value="currentDate.toISOString().split('T')[0]" 
          @input="onDateInput"
        />
      </div>
    </div>

    <!-- Stats bar -->
    <div class="tt-stats" v-if="!loading && classes.length > 0">
      <div class="stat-pill">
        <i class="pi pi-book"></i>
        <span>{{ classes.length }} {{ role === 'SINH_VIEN' ? 'lớp đã đăng ký' : isAdminView ? 'lớp trong hệ thống' : 'lớp đang dạy' }}</span>
      </div>
      <div class="stat-pill">
        <i class="pi pi-star"></i>
        <span>{{ totalCredits }} tín chỉ</span>
      </div>
      <div class="stat-pill" v-if="classes[0]?.semester">
        <i class="pi pi-calendar"></i>
        <span>{{ classes[0].semester }}</span>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="tt-loading">
      <i class="pi pi-spin pi-spinner"></i>
      <span>{{ role === 'GIANG_VIEN' ? 'Đang tải lịch giảng dạy...' : 'Đang tải thời khoá biểu...' }}</span>
    </div>

    <!-- Error -->
    <div v-else-if="errMsg" class="alert alert-e">
      <i class="pi pi-times-circle"></i> {{ errMsg }}
    </div>

    <!-- Empty state -->
    <div v-else-if="classes.length === 0" class="tt-empty">
      <i class="pi pi-calendar-times"></i>
      <h3>{{ role === 'GIANG_VIEN' ? 'Chưa có lịch dạy' : 'Chưa có lịch học' }}</h3>
      <p v-if="role === 'SINH_VIEN'">Bạn chưa đăng ký lớp học nào hoặc chưa có lớp nào có lịch.</p>
      <p v-else-if="isAdminView">Chưa có lớp học nào trong hệ thống có lịch học cụ thể.</p>
      <p v-else>Bạn chưa được phân công giảng dạy lớp nào.</p>
    </div>

    <!-- Content -->
    <div v-else ref="timetableRef">
      <!-- === GRID VIEW === -->
      <div v-if="effectiveView === 'grid'" class="shift-grid-container">
        <table class="shift-grid-table">
          <thead>
            <tr>
              <th class="col-shift">Ca học</th>
              <th 
                v-for="wd in weekDays" :key="wd.dayCode" 
                :class="{ 'is-today': wd.dayCode === today && isCurrentWeek(wd.date) }"
              >
                <div class="th-day-label">{{ DAY_LABELS[wd.dayCode] }}</div>
                <div class="th-day-date">{{ formatDateDDMMYYYY(wd.date) }}</div>
              </th>
            </tr>
          </thead>
          <tbody>
            <!-- SÁNG -->
            <tr>
              <td class="row-shift sáng-header">Sáng</td>
              <td v-for="wd in weekDays" :key="wd.dayCode" class="shift-cell">
                <div class="shift-cell-content">
                  <div 
                    v-for="(block, idx) in getShiftBlocks(wd.dayCode, 'Sáng')" 
                    :key="idx"
                    class="class-card"
                    :class="block.type"
                  >
                    <div class="card-title">{{ block.cls.className }}</div>
                    <div class="card-code">{{ block.cls.subjectCode }}</div>
                    <div class="card-meta">{{ block.periods }}</div>
                    <div class="card-meta">Giờ: {{ block.session.startTime }} - {{ block.session.endTime }}</div>
                    <div class="card-meta">Phòng: {{ block.cls.room || 'Chưa xếp' }}</div>
                    <div class="card-meta">
                      <template v-if="role === 'GIANG_VIEN'">
                        Sĩ số: <strong>{{ block.cls.enrolledCount ?? 0 }} sinh viên</strong>
                      </template>
                      <template v-else>
                        GV: 
                        <span v-if="block.cls.instructor" class="teacher-link">{{ block.cls.instructor.fullName }}</span>
                        <span v-else class="no-instructor">Chưa phân công</span>
                      </template>
                    </div>
                  </div>
                </div>
              </td>
            </tr>

            <!-- CHIỀU -->
            <tr>
              <td class="row-shift chiều-header">Chiều</td>
              <td v-for="wd in weekDays" :key="wd.dayCode" class="shift-cell">
                <div class="shift-cell-content">
                  <div 
                    v-for="(block, idx) in getShiftBlocks(wd.dayCode, 'Chiều')" 
                    :key="idx"
                    class="class-card"
                    :class="block.type"
                  >
                    <div class="card-title">{{ block.cls.className }}</div>
                    <div class="card-code">{{ block.cls.subjectCode }}</div>
                    <div class="card-meta">{{ block.periods }}</div>
                    <div class="card-meta">Giờ: {{ block.session.startTime }} - {{ block.session.endTime }}</div>
                    <div class="card-meta">Phòng: {{ block.cls.room || 'Chưa xếp' }}</div>
                    <div class="card-meta">
                      <template v-if="role === 'GIANG_VIEN'">
                        Sĩ số: <strong>{{ block.cls.enrolledCount ?? 0 }} sinh viên</strong>
                      </template>
                      <template v-else>
                        GV: 
                        <span v-if="block.cls.instructor" class="teacher-link">{{ block.cls.instructor.fullName }}</span>
                        <span v-else class="no-instructor">Chưa phân công</span>
                      </template>
                    </div>
                  </div>
                </div>
              </td>
            </tr>

            <!-- TỐI -->
            <tr>
              <td class="row-shift tối-header">Tối</td>
              <td v-for="wd in weekDays" :key="wd.dayCode" class="shift-cell">
                <div class="shift-cell-content">
                  <div 
                    v-for="(block, idx) in getShiftBlocks(wd.dayCode, 'Tối')" 
                    :key="idx"
                    class="class-card"
                    :class="block.type"
                  >
                    <div class="card-title">{{ block.cls.className }}</div>
                    <div class="card-code">{{ block.cls.subjectCode }}</div>
                    <div class="card-meta">{{ block.periods }}</div>
                    <div class="card-meta">Giờ: {{ block.session.startTime }} - {{ block.session.endTime }}</div>
                    <div class="card-meta">Phòng: {{ block.cls.room || 'Chưa xếp' }}</div>
                    <div class="card-meta">
                      <template v-if="role === 'GIANG_VIEN'">
                        Sĩ số: <strong>{{ block.cls.enrolledCount ?? 0 }} sinh viên</strong>
                      </template>
                      <template v-else>
                        GV: 
                        <span v-if="block.cls.instructor" class="teacher-link">{{ block.cls.instructor.fullName }}</span>
                        <span v-else class="no-instructor">Chưa phân công</span>
                      </template>
                    </div>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- === LIST VIEW === -->
      <div v-else class="list-container">
        <div v-if="listByDay.length === 0" class="list-empty-week">
          <i class="pi pi-calendar-times"></i>
          <p>{{ role === 'GIANG_VIEN' ? 'Không có lịch giảng dạy trong tuần này.' : 'Không có lịch học trong tuần này.' }}</p>
        </div>
        <div v-else v-for="group in listByDay" :key="group.day" class="list-day-group">
          <div class="list-day-header" :class="{ 'is-today': group.day === today }">
            <span class="day-icon">{{ group.day }}</span>
            <span>{{ group.dateLabel }}</span>
            <span class="day-count">{{ group.items.length }} buổi</span>
          </div>
          <div class="list-items">
            <div
              v-for="(item, idx) in group.items" :key="idx"
              class="list-item"
              :class="item.type"
            >
              <div class="li-time">
                {{ item.session.startTime }} - {{ item.session.endTime }}
              </div>
              <div class="li-info">
                <div class="li-subject">
                  {{ item.cls.className }}
                </div>
                <div class="li-meta">
                  <span>Mã môn: {{ item.cls.subjectCode }}</span>
                  <span>{{ item.periods }}</span>
                  <span v-if="item.cls.room"><i class="pi pi-map-marker"></i> Phòng: {{ item.cls.room }}</span>
                  <span>
                    <template v-if="role === 'GIANG_VIEN'">
                      <i class="pi pi-users"></i>
                      Sĩ số: <strong>{{ item.cls.enrolledCount ?? 0 }} sinh viên</strong>
                    </template>
                    <template v-else>
                      <i class="pi pi-user"></i>
                      GV: 
                      <span v-if="item.cls.instructor" class="teacher-link">{{ item.cls.instructor.fullName }}</span>
                      <span v-else class="no-instructor">Chưa phân công</span>
                    </template>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Shift Legend -->
      <div class="shift-legend-bar">
        <div class="legend-item"><span class="legend-color-box study"></span> Lịch học</div>
        <div class="legend-item"><span class="legend-color-box exam"></span> Lịch thi</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ─── Wrapper ─── */
.tt-wrapper { padding: 1.5rem 2rem; animation: fadeIn 0.3s ease-out; }
.tt-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; border-bottom: 1px solid #e5e7eb; padding-bottom: 1rem; flex-wrap: wrap; gap: 1rem; }
.breadcrumb { font-size: 0.8rem; color: #6b7280; margin-bottom: 0.5rem; }
.breadcrumb span { color: #111827; font-weight: 600; }
.tt-title { font-size: 1.75rem; font-weight: 700; margin: 0 0 0.35rem 0; color: #111827; }
.tt-subtitle { font-size: 0.875rem; color: #6b7280; margin: 0; }

/* ─── Actions ─── */
.tt-actions { display: flex; align-items: center; gap: 0.75rem; }
.view-toggle { display: flex; border: 1px solid #d1d5db; border-radius: 8px; overflow: hidden; }
.view-toggle button { padding: 0.5rem 0.75rem; border: none; background: #fff; cursor: pointer; color: #6b7280; transition: all 0.2s; }
.view-toggle button.active { background: #111827; color: #fff; }
.view-toggle button:hover:not(.active) { background: #f3f4f6; }
.btn-pdf { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1.25rem; background: var(--lms-primary); color: #fff; border: none; border-radius: 8px; font-weight: 500; cursor: pointer; transition: background 0.2s; font-size: 0.875rem; }
.btn-pdf:hover:not(:disabled) { background: var(--lms-primary-hover); }
.btn-pdf:disabled { opacity: 0.5; cursor: not-allowed; }

/* ─── Stats ─── */
.tt-stats { display: flex; gap: 0.75rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
.stat-pill { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.4rem 1rem; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 20px; font-size: 0.8rem; color: #374151; font-weight: 500; }
.stat-pill i { color: var(--lms-primary); font-size: 0.85rem; }

/* ─── States ─── */
.tt-loading { display: flex; flex-direction: column; align-items: center; gap: 1rem; padding: 5rem 0; color: #6b7280; }
.tt-loading i { font-size: 2.5rem; }
.alert { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1.25rem; border-radius: 8px; font-size: 0.875rem; }
.alert-e { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }
.tt-empty { display: flex; flex-direction: column; align-items: center; gap: 0.75rem; padding: 5rem 0; color: #9ca3af; text-align: center; }
.tt-empty i { font-size: 3rem; }
.tt-empty h3 { font-size: 1.25rem; color: #6b7280; margin: 0; }
.tt-empty p { font-size: 0.875rem; margin: 0; }

/* ─── GRID SHIFT VIEW ─── */
.shift-grid-container {
  overflow-x: auto;
  border: 1px solid #dcdcdc;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}

.shift-grid-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 1000px;
}

.shift-grid-table th, 
.shift-grid-table td {
  border: 1px solid #dcdcdc;
}

.shift-grid-table th {
  background-color: #f8fafc;
  padding: 0.75rem 0.5rem;
  text-align: center;
  font-weight: bold;
  font-size: 0.88rem;
  color: #334155;
  width: calc(100% / 8);
}

.shift-grid-table th.col-shift {
  width: 60px;
  color: #475569;
  background-color: #f1f5f9;
  text-transform: uppercase;
  font-size: 0.75rem;
  letter-spacing: 0.05em;
}

.shift-grid-table th.is-today {
  background-color: var(--lms-primary-light);
  border-bottom: 3px solid var(--lms-primary);
  color: var(--lms-primary);
}

.th-day-label {
  font-size: 0.88rem;
  font-weight: 700;
  margin-bottom: 2px;
}

.th-day-date {
  font-size: 0.78rem;
  font-weight: 500;
  color: #64748b;
}

.row-shift {
  background-color: #f8fafc;
  font-weight: bold;
  color: #475569;
  text-align: center;
  vertical-align: middle;
  font-size: 0.95rem;
  width: 60px;
  padding: 1.5rem 0.5rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.shift-cell {
  background-image: 
    linear-gradient(to right, rgba(200, 220, 240, 0.2) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(200, 220, 240, 0.2) 1px, transparent 1px);
  background-size: 16px 16px;
  vertical-align: top;
  padding: 0.5rem;
  min-height: 120px;
}

.shift-cell-content {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-height: 100px;
}

/* ─── Class Cards ─── */
.class-card {
  border-radius: 4px;
  border: 1px solid rgba(0,0,0,0.08);
  border-left: 4px solid #4b5563;
  padding: 0.5rem 0.6rem;
  text-align: left;
  line-height: 1.4;
  box-shadow: 0 1px 2px rgba(0,0,0,0.04);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.class-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 6px rgba(0,0,0,0.08);
}

.card-title {
  font-size: 0.82rem;
  font-weight: 700;
  margin-bottom: 3px;
  color: #1e3a8a;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.card-code {
  font-size: 0.72rem;
  font-weight: 600;
  color: #4b5563;
  margin-bottom: 2px;
}

.card-meta {
  font-size: 0.72rem;
  color: #4b5563;
  margin-bottom: 1px;
}

.teacher-link {
  color: #2563eb;
  text-decoration: underline;
  cursor: pointer;
  font-weight: 500;
}

.teacher-link:hover {
  color: #1d4ed8;
}

/* Themes colors matching Vietnamese schedule system */
.class-card.study {
  background-color: #eff6ff;
  border-left-color: #2563eb;
  color: #1e40af;
}
.class-card.study .card-title {
  color: #1e3a8a;
}
.class-card.study .card-code,
.class-card.study .card-meta {
  color: #475569;
}

.class-card.exam {
  background-color: #fffbeb;
  border-left-color: #d97706;
  color: #b45309;
}
.class-card.exam .card-title {
  color: #78350f;
}
.class-card.exam .card-code,
.class-card.exam .card-meta {
  color: #475569;
}

/* ─── LIST VIEW ─── */
.list-container { display: flex; flex-direction: column; gap: 1.25rem; }
.list-day-group { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
.list-day-header { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1.25rem; background: #f9fafb; border-bottom: 1px solid #e5e7eb; font-weight: 600; font-size: 0.9rem; color: #111827; }
.list-day-header.is-today { background: var(--lms-primary-light); color: var(--lms-primary); }
.day-icon { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 8px; background: #e5e7eb; font-weight: 700; font-size: 0.75rem; color: #374151; }
.list-day-header.is-today .day-icon { background: var(--lms-primary); color: #fff; }
.day-count { margin-left: auto; font-size: 0.75rem; font-weight: 500; color: #9ca3af; }

.list-items { padding: 0.5rem; display: flex; flex-direction: column; gap: 0.5rem; }
.list-item { 
  display: flex; 
  align-items: flex-start; 
  gap: 1rem; 
  padding: 0.75rem 1.25rem; 
  border-radius: 8px;
  border: 1px solid rgba(0,0,0,0.08);
  border-left: 5px solid transparent; 
  transition: transform 0.15s, box-shadow 0.15s; 
}
.list-item:hover { 
  transform: translateY(-1px);
  box-shadow: 0 4px 6px rgba(0,0,0,0.08); 
}

.list-item.study { background-color: #eff6ff; border-left-color: #2563eb; color: #1e40af; }
.list-item.exam { background-color: #fffbeb; border-left-color: #d97706; color: #b45309; }

.li-time { font-size: 0.85rem; font-weight: 700; white-space: nowrap; min-width: 110px; padding-top: 2px; }
.li-info { flex: 1; min-width: 0; }
.li-subject { font-weight: 700; font-size: 0.9rem; margin-bottom: 4px; }
.li-meta { display: flex; gap: 1.25rem; font-size: 0.8rem; flex-wrap: wrap; }
.li-meta span { display: inline-flex; align-items: center; gap: 0.25rem; }
.li-meta i { font-size: 0.75rem; }

/* ─── Legend ─── */
.shift-legend-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
  justify-content: center;
  align-items: center;
  margin-top: 1.5rem;
  padding: 0.75rem 1rem;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
  color: #374151;
  font-weight: 500;
}

.legend-color-box {
  width: 24px;
  height: 14px;
  border-radius: 3px;
  border: 1px solid rgba(0,0,0,0.1);
  display: inline-block;
}

.legend-color-box.study { background-color: #eff6ff; border-left: 3px solid #2563eb; }
.legend-color-box.exam { background-color: #fffbeb; border-left: 3px solid #d97706; }

@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

/* ─── Week Navigator ─── */
.week-navigator-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 0.75rem 1.25rem;
  margin-bottom: 1.25rem;
  flex-wrap: wrap;
  gap: 1rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.nav-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.nav-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #ffffff;
  color: #374151;
  cursor: pointer;
  transition: all 0.15s ease;
}

.nav-btn:hover {
  background: #f3f4f6;
  border-color: #9ca3af;
}

.nav-today-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  height: 36px;
  padding: 0 1rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #ffffff;
  color: #374151;
  font-weight: 500;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.nav-today-btn:hover {
  background: #f3f4f6;
  border-color: #9ca3af;
}

.current-week-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  font-size: 0.95rem;
  color: #111827;
}

.current-week-label i {
  color: var(--lms-primary);
}

.date-picker-wrapper {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.picker-label {
  font-size: 0.85rem;
  color: #4b5563;
  font-weight: 500;
}

.date-input {
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 0.4rem 0.6rem;
  font-size: 0.85rem;
  color: #374151;
  outline: none;
  background: #ffffff;
  transition: border-color 0.15s ease;
}

.date-input:focus {
  border-color: var(--lms-primary);
}

.list-empty-week {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 0;
  color: #9ca3af;
}

.list-empty-week i {
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
}

.list-empty-week p {
  font-size: 0.875rem;
}

.no-instructor {
  color: #ef4444;
  font-style: italic;
  font-weight: 500;
}

/* ─── Print / PDF adjustments ─── */
@media print {
  .tt-actions, .view-toggle, .btn-pdf, .week-navigator-bar, .shift-legend-bar { display: none !important; }
  .tt-wrapper { padding: 0; }
  .shift-grid-container { border: none; }
}
</style>
