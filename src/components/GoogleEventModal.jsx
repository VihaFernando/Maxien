import { useState, useEffect } from 'react'
import { FaTimes, FaVideo, FaCalendarAlt, FaClock, FaGlobe, FaExternalLinkAlt } from 'react-icons/fa'

const COMMON_TIMEZONES = [
    'UTC',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Toronto',
    'America/Vancouver',
    'America/Mexico_City',
    'America/Sao_Paulo',
    'America/Argentina/Buenos_Aires',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Europe/Madrid',
    'Europe/Rome',
    'Europe/Amsterdam',
    'Europe/Stockholm',
    'Europe/Moscow',
    'Africa/Cairo',
    'Africa/Johannesburg',
    'Africa/Lagos',
    'Asia/Dubai',
    'Asia/Kolkata',
    'Asia/Bangkok',
    'Asia/Singapore',
    'Asia/Shanghai',
    'Asia/Tokyo',
    'Asia/Seoul',
    'Asia/Hong_Kong',
    'Australia/Sydney',
    'Australia/Melbourne',
    'Pacific/Auckland',
    'Pacific/Honolulu',
]

/** Convert an ISO date string to the value expected by datetime-local inputs (YYYY-MM-DDTHH:MM) */
function toLocalInput(isoString) {
    if (!isoString) return ''
    const d = new Date(isoString)
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Default start: round up to next 30-min boundary */
function defaultStart(date) {
    const d = date ? new Date(date) : new Date()
    if (date) {
        d.setHours(9, 0, 0, 0)
    } else {
        const mins = d.getMinutes()
        d.setMinutes(mins > 30 ? 60 : 30, 0, 0)
    }
    return toLocalInput(d.toISOString())
}

/** Default end: 1 hour after a given local-input string */
function defaultEnd(startLocalStr) {
    if (!startLocalStr) return ''
    const d = new Date(startLocalStr)
    d.setHours(d.getHours() + 1)
    return toLocalInput(d.toISOString())
}

export default function GoogleEventModal({ event, defaultDate, onSave, onDelete, onClose }) {
    const isEdit = !!event?.id

    const initStart = event?.start?.dateTime
        ? toLocalInput(event.start.dateTime)
        : defaultStart(defaultDate)

    const initEnd = event?.end?.dateTime
        ? toLocalInput(event.end.dateTime)
        : defaultEnd(initStart)

    const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone
    const allTimezones = COMMON_TIMEZONES.includes(userTz)
        ? COMMON_TIMEZONES
        : [userTz, ...COMMON_TIMEZONES]

    const [title, setTitle] = useState(event?.summary || '')
    const [description, setDescription] = useState(event?.description || '')
    const [startDt, setStartDt] = useState(initStart)
    const [endDt, setEndDt] = useState(initEnd)
    const [timezone, setTimezone] = useState(event?.start?.timeZone || userTz)
    const [addMeet, setAddMeet] = useState(!!event?.conferenceData)
    const [saving, setSaving] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [error, setError] = useState('')

    // When start changes and no explicit end was set, auto-advance end by 1h
    useEffect(() => {
        if (startDt && !event?.end?.dateTime) {
            setEndDt(defaultEnd(startDt))
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [startDt])

    const meetLink = event?.conferenceData?.entryPoints?.find(
        (ep) => ep.entryPointType === 'video'
    )?.uri

    const handleSave = async () => {
        if (!title.trim()) { setError('Title is required.'); return }
        if (!startDt || !endDt) { setError('Start and end time are required.'); return }
        if (new Date(endDt) <= new Date(startDt)) {
            setError('End time must be after start time.')
            return
        }

        setSaving(true)
        setError('')

        const eventData = {
            summary: title.trim(),
            description: description.trim() || undefined,
            start: { dateTime: new Date(startDt).toISOString(), timeZone: timezone },
            end: { dateTime: new Date(endDt).toISOString(), timeZone: timezone },
        }

        if (addMeet) {
            eventData.conferenceData = {
                createRequest: {
                    requestId: `meet-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                    conferenceSolutionKey: { type: 'hangoutsMeet' },
                },
            }
        }

        await onSave(eventData)
        setSaving(false)
    }

    const handleDelete = async () => {
        if (!window.confirm('Delete this Google Calendar event? This cannot be undone.')) return
        setDeleting(true)
        await onDelete()
        setDeleting(false)
    }

    return (
        <div className="fixed inset-0 bg-[#1d1d1f]/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 sm:p-4 transition-opacity duration-300">
            <div className="bg-white rounded-t-[32px] sm:rounded-[32px] p-6 sm:p-8 w-full max-w-lg max-h-[92vh] overflow-y-auto shadow-2xl relative">

                {/* Mobile drag handle */}
                <div className="flex justify-center sm:hidden mb-4">
                    <div className="w-12 h-1.5 bg-[#d2d2d7] rounded-full" />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-indigo-500 rounded-xl flex items-center justify-center">
                            <FaCalendarAlt className="w-4 h-4 text-white" />
                        </div>
                        <h2 className="text-xl font-bold text-[#1d1d1f]">
                            {isEdit ? 'Edit Event' : 'New Calendar Event'}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 bg-[#f5f5f7] hover:bg-[#e8e8ed] rounded-full transition-colors"
                    >
                        <FaTimes className="w-4 h-4 text-[#86868b]" />
                    </button>
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 font-medium">
                        {error}
                    </div>
                )}

                <div className="space-y-5">
                    {/* Title */}
                    <div>
                        <label className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider mb-1.5 block">
                            Title *
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Add title"
                            autoFocus
                            className="w-full bg-[#f5f5f7] border border-[#d2d2d7]/50 rounded-xl px-4 py-3 text-[15px] text-[#1d1d1f] placeholder-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#C6FF00] focus:border-transparent transition-all"
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider mb-1.5 block">
                            Description
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Add description (optional)"
                            rows={3}
                            className="w-full bg-[#f5f5f7] border border-[#d2d2d7]/50 rounded-xl px-4 py-3 text-[15px] text-[#1d1d1f] placeholder-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#C6FF00] focus:border-transparent transition-all resize-none"
                        />
                    </div>

                    {/* Start / End datetime */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                <FaClock className="w-3 h-3" /> Start *
                            </label>
                            <input
                                type="datetime-local"
                                value={startDt}
                                onChange={(e) => setStartDt(e.target.value)}
                                className="w-full bg-[#f5f5f7] border border-[#d2d2d7]/50 rounded-xl px-4 py-3 text-[14px] text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#C6FF00] transition-all"
                            />
                        </div>
                        <div>
                            <label className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                <FaClock className="w-3 h-3" /> End *
                            </label>
                            <input
                                type="datetime-local"
                                value={endDt}
                                onChange={(e) => setEndDt(e.target.value)}
                                min={startDt}
                                className="w-full bg-[#f5f5f7] border border-[#d2d2d7]/50 rounded-xl px-4 py-3 text-[14px] text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#C6FF00] transition-all"
                            />
                        </div>
                    </div>

                    {/* Timezone */}
                    <div>
                        <label className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider mb-1.5 flex items-center gap-1">
                            <FaGlobe className="w-3 h-3" /> Timezone
                        </label>
                        <select
                            value={timezone}
                            onChange={(e) => setTimezone(e.target.value)}
                            className="w-full bg-[#f5f5f7] border border-[#d2d2d7]/50 rounded-xl px-4 py-3 text-[14px] text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#C6FF00] transition-all"
                        >
                            {allTimezones.map((tz) => (
                                <option key={tz} value={tz}>
                                    {tz}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Google Meet toggle */}
                    <div className="flex items-center justify-between bg-[#f5f5f7] rounded-2xl p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-[#00897b] rounded-xl flex items-center justify-center flex-shrink-0">
                                <FaVideo className="w-4 h-4 text-white" />
                            </div>
                            <div>
                                <p className="text-[14px] font-semibold text-[#1d1d1f]">Add Google Meet</p>
                                <p className="text-[11px] text-[#86868b]">Automatically create a video call link</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setAddMeet(!addMeet)}
                            className={`relative flex-shrink-0 rounded-full transition-all duration-200 focus:outline-none ${addMeet ? 'bg-[#C6FF00]' : 'bg-[#d2d2d7]'}`}
                            style={{ width: 48, height: 26 }}
                            aria-label="Toggle Google Meet"
                        >
                            <span
                                className={`absolute top-[3px] left-[3px] w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${addMeet ? 'translate-x-[22px]' : 'translate-x-0'}`}
                            />
                        </button>
                    </div>

                    {/* Existing Meet link (edit mode) */}
                    {isEdit && meetLink && (
                        <div className="bg-[#e8f5e9] border border-[#81c784] rounded-xl p-4">
                            <p className="text-[11px] font-bold text-[#2e7d32] uppercase tracking-wider mb-2">
                                Google Meet Link
                            </p>
                            <a
                                href={meetLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[13px] text-[#1565c0] underline break-all flex items-center gap-1.5"
                            >
                                <FaExternalLinkAlt className="w-3 h-3 flex-shrink-0" />
                                {meetLink}
                            </a>
                        </div>
                    )}
                </div>

                {/* Action buttons */}
                <div
                    className={`mt-8 pt-6 border-t border-[#d2d2d7]/50 flex gap-3 ${isEdit ? 'justify-between' : 'justify-end'}`}
                >
                    {isEdit && (
                        <button
                            onClick={handleDelete}
                            disabled={deleting || saving}
                            className="px-5 py-3 bg-red-50 text-red-600 hover:bg-red-100 font-semibold rounded-xl text-[14px] transition-all disabled:opacity-50"
                        >
                            {deleting ? 'Deleting…' : 'Delete'}
                        </button>
                    )}
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            disabled={saving || deleting}
                            className="px-5 py-3 bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] font-semibold rounded-xl text-[14px] transition-all disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving || deleting}
                            className="px-6 py-3 bg-[#C6FF00] hover:bg-[#b8f000] active:scale-[0.98] text-[#1d1d1f] font-bold rounded-xl text-[14px] transition-all shadow-sm disabled:opacity-50"
                        >
                            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Event'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
