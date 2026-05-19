#!/usr/bin/env node
/**
 * 一次性 seed：建立「新北市政府文化局」客戶（若不存在）+ 115 年度新店十四張歷史建築園區合約
 *
 * 來源：115 年新店十四張歷史建築園區清潔維護工作 經費概算表（經議價後調整）
 * 金額：不含行政管理費（10%）與營業稅（5%）—— 純合約直接成本
 *
 * 跑法：
 *   STAGING_EMAIL=xxx@gmail.com STAGING_PASSWORD=xxx \
 *     node scripts/seedShisizhangContract.mjs
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
const CUSTOMER_NAME = '新北市政府文化局'
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
  id: `mi-${Math.random().toString(36).slice(2, 8)}`,
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

// ─── 2. 案場資料：新店十四張歷史建築園區 ───────────────────────────────────
//
// 115 年度經費拆解（不含行政管理費 10% 與營業稅 5%）：
//   月固定（人力 + 用品 + 雜項月攤）：
//     1-1 駐點人力薪資  39,064 × 3 人 × 12 月 = 1,406,304   → 117,192 / 月
//     1-3 勞工健康檢查  1,000 × 1 次 × 3 人  =     3,000   →     250 / 月（年攤）
//      4  材料機具設備  53,770（合約明列分 12 月攤）       →   4,481 / 月
//      3  機動人力      24 小時 × 200             =  4,800   →     400 / 月（年攤）
//      5  垃圾清運                              =  35,868   →   2,989 / 月
//     月固定合計 = 125,312 / 月
//   週期任務（按次實作）：
//      2  戶外地面青苔高壓沖洗  3 次 × 49,755 = 149,265（依機關通知，月份不指定）
//   115 年度總額：125,312 × 12 + 149,265 = 1,503,744 + 149,265 = 1,653,009
//   （與 PDF 拆分 1,653,007 差 2 元，源自材機 53,770/12 捨入）
//
// 註：1-2 三節慰問金（18,000）不放 monthlyItems，由薪資頁逐節處理。

const site = {
  id:           `site-shisizhang-${Date.now()}`,
  name:         '新店十四張歷史建築園區',
  address:      '新北市新店區',
  billingMode:  'actual',
  monthlyItems: [
    monthlyItem('清潔駐點人力薪資（3 人 × 39,064，含勞健保/勞退/整備金）', 117192),
    monthlyItem('勞工健康檢查月攤（3 人 × 1,000 ÷ 12）', 250),
    monthlyItem('清潔材料機具設備月攤（53,770 ÷ 12）', 4481),
    monthlyItem('機動人力月攤（24 小時 × 200 ÷ 12，配合活動或颱風後）', 400),
    monthlyItem('垃圾清運（新北市政府專用垃圾袋）', 2989),
  ],
  monthlyBase:   125312,
  dispatchPlan:  [],
  locations:     [],
  weeklySchedule: null,
  shifts:        [],
  periodicTasks: [
    // 戶外地面青苔高壓沖洗 3 次/年（依機關通知辦理，月份不指定 → 整年區間，分 3 段）
    rangeTask('戶外地面青苔高壓沖洗（第 1 次）', 49755, 1, 4),
    rangeTask('戶外地面青苔高壓沖洗（第 2 次）', 49755, 5, 8),
    rangeTask('戶外地面青苔高壓沖洗（第 3 次）', 49755, 9, 12),
  ],
  assignedEmployeeIds:   [],
  weeklyVisits:          [],
  monthlyConsumableCost: 0,
  monthlyToolCost:       0,
}

// ─── 3. 建合約 ─────────────────────────────────────────────────────────────
const contractData = {
  orgId:         ORG_ID,
  title:         '115 年新店十四張歷史建築園區清潔維護工作',
  contractNo:    '',
  customerId,
  customerName:  CUSTOMER_NAME,
  contractStart: '2026-01-01',
  contractEnd:   '2026-12-31',
  totalValue:    1653007,
  paymentMode:   'actual',
  status:        'active',
  sites:         [site],
  amendments:    [],
  notes:         '經議價後調整。採輪休每日安排至少 2 人、工時 08:00-17:00。員工月薪不低於 32,450 元（配合 115 年基本薪資調漲）。合約金額 1,653,007 元為未稅小計（不含行政管理費 10%、營業稅 5%；三節慰問金 18,000 由薪資頁逐節處理）。',
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
console.log(`  合約金額：$${contractData.totalValue.toLocaleString()}（未稅、不含管理費）`)
console.log(`  付款方式：核實請款`)
console.log(`  月固定：$${site.monthlyBase.toLocaleString()} / 月`)
console.log(`  週期任務：${site.periodicTasks.length} 項`)
console.log('')
console.log('  下一步：')
console.log('    cd "/Users/linxianzhe/Desktop/ERP Website"')
console.log('    npm run dev')
console.log('    → 開啟瀏覽器 → 訂單 & 合約 → 年度合約分頁')
console.log('')

process.exit(0)
