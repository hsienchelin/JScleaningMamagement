import { useMemo, useState } from 'react'
import { Archive, MapPin, Building2, Calendar, DollarSign, Search, ChevronDown, ChevronUp, Clock, Layers, Users } from 'lucide-react'
import { COL } from '../lib/db'
import { useCollection } from '../hooks/useCollection'
import { useOrg } from '../contexts/OrgContext'
import {
  getSiteMonthlyBase, getContractMonthlyTotal, isContractEnded,
  getContractLifecycleStatus, CONTRACT_LIFECYCLE,
  BILLING_MODE_MAP, getTaskScheduleText, getWeeklyAnnualTotal, WEEKDAYS,
} from '../utils/contractSchema'
import CloneContractModal from '../components/CloneContractModal'
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

// ─── Site detail row（展開時顯示每個案場的完整資訊）─────────────────────────
function HistorySiteDetail({ site, shiftCodes = [] }) {
  const mode = site.billingMode || 'fixed'
  const meta = BILLING_MODE_MAP[mode] || BILLING_MODE_MAP.fixed

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-2.5">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <MapPin size={12} className="text-brand-500" />
        <span className="text-sm font-bold text-gray-800">{site.name}</span>
        <span className="badge badge-gray text-[10px]">{meta.icon} {meta.label}</span>
        {(mode === 'fixed' || mode === 'actual') && (
          <span className="ml-auto text-xs font-semibold text-brand-700">
            月費 {fmt(getSiteMonthlyBase(site))}
          </span>
        )}
      </div>

      {/* 月固定明細 */}
      {(mode === 'fixed' || mode === 'actual') && site.monthlyItems?.length > 0 && (
        <div className="pl-4 space-y-1">
          {site.monthlyItems.map(item => (
            <div key={item.id} className="flex justify-between text-xs">
              <span className="text-gray-600">· {item.name || '未命名'}</span>
              <span className="text-gray-700 font-medium">{fmt(item.amount)}</span>
            </div>
          ))}
        </div>
      )}

      {/* 每週固定 */}
      {mode === 'weekly' && site.weeklySchedule && (
        <div className="pl-4 text-xs text-gray-600 space-y-0.5">
          <p>
            週幾：{(site.weeklySchedule.weekdays || []).map(d => WEEKDAYS.find(w => w.id === d)?.full || `週${d}`).join('、') || '未指定'}
          </p>
          <p>
            每週 {site.weeklySchedule.timesPerWeek || 0} 次 × {fmt(site.weeklySchedule.unitPrice)} × {site.weeklySchedule.weeks || 52} 週 ＝
            <span className="font-bold text-brand-700 ml-1">{fmt(getWeeklyAnnualTotal(site.weeklySchedule))}</span>
          </p>
        </div>
      )}

      {/* 按次派工 */}
      {mode === 'dispatch' && site.dispatchPlan?.length > 0 && (
        <div className="pl-4 space-y-1">
          {site.dispatchPlan.map(d => (
            <div key={d.id} className="flex justify-between text-xs">
              <span className="text-gray-600">· {d.name}（{fmt(d.unitPrice)}/次）</span>
              <span className="text-gray-700">{d.usedCount || 0} / {d.plannedCount || 0} 次</span>
            </div>
          ))}
          {site.locations?.length > 0 && (
            <p className="text-[11px] text-gray-400 pt-1">
              服務地點：{site.locations.join('、')}
            </p>
          )}
        </div>
      )}

      {/* 班次 */}
      {site.shifts?.length > 0 && (
        <div className="pl-4 pt-1.5 border-t border-gray-100">
          <p className="text-[11px] font-semibold text-gray-400 mb-1">
            <Clock size={9} className="inline-block -mt-0.5 mr-0.5" /> 班次
          </p>
          {site.shifts.map(s => {
            const sc = shiftCodes.find(c => c.id === s.shiftCodeId)
            const wds = Array.isArray(s.weekdays) ? s.weekdays : []
            const wdText = wds.length > 0 && wds.length < 7
              ? '・週' + wds.map(d => WEEKDAYS.find(w => w.id === d)?.label || '').join('')
              : ''
            return (
              <div key={s.id} className="flex items-center gap-2 text-xs text-gray-600">
                {sc?.code && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white shrink-0" style={{ backgroundColor: sc.color || '#6b7280' }}>
                    {sc.code}
                  </span>
                )}
                <span>
                  {sc ? `${sc.label} ${sc.startTime}–${sc.endTime}` : '（班次代號已刪除）'}{wdText}・需 {s.headcount} 人
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* 週期任務 */}
      {site.periodicTasks?.length > 0 && (
        <div className="pl-4 pt-1.5 border-t border-gray-100">
          <p className="text-[11px] font-semibold text-gray-400 mb-1">
            <Layers size={9} className="inline-block -mt-0.5 mr-0.5" /> 週期任務（{site.periodicTasks.length} 項）
          </p>
          {site.periodicTasks.map(t => {
            const completedCount = (t.completedMonths || []).length
            return (
              <div key={t.id} className="flex justify-between text-xs">
                <span className="text-gray-600 truncate pr-2">· {t.name}（{getTaskScheduleText(t)}）</span>
                <span className="text-gray-400 shrink-0">
                  {fmt(t.unitPrice)}/次 · 完成 {completedCount} 次
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Annual contract history card ─────────────────────────────────────────────
function ContractCard({ contract, customers, shiftCodes = [], onClone }) {
  const [open, setOpen] = useState(false)
  const customer    = customers.find(c => c.id === contract.customerId)
  const totalAnnual = getContractMonthlyTotal(contract.sites || []) * 12
  // 正確的欄位名稱（之前用 startDate/endDate 是 bug）
  const start = contract.contractStart || contract.startDate || ''
  const end   = contract.contractEnd   || contract.endDate   || ''
  // 計費模式分佈
  const modeStats = (contract.sites || []).reduce((acc, s) => {
    const m = s.billingMode || 'fixed'
    acc[m] = (acc[m] || 0) + 1
    return acc
  }, {})
  // 週期任務完成數
  const totalPeriodicCompleted = (contract.sites || []).reduce((sum, s) =>
    sum + (s.periodicTasks || []).reduce((ss, t) => ss + (t.completedMonths?.length || 0), 0)
  , 0)
  // weekly 訪視次數
  const totalWeeklyVisits = (contract.sites || []).reduce((sum, s) => sum + (s.weeklyVisits?.length || 0), 0)
  // dispatch 已使用次數
  const totalDispatchUsed = (contract.sites || []).reduce((sum, s) =>
    sum + (s.dispatchPlan || []).reduce((ss, d) => ss + (d.usedCount || 0), 0)
  , 0)

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
            {(() => {
              const lc = getContractLifecycleStatus(contract)
              const meta = CONTRACT_LIFECYCLE[lc] || CONTRACT_LIFECYCLE.ended
              return <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${meta.badge}`}>{meta.label}</span>
            })()}
            {contract.contractNo && (
              <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">合約編號 {contract.contractNo}</span>
            )}
            <span className="text-[10px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded-full">
              {contract.paymentMode === 'actual' ? '核實請款' : '平均攤提'}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1 flex-wrap">
            <Building2 size={10} />{customer?.name || contract.customerName || '—'}
            <span className="text-gray-300 mx-1">·</span>
            <Calendar size={10} />{start} ~ {end}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-base font-bold text-gray-700">{fmt(totalAnnual)}</p>
          <p className="text-xs text-gray-400 mt-0.5">合約總額（含稅）{fmt(contract.totalValue || 0)}</p>
        </div>
        {open ? <ChevronUp size={15} className="text-gray-400 shrink-0" /> : <ChevronDown size={15} className="text-gray-400 shrink-0" />}
      </div>

      {open && (
        <div className="border-t border-gray-100 px-5 py-4 bg-gray-50 space-y-4">
          {/* 基本資訊 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            {[
              { label: '客戶',         value: customer?.name || contract.customerName || '—' },
              { label: '合約期間',     value: `${start} ~ ${end}` },
              { label: '合約總額(含稅)', value: fmt(contract.totalValue || 0) },
              { label: '案場數',       value: `${(contract.sites || []).length} 個` },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white rounded-lg px-3 py-2 border border-gray-100">
                <p className="text-[10px] text-gray-400 mb-0.5">{label}</p>
                <p className="font-medium text-gray-800 text-xs">{value}</p>
              </div>
            ))}
          </div>

          {/* 執行統計 */}
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="bg-white rounded-lg px-3 py-2 border border-gray-100">
              <p className="text-[10px] text-gray-400">週期任務完成</p>
              <p className="font-bold text-brand-700">{totalPeriodicCompleted} 次</p>
            </div>
            <div className="bg-white rounded-lg px-3 py-2 border border-gray-100">
              <p className="text-[10px] text-gray-400">每週訪視</p>
              <p className="font-bold text-brand-700">{totalWeeklyVisits} 次</p>
            </div>
            <div className="bg-white rounded-lg px-3 py-2 border border-gray-100">
              <p className="text-[10px] text-gray-400">按次派工</p>
              <p className="font-bold text-brand-700">{totalDispatchUsed} 次</p>
            </div>
          </div>

          {/* 變更歷史 */}
          {Array.isArray(contract.amendments) && contract.amendments.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1.5">變更歷史（{contract.amendments.length} 次）</p>
              <div className="space-y-1">
                {contract.amendments.map((a, i) => (
                  <div key={i} className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-xs">
                    <p className="font-semibold text-amber-800">第 {a.no || (i + 1)} 次變更 · {a.date || '未填日期'}</p>
                    {a.summary && <p className="text-gray-600 mt-0.5">{a.summary}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 備註 */}
          {contract.notes && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">備註</p>
              <p className="text-xs text-gray-600 bg-white rounded-lg px-3 py-2 border border-gray-100 whitespace-pre-line">
                {contract.notes}
              </p>
            </div>
          )}

          {/* 案場清單（完整資訊）*/}
          {(contract.sites || []).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1.5">案場明細（{contract.sites.length}）</p>
              <div className="space-y-2">
                {contract.sites.map(s => (
                  <HistorySiteDetail key={s.id} site={s} shiftCodes={shiftCodes} />
                ))}
              </div>
            </div>
          )}

          {/* 複製成新合約 */}
          {onClone && (
            <div className="pt-2 border-t border-gray-200">
              <button
                onClick={() => onClone(contract)}
                className="btn-primary text-sm w-full justify-center"
              >
                📋 複製成新合約（用於續約 / 類似標案）
              </button>
              <p className="text-[11px] text-gray-400 text-center mt-1.5">
                結構、班次、週期任務都會完整複製；執行紀錄會清空
              </p>
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
  const { data: shiftCodesRaw }      = useCollection(COL.SHIFT_CODES)
  const [search, setSearch]          = useState('')
  const [tab, setTab]                = useState('orders')
  const [cloneSource, setCloneSource] = useState(null)  // 點「複製成新合約」時設定

  const customers  = customersRaw.filter(c => c.orgId === activeOrgId)
  const shiftCodes = shiftCodesRaw.filter(c => c.orgId === activeOrgId)

  const closedOrders = useMemo(() =>
    ordersRaw
      .filter(o => o.orgId === activeOrgId && o.status === 'closed')
      .filter(o => !search || (o.siteName || o.title || '').includes(search) || (o.customerName || '').includes(search))
      .sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0)),
    [ordersRaw, activeOrgId, search]
  )

  const endedContracts = useMemo(() => {
    return contractsRaw
      .filter(c => c.orgId === activeOrgId && isContractEnded(c))
      .filter(c => !search || (c.title || '').includes(search) || (c.customerName || '').includes(search))
      .sort((a, b) => (b.contractEnd || '').localeCompare(a.contractEnd || ''))
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
              <ContractCard
                key={c.id}
                contract={c}
                customers={customers}
                shiftCodes={shiftCodes}
                onClone={(src) => setCloneSource(src)}
              />
            ))}
          </div>
        )
      )}

      {cloneSource && (
        <CloneContractModal
          source={cloneSource}
          onSuccess={() => {
            setCloneSource(null)
            alert('已建立複本合約！請至「訂單 & 合約 → 年度合約」分頁查看（未開始狀態）')
          }}
          onClose={() => setCloneSource(null)}
        />
      )}
    </div>
  )
}
