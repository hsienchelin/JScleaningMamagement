#!/usr/bin/env node
/**
 * 一次性 seed：建立「新北市政府文化局」客戶 + 115 年度坪林茶業博物館合約
 *
 * 來源：第 1 次契約變更 經費概算表（114 至 115 年度坪林茶業博物館環境清潔維護採購案）
 * 範圍：只取 115 年度部分（114 年度不寫入）
 * 金額：不含行政管理費（3%）與營業稅（5%）—— 純合約直接成本
 *
 * 跑法：
 *   STAGING_EMAIL=xxx@gmail.com STAGING_PASSWORD=xxx \
 *     node scripts/seedPinglinContract.mjs
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

// ─── 2. 案場資料：坪林茶業博物館 ────────────────────────────────────────────
//
// 115 年度經費拆解（不含行政管理費 3% 與營業稅 5%）：
//   月固定（人力 + 用品）：138,527 + 8,980 = 147,507 / 月
//     人力 117,373 + 變更追加 21,154 = 138,527
//     清潔用品 24 式 ÷ 2 年 = 12 式 / 年 = 8,980 / 月
//   指定工作（按次實作，含全部 5 項）：
//     地面打蠟    115 年度 2 次 × 23,530 = 47,060
//     全區玻璃清洗 4 次 × 7,873  = 31,492
//     高壓清洗機  12 次 × 26,525 = 318,300
//     水塔清洗    2 次 × 10,267 = 20,534
//     魚池清洗    3 次 × 9,413  = 28,239
//     指定工作小計             = 445,625
//   115 年度合計：147,507 × 12 + 445,625 = 1,770,084 + 445,625 = 2,215,709

const site = {
  id:           `site-pinglin-${Date.now()}`,
  name:         '坪林茶業博物館',
  address:      '新北市坪林區',
  billingMode:  'actual', // 月固定 + 週期任務按實際施作月份核實請款
  monthlyItems: [
    monthlyItem('清潔人力費用（已含 115 年度調漲）', 138527),
    monthlyItem('清潔用品月攤（衛生紙、洗手乳、清潔劑等）', 8980),
  ],
  monthlyBase:   147507,
  dispatchPlan:  [],
  locations:     [],
  weeklySchedule: null,
  shifts:        [],
  periodicTasks: [
    // 地面打蠟 一年 2 次（預計 5-11 月）：拆上下半段各 1 次
    rangeTask('地面打蠟（上半段，展示館 I + I 樓 + 體驗館）', 23530, 5, 8),
    rangeTask('地面打蠟（下半段）',                          23530, 9, 11),

    // 全區玻璃內外清洗 一年 4 次：每季 1 次
    rangeTask('全區玻璃內外清洗（Q1）', 7873, 1, 3),
    rangeTask('全區玻璃內外清洗（Q2）', 7873, 4, 6),
    rangeTask('全區玻璃內外清洗（Q3）', 7873, 7, 9),
    rangeTask('全區玻璃內外清洗（Q4）', 7873, 10, 12),

    // 高壓清洗機清洗 一年 12 次 = 每月一次
    fixedTask('高壓清洗機清洗（室外地面、看板）', 26525, [1,2,3,4,5,6,7,8,9,10,11,12]),

    // 水塔清洗 一年 2 次（預計 5-11 月）：拆上下半段各 1 次
    rangeTask('水塔清洗（上半段）', 10267, 5, 7),
    rangeTask('水塔清洗（下半段）', 10267, 9, 11),

    // 魚池清洗 一年 3 次：每 4 個月一次
    rangeTask('魚池清洗（第 1 次）', 9413, 1, 4),
    rangeTask('魚池清洗（第 2 次）', 9413, 5, 8),
    rangeTask('魚池清洗（第 3 次）', 9413, 9, 12),
  ],
  assignedEmployeeIds:   [],
  weeklyVisits:          [],
  monthlyConsumableCost: 0,
  monthlyToolCost:       0,
}

// ─── 3. 建合約 ─────────────────────────────────────────────────────────────
const contractData = {
  orgId:         ORG_ID,
  title:         '115 年度坪林茶業博物館環境清潔維護',
  contractNo:    '',
  customerId,
  customerName:  CUSTOMER_NAME,
  contractStart: '2026-01-01',
  contractEnd:   '2026-12-31',
  totalValue:    2215709,
  paymentMode:   'actual',
  status:        'active',
  sites:         [site],
  amendments: [
    {
      no:      1,
      date:    '2026-01-01',
      summary: '依基本工資調漲（月薪 29,500 × 1.1 = 32,450、日薪 1,728 × 1.1）追加 115 年度清潔人力費用 21,154 元/月',
    },
  ],
  notes:         '原採購案為「114 至 115 年度坪林茶業博物館環境清潔維護」（兩年期），本筆只記 115 年度部分。合約金額 2,215,709 元 = 月固定 147,507 × 12 + 指定工作 445,625（不含行政管理費 3% 與營業稅 5%）。',
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
console.log(`  案場：${contractData.sites.length} 個`)
console.log(`  週期任務：${site.periodicTasks.length} 項`)
console.log('')
console.log('  下一步：')
console.log('    cd "/Users/linxianzhe/Desktop/ERP Website"')
console.log('    npm run dev')
console.log('    → 開啟瀏覽器 → 訂單 & 合約 → 年度合約分頁')
console.log('')

process.exit(0)
