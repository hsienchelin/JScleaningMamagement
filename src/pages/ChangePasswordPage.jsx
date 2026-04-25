import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { auth } from '../lib/firebase'
import { KeyRound, Eye, EyeOff, ShieldCheck } from 'lucide-react'

export default function ChangePasswordPage() {
  const { user, changePassword } = useAuth()
  const navigate = useNavigate()

  const [currentPw,  setCurrentPw]  = useState('')
  const [newPw,      setNewPw]      = useState('')
  const [confirmPw,  setConfirmPw]  = useState('')
  const [showCur,    setShowCur]    = useState(false)
  const [showNew,    setShowNew]    = useState(false)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')

  const strengthScore = (() => {
    if (newPw.length < 6)  return 0
    if (newPw.length < 8)  return 1
    let s = 1
    if (/[A-Z]/.test(newPw))      s++
    if (/[0-9]/.test(newPw))      s++
    if (/[^A-Za-z0-9]/.test(newPw)) s++
    return s
  })()
  const strengthLabel = ['', '弱', '中', '強', '很強'][strengthScore]
  const strengthColor = ['', 'bg-red-400', 'bg-amber-400', 'bg-green-400', 'bg-green-600'][strengthScore]

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (newPw.length < 6) {
      setError('新密碼至少需要 6 個字元')
      return
    }
    if (newPw !== confirmPw) {
      setError('兩次輸入的密碼不一致')
      return
    }
    if (newPw === currentPw) {
      setError('新密碼不能與目前密碼相同')
      return
    }

    setLoading(true)
    try {
      await changePassword(currentPw, newPw)

      // 清除 mustChangePassword 旗標
      if (auth.currentUser) {
        await updateDoc(doc(db, 'users', auth.currentUser.uid), {
          mustChangePassword: false,
        })
      }

      navigate('/dashboard', { replace: true })
    } catch (e) {
      if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
        setError('目前密碼錯誤，請重新輸入')
      } else if (e.code === 'auth/weak-password') {
        setError('密碼強度不足，請至少使用 6 個字元')
      } else {
        setError('發生錯誤，請稍後再試')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Header */}
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Logo" className="w-20 h-20 rounded-2xl mx-auto mb-4 shadow-xl object-cover" />
          <h1 className="text-2xl font-bold text-gray-900">設定新密碼</h1>
          <p className="text-gray-400 text-sm mt-1">
            {user?.employeeId
              ? `員工編號：${user.employeeId.toUpperCase()}`
              : '首次登入，請設定您的密碼'}
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8 space-y-5">

          {/* 說明 */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
            首次登入或密碼重設後，必須先設定新密碼才能使用系統。
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* 目前密碼 */}
            <div>
              <label className="label">目前密碼（預設／臨時密碼）</label>
              <div className="relative">
                <input
                  type={showCur ? 'text' : 'password'}
                  className="input pr-10"
                  value={currentPw}
                  onChange={e => setCurrentPw(e.target.value)}
                  placeholder="輸入目前的密碼"
                  required
                  autoFocus
                />
                <button type="button" onClick={() => setShowCur(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showCur ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* 新密碼 */}
            <div>
              <label className="label">新密碼</label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  className="input pr-10"
                  value={newPw}
                  onChange={e => setNewPw(e.target.value)}
                  placeholder="至少 6 個字元"
                  required
                />
                <button type="button" onClick={() => setShowNew(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {/* 強度指示 */}
              {newPw.length > 0 && (
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex gap-0.5 flex-1">
                    {[1,2,3,4].map(i => (
                      <div key={i}
                        className={`h-1 flex-1 rounded-full transition-colors ${i <= strengthScore ? strengthColor : 'bg-gray-200'}`}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-gray-500">{strengthLabel}</span>
                </div>
              )}
            </div>

            {/* 確認新密碼 */}
            <div>
              <label className="label">確認新密碼</label>
              <input
                type="password"
                className={`input ${confirmPw && newPw !== confirmPw ? 'border-red-300 focus:ring-red-300' : ''}`}
                value={confirmPw}
                onChange={e => setConfirmPw(e.target.value)}
                placeholder="再輸入一次新密碼"
                required
              />
              {confirmPw && newPw !== confirmPw && (
                <p className="text-xs text-red-500 mt-1">密碼不一致</p>
              )}
            </div>

            {/* 錯誤訊息 */}
            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              className="btn-primary w-full justify-center py-2.5"
              disabled={loading || !currentPw || !newPw || !confirmPw}
            >
              <KeyRound size={16} />
              {loading ? '設定中...' : '確認設定新密碼'}
            </button>
          </form>
        </div>

        <p className="text-center text-gray-400 text-xs mt-6">
          © 2025 清潔 ERP — 佳翔 & 哲欣
        </p>
      </div>
    </div>
  )
}
