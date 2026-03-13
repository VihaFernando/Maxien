import { useEffect, useState, useCallback } from "react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../context/AuthContext"
import { FaChevronLeft, FaChevronRight, FaTimes, FaClock, FaFlag, FaPlus, FaCalendarAlt, FaVideo, FaExternalLinkAlt, FaSync } from "react-icons/fa"
import { fetchGoogleEvents, createGoogleEvent, updateGoogleEvent, deleteGoogleEvent } from "../lib/googleCalendar"
import GoogleEventModal from "../components/GoogleEventModal"

export default function Calendar() {
    const { user, connectGoogleCalendar } = useAuth()
    const [tasks, setTasks] = useState([])
    const [types, setTypes] = useState([])
    const [currentDate, setCurrentDate] = useState(new Date())
    const [viewMode, setViewMode] = useState("month") // month, week, day
    const [prevViewMode, setPrevViewMode] = useState("month")
    const [selectedDate, setSelectedDate] = useState(new Date())
    const [showDayOverlay, setShowDayOverlay] = useState(false)
    const [selectedTask, setSelectedTask] = useState(null)
    const [loading, setLoading] = useState(false)

    // Google Calendar state
    const [providerToken, setProviderToken] = useState(null)
    const [googleEvents, setGoogleEvents] = useState([])
    const [gCalLoading, setGCalLoading] = useState(false)
    const [gCalError, setGCalError] = useState(null)
    const [showEventModal, setShowEventModal] = useState(false)
    const [editingGoogleEvent, setEditingGoogleEvent] = useState(null)
    const [selectedGoogleEvent, setSelectedGoogleEvent] = useState(null)
    const [newEventDefaultDate, setNewEventDefaultDate] = useState(null)
    const [calendarConnected, setCalendarConnected] = useState(false)
    const [connectingCalendar, setConnectingCalendar] = useState(false)

    const priorityColors = {
        "Low": "#86868b",
        "Medium": "#3b82f6",
        "High": "#f97316",
        "Urgent": "#ef4444"
    }

    // Utility: Check if task is overdue (not done and past due time)
    const isOverdueTask = (task) => {
        if (!task.due_at || task.status === "Done" || task.status === "Cancelled") return false
        const now = new Date()
        const dueDate = new Date(task.due_at)
        return dueDate < now
    }

    // Utility: Check if task is due soon (within 2 hours and not overdue)
    const isOverdueSoon = (task) => {
        if (!task.due_at || task.status === "Done" || task.status === "Cancelled") return false
        if (isOverdueTask(task)) return false
        const now = new Date()
        const dueDate = new Date(task.due_at)
        const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000)
        return dueDate <= twoHoursFromNow && dueDate > now
    }

    // Sync provider token from Supabase session (needed for Google Calendar API)
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setProviderToken(session?.provider_token || null)
        })
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
            setProviderToken(session?.provider_token || null)
        })
        return () => subscription.unsubscribe()
    }, [])

    useEffect(() => {
        if (!user) return
        fetchTypes()
        fetchTasks()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user])

    const fetchTypes = async () => {
        try {
            const { data } = await supabase
                .from("task_types")
                .select("*")
                .eq("user_id", user.id)
                .eq("status", "Active")
            setTypes(data || [])
        } catch {
            setTypes([])
        }
    }

    const fetchTasks = async () => {
        setLoading(true)
        try {
            const { data } = await supabase
                .from("tasks")
                .select("*")
                .eq("user_id", user.id)
            setTasks(data || [])
        } catch {
            setTasks([])
        } finally {
            setLoading(false)
        }
    }

    // ── Google Calendar ──────────────────────────────────────────────────────

    const loadGoogleEvents = useCallback(async () => {
        if (!providerToken) {
            setGoogleEvents([])
            setCalendarConnected(false)
            return
        }
        setGCalLoading(true)
        setGCalError(null)
        try {
            // Fetch a ±1 month window around the current view so all views have data
            const start = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
            const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 2, 0, 23, 59, 59)
            const events = await fetchGoogleEvents(providerToken, start, end)
            setGoogleEvents(events)
            setCalendarConnected(true)
        } catch (err) {
            setGoogleEvents([])
            setCalendarConnected(false)
            const msg = err?.message || ''
            const isScopeError = /insufficient|permission|scope|forbidden|403/i.test(msg)
            setGCalError(isScopeError ? null : msg)
        } finally {
            setGCalLoading(false)
        }
    }, [providerToken, currentDate])

    useEffect(() => {
        loadGoogleEvents()
    }, [loadGoogleEvents])

    const handleCreateGoogleEvent = async (eventData) => {
        try {
            await createGoogleEvent(providerToken, eventData)
            setShowEventModal(false)
            setNewEventDefaultDate(null)
            await loadGoogleEvents()
        } catch (err) {
            setGCalError('Failed to create event: ' + err.message)
        }
    }

    const handleUpdateGoogleEvent = async (eventData) => {
        try {
            await updateGoogleEvent(providerToken, editingGoogleEvent.id, eventData)
            setEditingGoogleEvent(null)
            setSelectedGoogleEvent(null)
            await loadGoogleEvents()
        } catch (err) {
            setGCalError('Failed to update event: ' + err.message)
        }
    }

    const handleDeleteGoogleEvent = async () => {
        try {
            await deleteGoogleEvent(providerToken, editingGoogleEvent.id)
            setEditingGoogleEvent(null)
            setSelectedGoogleEvent(null)
            await loadGoogleEvents()
        } catch (err) {
            setGCalError('Failed to delete event: ' + err.message)
        }
    }

    const handleConnectCalendar = async () => {
        setGCalError(null)
        setConnectingCalendar(true)
        try {
            const { error } = await connectGoogleCalendar()
            if (error) setGCalError(error.message)
        } catch {
            setGCalError('Failed to connect Google Calendar.')
        } finally {
            setConnectingCalendar(false)
        }
    }

    const getGoogleEventsForDate = (date) => {
        return googleEvents.filter(event => {
            const start = event.start?.dateTime || event.start?.date
            if (!start) return false
            const startDate = new Date(start)
            return startDate.getFullYear() === date.getFullYear() &&
                startDate.getMonth() === date.getMonth() &&
                startDate.getDate() === date.getDate()
        })
    }

    // ────────────────────────────────────────────────────────────────────────

    // Get all days in current month
    const getDaysInMonth = (date) => {
        return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
    }

    // Get first day of month (0-6, where 0 is Sunday)
    const getFirstDayOfMonth = (date) => {
        return new Date(date.getFullYear(), date.getMonth(), 1).getDay()
    }

    // Get tasks for specific date
    const getTasksForDate = (date) => {
        return tasks.filter(task => {
            if (!task.due_at) return false
            const taskDate = new Date(task.due_at)
            return taskDate.getFullYear() === date.getFullYear() &&
                taskDate.getMonth() === date.getMonth() &&
                taskDate.getDate() === date.getDate()
        })
    }

    // Get week dates (Monday to Sunday)
    const getWeekDates = (date) => {
        const d = new Date(date)
        const day = d.getDay()
        const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Adjust to get Monday
        const weekStart = new Date(d.setDate(diff))

        const week = []
        for (let i = 0; i < 7; i++) {
            const date = new Date(weekStart)
            date.setDate(date.getDate() + i)
            week.push(new Date(date))
        }
        return week
    }

    const isSameDay = (d1, d2) => {
        return d1.getFullYear() === d2.getFullYear() &&
            d1.getMonth() === d2.getMonth() &&
            d1.getDate() === d2.getDate()
    }

    const isToday = (date) => isSameDay(date, new Date())

    const formatDateHeader = () => {
        const options = { month: 'long', year: 'numeric' }
        return currentDate.toLocaleDateString('en-US', options)
    }

    // Month View Component
    const MonthView = () => {
        const daysInMonth = getDaysInMonth(currentDate)
        const firstDay = getFirstDayOfMonth(currentDate)
        const days = []

        // Empty cells for days before month starts
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="bg-[#f5f5f7]/50 rounded-xl min-h-[60px] sm:min-h-[80px] md:min-h-[120px]"></div>)
        }

        // Days of month
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
            const dayTasks = getTasksForDate(date)
            const dayGEvents = getGoogleEventsForDate(date)
            const allItems = [
                ...dayTasks.map(t => ({ type: 'task', data: t })),
                ...dayGEvents.map(e => ({ type: 'gcal', data: e }))
            ]
            const isCurrentDay = isToday(date)

            days.push(
                <div
                    key={day}
                    onClick={() => {
                        setPrevViewMode(viewMode)
                        setSelectedDate(date)
                        setViewMode("day")
                        setShowDayOverlay(true)
                    }}
                    className={`rounded-xl p-1 sm:p-2 md:p-3 min-h-[60px] sm:min-h-[80px] md:min-h-[120px] border cursor-pointer transition-all duration-200 ${isCurrentDay
                        ? "bg-[#C6FF00]/10 border-[#C6FF00] ring-1 ring-[#C6FF00]/50"
                        : "bg-white border-[#d2d2d7]/40 hover:border-[#d2d2d7] hover:shadow-sm"
                        }`}
                >
                    <div className={`text-[10px] sm:text-xs md:text-sm font-semibold mb-1 sm:mb-2 text-center sm:text-left ${isCurrentDay ? "text-[#9ecb00]" : "text-[#1d1d1f]"}`}>
                        <span className={isCurrentDay ? "bg-[#C6FF00] text-[#1d1d1f] px-1.5 sm:px-2 py-0.5 rounded-full" : ""}>
                            {day}
                        </span>
                    </div>

                    {/* Mobile dots — blue for tasks, indigo for Google events */}
                    <div className="flex sm:hidden justify-center gap-1 mt-1 flex-wrap px-1">
                        {dayTasks.slice(0, 2).map(task => (
                            <div key={`dot-${task.id}`} className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        ))}
                        {dayGEvents.slice(0, 2).map(ev => (
                            <div key={`gdot-${ev.id}`} className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                        ))}
                        {allItems.length > 4 && <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />}
                    </div>

                    {/* Desktop/Tablet pills — tasks first, then Google events, max 3 total */}
                    <div className="hidden sm:block space-y-1 overflow-hidden">
                        {allItems.slice(0, 3).map(item => item.type === 'task' ? (
                            <div
                                key={item.data.id}
                                onClick={(e) => { e.stopPropagation(); setSelectedTask(item.data) }}
                                className="text-[10px] md:text-xs bg-blue-50 text-blue-700 px-1.5 md:px-2 py-1 rounded-md cursor-pointer hover:bg-blue-100 group relative truncate font-medium transition-colors"
                            >
                                {item.data.title}
                                {isOverdueTask(item.data) && <span className="absolute top-0 right-0 translate-x-1/2 -translate-y-1/2 text-[6px] bg-red-600 text-white rounded-full px-1">!</span>}
                                {!isOverdueTask(item.data) && isOverdueSoon(item.data) && <span className="absolute top-0 right-0 translate-x-1/2 -translate-y-1/2 text-[6px] bg-orange-500 text-white rounded-full px-1">!</span>}
                            </div>
                        ) : (
                            <div
                                key={item.data.id}
                                onClick={(e) => { e.stopPropagation(); setSelectedGoogleEvent(item.data) }}
                                className="text-[10px] md:text-xs bg-indigo-50 text-indigo-700 px-1.5 md:px-2 py-1 rounded-md cursor-pointer hover:bg-indigo-100 truncate font-medium transition-colors flex items-center gap-1"
                            >
                                <FaCalendarAlt className="w-2 h-2 flex-shrink-0 opacity-60" />
                                <span className="truncate">{item.data.summary || '(No title)'}</span>
                            </div>
                        ))}
                        {allItems.length > 3 && (
                            <div className="text-[10px] md:text-xs font-medium text-[#86868b] px-1 md:px-2">
                                +{allItems.length - 3} more
                            </div>
                        )}
                    </div>
                </div>
            )
        }

        return (
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="text-center font-semibold text-[#86868b] text-[10px] sm:text-xs md:text-sm py-2 uppercase tracking-wider">
                        <span className="hidden sm:inline">{day}</span>
                        <span className="sm:hidden">{day.charAt(0)}</span>
                    </div>
                ))}
                {days}
            </div>
        )
    }

    // Week View Component
    const WeekView = () => {
        const weekDates = getWeekDates(currentDate)

        return (
            <div className="overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
                <div className="grid grid-cols-7 gap-2 min-w-[500px] sm:min-w-full">
                    {weekDates.map((date, idx) => {
                        const dayTasks = getTasksForDate(date)
                        const isCurrentDay = isToday(date)

                        return (
                            <div
                                key={idx}
                                onClick={() => {
                                    setPrevViewMode(viewMode)
                                    setSelectedDate(date)
                                    setViewMode("day")
                                    setShowDayOverlay(true)
                                }}
                                className={`rounded-xl p-2 sm:p-4 min-h-[200px] sm:min-h-[300px] border transition-all duration-200 cursor-pointer ${isCurrentDay
                                    ? "bg-[#C6FF00]/10 border-[#C6FF00] ring-1 ring-[#C6FF00]/50"
                                    : "bg-white border-[#d2d2d7]/40 hover:border-[#d2d2d7] hover:shadow-sm"
                                    }`}
                            >
                                <div className="font-semibold mb-3 text-center sm:text-left">
                                    <div className="text-[10px] sm:text-[12px] text-[#86868b] uppercase tracking-wider">
                                        {date.toLocaleDateString('en-US', { weekday: 'short' })}
                                    </div>
                                    <div className={`text-lg sm:text-xl mt-0.5 ${isCurrentDay ? "text-[#9ecb00]" : "text-[#1d1d1f]"}`}>
                                        <span className={isCurrentDay ? "bg-[#C6FF00] text-[#1d1d1f] px-2 py-0.5 rounded-full" : ""}>
                                            {date.getDate()}
                                        </span>
                                    </div>
                                </div>
                                <div className="space-y-1.5 sm:space-y-2">
                                    {dayTasks.map(task => (
                                        <div
                                            key={task.id}
                                            onClick={(e) => { e.stopPropagation(); setSelectedTask(task) }}
                                            className="text-[10px] sm:text-xs bg-blue-50 text-blue-700 p-1.5 sm:p-2 rounded-md hover:bg-blue-100 truncate font-medium transition-colors relative"
                                        >
                                            {task.title}
                                            {isOverdueTask(task) && <span className="absolute top-0 right-0 translate-x-1/2 -translate-y-1/2 text-[6px] bg-red-600 text-white rounded-full px-1">!</span>}
                                            {!isOverdueTask(task) && isOverdueSoon(task) && <span className="absolute top-0 right-0 translate-x-1/2 -translate-y-1/2 text-[6px] bg-orange-500 text-white rounded-full px-1">!</span>}
                                        </div>
                                    ))}
                                    {getGoogleEventsForDate(date).map(gEvent => (
                                        <div
                                            key={gEvent.id}
                                            onClick={(e) => { e.stopPropagation(); setSelectedGoogleEvent(gEvent) }}
                                            className="text-[10px] sm:text-xs bg-indigo-50 text-indigo-700 p-1.5 sm:p-2 rounded-md hover:bg-indigo-100 font-medium transition-colors flex items-center gap-1 min-w-0"
                                        >
                                            <FaCalendarAlt className="w-2.5 h-2.5 flex-shrink-0 opacity-60" />
                                            <span className="truncate">{gEvent.summary || '(No title)'}</span>
                                            {gEvent.conferenceData && <FaVideo className="w-2 h-2 flex-shrink-0 ml-auto text-indigo-400" />}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        )
    }

    // Day View Component
    const DayView = () => {
        const dayTasks = getTasksForDate(selectedDate).sort((a, b) =>
            new Date(a.due_at).getTime() - new Date(b.due_at).getTime()
        )
        const dayGEvents = getGoogleEventsForDate(selectedDate).sort((a, b) =>
            new Date(a.start?.dateTime || a.start?.date).getTime() - new Date(b.start?.dateTime || b.start?.date).getTime()
        )
        const hasAnything = dayTasks.length > 0 || dayGEvents.length > 0

        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                    <h3 className="text-xl sm:text-2xl font-bold text-[#1d1d1f]">
                        {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </h3>
                    {calendarConnected && (
                        <button
                            onClick={() => { setNewEventDefaultDate(selectedDate); setShowEventModal(true) }}
                            className="flex items-center gap-2 px-3 py-2 bg-indigo-500 hover:bg-indigo-600 text-white font-bold rounded-xl text-[13px] transition-all active:scale-95 shadow-sm"
                        >
                            <FaPlus className="w-3 h-3" />
                            <span className="hidden sm:inline">New Event</span>
                        </button>
                    )}
                </div>

                {!hasAnything ? (
                    <div className="text-center py-12 bg-[#f5f5f7]/50 rounded-2xl border border-dashed border-[#d2d2d7] text-[#86868b]">
                        <p className="font-medium">No events scheduled</p>
                        <p className="text-sm mt-1">Take a breather for the day!</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {/* App Tasks */}
                        {dayTasks.map(task => {
                            const taskType = types.find(t => t.id === task.type_id)
                            const due = new Date(task.due_at)

                            return (
                                <div
                                    key={`task-${task.id}`}
                                    onClick={() => setSelectedTask(task)}
                                    className="bg-white rounded-2xl p-3 sm:p-4 border border-[#d2d2d7]/50 cursor-pointer hover:border-[#d2d2d7] hover:shadow-md transition-all duration-200 group relative"
                                >
                                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1">
                                                <h4 className="font-bold text-[#1d1d1f] truncate group-hover:text-blue-600 transition-colors text-sm sm:text-base">{task.title}</h4>
                                                {(isOverdueTask(task) || isOverdueSoon(task)) && (
                                                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${isOverdueTask(task) ? "bg-red-100 text-red-600" : "bg-orange-100 text-orange-600"}`}>{isOverdueTask(task) ? "OVERDUE" : "SOON"}</span>
                                                )}
                                            </div>
                                            {task.description && (
                                                <p className="text-xs sm:text-[13px] text-[#86868b] truncate mt-1">{task.description}</p>
                                            )}
                                            <div className="flex flex-wrap items-center gap-2 mt-3">
                                                {taskType && (
                                                    <span
                                                        className="text-[10px] sm:text-[11px] font-bold px-2 py-1 rounded-md text-[#1d1d1f]"
                                                        style={{ backgroundColor: taskType.color || "#C6FF00" }}
                                                    >
                                                        {taskType.name}
                                                    </span>
                                                )}
                                                <span
                                                    className="flex items-center text-[10px] sm:text-[11px] font-bold px-2 py-1 rounded-md"
                                                    style={{ backgroundColor: `${priorityColors[task.priority]}15`, color: priorityColors[task.priority] }}
                                                >
                                                    <FaFlag className="mr-1.5 w-2.5 h-2.5" />
                                                    {task.priority}
                                                </span>
                                                <span className="flex items-center text-[10px] sm:text-[11px] text-[#86868b] bg-[#f5f5f7] px-2 py-1 rounded-md font-medium">
                                                    <FaClock className="mr-1.5 w-2.5 h-2.5" />
                                                    {due.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                                                </span>
                                            </div>
                                        </div>
                                        <span className={`text-[10px] sm:text-[12px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap w-fit ${task.status === "Done"
                                            ? "bg-green-100 text-green-700"
                                            : task.status === "In Progress"
                                                ? "bg-blue-100 text-blue-700"
                                                : task.status === "Cancelled"
                                                    ? "bg-red-100 text-red-700"
                                                    : "bg-gray-100 text-gray-700"
                                            }`}>
                                            {task.status}
                                        </span>
                                    </div>
                                </div>
                            )
                        })}

                        {/* Google Calendar Events */}
                        {dayGEvents.map(gEvent => {
                            const startDt = gEvent.start?.dateTime || gEvent.start?.date
                            const endDt = gEvent.end?.dateTime || gEvent.end?.date
                            const isAllDay = !gEvent.start?.dateTime
                            const meetLink = gEvent.conferenceData?.entryPoints?.find(ep => ep.entryPointType === 'video')?.uri

                            return (
                                <div
                                    key={`gcal-${gEvent.id}`}
                                    onClick={() => setSelectedGoogleEvent(gEvent)}
                                    className="bg-white rounded-2xl p-3 sm:p-4 border border-indigo-200 cursor-pointer hover:border-indigo-400 hover:shadow-md transition-all duration-200 group"
                                >
                                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <div className="w-5 h-5 bg-indigo-100 rounded-md flex items-center justify-center flex-shrink-0">
                                                    <FaCalendarAlt className="w-2.5 h-2.5 text-indigo-600" />
                                                </div>
                                                <h4 className="font-bold text-[#1d1d1f] truncate group-hover:text-indigo-600 transition-colors text-sm sm:text-base">
                                                    {gEvent.summary || '(No title)'}
                                                </h4>
                                            </div>
                                            {gEvent.description && (
                                                <p className="text-xs sm:text-[13px] text-[#86868b] truncate mt-1 ml-7">{gEvent.description}</p>
                                            )}
                                            <div className="flex flex-wrap items-center gap-2 mt-3 ml-7">
                                                <span className="flex items-center text-[10px] sm:text-[11px] text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md font-medium">
                                                    <FaClock className="mr-1.5 w-2.5 h-2.5" />
                                                    {isAllDay ? 'All day' : `${new Date(startDt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} \u2013 ${new Date(endDt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`}
                                                </span>
                                                {meetLink && (
                                                    <a
                                                        href={meetLink}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold bg-[#00897b] text-white px-2.5 py-1 rounded-md hover:bg-[#00796b] transition-colors"
                                                    >
                                                        <FaVideo className="w-2.5 h-2.5" />
                                                        Join Meet
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                        <span className="text-[10px] sm:text-[12px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap w-fit bg-indigo-50 text-indigo-700">
                                            Google
                                        </span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto">
            <header className="space-y-1 sm:space-y-2 px-2 sm:px-1">
                <h2 className="text-2xl sm:text-[32px] font-bold text-[#1d1d1f] tracking-tight">Calendar</h2>
                <p className="text-[#86868b] text-sm sm:text-[17px] font-medium">
                    View your tasks{calendarConnected ? ' and Google Calendar events' : ''} by date across all views.
                </p>
            </header>

            {/* Integrations */}
            <div className="mx-2 sm:mx-0 px-4 sm:px-5 py-3.5 bg-white border border-[#d2d2d7]/40 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${calendarConnected ? 'bg-[#e8f5e9]' : 'bg-indigo-50'}`}>
                        <FaCalendarAlt className={`w-4 h-4 ${calendarConnected ? 'text-[#2e7d32]' : 'text-indigo-600'}`} />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[14px] font-semibold text-[#1d1d1f]">Google Calendar</p>
                        <p className="text-[12px] text-[#86868b]">{calendarConnected ? 'Connected' : 'Not connected'}</p>
                    </div>
                </div>
                {calendarConnected ? (
                    <span className="px-3 py-1.5 rounded-xl text-[12px] font-bold bg-[#e8f5e9] text-[#2e7d32] w-fit">Connected</span>
                ) : (
                    <button
                        onClick={handleConnectCalendar}
                        disabled={connectingCalendar}
                        className="px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white font-bold rounded-xl text-[13px] transition-all active:scale-95 disabled:opacity-60"
                    >
                        {connectingCalendar ? 'Connecting...' : 'Connect Google Calendar'}
                    </button>
                )}
            </div>

            {/* Google Calendar status banners */}
            {!calendarConnected && user && (
                <div className="mx-2 sm:mx-0 px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-2xl text-[13px] text-indigo-700 flex items-center gap-3">
                    <FaCalendarAlt className="w-4 h-4 flex-shrink-0" />
                    <span><strong>Connect Google Calendar first</strong> to create, edit, delete, and sync Google Calendar events in this view.</span>
                </div>
            )}
            {gCalError && (
                <div className="mx-2 sm:mx-0 px-4 py-3 bg-red-50 border border-red-200 rounded-2xl text-[13px] text-red-700 flex items-center justify-between gap-3">
                    <span><strong>Google Calendar error:</strong> {gCalError}</span>
                    <button onClick={() => setGCalError(null)} className="p-1 hover:bg-red-100 rounded-full transition-colors flex-shrink-0">
                        <FaTimes className="w-3 h-3" />
                    </button>
                </div>
            )}

            {/* Controls & Main Content Area */}
            <div className="bg-white rounded-[24px] sm:rounded-[32px] p-4 sm:p-6 md:p-8 border border-[#d2d2d7]/40 shadow-sm">

                {/* Responsive Header Controls */}
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6 sm:mb-8">

                    {/* Month Nav */}
                    <div className="flex items-center justify-between w-full lg:w-auto bg-[#f5f5f7] rounded-2xl p-1.5">
                        <button
                            onClick={() => {
                                const newDate = new Date(currentDate)
                                newDate.setMonth(newDate.getMonth() - 1)
                                setCurrentDate(newDate)
                            }}
                            className="p-2.5 hover:bg-white rounded-xl transition-all shadow-sm hover:shadow active:scale-95"
                        >
                            <FaChevronLeft className="w-4 h-4 text-[#1d1d1f]" />
                        </button>
                        <h2 className="text-[16px] sm:text-[20px] font-bold text-[#1d1d1f] min-w-[140px] sm:min-w-[200px] text-center tracking-tight">
                            {formatDateHeader()}
                        </h2>
                        <button
                            onClick={() => {
                                const newDate = new Date(currentDate)
                                newDate.setMonth(newDate.getMonth() + 1)
                                setCurrentDate(newDate)
                            }}
                            className="p-2.5 hover:bg-white rounded-xl transition-all shadow-sm hover:shadow active:scale-95"
                        >
                            <FaChevronRight className="w-4 h-4 text-[#1d1d1f]" />
                        </button>
                    </div>

                    {/* Right side: view switcher + Google Calendar actions */}
                    <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                        <div className="flex bg-[#f5f5f7] p-1.5 rounded-2xl flex-1 lg:flex-none">
                            {['month', 'week', 'day'].map((mode) => (
                                <button
                                    key={mode}
                                    onClick={() => setViewMode(mode)}
                                    className={`flex-1 lg:flex-none px-4 sm:px-6 py-2 rounded-xl font-semibold text-[13px] capitalize transition-all duration-200 ${viewMode === mode
                                        ? "bg-[#C6FF00] text-[#1d1d1f] shadow-sm ring-1 ring-black/5"
                                        : "text-[#86868b] hover:text-[#1d1d1f] hover:bg-white/50"
                                        }`}
                                >
                                    {mode}
                                </button>
                            ))}
                        </div>
                        {calendarConnected && (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => { setNewEventDefaultDate(null); setShowEventModal(true) }}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white font-bold rounded-xl text-[13px] transition-all active:scale-95 shadow-sm"
                                >
                                    <FaPlus className="w-3 h-3" />
                                    <span className="hidden sm:inline">New Event</span>
                                </button>
                                <button
                                    onClick={loadGoogleEvents}
                                    disabled={gCalLoading}
                                    title="Sync Google Calendar"
                                    className="p-2.5 bg-[#f5f5f7] hover:bg-[#e8e8ed] rounded-xl transition-all disabled:opacity-50"
                                >
                                    <FaSync className={`w-3.5 h-3.5 text-[#86868b] ${gCalLoading ? 'animate-spin' : ''}`} />
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Calendar Render */}
                <div className="transition-opacity duration-300">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-[#86868b] space-y-4">
                            <div className="w-8 h-8 border-4 border-[#C6FF00] border-t-transparent rounded-full animate-spin"></div>
                            <p className="font-medium text-sm">Loading calendar...</p>
                        </div>
                    ) : viewMode === "month" ? (
                        <MonthView />
                    ) : viewMode === "week" ? (
                        <WeekView />
                    ) : (
                        <DayView />
                    )}
                </div>
            </div>

            {/* Modals / Overlays */}

            {/* Google Event Create / Edit Modal */}
            {(showEventModal || editingGoogleEvent) && (
                <GoogleEventModal
                    event={editingGoogleEvent || null}
                    defaultDate={newEventDefaultDate}
                    onSave={editingGoogleEvent ? handleUpdateGoogleEvent : handleCreateGoogleEvent}
                    onDelete={handleDeleteGoogleEvent}
                    onClose={() => { setShowEventModal(false); setEditingGoogleEvent(null); setNewEventDefaultDate(null) }}
                />
            )}

            {/* Google Event Detail Modal */}
            {selectedGoogleEvent && !editingGoogleEvent && (
                <div className="fixed inset-0 bg-[#1d1d1f]/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 sm:p-4 transition-opacity duration-300">
                    <div className="bg-white rounded-t-[32px] sm:rounded-[32px] p-6 sm:p-8 w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl relative">
                        <div className="flex justify-center sm:hidden mb-4">
                            <div className="w-12 h-1.5 bg-[#d2d2d7] rounded-full" />
                        </div>
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-9 h-9 bg-indigo-500 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <FaCalendarAlt className="w-4 h-4 text-white" />
                                </div>
                                <h2 className="text-xl font-bold text-[#1d1d1f] tracking-tight truncate">
                                    {selectedGoogleEvent.summary || '(No title)'}
                                </h2>
                            </div>
                            <button
                                onClick={() => setSelectedGoogleEvent(null)}
                                className="p-2 bg-[#f5f5f7] hover:bg-[#e8e8ed] rounded-full transition-colors flex-shrink-0 ml-2"
                            >
                                <FaTimes className="w-4 h-4 text-[#86868b]" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {selectedGoogleEvent.description && (
                                <div className="bg-[#f5f5f7]/50 rounded-2xl p-4 border border-[#d2d2d7]/30">
                                    <label className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider mb-1.5 block">Description</label>
                                    <p className="text-sm text-[#1d1d1f] leading-relaxed">{selectedGoogleEvent.description}</p>
                                </div>
                            )}
                            <div className="bg-[#f5f5f7]/50 rounded-2xl p-4 border border-[#d2d2d7]/30">
                                <label className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider mb-1.5 block">Time</label>
                                {selectedGoogleEvent.start?.dateTime ? (
                                    <p className="text-[15px] font-semibold text-[#1d1d1f]">
                                        {new Date(selectedGoogleEvent.start.dateTime).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                        {' \u2013 '}
                                        {new Date(selectedGoogleEvent.end?.dateTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                    </p>
                                ) : (
                                    <p className="text-[15px] font-semibold text-[#1d1d1f]">All day &mdash; {selectedGoogleEvent.start?.date}</p>
                                )}
                                {selectedGoogleEvent.start?.timeZone && (
                                    <p className="text-[12px] text-[#86868b] mt-1">{selectedGoogleEvent.start.timeZone}</p>
                                )}
                            </div>

                            {(() => {
                                const meetLink = selectedGoogleEvent.conferenceData?.entryPoints?.find(ep => ep.entryPointType === 'video')?.uri
                                if (!meetLink) return null
                                return (
                                    <div className="bg-[#e8f5e9] border border-[#81c784] rounded-2xl p-4 flex items-center gap-3">
                                        <div className="w-9 h-9 bg-[#00897b] rounded-xl flex items-center justify-center flex-shrink-0">
                                            <FaVideo className="w-4 h-4 text-white" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[11px] font-bold text-[#2e7d32] uppercase tracking-wider">Google Meet</p>
                                            <a
                                                href={meetLink}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-[13px] text-[#1565c0] underline truncate block"
                                            >
                                                {meetLink}
                                            </a>
                                        </div>
                                        <a
                                            href={meetLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1.5 px-3 py-2 bg-[#00897b] text-white text-[12px] font-bold rounded-xl hover:bg-[#00796b] transition-colors flex-shrink-0"
                                        >
                                            <FaExternalLinkAlt className="w-3 h-3" />
                                            Join
                                        </a>
                                    </div>
                                )
                            })()}
                        </div>

                        <div className="mt-8 pt-6 border-t border-[#d2d2d7]/50 flex justify-between gap-3">
                            <button
                                onClick={() => setSelectedGoogleEvent(null)}
                                className="px-5 py-3 bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] font-semibold rounded-xl text-[14px] transition-all"
                            >
                                Close
                            </button>
                            {calendarConnected && (
                                <button
                                    onClick={() => { setEditingGoogleEvent(selectedGoogleEvent); setSelectedGoogleEvent(null) }}
                                    className="px-6 py-3 bg-indigo-500 hover:bg-indigo-600 text-white font-bold rounded-xl text-[14px] transition-all shadow-sm"
                                >
                                    Edit Event
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Day Overlay Modal */}
            {showDayOverlay && (
                <div className="fixed inset-0 bg-[#1d1d1f]/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-40 sm:p-4 transition-opacity duration-300">
                    <div className="bg-white rounded-t-[32px] sm:rounded-[32px] p-6 sm:p-8 w-full max-w-3xl max-h-[85vh] overflow-y-auto shadow-2xl relative animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 sm:fade-in-20">
                        <div className="flex justify-center sm:hidden mb-4">
                            <div className="w-12 h-1.5 bg-[#d2d2d7] rounded-full"></div>
                        </div>
                        <button
                            onClick={() => { setShowDayOverlay(false); setViewMode(prevViewMode) }}
                            className="absolute top-4 sm:top-6 right-4 sm:right-6 p-2 bg-[#f5f5f7] hover:bg-[#e8e8ed] rounded-full transition-colors"
                        >
                            <FaTimes className="w-4 h-4 text-[#86868b]" />
                        </button>
                        <DayView />
                    </div>
                </div>
            )}

            {/* Task Detail Modal */}
            {selectedTask && (
                <div className="fixed inset-0 bg-[#1d1d1f]/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 sm:p-4 transition-opacity duration-300">
                    <div className="bg-white rounded-t-[32px] sm:rounded-[32px] p-6 sm:p-8 w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl relative animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 sm:fade-in-20">
                        <div className="flex justify-center sm:hidden mb-4">
                            <div className="w-12 h-1.5 bg-[#d2d2d7] rounded-full"></div>
                        </div>

                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl sm:text-[24px] font-bold text-[#1d1d1f] tracking-tight">Task Details</h2>
                            <button
                                onClick={() => setSelectedTask(null)}
                                className="p-2 bg-[#f5f5f7] hover:bg-[#e8e8ed] rounded-full transition-colors"
                            >
                                <FaTimes className="w-4 h-4 text-[#86868b]" />
                            </button>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg sm:text-[20px] font-bold text-[#1d1d1f] leading-snug">{selectedTask.title}</h3>
                                {selectedTask.description && (
                                    <p className="text-sm sm:text-[15px] text-[#86868b] mt-2 leading-relaxed">{selectedTask.description}</p>
                                )}
                            </div>

                            {selectedTask.due_at && (
                                <div className="bg-[#f5f5f7]/50 rounded-2xl p-4 border border-[#d2d2d7]/30">
                                    <label className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider">Due Date & Time</label>
                                    <p className="text-sm sm:text-[15px] font-bold text-[#1d1d1f] mt-1.5">
                                        {new Date(selectedTask.due_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                    </p>
                                    {(isOverdueTask(selectedTask) || isOverdueSoon(selectedTask)) && (
                                        <p className={`mt-2 text-[11px] font-semibold ${isOverdueTask(selectedTask) ? 'text-red-600' : 'text-orange-600'}`}>{isOverdueTask(selectedTask) ? 'OVERDUE' : 'Due soon'}</p>
                                    )}
                                </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                <div className="bg-[#f5f5f7]/50 rounded-2xl p-4 border border-[#d2d2d7]/30">
                                    <label className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider mb-1.5 block">Status</label>
                                    <span className={`inline-block text-[12px] font-bold px-3 py-1 rounded-full ${selectedTask.status === "Done"
                                        ? "bg-green-100 text-green-700"
                                        : selectedTask.status === "In Progress"
                                            ? "bg-blue-100 text-blue-700"
                                            : selectedTask.status === "Cancelled"
                                                ? "bg-red-100 text-red-700"
                                                : "bg-gray-200 text-gray-700"
                                        }`}>
                                        {selectedTask.status}
                                    </span>
                                </div>
                                <div className="bg-[#f5f5f7]/50 rounded-2xl p-4 border border-[#d2d2d7]/30">
                                    <label className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider mb-1.5 block">Priority</label>
                                    <span
                                        className="inline-flex items-center text-[12px] font-bold px-3 py-1 rounded-full"
                                        style={{ backgroundColor: `${priorityColors[selectedTask.priority]}15`, color: priorityColors[selectedTask.priority] }}
                                    >
                                        <FaFlag className="mr-1.5 w-3 h-3" />
                                        {selectedTask.priority}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 pt-6 border-t border-[#d2d2d7]/50">
                            <button
                                onClick={() => setSelectedTask(null)}
                                className="w-full px-6 py-3.5 bg-[#C6FF00] hover:bg-[#b8f000] active:scale-[0.98] text-[#1d1d1f] font-bold rounded-xl transition-all shadow-sm"
                            >
                                Close Details
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}