import { useEffect, useMemo, useState } from "react"

const SparkleIcon = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2l2.09 6.26L20 10l-5.91 1.74L12 18l-2.09-6.26L4 10l5.91-1.74L12 2z" />
        <path d="M19 15l1.12 3.38L23.5 19.5l-3.38 1.12L19 24l-1.12-3.38L14.5 19.5l3.38-1.12L19 15z" opacity=".55" />
        <path d="M5 2l.84 2.52L8.5 5.5 5.84 6.34 5 8.86 4.16 6.34 1.5 5.5l2.66-.84L5 2z" opacity=".45" />
    </svg>
)

const SpotlightIcon = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="6.2" />
        <path d="M20 20l-4.35-4.35" />
    </svg>
)

const LifeSyncIcon = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 12a8 8 0 0113.657-5.657M20 12a8 8 0 01-13.657 5.657" />
        <path d="M8 5H4V1M16 19h4v4" />
    </svg>
)

export default function AIShortcutHint({ onOpen, onOpenSpotlight, onOpenLifeSync }) {
    const [isMac] = useState(() => /Mac|iPhone|iPad|iPod/.test(navigator.platform))
    const [activeIndex, setActiveIndex] = useState(0)

    const hints = useMemo(() => {
        const aiShortcut = isMac ? ["⌘", "/"] : ["Alt", "C"]
        const spotlightShortcut = isMac ? ["⌘", "K"] : ["Ctrl", "K"]
        const lifesyncShortcut = []

        return [
            {
                id: "lifesync",
                title: "Introducing LifeSync",
                description: "Manage plugins, OAuth links, and your backend session under Settings → Integrations.",
                actionLabel: "Open Integrations",
                icon: LifeSyncIcon,
                shortcutParts: lifesyncShortcut,
                onClick: onOpenLifeSync ?? (() => {}),
            },
            {
                id: "ai",
                title: "Introducing AI Chat",
                description: "Instantly create tasks, manage projects and take action, all from one command.",
                actionLabel: "Open AI Chat",
                icon: SparkleIcon,
                shortcutParts: aiShortcut,
                onClick: onOpen,
            },
            {
                id: "spotlight",
                title: "Meet Spotlight",
                description: "Jump across pages, run quick actions, and find things fast with Command Palette.",
                actionLabel: "Open Spotlight",
                icon: SpotlightIcon,
                shortcutParts: spotlightShortcut,
                onClick: onOpenSpotlight || onOpen,
            },
        ]
    }, [isMac, onOpen, onOpenSpotlight, onOpenLifeSync])

    useEffect(() => {
        const timer = setInterval(() => {
            setActiveIndex((current) => (current + 1) % hints.length)
        }, 8000)
        return () => clearInterval(timer)
    }, [hints.length])

    const activeHint = hints[activeIndex]
    const ActiveIcon = activeHint.icon

    return (
        <div className="mb-3">
            <div className="rounded-2xl border border-[var(--color-border-soft)] bg-[linear-gradient(180deg,var(--color-surface)_0%,var(--color-surface-muted)_100%)] shadow-sm p-4 text-center">

                <div className="relative min-h-[82px] overflow-hidden">
                    {hints.map((hint, index) => (
                        <div
                            key={hint.id}
                            className={`absolute inset-0 transition-all duration-500 ${activeIndex === index ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1 pointer-events-none"}`}
                        >
                            <p className="mb-1.5 text-[13px] font-bold text-[var(--color-text-primary)] leading-snug">{hint.title}</p>
                            <p className="mb-4 text-[11px] text-[var(--color-text-secondary)] leading-relaxed">{hint.description}</p>
                        </div>
                    ))}
                </div>

                <button
                    onClick={activeHint.onClick}
                    className="group flex w-full items-center justify-between rounded-full border border-[var(--color-border-soft)] bg-[var(--color-surface)] py-2 pl-1.5 pr-2.5 shadow-sm transition-all active:scale-[0.98] hover:bg-[var(--color-surface-muted)]"
                >
                    <div className="flex min-w-0 flex-1 items-center gap-1.5">
                        <ActiveIcon className="h-3.5 w-3.5 flex-shrink-0 text-[var(--color-text-secondary)] transition-colors group-hover:text-[var(--color-text-primary)]" />
                        <span className="truncate text-[11px] font-semibold text-[var(--color-text-primary)] transition-colors">
                            {activeHint.actionLabel}
                        </span>
                    </div>

                    {activeHint.shortcutParts.length > 0 && (
                        <div className="ml-2 flex shrink-0 items-center gap-0.5">
                            {activeHint.shortcutParts.map((key, i) => (
                                <span key={i} className="flex items-center">
                                    <kbd className="inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-[4px] border border-[var(--color-border-soft)] bg-[var(--color-surface-muted)] px-1 text-[9px] font-bold leading-none text-[var(--color-text-primary)] shadow-[0_1px_0_var(--color-border-soft)]">
                                        {key}
                                    </kbd>
                                    {i < activeHint.shortcutParts.length - 1 && (
                                        <span className="mx-0.5 text-[9px] font-medium text-[var(--color-text-secondary)]">+</span>
                                    )}
                                </span>
                            ))}
                        </div>
                    )}
                </button>
            </div>
        </div>
    )
}
