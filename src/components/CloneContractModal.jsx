/**
 * 複製年度合約的彈窗
 *
 * 用途：標到類似/續約合約時快速複製、再微調
 *
 * 流程：
 *  1. 父元件傳入 source contract
 *  2. 自動呼叫 cloneContractData() 取得深拷貝、ID 重生、執行紀錄清空的 data
 *  3. 此 Modal 讓使用者調整：客戶、合約名稱、合約編號、期間、總額、付款方式
 *  4. 確認 → addAnnualContract → onSuccess(newContractId)
 */
import { useState, useMemo } from 'react'
import { X, Copy, Building2, Calendar } from 'lucide-react'
import { COL, addAnnualContract } from '../lib/db'
import { useCollection } from '../hooks/useCollection'
import { useOrg } from '../contexts/OrgContext'
import { cloneContractData, BILLING_MODE_MAP } from '../utils/contractSchema'
import clsx from 'clsx'

export default function CloneContractModal({ source, onSuccess, onClose }) {
  const { activeOrgId }       = useOrg()
  const { data: customersRaw } = useCollection(COL.CUSTOMERS)
  const orgCustomers          = useMemo(
    () => customersRaw.filter(c => c.orgId === (source?.orgId || activeOrgId)),
    [customersRaw, source?.orgId, activeOrgId]
  )

  // 預先 clone 出新合約資料（保留結構、清掉執行紀錄）
  const seed = useMemo(() => cloneContractData(source) || {}, [source])

  const [customerId,    setCustomerId]    = useState(seed.customerId  || '')
  const [title,         setTitle]         = useState(seed.title       || '')
  const [contractNo,    setContractNo]    = useState(seed.contractNo  || '')
  const [contractStart, setContractStart] = useState('')   // 留空，必填
  const [contractEnd,   setContractEnd]   = useState('')   // 留空，必填
  const [totalValue,    setTotalValue]    = useState(String(seed.totalValue || ''))
  const [paymentMode,   setPaymentMode]   = useState(seed.paymentMode || 'averaged')
  const [saving, setSaving] = useState(false)
  const [err,    setErr]    = useState('')

  if (!source) return null

  // 統計來源合約結構（給確認區顯示）
  const sites   = source.sites || []
  const tShifts = sites.reduce((s, si) => s + (si.shifts?.length || 0), 0)
  const tTasks  = sites.reduce((s, si) => s + (si.periodicTasks?.length || 0), 0)

  const handleSave = async () => {
    if (!customerId)                    { setErr('請選擇客戶'); return }
    if (!title.trim())                  { setErr('請填寫合約名稱'); return }
    if (!contractStart || !contractEnd) { setErr('請填寫合約期間'); return }
    if (new Date(contractEnd) < new Date(contractStart)) {
      setErr('合約結束日不能早於開始日'); return
    }
    setSaving(true); setErr('')
    try {
      const customer = orgCustomers.find(c => c.id === customerId)
      const data = {
        ...seed,
        customerId,
        customerName: customer?.name || seed.customerName,
        title:         title.trim(),
        contractNo:    contractNo.trim(),
        contractStart,
        contractEnd,
        totalValue:    Number(totalValue) || 0,
        paymentMode,
      }
      const ref = await addAnnualContract(data)
      onSuccess?.(ref?.id || null)
      onClose?.()
    } catch (e) {
      setErr('儲存失敗：' + (e.message || '請稍後再試'))
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl p-6 max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Copy size={18} className="text-brand-600" />
            <h2 className="text-lg font-bold text-gray-900">複製合約</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        {/* Source preview */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-4">
          <p className="text-[11px] text-gray-400 mb-1">來源合約</p>
          <p className="text-sm font-bold text-gray-800 mb-2">{source.title}</p>
          <p className="text-xs text-gray-500 flex items-center gap-1 flex-wrap">
            <Building2 size={11} />{source.customerName}
            <span className="text-gray-300 mx-1">·</span>
            <Calendar size={11} />{source.contractStart} ~ {source.contractEnd}
          </p>
        </div>

        <div className="space-y-4">
          {/* 客戶 */}
          <div>
            <label className="label">客戶 *</label>
            <select className="input" value={customerId} onChange={e => setCustomerId(e.target.value)}>
              <option value="">選擇客戶…</option>
              {orgCustomers.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">合約名稱 *</label>
              <input className="input" value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div>
              <label className="label">合約編號</label>
              <input className="input" placeholder="例：JX-116-S001" value={contractNo} onChange={e => setContractNo(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">合約開始 *</label>
              <input className="input" type="date" value={contractStart} onChange={e => setContractStart(e.target.value)} />
            </div>
            <div>
              <label className="label">合約結束 *</label>
              <input className="input" type="date" value={contractEnd} onChange={e => setContractEnd(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="label">合約總額（含稅）</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input className="input pl-7" type="number" min="0" value={totalValue} onChange={e => setTotalValue(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="label">付款方式</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'averaged', label: '平均攤提', desc: '合約總額 ÷ 12 個月' },
                { id: 'actual',   label: '核實請款', desc: '依每月實際施作核實' },
              ].map(o => (
                <button
                  key={o.id} type="button"
                  onClick={() => setPaymentMode(o.id)}
                  className={clsx('text-left rounded-xl border-2 px-3 py-2 transition-colors',
                    paymentMode === o.id ? 'border-brand-500 bg-brand-50' : 'border-gray-200 bg-white hover:border-gray-300')}
                >
                  <p className="text-sm font-semibold text-gray-800">{o.label}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">{o.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* 將複製/清空摘要 */}
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <div className="bg-green-50/60 px-4 py-2.5 border-b border-gray-200">
              <p className="text-xs font-semibold text-green-700 mb-1">✓ 將完整複製</p>
              <p className="text-xs text-gray-600">
                {sites.length} 個案場 · {tShifts} 個班別 · {tTasks} 項週期任務
                <span className="text-gray-400 ml-1">（含計費模式、月固定明細、派工計畫、指派員工、locations 等）</span>
              </p>
            </div>
            <div className="bg-amber-50/60 px-4 py-2.5">
              <p className="text-xs font-semibold text-amber-700 mb-1">✗ 將清空（從零開始）</p>
              <p className="text-xs text-gray-600">
                合約編號、變更歷史、週期任務完成紀錄、每週訪視紀錄、派工已用次數、排班計畫日
              </p>
            </div>
          </div>

          {err && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</p>}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button className="btn-secondary" onClick={onClose} disabled={saving}>取消</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            <Copy size={14} /> {saving ? '建立中...' : '建立複本合約'}
          </button>
        </div>
      </div>
    </div>
  )
}
