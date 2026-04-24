import { useState } from 'react'
import {
  Plus, Package, Search, Truck, Tag, Pencil, Trash2,
  X, ChevronDown, ChevronRight, Zap,
} from 'lucide-react'
import { COST_ENGINE } from '../lib/mockData'
import {
  COL,
  addSupplier, updateSupplier, deleteSupplier,
  addInventoryItem, updateInventoryItem, deleteInventoryItem,
  addPurchase,
} from '../lib/db'
import { useCollection } from '../hooks/useCollection'
import { useOrg } from '../contexts/OrgContext'
import clsx from 'clsx'

const ITEM_CATEGORIES = [
  { id: 'consumable', name: '耗材'  },
  { id: 'chemical',   name: '化學品' },
  { id: 'tool',       name: '工具'  },
  { id: 'equipment',  name: '設備'  },
]
const CAT_LABEL = { consumable: '耗材', chemical: '化學品', tool: '工具', equipment: '設備' }

// ─── Supplier Modal ────────────────────────────────────────────────────────────
function SupplierModal({ supplier, orgId, onClose }) {
  const isEdit = !!supplier
  const [name,    setName]    = useState(supplier?.name    || '')
  const [contact, setContact] = useState(supplier?.contact || '')
  const [phone,   setPhone]   = useState(supplier?.phone   || '')
  const [email,   setEmail]   = useState(supplier?.email   || '')
  const [address, setAddress] = useState(supplier?.address || '')
  const [notes,   setNotes]   = useState(supplier?.notes   || '')
  const [saving,  setSaving]  = useState(false)
  const [err,     setErr]     = useState('')

  const handleSave = async () => {
    if (!name.trim()) { setErr('請填寫廠商名稱'); return }
    setSaving(true); setErr('')
    try {
      const data = {
        orgId,
        name: name.trim(), contact: contact.trim(),
        phone: phone.trim(), email: email.trim(),
        address: address.trim(), notes: notes.trim(),
      }
      if (isEdit) await updateSupplier(supplier.id, data)
      else        await addSupplier(data)
      onClose()
    } catch { setErr('儲存失敗，請稍後再試') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">{isEdit ? '編輯廠商' : '新增廠商'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="label">廠商名稱 *</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="例：台灣清潔用品有限公司" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">聯絡人</label>
              <input className="input" value={contact} onChange={e => setContact(e.target.value)} placeholder="王先生" />
            </div>
            <div>
              <label className="label">聯絡電話</label>
              <input className="input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="02-1234-5678" />
            </div>
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="supplier@example.com" />
          </div>
          <div>
            <label className="label">地址</label>
            <input className="input" value={address} onChange={e => setAddress(e.target.value)} placeholder="台北市..." />
          </div>
          <div>
            <label className="label">備註</label>
            <textarea className="input h-16 resize-none" value={notes} onChange={e => setNotes(e.target.value)} placeholder="付款條件、交貨說明..." />
          </div>
          {err && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</p>}
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button className="btn-secondary" onClick={onClose}>取消</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? '儲存中...' : isEdit ? '更新' : '新增廠商'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Item Modal ────────────────────────────────────────────────────────────────
function ItemModal({ item, orgId, onClose }) {
  const isEdit = !!item
  const [name,        setName]        = useState(item?.name        || '')
  const [unit,        setUnit]        = useState(item?.unit        || '')
  const [category,    setCategory]    = useState(item?.category    || 'consumable')
  const [description, setDescription] = useState(item?.description || '')
  const [saving,      setSaving]      = useState(false)
  const [err,         setErr]         = useState('')

  const handleSave = async () => {
    if (!name.trim()) { setErr('請填寫品名'); return }
    if (!unit.trim()) { setErr('請填寫單位'); return }
    setSaving(true); setErr('')
    try {
      const data = { orgId, name: name.trim(), unit: unit.trim(), category, description: description.trim() }
      if (isEdit) await updateInventoryItem(item.id, data)
      else        await addInventoryItem(data)
      onClose()
    } catch { setErr('儲存失敗，請稍後再試') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">{isEdit ? '編輯品項' : '新增品項'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="label">品名 *</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="例：地板清潔劑" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">單位 *</label>
              <input className="input" value={unit} onChange={e => setUnit(e.target.value)} placeholder="桶、瓶、包..." />
            </div>
            <div>
              <label className="label">分類</label>
              <select className="input" value={category} onChange={e => setCategory(e.target.value)}>
                {ITEM_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">說明</label>
            <input className="input" value={description} onChange={e => setDescription(e.target.value)} placeholder="規格、備注..." />
          </div>
          {err && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</p>}
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button className="btn-secondary" onClick={onClose}>取消</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? '儲存中...' : isEdit ? '更新' : '新增品項'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Purchase Card ─────────────────────────────────────────────────────────────
function PurchaseCard({ purchase }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="card overflow-hidden">
      <div
        className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center shrink-0">
          <Package size={16} className="text-green-700" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-gray-900">{purchase.supplierName}</p>
          <p className="text-xs text-gray-500">{purchase.date} · {(purchase.items || []).length} 項品目</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <p className="font-bold text-gray-900">${(purchase.totalAmount || 0).toLocaleString()}</p>
          {expanded
            ? <ChevronDown size={14} className="text-gray-400" />
            : <ChevronRight size={14} className="text-gray-400" />
          }
        </div>
      </div>
      {expanded && (
        <div className="border-t border-gray-100">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2 text-xs text-gray-500 font-medium">品名</th>
                <th className="text-right px-4 py-2 text-xs text-gray-500 font-medium">數量</th>
                <th className="text-right px-4 py-2 text-xs text-gray-500 font-medium">單價</th>
                <th className="text-right px-4 py-2 text-xs text-gray-500 font-medium">小計</th>
              </tr>
            </thead>
            <tbody>
              {(purchase.items || []).map((item, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="px-4 py-2.5">{item.name}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600">{item.qty} {item.unit}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600">${item.unitPrice?.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right font-medium">
                    ${(item.subtotal ?? item.qty * item.unitPrice).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Purchase Modal ────────────────────────────────────────────────────────────
function PurchaseModal({ suppliers, inventoryItems, orgId, annualContracts, onClose }) {
  const [supplierId,        setSupplierId]        = useState('')
  const [date,              setDate]              = useState(new Date().toISOString().slice(0, 10))
  const [lineItems,         setLineItems]         = useState([{ itemId: '', name: '', unit: '', qty: 1, unitPrice: 0 }])
  const [relatedContractId, setRelatedContractId] = useState('')
  const [relatedSiteName,   setRelatedSiteName]   = useState('')
  const [saving,     setSaving]     = useState(false)
  const [err,        setErr]        = useState('')

  const selectedContract = annualContracts.find(c => c.id === relatedContractId)
  const contractSites    = selectedContract?.sites || []

  const updateLine = (i, patch) =>
    setLineItems(prev => prev.map((it, idx) => idx === i ? { ...it, ...patch } : it))
  const addLine    = () =>
    setLineItems(prev => [...prev, { itemId: '', name: '', unit: '', qty: 1, unitPrice: 0 }])
  const removeLine = (i) =>
    setLineItems(prev => prev.filter((_, idx) => idx !== i))

  const totalAmount      = lineItems.reduce((s, it) => s + it.qty * it.unitPrice, 0)
  const selectedSupplier = suppliers.find(s => s.id === supplierId)

  const handleSave = async () => {
    if (!supplierId)   { setErr('請選擇供應商'); return }
    if (!date)         { setErr('請填寫進貨日期'); return }
    const valid = lineItems.filter(it => it.name && it.qty > 0)
    if (!valid.length) { setErr('請至少填寫一項品目'); return }
    setSaving(true); setErr('')
    try {
      await addPurchase({
        orgId,
        supplierId,
        supplierName: selectedSupplier?.name || '',
        date,
        items: valid.map(it => ({ ...it, subtotal: it.qty * it.unitPrice })),
        totalAmount,
        relatedContractId: relatedContractId || null,
        relatedSiteName:   relatedSiteName   || null,
      })
      onClose()
    } catch { setErr('儲存失敗，請稍後再試') }
    finally { setSaving(false) }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl p-6 my-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">新增進貨單</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">供應商 *</label>
              <select className="input" value={supplierId} onChange={e => setSupplierId(e.target.value)}>
                <option value="">請選擇供應商...</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">進貨日期 *</label>
              <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
          </div>

          {/* 關聯合約案場（選填） */}
          {annualContracts.length > 0 && (
            <div>
              <label className="label">關聯合約案場 <span className="text-gray-400 font-normal text-xs">（選填，用於成本分析）</span></label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  className="input"
                  value={relatedContractId}
                  onChange={e => { setRelatedContractId(e.target.value); setRelatedSiteName('') }}
                >
                  <option value="">不指定合約</option>
                  {annualContracts.map(c => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
                {relatedContractId && (
                  <select
                    className="input"
                    value={relatedSiteName}
                    onChange={e => setRelatedSiteName(e.target.value)}
                  >
                    <option value="">不指定案場</option>
                    {contractSites.map(s => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="label">進貨明細</label>
            <div className="grid grid-cols-12 gap-2 px-1">
              <div className="col-span-5 text-xs text-gray-400 font-medium">品名</div>
              <div className="col-span-2 text-xs text-gray-400 font-medium">數量</div>
              <div className="col-span-2 text-xs text-gray-400 font-medium">單價</div>
              <div className="col-span-2 text-xs text-gray-400 font-medium text-right">小計</div>
              <div className="col-span-1" />
            </div>

            {lineItems.map((item, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-5">
                  <select
                    className="input text-sm"
                    value={item.itemId || ''}
                    onChange={e => {
                      const sel = inventoryItems.find(it => it.id === e.target.value)
                      updateLine(i, { itemId: sel?.id || '', name: sel?.name || '', unit: sel?.unit || '' })
                    }}
                  >
                    <option value="">選擇品項...</option>
                    {inventoryItems.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
                  </select>
                </div>
                <div className="col-span-2 flex items-center gap-1">
                  <input
                    className="input text-sm min-w-0"
                    type="number" min="1"
                    value={item.qty}
                    onChange={e => updateLine(i, { qty: +e.target.value })}
                  />
                  <span className="text-xs text-gray-400 shrink-0 w-5">{item.unit}</span>
                </div>
                <div className="col-span-2">
                  <input
                    className="input text-sm"
                    type="number" min="0" placeholder="0"
                    value={item.unitPrice}
                    onChange={e => updateLine(i, { unitPrice: +e.target.value })}
                  />
                </div>
                <div className="col-span-2 text-sm text-right font-medium text-gray-700">
                  ${(item.qty * item.unitPrice).toLocaleString()}
                </div>
                <div className="col-span-1 flex justify-end">
                  {lineItems.length > 1 && (
                    <button onClick={() => removeLine(i)} className="text-gray-300 hover:text-red-400">
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
            <button className="btn-secondary text-xs" onClick={addLine}>
              <Plus size={12} /> 新增品目
            </button>
          </div>

          <div className="flex justify-between py-3 border-t border-gray-100">
            <span className="font-semibold text-gray-700">合計金額</span>
            <span className="font-bold text-brand-700 text-lg">${totalAmount.toLocaleString()}</span>
          </div>

          {err && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</p>}
        </div>

        <div className="flex justify-end gap-3 mt-4">
          <button className="btn-secondary" onClick={onClose}>取消</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? '儲存中...' : '儲存進貨單'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function InventoryPage() {
  const { activeOrgId } = useOrg()
  const [tab, setTab] = useState('purchases')

  const { data: suppliersRaw }       = useCollection(COL.SUPPLIERS)
  const { data: itemsRaw }           = useCollection(COL.INVENTORY_ITEMS)
  const { data: purchasesRaw }       = useCollection(COL.PURCHASES)
  const { data: annualContractsRaw } = useCollection(COL.ANNUAL_CONTRACTS)

  const suppliers      = suppliersRaw.filter(s => s.orgId === activeOrgId)
  const inventoryItems = itemsRaw.filter(i => i.orgId === activeOrgId)
  const annualContracts = annualContractsRaw
    .filter(c => c.orgId === activeOrgId && c.status === 'active')
    .sort((a, b) => (a.title || '').localeCompare(b.title || ''))
  const purchases      = purchasesRaw
    .filter(p => p.orgId === activeOrgId)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))

  const [showPurchaseForm, setShowPurchaseForm] = useState(false)
  const [editingSupplier,  setEditingSupplier]  = useState(null)  // null=closed, false=new, obj=edit
  const [editingItem,      setEditingItem]      = useState(null)
  const [search,           setSearch]           = useState('')

  const TABS = [
    { key: 'purchases', label: '進貨紀錄', icon: Package, count: purchases.length      },
    { key: 'suppliers', label: '廠商管理', icon: Truck,   count: suppliers.length      },
    { key: 'items',     label: '品項字典', icon: Tag,     count: inventoryItems.length },
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-5">

      {/* Cost Engine Banner */}
      <div className="card p-5 bg-gradient-to-r from-brand-600 to-brand-700 text-white border-0">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Zap size={16} />
              <span className="text-sm font-semibold">動態成本引擎</span>
            </div>
            <p className="text-2xl font-bold">
              ${COST_ENGINE.costPerSqm.toFixed(2)}
              <span className="text-base font-normal opacity-80"> / ㎡</span>
            </p>
            <p className="text-xs opacity-70 mt-1">基準成本自動更新於每次進貨後</p>
          </div>
          <div className="text-right text-sm space-y-1">
            <p className="opacity-70">計算週期</p>
            <p className="font-medium">{COST_ENGINE.periodStart} ~ {COST_ENGINE.periodEnd}</p>
            <p className="opacity-70">週期進貨總額</p>
            <p className="font-medium">${COST_ENGINE.totalPurchaseAmount.toLocaleString()}</p>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-white/20 text-xs opacity-70">
          公式：週期進貨總額 ÷ 週期服務坪數 = 每坪基準成本
        </div>
      </div>

      {/* Tabs + action button */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
          {TABS.map(({ key, label, icon: Icon, count }) => (
            <button
              key={key}
              onClick={() => { setTab(key); setSearch('') }}
              className={clsx(
                'flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors',
                tab === key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700',
              )}
            >
              <Icon size={14} />
              {label}
              <span className="text-xs text-gray-400">({count})</span>
            </button>
          ))}
        </div>

        {tab === 'purchases' && (
          <button className="btn-primary" onClick={() => setShowPurchaseForm(true)}>
            <Plus size={16} /> 新增進貨單
          </button>
        )}
        {tab === 'suppliers' && (
          <button className="btn-primary" onClick={() => setEditingSupplier(false)}>
            <Plus size={16} /> 新增廠商
          </button>
        )}
        {tab === 'items' && (
          <button className="btn-primary" onClick={() => setEditingItem(false)}>
            <Plus size={16} /> 新增品項
          </button>
        )}
      </div>

      {/* ── 進貨紀錄 ── */}
      {tab === 'purchases' && (
        <div className="space-y-3">
          {purchases.length === 0 ? (
            <div className="card p-12 text-center text-gray-400">
              <Package size={36} className="mx-auto mb-3 opacity-30" />
              <p>尚無進貨紀錄</p>
            </div>
          ) : (
            purchases.map(p => <PurchaseCard key={p.id} purchase={p} />)
          )}
        </div>
      )}

      {/* ── 廠商管理 ── */}
      {tab === 'suppliers' && (
        <div className="space-y-3">
          {suppliers.length === 0 ? (
            <div className="card p-12 text-center text-gray-400">
              <Truck size={36} className="mx-auto mb-3 opacity-30" />
              <p>尚無廠商資料</p>
            </div>
          ) : (
            <div className="card divide-y divide-gray-100">
              {suppliers.map(s => (
                <div key={s.id} className="flex items-center gap-4 px-4 py-3.5 hover:bg-gray-50 transition-colors">
                  <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                    <Truck size={16} className="text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-900">{s.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {[s.contact, s.phone, s.email].filter(Boolean).join(' · ') || '—'}
                    </p>
                    {s.notes && <p className="text-xs text-gray-400 mt-0.5 truncate">{s.notes}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setEditingSupplier(s)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-gray-100 transition-colors"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={async () => {
                        if (confirm(`確定刪除「${s.name}」？`)) await deleteSupplier(s.id)
                      }}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 品項字典 ── */}
      {tab === 'items' && (
        <div className="space-y-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-9"
              placeholder="搜尋品名..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          {inventoryItems.length === 0 ? (
            <div className="card p-12 text-center text-gray-400">
              <Tag size={36} className="mx-auto mb-3 opacity-30" />
              <p>尚無品項資料</p>
            </div>
          ) : (
            <div className="card divide-y divide-gray-100">
              {inventoryItems
                .filter(i => !search || (i.name || '').includes(search))
                .map(item => (
                  <div key={item.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                    <Package size={14} className="text-gray-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">{item.name}</p>
                      {item.description && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{item.description}</p>
                      )}
                    </div>
                    <span className="badge badge-gray">{item.unit}</span>
                    {item.category && (
                      <span className="badge badge-blue text-xs">{CAT_LABEL[item.category] || item.category}</span>
                    )}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => setEditingItem(item)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-gray-100 transition-colors"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={async () => {
                          if (confirm(`確定刪除「${item.name}」？`)) await deleteInventoryItem(item.id)
                        }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              }
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showPurchaseForm && (
        <PurchaseModal
          suppliers={suppliers}
          inventoryItems={inventoryItems}
          orgId={activeOrgId}
          annualContracts={annualContracts}
          onClose={() => setShowPurchaseForm(false)}
        />
      )}
      {editingSupplier !== null && (
        <SupplierModal
          supplier={editingSupplier || null}
          orgId={activeOrgId}
          onClose={() => setEditingSupplier(null)}
        />
      )}
      {editingItem !== null && (
        <ItemModal
          item={editingItem || null}
          orgId={activeOrgId}
          onClose={() => setEditingItem(null)}
        />
      )}
    </div>
  )
}
