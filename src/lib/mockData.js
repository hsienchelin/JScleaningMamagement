// ─── 靜態設定常數（非 mock 資料）──────────────────────────────────────────────
// 實際業務資料已移至 Firestore，透過 src/hooks/useCollection.js 讀取

export const ORGS = [
  { id: 'jiaxiang', name: '佳翔清潔', color: '#2563eb', type: 'government' },
  { id: 'zhexin',   name: '哲欣清潔', color: '#7c3aed', type: 'commercial' },
]

export const WORK_TYPES = [
  { id: 'stationed', name: '駐點清潔', color: '#2563eb' },
  { id: 'rough',     name: '裝潢粗清', color: '#f59e0b' },
  { id: 'fine',      name: '裝潢細清', color: '#10b981' },
  { id: 'disinfect', name: '環境消毒', color: '#06b6d4' },
  { id: 'other',     name: '其他',     color: '#8b5cf6' },
]

export const DIFFICULTY_COEFFICIENTS = [
  { id: 'normal',    name: '一般',     value: 1.0 },
  { id: 'marble',    name: '全室石材', value: 1.2 },
  { id: 'high_rise', name: '高空玻璃', value: 1.5 },
  { id: 'hospital',  name: '醫療院所', value: 1.3 },
]

export const CLEANING_TYPES = [
  '粗清（開荒）',
  '細清（精清）',
  '洗地打蠟',
  '石材護理研磨',
  '外牆高空清洗',
  '地毯清洗',
  '玻璃清潔',
  '消毒殺菌',
  '一般日常清潔',
  '工程後清',
]

export const PRESET_TASKS = [
  { id: 'pt001', name: '大廳洗地機洗',   category: '地板清潔' },
  { id: 'pt002', name: '地板拋光上蠟',   category: '地板清潔' },
  { id: 'pt003', name: '石材養護研磨',   category: '石材護理' },
  { id: 'pt004', name: '玻璃刮拭清潔',   category: '玻璃清潔' },
  { id: 'pt005', name: '外牆高空清洗',   category: '外牆清潔' },
  { id: 'pt006', name: '廁所消毒清潔',   category: '衛生清潔' },
  { id: 'pt007', name: '垃圾收集清運',   category: '環境清潔' },
  { id: 'pt008', name: '地毯吸塵除污',   category: '地板清潔' },
  { id: 'pt009', name: '停車場地面刷洗', category: '特殊區域' },
  { id: 'pt010', name: '電梯廂全面清潔', category: '特殊區域' },
  { id: 'pt011', name: '辦公室桌椅清潔', category: '辦公區域' },
  { id: 'pt012', name: '天花板高處除塵', category: '高處清潔' },
  { id: 'pt013', name: '裝潢清潔－粗清', category: '裝潢清潔' },
  { id: 'pt014', name: '裝潢清潔－細清', category: '裝潢清潔' },
  { id: 'pt015', name: '裝潢清潔－收尾', category: '裝潢清潔' },
  { id: 'pt016', name: '環境消毒',       category: '消毒除菌' },
]

export const PAY_RATES = {
  stationed: { '清潔組長': 1500, '清潔技術員': 1200, '機動清潔員': 1100 },
  overtimePerHour: 200,
}

export const DEDUCTION_RATES = {
  laborInsurance:  0.0208,
  healthInsurance: 0.0155,
  withholdingTax:  0.05,
}

export const COST_ENGINE = {
  periodStart: '',
  periodEnd:   '',
  totalPurchaseAmount: 0,
  totalServiceArea:    0,
  costPerSqm:          0,
}

// ─── 以下為向下相容的空陣列，各頁面遷移至 Firestore 後可逐步移除 ───────────────
export const MOCK_USER              = null
export const MOCK_EMPLOYEES         = []
export const MOCK_CUSTOMERS         = []
export const MOCK_ORDERS            = []
export const MOCK_ANNUAL_CONTRACTS  = []
export const MOCK_WORK_ORDERS       = []
export const MOCK_SCHEDULE_TEMPLATES = []
export const MOCK_SCHEDULE_INSTANCES = []
export const MOCK_MOBILE_DISPATCHES  = []
export const MOCK_INVENTORY_ITEMS    = []
export const MOCK_WORK_REPORTS       = []
export const MOCK_SUPPLIERS          = []
export const MOCK_PURCHASES          = []
export const MOCK_SALARY_RECORDS     = []
export const MOCK_AR                 = []
export const MOCK_FINANCE            = { monthly: [], profitByType: [] }
