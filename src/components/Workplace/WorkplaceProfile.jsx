import { Link } from "react-router-dom"
import { FaChevronLeft } from "react-icons/fa"

export default function WorkplaceProfile({ workplace, loading }) {
    return (
        <div className="animate-in fade-in duration-500 mb-6">
            <div className="flex items-center gap-3 mb-5">
                <Link
                    to="/dashboard/workplaces"
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-[12px] bg-white border border-[#d2d2d7]/60 text-[#1d1d1f] font-semibold text-[13px] hover:bg-[#f5f5f7] transition-colors"
                >
                    <FaChevronLeft className="w-3 h-3" />
                    Workplaces
                </Link>
            </div>

            <div className="bg-white rounded-[22px] border border-[#d2d2d7]/50 shadow-sm overflow-hidden">
                {/* Banner */}
                <div className="relative h-40 bg-gradient-to-r from-[#C6FF00] via-[#b8f000] to-[#a8e000] overflow-hidden">
                    {workplace?.bannerUrl ? (
                        <img
                            src={workplace.bannerUrl}
                            alt="Workplace banner"
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-r from-[#C6FF00] via-[#b8f000] to-[#a8e000]" />
                    )}
                </div>

                {/* Profile Content */}
                <div className="px-6 py-5">
                    <div>
                        {loading ? (
                            <>
                                <div className="h-8 w-48 bg-[#f5f5f7] rounded-[8px] mb-2 animate-pulse" />
                                <div className="h-5 w-96 bg-[#f5f5f7] rounded-[6px] mb-2 animate-pulse" />
                            </>
                        ) : (
                            <>
                                <h1 className="text-[28px] sm:text-[32px] font-bold text-[#1d1d1f] tracking-tight">
                                    {workplace?.name || "…"}
                                </h1>
                                {workplace?.description && (
                                    <p className="text-[14px] text-[#86868b] mt-2 max-w-2xl leading-relaxed">
                                        {workplace.description}
                                    </p>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
