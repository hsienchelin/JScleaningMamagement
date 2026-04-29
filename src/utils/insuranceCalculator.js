/**
 * 勞健保 / 勞退計算工具
 * 純函式，依據傳入的 settings（費率）與 brackets（級距）計算金額
 */

// 四捨五入到整數
const round = (n) => Math.round(n)

// 找出「>= salary 的最低級距」（往上取）
export function findBracket(brackets, salary) {
  if (!brackets || !brackets.length) return 0
  const sorted = [...brackets].sort((a, b) => a - b)
  for (const b of sorted) if (b >= salary) return b
  return sorted[sorted.length - 1] // 超過最高 → 取最高
}

/**
 * 取得勞保投保金額
 * @param {number} salary - 本薪
 * @param {object} laborSettings - { brackets:[], partTime:[] }
 * @param {boolean} isPartTime - 是否部分工時
 * @param {number} basicWage - 基本工資（部分工時最低保障）
 */
export function getLaborBracket(salary, laborSettings, isPartTime, basicWage = 29500) {
  const allBrackets = isPartTime
    ? [...(laborSettings?.partTime || []), ...(laborSettings?.brackets || [])]
    : (laborSettings?.brackets || [])
  // 部分工時最低不低於基本工資的下級
  const target = Math.max(salary, isPartTime ? 0 : basicWage)
  return findBracket(allBrackets, target)
}

/** 取得健保投保金額（最低為基本工資 29,500）*/
export function getHealthBracket(salary, healthSettings, basicWage = 29500) {
  const target = Math.max(salary, basicWage)
  return findBracket(healthSettings?.brackets || [], target)
}

/**
 * 計算勞保
 * @param {number} bracket - 月投保金額
 * @param {object} rates - PAYROLL_RATES_2026 同形狀
 * @param {boolean} hasReceivedPension - 已領老年給付
 */
export function calcLabor(bracket, rates, hasReceivedPension = false) {
  if (!bracket) return { employee: 0, employer: 0, occupational: 0 }
  const occupational = round(bracket * rates.occupationalRate)
  if (hasReceivedPension) {
    return { employee: 0, employer: occupational, occupational, laborOnly: 0 }
  }
  const employee = round(bracket * rates.laborRate * rates.laborEmployeePct)
  const laborOnly = round(bracket * rates.laborRate * rates.laborEmployerPct)
  const employer = laborOnly + occupational
  return { employee, employer, occupational, laborOnly }
}

/**
 * 計算健保
 * @param {number} bracket - 月投保金額
 * @param {object} rates
 * @param {number} dependentCount - 眷屬人數（不含本人，預設 0）
 */
export function calcHealth(bracket, rates, dependentCount = 0) {
  if (!bracket) return { employee: 0, employer: 0 }
  const employee = round(bracket * rates.healthRate * rates.healthEmployeePct * (1 + dependentCount))
  const employer = round(bracket * rates.healthRate * rates.healthEmployerPct * rates.dependentAvg)
  return { employee, employer }
}

/** 計算勞退（雇主 6%）*/
export function calcPension(bracket, rates, employeeContribRate = 0) {
  if (!bracket) return { employer: 0, employee: 0 }
  return {
    employer: round(bracket * rates.pensionRate),
    employee: round(bracket * (employeeContribRate || 0)),
  }
}

/**
 * 月中離職比例：勞保勞退 = (月薪 / 30) × 在職天數
 * 當 daysWorked >= 30 (整月) 或 0 時不調整
 */
export function prorateByDays(amount, daysWorked) {
  if (!daysWorked || daysWorked >= 30) return amount
  return round(amount * daysWorked / 30)
}

/**
 * 一鍵算出所有保險金額
 * @returns {{ laborEmployee, laborEmployerLabor, occupational, laborEmployerTotal, healthEmployee, healthEmployer, pensionEmployer, laborBracket, healthBracket }}
 */
export function calcAllInsurance({
  baseSalary,
  rates,
  laborBrackets,
  healthBrackets,
  insuredLabor = true,
  insuredHealth = true,
  isPartTime = false,
  hasReceivedPension = false,
  dependentCount = 0,
  employeePensionRate = 0,
  daysWorked = 30,        // 在職天數（用於月中離職比例）
  leftMidMonth = false,    // 是否月中離職（健保該月雇主不負擔）
}) {
  const basicWage = rates.basicWage || 29500
  const laborBracket  = insuredLabor  ? getLaborBracket(baseSalary, laborBrackets, isPartTime, basicWage) : 0
  const healthBracket = insuredHealth ? getHealthBracket(baseSalary, healthBrackets, basicWage) : 0

  const labor   = calcLabor(laborBracket, rates, hasReceivedPension)
  const health  = calcHealth(healthBracket, rates, dependentCount)
  const pension = calcPension(laborBracket, rates, employeePensionRate)

  // 比例計算（勞保 / 勞退按在職天數比例；健保月中離職則該月雇主不負擔）
  return {
    laborBracket, healthBracket,
    laborEmployee:       prorateByDays(labor.employee, daysWorked),
    laborEmployerLabor:  prorateByDays(labor.laborOnly, daysWorked),
    occupational:        prorateByDays(labor.occupational, daysWorked),
    laborEmployerTotal:  prorateByDays(labor.employer, daysWorked),
    healthEmployee:      health.employee,
    healthEmployer:      leftMidMonth ? 0 : health.employer,
    pensionEmployer:     prorateByDays(pension.employer, daysWorked),
    pensionEmployee:     prorateByDays(pension.employee, daysWorked),
  }
}
