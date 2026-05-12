import { useMemo, useState } from 'react'
import { Archive, MapPin, Building2, Calendar, DollarSign, Search, ChevronDown, ChevronUp } from 'lucide-react'
import { COL } from '../lib/db'
import { useCollection } from '../hooks/useCollection'
import { useOrg } from '../contexts/OrgContext'
import { getSiteMonthlyBase, getContractMonthlyTotal } from '../utils/contractSchema'
import clsx from 'clsx'

const CLEAN_TYPE_LABEL = {
  stationed: '駐點清潔',
  rough:     '裝潢粗清',
  fine:      '裝潢細清',
  disinfect: '環境消毒',
  other:     '其他',
}

function fmt(n) { return `$${(n || 0).toLocaleString()}` }

// ─── Order history card ───────────────────────────────────────────────────────
function OrderCard({ order, customers }) {
  const [open, setOpen] = useState(false)
  const customer = customers.find(c => c.id === order.customerId)

  return (
    <div className="card overflow-hidden">
      <div
        className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="w-2 h-2 rounded-full bg-gray-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-gray-900">{order.siteName || order.title || '—'}</span>
            <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-medium">
              {CLEAN_TYPE_LABEL[order.type] || order.typeCustom || order.type || '—'}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
            <Building2 size={10} />{customer?.name || order.customerName || '—'}
            {order.siteAddress && <><span className="text-gray-300 mx-1">·</span><MapPin size={10} />{order.siteAddress}</>}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-base font-bold text-gray-700">{fmt(order.totalPrice)}</p>
          {(order.contractStart || order.contractEnd) && (
            <p className="text-xs text-gray-400 mt-0.5">
              {order.contractStart} {order.contractEnd ? `~ ${order.contractEnd}` : ''}
            </p>
          )}
        </div>
        {open ? <ChevronUp size={15} className="text-gray-400 shrink-0" /> : <ChevronDown size={15} className="text-gray-400 shrink-0" />}
      </div>

      {open && (
        <div className="border-t border-gray-100 px-5 py-4 bg-gray-50 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          {[
            { label: '客戶',     value: customer?.name || order.customerName || '—' },
            { label: '案場',     value: order.siteName || '—' },
            { label: '施工地址', value: order.siteAddress || '—' },
            { label: '清潔類型', value: CLEAN_TYPE_LABEL[order.type] || order.typeCustom || '—' },
            { label: '訂單總價', value: fmt(order.totalPrice) },
            { label: '合約期間', value: order.contractStart ? `${order.contractStart} ~ ${order.contractEnd || ''}` : '—' },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-xs text-gray-400 mb-0.5">{label}</p>
              <p className="font-medium text-gray-800">{value}</p>
            </div>
          ))}
          {order.notes && (
            <div className="col-span-full">
              <p className="text-xs text-gray-400 mb-0.5">備註</p>
              <p className="text-gray-600">{order.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Annual contract history card ─────────────────────────────────────────────
function ContractCard({ contract, customers }) {
  const [open, setOpen] = useState(false)
  const customer = customers.find(c => c.id === contract.customerId)
  const totalAnnual = getContractMonthlyTotal(contract.sites || []) * 12

  return (
    <div className="card overflow-hidden">
      <div
        className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="w-2 h-2 rounded-full bg-purple-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-gray-900">{contract.title || '年度合約'}</span>
            <span className="text-[10px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded-full font-medium">年度合約</span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
            <Building2 size={10} />{customer?.name || contract.customerName || '—'}
            <span className="text-gray-300 mx-1">·</span>
            <Calendar size={10} />{contract.startDate} ~ {contract.endDate}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-base font-bold text-gray-700">{fmt(totalAnnual)}</p>
          <p className="text-xs text-gray-400 mt-0.5">年度總額</p>
        </div>
        {open ? <ChevronUp size={15} className="text-gray-400 shrink-0" /> : <ChevronDown size={15} className="text-gray-400 shrink-0" />}
      </div>

      {open && (
        <div className="border-t border-gray-100 px-5 py-4 bg-gray-50 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            {[
              { label: '客戶',     value: customer?.name || contract.customerName || '—' },
              { label: '合約名稱', value: contract.title || '—' },
              { label: '合約期間', value: `${contract.startDate} ~ ${contract.endDate}` },
              { label: '案場數',   value: `${(contract.sites || []).length} 個` },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                <p className="font-medium text-gray-800">{value}</p>
              </div>
            ))}
          </div>
          {(contract.sites || []).length > 0 && (
            <div>
              <p className="text-xs text-gray-400 mb-1.5">案場清單</p>
              <div className="space-y-1">
                {contract.sites.map(s => (
                  <div key={s.id} className="flex items-center justify-between text-sm bg-white rounded-lg px-3 py-2">
                    <span className="text-gray-700">{s.name}</span>
                    <span className="text-gray-400 text-xs">月費 {fmt(getSiteMonthlyBase(s))}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function HistoryPage() {
  const { activeOrgId } = useOrg()
  const { data: ordersRaw }          = useCollection(COL.ORDERS)
  const { data: contractsRaw }       = useCollection(COL.ANNUAL_CONTRACTS)
  const { data: customersRaw }       = useCollection(COL.CUSTOMERS)
  const [search, setSearch]          = useState('')
  const [tab, setTab]                = useState('orders')

  const customers = customersRaw.filter(c => c.orgId === activeOrgId)

  const closedOrders = useMemo(() =>
    ordersRaw
      .filter(o => o.orgId === activeOrgId && o.status === 'closed')
      .filter(o => !search || (o.siteName || o.title || '').includes(search) || (o.customerName || '').includes(search))
      .sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0)),
    [ordersRaw, activeOrgId, search]
  )

  const endedContracts = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return contractsRaw
      .filter(c => c.orgId === activeOrgId && (c.status === 'ended' || (c.endDate && c.endDate < today)))
      .filter(c => !search || (c.title || '').includes(search) || (c.customerName || '').includes(search))
      .sort((a, b) => (b.endDate || '').localeCompare(a.endDate || ''))
  }, [contractsRaw, activeOrgId, search])

  const totalValue = closedOrders.reduce((s, o) => s + (o.totalPrice || 0), 0)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">歷史訂單 &amp; 合約</h1>
        <p className="text-sm text-gray-500 mt-0.5">已完成的單次訂單與結束的年度合約</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: '歷史訂單',   value: closedOrders.length,    color: 'text-gray-700'   },
          { label: '歷史合約',   value: endedContracts.length,  color: 'text-purple-700' },
          { label: '訂單總金額', value: fmt(totalValue),        color: 'text-brand-700'  },
        ].map(({ label, value, color }) => (
          <div key={label} className="card p-4 text-center">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-sm text-gray-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Search + Tab */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-8 text-sm"
            placeholder="搜尋客戶、案場名稱…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
          {[
            { key: 'orders',    label: `訂單（${closedOrders.length}）`   },
            { key: 'contracts', label: `合約（${endedContracts.length}）` },
          ].map(({ key, label }) => (
            <button key={key} onClick={() => setTab(key)}
              className={clsx('px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                tab === key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              )}
            >{label}</button>
          ))}
        </div>
      </div>

      {/* List */}
      {tab === 'orders' && (
        closedOrders.length === 0 ? (
          <div className="card p-16 text-center">
            <Archive size={40} className="mx-auto mb-3 text-gray-200" />
            <p className="text-gray-400">尚無歷史訂單</p>
            <p className="text-xs text-gray-300 mt-1">在訂單詳情頁點「完成訂單」後會顯示在此</p>
          </div>
        ) : (
          <div className="space-y-3">
            {closedOrders.map(o => (
              <OrderCard key={o.id} order={o} customers={customers} />
            ))}
          </div>
        )
      )}

      {tab === 'contracts' && (
        endedContracts.length === 0 ? (
          <div className="card p-16 text-center">
            <Archive size={40} className="mx-auto mb-3 text-gray-200" />
            <p className="text-gray-400">尚無歷史合約</p>
            <p className="text-xs text-gray-300 mt-1">合約到期後會自動出現在此</p>
          </div>
        ) : (
          <div className="space-y-3">
            {endedContracts.map(c => (
              <ContractCard key={c.id} contract={c} customers={customers} />
            ))}
          </div>
        )
      )}
    </div>
  )
}
