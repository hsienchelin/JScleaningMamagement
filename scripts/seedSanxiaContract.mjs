#!/usr/bin/env node
/**
 * 一次性 seed：建立「新北市三峽區公所」客戶 + 115 年合約（5 個案場、含變更後條款）
 *
 * 跑法：
 *   STAGING_EMAIL=xxx@gmail.com STAGING_PASSWORD=xxx \
 *     node scripts/seedSanxiaContract.mjs
 *
 * 預設讀 .env.development → 寫 staging。換成 .env.production 就會寫 prod。
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { initializeApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import {
  getFirestore, collection, doc, getDocs, query, where,
  addDoc, setDoc, serverTimestamp,
} from 'firebase/firestore'

// ─── 讀 env ──────────────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url)
const __dirname  = dirname(__filename)
const envFile = process.env.SEED_ENV_FILE || '.env.development'
try {
  const envContent = readFileSync(resolve(__dirname, '..', envFile), 'utf-8')
  envContent.split('\n').forEach(line => {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  })
} catch (e) {
  console.error(`✗ 讀不到 ${envFile}：${e.message}`)
  process.exit(1)
}

const email    = process.env.STAGING_EMAIL    || process.env.SEED_EMAIL
const password = process.env.STAGING_PASSWORD || process.env.SEED_PASSWORD
if (!email || !password) {
  console.error('✗ 請設定環境變數 STAGING_EMAIL 和 STAGING_PASSWORD')
  process.exit(1)
}

const firebaseConfig = {
  apiKey:            process.env.VITE_FIREBASE_API_KEY,
  authDomain:        process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.VITE_FIREBASE_APP_ID,
}

console.log(`▶ 連 Firebase 專案：${firebaseConfig.projectId}`)
console.log(`▶ 登入帳號：${email}`)

const app = initializeApp(firebaseConfig)
const auth = getAuth(app)
const db   = getFirestore(app)

await signInWithEmailAndPassword(auth, email, password)
console.log('✓ 已登入')

// ─── 1. 建立或取得客戶 ────────────────────────────────────────────────────────
const CUSTOMER_NAME = '新北市三峽區公所'
const ORG_ID = 'jiaxiang'

async function findOrCreateCustomer() {
  const snap = await getDocs(query(
    collection(db, 'customers'),
    where('orgId', '==', ORG_ID),
    where('name', '==', CUSTOMER_NAME),
  ))
  if (!snap.empty) {
    console.log(`✓ 客戶已存在：${CUSTOMER_NAME} (${snap.docs[0].id})`)
    return snap.docs[0].id
  }
  const ref = await addDoc(collection(db, 'customers'), {
    orgId:    ORG_ID,
    name:     CUSTOMER_NAME,
    category: 'gov',
    contact:  '',
    phone:    '',
    email:    '',
    taxId:    '',
    fax:      '',
    sites:    [],
    createdAt: serverTimestamp(),
  })
  console.log(`✓ 建立客戶：${CUSTOMER_NAME} (${ref.id})`)
  return ref.id
}

const customerId = await findOrCreateCustomer()

// ─── helper ──────────────────────────────────────────────────────────────────
const monthlyItem = (name, amount) => ({
  id: `mi-${name}-${Math.random().toString(36).slice(2, 8)}`,
  name, amount,
})
const fixedTask = (name, unitPrice, months) => ({
  id:   `task-${Math.random().toString(36).slice(2, 8)}`,
  name, unitPrice,
  scheduleType: 'fixed',
  months: [...months].sort((a, b) => a - b),
  completedMonths: [],
})
const rangeTask = (name, unitPrice, windowStart, windowEnd) => {
  const months = []
  for (let m = windowStart; m <= windowEnd; m++) months.push(m)
  return {
    id:   `task-${Math.random().toString(36).slice(2, 8)}`,
    name, unitPrice,
    scheduleType: 'range',
    months,
    windowStart, windowEnd,
    completedMonths: [],
  }
}
const onceTask = (name, unitPrice, months = []) => ({
  id:   `task-${Math.random().toString(36).slice(2, 8)}`,
  name, unitPrice,
  scheduleType: 'once',
  months,
  completedMonths: [],
})

// ─── 2. 案場資料（5 個）──────────────────────────────────────────────────────

// 案場 1：行政大樓（核實請款）
const site1 = {
  id:           `site-admin-${Date.now()}`,
  name:         '行政大樓',
  address:      '新北市三峽區',
  billingMode:  'actual',
  monthlyItems: [
    monthlyItem('清潔人員工資',  44500),
    monthlyItem('機具耗材',       1500),
    monthlyItem('專用及一般垃圾袋', 2000),
    monthlyItem('管理費月攤',     6500),
  ],
  monthlyBase:   54500,
  dispatchPlan:  [],
  locations:     [],
  weeklySchedule: null,
  shifts:        [],
  periodicTasks: [
    onceTask('地板除蠟', 30000, [12]),
    fixedTask('地板打蠟（含綠屋頂清掃）', 25000, [1, 3, 5, 7, 9, 11]),
    fixedTask('地下室停車場清潔', 7500, [1, 3, 5, 7, 9, 11]),
    fixedTask('前階梯及地面及外側四樓層階梯高壓清洗', 7500, [1, 3, 5, 7, 9, 11]),
    rangeTask('飲用水塔及蓄水池清洗', 8000, 9, 11),
    rangeTask('病媒防治（上半年）', 8000, 3, 5),
    rangeTask('病媒防治（下半年）', 8000, 9, 11),
    rangeTask('水肥清運', 18000, 6, 8),
    rangeTask('外牆玻璃清洗', 39000, 9, 11),
    rangeTask('循環風扇擦拭', 14500, 5, 9),
  ],
  monthlyConsumableCost: 0,
  monthlyToolCost:       0,
}

// 案場 2：生命紀念館（核實請款）
const site2 = {
  id:           `site-memorial-${Date.now()}`,
  name:         '生命紀念館',
  address:      '新北市三峽區',
  billingMode:  'actual',
  monthlyItems: [
    monthlyItem('1~4樓地板清掃拖拭、廁所及樓梯間清潔、4樓陽台清掃', 29500),
  ],
  monthlyBase:   29500,
  dispatchPlan:  [],
  locations:     [],
  weeklySchedule: null,
  shifts:        [],
  periodicTasks: [
    rangeTask('1~4樓玻璃擦拭、除塵（上半年）', 10000, 1, 3),
    rangeTask('1~4樓玻璃擦拭、除塵（下半年）', 10000, 7, 9),
    fixedTask('櫃位及牌位擦拭', 9000, [2, 4, 6, 8, 10, 12]),
    rangeTask('水塔清洗', 5000, 5, 7),
    rangeTask('全棟外牆清洗、採光罩清洗', 65000, 5, 7),
  ],
  monthlyConsumableCost: 0,
  monthlyToolCost:       0,
}

// 案場 3：調解委員會（每週固定）
const site3 = {
  id:           `site-mediation-${Date.now()}`,
  name:         '調解委員會',
  address:      '新北市三峽區',
  billingMode:  'weekly',
  monthlyItems: [],
  monthlyBase:   0,
  dispatchPlan:  [],
  locations:     [],
  weeklySchedule: {
    weekdays: [2, 3, 5],
    timesPerWeek: 3,
    unitPrice: 1000,
    weeks: 52,
    annualTotal: 156000,
  },
  shifts:        [],
  periodicTasks: [],
  monthlyConsumableCost: 0,
  monthlyToolCost:       0,
}

// 案場 4：市民活動中心（按次派工，19 間分點）
const site4 = {
  id:           `site-community-${Date.now()}`,
  name:         '市民活動中心',
  address:      '新北市三峽區',
  billingMode:  'dispatch',
  monthlyItems: [],
  monthlyBase:   0,
  dispatchPlan: [
    { id: `dp-mobile-${Math.random().toString(36).slice(2, 6)}`,  name: '機動清潔', plannedCount: 10, unitPrice: 3000,  usedCount: 0 },
    { id: `dp-regular-${Math.random().toString(36).slice(2, 6)}`, name: '平時清潔', plannedCount: 70, unitPrice: 2000,  usedCount: 0 },
    { id: `dp-annual-${Math.random().toString(36).slice(2, 6)}`,  name: '年度清潔', plannedCount: 23, unitPrice: 10000, usedCount: 0 },
  ],
  locations: [
    '長青', '龍學龍恩', '大埔二鬮', '介壽中正安溪礁溪', '龍埔',
    '八張', '弘道', '五寮', '竹崙', '自強',
    '大有', '添福', '溪東', '安和', '仁愛',
    '成福', '中興', '溪北', '光明',
  ],
  weeklySchedule: null,
  shifts:        [],
  periodicTasks: [],
  monthlyConsumableCost: 0,
  monthlyToolCost:       0,
}

// 案場 5：歷史文物館（月固定）
const site5 = {
  id:           `site-museum-${Date.now()}`,
  name:         '歷史文物館',
  address:      '新北市三峽區',
  billingMode:  'fixed',
  monthlyItems: [
    monthlyItem('環境清潔維護（每日 1 次 + 月清 + 年清）', 13000),
  ],
  monthlyBase:   13000,
  dispatchPlan:  [],
  locations:     [],
  weeklySchedule: null,
  shifts:        [],
  periodicTasks: [],
  monthlyConsumableCost: 0,
  monthlyToolCost:       0,
}

// ─── 3. 建合約 ─────────────────────────────────────────────────────────────
const contractData = {
  orgId:         ORG_ID,
  title:         '115 年三峽區公所經管廳舍環境清潔維護委外案',
  contractNo:    '',  // 招標文件未提供
  customerId,
  customerName:  CUSTOMER_NAME,
  contractStart: '2026-01-01',
  contractEnd:   '2026-12-31',
  totalValue:    2305375,
  paymentMode:   'actual',
  status:        'active',
  sites:         [site1, site2, site3, site4, site5],
  amendments: [
    {
      no:      1,
      date:    '2026-01-01',  // 實際日期 PDF 未顯示
      summary: '付款方式改為核實請款；行政大樓與生命紀念館各週期任務指定具體執行月份',
    },
  ],
  notes:         '原契約 230 萬 5,375 元（含稅）；履約期限 115/1/1～115/12/31。第 1 次變更：合約金額與履約期限皆未變更，付款方式改為「每月依實際施作項目核實請款」。',
  createdAt: serverTimestamp(),
}

// 防呆：先檢查是否已有相同標題的合約
const existing = await getDocs(query(
  collection(db, 'annualContracts'),
  where('orgId', '==', ORG_ID),
  where('title', '==', contractData.title),
))
if (!existing.empty) {
  console.error(`✗ 已存在同名合約 (id=${existing.docs[0].id})。如要重建請先在 Firebase Console 刪除。`)
  process.exit(1)
}

const cref = await addDoc(collection(db, 'annualContracts'), contractData)
console.log(`✓ 建立合約：${contractData.title} (${cref.id})`)
console.log(`✓ 包含 ${contractData.sites.length} 個案場：${contractData.sites.map(s => s.name).join('、')}`)

// ─── Summary ───────────────────────────────────────────────────────────────
console.log('')
console.log('─────────────────────────────────────────────')
console.log('  建檔完成 ✓')
console.log('─────────────────────────────────────────────')
console.log(`  客戶：${CUSTOMER_NAME}`)
console.log(`  合約：${contractData.title}`)
console.log(`  合約金額：$${contractData.totalValue.toLocaleString()}`)
console.log(`  付款方式：核實請款`)
console.log(`  案場：${contractData.sites.length} 個`)
console.log('')
console.log('  下一步：')
console.log('    cd "/Users/linxianzhe/Desktop/ERP Website"')
console.log('    npm run dev')
console.log('    → 開啟瀏覽器 → 訂單 & 合約 → 年度合約分頁')
console.log('')

process.exit(0)
