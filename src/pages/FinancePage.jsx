import { useMemo, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ComposedChart, Line,
} from 'recharts'
import {
  DollarSign, TrendingUp, TrendingDown, Percent, ChevronDown, ChevronUp,
} from 'lucide-react'
import { COL } from '../lib/db'
import { useCollection } from '../hooks/useCollection'
import { useOrg } from '../contexts/OrgContext'
import clsx from 'clsx'

const MONTHS_ZH = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']

const CLEAN_TYPE_LABEL = {
  stationed: '駐點清潔',
  rough:     '裝潢粗清',
  fine:      '裝潢細清',
  disinfect: '環境消毒',
  other:     '其他',
}

function fmt(n)  { return `$${Math.round(n || 0).toLocaleString()}` }
function fmtK(n) { return n >= 1000 ? `${(n/1000).toFixed(1)}K` : `${Math.round(n)}` }

// ─── Metric card ──────────────────────────────────────────────────────────────
function MetricCard({ icon: Icon, label, value, sub, color = 'blue' }) {
  const colors = {
    blue:   { bg: 'bg-blue-50',   text: 'text-blue-600',   val: 'text-blue-700'   },
    green:  { bg: 'bg-green-50',  text: 'text-green-600',  val: 'text-green-700'  },
    red:    { bg: 'bg-red-50',    text: 'text-red-600',    val: 'text-red-700'    },
    purple: { bg: 'bg-purple-50', text: 'text-purple-600', val: 'text-purple-700' },
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

// ─── Order profit row ─────────────────────────────────────────────────────────
function OrderProfitRow({ order }) {
  const [open, setOpen] = useState(false)
  const revenue  = order.totalPrice || 0
  const labor    = order.estimatedLaborCost || 0
  const material = order.estimatedMaterialCost || 0
  const cost     = labor + material
  const profit   = revenue - cost
  const margin   = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : null

  return (
    <div className={clsx('border-b border-gray-100 last:border-0', open && 'bg-gray-50')}>
      <div
        className="flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate">{order.siteName || order.title || '—'}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {order.customerName || '—'} · {CLEAN_TYPE_LABEL[order.type] || order.type || '—'}
          </p>
        </div>
        <div className="text-right shrink-0 w-20">
          <p className="text-sm font-semibold text-gray-800">{fmt(revenue)}</p>
          <p className="text-xs text-gray-400">訂單金額</p>
        </div>
        <div className="text-right shrink-0 w-20">
          <p className="text-sm text-red-500">{fmt(cost)}</p>
          <p className="text-xs text-gray-400">預估成本</p>
        </div>
        <div className="text-right shrink-0 w-24">
          {margin !== null ? (
            <>
              <p className={clsx('text-sm font-bold', profit >= 0 ? 'text-green-600' : 'text-red-600')}>{fmt(profit)}</p>
              <p className={clsx('text-xs', profit >= 0 ? 'text-green-500' : 'text-red-400')}>{margin}%</p>
            </>
          ) : (
            <p className="text-xs text-gray-300">未估算</p>
          )}
        </div>
        {open ? <ChevronUp size={14} className="text-gray-400 shrink-0" /> : <ChevronDown size={14} className="text-gray-400 shrink-0" />}
      </div>
      {open && (
        <div className="px-4 pb-3 grid grid-cols-4 gap-3 text-sm">
          {[
            { label: '訂單金額', value: fmt(revenue),  cls: 'text-gray-700' },
            { label: '預估人工', value: fmt(labor),    cls: 'text-red-500'  },
            { label: '預估耗材', value: fmt(material), cls: 'text-red-500'  },
            { label: '預估毛利', value: fmt(profit),   cls: profit >= 0 ? 'text-green-600' : 'text-red-600' },
          ].map(({ label, value, cls }) => (
            <div key={label} className="bg-white rounded-lg px-3 py-2">
              <p className="text-xs text-gray-400">{label}</p>
              <p className={clsx('font-semibold mt-0.5', cls)}>{value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function FinancePage() {
  const { activeOrgId } = useOrg()
  const { data: invoicesRaw }  = useCollection(COL.INVOICES)
  const { data: purchasesRaw } = useCollection(COL.PURCHASES)
  const { data: ordersRaw }    = useCollection(COL.ORDERS)
  const [year, setYear]        = useState(new Date().getFullYear())

  const invoices  = useMemo(() => invoicesRaw.filter(i => i.orgId === activeOrgId),  [invoicesRaw,  activeOrgId])
  const purchases = useMemo(() => purchasesRaw.filter(p => p.orgId === activeOrgId), [purchasesRaw, activeOrgId])
  const orders    = useMemo(() => ordersRaw.filter(o => o.orgId === activeOrgId),    [ordersRaw,    activeOrgId])

  // ── Available years (union of invoice dates + purchase dates) ─────────────
  const availableYears = useMemo(() => {
    const years = new Set([new Date().getFullYear()])
    invoices.forEach(i => {
      const d = i.invoiceDate || i.paidDate
      if (d) years.add(parseInt(d.slice(0, 4), 10))
    })
    purchases.forEach(p => {
      if (p.date) years.add(parseInt(p.date.slice(0, 4), 10))
    })
    return [...years].sort((a, b) => b - a)
  }, [invoices, purchases])

  // ── Year-filtered slices ──────────────────────────────────────────────────
  const yearInvoices  = useMemo(() =>
    invoices.filter(i => (i.invoiceDate || i.paidDate || '').startsWith(String(year))),
    [invoices, year]
  )
  const yearPurchases = useMemo(() =>
    purchases.filter(p => (p.date || '').startsWith(String(year))),
    [purchases, year]
  )

  // ── Annual P&L ────────────────────────────────────────────────────────────
  const annualRevenue  = yearInvoices.reduce((s, i) => s + (i.totalAmount || 0), 0)
  const annualCost     = yearPurchases.reduce((s, p) => s + (p.totalAmount || p.total || 0), 0)
  const annualProfit   = annualRevenue - annualCost
  const annualMargin   = annualRevenue > 0 ? ((annualProfit / annualRevenue) * 100).toFixed(1) : '—'

  // ── Monthly P&L (invoices = revenue, purchases = cost) ───────────────────
  const monthlyData = useMemo(() => {
    const buckets = Array.from({ length: 12 }, (_, i) => ({
      month: MONTHS_ZH[i], 營收: 0, 進貨成本: 0, 毛利: 0,
    }))
    invoices.forEach(i => {
      const d = i.invoiceDate || i.paidDate
      if (!d || !d.startsWith(String(year))) return
      const m = parseInt(d.slice(5, 7), 10) - 1
      if (m < 0 || m > 11) return
      buckets[m]['營收'] += i.totalAmount || 0
    })
    purchases.forEach(p => {
      if (!p.date || !p.date.startsWith(String(year))) return
      const m = parseInt(p.date.slice(5, 7), 10) - 1
      if (m < 0 || m > 11) return
      buckets[m]['進貨成本'] += p.totalAmount || p.total || 0
    })
    buckets.forEach(b => { b['毛利'] = b['營收'] - b['進貨成本'] })
    return buckets
  }, [invoices, purchases, year])

  const hasMonthlyData = monthlyData.some(d => d['營收'] > 0 || d['進貨成本'] > 0)

  // ── By-type from orders (estimated) ───────────────────────────────────────
  const byType = useMemo(() => {
    const map = {}
    orders.forEach(o => {
      const key = CLEAN_TYPE_LABEL[o.type] || o.typeCustom || o.type || '其他'
      if (!map[key]) map[key] = { type: key, 營收: 0, 成本: 0, 毛利: 0 }
      const rev  = o.totalPrice || 0
      const cost = (o.estimatedLaborCost || 0) + (o.estimatedMaterialCost || 0)
      map[key]['營收'] += rev
      map[key]['成本'] += cost
      map[key]['毛利'] += rev - cost
    })
    return Object.values(map).filter(d => d['營收'] > 0)
  }, [orders])

  // ── Order profit list ──────────────────────────────────────────────────────
  const orderList = useMemo(() =>
    orders
      .filter(o => (o.totalPrice || 0) > 0)
      .sort((a, b) => (b.totalPrice || 0) - (a.totalPrice || 0)),
    [orders]
  )

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">財務損益</h1>
          <p className="text-sm text-gray-500 mt-0.5">營收來自請款單 · 成本來自進貨記錄</p>
        </div>
        <select className="input w-auto text-sm" value={year} onChange={e => setYear(Number(e.target.value))}>
          {availableYears.map(y => <option key={y} value={y}>{y} 年</option>)}
        </select>
      </div>

      {/* Annual P&L cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard icon={DollarSign}   color="blue"
          label={`${year} 年請款總額`}
          value={fmt(annualRevenue)}
          sub={`${yearInvoices.length} 張請款單`}
        />
        <MetricCard icon={TrendingDown} color="red"
          label={`${year} 年進貨成本`}
          value={fmt(annualCost)}
          sub={`${yearPurchases.length} 筆進貨`}
        />
        <MetricCard
          icon={TrendingUp}
          color={annualProfit >= 0 ? 'green' : 'red'}
          label={`${year} 年毛利`}
          value={fmt(annualProfit)}
          sub={annualRevenue > 0 ? `毛利率 ${annualMargin}%` : '尚無營收'}
        />
        <MetricCard icon={Percent} color="purple"
          label={`${year} 年毛利率`}
          value={`${annualMargin}%`}
          sub={annualRevenue > 0 ? `營收 ${fmt(annualRevenue)}` : undefined}
        />
      </div>

      {/* Monthly P&L chart */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">{year} 年月度損益</h3>
        {!hasMonthlyData ? (
          <div className="h-48 flex items-center justify-center text-gray-300 text-sm">
            {year} 年尚無請款或進貨記錄
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={monthlyData} margin={{ right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={fmtK} />
              <Tooltip formatter={v => [`$${v.toLocaleString()}`, '']} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="營收"    fill="#bfdbfe" radius={[4,4,0,0]} />
              <Bar dataKey="進貨成本" fill="#fca5a5" radius={[4,4,0,0]} />
              <Line type="monotone" dataKey="毛利" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* By-type P&L (estimated from orders) */}
      {byType.length > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">各清潔類型損益（預估）</h3>
          <p className="text-xs text-gray-400 mb-4">依訂單預估人工＋耗材計算，非實際進貨成本</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byType} margin={{ right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="type" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={fmtK} />
              <Tooltip formatter={v => [`$${v.toLocaleString()}`, '']} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="營收" fill="#bfdbfe" radius={[4,4,0,0]} />
              <Bar dataKey="成本" fill="#fca5a5" radius={[4,4,0,0]} />
              <Bar dataKey="毛利" fill="#86efac" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Order profit table */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100">
          <div>
            <h3 className="text-sm font-semibold text-gray-700">訂單損益明細（預估）</h3>
            <p className="text-xs text-gray-400 mt-0.5">所有訂單 · 含預估人工與耗材</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span className="w-20 text-right">訂單金額</span>
            <span className="w-20 text-right">預估成本</span>
            <span className="w-24 text-right">預估毛利</span>
            <span className="w-4" />
          </div>
        </div>
        {orderList.length === 0 ? (
          <div className="p-12 text-center text-gray-300 text-sm">尚無訂單資料</div>
        ) : (
          orderList.map(o => <OrderProfitRow key={o.id} order={o} />)
        )}
      </div>
    </div>
  )
}
