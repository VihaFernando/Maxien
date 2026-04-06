import { useCallback, useEffect, useRef, useState } from 'react'
import { lifesyncFetch } from '../../lib/lifesyncApi'

/** MAL `my_list_status.status` values (API v2). */
export const MAL_LIST_STATUS_OPTIONS = [
  { value: 'watching', label: 'Watching' },
  { value: 'completed', label: 'Completed' },
  { value: 'on_hold', label: 'On hold' },
  { value: 'dropped', label: 'Dropped' },
  { value: 'plan_to_watch', label: 'Plan to watch' },
]

/**
 * @param {unknown} res — PATCH `/api/anime/mylist/:id` JSON body
 * @returns {Record<string, unknown>}
 */
export function malListStatusPatchFromResponse(res) {
  if (!res || typeof res !== 'object') return {}
  const o = /** @type {Record<string, unknown>} */ (res)
  const nested = o.my_list_status
  if (nested && typeof nested === 'object') return /** @type {Record<string, unknown>} */ (nested)
  const ls = o.list_status
  if (ls && typeof ls === 'object') return /** @type {Record<string, unknown>} */ (ls)
  if (typeof o.status === 'string') return { status: o.status }
  return o
}

/**
 * Dropdown: updates only `status` on MAL via PATCH (score / episode count stay server-driven).
 * @param {{
 *   malId: string | number | null | undefined
 *   malLinked: boolean
 *   currentStatus?: string | null
 *   variant?: 'light' | 'dark'
 *   onPatched?: (patch: Record<string, unknown>) => void | Promise<void>
 *   className?: string
 *   id?: string
 * }} props
 */
export function MalListStatusControl({
  malId,
  malLinked,
  currentStatus,
  variant = 'light',
  onPatched,
  className = '',
  id,
}) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const msgClearTimerRef = useRef(null)

  useEffect(
    () => () => {
      if (msgClearTimerRef.current != null) {
        window.clearTimeout(msgClearTimerRef.current)
        msgClearTimerRef.current = null
      }
    },
    [],
  )

  const applyStatus = useCallback(
    async (next) => {
      const mid = malId != null ? String(malId).trim() : ''
      if (!malLinked || !/^\d+$/.test(mid) || !next) return
      setBusy(true)
      setMsg('')
      try {
        const res = await lifesyncFetch(`/api/anime/mylist/${encodeURIComponent(mid)}`, {
          method: 'PATCH',
          json: { status: next },
        })
        const patch = malListStatusPatchFromResponse(res)
        await onPatched?.(patch)
        setMsg('Saved.')
        if (msgClearTimerRef.current != null) window.clearTimeout(msgClearTimerRef.current)
        msgClearTimerRef.current = window.setTimeout(() => {
          msgClearTimerRef.current = null
          setMsg('')
        }, 2000)
      } catch (e) {
        setMsg(e?.message || 'Update failed.')
      } finally {
        setBusy(false)
      }
    },
    [malId, malLinked, onPatched],
  )

  const onSelect = useCallback(
    (e) => {
      const v = String(e.target?.value || '').trim()
      if (!v) return
      void applyStatus(v)
    },
    [applyStatus],
  )

  const value = currentStatus && String(currentStatus).trim() ? String(currentStatus).trim() : ''

  /** Mobile: full-width, taller tap target. Desktop (`sm:`): compact inline select. */
  const selectClass =
    variant === 'dark'
      ? [
          'block w-full max-w-none cursor-pointer outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-45',
          'h-11 rounded-xl border border-white/12 bg-black/40 px-3 py-0 pr-9 text-[13px] font-medium leading-none text-white/90',
          'hover:border-white/22 focus:border-white/35 focus:ring-2 focus:ring-white/10',
          'sm:h-8 sm:w-auto sm:max-w-[10rem] sm:rounded-lg sm:px-2 sm:pr-7 sm:text-[12px] sm:focus:ring-1',
        ].join(' ')
      : [
          'block w-full max-w-none cursor-pointer outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-50',
          'h-11 rounded-xl border border-[#d2d2d7] bg-white px-3 py-0 pr-9 text-[13px] font-medium leading-none text-[#1d1d1f]',
          'hover:border-[#b0b0b5] focus:border-[#1d1d1f] focus:ring-2 focus:ring-[#1d1d1f]/10',
          'sm:h-8 sm:w-auto sm:max-w-[10rem] sm:rounded-lg sm:px-2 sm:pr-7 sm:text-[12px] sm:focus:ring-1',
        ].join(' ')

  const msgClass =
    variant === 'dark'
      ? 'mt-2 text-[11px] text-emerald-300/90 sm:mt-1.5 sm:text-[10px]'
      : 'mt-2 text-[11px] text-emerald-700 sm:mt-1.5 sm:text-[10px]'

  return (
    <div className={className}>
      <label htmlFor={id} className="sr-only">
        MyAnimeList list status
      </label>
      <select
        id={id}
        className={selectClass}
        value={value}
        onChange={onSelect}
        disabled={!malLinked || busy}
      >
        {!value ? (
          <option value="" disabled className={variant === 'dark' ? 'bg-[#111]' : ''}>
            Choose status…
          </option>
        ) : null}
        {MAL_LIST_STATUS_OPTIONS.map((opt) => (
          <option
            key={opt.value}
            value={opt.value}
            className={variant === 'dark' ? 'bg-[#111] text-white' : ''}
          >
            {opt.label}
          </option>
        ))}
      </select>
      {msg ? <p className={msgClass}>{msg}</p> : null}
    </div>
  )
}
