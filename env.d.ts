/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

// Type shims for Vue beta (temporary workaround until stable types are available)
declare module 'vue' {
  function ref<T>(value: T): any
  function onMounted(callback: () => void): void
  function onUnmounted(callback: () => void): void
  function computed<T>(getter: () => T): any
  export { ref, onMounted, onUnmounted, computed }
}

declare module 'vue-router' {
  function useRouter(): any
  export { useRouter }
}
