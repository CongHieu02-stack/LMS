<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { apiGet, apiPost, apiDelete, apiPut } from '@/lib/api'
import { useAdminActions } from '@/composables/useAdminActions'
import ReasonDialog from '@/components/ReasonDialog.vue'
import ConfirmDialog from 'primevue/confirmdialog'
import { useConfirm } from 'primevue/useconfirm'

const authStore = useAuthStore()
const confirmPrime = useConfirm()

// State
const profiles = ref<any[]>([])
const loading = ref(false)
const submitLoading = ref(false)
const errorMessage = ref<string | null>(null)
const successMessage = ref<string | null>(null)

// Search & Filter State
const searchQuery = ref('')
const roleFilter = ref('')

// Form State
const showCreateModal = ref(false)
const formEmail = ref('')
const formPassword = ref('')
const formConfirmPassword = ref('')
const formFullName = ref('')
const formRole = ref('HR')
const formDepartment = ref('Khoa Công nghệ thông tin')
const showPassword = ref(false)
const showConfirmPassword = ref(false)

const departments = [
  'Khoa Công nghệ thông tin',
  'Khoa Quản trị - Marketing',
  'Khoa Tài chính - Thương mại',
  'Khoa Khoa học Xã hội & Ngôn ngữ Quốc tế',
  'Khoa Truyền thông số',
  'Khoa Khoa học Sức khỏe'
]

// Password strength validation rules
const passwordRules = computed(() => [
  { label: 'Ít nhất 8 ký tự', valid: formPassword.value.length >= 8 },
  { label: 'Chứa chữ cái viết hoa (A-Z)', valid: /[A-Z]/.test(formPassword.value) },
  { label: 'Chứa chữ cái viết thường (a-z)', valid: /[a-z]/.test(formPassword.value) },
  { label: 'Chứa chữ số (0-9)', valid: /[0-9]/.test(formPassword.value) },
  { label: 'Chứa ký tự đặc biệt (!@#$%...)', valid: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(formPassword.value) },
])

const isPasswordStrong = computed(() => passwordRules.value.every(r => r.valid))
const passwordsMatch = computed(() => formPassword.value && formConfirmPassword.value && formPassword.value === formConfirmPassword.value)

const rolesList = [
  { label: 'Hiệu trưởng', value: 'HIEU_TRUONG' },
  { label: 'Nhân sự (HR)', value: 'HR' },
  { label: 'Phòng đào tạo', value: 'PHONG_DAO_TAO' },
  { label: 'Trưởng bộ môn', value: 'TRUONG_BO_MON' },
  { label: 'Giảng viên', value: 'GIANG_VIEN' },
  { label: 'Sinh viên', value: 'SINH_VIEN' },
]

const RANK_MAP: Record<string, number> = {
  ADMIN: 100,
  HIEU_TRUONG: 90,
  HR: 80,
  PHONG_DAO_TAO: 70,
  TRUONG_BO_MON: 60,
  GIANG_VIEN: 50,
  SINH_VIEN: 10,
}

const effectiveRank = computed(() => {
  let rank = authStore.profile?.rank || 0
  if (authStore.hasPermission('user_manage_senior')) rank = Math.max(rank, 90)
  else if (authStore.hasPermission('user_manage_staff')) rank = Math.max(rank, 80)
  return rank
})

const availableRoles = computed(() => {
  return rolesList.filter((role) => RANK_MAP[role.value] <= effectiveRank.value)
})

// useAdminActions Composable for password resets and locking
const {
  showModal: showAdminModal,
  targetId: adminTargetId,
  actionType: adminActionType,
  reason: adminReason,
  password: adminPassword,
  submitting: adminSubmitting,
  errorMsg: adminErrorMsg,
  openReasonModal,
  submitAction
} = useAdminActions(async () => {
  successMessage.value = 'Thao tác cập nhật trạng thái người dùng thành công.'
  await fetchProfiles()
})

const filteredProfiles = computed(() => {
  return profiles.value.filter((u) => {
    const matchesSearch =
      !searchQuery.value.trim() ||
      u.fullName.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.value.toLowerCase())

    const matchesRole =
      !roleFilter.value ||
      u.role === roleFilter.value

    return matchesSearch && matchesRole
  })
})

const adminModalInputValue = computed({
  get: () => {
    return adminActionType.value === 'RESET_PASSWORD' ? adminPassword.value : adminReason.value
  },
  set: (val) => {
    if (adminActionType.value === 'RESET_PASSWORD') {
      adminPassword.value = val
    } else {
      adminReason.value = val
    }
  }
})

// Hàm fetch danh sách profiles
async function fetchProfiles() {
  loading.value = true
  errorMessage.value = null
  try {
    const res = await apiGet<any>('/profiles')
    profiles.value = res.data || []
  } catch (err) {
    errorMessage.value = (err as Error).message || 'Không thể tải danh sách hồ sơ.'
  } finally {
    loading.value = false
  }
}

// Xử lý tạo mới user
async function handleCreateUser() {
  if (
    !formEmail.value ||
    !formPassword.value ||
    !formConfirmPassword.value ||
    !formFullName.value
  ) {
    errorMessage.value = 'Vui lòng điền đầy đủ thông tin.'
    return
  }

  if (!isPasswordStrong.value) {
    errorMessage.value = 'Mật khẩu chưa đủ mạnh. Vui lòng đáp ứng tất cả yêu cầu bên dưới.'
    return
  }

  if (formPassword.value !== formConfirmPassword.value) {
    errorMessage.value = 'Mật khẩu xác nhận không khớp!'
    return
  }

  submitLoading.value = true
  errorMessage.value = null
  successMessage.value = null

  try {
    const res = await apiPost<any>('/profiles', {
      email: formEmail.value,
      password: formPassword.value,
      fullName: formFullName.value,
      role: formRole.value,
      department: formRole.value === 'TRUONG_BO_MON' ? formDepartment.value : undefined
    })

    if (res.success) {
      successMessage.value = res.message || 'Tạo tài khoản thành công.'
      showCreateModal.value = false
      formEmail.value = ''
      formPassword.value = ''
      formConfirmPassword.value = ''
      formFullName.value = ''
      formRole.value = 'HR'
      await fetchProfiles()
    }
  } catch (err) {
    errorMessage.value = (err as Error).message || 'Lỗi khi tạo tài khoản.'
  } finally {
    submitLoading.value = false
  }
}

// Xử lý xóa user
async function handleDeleteUser(user: any) {
  const actorRank = authStore.profile?.rank || 0
  if (user.rank >= actorRank) {
    alert('Bạn không có quyền xóa tài khoản có cấp bậc bằng hoặc cao hơn.')
    return
  }
  if (user.id === authStore.profile?.id) {
    alert('Bạn không thể tự xóa chính mình.')
    return
  }

  confirmPrime.require({
    message: `Bạn có chắc chắn muốn xóa tài khoản "${user.fullName}" (${user.email}) không?`,
    header: 'Xác nhận xóa tài khoản',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    accept: async () => {
      loading.value = true
      errorMessage.value = null
      successMessage.value = null

      try {
        const res = await apiDelete<any>(`/profiles/${user.id}`)
        if (res.success) {
          successMessage.value = res.message || 'Xóa tài khoản thành công.'
          await fetchProfiles()
        }
      } catch (err) {
        errorMessage.value = (err as Error).message || 'Lỗi khi xóa tài khoản.'
      } finally {
        loading.value = false
      }
    }
  })
}

// Mở khóa người dùng trực tiếp
async function handleUnlockUser(user: any) {
  confirmPrime.require({
    message: `Bạn có muốn MỞ KHÓA tài khoản "${user.fullName}" không?`,
    header: 'Xác nhận mở khóa',
    icon: 'pi pi-unlock',
    acceptClass: 'p-button-success',
    accept: async () => {
      loading.value = true
      errorMessage.value = null
      successMessage.value = null

      try {
        const res = await apiPut<any>(`/profiles/${user.id}/lock`, {
          isLocked: false
        })
        if (res.success) {
          successMessage.value = `Đã mở khóa tài khoản "${user.fullName}" thành công.`
          await fetchProfiles()
        }
      } catch (err) {
        errorMessage.value = (err as Error).message || 'Gặp lỗi khi mở khóa tài khoản.'
      } finally {
        loading.value = false
      }
    }
  })
}

function openCreateModal() {
  errorMessage.value = null
  successMessage.value = null
  showCreateModal.value = true

  if (availableRoles.value.length > 0) {
    formRole.value = availableRoles.value[0].value
  } else {
    formRole.value = 'SINH_VIEN'
  }
}

const route = useRoute()
const router = useRouter()

// Watch for query changes to automatically open the create modal
watch(
  () => route.query.action,
  (newAction) => {
    if (newAction === 'create') {
      openCreateModal()
    } else {
      showCreateModal.value = false
    }
  },
  { immediate: true }
)

// When create modal is closed manually, clear the action query param
watch(showCreateModal, (val) => {
  if (!val && route.query.action === 'create') {
    router.replace({ query: { ...route.query, action: undefined } })
  }
})

onMounted(() => {
  fetchProfiles()
})
</script>

<template>
  <div class="mono-wrapper">
    <!-- Header -->
    <div class="page-header">
      <div>
        <div class="breadcrumb">Quản trị / <span>Quản lý Nhân sự</span></div>
        <h1 class="page-title">Quản lý Nhân sự</h1>
        <div class="page-subtitle">Tạo, phân quyền và quản lý tài khoản nhân viên trường học.</div>
      </div>
      <button class="btn-create" @click="openCreateModal">
        <i class="pi pi-plus"></i> Thêm Nhân viên
      </button>
    </div>

    <!-- Alert thông báo -->
    <div v-if="errorMessage && !showCreateModal" class="mono-alert alert-error">
      <i class="pi pi-exclamation-triangle"></i>
      <div><strong>LỖI:</strong> {{ errorMessage }}</div>
    </div>
    <div v-if="successMessage && !showCreateModal" class="mono-alert alert-success">
      <i class="pi pi-check"></i>
      <div><strong>THÀNH CÔNG:</strong> {{ successMessage }}</div>
    </div>

    <!-- Bảng danh sách tài khoản -->
    <div class="mono-card">
      <div class="card-header">
        <span>Danh sách tài khoản</span>
        <i class="pi pi-users"></i>
      </div>

      <!-- Tìm kiếm & Bộ lọc (Thoả mãn Use Case tìm kiếm & lọc vai trò) -->
      <div class="filter-bar flex gap-md p-md" style="background-color: #fafafa; border-bottom: 1px solid #e5e7eb; flex-wrap: wrap; gap: 16px; padding: 16px;">
        <div class="form-group" style="flex: 1; min-width: 200px; display: flex; flex-direction: column; gap: 8px;">
          <input
            v-model="searchQuery"
            type="text"
            class="mono-input"
            placeholder="🔍 Tìm kiếm theo họ tên hoặc email..."
            style="width: 100%; padding: 10px 12px; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.9rem;"
          />
        </div>
        <div class="form-group" style="min-width: 180px; display: flex; flex-direction: column; gap: 8px;">
          <select 
            v-model="roleFilter" 
            class="mono-input" 
            style="width: 100%; padding: 10px 12px; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.9rem; background: #fff;"
          >
            <option value="">Tất cả vai trò</option>
            <option v-for="role in rolesList" :key="role.value" :value="role.value">
              {{ role.label }}
            </option>
          </select>
        </div>
      </div>

      <div v-if="loading && profiles.length === 0" class="loading-state">
        <i class="pi pi-spin pi-spinner spinner"></i>
        <div>Đang tải dữ liệu...</div>
      </div>

      <div v-else class="table-container">
        <table class="mono-table">
          <thead>
            <tr>
              <th>Họ tên nhân viên</th>
              <th>Địa chỉ Email</th>
              <th>Vai trò (Role)</th>
              <th class="text-center">Trạng thái</th>
              <th class="text-center">Cấp bậc</th>
              <th class="text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="user in filteredProfiles"
              :key="user.id"
              class="table-row"
              :class="{ 'row-self': user.id === authStore.profile?.id }"
            >
              <td>
                <div class="user-name" :style="user.isLocked ? 'text-decoration: line-through; color: #9ca3af;' : ''">
                  {{ user.fullName }}
                </div>
                <div v-if="user.id === authStore.profile?.id" class="self-tag">(Bạn hiện tại)</div>
              </td>
              <td class="email-cell">{{ user.email }}</td>
              <td>
                <span class="mono-badge" :class="`badge-rank-${Math.floor(user.rank / 10) * 10}`">
                  {{ user.displayRole }}
                </span>
              </td>
              <td class="text-center">
                <span 
                  v-if="user.isLocked" 
                  class="mono-badge" 
                  style="background: #fee2e2; color: #ef4444; border-color: #fca5a5;"
                  :title="`Lý do khóa: ${user.lockReason || 'Không có'}`"
                >
                  🔒 Bị khóa
                </span>
                <span 
                  v-else 
                  class="mono-badge" 
                  style="background: #d1fae5; color: #10b981; border-color: #a7f3d0;"
                >
                  ✅ Hoạt động
                </span>
              </td>
              <td class="text-center font-black rank-cell">{{ user.rank }}</td>
              <td class="text-right" style="display: flex; gap: 8px; justify-content: flex-end; align-items: center;">
                <!-- Khóa/Mở khóa (Use Case Khóa người dùng kèm lý do) -->
                <button
                  v-if="!user.isLocked"
                  class="btn-icon btn-lock"
                  :disabled="user.rank >= effectiveRank || user.id === authStore.profile?.id"
                  title="Khóa tài khoản nhân sự"
                  @click="openReasonModal(user.id, 'user', 'KHOA')"
                >
                  <i class="pi pi-lock"></i>
                </button>
                <button
                  v-else
                  class="btn-icon btn-unlock"
                  :disabled="user.rank >= effectiveRank || user.id === authStore.profile?.id"
                  title="Mở khóa tài khoản nhân sự"
                  @click="handleUnlockUser(user)"
                >
                  <i class="pi pi-lock-open"></i>
                </button>

                <!-- Reset mật khẩu (Use Case Reset mật khẩu) -->
                <button
                  class="btn-icon btn-reset"
                  :disabled="user.rank >= effectiveRank || user.id === authStore.profile?.id"
                  title="Đặt lại mật khẩu mới"
                  @click="openReasonModal(user.id, 'user', 'RESET_PASSWORD')"
                >
                  <i class="pi pi-key"></i>
                </button>

              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal Tạo Nhân viên -->
    <div v-if="showCreateModal" class="mono-modal-overlay" @click.self="showCreateModal = false">
      <div class="mono-modal">
        <div class="modal-header">
          <span>Thêm Nhân Viên</span>
          <button class="btn-close" @click="showCreateModal = false">
            <i class="pi pi-times"></i>
          </button>
        </div>

        <form @submit.prevent="handleCreateUser" autocomplete="off" class="modal-form">
          <div class="modal-body">
            <div v-if="errorMessage" class="mono-alert alert-error mb-4">
              <i class="pi pi-exclamation-triangle"></i> {{ errorMessage }}
            </div>

            <div class="form-group">
              <label class="form-label">Họ tên đầy đủ</label>
              <input
                v-model="formFullName"
                type="text"
                class="mono-input"
                placeholder="Nguyễn Văn A"
                required
              />
            </div>

            <div class="form-group">
              <label class="form-label">Địa chỉ Email</label>
              <input
                v-model="formEmail"
                type="email"
                class="mono-input"
                placeholder="email@example.com"
                required
                autocomplete="off"
              />
            </div>

            <div class="grid-2">
              <div class="form-group">
                <label class="form-label">Mật khẩu</label>
                <div class="input-password-wrapper">
                  <input
                    v-model="formPassword"
                    :type="showPassword ? 'text' : 'password'"
                    class="mono-input"
                    placeholder="Mật khẩu mạnh"
                    required
                    autocomplete="new-password"
                  />
                  <button type="button" class="btn-toggle-pw" @click="showPassword = !showPassword" tabindex="-1">
                    <i :class="showPassword ? 'pi pi-eye-slash' : 'pi pi-eye'"></i>
                  </button>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Xác nhận</label>
                <div class="input-password-wrapper">
                  <input
                    v-model="formConfirmPassword"
                    :type="showConfirmPassword ? 'text' : 'password'"
                    class="mono-input"
                    placeholder="Nhập lại mật khẩu"
                    required
                    autocomplete="new-password"
                  />
                  <button type="button" class="btn-toggle-pw" @click="showConfirmPassword = !showConfirmPassword" tabindex="-1">
                    <i :class="showConfirmPassword ? 'pi pi-eye-slash' : 'pi pi-eye'"></i>
                  </button>
                </div>
                <div v-if="formConfirmPassword && !passwordsMatch" class="pw-mismatch">
                  <i class="pi pi-times-circle"></i> Mật khẩu không khớp
                </div>
                <div v-if="passwordsMatch" class="pw-match">
                  <i class="pi pi-check-circle"></i> Mật khẩu khớp
                </div>
              </div>
            </div>

            <!-- Password strength checklist -->
            <div v-if="formPassword" class="pw-strength-box">
              <div class="pw-strength-title">Yêu cầu mật khẩu:</div>
              <ul class="pw-rules-list">
                <li v-for="(rule, idx) in passwordRules" :key="idx" :class="{ 'rule-pass': rule.valid, 'rule-fail': !rule.valid }">
                  <i :class="rule.valid ? 'pi pi-check-circle' : 'pi pi-circle'"></i>
                  {{ rule.label }}
                </li>
              </ul>
            </div>

            <div class="grid-2">
              <div class="form-group">
                <label class="form-label">Vai trò chức vụ</label>
                <div class="select-wrapper">
                  <select v-model="formRole" class="mono-input">
                    <option v-for="role in availableRoles" :key="role.value" :value="role.value">
                      {{ role.label }}
                    </option>
                  </select>
                </div>
              </div>

              <!-- Chỉ hiện ra khi chọn Trưởng bộ môn -->
              <div v-if="formRole === 'TRUONG_BO_MON'" class="form-group">
                <label class="form-label">Khoa / Bộ môn phụ trách</label>
                <div class="select-wrapper">
                  <select v-model="formDepartment" class="mono-input">
                    <option v-for="dept in departments" :key="dept" :value="dept">
                      {{ dept }}
                    </option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn-cancel" @click="showCreateModal = false">Hủy</button>
            <button type="submit" class="btn-submit" :disabled="!!submitLoading || (!!formPassword && !isPasswordStrong) || (!!formConfirmPassword && !passwordsMatch)">
              <i v-if="submitLoading" class="pi pi-spin pi-spinner"></i>
              Tạo tài khoản
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal nhập lý do & Reset mật khẩu của Admin (quan hệ <<include>>) -->
    <ReasonDialog
      :visible="showAdminModal"
      :title="adminActionType === 'RESET_PASSWORD' ? 'Đặt lại mật khẩu nhân viên' : 'Khóa tài khoản nhân sự'"
      :action-type="adminActionType"
      v-model="adminModalInputValue"
      :submitting="adminSubmitting"
      :error="adminErrorMsg"
      @submit="submitAction"
      @close="showAdminModal = false"
    />

    <!-- PrimeVue ConfirmDialog for Delete & Unlock -->
    <ConfirmDialog></ConfirmDialog>
  </div>
</template>

<style scoped>
.mono-wrapper {
  display: flex;
  flex-direction: column;
  padding: 1rem 2rem;
  box-sizing: border-box;
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
.breadcrumb {
  font-size: 0.75rem;
  /* text-transform: removed */
  letter-spacing: normal;
  color: #9ca3af;
  font-weight: 600;
  margin-bottom: 0.5rem;
}
.breadcrumb span {
  color: #111827;
  font-weight: 600;
}
.page-title {
  font-size: 2rem;
  font-weight: 600;
  letter-spacing: normal;
  /* text-transform: removed */
  margin: 0 0 0.5rem 0;
  color: #111827;
}
.page-subtitle {
  font-size: 0.875rem;
  color: #6b7280;
}

/* Header Button */
.btn-create {
  background: #7c3aed;
  color: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow:
    0 1px 3px 0 rgba(0, 0, 0, 0.05),
    0 1px 2px -1px rgba(0, 0, 0, 0.03);
  padding: 0.75rem 1.5rem;
  font-weight: 600;
  /* text-transform: removed */
  letter-spacing: normal;
  font-size: 0.875rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.2s;
}
.btn-create:hover {
  transform: translate(2px, 2px);
  box-shadow:
    0 1px 3px 0 rgba(0, 0, 0, 0.05),
    0 1px 2px -1px rgba(0, 0, 0, 0.03);
  background: #7e22ce;
}

/* Alerts */
.mono-alert {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.5rem;
  margin-bottom: 1.5rem;
  font-size: 0.875rem;
}
.mono-alert i {
  font-size: 1.25rem;
}
.alert-error {
  background-color: #fef2f2;
  border: 2px solid #ef4444;
  color: #b91c1c;
  box-shadow:
    0 1px 3px 0 rgba(0, 0, 0, 0.05),
    0 1px 2px -1px rgba(0, 0, 0, 0.03);
}
.alert-success {
  background-color: #f0fdf4;
  border: 2px solid #22c55e;
  color: #15803d;
  box-shadow:
    0 1px 3px 0 rgba(0, 0, 0, 0.05),
    0 1px 2px -1px rgba(0, 0, 0, 0.03);
}

/* Card */
.mono-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow:
    0 1px 3px 0 rgba(0, 0, 0, 0.05),
    0 1px 2px -1px rgba(0, 0, 0, 0.03);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.card-header {
  background-color: #f9fafb;
  color: #111827;
  border-top-left-radius: 8px;
  border-top-right-radius: 8px;
  padding: 1rem 1.5rem;
  font-weight: 600;
  /* text-transform: removed */
  font-size: 0.875rem;
  letter-spacing: normal;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.card-header i {
  color: #9ca3af;
}

/* Table */
.table-container {
  overflow-x: auto;
}
.mono-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}
.mono-table th {
  background-color: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
  padding: 1rem;
  font-size: 0.75rem;
  font-weight: 600;
  /* text-transform: removed */
  letter-spacing: normal;
  color: #111827;
}
.mono-table td {
  padding: 1rem;
  border-bottom: 1px solid #e5e7eb;
  vertical-align: middle;
}
.table-row {
  transition: background-color 0.2s;
}
.table-row:hover {
  background-color: #f9fafb;
}
.row-self {
  background-color: #faf5ff !important;
}

/* Cell Content */
.user-name {
  font-weight: 600;
  color: #111827;
  font-size: 0.95rem;
}
.self-tag {
  font-size: 0.75rem;
  color: #9333ea;
  font-weight: 500;
  margin-top: 0.25rem;
}
.email-cell {
  font-size: 0.875rem;
  color: #4b5563;
}
.rank-cell {
  font-size: 1.1rem;
  color: #111827;
}
.text-center {
  text-align: center;
}
.text-right {
  text-align: right;
}
.font-black {
  font-weight: 600;
}

/* Badges */
.mono-badge {
  display: inline-block;
  font-size: 0.65rem;
  font-weight: 600;
  /* text-transform: removed */
  letter-spacing: normal;
  padding: 0.25rem 0.75rem;
  border: 1px solid #000;
}
.badge-rank-100 {
  background: #fee2e2;
  color: #991b1b;
  border-color: #991b1b;
}
.badge-rank-90 {
  background: #dbeafe;
  color: #1e40af;
  border-color: #1e40af;
}
.badge-rank-80 {
  background: #dcfce7;
  color: #166534;
  border-color: #166534;
}
.badge-rank-70,
.badge-rank-60 {
  background: #fef08a;
  color: #854d0e;
  border-color: #854d0e;
}
.badge-rank-50,
.badge-rank-10 {
  background: #f3f4f6;
  color: #374151;
  border-color: #374151;
}

/* Action Buttons */
.btn-icon {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background-color: #fff;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-delete {
  color: #dc2626;
}
.btn-delete:hover:not(:disabled) {
  background-color: #fee2e2;
  transform: translateY(-2px);
  box-shadow:
    0 10px 15px -3px rgba(0, 0, 0, 0.08),
    0 4px 6px -4px rgba(0, 0, 0, 0.04);
  border-color: #dc2626;
}
.btn-delete:disabled {
  opacity: 0.3;
  cursor: not-allowed;
  border-color: #d1d5db;
  color: #d1d5db;
}
.btn-lock {
  color: #d97706;
}
.btn-lock:hover:not(:disabled) {
  background-color: #fef3c7;
  transform: translateY(-2px);
  border-color: #d97706;
}
.btn-lock:disabled {
  opacity: 0.3;
  cursor: not-allowed;
  border-color: #d1d5db;
  color: #d1d5db;
}
.btn-unlock {
  color: #10b981;
}
.btn-unlock:hover:not(:disabled) {
  background-color: #d1fae5;
  transform: translateY(-2px);
  border-color: #10b981;
}
.btn-unlock:disabled {
  opacity: 0.3;
  cursor: not-allowed;
  border-color: #d1d5db;
  color: #d1d5db;
}
.btn-reset {
  color: #3b82f6;
}
.btn-reset:hover:not(:disabled) {
  background-color: #dbeafe;
  transform: translateY(-2px);
  border-color: #3b82f6;
}
.btn-reset:disabled {
  opacity: 0.3;
  cursor: not-allowed;
  border-color: #d1d5db;
  color: #d1d5db;
}

/* Modal */
.mono-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}
.mono-modal {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow:
    0 1px 3px 0 rgba(0, 0, 0, 0.05),
    0 1px 2px -1px rgba(0, 0, 0, 0.03);
  width: 100%;
  max-width: 500px;
  display: flex;
  flex-direction: column;
  animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.modal-header {
  background: #f9fafb;
  color: #111827;
  border-top-left-radius: 8px;
  border-top-right-radius: 8px;
  padding: 1rem 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  /* text-transform: removed */
  letter-spacing: normal;
}
.btn-close {
  background: none;
  border: none;
  color: #9ca3af;
  cursor: pointer;
  padding: 0.25rem;
}
.btn-close:hover {
  color: #fff;
}
.modal-body {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.modal-footer {
  padding: 1.5rem;
  border-top: 1px solid #e5e7eb;
  background: #f9fafb;
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
}

/* Modal Form Elements */
.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}
.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.form-label {
  font-size: 0.8rem;
  font-weight: 600; /* text-transform: removed */
  color: #111827;
}
.mono-input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #e5e7eb;
  border-radius: 8px;

  font-size: 0.95rem;
  outline: none;
  box-sizing: border-box;
}
.mono-input:focus {
  border-color: #7c3aed;
  box-shadow:
    0 1px 3px 0 rgba(0, 0, 0, 0.05),
    0 1px 2px -1px rgba(0, 0, 0, 0.03);
}
.select-wrapper {
  position: relative;
}
.select-wrapper::after {
  content: '▼';
  position: absolute;
  right: 1rem;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.7rem;
  pointer-events: none;
}
select.mono-input {
  appearance: none;
  padding-right: 2.5rem;
}
.mb-4 {
  margin-bottom: 1rem;
}

/* Modal Buttons */
.btn-cancel {
  padding: 0.75rem 1.5rem;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  font-weight: 600;
  /* text-transform: removed */
  cursor: pointer;
}
.btn-cancel:hover {
  background: #f3f4f6;
}
.btn-submit {
  padding: 0.75rem 1.5rem;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f9fafb;
  color: #fff;
  border-top-left-radius: 8px;
  border-top-right-radius: 8px;
  font-weight: 600;
  /* text-transform: removed */
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #111827;
  border: 1px solid #111827;
}
.btn-submit:hover:not(:disabled) {
  background: #7c3aed;
  border-color: #7c3aed;
}
.btn-submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Password input wrapper */
.input-password-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}
.input-password-wrapper .mono-input {
  padding-right: 2.5rem;
}
.btn-toggle-pw {
  position: absolute;
  right: 0.5rem;
  background: none;
  border: none;
  cursor: pointer;
  color: #9ca3af;
  padding: 0.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
}
.btn-toggle-pw:hover {
  color: #6b7280;
}

/* Password strength checklist */
.pw-strength-box {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 0.75rem 1rem;
}
.pw-strength-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: #475569;
  margin-bottom: 0.5rem;
}
.pw-rules-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.pw-rules-list li {
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: color 0.2s;
}
.pw-rules-list li i {
  font-size: 0.85rem;
}
.rule-pass {
  color: #16a34a;
}
.rule-pass i {
  color: #16a34a;
}
.rule-fail {
  color: #94a3b8;
}
.rule-fail i {
  color: #cbd5e1;
}

/* Password match indicators */
.pw-mismatch {
  font-size: 0.75rem;
  color: #ef4444;
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin-top: 0.25rem;
}
.pw-match {
  font-size: 0.75rem;
  color: #16a34a;
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin-top: 0.25rem;
}
</style>
