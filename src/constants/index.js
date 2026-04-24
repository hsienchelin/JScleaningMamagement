/**
 * constants/index.js — 全域系統常數
 *
 * 業務層面的固定設定集中在此，修改一處全站生效。
 * 不放任何 React 元件或副作用程式碼。
 */

// ─── 雇用類型 ─────────────────────────────────────────────────────────────────
export const EMP_TYPE = {
  fulltime:  {
    label: '正職',
    badge: 'bg-blue-100 text-blue-700',
    dot:   'bg-blue-500',
    baseLabel: '月薪底薪',
  },
  stationed: {
    label: '駐點',
    badge: 'bg-green-100 text-green-700',
    dot:   'bg-green-500',
    baseLabel: '駐點出勤',
  },
  mobile: {
    label: '機動',
    badge: 'bg-amber-100 text-amber-700',
    dot:   'bg-amber-500',
    baseLabel: null,  // 機動無底薪
  },
}

// ─── 員工狀態 ─────────────────────────────────────────────────────────────────
export const EMP_STATUS = {
  active:   { label: '在職',  badge: 'bg-green-100 text-green-700',  dot: 'bg-green-400'  },
  leave:    { label: '留職停薪', badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-400' },
  resigned: { label: '已離職', badge: 'bg-red-100 text-red-600',     dot: 'bg-red-400'    },
}

// ─── 薪資狀態 ─────────────────────────────────────────────────────────────────
export const SALARY_STATUS = {
  pending:  { label: '待審核', badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-400' },
  approved: { label: '已核准', badge: 'bg-blue-100 text-blue-700',   dot: 'bg-blue-400'  },
  paid:     { label: '已匯款', badge: 'bg-green-100 text-green-700', dot: 'bg-green-400' },
}

// ─── 工務單狀態 ───────────────────────────────────────────────────────────────
export const REPORT_STATUS = {
  draft:     { label: '草稿',   badge: 'bg-gray-100 text-gray-600',  dot: 'bg-gray-400'  },
  submitted: { label: '已提交', badge: 'bg-blue-100 text-blue-700',  dot: 'bg-blue-400'  },
  approved:  { label: '已審核', badge: 'bg-green-100 text-green-700', dot: 'bg-green-400' },
}

// ─── 班別 ─────────────────────────────────────────────────────────────────────
export const SHIFT_TYPE = {
  full:    { label: '全天班',   hours: 8, badge: 'bg-blue-100 text-blue-700'   },
  half_am: { label: '上午半天', hours: 4, badge: 'bg-green-100 text-green-700' },
  half_pm: { label: '下午半天', hours: 4, badge: 'bg-amber-100 text-amber-700' },
}

// ─── 費率類型 ─────────────────────────────────────────────────────────────────
export const RATE_TYPE = {
  daily:  { label: '日薪', hint: '整日計費' },
  hourly: { label: '時薪', hint: '依實際工時計費' },
}

// ─── 路由權限對照 ──────────────────────────────────────────────────────────────
export const ROLES = {
  admin:    '管理者',
  staff:    '行政',
  employee: '員工',
}
