import { useState, useMemo } from 'react'
import {
  Users, Plus, Search, Phone, Mail, MapPin,
  Calendar, Briefcase, Star, FileText, Download,
  X, ChevronRight, Shield, AlertCircle, CheckCircle,
  Clock, UserX, Filter, KeyRound, UserCheck, Loader2,
} from 'lucide-react'
import { ORGS } from '../lib/mockData'
import { COL, addEmployee, updateEmployee } from '../lib/db'
import { useCollection } from '../hooks/useCollection'
import { functions } from '../lib/firebase'
import { httpsCallable } from 'firebase/functions'
import clsx from 'clsx'

// ─── Work mode config ─────────────────────────────────────────────────────────
const WORK_MODE = {
  stationed: { label: '駐點', badge: 'bg-green-100 text-green-700',  dot: 'bg-green-500'  },
  mobile:    { label: '機動', badge: 'bg-amber-100 text-amber-700',  dot: 'bg-amber-500'  },
  office:    { label: '內勤', badge: 'bg-violet-100 text-violet-700', dot: 'bg-violet-500' },
}
// Pay type within each mode
const PAY_TYPE = {
  monthly: { label: '正職員工', badge: 'bg-blue-100 text-blue-700',  dot: 'bg-blue-500'  },
  daily:   { label: '日薪員工', badge: 'bg-gray-100 text-gray-600',  dot: 'bg-gray-400'  },
}
// 內勤職務類型
const OFFICE_TYPE = {
  principal:  { label: '負責人',  badge: 'bg-rose-100 text-rose-700'     },
  admin_dept: { label: '行政部門', badge: 'bg-sky-100 text-sky-700'       },
  it_dept:    { label: '資訊部門', badge: 'bg-indigo-100 text-indigo-700' },
}

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  active:   { label: '在職',   dot: 'bg-green-400',  badge: 'bg-green-100 text-green-700',  icon: CheckCircle },
  leave:    { label: '請假中', dot: 'bg-amber-400',  badge: 'bg-amber-100 text-amber-700',  icon: Clock       },
  resigned: { label: '已離職', dot: 'bg-red-400',    badge: 'bg-red-100 text-red-600',      icon: UserX       },
}

const POSITION_COLORS = {
  '清潔組長':   'bg-blue-100 text-blue-700',
  '清潔技術員': 'bg-gray-100 text-gray-600',
  '機動清潔員': 'bg-purple-100 text-purple-700',
  '負責人':     'bg-rose-100 text-rose-700',
  '行政部門':   'bg-sky-100 text-sky-700',
  '資訊部門':   'bg-indigo-100 text-indigo-700',
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color = 'blue' }) {
  const palette = {
    blue:   { bg: 'bg-blue-50',   text: 'text-blue-700'   },
    green:  { bg: 'bg-green-50',  text: 'text-green-700'  },
    amber:  { bg: 'bg-amber-50',  text: 'text-amber-700'  },
    red:    { bg: 'bg-red-50',    text: 'text-red-700'    },
    purple: { bg: 'bg-purple-50', text: 'text-purple-700' },
  }
  const c = palette[color] || palette.blue
  return (
    <div className="card p-4 flex items-start gap-3">
      <div className={`p-2 rounded-xl shrink-0 ${c.bg} ${c.text}`}><Icon size={18} /></div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ name, orgId, size = 'md' }) {
  const org   = ORGS.find(o => o.id === orgId)
  const color = orgId === 'jiaxiang' ? '#2563eb' : '#7c3aed'
  const dim   = size === 'lg' ? 'w-14 h-14 text-xl' : 'w-9 h-9 text-sm'
  return (
    <div
      className={`${dim} rounded-full flex items-center justify-center font-bold text-white shrink-0`}
      style={{ backgroundColor: color }}
    >
      {name[0]}
    </div>
  )
}

// ─── Employee row ─────────────────────────────────────────────────────────────
function EmployeeRow({ emp, onClick, showUnit = false, hideWorkMode = false, hidePayType = false }) {
  const sc  = STATUS_CONFIG[emp.status] || STATUS_CONFIG.active
  const org = ORGS.find(o => o.id === emp.orgId)
  const posColor = POSITION_COLORS[emp.position] || 'bg-gray-100 text-gray-600'
  const tenure = (() => {
    const ms = new Date() - new Date(emp.joinDate)
    const months = Math.floor(ms / (1000 * 60 * 60 * 24 * 30))
    if (months < 12) return `${months} 個月`
    return `${Math.floor(months / 12)} 年 ${months % 12} 個月`
  })()

  return (
    <tr
      className="hover:bg-gray-50 cursor-pointer transition-colors"
      onClick={() => onClick(emp)}
    >
      {/* Name + avatar */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar name={emp.name} orgId={emp.orgId} />
          <div>
            <p className="font-semibold text-sm text-gray-900">{emp.name}</p>
            <p className="text-xs text-gray-400">{emp.email}</p>
          </div>
        </div>
      </td>

      {/* Company */}
      <td className="px-4 py-3 hidden sm:table-cell">
        <span
          className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full text-white"
          style={{ backgroundColor: org?.color }}
        >
          {org?.name}
        </span>
      </td>

      {/* Position / stationed unit */}
      <td className="px-4 py-3 hidden md:table-cell">
        <div className="flex flex-wrap gap-1">
          {showUnit && emp.stationedSite ? (
            <span className="text-sm text-gray-700">{emp.stationedSite}</span>
          ) : (
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${posColor}`}>
              {emp.position}
            </span>
          )}
          {!hideWorkMode && emp.workMode && WORK_MODE[emp.workMode] && emp.workMode !== 'office' && (
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 ${WORK_MODE[emp.workMode].badge}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${WORK_MODE[emp.workMode].dot}`} />
              {WORK_MODE[emp.workMode].label}
            </span>
          )}
          {!hidePayType && emp.payType && PAY_TYPE[emp.payType] && emp.workMode !== 'office' && (
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${PAY_TYPE[emp.payType].badge}`}>
              {PAY_TYPE[emp.payType].label}
            </span>
          )}
        </div>
      </td>

      {/* Phone */}
      <td className="px-4 py-3 hidden lg:table-cell">
        <span className="text-sm text-gray-600">{emp.phone}</span>
      </td>

      {/* Join date / tenure */}
      <td className="px-4 py-3 hidden lg:table-cell">
        <p className="text-sm text-gray-700">{emp.joinDate}</p>
        <p className="text-xs text-gray-400">{tenure}</p>
      </td>

      {/* Monthly salary */}
      <td className="px-4 py-3 hidden xl:table-cell">
        <span className="text-sm font-semibold text-gray-800">
          ${emp.monthlySalary.toLocaleString()}
        </span>
      </td>

      {/* Skills */}
      <td className="px-4 py-3 hidden xl:table-cell">
        <div className="flex flex-wrap gap-1 max-w-[200px]">
          {emp.skills.slice(0, 3).map(s => (
            <span key={s} className="text-[11px] bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full">{s}</span>
          ))}
          {emp.skills.length > 3 && (
            <span className="text-[11px] text-gray-400">+{emp.skills.length - 3}</span>
          )}
        </div>
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${sc.badge}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
          {sc.label}
        </span>
      </td>

      {/* Arrow */}
      <td className="px-3 py-3">
        <ChevronRight size={16} className="text-gray-300" />
      </td>
    </tr>
  )
}

// ─── Detail modal ─────────────────────────────────────────────────────────────
// ─── Account management modal ─────────────────────────────────────────────────
function AccountModal({ emp, onClose }) {
  const hasAccount = !!emp.authUid
  const [tempPw,   setTempPw]   = useState('')
  const [loading,  setLoading]  = useState(false)
  const [success,  setSuccess]  = useState(false)
  const [error,    setError]    = useState('')

  const createAccount  = httpsCallable(functions, 'createEmployeeAccount')
  const resetPassword  = httpsCallable(functions, 'resetEmployeePassword')

  const handleCreate = async () => {
    if (tempPw.length < 4) { setError('預設密碼至少需要 4 個字元'); return }
    setLoading(true); setError('')
    try {
      const result = await createAccount({
        employeeId:  emp.id.toLowerCase(),
        displayName: emp.name,
        tempPassword: tempPw,
        orgId:       emp.orgId,
        role:        emp.workMode === 'office' ? 'admin' : 'employee',
      })
      await updateEmployee(emp.id, { authUid: result.data.uid })
      setSuccess(true)
    } catch (e) {
      setError(e.message || '建立失敗，請稍後再試')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = async () => {
    if (tempPw.length < 4) { setError('臨時密碼至少需要 4 個字元'); return }
    setLoading(true); setError('')
    try {
      await resetPassword({ employeeId: emp.id.toLowerCase(), tempPassword: tempPw })
      setSuccess(true)
    } catch (e) {
      setError(e.message || '重設失敗，請稍後再試')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4"
      onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4"
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <KeyRound size={18} className="text-brand-600" />
            {hasAccount ? '重設登入密碼' : '建立登入帳號'}
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X size={16} />
          </button>
        </div>

        {success ? (
          <div className="text-center py-4 space-y-2">
            <CheckCircle size={40} className="text-green-500 mx-auto" />
            <p className="font-semibold text-gray-800">
              {hasAccount ? '密碼已重設' : '帳號建立成功'}
            </p>
            <p className="text-sm text-gray-500">
              員工編號：<span className="font-mono font-bold">{emp.id.toUpperCase()}</span>
              <br />臨時密碼：<span className="font-mono font-bold">{tempPw}</span>
            </p>
            <p className="text-xs text-amber-600 bg-amber-50 rounded-lg p-2 mt-2">
              請將此臨時密碼交給員工，首次登入後將強制更改密碼
            </p>
            <button className="btn-primary w-full justify-center mt-3" onClick={onClose}>完成</button>
          </div>
        ) : (
          <>
            <div className="bg-gray-50 rounded-xl p-3 text-sm space-y-1">
              <p className="text-gray-500">員工姓名</p>
              <p className="font-semibold text-gray-900">{emp.name}</p>
              <p className="text-gray-500 mt-1.5">登入帳號</p>
              <p className="font-mono text-brand-700 font-bold">{emp.id.toUpperCase()}</p>
            </div>

            <div>
              <label className="label">{hasAccount ? '新臨時密碼' : '預設密碼'}</label>
              <input
                type="text"
                className="input font-mono tracking-widest"
                value={tempPw}
                onChange={e => setTempPw(e.target.value)}
                placeholder={hasAccount ? '輸入新的臨時密碼' : '建議使用身分證後四碼'}
                autoFocus
              />
              <p className="text-xs text-gray-400 mt-1">員工首次登入後會被要求更改密碼</p>
            </div>

            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

            <div className="flex gap-3 pt-1">
              <button className="btn-secondary flex-1 justify-center" onClick={onClose} disabled={loading}>取消</button>
              <button
                className="btn-primary flex-1 justify-center"
                onClick={hasAccount ? handleReset : handleCreate}
                disabled={loading || !tempPw}
              >
                {loading ? <Loader2 size={15} className="animate-spin" /> : <UserCheck size={15} />}
                {loading ? '處理中...' : hasAccount ? '確認重設' : '建立帳號'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function DetailModal({ emp, onClose, onEdit }) {
  const [showAccount, setShowAccount] = useState(false)
  const sc      = STATUS_CONFIG[emp.status] || STATUS_CONFIG.active
  const StatusIcon = sc.icon
  const org     = ORGS.find(o => o.id === emp.orgId)
  const posColor = POSITION_COLORS[emp.position] || 'bg-gray-100 text-gray-600'
  const tenure  = (() => {
    const ms     = new Date() - new Date(emp.joinDate)
    const months = Math.floor(ms / (1000 * 60 * 60 * 24 * 30))
    if (months < 12) return `${months} 個月`
    return `${Math.floor(months / 12)} 年 ${months % 12} 個月`
  })()

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header banner */}
        <div
          className="px-6 py-5 flex items-center gap-4 text-white relative"
          style={{ background: `linear-gradient(135deg, ${org?.color}, ${org?.color}cc)` }}
        >
          <Avatar name={emp.name} orgId={emp.orgId} size="lg" />
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold">{emp.name}</h2>
            <p className="text-white/80 text-sm mt-0.5">{emp.position} · {org?.name}</p>
          </div>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Status + stats row */}
        <div className="px-6 pt-4 pb-2 flex flex-wrap gap-3">
          <span className={`inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-full ${sc.badge}`}>
            <StatusIcon size={14} />
            {sc.label}
          </span>
          <span className="inline-flex items-center gap-1.5 text-sm text-gray-600 bg-gray-100 px-3 py-1.5 rounded-full">
            <Calendar size={14} />
            在職 {tenure}
          </span>
          <span className="inline-flex items-center gap-1.5 text-sm text-gray-600 bg-gray-100 px-3 py-1.5 rounded-full">
            <Clock size={14} />
            本月 {emp.workDaysThisMonth} 工作天
          </span>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4 max-h-[60vh] overflow-y-auto">

          {/* Contact info */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">聯絡資訊</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-3 text-sm">
                <Phone size={15} className="text-gray-400 shrink-0" />
                <a href={`tel:${emp.phone}`} className="text-gray-700 hover:text-brand-600">{emp.phone}</a>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Mail size={15} className="text-gray-400 shrink-0" />
                <a href={`mailto:${emp.email}`} className="text-gray-700 hover:text-brand-600 truncate">{emp.email}</a>
              </div>
              <div className="flex items-start gap-3 text-sm">
                <MapPin size={15} className="text-gray-400 shrink-0 mt-0.5" />
                <span className="text-gray-700">{emp.address}</span>
              </div>
            </div>
          </div>

          {/* HR info */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">人事資料</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: '身分證號',   value: emp.idNumber    },
                { label: '到職日',     value: emp.joinDate    },
                { label: '月薪',       value: `$${emp.monthlySalary.toLocaleString()}` },
                emp.baseSalary ? { label: '本薪', value: `$${Number(emp.baseSalary).toLocaleString()}` } : null,
                { label: '特休餘額',   value: `${emp.leaveBalance} 天` },
              ].filter(Boolean).map(({ label, value }) => (
                <div key={label} className="bg-gray-50 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                  <p className="text-sm font-semibold text-gray-800">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Insurance / pension */}
          {(emp.laborInsuredSalary || emp.healthInsuredSalary || emp.laborPensionEmployer) ? (
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">保險與退休金</h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: '勞保投保金額',    value: emp.laborInsuredSalary     },
                  { label: '健保投保金額',    value: emp.healthInsuredSalary    },
                  { label: '勞保自付額',      value: emp.laborInsuranceEmployee },
                  { label: '勞保單位負擔',    value: emp.laborInsuranceEmployer },
                  { label: '健保自付額',      value: emp.healthInsuranceEmployee },
                  { label: '健保單位負擔',    value: emp.healthInsuranceEmployer },
                  emp.laborPensionEmployer ? { label: '勞退提撥（雇主）', value: emp.laborPensionEmployer, rate: emp.laborPensionEmployerRate } : null,
                  emp.laborPensionEmployee ? { label: '勞退提撥（自提）', value: emp.laborPensionEmployee, rate: emp.laborPensionEmployeeRate } : null,
                ].filter(i => i?.value).map(({ label, value, rate }) => (
                  <div key={label} className="bg-gray-50 rounded-xl px-3 py-2.5">
                    <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                    <p className="text-sm font-semibold text-gray-800">${Number(value).toLocaleString()}</p>
                    {rate != null && <p className="text-xs text-gray-400 mt-0.5">{rate}% 本薪</p>}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Bank account */}
          {(emp.bankCode || emp.bankAccount) ? (
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">銀行帳戶</h3>
              <div className="grid grid-cols-2 gap-3">
                {emp.bankCode && (
                  <div className="bg-gray-50 rounded-xl px-3 py-2.5">
                    <p className="text-xs text-gray-400 mb-0.5">郵局 / 銀行代號</p>
                    <p className="text-sm font-semibold text-gray-800">{emp.bankCode}</p>
                  </div>
                )}
                {emp.bankAccount && (
                  <div className="bg-gray-50 rounded-xl px-3 py-2.5">
                    <p className="text-xs text-gray-400 mb-0.5">帳號</p>
                    <p className="text-sm font-semibold text-gray-800 font-mono">{emp.bankAccount}</p>
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {/* Emergency contact */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">緊急聯絡人</h3>
            <div className="flex items-center gap-3 bg-red-50 rounded-xl px-4 py-3 text-sm">
              <Shield size={15} className="text-red-400 shrink-0" />
              <span className="text-red-700">{emp.emergencyContact}</span>
            </div>
          </div>

          {/* Skills */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">技能專長</h3>
            <div className="flex flex-wrap gap-2">
              {emp.skills.map(s => (
                <span key={s} className="flex items-center gap-1 bg-brand-50 text-brand-700 text-sm px-3 py-1.5 rounded-full font-medium">
                  <Star size={11} />
                  {s}
                </span>
              ))}
            </div>
          </div>

          {/* Note */}
          {emp.note && (
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">備註</h3>
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-sm text-amber-800">
                <AlertCircle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                {emp.note}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t space-y-2">
          <div className="flex gap-3">
            <button className="btn-secondary flex-1 justify-center" onClick={() => setShowAccount(true)}>
              <KeyRound size={15} />
              {emp.authUid ? '重設密碼' : '建立帳號'}
            </button>
            <button className="btn-primary flex-1 justify-center" onClick={onEdit}>
              編輯資料
            </button>
          </div>
          {emp.authUid && (
            <p className="text-xs text-center text-green-600 flex items-center justify-center gap-1">
              <UserCheck size={12} /> 已有登入帳號（{emp.id.toUpperCase()}）
            </p>
          )}
        </div>
      </div>

      {showAccount && (
        <AccountModal emp={emp} onClose={() => setShowAccount(false)} />
      )}
    </div>
  )
}

// ─── Employee type options ────────────────────────────────────────────────────
const EMP_TYPE_OPTIONS = [
  {
    key: 'fulltime-stationed',
    label: '正職駐點', sub: '月薪 · 固定案場',
    workMode: 'stationed', payType: 'monthly', employmentType: 'fulltime',
    position: '清潔技術員',
  },
  {
    key: 'daily-stationed',
    label: '日薪駐點', sub: '日薪 · 固定案場',
    workMode: 'stationed', payType: 'daily', employmentType: 'stationed',
    position: '清潔技術員',
  },
  {
    key: 'fulltime-mobile',
    label: '正職機動', sub: '月薪 · 機動派工',
    workMode: 'mobile', payType: 'monthly', employmentType: 'fulltime',
    position: '機動清潔員',
  },
  {
    key: 'daily-mobile',
    label: '日薪機動', sub: '日薪 · 按次計算',
    workMode: 'mobile', payType: 'daily', employmentType: 'mobile',
    position: '機動清潔員',
  },
  {
    key: 'principal',
    label: '負責人', sub: '內勤 · 公司負責人',
    workMode: 'office', payType: 'monthly', employmentType: 'principal',
    position: '負責人',
  },
  {
    key: 'admin_dept',
    label: '行政部門', sub: '內勤 · 行政人員',
    workMode: 'office', payType: 'monthly', employmentType: 'admin_dept',
    position: '行政部門',
  },
  {
    key: 'it_dept',
    label: '資訊部門', sub: '內勤 · 資訊人員',
    workMode: 'office', payType: 'monthly', employmentType: 'it_dept',
    position: '資訊部門',
  },
]

// ─── Add employee modal ───────────────────────────────────────────────────────
function AddModal({ onClose, allSites }) {
  const [form, setForm] = useState({
    name: '', orgId: 'jiaxiang', empTypeKey: 'fulltime-stationed',
    phone: '', email: '', idNumber: '',
    joinDate: new Date().toISOString().slice(0, 10),
    salary: '', stationedSite: '',
    baseSalary: '',
    laborInsuredSalary: '', healthInsuredSalary: '',
    laborInsuranceEmployee: '', laborInsuranceEmployer: '',
    healthInsuranceEmployee: '', healthInsuranceEmployer: '',
    laborPensionEmployerRate: '', laborPensionEmployeeRate: '',
    bankCode: '', bankAccount: '',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const empType   = EMP_TYPE_OPTIONS.find(t => t.key === form.empTypeKey) || EMP_TYPE_OPTIONS[0]
  const isMonthly = empType.payType === 'monthly'
  const isStationed = empType.workMode === 'stationed'
  const isOffice    = empType.workMode === 'office'

  const pensionBase = Number(form.laborInsuredSalary) || 0
  const pensionEmployerAmt = Math.round(pensionBase * (Number(form.laborPensionEmployerRate) || 0) / 100)
  const pensionEmployeeAmt = Math.round(pensionBase * (Number(form.laborPensionEmployeeRate) || 0) / 100)

  const handleSave = async () => {
    if (!form.name.trim()) { setErr('請填寫姓名'); return }
    setSaving(true)
    setErr('')
    try {
      await addEmployee({
        orgId:          form.orgId,
        name:           form.name.trim(),
        phone:          form.phone.trim(),
        email:          form.email.trim(),
        idNumber:       form.idNumber.trim(),
        joinDate:       form.joinDate,
        position:       empType.position,
        workMode:       empType.workMode,
        payType:        empType.payType,
        employmentType: empType.employmentType,
        stationedSite:  isStationed ? form.stationedSite : '',
        monthlySalary:  isMonthly ? Number(form.salary) || 0 : 0,
        dailyRate:      !isMonthly && !isOffice ? Number(form.salary) || 0 : 0,
        baseSalary:             Number(form.baseSalary) || 0,
        laborInsuredSalary:     Number(form.laborInsuredSalary) || 0,
        healthInsuredSalary:    Number(form.healthInsuredSalary) || 0,
        laborInsuranceEmployee: Number(form.laborInsuranceEmployee) || 0,
        laborInsuranceEmployer: Number(form.laborInsuranceEmployer) || 0,
        healthInsuranceEmployee: Number(form.healthInsuranceEmployee) || 0,
        healthInsuranceEmployer: Number(form.healthInsuranceEmployer) || 0,
        laborPensionEmployerRate: Number(form.laborPensionEmployerRate) || 0,
        laborPensionEmployer:     pensionEmployerAmt,
        laborPensionEmployeeRate: Number(form.laborPensionEmployeeRate) || 0,
        laborPensionEmployee:     pensionEmployeeAmt,
        bankCode:               form.bankCode.trim(),
        bankAccount:            form.bankAccount.trim(),
        status:         'active',
        skills:         [],
        leaveBalance:   0,
        workDaysThisMonth: 0,
        address:        '',
        note:           '',
      })
      onClose()
    } catch (e) {
      setErr('儲存失敗，請稍後再試')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">新增員工</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          {/* 基本資料 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">姓名 *</label>
              <input className="input" placeholder="王小明" value={form.name} onChange={e => set('name', e.target.value)} />
            </div>
            <div>
              <label className="label">所屬公司 *</label>
              <select className="input" value={form.orgId} onChange={e => set('orgId', e.target.value)}>
                {ORGS.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
          </div>

          {/* 員工類型 + 到職日 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">員工類型 *</label>
              <select className="input" value={form.empTypeKey} onChange={e => set('empTypeKey', e.target.value)}>
                {EMP_TYPE_OPTIONS.map(opt => (
                  <option key={opt.key} value={opt.key}>{opt.label}　{opt.sub}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">到職日 *</label>
              <input className="input" type="date" value={form.joinDate} onChange={e => set('joinDate', e.target.value)} />
            </div>
          </div>

          {/* 聯絡資訊 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">手機號碼</label>
              <input className="input" placeholder="0912-345-678" value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
            <div>
              <label className="label">身分證號</label>
              <input className="input" placeholder="A123456789" value={form.idNumber} onChange={e => set('idNumber', e.target.value)} />
            </div>
          </div>

          {/* 薪資（內勤不顯示） */}
          {!isOffice && (
            <div>
              <label className="label">{isMonthly ? '月薪（元）' : '日薪（元）'}</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input
                  className="input pl-7" type="number" min="0"
                  placeholder={isMonthly ? '30000' : '1200'}
                  value={form.salary}
                  onChange={e => set('salary', e.target.value)}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                  {isMonthly ? '/ 月' : '/ 天'}
                </span>
              </div>
            </div>
          )}

          {/* 主要駐點案場（僅駐點類型顯示） */}
          {isStationed && (
            <div>
              <label className="label">主要駐點案場</label>
              <select className="input" value={form.stationedSite} onChange={e => set('stationedSite', e.target.value)}>
                <option value="">選擇案場…</option>
                {allSites.map(s => (
                  <option key={s.id} value={s.name}>{s.name}　{s.customerName}</option>
                ))}
              </select>
            </div>
          )}

          {/* 本薪（僅非內勤） */}
          {!isOffice && (
            <div>
              <label className="label">本薪（元）</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input
                  className="input pl-7" type="number" min="0"
                  placeholder="28000"
                  value={form.baseSalary}
                  onChange={e => set('baseSalary', e.target.value)}
                />
              </div>
            </div>
          )}

          {/* 勞保 / 健保 / 勞退 */}
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">勞保 / 健保 / 勞退</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'laborInsuredSalary',     label: '勞保投保金額' },
                { key: 'healthInsuredSalary',    label: '健保投保金額' },
                { key: 'laborInsuranceEmployee', label: '勞保自付額' },
                { key: 'laborInsuranceEmployer', label: '勞保單位負擔' },
                { key: 'healthInsuranceEmployee',label: '健保自付額' },
                { key: 'healthInsuranceEmployer',label: '健保單位負擔' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="label">{label}</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                    <input
                      className="input pl-7" type="number" min="0" placeholder="0"
                      value={form[key]}
                      onChange={e => set(key, e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* 勞退提撥：% 輸入 + 自動計算金額 */}
            <div className="grid grid-cols-2 gap-3 mt-3">
              {[
                { rateKey: 'laborPensionEmployerRate', label: '勞退提撥（雇主）', amt: pensionEmployerAmt },
                { rateKey: 'laborPensionEmployeeRate', label: '勞退提撥（自提）', amt: pensionEmployeeAmt },
              ].map(({ rateKey, label, amt }) => (
                <div key={rateKey}>
                  <label className="label">{label}</label>
                  <div className="relative">
                    <input
                      className="input pr-8" type="number" min="0" max="100" step="0.1" placeholder="6"
                      value={form[rateKey]}
                      onChange={e => set(rateKey, e.target.value)}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                  </div>
                  {amt > 0 && (
                    <p className="text-xs text-gray-400 mt-1 ml-1">≈ ${amt.toLocaleString()} / 月</p>
                  )}
                  {!pensionBase && form[rateKey] && (
                    <p className="text-xs text-amber-500 mt-1 ml-1">請先填寫勞保投保金額</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 銀行帳戶 */}
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">銀行帳戶</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">郵局 / 銀行代號</label>
                <input className="input" placeholder="700（中華郵政）" value={form.bankCode} onChange={e => set('bankCode', e.target.value)} />
              </div>
              <div>
                <label className="label">帳號</label>
                <input className="input" placeholder="00000000000000" value={form.bankAccount} onChange={e => set('bankAccount', e.target.value)} />
              </div>
            </div>
          </div>

          {err && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</p>}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button className="btn-secondary" onClick={onClose} disabled={saving}>取消</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving || !form.name.trim()}>
            {saving ? '儲存中...' : '儲存員工'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Edit employee modal ──────────────────────────────────────────────────────
function EditModal({ emp, onClose, allSites }) {
  const initTypeKey = EMP_TYPE_OPTIONS.find(t =>
    t.workMode === emp.workMode &&
    t.payType  === emp.payType  &&
    t.employmentType === emp.employmentType
  )?.key || 'fulltime-stationed'

  const [form, setForm] = useState({
    name:             emp.name        || '',
    orgId:            emp.orgId       || 'jiaxiang',
    empTypeKey:       initTypeKey,
    phone:            emp.phone       || '',
    email:            emp.email       || '',
    address:          emp.address     || '',
    idNumber:         emp.idNumber    || '',
    joinDate:         emp.joinDate    || '',
    salary:           String(emp.monthlySalary || emp.dailyRate || ''),
    stationedSite:    emp.stationedSite || '',
    status:           emp.status      || 'active',
    leaveBalance:     String(emp.leaveBalance ?? ''),
    emergencyContact: emp.emergencyContact || '',
    note:             emp.note        || '',
    skills:           (emp.skills || []).join('、'),
    baseSalary:             String(emp.baseSalary || ''),
    laborInsuredSalary:     String(emp.laborInsuredSalary || ''),
    healthInsuredSalary:    String(emp.healthInsuredSalary || ''),
    laborInsuranceEmployee: String(emp.laborInsuranceEmployee || ''),
    laborInsuranceEmployer: String(emp.laborInsuranceEmployer || ''),
    healthInsuranceEmployee: String(emp.healthInsuranceEmployee || ''),
    healthInsuranceEmployer: String(emp.healthInsuranceEmployer || ''),
    laborPensionEmployerRate: String(emp.laborPensionEmployerRate || ''),
    laborPensionEmployeeRate: String(emp.laborPensionEmployeeRate || ''),
    bankCode:               emp.bankCode    || '',
    bankAccount:            emp.bankAccount || '',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const empType    = EMP_TYPE_OPTIONS.find(t => t.key === form.empTypeKey) || EMP_TYPE_OPTIONS[0]
  const isMonthly  = empType.payType === 'monthly'
  const isStationed = empType.workMode === 'stationed'
  const isOffice    = empType.workMode === 'office'

  const pensionBase = Number(form.laborInsuredSalary) || 0
  const pensionEmployerAmt = Math.round(pensionBase * (Number(form.laborPensionEmployerRate) || 0) / 100)
  const pensionEmployeeAmt = Math.round(pensionBase * (Number(form.laborPensionEmployeeRate) || 0) / 100)

  const handleSave = async () => {
    if (!form.name.trim()) { setErr('請填寫姓名'); return }
    setSaving(true)
    setErr('')
    try {
      await updateEmployee(emp.id, {
        name:           form.name.trim(),
        orgId:          form.orgId,
        phone:          form.phone.trim(),
        email:          form.email.trim(),
        address:        form.address.trim(),
        idNumber:       form.idNumber.trim(),
        joinDate:       form.joinDate,
        position:       empType.position,
        workMode:       empType.workMode,
        payType:        empType.payType,
        employmentType: empType.employmentType,
        stationedSite:  isStationed ? form.stationedSite : '',
        monthlySalary:  isMonthly ? Number(form.salary) || 0 : 0,
        dailyRate:      !isMonthly && !isOffice ? Number(form.salary) || 0 : 0,
        baseSalary:             Number(form.baseSalary) || 0,
        laborInsuredSalary:     Number(form.laborInsuredSalary) || 0,
        healthInsuredSalary:    Number(form.healthInsuredSalary) || 0,
        laborInsuranceEmployee: Number(form.laborInsuranceEmployee) || 0,
        laborInsuranceEmployer: Number(form.laborInsuranceEmployer) || 0,
        healthInsuranceEmployee: Number(form.healthInsuranceEmployee) || 0,
        healthInsuranceEmployer: Number(form.healthInsuranceEmployer) || 0,
        laborPensionEmployerRate: Number(form.laborPensionEmployerRate) || 0,
        laborPensionEmployer:     pensionEmployerAmt,
        laborPensionEmployeeRate: Number(form.laborPensionEmployeeRate) || 0,
        laborPensionEmployee:     pensionEmployeeAmt,
        bankCode:               form.bankCode.trim(),
        bankAccount:            form.bankAccount.trim(),
        status:         form.status,
        leaveBalance:   Number(form.leaveBalance) || 0,
        emergencyContact: form.emergencyContact.trim(),
        note:           form.note.trim(),
        skills:         form.skills.split(/[,，、]/).map(s => s.trim()).filter(Boolean),
      })
      onClose()
    } catch (e) {
      setErr('儲存失敗，請稍後再試')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">編輯員工資料</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">姓名 *</label>
              <input className="input" value={form.name} onChange={e => set('name', e.target.value)} />
            </div>
            <div>
              <label className="label">所屬公司 *</label>
              <select className="input" value={form.orgId} onChange={e => set('orgId', e.target.value)}>
                {ORGS.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">員工類型 *</label>
              <select className="input" value={form.empTypeKey} onChange={e => set('empTypeKey', e.target.value)}>
                {EMP_TYPE_OPTIONS.map(opt => (
                  <option key={opt.key} value={opt.key}>{opt.label}　{opt.sub}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">狀態</label>
              <select className="input" value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="active">在職</option>
                <option value="leave">請假中</option>
                <option value="resigned">已離職</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">到職日</label>
              <input className="input" type="date" value={form.joinDate} onChange={e => set('joinDate', e.target.value)} />
            </div>
            <div>
              <label className="label">特休餘額（天）</label>
              <input className="input" type="number" min="0" value={form.leaveBalance} onChange={e => set('leaveBalance', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">手機號碼</label>
              <input className="input" value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
            <div>
              <label className="label">身分證號</label>
              <input className="input" value={form.idNumber} onChange={e => set('idNumber', e.target.value)} />
            </div>
          </div>

          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} />
          </div>

          <div>
            <label className="label">地址</label>
            <input className="input" value={form.address} onChange={e => set('address', e.target.value)} />
          </div>

          {!isOffice && (
            <div>
              <label className="label">{isMonthly ? '月薪（元）' : '日薪（元）'}</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input
                  className="input pl-7" type="number" min="0"
                  value={form.salary}
                  onChange={e => set('salary', e.target.value)}
                />
              </div>
            </div>
          )}

          {isStationed && (
            <div>
              <label className="label">主要駐點案場</label>
              <select className="input" value={form.stationedSite} onChange={e => set('stationedSite', e.target.value)}>
                <option value="">選擇案場…</option>
                {allSites.map(s => (
                  <option key={s.id} value={s.name}>{s.name}　{s.customerName}</option>
                ))}
              </select>
            </div>
          )}

          {/* 本薪（僅非內勤） */}
          {!isOffice && (
            <div>
              <label className="label">本薪（元）</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input
                  className="input pl-7" type="number" min="0"
                  placeholder="28000"
                  value={form.baseSalary}
                  onChange={e => set('baseSalary', e.target.value)}
                />
              </div>
            </div>
          )}

          {/* 勞保 / 健保 / 勞退 */}
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">勞保 / 健保 / 勞退</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'laborInsuredSalary',     label: '勞保投保金額' },
                { key: 'healthInsuredSalary',    label: '健保投保金額' },
                { key: 'laborInsuranceEmployee', label: '勞保自付額' },
                { key: 'laborInsuranceEmployer', label: '勞保單位負擔' },
                { key: 'healthInsuranceEmployee',label: '健保自付額' },
                { key: 'healthInsuranceEmployer',label: '健保單位負擔' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="label">{label}</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                    <input
                      className="input pl-7" type="number" min="0" placeholder="0"
                      value={form[key]}
                      onChange={e => set(key, e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* 勞退提撥：% 輸入 + 自動計算金額 */}
            <div className="grid grid-cols-2 gap-3 mt-3">
              {[
                { rateKey: 'laborPensionEmployerRate', label: '勞退提撥（雇主）', amt: pensionEmployerAmt },
                { rateKey: 'laborPensionEmployeeRate', label: '勞退提撥（自提）', amt: pensionEmployeeAmt },
              ].map(({ rateKey, label, amt }) => (
                <div key={rateKey}>
                  <label className="label">{label}</label>
                  <div className="relative">
                    <input
                      className="input pr-8" type="number" min="0" max="100" step="0.1" placeholder="6"
                      value={form[rateKey]}
                      onChange={e => set(rateKey, e.target.value)}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                  </div>
                  {amt > 0 && (
                    <p className="text-xs text-gray-400 mt-1 ml-1">≈ ${amt.toLocaleString()} / 月</p>
                  )}
                  {!pensionBase && form[rateKey] && (
                    <p className="text-xs text-amber-500 mt-1 ml-1">請先填寫勞保投保金額</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 銀行帳戶 */}
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">銀行帳戶</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">郵局 / 銀行代號</label>
                <input className="input" placeholder="700（中華郵政）" value={form.bankCode} onChange={e => set('bankCode', e.target.value)} />
              </div>
              <div>
                <label className="label">帳號</label>
                <input className="input" placeholder="00000000000000" value={form.bankAccount} onChange={e => set('bankAccount', e.target.value)} />
              </div>
            </div>
          </div>

          <div>
            <label className="label">緊急聯絡人</label>
            <input className="input" placeholder="王大明 / 0912-000-000" value={form.emergencyContact} onChange={e => set('emergencyContact', e.target.value)} />
          </div>

          <div>
            <label className="label">技能專長（逗號分隔）</label>
            <input className="input" placeholder="地板拋光、玻璃清潔" value={form.skills} onChange={e => set('skills', e.target.value)} />
          </div>

          <div>
            <label className="label">備註</label>
            <textarea className="input" rows={2} value={form.note} onChange={e => set('note', e.target.value)} />
          </div>

          {err && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</p>}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button className="btn-secondary" onClick={onClose} disabled={saving}>取消</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving || !form.name.trim()}>
            {saving ? '儲存中...' : '儲存變更'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function EmployeesPage() {
  const [search, setSearch]       = useState('')
  const [filterOrg, setFilterOrg] = useState('all')
  const [filterStatus, setStatus] = useState('all')
  const [filterMode, setMode]     = useState('all')
  const [selected, setSelected]   = useState(null)
  const [editing, setEditing]     = useState(null)
  const [showAdd, setShowAdd]     = useState(false)

  // ─ Firestore 即時資料 ──────────────────────────────────────────────────────
  const { data: employees, loading } = useCollection(COL.EMPLOYEES)
  const { data: customers } = useCollection(COL.CUSTOMERS)
  const allSites = useMemo(() =>
    customers.flatMap(c => (c.sites || []).map(s => ({ ...s, customerName: c.name }))),
    [customers]
  )

  // ─ Stats ──────────────────────────────────────────────────────────────────
  const active   = employees.filter(e => e.status === 'active')
  const onLeave  = employees.filter(e => e.status === 'leave')
  const resigned = employees.filter(e => e.status === 'resigned')
  const jiaxiangCount = employees.filter(e => e.orgId === 'jiaxiang' && e.status !== 'resigned').length
  const zhexinCount   = employees.filter(e => e.orgId === 'zhexin'   && e.status !== 'resigned').length
  const avgSalary     = Math.round(active.reduce((s, e) => s + (e.monthlySalary || 0), 0) / (active.length || 1))

  // ─ Filtered list ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return employees.filter(e => {
      const q = search.toLowerCase()
      if (filterOrg    !== 'all' && e.orgId    !== filterOrg)    return false
      if (filterStatus !== 'all' && e.status   !== filterStatus) return false
      if (filterMode   !== 'all' && e.workMode !== filterMode)   return false
      if (q && !e.name?.includes(q) && !e.phone?.includes(q) && !e.email?.includes(q) && !e.position?.includes(q)) return false
      return true
    })
  }, [employees, search, filterOrg, filterStatus, filterMode])

  // ─ CSV export ─────────────────────────────────────────────────────────────
  const exportCSV = () => {
    const header = '姓名,公司,職稱,電話,Email,到職日,月薪,狀態\n'
    const rows   = filtered.map(e => {
      const org = ORGS.find(o => o.id === e.orgId)
      return `${e.name},${org?.name},${e.position},${e.phone},${e.email},${e.joinDate},${e.monthlySalary},${STATUS_CONFIG[e.status]?.label}`
    }).join('\n')
    const blob = new Blob(['\uFEFF' + header + rows], { type: 'text/csv;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `員工名冊_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">

      {/* ── Stats ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users}       color="blue"   label="總員工人數"   value={employees.length}           sub="雙公司合計" />
        <StatCard icon={CheckCircle} color="green"  label="在職"         value={active.length}                   sub={`佳翔 ${jiaxiangCount} · 哲欣 ${zhexinCount}`} />
        <StatCard icon={Clock}       color="amber"  label="請假中"       value={onLeave.length}                  sub="育嬰 / 病假 / 事假" />
        <StatCard icon={Briefcase}   color="purple" label="平均月薪"     value={`$${avgSalary.toLocaleString()}`} sub="在職員工平均" />
      </div>

      {/* ── Toolbar ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            className="input pl-9"
            placeholder="搜尋姓名、電話、職稱…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Org filter */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {[
            { key: 'all',      label: '全部' },
            { key: 'jiaxiang', label: '佳翔' },
            { key: 'zhexin',   label: '哲欣' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilterOrg(key)}
              className={clsx(
                'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                filterOrg === key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Work mode filter */}
        <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
          {[
            { key: 'all',      label: '全部', count: employees.length },
            { key: 'stationed',label: '駐點', count: employees.filter(e => e.workMode === 'stationed').length },
            { key: 'mobile',   label: '機動', count: employees.filter(e => e.workMode === 'mobile').length },
            { key: 'office',   label: '內勤', count: employees.filter(e => e.workMode === 'office').length },
          ].map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setMode(key)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                filterMode === key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700',
              )}
            >
              {label}
              <span className={clsx('text-[11px] px-1.5 py-0.5 rounded-full font-semibold',
                filterMode === key ? 'bg-brand-100 text-brand-700' : 'bg-gray-200 text-gray-500'
              )}>{count}</span>
            </button>
          ))}
        </div>

        {/* Status filter */}
        <select
          className="input w-auto"
          value={filterStatus}
          onChange={e => setStatus(e.target.value)}
        >
          <option value="all">全部狀態</option>
          <option value="active">在職</option>
          <option value="leave">請假中</option>
          <option value="resigned">已離職</option>
        </select>

        {/* Export */}
        <button className="btn-secondary" onClick={exportCSV}>
          <Download size={16} /> 匯出 CSV
        </button>

        {/* Add */}
        <button className="btn-primary" onClick={() => setShowAdd(true)}>
          <Plus size={16} /> 新增員工
        </button>
      </div>

      {/* ── Table ─────────────────────────────────────────────────── */}
      {(() => {
        const isStationed = filterMode === 'stationed'
        const tableHead = (
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">員工</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">公司</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">
                {isStationed ? '任職單位' : '職稱'}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">電話</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">到職日</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden xl:table-cell">薪資</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden xl:table-cell">技能</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">狀態</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
        )

        const tableFooter = filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              顯示 <span className="font-semibold">{filtered.length}</span> / {employees.length} 筆員工資料
            </p>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
                const count = filtered.filter(e => e.status === key).length
                return count > 0 ? (
                  <span key={key} className="flex items-center gap-1">
                    <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                    {cfg.label} {count}
                  </span>
                ) : null
              })}
            </div>
          </div>
        )

        if (filtered.length === 0) {
          return (
            <div className="card text-center py-20">
              <Users size={48} className="mx-auto mb-4 text-gray-200" />
              <p className="text-gray-400 font-medium">沒有符合條件的員工</p>
              <p className="text-sm text-gray-300 mt-1">請調整搜尋條件</p>
            </div>
          )
        }

        // 內勤 tab → 直接列出，不分正職/日薪
        if (filterMode === 'office') {
          return (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  {tableHead}
                  <tbody className="divide-y divide-gray-50">
                    {filtered.map(emp => <EmployeeRow key={emp.id} emp={emp} onClick={setSelected} hideWorkMode hidePayType />)}
                  </tbody>
                </table>
              </div>
              {tableFooter}
            </div>
          )
        }

        // 駐點/機動 tab → 拆 正職員工 / 日薪員工 兩段
        if (filterMode !== 'all') {
          const monthly = filtered.filter(e => e.payType === 'monthly')
          const daily   = filtered.filter(e => e.payType === 'daily')
          const SectionHeader = ({ payType, count }) => (
            <tr>
              <td colSpan={9} className="px-4 py-2.5 bg-gray-50 border-y border-gray-100">
                <div className="flex items-center gap-2">
                  <span className={clsx(
                    'text-xs font-bold px-2.5 py-1 rounded-full',
                    PAY_TYPE[payType].badge,
                  )}>
                    {PAY_TYPE[payType].label}
                  </span>
                  <span className="text-xs text-gray-400">{count} 人</span>
                </div>
              </td>
            </tr>
          )
          return (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  {tableHead}
                  <tbody className="divide-y divide-gray-50">
                    {monthly.length > 0 && (
                      <>
                        <SectionHeader payType="monthly" count={monthly.length} />
                        {monthly.map(emp => <EmployeeRow key={emp.id} emp={emp} onClick={setSelected} showUnit={isStationed} hideWorkMode hidePayType />)}
                      </>
                    )}
                    {daily.length > 0 && (
                      <>
                        <SectionHeader payType="daily" count={daily.length} />
                        {daily.map(emp => <EmployeeRow key={emp.id} emp={emp} onClick={setSelected} showUnit={isStationed} hideWorkMode hidePayType />)}
                      </>
                    )}
                  </tbody>
                </table>
              </div>
              {tableFooter}
            </div>
          )
        }

        // 全部 tab → 平鋪列表
        return (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                {tableHead}
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(emp => <EmployeeRow key={emp.id} emp={emp} onClick={setSelected} />)}
                </tbody>
              </table>
            </div>
            {tableFooter}
          </div>
        )
      })()}

      {/* ── Org breakdown cards ────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {ORGS.map(org => {
          const emps = employees.filter(e => e.orgId === org.id && e.status !== 'resigned')
          const totalSalary = emps.filter(e => e.status === 'active').reduce((s, e) => s + (e.monthlySalary || 0), 0)
          return (
            <div key={org.id} className="card p-5">
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: org.color }}
                />
                <h3 className="font-semibold text-gray-900">{org.name}</h3>
                <span className="ml-auto text-sm text-gray-500">{emps.length} 人（含請假）</span>
              </div>
              <div className="space-y-2">
                {emps.map(e => {
                  const sc = STATUS_CONFIG[e.status] || STATUS_CONFIG.active
                  return (
                    <div
                      key={e.id}
                      className="flex items-center gap-3 py-2 px-3 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => setSelected(e)}
                    >
                      <Avatar name={e.name} orgId={e.orgId} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800">{e.name}</p>
                        <p className="text-xs text-gray-400">{e.position}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-gray-500">本月 {e.workDaysThisMonth} 天</p>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${sc.badge}`}>
                          {sc.label}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between text-sm">
                <span className="text-gray-500">在職月薪合計</span>
                <span className="font-bold text-gray-900">${totalSalary.toLocaleString()}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Modals ────────────────────────────────────────────────── */}
      {selected && <DetailModal emp={selected} onClose={() => setSelected(null)} onEdit={() => { setEditing(selected); setSelected(null) }} />}
      {showAdd   && <AddModal onClose={() => setShowAdd(false)} allSites={allSites} />}
      {editing   && <EditModal emp={editing} onClose={() => setEditing(null)} allSites={allSites} />}
    </div>
  )
}
