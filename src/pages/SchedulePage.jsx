import { useState, useRef, useMemo, useEffect, useContext, createContext } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin     from '@fullcalendar/daygrid'
import timeGridPlugin    from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import {
  Plus, AlertCircle, Layers, Calendar as CalIcon, Clock,
  ChevronRight, ChevronLeft, Building2, Smartphone,
  MapPin, Banknote, X, CheckCircle, Users,
  Hash, Pencil, Trash2, CalendarDays,
} from 'lucide-react'
import {
  MOCK_SCHEDULE_INSTANCES, MOCK_SCHEDULE_TEMPLATES,
  MOCK_CUSTOMERS, MOCK_ORDERS, ORGS,
  MOCK_MOBILE_DISPATCHES, CLEANING_TYPES,
} from '../lib/mockData'
import {
  COL, updateAnnualContract,
  addShiftCode, updateShiftCode, deleteShiftCode,
  saveSchedulePlan, updateSchedulePlan,
} from '../lib/db'
import { useCollection } from '../hooks/useCollection'
import { useOrg } from '../contexts/OrgContext'
import clsx from 'clsx'

// ─── Shared contexts ──────────────────────────────────────────────────────────
const EmployeeCtx  = createContext([])
const ShiftCodeCtx = createContext([])
const useEmployees  = () => useContext(EmployeeCtx)
const useShiftCodes = () => useContext(ShiftCodeCtx)

// ─── Helpers ──────────────────────────────────────────────────────────────────
const DAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']
const TODAY_STR  = new Date().toISOString().slice(0, 10)

function getWeekDates(offset = 0) {
  const now = new Date()
  const mon = new Date(now)
  mon.setDate(now.getDate() - ((now.getDay() + 6) % 7) + offset * 7)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon)
    d.setDate(mon.getDate() + i)
    return d.toISOString().slice(0, 10)
  })
}

function currency(n) { return `$${Number(n || 0).toLocaleString()}` }

function calcMobilePay(d, employees) {
  const emp = employees.find(e => e.id === d.employeeId)
  return (emp?.dailyRate || 0) * (d.hours / 8)
}

const DISPATCH_STATUS = {
  pending:   { label: '待執行', badge: 'bg-amber-100 text-amber-700',  dot: 'bg-amber-400'  },
  completed: { label: '已完成', badge: 'bg-green-100 text-green-700',  dot: 'bg-green-400'  },
  cancelled: { label: '已取消', badge: 'bg-gray-100 text-gray-500',    dot: 'bg-gray-300'   },
}

const ALL_SITES = MOCK_CUSTOMERS.flatMap(c =>
  c.sites.map(s => ({ ...s, customerName: c.name, orgId: c.orgId }))
)


function shiftBadgeClass(label) {
  if (label.includes('早')) return 'bg-amber-100 text-amber-700'
  if (label.includes('晚')) return 'bg-indigo-100 text-indigo-700'
  return 'bg-sky-100 text-sky-700'
}

// ─── MiniCalendar (used in EditScheduleModal) ────────────────────────────────
function MiniCalendar({ year, month, dayColorMap, shiftCodes, rules }) {
  const daysInMonth = new Date(year, month, 0).getDate()
  const firstDay    = (new Date(year, month - 1, 1).getDay() + 6) % 7 // Mon=0

  const weeks = []
  let cells = Array(firstDay).fill(null)
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(d)
    if (cells.length === 7) { weeks.push(cells); cells = [] }
  }
  if (cells.length) { while (cells.length < 7) cells.push(null); weeks.push(cells) }

  const getColor = (day) => {
    const sid = dayColorMap[day]
    if (!sid) return null
    if (sid === 'dayoff') return '#d1d5db'
    return shiftCodes.find(sc => sc.id === sid)?.color || '#6b7280'
  }

  return (
    <div className="select-none">
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {['一','二','三','四','五','六','日'].map(d => (
          <div key={d} className="text-center text-[10px] text-gray-400 font-medium py-1">{d}</div>
        ))}
        {weeks.flatMap((week, wi) => week.map((day, di) => {
          const color = day ? getColor(day) : null
          return (
            <div
              key={`${wi}-${di}`}
              className={clsx(
                'w-8 h-8 rounded-full flex items-center justify-center text-[11px] mx-auto transition-colors',
                day ? 'font-medium' : 'opacity-0 pointer-events-none',
              )}
              style={color ? { backgroundColor: color, color: '#fff' } : { color: '#374151' }}
            >
              {day || ''}
            </div>
          )
        }))}
      </div>
      {/* Legend */}
      <div className="mt-3 space-y-1.5 border-t border-gray-100 pt-3">
        {rules.filter(r => r.shiftCodeId && r.dates.size > 0).map(rule => {
          const sc = rule.shiftCodeId === 'dayoff'
            ? { code: '休', label: '休假', color: '#d1d5db' }
            : shiftCodes.find(s => s.id === rule.shiftCodeId)
          if (!sc) return null
          return (
            <div key={rule.id} className="flex items-center gap-2 text-xs">
              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: sc.color }} />
              <span className="font-bold text-gray-800">{sc.code}</span>
              <span className="text-gray-500 flex-1 truncate">{sc.label}</span>
              <span className="text-gray-400">{rule.dates.size} 天</span>
            </div>
          )
        })}
        {rules.every(r => r.dates.size === 0) && (
          <p className="text-xs text-gray-300 text-center">尚未設定任何日期</p>
        )}
      </div>
    </div>
  )
}

// ─── RuleRow (used in EditScheduleModal) ──────────────────────────────────────
function RuleRow({ rule, index, daysInMonth, onSetShift, onToggleDate, onRemove }) {
  const shiftCodes = useShiftCodes()
  const sc = rule.shiftCodeId === 'dayoff'
    ? { code: '休', label: '休假', color: '#d1d5db', startTime: '', endTime: '' }
    : shiftCodes.find(s => s.id === rule.shiftCodeId)

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-400 font-bold w-5 shrink-0">{index + 1}</span>
        <select
          value={rule.shiftCodeId}
          onChange={e => onSetShift(e.target.value)}
          className="input flex-1 text-sm max-w-xs"
        >
          <option value="">選擇班次…</option>
          <option value="dayoff">休假 / 補休</option>
          {shiftCodes.map(s => (
            <option key={s.id} value={s.id}>
              {s.code}｜{s.label}　{s.startTime}–{s.endTime}
            </option>
          ))}
        </select>
        {sc && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500 shrink-0">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: sc.color }} />
            {rule.shiftCodeId !== 'dayoff' && <span>{sc.startTime}–{sc.endTime}</span>}
          </div>
        )}
        <button onClick={onRemove} className="text-gray-300 hover:text-red-400 ml-auto shrink-0">
          <X size={15} />
        </button>
      </div>
      {/* Day chips */}
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => (
          <button
            key={day}
            onClick={() => onToggleDate(day)}
            className={clsx(
              'w-7 h-7 rounded-full text-[11px] font-medium transition-all border',
              rule.dates.has(day)
                ? 'text-white border-transparent shadow-sm'
                : 'text-gray-500 border-gray-200 hover:border-gray-400 bg-white',
            )}
            style={rule.dates.has(day) ? { backgroundColor: sc?.color || '#6b7280' } : {}}
          >
            {day}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── EditScheduleModal ────────────────────────────────────────────────────────
function EditScheduleModal({ annualContracts, existingPlans, onClose }) {
  const employees  = useEmployees()
  const shiftCodes = useShiftCodes()
  const { activeOrgId } = useOrg()

  const [siteKey, setSiteKey]   = useState('')
  const [empId,   setEmpId]     = useState('')
  const [saveMsg, setSaveMsg]   = useState('')
  const [saving,  setSaving]    = useState(false)
  const [month,   setMonth]     = useState(() => {
    const n = new Date()
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
  })
  const [rules, setRules] = useState([
    { id: `r${Date.now()}`, shiftCodeId: '', dates: new Set() }
  ])

  const [y, m] = month.split('-').map(Number)
  const daysInMonth = new Date(y, m, 0).getDate()

  const prevMonth = () => setMonth(month === `${y}-01` ? `${y-1}-12` : `${y}-${String(m-1).padStart(2,'0')}`)
  const nextMonth = () => setMonth(m  === 12 ? `${y+1}-01` : `${y}-${String(m+1).padStart(2,'0')}`)

  // Build site list from employees' stationedSite values — this guarantees the
  // employee filter will always match because we use the same source field.
  // Also merge in annual contract sites so sites without employees yet still appear.
  const allContractSites = useMemo(() => {
    const map = new Map()
    // 1. Annual contract sites (primary, carry siteId for plan matching)
    annualContracts.forEach(c =>
      (c.sites || []).forEach(s => {
        if (!s.name) return
        if (!map.has(s.name)) {
          map.set(s.name, {
            key: s.name,
            siteId: s.id || s.name,
            siteName: s.name,
            contractTitle: c.title,
          })
        }
      })
    )
    // 2. Employee stationedSite values (fill in any site not in contracts)
    employees.forEach(e => {
      if (e.stationedSite && !map.has(e.stationedSite)) {
        map.set(e.stationedSite, {
          key: e.stationedSite,
          siteId: e.stationedSite,
          siteName: e.stationedSite,
          contractTitle: '',
        })
      }
    })
    return [...map.values()].sort((a, b) => a.siteName.localeCompare(b.siteName, 'zh-TW'))
  }, [annualContracts, employees])

  const selectedSite = allContractSites.find(s => s.key === siteKey)

  // Reset employee when site changes
  useEffect(() => { setEmpId('') }, [siteKey])

  // Employees for this site — match by stationedSite name (same field used in EmployeesPage)
  const siteEmployees = useMemo(() => {
    if (!selectedSite) return []
    return employees.filter(e =>
      (!e.status || e.status === 'active') &&
      e.stationedSite === selectedSite.siteName
    )
  }, [employees, selectedSite])

  // Load existing plan when site + employee + month changes
  // Match by siteName (most reliable) — falls back to siteId for older records
  useEffect(() => {
    if (!selectedSite || !empId) return
    const plan = existingPlans.find(p =>
      p.orgId === activeOrgId &&
      (p.siteName === selectedSite.siteName || p.siteId === selectedSite.siteId) &&
      p.employeeId === empId &&
      p.month === month
    )
    if (plan?.rules?.length) {
      setRules(plan.rules.map(r => ({ ...r, dates: new Set(r.dates) })))
    } else {
      setRules([{ id: `r${Date.now()}`, shiftCodeId: '', dates: new Set() }])
    }
  }, [siteKey, empId, month])

  // Calendar color map
  const dayColorMap = useMemo(() => {
    const map = {}
    rules.forEach(rule => {
      rule.dates.forEach(d => { if (!map[d]) map[d] = rule.shiftCodeId })
    })
    return map
  }, [rules])

  const addRule    = () => setRules(prev => [...prev, { id: `r${Date.now()}`, shiftCodeId: '', dates: new Set() }])
  const removeRule = id  => setRules(prev => prev.filter(r => r.id !== id))
  const setShift   = (id, sid) => setRules(prev => prev.map(r => r.id === id ? { ...r, shiftCodeId: sid } : r))
  const toggleDate = (id, day) => setRules(prev => prev.map(r => {
    if (r.id !== id) return r
    const d = new Set(r.dates)
    d.has(day) ? d.delete(day) : d.add(day)
    return { ...r, dates: d }
  }))

  const handleSave = async () => {
    if (!selectedSite || !empId) {
      setSaveMsg('請先選擇案場與員工')
      return
    }
    setSaving(true)
    setSaveMsg('')
    try {
      const serialized = rules.map(r => ({ ...r, dates: [...r.dates].sort((a,b) => a-b) }))
      const existing = existingPlans.find(p =>
        p.orgId === activeOrgId &&
        (p.siteName === selectedSite.siteName || p.siteId === selectedSite.siteId) &&
        p.employeeId === empId &&
        p.month === month
      )
      if (existing) {
        await updateSchedulePlan(existing.id, { rules: serialized, updatedAt: new Date() })
      } else {
        await saveSchedulePlan({
          orgId: activeOrgId,
          siteId: selectedSite.siteId,
          siteName: selectedSite.siteName,
          employeeId: empId,
          month,
          rules: serialized,
        })
      }
      setSaving(false)
      onClose()
    } catch (err) {
      console.error('儲存班表失敗', err)
      setSaveMsg(`儲存失敗：${err.message || '請稍後再試'}`)
      setSaving(false)
    }
  }

  const empName = employees.find(e => e.id === empId)?.name || ''

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <CalendarDays size={16} className="text-green-600" /> 編輯駐點班表
            </h2>
            {selectedSite && empName && (
              <p className="text-xs text-gray-400 mt-0.5">{selectedSite.siteName} · {empName} · {y}年{m}月</p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        {/* Controls row */}
        <div className="px-6 py-3 border-b border-gray-100 flex flex-wrap items-center gap-3 shrink-0 bg-gray-50">
          <select className="input w-auto text-sm" value={siteKey} onChange={e => { setSiteKey(e.target.value); setEmpId('') }}>
            <option value="">選擇案場…</option>
            {allContractSites.map(s => (
              <option key={s.key} value={s.key}>
                {s.siteName}{s.contractTitle ? `（${s.contractTitle}）` : ''}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl px-3 py-2">
            <button onClick={prevMonth} className="p-0.5 hover:bg-gray-100 rounded-lg"><ChevronLeft size={15} /></button>
            <span className="text-sm font-semibold text-gray-800 w-20 text-center">{y} 年 {m} 月</span>
            <button onClick={nextMonth} className="p-0.5 hover:bg-gray-100 rounded-lg"><ChevronRight size={15} /></button>
          </div>
        </div>

        {/* Employee chips */}
        <div className="px-6 py-3 border-b border-gray-100 flex gap-2 flex-wrap shrink-0">
          <span className="text-xs text-gray-500 self-center mr-1">員工：</span>
          {siteEmployees.length === 0 && <span className="text-xs text-gray-400">請先選擇案場</span>}
          {siteEmployees.map(e => (
            <button
              key={e.id}
              onClick={() => setEmpId(e.id)}
              className={clsx(
                'px-3 py-1 rounded-full text-sm font-medium border transition-colors',
                empId === e.id
                  ? 'bg-brand-600 text-white border-brand-600'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400',
              )}
            >
              {e.name}
              {e.stationedSite === selectedSite?.siteName && (
                <span className="ml-1 text-[10px] opacity-70">駐</span>
              )}
            </button>
          ))}
        </div>

        {/* Main: Calendar + Rules */}
        <div className="flex-1 overflow-y-auto min-h-0 flex gap-0">
          {/* Left: Mini Calendar */}
          <div className="w-64 shrink-0 border-r border-gray-100 p-5 bg-gray-50">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">班表預覽</p>
            <MiniCalendar
              year={y} month={m}
              dayColorMap={dayColorMap}
              shiftCodes={shiftCodes}
              rules={rules}
            />
          </div>

          {/* Right: Rules */}
          <div className="flex-1 p-5 space-y-3 overflow-y-auto">
            {(!siteKey || !empId) ? (
              <div className="h-48 flex items-center justify-center text-gray-300 text-sm">
                請先選擇案場與員工
              </div>
            ) : (
              <>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">班次規則</p>
                {rules.map((rule, idx) => (
                  <RuleRow
                    key={rule.id}
                    rule={rule} index={idx}
                    daysInMonth={daysInMonth}
                    onSetShift={sid  => setShift(rule.id, sid)}
                    onToggleDate={day => toggleDate(rule.id, day)}
                    onRemove={() => removeRule(rule.id)}
                  />
                ))}
                <button onClick={addRule} className="btn-secondary text-sm w-full justify-center">
                  <Plus size={14} /> 新增規則列
                </button>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center gap-3 shrink-0">
          {saveMsg && <p className="text-sm text-red-500 flex-1">{saveMsg}</p>}
          <div className="flex gap-3 ml-auto">
            <button className="btn-secondary" onClick={onClose}>取消</button>
            <button
              className="btn-primary"
              onClick={handleSave}
              disabled={saving || !siteKey || !empId}
            >
              {saving ? '儲存中…' : '儲存班表'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── ShiftManager (班次管理 Tab) ──────────────────────────────────────────────
function ShiftManager() {
  const { activeOrgId } = useOrg()
  const shiftCodes = useShiftCodes()

  const PRESET_COLORS = ['#3b82f6','#22c55e','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#6b7280']

  const [code,      setCode]      = useState('')
  const [label,     setLabel]     = useState('')
  const [startTime, setStartTime] = useState('08:00')
  const [endTime,   setEndTime]   = useState('17:00')
  const [color,     setColor]     = useState(PRESET_COLORS[0])
  const [editId,    setEditId]    = useState(null)
  const [saving,    setSaving]    = useState(false)

  const resetForm = () => { setCode(''); setLabel(''); setStartTime('08:00'); setEndTime('17:00'); setColor(PRESET_COLORS[0]); setEditId(null) }

  const startEdit = (sc) => {
    setEditId(sc.id); setCode(sc.code); setLabel(sc.label || '');
    setStartTime(sc.startTime); setEndTime(sc.endTime); setColor(sc.color || PRESET_COLORS[0])
  }

  const handleSave = async () => {
    if (!code.trim() || !startTime || !endTime) return
    setSaving(true)
    const data = { orgId: activeOrgId, code: code.trim().toUpperCase(), label: label.trim() || code.trim(), startTime, endTime, color }
    if (editId) { await updateShiftCode(editId, data) } else { await addShiftCode(data) }
    resetForm(); setSaving(false)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('確認刪除此班次代號？')) return
    await deleteShiftCode(id)
  }

  return (
    <div className="space-y-5">
      {/* Form */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <Hash size={14} /> {editId ? '編輯班次代號' : '新增班次代號'}
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div>
            <label className="label text-xs">代號 *</label>
            <input className="input font-mono font-bold" placeholder="A" value={code} onChange={e => setCode(e.target.value)} maxLength={4} />
          </div>
          <div>
            <label className="label text-xs">名稱</label>
            <input className="input" placeholder="日班" value={label} onChange={e => setLabel(e.target.value)} />
          </div>
          <div>
            <label className="label text-xs">開始時間 *</label>
            <input className="input" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
          </div>
          <div>
            <label className="label text-xs">結束時間 *</label>
            <input className="input" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
          </div>
          <div>
            <label className="label text-xs">顏色</label>
            <div className="flex gap-1.5 flex-wrap pt-1">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={clsx('w-6 h-6 rounded-full border-2 transition-transform',
                    color === c ? 'border-gray-800 scale-110' : 'border-transparent hover:scale-105'
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-4">
          <button onClick={handleSave} disabled={saving || !code || !startTime || !endTime} className="btn-primary">
            {saving ? '儲存中…' : editId ? '更新' : '新增班次'}
          </button>
          {editId && <button onClick={resetForm} className="btn-secondary">取消編輯</button>}
        </div>
      </div>

      {/* List */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-700">班次代號一覽</h3>
        </div>
        {shiftCodes.length === 0 ? (
          <div className="p-12 text-center text-gray-300 text-sm">尚無班次代號，請新增</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {shiftCodes.map(sc => (
              <div key={sc.id} className="flex items-center gap-4 px-4 py-3">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: sc.color }} />
                <span
                  className="text-base font-bold font-mono w-12 shrink-0 px-2 py-0.5 rounded text-white text-center text-sm"
                  style={{ backgroundColor: sc.color }}
                >
                  {sc.code}
                </span>
                <span className="font-medium text-gray-800 w-20 shrink-0">{sc.label}</span>
                <span className="text-gray-500 text-sm flex-1">
                  <Clock size={11} className="inline mr-1" />{sc.startTime} – {sc.endTime}
                </span>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => startEdit(sc)} className="btn-secondary text-xs py-1 px-2.5">
                    <Pencil size={12} /> 編輯
                  </button>
                  <button onClick={() => handleDelete(sc.id)} className="text-gray-300 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── TemplateCard ─────────────────────────────────────────────────────────────
function TemplateCard({ tpl }) {
  const employees = useEmployees()
  const emp   = employees.filter(e => tpl.employeeIds.includes(e.id))
  const days  = ['日','一','二','三','四','五','六']
  const order = MOCK_ORDERS.find(o => o.id === tpl.orderId)
  return (
    <div className="card p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className="w-2 self-stretch rounded-full shrink-0" style={{ backgroundColor: tpl.color }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-sm text-gray-900">{tpl.name}</p>
            <span className="badge badge-green shrink-0">駐點樣板</span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{order?.title || '—'}</p>
          <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
            <Clock size={11} />
            每週 {tpl.daysOfWeek.map(d => days[d]).join('、')} · {tpl.startTime}–{tpl.endTime}
          </div>
          <div className="flex flex-wrap gap-1 mt-2">
            {emp.map(e => <span key={e.id} className="badge badge-gray">{e.name}</span>)}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Shift definitions ─────────────────────────────────────────────────────────
const SHIFTS = [
  {
    key: 'morning',
    label: '早班',
    timeHint: '00:00–11:59',
    check: t => t < '12:00',
    rowBg: 'bg-amber-50/50',
    badge: 'bg-amber-100 text-amber-700',
    dot: 'bg-amber-400',
  },
  {
    key: 'afternoon',
    label: '午班',
    timeHint: '12:00–17:59',
    check: t => t >= '12:00' && t < '18:00',
    rowBg: 'bg-sky-50/50',
    badge: 'bg-sky-100 text-sky-700',
    dot: 'bg-sky-400',
  },
  {
    key: 'night',
    label: '晚班',
    timeHint: '18:00 以後',
    check: t => t >= '18:00',
    rowBg: 'bg-indigo-50/50',
    badge: 'bg-indigo-100 text-indigo-700',
    dot: 'bg-indigo-400',
  },
]

// ─── Reusable instance card (used in both grid modes) ──────────────────────────
function InstCard({ inst, onClick }) {
  const employees = useEmployees()
  const emps = employees.filter(e => inst.employeeIds?.includes(e.id))
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white rounded-lg border border-gray-100
                 px-2 py-1.5 shadow-sm hover:shadow-md hover:border-gray-300 transition-all"
    >
      <div className="text-[10px] text-gray-400 mb-1">{inst.startTime}–{inst.endTime}</div>
      <div className="flex flex-wrap gap-1">
        {emps.map(e => (
          <span key={e.id} className="inline-flex items-center text-[10px] font-medium bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded-full">
            {e.name}
          </span>
        ))}
      </div>
    </button>
  )
}

// ─── Weekly Site Grid (駐點週表) — 從 schedulePlans 渲染 ────────────────────────
function WeeklySiteGrid({ schedulePlans, selectedSite = 'all' }) {
  const employees  = useEmployees()
  const shiftCodes = useShiftCodes()
  const [weekOffset, setWeekOffset] = useState(0)

  const weekDates  = useMemo(() => getWeekDates(weekOffset), [weekOffset])
  const isSingleSite = selectedSite !== 'all'
  const weekLabel  = `${weekDates[0].slice(5).replace('-','/')} – ${weekDates[6].slice(5).replace('-','/')}`

  // Plans filtered to selected site
  const sitePlans = useMemo(() =>
    isSingleSite
      ? schedulePlans.filter(p => p.siteName === selectedSite || p.siteId === selectedSite)
      : schedulePlans,
    [schedulePlans, selectedSite, isSingleSite]
  )

  // All unique site names across all plans (for all-sites mode)
  const allSiteNames = useMemo(() => {
    const s = new Set(schedulePlans.map(p => p.siteName).filter(Boolean))
    return [...s].sort((a, b) => a.localeCompare(b, 'zh-TW'))
  }, [schedulePlans])

  // Employees stationed at the selected site
  const siteEmployees = useMemo(() =>
    isSingleSite
      ? employees.filter(e => (!e.status || e.status === 'active') && e.stationedSite === selectedSite)
      : [],
    [employees, selectedSite, isSingleSite]
  )

  // Get shift code for an employee's plan on a given date
  const getShiftEntry = (plan, dateStr) => {
    const monthStr = dateStr.slice(0, 7)
    const dayNum   = parseInt(dateStr.slice(8), 10)
    if (plan.month !== monthStr) return null
    const rule = plan.rules?.find(r => r.dates?.includes(dayNum))
    if (!rule) return null
    if (!rule.shiftCodeId) return { isOff: true, sc: null }
    return { isOff: false, sc: shiftCodes.find(s => s.id === rule.shiftCodeId) || null }
  }

  const renderDayHeaders = () => weekDates.map(date => {
    const isToday   = date === TODAY_STR
    const dayIdx    = new Date(date + 'T00:00:00').getDay()
    const isWeekend = dayIdx === 0 || dayIdx === 6
    return (
      <th key={date} className={clsx(
        'text-center px-2 py-3 font-medium min-w-[100px]',
        isToday ? 'text-brand-700' : isWeekend ? 'text-red-400' : 'text-gray-500',
      )}>
        <div className="text-[11px]">週{DAY_LABELS[dayIdx]}</div>
        <div className={clsx(
          'inline-flex items-center justify-center w-7 h-7 rounded-full mt-0.5 text-sm font-bold',
          isToday ? 'bg-brand-600 text-white' : 'text-gray-700',
        )}>
          {date.slice(8)}
        </div>
      </th>
    )
  })

  return (
    <div className="card overflow-hidden">
      {/* Week navigator */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50/60">
        <button onClick={() => setWeekOffset(w => w - 1)} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-500 transition-colors">
          <ChevronLeft size={16} />
        </button>
        <div className="text-center">
          {isSingleSite && <p className="text-xs font-semibold text-gray-600 mb-0.5">{selectedSite}</p>}
          <p className="text-sm font-semibold text-gray-800">{weekLabel}</p>
          {weekOffset !== 0 && (
            <button onClick={() => setWeekOffset(0)} className="text-xs text-brand-600 hover:underline mt-0.5">回本週</button>
          )}
        </div>
        <button onClick={() => setWeekOffset(w => w + 1)} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-500 transition-colors">
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[760px]">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-4 py-3 text-gray-500 font-medium w-32">
                {isSingleSite ? '員工' : '案場'}
              </th>
              {renderDayHeaders()}
            </tr>
          </thead>
          <tbody>
            {isSingleSite ? (
              siteEmployees.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-400">
                    此案場尚無駐點員工，請在員工資料設定主要駐點案場
                  </td>
                </tr>
              ) : (
                siteEmployees.map(emp => {
                  const empPlan = sitePlans.find(p => p.employeeId === emp.id)
                  return (
                    <tr key={emp.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">{emp.name}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{emp.position || ''}</p>
                      </td>
                      {weekDates.map(date => {
                        const isToday   = date === TODAY_STR
                        const dayIdx    = new Date(date + 'T00:00:00').getDay()
                        const isWeekend = dayIdx === 0 || dayIdx === 6
                        const entry     = empPlan ? getShiftEntry(empPlan, date) : null
                        return (
                          <td key={date} className={clsx(
                            'px-2 py-2 align-middle text-center',
                            isToday   && 'bg-brand-50/40',
                            isWeekend && 'bg-rose-50/20',
                          )}>
                            {entry?.isOff ? (
                              <span className="text-[11px] font-bold text-rose-400">休</span>
                            ) : entry?.sc ? (
                              <div className="inline-flex flex-col items-center gap-0.5">
                                <span
                                  className="text-[11px] font-bold px-2 py-0.5 rounded-full text-white"
                                  style={{ backgroundColor: entry.sc.color || '#6b7280' }}
                                >
                                  {entry.sc.code}
                                </span>
                                <span className="text-[10px] text-gray-400">{entry.sc.startTime}–{entry.sc.endTime}</span>
                              </div>
                            ) : (
                              <span className="text-gray-200">—</span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })
              )
            ) : (
              allSiteNames.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-400">尚無班表資料，請先編輯班表</td>
                </tr>
              ) : (
                allSiteNames.map(siteName => {
                  const plans = schedulePlans.filter(p => p.siteName === siteName)
                  return (
                    <tr key={siteName} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-medium text-gray-800">{siteName}</td>
                      {weekDates.map(date => {
                        const isToday   = date === TODAY_STR
                        const dayIdx    = new Date(date + 'T00:00:00').getDay()
                        const isWeekend = dayIdx === 0 || dayIdx === 6
                        const monthStr  = date.slice(0, 7)
                        const dayNum    = parseInt(date.slice(8), 10)
                        const working   = plans.filter(p => {
                          if (p.month !== monthStr) return false
                          const rule = p.rules?.find(r => r.dates?.includes(dayNum))
                          return rule && rule.shiftCodeId
                        })
                        const empNames = working
                          .map(p => employees.find(e => e.id === p.employeeId)?.name)
                          .filter(Boolean)
                        return (
                          <td key={date} className={clsx(
                            'px-2 py-2 align-top text-center',
                            isToday   && 'bg-brand-50/40',
                            isWeekend && 'bg-rose-50/20',
                          )}>
                            {empNames.length === 0 ? (
                              <span className="text-gray-200">—</span>
                            ) : (
                              <div className="space-y-0.5">
                                {empNames.map(n => (
                                  <div key={n} className="text-[10px] bg-green-50 text-green-700 rounded px-1 py-0.5 font-medium">{n}</div>
                                ))}
                              </div>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })
              )
            )}
          </tbody>
        </table>
      </div>

      {/* Shift code legend */}
      {isSingleSite && shiftCodes.length > 0 && (
        <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50 flex flex-wrap items-center gap-3 text-xs text-gray-500">
          {shiftCodes.map(sc => (
            <span key={sc.id} className="flex items-center gap-1.5">
              <span
                className="font-bold px-1.5 py-0.5 rounded-full text-white text-[10px]"
                style={{ backgroundColor: sc.color || '#6b7280' }}
              >
                {sc.code}
              </span>
              {sc.label} {sc.startTime}–{sc.endTime}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Month Shift Calendar (單一案場月曆，每格顯示員工班次) ─────────────────────
function MonthShiftCalendar({ schedulePlans, selectedSite }) {
  const employees  = useEmployees()
  const shiftCodes = useShiftCodes()
  const [monthOffset, setMonthOffset] = useState(0)

  const { label, days, year, mo, monthStr } = useMemo(() => {
    const now  = new Date()
    const base = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1)
    const y    = base.getFullYear()
    const m    = base.getMonth()
    const firstWeekday = (base.getDay() + 6) % 7
    const daysInMonth  = new Date(y, m + 1, 0).getDate()
    const totalCells   = Math.ceil((firstWeekday + daysInMonth) / 7) * 7
    const cells = Array.from({ length: totalCells }, (_, i) => {
      const d = i - firstWeekday + 1
      return (d < 1 || d > daysInMonth) ? null : d
    })
    const mStr = `${y}-${String(m + 1).padStart(2, '0')}`
    return { label: `${y} 年 ${m + 1} 月`, days: cells, year: y, mo: m + 1, monthStr: mStr }
  }, [monthOffset])

  // Plans for this site and month
  const sitePlans = useMemo(() =>
    schedulePlans.filter(p =>
      (p.siteName === selectedSite || p.siteId === selectedSite) && p.month === monthStr
    ), [schedulePlans, selectedSite, monthStr])

  const getDayEntries = (dayNum) =>
    sitePlans.flatMap(plan => {
      const rule = plan.rules?.find(r => r.dates?.includes(dayNum))
      if (!rule) return []
      const emp = employees.find(e => e.id === plan.employeeId)
      if (!emp) return []
      if (!rule.shiftCodeId) return [{ emp, sc: null, isOff: true }]
      const sc = shiftCodes.find(s => s.id === rule.shiftCodeId)
      return [{ emp, sc, isOff: false }]
    })

  const WEEK_LABELS = ['一','二','三','四','五','六','日']
  const rows = days.length / 7

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50/60">
        <button onClick={() => setMonthOffset(o => o - 1)} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-500 transition-colors">
          <ChevronLeft size={16} />
        </button>
        <div className="text-center">
          <p className="text-xs font-semibold text-gray-500 mb-0.5">{selectedSite}</p>
          <p className="text-sm font-semibold text-gray-800">{label}</p>
          {monthOffset !== 0 && (
            <button onClick={() => setMonthOffset(0)} className="text-xs text-brand-600 hover:underline mt-0.5">回本月</button>
          )}
        </div>
        <button onClick={() => setMonthOffset(o => o + 1)} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-500 transition-colors">
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] border-collapse">
          <thead>
            <tr className="border-b border-gray-100">
              {WEEK_LABELS.map((d, i) => (
                <th key={d} className={clsx('text-center py-2 text-xs font-medium w-[14.28%]', i >= 5 ? 'text-red-400' : 'text-gray-500')}>
                  週{d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }, (_, row) => (
              <tr key={row} className="border-b border-gray-100 last:border-0">
                {days.slice(row * 7, row * 7 + 7).map((dayNum, col) => {
                  if (!dayNum) return <td key={col} className="bg-gray-50/50 p-2" />
                  const dateStr   = `${String(year).padStart(4,'0')}-${String(mo).padStart(2,'0')}-${String(dayNum).padStart(2,'0')}`
                  const isToday   = dateStr === TODAY_STR
                  const isWeekend = col >= 5
                  const entries   = getDayEntries(dayNum)
                  return (
                    <td key={col} className={clsx(
                      'align-top border-r border-gray-50 last:border-0 p-2',
                      isWeekend && 'bg-rose-50/20',
                      isToday   && 'bg-brand-50/40',
                    )}>
                      <div className="mb-1">
                        <span className={clsx(
                          'inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold',
                          isToday ? 'bg-brand-600 text-white' : isWeekend ? 'text-red-400' : 'text-gray-600',
                        )}>
                          {dayNum}
                        </span>
                      </div>
                      <div className="space-y-0.5">
                        {entries.length === 0 ? (
                          <p className="text-[10px] text-gray-200">—</p>
                        ) : entries.map(({ emp, sc, isOff }) => (
                          <div key={emp.id} className="flex items-center gap-1 min-w-0">
                            {isOff ? (
                              <span className="text-[10px] font-bold text-rose-400 shrink-0">休</span>
                            ) : sc ? (
                              <span
                                className="text-[10px] font-bold px-1 py-0.5 rounded text-white shrink-0"
                                style={{ backgroundColor: sc.color || '#6b7280' }}
                              >
                                {sc.code}
                              </span>
                            ) : null}
                            <span className="text-[10px] text-gray-700 truncate">{emp.name}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {shiftCodes.length > 0 && (
        <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50 flex flex-wrap items-center gap-3 text-xs text-gray-500">
          {shiftCodes.map(sc => (
            <span key={sc.id} className="flex items-center gap-1.5">
              <span
                className="font-bold px-1.5 py-0.5 rounded text-white text-[10px]"
                style={{ backgroundColor: sc.color || '#6b7280' }}
              >
                {sc.code}
              </span>
              {sc.label} {sc.startTime}–{sc.endTime}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── 新增駐點班次 Modal ───────────────────────────────────────────────────────
function AddStationedModal({ defaultDate, annualContracts = [], onClose }) {
  const employees = useEmployees()
  const [siteId,      setSiteId]      = useState('')
  const [shiftId,     setShiftId]     = useState('')
  const [date,        setDate]        = useState(defaultDate || '')
  const [empIds,      setEmpIds]      = useState(new Set())
  const [manualStart, setManualStart] = useState('08:00')
  const [manualEnd,   setManualEnd]   = useState('17:00')

  // 從 Firestore 年度合約動態建立案場清單
  const contractSites = useMemo(() =>
    annualContracts.flatMap(c =>
      (c.sites || []).map(s => ({
        id: s.id, name: s.name,
        contractTitle: c.title,
        shifts: s.shifts || [],
      }))
    )
  , [annualContracts])

  // 查該案場在合約中設定的班次（無班次 → null → 手動輸入）
  const contractShifts = useMemo(() => {
    if (!siteId) return null
    const found = contractSites.find(s => s.id === siteId)
    return found?.shifts?.length > 0 ? found.shifts : null
  }, [siteId, contractSites])

  const selectedShift = contractShifts?.find(s => s.id === shiftId)

  const handleSiteChange = (id) => { setSiteId(id); setShiftId(''); setEmpIds(new Set()) }

  const toggleEmp = (id) => setEmpIds(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  // 班次確定後（合約班次已選 or 手動時段已填）才顯示員工列表
  const shiftReady = contractShifts ? !!shiftId : !!(manualStart && manualEnd)

  // 顯示時段摘要
  const timeLabel = selectedShift
    ? `${selectedShift.startTime} – ${selectedShift.endTime}`
    : (manualStart && manualEnd ? `${manualStart} – ${manualEnd}` : '')

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 my-4">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">新增駐點班次</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={20} /></button>
        </div>

        <div className="space-y-4">
          {/* ① 選擇案場 */}
          <div>
            <label className="label">① 選擇案場 *</label>
            <select
              className="input"
              value={siteId}
              onChange={e => handleSiteChange(e.target.value)}
            >
              <option value="">選擇案場…</option>
              {contractSites.length > 0 && (
                <optgroup label="年度合約案場">
                  {contractSites.map(s => (
                    <option key={s.id} value={s.id}>{s.name}（{s.contractTitle}）</option>
                  ))}
                </optgroup>
              )}
              <optgroup label="其他案場">
                {ALL_SITES.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* ② 班次選擇（合約案場：選按鈕；其他：手動輸入時段）*/}
          {siteId && (
            <div>
              <label className="label">
                {contractShifts ? '② 選擇班次 *' : '② 設定時段 *'}
              </label>

              {contractShifts ? (
                /* 合約預設班次 — 只需點選 */
                <div className="space-y-2">
                  {contractShifts.map(shift => {
                    const isSelected = shiftId === shift.id
                    return (
                      <button
                        key={shift.id}
                        type="button"
                        onClick={() => setShiftId(shift.id)}
                        className={clsx(
                          'w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all',
                          isSelected
                            ? 'border-brand-500 bg-brand-50 shadow-sm'
                            : 'border-gray-200 hover:border-gray-300 bg-white',
                        )}
                      >
                        <span className={clsx(
                          'text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0',
                          shiftBadgeClass(shift.label),
                        )}>
                          {shift.label}
                        </span>
                        <span className="text-sm font-medium text-gray-800 flex items-center gap-1.5">
                          <Clock size={13} className="text-gray-400" />
                          {shift.startTime} – {shift.endTime}
                        </span>
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Users size={12} /> 需 {shift.headcount} 人
                        </span>
                        {isSelected && (
                          <CheckCircle size={16} className="text-brand-600 ml-auto shrink-0" />
                        )}
                      </button>
                    )
                  })}
                  {shiftId && (
                    <p className="text-[11px] text-green-600 flex items-center gap-1 pl-1">
                      <CheckCircle size={11} /> 時段已從合約設定自動帶入，無需手動輸入
                    </p>
                  )}
                </div>
              ) : (
                /* 非合約案場 — 手動輸入時段 */
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label text-xs">開始時間</label>
                    <input className="input" type="time" value={manualStart} onChange={e => setManualStart(e.target.value)} />
                  </div>
                  <div>
                    <label className="label text-xs">結束時間</label>
                    <input className="input" type="time" value={manualEnd}   onChange={e => setManualEnd(e.target.value)} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ③ 日期 */}
          {siteId && (
            <div>
              <label className="label">③ 排班日期 *</label>
              <input
                className="input"
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
              />
            </div>
          )}

          {/* ④ 勾選員工（班次 + 日期都確定後才顯示）*/}
          {siteId && shiftReady && date && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label mb-0">
                  ④ 勾選員工 *
                  {timeLabel && (
                    <span className="ml-2 text-[11px] font-normal text-gray-400">
                      {timeLabel}
                    </span>
                  )}
                </label>
                {selectedShift && (
                  <span className={clsx(
                    'text-xs font-semibold',
                    empIds.size < selectedShift.headcount ? 'text-amber-600' : 'text-green-600',
                  )}>
                    {empIds.size} / {selectedShift.headcount} 人
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto">
                {employees.filter(e => !e.status || e.status === 'active').map(e => {
                  const checked = empIds.has(e.id)
                  return (
                    <label key={e.id} className={clsx(
                      'flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-colors',
                      checked ? 'border-brand-400 bg-brand-50' : 'border-gray-200 hover:bg-gray-50',
                    )}>
                      <input
                        type="checkbox"
                        className="accent-brand-600"
                        checked={checked}
                        onChange={() => toggleEmp(e.id)}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{e.name}</p>
                        <p className="text-[10px] text-gray-400">
                          {e.workMode === 'stationed' ? '駐點' : '機動'}
                        </p>
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>
          )}

          {/* Conflict notice */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700 flex items-start gap-2">
            <AlertCircle size={13} className="mt-0.5 shrink-0" />
            系統將自動偵測員工時段衝突。手動新增班次僅影響該日，不影響長期樣板。
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button className="btn-secondary" onClick={onClose}>取消</button>
          <button
            className="btn-primary"
            disabled={!siteId || !shiftReady || !date || empIds.size === 0}
            onClick={onClose}
          >
            確認新增
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── 駐點班表 View ─────────────────────────────────────────────────────────────
function StationedView({ annualContracts, schedulePlans = [] }) {
  const employees = useEmployees()
  const [subView, setSubView]             = useState('weekly')
  const [showEditSchedule, setShowEditSchedule] = useState(false)
  const [selectedSite, setSelSite]        = useState('all')

  // Site list from annual contracts + employees' stationedSite
  const allSites = useMemo(() => {
    const map = new Map()
    annualContracts.forEach(c =>
      (c.sites || []).forEach(s => {
        if (s.name && !map.has(s.name)) map.set(s.name, { id: s.name, name: s.name })
      })
    )
    employees.forEach(e => {
      if (e.stationedSite && !map.has(e.stationedSite))
        map.set(e.stationedSite, { id: e.stationedSite, name: e.stationedSite })
    })
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'zh-TW'))
  }, [annualContracts, employees])

  const SUB_TABS = [
    { key: 'weekly',   label: '週表', icon: Building2 },
    { key: 'calendar', label: '月曆', icon: CalIcon   },
  ]

  return (
    <div className="space-y-4">
      {/* Sub-tabs + site filter + edit button */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
          {SUB_TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setSubView(key)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                subView === key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700',
              )}
            >
              <Icon size={14} />{label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <MapPin size={14} className="text-gray-400 shrink-0" />
          <select
            className="input w-auto text-sm py-1.5"
            value={selectedSite}
            onChange={e => setSelSite(e.target.value)}
          >
            <option value="all">全部案場</option>
            {allSites.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div className="flex-1" />
        <button className="btn-primary" onClick={() => setShowEditSchedule(true)}>
          <CalendarDays size={16} /> 編輯班表
        </button>
      </div>

      {/* Weekly grid (all sites or single site — employees as rows) */}
      {subView === 'weekly' && (
        <WeeklySiteGrid schedulePlans={schedulePlans} selectedSite={selectedSite} />
      )}

      {/* Monthly calendar — requires a site to be selected */}
      {subView === 'calendar' && selectedSite !== 'all' && (
        <MonthShiftCalendar schedulePlans={schedulePlans} selectedSite={selectedSite} />
      )}
      {subView === 'calendar' && selectedSite === 'all' && (
        <div className="card p-8 text-center text-gray-400 text-sm">
          請在上方選擇案場以查看月曆班表
        </div>
      )}

      {/* Edit schedule modal */}
      {showEditSchedule && (
        <EditScheduleModal
          annualContracts={annualContracts}
          existingPlans={schedulePlans}
          onClose={() => setShowEditSchedule(false)}
        />
      )}
    </div>
  )
}

// ─── Mobile Dispatch Card ─────────────────────────────────────────────────────
function MobileDispatchCard({ dispatch, onDetail }) {
  const employees = useEmployees()
  const emp  = employees.find(e => e.id === dispatch.employeeId)
  const pay  = calcMobilePay(dispatch, employees)
  const st   = DISPATCH_STATUS[dispatch.status] || DISPATCH_STATUS.pending
  const org  = ORGS.find(o => o.id === dispatch.orgId)

  return (
    <div
      className="card p-4 hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onDetail(dispatch)}
    >
      <div className="flex items-start gap-4">
        {/* Employee avatar */}
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
          style={{ backgroundColor: org?.color || '#6b7280' }}
        >
          {emp?.name?.[0] || '?'}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm text-gray-900">{emp?.name || '未知員工'}</span>
                <span
                  className="text-[11px] font-semibold px-2 py-0.5 rounded-full text-white"
                  style={{ backgroundColor: org?.color }}
                >
                  {org?.name}
                </span>
                <span className="badge badge-amber text-[11px]">機動</span>
              </div>
              <div className="flex items-center gap-1 mt-0.5 text-xs text-gray-500">
                <MapPin size={11} />
                {dispatch.siteName}
                <span className="text-gray-300 mx-1">·</span>
                {dispatch.customerName}
              </div>
            </div>
            <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full shrink-0', st.badge)}>
              {st.label}
            </span>
          </div>

          {/* Info row */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <CalIcon size={11} /> {dispatch.date}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={11} /> {dispatch.startTime}–{dispatch.endTime}（{dispatch.hours}h）
            </span>
            <span className="flex items-center gap-1 font-semibold text-gray-700">
              <Banknote size={11} />
              {dispatch.rateType === 'daily'
                ? `${currency(dispatch.rate)}/日`
                : `${currency(dispatch.rate)}/時 × ${dispatch.hours}h`
              }
              <span className="text-brand-600 ml-1">= {currency(pay)}</span>
            </span>
          </div>

          {dispatch.note && (
            <p className="mt-1.5 text-xs text-gray-400 truncate">備註：{dispatch.note}</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Add Mobile Dispatch Modal ────────────────────────────────────────────────
function AddMobileModal({ onClose, selectedDate, prefill }) {
  const employees = useEmployees()
  const [rateType, setRateType] = useState('daily')
  const [note,     setNote]     = useState(prefill?.taskName ? `週期任務：${prefill.taskName}` : '')
  const [date,     setDate]     = useState(selectedDate || prefill?.date || '')

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 my-4">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-gray-900">新增機動派工</h2>
            {prefill && (
              <p className="text-xs text-teal-600 mt-0.5">
                週期任務：{prefill.taskName} · {prefill.siteName}
              </p>
            )}
          </div>
          <button className="text-gray-400 hover:text-gray-700" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="space-y-4">
          {/* Employee */}
          <div>
            <label className="label">機動員工 *</label>
            <select className="input">
              <option value="">選擇員工…</option>
              {employees.filter(e => e.employmentType === 'mobile').map(e => (
                <option key={e.id} value={e.id}>{e.name}（{e.position}）</option>
              ))}
              <optgroup label="其他（兼任機動）">
                {employees.filter(e => e.employmentType !== 'mobile' && (!e.status || e.status === 'active')).map(e => (
                  <option key={e.id} value={e.id}>{e.name}（{e.position}）</option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Site — pre-filled if from periodic task */}
          <div>
            <label className="label">派工案場 *</label>
            {prefill?.siteName ? (
              <div className="input bg-gray-50 text-gray-700 flex items-center gap-2">
                <MapPin size={13} className="text-teal-500 shrink-0" />
                {prefill.siteName}
                <span className="text-xs text-gray-400 ml-1">（{prefill.customerName}）</span>
              </div>
            ) : (
              <select className="input">
                <option value="">選擇案場…</option>
                {MOCK_CUSTOMERS.map(c => (
                  <optgroup key={c.id} label={c.name}>
                    {c.sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </optgroup>
                ))}
              </select>
            )}
          </div>

          {/* Date + Time */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">日期 *</label>
              <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div>
              <label className="label">開始時間</label>
              <input className="input" type="time" defaultValue="09:00" />
            </div>
            <div>
              <label className="label">結束時間</label>
              <input className="input" type="time" defaultValue="17:00" />
            </div>
          </div>

          {/* Rate type + amount */}
          <div>
            <label className="label">計薪方式 *</label>
            <div className="flex gap-2 mb-2">
              {[['daily','日薪（整天）'],['hourly','時薪（依時數）']].map(([k, l]) => (
                <button
                  key={k}
                  onClick={() => setRateType(k)}
                  className={clsx(
                    'flex-1 py-2 rounded-lg text-sm font-medium border transition-colors',
                    rateType === k
                      ? 'bg-brand-600 text-white border-brand-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300',
                  )}
                >
                  {l}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">$</span>
              <input className="input flex-1" type="number" placeholder={rateType === 'daily' ? '1800' : '220'} />
              <span className="text-sm text-gray-500">{rateType === 'daily' ? '元/日' : '元/時'}</span>
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="label">備註說明</label>
            <input className="input" value={note} onChange={e => setNote(e.target.value)} placeholder="任務說明、注意事項…" />
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700 flex items-start gap-2">
            <AlertCircle size={13} className="mt-0.5 shrink-0" />
            機動派工不走固定樣板，薪資將依本單設定的費率自動計算至當月薪資。
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button className="btn-secondary" onClick={onClose}>取消</button>
          <button className="btn-primary" onClick={onClose}>確認派工</button>
        </div>
      </div>
    </div>
  )
}

// ─── Mobile Dispatch Detail Modal ────────────────────────────────────────────
function MobileDetailModal({ dispatch: d, empColor, onClose }) {
  const employees = useEmployees()
  const [editing, setEditing]       = useState(false)
  const [workType, setWorkType]     = useState(d.workType || '')
  const [startTime, setStartTime]   = useState(d.startTime)
  const [endTime, setEndTime]       = useState(d.endTime)

  const emp   = employees.find(e => e.id === d.employeeId)
  const org   = ORGS.find(o => o.id === d.orgId)
  const st    = DISPATCH_STATUS[d.status] || DISPATCH_STATUS.pending
  const color = empColor[d.employeeId] || org?.color

  // Calculate hours from time strings
  const calcHours = (s, e) => {
    const [sh, sm] = s.split(':').map(Number)
    const [eh, em] = e.split(':').map(Number)
    return ((eh * 60 + em) - (sh * 60 + sm)) / 60
  }
  const displayHours = calcHours(startTime, endTime)

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0"
            style={{ backgroundColor: color }}
          >
            {emp?.name?.[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900">{emp?.name}</p>
            <p className="text-xs text-gray-500">{emp?.position} · {org?.name}</p>
          </div>
          <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full shrink-0', st.badge)}>
            {st.label}
          </span>
        </div>

        {/* Info block */}
        <div className="space-y-3 text-sm bg-gray-50 rounded-xl p-4">
          {/* Site + Customer */}
          <div className="flex justify-between">
            <span className="text-gray-500">案場</span>
            <span className="font-medium">{d.siteName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">客戶</span>
            <span className="font-medium text-gray-700">{d.customerName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">日期</span>
            <span className="font-medium">{d.date}</span>
          </div>

          {/* Work type — editable */}
          <div className="flex justify-between items-center">
            <span className="text-gray-500">工作類型</span>
            {editing ? (
              <select
                className="input py-1 text-sm w-40"
                value={workType}
                onChange={e => setWorkType(e.target.value)}
              >
                {CLEANING_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            ) : (
              <span className="font-semibold text-brand-700 bg-brand-50 px-2 py-0.5 rounded-full text-xs">
                {workType || '未設定'}
              </span>
            )}
          </div>

          {/* Time — editable */}
          <div className="flex justify-between items-center">
            <span className="text-gray-500">施工時間</span>
            {editing ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="time"
                  className="input py-1 text-sm w-24"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                />
                <span className="text-gray-400">–</span>
                <input
                  type="time"
                  className="input py-1 text-sm w-24"
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                />
              </div>
            ) : (
              <span className="font-medium">
                {startTime} – {endTime}
                <span className="text-gray-400 ml-1 text-xs">
                  （{displayHours > 0 ? displayHours : d.hours}h）
                </span>
              </span>
            )}
          </div>
        </div>

        {d.note && (
          <p className="mt-3 text-xs text-gray-400">備註：{d.note}</p>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-5">
          {editing ? (
            <>
              <button className="btn-secondary flex-1 justify-center" onClick={() => setEditing(false)}>
                取消
              </button>
              <button className="btn-primary flex-1 justify-center" onClick={() => setEditing(false)}>
                儲存變更
              </button>
            </>
          ) : (
            <>
              <button className="btn-secondary flex-1 justify-center" onClick={onClose}>
                關閉
              </button>
              <button className="btn-primary flex-1 justify-center" onClick={() => setEditing(true)}>
                編輯
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── 機動派工 View — Calendar ─────────────────────────────────────────────────
const EMP_PALETTE = ['#f59e0b', '#8b5cf6', '#06b6d4', '#ef4444', '#10b981', '#ec4899']

function MobileView({ dispatches, annualContracts = [], periodicSchedules, setPeriodicSchedule }) {
  const employees = useEmployees()
  const [showAdd, setShowAdd]         = useState(false)
  const [selectedDate, setSelDate]    = useState(null)
  const [prefillTask, setPrefillTask] = useState(null)
  const [detailItem, setDetail]       = useState(null)
  const [filterEmp, setFilterEmp]     = useState('all')
  const [filterStatus, setStatus]     = useState('all')

  const currentMonth = new Date().getMonth() + 1
  const currentYear  = new Date().getFullYear()

  // Collect all current-month periodic tasks across all contracts
  const periodicDueTasks = useMemo(() => {
    return annualContracts.flatMap(contract =>
      (contract.sites || []).flatMap(site =>
        (site.periodicTasks || [])
          .filter(task => (task.months || []).includes(currentMonth))
          .map(task => ({
            key:           `${contract.id}_${site.id}_${task.id}`,
            taskId:        task.id,
            siteId:        site.id,
            siteName:      site.name,
            contractId:    contract.id,
            contractTitle: contract.title,
            customerName:  contract.customerName,
            taskName:      task.name,
            unitPrice:     task.unitPrice || 0,
            completed:     task.completedMonths?.includes(currentMonth),
          }))
      )
    )
  }, [annualContracts, currentMonth])

  // Build per-employee color map (stable order)
  const dispEmpIds = useMemo(
    () => [...new Set(dispatches.map(d => d.employeeId))],
    [dispatches]
  )
  const empColor = useMemo(
    () => Object.fromEntries(dispEmpIds.map((id, i) => [id, EMP_PALETTE[i % EMP_PALETTE.length]])),
    [dispEmpIds]
  )

  const filtered = useMemo(() =>
    dispatches.filter(d =>
      (filterEmp    === 'all' || d.employeeId === filterEmp) &&
      (filterStatus === 'all' || d.status     === filterStatus)
    )
  , [dispatches, filterEmp, filterStatus])

  // Map dispatches → FullCalendar events
  const dispatchEvents = useMemo(() =>
    filtered.map(d => {
      const color = empColor[d.employeeId] || '#6b7280'
      return {
        id:              d.id,
        title:           d.siteName,
        start:           `${d.date}T${d.startTime}`,
        end:             `${d.date}T${d.endTime}`,
        backgroundColor: d.status === 'completed' ? color : `${color}cc`,
        borderColor:     color,
        textColor:       '#ffffff',
        extendedProps:   { ...d, _type: 'dispatch' },
      }
    })
  , [filtered, empColor])

  // Periodic task scheduled events (teal)
  const periodicEvents = useMemo(() =>
    periodicDueTasks
      .filter(t => periodicSchedules[t.key])
      .map(t => ({
        id:              `periodic-${t.key}`,
        title:           `${t.taskName}`,
        start:           periodicSchedules[t.key],
        allDay:          true,
        backgroundColor: '#0d9488',
        borderColor:     '#0d9488',
        textColor:       '#ffffff',
        extendedProps:   { ...t, _type: 'periodic' },
      }))
  , [periodicDueTasks, periodicSchedules])

  const events = useMemo(() => [...dispatchEvents, ...periodicEvents], [dispatchEvents, periodicEvents])

  const totalPay     = filtered.reduce((s, d) => s + calcMobilePay(d, employees), 0)
  const pendingCount = filtered.filter(d => d.status === 'pending').length
  const unscheduledCount = periodicDueTasks.filter(t => !periodicSchedules[t.key] && !t.completed).length

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Employee filter */}
        <select
          className="input w-auto text-sm"
          value={filterEmp}
          onChange={e => setFilterEmp(e.target.value)}
        >
          <option value="all">全部員工</option>
          {employees.filter(e => dispEmpIds.includes(e.id)).map(e => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>

        {/* Status filter */}
        <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
          {[['all','全部'],['pending','待執行'],['completed','已完成']].map(([k, l]) => (
            <button
              key={k}
              onClick={() => setStatus(k)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                filterStatus === k ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700',
              )}
            >
              {l}
            </button>
          ))}
        </div>

        <div className="flex-1" />
        <button className="btn-primary" onClick={() => setShowAdd(true)}>
          <Plus size={16} /> 新增機動派工
        </button>
      </div>

      {/* Stat strip + employee legend */}
      <div className="card px-4 py-3 flex flex-wrap items-center gap-5">
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-500">本月派工 <strong className="text-gray-900">{filtered.length}</strong> 筆</span>
          <span className="text-gray-300">|</span>
          <span className="text-amber-600">待執行 <strong>{pendingCount}</strong></span>
          <span className="text-gray-300">|</span>
          <span className="text-green-600">合計 <strong>{currency(totalPay)}</strong></span>
          {unscheduledCount > 0 && (
            <>
              <span className="text-gray-300">|</span>
              <span className="text-teal-600">週期任務待安排 <strong>{unscheduledCount}</strong></span>
            </>
          )}
        </div>
        <div className="flex-1" />
        <div className="flex flex-wrap gap-3">
          {dispEmpIds.map(id => {
            const emp = employees.find(e => e.id === id)
            return (
              <button
                key={id}
                onClick={() => setFilterEmp(filterEmp === id ? 'all' : id)}
                className={clsx(
                  'flex items-center gap-1.5 text-xs rounded-full px-2.5 py-1 border transition-all',
                  filterEmp === id
                    ? 'text-white border-transparent'
                    : 'text-gray-600 border-gray-200 bg-white hover:border-gray-300',
                )}
                style={filterEmp === id ? { backgroundColor: empColor[id], borderColor: empColor[id] } : {}}
              >
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: empColor[id] }} />
                {emp?.name}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── 本月週期任務提醒 ── */}
      {periodicDueTasks.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-teal-50/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers size={15} className="text-teal-600" />
              <p className="text-sm font-semibold text-teal-800">
                本月週期任務提醒
              </p>
              <span className="text-xs text-teal-500">
                {currentYear}年{currentMonth}月 · 共 {periodicDueTasks.length} 項
              </span>
            </div>
            {unscheduledCount > 0 && (
              <span className="badge bg-amber-100 text-amber-700 text-[11px]">
                {unscheduledCount} 項待安排施作日
              </span>
            )}
          </div>
          <div className="divide-y divide-gray-50">
            {periodicDueTasks.map(task => {
              const scheduled = periodicSchedules[task.key]
              return (
                <div key={task.key} className="px-4 py-3 flex flex-wrap items-center gap-3">
                  <div className={clsx(
                    'w-2 h-2 rounded-full shrink-0',
                    task.completed ? 'bg-green-400' : scheduled ? 'bg-teal-400' : 'bg-amber-400',
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{task.taskName}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {task.siteName} · {task.customerName} · ${task.unitPrice.toLocaleString()}/次
                    </p>
                  </div>
                  {task.completed ? (
                    <span className="badge bg-green-100 text-green-700 text-[11px]">已完成</span>
                  ) : scheduled ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-teal-700 bg-teal-50 border border-teal-200 rounded-lg px-2.5 py-1 flex items-center gap-1.5">
                        <CalIcon size={11} /> 已排：{scheduled}
                      </span>
                      <button
                        className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                        onClick={() => setPeriodicSchedule(task.key, null)}
                      >
                        <X size={13} />
                      </button>
                      <button
                        className="btn-primary text-xs py-1 px-2.5 gap-1"
                        onClick={() => { setPrefillTask(task); setShowAdd(true) }}
                      >
                        <Plus size={12} /> 派工
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        className="input text-xs py-1 px-2.5 w-36"
                        onChange={e => {
                          if (e.target.value) setPeriodicSchedule(task.key, e.target.value)
                        }}
                        placeholder="安排施作日"
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50 flex items-center gap-4 text-[11px] text-gray-400">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> 待安排</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-teal-400 inline-block" /> 已排（顯示於月曆）</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" /> 已完成</span>
          </div>
        </div>
      )}

      {/* FullCalendar */}
      <div className="card p-4">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          initialDate={`${currentYear}-${String(currentMonth).padStart(2,'0')}-01`}
          headerToolbar={{
            left:   'prev,next today',
            center: 'title',
            right:  'dayGridMonth,timeGridWeek',
          }}
          locale="zh-tw"
          buttonText={{ today: '今天', month: '月', week: '週' }}
          events={events}
          dateClick={info => { setSelDate(info.dateStr); setPrefillTask(null); setShowAdd(true) }}
          eventClick={info => {
            const props = info.event.extendedProps
            if (props._type === 'periodic') return
            setDetail(props)
          }}
          height={560}
          eventContent={info => {
            const d = info.event.extendedProps
            if (d._type === 'periodic') {
              return (
                <div className="px-1.5 py-0.5 flex items-center gap-1 overflow-hidden w-full">
                  <Layers size={10} className="shrink-0 opacity-80" />
                  <span className="truncate text-[10px] font-semibold leading-tight">{d.taskName}</span>
                </div>
              )
            }
            return (
              <div className={clsx('px-1.5 py-0.5 flex items-center gap-1 overflow-hidden w-full', d.status === 'pending' && 'opacity-85')}>
                {d.status === 'pending' && <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-white/70" />}
                <span className="truncate text-[11px] font-semibold leading-tight">{d.siteName}</span>
              </div>
            )
          }}
        />
        {periodicEvents.length > 0 && (
          <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
            <span className="w-3 h-3 rounded-sm bg-teal-500 inline-block shrink-0" />
            <span>週期任務施作日（顯示於月曆，點選「派工」可建立機動派工單）</span>
          </div>
        )}
      </div>

      {/* Dispatch detail modal */}
      {detailItem && (
        <MobileDetailModal
          dispatch={detailItem}
          empColor={empColor}
          onClose={() => setDetail(null)}
        />
      )}

      {showAdd && (
        <AddMobileModal
          selectedDate={selectedDate}
          prefill={prefillTask}
          onClose={() => { setShowAdd(false); setSelDate(null); setPrefillTask(null) }}
        />
      )}
    </div>
  )
}

// ─── Main SchedulePage ────────────────────────────────────────────────────────
export default function SchedulePage() {
  const { activeOrgId } = useOrg()
  const [mainTab, setMainTab] = useState('mobile')

  const { data: annualContractsRaw } = useCollection(COL.ANNUAL_CONTRACTS)
  const { data: employeesRaw }       = useCollection(COL.EMPLOYEES)
  const { data: shiftCodesRaw }      = useCollection(COL.SHIFT_CODES)
  const { data: schedulePlansRaw }   = useCollection(COL.SCHEDULE_PLANS)

  const annualContracts = annualContractsRaw.filter(c => c.orgId === activeOrgId)
  const employees       = useMemo(
    () => employeesRaw.filter(e => e.orgId === activeOrgId),
    [employeesRaw, activeOrgId]
  )
  const shiftCodes      = useMemo(
    () => shiftCodesRaw.filter(s => s.orgId === activeOrgId),
    [shiftCodesRaw, activeOrgId]
  )
  const schedulePlans   = useMemo(
    () => schedulePlansRaw.filter(p => p.orgId === activeOrgId),
    [schedulePlansRaw, activeOrgId]
  )

  // Derived from Firestore — persists across reloads and devices
  const periodicSchedules = useMemo(() => {
    const result = {}
    annualContracts.forEach(contract => {
      ;(contract.sites || []).forEach(site => {
        ;(site.periodicTasks || []).forEach(task => {
          if (task.scheduledDate) {
            result[`${contract.id}_${site.id}_${task.id}`] = task.scheduledDate
          }
        })
      })
    })
    return result
  }, [annualContracts])

  // Write scheduled date back into the contract's periodic task
  const setPeriodicSchedule = async (taskKey, date) => {
    const first  = taskKey.indexOf('_')
    const second = taskKey.indexOf('_', first + 1)
    const contractId = taskKey.slice(0, first)
    const siteId     = taskKey.slice(first + 1, second)
    const taskId     = taskKey.slice(second + 1)
    const contract   = annualContracts.find(c => c.id === contractId)
    if (!contract) return
    const newSites = (contract.sites || []).map(site =>
      site.id !== siteId ? site : {
        ...site,
        periodicTasks: (site.periodicTasks || []).map(task =>
          task.id !== taskId ? task : { ...task, scheduledDate: date || null }
        ),
      }
    )
    await updateAnnualContract(contractId, { sites: newSites })
  }

  const instances  = MOCK_SCHEDULE_INSTANCES
  const dispatches = MOCK_MOBILE_DISPATCHES

  return (
    <EmployeeCtx.Provider value={employees}>
    <ShiftCodeCtx.Provider value={shiftCodes}>
    <div className="max-w-7xl mx-auto space-y-5">

      {/* Page header + main tab */}
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">排班調度</h1>
          <p className="text-sm text-gray-500 mt-0.5">駐點固定班表 · 機動臨時派工 · 班次管理</p>
        </div>
        <div className="flex bg-gray-100 rounded-xl p-1 gap-1 ml-auto">
          <button
            onClick={() => setMainTab('stationed')}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
              mainTab === 'stationed' ? 'bg-white shadow-sm text-green-700' : 'text-gray-500 hover:text-gray-700',
            )}
          >
            <Building2 size={15} /> 駐點班表
          </button>
          <button
            onClick={() => setMainTab('mobile')}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
              mainTab === 'mobile' ? 'bg-white shadow-sm text-amber-700' : 'text-gray-500 hover:text-gray-700',
            )}
          >
            <Smartphone size={15} /> 機動派工
            {dispatches.filter(d => d.status === 'pending').length > 0 && (
              <span className="bg-amber-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                {dispatches.filter(d => d.status === 'pending').length}
              </span>
            )}
          </button>
          <button
            onClick={() => setMainTab('shifts')}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
              mainTab === 'shifts' ? 'bg-white shadow-sm text-purple-700' : 'text-gray-500 hover:text-gray-700',
            )}
          >
            <Hash size={15} /> 班次管理
          </button>
        </div>
      </div>

      {/* Tab content */}
      {mainTab === 'stationed' && (
        <StationedView annualContracts={annualContracts} schedulePlans={schedulePlans} />
      )}
      {mainTab === 'mobile' && (
        <MobileView
          dispatches={dispatches}
          annualContracts={annualContracts}
          periodicSchedules={periodicSchedules}
          setPeriodicSchedule={setPeriodicSchedule}
        />
      )}
      {mainTab === 'shifts' && <ShiftManager />}
    </div>
    </ShiftCodeCtx.Provider>
    </EmployeeCtx.Provider>
  )
}
