import React, { useState, useEffect, useMemo } from 'react'
import {
  Plus, Calculator, AlertTriangle, FileText, Search, MapPin,
  ChevronRight, ChevronLeft, ChevronDown, Clock, Users,
  Building2, Calendar, CalendarCheck, ArrowLeft, Download, TrendingUp, Layers, X, Pencil, Printer, Send, CheckCircle, ClipboardList, DollarSign,
} from 'lucide-react'
import {
  DIFFICULTY_COEFFICIENTS, COST_ENGINE,
} from '../lib/mockData'
import { COL, addOrder, updateOrder, addAnnualContract, updateCustomer, updateAnnualContract, addInvoice, addScheduleInstance } from '../lib/db'
import { useCollection } from '../hooks/useCollection'
import { useOrg } from '../contexts/OrgContext'
import clsx from 'clsx'
import {
  BILLING_MODES, BILLING_MODE_MAP, SCHEDULE_TYPES, SCHEDULE_TYPE_MAP,
  getSiteMonthlyBase, getContractMonthlyTotal,
  isTaskDueInMonth, isTaskCompletedInPeriod, getTaskScheduleText,
  rangeMonths, getDispatchRemaining, getDispatchRevenueMax, getWeeklyAnnualTotal,
  WEEKDAYS, makeNewSite, makeNewMonthlyItem, makeNewDispatchPlanItem,
} from '../utils/contractSchema'

// ─── Constants ────────────────────────────────────────────────────────────────
const MONTHS_ZH = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']

const STATUS_BADGE = {
  not_started: 'badge-gray',
  in_progress: 'badge-blue',
  done:        'badge-green',
  invoiced:    'bg-teal-100 text-teal-700',
  paid:        'bg-purple-100 text-purple-700',
  closed:      'bg-gray-200 text-gray-600',
  // legacy
  active:      'badge-blue',
  completed:   'badge-gray',
  cancelled:   'badge-red',
}
const STATUS_LABEL = {
  not_started: '未施工',
  in_progress: '未收尾',
  done:        '施工完成',
  invoiced:    '請款單寄出',
  paid:        '工程款到帳',
  closed:      '完成訂單',
  // legacy
  active:      '進行中',
  completed:   '已完成',
  cancelled:   '已取消',
}
const ORDER_STATUSES = [
  { value: 'not_started', label: '未施工' },
  { value: 'in_progress', label: '未收尾' },
  { value: 'done',        label: '施工完成' },
  { value: 'invoiced',    label: '請款單寄出' },
  { value: 'paid',        label: '工程款到帳' },
  { value: 'closed',      label: '完成訂單' },
]

const CLEAN_TYPES = [
  { id: 'stationed', name: '駐點清潔' },
  { id: 'rough',     name: '裝潢粗清' },
  { id: 'fine',      name: '裝潢細清' },
  { id: 'disinfect', name: '環境消毒' },
  { id: 'other',     name: '其他'     },
]

function shiftBadgeClass(label) {
  if (label.includes('早')) return 'bg-amber-100 text-amber-700'
  if (label.includes('晚')) return 'bg-indigo-100 text-indigo-700'
  return 'bg-sky-100 text-sky-700'
}

// ─── CostEstimator ────────────────────────────────────────────────────────────
function CostEstimator({ area, diffId }) {
  const baseRate = 25
  const diff     = DIFFICULTY_COEFFICIENTS.find(d => d.id === diffId) || { value: 1 }
  const matCost  = COST_ENGINE.costPerSqm * area * diff.value
  const laborCost = baseRate * area * diff.value
  const totalCost = matCost + laborCost

  return (
    <div className="bg-brand-50 border border-brand-200 rounded-xl p-4 space-y-3">
      <p className="text-sm font-semibold text-brand-700 flex items-center gap-1.5">
        <Calculator size={14} /> 智能成本預估
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label text-xs">施作坪數 (㎡)</label>
          <input className="input text-sm" type="number" min="1" defaultValue={area} id="est-area" />
        </div>
        <div>
          <label className="label text-xs">場域難度</label>
          <select className="input text-sm" defaultValue={diffId} id="est-diff">
            {DIFFICULTY_COEFFICIENTS.map(d => (
              <option key={d.id} value={d.id}>{d.name} ({d.value}x)</option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <span className="text-gray-500">難度係數</span>
        <span className="font-medium">{diff.value}x</span>
        <span className="text-gray-500">每坪材料成本</span>
        <span className="font-medium">${COST_ENGINE.costPerSqm.toFixed(2)}</span>
        <span className="text-gray-500">預估人工成本</span>
        <span className="font-medium">${laborCost.toLocaleString()}</span>
        <span className="text-gray-500">預估耗材成本</span>
        <span className="font-medium">${matCost.toLocaleString()}</span>
      </div>
      <div className="border-t border-brand-200 pt-2 flex justify-between">
        <span className="text-sm font-bold text-gray-700">預估總成本</span>
        <span className="text-sm font-bold text-brand-700">${totalCost.toLocaleString()}</span>
      </div>
    </div>
  )
}

// ─── OrderRow (single orders) ─────────────────────────────────────────────────
function OrderRow({ order, customers = [], onSelect }) {
  const customer    = customers.find(c => c.id === order.customerId)
  const cleanType   = CLEAN_TYPES.find(t => t.id === order.type) || { name: order.typeCustom || order.type }
  const daysLeft    = order.contractEnd
    ? Math.ceil((new Date(order.contractEnd) - new Date()) / 86400000)
    : null
  const totalPrice  = order.totalPrice || 0
  const grossProfit = totalPrice - (order.estimatedLaborCost || 0) - (order.estimatedMaterialCost || 0)
  const margin      = totalPrice > 0 ? ((grossProfit / totalPrice) * 100).toFixed(0) : null

  return (
    <button
      onClick={() => onSelect(order)}
      className="card p-4 w-full text-left hover:shadow-md transition-all group"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900 group-hover:text-brand-700 transition-colors">
              {order.siteName || order.title}
            </span>
            <span className={`badge ${STATUS_BADGE[order.status]}`}>{STATUS_LABEL[order.status]}</span>
            <span className="badge badge-blue">{cleanType.name}</span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{customer?.name || order.customerName}</p>
          <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-xs text-gray-500">
            {order.contractStart && order.contractEnd && (
              <span>合約：{order.contractStart} ~ {order.contractEnd}</span>
            )}
            {order.area && <span>{order.area} ㎡</span>}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-bold text-gray-900">${totalPrice.toLocaleString()}</p>
          {margin !== null && (
            <p className="text-xs text-green-600 font-medium">毛利率 {margin}%</p>
          )}
          {daysLeft !== null && daysLeft <= 60 && daysLeft > 0 && (
            <span className={`badge mt-1 ${daysLeft <= 30 ? 'badge-red' : 'badge-yellow'}`}>
              <AlertTriangle size={10} className="mr-0.5" /> 剩{daysLeft}天
            </span>
          )}
          <div className="flex items-center justify-end gap-1 mt-2 text-brand-600 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">
            查看詳情 <ChevronRight size={14} />
          </div>
        </div>
      </div>
    </button>
  )
}

// ─── Order Detail (full-page) ─────────────────────────────────────────────────
function OrderDetail({ order, customers = [], orgId, workOrders = [], onBack }) {
  const [showEdit,    setShowEdit]    = useState(false)
  const [showPrint,   setShowPrint]   = useState(false)
  const [localOrder,  setLocalOrder]  = useState(order)

  const customer   = customers.find(c => c.id === localOrder.customerId)
  const cleanType  = CLEAN_TYPES.find(t => t.id === localOrder.type) || { name: localOrder.typeCustom || localOrder.type }
  const approvedWO  = workOrders.find(wo => wo.status === 'approved')
  const submittedWO = workOrders.find(wo => wo.status === 'submitted')

  const closeOrder = async () => {
    if (!window.confirm('確認將此訂單標記為「完成訂單」？完成後將移至歷史訂單。')) return
    await updateOrder(localOrder.id, { status: 'closed' })
    setLocalOrder(o => ({ ...o, status: 'closed' }))
  }
  const totalPrice   = localOrder.totalPrice || 0
  const laborCost    = localOrder.estimatedLaborCost   || 0
  const materialCost = localOrder.estimatedMaterialCost || 0
  const grossProfit  = totalPrice - laborCost - materialCost
  const margin       = totalPrice > 0 ? ((grossProfit / totalPrice) * 100).toFixed(1) : '—'
  const daysLeft     = localOrder.contractEnd
    ? Math.ceil((new Date(localOrder.contractEnd) - new Date()) / 86400000)
    : null

  const infoRows = [
    { label: '客戶',     value: customer?.name || localOrder.customerName || '—' },
    { label: '案場',     value: localOrder.siteName || '—' },
    { label: '施工地址', value: localOrder.siteAddress || '—' },
    { label: '清潔類型', value: cleanType.name },
    ...(localOrder.contractStart ? [{ label: '合約期間', value: `${localOrder.contractStart} ~ ${localOrder.contractEnd}` }] : []),
    ...(localOrder.notes ? [{ label: '備註', value: localOrder.notes }] : []),
  ]

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={onBack} className="btn-secondary py-1.5 px-3 shrink-0 mt-0.5">
          <ArrowLeft size={15} /> 返回
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-gray-900 leading-snug">
            {localOrder.siteName || localOrder.title}
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <span className="text-sm text-gray-500">{customer?.name || localOrder.customerName}</span>
            <span className={`badge ${STATUS_BADGE[localOrder.status]}`}>{STATUS_LABEL[localOrder.status]}</span>
            <span className="badge badge-blue">{cleanType.name}</span>
            {daysLeft !== null && daysLeft > 0 && daysLeft <= 60 && (
              <span className={`badge ${daysLeft <= 30 ? 'badge-red' : 'badge-yellow'}`}>
                <AlertTriangle size={10} className="mr-0.5" /> 剩 {daysLeft} 天
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 mt-0.5 flex-wrap justify-end">
          {localOrder.status !== 'closed' && (
            <button onClick={closeOrder} className="btn-secondary py-1.5 px-3 text-green-700 border-green-300 hover:bg-green-50">
              <CheckCircle size={14} /> 完成訂單
            </button>
          )}
          <button onClick={() => setShowPrint(true)} className="btn-secondary py-1.5 px-3">
            <Printer size={14} /> 列印請款單
          </button>
          <button onClick={() => setShowEdit(true)} className="btn-secondary py-1.5 px-3">
            <Pencil size={14} /> 編輯
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: '訂單總價',   value: `$${totalPrice.toLocaleString()}`,      highlight: true },
          { label: '預估毛利率', value: `${margin}%`,                           sub: `$${grossProfit.toLocaleString()}` },
          { label: '預估人工',   value: `$${laborCost.toLocaleString()}`,        sub: '成本' },
          { label: '預估耗材',   value: `$${materialCost.toLocaleString()}`,     sub: '成本' },
        ].map(({ label, value, sub, highlight }) => (
          <div key={label} className="card p-3.5">
            <p className="text-xs text-gray-400">{label}</p>
            <p className={clsx('text-lg font-bold mt-0.5', highlight ? 'text-brand-700' : 'text-gray-900')}>
              {value}
            </p>
            {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
          </div>
        ))}
      </div>

      {/* Detail card */}
      <div className="card divide-y divide-gray-100">
        {infoRows.map(({ label, value }) => (
          <div key={label} className="flex items-start gap-4 px-4 py-3 text-sm">
            <span className="text-gray-400 w-20 shrink-0">{label}</span>
            <span className="text-gray-800 flex-1">{value}</span>
          </div>
        ))}
      </div>

      {/* 施工紀錄 */}
      {(approvedWO || submittedWO) && (() => {
        const wo = approvedWO || submittedWO
        const isApproved = wo.status === 'approved'
        return (
          <div className="card overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-gray-50">
              <ClipboardList size={15} className="text-brand-600" />
              <span className="font-semibold text-sm text-gray-800 flex-1">施工紀錄</span>
              <span className={clsx('text-[11px] font-semibold px-2 py-0.5 rounded-full',
                isApproved ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
              )}>
                {isApproved ? '已核准' : '待審核'}
              </span>
            </div>
            <div className="px-4 py-3 space-y-2">
              <p className="text-xs text-gray-400 flex items-center gap-1">
                <Users size={11} /> 帶班組長：{wo.leaderName || '未指定'}
              </p>
              {(wo.sessions || []).map((sess, i) => (
                <div key={sess.id || i} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5 text-sm">
                  <div className="w-6 h-6 rounded-full bg-brand-100 flex items-center justify-center text-xs font-bold text-brand-700 shrink-0">{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800">{sess.date || '—'}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {sess.manpower?.length || 0} 人・{sess.tasks?.length || 0} 項工作
                      {sess.materials?.length > 0 && `・${sess.materials.length} 項耗材`}
                    </p>
                  </div>
                </div>
              ))}
              {isApproved && (
                <p className="text-xs text-teal-600 pt-1">列印請款單時將自動帶入以上施工日期</p>
              )}
              {!isApproved && (
                <p className="text-xs text-amber-600 pt-1">工務請款單尚待行政核准，核准後可帶入請款單</p>
              )}
            </div>
          </div>
        )
      })()}

      {/* Edit Modal */}
      {showEdit && (
        <OrderEditModal
          order={localOrder}
          customers={customers}
          onSave={updated => { setLocalOrder(updated); setShowEdit(false) }}
          onClose={() => setShowEdit(false)}
        />
      )}
      {/* Print Modal */}
      {showPrint && (
        <PrintInvoiceModal
          order={localOrder}
          customer={customer}
          orgId={orgId}
          workOrder={approvedWO}
          onClose={() => setShowPrint(false)}
        />
      )}
    </div>
  )
}

// ─── Order Edit Modal ─────────────────────────────────────────────────────────
function OrderEditModal({ order, customers, onSave, onClose }) {
  const [status,        setStatus]        = useState(order.status        || 'active')
  const [siteName,      setSiteName]      = useState(order.siteName      || '')
  const [siteAddress,   setSiteAddress]   = useState(order.siteAddress   || '')
  const [typeId,        setTypeId]        = useState(order.type          || 'stationed')
  const [customType,    setCustomType]    = useState(order.typeCustom    || '')
  const [contractStart, setContractStart] = useState(order.contractStart || '')
  const [contractEnd,   setContractEnd]   = useState(order.contractEnd   || '')
  const [totalPrice,    setTotalPrice]    = useState(String(order.totalPrice || ''))
  const [taxIncluded,   setTaxIncluded]   = useState(order.taxIncluded   ?? false)
  const [notes,         setNotes]         = useState(order.notes         || '')
  const [saving,        setSaving]        = useState(false)
  const [err,           setErr]           = useState('')

  const isOther = typeId === 'other'

  const handleSave = async () => {
    setSaving(true); setErr('')
    try {
      const typeName = isOther
        ? customType.trim()
        : (CLEAN_TYPES.find(t => t.id === typeId)?.name || typeId)
      const updated = {
        ...order,
        status,
        siteName:      siteName.trim(),
        siteAddress:   siteAddress.trim(),
        type:          typeId,
        typeCustom:    isOther ? customType.trim() : '',
        contractStart,
        contractEnd,
        totalPrice:    Number(totalPrice) || 0,
        taxIncluded,
        notes:         notes.trim(),
        title:         `${order.customerName} · ${typeName}`,
      }
      await updateOrder(order.id, updated)
      onSave(updated)
    } catch { setErr('儲存失敗，請稍後再試') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 my-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">編輯訂單</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <div className="space-y-4">
          {/* Status */}
          <div>
            <label className="label">施工進度</label>
            <select className="input" value={status} onChange={e => setStatus(e.target.value)}>
              {ORDER_STATUSES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          {/* Clean type */}
          <div>
            <label className="label">清潔類型</label>
            <div className="flex flex-wrap gap-2">
              {CLEAN_TYPES.map(t => (
                <button
                  key={t.id} type="button"
                  onClick={() => setTypeId(t.id)}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
                    typeId === t.id
                      ? 'bg-brand-600 text-white border-brand-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300',
                  )}
                >
                  {t.name}
                </button>
              ))}
            </div>
            {isOther && (
              <input className="input mt-2" placeholder="請輸入清潔類型..." value={customType} onChange={e => setCustomType(e.target.value)} />
            )}
          </div>
          {/* Site */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">案場名稱</label>
              <input className="input" value={siteName} onChange={e => setSiteName(e.target.value)} />
            </div>
            <div>
              <label className="label">施工地址</label>
              <input className="input" value={siteAddress} onChange={e => setSiteAddress(e.target.value)} />
            </div>
          </div>
          {/* Contract period */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">合約開始</label>
              <input className="input" type="date" value={contractStart} onChange={e => setContractStart(e.target.value)} />
            </div>
            <div>
              <label className="label">合約結束</label>
              <input className="input" type="date" value={contractEnd} onChange={e => setContractEnd(e.target.value)} />
            </div>
          </div>
          {/* Price */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="label mb-0">訂單總價</label>
              <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
                {[{ v: false, l: '未稅' }, { v: true, l: '含稅' }].map(o => (
                  <button key={String(o.v)} type="button"
                    onClick={() => setTaxIncluded(o.v)}
                    className={clsx('px-3 py-1 font-medium transition-colors',
                      taxIncluded === o.v ? 'bg-brand-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
                    )}
                  >{o.l}</button>
                ))}
              </div>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input className="input pl-7" type="number" value={totalPrice} onChange={e => setTotalPrice(e.target.value)} />
            </div>
            {totalPrice && (
              <p className="text-xs text-gray-400 mt-1">
                {taxIncluded
                  ? `未稅 $${Math.round(Number(totalPrice)/1.05).toLocaleString()}，稅金 $${Math.round(Number(totalPrice)/1.05*0.05).toLocaleString()}`
                  : `稅金 $${Math.round(Number(totalPrice)*0.05).toLocaleString()}，含稅 $${Math.round(Number(totalPrice)*1.05).toLocaleString()}`}
              </p>
            )}
          </div>
          {/* Notes */}
          <div>
            <label className="label">備註</label>
            <textarea className="input h-20 resize-none" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          {err && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</p>}
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button className="btn-secondary" onClick={onClose}>取消</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? '儲存中...' : '儲存變更'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Print Invoice Modal ──────────────────────────────────────────────────────
const ORG_INFO = {
  jiaxiang: { name: '佳   翔   企   業   社', addr: '新北市新莊市中和街59巷2號5樓', tel: '2998-3662 / 0932-328634', fax: '2998-3313' },
  zhexin:   { name: '哲   欣   清   潔   社', addr: '', tel: '', fax: '' },
}

function PrintInvoiceModal({ order, customer, orgId, workOrder, onClose }) {
  const today = new Date().toISOString().slice(0, 10)
  const org   = ORG_INFO[orgId] || ORG_INFO.jiaxiang

  // 請款日期、發票編號
  const [invoiceDate, setInvoiceDate] = useState(today)
  const [invoiceNo,   setInvoiceNo]   = useState(`JU${Date.now().toString().slice(-8)}`)
  // 客戶資訊（可覆寫）
  const [taxId,   setTaxId]   = useState(customer?.taxId   || '')
  const [contact, setContact] = useState(customer?.contact || '')
  const [phone,   setPhone]   = useState(customer?.phone   || '')
  const [fax,     setFax]     = useState(customer?.fax     || '')
  // 未稅模式：輸入未稅金額；含稅模式：輸入含稅總額
  const [taxMode, setTaxMode] = useState(order.taxIncluded ? 'inclusive' : 'exclusive')

  // 明細列：優先從已核准工務請款單帶入施工日期
  const defaultLocation = order.siteAddress || order.siteName || ''
  const [items, setItems] = useState(() => {
    const sessions = workOrder?.sessions || []
    if (sessions.length > 0) {
      return sessions.map((s, i) => ({
        id: `r${i + 1}`,
        date:     s.date || '',
        location: defaultLocation,
        amount:   0,
        notes:    '',
      }))
    }
    return [{
      id: 'r1',
      date:     order.contractStart || '',
      location: defaultLocation,
      amount:   order.totalPrice || 0,
      notes:    order.notes || '',
    }]
  })

  const addItem    = () => setItems(prev => [...prev, { id: `r${Date.now()}`, date: '', location: '', amount: 0, notes: '' }])
  const removeItem = id  => setItems(prev => prev.filter(i => i.id !== id))
  const updateItem = (id, field, val) => setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: val } : i))

  // 依 taxMode 計算每列的未稅金額、稅金、含稅總額
  const calcRow = (amount) => {
    const a = Number(amount) || 0
    if (taxMode === 'exclusive') {
      const tax   = Math.round(a * 0.05)
      return { pretax: a, tax, total: a + tax }
    } else {
      const tax   = Math.round(a / 1.05 * 0.05)
      return { pretax: a - tax, tax, total: a }
    }
  }

  const grandTotal   = items.reduce((s, i) => s + calcRow(i.amount).total,  0)
  const grandPretax  = items.reduce((s, i) => s + calcRow(i.amount).pretax, 0)
  const grandTax     = items.reduce((s, i) => s + calcRow(i.amount).tax,    0)
  const amountLabel  = taxMode === 'exclusive' ? '金額（未稅）' : '含稅總額'

  const [sending,  setSending]  = useState(false)
  const [sent,     setSent]     = useState(false)
  const [sendErr,  setSendErr]  = useState('')

  const buildInvoicePayload = () => {
    const dueDate = new Date(invoiceDate)
    dueDate.setDate(dueDate.getDate() + 30)
    return {
      orgId:        orgId,
      orderId:      order.id,
      customerId:   order.customerId,
      customerName: customer?.name || order.customerName || '',
      siteName:     order.siteName || '',
      invoiceNo,
      invoiceDate,
      dueDate:      dueDate.toISOString().slice(0, 10),
      taxId,
      contact,
      phone,
      fax,
      taxMode,
      items:        items.map(i => ({ ...i, ...calcRow(i.amount) })),
      totalAmount:  grandTotal,
      status:       'invoiced',
    }
  }

  const handleSendAndPrint = async () => {
    setSending(true); setSendErr('')
    try {
      await addInvoice(buildInvoicePayload())
      // sync invoice total back to order, advance status if not already later
      const laterStages = ['invoiced', 'paid', 'closed']
      const orderUpdates = { totalPrice: grandTotal }
      if (!laterStages.includes(order.status)) orderUpdates.status = 'invoiced'
      await updateOrder(order.id, orderUpdates)
      setSent(true)
      openPrintWindow()
    } catch {
      setSendErr('儲存失敗，請稍後再試')
    } finally {
      setSending(false)
    }
  }

  const openPrintWindow = () => {
    const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    const rows = items.map(i => {
      const r = calcRow(i.amount)
      return `<tr>
        <td style="padding:7px 8px;border-bottom:1px solid #e5e7eb">${esc(i.date)}</td>
        <td style="padding:7px 8px;border-bottom:1px solid #e5e7eb">${esc(i.location)}</td>
        <td style="padding:7px 8px;border-bottom:1px solid #e5e7eb;text-align:right">$${r.pretax.toLocaleString()}</td>
        <td style="padding:7px 8px;border-bottom:1px solid #e5e7eb;text-align:right">$${r.tax.toLocaleString()}</td>
        <td style="padding:7px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600">$${r.total.toLocaleString()}</td>
        <td style="padding:7px 8px;border-bottom:1px solid #e5e7eb;color:#6b7280">${esc(i.notes)}</td>
      </tr>`
    }).join('')

    const cName = customer?.name || order.customerName || ''
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>請款明細 ${esc(invoiceDate)}</title>
    <style>
      *{box-sizing:border-box}
      body{font-family:"Noto Sans TC","Microsoft JhengHei",sans-serif;color:#111;margin:0;padding:28px 36px;font-size:12px;line-height:1.6}
      .co-name{font-size:20px;font-weight:700;letter-spacing:4px;text-align:center;margin-bottom:4px}
      .title-row{font-size:14px;text-align:center;margin-bottom:16px}
      .info-block{margin-bottom:12px;font-size:12px}
      .info-block span{display:inline-block;min-width:80px;color:#555}
      table{width:100%;border-collapse:collapse;margin:12px 0}
      th{background:#f3f4f6;padding:6px 8px;text-align:left;font-size:11px;border:1px solid #d1d5db}
      th.r{text-align:right}
      td{border-bottom:1px solid #e5e7eb;vertical-align:top}
      .total-block{text-align:right;margin-top:8px;font-size:12px}
      .grand-line{font-size:15px;font-weight:700;margin-top:4px}
      .footer{margin-top:28px;font-size:11px;color:#555;border-top:1px solid #e5e7eb;padding-top:10px}
      @media print{body{padding:16px 24px}}
    </style></head><body>
    <div class="co-name">${esc(org.name)}</div>
    <div class="title-row">請款明細&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${esc(invoiceDate)}</div>
    <div class="info-block">
      <div><span>客戶名稱:</span>${esc(cName)}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span>統一編號:</span>${esc(taxId)}</div>
      ${contact ? `<div><span>聯絡人:</span>${esc(contact)}</div>` : ''}
      ${phone   ? `<div><span>電話:</span>${esc(phone)}</div>` : ''}
      ${fax     ? `<div><span>傳真:</span>${esc(fax)}</div>` : ''}
    </div>
    ${invoiceNo ? `<div style="margin-bottom:10px;font-size:12px"><span style="min-width:80px;display:inline-block;color:#555">發票NO:</span>${esc(invoiceNo)}</div>` : ''}
    <table>
      <thead><tr>
        <th style="width:90px">日期</th>
        <th>施工地點</th>
        <th class="r" style="width:90px">金額</th>
        <th class="r" style="width:70px">稅金</th>
        <th class="r" style="width:90px">總額</th>
        <th style="width:120px">備註</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="total-block">
      <div>應收金額&nbsp;&nbsp;&nbsp;&nbsp;<b style="font-size:15px">$${grandTotal.toLocaleString()}</b></div>
    </div>
    <div class="footer">
      <div>${esc(org.name.replace(/\s/g,''))}</div>
      ${org.addr ? `<div>地址:${esc(org.addr)}</div>` : ''}
      ${org.tel  ? `<div>電話:${esc(org.tel)}</div>`  : ''}
      ${org.fax  ? `<div>傳真:${esc(org.fax)}</div>`  : ''}
    </div>
    </body></html>`

    const w = window.open('', '_blank', 'width=860,height=680')
    w.document.write(html)
    w.document.close()
    w.focus()
    w.print()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl p-6 my-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Printer size={18} className="text-brand-600" /> 列印請款明細
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        {/* 工務請款單帶入提示 */}
        {workOrder?.sessions?.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-teal-700 bg-teal-50 rounded-xl px-3 py-2.5 mb-4">
            <ClipboardList size={15} className="shrink-0" />
            已從工務請款單帶入 <strong>{workOrder.sessions.length}</strong> 筆施工日期，請填寫各筆金額後送出
          </div>
        )}

        {/* 請款日期 + 發票NO + 未稅/含稅切換 */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div>
            <label className="label">請款日期</label>
            <input className="input" type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
          </div>
          <div>
            <label className="label">發票 NO</label>
            <input className="input" placeholder="JU35962751" value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)} />
          </div>
          <div>
            <label className="label">金額輸入方式</label>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden h-10">
              {[{ v: 'exclusive', l: '未稅金額' }, { v: 'inclusive', l: '含稅總額' }].map(o => (
                <button key={o.v} type="button"
                  onClick={() => setTaxMode(o.v)}
                  className={clsx('flex-1 text-sm font-medium transition-colors',
                    taxMode === o.v ? 'bg-brand-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
                  )}
                >{o.l}</button>
              ))}
            </div>
          </div>
        </div>

        {/* 客戶資訊 */}
        <div className="grid grid-cols-2 gap-3 mb-4 p-3 bg-gray-50 rounded-xl border border-gray-100">
          <div>
            <label className="label text-xs">客戶名稱</label>
            <p className="text-sm font-medium text-gray-800">{customer?.name || order.customerName || '—'}</p>
          </div>
          <div>
            <label className="label text-xs">統一編號</label>
            <input className="input text-sm py-1" value={taxId} onChange={e => setTaxId(e.target.value)} placeholder="統一編號" />
          </div>
          <div>
            <label className="label text-xs">聯絡人</label>
            <input className="input text-sm py-1" value={contact} onChange={e => setContact(e.target.value)} placeholder="聯絡人姓名" />
          </div>
          <div>
            <label className="label text-xs">電話</label>
            <input className="input text-sm py-1" value={phone} onChange={e => setPhone(e.target.value)} placeholder="電話" />
          </div>
          <div className="col-span-2">
            <label className="label text-xs">傳真</label>
            <input className="input text-sm py-1" value={fax} onChange={e => setFax(e.target.value)} placeholder="傳真" />
          </div>
        </div>

        {/* 明細表 */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="label mb-0">施工明細</label>
            <button onClick={addItem} className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-0.5">
              <Plus size={13} /> 新增列
            </button>
          </div>
          <div className="border border-gray-200 rounded-xl overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-2 py-2 font-medium text-gray-600 w-28">日期（施工）</th>
                  <th className="text-left px-2 py-2 font-medium text-gray-600">施工地點</th>
                  <th className="text-right px-2 py-2 font-medium text-gray-600 w-28">{amountLabel}</th>
                  <th className="text-right px-2 py-2 font-medium text-gray-600 w-20">稅金</th>
                  <th className="text-right px-2 py-2 font-medium text-gray-600 w-24">總額</th>
                  <th className="text-left px-2 py-2 font-medium text-gray-600 w-24">備註</th>
                  <th className="w-7" />
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const r = calcRow(item.amount)
                  return (
                    <tr key={item.id} className="border-t border-gray-100">
                      <td className="px-1 py-1">
                        <input type="date" className="w-full border-0 bg-transparent text-xs focus:outline-none focus:ring-1 focus:ring-brand-300 rounded px-1"
                          value={item.date} onChange={e => updateItem(item.id, 'date', e.target.value)} />
                      </td>
                      <td className="px-1 py-1">
                        <input className="w-full border-0 bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-brand-300 rounded px-1"
                          value={item.location} onChange={e => updateItem(item.id, 'location', e.target.value)} placeholder="施工地點..." />
                      </td>
                      <td className="px-1 py-1">
                        <input type="number" min="0" className="w-full border-0 bg-transparent text-sm text-right focus:outline-none focus:ring-1 focus:ring-brand-300 rounded px-1"
                          value={item.amount} onChange={e => updateItem(item.id, 'amount', e.target.value)} />
                      </td>
                      <td className="px-2 py-1 text-right text-sm text-gray-400">${r.tax.toLocaleString()}</td>
                      <td className="px-2 py-1 text-right text-sm font-semibold text-gray-800">${r.total.toLocaleString()}</td>
                      <td className="px-1 py-1">
                        <input className="w-full border-0 bg-transparent text-xs focus:outline-none focus:ring-1 focus:ring-brand-300 rounded px-1"
                          value={item.notes} onChange={e => updateItem(item.id, 'notes', e.target.value)} placeholder="備註" />
                      </td>
                      <td className="pr-1">
                        {items.length > 1 && (
                          <button onClick={() => removeItem(item.id)} className="text-gray-300 hover:text-red-500"><X size={13} /></button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {/* 合計 */}
          <div className="mt-2 text-right space-y-0.5 text-sm text-gray-600">
            <div>金額小計：<span className="font-medium">${grandPretax.toLocaleString()}</span></div>
            <div>稅金合計：<span className="font-medium">${grandTax.toLocaleString()}</span></div>
            <div className="text-base font-bold text-gray-900">應收金額：<span className="text-brand-700">${grandTotal.toLocaleString()}</span></div>
          </div>
        </div>

        {sendErr && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{sendErr}</p>}
        {sent && (
          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2 mb-3">
            <CheckCircle size={15} /> 已儲存至應收帳款，可至「應收帳款」頁面追蹤收款狀態
          </div>
        )}
        <div className="flex justify-end gap-3">
          <button className="btn-secondary" onClick={onClose}>關閉</button>
          <button className="btn-secondary gap-2" onClick={openPrintWindow}>
            <Printer size={15} /> 僅列印
          </button>
          <button
            className="btn-primary gap-2"
            onClick={handleSendAndPrint}
            disabled={sending || sent}
          >
            {sent ? <><CheckCircle size={15} /> 已送出</> : sending ? '送出中...' : <><Send size={15} /> 確認送出並列印</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANNUAL CONTRACT COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Task Matrix ──────────────────────────────────────────────────────────────
function TaskMatrix({ sites }) {
  const currentMonth = new Date().getMonth() + 1

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
        <p className="text-sm font-semibold text-gray-700">週期任務年度矩陣</p>
        <p className="text-xs text-gray-400 mt-0.5">標示各月份需執行的重點清潔項目，一眼掌握全年工作量</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-xs border-collapse">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-4 py-2.5 text-gray-500 font-medium w-52 bg-gray-50/80">項目名稱</th>
              <th className="text-right px-3 py-2.5 text-gray-400 font-medium w-20 bg-gray-50/80">單價/次</th>
              {MONTHS_ZH.map((m, i) => (
                <th key={i} className={clsx(
                  'text-center py-2.5 font-medium w-14 text-[11px]',
                  i + 1 === currentMonth
                    ? 'bg-brand-50 text-brand-700'
                    : 'bg-gray-50/80 text-gray-500',
                )}>
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sites.map(site => {
              if (!site.periodicTasks?.length) return null
              const siteMonthly = getSiteMonthlyBase(site)
              return (
                <React.Fragment key={site.id}>
                  {/* Site header row */}
                  <tr className="bg-gray-50/60">
                    <td colSpan={14} className="px-4 py-1.5 border-t border-gray-100">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500">
                        <Building2 size={11} />
                        {site.name}
                        <span className="font-normal text-gray-400">月費 ${siteMonthly.toLocaleString()}</span>
                      </div>
                    </td>
                  </tr>
                  {/* Task rows */}
                  {site.periodicTasks.map(task => (
                    <tr key={task.id} className="border-t border-gray-50 hover:bg-gray-50/40">
                      <td className="px-4 py-2 font-medium text-gray-800 text-[11px]">{task.name}</td>
                      <td className="px-3 py-2 text-right text-gray-500">${(task.unitPrice || 0).toLocaleString()}</td>
                      {Array.from({ length: 12 }, (_, i) => {
                        const m         = i + 1
                        // TaskMatrix 顯示原始排定月份（含已完成），由 completed 旗標決定樣式
                        const scheduleType  = task.scheduleType || 'fixed'
                        const scheduled     = scheduleType === 'once'
                          ? true  // once 任務每個月都可執行
                          : Array.isArray(task.months) && task.months.includes(m)
                        const completed     = isTaskCompletedInPeriod(task, m)
                        const isCurrent = m === currentMonth
                        const isPast    = m < currentMonth && scheduled && !completed
                        return (
                          <td key={m} className={clsx('py-2 text-center', isCurrent && 'bg-brand-50/60')}>
                            {scheduled ? (
                              completed ? (
                                <span className="text-green-500 text-sm font-bold">✓</span>
                              ) : isCurrent ? (
                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand-600 text-white text-[9px] font-bold">本</span>
                              ) : isPast ? (
                                <span className="text-amber-400 font-bold text-sm">!</span>
                              ) : (
                                <span className="text-gray-300 text-sm">○</span>
                              )
                            ) : (
                              <span className="text-gray-100 select-none">·</span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50 flex flex-wrap items-center gap-5 text-[11px] text-gray-500">
        <span className="flex items-center gap-1.5"><span className="text-green-500 font-bold text-sm">✓</span> 已完成</span>
        <span className="flex items-center gap-1.5">
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-brand-600 text-white text-[8px] font-bold">本</span>
          本月應執行
        </span>
        <span className="flex items-center gap-1.5"><span className="text-amber-400 font-bold">!</span> 已過期未執行</span>
        <span className="flex items-center gap-1.5"><span className="text-gray-300">○</span> 待執行</span>
      </div>
    </div>
  )
}

// ─── Billing Draft ────────────────────────────────────────────────────────────
function BillingDraft({ contract, sites = [] }) {
  const now          = new Date()
  const currentMonth = now.getMonth() + 1
  const monthLabel   = `${now.getFullYear()}年${currentMonth}月`

  const periodicThisMonth = sites.flatMap(site =>
    (site.periodicTasks || [])
      .filter(t => isTaskDueInMonth(t, currentMonth))
      .map(t => ({ ...t, siteName: site.name }))
  )

  const stationedTotal = getContractMonthlyTotal(sites)
  const periodicTotal  = periodicThisMonth.reduce((s, t) => s + (t.unitPrice || 0), 0)
  const grandTotal     = stationedTotal + periodicTotal
  const taxTotal       = Math.round(grandTotal * 1.05)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-700">{monthLabel}份請款草稿</p>
          <p className="text-xs text-gray-400 mt-0.5">
            系統依常態項目 + 本月週期任務自動計算，確認後可匯出正式請款單
          </p>
        </div>
        <button className="btn-secondary text-sm gap-1.5">
          <Download size={14} /> 匯出 Excel
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left   px-4 py-2.5 font-medium text-gray-600">項目</th>
              <th className="text-center px-3 py-2.5 font-medium text-gray-600 w-12">單位</th>
              <th className="text-center px-3 py-2.5 font-medium text-gray-600 w-12">數量</th>
              <th className="text-right  px-3 py-2.5 font-medium text-gray-600 w-28">單價</th>
              <th className="text-right  px-4 py-2.5 font-medium text-gray-600 w-28">複價</th>
              <th className="text-left   px-4 py-2.5 font-medium text-gray-600 hidden md:table-cell">備註</th>
            </tr>
          </thead>
          <tbody>
            {/* Stationed */}
            <tr>
              <td colSpan={6} className="px-4 py-2 bg-blue-50/60 text-[11px] font-semibold text-blue-700 border-t border-blue-100">
                常態性駐點清潔
              </td>
            </tr>
            {sites.map(site => {
              const mode = site.billingMode || 'fixed'
              const base = getSiteMonthlyBase(site)
              if (mode === 'dispatch' || mode === 'weekly') {
                return (
                  <tr key={site.id} className="border-t border-gray-50 text-gray-500 italic">
                    <td className="px-4 py-2.5">{site.name}（{BILLING_MODE_MAP[mode]?.label}，本月按實際執行另計）</td>
                    <td colSpan={5}></td>
                  </tr>
                )
              }
              return (
                <tr key={site.id} className="border-t border-gray-50 hover:bg-gray-50/30">
                  <td className="px-4 py-2.5 text-gray-800">{site.name}　全區環境清潔</td>
                  <td className="px-3 py-2.5 text-center text-gray-500">月</td>
                  <td className="px-3 py-2.5 text-center text-gray-500">1</td>
                  <td className="px-3 py-2.5 text-right text-gray-700">${base.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-gray-900">${base.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-400 hidden md:table-cell">
                    {(site.shifts || []).map(s => `${s.label || '班次'}×${s.headcount}人`).join('、')}
                  </td>
                </tr>
              )
            })}

            {/* Subtotal stationed */}
            <tr className="border-t border-gray-200 bg-gray-50/60">
              <td colSpan={4} className="px-4 py-2 text-right text-xs font-semibold text-gray-500">常態項目小計</td>
              <td className="px-4 py-2 text-right font-semibold text-gray-800">${stationedTotal.toLocaleString()}</td>
              <td className="hidden md:table-cell" />
            </tr>

            {/* Periodic */}
            {periodicThisMonth.length > 0 && (
              <>
                <tr>
                  <td colSpan={6} className="px-4 py-2 bg-teal-50/60 text-[11px] font-semibold text-teal-700 border-t border-teal-100">
                    週期性重點清潔（{monthLabel}執行）
                  </td>
                </tr>
                {periodicThisMonth.map(task => (
                  <tr key={task.id} className="border-t border-gray-50 hover:bg-gray-50/30">
                    <td className="px-4 py-2.5 text-gray-800">{task.name}</td>
                    <td className="px-3 py-2.5 text-center text-gray-500">次</td>
                    <td className="px-3 py-2.5 text-center text-gray-500">1</td>
                    <td className="px-3 py-2.5 text-right text-gray-700">${task.unitPrice.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-gray-900">${task.unitPrice.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-400 hidden md:table-cell">{task.siteName}</td>
                  </tr>
                ))}
                <tr className="border-t border-gray-200 bg-gray-50/60">
                  <td colSpan={4} className="px-4 py-2 text-right text-xs font-semibold text-gray-500">週期項目小計</td>
                  <td className="px-4 py-2 text-right font-semibold text-gray-800">${periodicTotal.toLocaleString()}</td>
                  <td className="hidden md:table-cell" />
                </tr>
              </>
            )}

            {/* Grand total */}
            <tr className="border-t-2 border-gray-300 bg-gray-50">
              <td colSpan={4} className="px-4 py-3 text-right font-bold text-gray-700">本月請款合計（未稅）</td>
              <td className="px-4 py-3 text-right font-bold text-lg text-brand-700">${grandTotal.toLocaleString()}</td>
              <td className="hidden md:table-cell" />
            </tr>
            <tr className="border-t border-gray-100 bg-gray-50">
              <td colSpan={4} className="px-4 py-2.5 text-right text-sm font-medium text-gray-500">含稅總計（×1.05）</td>
              <td className="px-4 py-2.5 text-right font-bold text-gray-900">${taxTotal.toLocaleString()}</td>
              <td className="hidden md:table-cell" />
            </tr>
          </tbody>
        </table>
      </div>

      {periodicThisMonth.length === 0 && (
        <div className="text-center py-4 text-sm text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          本月無排定的週期性項目
        </div>
      )}
    </div>
  )
}

// ─── Edit Site Modal ──────────────────────────────────────────────────────────
function EditSiteModal({ site, onSave, onClose }) {
  const { activeOrgId } = useOrg()
  const { data: shiftCodesRaw } = useCollection(COL.SHIFT_CODES)
  const shiftCodes = useMemo(
    () => shiftCodesRaw.filter(s => s.orgId === activeOrgId),
    [shiftCodesRaw, activeOrgId]
  )

  // ─── 計費模式 ─────────────────────────────────────────────────────────────
  const [billingMode, setBillingMode] = useState(site.billingMode || 'fixed')

  // ─── 月固定明細 ──（用於 fixed / actual）──────────────────────────────────
  // 沿用舊資料：若沒有 monthlyItems 但有 monthlyBase，先把它放成單行「月固定」
  const [monthlyItems, setMonthlyItems] = useState(() => {
    if (Array.isArray(site.monthlyItems) && site.monthlyItems.length > 0) return site.monthlyItems
    if (site.monthlyBase) return [makeNewMonthlyItem('月固定費用', site.monthlyBase)]
    return []
  })

  // ─── 派工型：派工計畫 + 子地點 ─────────────────────────────────────────────
  const [dispatchPlan, setDispatchPlan] = useState(site.dispatchPlan || [])
  const [locations,    setLocations]    = useState(site.locations    || [])
  const [newLocation,  setNewLocation]  = useState('')

  // ─── 每週固定型 ───────────────────────────────────────────────────────────
  const [weeklySchedule, setWeeklySchedule] = useState(
    site.weeklySchedule || { weekdays: [], timesPerWeek: 0, unitPrice: 0, weeks: 52 }
  )

  // ─── 班次 + 週期任務（共用）──────────────────────────────────────────────
  const [shifts, setShifts] = useState((site.shifts || []).filter(s => s.shiftCodeId))
  const [tasks,  setTasks]  = useState(site.periodicTasks || [])

  // ─── 成本預算 ────────────────────────────────────────────────────────────
  const [monthlyConsumableCost, setConsumable] = useState(String(site.monthlyConsumableCost || ''))
  const [monthlyToolCost,       setToolCost]   = useState(String(site.monthlyToolCost       || ''))

  // ─── shift form ──────────────────────────────────────────────────────────
  const [pickShiftCodeId, setPickShiftCodeId] = useState('')
  const [shiftHeadcount,  setShiftHeadcount]  = useState('1')
  const [shiftWeekdays,   setShiftWeekdays]   = useState([])

  // ─── task form ───────────────────────────────────────────────────────────
  const [taskName,        setTaskName]        = useState('')
  const [taskPrice,       setTaskPrice]       = useState('')
  const [taskScheduleTyp, setTaskScheduleTyp] = useState('fixed')
  const [taskMonths,      setTaskMonths]      = useState([])
  const [taskWindowStart, setTaskWinStart]    = useState('')
  const [taskWindowEnd,   setTaskWinEnd]      = useState('')

  const [saving, setSaving] = useState(false)
  const [saveErr, setSaveErr] = useState('')

  // ── monthly items handlers ──
  const addMonthlyItem = () => setMonthlyItems(prev => [...prev, makeNewMonthlyItem()])
  const updateMonthlyItem = (id, key, value) =>
    setMonthlyItems(prev => prev.map(i => i.id === id ? { ...i, [key]: key === 'amount' ? (Number(value) || 0) : value } : i))
  const removeMonthlyItem = id => setMonthlyItems(prev => prev.filter(i => i.id !== id))
  const monthlyTotal = monthlyItems.reduce((s, i) => s + (Number(i.amount) || 0), 0)

  // ── dispatch handlers ──
  const addDispatchItem = () => setDispatchPlan(prev => [...prev, makeNewDispatchPlanItem()])
  const updateDispatchItem = (id, key, value) =>
    setDispatchPlan(prev => prev.map(d => d.id === id ? { ...d, [key]: key === 'name' ? value : (Number(value) || 0) } : d))
  const removeDispatchItem = id => setDispatchPlan(prev => prev.filter(d => d.id !== id))
  const dispatchTotal = dispatchPlan.reduce((s, d) => s + (d.plannedCount * d.unitPrice), 0)

  const addLocation = () => {
    const v = newLocation.trim()
    if (!v || locations.includes(v)) return
    setLocations(prev => [...prev, v])
    setNewLocation('')
  }

  // ── shift handlers ──
  const toggleShiftWeekday = d =>
    setShiftWeekdays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort((a, b) => a - b))

  const addShift = () => {
    if (!pickShiftCodeId) return
    setShifts(prev => [...prev, {
      id: `shift-${Date.now()}`,
      shiftCodeId: pickShiftCodeId,
      headcount:   Number(shiftHeadcount) || 1,
      weekdays:    shiftWeekdays.length > 0 ? [...shiftWeekdays] : [],
    }])
    setPickShiftCodeId(''); setShiftHeadcount('1'); setShiftWeekdays([])
  }

  // ── task handlers ──
  const toggleMonth = m =>
    setTaskMonths(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])

  const addTask = () => {
    if (!taskName.trim()) return
    const newTask = {
      id: `task-${Date.now()}`,
      name: taskName.trim(),
      unitPrice: Number(taskPrice) || 0,
      scheduleType: taskScheduleTyp,
      completedMonths: [],
    }
    if (taskScheduleTyp === 'fixed') {
      if (taskMonths.length === 0) return
      newTask.months = [...taskMonths].sort((a, b) => a - b)
    } else if (taskScheduleTyp === 'range') {
      const s = Number(taskWindowStart)
      const e = Number(taskWindowEnd)
      if (!s || !e || s > e) return
      newTask.windowStart = s
      newTask.windowEnd   = e
      newTask.months      = rangeMonths(s, e)  // 候選月份
    } else if (taskScheduleTyp === 'once') {
      newTask.months = []  // 全年任何月份
    }
    setTasks(prev => [...prev, newTask])
    setTaskName(''); setTaskPrice(''); setTaskMonths([]); setTaskWinStart(''); setTaskWinEnd(''); setTaskScheduleTyp('fixed')
  }

  // ── weekly handlers ──
  const toggleWeeklyWeekday = d =>
    setWeeklySchedule(prev => {
      const wds = prev.weekdays || []
      const next = wds.includes(d) ? wds.filter(x => x !== d) : [...wds, d].sort((a, b) => a - b)
      return { ...prev, weekdays: next, timesPerWeek: next.length }
    })

  const handleSave = async () => {
    setSaving(true)
    setSaveErr('')
    try {
      const finalMonthlyBase = (billingMode === 'fixed' || billingMode === 'actual')
        ? monthlyTotal
        : 0

      await onSave({
        ...site,
        billingMode,
        // fixed/actual fields
        monthlyItems: (billingMode === 'fixed' || billingMode === 'actual') ? monthlyItems : [],
        monthlyBase:  finalMonthlyBase,
        // dispatch fields
        dispatchPlan: billingMode === 'dispatch' ? dispatchPlan : [],
        locations:    billingMode === 'dispatch' ? locations    : [],
        // weekly fields
        weeklySchedule: billingMode === 'weekly' ? weeklySchedule : null,
        // shared
        shifts,
        periodicTasks: tasks,
        monthlyConsumableCost: Number(monthlyConsumableCost) || 0,
        monthlyToolCost:       Number(monthlyToolCost)       || 0,
      })
    } catch (err) {
      console.error('儲存案場失敗', err)
      setSaveErr(`儲存失敗：${err.message || '請稍後再試'}`)
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 my-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-gray-900">編輯案場設定</h2>
            <p className="text-sm text-gray-400 mt-0.5">{site.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {/* ── 計費模式 ─────────────────────────────────────────────────── */}
        <div className="space-y-2 mb-6">
          <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
            <DollarSign size={14} /> 計費模式
          </p>
          <div className="grid grid-cols-2 gap-2">
            {BILLING_MODES.map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => setBillingMode(m.id)}
                className={clsx(
                  'text-left rounded-xl border-2 px-3 py-2.5 transition-colors',
                  billingMode === m.id
                    ? 'border-brand-500 bg-brand-50'
                    : 'border-gray-200 bg-white hover:border-gray-300',
                )}
              >
                <p className="text-sm font-semibold text-gray-800">
                  <span className="mr-1.5">{m.icon}</span>{m.label}
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">{m.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* ── 月固定明細（fixed / actual）──────────────────────────────── */}
        {(billingMode === 'fixed' || billingMode === 'actual') && (
          <div className="space-y-3 mb-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                <Layers size={14} /> 月固定明細
              </p>
              <span className="text-sm font-bold text-brand-700">合計 ${monthlyTotal.toLocaleString()} / 月</span>
            </div>

            {monthlyItems.length > 0 ? (
              <div className="space-y-2">
                {monthlyItems.map(item => (
                  <div key={item.id} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                    <input
                      className="input text-sm flex-1"
                      placeholder="項目名稱（例：清潔人員工資）"
                      value={item.name}
                      onChange={e => updateMonthlyItem(item.id, 'name', e.target.value)}
                    />
                    <div className="relative w-32 shrink-0">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                      <input
                        className="input pl-6 text-sm" type="number" min="0"
                        value={item.amount}
                        onChange={e => updateMonthlyItem(item.id, 'amount', e.target.value)}
                      />
                    </div>
                    <button onClick={() => removeMonthlyItem(item.id)} className="text-gray-300 hover:text-red-500 shrink-0">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">尚無月固定明細</p>
            )}

            <button type="button" className="btn-secondary w-full justify-center text-sm" onClick={addMonthlyItem}>
              <Plus size={14} /> 新增項目（如：清潔人員工資 / 機具耗材 / 管理費攤提）
            </button>

            {billingMode === 'actual' && (
              <p className="text-[11px] text-amber-700 bg-amber-50 rounded-lg px-3 py-2 leading-relaxed">
                💡 核實請款模式：月固定明細每月固定請款；週期任務按下方執行月份請款。
              </p>
            )}
          </div>
        )}

        {/* ── 派工計畫（dispatch）──────────────────────────────────────── */}
        {billingMode === 'dispatch' && (
          <div className="space-y-3 mb-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                <Calendar size={14} /> 派工計畫
              </p>
              <span className="text-sm font-bold text-brand-700">合約預估 ${dispatchTotal.toLocaleString()}</span>
            </div>

            {dispatchPlan.length > 0 && (
              <div className="space-y-2">
                {dispatchPlan.map(d => (
                  <div key={d.id} className="bg-gray-50 rounded-xl px-3 py-2.5 space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        className="input text-sm flex-1"
                        placeholder="項目名稱（例：機動清潔 / 平時清潔 / 年度清潔）"
                        value={d.name}
                        onChange={e => updateDispatchItem(d.id, 'name', e.target.value)}
                      />
                      <button onClick={() => removeDispatchItem(d.id)} className="text-gray-300 hover:text-red-500">
                        <X size={14} />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="label text-[11px]">合約次數</label>
                        <input className="input text-sm" type="number" min="0"
                          value={d.plannedCount}
                          onChange={e => updateDispatchItem(d.id, 'plannedCount', e.target.value)} />
                      </div>
                      <div>
                        <label className="label text-[11px]">單價</label>
                        <input className="input text-sm" type="number" min="0"
                          value={d.unitPrice}
                          onChange={e => updateDispatchItem(d.id, 'unitPrice', e.target.value)} />
                      </div>
                      <div>
                        <label className="label text-[11px]">已使用</label>
                        <input className="input text-sm" type="number" min="0"
                          value={d.usedCount}
                          onChange={e => updateDispatchItem(d.id, 'usedCount', e.target.value)} />
                      </div>
                    </div>
                    <p className="text-[11px] text-gray-500">
                      剩餘 {getDispatchRemaining(d)} 次 · 合計 ${(d.plannedCount * d.unitPrice).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
            <button type="button" className="btn-secondary w-full justify-center text-sm" onClick={addDispatchItem}>
              <Plus size={14} /> 新增派工項目
            </button>

            {/* 子地點清單 */}
            <div className="pt-2 border-t border-gray-100 space-y-2">
              <p className="text-xs font-semibold text-gray-500">服務地點（多個分點）</p>
              {locations.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {locations.map((loc, i) => (
                    <span key={i} className="badge badge-gray text-xs flex items-center gap-1">
                      {loc}
                      <button onClick={() => setLocations(prev => prev.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500">
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input className="input text-sm flex-1" placeholder="地點名稱（例：長青活動中心）" value={newLocation}
                  onChange={e => setNewLocation(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addLocation())} />
                <button type="button" className="btn-secondary text-sm" onClick={addLocation} disabled={!newLocation.trim()}>加入</button>
              </div>
            </div>
          </div>
        )}

        {/* ── 每週固定（weekly）──────────────────────────────────────── */}
        {billingMode === 'weekly' && (
          <div className="space-y-3 mb-6">
            <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
              <Calendar size={14} /> 每週固定排班
            </p>
            <div>
              <p className="text-xs text-gray-500 mb-1.5">執行週幾（多選）</p>
              <div className="flex gap-1.5">
                {WEEKDAYS.map(w => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => toggleWeeklyWeekday(w.id)}
                    className={clsx(
                      'flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                      (weeklySchedule.weekdays || []).includes(w.id)
                        ? 'bg-brand-600 text-white border-brand-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300',
                    )}
                  >
                    {w.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="label text-xs">每週次數</label>
                <input className="input text-sm" type="number" min="0"
                  value={weeklySchedule.timesPerWeek || 0}
                  onChange={e => setWeeklySchedule(p => ({ ...p, timesPerWeek: Number(e.target.value) || 0 }))} />
              </div>
              <div>
                <label className="label text-xs">每次單價</label>
                <input className="input text-sm" type="number" min="0"
                  value={weeklySchedule.unitPrice || 0}
                  onChange={e => setWeeklySchedule(p => ({ ...p, unitPrice: Number(e.target.value) || 0 }))} />
              </div>
              <div>
                <label className="label text-xs">合約週數</label>
                <input className="input text-sm" type="number" min="0"
                  value={weeklySchedule.weeks || 52}
                  onChange={e => setWeeklySchedule(p => ({ ...p, weeks: Number(e.target.value) || 52 }))} />
              </div>
            </div>
            <p className="text-xs text-brand-700 bg-brand-50 rounded-lg px-3 py-2">
              年度合計：{weeklySchedule.weeks || 52} 週 × {weeklySchedule.timesPerWeek || 0} 次 × ${(weeklySchedule.unitPrice || 0).toLocaleString()} =
              <span className="font-bold ml-1">${getWeeklyAnnualTotal(weeklySchedule).toLocaleString()}</span>
            </p>
          </div>
        )}

        {/* ── Shifts ── */}
        <div className="space-y-3 mb-6">
          <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
            <Clock size={14} /> 駐點班次
          </p>
          {shiftCodes.length === 0 && (
            <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
              尚無班次代號，請先至「排班調度 → 班次管理」新增班次
            </p>
          )}
          {shifts.length > 0 ? (
            <div className="space-y-2">
              {shifts.map(s => {
                const sc = shiftCodes.find(c => c.id === s.shiftCodeId)
                // backward compat: old format had label/startTime/endTime
                const label     = sc?.label     || s.label     || '—'
                const startTime = sc?.startTime || s.startTime || ''
                const endTime   = sc?.endTime   || s.endTime   || ''
                const code      = sc?.code      || ''
                const color     = sc?.color     || '#6b7280'
                const wds       = Array.isArray(s.weekdays) ? s.weekdays : []
                const wdText    = wds.length > 0 && wds.length < 7
                  ? `週${wds.map(d => WEEKDAYS.find(w => w.id === d)?.label || '').join('')}`
                  : '每日'
                return (
                  <div key={s.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
                    <span
                      className="text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0 text-white"
                      style={{ backgroundColor: color }}
                    >
                      {code || label}
                    </span>
                    <span className="text-sm text-gray-700 flex-1">
                      {label}{startTime ? ` ${startTime}–${endTime}` : ''} · {wdText} · 需 {s.headcount} 人
                    </span>
                    <button
                      onClick={() => setShifts(prev => prev.filter(x => x.id !== s.id))}
                      className="text-gray-300 hover:text-red-500 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400">尚無班次設定</p>
          )}

          {shiftCodes.length > 0 && (
            <div className="bg-gray-50 rounded-xl p-3 border border-dashed border-gray-200 space-y-2">
              <p className="text-xs font-semibold text-gray-500">新增班次</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label text-xs">班次代號</label>
                  <select className="input text-sm" value={pickShiftCodeId} onChange={e => setPickShiftCodeId(e.target.value)}>
                    <option value="">選擇班次…</option>
                    {shiftCodes.map(sc => (
                      <option key={sc.id} value={sc.id}>
                        {sc.code} {sc.label} ({sc.startTime}–{sc.endTime})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label text-xs">需求人數</label>
                  <input className="input text-sm" type="number" min="1" value={shiftHeadcount} onChange={e => setShiftHeadcount(e.target.value)} />
                </div>
              </div>
              <div>
                <p className="text-[11px] text-gray-500 mb-1">適用週幾（不選=每日）</p>
                <div className="flex gap-1.5">
                  {WEEKDAYS.map(w => (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => toggleShiftWeekday(w.id)}
                      className={clsx(
                        'flex-1 py-1 rounded-md text-xs font-medium border transition-colors',
                        shiftWeekdays.includes(w.id)
                          ? 'bg-brand-600 text-white border-brand-600'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300',
                      )}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                className="btn-primary w-full justify-center text-sm"
                onClick={addShift}
                disabled={!pickShiftCodeId}
              >
                加入班次
              </button>
            </div>
          )}
        </div>

        {/* ── Periodic tasks ── */}
        <div className="space-y-3 mb-6">
          <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
            <Layers size={14} /> 週期性任務
          </p>
          {tasks.length > 0 ? (
            <div className="space-y-2">
              {tasks.map(t => (
                <div key={t.id} className="flex items-start gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-gray-800">{t.name}</p>
                      <span className="badge badge-gray text-[10px]">
                        {SCHEDULE_TYPE_MAP[t.scheduleType || 'fixed']?.label || '固定月份'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      ${(t.unitPrice || 0).toLocaleString()}/次 · {getTaskScheduleText(t)}
                    </p>
                  </div>
                  <button
                    onClick={() => setTasks(prev => prev.filter(x => x.id !== t.id))}
                    className="text-gray-300 hover:text-red-500 transition-colors shrink-0 mt-0.5"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">尚無週期任務</p>
          )}

          <div className="bg-gray-50 rounded-xl p-3 border border-dashed border-gray-200 space-y-2">
            <p className="text-xs font-semibold text-gray-500">新增週期任務</p>
            <input
              className="input text-sm"
              placeholder="任務名稱（例：高空玻璃清潔）"
              value={taskName}
              onChange={e => setTaskName(e.target.value)}
            />
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
              <input
                className="input pl-6 text-sm"
                type="number"
                min="0"
                placeholder="單次費用"
                value={taskPrice}
                onChange={e => setTaskPrice(e.target.value)}
              />
            </div>

            {/* 排程類型 */}
            <div>
              <p className="text-xs text-gray-500 mb-1.5">排程類型</p>
              <div className="grid grid-cols-3 gap-1.5">
                {SCHEDULE_TYPES.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTaskScheduleTyp(t.id)}
                    className={clsx(
                      'px-2 py-1.5 rounded-md text-[11px] font-medium border transition-colors',
                      taskScheduleTyp === t.id
                        ? 'bg-brand-600 text-white border-brand-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300',
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-gray-400 mt-1">{SCHEDULE_TYPE_MAP[taskScheduleTyp]?.desc}</p>
            </div>

            {/* 月份輸入：依 scheduleType 不同顯示 */}
            {taskScheduleTyp === 'fixed' && (
              <div>
                <p className="text-xs text-gray-500 mb-1.5">執行月份（可多選）</p>
                <div className="flex flex-wrap gap-1.5">
                  {MONTHS_ZH.map((m, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggleMonth(i + 1)}
                      className={clsx(
                        'px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors',
                        taskMonths.includes(i + 1)
                          ? 'bg-brand-600 text-white border-brand-600'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300',
                      )}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {taskScheduleTyp === 'range' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label text-xs">起始月份</label>
                  <select className="input text-sm" value={taskWindowStart} onChange={e => setTaskWinStart(e.target.value)}>
                    <option value="">選擇…</option>
                    {MONTHS_ZH.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label text-xs">結束月份</label>
                  <select className="input text-sm" value={taskWindowEnd} onChange={e => setTaskWinEnd(e.target.value)}>
                    <option value="">選擇…</option>
                    {MONTHS_ZH.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                  </select>
                </div>
              </div>
            )}

            {taskScheduleTyp === 'once' && (
              <p className="text-[11px] text-gray-500 bg-white rounded-lg px-3 py-2 border border-gray-100">
                💡 全年只需做 1 次，可於任何月份完成
              </p>
            )}

            <button
              type="button"
              className="btn-primary w-full justify-center text-sm"
              onClick={addTask}
              disabled={
                !taskName.trim() ||
                (taskScheduleTyp === 'fixed' && taskMonths.length === 0) ||
                (taskScheduleTyp === 'range' && (!taskWindowStart || !taskWindowEnd))
              }
            >
              加入任務
            </button>
          </div>
        </div>

        {/* ── 每月固定成本預算 ── */}
        <div className="space-y-3 mb-6">
          <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
            <DollarSign size={14} /> 每月固定成本預算
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label text-xs">月耗材預算（元）</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input
                  className="input pl-7 text-sm" type="number" min="0" placeholder="0"
                  value={monthlyConsumableCost}
                  onChange={e => setConsumable(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="label text-xs">月工具 / 設備攤提（元）</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input
                  className="input pl-7 text-sm" type="number" min="0" placeholder="0"
                  value={monthlyToolCost}
                  onChange={e => setToolCost(e.target.value)}
                />
              </div>
            </div>
          </div>
          {/* 即時毛利預覽 */}
          {(Number(monthlyConsumableCost) > 0 || Number(monthlyToolCost) > 0) && (() => {
            const totalCost  = (Number(monthlyConsumableCost) || 0) + (Number(monthlyToolCost) || 0)
            // 用編輯中的月固定明細加總，而非原 site.monthlyBase
            const monthlyRevenue = (billingMode === 'fixed' || billingMode === 'actual') ? monthlyTotal : 0
            const grossProfit    = monthlyRevenue - totalCost
            return (
              <div className="grid grid-cols-3 gap-3 bg-gray-50 rounded-xl px-4 py-3 text-center text-xs">
                <div>
                  <p className="text-gray-400 mb-0.5">月費收入</p>
                  <p className="font-bold text-brand-700">${monthlyRevenue.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-gray-400 mb-0.5">月成本合計</p>
                  <p className="font-bold text-red-500">${totalCost.toLocaleString()}</p>
                  <p className="text-gray-300 mt-0.5">耗材 + 工具</p>
                </div>
                <div>
                  <p className="text-gray-400 mb-0.5">預估月毛利</p>
                  <p className={clsx('font-bold', grossProfit >= 0 ? 'text-green-600' : 'text-red-600')}>
                    ${grossProfit.toLocaleString()}
                  </p>
                  <p className="text-gray-300 mt-0.5">不含人事</p>
                </div>
              </div>
            )
          })()}
        </div>

        {saveErr && (
          <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2 mb-3">{saveErr}</p>
        )}
        <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
          <button className="btn-secondary" onClick={onClose}>取消</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? '儲存中...' : '儲存變更'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Site Section（案場班次 + 週期任務）──────────────────────────────────────
function SiteSection({ site, onEdit }) {
  const { activeOrgId } = useOrg()
  const { data: shiftCodesRaw } = useCollection(COL.SHIFT_CODES)
  const shiftCodes = useMemo(
    () => shiftCodesRaw.filter(s => s.orgId === activeOrgId),
    [shiftCodesRaw, activeOrgId]
  )
  const [isExpanded, setExpanded] = useState(true)
  const currentMonth = new Date().getMonth() + 1
  const billingMode  = site.billingMode || 'fixed'
  const billingMeta  = BILLING_MODE_MAP[billingMode] || BILLING_MODE_MAP.fixed
  const monthlyBase  = getSiteMonthlyBase(site)

  // header right summary depends on billingMode
  let headerSummary = ''
  if (billingMode === 'dispatch') {
    const remaining = (site.dispatchPlan || []).reduce((s, d) => s + Math.max(0, (d.plannedCount || 0) - (d.usedCount || 0)), 0)
    headerSummary = `派工剩 ${remaining} 次`
  } else if (billingMode === 'weekly') {
    headerSummary = `每週 ${site.weeklySchedule?.timesPerWeek || 0} 次`
  } else {
    headerSummary = `月費 $${monthlyBase.toLocaleString()}`
  }

  return (
    <div className="card overflow-hidden">
      {/* Site header */}
      <div className="flex items-center">
        <button
          onClick={() => setExpanded(e => !e)}
          className="flex-1 flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left"
        >
          <div className="flex items-center gap-3 flex-wrap">
            <Building2 size={16} className="text-brand-600 shrink-0" />
            <span className="font-semibold text-gray-900">{site.name}</span>
            <span className="badge badge-gray text-[10px]">{billingMeta.icon} {billingMeta.label}</span>
            <span className="text-sm text-gray-400">{headerSummary}</span>
          </div>
          <div className="flex items-center gap-2">
            {(site.shifts?.length > 0) && (
              <span className="badge badge-blue">{site.shifts.length} 班別</span>
            )}
            {(site.periodicTasks?.length > 0) && (
              <span className="badge badge-gray">{site.periodicTasks.length} 週期項目</span>
            )}
            {isExpanded
              ? <ChevronDown size={16} className="text-gray-400" />
              : <ChevronRight size={16} className="text-gray-400" />
            }
          </div>
        </button>
        {onEdit && (
          <button
            onClick={onEdit}
            className="shrink-0 px-3 py-3 text-gray-400 hover:text-brand-600 hover:bg-gray-50 transition-colors border-l border-gray-100"
            title="編輯班次與任務"
          >
            <Pencil size={15} />
          </button>
        )}
      </div>

      {isExpanded && (
        <div className="border-t border-gray-100">

          {/* ── 月固定明細（fixed / actual）─────────────────────────────── */}
          {(billingMode === 'fixed' || billingMode === 'actual') && site.monthlyItems?.length > 0 && (
            <div className="px-4 pt-4 pb-3">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">月固定明細</p>
              <div className="bg-gray-50 rounded-xl overflow-hidden">
                {site.monthlyItems.map(item => (
                  <div key={item.id} className="flex items-center justify-between px-3 py-2 border-b border-gray-100 last:border-0 text-sm">
                    <span className="text-gray-700">{item.name || '未命名項目'}</span>
                    <span className="font-medium text-gray-900">${(Number(item.amount) || 0).toLocaleString()}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between px-3 py-2 bg-gray-100 border-t border-gray-200 text-sm font-bold">
                  <span className="text-gray-600">月固定合計</span>
                  <span className="text-brand-700">${monthlyBase.toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          {/* ── 派工計畫（dispatch）─────────────────────────────────────── */}
          {billingMode === 'dispatch' && site.dispatchPlan?.length > 0 && (
            <div className="px-4 pt-4 pb-3">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">派工計畫</p>
              <div className="space-y-2">
                {site.dispatchPlan.map(d => {
                  const remaining = getDispatchRemaining(d)
                  const used = d.usedCount || 0
                  const total = d.plannedCount || 0
                  const pct = total > 0 ? (used / total) * 100 : 0
                  return (
                    <div key={d.id} className="bg-gray-50 rounded-xl px-3 py-2.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-gray-800">{d.name}</span>
                        <span className="text-gray-600">
                          <span className="font-bold">{used}</span> / {total} 次 · ${(d.unitPrice || 0).toLocaleString()}/次
                        </span>
                      </div>
                      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden mt-1.5">
                        <div className="h-full bg-brand-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-[11px] text-gray-400 mt-1">剩餘 {remaining} 次，可請款 ${(remaining * (d.unitPrice || 0)).toLocaleString()}</p>
                    </div>
                  )
                })}
              </div>
              {site.locations?.length > 0 && (
                <div className="mt-3">
                  <p className="text-[11px] text-gray-500 mb-1">服務地點（{site.locations.length}）</p>
                  <div className="flex flex-wrap gap-1">
                    {site.locations.map((l, i) => (
                      <span key={i} className="badge badge-gray text-[10px]">{l}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── 每週固定（weekly）───────────────────────────────────────── */}
          {billingMode === 'weekly' && site.weeklySchedule && (
            <div className="px-4 pt-4 pb-3">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">每週固定排班</p>
              <div className="bg-gray-50 rounded-xl px-3 py-2.5 text-sm">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-gray-600">執行日：</span>
                  {(site.weeklySchedule.weekdays || []).length > 0
                    ? (site.weeklySchedule.weekdays || []).map(d => (
                        <span key={d} className="badge bg-brand-100 text-brand-700 text-[10px]">
                          {WEEKDAYS.find(w => w.id === d)?.full || `週${d}`}
                        </span>
                      ))
                    : <span className="text-gray-400">未指定</span>
                  }
                </div>
                <p className="text-xs text-gray-500 mt-1.5">
                  每週 {site.weeklySchedule.timesPerWeek || 0} 次 ×
                  ${(site.weeklySchedule.unitPrice || 0).toLocaleString()}/次 ×
                  {site.weeklySchedule.weeks || 52} 週 =
                  <span className="font-bold text-brand-700 ml-1">${getWeeklyAnnualTotal(site.weeklySchedule).toLocaleString()}</span>
                </p>
              </div>
            </div>
          )}

          {/* ── 班次設定（唯讀）── */}
          <div className="px-4 pt-4 pb-3 border-t border-gray-100">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">
              駐點班次設定
            </p>
            {(() => {
              const newShifts = (site.shifts || []).filter(s => s.shiftCodeId)
              const hasLegacy = (site.shifts || []).some(s => !s.shiftCodeId)
              if (newShifts.length === 0) return (
                <p className="text-sm text-gray-400">
                  {hasLegacy ? '班次格式已更新，請點擊編輯重新選擇班次管理中的班次' : '尚無班次設定'}
                </p>
              )
              return (
                <div className="space-y-2">
                  {newShifts.map(shift => {
                    const sc = shiftCodes.find(c => c.id === shift.shiftCodeId)
                    const wds    = Array.isArray(shift.weekdays) ? shift.weekdays : []
                    const wdText = wds.length > 0 && wds.length < 7
                      ? wds.map(d => WEEKDAYS.find(w => w.id === d)?.label || '').join('')
                      : ''
                    return (
                      <div key={shift.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5 flex-wrap">
                        <span
                          className="text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0 text-white"
                          style={{ backgroundColor: sc?.color || '#6b7280' }}
                        >
                          {sc?.code || '?'}
                        </span>
                        <span className="text-sm text-gray-700 flex items-center gap-1.5">
                          <Clock size={12} className="text-gray-400" />
                          {sc ? `${sc.label} ${sc.startTime}–${sc.endTime}` : '（班次代號已刪除）'}
                        </span>
                        {wdText && (
                          <span className="text-[11px] text-gray-500 bg-white border border-gray-200 rounded px-1.5 py-0.5">
                            週{wdText}
                          </span>
                        )}
                        <span className="text-sm text-gray-500 flex items-center gap-1.5 ml-auto shrink-0">
                          <Users size={12} className="text-gray-400" />
                          需 {shift.headcount} 人
                        </span>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>

          {/* ── 週期性項目 ── */}
          {(site.periodicTasks?.length > 0) && (
            <div className="px-4 pb-4 border-t border-gray-100 pt-3">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                週期性項目
              </p>
              <div className="divide-y divide-gray-50">
                {(site.periodicTasks || []).map(task => {
                  const isDueThisMonth       = isTaskDueInMonth(task, currentMonth)
                  const isCompletedThisMonth = isTaskCompletedInPeriod(task, currentMonth)
                  const scheduleType         = task.scheduleType || 'fixed'
                  return (
                    <div key={task.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                      <div className={clsx('w-1.5 h-1.5 rounded-full shrink-0 mt-0.5', isDueThisMonth ? 'bg-amber-400' : 'bg-gray-300')} />
                      <span className="flex-1 text-gray-700 min-w-0">{task.name}</span>
                      {scheduleType !== 'fixed' && (
                        <span className="badge bg-purple-100 text-purple-700 text-[10px]">
                          {SCHEDULE_TYPE_MAP[scheduleType]?.label}
                        </span>
                      )}
                      <span className="text-gray-400 text-xs">${(task.unitPrice || 0).toLocaleString()}/次</span>
                      <span className="text-gray-400 text-xs">{getTaskScheduleText(task)}</span>
                      {isDueThisMonth       && <span className="badge bg-amber-100 text-amber-700 text-[10px]">本月可執行</span>}
                      {isCompletedThisMonth && <span className="badge bg-green-100 text-green-700 text-[10px]">已完成</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── 每月成本預算（有設定才顯示）── */}
          {(site.monthlyConsumableCost > 0 || site.monthlyToolCost > 0) && (() => {
            const totalCost   = (site.monthlyConsumableCost || 0) + (site.monthlyToolCost || 0)
            const grossProfit = monthlyBase - totalCost
            return (
              <div className="px-4 pb-4 border-t border-gray-100 pt-3">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">每月成本預算</p>
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  {site.monthlyConsumableCost > 0 && (
                    <div className="bg-orange-50 rounded-xl px-2 py-2.5">
                      <p className="text-gray-400 mb-0.5">耗材</p>
                      <p className="font-bold text-orange-600">${site.monthlyConsumableCost.toLocaleString()}</p>
                    </div>
                  )}
                  {site.monthlyToolCost > 0 && (
                    <div className="bg-blue-50 rounded-xl px-2 py-2.5">
                      <p className="text-gray-400 mb-0.5">工具攤提</p>
                      <p className="font-bold text-blue-600">${site.monthlyToolCost.toLocaleString()}</p>
                    </div>
                  )}
                  <div className="bg-gray-100 rounded-xl px-2 py-2.5">
                    <p className="text-gray-400 mb-0.5">月成本</p>
                    <p className="font-bold text-gray-700">${totalCost.toLocaleString()}</p>
                  </div>
                  <div className={clsx('rounded-xl px-2 py-2.5', grossProfit >= 0 ? 'bg-green-50' : 'bg-red-50')}>
                    <p className="text-gray-400 mb-0.5">預估毛利</p>
                    <p className={clsx('font-bold', grossProfit >= 0 ? 'text-green-600' : 'text-red-600')}>
                      ${grossProfit.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}

// ─── Month Schedule Tab ───────────────────────────────────────────────────────
function MonthScheduleTab({ contract, sites, employees, orgId }) {
  const now = new Date()
  const initMonth = now.getMonth() === 11
    ? `${now.getFullYear() + 1}-01`
    : `${now.getFullYear()}-${String(now.getMonth() + 2).padStart(2, '0')}`
  const [yearMonth, setYearMonth] = useState(initMonth)
  const [generating, setGenerating] = useState(false)
  const { data: instancesRaw } = useCollection(COL.SCHEDULE_INSTANCES)

  const [y, m] = yearMonth.split('-').map(Number)
  const daysInMonth = new Date(y, m, 0).getDate()
  const monthLabel  = new Date(y, m - 1, 1).toLocaleDateString('zh-TW', { year: 'numeric', month: 'long' })

  const prevMonth = () => {
    if (m === 1) setYearMonth(`${y - 1}-12`)
    else setYearMonth(`${y}-${String(m - 1).padStart(2, '0')}`)
  }
  const nextMonth = () => {
    if (m === 12) setYearMonth(`${y + 1}-01`)
    else setYearMonth(`${y}-${String(m + 1).padStart(2, '0')}`)
  }

  // Working days (Mon–Sat, skip Sunday)
  const workingDays = useMemo(() =>
    Array.from({ length: daysInMonth }, (_, i) => {
      const d = new Date(y, m - 1, i + 1)
      return { date: `${y}-${String(m).padStart(2,'0')}-${String(i + 1).padStart(2,'0')}`, dow: d.getDay() }
    }).filter(d => d.dow !== 0),
  [y, m, daysInMonth])

  const siteIds = sites.map(s => s.id)
  const monthInstances = useMemo(() =>
    instancesRaw.filter(inst => siteIds.includes(inst.siteId) && (inst.date || '').startsWith(yearMonth)),
  [instancesRaw, siteIds, yearMonth])

  const generateSchedule = async () => {
    setGenerating(true)
    for (const site of sites) {
      for (const shift of (site.shifts || [])) {
        if (!(shift.employeeIds || []).length) continue
        for (const { date } of workingDays) {
          const exists = monthInstances.find(inst =>
            inst.siteId === site.id && inst.date === date && inst.startTime === shift.startTime
          )
          if (exists) continue
          await addScheduleInstance({
            orgId, siteId: site.id, siteName: site.name,
            date, startTime: shift.startTime, endTime: shift.endTime,
            employeeIds: shift.employeeIds, templateId: contract.id,
            status: 'pending', color: '#3b82f6',
          })
        }
      }
    }
    setGenerating(false)
  }

  const allShiftsWithEmps = sites.flatMap(s =>
    (s.shifts || []).filter(sh => (sh.employeeIds || []).length > 0).map(sh => ({ site: s, shift: sh }))
  )

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
          <button onClick={prevMonth} className="p-1 hover:bg-gray-100 rounded-lg"><ChevronLeft size={15} /></button>
          <span className="text-sm font-semibold text-gray-800 w-32 text-center">{monthLabel}</span>
          <button onClick={nextMonth} className="p-1 hover:bg-gray-100 rounded-lg"><ChevronRight size={15} /></button>
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <span>工作日 {workingDays.length} 天（排除週日）</span>
          <button
            className="btn-primary text-sm"
            onClick={generateSchedule}
            disabled={generating || allShiftsWithEmps.length === 0}
          >
            <CalendarCheck size={14} />
            {generating ? '生成中…' : '生成班表'}
          </button>
        </div>
      </div>

      {allShiftsWithEmps.length === 0 ? (
        <div className="card p-8 text-center">
          <Users size={36} className="mx-auto mb-3 text-gray-200" />
          <p className="text-gray-400 text-sm">尚未在任何班次指派員工</p>
          <p className="text-gray-300 text-xs mt-1">請先至「案場與班次」→ 編輯案場 → 點選員工</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sites.map(site => {
            const siteShifts = (site.shifts || []).filter(sh => (sh.employeeIds || []).length > 0)
            if (!siteShifts.length) return null
            return (
              <div key={site.id} className="card overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 size={14} className="text-brand-600" />
                    <span className="font-semibold text-gray-800 text-sm">{site.name}</span>
                  </div>
                  {site.address && <span className="text-xs text-gray-400">{site.address}</span>}
                </div>
                <div className="divide-y divide-gray-100">
                  {siteShifts.map(shift => {
                    const generated = monthInstances.filter(inst =>
                      inst.siteId === site.id && inst.startTime === shift.startTime
                    ).length
                    const pct = workingDays.length > 0 ? Math.round((generated / workingDays.length) * 100) : 0
                    return (
                      <div key={shift.id} className="px-4 py-3 flex flex-wrap items-center gap-3">
                        <span className={clsx('text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0', shiftBadgeClass(shift.label))}>
                          {shift.label}
                        </span>
                        <span className="text-sm text-gray-600 shrink-0">{shift.startTime} – {shift.endTime}</span>
                        <div className="flex flex-wrap gap-1">
                          {(shift.employeeIds || []).map(id => {
                            const emp = employees.find(e => e.id === id)
                            return emp
                              ? <span key={id} className="text-[11px] font-medium bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full">{emp.name}</span>
                              : null
                          })}
                        </div>
                        <div className="ml-auto flex items-center gap-2 shrink-0">
                          <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-brand-500 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className={clsx('text-xs font-semibold', generated === workingDays.length ? 'text-green-600' : 'text-amber-600')}>
                            {generated} / {workingDays.length} 天
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Contract Detail ──────────────────────────────────────────────────────────
// ─── Cost Analysis Tab ────────────────────────────────────────────────────────
function CostAnalysisTab({ contract, sites, purchases }) {
  const now = new Date()
  const [yearMonth, setYearMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  )
  const [y, m] = yearMonth.split('-').map(Number)
  const prevMonth = () => setYearMonth(m === 1  ? `${y-1}-12` : `${y}-${String(m-1).padStart(2,'0')}`)
  const nextMonth = () => setYearMonth(m === 12 ? `${y+1}-01` : `${y}-${String(m+1).padStart(2,'0')}`)
  const monthLabel = new Date(y, m-1, 1).toLocaleDateString('zh-TW', { year: 'numeric', month: 'long' })

  // 篩選本月關聯進貨
  const monthPurchases = purchases.filter(p => (p.date || '').startsWith(yearMonth))

  // 按案場名稱加總實際花費
  const actualBySite = {}
  monthPurchases.forEach(p => {
    if (p.relatedSiteName) {
      actualBySite[p.relatedSiteName] = (actualBySite[p.relatedSiteName] || 0) + (p.totalAmount || 0)
    }
  })
  const unlinkedTotal = monthPurchases.filter(p => !p.relatedSiteName).reduce((s, p) => s + (p.totalAmount || 0), 0)

  // 各案場行
  const siteRows = sites.map(site => {
    const budgetConsumable = site.monthlyConsumableCost || 0
    const budgetTool       = site.monthlyToolCost       || 0
    const budget      = budgetConsumable + budgetTool
    const actual      = actualBySite[site.name] || 0
    const variance    = actual - budget
    const revenue     = getSiteMonthlyBase(site)
    const grossProfit = revenue - actual
    return { site, budget, budgetConsumable, budgetTool, actual, variance, revenue, grossProfit }
  })

  const totalBudget  = siteRows.reduce((s, r) => s + r.budget, 0)
  const totalActual  = monthPurchases.reduce((s, p) => s + (p.totalAmount || 0), 0)
  const totalRevenue = siteRows.reduce((s, r) => s + r.revenue, 0)

  return (
    <div className="space-y-5">
      {/* 月份切換 */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
          <button onClick={prevMonth} className="p-1 hover:bg-gray-100 rounded-lg"><ChevronLeft size={16} /></button>
          <span className="text-sm font-semibold text-gray-800 w-28 text-center">{monthLabel}</span>
          <button onClick={nextMonth} className="p-1 hover:bg-gray-100 rounded-lg"><ChevronRight size={16} /></button>
        </div>
        <p className="text-xs text-gray-400">預算估算 vs. 實際進貨成本對比</p>
      </div>

      {/* 摘要卡片 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4">
          <p className="text-xs text-gray-400">本月月費收入</p>
          <p className="text-xl font-bold text-brand-700 mt-1">${totalRevenue.toLocaleString()}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-400">耗材/工具預算</p>
          <p className="text-xl font-bold text-gray-700 mt-1">${totalBudget.toLocaleString()}</p>
          <p className="text-xs mt-0.5">
            實際進貨：<span className={clsx('font-semibold', totalActual > totalBudget && totalBudget > 0 ? 'text-red-500' : 'text-green-600')}>
              ${totalActual.toLocaleString()}
            </span>
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-400">預估毛利（不含人事）</p>
          <p className={clsx('text-xl font-bold mt-1', totalRevenue - totalActual >= 0 ? 'text-green-600' : 'text-red-600')}>
            ${(totalRevenue - totalActual).toLocaleString()}
          </p>
          {totalRevenue > 0 && (
            <p className="text-xs text-gray-400 mt-0.5">
              毛利率 {(((totalRevenue - totalActual) / totalRevenue) * 100).toFixed(1)}%
            </p>
          )}
        </div>
      </div>

      {/* 各案場對比表 */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-700">各案場成本分析</p>
          <p className="text-xs text-gray-400 mt-0.5">毛利 = 月費收入 − 本月實際進貨（不含人事成本）</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-2.5 text-left">案場</th>
                <th className="px-4 py-2.5 text-right">月費收入</th>
                <th className="px-4 py-2.5 text-right">成本預算</th>
                <th className="px-4 py-2.5 text-right">實際進貨</th>
                <th className="px-4 py-2.5 text-right">預算差異</th>
                <th className="px-4 py-2.5 text-right">毛利估算</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {siteRows.map(({ site, budget, budgetConsumable, budgetTool, actual, variance, revenue, grossProfit }) => (
                <tr key={site.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800">{site.name}</p>
                    {budget > 0 && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        耗材 ${budgetConsumable.toLocaleString()} ＋ 工具攤提 ${budgetTool.toLocaleString()}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-brand-700">${revenue.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{budget > 0 ? `$${budget.toLocaleString()}` : <span className="text-gray-300">未設定</span>}</td>
                  <td className="px-4 py-3 text-right">
                    {actual > 0
                      ? <span className={clsx('font-semibold', actual > budget && budget > 0 ? 'text-red-500' : 'text-gray-700')}>${actual.toLocaleString()}</span>
                      : <span className="text-gray-300">—</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-right">
                    {budget > 0
                      ? <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full', variance <= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600')}>
                          {variance <= 0 ? '▼' : '▲'} ${Math.abs(variance).toLocaleString()}
                        </span>
                      : <span className="text-gray-300">—</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className={clsx('font-semibold', grossProfit >= 0 ? 'text-green-600' : 'text-red-600')}>${grossProfit.toLocaleString()}</p>
                    {revenue > 0 && <p className="text-[11px] text-gray-400">{((grossProfit / revenue) * 100).toFixed(1)}%</p>}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-brand-50 border-t-2 border-brand-100 font-semibold">
                <td className="px-4 py-3 font-bold text-brand-800">合計</td>
                <td className="px-4 py-3 text-right text-brand-700">${totalRevenue.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-gray-600">${totalBudget.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-gray-700">${totalActual.toLocaleString()}</td>
                <td className="px-4 py-3 text-right">
                  <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full', totalActual - totalBudget <= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600')}>
                    {totalActual - totalBudget <= 0 ? '▼' : '▲'} ${Math.abs(totalActual - totalBudget).toLocaleString()}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-bold text-green-600">${(totalRevenue - totalActual).toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* 未指定案場的進貨提示 */}
      {unlinkedTotal > 0 && (
        <div className="card px-4 py-3 bg-amber-50 border border-amber-100 flex items-start gap-2">
          <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800">有進貨未指定到特定案場</p>
            <p className="text-xs text-amber-600 mt-0.5">本月 ${unlinkedTotal.toLocaleString()} 的進貨已計入合約合計，但未分配到任何案場列</p>
          </div>
        </div>
      )}

      {/* 本月進貨明細 */}
      {monthPurchases.length > 0 ? (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-700">本月進貨明細</p>
          </div>
          <div className="divide-y divide-gray-50">
            {monthPurchases.map(p => (
              <div key={p.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-800">{p.supplierName || '—'}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{p.date} · {p.relatedSiteName ? `→ ${p.relatedSiteName}` : '未指定案場'}</p>
                </div>
                <p className="font-semibold text-gray-700">${(p.totalAmount || 0).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="card p-12 text-center">
          <DollarSign size={36} className="mx-auto mb-3 text-gray-200" />
          <p className="text-gray-400 text-sm">本月尚無關聯進貨紀錄</p>
          <p className="text-xs text-gray-300 mt-1">在「庫存管理 → 新增進貨單」選擇此合約後即可自動關聯</p>
        </div>
      )}
    </div>
  )
}

function ContractDetail({ contract, onBack }) {
  const { activeOrgId }          = useOrg()
  const { data: employeesRaw }   = useCollection(COL.EMPLOYEES)
  const { data: purchasesRaw }   = useCollection(COL.PURCHASES)
  const employees = useMemo(
    () => employeesRaw.filter(e => e.orgId === (contract.orgId || activeOrgId)),
    [employeesRaw, contract.orgId, activeOrgId]
  )
  const contractPurchases = useMemo(
    () => purchasesRaw.filter(p => p.relatedContractId === contract.id),
    [purchasesRaw, contract.id]
  )

  const [subTab,      setSubTab]      = useState('sites')
  const [localSites,   setLocalSites]   = useState(contract.sites || [])
  const [editingSite,  setEditingSite]  = useState(null)
  const [showAddSite,  setShowAddSite]  = useState(false)
  const [newSiteName,  setNewSiteName]  = useState('')
  const [newSiteAddr,  setNewSiteAddr]  = useState('')
  const [newSiteBase,  setNewSiteBase]  = useState('')
  const [addSiteErr,   setAddSiteErr]   = useState('')
  const [addSiteSaving,setAddSiteSaving]= useState(false)

  const start = new Date(contract.contractStart)
  const end   = new Date(contract.contractEnd)
  const now   = new Date()

  const rawPct         = ((now - start) / (end - start)) * 100
  const pctElapsed     = isNaN(rawPct) ? 0 : Math.min(100, rawPct)
  const monthsElapsed  = Math.max(1, (now.getFullYear() * 12 + now.getMonth()) - (start.getFullYear() * 12 + start.getMonth()) + 1)
  const totalMonths    = Math.max(1, Math.round((end - start) / (30 * 24 * 3600 * 1000)))
  const sites          = localSites
  const monthlyTotal   = getContractMonthlyTotal(sites)
  const billedSoFar    = monthlyTotal * Math.max(0, monthsElapsed - 1)
  const customerName   = contract.customerName || ''

  const handleSaveSite = async (updatedSite) => {
    const newSites = localSites.map(s => s.id === updatedSite.id ? updatedSite : s)
    await updateAnnualContract(contract.id, { sites: newSites })
    setLocalSites(newSites)
    setEditingSite(null)
  }

  const handleAddSite = async () => {
    if (!newSiteName.trim()) { setAddSiteErr('請填寫案場名稱'); return }
    setAddSiteSaving(true)
    setAddSiteErr('')
    const baseAmount = Number(newSiteBase) || 0
    const newSite = {
      id: `site-${Date.now()}`,
      name: newSiteName.trim(),
      address: newSiteAddr.trim(),
      billingMode: 'fixed',
      monthlyBase: baseAmount,
      monthlyItems: baseAmount > 0 ? [makeNewMonthlyItem('月固定費用', baseAmount)] : [],
      dispatchPlan: [],
      locations: [],
      weeklySchedule: null,
      shifts: [],
      periodicTasks: [],
    }
    const newSites = [...localSites, newSite]
    setLocalSites(newSites)
    await updateAnnualContract(contract.id, { sites: newSites })
    setNewSiteName(''); setNewSiteAddr(''); setNewSiteBase(''); setAddSiteErr('')
    setShowAddSite(false)
    setAddSiteSaving(false)
  }

  const SUB_TABS = [
    { key: 'sites',   label: '案場與班次', icon: Building2  },
    { key: 'matrix',  label: '任務矩陣',   icon: Layers     },
    { key: 'billing', label: '本月請款',   icon: TrendingUp },
    { key: 'cost',    label: '成本分析',   icon: DollarSign },
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={onBack} className="btn-secondary py-1.5 px-3 shrink-0 mt-0.5">
          <ArrowLeft size={15} /> 返回
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-gray-900 leading-snug">{contract.title}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-gray-500">
            <span>{customerName}</span>
            <span>·</span>
            <span>{contract.contractStart} ~ {contract.contractEnd}</span>
            <span className={`badge ${STATUS_BADGE[contract.status]}`}>{STATUS_LABEL[contract.status]}</span>
            {contract.contractNo && (
              <span className="badge badge-gray text-[10px]">合約編號 {contract.contractNo}</span>
            )}
            <span className="badge bg-purple-100 text-purple-700 text-[10px]">
              {contract.paymentMode === 'actual' ? '核實請款' : '平均攤提'}
            </span>
            {Array.isArray(contract.amendments) && contract.amendments.length > 0 && (
              <span className="badge bg-amber-100 text-amber-700 text-[10px]">
                已變更 {contract.amendments.length} 次
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: '合約總金額',  value: `$${contract.totalValue.toLocaleString()}`,        sub: '含稅' },
          { label: '月均收入',    value: `$${monthlyTotal.toLocaleString()}`,   sub: `${sites.length} 個案場合計`, highlight: true },
          { label: '合約案場',    value: `${sites.length} 個`,                   sub: `共 ${sites.reduce((s, si) => s + (si.shifts?.length || 0), 0)} 個班別` },
          { label: '執行進度',    value: `第 ${monthsElapsed} / ${totalMonths} 月`, sub: `${pctElapsed.toFixed(0)}% 完成` },
        ].map(({ label, value, sub, highlight }) => (
          <div key={label} className="card p-3.5">
            <p className="text-xs text-gray-400">{label}</p>
            <p className={clsx('text-lg font-bold mt-0.5', highlight ? 'text-brand-700' : 'text-gray-900')}>{value}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="card px-4 py-3.5 space-y-2">
        <div className="flex justify-between text-xs text-gray-500">
          <span>{contract.contractStart}</span>
          <span className="font-semibold text-brand-600">合約執行進度 {pctElapsed.toFixed(0)}%</span>
          <span>{contract.contractEnd}</span>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-brand-400 to-brand-600 rounded-full transition-all"
            style={{ width: `${pctElapsed}%` }}
          />
        </div>
        <div className="flex justify-between text-[11px] text-gray-400">
          <span>已請款估算 ${billedSoFar.toLocaleString()}</span>
          <span>剩餘 ${(contract.totalValue - billedSoFar).toLocaleString()}</span>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex bg-gray-100 rounded-xl p-1 gap-1 w-fit">
        {SUB_TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setSubTab(key)}
            className={clsx(
              'flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors',
              subTab === key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700',
            )}
          >
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      {/* Content */}
      {subTab === 'sites' && (
        <div className="space-y-3">
          {sites.map(site => (
            <SiteSection
              key={site.id}
              site={site}
              onEdit={() => setEditingSite(site)}
            />
          ))}

          {/* Add site inline form */}
          {showAddSite ? (
            <div className="card p-4 space-y-3 border-2 border-dashed border-brand-200">
              <p className="text-sm font-semibold text-gray-700">新增案場</p>
              <div>
                <label className="label">案場名稱 *</label>
                <input className="input" placeholder="例：信義廠辦 3F" value={newSiteName} onChange={e => setNewSiteName(e.target.value)} />
              </div>
              <div>
                <label className="label">施工地址</label>
                <input className="input" placeholder="台北市信義區…" value={newSiteAddr} onChange={e => setNewSiteAddr(e.target.value)} />
              </div>
              <div>
                <label className="label">月費</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input className="input pl-7" type="number" min="0" placeholder="0" value={newSiteBase} onChange={e => setNewSiteBase(e.target.value)} />
                </div>
              </div>
              {addSiteErr && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{addSiteErr}</p>}
              <div className="flex gap-2 justify-end">
                <button className="btn-secondary text-sm" onClick={() => { setShowAddSite(false); setAddSiteErr('') }}>取消</button>
                <button className="btn-primary text-sm" onClick={handleAddSite} disabled={addSiteSaving}>
                  {addSiteSaving ? '儲存中...' : '加入案場'}
                </button>
              </div>
            </div>
          ) : (
            <button
              className="w-full py-3 rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-400 hover:border-brand-300 hover:text-brand-600 transition-colors flex items-center justify-center gap-1.5"
              onClick={() => setShowAddSite(true)}
            >
              <Plus size={15} /> 新增案場
            </button>
          )}
        </div>
      )}
      {subTab === 'matrix'  && <TaskMatrix    sites={sites} />}
      {subTab === 'billing' && <BillingDraft  contract={contract} sites={sites} />}
      {subTab === 'cost'    && <CostAnalysisTab contract={contract} sites={sites} purchases={contractPurchases} />}

      {editingSite && (
        <EditSiteModal
          site={editingSite}
          onSave={handleSaveSite}
          onClose={() => setEditingSite(null)}
        />
      )}
    </div>
  )
}

// ─── Annual Contract Card (list item) ────────────────────────────────────────
function AnnualContractCard({ contract, onSelect, customerName }) {
  const now     = new Date()
  const start   = new Date(contract.contractStart)
  const end     = new Date(contract.contractEnd)
  const pct     = Math.min(100, ((now - start) / (end - start)) * 100).toFixed(0)
  const monthly = getContractMonthlyTotal(contract.sites || [])

  // Count periodic tasks due this month
  const currentMonth = now.getMonth() + 1
  const dueTasks = (contract.sites || []).flatMap(s =>
    (s.periodicTasks || []).filter(t => isTaskDueInMonth(t, currentMonth))
  ).length

  return (
    <button
      onClick={() => onSelect(contract)}
      className="card p-4 w-full text-left hover:shadow-md transition-all group"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="font-semibold text-gray-900 group-hover:text-brand-700 transition-colors line-clamp-1">
              {contract.title}
            </span>
            <span className={`badge ${STATUS_BADGE[contract.status]} shrink-0`}>{STATUS_LABEL[contract.status]}</span>
            {dueTasks > 0 && (
              <span className="badge bg-amber-100 text-amber-700 shrink-0">本月 {dueTasks} 項週期任務</span>
            )}
          </div>
          <p className="text-sm text-gray-500">{customerName || contract.customerName}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {contract.contractStart} ~ {contract.contractEnd} ·&nbsp;
            {(contract.sites || []).length} 個案場
          </p>

          {/* Progress */}
          <div className="mt-3">
            <div className="flex justify-between text-[11px] text-gray-400 mb-1">
              <span>合約執行進度</span><span>{pct}%</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-brand-400 rounded-full" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>

        <div className="text-right shrink-0">
          <p className="text-lg font-bold text-gray-900">${contract.totalValue.toLocaleString()}</p>
          <p className="text-[11px] text-gray-400">合約總額</p>
          <p className="text-sm font-semibold text-brand-600 mt-1">${monthly.toLocaleString()}<span className="text-gray-400 font-normal">/月</span></p>
          <div className="flex items-center justify-end gap-1 mt-2 text-brand-600 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">
            查看詳情 <ChevronRight size={14} />
          </div>
        </div>
      </div>
    </button>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function OrdersPage() {
  const { activeOrgId } = useOrg()
  const { data: customers } = useCollection(COL.CUSTOMERS)
  const [mainTab,           setMainTab]          = useState('oneoff')
  const [selectedContract,  setSelectedContract] = useState(null)
  const [selectedOrder,     setSelectedOrder]    = useState(null)

  // Single-order state
  const [showForm,       setShowForm]       = useState(false)
  const [orderType,      setOrderType]      = useState('oneoff')
  const [search,         setSearch]         = useState('')
  const [statusFilter,   setStatus]         = useState('active_only')
  const [contractFilter, setContractFilter] = useState('active')
  const [typeId,         setTypeId]         = useState('stationed')
  const [customType,     setCustomType]     = useState('')
  const [customerId,     setCustomerId]     = useState('')
  const [siteId,         setSiteId]         = useState('')
  const [newSiteName,    setNewSiteName]    = useState('')
  const [newSiteAddress, setNewSiteAddress] = useState('')
  const [contractStart,  setContractStart]  = useState('')
  const [contractEnd,    setContractEnd]    = useState('')
  const [totalPrice,     setTotalPrice]     = useState('')
  const [taxIncluded,    setTaxIncluded]    = useState(false)
  const [notes,          setNotes]          = useState('')
  const [showEst,        setShowEst]        = useState(false)
  const [saving,         setSaving]         = useState(false)
  const [formErr,        setFormErr]        = useState('')

  const isStationed = typeId === 'stationed'
  const isOther     = typeId === 'other'

  const orgCustomers     = customers.filter(c => c.orgId === activeOrgId)
  const selectedCustomer = orgCustomers.find(c => c.id === customerId)
  const customerSites    = selectedCustomer?.sites || []

  useEffect(() => {
    setSiteId('')
    setNewSiteName('')
    setNewSiteAddress('')
  }, [customerId])

  const { data: ordersRaw } = useCollection(COL.ORDERS)
  const orders = ordersRaw
    .filter(o => o.orgId === activeOrgId)
    .filter(o => {
      if (statusFilter === 'all')         return true
      if (statusFilter === 'active_only') return o.status !== 'closed'
      return o.status === statusFilter
    })
    .filter(o => (o.title || '').includes(search))

  const { data: annualContractsRaw } = useCollection(COL.ANNUAL_CONTRACTS)
  const { data: workOrdersRaw }      = useCollection(COL.WORK_ORDERS)
  const annualContracts = annualContractsRaw
    .filter(c => c.orgId === activeOrgId)
    .filter(c => contractFilter === 'all' || c.status === contractFilter)
  const activeAnnual = annualContractsRaw
    .filter(c => c.orgId === activeOrgId && c.status === 'active').length

  // ── Annual contract form state ──
  const [showAnnualForm,    setShowAnnualForm]    = useState(false)
  const [annualCustomerId,  setAnnualCustomerId]  = useState('')
  const [annualTitle,       setAnnualTitle]       = useState('')
  const [annualContractNo,  setAnnualContractNo]  = useState('')
  const [annualPaymentMode, setAnnualPaymentMode] = useState('averaged')
  const [annualStart,       setAnnualStart]       = useState('')
  const [annualEnd,         setAnnualEnd]         = useState('')
  const [annualValue,       setAnnualValue]       = useState('')
  const [annualSaving,      setAnnualSaving]      = useState(false)
  const [annualErr,         setAnnualErr]         = useState('')
  // site picker
  const [annualSites,           setAnnualSites]          = useState([])
  const [annualPickSiteId,      setAnnualPickSiteId]     = useState('')
  const [annualPickBillingMode, setAnnualPickBillingMode]= useState('fixed')
  const [annualPickMonthly,     setAnnualPickMonthly]    = useState('')
  const [annualNewSiteName,     setAnnualNewSiteName]    = useState('')
  const [annualNewSiteAddr,     setAnnualNewSiteAddr]    = useState('')
  const [annualNewMonthly,      setAnnualNewMonthly]     = useState('')

  const annualCustomer      = orgCustomers.find(c => c.id === annualCustomerId)
  const annualCustomerSites = annualCustomer?.sites || []

  useEffect(() => {
    setAnnualPickSiteId('')
    setAnnualPickBillingMode('fixed')
    setAnnualPickMonthly('')
    setAnnualNewSiteName('')
    setAnnualNewSiteAddr('')
    setAnnualNewMonthly('')
    setAnnualSites([])
  }, [annualCustomerId])

  // 自動計算合約總額 = 各案場月費合計 × 合約月數
  useEffect(() => {
    const totalMonthly = getContractMonthlyTotal(annualSites)
    if (!totalMonthly) return
    if (annualStart && annualEnd) {
      const months = Math.max(1, Math.round(
        (new Date(annualEnd) - new Date(annualStart)) / (1000 * 60 * 60 * 24 * 30.44)
      ))
      setAnnualValue(String(totalMonthly * months))
    } else {
      setAnnualValue(String(totalMonthly))
    }
  }, [annualSites, annualStart, annualEnd])

  const addAnnualSite = () => {
    const mode = annualPickBillingMode || 'fixed'
    const baseFields = {
      billingMode: mode,
      monthlyItems: [],
      dispatchPlan: [],
      locations: [],
      weeklySchedule: mode === 'weekly' ? { weekdays: [], timesPerWeek: 0, unitPrice: 0, weeks: 52 } : null,
      shifts: [],
      periodicTasks: [],
    }
    if (annualPickSiteId === 'new') {
      if (!annualNewSiteName.trim()) return
      const monthlyAmount = (mode === 'fixed' || mode === 'actual') ? (Number(annualNewMonthly) || 0) : 0
      setAnnualSites(prev => [...prev, {
        id: `new-${Date.now()}`,
        name: annualNewSiteName.trim(),
        address: annualNewSiteAddr.trim(),
        ...baseFields,
        monthlyBase: monthlyAmount,
        monthlyItems: monthlyAmount > 0
          ? [makeNewMonthlyItem('月固定費用', monthlyAmount)]
          : [],
      }])
      setAnnualNewSiteName(''); setAnnualNewSiteAddr(''); setAnnualNewMonthly('')
      setAnnualPickSiteId(''); setAnnualPickBillingMode('fixed')
    } else if (annualPickSiteId) {
      const site = annualCustomerSites.find(s => s.id === annualPickSiteId)
      if (!site || annualSites.some(s => s.id === site.id)) return
      const monthlyAmount = (mode === 'fixed' || mode === 'actual') ? (Number(annualPickMonthly) || 0) : 0
      setAnnualSites(prev => [...prev, {
        id: site.id, name: site.name, address: site.address || '',
        ...baseFields,
        monthlyBase: monthlyAmount,
        monthlyItems: monthlyAmount > 0
          ? [makeNewMonthlyItem('月固定費用', monthlyAmount)]
          : [],
      }])
      setAnnualPickSiteId(''); setAnnualPickBillingMode('fixed'); setAnnualPickMonthly('')
    }
  }

  const closeAnnualForm = () => {
    setShowAnnualForm(false)
    setAnnualCustomerId('')
    setAnnualTitle('')
    setAnnualContractNo('')
    setAnnualPaymentMode('averaged')
    setAnnualStart('')
    setAnnualEnd('')
    setAnnualValue('')
    setAnnualSites([])
    setAnnualPickSiteId('')
    setAnnualPickBillingMode('fixed')
    setAnnualPickMonthly('')
    setAnnualNewSiteName('')
    setAnnualNewSiteAddr('')
    setAnnualNewMonthly('')
    setAnnualErr('')
  }

  const handleSaveAnnual = async () => {
    if (!annualCustomerId) { setAnnualErr('請選擇客戶'); return }
    if (!annualStart || !annualEnd) { setAnnualErr('請填寫合約期間'); return }
    setAnnualSaving(true)
    setAnnualErr('')
    try {
      const customer = orgCustomers.find(c => c.id === annualCustomerId)
      const title = annualTitle.trim() || `${customer?.name} 年度合約`

      // 將合約案場同步回客戶文件（依名稱去重）
      if (annualSites.length > 0) {
        const existingSites = customer?.sites || []
        const existingNames = new Set(existingSites.map(s => s.name))
        const toAdd = annualSites
          .filter(s => !existingNames.has(s.name))
          .map((s, i) => ({
            id:      `site-${Date.now()}-${i}`,
            name:    s.name,
            address: s.address || '',
            lat:     0,
            lng:     0,
            area:    0,
          }))
        if (toAdd.length > 0) {
          await updateCustomer(annualCustomerId, { sites: [...existingSites, ...toAdd] })
        }
      }

      await addAnnualContract({
        orgId:         activeOrgId,
        title,
        contractNo:    annualContractNo.trim(),
        customerId:    annualCustomerId,
        customerName:  customer?.name || '',
        contractStart: annualStart,
        contractEnd:   annualEnd,
        totalValue:    Number(annualValue) || 0,
        paymentMode:   annualPaymentMode,
        status:        'active',
        sites:         annualSites,
        amendments:    [],
      })
      closeForm()
    } catch (e) {
      setAnnualErr('儲存失敗，請稍後再試')
    } finally {
      setAnnualSaving(false)
    }
  }

  const closeForm = () => {
    setShowForm(false)
    setOrderType('oneoff')
    setTypeId('stationed')
    setCustomType('')
    setCustomerId('')
    setSiteId('')
    setNewSiteName('')
    setNewSiteAddress('')
    setContractStart('')
    setContractEnd('')
    setTotalPrice('')
    setNotes('')
    setShowEst(false)
    setFormErr('')
    // also reset annual fields
    setAnnualCustomerId('')
    setAnnualTitle('')
    setAnnualContractNo('')
    setAnnualPaymentMode('averaged')
    setAnnualStart('')
    setAnnualEnd('')
    setAnnualValue('')
    setAnnualSites([])
    setAnnualPickSiteId('')
    setAnnualPickBillingMode('fixed')
    setAnnualPickMonthly('')
    setAnnualNewSiteName('')
    setAnnualNewSiteAddr('')
    setAnnualNewMonthly('')
    setAnnualErr('')
  }

  const handleSave = async () => {
    if (!customerId) { setFormErr('請選擇客戶'); return }
    if (!siteId)     { setFormErr('請選擇或新增案場'); return }
    if (siteId === 'new' && !newSiteName.trim()) { setFormErr('請填寫案場名稱'); return }
    setSaving(true)
    setFormErr('')
    try {
      const typeName = isOther ? customType.trim() : (CLEAN_TYPES.find(t => t.id === typeId)?.name || typeId)
      const siteName = siteId === 'new' ? newSiteName.trim() : (customerSites.find(s => s.id === siteId)?.name || '')
      await addOrder({
        orgId:         activeOrgId,
        title:         `${selectedCustomer?.name} · ${typeName}`,
        customerId,
        customerName:  selectedCustomer?.name || '',
        siteId:        siteId === 'new' ? null : siteId,
        siteName,
        siteAddress:   siteId === 'new' ? newSiteAddress.trim() : (customerSites.find(s => s.id === siteId)?.address || ''),
        type:          typeId,
        typeCustom:    isOther ? customType.trim() : '',
        contractStart: isStationed ? contractStart : '',
        contractEnd:   isStationed ? contractEnd : '',
        totalPrice:    Number(totalPrice) || 0,
        notes:         notes.trim(),
        status:        'not_started',
      })
      closeForm()
    } catch (e) {
      setFormErr('儲存失敗，請稍後再試')
      setSaving(false)
    }
  }

  // ── Contract detail full-page view ──
  if (selectedOrder) {
    return (
      <div className="max-w-4xl mx-auto px-1">
        <OrderDetail
          order={selectedOrder}
          customers={orgCustomers}
          orgId={activeOrgId}
          workOrders={workOrdersRaw.filter(wo => wo.orderId === selectedOrder.id)}
          onBack={() => setSelectedOrder(null)}
        />
      </div>
    )
  }

  if (selectedContract) {
    return (
      <div className="max-w-5xl mx-auto">
        <ContractDetail contract={selectedContract} onBack={() => setSelectedContract(null)} />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">

      {/* ── Main tabs + 新增按鈕 ── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
          <button
            onClick={() => setMainTab('oneoff')}
            className={clsx(
              'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
              mainTab === 'oneoff' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700',
            )}
          >
            <FileText size={14} /> 單次案件
          </button>
          <button
            onClick={() => setMainTab('annual')}
            className={clsx(
              'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
              mainTab === 'annual' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700',
            )}
          >
            <Calendar size={14} /> 年度合約
            {activeAnnual > 0 && (
              <span className="bg-brand-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                {activeAnnual}
              </span>
            )}
          </button>
        </div>
        <button
          className="btn-primary"
          onClick={() => { setOrderType(mainTab === 'annual' ? 'annual' : 'oneoff'); setShowForm(true) }}
        >
          <Plus size={16} /> 新增訂單
        </button>
      </div>

      {/* ════════════════════════════════════════
          Tab 1: 單次案件
      ════════════════════════════════════════ */}
      {mainTab === 'oneoff' && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-48">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="input pl-9"
                placeholder="搜尋訂單..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select className="input w-auto" value={statusFilter} onChange={e => setStatus(e.target.value)}>
              <option value="active_only">進行中（預設）</option>
              <option value="all">全部狀態</option>
              <option value="not_started">未施工</option>
              <option value="in_progress">未收尾</option>
              <option value="done">施工完成</option>
              <option value="invoiced">請款單寄出</option>
              <option value="paid">工程款到帳</option>
              <option value="closed">完成訂單</option>
            </select>
          </div>

          <div className="space-y-3">
            {orders.map(o => <OrderRow key={o.id} order={o} customers={orgCustomers} onSelect={setSelectedOrder} />)}
            {orders.length === 0 && (
              <div className="card p-12 text-center text-gray-400">
                <FileText size={36} className="mx-auto mb-3 opacity-30" />
                <p>尚無訂單資料</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* ════════════════════════════════════════
          Tab 2: 年度合約
      ════════════════════════════════════════ */}
      {mainTab === 'annual' && (
        <>
          <div className="flex items-center gap-3">
            <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
              {[
                { key: 'active', label: '進行中' },
                { key: 'all',    label: '全部' },
                { key: 'ended',  label: '已結束' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setContractFilter(key)}
                  className={clsx(
                    'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                    contractFilter === key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            {annualContracts.map(c => (
              <AnnualContractCard
                key={c.id}
                contract={c}
                onSelect={setSelectedContract}
                customerName={orgCustomers.find(cu => cu.id === c.customerId)?.name}
              />
            ))}
            {annualContracts.length === 0 && (
              <div className="card p-12 text-center text-gray-400">
                <Calendar size={36} className="mx-auto mb-3 opacity-30" />
                <p>尚無年度合約</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Unified new order modal ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl p-6 my-4">
            <h2 className="text-lg font-bold text-gray-900 mb-4">新增訂單</h2>
            {/* 類型選擇 */}
            <div className="mb-5">
              <label className="label">訂單類型 *</label>
              <select
                className="input"
                value={orderType}
                onChange={e => setOrderType(e.target.value)}
              >
                <option value="oneoff">單次案件</option>
                <option value="annual">年度合約</option>
              </select>
            </div>

            {/* ── 單次案件欄位 ── */}
            {orderType === 'oneoff' && (<>
            <div className="space-y-4">

              {/* 清潔類型 */}
              <div>
                <label className="label">清潔類型 *</label>
                <div className="flex flex-wrap gap-2">
                  {CLEAN_TYPES.map(t => (
                    <button
                      key={t.id} type="button"
                      onClick={() => setTypeId(t.id)}
                      className={clsx(
                        'px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
                        typeId === t.id
                          ? 'bg-brand-600 text-white border-brand-600'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300',
                      )}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
                {isOther && (
                  <input
                    className="input mt-2"
                    placeholder="請輸入清潔類型..."
                    value={customType}
                    onChange={e => setCustomType(e.target.value)}
                  />
                )}
              </div>

              {/* 客戶 */}
              <div>
                <label className="label">客戶 *</label>
                <select className="input" value={customerId} onChange={e => setCustomerId(e.target.value)}>
                  <option value="">選擇客戶…</option>
                  {orgCustomers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* 案場 */}
              {customerId && (
                <div className="space-y-3">
                  <div>
                    <label className="label">案場 *</label>
                    <select className="input" value={siteId} onChange={e => setSiteId(e.target.value)}>
                      <option value="">選擇案場…</option>
                      {customerSites.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                      <option value="new">＋ 新增案場</option>
                    </select>
                  </div>
                  {siteId && siteId !== 'new' && (() => {
                    const site = customerSites.find(s => s.id === siteId)
                    return site ? (
                      <div className="flex items-start gap-2 bg-brand-50 rounded-xl px-4 py-3 text-sm text-brand-700">
                        <MapPin size={14} className="mt-0.5 shrink-0" />
                        <div>
                          <p className="font-medium">{site.name}</p>
                          <p className="text-brand-500 text-xs mt-0.5">{site.address}</p>
                        </div>
                      </div>
                    ) : null
                  })()}
                  {siteId === 'new' && (
                    <div className="space-y-3 bg-gray-50 rounded-xl p-3 border border-dashed border-gray-300">
                      <p className="text-xs font-semibold text-gray-500">新增案場資料</p>
                      <div>
                        <label className="label">案場名稱 *</label>
                        <input className="input" placeholder="例：信義廠辦 3F" value={newSiteName} onChange={e => setNewSiteName(e.target.value)} />
                      </div>
                      <div>
                        <label className="label">施工地址 *</label>
                        <input className="input" placeholder="台北市信義區…" value={newSiteAddress} onChange={e => setNewSiteAddress(e.target.value)} />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 合約期間（駐點清潔才顯示） */}
              {isStationed && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">合約開始</label>
                    <input className="input" type="date" value={contractStart} onChange={e => setContractStart(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">合約結束</label>
                    <input className="input" type="date" value={contractEnd} onChange={e => setContractEnd(e.target.value)} />
                  </div>
                </div>
              )}

              {/* 訂單總價 */}
              <div>
                <label className="label">訂單總價</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input className="input pl-7" type="number" placeholder="自動計算或手動輸入" value={totalPrice} onChange={e => setTotalPrice(e.target.value)} />
                </div>
              </div>

              {/* 計算預估成本 */}
              <button
                type="button"
                className="btn-secondary w-full justify-center"
                onClick={() => setShowEst(e => !e)}
              >
                <Calculator size={15} />
                {showEst ? '收起預估成本' : '計算預估成本'}
              </button>
              {showEst && (
                <CostEstimator
                  area={siteId && siteId !== 'new' ? (customerSites.find(s => s.id === siteId)?.area || 500) : 500}
                  diffId="normal"
                />
              )}

              {/* 備註 */}
              <div>
                <label className="label">備註</label>
                <textarea className="input h-20 resize-none" placeholder="特殊要求或說明..." value={notes} onChange={e => setNotes(e.target.value)} />
              </div>

              {formErr && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{formErr}</p>}
            </div>
            </>)}

            {/* ── 年度合約欄位 ── */}
            {orderType === 'annual' && (
            <div className="space-y-4">
              <div>
                <label className="label">客戶 *</label>
                <select className="input" value={annualCustomerId} onChange={e => setAnnualCustomerId(e.target.value)}>
                  <option value="">選擇客戶…</option>
                  {orgCustomers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">合約名稱</label>
                  <input className="input" placeholder="留空自動產生" value={annualTitle} onChange={e => setAnnualTitle(e.target.value)} />
                </div>
                <div>
                  <label className="label">合約編號</label>
                  <input className="input" placeholder="例：JX-115-S001" value={annualContractNo} onChange={e => setAnnualContractNo(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">合約開始 *</label>
                  <input className="input" type="date" value={annualStart} onChange={e => setAnnualStart(e.target.value)} />
                </div>
                <div>
                  <label className="label">合約結束 *</label>
                  <input className="input" type="date" value={annualEnd} onChange={e => setAnnualEnd(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label">付款方式</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'averaged', label: '平均攤提', desc: '合約總額 ÷ 12 個月，每月固定請款' },
                    { id: 'actual',   label: '核實請款', desc: '依每月實際施作項目逐月計算' },
                  ].map(o => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setAnnualPaymentMode(o.id)}
                      className={clsx(
                        'text-left rounded-xl border-2 px-3 py-2 transition-colors',
                        annualPaymentMode === o.id
                          ? 'border-brand-500 bg-brand-50'
                          : 'border-gray-200 bg-white hover:border-gray-300',
                      )}
                    >
                      <p className="text-sm font-semibold text-gray-800">{o.label}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">{o.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
              {/* 案場管理 */}
              {annualCustomerId && (
                <div className="space-y-3">
                  <label className="label">案場</label>
                  {annualSites.length > 0 && (
                    <div className="space-y-2">
                      {annualSites.map(s => {
                        const mode = s.billingMode || 'fixed'
                        const meta = BILLING_MODE_MAP[mode] || BILLING_MODE_MAP.fixed
                        return (
                          <div key={s.id} className="flex items-center gap-2 bg-brand-50 rounded-xl px-3 py-2 text-sm">
                            <MapPin size={13} className="text-brand-500 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="font-medium text-brand-700">{s.name}</p>
                                <span className="badge badge-gray text-[10px]">{meta.icon} {meta.label}</span>
                              </div>
                              {s.address && <p className="text-brand-400 text-xs truncate">{s.address}</p>}
                              {getSiteMonthlyBase(s) > 0 && <p className="text-brand-500 text-xs">${getSiteMonthlyBase(s).toLocaleString()} / 月</p>}
                            </div>
                            <button type="button" className="text-gray-400 hover:text-red-500 transition-colors shrink-0"
                              onClick={() => setAnnualSites(prev => prev.filter(x => x.id !== s.id))}>
                              <X size={14} />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  <div className="space-y-2 bg-gray-50 rounded-xl p-3 border border-dashed border-gray-200">
                    <select className="input" value={annualPickSiteId} onChange={e => setAnnualPickSiteId(e.target.value)}>
                      <option value="">選擇或新增案場…</option>
                      {annualCustomerSites.filter(s => !annualSites.some(a => a.id === s.id)).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      <option value="new">＋ 新增案場</option>
                    </select>
                    {annualPickSiteId && annualPickSiteId !== 'new' && (() => {
                      const site = annualCustomerSites.find(s => s.id === annualPickSiteId)
                      return site ? <div className="text-xs text-gray-500 px-1">{site.address}</div> : null
                    })()}
                    {annualPickSiteId === 'new' && (
                      <div className="space-y-2">
                        <input className="input" placeholder="案場名稱 *" value={annualNewSiteName} onChange={e => setAnnualNewSiteName(e.target.value)} />
                        <input className="input" placeholder="施工地址" value={annualNewSiteAddr} onChange={e => setAnnualNewSiteAddr(e.target.value)} />
                      </div>
                    )}
                    {annualPickSiteId && (
                      <>
                        <div>
                          <p className="text-[11px] text-gray-500 mb-1">案場計費模式</p>
                          <div className="grid grid-cols-2 gap-1.5">
                            {BILLING_MODES.map(m => (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => setAnnualPickBillingMode(m.id)}
                                className={clsx(
                                  'text-left rounded-lg border px-2.5 py-1.5 text-[11px] transition-colors',
                                  annualPickBillingMode === m.id
                                    ? 'border-brand-500 bg-white text-brand-700 font-semibold'
                                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300',
                                )}
                              >
                                {m.icon} {m.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {(annualPickBillingMode === 'fixed' || annualPickBillingMode === 'actual') ? (
                            <div className="relative flex-1">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                              <input className="input pl-6 text-sm" type="number" min="0" placeholder="月費（選填，可後續細拆明細）"
                                value={annualPickSiteId === 'new' ? annualNewMonthly : annualPickMonthly}
                                onChange={e => annualPickSiteId === 'new' ? setAnnualNewMonthly(e.target.value) : setAnnualPickMonthly(e.target.value)} />
                            </div>
                          ) : (
                            <p className="flex-1 text-[11px] text-gray-500 px-1">先建立案場，加入後到編輯頁設定派工計畫或每週排程</p>
                          )}
                          <button type="button" className="btn-primary shrink-0" onClick={addAnnualSite}
                            disabled={annualPickSiteId === 'new' && !annualNewSiteName.trim()}>加入</button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
              {/* 合約總額（案場下方，自動計算） */}
              <div>
                <label className="label">合約總額</label>
                {annualSites.length > 0 && annualStart && annualEnd && (() => {
                  const totalMonthly = getContractMonthlyTotal(annualSites)
                  const months = Math.max(1, Math.round((new Date(annualEnd) - new Date(annualStart)) / (1000 * 60 * 60 * 24 * 30.44)))
                  return totalMonthly > 0 ? (
                    <p className="text-xs text-gray-400 mb-1">
                      月固定合計 ${totalMonthly.toLocaleString()} × {months} 個月 = ${(totalMonthly * months).toLocaleString()}
                      <span className="ml-1 text-gray-300">（不含派工/週次型案場與週期任務）</span>
                    </p>
                  ) : null
                })()}
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input className="input pl-7" type="number" placeholder="自動計算或手動輸入" value={annualValue} onChange={e => setAnnualValue(e.target.value)} />
                </div>
              </div>

              {annualErr && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{annualErr}</p>}
            </div>
            )}

            <div className="flex justify-end gap-3 mt-6">
              <button className="btn-secondary" onClick={closeForm} disabled={saving || annualSaving}>取消</button>
              <button
                className="btn-primary"
                onClick={orderType === 'annual' ? handleSaveAnnual : handleSave}
                disabled={saving || annualSaving}
              >
                {(saving || annualSaving) ? '儲存中...' : orderType === 'annual' ? '建立合約' : '建立訂單'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
