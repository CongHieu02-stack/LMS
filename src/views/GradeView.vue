<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { apiGet } from '@/lib/api'

/* =========================
   TYPES
========================= */
interface GradeItem {
  subjectCode: string
  subjectName: string
  credits: number
  regular1: number | null
  regular2: number | null
  midtermScore: number | null
  finalScore: number | null
  averageScore: number | null
  pass: boolean | null
  semester: string
  className: string
}

interface RawGrade {
  subjectCode: string
  subjectName: string
  credits: number
  regular1: number | null
  regular2: number | null
  midtermScore: number | null
  finalScore: number | null
  averageScore: number | null
  pass: boolean | null
  semester: string
  className: string
}

/* =========================
   GROUPED TYPE
========================= */
type GroupedGrade = GradeItem & {
  totalScore: number
  count: number
}

/* =========================
   STATE
========================= */
const grades = ref<GradeItem[]>([])
const loading = ref(true)

/* =========================
   LOAD DATA
========================= */
async function loadGrades() {
  loading.value = true

  try {
    const res = await apiGet<{ success: boolean; data: RawGrade[] }>('/grades/me')

    grades.value = (res.data || []).map((g: RawGrade): GradeItem => {
      const subjectName = g.subjectName || ''
      const subjectCode = g.subjectCode || ''
      const className = g.className || ''
      
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
        subjectCode: g.subjectCode,
        subjectName: g.subjectName,
        credits: g.credits,
        regular1: g.regular1,
        regular2: g.regular2,
        midtermScore: g.midtermScore,
        finalScore: g.finalScore,
        averageScore: g.averageScore,
        pass: g.pass,
        semester: g.semester,
        className: displayName
      }
    })
  } catch (err) {
    console.log(err)
  }

  loading.value = false
}

/* =========================
   GROUP BY SEMESTER
========================= */
const groupedBySemester = computed(() => {
  const map = new Map<string, GradeItem[]>()

  for (const g of grades.value) {
    const key = g.semester
    if (!map.has(key)) {
      map.set(key, [])
    }
    map.get(key)!.push(g)
  }

  return Array.from(map.entries()).map(([semester, items]) => ({
    semester,
    items
  }))
})

/* =========================
   CONVERSION HELPERS
========================= */
function toScale4(score: number): number {
  if (score === null || score === undefined) return 0.0
  return score * 0.4
}

function toLetter(score: number): string {
  if (score === null || score === undefined) return '-'
  if (score >= 8.5) return 'A'
  if (score >= 8.0) return 'B+'
  if (score >= 7.0) return 'B'
  if (score >= 6.5) return 'C+'
  if (score >= 5.5) return 'C'
  if (score >= 5.0) return 'D+'
  if (score >= 4.0) return 'D'
  return 'F'
}

/* =========================
   GPA 10-POINT SCALE
========================= */
const gpa10 = computed(() => {
  if (grades.value.length === 0) return '0.00'

  const validGrades = grades.value.filter(g => g.averageScore !== null)
  if (validGrades.length === 0) return '0.00'

  const total = validGrades.reduce(
    (acc: number, g: GradeItem) => acc + (g.averageScore || 0) * g.credits,
    0
  )

  const credits = validGrades.reduce(
    (acc: number, g: GradeItem) => acc + g.credits,
    0
  )

  return credits > 0 ? (total / credits).toFixed(2) : '0.00'
})

/* =========================
   GPA 4-POINT SCALE
========================= */
const gpa4 = computed(() => {
  if (grades.value.length === 0) return '0.00'

  const validGrades = grades.value.filter(g => g.averageScore !== null)
  if (validGrades.length === 0) return '0.00'

  const total = validGrades.reduce(
    (acc: number, g: GradeItem) => acc + toScale4(g.averageScore || 0) * g.credits,
    0
  )

  const credits = validGrades.reduce(
    (acc: number, g: GradeItem) => acc + g.credits,
    0
  )

  return credits > 0 ? (total / credits).toFixed(2) : '0.00'
})

/* =========================
   SEMESTER GPA SCALES
========================= */
const semesterGpa10 = computed(() => {
  const result = new Map<string, string>()

  for (const { semester, items } of groupedBySemester.value) {
    const validItems = items.filter(g => g.averageScore !== null)
    if (validItems.length === 0) {
      result.set(semester, '0.00')
      continue
    }

    const total = validItems.reduce(
      (acc: number, g: GradeItem) => acc + (g.averageScore || 0) * g.credits,
      0
    )

    const credits = validItems.reduce(
      (acc: number, g: GradeItem) => acc + g.credits,
      0
    )

    result.set(semester, credits > 0 ? (total / credits).toFixed(2) : '0.00')
  }

  return result
})

const semesterGpa4 = computed(() => {
  const result = new Map<string, string>()

  for (const { semester, items } of groupedBySemester.value) {
    const validItems = items.filter(g => g.averageScore !== null)
    if (validItems.length === 0) {
      result.set(semester, '0.00')
      continue
    }

    const total = validItems.reduce(
      (acc: number, g: GradeItem) => acc + toScale4(g.averageScore || 0) * g.credits,
      0
    )

    const credits = validItems.reduce(
      (acc: number, g: GradeItem) => acc + g.credits,
      0
    )

    result.set(semester, credits > 0 ? (total / credits).toFixed(2) : '0.00')
  }

  return result
})

/* =========================
   TOTAL CREDITS
========================= */
const totalCredits = computed(() => {
  const unique = new Map<string, number>()

  for (const g of grades.value) {
    unique.set(g.subjectCode, g.credits)
  }

  return Array.from(unique.values()).reduce(
    (a: number, b: number) => a + b,
    0
  )
})

/* =========================
   PASSED CREDITS
========================= */
const passedCredits = computed(() => {
  const unique = new Map<string, number>()

  for (const g of grades.value) {
    if (g.pass) {
      unique.set(g.subjectCode, g.credits)
    }
  }

  return Array.from(unique.values()).reduce(
    (a: number, b: number) => a + b,
    0
  )
})

/* =========================
   STATUS
========================= */
function getStatus(pass: boolean) {
  if (pass === null || pass === undefined) return '-'
  return pass ? 'PASS' : 'FAIL'
}

onMounted(loadGrades)
</script>

<template>
  <div class="mono-wrapper">

    <div class="page-header">
      <div>
        <div class="breadcrumb">Học vụ / <span>Xem Bảng Điểm</span></div>
        <h1 class="page-title">Bảng Điểm Cá Nhân</h1>
        <div class="page-subtitle">
          Kết quả học tập các môn học và điểm tích lũy (GPA).
        </div>
      </div>
    </div>

    <div v-if="loading" class="loading-center">
      <i class="pi pi-spin pi-spinner" style="font-size:2rem;color:#6b7280"></i>
    </div>

    <template v-else>

      <!-- STATS -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon bg-purple">
            <i class="pi pi-chart-line"></i>
          </div>
          <div>
            <div class="stat-label">GPA (Hệ 10)</div>
            <div class="stat-value">{{ gpa10 }}</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon bg-purple">
            <i class="pi pi-chart-line"></i>
          </div>
          <div>
            <div class="stat-label">GPA (Hệ 4)</div>
            <div class="stat-value">{{ gpa4 }}</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon bg-blue">
            <i class="pi pi-book"></i>
          </div>
          <div>
            <div class="stat-label">Tín Chỉ Tích Lũy</div>
            <div class="stat-value">
              {{ passedCredits }}
              <small>/ {{ totalCredits }} TC</small>
            </div>
          </div>
        </div>
      </div>

      <!-- SEMESTER TABLES -->
      <template v-if="groupedBySemester.length > 0">
        <template v-for="semesterData in groupedBySemester" :key="semesterData.semester">
          <div class="mono-card mt-8" v-if="semesterData.items.length > 0">
            <div class="card-header">
              <span>{{ semesterData.semester }} — GPA (Hệ 10): {{ semesterGpa10.get(semesterData.semester) }} | GPA (Hệ 4): {{ semesterGpa4.get(semesterData.semester) }}</span>
            </div>

            <div class="table-container">
              <table class="mono-table">

                <thead>
                  <tr>
                    <th>Mã Môn</th>
                    <th>Tên Môn Học</th>
                    <th class="tc">Số TC</th>
                    <th class="tc">Điểm TX1</th>
                    <th class="tc">Điểm TX2</th>
                    <th class="tc">Điểm GK</th>
                    <th class="tc">Điểm CK</th>
                    <th class="tc">Hệ 10</th>
                    <th class="tc">Hệ 4</th>
                    <th class="tc">Điểm Chữ</th>
                    <th class="tc">Trạng Thái</th>
                  </tr>
                </thead>

                <tbody>
                  <tr v-for="g in semesterData.items" :key="g.subjectCode">
                    <td class="font-mono">{{ g.subjectCode }}</td>
                    <td class="fw-600">{{ g.subjectName }}</td>
                    <td class="tc">{{ g.credits }}</td>
                    <td class="tc">{{ g.regular1 !== null ? g.regular1.toFixed(1) : '-' }}</td>
                    <td class="tc">{{ g.regular2 !== null ? g.regular2.toFixed(1) : '-' }}</td>
                    <td class="tc">{{ g.midtermScore !== null ? g.midtermScore.toFixed(1) : '-' }}</td>
                    <td class="tc">{{ g.finalScore !== null ? g.finalScore.toFixed(1) : '-' }}</td>
                    <td class="tc fw-700"
                        :class="g.averageScore !== null && g.pass ? 'text-green' : (g.averageScore !== null && !g.pass ? 'text-red' : '')">
                      {{ g.averageScore !== null ? g.averageScore.toFixed(1) : '-' }}
                    </td>
                    <td class="tc fw-700">
                      {{ g.averageScore !== null ? toScale4(g.averageScore).toFixed(2) : '-' }}
                    </td>
                    <td class="tc font-mono fw-700"
                        :class="g.averageScore !== null ? (toLetter(g.averageScore) !== 'F' ? 'text-green' : 'text-red') : ''">
                      {{ g.averageScore !== null ? toLetter(g.averageScore) : '-' }}
                    </td>
                    <td class="tc">
                      <span class="status-badge"
                            :class="g.pass === null || g.pass === undefined ? 'badge-pending' : (g.pass ? 'badge-pass' : 'badge-fail')">
                        {{ getStatus(g.pass) }}
                      </span>
                    </td>
                  </tr>
                </tbody>

              </table>
            </div>
          </div>
        </template>
      </template>

      <!-- EMPTY -->
      <div v-else class="empty-state">
        <i class="pi pi-inbox" style="font-size:3rem;color:#9ca3af"></i>
        <h3>Chưa có điểm nào</h3>
        <p>Bảng điểm sẽ hiển thị sau khi giảng viên chấm điểm.</p>
      </div>

    </template>
  </div>
</template>

<style scoped>
.mono-wrapper { padding: 1.5rem 2rem; }
.page-header { margin-bottom: 2rem; border-bottom: 1px solid #e5e7eb; padding-bottom: 1rem; }
.breadcrumb { font-size: 0.8rem; color: #6b7280; margin-bottom: 0.5rem; }
.breadcrumb span { color: #111827; font-weight: 600; }
.page-title { font-size: 1.75rem; font-weight: 600; }
.page-subtitle { font-size: 0.875rem; color: #6b7280; }

.loading-center { display: flex; justify-content: center; padding: 4rem; }

.stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; }

.stat-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 1.5rem;
  display: flex;
  gap: 1rem;
}

.stat-icon {
  width: 48px;
  height: 48px;
  display:flex;
  align-items:center;
  justify-content:center;
  border-radius:12px;
}

.bg-purple { background:#f3e8ff; color:#9333ea; }
.bg-blue { background:#dbeafe; color:#2563eb; }

.stat-label { font-size: 0.75rem; color:#6b7280; }
.stat-value { font-size: 1.5rem; font-weight: 600; }

.mono-card { background:#fff; border:1px solid #e5e7eb; border-radius:12px; }
.card-header { padding:1rem; font-weight:600; border-bottom:1px solid #e5e7eb; }

.mono-table { width:100%; border-collapse:collapse; }
.mono-table th { background:#f9fafb; padding:1rem; font-size:0.8rem; text-align:left; }
.mono-table th.tc { text-align:center; }
.mono-table td { padding:1rem; border-top:1px solid #e5e7eb; }

.tc { text-align:center; }
.font-mono { font-family: monospace; color:#6b7280; }

.fw-600 { font-weight:600; }
.fw-700 { font-weight:700; }

.text-green { color:#166534; }
.text-red { color:#dc2626; }

.status-badge {
  padding:0.3rem 0.7rem;
  border-radius:999px;
  font-size:0.7rem;
}

.badge-pass { background:#dcfce7; color:#166534; }
.badge-fail { background:#fee2e2; color:#991b1b; }
.badge-pending { background:#ffffff; color:#6b7280; border: 1px solid #e5e7eb; }

.empty-state { text-align:center; padding:4rem; color:#6b7280; }
</style>