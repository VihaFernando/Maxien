import { useEffect, useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { useLifeSync } from "../context/LifeSyncContext"

export default function Login() {
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(false)
    const navigate = useNavigate()
    const { signIn, signInWithGoogle, user, loading: authLoading } = useAuth()
    const { lifeSyncEnsureAccount } = useLifeSync()

    useEffect(() => {
        if (!authLoading && user) {
            navigate("/dashboard", { replace: true })
        }
    }, [authLoading, user, navigate])

    const handleEmailLogin = async (e) => {
        e.preventDefault()
        setError("")
        setLoading(true)
        try {
            const { data, error } = await signIn(email, password)
            if (error) {
                setError(error.message)
            } else {
                try {
                    const meta = data?.user?.user_metadata || {}
                    const name =
                        meta.full_name || meta.display_name || meta.name || ''
                    await lifeSyncEnsureAccount(email.trim(), password, name)
                } catch (lsErr) {
                    try {
                        sessionStorage.setItem(
                            'maxien_lifesync_link_notice',
                            lsErr.message ||
                                'LifeSync could not be reached. Open Settings → Integrations to try again.'
                        )
                    } catch {
                        // ignore
                    }
                }
                navigate("/dashboard")
            }
        } catch {
            setError("An unexpected error occurred")
        } finally {
            setLoading(false)
        }
    }

    const handleGoogleLogin = async () => {
        setError("")
        setLoading(true)
        try {
            const { error } = await signInWithGoogle()
            if (error) setError(error.message)
        } catch {
            setError("An unexpected error occurred")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="auth-login-page min-h-screen flex items-center justify-center font-sans p-4 sm:p-8 selection:bg-[var(--mx-color-c6ff00)] selection:text-[var(--mx-color-1d1d1f)]">
            <div className="w-full max-w-[400px]">

                {/* Header Section */}
                <div className="flex flex-col items-center mb-8">
                    <div className="w-14 h-14 mb-6 transition-transform hover:scale-105 duration-300 shadow-[0_8px_16px_rgba(198,255,0,0.25)]">
                        <img src="/logo.svg" alt="Maxien logo" className="w-full h-full" />
                    </div>
                    <h1 className="text-2xl sm:text-[28px] font-semibold text-[var(--mx-color-1d1d1f)] tracking-tight text-center mb-2">
                        Welcome back
                    </h1>
                    <p className="text-[var(--mx-color-86868b)] text-[15px] text-center leading-relaxed">
                        Sign in to continue to your workspace, LifeSync hubs, and daily dashboard.
                    </p>
                </div>

                {/* Main Card */}
                <div className="auth-login-card rounded-4xl p-6 sm:p-10">

                    {error && (
                        <div className="bg-red-50 text-red-600 text-[13px] font-medium px-4 py-3 rounded-xl mb-6 flex items-center gap-2 border border-red-100/50">
                            <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleEmailLogin} className="space-y-5">
                        <div>
                            <label className="text-[13px] font-medium text-[var(--mx-color-1d1d1f)]/70 mb-1.5 ml-1 block">
                                Email
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="name@example.com"
                                required
                                className="auth-login-input w-full rounded-xl px-4 py-3.5 text-[15px] text-[var(--mx-color-1d1d1f)] placeholder-[var(--mx-color-86868b)] transition-all duration-300 focus:outline-none focus:border-[var(--mx-color-c6ff00)] focus:ring-4 focus:ring-[var(--mx-color-c6ff00)]/20"
                            />
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-1.5 ml-1 mr-1">
                                <label className="text-[13px] font-medium text-[var(--mx-color-1d1d1f)]/70">
                                    Password
                                </label>
                                <a href="#" className="text-[12px] font-medium text-[var(--mx-color-86b300)] hover:text-[var(--mx-color-749c00)] transition-colors">
                                    Need help signing in?
                                </a>
                            </div>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                className="auth-login-input w-full rounded-xl px-4 py-3.5 text-[15px] text-[var(--mx-color-1d1d1f)] placeholder-[var(--mx-color-86868b)] transition-all duration-300 focus:outline-none focus:border-[var(--mx-color-c6ff00)] focus:ring-4 focus:ring-[var(--mx-color-c6ff00)]/20"
                            />
                        </div>

                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-[var(--mx-color-c6ff00)] hover:bg-[var(--mx-color-b8f000)] text-[var(--mx-color-1d1d1f)] font-semibold py-3.5 rounded-xl text-[15px] transition-all duration-300 hover:shadow-lg hover:shadow-[var(--mx-color-c6ff00)]/20 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center"
                            >
                                {loading ? (
                                    <svg className="animate-spin h-5 w-5 text-[var(--mx-color-1d1d1f)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                ) : (
                                    "Sign in"
                                )}
                            </button>
                        </div>
                    </form>

                    <div className="my-6 flex items-center gap-4">
                        <div className="auth-login-separator flex-1 h-px bg-black/[0.06]"></div>
                        <span className="text-[var(--mx-color-86868b)] text-[12px] font-medium">or</span>
                        <div className="auth-login-separator flex-1 h-px bg-black/[0.06]"></div>
                    </div>

                    <button
                        type="button"
                        onClick={handleGoogleLogin}
                        disabled={loading}
                        className="w-full bg-[var(--color-surface)] hover:bg-gray-50 border border-black/[0.08] text-[var(--mx-color-1d1d1f)] font-medium py-3.5 rounded-xl text-[15px] transition-all duration-300 shadow-sm active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3"
                    >
                        <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="var(--mx-color-4285f4)" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="var(--mx-color-34a853)" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="var(--mx-color-fbbc05)" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="var(--mx-color-ea4335)" />
                        </svg>
                        Continue with Google
                    </button>
                </div>

                <p className="text-center text-[var(--mx-color-86868b)] text-[14px] mt-8">
                    Don&apos;t have an account yet?{" "}
                    <Link to="/signup" className="text-[var(--mx-color-86b300)] hover:text-[var(--mx-color-749c00)] font-medium transition-colors">
                        Create account
                    </Link>
                </p>

            </div>
        </div>
    )
}
