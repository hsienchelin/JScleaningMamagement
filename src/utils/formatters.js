/**
 * formatters.js — 格式化工具函式
 *
 * 純函式，不依賴 React，可在任何地方 import。
 */

// ─── 金額格式 ─────────────────────────────────────────────────────────────────
export function currency(n) {
  return `$${Number(n || 0).toLocaleString()}`
}

// ─── 日期格式 ─────────────────────────────────────────────────────────────────
// YYYY-MM-DD → 2026/04/16
export function dateDisplay(isoStr) {
  if (!isoStr) return '-'
  return isoStr.replace(/-/g, '/')
}

// 取得今天 ISO 日期字串 (YYYY-MM-DD)
export function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

// ─── 數字補零 ─────────────────────────────────────────────────────────────────
export function pad2(n) {
  return String(n).padStart(2, '0')
}

// ─── 人數 / 時數 ──────────────────────────────────────────────────────────────
export function hoursLabel(h) {
  return `${h} 小時`
}
