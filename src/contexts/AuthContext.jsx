import { createContext, useContext, useState, useEffect } from 'react'
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'

const AuthContext = createContext(null)

// 員工編號 → Firebase 假 Email
function toEmail(employeeId) {
  return `${employeeId.trim().toLowerCase()}@erp-internal.com`
}

// Firebase 錯誤碼 → 中文說明
function authErrorMessage(code) {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return '員工編號或密碼錯誤'
    case 'auth/user-disabled':
      return '此帳號已停用，請聯絡管理員'
    case 'auth/too-many-requests':
      return '嘗試次數過多，請稍後再試'
    default:
      return '登入失敗，請稍後再試'
  }
}

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // 從 Firestore users/{uid} 取得角色與公司資訊
        let profile = {}
        try {
          const snap = await getDoc(doc(db, 'users', firebaseUser.uid))
          if (snap.exists()) profile = snap.data()
        } catch {
          // Firestore 尚未設定時不中斷流程
        }

        setUser({
          uid:         firebaseUser.uid,
          email:       firebaseUser.email,
          // 從 email 反推員工編號（js001@erp-internal.com → JS001）
          employeeId:  profile.employeeId || firebaseUser.email.split('@')[0].toUpperCase(),
          displayName: profile.name       || profile.displayName || '',
          role:        profile.role       || 'employee',   // admin | staff | employee
          orgId:       profile.orgId      || 'jiaxiang',
          mustChangePassword: profile.mustChangePassword ?? false,
        })
      } else {
        setUser(null)
      }
      setLoading(false)
    })
    return unsub
  }, [])

  /** 員工編號 + 密碼登入 */
  const login = async (employeeId, password) => {
    setError(null)
    try {
      await signInWithEmailAndPassword(auth, toEmail(employeeId), password)
    } catch (e) {
      const msg = authErrorMessage(e.code)
      setError(msg)
      throw e
    }
  }

  const logout = async () => {
    await signOut(auth)
    setUser(null)
  }

  /**
   * 員工自行改密碼
   * 需要先用舊密碼重新驗證（Firebase 安全要求）
   */
  const changePassword = async (currentPassword, newPassword) => {
    const firebaseUser = auth.currentUser
    if (!firebaseUser) throw new Error('未登入')
    const credential = EmailAuthProvider.credential(firebaseUser.email, currentPassword)
    await reauthenticateWithCredential(firebaseUser, credential)
    await updatePassword(firebaseUser, newPassword)
  }

  return (
    <AuthContext.Provider value={{ user, loading, error, login, logout, changePassword }}>
      {!loading && children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
