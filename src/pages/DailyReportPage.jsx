import { useState, useRef, useMemo, useEffect } from 'react'
import {
  ClipboardList, Plus, ChevronLeft, Users, CheckSquare,
  Package, AlertTriangle, Send, Save,
  CheckCircle, X, Trash2, ChevronDown, ChevronUp,
  MapPin, Building2, FileText, Pencil, UserPlus, Calendar, Crown,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useOrg } from '../contexts/OrgContext'
import { MOCK_EMPLOYEES, MOCK_INVENTORY_ITEMS, PRESET_TASKS, ORGS } from '../lib/mockData'
import { COL, addWorkOrder, updateWorkOrder, updateOrder, updateAnnualContract } from '../lib/db'
import { useCollection } from '../hooks/useCollection'
import { getTaskScheduleText } from '../utils/contractSchema'
import clsx from 'clsx'

// 找出某日「排班已排定」的所有週期任務，跨所有合約/案場
function getScheduledTasksForDate(dateStr, annualContracts) {
  if (!dateStr) return []
  return annualContracts.flatMap(contract =>
    (contract.sites || []).flatMap(site =>
      (site.periodicTasks || [])
        .filter(t => t.scheduledDate === dateStr)
        .map(t => ({
          contractId:    contract.id,
          contractTitle: contract.title,
          customerName:  contract.customerName,
          siteId:        site.id,
          siteName:      site.name,
          siteAddress:   site.address || '',
          taskId:        t.id,
          taskName:      t.name,
          unitPrice:     t.unitPrice || 0,
          scheduleType:  t.scheduleType || 'fixed',
          months:        t.months || [],
        }))
    )
  )
}

// ─── Constants ────────────────────────────────────────────────────────────────
const TODAY = new Date().toISOString().slice(0, 10)

const SHIFT = {
  full:    { label: '全天班',   hours: 8, badge: 'bg-blue-100 text-blue-700'  },
  half_am: { label: '上午半天', hours: 4, badge: 'bg-green-100 text-green-700' },
  half_pm: { label: '下午半天', hours: 4, badge: 'bg-amber-100 text-amber-700' },
}

const STATUS = {
  draft:     { label: '草稿',   badge: 'bg-gray-100 text-gray-600',   dot: 'bg-gray-400'  },
  submitted: { label: '已提交', badge: 'bg-blue-100 text-blue-700',   dot: 'bg-blue-400'  },
  approved:  { label: '已核准', badge: 'bg-green-100 text-green-700', dot: 'bg-green-400' },
}

function newSession(date = TODAY) {
  return {
    id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    date,
    manpower:  [],
    tasks:     [],
    materials: [],
    notes:     '',
  }
}

// ─── Collapsible section ──────────────────────────────────────────────────────
function Section({ icon: Icon, title, badge, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="card overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="p-1.5 bg-brand-50 rounded-lg shrink-0">
          <Icon size={15} className="text-brand-600" />
        </div>
        <span className="font-semibold text-gray-800 flex-1 text-sm">{title}</span>
        {badge !== undefined && (
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">{badge}</span>
        )}
        {open ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
      </button>
      {open && <div className="px-5 pb-5 border-t border-gray-100 pt-4">{children}</div>}
    </div>
  )
}

// ─── Report list card ─────────────────────────────────────────────────────────
function ReportCard({ report, onClick }) {
  const sc       = STATUS[report.status] || STATUS.draft
  const org      = ORGS.find(o => o.id === report.orgId)
  const sessions = report.sessions || []
  const totalPeople = sessions.reduce((s, sess) => s + (sess.manpower?.length || 0), 0)
  const totalTasks  = sessions.reduce((s, sess) => s + (sess.tasks?.length || 0), 0)
  const dates = sessions.map(s => s.date).filter(Boolean).sort()
  const dateRange = dates.length === 0 ? '未設定'
    : dates.length === 1 ? dates[0]
    : `${dates[0]} ~ ${dates[dates.length - 1]}`

  return (
    <div className="card p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={onClick}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            <span className="text-[11px] font-semibold text-white px-2 py-0.5 rounded-full" style={{ backgroundColor: org?.color }}>
              {org?.name}
            </span>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${sc.badge}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />{sc.label}
            </span>
          </div>
          <h3 className="font-bold text-gray-900 leading-tight">{report.siteName || report.orderName || '未設定案場'}</h3>
          <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
            <Crown size={10} /> 帶班：{report.leaderName || '未指定'}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center mb-2">
        <div>
          <p className="text-xl font-bold text-gray-900">{sessions.length}</p>
          <p className="text-[11px] text-gray-400">施工次數</p>
        </div>
        <div className="border-x border-gray-100">
          <p className="text-xl font-bold text-gray-900">{totalPeople}</p>
          <p className="text-[11px] text-gray-400">總人次</p>
        </div>
        <div>
          <p className="text-xl font-bold text-gray-900">{totalTasks}</p>
          <p className="text-[11px] text-gray-400">工作項目</p>
        </div>
      </div>
      <p className="text-xs text-gray-400 flex items-center gap-1">
        <Calendar size={10} />{dateRange}
      </p>
    </div>
  )
}

// ─── Manpower Section ─────────────────────────────────────────────────────────
function ManpowerSection({ manpower, allEmployees, onAdd, onRemove, onShift }) {
  const [open, setOpen]  = useState(false)
  const dropdownRef      = useRef(null)
  const selectedIds      = new Set(manpower.map(m => m.employeeId))
  const available        = allEmployees.filter(e => !selectedIds.has(e.id))
  const totalHours       = manpower.reduce((s, m) => s + (SHIFT[m.shift]?.hours || 8), 0)

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="card">
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-100">
        <div className="p-1.5 bg-brand-50 rounded-lg shrink-0"><Users size={15} className="text-brand-600" /></div>
        <span className="font-semibold text-sm text-gray-800 flex-1">人力派遣</span>
        {manpower.length > 0 && (
          <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
            {manpower.length} 人・{totalHours} 小時
          </span>
        )}
      </div>
      <div className="px-5 py-4 space-y-2">
        {manpower.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">尚未加入任何人員</p>
        )}
        {manpower.map(m => {
          const emp = allEmployees.find(e => e.id === m.employeeId)
          const orgColor = emp?.orgId === 'jiaxiang' ? '#2563eb' : '#7c3aed'
          return (
            <div key={m.employeeId} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ backgroundColor: orgColor }}>
                {m.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800">{m.name}</p>
                <p className="text-xs text-gray-400">{emp?.position}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => onShift(m.employeeId, 'full')}
                  className={clsx('px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors',
                    m.shift === 'full' ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-300'
                  )}
                >全天班</button>
                <button
                  onClick={() => onShift(m.employeeId, m.shift === 'half_am' ? 'half_pm' : 'half_am')}
                  className={clsx('px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors',
                    m.shift !== 'full' ? 'bg-amber-500 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-300'
                  )}
                >{m.shift === 'half_am' ? '上午半天' : m.shift === 'half_pm' ? '下午半天' : '半天'}</button>
                {m.shift !== 'full' && (
                  <div className="flex gap-1">
                    {[['half_am','上午'],['half_pm','下午']].map(([k, label]) => (
                      <button key={k} onClick={() => onShift(m.employeeId, k)}
                        className={clsx('px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors border',
                          m.shift === k ? 'bg-amber-100 text-amber-700 border-amber-300' : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
                        )}
                      >{label}</button>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={() => onRemove(m.employeeId)} className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0">
                <X size={14} />
              </button>
            </div>
          )
        })}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setOpen(o => !o)}
            disabled={available.length === 0}
            className={clsx('flex items-center gap-2 w-full px-3 py-2.5 rounded-xl border-2 border-dashed text-sm font-medium transition-colors',
              available.length === 0
                ? 'border-gray-100 text-gray-300 cursor-not-allowed'
                : 'border-gray-300 text-gray-500 hover:border-brand-400 hover:text-brand-600 hover:bg-brand-50'
            )}
          >
            <UserPlus size={16} />
            {available.length === 0 ? '所有人員已加入' : '新增人員'}
            {available.length > 0 && <span className="ml-auto text-xs text-gray-400">{available.length} 人可選</span>}
          </button>
          {open && available.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-30 overflow-hidden">
              {available.map(emp => {
                const orgColor = emp.orgId === 'jiaxiang' ? '#2563eb' : '#7c3aed'
                const org = ORGS.find(o => o.id === emp.orgId)
                return (
                  <button key={emp.id} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                    onClick={() => { onAdd(emp); setOpen(false) }}
                  >
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ backgroundColor: orgColor }}>
                      {emp.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">{emp.name}</p>
                      <p className="text-xs text-gray-400">{emp.position}</p>
                    </div>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full text-white shrink-0" style={{ backgroundColor: orgColor }}>
                      {org?.name}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Task Section ─────────────────────────────────────────────────────────────
function TaskSection({ tasks, onAdd, onRemove, onUpdate, customTasks = [] }) {
  const [open, setOpen] = useState(false)
  const dropdownRef     = useRef(null)
  const selectedIds     = new Set(tasks.map(t => t.presetId))
  // 內建 + 使用者自訂合併，依名稱排序、自訂優先
  const mergedTasks = useMemo(() => {
    const builtin = PRESET_TASKS
    const custom  = customTasks.map(c => ({ id: c.id, name: c.name, category: c.category }))
    return [...custom, ...builtin]
  }, [customTasks])
  const available  = mergedTasks.filter(p => !selectedIds.has(p.id))

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const availableGroups = available.reduce((acc, p) => {
    const cat = p.category || '未分類'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(p)
    return acc
  }, {})

  return (
    <div className="card">
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-100">
        <div className="p-1.5 bg-brand-50 rounded-lg shrink-0"><CheckSquare size={15} className="text-brand-600" /></div>
        <span className="font-semibold text-sm text-gray-800 flex-1">工作項目</span>
        {tasks.length > 0 && (
          <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{tasks.length} 項</span>
        )}
      </div>
      <div className="px-5 py-4 space-y-2">
        {tasks.length === 0 && <p className="text-sm text-gray-400 text-center py-4">尚未加入任何施工項目</p>}
        {tasks.map(t => {
          const preset = mergedTasks.find(p => p.id === t.presetId)
          return (
            <div key={t.presetId} className="bg-gray-50 rounded-xl px-3 py-3 space-y-2.5">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
                  <CheckSquare size={11} className="text-brand-600" />
                </div>
                <span className="text-sm font-semibold text-gray-800 flex-1">{t.name}</span>
                <span className="text-[10px] bg-brand-50 text-brand-600 px-2 py-0.5 rounded-full font-medium shrink-0">{preset?.category}</span>
                <button onClick={() => onRemove(t.presetId)} className="p-1 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0">
                  <X size={13} />
                </button>
              </div>
              <input className="input text-sm py-1.5" placeholder="施作地點（如：1F大廳）"
                value={t.location} onChange={e => onUpdate(t.presetId, { location: e.target.value })} />
            </div>
          )
        })}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setOpen(o => !o)}
            disabled={available.length === 0}
            className={clsx('flex items-center gap-2 w-full px-3 py-2.5 rounded-xl border-2 border-dashed text-sm font-medium transition-colors',
              available.length === 0
                ? 'border-gray-100 text-gray-300 cursor-not-allowed'
                : 'border-gray-300 text-gray-500 hover:border-brand-400 hover:text-brand-600 hover:bg-brand-50'
            )}
          >
            <Plus size={16} />
            {available.length === 0 ? '所有項目已加入' : '新增施工項目'}
            {available.length > 0 && <span className="ml-auto text-xs text-gray-400">{available.length} 項可選</span>}
          </button>
          {open && available.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-30 max-h-64 overflow-y-auto">
              {Object.entries(availableGroups).map(([cat, presets]) => (
                <div key={cat}>
                  <div className="px-4 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wide bg-gray-50 border-b border-gray-100 sticky top-0">{cat}</div>
                  {presets.map(p => (
                    <button key={p.id} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-brand-50 transition-colors text-left"
                      onClick={() => { onAdd(p); setOpen(false) }}
                    >
                      <div className="w-6 h-6 rounded-lg bg-brand-100 flex items-center justify-center shrink-0">
                        <CheckSquare size={12} className="text-brand-600" />
                      </div>
                      <span className="text-sm font-medium text-gray-800">{p.name}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Session Editor ───────────────────────────────────────────────────────────
function SessionEditor({ session, sessionNum, total, onChange, onRemove, allEmployees, inventoryItems, customCleaningTasks = [] }) {
  const [open, setOpen] = useState(true)

  const set = (patch) => onChange({ ...session, ...patch })

  const addMaterial    = () => set({ materials: [...session.materials, { itemId: '', name: '', qty: 1, unit: '' }] })
  const updateMaterial = (idx, patch) => set({ materials: session.materials.map((m, i) => i === idx ? { ...m, ...patch } : m) })
  const removeMaterial = (idx) => set({ materials: session.materials.filter((_, i) => i !== idx) })
  const selectItem     = (idx, itemId) => {
    const item = (inventoryItems.length > 0 ? inventoryItems : MOCK_INVENTORY_ITEMS).find(i => i.id === itemId)
    if (item) updateMaterial(idx, { itemId: item.id, name: item.name, unit: item.unit })
  }

  const totalHrs = session.manpower.reduce((s, m) => s + (SHIFT[m.shift]?.hours || 8), 0)
  const itemList = inventoryItems.length > 0 ? inventoryItems : MOCK_INVENTORY_ITEMS

  return (
    <div className="border border-gray-200 rounded-2xl overflow-hidden">
      {/* Session header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-50">
        <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
          {sessionNum}
        </div>
        <input
          type="date"
          className="input text-sm font-semibold flex-1 min-w-0 py-1"
          value={session.date}
          onChange={e => set({ date: e.target.value })}
        />
        <div className="flex items-center gap-2 text-xs text-gray-400 shrink-0">
          {session.manpower.length > 0 && <span>{session.manpower.length} 人・{totalHrs}h</span>}
          {session.tasks.length > 0 && <span>{session.tasks.length} 項</span>}
        </div>
        {total > 1 && (
          <button type="button" onClick={onRemove}
            className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
          >
            <Trash2 size={14} />
          </button>
        )}
        <button type="button" onClick={() => setOpen(o => !o)}
          className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg transition-colors shrink-0"
        >
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {open && (
        <div className="p-4 space-y-4">
          {/* Manpower */}
          <ManpowerSection
            manpower={session.manpower}
            allEmployees={allEmployees}
            onAdd={emp => set({ manpower: [...session.manpower, { employeeId: emp.id, name: emp.name, shift: 'full' }] })}
            onRemove={eid => set({ manpower: session.manpower.filter(m => m.employeeId !== eid) })}
            onShift={(eid, shift) => set({ manpower: session.manpower.map(m => m.employeeId === eid ? { ...m, shift } : m) })}
          />

          {/* Tasks */}
          <TaskSection
            tasks={session.tasks}
            customTasks={customCleaningTasks}
            onAdd={preset => set({ tasks: [...session.tasks, { presetId: preset.id, name: preset.name, location: '' }] })}
            onRemove={pid => set({ tasks: session.tasks.filter(t => t.presetId !== pid) })}
            onUpdate={(pid, patch) => set({ tasks: session.tasks.map(t => t.presetId === pid ? { ...t, ...patch } : t) })}
          />

          {/* Materials */}
          <div className="card">
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-100">
              <div className="p-1.5 bg-brand-50 rounded-lg shrink-0"><Package size={15} className="text-brand-600" /></div>
              <span className="font-semibold text-sm text-gray-800 flex-1">材料耗材統計</span>
              {session.materials.length > 0 && (
                <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{session.materials.length} 項</span>
              )}
            </div>
            <div className="px-5 py-4 space-y-2">
              {session.materials.map((m, idx) => {
                const item    = itemList.find(i => i.id === m.itemId)
                const anomaly = item?.maxPerDay && m.qty > item.maxPerDay
                return (
                  <div key={idx} className={clsx('rounded-xl border p-3 space-y-2 transition-colors',
                    anomaly ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50'
                  )}>
                    <div className="flex gap-2">
                      <select className="input flex-1 text-sm" value={m.itemId} onChange={e => selectItem(idx, e.target.value)}>
                        <option value="">選擇耗材品項…</option>
                        {itemList.map(i => <option key={i.id} value={i.id}>{i.name}（{i.unit}）</option>)}
                      </select>
                      <div className="flex items-center gap-1 w-36 shrink-0">
                        <input type="number" min="0" step="0.5"
                          className={clsx('input text-sm w-20', anomaly && 'border-red-300')}
                          value={m.qty}
                          onChange={e => updateMaterial(idx, { qty: Number(e.target.value) })}
                        />
                        <span className="text-sm text-gray-500 font-medium w-8 shrink-0">{m.unit}</span>
                      </div>
                      <button onClick={() => removeMaterial(idx)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-100 rounded-lg transition-colors shrink-0">
                        <Trash2 size={15} />
                      </button>
                    </div>
                    {anomaly && (
                      <div className="flex items-start gap-2 text-sm text-red-700">
                        <AlertTriangle size={14} className="mt-0.5 shrink-0 text-red-500" />
                        <span>用量異常！正常每日上限 <strong>{item.maxPerDay} {item.unit}</strong>，目前填寫 <strong>{m.qty} {item.unit}</strong>。</span>
                      </div>
                    )}
                  </div>
                )
              })}
              <button onClick={addMaterial} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-gray-300 text-gray-500 hover:border-brand-400 hover:text-brand-600 hover:bg-brand-50 transition-colors text-sm font-medium">
                <Plus size={16} /> 新增耗材品項
              </button>
            </div>
          </div>

          {/* Notes */}
          <div className="card p-5">
            <label className="label">現場備註</label>
            <textarea className="input resize-none" rows={2}
              placeholder="現場狀況、客戶意見、下次注意事項…"
              value={session.notes}
              onChange={e => set({ notes: e.target.value })}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Report Form ──────────────────────────────────────────────────────────────
function ReportForm({ report: init, onSave, onCancel, employees = [], inventoryItems = [], orders = [], annualContracts = [], customCleaningTasks = [] }) {
  const [form, setForm] = useState(init)
  // 已提交 / 已核准的請款單不允許修改；只有透過「撤回為草稿」明確 onSave 才能解鎖
  const set = (patch) => setForm(f => {
    if (f.status === 'submitted' || f.status === 'approved') return f
    return { ...f, ...patch }
  })

  const activeEmployees = (employees.length > 0 ? employees : MOCK_EMPLOYEES)
    .filter(e => e.status === 'active')
  const mobileEmployees = activeEmployees.filter(e => e.workMode === 'mobile')

  // ── Link type helpers ────────────────────────────────────────────────────────
  const clearLink = (linkType) => {
    const cleanedSessions = (form.sessions || []).map(sess => ({
      ...sess,
      tasks: (sess.tasks || []).filter(t => !t.linkedToPeriodic),
    }))
    set({
      linkType, orderId: '', orderName: '',
      contractId: '', contractSiteId: '', taskId: '', taskName: '',
      siteName: '', siteAddress: '',
      sessions: cleanedSessions,
    })
  }

  const handleOrderChange = (orderId) => {
    const o = orders.find(x => x.id === orderId)
    set({ orderId, orderName: o?.siteName || o?.title || '',
          siteName: o?.siteName || '', siteAddress: o?.siteAddress || '' })
  }

  const handleContractChange = (contractId) => {
    set({ contractId, contractSiteId: '', taskId: '', taskName: '', siteName: '', siteAddress: '' })
  }

  const handleContractSiteChange = (contractSiteId) => {
    const contract = annualContracts.find(c => c.id === form.contractId)
    const site     = (contract?.sites || []).find(s => s.id === contractSiteId)
    set({ contractSiteId, siteName: site?.name || '', siteAddress: site?.address || '',
          taskId: '', taskName: '' })
  }

  const handleTaskChange = (taskId) => {
    const contract = annualContracts.find(c => c.id === form.contractId)
    const site     = (contract?.sites || []).find(s => s.id === form.contractSiteId)
    const task     = (site?.periodicTasks || []).find(t => t.id === taskId)
    // 自動把週期任務帶進第一個 session 的施作項目（清掉之前自動加入的）
    const newSessions = (form.sessions || []).map((sess, idx) => {
      const cleaned = (sess.tasks || []).filter(t => !t.linkedToPeriodic)
      if (idx !== 0 || !task) return { ...sess, tasks: cleaned }
      return {
        ...sess,
        tasks: [
          { presetId: `periodic-${task.id}`, name: task.name, location: site?.name || '', linkedToPeriodic: true },
          ...cleaned,
        ],
      }
    })
    set({ taskId, taskName: task?.name || '', sessions: newSessions })
  }

  const handleLeaderChange = (leaderId) => {
    const emp = activeEmployees.find(e => e.id === leaderId)
    set({ leaderId, leaderName: emp?.name || '' })
  }

  const contractSites = annualContracts.find(c => c.id === form.contractId)?.sites || []
  const contractTasks = contractSites.find(s => s.id === form.contractSiteId)?.periodicTasks || []

  // 排班→請款連動：找出第一個 session 的日期排定了哪些週期任務
  const reportDate = form.sessions?.[0]?.date || ''
  const scheduledToday = useMemo(
    () => getScheduledTasksForDate(reportDate, annualContracts),
    [reportDate, annualContracts]
  )

  // 點「今日排定」卡片 → 一鍵帶入合約/案場/任務，並把週期任務寫進第一個 session 的施作項目
  const fillFromScheduled = (s) => {
    const presetId = `periodic-${s.taskId}`
    const newSessions = (form.sessions || []).map((sess, idx) => {
      // 清掉舊的 linkedToPeriodic 項目（換任務時不殘留）
      const cleaned = (sess.tasks || []).filter(t => !t.linkedToPeriodic)
      if (idx !== 0) return { ...sess, tasks: cleaned }
      return {
        ...sess,
        tasks: [
          { presetId, name: s.taskName, location: s.siteName, linkedToPeriodic: true },
          ...cleaned,
        ],
      }
    })
    set({
      linkType:       'periodic',
      contractId:     s.contractId,
      contractSiteId: s.siteId,
      siteName:       s.siteName,
      siteAddress:    s.siteAddress,
      taskId:         s.taskId,
      taskName:       s.taskName,
      sessions:       newSessions,
    })
  }

  // 下拉選單排序：把今日排定的任務排到最上面
  const sortedContractTasks = useMemo(() => {
    const isScheduledToday = (t) => t.scheduledDate === reportDate
    return [...contractTasks].sort((a, b) => Number(isScheduledToday(b)) - Number(isScheduledToday(a)))
  }, [contractTasks, reportDate])

  const addSession    = () => set({ sessions: [...form.sessions, newSession()] })
  const removeSession = (id) => set({ sessions: form.sessions.filter(s => s.id !== id) })
  const updateSession = (id, updated) => set({ sessions: form.sessions.map(s => s.id === id ? updated : s) })

  const subtitle = form.linkType === 'order'
    ? (form.siteName || form.orderName || '尚未選擇訂單')
    : form.linkType === 'periodic'
    ? (form.taskName ? `${form.siteName} — ${form.taskName}` : '尚未選擇週期項目')
    : '不關聯'

  const status   = form.status || 'draft'
  const isLocked = status === 'submitted' || status === 'approved'

  return (
    <div className="max-w-3xl mx-auto space-y-4 pb-8">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-gray-50 pt-2 pb-3 -mx-6 px-6 border-b border-gray-200 flex items-center gap-3">
        <button onClick={onCancel} className="btn-secondary py-2">
          <ChevronLeft size={16} /> 返回
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-gray-900">
              {init.isNew ? '新增工務請款單' : (isLocked ? '檢視工務請款單' : '編輯工務請款單')}
            </h1>
            {!init.isNew && (
              <span className={clsx('text-[11px] font-semibold px-2 py-0.5 rounded-full', STATUS[status]?.badge || 'bg-gray-100 text-gray-600')}>
                {STATUS[status]?.label || status}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400">{subtitle}</p>
        </div>

        {/* draft 才能改 / 提交；submitted 顯示「撤回為草稿」；approved 完全鎖定 */}
        {status === 'draft' && (
          <>
            <button className="btn-secondary" onClick={() => onSave({ ...form, status: 'draft' })}>
              <Save size={15} /> 存草稿
            </button>
            <button className="btn-primary" onClick={() => onSave({ ...form, status: 'submitted' })}>
              <Send size={15} /> 提交
            </button>
          </>
        )}
        {status === 'submitted' && (
          <button
            className="btn-secondary"
            onClick={() => {
              if (confirm('撤回為草稿後可重新修改，主管需重新審核。確定撤回？')) {
                onSave({ ...form, status: 'draft' })
              }
            }}
          >
            <ChevronLeft size={14} /> 撤回為草稿
          </button>
        )}
        {status === 'approved' && (
          <span className="text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-lg font-medium">
            已核准・不可修改
          </span>
        )}
      </div>

      {/* ── 今日排定（依第一個 session 日期、跨合約找出已排定的週期任務）── */}
      {scheduledToday.length > 0 && !form.taskId && (
        <div className="card overflow-hidden border border-amber-200 bg-amber-50/40">
          <div className="px-5 py-3 flex items-center gap-2 border-b border-amber-100 bg-amber-100/60">
            <Calendar size={15} className="text-amber-600" />
            <p className="text-sm font-bold text-amber-800">
              {reportDate} 已排定 {scheduledToday.length} 項
            </p>
            <p className="text-[11px] text-amber-700 ml-auto">點卡片一鍵帶入</p>
          </div>
          <div className="p-3 space-y-2">
            {scheduledToday.map(s => (
              <button
                key={`${s.contractId}_${s.siteId}_${s.taskId}`}
                type="button"
                onClick={() => fillFromScheduled(s)}
                className="w-full text-left bg-white rounded-xl border border-amber-200 hover:border-brand-400 hover:shadow-sm transition-all px-4 py-3"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{s.taskName}</p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      <Building2 size={11} className="inline-block mr-0.5 -mt-0.5" />
                      {s.customerName} · {s.siteName}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5 truncate">{s.contractTitle}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-base font-bold text-brand-700">${s.unitPrice.toLocaleString()}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">點選帶入 →</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Basic Info */}
      <Section icon={FileText} title="基本資訊">
        <div className="space-y-4 mt-1">
          {/* 帶班組長 */}
          <div>
            <label className="label">帶班組長</label>
            <select className="input" value={form.leaderId || ''} onChange={e => handleLeaderChange(e.target.value)}>
              <option value="">選擇帶班組長…</option>
              {activeEmployees.map(e => (
                <option key={e.id} value={e.id}>{e.name}{e.position ? `（${e.position}）` : ''}</option>
              ))}
            </select>
          </div>

          {/* 關聯來源 toggle */}
          <div>
            <label className="label">關聯來源</label>
            <div className="flex rounded-xl border border-gray-200 overflow-hidden">
              {[
                { v: '',         l: '不關聯'           },
                { v: 'order',    l: '單次案件'         },
                { v: 'periodic', l: '年度合約週期項目' },
              ].map(o => (
                <button key={o.v} type="button"
                  onClick={() => clearLink(o.v)}
                  className={clsx('flex-1 py-2 text-sm font-medium transition-colors',
                    form.linkType === o.v ? 'bg-brand-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
                  )}
                >{o.l}</button>
              ))}
            </div>
          </div>

          {/* 單次案件 */}
          {form.linkType === 'order' && (
            <div>
              <label className="label">訂單</label>
              <select className="input" value={form.orderId || ''} onChange={e => handleOrderChange(e.target.value)}>
                <option value="">選擇訂單…</option>
                {orders.filter(o => o.status !== 'closed').map(o => (
                  <option key={o.id} value={o.id}>
                    {o.siteName || o.title}{o.customerName ? ` （${o.customerName}）` : ''}
                  </option>
                ))}
              </select>
              {form.orderId && <p className="text-xs text-teal-600 mt-1">核准後自動更新訂單狀態為「施工完成」</p>}
            </div>
          )}

          {/* 年度合約週期項目 */}
          {form.linkType === 'periodic' && (
            <div className="space-y-3">
              <div>
                <label className="label">年度合約</label>
                <select className="input" value={form.contractId || ''} onChange={e => handleContractChange(e.target.value)}>
                  <option value="">選擇合約…</option>
                  {annualContracts.map(c => (
                    <option key={c.id} value={c.id}>{c.title}（{c.customerName}）</option>
                  ))}
                </select>
              </div>
              {form.contractId && (
                <div>
                  <label className="label">案場</label>
                  <select className="input" value={form.contractSiteId || ''} onChange={e => handleContractSiteChange(e.target.value)}>
                    <option value="">選擇案場…</option>
                    {contractSites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}
              {form.contractSiteId && (
                <div>
                  <label className="label">週期項目</label>
                  <select className="input" value={form.taskId || ''} onChange={e => handleTaskChange(e.target.value)}>
                    <option value="">選擇週期項目…</option>
                    {sortedContractTasks.map(t => {
                      const isToday = t.scheduledDate === reportDate
                      return (
                        <option key={t.id} value={t.id}>
                          {isToday ? '★ ' : ''}{t.name}（{getTaskScheduleText(t)}）
                        </option>
                      )
                    })}
                  </select>
                  {form.taskId && <p className="text-xs text-teal-600 mt-1">核准後：本月標完成 + 排班計畫日清空</p>}
                </div>
              )}
            </div>
          )}

          {/* Site info */}
          {form.siteName && (
            <div className="bg-brand-50 rounded-xl px-4 py-3 text-sm text-brand-700 flex items-start gap-2">
              <Building2 size={14} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">{form.siteName}</p>
                {form.siteAddress && <p className="text-brand-500 text-xs mt-0.5">{form.siteAddress}</p>}
              </div>
            </div>
          )}
        </div>
      </Section>

      {/* Sessions */}
      <div className="card overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-100">
          <div className="p-1.5 bg-brand-50 rounded-lg shrink-0"><Calendar size={15} className="text-brand-600" /></div>
          <span className="font-semibold text-sm text-gray-800 flex-1">施工日期</span>
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">{form.sessions.length} 次</span>
        </div>
        <div className="px-5 py-4 space-y-4">
          {form.sessions.map((sess, idx) => (
            <SessionEditor
              key={sess.id}
              session={sess}
              sessionNum={idx + 1}
              total={form.sessions.length}
              onChange={updated => updateSession(sess.id, updated)}
              onRemove={() => removeSession(sess.id)}
              allEmployees={mobileEmployees}
              inventoryItems={inventoryItems}
              customCleaningTasks={customCleaningTasks}
            />
          ))}
          <button
            type="button"
            onClick={addSession}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-gray-300 text-gray-500 hover:border-brand-400 hover:text-brand-600 hover:bg-brand-50 transition-colors text-sm font-medium"
          >
            <Plus size={16} /> 新增施工日期
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Detail view ──────────────────────────────────────────────────────────────
function ReportDetail({ report, onBack, onEdit, onApprove }) {
  const sc       = STATUS[report.status] || STATUS.draft
  const org      = ORGS.find(o => o.id === report.orgId)
  const sessions = report.sessions || []

  return (
    <div className="max-w-3xl mx-auto space-y-4 pb-8">
      <div className="sticky top-0 z-20 bg-gray-50 pt-2 pb-3 -mx-6 px-6 border-b border-gray-200 flex items-center gap-3">
        <button onClick={onBack} className="btn-secondary py-2"><ChevronLeft size={16} /> 返回</button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base font-bold text-gray-900">{report.siteName || report.orderName || '未命名'}</h1>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 ${sc.badge}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />{sc.label}
            </span>
          </div>
          <p className="text-xs text-gray-400">帶班組長：{report.leaderName || '未指定'}</p>
        </div>
        <button className="btn-secondary" onClick={onEdit}><Pencil size={15} /> 編輯</button>
      </div>

      {/* 關聯資訊（單次 / 週期項目）*/}
      {report.linkType === 'periodic' && report.taskName && (
        <div className="card border border-amber-200 bg-amber-50/40 px-4 py-3">
          <div className="flex items-start gap-2.5">
            <Calendar size={14} className="text-amber-700 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wide">年度合約週期項目</p>
              <p className="text-sm font-bold text-gray-800 mt-0.5">{report.taskName}</p>
              <p className="text-xs text-gray-500 mt-0.5">{report.siteName} · 核准後將標記為本月完成 + 清空排班計畫日</p>
            </div>
          </div>
        </div>
      )}
      {report.linkType === 'order' && report.orderName && (
        <div className="card border border-blue-200 bg-blue-50/40 px-4 py-3">
          <div className="flex items-start gap-2.5">
            <FileText size={14} className="text-blue-700 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-blue-700 uppercase tracking-wide">單次案件</p>
              <p className="text-sm font-bold text-gray-800 mt-0.5">{report.orderName}</p>
              <p className="text-xs text-gray-500 mt-0.5">核准後將更新訂單狀態為「施工完成」</p>
            </div>
          </div>
        </div>
      )}

      {/* Overview banner */}
      <div className="card p-5" style={{ background: `linear-gradient(135deg, ${org?.color}, ${org?.color}cc)` }}>
        <div className="grid grid-cols-3 gap-4 text-white text-center">
          {[
            { label: '施工次數', value: `${sessions.length} 次` },
            { label: '總人次',   value: `${sessions.reduce((s, sess) => s + (sess.manpower?.length || 0), 0)} 人` },
            { label: '工作項目', value: `${sessions.reduce((s, sess) => s + (sess.tasks?.length || 0), 0)} 項` },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-xl font-bold">{value}</p>
              <p className="text-white/70 text-xs mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Session details */}
      {sessions.map((sess, idx) => (
        <div key={sess.id || idx} className="card overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-3.5 bg-gray-50 border-b border-gray-100">
            <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
              {idx + 1}
            </div>
            <Calendar size={13} className="text-gray-400 shrink-0" />
            <span className="text-sm font-semibold text-gray-800 flex-1">{sess.date || '未設定'}</span>
            <span className="text-xs text-gray-400">
              {sess.manpower?.length || 0} 人・{sess.tasks?.length || 0} 項
            </span>
          </div>
          <div className="px-5 py-4 space-y-4">
            {/* Manpower */}
            {(sess.manpower?.length || 0) > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">人力派遣</p>
                <div className="flex flex-wrap gap-2">
                  {sess.manpower.map(m => (
                    <div key={m.employeeId} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                      <div className="w-7 h-7 rounded-full bg-brand-200 flex items-center justify-center text-xs font-bold text-brand-700">{m.name[0]}</div>
                      <span className="text-sm font-medium text-gray-800">{m.name}</span>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${SHIFT[m.shift]?.badge}`}>
                        {SHIFT[m.shift]?.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Tasks */}
            {(sess.tasks?.length || 0) > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">工作項目</p>
                <div className="space-y-2">
                  {sess.tasks.map(t => (
                    <div key={t.presetId} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
                      <div className="w-5 h-5 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
                        <CheckSquare size={11} className="text-brand-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800">{t.name}</p>
                        {t.location && <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1"><MapPin size={10} />{t.location}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Materials */}
            {(sess.materials?.length || 0) > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">材料耗材</p>
                <div className="space-y-2">
                  {sess.materials.map((m, i) => (
                    <div key={i} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-xl">
                      <span className="text-sm text-gray-700">{m.name}</span>
                      <span className="text-sm font-semibold text-gray-900">{m.qty} {m.unit}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Notes */}
            {sess.notes && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">現場備註</p>
                <p className="text-sm text-gray-700 leading-relaxed">{sess.notes}</p>
              </div>
            )}
          </div>
        </div>
      ))}

      {report.status === 'submitted' && (
        <div className="flex justify-end">
          <button className="btn-primary" onClick={() => onApprove(report)}>
            <CheckCircle size={16} /> 核准此工務請款單
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function DailyReportPage() {
  const { activeOrgId }           = useOrg()
  const [view, setView]           = useState('list')
  const [current, setCurrent]     = useState(null)
  const [filterStatus, setStatus] = useState('all')

  const { data: workOrdersRaw }      = useCollection(COL.WORK_ORDERS)
  const { data: employeesRaw }       = useCollection(COL.EMPLOYEES)
  const { data: inventoryItemsRaw }  = useCollection(COL.INVENTORY_ITEMS)
  const { data: ordersRaw }          = useCollection(COL.ORDERS)
  const { data: annualContractsRaw } = useCollection(COL.ANNUAL_CONTRACTS)
  const { data: customCleaningTasks } = useCollection(COL.CLEANING_TASKS)

  const reports         = workOrdersRaw.filter(r => r.orgId === activeOrgId)
  const employees       = employeesRaw.filter(e => e.orgId === activeOrgId)
  const inventoryItems  = inventoryItemsRaw.filter(i => i.orgId === activeOrgId)
  const orders          = ordersRaw.filter(o => o.orgId === activeOrgId)
  const annualContracts = annualContractsRaw.filter(c => c.orgId === activeOrgId)

  const newReport = () => ({
    isNew:           true,
    orgId:           activeOrgId,
    linkType:        '',
    orderId:         '',
    orderName:       '',
    contractId:      '',
    contractSiteId:  '',
    taskId:          '',
    taskName:        '',
    siteName:        '',
    siteAddress:     '',
    leaderId:        '',
    leaderName:      '',
    status:          'draft',
    sessions:        [newSession()],
  })

  const openNew    = ()  => { setCurrent(newReport());             setView('form')   }
  const openEdit   = (r) => { setCurrent({ ...r, isNew: false });  setView('form')   }
  const openDetail = (r) => { setCurrent(r);                       setView('detail') }

  const approveReport = async (r) => {
    await updateWorkOrder(r.id, { status: 'approved' })
    if (r.linkType === 'order' && r.orderId) {
      await updateOrder(r.orderId, { status: 'done' })
    }
    if (r.linkType === 'periodic' && r.contractId && r.contractSiteId && r.taskId) {
      const contract     = annualContractsRaw.find(c => c.id === r.contractId)
      const currentMonth = new Date().getMonth() + 1
      const reportDate   = r.sessions?.[0]?.date || ''
      if (contract) {
        const newSites = (contract.sites || []).map(site => {
          if (site.id !== r.contractSiteId) return site
          return {
            ...site,
            periodicTasks: (site.periodicTasks || []).map(task => {
              if (task.id !== r.taskId) return task
              const updated = {
                ...task,
                completedMonths:    [...new Set([...(task.completedMonths || []), currentMonth])],
                lastCompletedDate:  reportDate || task.lastCompletedDate || '',
              }
              // 核准後回寫排班：若請款單日期 = 排班計畫日，清掉計畫日避免重複亮燈
              if (task.scheduledDate && task.scheduledDate === reportDate) {
                updated.scheduledDate = null
              }
              return updated
            }),
          }
        })
        await updateAnnualContract(r.contractId, { sites: newSites })
      }
    }
  }

  const saveReport = async (r) => {
    const { isNew, ...data } = r
    if (isNew) {
      await addWorkOrder(data)
    } else {
      await updateWorkOrder(r.id, data)
    }
    setView('list')
  }

  const filtered = useMemo(() =>
    reports
      .filter(r => filterStatus === 'all' || r.status === filterStatus)
      .sort((a, b) => {
        const aDate = (a.sessions?.[0]?.date || '')
        const bDate = (b.sessions?.[0]?.date || '')
        return bDate.localeCompare(aDate)
      }),
    [reports, filterStatus]
  )

  const liveReport = reports.find(r => r.id === current?.id) || current

  if (view === 'form')   return <ReportForm   report={current} onSave={saveReport} onCancel={() => setView('list')} employees={employees} inventoryItems={inventoryItems} orders={orders} annualContracts={annualContracts} customCleaningTasks={customCleaningTasks} />
  if (view === 'detail') return <ReportDetail report={liveReport} onBack={() => setView('list')} onEdit={() => openEdit(liveReport)} onApprove={approveReport} />

  // ── List view ──────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">工務請款單</h1>
          <p className="text-sm text-gray-500 mt-0.5">現場工作紀錄 · 人力派遣 · 材料耗材</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
            {[
              { key: 'all',       label: '全部' },
              { key: 'draft',     label: '草稿' },
              { key: 'submitted', label: '待審' },
              { key: 'approved',  label: '已核' },
            ].map(({ key, label }) => (
              <button key={key} onClick={() => setStatus(key)}
                className={clsx('px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                  filterStatus === key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                )}
              >{label}</button>
            ))}
          </div>
          <button className="btn-primary" onClick={openNew}>
            <Plus size={16} /> 新增工務請款單
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: '工務請款單', value: reports.length,                                       color: 'text-blue-600'  },
          { label: '待審核',     value: reports.filter(r => r.status === 'submitted').length, color: 'text-amber-600' },
          { label: '已核准',     value: reports.filter(r => r.status === 'approved').length,  color: 'text-green-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card p-4 text-center">
            <p className={`text-3xl font-bold ${color}`}>{value}</p>
            <p className="text-sm text-gray-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Report grid */}
      {filtered.length === 0 ? (
        <div className="card p-20 text-center">
          <ClipboardList size={48} className="mx-auto mb-4 text-gray-200" />
          <p className="text-gray-400 font-medium">尚無工務請款單紀錄</p>
          <p className="text-sm text-gray-300 mt-1">點下方按鈕建立第一份</p>
          <button className="btn-primary mt-5" onClick={openNew}><Plus size={16} /> 新增工務請款單</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(r => (
            <ReportCard key={r.id} report={r} onClick={() => openDetail(r)} />
          ))}
        </div>
      )}
    </div>
  )
}
