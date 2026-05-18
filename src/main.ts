// ============================================================================
// main.ts — Frontend Entry Point
// Trách nhiệm DUY NHẤT: Khởi tạo Vue app, đăng ký plugins.
// KHÔNG chứa logic nghiệp vụ hay cấu hình component.
// ============================================================================

import { createApp } from 'vue'
import { createPinia } from 'pinia'

// PrimeVue
import PrimeVue from 'primevue/config'
import Aura from '@primevue/themes/aura'
import ToastService from 'primevue/toastservice'
import ConfirmationService from 'primevue/confirmationservice'
import 'primeicons/primeicons.css'

// App
import App from './App.vue'
import router from './router'
import './assets/main.css'

const app = createApp(App)

// ─── Plugins ───
app.use(createPinia())
app.use(router)
app.use(PrimeVue, {
  theme: {
    preset: Aura,
    options: {
      darkModeSelector: false,
      cssLayer: false
    }
  }
})
app.use(ToastService)
app.use(ConfirmationService)

app.mount('#app')
