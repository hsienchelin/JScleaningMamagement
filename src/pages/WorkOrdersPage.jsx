import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import SignatureCanvas from 'react-signature-canvas'
import { jsPDF } from 'jspdf'
import {
  FileDown, PenLine, CheckCircle, Clock, Trash2, Plus, X,
  FileText, Building2, Calendar, Users, CheckSquare, Pencil, Send, ChevronRight,
} from 'lucide-react'
import { PRESET_TASKS } from '../lib/mockData'
import { useOrg } from '../contexts/OrgContext'
import { useCollection } from '../hooks/useCollection'
import {
  COL, addDispatchOrder, updateDispatchOrder, deleteDispatchOrder, addWorkOrder,
} from '../lib/db'
import { getTaskScheduleText } from '../utils/contractSchema'
import clsx from 'clsx'

const TODAY = new Date().toISOString().slice(0, 10)

// status: pending(待驗收) → accepted(已驗收) → billed(已轉請款)
const DSTATUS = {
  pending:  { label: '待驗收',   badge: 'badge-yellow', icon: Clock },
  accepted: { label: '已驗收',   badge: 'badge-green',  icon: CheckCircle },
  billed:   { label: '已轉請款', badge: 'badge-blue',   icon: FileText },
}

// ─── 客戶電子簽名 ───────────────────────────────────────────────────────────────
function SignModal({ order, onClose, onSave }) {
  const sigRef = useRef(null)

  const handleClear = () => sigRef.current?.clear()

  const handleSave = () => {
    if (sigRef.current?.isEmpty()) {
      alert('請先完成簽名')
      return
    }
    const dataUrl = sigRef.current.toDataURL('image/png')
    onSave(dataUrl)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-1">客戶驗收簽名</h2>
        <p className="text-sm text-gray-500 mb-4">派工單：{order.siteName} — {order.date}</p>

        <div className="border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 relative">
          <SignatureCanvas
            ref={sigRef}
            canvasProps={{ width: 400, height: 190, className: 'rounded-xl w-full' }}
            backgroundColor="rgb(249,250,251)"
          />
        </div>

        <div className="flex justify-between gap-3 mt-4">
          <button className="btn-secondary" onClick={handleClear}>
            <Trash2 size={14} /> 清除
          </button>
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={onClose}>取消</button>
            <button className="btn-primary" onClick={handleSave}>
              <CheckCircle size={14} /> 確認簽名並驗收
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── 建立 / 編輯派工單 ──────────────────────────────────────────────────────────
function CreateDispatchModal({ initial, onClose, onSave, employees, customers, orders, contracts, customTasks }) {
  const [form, setForm] = useState(initial)
  const set = (patch) => setForm(f => ({ ...f, ...patch }))

  const mergedTasks = [
    ...customTasks.map(c => ({ id: c.id, name: c.name, category: c.category })),
    ...PRESET_TASKS,
  ]

  // ── 關聯處理 ──────────────────────────────────────────────────────────────────
  const clearLink = (linkType) => set({
    linkType,
    orderId: '', orderName: '',
    contractId: '', contractSiteId: '', contractTitle: '',
    taskId: '', taskName: '',
    dispatchItemId: '', dispatchItemName: '', dispatchLocation: '',
    customerId: '', customerSiteId: '',
    siteName: '', siteAddress: '',
  })

  const handleOrderChange = (orderId) => {
    const o = orders.find(x => x.id === orderId)
    set({ orderId, orderName: o?.siteName || o?.title || '', siteName: o?.siteName || '', siteAddress: o?.siteAddress || '' })
  }

  const handleContractChange = (contractId) => {
    const c = contracts.find(x => x.id === contractId)
    set({ contractId, contractTitle: c?.title || '', contractSiteId: '', taskId: '', taskName: '', siteName: '', siteAddress: '', dispatchItemId: '', dispatchItemName: '', dispatchLocation: '' })
  }

  const handleContractSiteChange = (siteId) => {
    const contract = contracts.find(c => c.id === form.contractId)
    const site     = (contract?.sites || []).find(s => s.id === siteId)
    set({ contractSiteId: siteId, siteName: site?.name || '', siteAddress: site?.address || '', taskId: '', taskName: '', dispatchItemId: '', dispatchItemName: '', dispatchLocation: '' })
  }

  const handleCustomerChange = (customerId) => {
    set({ customerId, customerSiteId: '', siteName: '', siteAddress: '' })
  }
  const handleCustomerSiteChange = (siteId) => {
    const cust = customers.find(c => c.id === form.customerId)
    const site = (cust?.sites || []).find(s => s.id === siteId)
    set({ customerSiteId: siteId, siteName: site?.name || '', siteAddress: site?.address || '' })
  }

  const handleLeaderChange = (leaderId) => {
    const emp = employees.find(e => e.id === leaderId)
    set({ leaderId, leaderName: emp?.name || '' })
  }

  const toggleEmployee = (id) => {
    const cur = form.employeeIds || []
    set({ employeeIds: cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id] })
  }

  // ── 工作項目 ──────────────────────────────────────────────────────────────────
  const addWorkItem = (presetId) => {
    if (!presetId) return
    const p = mergedTasks.find(t => t.id === presetId)
    if (!p || (form.workItems || []).some(w => w.presetId === presetId)) return
    set({ workItems: [...(form.workItems || []), { presetId, name: p.name, location: '' }] })
  }
  const updateWorkItem = (presetId, patch) =>
    set({ workItems: (form.workItems || []).map(w => w.presetId === presetId ? { ...w, ...patch } : w) })
  const removeWorkItem = (presetId) =>
    set({ workItems: (form.workItems || []).filter(w => w.presetId !== presetId) })

  // ── 建議物料 ──────────────────────────────────────────────────────────────────
  const [matInput, setMatInput] = useState('')
  const addMaterial = () => {
    const v = matInput.trim()
    if (!v || (form.materialList || []).includes(v)) { setMatInput(''); return }
    set({ materialList: [...(form.materialList || []), v] })
    setMatInput('')
  }
  const removeMaterial = (m) => set({ materialList: (form.materialList || []).filter(x => x !== m) })

  const contractSites = contracts.find(c => c.id === form.contractId)?.sites || []
  const selectedSite  = contractSites.find(s => s.id === form.contractSiteId)
  const siteMode      = selectedSite?.billingMode || 'fixed'
  const customerSites = customers.find(c => c.id === form.customerId)?.sites || []
  const availableTasks = mergedTasks.filter(t => !(form.workItems || []).some(w => w.presetId === t.id))

  const canSave = form.date && form.siteName

  const handleSubmit = () => {
    if (!form.siteName) { alert('請選擇案場'); return }
    if (!form.date)     { alert('請選擇派工日期'); return }
    const { isNew, ...data } = form
    onSave(data, isNew)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 my-4">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">{form.isNew ? '新增派工單' : '編輯派工單'}</h2>
          <button className="text-gray-400 hover:text-gray-700" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="space-y-4">
          {/* 關聯來源 */}
          <div>
            <label className="label">關聯來源</label>
            <div className="flex rounded-xl border border-gray-200 overflow-hidden">
              {[
                { v: '',         l: '不關聯' },
                { v: 'order',    l: '單次案件' },
                { v: 'periodic', l: '年度合約' },
              ].map(o => (
                <button key={o.v} type="button" onClick={() => clearLink(o.v)}
                  className={clsx('flex-1 py-2 text-sm font-medium transition-colors',
                    form.linkType === o.v ? 'bg-brand-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50')}
                >{o.l}</button>
              ))}
            </div>
          </div>

          {/* 不關聯：直接選客戶案場 */}
          {form.linkType === '' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">客戶</label>
                <select className="input" value={form.customerId || ''} onChange={e => handleCustomerChange(e.target.value)}>
                  <option value="">選擇客戶…</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">案場 *</label>
                <select className="input" value={form.customerSiteId || ''} onChange={e => handleCustomerSiteChange(e.target.value)} disabled={!form.customerId}>
                  <option value="">選擇案場…</option>
                  {customerSites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* 單次案件 */}
          {form.linkType === 'order' && (
            <div>
              <label className="label">訂單 *</label>
              <select className="input" value={form.orderId || ''} onChange={e => handleOrderChange(e.target.value)}>
                <option value="">選擇訂單…</option>
                {orders.filter(o => o.status !== 'closed').map(o => (
                  <option key={o.id} value={o.id}>{o.siteName || o.title}{o.customerName ? `（${o.customerName}）` : ''}</option>
                ))}
              </select>
            </div>
          )}

          {/* 年度合約週期項目 */}
          {form.linkType === 'periodic' && (
            <div className="space-y-3">
              <div>
                <label className="label">年度合約 *</label>
                <select className="input" value={form.contractId || ''} onChange={e => handleContractChange(e.target.value)}>
                  <option value="">選擇合約…</option>
                  {contracts.map(c => <option key={c.id} value={c.id}>{c.title}（{c.customerName}）</option>)}
                </select>
              </div>
              {form.contractId && (
                <div>
                  <label className="label">案場 *</label>
                  <select className="input" value={form.contractSiteId || ''} onChange={e => handleContractSiteChange(e.target.value)}>
                    <option value="">選擇案場…</option>
                    {contractSites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}
              {/* 依 billingMode 帶出週期項目 / 派工類型 */}
              {form.contractSiteId && siteMode === 'dispatch' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">派工類型 *</label>
                    <select className="input" value={form.dispatchItemId || ''}
                      onChange={e => {
                        const item = (selectedSite.dispatchPlan || []).find(p => p.id === e.target.value)
                        set({ dispatchItemId: e.target.value, dispatchItemName: item?.name || '' })
                      }}>
                      <option value="">選擇…</option>
                      {(selectedSite.dispatchPlan || []).map(p => {
                        const remaining = Math.max(0, (p.plannedCount || 0) - (p.usedCount || 0))
                        return <option key={p.id} value={p.id}>{p.name}（剩 {remaining} 次）</option>
                      })}
                    </select>
                  </div>
                  <div>
                    <label className="label">服務地點</label>
                    <select className="input" value={form.dispatchLocation || ''} onChange={e => set({ dispatchLocation: e.target.value })}>
                      <option value="">選擇地點…</option>
                      {(selectedSite.locations || []).map((l, i) => <option key={i} value={l}>{l}</option>)}
                    </select>
                  </div>
                </div>
              )}
              {form.contractSiteId && (siteMode === 'fixed' || siteMode === 'actual') && (
                <div>
                  <label className="label">週期項目</label>
                  <select className="input" value={form.taskId || ''}
                    onChange={e => {
                      const t = (selectedSite.periodicTasks || []).find(x => x.id === e.target.value)
                      set({ taskId: e.target.value, taskName: t?.name || '' })
                    }}>
                    <option value="">選擇週期項目…</option>
                    {(selectedSite.periodicTasks || []).map(t => (
                      <option key={t.id} value={t.id}>{t.name}（{getTaskScheduleText(t)}）</option>
                    ))}
                  </select>
                </div>
              )}
              {form.contractSiteId && siteMode === 'weekly' && (
                <p className="text-xs text-purple-600 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2">
                  每週固定訪視案場，驗收後轉請款將按次計費。
                </p>
              )}
            </div>
          )}

          {/* 案場顯示 */}
          {form.siteName && (
            <div className="bg-brand-50 rounded-xl px-4 py-2.5 text-sm text-brand-700 flex items-start gap-2">
              <Building2 size={14} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">{form.siteName}</p>
                {form.siteAddress && <p className="text-brand-500 text-xs mt-0.5">{form.siteAddress}</p>}
              </div>
            </div>
          )}

          {/* 日期 + 帶班 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">派工日期 *</label>
              <input className="input" type="date" value={form.date || ''} onChange={e => set({ date: e.target.value })} />
            </div>
            <div>
              <label className="label">帶班組長</label>
              <select className="input" value={form.leaderId || ''} onChange={e => handleLeaderChange(e.target.value)}>
                <option value="">選擇…</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}{e.position ? `（${e.position}）` : ''}</option>)}
              </select>
            </div>
          </div>

          {/* 施作人員 */}
          <div>
            <label className="label">施作人員 {(form.employeeIds || []).length > 0 && <span className="text-gray-400">（{form.employeeIds.length} 人）</span>}</label>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto border border-gray-200 rounded-xl p-2">
              {employees.length === 0 && <span className="text-xs text-gray-400 px-1 py-1">無可選員工</span>}
              {employees.map(e => {
                const on = (form.employeeIds || []).includes(e.id)
                return (
                  <button key={e.id} type="button" onClick={() => toggleEmployee(e.id)}
                    className={clsx('px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors',
                      on ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300')}
                  >{e.name}</button>
                )
              })}
            </div>
          </div>

          {/* 工作項目 */}
          <div>
            <label className="label">工作項目</label>
            <select className="input mb-2" value="" onChange={e => addWorkItem(e.target.value)}>
              <option value="">+ 加入工作項目…</option>
              {availableTasks.map(t => <option key={t.id} value={t.id}>{t.name}{t.category ? `（${t.category}）` : ''}</option>)}
            </select>
            <div className="space-y-2">
              {(form.workItems || []).map(w => (
                <div key={w.presetId} className="bg-gray-50 rounded-xl px-3 py-2 flex items-center gap-2">
                  <CheckSquare size={13} className="text-brand-600 shrink-0" />
                  <span className="text-sm font-medium text-gray-800 shrink-0">{w.name}</span>
                  <input className="input text-sm py-1 flex-1" placeholder="施作地點（如：1F大廳）"
                    value={w.location} onChange={e => updateWorkItem(w.presetId, { location: e.target.value })} />
                  <button onClick={() => removeWorkItem(w.presetId)} className="p-1 rounded-lg text-gray-300 hover:text-red-500 shrink-0"><X size={13} /></button>
                </div>
              ))}
            </div>
          </div>

          {/* 建議物料 */}
          <div>
            <label className="label">建議攜帶物料</label>
            <div className="flex gap-2">
              <input className="input flex-1" value={matInput} onChange={e => setMatInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addMaterial() } }}
                placeholder="輸入物料後按 Enter 或新增" />
              <button type="button" className="btn-secondary" onClick={addMaterial}><Plus size={14} /></button>
            </div>
            {(form.materialList || []).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {form.materialList.map(m => (
                  <span key={m} className="badge badge-gray flex items-center gap-1">
                    {m}<button onClick={() => removeMaterial(m)} className="text-gray-400 hover:text-red-500"><X size={11} /></button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 備註 */}
          <div>
            <label className="label">備註說明</label>
            <input className="input" value={form.notes || ''} onChange={e => set({ notes: e.target.value })} placeholder="特殊注意事項…" />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button className="btn-secondary" onClick={onClose}>取消</button>
          <button className="btn-primary" onClick={handleSubmit} disabled={!canSave}>
            <CheckCircle size={14} /> {form.isNew ? '建立派工單' : '儲存'}
          </button>
        </div>
      </div>
    </div>
  )
}

function exportPDF(d, employees) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  doc.setFontSize(18); doc.setFont('helvetica', 'bold')
  doc.text('Dispatch & Acceptance Order', 20, 25)
  doc.setFontSize(10); doc.setFont('helvetica', 'normal')
  doc.text(`Site: ${d.siteName || ''}`, 20, 38)
  doc.text(`Date: ${d.date || ''}`, 20, 44)
  doc.text(`Status: ${DSTATUS[d.status]?.label || d.status}`, 20, 50)

  doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.text('Work Items', 20, 65)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10)
  ;(d.workItems || []).forEach((w, i) => doc.text(`  • ${w.name}${w.location ? ` (${w.location})` : ''}`, 20, 73 + i * 7))

  const emps = employees.filter(e => (d.employeeIds || []).includes(e.id))
  doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.text('Assigned Team', 120, 65)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10)
  emps.forEach((e, i) => doc.text(`  • ${e.name}`, 120, 73 + i * 7))

  doc.setFontSize(9); doc.setTextColor(150)
  doc.text('Generated by Cleaning ERP System', 20, 280)
  doc.save(`dispatch-${d.id}.pdf`)
}

// ─── 主頁 ────────────────────────────────────────────────────────────────────────
export default function WorkOrdersPage() {
  const { activeOrgId } = useOrg()
  const navigate = useNavigate()
  const [signTarget, setSignTarget] = useState(null)
  const [editTarget, setEditTarget] = useState(null)   // 物件=編輯/新增；null=關閉
  const [statusFilter, setStatus]   = useState('all')

  const { data: dispatchRaw }  = useCollection(COL.DISPATCH_ORDERS)
  const { data: employeesRaw } = useCollection(COL.EMPLOYEES)
  const { data: customersRaw } = useCollection(COL.CUSTOMERS)
  const { data: ordersRaw }    = useCollection(COL.ORDERS)
  const { data: contractsRaw } = useCollection(COL.ANNUAL_CONTRACTS)
  const { data: customTasks }  = useCollection(COL.CLEANING_TASKS)

  const employees = employeesRaw.filter(e => e.orgId === activeOrgId && (e.status === 'active' || !e.status))
  const customers = customersRaw.filter(c => c.orgId === activeOrgId)
  const orders    = ordersRaw.filter(o => o.orgId === activeOrgId)
  const contracts = contractsRaw.filter(c => c.orgId === activeOrgId)

  const dispatches = dispatchRaw
    .filter(d => d.orgId === activeOrgId)
    .filter(d => statusFilter === 'all' || d.status === statusFilter)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))

  const newOrder = () => ({
    isNew: true, orgId: activeOrgId,
    linkType: '', orderId: '', orderName: '',
    contractId: '', contractSiteId: '', contractTitle: '',
    taskId: '', taskName: '',
    dispatchItemId: '', dispatchItemName: '', dispatchLocation: '',
    customerId: '', customerSiteId: '', siteName: '', siteAddress: '',
    date: TODAY, leaderId: '', leaderName: '',
    employeeIds: [], workItems: [], materialList: [], notes: '',
    status: 'pending',
  })

  // 儲存（新增 / 編輯）
  const saveOrder = async (data, isNew) => {
    try {
      if (isNew) await addDispatchOrder(data)
      else       await updateDispatchOrder(editTarget.id, data)
      setEditTarget(null)
    } catch (e) { alert('儲存失敗：' + (e.message || '請稍後再試')) }
  }

  // 簽名驗收
  const handleSigned = async (dataUrl) => {
    try {
      const now = new Date().toISOString()
      await updateDispatchOrder(signTarget.id, {
        status: 'accepted', signedAt: now, signatureDataUrl: dataUrl,
        acceptedAt: now, acceptedBy: 'signature',
      })
      setSignTarget(null)
    } catch (e) { alert('儲存失敗：' + (e.message || '請稍後再試')) }
  }

  // 手動驗收完成
  const acceptManually = async (d) => {
    if (!confirm(`確認「${d.siteName}」已驗收完成？`)) return
    try {
      const now = new Date().toISOString()
      await updateDispatchOrder(d.id, { status: 'accepted', acceptedAt: now, acceptedBy: 'manual' })
    } catch (e) { alert('操作失敗：' + (e.message || '請稍後再試')) }
  }

  // 驗收 → 轉工務請款單（一對一）
  const convertToReport = async (d) => {
    if (!confirm(`將「${d.siteName}」的派工單轉為工務請款單草稿？`)) return
    try {
      const report = {
        orgId: d.orgId,
        linkType: d.linkType || '',
        orderId: d.orderId || '', orderName: d.orderName || '',
        contractId: d.contractId || '', contractSiteId: d.contractSiteId || '',
        taskId: d.taskId || '', taskName: d.taskName || '',
        dispatchItemId: d.dispatchItemId || '', dispatchItemName: d.dispatchItemName || '',
        dispatchLocation: d.dispatchLocation || '',
        siteName: d.siteName || '', siteAddress: d.siteAddress || '',
        leaderId: d.leaderId || '', leaderName: d.leaderName || '',
        status: 'draft',
        dispatchOrderId: d.id,
        sessions: [{
          id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          date: d.date || TODAY,
          manpower: (d.employeeIds || []).map(id => {
            const e = employees.find(x => x.id === id)
            return { employeeId: id, name: e?.name || '', shift: 'full' }
          }),
          tasks: [
            ...(d.taskName ? [{ presetId: `periodic-${d.taskId}`, name: d.taskName, location: d.siteName || '', linkedToPeriodic: true }] : []),
            ...(d.workItems || []).map(w => ({ presetId: w.presetId, name: w.name, location: w.location || '' })),
          ],
          materials: [],
          notes: d.notes || '',
        }],
      }
      const ref = await addWorkOrder(report)
      await updateDispatchOrder(d.id, { status: 'billed', billedReportId: ref.id })
      if (confirm('已建立工務請款單草稿，是否前往工務請款單填寫？')) navigate('/daily')
    } catch (e) { alert('轉換失敗：' + (e.message || '請稍後再試')) }
  }

  const delOrder = async (d) => {
    if (!confirm(`確定刪除派工單「${d.siteName}」？`)) return
    try { await deleteDispatchOrder(d.id) }
    catch (e) { alert('刪除失敗：' + (e.message || '請稍後再試')) }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">派工驗收</h1>
          <p className="text-sm text-gray-500 mt-0.5">派工單 · 客戶驗收 · 轉工務請款</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <select className="input w-auto" value={statusFilter} onChange={e => setStatus(e.target.value)}>
            <option value="all">全部</option>
            <option value="pending">待驗收</option>
            <option value="accepted">已驗收</option>
            <option value="billed">已轉請款</option>
          </select>
          <button className="btn-primary" onClick={() => setEditTarget(newOrder())}>
            <Plus size={16} /> 手動建立派工單
          </button>
        </div>
      </div>

      {/* 列表 */}
      {dispatches.length === 0 ? (
        <div className="card p-10 text-center text-gray-400">
          <FileText size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">尚無派工單，點右上角「手動建立派工單」開始。</p>
        </div>
      ) : (
        <div className="space-y-4">
          {dispatches.map(d => {
            const sc = DSTATUS[d.status] || DSTATUS.pending
            const StatusIcon = sc.icon
            const emps = employees.filter(e => (d.employeeIds || []).includes(e.id))

            return (
              <div key={d.id} className="card overflow-hidden">
                {/* Top bar */}
                <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-100">
                  <StatusIcon size={16} className={d.status === 'pending' ? 'text-amber-500' : d.status === 'accepted' ? 'text-green-600' : 'text-blue-600'} />
                  <span className="font-semibold text-gray-900 flex-1">{d.siteName || '未設定案場'}</span>
                  <span className={`badge ${sc.badge}`}>{sc.label}</span>
                  <span className="text-sm text-gray-500 flex items-center gap-1"><Calendar size={12} />{d.date}</span>
                </div>

                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Left */}
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Users size={11} /> 施工人員</p>
                      <div className="flex flex-wrap gap-1">
                        {emps.length === 0 ? <span className="text-xs text-gray-400">未指定</span>
                          : emps.map(e => <span key={e.id} className="badge badge-blue">{e.name}</span>)}
                      </div>
                    </div>
                    {d.taskName && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">合約週期項目</p>
                        <span className="badge badge-yellow">{d.taskName}</span>
                      </div>
                    )}
                    {d.dispatchItemName && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">派工類型</p>
                        <span className="badge badge-blue">{d.dispatchItemName}{d.dispatchLocation ? `・${d.dispatchLocation}` : ''}</span>
                      </div>
                    )}
                    {d.notes && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">備註</p>
                        <p className="text-sm text-gray-700 bg-amber-50 rounded-lg px-3 py-2">{d.notes}</p>
                      </div>
                    )}
                  </div>

                  {/* Right */}
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">工作項目</p>
                      {(d.workItems || []).length === 0 ? <span className="text-xs text-gray-400">未設定</span> : (
                        <ul className="space-y-0.5">
                          {d.workItems.map((w, i) => (
                            <li key={i} className="text-sm text-gray-700 flex items-center gap-1.5">
                              <span className="w-1 h-1 bg-brand-400 rounded-full shrink-0" />
                              {w.name}{w.location ? <span className="text-gray-400 text-xs">（{w.location}）</span> : null}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    {(d.materialList || []).length > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">建議物料</p>
                        <div className="flex flex-wrap gap-1">
                          {d.materialList.map((m, i) => <span key={i} className="badge badge-gray">{m}</span>)}
                        </div>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-gray-500 mb-1">客戶驗收</p>
                      {d.acceptedAt
                        ? <span className="badge badge-green"><CheckCircle size={11} className="mr-1" /> 已驗收{d.acceptedBy === 'signature' ? '（簽名）' : '（手動）'}</span>
                        : <span className="badge badge-gray">未驗收</span>}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2 px-4 pb-4">
                  {d.status === 'pending' && (
                    <>
                      <button className="btn-secondary text-xs" onClick={() => setSignTarget(d)}>
                        <PenLine size={13} /> 請客戶簽名
                      </button>
                      <button className="btn-secondary text-xs" onClick={() => acceptManually(d)}>
                        <CheckCircle size={13} /> 驗收完成
                      </button>
                      <button className="btn-secondary text-xs" onClick={() => setEditTarget({ ...d, isNew: false })}>
                        <Pencil size={13} /> 編輯
                      </button>
                      <button className="btn-secondary text-xs text-red-600" onClick={() => delOrder(d)}>
                        <Trash2 size={13} /> 刪除
                      </button>
                    </>
                  )}
                  {d.status === 'accepted' && (
                    <button className="btn-primary text-xs" onClick={() => convertToReport(d)}>
                      <Send size={13} /> 轉工務請款 <ChevronRight size={13} />
                    </button>
                  )}
                  {d.status === 'billed' && (
                    <button className="btn-secondary text-xs" onClick={() => navigate('/daily')}>
                      <FileText size={13} /> 已轉請款，前往工務請款單
                    </button>
                  )}
                  <button className="btn-secondary text-xs ml-auto" onClick={() => exportPDF(d, employees)}>
                    <FileDown size={13} /> 下載 PDF
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 簽名 */}
      {signTarget && (
        <SignModal order={signTarget} onClose={() => setSignTarget(null)} onSave={handleSigned} />
      )}

      {/* 建立 / 編輯 */}
      {editTarget && (
        <CreateDispatchModal
          initial={editTarget}
          onClose={() => setEditTarget(null)}
          onSave={saveOrder}
          employees={employees}
          customers={customers}
          orders={orders}
          contracts={contracts}
          customTasks={customTasks.filter(t => t.orgId === activeOrgId)}
        />
      )}
    </div>
  )
}
