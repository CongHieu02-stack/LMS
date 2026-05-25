<!-- ============================================================================
  LoginView.vue — Trang đăng nhập
  Trách nhiệm DUY NHẤT: Hiển thị form đăng nhập và bắt sự kiện submit.
  Logic xác thực nằm trong auth store.
  ============================================================================ -->

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useToast } from 'primevue/usetoast'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import Button from 'primevue/button'

const router = useRouter()
const authStore = useAuthStore()
const toast = useToast()

// Form state
const email = ref('')
const password = ref('')
const submitting = ref(false)

/** Xử lý đăng nhập */
async function handleLogin() {
  if (!email.value || !password.value) {
    toast.add({
      severity: 'error',
      summary: 'Thiếu thông tin',
      detail: 'Vui lòng nhập email và mật khẩu.',
      life: 3000,
    })
    return
  }

  submitting.value = true

  const success = await authStore.login(email.value, password.value)

  if (success) {
    toast.add({
      severity: 'success',
      summary: 'Đăng nhập thành công',
      detail: `Xin chào, ${authStore.profile?.fullName || 'User'}!`,
      life: 3000,
    })
    router.push('/dashboard')
  } else {
    toast.add({
      severity: 'error',
      summary: 'Đăng nhập thất bại',
      detail: authStore.error || 'Email hoặc mật khẩu không đúng.',
      life: 4000,
    })
  }

  submitting.value = false
}
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <!-- Header -->
      <div class="login-header">
        <div class="login-icon-wrapper">
          <i class="pi pi-graduation-cap login-icon"></i>
        </div>
        <h1>Hệ thống LMS</h1>
        <p class="login-subtitle">Đăng nhập để tiếp tục học tập</p>
      </div>

      <!-- Form -->
      <form @submit.prevent="handleLogin" class="login-form">
        <!-- Email -->
        <div class="form-field">
          <label for="login-email">Email</label>
          <InputText
            id="login-email"
            v-model="email"
            type="email"
            placeholder="admin@example.com"
            class="form-input"
            :disabled="submitting"
          />
        </div>

        <!-- Password -->
        <div class="form-field">
          <label for="login-password">Mật khẩu</label>
          <Password
            id="login-password"
            v-model="password"
            placeholder="Nhập mật khẩu"
            :feedback="false"
            toggle-mask
            class="form-input"
            :disabled="submitting"
            input-class="form-input-inner"
          />
        </div>

        <!-- Submit -->
        <Button
          type="submit"
          label="Đăng nhập"
          icon="pi pi-sign-in"
          class="login-btn"
          :loading="submitting"
          :disabled="submitting"
        />
      </form>

      <!-- Footer note -->
      <p class="login-note">Sử dụng tài khoản được cấp bởi quản trị viên hệ thống.</p>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--lms-gray-50);
  padding: var(--lms-space-lg);
}

.login-card {
  width: 100%;
  max-width: 400px;
  background: var(--lms-white);
  border: var(--lms-border);
  border-radius: var(--lms-radius-lg);
  padding: var(--lms-space-2xl);
  box-shadow: var(--lms-shadow-lg);
}

/* Header */
.login-header {
  text-align: center;
  margin-bottom: var(--lms-space-xl);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.login-icon-wrapper {
  width: 56px;
  height: 56px;
  background-color: var(--lms-primary-light);
  border-radius: var(--lms-radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--lms-space-md);
}

.login-icon {
  font-size: 2rem;
  color: var(--lms-primary);
}

.login-header h1 {
  font-size: 1.5rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  margin-bottom: 4px;
}

.login-subtitle {
  font-size: 0.9rem;
  color: var(--lms-gray-500);
}

/* Form */
.login-form {
  display: flex;
  flex-direction: column;
  gap: var(--lms-space-md);
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-field label {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--lms-gray-700);
}

.form-input {
  width: 100%;
}

:deep(.form-input-inner) {
  width: 100%;
}

.login-btn {
  margin-top: var(--lms-space-sm);
  width: 100%;
  padding: 10px !important;
  font-size: 0.95rem !important;
  background: var(--lms-primary) !important;
  border-color: var(--lms-primary) !important;
}

.login-btn:hover {
  background: var(--lms-primary-hover) !important;
  border-color: var(--lms-primary-hover) !important;
}

/* Footer */
.login-note {
  text-align: center;
  font-size: 0.8rem;
  color: var(--lms-gray-400);
  margin-top: var(--lms-space-lg);
}
</style>
