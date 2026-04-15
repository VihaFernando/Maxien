import { useCallback, useSyncExternalStore } from "react"
import { Link } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { supabase } from "../lib/supabase"
import LifeSyncIntegration from "./LifeSyncIntegration"

const GITHUB_TOKEN_CHANGED_EVENT = "maxien:github-token-changed"

const GitHubIcon = ({ className }) => (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
        <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
)

export default function GithubIntegrations({ embedded = false }) {
    const { user } = useAuth()

    const getSnapshot = useCallback(() => {
        const tokenFromProfile = user?.user_metadata?.github_token
        if (tokenFromProfile) return true
        try {
            return Boolean(localStorage.getItem("github_token"))
        } catch {
            return false
        }
    }, [user?.user_metadata?.github_token])

    const ghConnected = useSyncExternalStore(
        (onStoreChange) => {
            if (typeof window === "undefined") return () => {}
            window.addEventListener("storage", onStoreChange)
            window.addEventListener(GITHUB_TOKEN_CHANGED_EVENT, onStoreChange)
            return () => {
                window.removeEventListener("storage", onStoreChange)
                window.removeEventListener(GITHUB_TOKEN_CHANGED_EVENT, onStoreChange)
            }
        },
        getSnapshot,
        () => false,
    )

    const connectGithub = () => {
        const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID
        const redirectUri = `${window.location.origin}/auth/github/callback`
        window.location.href = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=repo%20read:user%20user:email`
    }

    const disconnectGithub = async () => {
        await supabase.auth.updateUser({ data: { github_token: null } })
        localStorage.removeItem("github_token")
        window.dispatchEvent(new Event(GITHUB_TOKEN_CHANGED_EVENT))
    }

    return (
        <div
            className={
                embedded
                    ? "w-full min-w-0 space-y-5"
                    : "mx-auto w-full min-w-0 max-w-[1600px] animate-in space-y-5 pb-10 duration-500 fade-in sm:space-y-6"
            }
        >
            {!embedded && (
                <div className="mb-6 flex flex-col justify-between gap-1 px-0.5 sm:mb-8 sm:flex-row sm:items-end">
                    <div>
                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-[#86868b]">Workspace</p>
                        <h1 className="flex items-center gap-2.5 text-[20px] font-bold leading-tight tracking-tight text-[#1d1d1f] sm:text-[24px]">
                            <span className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-[#1d1d1f]">
                                <GitHubIcon className="h-4 w-4 text-white" />
                            </span>
                            Integrations
                        </h1>
                        <p className="mt-1 max-w-xl text-[12px] text-[#86868b]">
                            LifeSync and GitHub connections. Use the sidebar <span className="font-semibold text-[#1d1d1f]">GitHub</span> page for repositories, commits, and issues.
                        </p>
                    </div>
                </div>
            )}

            <LifeSyncIntegration embedded={embedded} />

            <div className="rounded-[20px] border border-[#d2d2d7]/50 bg-white p-4 shadow-sm sm:rounded-[24px] sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-3.5 flex-1 min-w-0">
                        <div className="w-11 h-11 rounded-2xl bg-[#1d1d1f] flex items-center justify-center flex-shrink-0 shadow-sm">
                            <GitHubIcon className="w-[22px] h-[22px] text-white" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[14px] font-bold text-[#1d1d1f]">GitHub</span>
                                {ghConnected && (
                                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                                        Connected
                                    </span>
                                )}
                            </div>
                            <p className="text-[12px] text-[#86868b] mt-0.5">
                                Repos, commits, and issues live on the GitHub page.
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-shrink-0 flex-wrap items-center gap-2 lg:justify-end">
                        <Link
                            to="/dashboard/github"
                            className="flex items-center justify-center gap-2 bg-[#1d1d1f] hover:bg-black text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm active:scale-[0.98] whitespace-nowrap"
                        >
                            <GitHubIcon className="w-4 h-4" />
                            Open GitHub
                        </Link>
                        {ghConnected ? (
                            <button
                                type="button"
                                onClick={disconnectGithub}
                                className="text-[12px] font-semibold text-[#86868b] hover:text-red-500 transition-colors px-3 py-2 rounded-xl hover:bg-red-50 border border-[#e5e5ea] hover:border-red-100 whitespace-nowrap"
                            >
                                Disconnect
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={connectGithub}
                                className="text-[12px] font-semibold text-[#1d1d1f] bg-[#f5f5f7] hover:bg-[#ebebed] px-3 py-2 rounded-xl border border-[#e5e5ea] whitespace-nowrap"
                            >
                                Connect account
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
