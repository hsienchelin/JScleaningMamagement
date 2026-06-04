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

/** 取得職災投保金額（部分工時也適用基本工資最低保障）*/
export function getOccupationalBracket(salary, laborSettings, isPartTime, basicWage = 29500) {
  const allBrackets = isPartTime
    ? [...(laborSettings?.partTime || []), ...(laborSettings?.brackets || [])]
    : (laborSettings?.brackets || [])
  const target = Math.max(salary, basicWage)
  return findBracket(allBrackets, target)
}

/**
 * 計算勞保
 * @param {number} laborBracket        - 勞保（普通事故）月投保金額
 * @param {number} occupationalBracket - 職災月投保金額（部分工時可能 >= laborBracket）
 * @param {object} rates - PAYROLL_RATES_2026 同形狀
 * @param {boolean} hasReceivedPension - 已領老年給付
 */
export function calcLabor(laborBracket, occupationalBracket, rates, hasReceivedPension = false) {
  const occupational = occupationalBracket ? round(occupationalBracket * rates.occupationalRate) : 0
  if (!laborBracket || hasReceivedPension) {
    return { employee: 0, employer: occupational, occupational, laborOnly: 0 }
  }
  const employee = round(laborBracket * rates.laborRate * rates.laborEmployeePct)
  const laborOnly = round(laborBracket * rates.laborRate * rates.laborEmployerPct)
  const employer = laborOnly + occupational
  return { employee, employer, occupational, laborOnly }
}

/**
 * 計算健保
 * @param {number} bracket - 月投保金額
 * @param {object} rates
 * @param {number} dependentCount - 眷屬人數（不含本人，預設 0）
 * @param {number} selfDiscount - 本人健保自付政府補助 %（0/25/50/100）
 * @param {number[]} dependentDiscounts - 各眷屬健保自付政府補助 %（index 對應第 i 位眷屬，可逐位不同）
 *
 * 健保局算法：先 round 單人保費，再逐口（本人＋各眷屬）套用各自的政府補助減免後加總，
 * 避免兩次四捨五入累積誤差，也讓本人與每位眷屬能套用不同補助比例。
 */
export function calcHealth(bracket, rates, dependentCount = 0, selfDiscount = 0, dependentDiscounts = []) {
  if (!bracket) return { employee: 0, employer: 0 }
  const employeePerPerson = round(bracket * rates.healthRate * rates.healthEmployeePct)
  // 本人自付（套用本人補助）
  let employee = applySelfPayDiscount(employeePerPerson, selfDiscount)
  // 眷屬自付（逐位套用各自補助）
  for (let i = 0; i < dependentCount; i++) {
    employee += applySelfPayDiscount(employeePerPerson, Number(dependentDiscounts?.[i]) || 0)
  }
  const employer = round(bracket * rates.healthRate * rates.healthEmployerPct * rates.dependentAvg)
  return { employee, employer }
}

/**
 * 套用勞健保員工自付的政府補助減免（身障補助同時適用勞保與健保自付額）
 * @param {number} employee - 員工原本應付金額
 * @param {number} discountPct - 補助 %（0/25/50/100，分別對應全額自付/身障輕度/身障中度/身障重度·全免）
 * 健保局：減免後金額仍以整數元計，使用四捨五入。
 */
export function applySelfPayDiscount(employee, discountPct = 0) {
  if (!employee) return 0
  const pct = Math.max(0, Math.min(100, Number(discountPct) || 0))
  if (pct === 0)   return employee
  if (pct === 100) return 0
  return round(employee * (1 - pct / 100))
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
 * @returns {{ laborEmployee, laborEmployerLabor, occupational, laborEmployerTotal, healthEmployee, healthEmployer, pensionEmployer, laborBracket, healthBracket, occupationalBracket }}
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
  healthSelfPayDiscount = 0, // 本人勞健保員工自付政府補助 % (0/25/50/100)；身障輕/中/重度或年長者代繳，同時減免勞保與健保（本人）自付
  dependentDiscounts = [],   // 各眷屬健保自付政府補助 %（逐口，index 對應第 i 位眷屬）
}) {
  const basicWage = rates.basicWage || 29500
  const laborBracket        = insuredLabor  ? getLaborBracket(baseSalary, laborBrackets, isPartTime, basicWage) : 0
  const occupationalBracket = insuredLabor  ? getOccupationalBracket(baseSalary, laborBrackets, isPartTime, basicWage) : 0
  const healthBracket       = insuredHealth ? getHealthBracket(baseSalary, healthBrackets, basicWage) : 0

  const labor   = calcLabor(laborBracket, occupationalBracket, rates, hasReceivedPension)
  const health  = calcHealth(healthBracket, rates, dependentCount, healthSelfPayDiscount, dependentDiscounts)
  const pension = calcPension(laborBracket, rates, employeePensionRate)

  // 比例計算（勞保 / 勞退按在職天數比例；健保月中離職則該月雇主不負擔）
  return {
    laborBracket, healthBracket, occupationalBracket,
    laborEmployee:       applySelfPayDiscount(prorateByDays(labor.employee, daysWorked), healthSelfPayDiscount),
    laborEmployerLabor:  prorateByDays(labor.laborOnly, daysWorked),
    occupational:        prorateByDays(labor.occupational, daysWorked),
    laborEmployerTotal:  prorateByDays(labor.employer, daysWorked),
    healthEmployee:      health.employee,  // 本人＋各眷屬已逐口套用政府補助
    healthEmployer:      leftMidMonth ? 0 : health.employer,
    pensionEmployer:     prorateByDays(pension.employer, daysWorked),
    pensionEmployee:     prorateByDays(pension.employee, daysWorked),
  }
}
