<!-- ============================================================================
  App.vue — Root Application Component
  Trách nhiệm DUY NHẤT: Cung cấp layout chung (Sidebar + Main Content + Toast).
  KHÔNG chứa logic nghiệp vụ, không fetch data.
  ============================================================================ -->

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import AppSidebar from '@/components/AppSidebar.vue'
import Toast from 'primevue/toast'

const route = useRoute()
const authStore = useAuthStore()

// Khởi tạo auth state khi app mount
onMounted(() => {
  authStore.initialize()
})

/** Xác định xem trang hiện tại có phải trang "khách" (login) hay không */
const isGuestPage = computed(() => route.meta.requiresGuest === true)
</script>

<template>
  <!-- Toast thông báo toàn cục -->
  <Toast position="top-right" />

  <!-- Layout cho trang khách (Login/Register) — full screen centered -->
  <div v-if="isGuestPage" class="app-guest">
    <RouterView />
  </div>

  <!-- Layout cho User đã đăng nhập (Sidebar + Main Content) -->
  <div v-else class="app-layout">
    <AppSidebar />
    <div class="lms-main-wrapper">
      <main class="lms-page">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style scoped>
/* Authenticated layout: sidebar + main side by side */
.app-layout {
  display: flex;
  min-height: 100vh;
  background-color: var(--lms-gray-50);
}

/* Guest layout: login/register full screen */
.app-guest {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--lms-gray-50);
}
</style>
