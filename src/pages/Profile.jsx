import { useState, useEffect } from "react"
import { useAuth } from "../context/AuthContext"
import { useLifeSync } from "../context/LifeSyncContext"
import { supabase } from "../lib/supabase"
import { useSearchParams } from "react-router-dom"
import GithubIntegrations from "../components/GithubIntegrations"
import { getAnimeStreamAudio } from "../lib/lifesyncApi"
import {
    isLifeSyncReduceAnimationsEnabled,
    notifyReduceMotionPreferenceChanged,
    writeStoredReduceAnimationsSetting,
} from "../lib/lifeSyncReduceMotion"
import {
    engagementNotificationsSupported,
    readPwaEngagementNotificationsEnabled,
    writePwaEngagementNotificationsEnabled,
} from "../lib/pwaNotifications"
import useTimeoutRegistry from "../hooks/useTimeoutRegistry"
const NAV = [
    {
        id: "profile", label: "Profile",
        icon: <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    },
    {
        id: "security", label: "Security",
        icon: <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    },
    {
        id: "preferences", label: "Preferences",
        icon: <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
    },
    {
        id: "integrations", label: "Integrations",
        icon: (
            <>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 13a5 5 0 00.7 2.5" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 11a5 5 0 01.7 2.5" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.5 12a3.5 3.5 0 016.6-1.4" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.5 12a3.5 3.5 0 01-6.6 1.4" />
            </>
        )
    },
]

const LANG_COLORS = {
    JavaScript: "#f1e05a", TypeScript: "#2b7489", Python: "#3572A5",
    HTML: "#e34c26", CSS: "#563d7c", Rust: "#dea584", Go: "#00ADD8",
    Java: "#b07219", "C++": "#f34b7d", C: "#555555", Ruby: "#701516",
    PHP: "#4F5D95", Swift: "#ffac45", Kotlin: "#A97BFF", Dart: "#00B4AB",
    Shell: "#89e051", Vue: "#41b883", default: "#8b8b8b"
}

export default function Profile() {
    const { user } = useAuth()
    const { lifeSyncUser, lifeSyncUpdatePreferences, refreshLifeSyncPreferencesFromDb } = useLifeSync()
    const [searchParams] = useSearchParams()
    const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "profile")
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState("")
    const [error, setError] = useState("")
    const [imgError, setImgError] = useState(false)
    const [prefMotionBusy, setPrefMotionBusy] = useState(false)
    const [prefsBusy, setPrefsBusy] = useState(false)
    const [engageNotifs, setEngageNotifs] = useState(() => readPwaEngagementNotificationsEnabled())
    const [engageBusy, setEngageBusy] = useState(false)
    const { registerTimeout } = useTimeoutRegistry()

    const [fullName, setFullName] = useState("")
    const [username, setUsername] = useState("")
    const [phone, setPhone] = useState("")
    const [bio, setBio] = useState("")

    useEffect(() => {
        if (user) {
            setFullName(user.user_metadata?.display_name || user.user_metadata?.full_name || "")
            setUsername(user.user_metadata?.username || user.email?.split("@")[0] || "")
            setPhone(user.user_metadata?.phone || "")
            setBio(user.user_metadata?.bio || "")
        }
    }, [user])

    useEffect(() => {
        const nextTab = searchParams.get("tab") || "profile"
        setActiveTab(nextTab)
    }, [searchParams])

    useEffect(() => {
        const onChange = () => setEngageNotifs(readPwaEngagementNotificationsEnabled())
        window.addEventListener("pwa-engagement-notifications-changed", onChange)
        return () => window.removeEventListener("pwa-engagement-notifications-changed", onChange)
    }, [])

    useEffect(() => {
        if (
            readPwaEngagementNotificationsEnabled() &&
            engagementNotificationsSupported() &&
            Notification.permission === "denied"
        ) {
            writePwaEngagementNotificationsEnabled(false)
            setEngageNotifs(false)
        }
    }, [])

    useEffect(() => {
        refreshLifeSyncPreferencesFromDb().catch(() => {})
    }, [refreshLifeSyncPreferencesFromDb])

    /** If another device enabled tips in LifeSync, mirror locally. */
    useEffect(() => {
        if (lifeSyncUser?.preferences?.pwaEngagementNotifications === true) {
            writePwaEngagementNotificationsEnabled(true)
            setEngageNotifs(true)
        }
    }, [lifeSyncUser?.preferences?.pwaEngagementNotifications])

    const handleSave = async (e) => {
        e.preventDefault()
        setLoading(true)
        setMessage("")
        setError("")
        try {
            const { error: updateError } = await supabase.auth.updateUser({
                data: { full_name: fullName, display_name: fullName, username, phone, bio },
            })
            if (updateError) setError(updateError.message)
            else {
                setMessage("Profile updated successfully.")
                registerTimeout(() => setMessage(""), 3000)
            }
        } catch {
            setError("Failed to update profile")
        } finally {
            setLoading(false)
        }
    }

    const initials = fullName
        ? fullName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
        : user?.email?.[0]?.toUpperCase() || "U"

    const firstName = fullName.split(" ")[0] || ""
    const lastName = fullName.split(" ").slice(1).join(" ") || ""

    const avatarUrl = user?.user_metadata?.avatar_url
        || user?.user_metadata?.picture
        || user?.user_metadata?.photo_url
        || null

    const isAppleDevice = (() => {
        if (typeof navigator === "undefined") return false
        const ua = navigator.userAgent || ""
        return /Macintosh|iPhone|iPad|iPod/i.test(ua)
    })()

    return (
        <div className={`animate-in fade-in duration-500 flex min-h-0 w-full flex-1 flex-col ${isAppleDevice ? "overflow-hidden" : "overflow-visible"}`}>

            {/* Page header */}
            <div className="shrink-0 mb-4 px-0.5">
                <h1 className="text-[18px] sm:text-[22px] font-bold text-[#1d1d1f] tracking-tight">Settings</h1>
                <p className="text-[12px] text-[#86868b] mt-0.5">You can find all settings here</p>
            </div>

            {/* Mobile tab bar */}
            <div className="shrink-0 md:hidden -mx-4 px-4 pb-3 mb-3 border-b border-[#e5e5ea] overflow-x-auto hide-scrollbar">
                <div className="flex gap-2 min-w-max">
                    {NAV.map((n) => (
                        <button
                            key={n.id}
                            type="button"
                            onClick={() => setActiveTab(n.id)}
                            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-[12px] font-semibold whitespace-nowrap border transition-colors ${activeTab === n.id
                                ? "bg-[#1d1d1f] text-white border-[#1d1d1f]"
                                : "bg-white text-[#86868b] border-[#e5e5ea] hover:text-[#1d1d1f]"
                                }`}
                        >
                            <svg
                                className={`w-4 h-4 ${activeTab === n.id ? "text-white" : "text-[#86868b]"}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                strokeWidth="1.8"
                            >
                                {n.icon}
                            </svg>
                            <span>{n.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className={`flex min-h-0 flex-1 flex-col gap-5 sm:gap-6 md:flex-row md:items-stretch ${isAppleDevice ? "overflow-hidden" : "overflow-visible"}`}>

                {/* Left sidebar nav */}
                <div className="hidden md:block w-full md:w-[200px] lg:w-[220px] flex-shrink-0 bg-white rounded-[20px] border border-[#d2d2d7]/50 shadow-sm p-3">
                    <p className="text-[10px] font-bold text-[#86868b] uppercase tracking-widest px-3 pt-1 pb-2">Account</p>
                    <div className="space-y-0.5">
                        {NAV.map(n => (
                            <button
                                key={n.id}
                                onClick={() => setActiveTab(n.id)}
                                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all duration-150 ${activeTab === n.id
                                    ? "bg-[#f5f5f7] text-[#1d1d1f] font-semibold"
                                    : "text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f] font-medium"
                                    }`}
                            >
                                <svg className={`w-4 h-4 flex-shrink-0 ${activeTab === n.id ? "text-[#1d1d1f]" : "text-[#86868b]"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                                    {n.icon}
                                </svg>
                                <span className="text-[13px]">{n.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Main content */}
                <div className={`flex min-h-0 min-w-0 flex-1 flex-col ${isAppleDevice ? "overflow-hidden" : "overflow-visible"}`}>
                    <div className={`min-h-0 flex-1 pr-0.5 ${isAppleDevice ? "overflow-y-auto overscroll-contain hide-scrollbar" : "overflow-visible"}`}>
                        {activeTab === "profile" && (
                            <div className="bg-white rounded-[20px] sm:rounded-[24px] border border-[#d2d2d7]/50 shadow-sm overflow-hidden">

                                {/* Section header */}
                                <div className="px-6 sm:px-8 pt-6 pb-4 border-b border-[#f0f0f0]">
                                    <h2 className="text-[16px] font-bold text-[#1d1d1f]">Profile Information</h2>
                                </div>

                                {/* Cover banner + avatar */}
                                <div className="relative px-3 pt-3">
                                    {/* Cover */}
                                    <div className="h-[90px] sm:h-[110px] bg-gradient-to-br from-[#f0f9d4] via-[#e2f5a0] to-[#d4edff] relative overflow-hidden rounded-xl">
                                        <div className="absolute inset-0 bg-gradient-to-r from-[#C6FF00]/20 via-transparent to-[#a8d8ff]/30"></div>
                                        <div className="absolute -top-8 -right-8 w-48 h-48 rounded-full bg-[#C6FF00]/20 blur-3xl"></div>
                                        <div className="absolute bottom-0 left-24 w-32 h-32 rounded-full bg-white/30 blur-2xl"></div>
                                        <button className="absolute bottom-3 right-4 flex items-center gap-1.5 bg-white/80 backdrop-blur-sm text-[#1d1d1f] text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-white/60 hover:bg-white transition-all shadow-sm">
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                            Edit Cover
                                        </button>
                                    </div>

                                    {/* Avatar circle */}
                                    <div className="absolute left-1/2 -translate-x-1/2 bottom-0 translate-y-1/2">
                                        <div className="relative">
                                            {avatarUrl && !imgError ? (
                                                <img
                                                    src={avatarUrl}
                                                    alt="Avatar"
                                                    referrerPolicy="no-referrer"
                                                    className="w-[80px] h-[80px] sm:w-[92px] sm:h-[92px] rounded-full object-cover border-4 border-white shadow-lg"
                                                    onError={() => setImgError(true)}
                                                />
                                            ) : (
                                                <div className="w-[80px] h-[80px] sm:w-[92px] sm:h-[92px] rounded-full bg-gradient-to-br from-[#C6FF00] to-[#a8db00] border-4 border-white shadow-lg flex items-center justify-center text-[#1d1d1f] text-[22px] font-black">
                                                    {initials}
                                                </div>
                                            )}
                                            <button className="absolute bottom-0.5 right-0.5 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-md border border-[#d2d2d7]/60 hover:scale-110 transition-transform">
                                                <svg className="w-3 h-3 text-[#1d1d1f]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Spacer for avatar overflow */}
                                <div className="h-10"></div>

                                {/* Profile details form */}
                                <div className="px-4 sm:px-6 pb-5">
                                    <div className="border border-[#e5e5ea] rounded-2xl px-5 py-4">
                                        <div className="mb-3">
                                            <h3 className="text-[15px] font-bold text-[#1d1d1f]">Profile Details</h3>
                                            <p className="text-[12px] text-[#86868b] mt-0.5">Enter your basic personal information for identification and contact purposes</p>
                                        </div>

                                        {error && (
                                            <div className="mb-4 bg-red-50 text-red-600 text-[12px] font-medium px-4 py-3 rounded-xl border border-red-100 flex items-center gap-2">
                                                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                                {error}
                                            </div>
                                        )}
                                        {message && (
                                            <div className="mb-4 bg-green-50 text-green-700 text-[12px] font-medium px-4 py-3 rounded-xl border border-green-100 flex items-center gap-2">
                                                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                                {message}
                                            </div>
                                        )}

                                        <form onSubmit={handleSave} className="space-y-3">
                                            {/* Row 1: First Name + Last Name */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-[11px] font-semibold text-[#1d1d1f] mb-1.5 uppercase tracking-wide">First Name</label>
                                                    <input
                                                        type="text"
                                                        value={firstName}
                                                        onChange={(e) => setFullName(e.target.value + (lastName ? " " + lastName : ""))}
                                                        placeholder="First name"
                                                        className="w-full px-3.5 py-2.5 bg-[#f5f5f7] border border-transparent focus:border-[#C6FF00]/60 focus:bg-white rounded-xl text-[13px] text-[#1d1d1f] placeholder-[#86868b] focus:outline-none transition-all duration-200"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[11px] font-semibold text-[#1d1d1f] mb-1.5 uppercase tracking-wide">Last Name</label>
                                                    <input
                                                        type="text"
                                                        value={lastName}
                                                        onChange={(e) => setFullName((firstName ? firstName + " " : "") + e.target.value)}
                                                        placeholder="Last name"
                                                        className="w-full px-3.5 py-2.5 bg-[#f5f5f7] border border-transparent focus:border-[#C6FF00]/60 focus:bg-white rounded-xl text-[13px] text-[#1d1d1f] placeholder-[#86868b] focus:outline-none transition-all duration-200"
                                                    />
                                                </div>
                                            </div>

                                            {/* Row 2: Username */}
                                            <div>
                                                <label className="block text-[11px] font-semibold text-[#1d1d1f] mb-1.5 uppercase tracking-wide">Username</label>
                                                <input
                                                    type="text"
                                                    value={username}
                                                    onChange={(e) => setUsername(e.target.value)}
                                                    placeholder="username"
                                                    className="w-full sm:w-1/2 px-3.5 py-2.5 bg-[#f5f5f7] border border-transparent focus:border-[#C6FF00]/60 focus:bg-white rounded-xl text-[13px] text-[#1d1d1f] placeholder-[#86868b] focus:outline-none transition-all duration-200"
                                                />
                                            </div>

                                            {/* Row 3: Email Address */}
                                            <div>
                                                <label className="block text-[11px] font-semibold text-[#1d1d1f] mb-1.5 uppercase tracking-wide">Email Address</label>
                                                <input
                                                    type="email"
                                                    value={user?.email || ""}
                                                    disabled
                                                    className="w-full px-3.5 py-2.5 bg-[#f5f5f7] border border-transparent rounded-xl text-[13px] text-[#86868b] cursor-not-allowed"
                                                />
                                                <p className="text-[11px] text-[#86868b] mt-1">Email cannot be changed for security reasons.</p>
                                            </div>

                                            {/* Row 4: Phone */}
                                            <div>
                                                <label className="block text-[11px] font-semibold text-[#1d1d1f] mb-1.5 uppercase tracking-wide">Phone</label>
                                                <input
                                                    type="tel"
                                                    value={phone}
                                                    onChange={(e) => setPhone(e.target.value)}
                                                    placeholder="+1 000 000 0000"
                                                    className="w-full sm:w-1/2 px-3.5 py-2.5 bg-[#f5f5f7] border border-transparent focus:border-[#C6FF00]/60 focus:bg-white rounded-xl text-[13px] text-[#1d1d1f] placeholder-[#86868b] focus:outline-none transition-all duration-200"
                                                />
                                            </div>

                                            {/* Row 5: Bio */}
                                            <div>
                                                <label className="block text-[11px] font-semibold text-[#1d1d1f] mb-1.5 uppercase tracking-wide">Bio</label>
                                                <textarea
                                                    value={bio}
                                                    onChange={(e) => setBio(e.target.value)}
                                                    rows={2}
                                                    placeholder="Tell us about yourself"
                                                    className="w-full px-3.5 py-2.5 bg-[#f5f5f7] border border-transparent focus:border-[#C6FF00]/60 focus:bg-white rounded-xl text-[13px] text-[#1d1d1f] placeholder-[#86868b] focus:outline-none transition-all duration-200 resize-none"
                                                />
                                            </div>

                                            {/* Save button */}
                                            <div className="flex justify-end pt-1">
                                                <button
                                                    type="submit"
                                                    disabled={loading}
                                                    className="bg-[#1d1d1f] hover:bg-black text-white font-semibold py-2.5 px-7 rounded-xl text-[13px] transition-all duration-200 shadow-sm active:scale-[0.98] disabled:opacity-50"
                                                >
                                                    {loading ? "Saving..." : "Save Changes"}
                                                </button>
                                            </div>
                                        </form>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === "security" && (
                            <div className="bg-white rounded-[20px] sm:rounded-[24px] border border-[#d2d2d7]/50 shadow-sm overflow-hidden">
                                <div className="px-6 sm:px-8 pt-6 pb-4 border-b border-[#f0f0f0]">
                                    <h2 className="text-[16px] font-bold text-[#1d1d1f]">Security</h2>
                                </div>
                                <div className="px-6 sm:px-8 py-10 flex flex-col items-center justify-center gap-3 text-center">
                                    <div className="w-12 h-12 rounded-2xl bg-[#f5f5f7] flex items-center justify-center">
                                        <svg className="w-6 h-6 text-[#86868b]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                    </div>
                                    <p className="text-[13px] font-semibold text-[#1d1d1f]">Security settings coming soon</p>
                                    <p className="text-[12px] text-[#86868b]">Password and 2FA management will be available here.</p>
                                </div>
                            </div>
                        )}

                        {activeTab === "preferences" && (
                            <div className="space-y-5 sm:space-y-6">
                                <div className="bg-white rounded-[20px] sm:rounded-[24px] border border-[#d2d2d7]/50 shadow-sm overflow-hidden">
                                    <div className="px-6 sm:px-8 pt-6 pb-4 border-b border-[#f0f0f0]">
                                        <h2 className="text-[16px] font-bold text-[#1d1d1f]">Preferences</h2>
                                        <p className="mt-0.5 text-[12px] text-[#86868b]">
                                            App preferences apply immediately. LifeSync preferences sync only when your account is connected.
                                        </p>
                                    </div>

                                    <div className="px-6 sm:px-8 py-5">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="min-w-0">
                                                <p className="text-[12px] font-bold text-[#86868b] uppercase tracking-widest">App</p>
                                                <p className="mt-1 text-[13px] font-semibold text-[#1d1d1f]">Reduce animations</p>
                                                <p className="mt-1 text-[12px] leading-relaxed text-[#86868b]">
                                                    Turns off transitions and decorative motion app-wide for less CPU/GPU use and a calmer UI.
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                disabled={prefMotionBusy}
                                                role="switch"
                                                aria-checked={isLifeSyncReduceAnimationsEnabled(lifeSyncUser?.preferences)}
                                                onClick={async () => {
                                                    const next = !isLifeSyncReduceAnimationsEnabled(lifeSyncUser?.preferences)
                                                    if (!lifeSyncUser) {
                                                        writeStoredReduceAnimationsSetting(next)
                                                        notifyReduceMotionPreferenceChanged()
                                                        return
                                                    }
                                                    setPrefMotionBusy(true)
                                                    setError("")
                                                    try {
                                                        await lifeSyncUpdatePreferences({ reduceAnimations: next })
                                                    } catch (e) {
                                                        setError(e?.message || "Could not save preference")
                                                    } finally {
                                                        setPrefMotionBusy(false)
                                                    }
                                                }}
                                                className={`relative mt-0.5 h-6 w-11 flex-shrink-0 rounded-full transition-colors ${isLifeSyncReduceAnimationsEnabled(lifeSyncUser?.preferences) ? "bg-[#C6FF00]" : "bg-[#d2d2d7]"} disabled:opacity-50`}
                                            >
                                                <span
                                                    className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${isLifeSyncReduceAnimationsEnabled(lifeSyncUser?.preferences) ? "translate-x-5" : ""}`}
                                                />
                                            </button>
                                        </div>

                                        <div className="mt-6 flex items-start justify-between gap-4 border-t border-[#f5f5f7] pt-6">
                                            <div className="min-w-0">
                                                <p className="text-[13px] font-semibold text-[#1d1d1f]">Tips & reminders</p>
                                                <p className="mt-1 text-[12px] leading-relaxed text-[#86868b]">
                                                    Occasional nudges for manga, anime, and Steam wishlist deals. They only
                                                    appear while Maxien has an open tab and your browser allows notifications.
                                                </p>
                                                {!engagementNotificationsSupported() && (
                                                    <p className="mt-2 text-[12px] text-amber-700">
                                                        Notifications are not available in this browser.
                                                    </p>
                                                )}
                                                {engagementNotificationsSupported() && Notification.permission === "denied" && (
                                                    <p className="mt-2 text-[12px] text-amber-700">
                                                        Notifications are blocked for this site — change it in browser or OS
                                                        settings to turn this on.
                                                    </p>
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                disabled={engageBusy || !engagementNotificationsSupported()}
                                                role="switch"
                                                aria-checked={engageNotifs}
                                                onClick={async () => {
                                                    if (!engagementNotificationsSupported()) return
                                                    const next = !engageNotifs
                                                    if (!next) {
                                                        writePwaEngagementNotificationsEnabled(false)
                                                        setEngageNotifs(false)
                                                        setError("")
                                                        setEngageBusy(true)
                                                        try {
                                                            if (lifeSyncUser) {
                                                                await lifeSyncUpdatePreferences({
                                                                    pwaEngagementNotifications: false,
                                                                })
                                                            }
                                                        } catch (e) {
                                                            setError(e?.message || "Could not turn off reminders")
                                                        } finally {
                                                            setEngageBusy(false)
                                                        }
                                                        return
                                                    }
                                                    setEngageBusy(true)
                                                    setError("")
                                                    try {
                                                        let perm = Notification.permission
                                                        if (perm === "default") {
                                                            perm = await Notification.requestPermission()
                                                        }
                                                        if (perm === "granted") {
                                                            setError("")
                                                            writePwaEngagementNotificationsEnabled(true)
                                                            setEngageNotifs(true)
                                                            if (lifeSyncUser) {
                                                                await lifeSyncUpdatePreferences({
                                                                    pwaEngagementNotifications: true,
                                                                })
                                                            }
                                                        } else {
                                                            writePwaEngagementNotificationsEnabled(false)
                                                            setEngageNotifs(false)
                                                            setError(
                                                                "Notifications are blocked. Enable them in your browser or system settings for this site.",
                                                            )
                                                        }
                                                    } catch (e) {
                                                        setError(e?.message || "Could not enable reminders")
                                                    } finally {
                                                        setEngageBusy(false)
                                                    }
                                                }}
                                                className={`relative mt-0.5 h-6 w-11 flex-shrink-0 rounded-full transition-colors ${engageNotifs ? "bg-[#C6FF00]" : "bg-[#d2d2d7]"} disabled:opacity-50`}
                                                title={
                                                    !engagementNotificationsSupported()
                                                        ? "Not supported in this browser"
                                                        : undefined
                                                }
                                            >
                                                <span
                                                    className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${engageNotifs ? "translate-x-5" : ""}`}
                                                />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white rounded-[20px] sm:rounded-[24px] border border-[#d2d2d7]/50 shadow-sm overflow-hidden">
                                    <div className="px-6 sm:px-8 pt-6 pb-4 border-b border-[#f0f0f0] flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="min-w-0">
                                            <p className="text-[12px] font-bold text-[#86868b] uppercase tracking-widest">LifeSync</p>
                                            <h3 className="mt-1 text-[15px] font-bold text-[#1d1d1f]">LifeSync preferences</h3>
                                            <p className="mt-0.5 text-[12px] text-[#86868b]">
                                                NSFW access, MangaDex language filtering, and default anime audio.
                                            </p>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            {lifeSyncUser ? (
                                                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700">
                                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                                    Connected
                                                </span>
                                            ) : (
                                                <>
                                                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#e5e5ea] bg-[#f5f5f7] px-3 py-1 text-[11px] font-bold text-[#86868b]">
                                                        Not connected
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setActiveTab("integrations")}
                                                        className="text-[12px] font-semibold text-[#1d1d1f] bg-[#f5f5f7] hover:bg-[#ebebed] px-3 py-2 rounded-xl border border-[#e5e5ea] whitespace-nowrap"
                                                    >
                                                        Connect LifeSync
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <ul className="divide-y divide-[#f5f5f7]">
                                        <li className="px-6 sm:px-8 py-5">
                                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                                <div className="min-w-0">
                                                    <p className="text-[13px] font-semibold text-[#1d1d1f]">NSFW content</p>
                                                    <p className="mt-1 text-[12px] leading-relaxed text-[#86868b]">
                                                        Allow mature catalog areas (e.g. Hentai Ocean, NSFW manga sources) when those plugins are enabled.
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    disabled={prefsBusy || !lifeSyncUser}
                                                    role="switch"
                                                    aria-checked={Boolean(lifeSyncUser?.preferences?.nsfwContentEnabled)}
                                                    onClick={async () => {
                                                        if (!lifeSyncUser) return
                                                        const next = !lifeSyncUser?.preferences?.nsfwContentEnabled
                                                        setPrefsBusy(true)
                                                        setError("")
                                                        try {
                                                            await lifeSyncUpdatePreferences({ nsfwContentEnabled: next })
                                                        } catch (e) {
                                                            setError(e?.message || "Could not save preference")
                                                        } finally {
                                                            setPrefsBusy(false)
                                                        }
                                                    }}
                                                    className={`relative h-6 w-11 flex-shrink-0 self-end rounded-full transition-colors sm:self-auto ${lifeSyncUser?.preferences?.nsfwContentEnabled ? "bg-[#C6FF00]" : "bg-[#d2d2d7]"} disabled:opacity-50`}
                                                    title={!lifeSyncUser ? "Connect LifeSync under Integrations to edit" : undefined}
                                                >
                                                    <span
                                                        className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${lifeSyncUser?.preferences?.nsfwContentEnabled ? "translate-x-5" : ""}`}
                                                    />
                                                </button>
                                            </div>
                                        </li>
                                        <li className="px-6 sm:px-8 py-5">
                                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                                <div className="min-w-0">
                                                    <p className="text-[13px] font-semibold text-[#1d1d1f]">English manga only</p>
                                                    <p className="mt-1 text-[12px] leading-relaxed text-[#86868b]">
                                                        In LifeSync Manga, only list and search titles that have English chapter releases (MangaDex).
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    disabled={prefsBusy || !lifeSyncUser}
                                                    role="switch"
                                                    aria-checked={lifeSyncUser?.preferences?.mangaEnglishReleasesOnly !== false}
                                                    onClick={async () => {
                                                        if (!lifeSyncUser) return
                                                        const next = !(lifeSyncUser?.preferences?.mangaEnglishReleasesOnly !== false)
                                                        setPrefsBusy(true)
                                                        setError("")
                                                        try {
                                                            await lifeSyncUpdatePreferences({ mangaEnglishReleasesOnly: next })
                                                        } catch (e) {
                                                            setError(e?.message || "Could not save preference")
                                                        } finally {
                                                            setPrefsBusy(false)
                                                        }
                                                    }}
                                                    className={`relative h-6 w-11 flex-shrink-0 self-end rounded-full transition-colors sm:self-auto ${lifeSyncUser?.preferences?.mangaEnglishReleasesOnly !== false ? "bg-[#C6FF00]" : "bg-[#d2d2d7]"} disabled:opacity-50`}
                                                    title={!lifeSyncUser ? "Connect LifeSync under Integrations to edit" : undefined}
                                                >
                                                    <span
                                                        className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${lifeSyncUser?.preferences?.mangaEnglishReleasesOnly !== false ? "translate-x-5" : ""}`}
                                                    />
                                                </button>
                                            </div>
                                        </li>
                                        <li className="px-6 sm:px-8 py-5">
                                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                                <div className="min-w-0">
                                                    <p className="text-[13px] font-semibold text-[#1d1d1f]">Anime default audio</p>
                                                    <p className="mt-1 text-[12px] leading-relaxed text-[#86868b]">
                                                        Prefer subtitled (Japanese) or dubbed streams when the catalog offers both.
                                                    </p>
                                                </div>
                                                <div
                                                    className="inline-flex shrink-0 self-end rounded-xl border border-[#e5e5ea] bg-[#f5f5f7] p-0.5 sm:self-auto"
                                                    role="group"
                                                    aria-label="Default anime audio"
                                                    title={!lifeSyncUser ? "Connect LifeSync under Integrations to edit" : undefined}
                                                >
                                                    {(["sub", "dub"]).map((mode) => {
                                                        const active = getAnimeStreamAudio(lifeSyncUser?.preferences) === mode
                                                        const disabled = prefsBusy || !lifeSyncUser
                                                        return (
                                                            <button
                                                                key={mode}
                                                                type="button"
                                                                disabled={disabled}
                                                                onClick={async () => {
                                                                    if (!lifeSyncUser) return
                                                                    if (active) return
                                                                    setPrefsBusy(true)
                                                                    setError("")
                                                                    try {
                                                                        await lifeSyncUpdatePreferences({ animeStreamAudio: mode })
                                                                    } catch (e) {
                                                                        setError(e?.message || "Could not save preference")
                                                                    } finally {
                                                                        setPrefsBusy(false)
                                                                    }
                                                                }}
                                                                className={`rounded-lg px-3.5 py-1.5 text-[11px] font-semibold transition-colors ${active
                                                                    ? "bg-white text-[#1d1d1f] shadow-sm"
                                                                    : "text-[#86868b] hover:text-[#1d1d1f]"
                                                                    } disabled:opacity-50`}
                                                            >
                                                                {mode === "sub" ? "Sub" : "Dub"}
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        )}
                        {activeTab === "integrations" && (
                            <div className="min-w-0 rounded-[20px] border border-[#d2d2d7]/50 bg-white shadow-sm sm:rounded-[24px]">
                                <div className="border-b border-[#f0f0f0] px-4 pt-5 pb-4 sm:px-8 sm:pt-6">
                                    <h2 className="text-[16px] font-bold text-[#1d1d1f]">Integrations</h2>
                                    <p className="mt-0.5 text-[12px] text-[#86868b]">
                                        Link LifeSync, GitHub, and external services.
                                    </p>
                                </div>
                                <div className="min-w-0 px-4 py-5 sm:px-8 sm:py-6">
                                    <GithubIntegrations embedded />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
