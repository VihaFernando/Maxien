import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { Command } from 'cmdk'
import { evaluate } from 'mathjs'
import { FaArrowRight, FaBolt, FaCalculator, FaCalendarAlt, FaCheckSquare, FaExchangeAlt, FaFolder, FaSearch, FaStickyNote, FaUser } from 'react-icons/fa'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { fetchGoogleEvents } from '../lib/googleCalendar'
import { buildCommandEntries, fetchCurrencyConversion, formatCommandNumber, getCommandModifierLabel, getGoogleCalendarPaletteToken, looksLikeCurrencyIntent, looksLikeMathExpression, parseCurrencyConversionQuery } from '../lib/commandPalette'

const isMacPlatform = () => {
    if (typeof navigator === 'undefined') return false
    const platform = navigator.platform || navigator.userAgent || ''
    return /Mac|iPhone|iPad|iPod/i.test(platform)
}

const isEditableElement = (target) => {
    if (!(target instanceof HTMLElement)) return false
    const tagName = target.tagName.toLowerCase()
    return tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target.isContentEditable
}

const fuzzyScore = (value, search, keywords = []) => {
    const needle = search.trim().toLowerCase()
    if (!needle) return 1

    const haystack = `${value} ${(keywords || []).join(' ')}`.toLowerCase()
    if (haystack.includes(needle)) {
        return 100 - haystack.indexOf(needle)
    }

    let lastIndex = -1
    let score = 0

    for (const character of needle) {
        const nextIndex = haystack.indexOf(character, lastIndex + 1)
        if (nextIndex === -1) return 0
        score += lastIndex === -1 ? 4 : Math.max(1, 8 - (nextIndex - lastIndex))
        lastIndex = nextIndex
    }

    return score
}

const sectionIconMap = {
    Utilities: FaCalculator,
    Pages: FaSearch,
    Commands: FaBolt,
    Tasks: FaCheckSquare,
    Projects: FaFolder,
    Notes: FaStickyNote,
    Integrations: FaUser,
    'Calendar Events': FaCalendarAlt,
}

export default function GlobalCommandPalette() {
    const { user } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [query, setQuery] = useState('')
    const [tasks, setTasks] = useState([])
    const [projects, setProjects] = useState([])
    const [calendarEvents, setCalendarEvents] = useState([])
    const [currencyEntry, setCurrencyEntry] = useState(null)
    const [currencyError, setCurrencyError] = useState('')
    const [currencyLoading, setCurrencyLoading] = useState(false)
    const modifierLabel = useMemo(() => getCommandModifierLabel(), [])
    const paletteLoadTokenRef = useRef(0)

    const openAIChat = useCallback(() => {
        window.dispatchEvent(new CustomEvent('maxien:open-ai-chat'))
    }, [])

    const closePalette = useCallback(() => {
        setOpen(false)
    }, [])

    const loadDynamicResults = useCallback(async () => {
        const loadToken = ++paletteLoadTokenRef.current

        if (!user?.id) {
            if (paletteLoadTokenRef.current === loadToken) {
                setTasks([])
                setProjects([])
                setCalendarEvents([])
                setLoading(false)
            }
            return
        }

        setLoading(true)

        try {
            const [tasksResponse, projectsResponse, providerToken] = await Promise.all([
                supabase
                    .from('tasks')
                    .select('id, title, description, status, priority, due_at, project_id, created_at')
                    .eq('user_id', user.id)
                    .order('updated_at', { ascending: false })
                    .limit(40),
                supabase
                    .from('projects')
                    .select('id, name, description, status, created_at, target_end_date')
                    .eq('user_id', user.id)
                    .order('updated_at', { ascending: false })
                    .limit(30),
                getGoogleCalendarPaletteToken(supabase),
            ])

            if (paletteLoadTokenRef.current !== loadToken) return

            setTasks(tasksResponse.data || [])
            setProjects(projectsResponse.data || [])

            if (providerToken) {
                const now = new Date()
                const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
                const end = new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59)
                const events = await fetchGoogleEvents(providerToken, start, end)
                if (paletteLoadTokenRef.current !== loadToken) return
                setCalendarEvents((events || []).slice(0, 30))
            } else {
                setCalendarEvents([])
            }
        } catch {
            if (paletteLoadTokenRef.current !== loadToken) return
            setTasks([])
            setProjects([])
            setCalendarEvents([])
        } finally {
            if (paletteLoadTokenRef.current === loadToken) {
                setLoading(false)
            }
        }
    }, [user])

    useEffect(() => {
        const handleKeyDown = (event) => {
            const shortcutPressed = isMacPlatform()
                ? event.metaKey && event.key.toLowerCase() === 'k'
                : event.ctrlKey && event.key.toLowerCase() === 'k'

            if (!shortcutPressed) {
                if (event.key === 'Escape') setOpen(false)
                return
            }

            if (isEditableElement(event.target) && !open) {
                event.preventDefault()
                setOpen(true)
                return
            }

            event.preventDefault()
            setOpen(current => !current)
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [open])

    useEffect(() => {
        const handleOpenPalette = () => {
            setOpen(true)
        }

        window.addEventListener('maxien:open-command-palette', handleOpenPalette)
        return () => window.removeEventListener('maxien:open-command-palette', handleOpenPalette)
    }, [])

    useEffect(() => {
        setOpen(false)
    }, [location.pathname, location.search])

    useEffect(() => {
        if (!open) {
            setQuery('')
            setCurrencyEntry(null)
            setCurrencyError('')
            setCurrencyLoading(false)
            setLoading(false)
        }
    }, [open])

    useEffect(() => {
        if (!open) return
        void loadDynamicResults()
        return () => {
            paletteLoadTokenRef.current += 1
        }
    }, [open, loadDynamicResults])

    const copyToClipboard = useCallback(async (value) => {
        if (!value) return
        try {
            if (navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(value)
            }
        } catch {
            // ignore clipboard failures in palette actions
        }
    }, [])

    const calculationEntry = useMemo(() => {
        const trimmedQuery = query.trim()
        if (!looksLikeMathExpression(trimmedQuery)) return null

        try {
            const result = evaluate(trimmedQuery)
            if (result === null || result === undefined || typeof result === 'function') return null

            const formattedResult = formatCommandNumber(typeof result === 'number' ? result : Number(result))
            const rawResult = typeof result === 'number' && Number.isFinite(result)
                ? formattedResult
                : String(result)

            return {
                id: 'utility-calculation',
                section: 'Utilities',
                label: `= ${rawResult}`,
                subtitle: `Calculation result for ${trimmedQuery}`,
                keywords: [trimmedQuery, rawResult, 'calculate', 'math'],
                badge: 'Calc',
                icon: FaCalculator,
                run: async () => {
                    await copyToClipboard(String(result))
                },
            }
        } catch {
            return null
        }
    }, [copyToClipboard, query])

    useEffect(() => {
        const parsedQuery = parseCurrencyConversionQuery(query.trim())

        if (!open || !parsedQuery) {
            setCurrencyEntry(null)
            setCurrencyError('')
            setCurrencyLoading(false)
            return
        }

        const controller = new AbortController()
        const loadCurrencyConversion = async () => {
            setCurrencyLoading(true)
            setCurrencyError('')

            try {
                const convertedAmount = await fetchCurrencyConversion({
                    amount: parsedQuery.amount,
                    fromCurrency: parsedQuery.fromCurrency,
                    toCurrency: parsedQuery.toCurrency,
                    signal: controller.signal,
                })

                const sourceAmount = formatCommandNumber(parsedQuery.amount)
                const targetAmount = formatCommandNumber(convertedAmount)
                const copyValue = `${targetAmount} ${parsedQuery.toCurrency}`

                setCurrencyEntry({
                    id: 'utility-currency',
                    section: 'Utilities',
                    label: `${targetAmount} ${parsedQuery.toCurrency}`,
                    subtitle: `${sourceAmount} ${parsedQuery.fromCurrency} = ${targetAmount} ${parsedQuery.toCurrency}`,
                    keywords: [query, parsedQuery.fromCurrency, parsedQuery.toCurrency, 'currency', 'convert', targetAmount],
                    badge: 'FX',
                    icon: FaExchangeAlt,
                    run: async () => {
                        await copyToClipboard(copyValue)
                    },
                })
            } catch (error) {
                if (controller.signal.aborted) return
                setCurrencyEntry(null)
                setCurrencyError(error?.message || 'Unable to fetch conversion right now')
            } finally {
                if (!controller.signal.aborted) {
                    setCurrencyLoading(false)
                }
            }
        }

        loadCurrencyConversion()

        return () => controller.abort()
    }, [copyToClipboard, open, query])

    const currencyHintEntry = useMemo(() => {
        const trimmedQuery = query.trim()
        if (!open || !trimmedQuery) return null
        if (currencyLoading) return null
        if (!looksLikeCurrencyIntent(trimmedQuery)) return null
        if (currencyEntry) return null

        const parsedQuery = parseCurrencyConversionQuery(trimmedQuery)
        const subtitle = currencyError
            ? `${currencyError}. Try: 1usd to lkr`
            : parsedQuery
                ? 'Fetching conversion...'
                : 'Try formats: 1usd to lkr, 1 usd to lkr, 1usd in lkr'

        return {
            id: 'utility-currency-hint',
            section: 'Utilities',
            label: 'Currency conversion available',
            subtitle,
            keywords: ['currency convert forex fx exchange rate usd eur lkr inr gbp', trimmedQuery],
            badge: 'FX',
            icon: FaExchangeAlt,
            run: () => { },
        }
    }, [currencyEntry, currencyError, currencyLoading, open, query])

    const utilityEntries = useMemo(() => {
        const entries = []
        if (calculationEntry) entries.push(calculationEntry)
        if (currencyEntry) entries.push(currencyEntry)
        if (currencyHintEntry) entries.push(currencyHintEntry)
        return entries
    }, [calculationEntry, currencyEntry, currencyHintEntry])

    const commandGroups = useMemo(() => buildCommandEntries({ tasks, projects, calendarEvents, utilityEntries }), [tasks, projects, calendarEvents, utilityEntries])

    const executeCommand = useCallback((command) => {
        command.run({ navigate, openAIChat, closePalette, location })
        closePalette()
    }, [navigate, openAIChat, closePalette, location])

    if (!open) return null

    return createPortal(
        <div className="fixed inset-0 z-[120] bg-black/35 backdrop-blur-sm px-4 py-[10vh]" onClick={closePalette}>
            <div
                className="mx-auto w-full max-w-[720px] overflow-hidden rounded-[28px] border border-[var(--color-border-strong)]/70 bg-[var(--color-surface)]/95 shadow-[0_24px_80px_rgba(17,24,39,0.18)]"
                onClick={(event) => event.stopPropagation()}
            >
                <Command
                    label="Global Command Palette"
                    shouldFilter
                    filter={(value, search, keywords) => fuzzyScore(value, search, keywords)}
                    className="flex max-h-[75vh] flex-col"
                >
                    <div className="flex items-center gap-3 border-b border-[var(--mx-color-ececf1)] px-4 py-3.5 sm:px-5">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--mx-color-f5f5f7)] text-[var(--mx-color-1d1d1f)]">
                            <FaSearch className="h-4 w-4" />
                        </div>
                        <Command.Input
                            autoFocus
                            value={query}
                            onValueChange={setQuery}
                            placeholder="Search pages, tasks, projects, notes, events, and commands..."
                            className="h-11 flex-1 border-0 bg-transparent text-[15px] font-medium text-[var(--mx-color-1d1d1f)] outline-none placeholder:text-[var(--mx-color-86868b)]"
                        />
                        <div className="hidden items-center gap-1 rounded-full bg-[var(--mx-color-f5f5f7)] px-2.5 py-1 text-[11px] font-semibold text-[var(--mx-color-86868b)] sm:flex">
                            <span>{modifierLabel}</span>
                            <span>K</span>
                        </div>
                    </div>

                    <Command.List className="max-h-[56vh] overflow-y-auto p-2.5 sm:p-3">
                        <Command.Empty>
                            <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--mx-color-f5f5f7)] text-[var(--mx-color-86868b)]">
                                    <FaSearch className="h-4 w-4" />
                                </div>
                                <p className="text-[14px] font-semibold text-[var(--mx-color-1d1d1f)]">No matching results</p>
                                <p className="max-w-[320px] text-[12px] text-[var(--mx-color-86868b)]">Try a page name, a task title, a project, a note, or a command like create task.</p>
                            </div>
                        </Command.Empty>

                        {loading && (
                            <div className="flex items-center gap-3 rounded-2xl border border-[var(--mx-color-eef0f4)] bg-[var(--mx-color-fafafc)] px-4 py-3 text-[13px] font-medium text-[var(--mx-color-86868b)]">
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                                Loading command results...
                            </div>
                        )}

                        {currencyLoading && (
                            <div className="flex items-center gap-3 rounded-2xl border border-[var(--mx-color-eef0f4)] bg-[var(--mx-color-fafafc)] px-4 py-3 text-[13px] font-medium text-[var(--mx-color-86868b)]">
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                                Converting currency...
                            </div>
                        )}

                        {Object.entries(commandGroups).map(([section, items]) => {
                            if (!items.length) return null
                            const SectionIcon = sectionIconMap[section] || FaSearch

                            return (
                                <Command.Group
                                    key={section}
                                    heading={section}
                                    className="mb-2 rounded-[22px] bg-[var(--mx-color-fbfbfc)] p-1.5 text-[var(--mx-color-86868b)] [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:pt-1 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.18em]"
                                >
                                    {items.map(item => (
                                        (() => {
                                            const ItemIcon = item.icon || SectionIcon

                                            return (
                                                <Command.Item
                                                    key={item.id}
                                                    value={`${item.label} ${item.subtitle} ${item.section}`}
                                                    keywords={item.keywords}
                                                    onSelect={() => executeCommand(item)}
                                                    className="group flex cursor-pointer items-center gap-3 rounded-[18px] px-3 py-3 text-[var(--mx-color-1d1d1f)] outline-none transition-colors data-[selected=true]:bg-[var(--mx-color-eef7d7)]"
                                                >
                                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-surface)] text-[var(--mx-color-1d1d1f)] ring-1 ring-black/5 transition-colors group-data-[selected=true]:bg-[var(--mx-color-c6ff00)]">
                                                        <ItemIcon className="h-4 w-4" />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <p className="truncate text-[13px] font-semibold text-[var(--mx-color-1d1d1f)]">{item.label}</p>
                                                            {item.badge && (
                                                                <span className="rounded-full bg-[var(--color-surface)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--mx-color-86868b)] ring-1 ring-black/5">
                                                                    {item.badge}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {item.subtitle && (
                                                            <p className="truncate pt-0.5 text-[11px] font-medium text-[var(--mx-color-86868b)]">{item.subtitle}</p>
                                                        )}
                                                    </div>
                                                    <FaArrowRight className="h-3.5 w-3.5 shrink-0 text-[var(--mx-color-b0b0b6)] transition-transform group-data-[selected=true]:translate-x-0.5 group-data-[selected=true]:text-[var(--mx-color-1d1d1f)]" />
                                                </Command.Item>
                                            )
                                        })()
                                    ))}
                                </Command.Group>
                            )
                        })}
                    </Command.List>

                    <div className="flex items-center justify-between border-t border-[var(--mx-color-ececf1)] px-4 py-3 text-[11px] font-medium text-[var(--mx-color-86868b)] sm:px-5">
                        <div className="flex items-center gap-4">
                            <span>Search everything</span>
                            <span>Arrow keys to move</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <span>Enter to run</span>
                            <span>Esc to close</span>
                        </div>
                    </div>
                </Command>
            </div>
        </div>,
        document.body,
    )
}