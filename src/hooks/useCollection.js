import { useState, useEffect } from 'react'
import { collection, onSnapshot, query, doc } from 'firebase/firestore'
import { db } from '../lib/firebase'

/**
 * 即時監聽 Firestore 集合
 * @param {string} name  - 集合名稱（用 COL.* 常數）
 * @param {...QueryConstraint} constraints - where(), orderBy() 等條件
 * @returns {{ data: Array, loading: boolean }}
 *
 * 用法：
 *   const { data: employees, loading } = useCollection('employees')
 *   const { data: myEmps } = useCollection('employees', where('orgId', '==', 'jiaxiang'))
 */
export function useCollection(name, ...constraints) {
  const [data, setData]       = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const ref = constraints.length > 0
      ? query(collection(db, name), ...constraints)
      : collection(db, name)

    const unsub = onSnapshot(
      ref,
      snap => {
        setData(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        setLoading(false)
      },
      err => { console.error(`useCollection(${name}) error:`, err); setLoading(false) },
    )
    return unsub
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name])

  return { data, loading }
}

/**
 * 即時監聽單一 Firestore 文件
 * @param {string} collectionName
 * @param {string|null} docId  - null 時暫不監聽，回傳 null
 */
export function useDoc(collectionName, docId) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!docId) { setData(null); setLoading(false); return }
    const unsub = onSnapshot(
      doc(db, collectionName, docId),
      snap => {
        setData(snap.exists() ? { id: snap.id, ...snap.data() } : null)
        setLoading(false)
      },
      err => { console.error(`useDoc(${collectionName}/${docId}) error:`, err); setLoading(false) },
    )
    return unsub
  }, [collectionName, docId])

  return { data, loading }
}
