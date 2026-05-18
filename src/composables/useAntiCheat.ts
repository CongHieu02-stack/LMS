// ============================================================================
// composables/useAntiCheat.ts — Composable chống gian lận thi cử
// Trách nhiệm DUY NHẤT: Thiết lập event listeners theo dõi chuyển tab/cửa sổ,
// đếm số lần vi phạm, và kích hoạt callback nộp bài khi vượt ngưỡng.
// KHÔNG chứa logic UI, không render component, không gọi API.
// ============================================================================

import { ref, onMounted, onUnmounted } from 'vue'

/** Cấu hình cho anti-cheat */
interface AntiCheatOptions {
  /** Số lần vi phạm tối đa trước khi bắt buộc nộp bài (mặc định: 3) */
  maxViolations?: number
  /** Callback được gọi khi vi phạm vượt ngưỡng — nộp bài bắt buộc */
  onForceSubmit: () => void
  /** Callback được gọi mỗi lần phát hiện vi phạm (tùy chọn) */
  onViolation?: (count: number) => void
}

/**
 * Composable chống gian lận thi cử.
 *
 * Theo dõi 2 sự kiện:
 * 1. `visibilitychange` — Phát hiện khi user chuyển sang tab khác
 * 2. `window.blur` — Phát hiện khi cửa sổ mất focus (Alt+Tab, click ngoài)
 *
 * Khi số lần vi phạm vượt quá ngưỡng → gọi callback nộp bài bắt buộc.
 *
 * @example
 * ```ts
 * const { violationCount, isLocked } = useAntiCheat({
 *   maxViolations: 3,
 *   onForceSubmit: () => submitExam(true),
 *   onViolation: (count) => toast.warn(`Vi phạm lần ${count}!`)
 * })
 * ```
 */
export function useAntiCheat(options: AntiCheatOptions) {
  const { maxViolations = 3, onForceSubmit, onViolation } = options

  /** Số lần vi phạm hiện tại */
  const violationCount = ref(0)

  /** Đã bị khóa bài thi chưa (vi phạm >= max) */
  const isLocked = ref(false)

  /** Flag tránh gọi force submit nhiều lần */
  let forceSubmitCalled = false

  /**
   * Xử lý khi phát hiện vi phạm.
   * Hàm nội bộ — không export, chỉ dùng trong composable.
   */
  function handleViolation(): void {
    // Đã khóa rồi thì không đếm thêm
    if (isLocked.value) return

    violationCount.value++

    // Gọi callback thông báo vi phạm (nếu có)
    if (onViolation) {
      onViolation(violationCount.value)
    }

    // Kiểm tra vượt ngưỡng
    if (violationCount.value >= maxViolations && !forceSubmitCalled) {
      isLocked.value = true
      forceSubmitCalled = true
      onForceSubmit()
    }
  }

  /**
   * Handler cho sự kiện visibilitychange.
   * Kích hoạt khi user chuyển tab (document.hidden = true).
   */
  function onVisibilityChange(): void {
    if (document.hidden) {
      handleViolation()
    }
  }

  /**
   * Handler cho sự kiện window.blur.
   * Kích hoạt khi cửa sổ mất focus (Alt+Tab, click ra ngoài).
   */
  function onWindowBlur(): void {
    handleViolation()
  }

  // ─── LIFECYCLE: Mount listeners ───
  onMounted(() => {
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('blur', onWindowBlur)
  })

  // ─── LIFECYCLE: Cleanup listeners ───
  onUnmounted(() => {
    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.removeEventListener('blur', onWindowBlur)
  })

  return {
    /** Số lần vi phạm (reactive) */
    violationCount,
    /** Bài thi đã bị khóa chưa (reactive) */
    isLocked
  }
}
