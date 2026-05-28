#!/usr/bin/env node
/**
 * 一次性 seed：建立「新北市泰山區公所」客戶（若不存在）+ 115 年度泰山區行政大樓合約
 *
 * 來源：115 年泰山區行政大樓清潔庶務工作委外工作計畫表（未稅金額直接存）
 *
 * 註：PDF 上 12 月「每月清潔維護」151,061 = 86,161 + 64,900；
 *     差額 64,900 為年終/三節，依專案慣例移至薪資頁處理，本合約 12 月仍用 86,161。
 *
 * 跑法：
 *   STAGING_EMAIL=xxx@gmail.com STAGING_PASSWORD=xxx \
 *     node scripts/seedTaishanAdminContract.mjs
 *
 * 預設讀 .env.development → 寫 staging。換成 .env.production 就會寫 prod。
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { initializeApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import {
  getFirestore, collection, doc, getDoc, getDocs, query, where,
  addDoc, updateDoc, serverTimestamp,
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
const CUSTOMER_NAME = '新北市泰山區公所'
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

// ─── 2. 案場資料：泰山區行政大樓 ───────────────────────────────────────────
//
// 115 年度經費拆解（未稅）：
//   月固定：每月清潔維護 86,161 × 12 月 = 1,033,932
//   週期任務（固定月份）：
//     地板清洗打蠟 2 次/年（1 月、8 月）   19,764 × 2 =  39,528
//     窗戶清潔擦拭 1 次/年（10 月）        24,705 × 1 =  24,705
//     水塔清洗     1 次/年（4 月）          5,935 × 1 =   5,935
//   合約總額 = 1,033,932 + 39,528 + 24,705 + 5,935 = 1,104,100
//
// 註：PDF 12 月「每月清潔維護」151,061 = 86,161 + 64,900
//     差額 64,900 為年終/三節，依專案慣例移至薪資頁處理，本合約 12 月仍用 86,161。

const site = {
  id:           `site-taishan-admin-${Date.now()}`,
  name:         '泰山區行政大樓',
  address:      '新北市泰山區',
  billingMode:  'actual',
  monthlyBase:  86161,
  monthlyItems: [
    monthlyItem('每月清潔維護', 86161),
  ],
  dispatchPlan:  [],
  locations:     [],
  weeklySchedule: null,
  shifts:        [],
  periodicTasks: [
    fixedTask('地板清洗打蠟', 19764, [1, 8]),
    fixedTask('窗戶清潔擦拭', 24705, [10]),
    fixedTask('水塔清洗',     5935,  [4]),
  ],
  assignedEmployeeIds:   [],
  weeklyVisits:          [],
  monthlyConsumableCost: 0,
  monthlyToolCost:       0,
}

// ─── 3. 建合約 ─────────────────────────────────────────────────────────────
const contractData = {
  orgId:         ORG_ID,
  title:         '115 年泰山區行政大樓清潔庶務工作委外',
  contractNo:    '',
  customerId,
  customerName:  CUSTOMER_NAME,
  contractStart: '2026-01-01',
  contractEnd:   '2026-12-31',
  totalValue:    1104100,
  paymentMode:   'actual',
  status:        'active',
  sites:         [site],
  amendments:    [],
  notes:         '未稅、不含行政管理費 10% 與營業稅 5%。PDF 12 月「每月清潔維護」151,061 = 86,161 + 64,900；差額 64,900 為年終/三節，由薪資頁處理，本合約 12 月仍用 86,161。',
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

// ─── 4. 同步案場到 customer.sites[]（員工駐點下拉用，schema 不同）──────────
{
  const customerRef = doc(db, 'customers', customerId)
  const csnap = await getDoc(customerRef)
  if (csnap.exists()) {
    const existingSites = csnap.data().sites || []
    const existingNames = new Set(existingSites.map(s => s.name))
    const toAdd = contractData.sites
      .filter(s => !existingNames.has(s.name))
      .map(s => ({
        id:      s.id || `site-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name:    s.name || '',
        address: s.address || '',
        lat:     s.lat || 0,
        lng:     s.lng || 0,
        area:    s.area || 0,
      }))
    if (toAdd.length > 0) {
      await updateDoc(customerRef, { sites: [...existingSites, ...toAdd], updatedAt: serverTimestamp() })
      console.log(`✓ 同步 ${toAdd.length} 個案場到 customer.sites[]`)
    }
  }
}

// ─── Summary ───────────────────────────────────────────────────────────────
console.log('')
console.log('─────────────────────────────────────────────')
console.log('  建檔完成 ✓')
console.log('─────────────────────────────────────────────')
console.log(`  客戶：${CUSTOMER_NAME}`)
console.log(`  合約：${contractData.title}`)
console.log(`  合約金額：$${contractData.totalValue.toLocaleString()}（未稅、不含管理費）`)
console.log(`  月固定：$${site.monthlyBase.toLocaleString()} / 月（× 12 = $${(site.monthlyBase * 12).toLocaleString()}）`)
console.log(`  週期任務：${site.periodicTasks.length} 項（地板 1/8 月、窗戶 10 月、水塔 4 月）`)
console.log('')

process.exit(0)
