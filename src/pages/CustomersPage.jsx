import { useState, useMemo } from 'react'
import { Plus, Search, MapPin, Phone, Mail, ChevronDown, ChevronRight, Landmark, Building2, Users, RefreshCcw, Pen, Clock, X, Pencil } from 'lucide-react'
import { COL, addCustomer, updateCustomer } from '../lib/db'
import { useCollection } from '../hooks/useCollection'
import { useOrg } from '../contexts/OrgContext'
import clsx from 'clsx'

// ─── Category config ──────────────────────────────────────────────────────────
const CATEGORY = {
  gov: {
    label: '政府機關',
    icon: Landmark,
    badge: 'bg-blue-100 text-blue-700',
    iconBg: 'bg-blue-50', iconText: 'text-blue-600',
    border: 'border-blue-200',
  },
  stationed: {
    label: '駐點',
    icon: MapPin,
    badge: 'bg-teal-100 text-teal-700',
    iconBg: 'bg-teal-50', iconText: 'text-teal-600',
    border: 'border-teal-200',
  },
  regular: {
    label: '固定',
    icon: RefreshCcw,
    badge: 'bg-green-100 text-green-700',
    iconBg: 'bg-green-50', iconText: 'text-green-600',
    border: 'border-green-200',
  },
  designer: {
    label: '設計師',
    icon: Pen,
    badge: 'bg-purple-100 text-purple-700',
    iconBg: 'bg-purple-50', iconText: 'text-purple-600',
    border: 'border-purple-200',
  },
  peer: {
    label: '同行',
    icon: Users,
    badge: 'bg-gray-100 text-gray-600',
    iconBg: 'bg-gray-50', iconText: 'text-gray-500',
    border: 'border-gray-200',
  },
  temporary: {
    label: '臨時',
    icon: Clock,
    badge: 'bg-amber-100 text-amber-700',
    iconBg: 'bg-amber-50', iconText: 'text-amber-600',
    border: 'border-amber-200',
  },
}

const CATEGORY_ORDER = ['gov', 'stationed', 'regular', 'designer', 'peer', 'temporary']

// ─── Site row ─────────────────────────────────────────────────────────────────
function SiteRow({ site }) {
  // 防呆：所有數值都先轉 Number 並落到 0，避免 NaN
  const lat  = Number(site.lat)  || 0
  const lng  = Number(site.lng)  || 0
  const area = Number(site.area) || 0
  const hasGeo = lat !== 0 || lng !== 0 || area !== 0
  return (
    <div className="flex items-start gap-3 py-2.5 pl-8 pr-4 border-t border-gray-100 bg-gray-50">
      <MapPin size={14} className="text-brand-500 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-700">{site.name}</p>
        {site.address && <p className="text-xs text-gray-500 truncate">{site.address}</p>}
        {hasGeo && (
          <p className="text-xs text-gray-400">
            GPS: {lat.toFixed(4)}, {lng.toFixed(4)} · {area} ㎡
          </p>
        )}
        {site.contractTitle && (
          <p className="text-[11px] text-gray-400 mt-0.5">來自合約：{site.contractTitle}</p>
        )}
      </div>
    </div>
  )
}

// ─── Order row（單次案件 ── for 設計師/同行/臨時等）─────────────────────────
function OrderRow({ order }) {
  return (
    <div className="flex items-start gap-3 py-2.5 pl-8 pr-4 border-t border-gray-100 bg-gray-50">
      <Building2 size={14} className="text-purple-500 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-700">{order.title || order.siteName || '單次案件'}</p>
        {order.siteAddress && <p className="text-xs text-gray-500 truncate">{order.siteAddress}</p>}
        <p className="text-[11px] text-gray-400 mt-0.5">
          {order.contractStart || ''}{order.contractEnd ? ` ~ ${order.contractEnd}` : ''}
          {order.totalPrice > 0 && ` · $${Number(order.totalPrice).toLocaleString()}`}
        </p>
      </div>
    </div>
  )
}

// ─── Customer card ────────────────────────────────────────────────────────────
function CustomerCard({ customer, sites = [], orders = [], onEdit }) {
  const [expanded, setExpanded] = useState(false)
  const cat = CATEGORY[customer.category] || CATEGORY.regular
  const CatIcon = cat.icon
  const siteCount  = sites.length
  const orderCount = orders.length

  // badge 文案：案場 + 案件（兩者都有就都顯示，都 0 就顯示「0 個」）
  const badge = siteCount > 0 && orderCount > 0
    ? `${siteCount} 案場 · ${orderCount} 案件`
    : siteCount > 0
      ? `${siteCount} 個案場`
      : orderCount > 0
        ? `${orderCount} 個案件`
        : '尚無案場/案件'

  return (
    <div className="card overflow-hidden">
      <div
        className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', cat.iconBg)}>
          <CatIcon size={18} className={cat.iconText} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="font-semibold text-gray-900">{customer.name}</p>
            <span className={clsx('text-[10px] font-semibold px-1.5 py-0.5 rounded-full', cat.badge)}>
              {cat.label}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <Phone size={11} />{customer.phone}
            </span>
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <Mail size={11} />{customer.email}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="badge badge-blue">{badge}</span>
          <button
            className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors text-gray-400 hover:text-gray-600"
            onClick={e => { e.stopPropagation(); onEdit(customer) }}
          >
            <Pencil size={14} />
          </button>
          {expanded
            ? <ChevronDown size={16} className="text-gray-400" />
            : <ChevronRight size={16} className="text-gray-400" />
          }
        </div>
      </div>

      {expanded && siteCount === 0 && orderCount === 0 && (
        <div className="px-8 py-3 text-xs text-gray-400 bg-gray-50 border-t border-gray-100">
          尚無案場/案件（建立年度合約或單次訂單後自動顯示）
        </div>
      )}
      {expanded && sites.map(site => (
        <SiteRow key={`s-${site.contractId || 'c'}-${site.id}`} site={site} />
      ))}
      {expanded && orders.map(order => (
        <OrderRow key={`o-${order.id}`} order={order} />
      ))}
    </div>
  )
}

// ─── Category section ─────────────────────────────────────────────────────────
function CategorySection({ categoryKey, customers, sitesByCustomer, ordersByCustomer, onEdit }) {
  const cat = CATEGORY[categoryKey]
  if (!cat || customers.length === 0) return null
  const CatIcon = cat.icon
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className={clsx('p-1.5 rounded-lg', cat.iconBg)}>
          <CatIcon size={14} className={cat.iconText} />
        </div>
        <h3 className="text-sm font-bold text-gray-700">{cat.label}</h3>
        <span className={clsx('text-[11px] font-semibold px-2 py-0.5 rounded-full', cat.badge)}>
          {customers.length} 家
        </span>
        <div className="flex-1 h-px bg-gray-200 ml-1" />
      </div>
      {customers.map(c => (
        <CustomerCard
          key={c.id}
          customer={c}
          sites={sitesByCustomer[c.id] || []}
          orders={ordersByCustomer[c.id] || []}
          onEdit={onEdit}
        />
      ))}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function CustomersPage() {
  const { activeOrgId } = useOrg()
  const [search, setSearch]       = useState('')
  const [filterCat, setFilterCat] = useState('all')
  const [showForm, setShowForm]   = useState(false)
  const [editing, setEditing]     = useState(null)
  const [form, setForm]           = useState({ name: '', category: 'gov', contact: '', phone: '', email: '', taxId: '', fax: '' })
  const [saving, setSaving]       = useState(false)
  const [err, setErr]             = useState('')

  const { data: customers }       = useCollection(COL.CUSTOMERS)
  const { data: annualContracts } = useCollection(COL.ANNUAL_CONTRACTS)
  const { data: orders }          = useCollection(COL.ORDERS)

  // 案場以「合約」為單一真實來源，只統計「進行中」的合約（已結束/已取消歸歷史頁）
  const sitesByCustomer = useMemo(() => {
    const map = {}
    annualContracts.forEach(c => {
      if (!c.customerId) return
      const status = c.status || 'active'
      // 排除已結束 / 已完成 / 已取消
      if (status === 'ended' || status === 'completed' || status === 'cancelled') return
      const arr = map[c.customerId] || []
      const seenNames = new Set(arr.map(s => s.name))
      ;(c.sites || []).forEach(s => {
        if (!s.name || seenNames.has(s.name)) return
        arr.push({ ...s, contractId: c.id, contractTitle: c.title })
        seenNames.add(s.name)
      })
      map[c.customerId] = arr
    })
    return map
  }, [annualContracts])

  // 單次案件（訂單）依 customerId 聚合，只統計「未完成」的訂單
  const ordersByCustomer = useMemo(() => {
    const map = {}
    orders.forEach(o => {
      if (!o.customerId) return
      // 排除已完成訂單（closed）— 已收尾結案的不算
      if (o.status === 'closed') return
      const arr = map[o.customerId] || []
      arr.push(o)
      map[o.customerId] = arr
    })
    return map
  }, [orders])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const openEdit = (customer) => {
    setEditing(customer)
    setForm({ name: customer.name || '', category: customer.category || 'gov', contact: customer.contact || '', phone: customer.phone || '', email: customer.email || '', taxId: customer.taxId || '', fax: customer.fax || '' })
    setErr('')
  }

  const closeEdit = () => { setEditing(null); setErr('') }

  const handleSave = async () => {
    if (!form.name.trim()) { setErr('請填寫客戶名稱'); return }
    setSaving(true)
    setErr('')
    try {
      await addCustomer({
        orgId:    activeOrgId,
        name:     form.name.trim(),
        category: form.category,
        contact:  form.contact.trim(),
        phone:    form.phone.trim(),
        email:    form.email.trim(),
        taxId:    form.taxId.trim(),
        fax:      form.fax.trim(),
        sites:    [],
      })
      setShowForm(false)
      setForm({ name: '', category: 'gov', contact: '', phone: '', email: '', taxId: '', fax: '' })
    } catch (e) {
      setErr('儲存失敗，請稍後再試')
      setSaving(false)
    }
  }

  const handleUpdate = async () => {
    if (!form.name.trim()) { setErr('請填寫客戶名稱'); return }
    setSaving(true)
    setErr('')
    try {
      await updateCustomer(editing.id, {
        name:     form.name.trim(),
        category: form.category,
        contact:  form.contact.trim(),
        phone:    form.phone.trim(),
        email:    form.email.trim(),
        taxId:    form.taxId.trim(),
        fax:      form.fax.trim(),
      })
      closeEdit()
    } catch (e) {
      setErr('儲存失敗，請稍後再試')
    } finally {
      setSaving(false)
    }
  }

  const allCustomers = customers
    .filter(c => c.orgId === activeOrgId)
    .filter(c => c.name?.includes(search) || c.contact?.includes(search))
    .filter(c => filterCat === 'all' || c.category === filterCat)

  const totalSites  = allCustomers.reduce((s, c) => s + (sitesByCustomer[c.id]?.length  || 0), 0)
  const totalOrders = allCustomers.reduce((s, c) => s + (ordersByCustomer[c.id]?.length || 0), 0)

  // Count per category (from unfiltered org list, for tab badges)
  const orgCustomers = customers.filter(c => c.orgId === activeOrgId)
  const countOf = (key) => orgCustomers.filter(c => c.category === key).length

  const filterTabs = [
    { key: 'all', label: '全部', count: orgCustomers.length },
    ...CATEGORY_ORDER.map(key => ({ key, label: CATEGORY[key].label, count: countOf(key) })).filter(t => t.count > 0),
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="搜尋客戶名稱或聯絡人..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <Plus size={16} /> 新增客戶
        </button>
      </div>

      {/* Category filter tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {filterTabs.map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setFilterCat(key)}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              filterCat === key
                ? 'bg-brand-600 text-white shadow-sm'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300',
            )}
          >
            {key !== 'all' && (() => {
              const Icon = CATEGORY[key]?.icon
              return Icon ? <Icon size={13} /> : null
            })()}
            {label}
            <span className={clsx(
              'text-[11px] font-bold px-1.5 py-0.5 rounded-full',
              filterCat === key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500',
            )}>
              {count}
            </span>
          </button>
        ))}
        <span className="ml-auto text-sm text-gray-400">
          合計 <strong className="text-gray-700">{totalSites}</strong> 案場 · <strong className="text-gray-700">{totalOrders}</strong> 案件
        </span>
      </div>

      {/* Customer list */}
      {allCustomers.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <Building2 size={36} className="mx-auto mb-3 opacity-30" />
          <p>尚無符合條件的客戶</p>
        </div>
      ) : filterCat === 'all' ? (
        <div className="space-y-6">
          {CATEGORY_ORDER.map(key => (
            <CategorySection
              key={key}
              categoryKey={key}
              customers={allCustomers.filter(c => c.category === key)}
              sitesByCustomer={sitesByCustomer}
              ordersByCustomer={ordersByCustomer}
              onEdit={openEdit}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {allCustomers.map(c => (
            <CustomerCard
              key={c.id}
              customer={c}
              sites={sitesByCustomer[c.id] || []}
              orders={ordersByCustomer[c.id] || []}
              onEdit={openEdit}
            />
          ))}
        </div>
      )}

      {/* Add Customer Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-bold text-gray-900">新增客戶</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-gray-400 mb-5">案場資料於建立訂單合約時填入</p>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">客戶名稱 *</label>
                  <input className="input" placeholder="台北市政府" value={form.name} onChange={e => set('name', e.target.value)} />
                </div>
                <div>
                  <label className="label">客戶類別 *</label>
                  <select className="input" value={form.category} onChange={e => set('category', e.target.value)}>
                    {CATEGORY_ORDER.map(key => (
                      <option key={key} value={key}>{CATEGORY[key].label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">聯絡人</label>
                  <input className="input" placeholder="林秘書" value={form.contact} onChange={e => set('contact', e.target.value)} />
                </div>
                <div>
                  <label className="label">聯絡電話</label>
                  <input className="input" placeholder="02-2720-8889" value={form.phone} onChange={e => set('phone', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">統一編號</label>
                  <input className="input" placeholder="12345678" value={form.taxId} onChange={e => set('taxId', e.target.value)} />
                </div>
                <div>
                  <label className="label">傳真</label>
                  <input className="input" placeholder="02-2720-8890" value={form.fax} onChange={e => set('fax', e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label">電子信箱</label>
                <input className="input" type="email" placeholder="contact@example.com" value={form.email} onChange={e => set('email', e.target.value)} />
              </div>
              {err && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</p>}
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button className="btn-secondary" onClick={() => setShowForm(false)} disabled={saving}>取消</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving || !form.name.trim()}>
                {saving ? '儲存中...' : '儲存客戶'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Customer Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={closeEdit}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-bold text-gray-900">編輯客戶</h2>
              <button onClick={closeEdit} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-gray-400 mb-5">修改客戶基本資料</p>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">客戶名稱 *</label>
                  <input className="input" value={form.name} onChange={e => set('name', e.target.value)} />
                </div>
                <div>
                  <label className="label">客戶類別 *</label>
                  <select className="input" value={form.category} onChange={e => set('category', e.target.value)}>
                    {CATEGORY_ORDER.map(key => (
                      <option key={key} value={key}>{CATEGORY[key].label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">聯絡人</label>
                  <input className="input" value={form.contact} onChange={e => set('contact', e.target.value)} />
                </div>
                <div>
                  <label className="label">聯絡電話</label>
                  <input className="input" value={form.phone} onChange={e => set('phone', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">統一編號</label>
                  <input className="input" placeholder="12345678" value={form.taxId} onChange={e => set('taxId', e.target.value)} />
                </div>
                <div>
                  <label className="label">傳真</label>
                  <input className="input" placeholder="02-2720-8890" value={form.fax} onChange={e => set('fax', e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label">電子信箱</label>
                <input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} />
              </div>
              {err && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</p>}
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button className="btn-secondary" onClick={closeEdit} disabled={saving}>取消</button>
              <button className="btn-primary" onClick={handleUpdate} disabled={saving || !form.name.trim()}>
                {saving ? '儲存中...' : '儲存變更'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
