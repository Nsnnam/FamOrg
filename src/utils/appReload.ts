/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Một điểm reload duy nhất cho cả luồng cập nhật (banner tự động ở App + nút
// "Cập nhật ngay" của admin ở Settings). Khóa module đảm bảo dù nhiều nguồn
// cùng yêu cầu (controllerchange của service worker, fallback timeout, xác nhận
// đã lên bản mới…) thì trang chỉ tải lại ĐÚNG MỘT LẦN — tránh nháy/giật.

let reloaded = false;
let fallbackTimer: number | null = null;

/** Tải lại trang ngay, tối đa một lần. Hủy mọi fallback đang chờ. */
export function reloadOnce(): void {
  if (reloaded) return;
  reloaded = true;
  if (fallbackTimer !== null) {
    window.clearTimeout(fallbackTimer);
    fallbackTimer = null;
  }
  window.location.reload();
}

/**
 * Đặt một reload dự phòng sau `ms` — dùng khi ta đã kích hoạt SKIP_WAITING và
 * kỳ vọng `controllerchange` sẽ reload trước; nếu vì lý do gì nó không bắn, dự
 * phòng này bảo đảm trang vẫn được nạp bản mới. reloadOnce() sẽ hủy nó nếu tới
 * trước.
 */
export function scheduleReloadFallback(ms: number): void {
  if (reloaded || fallbackTimer !== null) return;
  fallbackTimer = window.setTimeout(() => {
    fallbackTimer = null;
    reloadOnce();
  }, ms);
}
