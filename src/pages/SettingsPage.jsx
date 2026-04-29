import { useState, useEffect } from 'react'
import {
  Save, Plus, Trash2, Shield, Layers, Download, Calculator, Percent, Briefcase,
} from 'lucide-react'
import { WORK_TYPES } from '../lib/mockData'
import { useDoc } from '../hooks/useCollection'
import { setSettingsDoc } from '../lib/db'
import {
  HEALTH_BRACKETS_2026,
  LABOR_BRACKETS_REGULAR_2026,
  LABOR_BRACKETS_PARTTIME_2026,
  PAYROLL_RATES_2026,
} from '../lib/insuranceBracketsSeed'

const TABS = [
  { id: 'rates',     label: '費率與基本工資', icon: Percent },
  { id: 'health',    label: '健保級距',       icon: Shield },
  { id: 'labor',     label: '勞保級距',       icon: Briefcase },
  { id: 'general',   label: '一般設定',       icon: Layers },
]

export default function SettingsPage() {
  const [tab, setTab] = useState('rates')

  return (
    <div className="max-w-4xl mx-auto">
      {/* Tab nav */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {TABS.map(t => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
                active
                  ? 'text-brand-600 border-brand-600'
                  : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              <Icon size={15} />{t.label}
            </button>
          )
        })}
      </div>

      {tab === 'rates'   && <RatesPanel />}
      {tab === 'health'  && <BracketPanel docId="healthBrackets" title="健保級距表" seed={HEALTH_BRACKETS_2026} />}
      {tab === 'labor'   && <LaborBracketPanel />}
      {tab === 'general' && <GeneralPanel />}
    </div>
  )
}

// ─── 費率設定 ────────────────────────────────────────────────────────────────
function RatesPanel() {
  const { data, loading } = useDoc('settings', 'payrollRates')
  const [form, setForm]   = useState(PAYROLL_RATES_2026)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState(null)

  useEffect(() => { if (data) setForm({ ...PAYROLL_RATES_2026, ...data }) }, [data])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    setSaving(true)
    try {
      await setSettingsDoc('payrollRates', form)
      setSavedAt(new Date())
    } finally { setSaving(false) }
  }

  const handleSeed = async () => {
    if (!confirm('確定要把費率重置為政府公布的 115 年版預設值嗎？')) return
    setSaving(true)
    try {
      await setSettingsDoc('payrollRates', PAYROLL_RATES_2026)
      setForm(PAYROLL_RATES_2026)
      setSavedAt(new Date())
    } finally { setSaving(false) }
  }

  const fields = [
    { key: 'basicWage',         label: '基本工資（月薪）', suffix: '元', step: 1 },
    { key: 'basicHourlyWage',   label: '基本工資（時薪）', suffix: '元', step: 1 },
    { key: 'laborRate',         label: '勞保費率',         suffix: '%', toPct: true, step: 0.01 },
    { key: 'laborEmployerPct',  label: '勞保雇主負擔比例', suffix: '%', toPct: true, step: 0.01 },
    { key: 'laborEmployeePct',  label: '勞保員工負擔比例', suffix: '%', toPct: true, step: 0.01 },
    { key: 'occupationalRate',  label: '職災保險費率',     suffix: '%', toPct: true, step: 0.01 },
    { key: 'healthRate',        label: '健保費率',         suffix: '%', toPct: true, step: 0.01 },
    { key: 'healthEmployerPct', label: '健保雇主負擔比例', suffix: '%', toPct: true, step: 0.01 },
    { key: 'healthEmployeePct', label: '健保員工負擔比例', suffix: '%', toPct: true, step: 0.01 },
    { key: 'dependentAvg',      label: '雇主端平均眷口數', suffix: '人', step: 0.01 },
    { key: 'pensionRate',       label: '勞退提撥率（雇主）', suffix: '%', toPct: true, step: 0.01 },
  ]

  if (loading) return <div className="text-sm text-gray-400">載入中…</div>

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
          <Calculator size={18} className="text-brand-600" /> 費率與基本工資
        </h2>
        <button className="btn-secondary text-xs" onClick={handleSeed} disabled={saving}>
          <Download size={13} /> 從預設值匯入
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {fields.map(({ key, label, suffix, toPct, step }) => (
          <div key={key}>
            <label className="label">{label}</label>
            <div className="relative">
              <input
                className="input pr-12"
                type="number" step={step}
                value={toPct ? +(form[key] * 100).toFixed(4) : form[key]}
                onChange={e => {
                  const v = +e.target.value
                  set(key, toPct ? v / 100 : v)
                }}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{suffix}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mt-5">
        <p className="text-xs text-gray-400">
          {savedAt ? `已儲存於 ${savedAt.toLocaleTimeString('zh-TW')}` : '修改後請按儲存才會生效'}
        </p>
        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          <Save size={14} /> {saving ? '儲存中…' : '儲存設定'}
        </button>
      </div>
    </div>
  )
}

// ─── 健保 / 勞保 級距共用面板 ────────────────────────────────────────────────
function BracketPanel({ docId, title, seed }) {
  const { data, loading } = useDoc('settings', docId)
  const [list, setList]   = useState(seed)
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (data?.brackets) setList(data.brackets) }, [data])

  const update = (i, v) => setList(arr => arr.map((x, idx) => idx === i ? +v : x))
  const remove = (i) => setList(arr => arr.filter((_, idx) => idx !== i))
  const add    = () => setList(arr => [...arr, 0])

  const handleSave = async () => {
    const sorted = [...list].filter(n => n > 0).sort((a, b) => a - b)
    setSaving(true)
    try {
      await setSettingsDoc(docId, { brackets: sorted })
      setList(sorted)
    } finally { setSaving(false) }
  }

  const handleSeed = async () => {
    if (!confirm(`確定要重置 ${title} 為 115 年版預設值嗎？`)) return
    setSaving(true)
    try {
      await setSettingsDoc(docId, { brackets: seed })
      setList(seed)
    } finally { setSaving(false) }
  }

  if (loading) return <div className="text-sm text-gray-400">載入中…</div>

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
          <Shield size={18} className="text-brand-600" /> {title}
        </h2>
        <button className="btn-secondary text-xs" onClick={handleSeed} disabled={saving}>
          <Download size={13} /> 從預設值匯入
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {list.map((salary, i) => (
          <div key={i} className="flex items-center gap-1">
            <span className="text-xs text-gray-400 w-6 text-right">{i + 1}</span>
            <input
              className="input text-sm"
              type="number" min="0"
              value={salary}
              onChange={e => update(i, e.target.value)}
            />
            <button onClick={() => remove(i)} className="p-1 text-red-400 hover:text-red-600">
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mt-4">
        <button className="btn-secondary text-sm" onClick={add}>
          <Plus size={13} /> 新增一級
        </button>
        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          <Save size={14} /> {saving ? '儲存中…' : '儲存設定'}
        </button>
      </div>
    </div>
  )
}

function LaborBracketPanel() {
  const { data, loading } = useDoc('settings', 'laborBrackets')
  const [regular, setRegular]   = useState(LABOR_BRACKETS_REGULAR_2026)
  const [partTime, setPartTime] = useState(LABOR_BRACKETS_PARTTIME_2026)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (data?.brackets) setRegular(data.brackets)
    if (data?.partTime) setPartTime(data.partTime)
  }, [data])

  const handleSave = async () => {
    setSaving(true)
    try {
      await setSettingsDoc('laborBrackets', {
        brackets: [...regular].filter(n => n > 0).sort((a, b) => a - b),
        partTime: [...partTime].filter(n => n > 0).sort((a, b) => a - b),
      })
    } finally { setSaving(false) }
  }

  const handleSeed = async () => {
    if (!confirm('確定要重置勞保級距為 115 年版預設值嗎？')) return
    setSaving(true)
    try {
      await setSettingsDoc('laborBrackets', {
        brackets: LABOR_BRACKETS_REGULAR_2026,
        partTime: LABOR_BRACKETS_PARTTIME_2026,
      })
      setRegular(LABOR_BRACKETS_REGULAR_2026)
      setPartTime(LABOR_BRACKETS_PARTTIME_2026)
    } finally { setSaving(false) }
  }

  const renderList = (list, setList, title) => (
    <div>
      <p className="text-sm font-semibold text-gray-700 mb-2">{title}</p>
      <div className="grid grid-cols-4 gap-2">
        {list.map((salary, i) => (
          <div key={i} className="flex items-center gap-1">
            <span className="text-xs text-gray-400 w-6 text-right">{i + 1}</span>
            <input
              className="input text-sm"
              type="number" min="0"
              value={salary}
              onChange={e => setList(arr => arr.map((x, idx) => idx === i ? +e.target.value : x))}
            />
            <button
              onClick={() => setList(arr => arr.filter((_, idx) => idx !== i))}
              className="p-1 text-red-400 hover:text-red-600"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
      <button className="btn-secondary text-xs mt-2" onClick={() => setList(arr => [...arr, 0])}>
        <Plus size={12} /> 新增一級
      </button>
    </div>
  )

  if (loading) return <div className="text-sm text-gray-400">載入中…</div>

  return (
    <div className="card p-5 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
          <Briefcase size={18} className="text-brand-600" /> 勞保級距表
        </h2>
        <button className="btn-secondary text-xs" onClick={handleSeed} disabled={saving}>
          <Download size={13} /> 從預設值匯入
        </button>
      </div>

      {renderList(regular, setRegular, '一般受僱者級距（第 1 ~ 11 級）')}
      {renderList(partTime, setPartTime, '部分工時專屬級距')}

      <div className="flex justify-end pt-2">
        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          <Save size={14} /> {saving ? '儲存中…' : '儲存設定'}
        </button>
      </div>
    </div>
  )
}

// ─── 一般設定（保留原內容）──────────────────────────────────────────────────
function GeneralPanel() {
  return (
    <div className="space-y-6">
      <div className="card p-5">
        <h2 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Shield size={18} className="text-brand-600" /> 後端權限驗證 (RBAC)
        </h2>
        <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600 space-y-2">
          <p>使用者身分由 <strong>Firebase Custom Claims</strong> 設定，前端僅讀取並渲染 UI。</p>
          <table className="w-full text-sm mt-2">
            <thead>
              <tr className="text-left">
                <th className="pb-2 text-gray-700 font-medium">角色</th>
                <th className="pb-2 text-gray-700 font-medium">可存取模組</th>
              </tr>
            </thead>
            <tbody>
              {[
                { role: '管理者 (admin)',   access: '全部模組' },
                { role: '行政 (staff)',     access: '客戶、訂單、排班、派工、進貨' },
                { role: '員工 (employee)', access: '現場作業、儀表板' },
              ].map(r => (
                <tr key={r.role} className="border-t border-gray-100">
                  <td className="py-1.5 font-medium">{r.role}</td>
                  <td className="py-1.5 text-gray-500">{r.access}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Layers size={18} className="text-brand-600" /> 工作類型
        </h2>
        <div className="space-y-2">
          {WORK_TYPES.map(t => (
            <div key={t.id} className="flex items-center gap-3 py-2 px-3 border border-gray-100 rounded-lg">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color }} />
              <span className="flex-1 text-sm text-gray-700">{t.name}</span>
              <span className="badge badge-gray">系統預設</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
