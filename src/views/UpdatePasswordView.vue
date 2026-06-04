<!-- ============================================================================
  UpdatePasswordView.vue — Trang cập nhật mật khẩu mới (phục hồi)
  Trách nhiệm DUY NHẤT: Cho phép người dùng nhập mật khẩu mới và xác nhận sau khi chuyển hướng từ mail.
  ============================================================================ -->

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { useToast } from 'primevue/usetoast'
import Password from 'primevue/password'
import Button from 'primevue/button'

const router = useRouter()
const toast = useToast()

const password = ref('')
const confirmPassword = ref('')
const submitting = ref(false)
const hasSession = ref(false)
const checkingSession = ref(true)

// Password strength validation rules
const passwordRules = computed(() => [
  { label: 'Ít nhất 8 ký tự', valid: password.value.length >= 8 },
  { label: 'Chứa chữ cái viết hoa (A-Z)', valid: /[A-Z]/.test(password.value) },
  { label: 'Chứa chữ cái viết thường (a-z)', valid: /[a-z]/.test(password.value) },
  { label: 'Chứa chữ số (0-9)', valid: /[0-9]/.test(password.value) },
  { label: 'Chứa ký tự đặc biệt (!@#$%...)', valid: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password.value) },
])

const isPasswordStrong = computed(() => passwordRules.value.every(r => r.valid))
const passwordsMatch = computed(() => password.value && confirmPassword.value && password.value === confirmPassword.value)

onMounted(async () => {
  // Đợi một khoảng thời gian ngắn để Supabase SDK xử lý các tham số hash trên URL (#access_token=...)
  await new Promise(resolve => setTimeout(resolve, 800))
  
  const { data: { session } } = await supabase.auth.getSession()
  if (session) {
    hasSession.value = true
  } else {
    hasSession.value = false
    toast.add({
      severity: 'error',
      summary: 'Liên kết không hợp lệ',
      detail: 'Liên kết đặt lại mật khẩu không còn hiệu lực hoặc đã hết hạn.',
      life: 5000
    })
  }
  checkingSession.value = false
})

/** Xử lý cập nhật mật khẩu mới */
async function handleUpdatePassword() {
  if (!password.value || !confirmPassword.value) {
    toast.add({
      severity: 'error',
      summary: 'Thiếu thông tin',
      detail: 'Vui lòng điền đầy đủ các trường.',
      life: 3000
    })
    return
  }

  if (!isPasswordStrong.value) {
    toast.add({
      severity: 'error',
      summary: 'Mật khẩu yếu',
      detail: 'Mật khẩu mới chưa đáp ứng đầy đủ yêu cầu bảo mật.',
      life: 3000
    })
    return
  }

  if (!passwordsMatch.value) {
    toast.add({
      severity: 'error',
      summary: 'Mật khẩu không khớp',
      detail: 'Mật khẩu xác nhận không trùng khớp.',
      life: 3000
    })
    return
  }

  submitting.value = true

  try {
    const { error: updateError } = await supabase.auth.updateUser({
      password: password.value
    })

    if (updateError) {
      throw updateError
    }

    toast.add({
      severity: 'success',
      summary: 'Thành công',
      detail: 'Mật khẩu của bạn đã được cập nhật. Đang chuyển hướng...',
      life: 3000
    })

    // Đăng xuất session hiện tại để người dùng đăng nhập lại từ đầu
    await supabase.auth.signOut()

    setTimeout(() => {
      router.push('/login')
    }, 2000)

  } catch (err: any) {
    toast.add({
      severity: 'error',
      summary: 'Lỗi cập nhật',
      detail: err.message || 'Gặp lỗi trong quá trình đổi mật khẩu.',
      life: 4000
    })
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="update-pw-page">
    <!-- Background blobs tương tự login -->
    <div class="bg-blob bg-blob-indigo"></div>
    <div class="bg-blob bg-blob-purple"></div>

    <div class="update-pw-card">
      <div class="card-header">
        <div class="icon-wrapper">
          <i class="pi pi-key lock-icon"></i>
        </div>
        <h1>Đặt lại mật khẩu</h1>
        <p class="subtitle">Thiết lập mật khẩu mới cho tài khoản của bạn</p>
      </div>

      <!-- Đang kiểm tra session -->
      <div v-if="checkingSession" class="status-center">
        <i class="pi pi-spin pi-spinner spinner"></i>
        <p>Đang xác thực liên kết khôi phục...</p>
      </div>

      <!-- Không có session đặt lại hợp lệ -->
      <div v-else-if="!hasSession" class="status-center">
        <i class="pi pi-times-circle error-icon"></i>
        <h3>Yêu cầu không hợp lệ</h3>
        <p class="error-text">Đường dẫn đặt lại mật khẩu đã hết hạn hoặc bị lỗi. Vui lòng liên hệ Admin hoặc yêu cầu gửi lại mail.</p>
        <RouterLink to="/login" class="back-link">Quay lại trang Đăng nhập</RouterLink>
      </div>

      <!-- Form nhập mật khẩu mới -->
      <form v-else @submit.prevent="handleUpdatePassword" class="update-pw-form">
        <div class="form-field">
          <label for="new-password">Mật khẩu mới</label>
          <Password
            id="new-password"
            v-model="password"
            placeholder="Nhập mật khẩu mới"
            :feedback="false"
            toggle-mask
            class="form-input"
            :disabled="submitting"
            input-class="form-input-inner"
          />
        </div>

        <div class="form-field">
          <label for="confirm-password">Xác nhận mật khẩu mới</label>
          <Password
            id="confirm-password"
            v-model="confirmPassword"
            placeholder="Nhập lại mật khẩu mới"
            :feedback="false"
            toggle-mask
            class="form-input"
            :disabled="submitting"
            input-class="form-input-inner"
          />
          <div v-if="confirmPassword && !passwordsMatch" class="match-badge mismatch">
            <i class="pi pi-times-circle"></i> Mật khẩu xác nhận chưa khớp
          </div>
          <div v-if="passwordsMatch" class="match-badge match">
            <i class="pi pi-check-circle"></i> Mật khẩu xác nhận trùng khớp
          </div>
        </div>

        <!-- Quy tắc mật khẩu -->
        <div class="pw-strength-box">
          <div class="pw-strength-title">Yêu cầu bảo mật:</div>
          <ul class="pw-rules-list">
            <li v-for="(rule, idx) in passwordRules" :key="idx" :class="{ 'rule-pass': rule.valid, 'rule-fail': !rule.valid }">
              <i :class="rule.valid ? 'pi pi-check-circle' : 'pi pi-circle'"></i>
              {{ rule.label }}
            </li>
          </ul>
        </div>

        <Button
          type="submit"
          label="Cập nhật mật khẩu"
          icon="pi pi-save"
          class="submit-btn"
          :loading="submitting"
          :disabled="submitting || !isPasswordStrong || !passwordsMatch"
        />
      </form>
    </div>
  </div>
</template>

<style scoped>
.update-pw-page {
  position: relative;
  width: 100%;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f8fafc;
  padding: 2rem;
  overflow: hidden;
}

/* Background Blobs */
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
  0% { transform: translate(0, 0) scale(1); }
  100% { transform: translate(100px, 60px) scale(1.15); }
}
@keyframes float-blob-2 {
  0% { transform: translate(0, 0) scale(1); }
  100% { transform: translate(-100px, -60px) scale(1.15); }
}

/* Glassmorphic Card */
.update-pw-card {
  position: relative;
  z-index: 10;
  width: 100%;
  max-width: 440px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.6);
  border-radius: 16px;
  padding: 2.5rem;
  box-shadow: 
    0 20px 40px -15px rgba(0, 0, 0, 0.08),
    0 0 50px -10px rgba(99, 102, 241, 0.05);
}

/* Header */
.card-header {
  text-align: center;
  margin-bottom: 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.icon-wrapper {
  width: 64px;
  height: 64px;
  background: linear-gradient(135deg, rgba(124, 58, 237, 0.15), rgba(168, 85, 247, 0.15));
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1rem;
  box-shadow: 0 8px 16px -4px rgba(124, 58, 237, 0.2);
}
.lock-icon {
  font-size: 2rem;
  color: #7c3aed;
}
.card-header h1 {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 6px;
}
.subtitle {
  font-size: 0.9rem;
  color: #64748b;
}

/* Loading/Error state */
.status-center {
  text-align: center;
  padding: 2rem 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}
.spinner {
  font-size: 2.5rem;
  color: #7c3aed;
}
.error-icon {
  font-size: 3.5rem;
  color: #ef4444;
}
.error-text {
  font-size: 0.9rem;
  color: #64748b;
  line-height: 1.6;
}
.back-link {
  display: inline-block;
  margin-top: 1rem;
  color: #7c3aed;
  font-weight: 600;
  text-decoration: none;
  font-size: 0.9rem;
}
.back-link:hover {
  text-decoration: underline;
}

/* Form layout */
.update-pw-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}
.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.form-field label {
  font-size: 0.85rem;
  font-weight: 600;
  color: #475569;
}
.form-input {
  width: 100%;
}
:deep(.form-input-inner) {
  width: 100%;
}

/* Password rules checklist */
.pw-strength-box {
  background-color: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 1rem;
  font-size: 0.8rem;
}
.pw-strength-title {
  font-weight: 700;
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
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.rule-pass {
  color: #10b981;
}
.rule-fail {
  color: #94a3b8;
}

/* Badges for confirmation */
.match-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
  margin-top: 4px;
}
.match-badge.match {
  color: #10b981;
}
.match-badge.mismatch {
  color: #ef4444;
}

/* Submit button */
.submit-btn {
  margin-top: 0.5rem;
  width: 100%;
  padding: 12px !important;
  font-size: 0.95rem !important;
  font-weight: 600 !important;
  background: linear-gradient(135deg, #7c3aed, #6366f1) !important;
  border: none !important;
  box-shadow: 0 4px 12px rgba(124, 58, 237, 0.25) !important;
  transition: all 0.2s ease !important;
  color: #fff !important;
}
.submit-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(124, 58, 237, 0.35) !important;
  filter: brightness(1.05);
}
.submit-btn:disabled {
  opacity: 0.6;
  transform: none;
  box-shadow: none !important;
  cursor: not-allowed;
}
</style>
