import { Bell, LogOut } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useOrg } from '../../contexts/OrgContext'
import { useNavigate } from 'react-router-dom'
import { MOCK_ORDERS } from '../../lib/mockData'

export default function Header({ title }) {
  const { logout } = useAuth()
  const { activeOrg, activeOrgId } = useOrg()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  // Dynamic: contracts expiring within 30 days
  const expiring = MOCK_ORDERS.filter(o => {
    if (o.orgId !== activeOrgId || o.status !== 'active') return false
    const days = Math.ceil((new Date(o.contractEnd) - new Date()) / 86400000)
    return days > 0 && days <= 30
  })

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center gap-4 px-6 shrink-0">
      {/* Org badge */}
      <span
        className="text-white text-xs px-2.5 py-1 rounded-full font-semibold"
        style={{ backgroundColor: activeOrg.color }}
      >
        {activeOrg.name}
      </span>

      <h1 className="text-sm font-semibold text-gray-700 hidden sm:block">{title}</h1>

      <div className="flex-1" />

      {/* Contract expiry alert — dynamic */}
      {expiring.length > 0 && (
        <button
          className="flex items-center gap-1.5 text-amber-600 text-xs font-medium bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded-lg hover:bg-amber-100 transition-colors"
          onClick={() => navigate('/orders')}
          title={expiring.map(o => o.title).join('\n')}
        >
          <Bell size={13} />
          {expiring.length} 件合約即將到期
        </button>
      )}

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        title="登出"
      >
        <LogOut size={16} />
      </button>
    </header>
  )
}
