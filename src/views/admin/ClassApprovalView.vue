<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { apiGet, apiPut } from '@/lib/api'

const proposals = ref<any[]>([])
const loading = ref(true)
const processing = ref<string | null>(null)
const msg = ref<string | null>(null)

async function loadPending() {
  loading.value = true
  try {
    const res = await apiGet<{ success: boolean; data: any[] }>('/class-proposals/pending')
    proposals.value = res.data || []
  } catch {}
  loading.value = false
}

onMounted(loadPending)

async function handleAction(id: string, status: 'approved' | 'rejected') {
  processing.value = id; msg.value = null
  try {
    const res = await apiPut<{ success: boolean; message: string }>(`/class-proposals/${id}/status`, { status })
    msg.value = res.message
    proposals.value = proposals.value.filter(p => p.id !== id)
  } catch (err: any) { msg.value = err.message }
  processing.value = null
}
</script>

<template>
  <div class="mono-wrapper">
    <div class="page-header">
      <div>
        <div class="breadcrumb">Quản lý Lớp học / <span>Duyệt đề xuất SL lớp</span></div>
        <h1 class="page-title">Duyệt Đề Xuất Số Lượng Lớp</h1>
        <div class="page-subtitle">Phòng đào tạo xem xét và phê duyệt các đề xuất mở lớp từ Trưởng bộ môn.</div>
      </div>
    </div>

    <div v-if="msg" class="alert"><i class="pi pi-info-circle"></i> {{ msg }}</div>
    <div v-if="loading" class="loading"><i class="pi pi-spin pi-spinner"></i></div>

    <div v-else-if="proposals.length === 0" class="empty">
      <i class="pi pi-check-circle" style="font-size:3rem;color:#22c55e"></i>
      <h3>Không có đề xuất nào chờ duyệt</h3>
    </div>

    <div v-else class="table-card">
      <table class="mono-table">
        <thead><tr><th>Môn học</th><th class="tc">SL lớp</th><th>Học kỳ</th><th>Người đề xuất</th><th>Lý do</th><th class="tc">Hành động</th></tr></thead>
        <tbody>
          <tr v-for="p in proposals" :key="p.id">
            <td><strong>{{ p.subject?.code }}</strong> — {{ p.subject?.name }}</td>
            <td class="tc fw-700">{{ p.quantity }}</td>
            <td>{{ p.semester }}</td>
            <td>{{ p.proposer?.full_name || 'N/A' }}</td>
            <td class="reason">{{ p.reason || '—' }}</td>
            <td class="tc actions">
              <button class="btn-approve" @click="handleAction(p.id, 'approved')" :disabled="processing === p.id"><i class="pi pi-check"></i> Duyệt</button>
              <button class="btn-reject" @click="handleAction(p.id, 'rejected')" :disabled="processing === p.id"><i class="pi pi-times"></i> Từ chối</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.mono-wrapper { padding: 1.5rem 2rem; animation: fadeIn 0.3s ease-out; }
.page-header { margin-bottom: 2rem; border-bottom: 1px solid #e5e7eb; padding-bottom: 1rem; }
.breadcrumb { font-size: 0.8rem; color: #6b7280; margin-bottom: 0.5rem; } .breadcrumb span { color: #111827; font-weight: 600; }
.page-title { font-size: 1.75rem; font-weight: 600; margin: 0 0 0.5rem 0; color: #111827; }
.page-subtitle { font-size: 0.875rem; color: #6b7280; }
.alert { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1.25rem; border-radius: 8px; font-size: 0.875rem; margin-bottom: 1.5rem; background: #dbeafe; border: 1px solid #bfdbfe; color: #1e40af; }
.loading { display: flex; justify-content: center; padding: 4rem; font-size: 2rem; color: #6b7280; }
.empty { text-align: center; padding: 4rem; color: #6b7280; } .empty h3 { margin: 1rem 0; color: #111827; }
.table-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); overflow: hidden; }
.mono-table { width: 100%; border-collapse: collapse; }
.mono-table th { background: #f9fafb; border-bottom: 1px solid #e5e7eb; padding: 1rem; font-size: 0.8rem; font-weight: 600; color: #6b7280; text-transform: uppercase; text-align: left; }
.mono-table td { padding: 1rem; border-bottom: 1px solid #e5e7eb; font-size: 0.9rem; }
.mono-table tr:hover { background: #f9fafb; }
.tc { text-align: center; } .fw-700 { font-weight: 700; font-size: 1.1rem; color: #111827; }
.reason { max-width: 200px; color: #6b7280; font-size: 0.85rem; }
.actions { display: flex; gap: 0.5rem; justify-content: center; }
.btn-approve { padding: 0.4rem 0.75rem; background: #166534; color: #fff; border: none; border-radius: 6px; font-size: 0.8rem; font-weight: 500; cursor: pointer; display: flex; align-items: center; gap: 0.3rem; }
.btn-approve:hover { background: #15803d; }
.btn-reject { padding: 0.4rem 0.75rem; background: #fff; color: #dc2626; border: 1px solid #fecaca; border-radius: 6px; font-size: 0.8rem; font-weight: 500; cursor: pointer; display: flex; align-items: center; gap: 0.3rem; }
.btn-reject:hover { background: #fef2f2; }
button:disabled { opacity: 0.5; cursor: not-allowed; }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
</style>
