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

export default function AIShortcutHint({ onOpen, onOpenSpotlight }) {
    const [isMac] = useState(() => /Mac|iPhone|iPad|iPod/.test(navigator.platform))
    const [activeIndex, setActiveIndex] = useState(0)

    const hints = useMemo(() => {
        const aiShortcut = isMac ? ["⌘", "/"] : ["Alt", "C"]
        const spotlightShortcut = isMac ? ["⌘", "K"] : ["Ctrl", "K"]

        return [
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
    }, [isMac, onOpen, onOpenSpotlight])

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
            <div className="rounded-2xl bg-gradient-to-b from-white to-[#f0f4ff] border border-[#e2e8f5] shadow-sm p-4 text-center">

                <div className="relative min-h-[82px] overflow-hidden">
                    {hints.map((hint, index) => (
                        <div
                            key={hint.id}
                            className={`absolute inset-0 transition-all duration-500 ${activeIndex === index ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1 pointer-events-none"}`}
                        >
                            <p className="text-[13px] font-bold text-[#1a1f36] leading-snug mb-1.5">{hint.title}</p>
                            <p className="text-[11px] text-[#6b7280] leading-relaxed mb-4">{hint.description}</p>
                        </div>
                    ))}
                </div>

                <button
                    onClick={activeHint.onClick}
                    className="w-full flex items-center justify-between bg-white hover:bg-[#f8faff] border border-[#dde3f0] hover:border-[#b8c4e8] rounded-full pl-1.5 pr-2.5 py-2 transition-all active:scale-[0.98] shadow-sm group"
                >
                    <div className="flex min-w-0 flex-1 items-center gap-1.5">
                        <ActiveIcon className="w-3.5 h-3.5 text-[#9ca3af] group-hover:text-[#4f5882] transition-colors flex-shrink-0" />
                        <span className="truncate text-[11px] font-semibold text-[#4f5882] group-hover:text-[#1a1f36] transition-colors">
                            {activeHint.actionLabel}
                        </span>
                    </div>

                    <div className="ml-2 flex shrink-0 items-center gap-0.5">
                        {activeHint.shortcutParts.map((key, i) => (
                            <span key={i} className="flex items-center">
                                <kbd className="inline-flex items-center justify-center h-[17px] min-w-[17px] px-1 bg-[#eef1f8] border border-[#d2d8ea] rounded-[4px] text-[9px] font-bold text-[#4f5882] shadow-[0_1px_0_#c8cedf] leading-none">
                                    {key}
                                </kbd>
                                {i < activeHint.shortcutParts.length - 1 && (
                                    <span className="text-[9px] text-[#9ca3af] mx-0.5 font-medium">+</span>
                                )}
                            </span>
                        ))}
                    </div>
                </button>
            </div>
        </div>
    )
}
