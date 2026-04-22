import { FaCheckSquare, FaChartLine, FaBuilding, FaFolderOpen, FaUsers, FaUserShield } from "react-icons/fa"

export default function WorkplaceSidebar({ workplaceName, activeTab, setActiveTab, counts }) {
    const tabs = [
        { id: "profile", label: "Profile", icon: FaFolderOpen, count: undefined },
        { id: "analytics", label: "Analytics", icon: FaChartLine, count: undefined },
        { id: "departments", label: "Departments", icon: FaBuilding, count: counts?.departments || 0 },
        { id: "projects", label: "Projects", icon: FaFolderOpen, count: counts?.projects || 0 },
        { id: "tasks", label: "Tasks", icon: FaCheckSquare, count: counts?.tasks || 0 },
        { id: "users", label: "Members", icon: FaUsers, count: counts?.members || 0 },
        { id: "roles", label: "Roles", icon: FaUserShield, count: counts?.roles || 0 },
    ]

    return (
        <aside className="lg:sticky lg:top-20 lg:h-fit">
            <div>
                <div className="mb-2 px-1">
                    <p className="text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-widest">{workplaceName || "Workplace"}</p>
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
                                        ? "bg-[var(--mx-color-c6ff00)] border-[var(--mx-color-c3f700)] text-black"
                                        : "bg-[var(--color-surface)] border-[var(--mx-color-e5e5ea)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
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
