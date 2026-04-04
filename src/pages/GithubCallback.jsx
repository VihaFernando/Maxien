import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"

export default function GithubCallback() {
    const navigate = useNavigate()
    const [status, setStatus] = useState("Connecting GitHub...")

    useEffect(() => {
        const code = new URLSearchParams(window.location.search).get("code")

        if (!code) {
            navigate("/dashboard/profile")
            return
        }

        queueMicrotask(() => setStatus("Exchanging code for token..."))

        fetch(`${import.meta.env.VITE_GITHUB_TOKEN_ENDPOINT}?code=${code}`, {
            headers: {
                Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
            }
        })
            .then(res => res.json())
            .then(async (data) => {
                if (data.access_token) {
                    setStatus("Saving GitHub connection...")
                    localStorage.setItem("github_token_pending", data.access_token)
                    setStatus("GitHub connected! Redirecting...")
                    setTimeout(() => navigate("/dashboard/github"), 800)
                } else {
                    setStatus("Failed to connect GitHub. Redirecting...")
                    setTimeout(() => navigate("/dashboard/profile"), 1500)
                }
            })
            .catch(() => {
                setStatus("Something went wrong. Redirecting...")
                setTimeout(() => navigate("/dashboard/profile"), 1500)
            })
    }, [navigate])

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#f5f5f7]">
            <div className="bg-white rounded-[24px] border border-[#d2d2d7]/50 shadow-sm px-10 py-10 flex flex-col items-center gap-4 w-full max-w-sm">
                <div className="w-14 h-14 rounded-2xl bg-[#1d1d1f] flex items-center justify-center shadow-lg">
                    <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                    </svg>
                </div>
                <div className="text-center">
                    <p className="text-[15px] font-bold text-[#1d1d1f]">GitHub Integration</p>
                    <p className="text-[12px] text-[#86868b] mt-1">{status}</p>
                </div>
                <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#C6FF00] animate-bounce" style={{ animationDelay: "0ms" }}></span>
                    <span className="w-2 h-2 rounded-full bg-[#C6FF00] animate-bounce" style={{ animationDelay: "150ms" }}></span>
                    <span className="w-2 h-2 rounded-full bg-[#C6FF00] animate-bounce" style={{ animationDelay: "300ms" }}></span>
                </div>
            </div>
        </div>
    )
}
