import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { LogIn, Eye, EyeOff, IdCard } from 'lucide-react'

export default function LoginPage() {
  const { login, error } = useAuth()
  const navigate = useNavigate()
  const [employeeId, setEmployeeId] = useState('')
  const [password, setPassword]     = useState('')
  const [showPw, setShowPw]         = useState(false)
  const [loading, setLoading]       = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await login(employeeId.trim().toUpperCase(), password)
      navigate('/dashboard')
    } catch {
      // error 已由 AuthContext 設定
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-900 via-brand-800 to-brand-700 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl">
            <span className="text-3xl font-bold text-brand-700">清</span>
          </div>
          <h1 className="text-2xl font-bold text-white">清潔 ERP 系統</h1>
          <p className="text-brand-300 text-sm mt-1">佳翔 & 哲欣 雲端管理後台</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* 員工編號 */}
            <div>
              <label className="label">員工編號</label>
              <div className="relative">
                <IdCard size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  className="input pl-9 uppercase tracking-widest"
                  value={employeeId}
                  onChange={e => setEmployeeId(e.target.value.toUpperCase())}
                  placeholder="JS001"
                  maxLength={10}
                  required
                  autoFocus
                  autoCapitalize="characters"
                  autoComplete="username"
                />
              </div>
            </div>

            {/* 密碼 */}
            <div>
              <label className="label">密碼</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  className="input pr-10"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="預設密碼：身分證後六碼"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1.5">首次登入請使用身分證後六碼作為密碼</p>
            </div>

            {/* 錯誤訊息 */}
            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              className="btn-primary w-full justify-center py-2.5"
              disabled={loading || !employeeId || !password}
            >
              <LogIn size={16} />
              {loading ? '登入中...' : '登入系統'}
            </button>
          </form>

          {/* 忘記密碼提示 */}
          <div className="mt-5 pt-5 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-400">
              忘記密碼？請聯絡管理員協助重設
            </p>
          </div>
        </div>

        <p className="text-center text-brand-400 text-xs mt-6">
          © 2025 清潔 ERP — 佳翔 & 哲欣
        </p>
      </div>
    </div>
  )
}
