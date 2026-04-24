import { useState, useMemo } from 'react'
import {
  DollarSign, Building2, Clock, Banknote, ChevronLeft,
  ChevronRight, ChevronDown, Download, CheckCircle,
  X, AlertCircle, Plus, Trash2,
  Pencil, Save, MapPin, Users,
} from 'lucide-react'
import { ORGS } from '../lib/mockData'
import { COL, addSalaryRecord, updateSalaryRecord } from '../lib/db'
import { useCollection } from '../hooks/useCollection'
import { useOrg } from '../contexts/OrgContext'
import { calcEntry, calcSalary } from '../utils/calculators'
import clsx from 'clsx'

// Re-export for backward compat
export { calcSalary }

// ─── Helpers ──────────────────────────────────────────────────────────────────
function currency(n) { return `$${Number(n || 0).toLocaleString()}` }

const STATUS = {
  pending:  { label: '待審核', badge: 'bg-amber-100 text-amber-700',  icon: Clock        },
  approved: { label: '已核准', badge: 'bg-blue-100 text-blue-700',    icon: CheckCircle  },
  paid:     { label: '已匯款', badge: 'bg-green-100 text-green-700',  icon: Banknote     },
}

const PAY_METHOD = {
  bank: { label: '匯銀行', color: 'bg-blue-100 text-blue-700'   },
  post: { label: '匯郵局', color: 'bg-teal-100 text-teal-700'   },
  cash: { label: '已領現', color: 'bg-amber-100 text-amber-700' },
}

function OrgBadge({ orgId }) {
  const org = ORGS.find(o => o.id === orgId)
  return (
    <span
      className="text-[11px] font-semibold px-2 py-0.5 rounded-full text-white"
      style={{ backgroundColor: org?.color }}
    >
      {org?.name}
    </span>
  )
}

function Avatar({ name, orgId }) {
  const color = orgId === 'jiaxiang' ? '#2563eb' : '#7c3aed'
  return (
    <div
      className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-sm shrink-0"
      style={{ backgroundColor: color }}
    >
      {name[0]}
    </div>
  )
}

function StatCard({ icon: Icon, label, value, sub, color = 'blue' }) {
  const pal = {
    blue:   'bg-blue-50 text-blue-700',
    green:  'bg-green-50 text-green-700',
    amber:  'bg-amber-50 text-amber-700',
    purple: 'bg-purple-50 text-purple-700',
    red:    'bg-red-50 text-red-700',
  }
  return (
    <div className="card p-4 flex items-start gap-3">
      <div className={`p-2 rounded-xl shrink-0 ${pal[color]}`}><Icon size={18} /></div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function MonthNav({ month, onChange }) {
  const [y, m] = month.split('-').map(Number)
  const prev = () => onChange(m === 1  ? `${y-1}-12`                    : `${y}-${String(m-1).padStart(2,'0')}`)
  const next = () => onChange(m === 12 ? `${y+1}-01`                    : `${y}-${String(m+1).padStart(2,'0')}`)
  const label = new Date(y, m-1, 1).toLocaleDateString('zh-TW', { year: 'numeric', month: 'long' })
  return (
    <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
      <button onClick={prev} className="p-1 hover:bg-gray-100 rounded-lg"><ChevronLeft size={16} /></button>
      <span className="text-sm font-semibold text-gray-800 w-28 text-center">{label}</span>
      <button onClick={next} className="p-1 hover:bg-gray-100 rounded-lg"><ChevronRight size={16} /></button>
    </div>
  )
}

// ─── Reusable salary field row ────────────────────────────────────────────────
function SalaryFieldRow({ label, value, editMode, onChange, isDeduction = false, showAlways = false }) {
  if (!editMode && !value && !showAlways) return null
  return (
    <div className={`flex items-center justify-between py-2 px-4 rounded-lg ${isDeduction ? 'bg-red-50' : 'bg-gray-50'}`}>
      <p className="text-sm text-gray-600">{label}</p>
      {editMode ? (
        <input
          type="number" min="0"
          value={value || 0}
          onChange={e => onChange(Number(e.target.value))}
          className="input w-28 text-right text-sm py-1"
        />
      ) : (
        <p className={`text-sm font-semibold ${isDeduction ? 'text-red-600' : 'text-gray-800'}`}>
          {isDeduction ? `-${currency(value)}` : currency(value)}
        </p>
      )}
    </div>
  )
}

// ─── Pay slip modal ───────────────────────────────────────────────────────────
function PaySlipModal({ record: initRecord, employee, onClose, onUpdate }) {
  const [record, setRecord]           = useState(initRecord)
  const [editMode, setEditMode]       = useState(false)
  const [showEmployer, setShowEmp]    = useState(false)

  const calc = calcSalary(record, employee)
  const org  = ORGS.find(o => o.id === employee.orgId)
  const sc   = STATUS[record.status] || STATUS.pending
  const pm   = PAY_METHOD[record.paymentMethod] || PAY_METHOD.bank
  const StatusIcon = sc.icon

  const patch  = (p)        => setRecord(r => ({ ...r, ...p }))
  const set    = (k, v)     => patch({ [k]: v })
  const updMob = (i, entry) => patch({ mobile: record.mobile.map((m, idx) => idx === i ? entry : m) })
  const delMob = (i)        => patch({ mobile: record.mobile.filter((_, idx) => idx !== i) })
  const addMob = ()         => patch({
    mobile: [...record.mobile, { id: `m${Date.now()}`, siteName: '', count: 1, rate: employee.dailyRate || 1800 }],
  })

  const handleSave  = () => { onUpdate(record); setEditMode(false) }
  const handleStatus = (s) => {
    const updated = { ...record, status: s }
    setRecord(updated)
    onUpdate(updated)
  }

  // 從員工資料同步：將保險/勞退/本薪覆寫回薪資單
  const syncFromEmployee = () => {
    const synced = {
      ...record,
      baseSalary:        employee.baseSalary            || record.baseSalary,
      laborInsBracket:   employee.laborInsuredSalary    || record.laborInsBracket,
      healthInsBracket:  employee.healthInsuredSalary   || record.healthInsBracket,
      laborInsEmployee:  employee.laborInsuranceEmployee  ?? record.laborInsEmployee,
      laborInsEmployer:  employee.laborInsuranceEmployer  ?? record.laborInsEmployer,
      healthInsEmployee: employee.healthInsuranceEmployee ?? record.healthInsEmployee,
      healthInsEmployer: employee.healthInsuranceEmployer ?? record.healthInsEmployer,
      pensionEmployee:   employee.laborPensionEmployee  ?? record.pensionEmployee,
      pensionEmployer:   employee.laborPensionEmployer  ?? record.pensionEmployer,
    }
    setRecord(synced)
    onUpdate(synced)
  }

  // 檢查員工資料與薪資單是否有差異（判斷是否需要同步）
  const hasEmployeeDiff =
    (employee.laborInsuranceEmployee != null && employee.laborInsuranceEmployee !== record.laborInsEmployee) ||
    (employee.laborInsuranceEmployer != null && employee.laborInsuranceEmployer !== record.laborInsEmployer) ||
    (employee.healthInsuranceEmployee != null && employee.healthInsuranceEmployee !== record.healthInsEmployee) ||
    (employee.healthInsuranceEmployer != null && employee.healthInsuranceEmployer !== record.healthInsEmployer) ||
    (employee.laborPensionEmployee    != null && employee.laborPensionEmployee    !== record.pensionEmployee) ||
    (employee.laborPensionEmployer    != null && employee.laborPensionEmployer    !== record.pensionEmployer) ||
    (employee.laborInsuredSalary      != null && employee.laborInsuredSalary      !== record.laborInsBracket) ||
    (employee.healthInsuredSalary     != null && employee.healthInsuredSalary     !== record.healthInsBracket)

  const isMobile = employee.employmentType === 'mobile'

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden max-h-[93vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div
          className="px-6 py-5 flex items-center gap-4 text-white relative shrink-0"
          style={{ background: `linear-gradient(135deg, ${org?.color}, ${org?.color}bb)` }}
        >
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-xl font-bold shrink-0">
            {employee.name[0]}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold">{employee.name} 薪資單</h2>
            <p className="text-white/80 text-sm mt-0.5">{record.month} · {employee.position} · {org?.name}</p>
          </div>
          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full shrink-0 ${sc.badge}`}>
            <StatusIcon size={13} /> {sc.label}
          </span>
          <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg bg-white/20 hover:bg-white/30">
            <X size={16} />
          </button>
        </div>

        {/* ── Net pay banner ── */}
        <div className="px-6 py-4 bg-gray-50 border-b flex items-center justify-between shrink-0">
          <div>
            <p className="text-xs text-gray-500 mb-0.5">實領薪資</p>
            <p className="text-3xl font-bold text-green-600">{currency(calc.net)}</p>
          </div>
          <div className="text-right space-y-1">
            <div className="flex items-center justify-end gap-3 text-sm">
              <span className="text-gray-500">應發合計</span>
              <span className="font-semibold text-gray-800 w-24 text-right">{currency(calc.gross)}</span>
            </div>
            <div className="flex items-center justify-end gap-3 text-sm">
              <span className="text-gray-500">扣除合計</span>
              <span className="font-semibold text-red-500 w-24 text-right">-{currency(calc.totalDeductions)}</span>
            </div>
            <div className="flex items-center justify-end gap-2 mt-1">
              {editMode ? (
                <select
                  className="input w-auto text-xs py-1"
                  value={record.paymentMethod}
                  onChange={e => set('paymentMethod', e.target.value)}
                >
                  {Object.entries(PAY_METHOD).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              ) : (
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${pm.color}`}>{pm.label}</span>
              )}
            </div>
          </div>
        </div>

        {/* ── Sync banner ── */}
        {hasEmployeeDiff && !editMode && (
          <div className="px-6 py-2.5 bg-amber-50 border-b border-amber-100 flex items-center gap-3 shrink-0">
            <AlertCircle size={14} className="text-amber-500 shrink-0" />
            <p className="text-xs text-amber-700 flex-1">員工保險/勞退資料已更新，薪資單尚未同步</p>
            <button
              onClick={syncFromEmployee}
              className="text-xs font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors shrink-0"
            >
              從員工資料更新
            </button>
          </div>
        )}

        {/* ── Body ── */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* Attendance info */}
          <div className="flex flex-wrap items-center gap-4 text-sm bg-blue-50 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2 text-blue-700">
              <Clock size={14} />
              <span>出勤天數</span>
              {editMode ? (
                <>
                  <input type="number" min="0" max="31" value={record.workDays} onChange={e => set('workDays', Number(e.target.value))} className="input w-14 text-center text-sm py-1" />
                  <span className="text-blue-500">/ 當月</span>
                  <input type="number" min="28" max="31" value={record.totalDaysInMonth} onChange={e => set('totalDaysInMonth', Number(e.target.value))} className="input w-14 text-center text-sm py-1" />
                  <span className="text-blue-500">天</span>
                </>
              ) : (
                <span className="font-bold">{record.workDays} 天 <span className="font-normal text-blue-500">/ 當月 {record.totalDaysInMonth} 天</span></span>
              )}
            </div>
            {employee.stationedSite && (
              <div className="flex items-center gap-1 text-gray-500 ml-auto">
                <MapPin size={12} />
                <span className="text-xs">{employee.stationedSite}</span>
              </div>
            )}
          </div>

          {/* ── Earnings ── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">應發項目</h3>
              <div className="flex-1 h-px bg-gray-100" />
            </div>
            <div className="space-y-1.5">
              <SalaryFieldRow label="本薪" value={record.baseSalary} editMode={editMode} onChange={v => set('baseSalary', v)} showAlways />
              <SalaryFieldRow label="職務加給" value={record.allowance} editMode={editMode} onChange={v => set('allowance', v)} />
              <SalaryFieldRow label="加班費" value={record.overtimePay} editMode={editMode} onChange={v => set('overtimePay', v)} />
              <SalaryFieldRow label="年終獎金" value={record.yearEndBonus} editMode={editMode} onChange={v => set('yearEndBonus', v)} />
              <SalaryFieldRow label="過年獎金" value={record.lunarBonus} editMode={editMode} onChange={v => set('lunarBonus', v)} />
              <SalaryFieldRow label="特休折現" value={record.paidLeave} editMode={editMode} onChange={v => set('paidLeave', v)} />
              <SalaryFieldRow label="代付款" value={record.advancePayment} editMode={editMode} onChange={v => set('advancePayment', v)} />
            </div>

            {/* Mobile entries — site-grouped table (次數 × 金額 = 小計) */}
            {(isMobile || record.mobile.length > 0 || editMode) && (
              <div className="mt-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-amber-700">機動出勤明細</p>
                  {editMode && (
                    <button onClick={addMob} className="text-xs text-brand-600 hover:text-brand-800 flex items-center gap-1 font-medium">
                      <Plus size={12} /> 新增地點
                    </button>
                  )}
                </div>

                <div className="rounded-xl overflow-hidden border border-amber-200">
                  {/* Table header */}
                  <div className="grid grid-cols-[1fr_52px_72px_80px_32px] gap-0 bg-amber-100 text-[11px] font-semibold text-amber-800 px-3 py-1.5">
                    <span>工作地點</span>
                    <span className="text-center">次數</span>
                    <span className="text-right">金額/次</span>
                    <span className="text-right">小計</span>
                    <span />
                  </div>

                  {/* Rows */}
                  <div className="bg-amber-50 divide-y divide-amber-100">
                    {record.mobile.length === 0 && !editMode && (
                      <p className="text-xs text-center text-gray-400 py-3">本月無機動出勤</p>
                    )}
                    {record.mobile.map((m, i) => {
                      const sub = calcEntry(m)
                      return editMode ? (
                        <div key={i} className="grid grid-cols-[1fr_52px_72px_80px_32px] gap-0 items-center px-3 py-1.5">
                          <input
                            value={m.siteName} placeholder="工作地點"
                            onChange={e => updMob(i, { ...m, siteName: e.target.value })}
                            className="input text-xs py-1 mr-1"
                          />
                          <input
                            type="number" min="0" value={m.count}
                            onChange={e => updMob(i, { ...m, count: Number(e.target.value) })}
                            className="input text-xs py-1 text-center mx-1"
                          />
                          <input
                            type="number" min="0" value={m.rate}
                            onChange={e => updMob(i, { ...m, rate: Number(e.target.value) })}
                            className="input text-xs py-1 text-right mx-1"
                          />
                          <span className="text-xs font-semibold text-amber-700 text-right pr-1">{currency(sub)}</span>
                          <button onClick={() => delMob(i)} className="p-1 text-red-400 hover:text-red-600 flex justify-center">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ) : (
                        <div key={i} className="grid grid-cols-[1fr_52px_72px_80px_32px] gap-0 items-center px-3 py-1.5 text-xs text-gray-700">
                          <span className="truncate">{m.siteName || '—'}</span>
                          <span className="text-center text-gray-500">{m.count}</span>
                          <span className="text-right text-gray-500">{currency(m.rate)}</span>
                          <span className="text-right font-semibold text-amber-700">{currency(sub)}</span>
                          <span />
                        </div>
                      )
                    })}
                  </div>

                  {/* Total row */}
                  {record.mobile.length > 0 && (
                    <div className="grid grid-cols-[1fr_52px_72px_80px_32px] gap-0 items-center px-3 py-1.5 bg-amber-100 border-t border-amber-200">
                      <span className="text-xs font-bold text-amber-800">合計</span>
                      <span className="text-center text-xs text-amber-700">
                        {record.mobile.reduce((s, m) => s + (m.count || 0), 0)} 次
                      </span>
                      <span />
                      <span className="text-right text-sm font-bold text-amber-800">{currency(calc.mobilePay)}</span>
                      <span />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Gross subtotal */}
            <div className="flex items-center justify-between py-2.5 px-4 bg-brand-50 rounded-xl border border-brand-100 mt-3">
              <p className="text-sm font-bold text-brand-700">應發合計</p>
              <p className="text-base font-bold text-brand-700">{currency(calc.gross)}</p>
            </div>
          </div>

          {/* ── Deductions ── */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">扣除項目</h3>
              <div className="flex-1 h-px bg-gray-100" />
            </div>

            {/* Insurance bracket */}
            {editMode ? (
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div>
                  <label className="label text-xs">勞保投保金額</label>
                  <input type="number" value={record.laborInsBracket} onChange={e => set('laborInsBracket', Number(e.target.value))} className="input text-sm" />
                </div>
                <div>
                  <label className="label text-xs">健保投保金額</label>
                  <input type="number" value={record.healthInsBracket} onChange={e => set('healthInsBracket', Number(e.target.value))} className="input text-sm" />
                </div>
              </div>
            ) : (
              <div className="flex gap-4 mb-2 text-xs text-gray-400 px-1">
                <span>勞保投保：{currency(record.laborInsBracket)}</span>
                <span>健保投保：{currency(record.healthInsBracket)}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <SalaryFieldRow label="勞保自負額" value={record.laborInsEmployee} editMode={editMode} onChange={v => set('laborInsEmployee', v)} isDeduction showAlways />
              <SalaryFieldRow label="健保自負額" value={record.healthInsEmployee} editMode={editMode} onChange={v => set('healthInsEmployee', v)} isDeduction showAlways />
              <SalaryFieldRow label="個人勞退自提" value={record.pensionEmployee} editMode={editMode} onChange={v => set('pensionEmployee', v)} isDeduction />
              <SalaryFieldRow label="請假扣款" value={record.leaveDeduction} editMode={editMode} onChange={v => set('leaveDeduction', v)} isDeduction />
              <SalaryFieldRow label="其他扣款" value={record.otherDeductions} editMode={editMode} onChange={v => set('otherDeductions', v)} isDeduction />
              <SalaryFieldRow label="借支" value={record.advance} editMode={editMode} onChange={v => set('advance', v)} isDeduction />
            </div>

            {/* Deduction subtotal */}
            <div className="flex items-center justify-between py-2.5 px-4 bg-red-50 rounded-xl border border-red-100 mt-3">
              <p className="text-sm font-bold text-red-700">扣除合計</p>
              <p className="text-base font-bold text-red-700">-{currency(calc.totalDeductions)}</p>
            </div>
          </div>

          {/* ── Employer costs (collapsible) ── */}
          <div>
            <button
              onClick={() => setShowEmp(v => !v)}
              className="w-full flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wide"
            >
              <span>雇主負擔成本</span>
              <span className="text-[10px] font-normal text-gray-400 normal-case">(不計入員工薪資)</span>
              <div className="flex-1 h-px bg-gray-100 mx-1" />
              <ChevronDown size={14} className={clsx('transition-transform shrink-0', showEmployer && 'rotate-180')} />
            </button>
            {showEmployer && (
              <div className="mt-2 space-y-1.5">
                <div className="flex items-center justify-between py-2 px-4 bg-purple-50 rounded-lg">
                  <p className="text-sm text-gray-600">勞保單位負擔</p>
                  <p className="text-sm font-semibold text-purple-700">{currency(record.laborInsEmployer)}</p>
                </div>
                <div className="flex items-center justify-between py-2 px-4 bg-purple-50 rounded-lg">
                  <p className="text-sm text-gray-600">健保單位負擔</p>
                  <p className="text-sm font-semibold text-purple-700">{currency(record.healthInsEmployer)}</p>
                </div>
                <div className="flex items-center justify-between py-2 px-4 bg-purple-50 rounded-lg">
                  <p className="text-sm text-gray-600">勞退提撥（雇主 6%）</p>
                  <p className="text-sm font-semibold text-purple-700">{currency(record.pensionEmployer)}</p>
                </div>
                <div className="flex items-center justify-between py-2.5 px-4 bg-purple-100 rounded-xl">
                  <p className="text-sm font-bold text-purple-800">雇主成本合計</p>
                  <p className="text-sm font-bold text-purple-800">{currency(calc.totalEmployerCosts)}</p>
                </div>
              </div>
            )}
          </div>

          {/* Note */}
          {(record.note || editMode) && (
            editMode ? (
              <textarea
                value={record.note || ''}
                onChange={e => set('note', e.target.value)}
                className="input h-16 resize-none text-sm"
                placeholder="備註..."
              />
            ) : (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-sm text-amber-800">
                <AlertCircle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                {record.note}
              </div>
            )
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-6 py-4 border-t flex gap-3 shrink-0">
          {editMode ? (
            <>
              <button
                className="btn-secondary flex-1 justify-center"
                onClick={() => { setRecord(initRecord); setEditMode(false) }}
              >
                <X size={15} /> 取消
              </button>
              <button className="btn-primary flex-1 justify-center" onClick={handleSave}>
                <Save size={15} /> 儲存
              </button>
            </>
          ) : (
            <>
              <button className="btn-secondary flex-1 justify-center" onClick={() => setEditMode(true)}>
                <Pencil size={15} /> 編輯薪資
              </button>
              {record.status === 'pending' && (
                <button className="btn-primary flex-1 justify-center" onClick={() => handleStatus('approved')}>
                  <CheckCircle size={15} /> 核准
                </button>
              )}
              {record.status === 'approved' && (
                <button
                  className="flex-1 inline-flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors"
                  onClick={() => handleStatus('paid')}
                >
                  <Banknote size={15} /> 標記匯款
                </button>
              )}
              {record.status === 'paid' && (
                <div className="flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-green-50 text-green-600 text-sm font-semibold">
                  <CheckCircle size={15} /> 已匯款
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Salary table row ─────────────────────────────────────────────────────────
function SalaryRow({ record, employee, onClick }) {
  const calc = calcSalary(record, employee)
  const sc   = STATUS[record.status] || STATUS.pending
  const pm   = PAY_METHOD[record.paymentMethod] || PAY_METHOD.bank
  const StatusIcon = sc.icon

  return (
    <tr className="hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => onClick(record, employee)}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar name={employee.name} orgId={employee.orgId} />
          <div>
            <p className="font-semibold text-sm text-gray-900">{employee.name}</p>
            <p className="text-xs text-gray-400">{employee.position}</p>
          </div>
        </div>
      </td>

      {/* 本薪＋加給 */}
      <td className="px-4 py-3 hidden md:table-cell">
        <p className="text-sm font-semibold text-gray-800">{currency(record.baseSalary)}</p>
        {record.allowance > 0 && <p className="text-xs text-blue-500">+加給 {currency(record.allowance)}</p>}
        {record.mobile?.length > 0 && (
          <p className="text-xs text-amber-500">
            機動 {record.mobile.reduce((s, m) => s + (m.count || 1), 0)} 次・{record.mobile.length} 地點
          </p>
        )}
      </td>

      {/* 加班費 / 特殊 */}
      <td className="px-4 py-3 hidden lg:table-cell text-sm">
        {(record.overtimePay > 0 || record.yearEndBonus > 0 || record.paidLeave > 0) ? (
          <div className="space-y-0.5">
            {record.overtimePay  > 0 && <p className="text-green-600">加班 {currency(record.overtimePay)}</p>}
            {record.yearEndBonus > 0 && <p className="text-green-600">年終 {currency(record.yearEndBonus)}</p>}
            {record.paidLeave    > 0 && <p className="text-green-600">特休 {currency(record.paidLeave)}</p>}
          </div>
        ) : (
          <span className="text-gray-300">—</span>
        )}
      </td>

      {/* 扣除 */}
      <td className="px-4 py-3 hidden lg:table-cell">
        <p className="text-sm text-red-400 font-medium">-{currency(calc.totalDeductions)}</p>
        <p className="text-xs text-gray-400">{record.workDays} 天出勤</p>
      </td>

      {/* 實領 */}
      <td className="px-4 py-3">
        <p className="text-base font-bold text-green-600">{currency(calc.net)}</p>
        <p className="text-xs text-gray-400">應發 {currency(calc.gross)}</p>
      </td>

      {/* 給薪方式 */}
      <td className="px-4 py-3 hidden md:table-cell">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${pm.color}`}>{pm.label}</span>
      </td>

      {/* 狀態 */}
      <td className="px-4 py-3">
        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${sc.badge}`}>
          <StatusIcon size={11} /> {sc.label}
        </span>
      </td>

      <td className="px-3">
        <ChevronRight size={16} className="text-gray-300" />
      </td>
    </tr>
  )
}

// ─── Site group header row ────────────────────────────────────────────────────
function SiteGroupHeader({ siteLabel, orgId, count, subtotalNet }) {
  return (
    <tr className="bg-brand-50/70 border-t-2 border-brand-100">
      <td colSpan={2} className="px-4 py-2">
        <div className="flex items-center gap-2">
          <MapPin size={13} className="text-brand-500 shrink-0" />
          <span className="text-sm font-bold text-brand-700">{siteLabel}</span>
          <OrgBadge orgId={orgId} />
        </div>
      </td>
      <td colSpan={2} className="hidden lg:table-cell" />
      <td className="px-4 py-2">
        <p className="text-xs text-gray-500">{count} 人 · 小計</p>
        <p className="text-sm font-bold text-green-600">{currency(subtotalNet)}</p>
      </td>
      <td colSpan={3} />
    </tr>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function SalaryPage() {
  const { activeOrgId }              = useOrg()
  const { data: employeesRaw }       = useCollection(COL.EMPLOYEES)
  const { data: salaryRecordsRaw }   = useCollection(COL.SALARY_RECORDS)

  const employees     = useMemo(() => employeesRaw.filter(e => e.orgId === activeOrgId),     [employeesRaw,     activeOrgId])
  const salaryRecords = useMemo(() => salaryRecordsRaw.filter(r => r.orgId === activeOrgId), [salaryRecordsRaw, activeOrgId])

  const [month, setMonth]         = useState(() => {
    const n = new Date()
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
  })
  const [filterOrg, setOrg]       = useState('all')
  const [filterStatus, setStatus] = useState('all')
  const [selected, setSelected]   = useState(null)
  const [generating, setGenerating] = useState(false)

  const handleUpdate = async (updated) => {
    await updateSalaryRecord(updated.id, updated)
    setSelected(sel => sel ? { ...sel, record: updated } : null)
  }

  const generateRecords = async () => {
    if (!employees.length) return
    setGenerating(true)
    const [y, m] = month.split('-').map(Number)
    const daysInMonth = new Date(y, m, 0).getDate()
    for (const emp of employees.filter(e => e.status === 'active' || !e.status)) {
      const exists = salaryRecords.some(r => r.month === month && r.employeeId === emp.id)
      if (exists) continue
      await addSalaryRecord({
        orgId: activeOrgId, employeeId: emp.id, month, status: 'pending',
        paymentMethod: 'bank', workDays: daysInMonth, totalDaysInMonth: daysInMonth,
        baseSalary:       emp.baseSalary       || emp.monthlySalary || 0,
        allowance: 0, overtimePay: 0,
        yearEndBonus: 0, lunarBonus: 0, paidLeave: 0, advancePayment: 0, mobile: [],
        // 從員工資料帶入保險 / 勞退
        laborInsBracket:   emp.laborInsuredSalary      || 0,
        healthInsBracket:  emp.healthInsuredSalary     || 0,
        laborInsEmployee:  emp.laborInsuranceEmployee  || 0,
        laborInsEmployer:  emp.laborInsuranceEmployer  || 0,
        healthInsEmployee: emp.healthInsuranceEmployee || 0,
        healthInsEmployer: emp.healthInsuranceEmployer || 0,
        pensionEmployee:   emp.laborPensionEmployee    || 0,
        pensionEmployer:   emp.laborPensionEmployer    || 0,
        leaveDeduction: 0, otherDeductions: 0, advance: 0,
        note: '',
      })
    }
    setGenerating(false)
  }

  // Build rows for selected month
  const allRows = useMemo(() => salaryRecords
    .filter(r => r.month === month)
    .map(r => {
      const emp = employees.find(e => e.id === r.employeeId)
      return emp ? { record: r, employee: emp } : null
    })
    .filter(Boolean),
  [salaryRecords, employees, month])

  // Filtered rows
  const filteredRows = useMemo(() => allRows
    .filter(({ employee }) => filterOrg    === 'all' || employee.orgId === filterOrg)
    .filter(({ record })   => filterStatus === 'all' || record.status  === filterStatus),
  [allRows, filterOrg, filterStatus])

  // 依 workMode 取得分組標籤（排序優先順序：駐點 → 機動 → 內勤）
  const groupLabel = (emp) => {
    if (emp.workMode === 'stationed') return emp.stationedSite || '駐點（未指定）'
    if (emp.workMode === 'office')    return '內勤'
    return '機動員工'
  }
  const groupOrder = (emp) => {
    if (emp.workMode === 'stationed') return 0
    if (emp.workMode === 'mobile')    return 1
    return 2  // office
  }

  // Group by org + workMode-aware label
  const grouped = useMemo(() => {
    const sorted = [...filteredRows].sort((a, b) => {
      if (a.employee.orgId !== b.employee.orgId) return a.employee.orgId.localeCompare(b.employee.orgId)
      const oA = groupOrder(a.employee), oB = groupOrder(b.employee)
      if (oA !== oB) return oA - oB
      return groupLabel(a.employee).localeCompare(groupLabel(b.employee))
    })

    const groups = []
    let currentKey = null

    for (const row of sorted) {
      const label = groupLabel(row.employee)
      const key   = `${row.employee.orgId}::${label}`
      if (key !== currentKey) {
        groups.push({ siteLabel: label, orgId: row.employee.orgId, rows: [] })
        currentKey = key
      }
      groups[groups.length - 1].rows.push(row)
    }

    return groups
  }, [filteredRows])

  // Stats
  const totalGross        = allRows.reduce((s, { record, employee }) => s + calcSalary(record, employee).gross, 0)
  const totalNet          = allRows.reduce((s, { record, employee }) => s + calcSalary(record, employee).net, 0)
  const totalEmployerCost = allRows.reduce((s, { record, employee }) => s + calcSalary(record, employee).totalEmployerCosts, 0)
  const pendingCnt        = allRows.filter(({ record }) => record.status === 'pending').length

  const exportCSV = () => {
    const header = '姓名,公司,職稱,出勤天數,本薪,加給,加班費,年終,特休,代付款,機動,勞保自負,健保自負,勞退自提,請假,其他,借支,應發,扣除,實領,給薪方式,狀態\n'
    const body   = filteredRows.map(({ record, employee }) => {
      const c   = calcSalary(record, employee)
      const org = ORGS.find(o => o.id === employee.orgId)
      return [
        employee.name, org?.name, employee.position,
        record.workDays, record.baseSalary, record.allowance, record.overtimePay,
        record.yearEndBonus, record.paidLeave, record.advancePayment,
        c.mobilePay,
        record.laborInsEmployee, record.healthInsEmployee, record.pensionEmployee,
        record.leaveDeduction, record.otherDeductions, record.advance,
        c.gross, c.totalDeductions, c.net,
        PAY_METHOD[record.paymentMethod]?.label,
        STATUS[record.status]?.label,
      ].join(',')
    }).join('\n')
    const blob = new Blob(['\uFEFF' + header + body], { type: 'text/csv;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `薪資表_${month}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">

      {/* Title */}
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">薪資計算</h1>
          <p className="text-sm text-gray-500 mt-0.5">本薪・職務加給・加班費・勞健保・勞退</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <MonthNav month={month} onChange={setMonth} />
          <button
            className="btn-secondary"
            onClick={generateRecords}
            disabled={generating}
            title="為所有在職員工建立本月薪資單（已有的不重複建立）"
          >
            <Plus size={16} /> 生成薪資單
          </button>
          <button className="btn-secondary" onClick={exportCSV}><Download size={16} /> 匯出 CSV</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={DollarSign} color="blue"   label="應發薪資總計"  value={currency(totalGross)}        sub={`實領合計 ${currency(totalNet)}`} />
        <StatCard icon={Building2}  color="purple" label="雇主成本合計"  value={currency(totalEmployerCost)} sub="勞保＋健保＋勞退提撥" />
        <StatCard icon={Users}      color="green"  label="本月出薪人數"  value={`${allRows.length} 人`}      sub={`共 ${grouped.length} 個案場/分組`} />
        <StatCard
          icon={Clock}
          color={pendingCnt > 0 ? 'amber' : 'green'}
          label="待審核"
          value={pendingCnt > 0 ? `${pendingCnt} 筆` : '全數已審'}
          sub={pendingCnt > 0 ? '需管理者核准' : '本月審核完成 ✓'}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
          {[{key:'all',label:'全部'},{key:'jiaxiang',label:'佳翔'},{key:'zhexin',label:'哲欣'}].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setOrg(key)}
              className={clsx('px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                filterOrg === key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <select className="input w-auto" value={filterStatus} onChange={e => setStatus(e.target.value)}>
          <option value="all">全部狀態</option>
          <option value="pending">待審核</option>
          <option value="approved">已核准</option>
          <option value="paid">已匯款</option>
        </select>
        <p className="ml-auto text-sm text-gray-500">顯示 <span className="font-semibold">{filteredRows.length}</span> 筆</p>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {filteredRows.length === 0 ? (
          <div className="text-center py-20">
            <DollarSign size={48} className="mx-auto mb-4 text-gray-200" />
            <p className="text-gray-400 font-medium">本月尚無薪資紀錄</p>
            <p className="text-gray-400 text-sm mt-1">點擊右上角「生成薪資單」自動為所有在職員工建立</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {[
                    { label: '員工',           cls: '' },
                    { label: '本薪 / 機動',    cls: 'hidden md:table-cell' },
                    { label: '加班 / 特殊',    cls: 'hidden lg:table-cell' },
                    { label: '扣除',           cls: 'hidden lg:table-cell' },
                    { label: '實領薪資',       cls: '' },
                    { label: '給薪方式',       cls: 'hidden md:table-cell' },
                    { label: '狀態',           cls: '' },
                    { label: '',               cls: '' },
                  ].map((h, i) => (
                    <th key={i} className={`px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide ${h.cls}`}>
                      {h.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {grouped.map((group) => {
                  const groupNet = group.rows.reduce((s, { record, employee }) => s + calcSalary(record, employee).net, 0)
                  return [
                    <SiteGroupHeader
                      key={`hdr-${group.orgId}-${group.siteLabel}`}
                      siteLabel={group.siteLabel}
                      orgId={group.orgId}
                      count={group.rows.length}
                      subtotalNet={groupNet}
                    />,
                    ...group.rows.map(({ record, employee }) => (
                      <SalaryRow
                        key={record.id}
                        record={record}
                        employee={employee}
                        onClick={(r, e) => setSelected({ record: r, employee: e })}
                      />
                    )),
                  ]
                })}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 border-t-2 border-gray-200">
                  <td colSpan={2} className="px-4 py-3 text-sm font-bold text-gray-700">
                    本月合計（{filteredRows.length} 人）
                  </td>
                  <td colSpan={2} className="px-4 py-3 hidden lg:table-cell">
                    <p className="text-xs text-gray-400">雇主成本合計</p>
                    <p className="text-sm font-semibold text-purple-600">{currency(filteredRows.reduce((s, { record, employee }) => s + calcSalary(record, employee).totalEmployerCosts, 0))}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-base font-bold text-green-600">{currency(filteredRows.reduce((s, { record, employee }) => s + calcSalary(record, employee).net, 0))}</p>
                    <p className="text-xs text-gray-400">應發 {currency(filteredRows.reduce((s, { record, employee }) => s + calcSalary(record, employee).gross, 0))}</p>
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {selected && (
        <PaySlipModal
          record={selected.record}
          employee={selected.employee}
          onClose={() => setSelected(null)}
          onUpdate={handleUpdate}
        />
      )}
    </div>
  )
}
