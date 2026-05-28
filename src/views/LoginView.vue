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
    <!-- Ambient Blur Background Blobs -->
    <div class="bg-blob bg-blob-indigo"></div>
    <div class="bg-blob bg-blob-purple"></div>

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
  position: relative;
  width: 100%;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f8fafc;
  padding: var(--lms-space-lg);
  overflow: hidden;
}

/* Ambient Background Blobs */
.bg-blob {
  position: absolute;
  width: 700px;
  height: 700px;
  border-radius: 50%;
  filter: blur(130px);
  opacity: 0.6;
  pointer-events: none;
  z-index: 1;
}

.bg-blob-indigo {
  background: radial-gradient(circle, rgba(99, 102, 241, 0.3) 0%, rgba(99, 102, 241, 0) 70%);
  top: -250px;
  left: -250px;
  animation: float-blob-1 25s infinite alternate ease-in-out;
}

.bg-blob-purple {
  background: radial-gradient(circle, rgba(168, 85, 247, 0.25) 0%, rgba(168, 85, 247, 0) 70%);
  bottom: -250px;
  right: -250px;
  animation: float-blob-2 25s infinite alternate ease-in-out;
}

@keyframes float-blob-1 {
  0% {
    transform: translate(0, 0) scale(1);
  }
  100% {
    transform: translate(100px, 60px) scale(1.15);
  }
}

@keyframes float-blob-2 {
  0% {
    transform: translate(0, 0) scale(1);
  }
  100% {
    transform: translate(-100px, -60px) scale(1.15);
  }
}

/* Glassmorphic Login Card */
.login-card {
  position: relative;
  z-index: 10;
  width: 100%;
  max-width: 400px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.6);
  border-radius: 16px;
  padding: var(--lms-space-2xl);
  box-shadow: 
    0 20px 40px -15px rgba(0, 0, 0, 0.08),
    0 0 50px -10px rgba(99, 102, 241, 0.05);
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
  width: 64px;
  height: 64px;
  background: linear-gradient(135deg, var(--lms-primary-light), rgba(168, 85, 247, 0.15));
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--lms-space-md);
  box-shadow: 0 8px 16px -4px rgba(99, 102, 241, 0.2);
}

.login-icon {
  font-size: 2rem;
  color: var(--lms-primary);
}

.login-header h1 {
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--lms-gray-800);
  letter-spacing: -0.02em;
  margin-bottom: 6px;
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
  padding: 12px !important;
  font-size: 0.95rem !important;
  font-weight: 600 !important;
  background: linear-gradient(135deg, var(--lms-primary), #6366f1) !important;
  border: none !important;
  box-shadow: 0 4px 12px rgba(79, 70, 229, 0.25) !important;
  transition: all 0.2s ease !important;
  color: var(--lms-white) !important;
}

.login-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(79, 70, 229, 0.35) !important;
  filter: brightness(1.05);
}

.login-btn:active:not(:disabled) {
  transform: translateY(1px);
}

/* Footer */
.login-note {
  text-align: center;
  font-size: 0.8rem;
  color: var(--lms-gray-400);
  margin-top: var(--lms-space-lg);
}
</style>
