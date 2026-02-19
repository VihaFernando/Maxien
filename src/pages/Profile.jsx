import { useState, useEffect } from "react"
import { useAuth } from "../context/AuthContext"
import { supabase } from "../lib/supabase"

export default function Profile() {
    const { user } = useAuth()
    const [fullName, setFullName] = useState("")
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState("")
    const [error, setError] = useState("")

    useEffect(() => {
        if (user) setFullName(user.user_metadata?.full_name || "")
    }, [user])

    const handleSave = async (e) => {
        e.preventDefault()
        setLoading(true)
        setMessage("")
        setError("")
        try {
            const { error: updateError } = await supabase.auth.updateUser({
                data: { full_name: fullName },
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

    const initials = user?.user_metadata?.full_name
        ? user.user_metadata.full_name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
        : user?.email?.[0]?.toUpperCase() || "U"

    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-1000">
             <header className="space-y-2">
                <h2 className="text-[36px] font-bold text-[#1d1d1f] tracking-tight leading-tight">Settings</h2>
                <p className="text-[#86868b] text-[19px] font-medium">Manage your personal information and preferences.</p>
            </header>

            <div className="bg-white rounded-[40px] p-10 shadow-sm border border-[#d2d2d7]/50 space-y-12">
                <section className="flex flex-col md:flex-row gap-10 items-start md:items-center">
                    <div className="relative">
                        <div className="w-32 h-32 rounded-[40px] bg-gradient-to-br from-[#C6FF00] to-[#a8db00] flex items-center justify-center text-[#1d1d1f] text-4xl font-black shadow-2xl shadow-[#C6FF00]/40">
                            {initials}
                        </div>
                        <button className="absolute -bottom-2 -right-2 bg-white rounded-2xl p-3 shadow-xl border border-[#d2d2d7] hover:scale-110 transition-transform">
                            <svg className="w-5 h-5 text-[#1d1d1f]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        </button>
                    </div>
                    <div>
                        <h4 className="text-[22px] font-bold text-[#1d1d1f]">{user?.user_metadata?.full_name || "Guest User"}</h4>
                        <p className="text-[#86868b] text-[15px] font-medium">{user?.email}</p>
                        <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 bg-[#22c55e]/10 text-[#22c55e] rounded-full text-[12px] font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]"></span>
                            VERIFIED ACCOUNT
                        </div>
                    </div>
                </section>

                <div className="h-px bg-[#d2d2d7]/50"></div>

                <form onSubmit={handleSave} className="max-w-xl space-y-8">
                    {error && (
                        <div className="bg-red-50 text-red-600 text-[14px] font-medium px-5 py-4 rounded-[20px] border border-red-100 flex items-center gap-3">
                             <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                            {error}
                        </div>
                    )}
                    {message && (
                        <div className="bg-green-50 text-green-700 text-[14px] font-medium px-5 py-4 rounded-[20px] border border-green-100 flex items-center gap-3">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                            {message}
                        </div>
                    )}

                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[13px] font-bold text-[#1d1d1f] ml-1 uppercase tracking-wider">Full Name</label>
                            <input
                                type="text"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                placeholder="Enter your name"
                                className="w-full px-6 py-4 bg-[#f5f5f7] border-2 border-transparent focus:border-[#C6FF00]/50 focus:bg-white rounded-[20px] text-[16px] text-[#1d1d1f] placeholder-[#86868b] focus:outline-none transition-all duration-300"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[13px] font-bold text-[#1d1d1f] ml-1 uppercase tracking-wider text-opacity-50">Email Address</label>
                            <input
                                type="email"
                                value={user?.email || ""}
                                disabled
                                className="w-full px-6 py-4 bg-[#f5f5f7] border-2 border-transparent rounded-[20px] text-[16px] text-[#86868b] cursor-not-allowed"
                            />
                            <p className="text-[#86868b] text-[12px] font-medium ml-1">Email cannot be changed for security.</p>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="bg-[#1d1d1f] hover:bg-black text-white font-bold py-4 px-10 rounded-2xl text-[15px] transition-all duration-300 shadow-xl shadow-black/10 active:scale-[0.98] disabled:opacity-50"
                    >
                        {loading ? "Updating..." : "Save Preferences"}
                    </button>
                </form>
            </div>
        </div>
    )
}