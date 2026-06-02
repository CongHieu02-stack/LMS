<!-- ============================================================================
  AppNavbar.vue — Thanh điều hướng chính
  Trách nhiệm DUY NHẤT: Hiển thị navigation links, role badge, nút logout.
  KHÔNG chứa logic nghiệp vụ hay fetch data.
  ============================================================================ -->

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import Button from 'primevue/button'
import Tag from 'primevue/tag'

const router = useRouter()
const authStore = useAuthStore()

/** Xử lý đăng xuất */
async function handleLogout() {
  await authStore.logout()
  router.push('/login')
}

/** Danh sách navigation links */
const navLinks = [
  { label: 'Tổng quan', to: '/dashboard', icon: 'pi pi-th-large' },
  { label: 'Đăng ký lớp', to: '/registration', icon: 'pi pi-book' },
  { label: 'Thi trắc nghiệm', to: '/exam', icon: 'pi pi-pencil' },
]
</script>

<template>
  <header class="navbar">
    <div class="lms-container navbar-inner">
      <!-- Logo / Brand -->
      <div class="navbar-brand" @click="router.push('/dashboard')">
        <span class="brand-icon">◼</span>
        <span class="brand-text">LMS</span>
      </div>

      <!-- Navigation links -->
      <nav class="navbar-nav">
        <RouterLink
          v-for="link in navLinks"
          :key="link.to"
          :to="link.to"
          class="nav-link"
          active-class="nav-link-active"
        >
          <i :class="link.icon"></i>
          <span>{{ link.label }}</span>
        </RouterLink>
      </nav>

      <!-- User info + Logout -->
      <div class="navbar-user">
        <!-- Role badge đơn sắc -->
        <Tag
          :value="authStore.displayRole"
          class="role-badge"
          :class="authStore.isAdmin ? 'role-badge-admin' : ''"
        />

        <!-- Tên user -->
        <span class="user-name">{{ authStore.profile?.fullName }}</span>

        <!-- Nút đăng xuất -->
        <Button
          icon="pi pi-sign-out"
          severity="contrast"
          text
          rounded
          aria-label="Đăng xuất"
          @click="handleLogout"
          class="logout-btn"
        />
      </div>
    </div>
  </header>
</template>

<style scoped>
.navbar {
  background: var(--lms-white);
  border-bottom: var(--lms-border-strong);
  position: sticky;
  top: 0;
  z-index: 100;
  backdrop-filter: blur(12px);
}

.navbar-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 64px;
  gap: var(--lms-space-lg);
}

/* Brand */
.navbar-brand {
  display: flex;
  align-items: center;
  gap: var(--lms-space-sm);
  cursor: pointer;
  user-select: none;
  transition: var(--lms-transition);
}

.navbar-brand:hover {
  opacity: 0.7;
}

.brand-icon {
  font-size: 1.25rem;
  color: var(--lms-black);
}

.brand-text {
  font-size: 1.25rem;
  font-weight: 900;
  letter-spacing: 0.1em;
  color: var(--lms-black-pure);
  text-transform: uppercase;
}

/* Nav links */
.navbar-nav {
  display: flex;
  align-items: center;
  gap: var(--lms-space-xs);
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--lms-gray-600);
  border-radius: var(--lms-radius);
  transition: var(--lms-transition);
  text-decoration: none;
}

.nav-link:hover {
  color: var(--lms-black);
  background: var(--lms-gray-100);
}

.nav-link-active {
  color: var(--lms-white) !important;
  background: var(--lms-black) !important;
  font-weight: 700;
}

.nav-link i {
  font-size: 0.9rem;
}

/* User section */
.navbar-user {
  display: flex;
  align-items: center;
  gap: var(--lms-space-md);
}

.user-name {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--lms-black);
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Role badge monochrome */
.role-badge {
  background: var(--lms-white) !important;
  color: var(--lms-black) !important;
  border: 2px solid var(--lms-black) !important;
  font-size: 0.65rem !important;
  font-weight: 800 !important;
  letter-spacing: 0.08em !important;
  padding: 2px 10px !important;
}

/* Admin badge đảo màu */
.role-badge-admin {
  background: var(--lms-black) !important;
  color: var(--lms-white) !important;
}

.logout-btn {
  color: var(--lms-gray-500) !important;
}

.logout-btn:hover {
  color: var(--lms-black) !important;
  background: var(--lms-gray-100) !important;
}

/* Responsive */
@media (max-width: 768px) {
  .navbar-inner {
    flex-wrap: wrap;
    height: auto;
    padding: var(--lms-space-sm) var(--lms-space-md);
    gap: var(--lms-space-sm);
  }

  .navbar-nav {
    order: 3;
    width: 100%;
    overflow-x: auto;
  }

  .user-name {
    display: none;
  }
}
</style>
