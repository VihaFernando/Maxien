const GOOGLE_TOKEN_CACHE_KEY = 'maxien_google_provider_token'

const currencyQueryPattern = /^\s*(?:convert\s+)?(\d+(?:\.\d+)?)\s*([a-zA-Z]{3})\s*(?:to|in)\s*([a-zA-Z]{3})\s*$/i

const readCachedGoogleProviderToken = () => {
    try {
        const raw = localStorage.getItem(GOOGLE_TOKEN_CACHE_KEY)
        if (!raw) return null

        const parsed = JSON.parse(raw)
        const token = typeof parsed?.token === 'string' ? parsed.token : null
        const expiresAt = Number(parsed?.expiresAt || 0)

        if (!token) {
            localStorage.removeItem(GOOGLE_TOKEN_CACHE_KEY)
            return null
        }

        if (expiresAt && Date.now() >= expiresAt) {
            localStorage.removeItem(GOOGLE_TOKEN_CACHE_KEY)
            return null
        }

        return token
    } catch {
        try {
            localStorage.removeItem(GOOGLE_TOKEN_CACHE_KEY)
        } catch {
            // ignore cache cleanup failures
        }
        return null
    }
}

const formatCalendarWindow = (event) => {
    const startValue = event?.start?.dateTime || event?.start?.date
    if (!startValue) return 'Calendar event'

    const startDate = new Date(startValue)
    const isAllDay = !event?.start?.dateTime

    if (Number.isNaN(startDate.getTime())) return 'Calendar event'

    if (isAllDay) {
        return startDate.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
        })
    }

    return startDate.toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    })
}

const truncate = (value, maxLength = 72) => {
    if (!value) return ''
    const compact = value.replace(/\s+/g, ' ').trim()
    if (compact.length <= maxLength) return compact
    return `${compact.slice(0, maxLength - 1)}…`
}

const buildNavigationAction = (path, options) => ({ navigate }) => navigate(path, options)

const staticDefinitions = [
    {
        id: 'open-dashboard',
        section: 'Pages',
        label: 'Open Dashboard',
        subtitle: 'Go to your overview and activity',
        keywords: ['dashboard overview home start'],
        badge: 'Page',
        run: buildNavigationAction('/dashboard'),
    },
    {
        id: 'open-tasks',
        section: 'Pages',
        label: 'Open Tasks',
        subtitle: 'View and manage your task list',
        keywords: ['tasks todo checklist work items'],
        badge: 'Page',
        run: buildNavigationAction('/dashboard/tasks'),
    },
    {
        id: 'open-projects',
        section: 'Pages',
        label: 'Open Projects',
        subtitle: 'Browse active and archived projects',
        keywords: ['projects roadmap workspace initiatives'],
        badge: 'Page',
        run: buildNavigationAction('/dashboard/projects'),
    },
    {
        id: 'open-calendar',
        section: 'Pages',
        label: 'Open Calendar',
        subtitle: 'See tasks and Google Calendar events',
        keywords: ['calendar schedule agenda events'],
        badge: 'Page',
        run: buildNavigationAction('/dashboard/calendar'),
    },
    {
        id: 'open-notes',
        section: 'Pages',
        label: 'Open Notes',
        subtitle: 'Capture and organize quick notes',
        keywords: ['notes writing memo rich text'],
        badge: 'Page',
        run: buildNavigationAction('/dashboard/notes'),
    },
    {
        id: 'open-profile',
        section: 'Pages',
        label: 'Open Profile',
        subtitle: 'Review account and profile settings',
        keywords: ['profile account settings user'],
        badge: 'Page',
        run: buildNavigationAction('/dashboard/profile'),
    },
    {
        id: 'open-subscriptions',
        section: 'Pages',
        label: 'Open Subscriptions',
        subtitle: 'Manage recurring subscriptions and renewal dates',
        keywords: ['subscriptions billing recurring payments subscription management'],
        badge: 'Page',
        run: buildNavigationAction('/dashboard/subscriptions'),
    },
    {
        id: 'open-integrations',
        section: 'Integrations',
        label: 'Open Integrations',
        subtitle: 'Manage GitHub and connected services',
        keywords: ['integrations github connections apps profile'],
        badge: 'Page',
        run: buildNavigationAction('/dashboard/profile?tab=integrations'),
    },
    {
        id: 'open-ai-assistant-page',
        section: 'Pages',
        label: 'Open AI Assistant Page',
        subtitle: 'Jump to the full AI assistant workspace',
        keywords: ['ai assistant page copilot chat'],
        badge: 'Page',
        run: buildNavigationAction('/dashboard/ai-assistant'),
    },
    {
        id: 'open-ai-assistant',
        section: 'Commands',
        label: 'Open AI Assistant',
        subtitle: 'Launch the floating AI chat',
        keywords: ['ai assistant chat ask copilot'],
        badge: 'Run',
        run: ({ openAIChat }) => openAIChat(),
    },
    {
        id: 'create-task',
        section: 'Commands',
        label: 'Create Task',
        subtitle: 'Open the new task form',
        keywords: ['create task new task add task todo'],
        badge: 'Run',
        run: buildNavigationAction('/dashboard/tasks?action=create'),
    },
    {
        id: 'create-project',
        section: 'Commands',
        label: 'Create Project',
        subtitle: 'Open the new project form',
        keywords: ['create project new project add project'],
        badge: 'Run',
        run: buildNavigationAction('/dashboard/projects?action=create'),
    },
    {
        id: 'create-calendar-event',
        section: 'Commands',
        label: 'Create Calendar Event',
        subtitle: 'Open the new Google Calendar event form',
        keywords: ['create calendar event schedule meeting google'],
        badge: 'Run',
        run: buildNavigationAction('/dashboard/calendar?action=create-event'),
    },
    {
        id: 'create-note',
        section: 'Commands',
        label: 'Create Note',
        subtitle: 'Open the rich text note editor',
        keywords: ['create note new note write memo'],
        badge: 'Run',
        run: buildNavigationAction('/dashboard/notes?action=create'),
    },
    {
        id: 'browse-notes',
        section: 'Notes',
        label: 'Browse Notes',
        subtitle: 'Review your saved rich text notes',
        keywords: ['notes memo writing rich text'],
        badge: 'Page',
        run: buildNavigationAction('/dashboard/notes'),
    },
]

export const getCommandModifierLabel = () => {
    if (typeof navigator === 'undefined') return 'Ctrl'
    const platform = navigator.platform || navigator.userAgent || ''
    return /Mac|iPhone|iPad|iPod/i.test(platform) ? 'Cmd' : 'Ctrl'
}

export const getGoogleCalendarPaletteToken = async (supabase) => {
    try {
        const { data: { session } } = await supabase.auth.getSession()
        return session?.provider_token || readCachedGoogleProviderToken()
    } catch {
        return readCachedGoogleProviderToken()
    }
}

export const parseCurrencyConversionQuery = (query) => {
    const match = query.match(currencyQueryPattern)
    if (!match) return null

    const amount = Number(match[1])
    if (!Number.isFinite(amount)) return null

    return {
        amount,
        fromCurrency: match[2].toUpperCase(),
        toCurrency: match[3].toUpperCase(),
    }
}

export const fetchCurrencyRate = async ({ fromCurrency, toCurrency, signal } = {}) => {
    const base = String(fromCurrency || '').toUpperCase()
    const target = String(toCurrency || '').toUpperCase()

    if (!base || !target) {
        throw new Error('Missing currency code')
    }

    if (base === target) return 1

    const endpoints = [
        `https://open.er-api.com/v6/latest/${base}`,
        `https://api.exchangerate-api.com/v4/latest/${base}`,
    ]

    let lastError = null

    for (const endpoint of endpoints) {
        try {
            const response = await fetch(endpoint, {
                signal,
                cache: 'no-store',
            })

            if (!response.ok) {
                throw new Error('Currency rate fetch failed')
            }

            const data = await response.json()
            if (data?.result && data.result !== 'success') {
                throw new Error(data?.error || 'Currency provider unavailable')
            }

            const rate = Number(data?.rates?.[target])
            if (!Number.isFinite(rate)) {
                throw new Error('Invalid currency rate')
            }

            return rate
        } catch (error) {
            if (signal?.aborted) throw error
            lastError = error
        }
    }

    throw lastError || new Error('Currency provider unavailable')
}

export const fetchCurrencyConversion = async ({ amount, fromCurrency, toCurrency, signal } = {}) => {
    const rate = await fetchCurrencyRate({ fromCurrency, toCurrency, signal })
    const normalizedAmount = Number(amount)
    if (!Number.isFinite(normalizedAmount)) {
        throw new Error('Invalid amount for conversion')
    }
    return normalizedAmount * rate
}

export const looksLikeCurrencyIntent = (query) => {
    const trimmed = query.trim().toLowerCase()
    if (!trimmed) return false

    if (parseCurrencyConversionQuery(trimmed)) return true

    const compact = trimmed.replace(/\s+/g, '')
    if (/^\d+(?:\.\d+)?[a-z]{3}(to|in)[a-z]{3}$/.test(compact)) return true

    return /\b(to|in)\b/.test(trimmed) && /[a-z]{3}/.test(trimmed) && /\d/.test(trimmed)
}

export const looksLikeMathExpression = (query) => {
    const trimmed = query.trim()
    if (!trimmed) return false
    if (parseCurrencyConversionQuery(trimmed)) return false
    if (!/[+\-*/%^()]/.test(trimmed)) return false
    return /^[\d\s.+\-*/%^()]+$/.test(trimmed)
}

export const formatCommandNumber = (value) => {
    if (typeof value !== 'number') return String(value)
    if (!Number.isFinite(value)) return String(value)

    return new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 6,
    }).format(value)
}

const mapStaticCommands = () => staticDefinitions.map(item => ({
    ...item,
    keywords: [...item.keywords],
}))

const mapTaskCommands = (tasks = []) => tasks.map(task => ({
    id: `task-${task.id}`,
    section: 'Tasks',
    label: task.title || 'Untitled task',
    subtitle: `${task.status || 'Task'}${task.priority ? ` • ${task.priority}` : ''}${task.due_at ? ` • ${new Date(task.due_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : ''}`,
    keywords: [task.title, task.description, task.status, task.priority].filter(Boolean),
    badge: 'Task',
    run: ({ navigate }) => navigate(`/dashboard/tasks?task=${task.id}`),
}))

const mapProjectCommands = (projects = []) => projects.map(project => ({
    id: `project-${project.id}`,
    section: 'Projects',
    label: project.name || 'Untitled project',
    subtitle: `${project.status || 'Project'}${project.description ? ` • ${truncate(project.description, 56)}` : ''}`,
    keywords: [project.name, project.description, project.status].filter(Boolean),
    badge: 'Project',
    run: ({ navigate }) => navigate(`/dashboard/projects?project=${project.id}`),
}))

const mapNoteCommands = (tasks = []) => tasks
    .filter(task => task.description && task.description.trim())
    .map(task => ({
        id: `note-${task.id}`,
        section: 'Notes',
        label: truncate(task.description, 68),
        subtitle: `From task ${task.title || 'Untitled task'}`,
        keywords: [task.title, task.description, 'notes', 'note'].filter(Boolean),
        badge: 'Note',
        run: ({ navigate }) => navigate(`/dashboard/tasks?task=${task.id}`),
    }))

const mapCalendarCommands = (calendarEvents = []) => calendarEvents.map(event => ({
    id: `calendar-${event.id}`,
    section: 'Calendar Events',
    label: event.summary || '(No title)',
    subtitle: formatCalendarWindow(event),
    keywords: [event.summary, event.description, event.location, 'calendar event'].filter(Boolean),
    badge: 'Event',
    run: ({ navigate }) => navigate(`/dashboard/calendar?event=${encodeURIComponent(event.id)}`),
}))

export const buildCommandEntries = ({ tasks = [], projects = [], calendarEvents = [], utilityEntries = [] }) => {
    const entries = [
        ...utilityEntries,
        ...mapStaticCommands(),
        ...mapTaskCommands(tasks),
        ...mapProjectCommands(projects),
        ...mapNoteCommands(tasks),
        ...mapCalendarCommands(calendarEvents),
    ]

    return entries.reduce((groups, entry) => {
        if (!groups[entry.section]) groups[entry.section] = []
        groups[entry.section].push(entry)
        return groups
    }, {})
}