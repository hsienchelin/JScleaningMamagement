#!/usr/bin/env node
/**
 * 一次性修復：把所有年度合約的 sites 同步回對應客戶的 sites 欄位
 *
 * 為什麼需要：
 *   - customers/{id}.sites      → 客戶地理位置記錄 { id, name, address, lat, lng, area }
 *   - annualContracts/{id}.sites → 合約計費紀錄 { id, name, billingMode, monthlyItems, ... }
 *   兩個 sites schema 不同，seed 合約時若沒同步，客戶頁就顯示 0 案場
 *
 * 跑法（跟之前 seedSanxiaContract.mjs 同方式）：
 *   STAGING_EMAIL=xxx@erp-internal.com STAGING_PASSWORD=xxx \
 *     node scripts/syncCustomerSites.mjs
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { initializeApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import {
  getFirestore, collection, doc, getDocs, updateDoc, serverTimestamp,
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

const app  = initializeApp(firebaseConfig)
const auth = getAuth(app)
const db   = getFirestore(app)

await signInWithEmailAndPassword(auth, email, password)
console.log('✓ 已登入')

const customersSnap = await getDocs(collection(db, 'customers'))
const contractsSnap = await getDocs(collection(db, 'annualContracts'))
console.log(`✓ 讀到 ${customersSnap.size} 個客戶、${contractsSnap.size} 份合約`)

// ─── 從合約收集每個客戶的案場 ────────────────────────────────────────────────
const customerSitesMap = {}
contractsSnap.forEach(docSnap => {
  const c = docSnap.data()
  if (!c.customerId) return
  const arr = customerSitesMap[c.customerId] || []
  ;(c.sites || []).forEach(s => {
    arr.push({
      id:      s.id || `site-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name:    s.name || '',
      address: s.address || '',
      lat:     s.lat   || 0,
      lng:     s.lng   || 0,
      area:    s.area  || 0,
    })
  })
  customerSitesMap[c.customerId] = arr
})

// ─── 同步回客戶文件（依 name 去重）────────────────────────────────────────────
let updateCount = 0
for (const customerDoc of customersSnap.docs) {
  const customer = customerDoc.data()
  const existing = customer.sites || []
  const fromContracts = customerSitesMap[customerDoc.id] || []
  if (fromContracts.length === 0) continue

  const existingNames = new Set(existing.map(s => s.name))
  const toAdd = fromContracts.filter(s => !existingNames.has(s.name))
  if (toAdd.length === 0) {
    console.log(`  · ${customer.name}：合約案場全部已同步，跳過`)
    continue
  }

  const newSites = [...existing, ...toAdd]
  await updateDoc(doc(db, 'customers', customerDoc.id), {
    sites:     newSites,
    updatedAt: serverTimestamp(),
  })
  console.log(`✓ ${customer.name}：新增 ${toAdd.length} 個案場 → 總計 ${newSites.length}`)
  toAdd.forEach(s => console.log(`    + ${s.name}`))
  updateCount++
}

console.log('')
console.log('─────────────────────────────────────────────')
console.log(`  完成：更新 ${updateCount} 個客戶`)
console.log('─────────────────────────────────────────────')

process.exit(0)
