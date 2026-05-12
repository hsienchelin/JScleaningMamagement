/**
 * Firestore CRUD helpers
 * 所有集合名稱統一在這裡管理，避免打錯字
 */
import {
  collection, doc, addDoc, setDoc, updateDoc, deleteDoc,
  getDoc, getDocs, serverTimestamp,
} from 'firebase/firestore'
import { db } from './firebase'

// ─── 集合名稱常數 ──────────────────────────────────────────────────────────────
export const COL = {
  EMPLOYEES:          'employees',
  CUSTOMERS:          'customers',
  ORDERS:             'orders',
  ANNUAL_CONTRACTS:   'annualContracts',
  SCHEDULE_INSTANCES: 'scheduleInstances',
  SCHEDULE_TEMPLATES: 'scheduleTemplates',
  SCHEDULE_PLANS:     'schedulePlans',
  SHIFT_CODES:        'shiftCodes',
  SALARY_RECORDS:     'salaryRecords',
  MOBILE_DISPATCHES:  'mobileDispatches',
  PURCHASES:          'purchases',
  SUPPLIERS:          'suppliers',
  INVENTORY_ITEMS:    'inventoryItems',
  WORK_ORDERS:        'workOrders',
  USERS:              'users',
  INVOICES:           'invoices',
  SETTINGS:           'settings',
  CLEANING_TASKS:     'cleaningTasks',
}

// ─── 員工編號自動產生（JS001, JS002, ...）────────────────────────────────────
export async function nextEmployeeId() {
  const snap = await getDocs(collection(db, COL.EMPLOYEES))
  const nums = snap.docs
    .map(d => d.id)
    .filter(id => /^JS\d+$/.test(id))
    .map(id => parseInt(id.slice(2), 10))
  const max = nums.length > 0 ? Math.max(...nums) : 0
  return `JS${String(max + 1).padStart(3, '0')}`
}

// ─── 員工 ──────────────────────────────────────────────────────────────────────
export async function addEmployee(data) {
  const id = await nextEmployeeId()
  await setDoc(doc(db, COL.EMPLOYEES, id), {
    ...data,
    id,
    status: data.status || 'active',
    skills: data.skills || [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return id
}

export async function updateEmployee(id, data) {
  await updateDoc(doc(db, COL.EMPLOYEES, id), {
    ...data,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteEmployee(id) {
  await deleteDoc(doc(db, COL.EMPLOYEES, id))
}

// ─── 客戶 ──────────────────────────────────────────────────────────────────────
export async function addCustomer(data) {
  return addDoc(collection(db, COL.CUSTOMERS), {
    ...data,
    sites: data.sites || [],
    createdAt: serverTimestamp(),
  })
}

export async function updateCustomer(id, data) {
  await updateDoc(doc(db, COL.CUSTOMERS, id), {
    ...data,
    updatedAt: serverTimestamp(),
  })
}

// ─── 訂單 ──────────────────────────────────────────────────────────────────────
export async function addOrder(data) {
  return addDoc(collection(db, COL.ORDERS), {
    ...data,
    createdAt: serverTimestamp(),
  })
}

export async function updateOrder(id, data) {
  await updateDoc(doc(db, COL.ORDERS, id), {
    ...data,
    updatedAt: serverTimestamp(),
  })
}

// ─── 年度合約 ──────────────────────────────────────────────────────────────────
export async function addAnnualContract(data) {
  return addDoc(collection(db, COL.ANNUAL_CONTRACTS), {
    ...data,
    createdAt: serverTimestamp(),
  })
}

export async function updateAnnualContract(id, data) {
  await updateDoc(doc(db, COL.ANNUAL_CONTRACTS, id), {
    ...data,
    updatedAt: serverTimestamp(),
  })
}

// ─── 排班 ──────────────────────────────────────────────────────────────────────
export async function addScheduleInstance(data) {
  return addDoc(collection(db, COL.SCHEDULE_INSTANCES), {
    ...data,
    createdAt: serverTimestamp(),
  })
}

export async function updateScheduleInstance(id, data) {
  await updateDoc(doc(db, COL.SCHEDULE_INSTANCES, id), data)
}

// ─── 供應商 ────────────────────────────────────────────────────────────────────
export async function addSupplier(data) {
  return addDoc(collection(db, COL.SUPPLIERS), {
    ...data,
    createdAt: serverTimestamp(),
  })
}

export async function updateSupplier(id, data) {
  await updateDoc(doc(db, COL.SUPPLIERS, id), { ...data, updatedAt: serverTimestamp() })
}

export async function deleteSupplier(id) {
  await deleteDoc(doc(db, COL.SUPPLIERS, id))
}

// ─── 進貨單 ────────────────────────────────────────────────────────────────────
export async function addPurchase(data) {
  return addDoc(collection(db, COL.PURCHASES), {
    ...data,
    createdAt: serverTimestamp(),
  })
}

// ─── 品項字典 ──────────────────────────────────────────────────────────────────
export async function addInventoryItem(data) {
  return addDoc(collection(db, COL.INVENTORY_ITEMS), {
    ...data,
    createdAt: serverTimestamp(),
  })
}

export async function updateInventoryItem(id, data) {
  await updateDoc(doc(db, COL.INVENTORY_ITEMS, id), { ...data, updatedAt: serverTimestamp() })
}

export async function deleteInventoryItem(id) {
  await deleteDoc(doc(db, COL.INVENTORY_ITEMS, id))
}

// ─── 班次代號 ──────────────────────────────────────────────────────────────────
export async function addShiftCode(data) {
  return addDoc(collection(db, COL.SHIFT_CODES), { ...data, createdAt: serverTimestamp() })
}
export async function updateShiftCode(id, data) {
  await updateDoc(doc(db, COL.SHIFT_CODES, id), { ...data, updatedAt: serverTimestamp() })
}
export async function deleteShiftCode(id) {
  await deleteDoc(doc(db, COL.SHIFT_CODES, id))
}

// ─── 排班計畫 ──────────────────────────────────────────────────────────────────
export async function saveSchedulePlan(data) {
  // data includes: { orgId, siteId, siteName, employeeId, month, rules }
  // rules: [{ shiftCodeId, dates: number[] }]
  return addDoc(collection(db, COL.SCHEDULE_PLANS), { ...data, updatedAt: serverTimestamp() })
}
export async function updateSchedulePlan(id, data) {
  await updateDoc(doc(db, COL.SCHEDULE_PLANS, id), { ...data, updatedAt: serverTimestamp() })
}
// ─── 薪資紀錄 ──────────────────────────────────────────────────────────────────
export async function addSalaryRecord(data) {
  return addDoc(collection(db, COL.SALARY_RECORDS), {
    ...data,
    createdAt: serverTimestamp(),
  })
}

export async function updateSalaryRecord(id, data) {
  await updateDoc(doc(db, COL.SALARY_RECORDS, id), {
    ...data,
    updatedAt: serverTimestamp(),
  })
}

// ─── 工作單 ────────────────────────────────────────────────────────────────────
export async function addWorkOrder(data) {
  return addDoc(collection(db, COL.WORK_ORDERS), {
    ...data,
    createdAt: serverTimestamp(),
  })
}

export async function updateWorkOrder(id, data) {
  await updateDoc(doc(db, COL.WORK_ORDERS, id), { ...data, updatedAt: serverTimestamp() })
}

// ─── 請款單（應收帳款）────────────────────────────────────────────────────────
export async function addInvoice(data) {
  return addDoc(collection(db, COL.INVOICES), {
    ...data,
    createdAt: serverTimestamp(),
  })
}

export async function updateInvoice(id, data) {
  await updateDoc(doc(db, COL.INVOICES, id), { ...data, updatedAt: serverTimestamp() })
}

// ─── 施工項目字典（PRESET_TASKS 之外可自訂的項目）────────────────────────────
export async function addCleaningTask(data) {
  return addDoc(collection(db, COL.CLEANING_TASKS), {
    ...data,
    createdAt: serverTimestamp(),
  })
}
export async function updateCleaningTask(id, data) {
  await updateDoc(doc(db, COL.CLEANING_TASKS, id), {
    ...data,
    updatedAt: serverTimestamp(),
  })
}
export async function deleteCleaningTask(id) {
  await deleteDoc(doc(db, COL.CLEANING_TASKS, id))
}

// ─── 系統設定（單一文件 docId 方式）─────────────────────────────────────────────
// settings/payrollRates       — 費率（勞保 12.5%、健保 5.17%、職災 0.25%、平均眷口 1.56、基本工資、勞退 6%）
// settings/healthBrackets     — { brackets: [29500, 30300, ...] }
// settings/laborBrackets      — { brackets: [29500, ...], partTime: [11100, ...] }
export async function getSettingsDoc(docId) {
  const snap = await getDoc(doc(db, COL.SETTINGS, docId))
  return snap.exists() ? snap.data() : null
}

export async function setSettingsDoc(docId, data) {
  await setDoc(doc(db, COL.SETTINGS, docId), {
    ...data,
    updatedAt: serverTimestamp(),
  }, { merge: true })
}
