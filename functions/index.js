const { onCall, HttpsError } = require('firebase-functions/v2/https')
const { initializeApp }     = require('firebase-admin/app')
const { getAuth }           = require('firebase-admin/auth')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')

initializeApp()

// 員工編號 → Firebase 假 Email（與前端 AuthContext 一致）
function toEmail(employeeId) {
  return `${employeeId.trim().toLowerCase()}@erp-internal.com`
}

// ─── 建立員工登入帳號 ──────────────────────────────────────────────────────────
exports.createEmployeeAccount = onCall(
  { region: 'asia-east1' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', '請先登入')

    const { employeeId, displayName, tempPassword, orgId, role } = request.data
    if (!employeeId || !tempPassword) {
      throw new HttpsError('invalid-argument', '缺少必要參數')
    }

    const email = toEmail(employeeId)

    try {
      // 建立 Firebase Auth 帳號
      const userRecord = await getAuth().createUser({
        email,
        password: tempPassword,
        displayName: displayName || employeeId,
      })

      // 建立 Firestore users/{uid} 使用者文件
      await getFirestore().doc(`users/${userRecord.uid}`).set({
        employeeId:          employeeId.toLowerCase(),
        displayName:         displayName || employeeId,
        role:                role || 'employee',
        orgId:               orgId || 'jiaxiang',
        mustChangePassword:  true,
        createdAt:           FieldValue.serverTimestamp(),
      })

      return { uid: userRecord.uid, success: true }
    } catch (e) {
      if (e.code === 'auth/email-already-exists') {
        throw new HttpsError('already-exists', '此員工編號已有登入帳號')
      }
      throw new HttpsError('internal', e.message)
    }
  }
)

// ─── 重設員工密碼（管理員操作）────────────────────────────────────────────────
exports.resetEmployeePassword = onCall(
  { region: 'asia-east1' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', '請先登入')

    const { employeeId, tempPassword } = request.data
    if (!employeeId || !tempPassword) {
      throw new HttpsError('invalid-argument', '缺少必要參數')
    }

    const email = toEmail(employeeId)

    try {
      const userRecord = await getAuth().getUserByEmail(email)

      // 更新 Firebase Auth 密碼
      await getAuth().updateUser(userRecord.uid, { password: tempPassword })

      // 標記下次登入需強制改密碼
      await getFirestore().doc(`users/${userRecord.uid}`).set(
        { mustChangePassword: true },
        { merge: true }
      )

      return { success: true }
    } catch (e) {
      if (e.code === 'auth/user-not-found') {
        throw new HttpsError('not-found', '找不到此員工的登入帳號')
      }
      throw new HttpsError('internal', e.message)
    }
  }
)
