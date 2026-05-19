<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { apiGet } from '@/lib/api'

interface GradeItem {
  id: string; subjectCode: string; subjectName: string; credits: number; score: number; className: string;
}

const grades = ref<GradeItem[]>([])
const loading = ref(true)
const passingScore = 5.0

async function loadGrades() {
  loading.value = true
  try {
    const res = await apiGet<{ success: boolean; data: any[] }>('/grades/me')
    grades.value = (res.data || []).map((g: any) => ({
      id: g.id,
      subjectCode: g.class?.subject?.code || 'N/A',
      subjectName: g.class?.subject?.name || 'N/A',
      credits: g.class?.subject?.credits || 0,
      score: parseFloat(g.score) || 0,
      className: g.class?.name || ''
    }))
  } catch { /* grades table may be empty */ }
  loading.value = false
}

onMounted(loadGrades)

function getStatus(score: number) { return score >= passingScore ? 'PASS' : 'FAIL' }

const totalCredits = computed(() => grades.value.reduce((acc, g) => acc + g.credits, 0))
const passedCredits = computed(() => grades.value.filter(g => g.score >= passingScore).reduce((acc, g) => acc + g.credits, 0))
const gpa = computed(() => {
  if (totalCredits.value === 0) return '0.00'
  return (grades.value.reduce((acc, g) => acc + g.score * g.credits, 0) / totalCredits.value).toFixed(2)
})
</script>

<template>
  <div class="mono-wrapper">
    <div class="page-header">
      <div>
        <div class="breadcrumb">Học vụ / <span>Xem Bảng Điểm</span></div>
        <h1 class="page-title">Bảng Điểm Cá Nhân</h1>
        <div class="page-subtitle">Kết quả học tập các môn học và điểm tích lũy (GPA).</div>
      </div>
    </div>

    <div v-if="loading" class="loading-center"><i class="pi pi-spin pi-spinner" style="font-size:2rem;color:#6b7280"></i></div>

    <template v-else>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon bg-purple"><i class="pi pi-chart-line"></i></div>
          <div><div class="stat-label">Điểm Trung Bình (GPA Hệ 10)</div><div class="stat-value">{{ gpa }}</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon bg-blue"><i class="pi pi-book"></i></div>
          <div><div class="stat-label">Tổng Tín Chỉ Tích Lũy</div><div class="stat-value">{{ passedCredits }} <small>/ {{ totalCredits }} TC</small></div></div>
        </div>
      </div>

      <div class="mono-card mt-8" v-if="grades.length > 0">
        <div class="card-header"><span>Chi tiết điểm số</span></div>
        <div class="table-container">
          <table class="mono-table">
            <thead><tr><th>Mã Môn</th><th>Tên Môn Học</th><th class="tc">Số TC</th><th class="tc">Điểm</th><th class="tc">Trạng Thái</th></tr></thead>
            <tbody>
              <tr v-for="g in grades" :key="g.id">
                <td class="font-mono">{{ g.subjectCode }}</td>
                <td class="fw-600">{{ g.subjectName }}</td>
                <td class="tc">{{ g.credits }}</td>
                <td class="tc fw-700" :class="g.score >= passingScore ? 'text-green' : 'text-red'">{{ g.score.toFixed(1) }}</td>
                <td class="tc"><span class="status-badge" :class="getStatus(g.score) === 'PASS' ? 'badge-pass' : 'badge-fail'">{{ getStatus(g.score) }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div v-else class="empty-state">
        <i class="pi pi-inbox" style="font-size:3rem;color:#9ca3af"></i>
        <h3>Chưa có điểm nào</h3>
        <p>Bảng điểm sẽ hiển thị sau khi giảng viên chấm điểm.</p>
      </div>
    </template>
  </div>
</template>

<style scoped>
.mono-wrapper { padding: 1.5rem 2rem; animation: fadeIn 0.3s ease-out; }
.page-header { margin-bottom: 2rem; border-bottom: 1px solid #e5e7eb; padding-bottom: 1rem; }
.breadcrumb { font-size: 0.8rem; color: #6b7280; margin-bottom: 0.5rem; } .breadcrumb span { color: #111827; font-weight: 600; }
.page-title { font-size: 1.75rem; font-weight: 600; margin: 0 0 0.5rem 0; color: #111827; }
.page-subtitle { font-size: 0.875rem; color: #6b7280; }
.loading-center { display: flex; justify-content: center; padding: 4rem; }
.stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; }
.stat-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 1.5rem; display: flex; align-items: center; gap: 1.25rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
.stat-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; }
.bg-purple { background: #f3e8ff; color: #9333ea; } .bg-blue { background: #dbeafe; color: #2563eb; }
.stat-label { font-size: 0.8rem; color: #6b7280; text-transform: uppercase; font-weight: 600; margin-bottom: 0.25rem; }
.stat-value { font-size: 1.75rem; font-weight: 600; color: #111827; }
.stat-value small { font-size: 0.9rem; color: #6b7280; font-weight: 400; }
.mt-8 { margin-top: 2rem; }
.mono-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); overflow: hidden; }
.card-header { background: #f9fafb; padding: 1rem 1.5rem; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #111827; }
.table-container { overflow-x: auto; }
.mono-table { width: 100%; border-collapse: collapse; }
.mono-table th { background: #f9fafb; border-bottom: 1px solid #e5e7eb; padding: 1rem; font-size: 0.8rem; font-weight: 600; color: #6b7280; text-transform: uppercase; text-align: left; }
.mono-table td { padding: 1rem; border-bottom: 1px solid #e5e7eb; }
.mono-table tr:hover { background: #f9fafb; }
.mono-table tr:last-child td { border-bottom: none; }
.tc { text-align: center; }
.font-mono { font-family: monospace; color: #6b7280; }
.fw-600 { font-weight: 600; color: #111827; } .fw-700 { font-weight: 700; font-size: 1.125rem; }
.text-green { color: #166534; } .text-red { color: #dc2626; }
.status-badge { font-size: 0.7rem; font-weight: 600; padding: 0.3rem 0.75rem; border-radius: 9999px; }
.badge-pass { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
.badge-fail { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
.empty-state { text-align: center; padding: 4rem; color: #6b7280; }
.empty-state h3 { margin: 1rem 0 0.5rem; color: #111827; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
</style>
