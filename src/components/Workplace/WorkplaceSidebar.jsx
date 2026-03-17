import { FaCheckSquare, FaFolderOpen, FaTags, FaUsers } from "react-icons/fa"

export default function WorkplaceSidebar({ activeTab, setActiveTab, counts }) {
    const tabs = [
        { id: "profile", label: "Profile", icon: FaFolderOpen, color: "#C6FF00" },
        { id: "tasks", label: "Tasks", icon: FaCheckSquare, count: counts?.tasks || 0 },
        { id: "projects", label: "Projects", icon: FaFolderOpen, count: counts?.projects || 0 },
        { id: "types", label: "Task Types", icon: FaTags, count: counts?.types || 0 },
        { id: "users", label: "Members", icon: FaUsers, count: counts?.members || 0 },
    ]

    return (
        <div className="sticky top-20 bg-white rounded-[22px] border border-[#d2d2d7]/50 shadow-sm p-4">
            <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest mb-4">
                Sections
            </p>
            <div className="space-y-2">
                {tabs.map((tab) => {
                    const Icon = tab.icon
                    const isActive = activeTab === tab.id

                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`w-full flex items-center justify-between px-4 py-3 rounded-[12px] text-[14px] font-semibold transition-all ${isActive
                                    ? "bg-[#C6FF00] text-[#1d1d1f] shadow-sm"
                                    : "text-[#1d1d1f] hover:bg-[#f5f5f7]"
                                }`}
                        >
                            <div className="flex items-center gap-2">
                                <Icon className="w-4 h-4" />
                                {tab.label}
                            </div>
                            {tab.count !== undefined && (
                                <span
                                    className={`text-[12px] font-bold px-2 py-0.5 rounded-full ${isActive
                                            ? "bg-[#1d1d1f]/10 text-[#1d1d1f]"
                                            : "bg-[#f5f5f7] text-[#86868b]"
                                        }`}
                                >
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
