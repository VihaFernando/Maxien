import { useMemo, useState } from 'react'
import { motion as M } from 'framer-motion'
import useLifeSyncGamepadInput from '../../../hooks/useLifeSyncGamepadInput'
import useControllerSupportEnabled from '../../../hooks/useControllerSupportEnabled'
import { XBOX_GAMEPAD_BUTTONS } from '../../../lib/lifeSyncControllerInput'
import useLifeSyncInputSource from '../../../hooks/useLifeSyncInputSource'
import { tvHintLabel } from '../../../lib/lifeSyncKeyboardGamepad'

/**
 * Confirmation popup shown when navigating to the Exit tab.
 * 0 = "Exit" focused, 1 = "Stay" focused.
 * A on Exit → calls onConfirm(); A on Stay / B anywhere → calls onCancel().
 */
export function TVExitConfirmPopup({ onConfirm, onCancel }) {
    const controllerEnabled = useControllerSupportEnabled()
    const inputSource = useLifeSyncInputSource()
    const [focus, setFocus] = useState(0) // 0=Exit 1=Stay

    const handlers = useMemo(() => ({
        [XBOX_GAMEPAD_BUTTONS.DPAD_LEFT]: () => setFocus(0),
        [XBOX_GAMEPAD_BUTTONS.DPAD_RIGHT]: () => setFocus(1),
        [XBOX_GAMEPAD_BUTTONS.A]: () => { if (focus === 0) onConfirm(); else onCancel() },
        [XBOX_GAMEPAD_BUTTONS.B]: () => onCancel(),
    }), [focus, onConfirm, onCancel])

    useLifeSyncGamepadInput({ enabled: controllerEnabled, handlers })

    return (
        <M.div
            className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
        >
            <M.div
                className="relative w-full max-w-md overflow-hidden rounded-[28px] bg-linear-to-b from-[#14141c] to-[#0c0c12] p-8 shadow-[0_50px_120px_-25px_rgba(0,0,0,0.95)] ring-1 ring-white/10"
                initial={{ scale: 0.92, y: 16, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.92, y: 16, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            >
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-red-400/50 to-transparent" aria-hidden />
                {/* Icon */}
                <div className="mb-6 flex justify-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 ring-1 ring-red-400/25">
                        <svg className="h-7 w-7 text-red-300/80" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                        </svg>
                    </div>
                </div>

                <h2 className="text-center text-[28px] font-black tracking-tight text-white">Exit TV Mode?</h2>
                <p className="mt-2 text-center text-[15px] text-white/50">You'll return to the normal dashboard.</p>

                <div className="mt-8 flex gap-4">
                    {/* Exit button */}
                    <button
                        type="button"
                        onClick={onConfirm}
                        className={`flex min-h-[60px] flex-1 items-center justify-center rounded-2xl text-[17px] font-black transition-all ${
                            focus === 0
                                ? 'bg-red-500 text-white scale-[1.03] shadow-[0_0_0_4px_rgba(239,68,68,0.25),0_16px_40px_-12px_rgba(239,68,68,0.5)]'
                                : 'bg-white/8 text-white/60 ring-1 ring-white/10'
                        }`}
                    >
                        Exit
                    </button>

                    {/* Stay button */}
                    <button
                        type="button"
                        onClick={onCancel}
                        className={`flex min-h-[60px] flex-1 items-center justify-center rounded-2xl text-[17px] font-black transition-all ${
                            focus === 1
                                ? 'bg-(--mx-color-c6ff00) text-black scale-[1.03] shadow-[0_0_0_4px_rgba(198,255,0,0.25),0_16px_40px_-12px_rgba(198,255,0,0.5)]'
                                : 'bg-(--mx-color-c6ff00)/12 text-(--mx-color-c6ff00)/80 ring-1 ring-(--mx-color-c6ff00)/20'
                        }`}
                    >
                        Stay
                    </button>
                </div>

                {/* Hint */}
                <p className="mt-5 text-center text-[12px] text-white/25">
                    ←→ to switch · <span className="rounded bg-green-600/80 px-1.5 py-0.5 text-[10px] font-black text-white">{tvHintLabel('A', inputSource)}</span> to confirm · <span className="rounded bg-red-600/80 px-1.5 py-0.5 text-[10px] font-black text-white">{tvHintLabel('B', inputSource)}</span> to stay
                </p>
            </M.div>
        </M.div>
    )
}
