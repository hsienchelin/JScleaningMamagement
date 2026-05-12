/**
 * 年度合約 schema helper
 *
 * 設計原則：向下相容
 *  - 舊合約只有 monthlyBase 仍可運作（getSiteMonthlyBase 會直接回傳）
 *  - 新合約用 monthlyItems[] 表達月固定明細（人員工資/耗材/管理費攤提...）
 *  - 新合約可指定 billingMode 與週期任務的 scheduleType
 */

// ─── 計費模式 ──────────────────────────────────────────────────────────────────
export const BILLING_MODES = [
  {
    id: 'fixed',
    label: '月固定（均攤）',
    desc: '每月固定金額均攤支付，含週期任務攤提',
    icon: '💰',
  },
  {
    id: 'actual',
    label: '月固定 + 核實請款',
    desc: '月固定 + 週期任務按實際施作月份請款（政府機關常見）',
    icon: '📋',
  },
  {
    id: 'dispatch',
    label: '按次派工',
    desc: '無月固定，按派工次數計費（如機動清潔）',
    icon: '🚗',
  },
  {
    id: 'weekly',
    label: '每週固定次數',
    desc: '每週固定 N 次清潔，按週累計（如會議室）',
    icon: '🗓',
  },
]

export const BILLING_MODE_MAP = Object.fromEntries(BILLING_MODES.map(m => [m.id, m]))

// ─── 週期任務排程類型 ─────────────────────────────────────────────────────────
export const SCHEDULE_TYPES = [
  {
    id: 'fixed',
    label: '固定月份',
    desc: '每月（或指定月份）都要做，例如：1、3、5、7、9、11 月',
  },
  {
    id: 'range',
    label: '區間擇一',
    desc: '在指定區間內做 1 次即可，例如：9-11 月間任一月完成',
  },
  {
    id: 'once',
    label: '全年一次',
    desc: '一年內任何時候做 1 次即可，無月份限制',
  },
]

export const SCHEDULE_TYPE_MAP = Object.fromEntries(SCHEDULE_TYPES.map(t => [t.id, t]))

// ─── 計算案場月固定金額（向下相容）────────────────────────────────────────────
export function getSiteMonthlyBase(site) {
  if (!site) return 0
  // 新欄位 monthlyItems[] 優先
  if (Array.isArray(site.monthlyItems) && site.monthlyItems.length > 0) {
    return site.monthlyItems.reduce((s, item) => s + (Number(item.amount) || 0), 0)
  }
  return Number(site.monthlyBase) || 0
}

// ─── 計算合約總月費（依案場 billingMode 不同處理）──────────────────────────────
export function getContractMonthlyTotal(sites = []) {
  return sites.reduce((sum, site) => {
    const mode = site.billingMode || 'fixed'
    if (mode === 'dispatch' || mode === 'weekly') return sum  // 按次/按週不算月固定
    return sum + getSiteMonthlyBase(site)
  }, 0)
}

// ─── 判斷週期任務在「該月所屬的執行週期」是否已完成 ──────────────────────────
// fixed：每個月份獨立 → 只看該月本身是否在 completedMonths
// range：整個區間共用 1 個完成記錄 → 候選月份內任一月在 completedMonths 就算完成
// once：全年共用 1 個完成記錄 → completedMonths 有任何月份就算完成
export function isTaskCompletedInPeriod(task, month) {
  if (!task) return false
  const completed = task.completedMonths || []
  const type      = task.scheduleType || 'fixed'
  if (type === 'fixed') {
    return completed.includes(month)
  }
  if (type === 'range') {
    const candidates = task.months || []
    return candidates.some(m => completed.includes(m))
  }
  if (type === 'once') {
    return completed.length > 0
  }
  return false
}

// ─── 判斷週期任務在指定月份是否需執行（已完成則回 false）────────────────────
export function isTaskDueInMonth(task, month) {
  if (!task) return false
  // 如果這個 period 已經完成，就不再提醒
  if (isTaskCompletedInPeriod(task, month)) return false
  const type = task.scheduleType || 'fixed'
  if (type === 'fixed' || type === 'range') {
    return Array.isArray(task.months) && task.months.includes(month)
  }
  if (type === 'once') {
    // 全年一次：未完成前每個月都可執行
    return true
  }
  return false
}

// ─── 取得任務月份顯示文字 ──────────────────────────────────────────────────────
export function getTaskScheduleText(task) {
  if (!task) return ''
  const type = task.scheduleType || 'fixed'
  const months = task.months || []
  if (type === 'fixed') {
    return months.map(m => `${m}月`).join('、') || '未設定月份'
  }
  if (type === 'range') {
    if (task.windowStart && task.windowEnd) {
      return `${task.windowStart}–${task.windowEnd} 月間擇 1`
    }
    return months.length > 0 ? `${months[0]}–${months[months.length - 1]} 月間擇 1` : '區間任務'
  }
  if (type === 'once') {
    return '全年任意 1 次'
  }
  return ''
}

// ─── 取得區間任務的候選月份（windowStart..windowEnd） ────────────────────────
export function rangeMonths(windowStart, windowEnd) {
  const s = Number(windowStart)
  const e = Number(windowEnd)
  if (!s || !e || s > e) return []
  const arr = []
  for (let m = s; m <= e; m++) arr.push(m)
  return arr
}

// ─── 派工型案場：剩餘額度 ──────────────────────────────────────────────────────
export function getDispatchRemaining(plan) {
  return Math.max(0, (Number(plan?.plannedCount) || 0) - (Number(plan?.usedCount) || 0))
}

export function getDispatchRevenueUsed(plan) {
  return (Number(plan?.usedCount) || 0) * (Number(plan?.unitPrice) || 0)
}

export function getDispatchRevenueMax(plan) {
  return (Number(plan?.plannedCount) || 0) * (Number(plan?.unitPrice) || 0)
}

// ─── 每週固定型案場：年度總金額 ───────────────────────────────────────────────
export function getWeeklyAnnualTotal(weeklySchedule) {
  if (!weeklySchedule) return 0
  // 若已存 annualTotal 直接用
  if (weeklySchedule.annualTotal) return Number(weeklySchedule.annualTotal) || 0
  // 否則用 weeks × timesPerWeek × unitPrice 計算（預設 52 週）
  const weeks  = Number(weeklySchedule.weeks) || 52
  const times  = Number(weeklySchedule.timesPerWeek) || 0
  const price  = Number(weeklySchedule.unitPrice) || 0
  return weeks * times * price
}

// ─── 週幾常數 ──────────────────────────────────────────────────────────────────
export const WEEKDAYS = [
  { id: 1, label: '一', full: '週一' },
  { id: 2, label: '二', full: '週二' },
  { id: 3, label: '三', full: '週三' },
  { id: 4, label: '四', full: '週四' },
  { id: 5, label: '五', full: '週五' },
  { id: 6, label: '六', full: '週六' },
  { id: 7, label: '日', full: '週日' },
]

export const MONTH_LABELS = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']

// ─── 預設值產生器 ─────────────────────────────────────────────────────────────
export function makeNewSite(name, billingMode = 'fixed') {
  return {
    id:             `site-${Date.now()}`,
    name:           name || '',
    address:        '',
    billingMode,
    monthlyBase:    0,
    monthlyItems:   billingMode === 'fixed' || billingMode === 'actual' ? [] : [],
    dispatchPlan:   billingMode === 'dispatch' ? [] : [],
    locations:      billingMode === 'dispatch' ? [] : [],
    weeklySchedule: billingMode === 'weekly' ? { weekdays: [], timesPerWeek: 0, unitPrice: 0, weeks: 52 } : null,
    shifts:         [],
    periodicTasks:  [],
  }
}

export function makeNewMonthlyItem(name = '', amount = 0) {
  return { id: `mi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name, amount: Number(amount) || 0 }
}

export function makeNewDispatchPlanItem() {
  return {
    id: `dp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: '',
    plannedCount: 0,
    unitPrice: 0,
    usedCount: 0,
  }
}
