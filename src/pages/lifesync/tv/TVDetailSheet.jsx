import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import useLifeSyncGamepadInput from '../../../hooks/useLifeSyncGamepadInput'
import useControllerSupportEnabled from '../../../hooks/useControllerSupportEnabled'
import { XBOX_GAMEPAD_BUTTONS } from '../../../lib/lifeSyncControllerInput'
import {
    MotionDiv,
    lifeSyncDetailSheetEnterInitial,
    lifeSyncDetailSheetEnterAnimate,
    lifeSyncDetailSheetExitVariant,
    lifeSyncDetailSheetMainTransition,
    lifeSyncDetailBackdropFadeTransition,
    lifeSyncDetailOverlayFadeTransition,
} from '../../../lib/lifesyncMotion'

/**
 * item shape:
 * {
 *   type: 'anime' | 'manga' | 'hentai',
 *   title: string,
 *   imageUrl: string,
 *   description?: string,
 *   badge?: string,          // e.g. "EP 5" or "Ch 12"
 *   chips?: string[],        // e.g. ['TV', 'Ongoing']
 *   navigateTo: string,      // route path to navigate to on confirm
 *   navigateState?: object,  // optional state for navigate()
 * }
 */
export function TVDetailSheet({ item, onClose, onExitTV }) {
    const navigate = useNavigate()
    const controllerEnabled = useControllerSupportEnabled()
    // 0 = "Watch/Read" button focused, 1 = "Cancel" button focused
    // Component is keyed by item identity at the call site, so this always starts at 0
    const [actionFocus, setActionFocus] = useState(0)

    const handlers = useMemo(() => ({
        [XBOX_GAMEPAD_BUTTONS.DPAD_UP]: () => setActionFocus(0),
        [XBOX_GAMEPAD_BUTTONS.DPAD_DOWN]: () => setActionFocus(1),
        [XBOX_GAMEPAD_BUTTONS.A]: () => {
            if (actionFocus === 0) {
                // Navigate to content and exit TV mode
                navigate(item.navigateTo, item.navigateState ? { state: item.navigateState } : undefined)
                onExitTV()
            } else {
                onClose()
            }
        },
        [XBOX_GAMEPAD_BUTTONS.B]: () => onClose(),
        [XBOX_GAMEPAD_BUTTONS.START]: () => onExitTV(),
    }), [actionFocus, item, navigate, onClose, onExitTV])

    useLifeSyncGamepadInput({
        enabled: controllerEnabled && Boolean(item),
        handlers,
    })

    if (!item) return null

    const ctaLabel = item.type === 'manga' ? 'Read' : item.type === 'hentai' ? 'Watch' : 'Watch'

    return (
        <MotionDiv
            className="absolute inset-0 z-20 flex items-end sm:items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={lifeSyncDetailOverlayFadeTransition}
            onClick={onClose}
        >
            {/* Backdrop */}
            <MotionDiv
                className="absolute inset-0 bg-black/75 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={lifeSyncDetailBackdropFadeTransition}
            />

            {/* Sheet */}
            <MotionDiv
                className="relative z-10 flex h-dvh w-full max-w-5xl flex-col overflow-hidden rounded-none bg-[#111116] sm:h-auto sm:max-h-[80vh] sm:rounded-3xl"
                initial={lifeSyncDetailSheetEnterInitial}
                animate={lifeSyncDetailSheetEnterAnimate}
                exit={lifeSyncDetailSheetExitVariant}
                transition={lifeSyncDetailSheetMainTransition}
                onClick={e => e.stopPropagation()}
            >
                {/* Hero section */}
                <div className="relative flex-shrink-0">
                    {/* Blurred backdrop */}
                    {item.imageUrl && (
                        <div className="absolute inset-0 overflow-hidden">
                            <img
                                src={item.imageUrl}
                                alt=""
                                className="h-full w-full scale-110 object-cover opacity-40 blur-2xl"
                                referrerPolicy="no-referrer"
                            />
                        </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#111116]/60 to-[#111116]" />

                    <div className="relative flex min-h-[240px] items-end gap-8 p-8 sm:min-h-[300px] sm:p-10">
                        {/* Poster */}
                        {item.imageUrl && (
                            <div className="hidden shrink-0 overflow-hidden rounded-2xl shadow-2xl sm:block" style={{ width: 180, aspectRatio: '2/3' }}>
                                <img
                                    src={item.imageUrl}
                                    alt=""
                                    className="h-full w-full object-cover"
                                    referrerPolicy="no-referrer"
                                />
                            </div>
                        )}

                        {/* Info */}
                        <div className="min-w-0 flex-1 pb-2">
                            {/* Chips */}
                            {item.chips?.length > 0 && (
                                <div className="mb-3 flex flex-wrap gap-2">
                                    {item.chips.map((chip, i) => (
                                        <span key={i} className="rounded-lg bg-white/10 px-3 py-1 text-[13px] font-semibold text-white/80 backdrop-blur-sm">
                                            {chip}
                                        </span>
                                    ))}
                                </div>
                            )}

                            <h2 className="line-clamp-3 text-[36px] font-black leading-tight tracking-tight text-white sm:text-[44px]">
                                {item.title}
                            </h2>

                            {item.badge && (
                                <p className="mt-2 text-[16px] font-semibold text-[var(--mx-color-c6ff00)]">
                                    {item.badge}
                                </p>
                            )}

                            {item.description && (
                                <p className="mt-3 line-clamp-3 text-[14px] leading-relaxed text-white/60 sm:text-[15px]">
                                    {item.description}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-3 px-8 pb-10 pt-2 sm:flex-row sm:px-10 sm:pb-12">
                    {/* Watch/Read button */}
                    <button
                        type="button"
                        onClick={() => {
                            navigate(item.navigateTo, item.navigateState ? { state: item.navigateState } : undefined)
                            onExitTV()
                        }}
                        className={`flex min-h-[64px] flex-1 items-center justify-center gap-3 rounded-2xl text-[18px] font-black transition-all ${
                            actionFocus === 0
                                ? 'bg-[var(--mx-color-c6ff00)] text-black scale-[1.02] shadow-[0_0_0_4px_rgba(198,255,0,0.3)]'
                                : 'bg-white/10 text-white'
                        }`}
                    >
                        <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                            <path d="M8 5v14l11-7z" />
                        </svg>
                        {ctaLabel}
                        {item.badge && <span className="ml-1 text-[14px] font-semibold opacity-70">{item.badge}</span>}
                    </button>

                    {/* Cancel button */}
                    <button
                        type="button"
                        onClick={onClose}
                        className={`flex min-h-[64px] items-center justify-center rounded-2xl px-10 text-[18px] font-bold transition-all ${
                            actionFocus === 1
                                ? 'bg-white/15 text-white scale-[1.02] ring-2 ring-white/30'
                                : 'bg-white/5 text-white/60'
                        }`}
                    >
                        Cancel
                    </button>
                </div>

                {/* Controller hint */}
                <div className="absolute right-6 top-6 flex items-center gap-2 rounded-xl bg-black/40 px-3 py-2 text-[11px] text-white/50 backdrop-blur-sm">
                    <span className="flex h-5 w-5 items-center justify-center rounded bg-green-600 text-[9px] font-black text-white">A</span>
                    <span>Confirm</span>
                    <span className="ml-2 flex h-5 w-5 items-center justify-center rounded bg-red-600 text-[9px] font-black text-white">B</span>
                    <span>Back</span>
                </div>
            </MotionDiv>
        </MotionDiv>
    )
}
