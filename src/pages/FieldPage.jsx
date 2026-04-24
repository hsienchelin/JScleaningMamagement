import { useState, useRef } from 'react'
import { MapPin, Camera, CheckCircle, Clock, AlertCircle, Navigation, Upload, Package, FileText } from 'lucide-react'
import { MOCK_WORK_ORDERS, MOCK_EMPLOYEES, MOCK_CUSTOMERS } from '../lib/mockData'
import { useAuth } from '../contexts/AuthContext'
import clsx from 'clsx'

const GPS_THRESHOLD_METERS = 100

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R   = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ─── Single task card ─────────────────────────────────────────────────────────
function TaskCard({ wo }) {
  const [punchStatus, setPunchStatus] = useState(wo.status === 'completed' ? 'completed' : 'pending')
  const [gpsError, setGpsError]       = useState(null)
  const [gpsLoading, setGpsLoading]   = useState(false)
  const [photos, setPhotos]           = useState([])
  const [uploading, setUploading]     = useState(false)
  const fileRef = useRef(null)

  // Find site GPS coords
  const site    = MOCK_CUSTOMERS.flatMap(c => c.sites).find(s => s.id === wo.siteId)
  const siteLat = site?.lat ?? 25.0455
  const siteLng = site?.lng ?? 121.5149

  const handlePunchIn = () => {
    setGpsLoading(true)
    setGpsError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLoading(false)
        const dist = haversineDistance(pos.coords.latitude, pos.coords.longitude, siteLat, siteLng)
        if (dist > GPS_THRESHOLD_METERS) {
          setGpsError(`距離案場 ${Math.round(dist)}m，超出 ${GPS_THRESHOLD_METERS}m 限制，無法簽到`)
        } else {
          setPunchStatus('punched_in')
        }
      },
      () => {
        setGpsLoading(false)
        // In demo mode (browser geolocation denied): simulate success
        setPunchStatus('punched_in')
      },
      { enableHighAccuracy: true, timeout: 8000 },
    )
  }

  const handlePhotoUpload = (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    setUploading(true)
    setTimeout(() => {
      const urls = files.map(f => URL.createObjectURL(f))
      setPhotos(prev => [...prev, ...urls])
      setUploading(false)
    }, 1200)
  }

  const emps = MOCK_EMPLOYEES.filter(e => wo.employeeIds?.includes(e.id))

  const statusConfig = {
    pending:    { label: '待出發', dot: 'bg-gray-300',   bar: 'bg-gray-200'   },
    punched_in: { label: '工作中', dot: 'bg-green-400',  bar: 'bg-green-400'  },
    completed:  { label: '已完工', dot: 'bg-blue-400',   bar: 'bg-blue-400'   },
  }
  const sc = statusConfig[punchStatus]

  return (
    <div className={clsx(
      'card overflow-hidden transition-opacity',
      punchStatus === 'completed' && 'opacity-75',
    )}>
      {/* Status accent bar */}
      <div className={clsx('h-1', sc.bar)} />

      <div className="p-5 space-y-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-xl font-bold text-gray-900 leading-tight">{wo.siteName}</h3>
            <p className="text-sm text-gray-400 mt-0.5">📅 {wo.date}</p>
          </div>
          <span className={clsx(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shrink-0',
            punchStatus === 'completed'  && 'bg-blue-100 text-blue-700',
            punchStatus === 'punched_in' && 'bg-green-100 text-green-700',
            punchStatus === 'pending'    && 'bg-gray-100 text-gray-600',
          )}>
            <span className={clsx('w-1.5 h-1.5 rounded-full', sc.dot)} />
            {sc.label}
          </span>
        </div>

        {/* Employees */}
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1.5">施工人員</p>
          <div className="flex flex-wrap gap-2">
            {emps.map(e => (
              <div key={e.id} className="flex items-center gap-1.5 bg-brand-50 text-brand-700 rounded-full px-2.5 py-1">
                <div className="w-5 h-5 bg-brand-200 rounded-full flex items-center justify-center text-[10px] font-bold">
                  {e.name[0]}
                </div>
                <span className="text-sm font-medium">{e.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Notes */}
        {wo.notes && (
          <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
            <p className="text-xs text-red-500 font-semibold uppercase tracking-wide mb-0.5 flex items-center gap-1">
              <AlertCircle size={11} /> 特殊備註
            </p>
            <p className="text-sm text-red-700">{wo.notes}</p>
          </div>
        )}

        {/* Material list */}
        {wo.materialList?.length > 0 && (
          <div className="bg-amber-50 rounded-xl px-4 py-3">
            <p className="text-xs text-amber-600 font-semibold uppercase tracking-wide mb-2 flex items-center gap-1">
              <Package size={11} /> 建議攜帶物料
            </p>
            <ul className="space-y-1">
              {wo.materialList.map((m, i) => (
                <li key={i} className="text-sm text-amber-800 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-amber-400 rounded-full shrink-0" />{m}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* GPS error */}
        {gpsError && (
          <div className="flex items-start gap-2 bg-red-50 text-red-700 rounded-xl px-4 py-3 text-sm">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{gpsError}</span>
          </div>
        )}

        {/* Photo upload (only when working) */}
        {punchStatus === 'punched_in' && (
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1">
              <Camera size={11} /> 現場照片（自動加時間地點浮水印）
            </p>
            <div className="flex flex-wrap gap-2">
              {photos.map((url, i) => (
                <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden">
                  <img src={url} className="w-full h-full object-cover" alt={`photo-${i}`} />
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[8px] px-1 py-0.5 truncate">
                    {new Date().toLocaleString('zh-TW', { hour12: false })}
                  </div>
                </div>
              ))}
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className={clsx(
                  'w-20 h-20 rounded-xl border-2 border-dashed flex flex-col items-center justify-center transition-colors',
                  uploading
                    ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                    : 'border-brand-300 text-brand-500 hover:border-brand-500 hover:bg-brand-50',
                )}
              >
                {uploading
                  ? <Upload size={20} className="animate-bounce" />
                  : <Camera size={20} />
                }
                <span className="text-[10px] mt-1 font-medium">
                  {uploading ? '上傳中' : '拍照'}
                </span>
              </button>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={handlePhotoUpload} />
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 pt-1">
          {punchStatus === 'pending' && (
            <button
              className="btn-primary flex-1 justify-center py-3.5 text-base"
              onClick={handlePunchIn}
              disabled={gpsLoading}
            >
              <Navigation size={18} />
              {gpsLoading ? 'GPS 定位中...' : 'GPS 打卡簽到'}
            </button>
          )}

          {punchStatus === 'punched_in' && (
            <button
              className="flex-1 inline-flex items-center justify-center gap-2 py-3.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-colors text-base"
              onClick={() => setPunchStatus('completed')}
            >
              <CheckCircle size={18} /> 完工簽退
            </button>
          )}

          {punchStatus === 'completed' && (
            <div className="flex-1 flex items-center justify-center gap-2 py-3 text-green-600 font-semibold bg-green-50 rounded-xl">
              <CheckCircle size={18} /> 本單已完成
            </div>
          )}

          {/* Navigation button */}
          <a
            href={`https://maps.google.com/?q=${siteLat},${siteLng}`}
            target="_blank"
            rel="noreferrer"
            className="btn-secondary px-4 py-3.5"
            title={`導航至 ${wo.siteName}`}
          >
            <MapPin size={18} />
          </a>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function FieldPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState('today')

  const today    = new Date().toISOString().slice(0, 10)
  // Demo: treat 2026-04-15 & 2026-04-16 as "today/tomorrow" so tasks always show
  const demoDate = '2026-04-15'

  const todayOrders    = MOCK_WORK_ORDERS.filter(wo =>
    wo.date === today || wo.date === demoDate || wo.date === '2026-04-16'
  )
  const upcomingOrders = MOCK_WORK_ORDERS.filter(wo =>
    wo.date > demoDate && wo.date !== '2026-04-16' && wo.status !== 'completed'
  )

  const displayed = tab === 'today' ? todayOrders : upcomingOrders

  return (
    <div className="max-w-lg mx-auto space-y-5">

      {/* Employee banner */}
      <div className="card p-4 flex items-center gap-3 border-0 text-white"
        style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' }}
      >
        <div className="w-11 h-11 bg-white/20 rounded-full flex items-center justify-center text-xl font-bold shrink-0">
          {user?.displayName?.[0] || 'W'}
        </div>
        <div className="min-w-0">
          <p className="font-bold text-base">{user?.displayName || '員工'}</p>
          <p className="text-blue-200 text-sm">現場作業介面 · {new Date().toLocaleDateString('zh-TW')}</p>
        </div>
        <div className="ml-auto text-right shrink-0">
          <p className="text-2xl font-bold">{todayOrders.length}</p>
          <p className="text-blue-200 text-xs">今日任務</p>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
        {[
          { key: 'today',    label: `今日任務 (${todayOrders.length})` },
          { key: 'upcoming', label: `即將任務 (${upcomingOrders.length})` },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={clsx(
              'flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all',
              tab === t.key
                ? 'bg-white shadow-sm text-gray-900'
                : 'text-gray-500 hover:text-gray-700',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Task cards */}
      <div className="space-y-4">
        {displayed.length > 0
          ? displayed.map(wo => <TaskCard key={wo.id} wo={wo} />)
          : (
            <div className="card p-16 text-center">
              <CheckCircle size={44} className="mx-auto mb-4 text-gray-200" />
              <p className="text-lg font-semibold text-gray-400">
                {tab === 'today' ? '今日無派工任務' : '暫無即將任務'}
              </p>
              <p className="text-sm text-gray-300 mt-1">好好休息！</p>
            </div>
          )
        }
      </div>
    </div>
  )
}
