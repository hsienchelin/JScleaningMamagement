/**
 * calculators.js — 薪資與成本計算工具
 *
 * 純函式，不依賴任何 React 元件，可在任何地方安全 import。
 * 薪資結構對應會計 Excel 登記方式：
 *   應發 = 本薪 + 職務加給 + 加班費 + 年終 + 過年 + 特休 + 代付款 + 機動出勤
 *   扣除 = 勞保自負 + 健保自負 + 勞退自提 + 請假 + 其他扣款 + 借支
 *   實領 = 應發 − 扣除
 */

// ─── Per-entry pay ────────────────────────────────────────────────────────────
// Site-grouped format: { siteName, count, rate }  → count × rate
// Legacy hourly format: { rateType:'hourly', hours, rate } → hours × rate
// Legacy daily  format: { rateType:'daily',  rate }        → rate
export function calcEntry(entry) {
  if ('count' in entry) return (entry.count || 0) * (entry.rate || 0)
  if (entry.rateType === 'hourly') return (entry.hours || 0) * (entry.rate || 0)
  return entry.rate || 0
}

// ─── Full salary calculation ──────────────────────────────────────────────────
export function calcSalary(record, _employee) {
  // ── Earnings ──────────────────────────────────────────────────────────────
  const baseSalary      = record.baseSalary      || 0
  const allowance       = record.allowance       || 0
  const overtimePay     = record.overtimePay     || 0
  const yearEndBonus    = record.yearEndBonus     || 0
  const lunarBonus      = record.lunarBonus       || 0
  const paidLeave       = record.paidLeave        || 0
  const advancePayment  = record.advancePayment   || 0
  const mobilePay       = (record.mobile || []).reduce((s, m) => s + calcEntry(m), 0)

  const gross = baseSalary + allowance + overtimePay + yearEndBonus + lunarBonus + paidLeave + advancePayment + mobilePay

  // ── Deductions (employee portion) ─────────────────────────────────────────
  const laborInsEmployee  = record.laborInsEmployee  || 0
  const healthInsEmployee = record.healthInsEmployee || 0
  const pensionEmployee   = record.pensionEmployee   || 0
  const leaveDeduction    = record.leaveDeduction    || 0
  const otherDeductions   = record.otherDeductions   || 0
  const advance           = record.advance           || 0

  const totalDeductions = laborInsEmployee + healthInsEmployee + pensionEmployee + leaveDeduction + otherDeductions + advance
  const net = gross - totalDeductions

  // ── Employer costs (reference only, not deducted from employee) ───────────
  const laborInsEmployer  = record.laborInsEmployer  || 0
  const healthInsEmployer = record.healthInsEmployer || 0
  const pensionEmployer   = record.pensionEmployer   || 0
  const totalEmployerCosts = laborInsEmployer + healthInsEmployer + pensionEmployer

  return {
    baseSalary, allowance, overtimePay, yearEndBonus, lunarBonus, paidLeave, advancePayment, mobilePay,
    gross,
    laborInsEmployee, healthInsEmployee, pensionEmployee, leaveDeduction, otherDeductions, advance,
    totalDeductions, net,
    laborInsEmployer, healthInsEmployer, pensionEmployer, totalEmployerCosts,
  }
}

// ─── 材料耗材異常偵測 ──────────────────────────────────────────────────────────
// 若 qty 超過 item.maxPerDay 即視為異常，回傳 true
export function isMaterialAnomaly(item, qty) {
  if (!item?.maxPerDay) return false
  return qty > item.maxPerDay
}
