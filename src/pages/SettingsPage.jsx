import { useState } from 'react'
import { Save, Plus, Trash2, Shield, Layers } from 'lucide-react'
import { WORK_TYPES, DIFFICULTY_COEFFICIENTS } from '../lib/mockData'

export default function SettingsPage() {
  const [diffs, setDiffs] = useState(DIFFICULTY_COEFFICIENTS)

  const addDiff = () => setDiffs(prev => [...prev, { id: `diff-${Date.now()}`, name: '', value: 1.0 }])
  const removeDiff = (id) => setDiffs(prev => prev.filter(d => d.id !== id))

  return (
    <div className="max-w-3xl mx-auto space-y-8">

      {/* RBAC info */}
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
            <tbody className="space-y-1">
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

      {/* Work types */}
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

      {/* Difficulty coefficients */}
      <div className="card p-5">
        <h2 className="text-base font-semibold text-gray-900 mb-3">場域難度係數</h2>
        <div className="space-y-2">
          {diffs.map((d, i) => (
            <div key={d.id} className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-7">
                <input
                  className="input"
                  value={d.name}
                  placeholder="場域名稱（如：全室石材）"
                  onChange={e => setDiffs(prev => prev.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))}
                />
              </div>
              <div className="col-span-3">
                <input
                  className="input"
                  type="number" step="0.1" min="1"
                  value={d.value}
                  onChange={e => setDiffs(prev => prev.map((x, idx) => idx === i ? { ...x, value: +e.target.value } : x))}
                />
              </div>
              <div className="col-span-2 flex gap-1">
                <span className="text-xs text-gray-400 py-2">x</span>
                <button onClick={() => removeDiff(d.id)} className="p-1.5 text-red-400 hover:text-red-600">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
          <button className="btn-secondary text-sm" onClick={addDiff}>
            <Plus size={14} /> 新增係數
          </button>
        </div>
        <button className="btn-primary mt-4">
          <Save size={14} /> 儲存設定
        </button>
      </div>

      {/* Firebase config info */}
      <div className="card p-5">
        <h2 className="text-base font-semibold text-gray-900 mb-3">Firebase 連線設定</h2>
        <p className="text-sm text-gray-500 mb-3">
          請在專案根目錄建立 <code className="bg-gray-100 px-1 rounded">.env</code> 檔並填入以下環境變數：
        </p>
        <pre className="bg-gray-900 text-green-400 rounded-xl p-4 text-xs overflow-x-auto leading-relaxed">
{`VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=000000000000
VITE_FIREBASE_APP_ID=1:000000000000:web:abcdef`}
        </pre>
      </div>
    </div>
  )
}
