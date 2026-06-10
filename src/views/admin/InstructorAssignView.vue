<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { apiGet, apiPut } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const classes = ref<any[]>([])
const instructors = ref<any[]>([])
const loading = ref(true)
const saving = ref<string | null>(null)
const msg = ref<string | null>(null)
const selectedInstructor = ref<Record<string, string>>({})
const searchQuery = ref('')

const filteredClasses = computed(() => {
  if (!searchQuery.value) return classes.value
  const q = searchQuery.value.toLowerCase()
  return classes.value.filter(c => {
    return (
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.subject?.name && c.subject.name.toLowerCase().includes(q)) ||
      (c.subject?.department && c.subject.department.toLowerCase().includes(q)) ||
      (c.instructor?.fullName && c.instructor.fullName.toLowerCase().includes(q)) ||
      (c.instructor?.full_name && c.instructor.full_name.toLowerCase().includes(q))
    )
  })
})

async function loadData() {
  loading.value = true
  try {
    const [cRes, pRes] = await Promise.all([
      apiGet<any>('/classes'),
      apiGet<{ success: boolean; data: any[] }>('/profiles')
    ])
    const cd = cRes.data || cRes
    const cdList = Array.isArray(cd) ? cd : []
    const allInstructors = pRes.data || []

    if (authStore.profile?.role === 'TRUONG_BO_MON' && authStore.profile?.department) {
      const userDept = authStore.profile.department
      classes.value = cdList.filter((c: any) => c.subject?.department === userDept)
      instructors.value = allInstructors.filter((p: any) => p.role === 'GIANG_VIEN')
    } else {
      classes.value = cdList
      instructors.value = allInstructors.filter((p: any) => p.role === 'GIANG_VIEN')
    }
  } catch {}
  loading.value = false
}
onMounted(loadData)

async function handleAssign(classId: string) {
  const iId = selectedInstructor.value[classId]
  if (!iId) return
  saving.value = classId; msg.value = null
  try {
    const res = await apiPut<{ success: boolean; message: string }>(`/classes/${classId}/instructor`, { instructorId: iId })
    msg.value = res.message
    loadData()
  } catch (err: any) { msg.value = err.message }
  saving.value = null
}
</script>

<template>
  <div class="w">
    <div class="hdr"><div class="bc">Quản lý Lớp học / <span>Phân công GV</span></div>
      <h1 class="tt">Phân Công Giảng Viên</h1>
      <div class="st">
        <span v-if="authStore.profile?.role === 'TRUONG_BO_MON' && authStore.profile?.department">
          Trưởng bộ môn quản lý và phân công giảng viên vào các lớp học thuộc <strong>{{ authStore.profile.department }}</strong>.
        </span>
        <span v-else>
          Trưởng bộ môn phân công giảng viên vào các lớp học.
        </span>
      </div></div>
    <div v-if="msg" class="al"><i class="pi pi-info-circle"></i> {{ msg }}</div>
    
    <!-- Search Bar -->
    <div class="search-container mb-6" v-if="!loading && classes.length > 0">
      <div class="search-box">
        <i class="pi pi-search search-icon"></i>
        <input
          type="text"
          v-model="searchQuery"
          placeholder="Tìm tên lớp, tên môn học, giảng viên..."
          class="search-input"
        />
      </div>
    </div>

    <div v-if="loading" class="ld"><i class="pi pi-spin pi-spinner"></i></div>
    <div v-else-if="filteredClasses.length===0" class="emp"><i class="pi pi-inbox" style="font-size:3rem;color:#9ca3af"></i><h3>Chưa có lớp nào</h3></div>
    <div v-else class="tc">
      <table class="mt">
        <thead>
          <tr>
            <th>Lớp</th>
            <th>Môn</th>
            <th>Khoa</th>
            <th>GV hiện tại</th>
            <th>Gán GV</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in filteredClasses" :key="c.id">
            <td class="fw">{{ c.name }}</td>
            <td>{{ c.subject?.name || '' }}</td>
            <td>
              <span class="dep-badge">{{ c.subject?.department || '—' }}</span>
            </td>
            <td>{{ c.instructor?.fullName || c.instructor?.full_name || '—' }}</td>
            <td>
              <select v-model="selectedInstructor[c.id]" class="si" :disabled="!!c.instructorId || !!c.instructor">
                <option value="">-- Chọn --</option>
                <option v-for="i in instructors" :key="i.id" :value="i.id">
                  {{ i.fullName || i.full_name }}
                </option>
              </select>
            </td>
            <td>
              <button class="btn" @click="handleAssign(c.id)" :disabled="!!c.instructorId || !!c.instructor || !selectedInstructor[c.id] || saving===c.id">
                <i v-if="saving===c.id" class="pi pi-spin pi-spinner"></i>
                <i v-else class="pi pi-user-plus"></i> Gán
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.w{padding:1.5rem 2rem;animation:fadeIn .3s ease-out}
.hdr{margin-bottom:2rem;border-bottom:1px solid #e5e7eb;padding-bottom:1rem}
.bc{font-size:.8rem;color:#6b7280;margin-bottom:.5rem} .bc span{color:#111827;font-weight:600}
.tt{font-size:1.75rem;font-weight:600;margin:0 0 .5rem;color:#111827}
.st{font-size:.875rem;color:#6b7280}
.al{display:flex;align-items:center;gap:.75rem;padding:.75rem 1.25rem;border-radius:8px;font-size:.875rem;margin-bottom:1.5rem;background:#dbeafe;border:1px solid #bfdbfe;color:#1e40af}
.ld{display:flex;justify-content:center;padding:4rem;font-size:2rem;color:#6b7280}
.emp{text-align:center;padding:4rem;color:#6b7280} .emp h3{margin:1rem 0;color:#111827}
.tc{background:#fff;border:1px solid #e5e7eb;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,.05);overflow:hidden}
.mt{width:100%;border-collapse:collapse}
.mt th{background:#f9fafb;border-bottom:1px solid #e5e7eb;padding:1rem;font-size:.8rem;font-weight:600;color:#6b7280;text-transform:uppercase;text-align:left}
.mt td{padding:1rem;border-bottom:1px solid #e5e7eb;font-size:.9rem}
.mt tr:hover{background:#f9fafb}
.fw{font-weight:600;color:#111827}
.si{padding:.4rem .75rem;border:1px solid #d1d5db;border-radius:6px;font-size:.85rem;min-width:180px}
.btn{padding:.4rem .75rem;background:#111827;color:#fff;border:none;border-radius:6px;font-size:.8rem;font-weight:500;cursor:pointer;display:flex;align-items:center;gap:.3rem}
.btn:hover:not(:disabled){background:#374151} .btn:disabled{opacity:.5;cursor:not-allowed}
.dep-badge { font-size: 0.72rem; font-weight: 600; color: #7c3aed; background-color: #f5f3ff; padding: 0.15rem 0.4rem; border-radius: 4px; display: inline-block; }
@keyframes fadeIn{from{opacity:0}to{opacity:1}}

.search-container {
  width: 100%;
}
.search-box {
  position: relative;
  width: 100%;
}
.search-icon {
  position: absolute;
  left: 1rem;
  top: 50%;
  transform: translateY(-50%);
  color: #9ca3af;
}
.search-input {
  width: 100%;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 0.6rem 1rem 0.6rem 2.5rem;
  font-size: 0.875rem;
  outline: none;
  background-color: #fff;
  font-weight: 500;
  transition: border-color 0.2s, box-shadow 0.2s;
  box-sizing: border-box;
}
.search-input:focus {
  border-color: #7c3aed;
  box-shadow: 0 0 0 3px rgba(124,58,237,0.1);
}
.mb-6 {
  margin-bottom: 1.5rem;
}
</style>
