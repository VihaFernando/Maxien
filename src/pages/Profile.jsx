import { useState, useEffect } from "react"
import { useAuth } from "../context/AuthContext"
import { supabase } from "../lib/supabase"

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
]

export default function Profile() {
    const { user } = useAuth()
    const [activeTab, setActiveTab] = useState("profile")
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState("")
    const [error, setError] = useState("")
    const [imgError, setImgError] = useState(false)

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
                setTimeout(() => setMessage(""), 3000)
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

    return (
        <div className="animate-in fade-in duration-500 w-full">

            {/* Page header */}
            <div className="mb-4 px-0.5">
                <h1 className="text-[18px] sm:text-[22px] font-bold text-[#1d1d1f] tracking-tight">Settings</h1>
                <p className="text-[12px] text-[#86868b] mt-0.5">You can find all settings here</p>
            </div>

            <div className="flex flex-col md:flex-row gap-5 sm:gap-6 items-start">

                {/* Left sidebar nav */}
                <div className="w-full md:w-[200px] lg:w-[220px] flex-shrink-0 bg-white rounded-[20px] border border-[#d2d2d7]/50 shadow-sm p-3">
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
                <div className="flex-1 min-w-0 min-h-0 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 140px)' }}>
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
                        <div className="bg-white rounded-[20px] sm:rounded-[24px] border border-[#d2d2d7]/50 shadow-sm overflow-hidden">
                            <div className="px-6 sm:px-8 pt-6 pb-4 border-b border-[#f0f0f0]">
                                <h2 className="text-[16px] font-bold text-[#1d1d1f]">Preferences</h2>
                            </div>
                            <div className="px-6 sm:px-8 py-10 flex flex-col items-center justify-center gap-3 text-center">
                                <div className="w-12 h-12 rounded-2xl bg-[#f5f5f7] flex items-center justify-center">
                                    <svg className="w-6 h-6 text-[#86868b]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                                </div>
                                <p className="text-[13px] font-semibold text-[#1d1d1f]">Preferences coming soon</p>
                                <p className="text-[12px] text-[#86868b]">Theme, notifications and app preferences will be here.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
