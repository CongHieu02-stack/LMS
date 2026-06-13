<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { apiGet } from '@/lib/api'

interface SubmissionItem {
  id: string
  examId: string
  examTitle: string
  score: number | null
  isForced: boolean
  violations: number
  submittedAt: string
  startedAt: string | null
}

const submissions = ref<SubmissionItem[]>([])
const loading = ref(true)
const selectedDetail = ref<any>(null)
const showDetailModal = ref(false)
const loadingDetail = ref(false)

async function loadSubmissions() {
  loading.value = true
  try {
    const res = await apiGet<{ success: boolean; data: SubmissionItem[] }>('/exam/my-submissions')
    submissions.value = res.data || []
  } catch (err) {
    console.error('Error loading submissions:', err)
  }
  loading.value = false
}

async function viewSubmissionDetail(id: string) {
  loadingDetail.value = true
  selectedDetail.value = null
  showDetailModal.value = true
  try {
    const res = await apiGet<any>(`/exam/submission/${id}`)
    if (res.success) {
      selectedDetail.value = res
    }
  } catch (err) {
    console.error('Error loading submission detail:', err)
  }
  loadingDetail.value = false
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return d.toLocaleString('vi-VN')
}

function formatDuration(startStr: string | null, endStr: string) {
  if (!startStr) return 'Không rõ'
  const start = new Date(startStr).getTime()
  const end = new Date(endStr).getTime()
  const diffMs = end - start
  if (diffMs <= 0) return '0 giây'
  const diffSec = Math.floor(diffMs / 1000)
  const m = Math.floor(diffSec / 60)
  const s = diffSec % 60
  return `${m} phút ${s} giây`
}

onMounted(loadSubmissions)
</script>

<template>
  <div class="mono-wrapper">
    <div class="page-header">
      <div>
        <div class="breadcrumb">Khảo thí / <span>Lịch sử thi</span></div>
        <h1 class="page-title">Lịch Sử Làm Bài Kiểm Tra</h1>
        <div class="page-subtitle">Xem lại danh sách và kết quả các bài kiểm tra bạn đã thực hiện.</div>
      </div>
    </div>

    <div v-if="loading" class="loading-center">
      <i class="pi pi-spin pi-spinner" style="font-size:2rem;color:#7c3aed"></i>
    </div>

    <template v-else>
      <div v-if="submissions.length === 0" class="empty-state">
        <i class="pi pi-history" style="font-size:3rem;color:#9ca3af"></i>
        <h3>Chưa có lịch sử làm bài thi</h3>
        <p>Các bài thi bạn đã hoàn thành sẽ xuất hiện tại đây.</p>
      </div>

      <div v-else class="mono-card">
        <div class="card-header">Lịch sử bài nộp</div>
        <div class="table-container">
          <table class="mono-table">
            <thead>
              <tr>
                <th>Tên bài thi</th>
                <th class="tc">Thời gian bắt đầu</th>
                <th class="tc">Thời gian nộp bài</th>
                <th class="tc">Thời lượng</th>
                <th class="tc">Số lần vi phạm</th>
                <th class="tc">Điểm số</th>
                <th class="tc">Hành động</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in submissions" :key="s.id">
                <td class="fw-600">{{ s.examTitle }}</td>
                <td class="tc">{{ formatDate(s.startedAt) }}</td>
                <td class="tc">{{ formatDate(s.submittedAt) }}</td>
                <td class="tc">{{ formatDuration(s.startedAt, s.submittedAt) }}</td>
                <td class="tc">
                  <span 
                    class="violation-badge" 
                    :class="s.violations > 0 ? (s.violations >= 2 ? 'badge-danger' : 'badge-warning') : 'badge-success'"
                  >
                    {{ s.violations }} lần
                  </span>
                </td>
                <td class="tc fw-700 font-mono" :class="s.score !== null && s.score >= 5 ? 'text-green' : 'text-red'">
                  {{ s.score !== null ? s.score.toFixed(1) : 'Chưa chấm' }}
                </td>
                <td class="tc">
                  <button class="btn-action" @click="viewSubmissionDetail(s.id)">
                    <i class="pi pi-eye mr-1"></i>Xem lại
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <!-- MODAL CHI TIẾT BÀI THI -->
    <div v-if="showDetailModal" class="custom-modal-overlay" @click.self="showDetailModal = false">
      <div class="custom-modal-card max-w-2xl">
        <div class="custom-modal-header">
          <i class="pi pi-file-edit custom-modal-icon"></i>
          <h3 v-if="selectedDetail">{{ selectedDetail.submission.examTitle }}</h3>
          <h3 v-else>Đang tải chi tiết...</h3>
          <button class="modal-close" @click="showDetailModal = false"><i class="pi pi-times"></i></button>
        </div>

        <div class="custom-modal-body modal-scrollable" style="max-height: 70vh;">
          <div v-if="loadingDetail" class="loading-center">
            <i class="pi pi-spin pi-spinner" style="font-size:2rem;color:#7c3aed"></i>
          </div>

          <div v-else-if="selectedDetail" class="detail-content">
            <!-- Thông tin tổng quan -->
            <div class="summary-box">
              <div class="summary-item">
                <span class="lbl">Thời gian làm bài:</span>
                <span class="val">{{ formatDuration(selectedDetail.submission.startedAt, selectedDetail.submission.submittedAt) }}</span>
              </div>
              <div class="summary-item">
                <span class="lbl">Số lần vi phạm:</span>
                <span class="val" :class="{ 'text-red fw-700': selectedDetail.submission.violations > 0 }">
                  {{ selectedDetail.submission.violations }} lần
                </span>
              </div>
              <div class="summary-item">
                <span class="lbl">Điểm số:</span>
                <span class="val fw-700 text-purple" style="font-size: 1.25rem;">
                  {{ selectedDetail.submission.score !== null ? selectedDetail.submission.score.toFixed(1) : '-' }} / 10.0
                </span>
              </div>
            </div>

            <div v-if="!selectedDetail.showAnswers" class="warning-banner mb-6">
              <i class="pi pi-lock mr-2"></i>
              Giảng viên đã khóa tính năng hiển thị đáp án chi tiết cho bài thi này. Bạn chỉ có thể xem lại phương án đã chọn của mình.
            </div>

            <!-- Danh sách câu hỏi -->
            <div class="q-list">
              <div 
                v-for="(q, idx) in selectedDetail.questions" 
                :key="idx" 
                class="q-card"
              >
                <div class="q-header">
                  <strong>Câu {{ idx + 1 }}:</strong> {{ q.text }}
                </div>
                <div class="options-list">
                  <div 
                    v-for="(opt, oIdx) in q.options" 
                    :key="oIdx" 
                    class="opt-item"
                    :class="{
                      'chosen': Number(selectedDetail.submission.answers[idx]?.selected_option) === Number(oIdx),
                      'correct': selectedDetail.showAnswers && Number(q.answer) === Number(oIdx),
                      'incorrect': selectedDetail.showAnswers && Number(selectedDetail.submission.answers[idx]?.selected_option) === Number(oIdx) && Number(q.answer) !== Number(oIdx)
                    }"
                  >
                    <span class="opt-prefix">{{ String.fromCharCode(65 + oIdx) }}.</span>
                    <span class="opt-text">{{ opt }}</span>
                    
                    <span class="badge-status" v-if="Number(selectedDetail.submission.answers[idx]?.selected_option) === Number(oIdx)">
                      (Lựa chọn của bạn)
                    </span>
                    <span class="badge-status" v-if="selectedDetail.showAnswers && Number(q.answer) === Number(oIdx)">
                      (Đáp án đúng)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="custom-modal-footer">
          <button class="btn-cancel" @click="showDetailModal = false">Đóng</button>
        </div>
      </div>
    </div>
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

.mono-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
.card-header { padding: 1rem; font-weight: 600; border-bottom: 1px solid #e5e7eb; background: #f9fafb; color: #111827; }

.table-container { overflow-x: auto; }
.mono-table { width: 100%; border-collapse: collapse; }
.mono-table th { background: #f9fafb; padding: 1rem; font-size: 0.8rem; text-align: left; color: #4b5563; font-weight: 700; border-bottom: 1px solid #e5e7eb; }
.mono-table th.tc { text-align: center; }
.mono-table td { padding: 1rem; border-top: 1px solid #e5e7eb; font-size: 0.9rem; color: #374151; }
.mono-table td.tc { text-align: center; }

.tc { text-align: center; }
.fw-600 { font-weight: 600; }
.fw-700 { font-weight: 700; }
.font-mono { font-family: monospace; }
.text-green { color: #166534; }
.text-red { color: #dc2626; }
.text-purple { color: #7c3aed; }
.mb-6 { margin-bottom: 1.5rem; }

.violation-badge {
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 600;
}
.badge-success { background: #dcfce7; color: #15803d; }
.badge-warning { background: #fef3c7; color: #92400e; }
.badge-danger { background: #fee2e2; color: #b91c1c; }

.btn-action {
  background: none;
  border: 1px solid #7c3aed;
  color: #7c3aed;
  padding: 0.35rem 0.75rem;
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.8rem;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  transition: all 0.2s;
}
.btn-action:hover {
  background: #7c3aed;
  color: #ffffff;
}

.empty-state { text-align: center; padding: 4rem; color: #6b7280; }
.empty-state h3 { font-size: 1.15rem; color: #1e293b; margin-top: 1rem; margin-bottom: 0.25rem; }

/* Modal Custom Styles */
.custom-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
}
.custom-modal-card {
  background: #ffffff;
  border-radius: 12px;
  width: 90%;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.max-w-2xl { max-width: 42rem; }
.custom-modal-header {
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.custom-modal-icon { font-size: 1.25rem; color: #7c3aed; margin-right: 0.5rem; }
.custom-modal-header h3 { font-size: 1.15rem; font-weight: 700; color: #111827; margin: 0; }
.modal-close { background: none; border: none; font-size: 1.15rem; cursor: pointer; color: #9ca3af; }
.modal-close:hover { color: #4b5563; }

.custom-modal-body {
  padding: 1.5rem;
  overflow-y: auto;
}
.custom-modal-footer {
  padding: 1rem 1.5rem;
  background: #f9fafb;
  border-top: 1px solid #e5e7eb;
  display: flex;
  justify-content: flex-end;
}
.btn-cancel {
  background: #ffffff;
  border: 1px solid #d1d5db;
  color: #374151;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
}
.btn-cancel:hover { background: #f9fafb; }

.summary-box {
  display: flex;
  justify-content: space-between;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
}
.summary-item {
  display: flex;
  flex-direction: column;
}
.summary-item .lbl { font-size: 0.75rem; color: #64748b; font-weight: 600; text-transform: uppercase; }
.summary-item .val { font-size: 0.95rem; color: #1e293b; font-weight: 600; margin-top: 0.25rem; }

.warning-banner {
  background: #fffbeb;
  border: 1px solid #fef3c7;
  color: #b45309;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  line-height: 1.5;
}

.q-list { display: flex; flex-direction: column; gap: 1.25rem; }
.q-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem; background: #fff; }
.q-header { font-size: 0.95rem; color: #1e293b; margin-bottom: 0.75rem; line-height: 1.5; }
.options-list { display: flex; flex-direction: column; gap: 0.5rem; }
.opt-item {
  display: flex;
  align-items: center;
  padding: 0.65rem 0.85rem;
  border-radius: 6px;
  font-size: 0.875rem;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  color: #475569;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.opt-prefix { font-weight: 700; color: #64748b; }
.opt-text { flex: 1; }
.badge-status { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; margin-left: auto; }

/* Styles for chosen/correct/incorrect states */
.opt-item.chosen {
  background: #f0fdf4;
  border-color: #bbf7d0;
  color: #15803d;
}
.opt-item.chosen .opt-prefix { color: #166534; }

.opt-item.correct {
  background: #dcfce7;
  border-color: #86efac;
  color: #15803d;
  font-weight: 600;
}
.opt-item.correct .opt-prefix { color: #166534; }

.opt-item.incorrect {
  background: #fef2f2;
  border-color: #fca5a5;
  color: #b91c1c;
}
.opt-item.incorrect .opt-prefix { color: #991b1b; }
</style>
