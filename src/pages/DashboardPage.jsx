import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import {
  Users, ClipboardCheck, AlertTriangle,
  DollarSign, Clock, ArrowRight,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { MOCK_FINANCE, MOCK_ORDERS, MOCK_EMPLOYEES, MOCK_WORK_ORDERS } from '../lib/mockData'

// ─── Stat card ─────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color = 'blue', onClick }) {
  const palette = {
    blue:   { bg: 'bg-blue-50',   text: 'text-blue-700'   },
    green:  { bg: 'bg-green-50',  text: 'text-green-700'  },
    amber:  { bg: 'bg-amber-50',  text: 'text-amber-700'  },
    purple: { bg: 'bg-purple-50', text: 'text-purple-700' },
    red:    { bg: 'bg-red-50',    text: 'text-red-700'    },
  }
  const c = palette[color] || palette.blue
  return (
    <div
      className={`card p-5 flex items-start gap-4 ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
      onClick={onClick}
    >
      <div className={`p-2.5 rounded-xl shrink-0 ${c.bg} ${c.text}`}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 truncate">{label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ─── CSS Donut chart (pure div/SVG — avoids Recharts PieChart quirks) ─────
function DonutChart({ segments }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0)
  let cumulative = 0
  const radius = 60, cx = 80, cy = 80, strokeW = 22
  const circumference = 2 * Math.PI * radius

  return (
    <div className="flex flex-col items-center gap-4">
      <svg width={160} height={160}>
        {/* Track */}
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#f3f4f6" strokeWidth={strokeW} />
        {segments.map((seg, i) => {
          const pct   = seg.value / total
          const dash  = pct * circumference
          const gap   = circumference - dash
          const angle = (cumulative / total) * 360 - 90
          cumulative += seg.value
          return (
            <circle
              key={i}
              cx={cx} cy={cy} r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={strokeW}
              strokeDasharray={`${dash} ${gap}`}
              strokeLinecap="round"
              transform={`rotate(${angle} ${cx} ${cy})`}
              style={{ transition: 'stroke-dasharray 0.4s ease' }}
            />
          )
        })}
        {/* Center label */}
        <text x={cx} y={cy - 6}  textAnchor="middle" fontSize={11} fill="#6b7280">合計</text>
        <text x={cx} y={cy + 12} textAnchor="middle" fontSize={14} fill="#111827" fontWeight={700}>
          ${(total / 1000).toFixed(0)}K
        </text>
      </svg>

      {/* Legend */}
      <div className="space-y-1.5 w-full">
        {segments.map((seg) => {
          const pct = ((seg.value / total) * 100).toFixed(0)
          return (
            <div key={seg.name} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 text-gray-600">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
                {seg.name}
              </span>
              <span className="font-semibold text-gray-800">${(seg.value/1000).toFixed(0)}K&nbsp;<span className="text-gray-400 font-normal">({pct}%)</span></span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const navigate = useNavigate()

  const totalRevenue = MOCK_FINANCE.monthly.reduce((s, m) => s + m.jiaxiang + m.zhexin, 0)
  const activeOrders = MOCK_ORDERS.filter(o => o.status === 'active').length
  const pendingWO    = MOCK_WORK_ORDERS.filter(w => w.status === 'pending').length

  // Contracts expiring in next 30 days
  const expiringContracts = MOCK_ORDERS.filter(o => {
    if (o.status !== 'active') return false
    const days = Math.ceil((new Date(o.contractEnd) - new Date()) / 86400000)
    return days > 0 && days <= 30
  })

  const jiaxiangTotal = MOCK_FINANCE.monthly.reduce((s, m) => s + m.jiaxiang, 0)
  const zhexinTotal   = MOCK_FINANCE.monthly.reduce((s, m) => s + m.zhexin,   0)
  const donutSegments = [
    { name: '佳翔清潔', value: jiaxiangTotal, color: '#2563eb' },
    { name: '哲欣清潔', value: zhexinTotal,   color: '#7c3aed' },
  ]

  return (
    <div className="space-y-6 max-w-7xl mx-auto">

      {/* ── Stats ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={DollarSign} color="blue"
          label="累計合計營收"
          value={`$${(totalRevenue / 1000).toFixed(0)}K`}
          sub={`${MOCK_FINANCE.monthly.length} 個月・佳翔 + 哲欣`}
        />
        <StatCard
          icon={ClipboardCheck} color="green"
          label="進行中訂單"
          value={activeOrders}
          sub="個有效合約"
          onClick={() => navigate('/orders')}
        />
        <StatCard
          icon={Users} color="purple"
          label="在職員工"
          value={MOCK_EMPLOYEES.length}
          sub="雙公司合計"
        />
        <StatCard
          icon={Clock} color="amber"
          label="待驗收派工單"
          value={pendingWO}
          sub="需簽收確認"
          onClick={() => navigate('/workorders')}
        />
      </div>

      {/* ── Revenue line + Pie ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">月度營收趨勢（佳翔 vs 哲欣）</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={MOCK_FINANCE.monthly} margin={{ right: 16, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `${v/1000}K`} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v, name) => [`$${v.toLocaleString()}`, name]}
                contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone" dataKey="jiaxiang" stroke="#2563eb"
                strokeWidth={2.5} name="佳翔" dot={{ r: 4, fill: '#2563eb' }}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone" dataKey="zhexin" stroke="#7c3aed"
                strokeWidth={2.5} name="哲欣" dot={{ r: 4, fill: '#7c3aed' }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Org revenue breakdown — CSS donut */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">累計營收佔比</h3>
          <DonutChart segments={donutSegments} />
        </div>
      </div>

      {/* ── Profit by type ─────────────────────────────────────────── */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">各清潔類型利潤率分析</h3>
        <ResponsiveContainer width="100%" height={210}>
          <BarChart data={MOCK_FINANCE.profitByType} margin={{ right: 16, top: 4 }} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
            <XAxis dataKey="type" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `${v/1000}K`} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(v, name) => [`$${v.toLocaleString()}`, name]}
              contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="revenue" name="營收" fill="#bfdbfe" radius={[4,4,0,0]} />
            <Bar dataKey="cost"    name="成本" fill="#fca5a5" radius={[4,4,0,0]} />
            <Bar dataKey="profit"  name="毛利" fill="#86efac" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Contract expiry alerts ─────────────────────────────────── */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-500" />
            合約到期預警（30天內）
          </span>
          <button
            className="text-xs text-brand-600 hover:underline flex items-center gap-1"
            onClick={() => navigate('/orders')}
          >
            查看全部 <ArrowRight size={12} />
          </button>
        </h3>

        {expiringContracts.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">目前無即將到期合約 ✓</p>
        ) : (
          <div className="space-y-2">
            {expiringContracts.map(o => {
              const days = Math.ceil((new Date(o.contractEnd) - new Date()) / 86400000)
              return (
                <div
                  key={o.id}
                  className="flex items-center justify-between py-2.5 px-4 bg-amber-50 rounded-xl border border-amber-100 cursor-pointer hover:bg-amber-100 transition-colors"
                  onClick={() => navigate('/orders')}
                >
                  <div>
                    <span className="text-sm font-medium text-gray-800">{o.title}</span>
                    <p className="text-xs text-gray-500 mt-0.5">到期日：{o.contractEnd}</p>
                  </div>
                  <span className={`badge ${days <= 14 ? 'badge-red' : 'badge-yellow'}`}>
                    剩 {days} 天
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
