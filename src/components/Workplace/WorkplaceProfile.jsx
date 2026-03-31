import { useState, useEffect, useMemo } from "react"
import { Link } from "react-router-dom"
import { FaChevronLeft, FaEdit, FaTimes, FaArrowRight, FaUsers, FaFolderOpen, FaCheckCircle, FaClock, FaCrown } from "react-icons/fa"
import { convertGoogleDriveLink } from "../../lib/imageUtils"
import { updateWorkplace } from "../../lib/workplaces"
import { getUsersByIds, getDisplayName, getUsername } from "../../lib/users"

export default function WorkplaceProfile({ workplace, loading, isOwner, onRefresh, setMessage, setError, members = [], projects = [], tasks = [], currentMembership = null }) {
    const [isEditing, setIsEditing] = useState(false)
    const [editLoading, setEditLoading] = useState(false)
    const [imageLoadError, setImageLoadError] = useState(false)
    const [userMap, setUserMap] = useState({})
    const [editForm, setEditForm] = useState({
        name: workplace?.name || "",
        description: workplace?.description || "",
        bannerUrl: workplace?.banner_url || "",
    })

    // Load user data for members
    useEffect(() => {
        const loadUsers = async () => {
            // Get accepted members only
            const acceptedMembers = members.filter(m => m.status === "accepted")
            if (!acceptedMembers.length) return

            const memberIds = acceptedMembers.map(m => m.user_id)
            try {
                const users = await getUsersByIds(memberIds)
                setUserMap(users.reduce((acc, u) => ({ ...acc, [u.id]: u }), {}))
            } catch (e) {
                // ignore
            }
        }

        loadUsers()
    }, [members])

    // Calculate days active
    const getDaysActive = () => {
        if (!workplace?.created_at) return "Recently"
        const created = new Date(workplace.created_at)
        const now = new Date()
        const days = Math.floor((now - created) / (1000 * 60 * 60 * 24))
        if (days === 0) return "Today"
        if (days === 1) return "1 day ago"
        if (days < 30) return `${days} days ago`
        if (days < 365) return `${Math.floor(days / 30)} months ago`
        return `${Math.floor(days / 365)} years ago`
    }

    // Get accepted members
    const acceptedMembers = useMemo(() => {
        return members.filter(m => m.status === "accepted")
    }, [members])

    // Reset image error and update edit form when workplace changes
    useEffect(() => {
        setImageLoadError(false)
        setEditForm({
            name: workplace?.name || "",
            description: workplace?.description || "",
            bannerUrl: workplace?.banner_url || "",
        })
    }, [workplace?.id, workplace?.banner_url])

    const handleEdit = async (e) => {
        e.preventDefault()
        setError?.("")
        setMessage?.("")

        if (!editForm.name.trim()) {
            setError?.("Workplace name is required.")
            return
        }

        setEditLoading(true)
        try {
            await updateWorkplace({
                workplaceId: workplace.id,
                name: editForm.name.trim(),
                description: editForm.description?.trim() || null,
                bannerUrl: editForm.bannerUrl?.trim() || null,
            })

            setMessage?.("Workplace updated successfully.")
            setIsEditing(false)
            setImageLoadError(false)
            await onRefresh?.()
            setTimeout(() => setMessage?.(""), 2000)
        } catch (e) {
            setError?.(e?.message || "Failed to update workplace.")
        } finally {
            setEditLoading(false)
        }
    }

    const handleCancel = () => {
        setEditForm({
            name: workplace?.name || "",
            description: workplace?.description || "",
            bannerUrl: workplace?.banner_url || "",
        })
        setIsEditing(false)
    }

    if (isEditing) {
        return (
            <div className="animate-in fade-in duration-300 mb-8">
                <div className="bg-white rounded-2xl shadow-sm border border-[#e5e5ea] p-8">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h2 className="text-2xl font-bold text-[#1d1d1f]">Edit Workplace</h2>
                            <p className="text-[13px] text-[#86868b] mt-1">Update your workspace information</p>
                        </div>
                        <button
                            onClick={handleCancel}
                            className="p-2.5 hover:bg-[#f5f5f7] rounded-lg transition-all duration-200 text-[#86868b] hover:text-[#1d1d1f]"
                        >
                            <FaTimes className="w-5 h-5" />
                        </button>
                    </div>

                    <form onSubmit={handleEdit} className="space-y-6">
                        <div>
                            <label className="text-[12px] font-semibold text-[#1d1d1f] uppercase tracking-wide mb-3 block">
                                Workspace Name
                            </label>
                            <input
                                type="text"
                                value={editForm.name}
                                onChange={(e) => setEditForm((v) => ({ ...v, name: e.target.value }))}
                                placeholder="Enter workspace name"
                                className="w-full px-4 py-3.5 bg-[#f5f5f7] rounded-xl border border-transparent focus:border-[#C6FF00] focus:bg-white outline-none text-[14px] font-medium transition-all duration-200"
                            />
                        </div>

                        <div>
                            <label className="text-[12px] font-semibold text-[#1d1d1f] uppercase tracking-wide mb-3 block">
                                Description
                            </label>
                            <textarea
                                value={editForm.description}
                                onChange={(e) => setEditForm((v) => ({ ...v, description: e.target.value }))}
                                placeholder="Add a description for your workspace (optional)"
                                rows={5}
                                className="w-full px-4 py-3.5 bg-[#f5f5f7] rounded-xl border border-transparent focus:border-[#C6FF00] focus:bg-white outline-none text-[14px] font-medium resize-none transition-all duration-200"
                            />
                        </div>

                        <div>
                            <label className="text-[12px] font-semibold text-[#1d1d1f] uppercase tracking-wide mb-3 block">
                                Banner Image (Google Drive Link)
                            </label>
                            <input
                                type="text"
                                value={editForm.bannerUrl}
                                onChange={(e) => setEditForm((v) => ({ ...v, bannerUrl: e.target.value }))}
                                placeholder="https://drive.google.com/file/d/..."
                                className="w-full px-4 py-3.5 bg-[#f5f5f7] rounded-xl border border-transparent focus:border-[#C6FF00] focus:bg-white outline-none text-[14px] font-medium transition-all duration-200"
                            />
                            <div className="mt-3 p-3.5 bg-[#C6FF00]/5 border border-[#C6FF00]/20 rounded-lg">
                                <p className="text-[12px] text-[#1d1d1f] font-medium leading-relaxed">
                                    ✨ <strong>Tip:</strong> Open the Google Drive file → Click "Share" → Change to "Anyone with the link" → Copy the link
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={handleCancel}
                                className="flex-1 py-3.5 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] text-[#1d1d1f] font-semibold text-[14px] hover:bg-[#ebebf0] transition-all duration-200 hover:shadow-sm"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={editLoading}
                                className="flex-1 py-3.5 rounded-xl bg-[#C6FF00] hover:bg-[#b8f000] disabled:opacity-50 disabled:hover:bg-[#C6FF00] text-[#1d1d1f] font-bold text-[14px] transition-all duration-200 hover:shadow-lg transform hover:scale-105 active:scale-95"
                            >
                                {editLoading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <div className="w-4 h-4 border-2 border-[#1d1d1f]/20 border-t-[#1d1d1f] rounded-full animate-spin" />
                                        Saving...
                                    </span>
                                ) : (
                                    "Save Changes"
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )
    }

    return (
        <div className="animate-in fade-in duration-300 mb-8">
            {/* Back Button */}
            <div className="mb-6">
                <Link
                    to="/dashboard/workplaces"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/50 backdrop-blur-sm border border-[#e5e5ea] text-[#1d1d1f] font-medium text-[13px] hover:bg-white hover:shadow-sm transition-all duration-200 group"
                >
                    <FaChevronLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
                    Workplaces
                </Link>
            </div>

            {/* Main Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-[#e5e5ea] overflow-hidden transition-all duration-300 hover:shadow-md">
                {/* Banner Section */}
                <div className="relative h-48 bg-gradient-to-br from-[#C6FF00] via-[#b8f000] to-[#a8e000] overflow-hidden group">
                    {workplace?.banner_url && !imageLoadError ? (
                        <>
                            <img
                                src={convertGoogleDriveLink(workplace.banner_url)}
                                alt="Workspace banner"
                                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                onError={() => {
                                    setImageLoadError(true)
                                    console.error("❌ Failed to load banner image from:", convertGoogleDriveLink(workplace.banner_url))
                                }}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent" />
                        </>
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-[#C6FF00] via-[#b8f000] to-[#a8e000] flex items-center justify-center relative overflow-hidden">
                            {/* Animated gradient background */}
                            <div className="absolute inset-0 opacity-20">
                                <div className="absolute top-0 left-1/4 w-96 h-96 bg-white rounded-full blur-3xl animate-pulse" />
                                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-black rounded-full blur-3xl animate-pulse" />
                            </div>
                            {workplace?.banner_url && imageLoadError && (
                                <div className="text-center px-6 relative z-10">
                                    <p className="text-[14px] font-bold text-[#1d1d1f] mb-1">
                                        Image couldn't load
                                    </p>
                                    <p className="text-[12px] text-[#1d1d1f]/60">
                                        Make sure the file is shared with "Anyone with the link"
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Content Section */}
                <div className="px-8 py-8">
                    <div className="flex items-start justify-between gap-8 mb-8">
                        <div className="flex-1 min-w-0">
                            {loading ? (
                                <div className="space-y-3">
                                    <div className="h-10 w-64 bg-[#f5f5f7] rounded-lg animate-pulse" />
                                    <div className="h-6 w-full max-w-2xl bg-[#f5f5f7] rounded-lg animate-pulse" />
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center gap-3 mb-2">
                                        <h1 className="text-4xl font-bold text-[#1d1d1f] leading-tight break-words">
                                            {workplace?.name || "Untitled Workspace"}
                                        </h1>
                                        {currentMembership?.role === "owner" && (
                                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#C6FF00]/10 border border-[#C6FF00]/30 rounded-lg">
                                                <FaCrown className="w-3.5 h-3.5 text-[#C6FF00]" />
                                                <span className="text-[11px] font-bold text-[#C6FF00] uppercase tracking-wide">Owner</span>
                                            </div>
                                        )}
                                        {currentMembership?.role === "member" && (
                                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#86868b]/10 border border-[#86868b]/30 rounded-lg">
                                                <FaUsers className="w-3.5 h-3.5 text-[#86868b]" />
                                                <span className="text-[11px] font-bold text-[#86868b] uppercase tracking-wide">Member</span>
                                            </div>
                                        )}
                                    </div>
                                    {workplace?.description && (
                                        <p className="text-[15px] text-[#86868b] leading-relaxed mt-3">
                                            {workplace.description}
                                        </p>
                                    )}
                                    {!workplace?.description && isOwner && (
                                        <p className="text-[14px] text-[#86868b]/60 italic mt-3">
                                            No description yet. Click Edit to add one.
                                        </p>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Edit Button */}
                        {isOwner && !loading && (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-[#C6FF00] hover:bg-[#b8f000] text-[#1d1d1f] font-bold text-[14px] transition-all duration-200 hover:shadow-lg transform hover:scale-105 active:scale-95 whitespace-nowrap flex-shrink-0"
                            >
                                <FaEdit className="w-4 h-4" />
                                <span>Edit</span>
                                <FaArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                        )}
                    </div>

                    {/* Dashboard Stats */}
                    {!loading && (
                        <><div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t border-[#e5e5ea]">
                            {/* Members Card */}
                            <div className="bg-[#f5f5f7] rounded-xl p-5 hover:bg-[#ebebf0] transition-all duration-200">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="w-9 h-9 bg-[#C6FF00]/10 rounded-lg flex items-center justify-center">
                                        <FaUsers className="w-4 h-4 text-[#C6FF00]" />
                                    </div>
                                </div>
                                <p className="text-[12px] font-semibold text-[#86868b] uppercase tracking-wide mb-1">Members</p>
                                <p className="text-3xl font-bold text-[#1d1d1f]">{acceptedMembers.length}</p>
                            </div>

                            {/* Projects Card */}
                            <div className="bg-[#f5f5f7] rounded-xl p-5 hover:bg-[#ebebf0] transition-all duration-200">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="w-9 h-9 bg-[#34C759]/10 rounded-lg flex items-center justify-center">
                                        <FaFolderOpen className="w-4 h-4 text-[#34C759]" />
                                    </div>
                                </div>
                                <p className="text-[12px] font-semibold text-[#86868b] uppercase tracking-wide mb-1">Projects</p>
                                <p className="text-3xl font-bold text-[#1d1d1f]">{projects.length}</p>
                            </div>

                            {/* Tasks Card */}
                            <div className="bg-[#f5f5f7] rounded-xl p-5 hover:bg-[#ebebf0] transition-all duration-200">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="w-9 h-9 bg-[#FF9500]/10 rounded-lg flex items-center justify-center">
                                        <FaCheckCircle className="w-4 h-4 text-[#FF9500]" />
                                    </div>
                                </div>
                                <p className="text-[12px] font-semibold text-[#86868b] uppercase tracking-wide mb-1">Tasks</p>
                                <p className="text-3xl font-bold text-[#1d1d1f]">{tasks.length}</p>
                            </div>

                            {/* Active Since Card */}
                            <div className="bg-[#f5f5f7] rounded-xl p-5 hover:bg-[#ebebf0] transition-all duration-200">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="w-9 h-9 bg-[#0071E3]/10 rounded-lg flex items-center justify-center">
                                        <FaClock className="w-4 h-4 text-[#0071E3]" />
                                    </div>
                                </div>
                                <p className="text-[12px] font-semibold text-[#86868b] uppercase tracking-wide mb-1">Active Since</p>
                                <p className="text-[13px] font-bold text-[#1d1d1f] truncate max-w-full">
                                    {getDaysActive()}
                                </p>
                            </div>
                        </div><div className="mt-8">
                                <h3 className="text-[16px] font-bold text-[#1d1d1f] mb-4 flex items-center gap-2">
                                    <FaUsers className="w-4 h-4" />
                                    Team Members <span className="text-[14px]">({acceptedMembers.length})</span>
                                </h3>
                                <div className="space-y-2">
                                    {acceptedMembers.length > 0 ? (
                                        acceptedMembers.map(member => {
                                            const user = userMap[member.user_id]
                                            return (
                                                <div key={member.user_id} className="bg-[#f5f5f7] rounded-lg p-4 hover:bg-[#ebebf0] transition-all duration-200">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-[14px] font-semibold text-[#1d1d1f]">
                                                                {user ? getDisplayName(user) : member.user_id}
                                                            </p>
                                                            <p className="text-[12px] text-[#86868b] truncate">
                                                                {user?.email || "—"}
                                                            </p>
                                                        </div>
                                                        {member.role === "owner" && (
                                                            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#C6FF00]/10 border border-[#C6FF00]/30 rounded-lg flex-shrink-0 ml-2">
                                                                <FaCrown className="w-3 h-3 text-[#C6FF00]" />
                                                                <span className="text-[10px] font-bold text-[#C6FF00] uppercase">Owner</span>
                                                            </div>
                                                        )}
                                                        {member.role === "member" && (
                                                            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#86868b]/10 border border-[#86868b]/30 rounded-lg flex-shrink-0 ml-2">
                                                                <FaUsers className="w-3 h-3 text-[#86868b]" />
                                                                <span className="text-[10px] font-bold text-[#86868b] uppercase">Member</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )
                                        })
                                    ) : (
                                        <p className="text-[13px] text-[#86868b] p-4 bg-[#f5f5f7] rounded-lg">
                                            No members yet
                                        </p>
                                    )}
                                </div>
                            </div></>
                    )}
                </div>
            </div>
        </div>
    )
}
