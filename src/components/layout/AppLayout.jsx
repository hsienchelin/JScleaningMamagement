import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'

const PAGE_TITLES = {
  '/dashboard':  '營運儀表板',
  '/customers':  '客戶 & 案場管理',
  '/orders':     '訂單 & 合約管理',
  '/schedule':   '排班調度系統',
  '/workorders': '派工單 & 驗收',
  '/inventory':  '進貨 & 成本引擎',
  '/field':      '現場行動作業',
  '/finance':    '財務 & 損益報表',
  '/settings':   '系統設定',
}

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()
  const title = PAGE_TITLES[location.pathname] || ''

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header title={title} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
