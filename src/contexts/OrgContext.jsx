import { createContext, useContext, useState } from 'react'
import { ORGS } from '../lib/mockData'

const OrgContext = createContext(null)

export function OrgProvider({ children }) {
  const [activeOrgId, setActiveOrgId] = useState('jiaxiang')

  const activeOrg = ORGS.find(o => o.id === activeOrgId) || ORGS[0]

  const switchOrg = (orgId) => {
    if (ORGS.find(o => o.id === orgId)) setActiveOrgId(orgId)
  }

  return (
    <OrgContext.Provider value={{ orgs: ORGS, activeOrg, activeOrgId, switchOrg }}>
      {children}
    </OrgContext.Provider>
  )
}

export const useOrg = () => {
  const ctx = useContext(OrgContext)
  if (!ctx) throw new Error('useOrg must be inside OrgProvider')
  return ctx
}
