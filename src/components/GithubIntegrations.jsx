import { useState, useEffect, useRef } from "react"
import { useAuth } from "../context/AuthContext"
import { supabase } from "../lib/supabase"

const LANG_COLORS = {
    JavaScript: "#f1e05a", TypeScript: "#2b7489", Python: "#3572A5",
    HTML: "#e34c26", CSS: "#563d7c", Rust: "#dea584", Go: "#00ADD8",
    Java: "#b07219", "C++": "#f34b7d", C: "#555555", Ruby: "#701516",
    PHP: "#4F5D95", Swift: "#ffac45", Kotlin: "#A97BFF", Dart: "#00B4AB",
    Shell: "#89e051", Vue: "#41b883", default: "#8b8b8b"
}

const GitHubIcon = ({ className }) => (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
        <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
)

function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    if (days < 30) return `${days}d ago`
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function RepoDropdown({ repos, value, onChange }) {
    const [open, setOpen] = useState(false)
    const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 240 })
    const btnRef = useRef(null)
    const menuRef = useRef(null)
    const selected = repos.find(r => r.full_name === value)

    const openDropdown = () => {
        if (!open && btnRef.current) {
            const rect = btnRef.current.getBoundingClientRect()
            const menuWidth = 240
            // Align right edge with button right edge; clamp to viewport left
            let left = rect.right - menuWidth
            if (left < 8) left = 8
            // Place below button; if not enough room flip above
            const spaceBelow = window.innerHeight - rect.bottom
            const menuMaxH = 280 // header + max-h-[220px]
            const top = spaceBelow >= menuMaxH ? rect.bottom + 6 : rect.top - menuMaxH - 6
            setDropPos({ top, left, width: menuWidth })
        }
        setOpen(o => !o)
    }

    useEffect(() => {
        if (!open) return
        const handler = (e) => {
            if (
                btnRef.current && !btnRef.current.contains(e.target) &&
                menuRef.current && !menuRef.current.contains(e.target)
            ) setOpen(false)
        }
        document.addEventListener("mousedown", handler)
        return () => document.removeEventListener("mousedown", handler)
    }, [open])

    // Reposition on scroll/resize while open
    useEffect(() => {
        if (!open) return
        const update = () => {
            if (!btnRef.current) return
            const rect = btnRef.current.getBoundingClientRect()
            const menuWidth = 240
            let left = rect.right - menuWidth
            if (left < 8) left = 8
            const spaceBelow = window.innerHeight - rect.bottom
            const menuMaxH = 280
            const top = spaceBelow >= menuMaxH ? rect.bottom + 6 : rect.top - menuMaxH - 6
            setDropPos({ top, left, width: menuWidth })
        }
        window.addEventListener("scroll", update, true)
        window.addEventListener("resize", update)
        return () => {
            window.removeEventListener("scroll", update, true)
            window.removeEventListener("resize", update)
        }
    }, [open])

    return (
        <div className="relative flex-shrink-0">
            <button
                ref={btnRef}
                onClick={openDropdown}
                className="flex items-center gap-2 pl-3 pr-2.5 py-2 bg-[#f5f5f7] hover:bg-[#ebebed] rounded-xl text-[12px] font-semibold text-[#1d1d1f] transition-colors border border-[#e5e5ea] min-w-[150px] sm:min-w-[190px]"
            >
                {selected ? (
                    <>
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: LANG_COLORS[selected.language] || LANG_COLORS.default }}></span>
                        <span className="flex-1 text-left truncate">{selected.name}</span>
                    </>
                ) : (
                    <span className="flex-1 text-left text-[#86868b]">All repositories</span>
                )}
                <svg className={`w-3.5 h-3.5 text-[#86868b] flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M19 9l-7 7-7-7" /></svg>
            </button>

            {open && (
                <div
                    ref={menuRef}
                    style={{ position: "fixed", top: dropPos.top, left: dropPos.left, width: dropPos.width, zIndex: 9999 }}
                    className="bg-white rounded-[14px] border border-[#d2d2d7]/70 shadow-2xl overflow-hidden"
                >
                    <button
                        onClick={() => { onChange(null); setOpen(false) }}
                        className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-[#f5f5f7] text-left transition-colors ${!value ? "bg-[#f0fdf4]" : ""}`}
                    >
                        <span className="w-2 h-2 rounded-full bg-[#d2d2d7] flex-shrink-0"></span>
                        <span className="text-[12px] font-semibold text-[#86868b] flex-1">All repositories</span>
                        {!value && <svg className="w-3 h-3 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                    </button>
                    <div className="border-t border-[#f0f0f0]"></div>
                    <div className="max-h-[220px] overflow-y-auto">
                        {repos.map(repo => (
                            <button
                                key={repo.id}
                                onClick={() => { onChange(repo.full_name); setOpen(false) }}
                                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-[#f5f5f7] text-left transition-colors ${value === repo.full_name ? "bg-[#f0fdf4]" : ""}`}
                            >
                                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: LANG_COLORS[repo.language] || LANG_COLORS.default }}></span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[12px] font-semibold text-[#1d1d1f] truncate">{repo.name}</p>
                                    {repo.language && <p className="text-[10px] text-[#86868b]">{repo.language}</p>}
                                </div>
                                {value === repo.full_name && <svg className="w-3 h-3 text-emerald-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

export default function GithubIntegrations() {
    const { user } = useAuth()

    const [ghToken, setGhToken] = useState(null)
    const [ghUser, setGhUser] = useState(null)
    const [ghRepos, setGhRepos] = useState([])
    const [ghIssues, setGhIssues] = useState([])
    const [ghCommits, setGhCommits] = useState([])
    const [ghLoading, setGhLoading] = useState(false)
    const [loadingCommits, setLoadingCommits] = useState(false)
    const [selectedRepo, setSelectedRepo] = useState(null)

    useEffect(() => {
        if (user) {
            const token = user.user_metadata?.github_token
            const cached = localStorage.getItem("github_token")
            const useToken = token || cached
            setGhToken(useToken || null)
            if (useToken) loadGithubData(useToken)

            const pendingToken = localStorage.getItem("github_token_pending")
            if (pendingToken && !useToken) {
                supabase.auth.updateUser({ data: { github_token: pendingToken } })
                    .then(() => {
                        localStorage.removeItem("github_token_pending")
                        localStorage.setItem("github_token", pendingToken)
                        setGhToken(pendingToken)
                        loadGithubData(pendingToken)
                    })
                    .catch(err => console.error("Failed to save GitHub token:", err))
            }
        }
    }, [user])

    useEffect(() => {
        const cached = localStorage.getItem("github_token")
        if (cached) { setGhToken(cached); loadGithubData(cached) }
    }, [])

    useEffect(() => {
        if (ghToken) localStorage.setItem("github_token", ghToken)
        else localStorage.removeItem("github_token")
    }, [ghToken])

    const loadGithubData = async (token) => {
        setGhLoading(true)
        try {
            const headers = { Authorization: `token ${token}`, Accept: "application/vnd.github.v3+json" }
            const [userRes, reposRes, issuesRes] = await Promise.all([
                fetch("https://api.github.com/user", { headers }),
                fetch("https://api.github.com/user/repos?sort=updated&per_page=15&type=owner", { headers }),
                fetch("https://api.github.com/user/issues?state=open&per_page=20", { headers }),
            ])
            const [userData, reposData, issuesData] = await Promise.all([
                userRes.json(), reposRes.json(), issuesRes.json()
            ])
            setGhUser(userData)
            if (Array.isArray(reposData)) {
                setGhRepos(reposData)
                const topRepos = reposData.slice(0, 5)
                const results = await Promise.allSettled(
                    topRepos.map(repo =>
                        fetch(`https://api.github.com/repos/${repo.full_name}/commits?per_page=5`, { headers })
                            .then(r => r.json())
                            .then(data => Array.isArray(data)
                                ? data.map(c => ({ ...c, repoFullName: repo.full_name, repoName: repo.name }))
                                : [])
                            .catch(() => [])
                    )
                )
                const allCommits = results
                    .filter(r => r.status === "fulfilled")
                    .flatMap(r => r.value)
                    .sort((a, b) => new Date(b.commit.author.date) - new Date(a.commit.author.date))
                setGhCommits(allCommits)
            }
            if (Array.isArray(issuesData)) setGhIssues(issuesData)
        } catch (e) {
            console.error("GitHub data load failed:", e)
        } finally {
            setGhLoading(false)
        }
    }

    const handleRepoSelect = async (repoFullName) => {
        setSelectedRepo(repoFullName)
        if (!repoFullName) return
        const existing = ghCommits.filter(c => c.repoFullName === repoFullName)
        if (existing.length > 0) return
        setLoadingCommits(true)
        try {
            const headers = { Authorization: `token ${ghToken}`, Accept: "application/vnd.github.v3+json" }
            const res = await fetch(`https://api.github.com/repos/${repoFullName}/commits?per_page=6`, { headers })
            const data = await res.json()
            if (Array.isArray(data)) {
                const repoName = repoFullName.split("/")[1]
                const tagged = data.map(c => ({ ...c, repoFullName, repoName }))
                setGhCommits(prev =>
                    [...prev, ...tagged].sort((a, b) => new Date(b.commit.author.date) - new Date(a.commit.author.date))
                )
            }
        } catch (e) { console.error(e) }
        finally { setLoadingCommits(false) }
    }

    const connectGithub = () => {
        const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID
        const redirectUri = `${window.location.origin}/auth/github/callback`
        window.location.href = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=repo%20read:user%20user:email`
    }

    const disconnectGithub = async () => {
        await supabase.auth.updateUser({ data: { github_token: null } })
        localStorage.removeItem("github_token")
        setGhToken(null); setGhUser(null); setGhRepos([]); setGhIssues([]); setGhCommits([]); setSelectedRepo(null)
    }

    const filteredCommits = selectedRepo
        ? ghCommits.filter(c => c.repoFullName === selectedRepo)
        : ghCommits

    const filteredIssues = selectedRepo
        ? ghIssues.filter(issue => {
            const repoFromUrl = issue.html_url?.split("/").slice(3, 5).join("/")
            return (issue.repository?.full_name || repoFromUrl) === selectedRepo
        })
        : ghIssues

    return (
        <div className="animate-in fade-in duration-500 max-w-[1600px] mx-auto pb-10">

            {/* Page header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-1 mb-6 sm:mb-8 px-0.5">
                <div>
                    <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest mb-1">Workspace</p>
                    <h1 className="text-[20px] sm:text-[24px] font-bold text-[#1d1d1f] tracking-tight leading-tight flex items-center gap-2.5">
                        <span className="inline-flex w-7 h-7 rounded-lg bg-[#1d1d1f] items-center justify-center flex-shrink-0">
                            <GitHubIcon className="w-4 h-4 text-white" />
                        </span>
                        Integrations
                    </h1>
                </div>
            </div>

            {/* Connection card */}
            <div className="bg-white rounded-[20px] sm:rounded-[24px] border border-[#d2d2d7]/50 shadow-sm p-4 sm:p-5 mb-5 sm:mb-6">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex items-center gap-3.5 flex-1 min-w-0">
                        <div className="w-11 h-11 rounded-2xl bg-[#1d1d1f] flex items-center justify-center flex-shrink-0 shadow-sm">
                            <GitHubIcon className="w-[22px] h-[22px] text-white" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[14px] font-bold text-[#1d1d1f]">GitHub</span>
                                {ghToken && (
                                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                                        Connected
                                    </span>
                                )}
                            </div>
                            {ghToken && ghUser ? (
                                <p className="text-[12px] text-[#86868b] mt-0.5 truncate">
                                    Signed in as <span className="font-semibold text-[#1d1d1f]">@{ghUser.login}</span>
                                </p>
                            ) : (
                                <p className="text-[12px] text-[#86868b] mt-0.5">Connect to view repos, commits &amp; issues</p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {ghToken ? (
                            <button
                                onClick={disconnectGithub}
                                className="text-[12px] font-semibold text-[#86868b] hover:text-red-500 transition-colors px-3 py-2 rounded-xl hover:bg-red-50 border border-[#e5e5ea] hover:border-red-100 whitespace-nowrap"
                            >
                                Disconnect
                            </button>
                        ) : (
                            <button
                                onClick={connectGithub}
                                className="flex items-center gap-2 bg-[#1d1d1f] hover:bg-black text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm active:scale-[0.98] whitespace-nowrap"
                            >
                                <GitHubIcon className="w-4 h-4" />
                                Connect GitHub
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Data area */}
            {!ghToken ? (
                <div className="bg-white rounded-[20px] sm:rounded-[24px] border border-[#d2d2d7]/50 shadow-sm px-6 py-16 flex flex-col items-center gap-4 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-[#f5f5f7] flex items-center justify-center">
                        <GitHubIcon className="w-9 h-9 text-[#1d1d1f]" />
                    </div>
                    <div>
                        <p className="text-[15px] font-bold text-[#1d1d1f]">Connect GitHub</p>
                        <p className="text-[12px] text-[#86868b] mt-1 max-w-xs mx-auto">Link your GitHub account to view repositories, recent commits, and open issues in one place.</p>
                    </div>
                    <button
                        onClick={connectGithub}
                        className="flex items-center gap-2 bg-[#1d1d1f] hover:bg-black text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl transition-all shadow-sm"
                    >
                        <GitHubIcon className="w-4 h-4" />
                        Connect GitHub
                    </button>
                </div>
            ) : ghLoading ? (
                <div className="bg-white rounded-[20px] border border-[#d2d2d7]/50 shadow-sm px-8 py-16 flex flex-col items-center gap-3">
                    <div className="flex gap-1.5">
                        {[0, 150, 300].map(d => (
                            <span key={d} className="w-2.5 h-2.5 rounded-full bg-[#C6FF00] animate-bounce" style={{ animationDelay: `${d}ms` }}></span>
                        ))}
                    </div>
                    <p className="text-[13px] font-medium text-[#86868b]">Loading GitHub data…</p>
                </div>
            ) : (
                <div className="space-y-5 sm:space-y-6">

                    {/* Profile row */}
                    {ghUser && (
                        <div className="bg-white rounded-[20px] sm:rounded-[24px] border border-[#d2d2d7]/50 shadow-sm p-4 sm:p-5">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-0 sm:justify-between">
                                <div className="flex items-center gap-3.5">
                                    <img src={ghUser.avatar_url} alt="avatar" className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl border border-[#e5e5ea] flex-shrink-0" />
                                    <div className="min-w-0">
                                        <p className="text-[15px] sm:text-[16px] font-bold text-[#1d1d1f] truncate">{ghUser.name || ghUser.login}</p>
                                        <p className="text-[12px] text-[#86868b]">@{ghUser.login}</p>
                                        {ghUser.bio && <p className="text-[11px] text-[#86868b] mt-0.5 line-clamp-1 hidden sm:block">{ghUser.bio}</p>}
                                    </div>
                                </div>
                                <div className="flex gap-6 sm:gap-10 pl-0.5 sm:pl-0">
                                    {[
                                        { label: "Repos", val: ghUser.public_repos },
                                        { label: "Followers", val: ghUser.followers },
                                        { label: "Following", val: ghUser.following },
                                    ].map(s => (
                                        <div key={s.label} className="text-center">
                                            <p className="text-[18px] sm:text-[20px] font-black text-[#1d1d1f]">{s.val}</p>
                                            <p className="text-[10px] text-[#86868b] font-semibold uppercase tracking-wide">{s.label}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Main grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">

                        {/* LEFT — Repositories + Issues */}
                        {ghRepos.length > 0 && (
                            <div className="lg:col-span-5 flex flex-col gap-5 sm:gap-6 lg:h-full">
                                <div className="bg-white rounded-[20px] sm:rounded-[24px] border border-[#d2d2d7]/50 shadow-sm overflow-hidden flex flex-col">
                                    <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-[#f0f0f0] flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-7 h-7 rounded-xl bg-[#0969da]/10 flex items-center justify-center">
                                                <svg className="w-3.5 h-3.5 text-[#0969da]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /><path strokeLinecap="round" strokeLinejoin="round" d="M8 7v10M8 7l4-2 4 2" /></svg>
                                            </div>
                                            <div>
                                                <h3 className="text-[13px] font-bold text-[#1d1d1f]">Repositories</h3>
                                                <p className="text-[10px] text-[#86868b]">{ghRepos.length} repos</p>
                                            </div>
                                        </div>
                                        {ghUser && (
                                            <a
                                                href={`https://github.com/${ghUser.login}?tab=repositories`}
                                                target="_blank" rel="noreferrer"
                                                className="text-[11px] font-semibold text-[#86868b] hover:text-[#1d1d1f] transition-colors flex items-center gap-1"
                                            >
                                                View all
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M9 5l7 7-7 7" /></svg>
                                            </a>
                                        )}
                                    </div>
                                    <div className="divide-y divide-[#f5f5f7] overflow-y-auto" style={{ maxHeight: "272px" }}>
                                        {ghRepos.map(repo => (
                                            <div key={repo.id} className="px-5 sm:px-6 py-3.5 hover:bg-[#fafafa] transition-colors">
                                                <div className="flex items-start gap-2">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <a href={repo.html_url} target="_blank" rel="noreferrer"
                                                                className="text-[13px] font-semibold text-[#1d1d1f] hover:text-[#0969da] transition-colors truncate">
                                                                {repo.name}
                                                            </a>
                                                            {repo.private && <span className="text-[9px] font-bold text-[#86868b] bg-[#f5f5f7] border border-[#e5e5ea] px-1.5 py-0.5 rounded-full flex-shrink-0">PRIVATE</span>}
                                                            {repo.fork && <span className="text-[9px] font-bold text-[#86868b] bg-[#f5f5f7] border border-[#e5e5ea] px-1.5 py-0.5 rounded-full flex-shrink-0">FORK</span>}
                                                        </div>
                                                        {repo.description && (
                                                            <p className="text-[11px] text-[#86868b] mt-0.5 line-clamp-1">{repo.description}</p>
                                                        )}
                                                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                                            {repo.language && (
                                                                <span className="flex items-center gap-1 text-[11px] text-[#86868b]">
                                                                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: LANG_COLORS[repo.language] || LANG_COLORS.default }}></span>
                                                                    {repo.language}
                                                                </span>
                                                            )}
                                                            {repo.stargazers_count > 0 && (
                                                                <span className="flex items-center gap-1 text-[11px] text-[#86868b]">
                                                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                                                                    {repo.stargazers_count}
                                                                </span>
                                                            )}
                                                            <span className="text-[11px] text-[#86868b] ml-auto">{timeAgo(repo.updated_at)}</span>
                                                        </div>
                                                    </div>
                                                    {repo.open_issues_count > 0 && (
                                                        <span className="text-[10px] font-bold text-orange-500 bg-orange-50 border border-orange-100 px-1.5 py-0.5 rounded-full flex-shrink-0 mt-0.5">
                                                            {repo.open_issues_count}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Open Issues — left column */}
                                <div className="bg-white rounded-[20px] sm:rounded-[24px] border border-[#d2d2d7]/50 shadow-sm overflow-hidden lg:flex-1 lg:flex lg:flex-col">
                                    <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-[#f0f0f0] flex flex-col sm:flex-row sm:items-center gap-3">
                                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                            <div className="w-7 h-7 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                                                <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 8v4m0 4h.01" /></svg>
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="text-[13px] font-bold text-[#1d1d1f]">Open Issues</h3>
                                                <p className="text-[10px] text-[#86868b] truncate">
                                                    {filteredIssues.length} issue{filteredIssues.length !== 1 ? "s" : ""}
                                                    {selectedRepo ? ` · ${selectedRepo.split("/")[1]}` : ""}
                                                </p>
                                            </div>
                                        </div>
                                        {ghRepos.length > 0 && (
                                            <RepoDropdown repos={ghRepos} value={selectedRepo} onChange={handleRepoSelect} />
                                        )}
                                    </div>

                                    {filteredIssues.length === 0 ? (
                                        <div className="px-6 py-10 flex flex-col items-center gap-3 text-center lg:flex-1 lg:justify-center">
                                            <div className="w-10 h-10 rounded-full bg-[#f0fdf4] flex items-center justify-center">
                                                <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M5 13l4 4L19 7" /></svg>
                                            </div>
                                            <div>
                                                <p className="text-[13px] font-semibold text-[#1d1d1f]">All clear!</p>
                                                <p className="text-[12px] text-[#86868b] mt-0.5">No open issues{selectedRepo ? " in this repo" : ""}</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-[#f5f5f7] lg:flex-1 lg:overflow-y-auto">
                                            {filteredIssues.map(issue => (
                                                <a
                                                    key={issue.id}
                                                    href={issue.html_url} target="_blank" rel="noreferrer"
                                                    className="px-5 sm:px-6 py-3.5 flex items-start gap-3 hover:bg-[#fafafa] transition-colors group"
                                                >
                                                    <div className="w-5 h-5 rounded-full border-2 border-emerald-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-start gap-2">
                                                            <p className="text-[12px] font-semibold text-[#1d1d1f] line-clamp-2 group-hover:text-[#0969da] transition-colors flex-1">{issue.title}</p>
                                                            <span className="text-[10px] font-semibold text-[#86868b] bg-[#f5f5f7] border border-[#e5e5ea] px-1.5 py-0.5 rounded-md flex-shrink-0 font-mono">#{issue.number}</span>
                                                        </div>
                                                        <p className="text-[11px] text-[#86868b] mt-0.5">
                                                            {issue.repository?.full_name || issue.html_url.split("/").slice(3, 5).join("/")} · {timeAgo(issue.created_at)}
                                                        </p>
                                                        {issue.labels?.length > 0 && (
                                                            <div className="flex flex-wrap gap-1 mt-1.5">
                                                                {issue.labels.map(lbl => (
                                                                    <span
                                                                        key={lbl.id}
                                                                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full border"
                                                                        style={{ background: `#${lbl.color}22`, color: `#${lbl.color}`, borderColor: `#${lbl.color}44` }}
                                                                    >
                                                                        {lbl.name}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </a>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* RIGHT — Commits only */}
                        <div className={`flex flex-col gap-5 sm:gap-6 ${ghRepos.length > 0 ? "lg:col-span-7" : "lg:col-span-12"}`}>

                            {/* Recent Commits */}
                            <div className="bg-white rounded-[20px] sm:rounded-[24px] border border-[#d2d2d7]/50 shadow-sm overflow-hidden">
                                <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-[#f0f0f0] flex flex-col sm:flex-row sm:items-center gap-3">
                                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                        <div className="w-7 h-7 rounded-xl bg-[#28a745]/10 flex items-center justify-center flex-shrink-0">
                                            <svg className="w-3.5 h-3.5 text-[#28a745]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path strokeLinecap="round" d="M12 3v6M12 15v6M3 12h6M15 12h6" /></svg>
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="text-[13px] font-bold text-[#1d1d1f]">Recent Commits</h3>
                                            <p className="text-[10px] text-[#86868b] truncate">
                                                {filteredCommits.length} commit{filteredCommits.length !== 1 ? "s" : ""}
                                                {selectedRepo ? ` · ${selectedRepo.split("/")[1]}` : " · all repos"}
                                            </p>
                                        </div>
                                    </div>
                                    {ghRepos.length > 0 && (
                                        <RepoDropdown repos={ghRepos} value={selectedRepo} onChange={handleRepoSelect} />
                                    )}
                                </div>

                                {loadingCommits ? (
                                    <div className="flex justify-center py-10">
                                        <div className="w-5 h-5 border-2 border-[#C6FF00] border-t-transparent rounded-full animate-spin"></div>
                                    </div>
                                ) : filteredCommits.length === 0 ? (
                                    <div className="px-6 py-10 text-center">
                                        <p className="text-[13px] font-semibold text-[#86868b]">No commits found</p>
                                        <p className="text-[11px] text-[#d2d2d7] mt-1">Try selecting a different repository</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-[#f5f5f7]">
                                        {filteredCommits.slice(0, 8).map((c, i) => (
                                            <a
                                                key={`${c.sha}-${i}`}
                                                href={c.html_url} target="_blank" rel="noreferrer"
                                                className="px-5 sm:px-6 py-3.5 flex items-start gap-3 hover:bg-[#fafafa] transition-colors group"
                                            >
                                                <div className="w-7 h-7 rounded-full bg-[#f5f5f7] border border-[#e5e5ea] overflow-hidden flex-shrink-0 mt-0.5">
                                                    {c.author?.avatar_url
                                                        ? <img src={c.author.avatar_url} alt="" className="w-full h-full object-cover" />
                                                        : <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-[#86868b]">{c.commit.author.name[0]}</div>
                                                    }
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[12px] font-semibold text-[#1d1d1f] line-clamp-1 group-hover:text-[#0969da] transition-colors">
                                                        {c.commit.message.split("\n")[0]}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                                        <p className="text-[11px] text-[#86868b]">{c.commit.author.name} · {timeAgo(c.commit.author.date)}</p>
                                                        {!selectedRepo && c.repoName && (
                                                            <span className="text-[10px] font-semibold text-[#86868b] bg-[#f5f5f7] px-1.5 py-0.5 rounded-full">{c.repoName}</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <code className="text-[10px] text-[#86868b] bg-[#f5f5f7] border border-[#e5e5ea] px-1.5 py-0.5 rounded-md font-mono flex-shrink-0 mt-0.5">
                                                    {c.sha.slice(0, 7)}
                                                </code>
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </div>

                        </div>
                    </div>

                    {ghRepos.length === 0 && ghIssues.length === 0 && (
                        <div className="bg-white rounded-[20px] border border-[#d2d2d7]/50 shadow-sm px-8 py-14 flex flex-col items-center gap-2 text-center">
                            <GitHubIcon className="w-10 h-10 text-[#d2d2d7]" />
                            <p className="text-[13px] font-semibold text-[#1d1d1f]">No data found</p>
                            <p className="text-[12px] text-[#86868b]">Your GitHub repos and issues will appear here.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
