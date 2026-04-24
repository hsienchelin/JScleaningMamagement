import { Component } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { OrgProvider } from './contexts/OrgContext'
import AppLayout      from './components/layout/AppLayout'
import LoginPage      from './pages/LoginPage'
import DashboardPage  from './pages/DashboardPage'
import CustomersPage  from './pages/CustomersPage'
import OrdersPage     from './pages/OrdersPage'
import SchedulePage   from './pages/SchedulePage'
import WorkOrdersPage from './pages/WorkOrdersPage'
import InventoryPage  from './pages/InventoryPage'
import FieldPage      from './pages/FieldPage'
import FinancePage    from './pages/FinancePage'
import SettingsPage   from './pages/SettingsPage'
import EmployeesPage    from './pages/EmployeesPage'
import SalaryPage       from './pages/SalaryPage'
import DailyReportPage  from './pages/DailyReportPage'
import ARPage           from './pages/ARPage'
import HistoryPage      from './pages/HistoryPage'

// ─── Error boundary ───────────────────────────────────────────────────────────
class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  componentDidCatch(error, info) {
    // In production: send to Sentry / Firebase Crashlytics
    console.error('[ERP ErrorBoundary]', error, info)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="card p-8 max-w-sm w-full text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">頁面發生錯誤</h2>
            <p className="text-sm text-gray-500 mb-5">
              {this.state.error?.message || '未知錯誤'}
            </p>
            <button
              className="btn-primary w-full justify-center"
              onClick={() => {
                this.setState({ hasError: false, error: null })
                window.location.href = '/dashboard'
              }}
            >
              返回儀表板
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// ─── Protected route ──────────────────────────────────────────────────────────
// 資料建置模式：暫時關閉登入驗證，直接進入系統輸入初始資料
// 資料建好後將此行改為 false，即可恢復正常登入流程
const SETUP_MODE = true

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (SETUP_MODE) return children   // 建置期間直接通過
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-gray-400">
        <div className="w-8 h-8 border-[3px] border-brand-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">載入中...</span>
      </div>
    </div>
  )
  return user ? children : <Navigate to="/login" replace />
}

// ─── Routes ───────────────────────────────────────────────────────────────────
function AppRoutes() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
      <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard"  element={<ErrorBoundary><DashboardPage /></ErrorBoundary>} />
        <Route path="customers"  element={<ErrorBoundary><CustomersPage /></ErrorBoundary>} />
        <Route path="orders"     element={<ErrorBoundary><OrdersPage /></ErrorBoundary>} />
        <Route path="schedule"   element={<ErrorBoundary><SchedulePage /></ErrorBoundary>} />
        <Route path="workorders" element={<ErrorBoundary><WorkOrdersPage /></ErrorBoundary>} />
        <Route path="inventory"  element={<ErrorBoundary><InventoryPage /></ErrorBoundary>} />
        <Route path="field"      element={<ErrorBoundary><FieldPage /></ErrorBoundary>} />
        <Route path="employees"  element={<ErrorBoundary><EmployeesPage /></ErrorBoundary>} />
        <Route path="salary"     element={<ErrorBoundary><SalaryPage /></ErrorBoundary>} />
        <Route path="daily"      element={<ErrorBoundary><DailyReportPage /></ErrorBoundary>} />
        <Route path="ar"         element={<ErrorBoundary><ARPage /></ErrorBoundary>} />
        <Route path="history"    element={<ErrorBoundary><HistoryPage /></ErrorBoundary>} />
        <Route path="finance"    element={<ErrorBoundary><FinancePage /></ErrorBoundary>} />
        <Route path="settings"   element={<ErrorBoundary><SettingsPage /></ErrorBoundary>} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <AuthProvider>
          <OrgProvider>
            <AppRoutes />
          </OrgProvider>
        </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  )
}
