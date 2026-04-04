    import { FaCheckSquare, FaFolderOpen, FaTags, FaUsers } from "react-icons/fa"

    export default function WorkplaceSidebar({ workplaceName, activeTab, setActiveTab, counts }) {
        const tabs = [
            { id: "profile", label: "Profile", icon: FaFolderOpen, count: undefined },
            { id: "tasks", label: "Tasks", icon: FaCheckSquare, count: counts?.tasks || 0 },
            { id: "projects", label: "Projects", icon: FaFolderOpen, count: counts?.projects || 0 },
            { id: "types", label: "Task Types", icon: FaTags, count: counts?.types || 0 },
            { id: "users", label: "Members", icon: FaUsers, count: counts?.members || 0 },
        ]

        return (
            <aside className="lg:sticky lg:top-20 lg:h-fit">
                <div>
                    <div className="mb-2 px-1">
                        <p className="text-[10px] font-semibold text-[#86868b] uppercase tracking-widest">{workplaceName || "Workplace"}</p>
                    </div>
                    <div className="overflow-x-auto pb-1 -mx-1 px-1 lg:mx-0 lg:px-0">
                        <div className="inline-flex min-w-full gap-2 lg:flex lg:flex-col lg:min-w-0">
                            {tabs.map((tab) => {
                                const Icon = tab.icon
                                const isActive = activeTab === tab.id

                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-semibold whitespace-nowrap border transition-colors ${isActive
                                            ? "bg-[#C6FF00] border-[#c3f700] text-[#1d1d1f]"
                                            : "bg-white border-[#e5e5ea] text-[#4b4b4f]"
                                            }`}
                                    >
                                        <Icon className="w-3.5 h-3.5" />
                                        {tab.label}
                                        {tab.count !== undefined && (
                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-black/10">
                                                {tab.count}
                                            </span>
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </aside>
        )
    }
