import { useMemo, useState } from 'react'
import { motion as M } from 'framer-motion'
import useLifeSyncGamepadInput from '../../../hooks/useLifeSyncGamepadInput'
import useControllerSupportEnabled from '../../../hooks/useControllerSupportEnabled'
import { XBOX_GAMEPAD_BUTTONS } from '../../../lib/lifeSyncControllerInput'

/**
 * Confirmation popup shown when navigating to the Exit tab.
 * 0 = "Exit" focused, 1 = "Stay" focused.
 * A on Exit → calls onConfirm(); A on Stay / B anywhere → calls onCancel().
 */
export function TVExitConfirmPopup({ onConfirm, onCancel }) {
    const controllerEnabled = useControllerSupportEnabled()
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
                className="w-full max-w-md rounded-3xl bg-[#111116] p-8 shadow-2xl"
                initial={{ scale: 0.92, y: 16, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.92, y: 16, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            >
                {/* Icon */}
                <div className="mb-6 flex justify-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 ring-1 ring-white/10">
                        <svg className="h-7 w-7 text-white/60" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" aria-hidden>
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
                                ? 'bg-white text-black scale-[1.03] shadow-[0_0_0_4px_rgba(255,255,255,0.2)]'
                                : 'bg-white/10 text-white/70'
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
                                ? 'bg-[var(--mx-color-c6ff00)] text-black scale-[1.03] shadow-[0_0_0_4px_rgba(198,255,0,0.25)]'
                                : 'bg-[var(--mx-color-c6ff00)]/15 text-[var(--mx-color-c6ff00)]/80'
                        }`}
                    >
                        Stay
                    </button>
                </div>

                {/* Hint */}
                <p className="mt-5 text-center text-[12px] text-white/25">
                    ←→ to switch · <span className="rounded bg-green-600/80 px-1.5 py-0.5 text-[10px] font-black text-white">A</span> to confirm · <span className="rounded bg-red-600/80 px-1.5 py-0.5 text-[10px] font-black text-white">B</span> to stay
                </p>
            </M.div>
        </M.div>
    )
}
