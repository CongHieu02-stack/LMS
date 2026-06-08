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

const gridBlocks = computed(() => {
  const blocks: Record<string, GridBlock[]> = {}
  for (const day of DAYS) blocks[day] = []

  for (const cls of classes.value) {
    const color = getColorForSubject(cls.subjectCode)
    for (const session of cls.sessions) {
      const startMin = timeToMinutes(session.startTime)
      const endMin = timeToMinutes(session.endTime)
      const topPx = ((startMin - START_HOUR * 60) / 60) * SLOT_HEIGHT
      const heightPx = ((endMin - startMin) / 60) * SLOT_HEIGHT
      if (blocks[session.day]) {
        blocks[session.day].push({ cls, session, color, topPx, heightPx })
      }
    }
  }
  return blocks
})

// ─── List view: group by day ───
const listByDay = computed(() => {
  const result: { day: string; label: string; items: { cls: TimetableClass; session: SessionItem; color: ReturnType<typeof getColorForSubject> }[] }[] = []
  for (const day of DAYS) {
    const items: typeof result[0]['items'] = []
    for (const cls of classes.value) {
      const color = getColorForSubject(cls.subjectCode)
      for (const session of cls.sessions) {
        if (session.day === day) {
          items.push({ cls, session, color })
        }
      }
    }
    if (items.length > 0) {
      items.sort((a, b) => a.session.startTime.localeCompare(b.session.startTime))
      result.push({ day, label: DAY_LABELS[day], items })
    }
  }
  return result
})

// ─── Today highlight ───
const today = todayDayCode()

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
    classes.value = res.data || []
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
      margin: [10, 10, 10, 10],
      filename: `thoi-khoa-bieu-${new Date().toISOString().split('T')[0]}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
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
const totalCredits = computed(() => classes.value.reduce((sum, c) => sum + (c.credits || 0), 0))
</script>

<template>
  <div class="tt-wrapper">
    <!-- Header -->
    <div class="tt-header">
      <div>
        <div class="breadcrumb">Học tập / <span>Thời khoá biểu</span></div>
        <h1 class="tt-title">Thời Khoá Biểu</h1>
        <p class="tt-subtitle" v-if="role === 'SINH_VIEN'">Lịch học cá nhân của bạn dựa trên các lớp đã đăng ký.</p>
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

    <!-- Stats bar -->
    <div class="tt-stats" v-if="!loading && classes.length > 0">
      <div class="stat-pill">
        <i class="pi pi-book"></i>
        <span>{{ classes.length }} {{ role === 'SINH_VIEN' ? 'lớp đã đăng ký' : 'lớp đang dạy' }}</span>
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
      <span>Đang tải thời khoá biểu...</span>
    </div>

    <!-- Error -->
    <div v-else-if="errMsg" class="alert alert-e">
      <i class="pi pi-times-circle"></i> {{ errMsg }}
    </div>

    <!-- Empty state -->
    <div v-else-if="classes.length === 0" class="tt-empty">
      <i class="pi pi-calendar-times"></i>
      <h3>Chưa có lịch học</h3>
      <p v-if="role === 'SINH_VIEN'">Bạn chưa đăng ký lớp học nào hoặc chưa có lớp nào được duyệt.</p>
      <p v-else>Bạn chưa được phân công giảng dạy lớp nào.</p>
    </div>

    <!-- Content -->
    <div v-else ref="timetableRef">
      <!-- === GRID VIEW === -->
      <div v-if="effectiveView === 'grid'" class="grid-container">
        <div class="grid-table">
          <!-- Header row: days -->
          <div class="grid-corner">
            <span>Giờ</span>
          </div>
          <div
            v-for="day in DAYS" :key="day"
            class="grid-day-header"
            :class="{ 'is-today': day === today }"
          >
            <span class="day-label">{{ DAY_LABELS[day] }}</span>
            <span class="day-code">{{ day }}</span>
          </div>

          <!-- Time column + day columns -->
          <div class="grid-body">
            <!-- Time labels -->
            <div class="grid-time-col">
              <div v-for="hour in hourLabels" :key="hour" class="time-label" :style="{ height: SLOT_HEIGHT + 'px' }">
                {{ hour }}
              </div>
            </div>

            <!-- Day columns -->
            <div
              v-for="day in DAYS" :key="day"
              class="grid-day-col"
              :class="{ 'is-today-col': day === today }"
              :style="{ height: (END_HOUR - START_HOUR + 1) * SLOT_HEIGHT + 'px' }"
            >
              <!-- Hour grid lines -->
              <div
                v-for="i in (END_HOUR - START_HOUR + 1)" :key="'line-'+i"
                class="hour-line"
                :style="{ top: (i - 1) * SLOT_HEIGHT + 'px' }"
              ></div>

              <!-- Blocks -->
              <div
                v-for="(block, idx) in gridBlocks[day]" :key="idx"
                class="tt-block"
                :style="{
                  top: block.topPx + 'px',
                  height: Math.max(block.heightPx, 30) + 'px',
                  backgroundColor: block.color.bg,
                  borderLeftColor: block.color.border,
                  color: block.color.text,
                }"
                :title="`${block.cls.subjectCode} — ${block.cls.subjectName}\n${block.session.startTime} - ${block.session.endTime}\nPhòng: ${block.cls.room || 'Chưa xếp'}`"
              >
                <div class="block-code">{{ block.cls.subjectCode }}</div>
                <div class="block-name" v-if="block.heightPx > 50">{{ block.cls.subjectName }}</div>
                <div class="block-room" v-if="block.heightPx > 70">
                  <i class="pi pi-map-marker"></i> {{ block.cls.room || '—' }}
                </div>
                <div class="block-time">{{ block.session.startTime }} - {{ block.session.endTime }}</div>
                <div class="block-teacher" v-if="block.heightPx > 90 && block.cls.instructor">
                  <i class="pi pi-user"></i> {{ block.cls.instructor.fullName }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- === LIST VIEW === -->
      <div v-else class="list-container">
        <div v-for="group in listByDay" :key="group.day" class="list-day-group">
          <div class="list-day-header" :class="{ 'is-today': group.day === today }">
            <span class="day-icon">{{ group.day }}</span>
            <span>{{ group.label }}</span>
            <span class="day-count">{{ group.items.length }} buổi</span>
          </div>
          <div class="list-items">
            <div
              v-for="(item, idx) in group.items" :key="idx"
              class="list-item"
              :style="{ borderLeftColor: item.color.border }"
            >
              <div class="li-time" :style="{ color: item.color.text }">
                {{ item.session.startTime }} - {{ item.session.endTime }}
              </div>
              <div class="li-info">
                <div class="li-subject">
                  <span class="li-code" :style="{ backgroundColor: item.color.bg, color: item.color.text }">{{ item.cls.subjectCode }}</span>
                  {{ item.cls.subjectName }}
                </div>
                <div class="li-meta">
                  <span v-if="item.cls.room"><i class="pi pi-map-marker"></i> {{ item.cls.room }}</span>
                  <span v-if="item.cls.instructor"><i class="pi pi-user"></i> {{ item.cls.instructor.fullName }}</span>
                  <span v-if="item.cls.className"><i class="pi pi-bookmark"></i> {{ item.cls.className }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Legend -->
      <div class="tt-legend">
        <span class="legend-title">Chú thích:</span>
        <div
          v-for="cls in classes" :key="cls.classId"
          class="legend-item"
          :style="{ backgroundColor: getColorForSubject(cls.subjectCode).bg, borderColor: getColorForSubject(cls.subjectCode).border, color: getColorForSubject(cls.subjectCode).text }"
        >
          {{ cls.subjectCode }} — {{ cls.subjectName }}
        </div>
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
.btn-pdf { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1.25rem; background: #7c3aed; color: #fff; border: none; border-radius: 8px; font-weight: 500; cursor: pointer; transition: background 0.2s; font-size: 0.875rem; }
.btn-pdf:hover:not(:disabled) { background: #6d28d9; }
.btn-pdf:disabled { opacity: 0.5; cursor: not-allowed; }

/* ─── Stats ─── */
.tt-stats { display: flex; gap: 0.75rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
.stat-pill { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.4rem 1rem; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 20px; font-size: 0.8rem; color: #374151; font-weight: 500; }
.stat-pill i { color: #7c3aed; font-size: 0.85rem; }

/* ─── States ─── */
.tt-loading { display: flex; flex-direction: column; align-items: center; gap: 1rem; padding: 5rem 0; color: #6b7280; }
.tt-loading i { font-size: 2.5rem; }
.alert { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1.25rem; border-radius: 8px; font-size: 0.875rem; }
.alert-e { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }
.tt-empty { display: flex; flex-direction: column; align-items: center; gap: 0.75rem; padding: 5rem 0; color: #9ca3af; text-align: center; }
.tt-empty i { font-size: 3rem; }
.tt-empty h3 { font-size: 1.25rem; color: #6b7280; margin: 0; }
.tt-empty p { font-size: 0.875rem; margin: 0; }

/* ─── GRID VIEW ─── */
.grid-container { overflow-x: auto; border: 1px solid #e5e7eb; border-radius: 12px; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
.grid-table { display: grid; grid-template-columns: 64px repeat(7, 1fr); min-width: 900px; }
.grid-corner { display: flex; align-items: center; justify-content: center; background: #f9fafb; border-bottom: 2px solid #e5e7eb; border-right: 1px solid #e5e7eb; padding: 0.75rem; font-size: 0.75rem; font-weight: 600; color: #6b7280; text-transform: uppercase; }
.grid-day-header { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 0.75rem 0.5rem; background: #f9fafb; border-bottom: 2px solid #e5e7eb; border-right: 1px solid #f3f4f6; transition: background 0.2s; }
.grid-day-header:last-child { border-right: none; }
.grid-day-header.is-today { background: #ede9fe; border-bottom-color: #7c3aed; }
.day-label { font-size: 0.85rem; font-weight: 600; color: #111827; }
.day-code { font-size: 0.7rem; color: #9ca3af; margin-top: 2px; }
.grid-day-header.is-today .day-label { color: #7c3aed; }
.grid-day-header.is-today .day-code { color: #7c3aed; }

.grid-body { display: contents; }
.grid-time-col { grid-column: 1; border-right: 1px solid #e5e7eb; }
.time-label { display: flex; align-items: flex-start; justify-content: center; padding-top: 0; font-size: 0.7rem; color: #9ca3af; font-weight: 500; border-bottom: 1px solid #f3f4f6; box-sizing: border-box; }
.grid-day-col { position: relative; border-right: 1px solid #f3f4f6; }
.grid-day-col:last-child { border-right: none; }
.grid-day-col.is-today-col { background: rgba(124, 58, 237, 0.03); }
.hour-line { position: absolute; left: 0; right: 0; border-top: 1px solid #f3f4f6; height: 0; }

/* ─── Blocks ─── */
.tt-block { position: absolute; left: 3px; right: 3px; border-radius: 6px; border-left: 3px solid; padding: 4px 6px; overflow: hidden; cursor: default; transition: box-shadow 0.2s, transform 0.15s; z-index: 1; font-size: 0.72rem; line-height: 1.3; }
.tt-block:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.12); transform: translateY(-1px); z-index: 10; }
.block-code { font-weight: 700; font-size: 0.78rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.block-name { font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; opacity: 0.85; }
.block-room { display: flex; align-items: center; gap: 2px; font-size: 0.68rem; opacity: 0.75; }
.block-room i { font-size: 0.6rem; }
.block-time { font-size: 0.68rem; opacity: 0.7; }
.block-teacher { display: flex; align-items: center; gap: 2px; font-size: 0.68rem; opacity: 0.75; margin-top: 1px; }
.block-teacher i { font-size: 0.6rem; }

/* ─── LIST VIEW ─── */
.list-container { display: flex; flex-direction: column; gap: 1.25rem; }
.list-day-group { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
.list-day-header { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1.25rem; background: #f9fafb; border-bottom: 1px solid #e5e7eb; font-weight: 600; font-size: 0.9rem; color: #111827; }
.list-day-header.is-today { background: #ede9fe; color: #7c3aed; }
.day-icon { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 8px; background: #e5e7eb; font-weight: 700; font-size: 0.75rem; color: #374151; }
.list-day-header.is-today .day-icon { background: #7c3aed; color: #fff; }
.day-count { margin-left: auto; font-size: 0.75rem; font-weight: 500; color: #9ca3af; }

.list-items { padding: 0.5rem 0; }
.list-item { display: flex; align-items: flex-start; gap: 1rem; padding: 0.75rem 1.25rem; border-left: 3px solid transparent; transition: background 0.15s; }
.list-item:hover { background: #fafafa; }
.li-time { font-size: 0.85rem; font-weight: 700; white-space: nowrap; min-width: 110px; padding-top: 2px; }
.li-info { flex: 1; min-width: 0; }
.li-subject { font-weight: 600; font-size: 0.9rem; color: #111827; display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.li-code { padding: 2px 8px; border-radius: 4px; font-size: 0.72rem; font-weight: 700; }
.li-meta { display: flex; gap: 1rem; margin-top: 0.35rem; font-size: 0.8rem; color: #6b7280; flex-wrap: wrap; }
.li-meta span { display: inline-flex; align-items: center; gap: 0.25rem; }
.li-meta i { font-size: 0.7rem; }

/* ─── Legend ─── */
.tt-legend { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; margin-top: 1.5rem; padding: 1rem; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; }
.legend-title { font-size: 0.8rem; font-weight: 600; color: #6b7280; margin-right: 0.5rem; }
.legend-item { padding: 0.25rem 0.75rem; border-radius: 6px; border: 1px solid; font-size: 0.75rem; font-weight: 600; }

@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

/* ─── Print / PDF adjustments ─── */
@media print {
  .tt-actions, .view-toggle, .btn-pdf { display: none !important; }
  .tt-wrapper { padding: 0; }
}
</style>
