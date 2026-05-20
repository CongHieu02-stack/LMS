<!-- ============================================================================
  UserPermissionEditor.vue — Giao diện Phân quyền Nhân sự Nâng cao
  Layout Split-pane: Trái (Danh sách Nhân sự) - Phải (Ma trận Quyền)
  Đã viết lại hoàn toàn bằng Pure CSS (Không phụ thuộc Tailwind).
  ============================================================================ -->

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useUserPermissions } from '@/composables/useUserPermissions'
import { useAuthStore } from '@/stores/auth'
import { useToast } from 'primevue/usetoast'

import pvCheckbox from 'primevue/checkbox'
import pvCard from 'primevue/card'
import pvButton from 'primevue/button'
import pvToast from 'primevue/toast'

const toast = useToast()
const authStore = useAuthStore()

const {
  profiles,
  selectedUserId,
  roleDefaultPermissions,
  selectedPermissionIds,
  loading,
  saving,
  errorMessage,
  successMessage,
  selectedUserProfile,
  groupedPermissions,
  fetchProfiles,
  fetchPermissions,
  initPermissionsForUser,
  saveUserPermissions,
  resetToDefault,
} = useUserPermissions()

// Tìm kiếm nhân sự
const searchQuery = ref('')
const filteredProfiles = computed(() => {
  if (!searchQuery.value) return profiles.value
  const query = searchQuery.value.toLowerCase()
  return profiles.value.filter(
    (p) =>
      p.full_name.toLowerCase().includes(query) ||
      p.email.toLowerCase().includes(query) ||
      p.role.toLowerCase().includes(query),
  )
})

const canEdit = computed(() => {
  if (!selectedUserProfile.value || !authStore.profile) return false
  return authStore.profile.rank > selectedUserProfile.value.rank
})

function handleUserChange(userId: string) {
  initPermissionsForUser(userId)
}

async function handleSave() {
  if (!selectedUserId.value || !selectedUserProfile.value) {
    toast.add({
      severity: 'error',
      summary: 'Cảnh báo',
      detail: 'Vui lòng chọn nhân sự.',
      life: 3000,
    })
    return
  }

  const success = await saveUserPermissions(
    selectedUserId.value,
    selectedUserProfile.value.role,
    selectedPermissionIds.value,
  )

  if (success) {
    toast.add({
      severity: 'success',
      summary: 'Thành công',
      detail: successMessage.value || 'Cập nhật phân quyền thành công!',
      life: 4000,
    })
  } else {
    toast.add({
      severity: 'error',
      summary: 'Lỗi',
      detail: errorMessage.value || 'Giao dịch bị từ chối.',
      life: 5000,
    })
  }
}

function handleReset() {
  resetToDefault()
  toast.add({
    severity: 'info',
    summary: 'Khôi phục',
    detail: 'Đã tải mẫu quyền của vai trò gốc lên UI.',
    life: 4000,
  })
}

onMounted(async () => {
  await fetchPermissions()
  await fetchProfiles()
})
</script>

<template>
  <pv-toast />

  <div class="permission-editor-wrapper">
    <!-- Header -->
    <div class="page-header">
      <div class="breadcrumb">Quản trị / <span>Phân quyền Nhân sự</span></div>
      <h1 class="page-title">Phân Quyền Hệ Thống</h1>
    </div>

    <!-- Main Split Layout -->
    <div class="split-layout">
      <!-- CỘT TRÁI: DANH SÁCH NHÂN SỰ -->
      <div class="left-pane">
        <div class="search-header">
          <h3>Lựa chọn nhân sự</h3>
          <div class="search-box">
            <i class="pi pi-search search-icon"></i>
            <input
              type="text"
              v-model="searchQuery"
              placeholder="Tìm tên, email, vai trò..."
              class="search-input"
            />
          </div>
        </div>

        <div class="user-list custom-scrollbar">
          <div
            v-for="profile in filteredProfiles"
            :key="profile.id"
            @click="handleUserChange(profile.id)"
            class="user-item"
            :class="{ active: selectedUserId === profile.id }"
          >
            <div class="active-indicator"></div>

            <div class="avatar" :class="{ active: selectedUserId === profile.id }">
              {{ profile.full_name.charAt(0).toUpperCase() }}
            </div>

            <div class="user-info">
              <div class="user-name" :class="{ active: selectedUserId === profile.id }">
                {{ profile.full_name }}
              </div>
              <div class="user-email">{{ profile.email }}</div>
              <span class="role-badge" :class="{ active: selectedUserId === profile.id }">
                {{ profile.role }}
              </span>
            </div>
          </div>

          <div v-if="filteredProfiles.length === 0" class="empty-list">
            Không tìm thấy nhân sự phù hợp.
          </div>
        </div>
      </div>

      <!-- CỘT PHẢI: MA TRẬN QUYỀN HẠN -->
      <div class="right-pane">
        <div v-if="!selectedUserId" class="empty-state">
          <div class="empty-icon">
            <i class="pi pi-user-edit"></i>
          </div>
          <h2>Chưa chọn nhân sự</h2>
          <p>
            Vui lòng chọn một tài khoản từ danh sách bên trái để xem và cấu hình phân quyền hệ
            thống.
          </p>
        </div>

        <div v-else-if="loading" class="loading-state">
          <i class="pi pi-spin pi-spinner spinner"></i>
          <div>Đang nạp phân hệ...</div>
        </div>

        <div v-else class="config-content">
          <div class="user-config-header">
            <div class="header-left">
              <div class="header-label">Đang cấu hình quyền cho</div>
              <div class="header-name">{{ selectedUserProfile?.full_name }}</div>
              <div class="header-email">{{ selectedUserProfile?.email }}</div>
            </div>
            <div class="header-right">
              <span class="badge-role">VAI TRÒ: {{ selectedUserProfile?.role }}</span>
              <span class="badge-rank">RANK {{ selectedUserProfile?.rank }}</span>
            </div>
          </div>

          <div v-if="!canEdit" class="hierarchy-warning">
            <i class="pi pi-shield"></i>
            <div>
              <strong>Phân tầng quyền lực:</strong> Cấp bậc của bạn (Rank
              {{ authStore.profile?.rank }}) không đủ để chỉnh sửa tài khoản này (Rank
              {{ selectedUserProfile?.rank }}).
            </div>
          </div>

          <div class="matrix-container custom-scrollbar">
            <div class="matrix-grid">
              <pv-card
                v-for="(perms, groupName) in groupedPermissions"
                :key="groupName"
                class="monochrome-card"
              >
                <template #title>
                  <div class="card-header">
                    <span>{{ groupName }}</span>
                    <i class="pi pi-shield"></i>
                  </div>
                </template>

                <template #content>
                  <div class="card-body">
                    <div v-for="perm in perms" :key="perm.id" class="permission-item">
                      <pv-checkbox
                        v-model="selectedPermissionIds"
                        :inputId="'perm_' + perm.id"
                        :value="perm.id"
                        class="purple-checkbox"
                        :disabled="!canEdit"
                      />

                      <div class="permission-label-wrap">
                        <label :for="'perm_' + perm.id" class="permission-label">
                          {{ perm.name }}
                        </label>

                        <div v-if="roleDefaultPermissions.includes(perm.id)" class="default-badge">
                          <span>Mặc định</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </template>
              </pv-card>
            </div>
          </div>

          <div class="action-footer">
            <div class="footer-note">
              <strong>Lưu ý:</strong> Người dùng phải giữ ít nhất một chức năng thuộc vai trò mặc
              định của họ.
            </div>

            <div class="footer-buttons">
              <button
                type="button"
                class="btn-reset"
                @click="handleReset"
                :disabled="saving || !canEdit"
              >
                Khôi phục mặc định
              </button>

              <button
                type="button"
                class="btn-save"
                @click="handleSave"
                :disabled="saving || !canEdit"
              >
                <i v-if="saving" class="pi pi-spin pi-spinner"></i>
                Lưu Cấu Hình Quyền
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.permission-editor-wrapper {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 80px);
  padding: 1rem 2rem;
  box-sizing: border-box;
  animation: fadeIn 0.3s ease-out;
}

/* Header */
.page-header {
  margin-bottom: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 0.5rem;
  flex-shrink: 0;
}
.breadcrumb {
  font-size: 0.75rem;
  /* text-transform: removed */
  letter-spacing: normal;
  color: #9ca3af;
  font-weight: 600;
  margin-bottom: 0.25rem;
}
.breadcrumb span {
  color: #111827;
  font-weight: 600;
}
.page-title {
  font-size: 1.875rem;
  font-weight: 600;
  letter-spacing: normal;
  /* text-transform: removed */
  margin: 0;
  color: #111827;
}

/* Layout */
.split-layout {
  flex: 1;
  display: flex;
  gap: 2rem;
  overflow: hidden;
  padding-bottom: 1rem;
}

/* Left Pane */
.left-pane {
  width: 320px;
  display: flex;
  flex-direction: column;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background-color: #fff;
  overflow: hidden;
  box-shadow:
    0 1px 3px 0 rgba(0, 0, 0, 0.05),
    0 1px 2px -1px rgba(0, 0, 0, 0.03);
  flex-shrink: 0;
}
.search-header {
  padding: 1rem;
  border-bottom: 1px solid #e5e7eb;
  background-color: #f9fafb;
  flex-shrink: 0;
}
.search-header h3 {
  font-weight: 600;
  /* text-transform: removed */
  font-size: 0.875rem;
  margin: 0 0 0.75rem 0;
  color: #111827;
}
.search-box {
  position: relative;
}
.search-icon {
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: #9ca3af;
}
.search-input {
  width: 100%;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 0.5rem 0.75rem 0.5rem 2.25rem;
  font-size: 0.875rem;
  outline: none;
  background-color: #fff;
  font-weight: 500;
  transition: border-color 0.2s;
  box-sizing: border-box;
}
.search-input:focus {
  border-color: #7c3aed;
}

.user-list {
  flex: 1;
  overflow-y: auto;
  background-color: #fff;
}
.user-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  border-bottom: 1px solid #f3f4f6;
  cursor: pointer;
  position: relative;
  transition: all 0.2s;
}
.user-item:hover {
  background-color: #faf5ff;
}
.user-item.active {
  background-color: #faf5ff;
}

.active-indicator {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background-color: transparent;
  transition: background-color 0.2s;
}
.user-item:hover .active-indicator {
  background-color: #d8b4fe;
}
.user-item.active .active-indicator {
  background-color: #7c3aed;
}

.avatar {
  width: 40px;
  height: 40px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background-color: #f9fafb;
  color: #111827;
  border-top-left-radius: 8px;
  border-top-right-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 1.125rem;
  flex-shrink: 0;
  transition: all 0.2s;
}
.user-item:hover .avatar {
  background-color: #a855f7;
  border-color: #a855f7;
}
.avatar.active {
  background-color: #7c3aed;
  border-color: #7c3aed;
}

.user-info {
  flex: 1;
  min-width: 0;
}
.user-name {
  font-weight: 600;
  font-size: 0.875rem;
  color: #111827;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 0.2s;
}
.user-item:hover .user-name {
  color: #7e22ce;
}
.user-name.active {
  color: #7e22ce;
}
.user-email {
  font-size: 0.75rem;
  color: #6b7280;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 0.25rem;
}
.role-badge {
  display: inline-block;
  font-size: 0.625rem;

  /* text-transform: removed */
  padding: 0.125rem 0.5rem;
  font-weight: 500;
  border: 1px solid #000;
  background-color: #fff;
  color: #111827;
  transition: all 0.2s;
}
.user-item:hover .role-badge {
  border-color: #a855f7;
  color: #9333ea;
}
.role-badge.active {
  background-color: #7c3aed;
  color: #fff;
  border-color: #7c3aed;
}

.empty-list {
  padding: 1.5rem;
  text-align: center;
  color: #9ca3af;
  font-size: 0.875rem;
  font-weight: 500;
}

/* Right Pane */
.right-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background-color: #fff;
  overflow: hidden;
  box-shadow:
    0 1px 3px 0 rgba(0, 0, 0, 0.05),
    0 1px 2px -1px rgba(0, 0, 0, 0.03);
}
.empty-state,
.loading-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
}
.empty-icon {
  width: 6rem;
  height: 6rem;
  border-radius: 50%;
  border: 4px dashed #d1d5db;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.5rem;
}
.empty-icon i {
  font-size: 2.5rem;
  color: #d1d5db;
}
.empty-state h2 {
  font-size: 1.25rem;
  font-weight: 600;
  /* text-transform: removed */
  margin: 0 0 0.5rem 0;
  color: #111827;
}
.empty-state p {
  font-size: 0.875rem;
  color: #6b7280;
  text-align: center;
  max-width: 400px;
}
.loading-state .spinner {
  font-size: 2.5rem;
  color: #9333ea;
  margin-bottom: 1rem;
}
.loading-state div {
  font-weight: 500;
  /* text-transform: removed */
  letter-spacing: normal;
  font-size: 0.75rem;
  color: #111827;
}

.config-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.user-config-header {
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  background-color: #faf5ff;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}
.header-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: #9333ea;
  /* text-transform: removed */
  letter-spacing: normal;
  margin-bottom: 0.25rem;
}
.header-name {
  font-size: 1.5rem;
  font-weight: 600;
  color: #111827;
  margin: 0;
}
.header-email {
  font-size: 0.875rem;
  color: #4b5563;

  margin-top: 0.25rem;
}
.header-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.5rem;
}
.badge-role {
  font-size: 0.75rem;
  font-weight: 600;
  /* text-transform: removed */
  background-color: #f9fafb;
  color: #111827;
  border-top-left-radius: 8px;
  border-top-right-radius: 8px;
  padding: 0.25rem 0.75rem;
}
.badge-rank {
  font-size: 0.75rem;
  font-weight: 500;
  border: 1px solid #000;
  padding: 0.25rem 0.75rem;
  background-color: #fff;
  color: #111827;
}

.hierarchy-warning {
  background-color: #fef2f2;
  border-bottom: 2px solid #ef4444;
  color: #b91c1c;
  padding: 1rem 1.5rem;
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-shrink: 0;
}
.hierarchy-warning i {
  font-size: 1.25rem;
}
.hierarchy-warning strong {
  font-weight: 600;
  /* text-transform: removed */
}

.matrix-container {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
  background-color: rgba(249, 250, 251, 0.5);
}
.matrix-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
}
@media (min-width: 1280px) {
  .matrix-grid {
    grid-template-columns: 1fr 1fr;
  }
}

.monochrome-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.card-header {
  background-color: #f9fafb;
  color: #111827;
  border-top-left-radius: 8px;
  border-top-right-radius: 8px;
  padding: 0.75rem 1rem;
  font-weight: 600;
  /* text-transform: removed */
  font-size: 0.75rem;
  letter-spacing: normal;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.card-header i {
  color: #9ca3af;
}
.card-body {
  display: flex;
  flex-direction: column;
}
.permission-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  border-bottom: 1px solid #f3f4f6;
  transition: background-color 0.2s;
}
.permission-item:last-child {
  border-bottom: none;
}
.permission-item:hover {
  background-color: #faf5ff;
}
.permission-label-wrap {
  flex: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.permission-label {
  cursor: pointer;
  font-weight: 500;
  color: #111827;
  font-size: 0.875rem;
  transition: color 0.2s;
  user-select: none;
}
.permission-item:hover .permission-label {
  color: #7e22ce;
}
.default-badge span {
  font-size: 0.5625rem;
  font-weight: 600;
  /* text-transform: removed */
  letter-spacing: normal;
  border: 1px solid #9333ea;
  padding: 0.25rem 0.5rem;
  color: #7e22ce;
  background-color: #faf5ff;
}

.action-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid #e5e7eb;
  background-color: #fff;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  flex-shrink: 0;
}
@media (min-width: 640px) {
  .action-footer {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }
}
.footer-note {
  font-size: 0.75rem;
  color: #6b7280;
  max-width: 400px;
}
.footer-note strong {
  color: #111827;
  /* text-transform: removed */
}
.footer-buttons {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.btn-reset {
  font-size: 0.75rem;
  font-weight: 600;
  /* text-transform: removed */
  letter-spacing: normal;
  color: #111827;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background-color: #fff;
  padding: 0.75rem 1.5rem;
  cursor: pointer;
  transition: background-color 0.2s;
}
.btn-reset:hover:not(:disabled) {
  background-color: #f3f4f6;
}
.btn-save {
  font-size: 0.75rem;
  font-weight: 600;
  /* text-transform: removed */
  letter-spacing: normal;
  color: #fff;
  border: 1px solid #9333ea;
  border-radius: 8px;
  background-color: #7c3aed;
  padding: 0.75rem 2rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition: all 0.2s;
}
.btn-save:hover:not(:disabled) {
  background-color: #7e22ce;
  border-color: #7e22ce;
}

/* Custom Scrollbar */
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: #f1f1f1;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

/* PrimeVue Overrides */
:deep(.p-card-body) {
  padding: 0 !important;
}

:deep(.purple-checkbox) {
  width: 20px;
  height: 20px;
  margin-right: 0.5rem;
}
:deep(.purple-checkbox .p-checkbox-box) {
  border: 2px solid #000 !important;
  border-radius: 0 !important;
  background-color: #fff !important;
  transition: all 0.2s !important;
}
:deep(.purple-checkbox.p-checkbox-checked .p-checkbox-box) {
  background-color: #9333ea !important;
  border-color: #9333ea !important;
}
:deep(.purple-checkbox.p-checkbox-checked .p-checkbox-icon) {
  color: #fff !important;
}

:deep(.p-toast-message) {
  background: #000 !important;
  color: #fff !important;
  border: 2px solid #9333ea !important;
  border-radius: 0 !important;
  box-shadow:
    0 1px 3px 0 rgba(0, 0, 0, 0.05),
    0 1px 2px -1px rgba(0, 0, 0, 0.03);
}
:deep(.p-toast-message-content) {
  background: #000 !important;
  color: #fff !important;
}
:deep(.p-toast-message-text),
:deep(.p-toast-summary),
:deep(.p-toast-detail) {
  color: #fff !important;
}
:deep(.p-toast-icon-close) {
  color: #fff !important;
  border: 1px solid #fff !important;
  border-radius: 0 !important;
}
:deep(.p-toast-icon-close:hover) {
  background: #9333ea !important;
  border-color: #9333ea !important;
}
button:disabled {
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
</style>
