import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Users, ClipboardList, ClipboardCheck, Calendar,
  Briefcase, Package, Smartphone, BarChart3, Settings,
  Building2, ChevronDown, UserCog, Wallet, Receipt, Archive,
} from 'lucide-react'
import { useOrg } from '../../contexts/OrgContext'
import { useAuth } from '../../contexts/AuthContext'
import clsx from 'clsx'

// ─── Navigation structure ──────────────────────────────────────────────────────
const NAV_SECTIONS = [
  {
    section: null,
    items: [
      { to: '/dashboard', icon: LayoutDashboard, label: '儀表板', roles: ['admin','staff','employee'] },
    ],
  },
  {
    section: '工務管理',
    items: [
      { to: '/schedule',   icon: Calendar,       label: '排班調度',   roles: ['admin','staff'] },
      { to: '/daily',      icon: ClipboardCheck, label: '工務請款單', roles: ['admin','staff'] },
      { to: '/workorders', icon: Briefcase,      label: '派工驗收',   roles: ['admin','staff'] },
      { to: '/field',      icon: Smartphone,     label: '現場作業',   roles: ['admin','staff','employee'] },
    ],
  },
  {
    section: 'ERP 管理',
    items: [
      { to: '/customers', icon: Users,         label: '客戶 & 案場',  roles: ['admin','staff'] },
      { to: '/orders',    icon: ClipboardList, label: '訂單 & 合約',  roles: ['admin','staff'] },
      { to: '/history',   icon: Archive,       label: '歷史訂單 & 合約', roles: ['admin','staff'] },
      { to: '/ar',        icon: Receipt,       label: '應收帳款',     roles: ['admin','staff'] },
      { to: '/inventory', icon: Package,       label: '進貨 & 成本',  roles: ['admin','staff'] },
      { to: '/employees', icon: UserCog,       label: '員工資料',     roles: ['admin','staff'] },
      { to: '/salary',    icon: Wallet,        label: '薪資計算',     roles: ['admin','staff'] },
      { to: '/finance',   icon: BarChart3,     label: '財務報表',     roles: ['admin'] },
      { to: '/settings',  icon: Settings,      label: '系統設定',     roles: ['admin'] },
    ],
  },
]

export default function Sidebar({ collapsed, onToggle }) {
  const { activeOrg, orgs, switchOrg } = useOrg()
  const { user } = useAuth()
  const role = user?.role || 'admin'

  return (
    <aside className={clsx(
      'flex flex-col bg-gray-900 text-white transition-all duration-300 shrink-0',
      collapsed ? 'w-16' : 'w-60',
    )}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-gray-700">
        <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center shrink-0 text-sm font-bold">
          清
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-sm font-bold truncate">清潔 ERP</p>
            <p className="text-xs text-gray-400 truncate">管理後台</p>
          </div>
        )}
      </div>

      {/* Org switcher */}
      {!collapsed && (
        <div className="px-3 py-3 border-b border-gray-700">
          <p className="text-xs text-gray-500 mb-1.5 px-1">切換組織</p>
          <div className="flex gap-1.5">
            {orgs.map(org => (
              <button
                key={org.id}
                onClick={() => switchOrg(org.id)}
                className={clsx(
                  'flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  activeOrg.id === org.id
                    ? 'bg-brand-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700',
                )}
              >
                {org.name.replace('清潔', '')}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {NAV_SECTIONS.map(({ section, items }, si) => {
          const visible = items.filter(n => n.roles.includes(role))
          if (!visible.length) return null

          return (
            <div key={si} className={clsx('px-2', si > 0 && 'mt-1')}>
              {/* Section header */}
              {section && !collapsed && (
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-3 pt-4 pb-1.5">
                  {section}
                </p>
              )}
              {section && collapsed && (
                <div className="mx-auto w-6 border-t border-gray-700 mt-3 mb-1.5" />
              )}

              {/* Nav items */}
              <div className="space-y-0.5">
                {visible.map(({ to, icon: Icon, label }) => (
                  <NavLink
                    key={to}
                    to={to}
                    className={({ isActive }) => clsx(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                      isActive
                        ? 'bg-brand-600 text-white'
                        : 'text-gray-400 hover:bg-gray-800 hover:text-white',
                    )}
                    title={collapsed ? label : undefined}
                  >
                    <Icon size={18} className="shrink-0" />
                    {!collapsed && <span className="truncate">{label}</span>}
                  </NavLink>
                ))}
              </div>
            </div>
          )
        })}
      </nav>

      {/* User */}
      <div className="border-t border-gray-700 px-3 py-3">
        <div className={clsx('flex items-center gap-2', collapsed && 'justify-center')}>
          <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-xs font-bold shrink-0">
            {user?.displayName?.[0] || 'U'}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{user?.displayName}</p>
              <p className="text-xs text-gray-500 truncate">
                {user?.role === 'admin' ? '管理者' : user?.role === 'staff' ? '行政' : '員工'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        className="border-t border-gray-700 py-2 text-gray-500 hover:text-white hover:bg-gray-800 transition-colors flex justify-center"
      >
        <ChevronDown
          size={16}
          className={clsx('transition-transform', collapsed ? '-rotate-90' : 'rotate-90')}
        />
      </button>
    </aside>
  )
}
