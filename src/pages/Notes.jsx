import { useEffect, useMemo, useRef, useState } from "react"
import { useLocation } from "react-router-dom"
import Quill from "quill"
import "quill/dist/quill.snow.css"
import { FaPlus, FaSearch, FaTimes, FaEdit, FaTrash, FaStickyNote } from "react-icons/fa"
import { supabase } from "../lib/supabase"
import { useAuth } from "../context/AuthContext"

const EMPTY_EDITOR_HTML = "<p><br></p>"

const getPlainTextFromHtml = (html = "") => {
    if (!html) return ""

    if (typeof window === "undefined" || !window.DOMParser) {
        return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
    }

    const parser = new window.DOMParser()
    const doc = parser.parseFromString(html, "text/html")
    return (doc.body.textContent || "").replace(/\s+/g, " ").trim()
}

const formatDateTime = (value) => {
    if (!value) return ""
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ""
    return date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
    })
}

export default function Notes() {
    const { user } = useAuth()
    const location = useLocation()

    const [notes, setNotes] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [message, setMessage] = useState("")
    const [searchTerm, setSearchTerm] = useState("")

    const [showEditorModal, setShowEditorModal] = useState(false)
    const [selectedNote, setSelectedNote] = useState(null)
    const [editingNote, setEditingNote] = useState(null)

    const [title, setTitle] = useState("")
    const [contentHtml, setContentHtml] = useState(EMPTY_EDITOR_HTML)
    const [saving, setSaving] = useState(false)

    const editorMountRef = useRef(null)
    const quillRef = useRef(null)
    const pendingEditorHtmlRef = useRef(EMPTY_EDITOR_HTML)
    const messageTimeoutRef = useRef(null)

    const syncEditorHtml = (html) => {
        const normalizedHtml = html || EMPTY_EDITOR_HTML
        pendingEditorHtmlRef.current = normalizedHtml

        if (!quillRef.current) return

        quillRef.current.setText("", "silent")
        quillRef.current.clipboard.dangerouslyPasteHTML(normalizedHtml, "silent")
        setContentHtml(quillRef.current.root.innerHTML || EMPTY_EDITOR_HTML)
    }

    useEffect(() => {
        if (!user) return
        fetchNotes()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user])

    useEffect(() => {
        const params = new URLSearchParams(location.search)
        if (params.get("action") === "create") {
            openCreateModal()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.search])

    useEffect(() => {
        if (!showEditorModal || !editorMountRef.current) return

        if (!quillRef.current) {
            const quill = new Quill(editorMountRef.current, {
                theme: "snow",
                placeholder: "Write your note here...",
                modules: {
                    toolbar: [
                        [{ header: [1, 2, 3, false] }],
                        ["bold", "italic", "underline", "strike"],
                        [{ list: "ordered" }, { list: "bullet" }],
                        [{ color: [] }, { background: [] }],
                        [{ align: [] }],
                        ["blockquote", "code-block", "link"],
                        ["clean"],
                    ],
                },
            })

            quill.on("text-change", () => {
                setContentHtml(quill.root.innerHTML)
            })

            quillRef.current = quill
            syncEditorHtml(pendingEditorHtmlRef.current)
        }
    }, [showEditorModal])

    // Cleanup message timeouts on unmount
    useEffect(() => {
        return () => {
            if (messageTimeoutRef.current) {
                clearTimeout(messageTimeoutRef.current)
            }
        }
    }, [])

    const fetchNotes = async () => {
        setLoading(true)
        setError("")

        try {
            const { data, error: fetchError } = await supabase
                .from("notes")
                .select("*")
                .eq("user_id", user.id)
                .order("updated_at", { ascending: false })

            if (fetchError) {
                setError("Failed to load notes")
                setNotes([])
            } else {
                setNotes(data || [])
            }
        } catch {
            setError("Failed to load notes")
            setNotes([])
        } finally {
            setLoading(false)
        }
    }

    const openCreateModal = () => {
        setEditingNote(null)
        setTitle("")
        setContentHtml(EMPTY_EDITOR_HTML)
        syncEditorHtml(EMPTY_EDITOR_HTML)
        setShowEditorModal(true)
        setError("")
    }

    const openEditModal = (note) => {
        setEditingNote(note)
        setTitle(note.title || "")
        setContentHtml(note.content_html || EMPTY_EDITOR_HTML)
        syncEditorHtml(note.content_html || EMPTY_EDITOR_HTML)
        setShowEditorModal(true)
        setError("")
    }

    const closeEditorModal = () => {
        setShowEditorModal(false)
        setEditingNote(null)
        setTitle("")
        setContentHtml(EMPTY_EDITOR_HTML)
        pendingEditorHtmlRef.current = EMPTY_EDITOR_HTML
        quillRef.current = null
    }

    const handleSaveNote = async (e) => {
        e.preventDefault()
        setError("")
        let saved = false

        const contentText = getPlainTextFromHtml(contentHtml)
        if (!contentText) {
            setError("Content is required")
            return
        }

        setSaving(true)
        const now = new Date().toISOString()

        const payload = {
            user_id: user.id,
            title: title.trim() || null,
            content_html: contentHtml || EMPTY_EDITOR_HTML,
            updated_at: now,
        }

        try {
            if (editingNote) {
                const { error: updateError } = await supabase
                    .from("notes")
                    .update(payload)
                    .eq("id", editingNote.id)
                    .eq("user_id", user.id)

                if (updateError) {
                    setError("Failed to update note")
                } else {
                    setMessage("Note updated")
                    saved = true
                    closeEditorModal()
                    await fetchNotes()
                }
            } else {
                const { error: insertError } = await supabase
                    .from("notes")
                    .insert([{ ...payload, created_at: now }])

                if (insertError) {
                    setError("Failed to create note")
                } else {
                    setMessage("Note created")
                    saved = true
                    closeEditorModal()
                    await fetchNotes()
                }
            }
        } catch {
            setError(editingNote ? "Failed to update note" : "Failed to create note")
        } finally {
            setSaving(false)
            if (saved) {
                messageTimeoutRef.current = setTimeout(() => setMessage(""), 2000)
            }
        }
    }

    const handleDeleteNote = async (noteId) => {
        if (!window.confirm("Delete this note?")) return

        try {
            const { error: deleteError } = await supabase
                .from("notes")
                .delete()
                .eq("id", noteId)
                .eq("user_id", user.id)

            if (deleteError) {
                setError("Failed to delete note")
                return
            }

            if (selectedNote?.id === noteId) {
                setSelectedNote(null)
            }

            setMessage("Note deleted")
            setNotes((prev) => prev.filter((n) => n.id !== noteId))
            messageTimeoutRef.current = setTimeout(() => setMessage(""), 2000)
        } catch {
            setError("Failed to delete note")
        }
    }

    const filteredNotes = useMemo(() => {
        const query = searchTerm.trim().toLowerCase()
        if (!query) return notes

        return notes.filter((note) => {
            const inTitle = (note.title || "").toLowerCase().includes(query)
            const inBody = getPlainTextFromHtml(note.content_html || "").toLowerCase().includes(query)
            return inTitle || inBody
        })
    }, [notes, searchTerm])

    return (
        <div className="mx-auto max-w-[1320px] animate-in fade-in pb-10 duration-500">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8 px-0">
                <div>
                    <h2 className="text-[28px] sm:text-[34px] font-bold text-[#1d1d1f] tracking-tight">Notes</h2>
                    <p className="text-[#86868b] text-sm sm:text-[17px] mt-1.5 font-medium">
                        Capture quick thoughts with a rich text editor.
                    </p>
                </div>
                <button
                    onClick={openCreateModal}
                    className="inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 bg-[#C6FF00] hover:bg-[#b8f000] text-[#1d1d1f] rounded-xl font-bold text-[13px] sm:text-[14px] transition-all active:scale-[0.98] shadow-sm"
                >
                    <FaPlus className="w-3 h-3" />
                    New Note
                </button>
            </div>

            {(error || message) && (
                <div className={`mb-4 sm:mb-6 px-4 py-3 rounded-2xl text-sm font-semibold border ${error
                    ? "bg-red-50 text-red-700 border-red-200"
                    : "bg-[#ecfdf3] text-[#166534] border-[#bbf7d0]"
                    }`}>
                    {error || message}
                </div>
            )}

            <div className="bg-white rounded-[24px] sm:rounded-[32px] p-4 sm:p-6 md:p-8 border border-[#d2d2d7]/40 shadow-sm">
                <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                    <div className="relative w-full sm:max-w-md">
                        <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[#86868b] w-3.5 h-3.5" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search notes..."
                            className="w-full pl-9 pr-3 py-2.5 text-sm bg-[#f5f5f7] border border-transparent rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C6FF00]/60 focus:bg-white transition-all"
                        />
                    </div>
                    <p className="text-xs sm:text-sm font-semibold text-[#86868b]">
                        {filteredNotes.length} {filteredNotes.length === 1 ? "note" : "notes"}
                    </p>
                </div>

                {loading ? (
                    <div className="py-20 flex items-center justify-center">
                        <div className="w-8 h-8 border-4 border-[#C6FF00] border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : filteredNotes.length === 0 ? (
                    <div className="text-center py-16 bg-[#f5f5f7]/60 border border-dashed border-[#d2d2d7] rounded-2xl">
                        <FaStickyNote className="w-7 h-7 text-[#86868b] mx-auto mb-3" />
                        <p className="text-[#1d1d1f] font-bold text-[15px]">No notes yet</p>
                        <p className="text-[#86868b] text-sm mt-1">Create your first rich text note.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
                        {filteredNotes.map((note) => {
                            const excerpt = getPlainTextFromHtml(note.content_html || "")
                            return (
                                <div
                                    key={note.id}
                                    className="group bg-[#f5f5f7]/55 border border-[#d2d2d7]/40 hover:border-[#d2d2d7] rounded-2xl p-4 sm:p-5 transition-all duration-200"
                                >
                                    <button
                                        onClick={() => setSelectedNote(note)}
                                        className="w-full text-left"
                                    >
                                        <h3 className="font-bold text-[#1d1d1f] text-[15px] leading-tight line-clamp-1">
                                            {note.title || "Untitled note"}
                                        </h3>
                                        <p className="text-[#86868b] text-sm mt-2 line-clamp-4 min-h-[80px]">
                                            {excerpt || "(Empty content)"}
                                        </p>
                                        <p className="text-[11px] font-medium text-[#86868b] mt-3">
                                            Updated {formatDateTime(note.updated_at)}
                                        </p>
                                    </button>
                                    <div className="mt-3 pt-3 border-t border-[#d2d2d7]/40 flex items-center justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => openEditModal(note)}
                                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold bg-white border border-[#d2d2d7] text-[#1d1d1f] hover:bg-[#f0f0f2]"
                                        >
                                            <FaEdit className="w-3 h-3" />
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => handleDeleteNote(note.id)}
                                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold bg-red-50 border border-red-200 text-red-700 hover:bg-red-100"
                                        >
                                            <FaTrash className="w-3 h-3" />
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {showEditorModal && (
                <div className="fixed inset-0 bg-[#1d1d1f]/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 sm:p-4 transition-opacity duration-300">
                    <div className="bg-white rounded-t-[32px] sm:rounded-[32px] p-6 sm:p-8 w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl relative animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 sm:fade-in-20">
                        <div className="flex justify-center sm:hidden mb-4">
                            <div className="w-12 h-1.5 bg-[#d2d2d7] rounded-full" />
                        </div>

                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-xl sm:text-2xl font-bold text-[#1d1d1f] tracking-tight">
                                {editingNote ? "Edit Note" : "New Note"}
                            </h3>
                            <button
                                onClick={closeEditorModal}
                                className="p-2 bg-[#f5f5f7] hover:bg-[#e8e8ed] rounded-full transition-colors"
                            >
                                <FaTimes className="w-4 h-4 text-[#86868b]" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveNote} className="space-y-4">
                            <div>
                                <label className="text-[12px] font-bold text-[#86868b] uppercase tracking-wider mb-2 block">
                                    Title (optional)
                                </label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Untitled note"
                                    className="w-full px-3.5 py-3 rounded-xl border border-[#d2d2d7] text-sm focus:outline-none focus:ring-2 focus:ring-[#C6FF00]/60 focus:border-transparent"
                                />
                            </div>

                            <div>
                                <label className="text-[12px] font-bold text-[#86868b] uppercase tracking-wider mb-2 block">
                                    Content
                                </label>
                                <div className="note-editor rounded-2xl border border-[#d2d2d7] overflow-hidden bg-white">
                                    <div ref={editorMountRef} className="min-h-[280px]" />
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#e5e5ea]">
                                <button
                                    type="button"
                                    onClick={closeEditorModal}
                                    className="px-4 py-2.5 rounded-xl bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] font-semibold text-sm transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-5 py-2.5 rounded-xl bg-[#C6FF00] hover:bg-[#b8f000] text-[#1d1d1f] font-bold text-sm transition-all active:scale-[0.98] disabled:opacity-60"
                                >
                                    {saving ? "Saving..." : editingNote ? "Update Note" : "Save Note"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {selectedNote && (
                <div className="fixed inset-0 bg-[#1d1d1f]/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 sm:p-4 transition-opacity duration-300">
                    <div className="bg-white rounded-t-[28px] sm:rounded-[30px] p-4 sm:p-5 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl relative animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 sm:fade-in-20 border border-[#d2d2d7]/40">
                        <div className="flex justify-center sm:hidden mb-2.5">
                            <div className="w-12 h-1.5 bg-[#d2d2d7] rounded-full" />
                        </div>

                        <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="bg-[#f5f5f7]/70 border border-[#d2d2d7]/40 rounded-2xl p-3.5 flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1.5">
                                    <div className="w-7 h-7 rounded-xl bg-[#C6FF00]/55 text-[#1d1d1f] flex items-center justify-center">
                                        <FaStickyNote className="w-3.5 h-3.5" />
                                    </div>
                                    <h3 className="text-[18px] sm:text-[22px] font-bold text-[#1d1d1f] tracking-tight truncate">
                                        {selectedNote.title || "Untitled note"}
                                    </h3>
                                </div>
                                <p className="text-[11px] font-semibold text-[#86868b]">
                                    Updated {formatDateTime(selectedNote.updated_at)}
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedNote(null)}
                                className="p-2 bg-[#f5f5f7] hover:bg-[#e8e8ed] rounded-full transition-colors shrink-0"
                            >
                                <FaTimes className="w-4 h-4 text-[#86868b]" />
                            </button>
                        </div>

                        <div className="bg-white border border-[#d2d2d7]/50 rounded-2xl px-3.5 py-3 sm:px-4 sm:py-3.5">
                            <article
                                className="ql-editor note-renderer max-w-none text-[#1d1d1f] text-sm sm:text-[15px] leading-relaxed"
                                dangerouslySetInnerHTML={{ __html: selectedNote.content_html || EMPTY_EDITOR_HTML }}
                            />
                        </div>

                        <div className="mt-4 pt-3 border-t border-[#e5e5ea] flex items-center justify-between gap-2">
                            <button
                                onClick={() => {
                                    setSelectedNote(null)
                                    openEditModal(selectedNote)
                                }}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] font-semibold text-[13px]"
                            >
                                <FaEdit className="w-3 h-3" />
                                Edit
                            </button>
                            <button
                                onClick={() => setSelectedNote(null)}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#C6FF00] hover:bg-[#b8f000] text-[#1d1d1f] font-bold text-[13px]"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
