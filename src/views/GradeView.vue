<script setup lang="ts">
import { ref } from 'vue'

interface GradeItem {
  id: string;
  semester: string;
  subjectCode: string;
  subjectName: string;
  credits: number;
  score: number;
}

const grades = ref<GradeItem[]>([
  { id: '1', semester: 'HK1-2026', subjectCode: 'INT101', subjectName: 'Trí tuệ nhân tạo', credits: 3, score: 8.5 },
  { id: '2', semester: 'HK1-2026', subjectCode: 'WEB202', subjectName: 'Lập trình Web', credits: 4, score: 4.0 },
  { id: '3', semester: 'HK1-2026', subjectCode: 'DB303', subjectName: 'Cơ sở dữ liệu', credits: 3, score: 6.8 },
])

const passingScore = 5.0

function getStatus(score: number) {
  return score >= passingScore ? 'PASS' : 'FAIL'
}

const totalCredits = grades.value.reduce((acc, curr) => acc + curr.credits, 0)
const passedCredits = grades.value.filter(g => g.score >= passingScore).reduce((acc, curr) => acc + curr.credits, 0)
const gpa = (grades.value.reduce((acc, curr) => acc + (curr.score * curr.credits), 0) / totalCredits).toFixed(2)
</script>

<template>
  <div class="mono-wrapper">
    <!-- Header -->
    <div class="page-header">
      <div>
        <div class="breadcrumb">Học vụ / <span>Xem Bảng Điểm</span></div>
        <h1 class="page-title">Bảng Điểm Cá Nhân</h1>
        <div class="page-subtitle">Kết quả học tập các môn học và điểm tích lũy (GPA).</div>
      </div>
    </div>

    <!-- Stats Grid -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon bg-purple-100 text-purple-600"><i class="pi pi-chart-line"></i></div>
        <div class="stat-info">
          <div class="stat-label">Điểm Trung Bình (GPA Hệ 10)</div>
          <div class="stat-value">{{ gpa }}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon bg-blue-100 text-blue-600"><i class="pi pi-book"></i></div>
        <div class="stat-info">
          <div class="stat-label">Tổng Tín Chỉ Tích Lũy</div>
          <div class="stat-value">{{ passedCredits }} <small class="text-gray-500 font-normal">/ {{ totalCredits }} TC</small></div>
        </div>
      </div>
    </div>

    <!-- Table -->
    <div class="mono-card mt-8">
      <div class="card-header">
        <span>Chi tiết điểm số - HK1-2026</span>
        <button class="btn-outline-small"><i class="pi pi-filter"></i> Lọc học kỳ</button>
      </div>
      
      <div class="table-container">
        <table class="mono-table">
          <thead>
            <tr>
              <th>Mã Môn</th>
              <th>Tên Môn Học</th>
              <th class="text-center">Số TC</th>
              <th class="text-center">Hệ Số Điểm</th>
              <th class="text-center">Trạng Thái</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="grade in grades" :key="grade.id">
              <td class="font-mono text-gray-500">{{ grade.subjectCode }}</td>
              <td class="font-semibold text-gray-900">{{ grade.subjectName }}</td>
              <td class="text-center">{{ grade.credits }}</td>
              <td class="text-center font-bold text-lg" :class="grade.score >= passingScore ? 'text-green-600' : 'text-red-600'">
                {{ grade.score.toFixed(1) }}
              </td>
              <td class="text-center">
                <span class="status-badge" :class="getStatus(grade.score) === 'PASS' ? 'badge-pass' : 'badge-fail'">
                  {{ getStatus(grade.score) }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mono-wrapper { padding: 1.5rem 2rem; animation: fadeIn 0.3s ease-out; }

/* Header */
.page-header { margin-bottom: 2rem; border-bottom: 1px solid #e5e7eb; padding-bottom: 1rem; }
.breadcrumb { font-size: 0.8rem; color: #6b7280; font-weight: 500; margin-bottom: 0.5rem; }
.breadcrumb span { color: #111827; font-weight: 600; }
.page-title { font-size: 1.75rem; font-weight: 600; margin: 0 0 0.5rem 0; color: #111827; }
.page-subtitle { font-size: 0.875rem; color: #6b7280; }

/* Stats */
.stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; }
.stat-card {
  background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 1.5rem;
  display: flex; align-items: center; gap: 1.25rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}
.stat-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; }
.bg-purple-100 { background: #f3e8ff; } .text-purple-600 { color: #9333ea; }
.bg-blue-100 { background: #dbeafe; } .text-blue-600 { color: #2563eb; }
.stat-label { font-size: 0.8rem; color: #6b7280; text-transform: uppercase; font-weight: 600; letter-spacing: 0.05em; margin-bottom: 0.25rem; }
.stat-value { font-size: 1.75rem; font-weight: 600; color: #111827; }

/* Card & Table */
.mt-8 { margin-top: 2rem; }
.mono-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); overflow: hidden; }
.card-header {
  background: #f9fafb; padding: 1rem 1.5rem; border-bottom: 1px solid #e5e7eb;
  font-weight: 600; color: #111827; display: flex; justify-content: space-between; align-items: center;
}
.btn-outline-small {
  padding: 0.4rem 0.75rem; border: 1px solid #d1d5db; background: #fff; border-radius: 6px;
  font-size: 0.8rem; font-weight: 500; cursor: pointer; transition: all 0.2s;
}
.btn-outline-small:hover { background: #f3f4f6; }

.table-container { overflow-x: auto; }
.mono-table { width: 100%; border-collapse: collapse; text-align: left; }
.mono-table th { background: #f9fafb; border-bottom: 1px solid #e5e7eb; padding: 1rem; font-size: 0.8rem; font-weight: 600; color: #6b7280; text-transform: uppercase; }
.mono-table td { padding: 1rem; border-bottom: 1px solid #e5e7eb; vertical-align: middle; }
.mono-table tr:hover { background: #f9fafb; }
.mono-table tr:last-child td { border-bottom: none; }

/* Table Utils */
.text-center { text-align: center; }
.font-mono { font-family: monospace; font-size: 0.95rem; }
.font-semibold { font-weight: 600; }
.font-bold { font-weight: 700; }
.text-lg { font-size: 1.125rem; }
.text-gray-500 { color: #6b7280; }
.text-gray-900 { color: #111827; }
.text-green-600 { color: #166534; }
.text-red-600 { color: #dc2626; }
.font-normal { font-weight: 400; }

.status-badge { font-size: 0.7rem; font-weight: 600; padding: 0.3rem 0.75rem; border-radius: 9999px; letter-spacing: 0.05em; }
.badge-pass { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
.badge-fail { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }

@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
</style>
