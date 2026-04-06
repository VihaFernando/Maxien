/**
 * Shared page chrome for LifeSync hub routes — matches CategoryHub (soft lavender base + pastel orbs).
 * Framer `MotionConfig` lives in `LifeSyncMotionRoot` (reduced-motion preference applies to portaled modals too).
 */
import { useLocation } from 'react-router-dom'
import {
    lifeSyncPageTransition,
    lifeSyncPageVariants,
    MotionDiv,
} from '../../lib/lifesyncMotion'

/** Wider than `max-w-6xl` so grids use large displays; horizontal padding scales with breakpoint. */
const shellInnerClass =
    'relative mx-auto w-full max-w-[min(100%,88rem)] px-4 pt-5 sm:px-6 sm:pt-6 md:px-8 lg:px-10 lg:pt-7 xl:px-12'

/** Pass `staticInnerChrome` for layouts that own section chrome and only swap an inner `<Outlet />`. */
export function LifeSyncHubPageShell({ children, staticInnerChrome = false }) {
    const { pathname, search } = useLocation()
    const routeKey = `${pathname}${search}`

    return (
        <div className="relative min-h-full overflow-x-hidden bg-transparent pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]">
                <MotionDiv
                    className="pointer-events-none absolute -left-24 top-0 h-[420px] w-[420px] rounded-full bg-[#ddd6fe]/25 blur-3xl"
                    aria-hidden
                    initial={{ opacity: 0.6, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
                />
                <MotionDiv
                    className="pointer-events-none absolute -right-20 top-32 h-[380px] w-[380px] rounded-full bg-[#c4b5fd]/20 blur-3xl"
                    aria-hidden
                    initial={{ opacity: 0.55, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 1.15, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
                />
                <MotionDiv
                    className="pointer-events-none absolute bottom-0 left-1/3 h-[300px] w-[500px] -translate-x-1/2 rounded-full bg-[#fde68a]/18 blur-3xl"
                    aria-hidden
                    initial={{ opacity: 0.5, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
                />
                {staticInnerChrome ? (
                    <div className={shellInnerClass}>{children}</div>
                ) : (
                    <MotionDiv
                        key={routeKey}
                        className={shellInnerClass}
                        initial="initial"
                        animate="animate"
                        variants={lifeSyncPageVariants}
                        transition={lifeSyncPageTransition}
                    >
                        {children}
                    </MotionDiv>
                )}
            </div>
    )
}
