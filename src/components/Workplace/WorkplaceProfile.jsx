import { useState, useEffect, useMemo } from "react"
import { Link } from "react-router-dom"
import { FaChevronLeft, FaEdit, FaTimes, FaUsers, FaFolderOpen, FaCheckCircle, FaClock, FaCrown } from "react-icons/fa"
import { convertGoogleDriveLink } from "../../lib/imageUtils"
import { updateWorkplace } from "../../lib/workplaces"
import { getUsersByIds, getDisplayName } from "../../lib/users"

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
                <div className="bg-white rounded-[28px] shadow-sm border border-[#e5e5ea] p-6 sm:p-8 max-w-5xl mx-auto">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
                        <div>
                            <h2 className="text-2xl sm:text-3xl font-bold text-[#1d1d1f]">Edit Workplace</h2>
                            <p className="text-sm text-[#6b7280] mt-1">Update your workspace information</p>
                        </div>
                        <button
                            onClick={handleCancel}
                            className="inline-flex items-center justify-center rounded-xl border border-[#e5e5e9] bg-[#f8fafc] p-2.5 text-[#475569] transition hover:bg-white hover:text-[#111827]"
                        >
                            <FaTimes className="w-4 h-4" />
                        </button>
                    </div>

                    <form onSubmit={handleEdit} className="space-y-5">
                        <div>
                            <label className="text-[11px] font-semibold text-[#475569] uppercase tracking-[0.24em] mb-2 block">
                                Workspace name
                            </label>
                            <input
                                type="text"
                                value={editForm.name}
                                onChange={(e) => setEditForm((v) => ({ ...v, name: e.target.value }))}
                                placeholder="Enter workspace name"
                                className="w-full rounded-2xl border border-[#e5e5e9] bg-[#f8fafc] px-4 py-3 text-sm text-[#111827] outline-none transition focus:border-[#C6FF00] focus:bg-white"
                            />
                        </div>

                        <div>
                            <label className="text-[11px] font-semibold text-[#475569] uppercase tracking-[0.24em] mb-2 block">
                                Description
                            </label>
                            <textarea
                                value={editForm.description}
                                onChange={(e) => setEditForm((v) => ({ ...v, description: e.target.value }))}
                                placeholder="Add a description for your workspace (optional)"
                                rows={5}
                                className="w-full rounded-2xl border border-[#e5e5e9] bg-[#f8fafc] px-4 py-3 text-sm text-[#111827] outline-none resize-none transition focus:border-[#C6FF00] focus:bg-white"
                            />
                        </div>

                        <div>
                            <label className="text-[11px] font-semibold text-[#475569] uppercase tracking-[0.24em] mb-2 block">
                                Banner image link
                            </label>
                            <input
                                type="text"
                                value={editForm.bannerUrl}
                                onChange={(e) => setEditForm((v) => ({ ...v, bannerUrl: e.target.value }))}
                                placeholder="https://drive.google.com/file/d/..."
                                className="w-full rounded-2xl border border-[#e5e5e9] bg-[#f8fafc] px-4 py-3 text-sm text-[#111827] outline-none transition focus:border-[#C6FF00] focus:bg-white"
                            />
                            <div className="mt-3 rounded-2xl border border-[#C6FF00]/20 bg-[#f5ff9f]/10 p-3 text-[12px] text-[#1d1d1f] leading-relaxed">
                                ✨ <strong>Tip:</strong> Share the Drive file as "Anyone with the link" and paste the link here.
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                            <button
                                type="button"
                                onClick={handleCancel}
                                className="w-full rounded-2xl border border-[#e5e5e9] bg-[#f8fafc] px-4 py-3 text-sm font-semibold text-[#1f2937] transition hover:bg-white"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={editLoading}
                                className="w-full rounded-2xl bg-[#C6FF00] px-4 py-3 text-sm font-bold text-[#111827] transition hover:bg-[#b8f000] disabled:opacity-60"
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
        <div className="animate-in fade-in duration-300 mb-8 px-3 sm:px-6 lg:px-10">
            {/* Back Button */}
            <div className="mb-5">
                <Link
                    to="/dashboard/workplaces"
                    className="inline-flex items-center gap-2 rounded-2xl border border-[#e5e5e9] bg-white/90 px-3 py-2 text-[13px] font-medium text-[#111827] shadow-sm transition hover:bg-white"
                >
                    <FaChevronLeft className="w-3.5 h-3.5" />
                    Workplaces
                </Link>
            </div>

            {/* Main Card */}
            <div className="mx-auto max-w-[1680px] overflow-hidden rounded-2xl border border-[#e5e5ea] bg-white shadow-sm transition duration-300 hover:shadow-md sm:rounded-[28px]">
                {/* Banner Section */}
                <div className="relative h-28 sm:h-40 md:h-44 lg:h-48 bg-gradient-to-br from-[#C6FF00] via-[#b8f000] to-[#a8e000] overflow-hidden">
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
                            <div className="absolute inset-0 opacity-15">
                                <div className="absolute top-0 left-1/4 h-72 w-72 rounded-full bg-white blur-3xl" />
                                <div className="absolute bottom-0 right-1/4 h-72 w-72 rounded-full bg-black blur-3xl" />
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
                <div className="px-3 py-4 sm:px-6 sm:py-8">
                    <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:gap-6 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
                        <div className="flex-1 min-w-0">
                            {loading ? (
                                <div className="space-y-3">
                                    <div className="h-7 w-44 rounded-xl bg-[#f5f5f7] animate-pulse sm:h-10 sm:w-56 sm:rounded-2xl" />
                                    <div className="h-4 w-full max-w-xl rounded-xl bg-[#f5f5f7] animate-pulse sm:h-5 sm:max-w-2xl sm:rounded-2xl" />
                                </div>
                            ) : (
                                <>
                                    <div className="mb-2.5 flex flex-col gap-2 sm:mb-3 sm:flex-row sm:items-center sm:gap-4">
                                        <h1 className="max-w-full text-xl font-bold tracking-tight text-[#111827] sm:text-3xl lg:text-4xl">
                                            {workplace?.name || "Untitled Workspace"}
                                        </h1>
                                        {(currentMembership?.role === "owner" || currentMembership?.role === "member") && (
                                            <div className="inline-flex items-center gap-1.5 rounded-xl border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] sm:gap-2 sm:rounded-2xl sm:px-3 sm:py-1.5 sm:text-[11px] sm:tracking-[0.24em]">
                                                {currentMembership?.role === "owner" ? (
                                                    <>
                                                        <FaCrown className="h-3.5 w-3.5 text-[#C6FF00]" />
                                                        <span className="text-[#2f855a] bg-[#ecfdf5] px-2 py-0.5 rounded-full">Owner</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <FaUsers className="h-3.5 w-3.5 text-[#64748b]" />
                                                        <span className="text-[#475569] bg-[#f8fafc] px-2 py-0.5 rounded-full">Member</span>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    {workplace?.description ? (
                                        <p className="hidden max-w-3xl text-sm leading-7 text-[#52525b] sm:block">
                                            {workplace.description}
                                        </p>
                                    ) : isOwner ? (
                                        <p className="hidden text-sm italic text-[#6b7280] sm:block">No description yet. Click Edit to add one.</p>
                                    ) : null}
                                </>
                            )}
                        </div>

                        {/* Edit Button */}
                        {isOwner && !loading && (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-[#C6FF00] px-3 py-2 text-[12px] font-bold text-[#111827] transition hover:bg-[#b8f000] sm:gap-2 sm:rounded-2xl sm:px-4 sm:py-2.5 sm:text-sm"
                            >
                                <FaEdit className="w-4 h-4" />
                                Edit
                            </button>
                        )}
                    </div>

                    {/* Dashboard Stats */}
                    {!loading && (
                        <>
                            <div className="grid grid-cols-2 gap-2.5 border-t border-[#e5e5ea] pt-4 sm:gap-3 sm:pt-5 xl:grid-cols-4">
                                <div className="rounded-xl border border-[#e5e5ea] bg-[#f8fafc] p-3 sm:rounded-[24px] sm:p-4">
                                    <div className="mb-2.5 flex items-center justify-between sm:mb-3">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#C6FF00]/10 text-[#C6FF00] sm:h-10 sm:w-10 sm:rounded-2xl">
                                            <FaUsers className="h-4 w-4 sm:h-5 sm:w-5" />
                                        </div>
                                    </div>
                                    <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-[#64748b] sm:text-[11px] sm:tracking-[0.24em]">Members</p>
                                    <p className="text-lg font-bold text-[#111827] sm:text-2xl">{acceptedMembers.length}</p>
                                </div>
                                <div className="rounded-xl border border-[#e5e5ea] bg-[#f8fafc] p-3 sm:rounded-[24px] sm:p-4">
                                    <div className="mb-2.5 flex items-center justify-between sm:mb-3">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#34C759]/10 text-[#34C759] sm:h-10 sm:w-10 sm:rounded-2xl">
                                            <FaFolderOpen className="h-4 w-4 sm:h-5 sm:w-5" />
                                        </div>
                                    </div>
                                    <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-[#64748b] sm:text-[11px] sm:tracking-[0.24em]">Projects</p>
                                    <p className="text-lg font-bold text-[#111827] sm:text-2xl">{projects.length}</p>
                                </div>
                                <div className="rounded-xl border border-[#e5e5ea] bg-[#f8fafc] p-3 sm:rounded-[24px] sm:p-4">
                                    <div className="mb-2.5 flex items-center justify-between sm:mb-3">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#FF9500]/10 text-[#FF9500] sm:h-10 sm:w-10 sm:rounded-2xl">
                                            <FaCheckCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                                        </div>
                                    </div>
                                    <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-[#64748b] sm:text-[11px] sm:tracking-[0.24em]">Tasks</p>
                                    <p className="text-lg font-bold text-[#111827] sm:text-2xl">{tasks.length}</p>
                                </div>
                                <div className="rounded-xl border border-[#e5e5ea] bg-[#f8fafc] p-3 sm:rounded-[24px] sm:p-4">
                                    <div className="mb-2.5 flex items-center justify-between sm:mb-3">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#0071E3]/10 text-[#0071E3] sm:h-10 sm:w-10 sm:rounded-2xl">
                                            <FaClock className="h-4 w-4 sm:h-5 sm:w-5" />
                                        </div>
                                    </div>
                                    <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-[#64748b] sm:text-[11px] sm:tracking-[0.24em]">Active since</p>
                                    <p className="text-[11px] font-semibold text-[#111827] sm:text-sm">{getDaysActive()}</p>
                                </div>
                            </div>

                            <div className="mt-6 sm:mt-8">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <h3 className="text-base font-bold text-[#111827] sm:text-lg">Team Members</h3>
                                    <span className="text-[11px] text-[#64748b] sm:text-sm">{acceptedMembers.length} active</span>
                                </div>
                                <div className="mt-3 grid gap-2.5 sm:mt-4 sm:gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                    {acceptedMembers.length > 0 ? (
                                        acceptedMembers.map(member => {
                                            const user = userMap[member.user_id]
                                            return (
                                                <div key={member.user_id} className="rounded-xl border border-[#e5e5ea] bg-[#f8fafc] p-3 sm:rounded-[24px] sm:p-4">
                                                    <div className="flex items-start justify-between gap-4">
                                                        <div className="min-w-0 flex-1">
                                                            <p className="truncate text-[13px] font-semibold text-[#111827] sm:text-base">
                                                                {user ? getDisplayName(user) : member.user_id}
                                                            </p>
                                                            <p className="mt-1 truncate text-[11px] text-[#64748b] sm:text-sm">
                                                                {user?.email || "—"}
                                                            </p>
                                                        </div>
                                                        <div className="shrink-0">
                                                            {member.role === "owner" ? (
                                                                <span className="inline-flex items-center rounded-full bg-[#ecfdf5] px-2.5 py-1 text-[9px] font-semibold text-[#166534] sm:px-3 sm:text-[10px]">
                                                                    <FaCrown className="mr-1 h-3 w-3" /> Owner
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center rounded-full bg-[#f8fafc] px-2.5 py-1 text-[9px] font-semibold text-[#475569] sm:px-3 sm:text-[10px]">
                                                                    <FaUsers className="mr-1 h-3 w-3" /> Member
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })
                                    ) : (
                                        <div className="rounded-xl border border-[#e5e5ea] bg-[#f8fafc] p-3 sm:rounded-[24px] sm:p-4">
                                            <p className="text-[12px] text-[#64748b] sm:text-sm">No members yet.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
