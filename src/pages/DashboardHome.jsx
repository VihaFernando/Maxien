import { useAuth } from "../context/AuthContext"

export default function DashboardHome() {
    const { user } = useAuth()
    const name = user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "there"
    const firstName = name.split(" ")[0]

    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <header className="space-y-2">
                <h2 className="text-[36px] font-bold text-[#1d1d1f] tracking-tight leading-tight">
                    Good morning, <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#1d1d1f] to-[#86868b]">{firstName}</span>.
                </h2>
                <p className="text-[#86868b] text-[19px] font-medium">Here is what is happening with your account today.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                    { label: "Email", value: user?.email, color: "#C6FF00", icon: <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /> },
                    { label: "Status", value: "Verified Client", color: "#22c55e", icon: <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /> },
                    { label: "Member", value: "Premium Tier", color: "#6366f1", icon: <path d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /> }
                ].map((stat, i) => (
                    <div key={i} className="bg-white rounded-[32px] p-8 shadow-sm border border-[#d2d2d7]/50 hover:shadow-xl hover:shadow-black/[0.02] transition-all duration-500 group">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-black/[0.05] transition-transform duration-500 group-hover:scale-110`} style={{ backgroundColor: `${stat.color}15` }}>
                            <svg className="w-6 h-6" fill="none" stroke={stat.color} viewBox="0 0 24 24" strokeWidth={2}>
                                {stat.icon}
                            </svg>
                        </div>
                        <p className="text-[#86868b] text-[13px] font-bold uppercase tracking-widest mb-1">{stat.label}</p>
                        <p className="text-[#1d1d1f] text-[17px] font-bold truncate">{stat.value}</p>
                    </div>
                ))}
            </div>

            <section className="bg-white rounded-[40px] p-10 shadow-sm border border-[#d2d2d7]/50">
                <div className="flex items-center justify-between mb-8">
                    <h3 className="text-[22px] font-bold text-[#1d1d1f]">Fast Actions</h3>
                    <div className="px-4 py-1.5 bg-[#f5f5f7] rounded-full text-[12px] font-bold text-[#86868b]">UPDATED JUST NOW</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                        { title: "Complete your profile", desc: "Update your bio and avatar", action: "Go to Profile" },
                        { title: "Security Checkup", desc: "Review your recent activity", action: "Review" }
                    ].map((item, i) => (
                        <div key={i} className="p-6 rounded-[28px] bg-[#f5f5f7] hover:bg-[#C6FF00]/10 border border-transparent hover:border-[#C6FF00]/20 transition-all duration-300 group cursor-pointer">
                            <h4 className="text-[17px] font-bold text-[#1d1d1f] mb-1">{item.title}</h4>
                            <p className="text-[#86868b] text-[14px] mb-4">{item.desc}</p>
                            <span className="text-[13px] font-bold text-[#1d1d1f] flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                                {item.action} <svg className="w-4 h-4 text-[#C6FF00]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M9 5l7 7-7 7" /></svg>
                            </span>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    )
}