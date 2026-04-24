import { useState, useMemo } from 'react'
import {
  DollarSign, AlertTriangle, CheckCircle, Clock,
  ChevronDown, Send, Check, Ban, X,
  Building2, Landmark, MapPin,
} from 'lucide-react'
import { COL, updateInvoice, updateOrder } from '../lib/db'
import { useCollection } from '../hooks/useCollection'
import { useOrg } from '../contexts/OrgContext'
import clsx from 'clsx'

// ─── Constants ────────────────────────────────────────────────────────────────
const STATUS = {
  invoiced:     { label: '已請款',   badge: 'bg-blue-100 text-blue-700',   dot: 'bg-blue-400',   icon: Send          },
  paid:         { label: '已收款',   badge: 'bg-green-100 text-green-700', dot: 'bg-green-500',  icon: Check         },
  overdue:      { label: '逾期未收', badge: 'bg-red-100 text-red-700',     dot: 'bg-red-500',    icon: AlertTriangle },
  written_off:  { label: '已註銷',   badge: 'bg-gray-100 text-gray-500',   dot: 'bg-gray-300',   icon: Ban           },
}

const CUSTOMER_CAT = {
  gov:     { label: '公家機關', badge: 'bg-blue-50 text-blue-600',    icon: Landmark  },
  private: { label: '一般企業', badge: 'bg-purple-50 text-purple-600', icon: Building2 },
}

function fmt(n) { return `$${(n || 0).toLocaleString()}` }

function daysFrom(dateStr) {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000)
}

// derive overdue status at render time
function resolveStatus(record) {
  if (record.status === 'paid')         return 'paid'
  if (record.status === 'written_off')  return 'written_off'
  const days = daysFrom(record.dueDate)
  if (days !== null && days < 0) return 'overdue'
  return 'invoiced'
}

// ─── Write-off confirm modal ──────────────────────────────────────────────────
function WriteOffModal({ record, onConfirm, onClose }) {
  const [reason, setReason] = useState('')
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Ban size={16} className="text-gray-400" /> 確認註銷帳款
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="bg-gray-50 rounded-xl px-4 py-3 mb-4 text-sm">
          <p className="font-medium text-gray-800">{record.customerName}</p>
          <p className="text-gray-500 mt-0.5">請款單號 {record.invoiceNo || '—'} · 金額 ${(record.totalAmount || 0).toLocaleString()}</p>
        </div>
        <p className="text-sm text-gray-500 mb-3">此帳款將被標記為「已註銷（壞帳）」，不再列入待收統計。</p>
        <div className="mb-5">
          <label className="label">註銷原因（選填）</label>
          <textarea
            className="input resize-none text-sm"
            rows={2}
            placeholder="例：客戶倒閉、糾紛和解、金額過小放棄追討…"
            value={reason}
            onChange={e => setReason(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-3">
          <button className="btn-secondary" onClick={onClose}>取消</button>
          <button
            className="btn-primary bg-gray-600 hover:bg-gray-700 border-gray-600"
            onClick={() => onConfirm(record.id, reason)}
          >
            <Ban size={14} /> 確認註銷
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color, icon: Icon }) {
  const colors = {
    red:   { bg: 'bg-red-50',   text: 'text-red-600',   val: 'text-red-700'   },
    amber: { bg: 'bg-amber-50', text: 'text-amber-600', val: 'text-amber-700' },
    green: { bg: 'bg-green-50', text: 'text-green-600', val: 'text-green-700' },
    blue:  { bg: 'bg-blue-50',  text: 'text-blue-600',  val: 'text-blue-700'  },
    gray:  { bg: 'bg-gray-100', text: 'text-gray-500',  val: 'text-gray-700'  },
  }
  const c = colors[color] || colors.blue
  return (
    <div className="card p-5 flex items-start gap-4">
      <div className={clsx('p-2.5 rounded-xl shrink-0', c.bg)}>
        <Icon size={20} className={c.text} />
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className={clsx('text-2xl font-bold mt-0.5', c.val)}>{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ─── AR Row ───────────────────────────────────────────────────────────────────
function ARRow({ record, customers, onMarkPaid, onWriteOff }) {
  const [expanded, setExpanded] = useState(false)
  const status = resolveStatus(record)
  const sc     = STATUS[status] || STATUS.invoiced
  const Icon   = sc.icon
  const customer = customers.find(c => c.id === record.customerId)
  const cat    = CUSTOMER_CAT[customer?.category] || CUSTOMER_CAT.private
  const CatIcon = cat.icon
  const days   = daysFrom(record.dueDate)

  const daysLabel = (() => {
    if (status === 'paid')                return null
    if (days === null)                    return null
    if (days < 0)  return { text: `逾期 ${Math.abs(days)} 天`, cls: 'text-red-500 font-semibold' }
    if (days === 0) return { text: '今日到期',                  cls: 'text-red-500 font-semibold' }
    if (days <= 7)  return { text: `${days} 天後到期`,          cls: 'text-amber-500 font-semibold' }
    return { text: `${days} 天後到期`, cls: 'text-gray-400' }
  })()

  return (
    <div className={clsx('card overflow-hidden transition-shadow',
      status === 'overdue'     && 'ring-1 ring-red-200',
      status === 'written_off' && 'opacity-60',
    )}>
      <div
        className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className={clsx('w-2.5 h-2.5 rounded-full shrink-0', sc.dot)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-gray-900">{record.customerName}</span>
            <span className={clsx('text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex items-center gap-1', cat.badge)}>
              <CatIcon size={9} />{cat.label}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1 flex-wrap">
            {record.siteName && <><MapPin size={10} />{record.siteName}<span className="text-gray-300 mx-1">·</span></>}
            <span>請款單號 {record.invoiceNo || '—'}</span>
          </p>
        </div>
        {daysLabel && (
          <span className={clsx('text-xs shrink-0 hidden sm:block', daysLabel.cls)}>{daysLabel.text}</span>
        )}
        <span className={clsx(
          'text-lg font-bold shrink-0',
          status === 'overdue' ? 'text-red-600' : status === 'paid' ? 'text-green-600' : 'text-gray-900',
        )}>
          {fmt(record.totalAmount)}
        </span>
        <span className={clsx('text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 shrink-0', sc.badge)}>
          <Icon size={11} />{sc.label}
        </span>
        <ChevronDown size={15} className={clsx('text-gray-400 shrink-0 transition-transform', expanded && 'rotate-180')} />
      </div>

      {expanded && (
        <div className="border-t border-gray-100 px-5 py-4 bg-gray-50 space-y-4">
          {/* 明細表 */}
          {record.items?.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[400px]">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-1.5 pr-3 font-medium text-gray-500">日期</th>
                    <th className="text-left py-1.5 pr-3 font-medium text-gray-500">施工地點</th>
                    <th className="text-right py-1.5 pr-3 font-medium text-gray-500">未稅金額</th>
                    <th className="text-right py-1.5 pr-3 font-medium text-gray-500">稅金</th>
                    <th className="text-right py-1.5 font-medium text-gray-500">總額</th>
                  </tr>
                </thead>
                <tbody>
                  {record.items.map((item, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="py-1.5 pr-3 text-gray-600">{item.date || '—'}</td>
                      <td className="py-1.5 pr-3 text-gray-800">{item.location || '—'}</td>
                      <td className="py-1.5 pr-3 text-right text-gray-600">${(item.pretax || 0).toLocaleString()}</td>
                      <td className="py-1.5 pr-3 text-right text-gray-400">${(item.tax || 0).toLocaleString()}</td>
                      <td className="py-1.5 text-right font-semibold text-gray-800">${(item.total || 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {/* 日期資訊 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-400 mb-0.5">請款日期</p>
              <p className="font-medium text-gray-800">{record.invoiceDate || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">應付款日</p>
              <p className={clsx('font-medium', status === 'overdue' ? 'text-red-600' : 'text-gray-800')}>
                {record.dueDate || '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">實收日期</p>
              <p className="font-medium text-gray-800">{record.paidDate || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">請款金額</p>
              <p className="font-bold text-gray-900">{fmt(record.totalAmount)}</p>
            </div>
          </div>
          {/* 動作 */}
          <div className="flex gap-2 flex-wrap items-center">
            {(status === 'invoiced' || status === 'overdue') && (
              <>
                <button
                  className="btn-primary text-sm py-1.5 bg-green-600 hover:bg-green-700 border-green-600"
                  onClick={e => { e.stopPropagation(); onMarkPaid(record.id) }}
                >
                  <Check size={14} /> 確認收款
                </button>
                <button
                  className="btn-secondary text-sm py-1.5 text-gray-500 hover:text-red-600 hover:border-red-300"
                  onClick={e => { e.stopPropagation(); onWriteOff(record) }}
                >
                  <Ban size={14} /> 註銷帳款
                </button>
              </>
            )}
            {status === 'paid' && (
              <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
                <CheckCircle size={15} /> 已完成收款 {record.paidDate && `（${record.paidDate}）`}
              </span>
            )}
            {status === 'written_off' && (
              <span className="flex items-center gap-1.5 text-sm text-gray-400 font-medium">
                <Ban size={15} /> 已註銷{record.writeOffReason ? `：${record.writeOffReason}` : ''}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ARPage() {
  const { activeOrgId } = useOrg()
  const { data: invoicesRaw, loading } = useCollection(COL.INVOICES)
  const { data: customers } = useCollection(COL.CUSTOMERS)
  const [filterStatus, setFilterStatus] = useState('all')

  const invoices = useMemo(() =>
    invoicesRaw.filter(r => r.orgId === activeOrgId),
    [invoicesRaw, activeOrgId]
  )

  // resolve dynamic overdue status
  const withStatus = useMemo(() =>
    invoices.map(r => ({ ...r, _status: resolveStatus(r) })),
    [invoices]
  )

  const filtered = useMemo(() =>
    filterStatus === 'all'
      ? withStatus.filter(r => r._status !== 'written_off')
      : withStatus.filter(r => r._status === filterStatus),
    [withStatus, filterStatus]
  )

  const count = (s) => withStatus.filter(r => r._status === s).length
  const sum   = (s) => withStatus.filter(r => r._status === s).reduce((a, r) => a + (r.totalAmount || 0), 0)

  const [writeOffTarget, setWriteOffTarget] = useState(null)

  const markPaid = async (id) => {
    const today   = new Date().toISOString().slice(0, 10)
    const invoice = withStatus.find(r => r.id === id)
    await updateInvoice(id, { status: 'paid', paidDate: today })
    if (invoice?.orderId) {
      await updateOrder(invoice.orderId, { status: 'paid' })
    }
  }

  const markWrittenOff = async (id, reason) => {
    const today = new Date().toISOString().slice(0, 10)
    await updateInvoice(id, { status: 'written_off', writeOffReason: reason, writeOffDate: today })
    setWriteOffTarget(null)
  }

  const activeCount = withStatus.filter(r => r._status !== 'written_off').length
  const tabs = [
    { key: 'all',          label: '全部',    count: activeCount              },
    { key: 'invoiced',     label: '已請款',  count: count('invoiced')        },
    { key: 'overdue',      label: '逾期未收', count: count('overdue')         },
    { key: 'paid',         label: '已收款',  count: count('paid')            },
    { key: 'written_off',  label: '已註銷',  count: count('written_off')     },
  ]

  const filteredTotal = filtered.reduce((s, r) => s + (r.totalAmount || 0), 0)

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">應收帳款</h1>
        <p className="text-sm text-gray-500 mt-0.5">從「訂單 → 列印請款單 → 確認送出」自動建立紀錄</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={AlertTriangle} color="red"
          label="逾期未收"
          value={fmt(sum('overdue'))}
          sub={`${count('overdue')} 筆逾期`}
        />
        <StatCard icon={Clock} color="amber"
          label="待收款（已請款）"
          value={fmt(sum('invoiced'))}
          sub={`${count('invoiced')} 筆待收`}
        />
        <StatCard icon={CheckCircle} color="green"
          label="已收款"
          value={fmt(sum('paid'))}
          sub={`${count('paid')} 筆完成`}
        />
        <StatCard icon={Ban} color="gray"
          label="已註銷（壞帳）"
          value={fmt(sum('written_off'))}
          sub={`${count('written_off')} 筆`}
        />
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {tabs.map(({ key, label, count: cnt }) => (
          <button
            key={key}
            onClick={() => setFilterStatus(key)}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              filterStatus === key
                ? 'bg-brand-600 text-white shadow-sm'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300',
            )}
          >
            {label}
            <span className={clsx(
              'text-[11px] font-bold px-1.5 py-0.5 rounded-full',
              filterStatus === key ? 'bg-white/20 text-white'
                : key === 'overdue' && cnt > 0 ? 'bg-red-100 text-red-600'
                : 'bg-gray-100 text-gray-500',
            )}>{cnt}</span>
          </button>
        ))}
        <span className="ml-auto text-sm text-gray-400">
          合計 <strong className="text-gray-700">{fmt(filteredTotal)}</strong>
        </span>
      </div>

      {/* List */}
      {loading ? (
        <div className="card p-16 text-center text-gray-400">載入中...</div>
      ) : filtered.length === 0 ? (
        <div className="card p-16 text-center">
          <DollarSign size={40} className="mx-auto mb-3 text-gray-200" />
          <p className="text-gray-400 mb-1">
            {filterStatus === 'all' ? '尚無請款紀錄' : '此分類暫無帳款'}
          </p>
          {filterStatus === 'all' && (
            <p className="text-xs text-gray-400">請至「訂單 & 合約」→ 開啟訂單 → 列印請款單 → 確認送出</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered
            .sort((a, b) => {
              const order = { overdue: 0, invoiced: 1, paid: 2, written_off: 3 }
              if (order[a._status] !== order[b._status]) return order[a._status] - order[b._status]
              return (a.dueDate || '').localeCompare(b.dueDate || '')
            })
            .map(r => (
              <ARRow key={r.id} record={r} customers={customers} onMarkPaid={markPaid} onWriteOff={setWriteOffTarget} />
            ))
          }
        </div>
      )}

      {writeOffTarget && (
        <WriteOffModal
          record={writeOffTarget}
          onConfirm={markWrittenOff}
          onClose={() => setWriteOffTarget(null)}
        />
      )}
    </div>
  )
}
