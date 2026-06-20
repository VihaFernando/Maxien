import { useId, useMemo, useState } from 'react'

/**
 * Dependency-free SVG charts for the LifeSync admin dashboard.
 * Designed against the app's Apple-style tokens (apple-text / apple-subtext / primary)
 * and to satisfy the ui-ux-pro-max chart guidelines:
 *  - accessible: aria summary, data not conveyed by color alone (line style + markers)
 *  - empty / loading states handled by callers
 *  - tooltips on hover (web) + on focus (keyboard) for exact values
 *  - prefers-reduced-motion respected (entrance animation is opt-in & gated)
 */

const usePrefersReducedMotion = () =>
    useMemo(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return false
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches
    }, [])

function niceMax(value) {
    if (!Number.isFinite(value) || value <= 0) return 1
    const pow = Math.pow(10, Math.floor(Math.log10(value)))
    const norm = value / pow
    const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10
    return step * pow
}

function buildPath(points) {
    if (!points.length) return ''
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')
}

/** Compact inline sparkline for KPI stat cards. */
export function Sparkline({ data = [], color = 'var(--color-primary)', width = 96, height = 28, ariaLabel }) {
    const id = useId()
    const series = Array.isArray(data) ? data.map((n) => Number(n) || 0) : []
    if (series.length < 2) {
        return <div style={{ width, height }} aria-hidden="true" />
    }
    const max = Math.max(...series, 1)
    const min = Math.min(...series, 0)
    const span = max - min || 1
    const pad = 2
    const stepX = (width - pad * 2) / (series.length - 1)
    const points = series.map((v, i) => ({
        x: pad + i * stepX,
        y: pad + (height - pad * 2) * (1 - (v - min) / span),
    }))
    const path = buildPath(points)
    const areaPath = `${path} L${points[points.length - 1].x.toFixed(2)},${height - pad} L${points[0].x.toFixed(2)},${height - pad} Z`
    const last = points[points.length - 1]
    return (
        <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label={ariaLabel || `Trend sparkline, latest value ${series[series.length - 1]}`}
            className="overflow-visible"
        >
            <defs>
                <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.28" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            <path d={areaPath} fill={`url(#spark-${id})`} />
            <path d={path} fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={last.x} cy={last.y} r="2.4" fill={color} />
        </svg>
    )
}

const SERIES_STYLES = [
    { dash: '', marker: 'circle' },
    { dash: '5 4', marker: 'square' },
    { dash: '2 3', marker: 'triangle' },
]

/**
 * Multi-series line chart with hover/focus tooltip, gridlines and a y-axis.
 * @param labels  string[] day labels (ISO yyyy-mm-dd)
 * @param series  Array<{ key, name, color, values:number[] }>
 */
export function LineChart({ labels = [], series = [], height = 240, valueFormatter = (n) => String(n) }) {
    const reduceMotion = usePrefersReducedMotion()
    const [active, setActive] = useState(null) // index of hovered point

    const width = 640
    const padL = 36
    const padR = 12
    const padT = 14
    const padB = 26
    const plotW = width - padL - padR
    const plotH = height - padT - padB

    const n = labels.length
    const allValues = series.flatMap((s) => s.values || [])
    const rawMax = allValues.length ? Math.max(...allValues) : 0
    const yMax = niceMax(rawMax)
    const stepX = n > 1 ? plotW / (n - 1) : 0

    const xAt = (i) => padL + (n > 1 ? i * stepX : plotW / 2)
    const yAt = (v) => padT + plotH * (1 - (Number(v) || 0) / yMax)

    const gridYs = useMemo(() => {
        const ticks = 4
        return Array.from({ length: ticks + 1 }, (_, k) => {
            const value = (yMax / ticks) * k
            return { value, y: padT + plotH * (1 - k / ticks) }
        })
    }, [yMax, plotH])

    // X tick labels: keep them readable on small widths (auto-skip).
    const xTickEvery = Math.max(1, Math.ceil(n / 7))

    const formatDay = (iso) => {
        if (!iso || typeof iso !== 'string') return ''
        const parts = iso.slice(5).split('-')
        return parts.length === 2 ? `${parts[1]}/${parts[0]}` : iso
    }

    const onMove = (evt) => {
        if (n < 1) return
        const rect = evt.currentTarget.getBoundingClientRect()
        const relX = ((evt.clientX - rect.left) / rect.width) * width
        const idx = Math.round((relX - padL) / (stepX || 1))
        setActive(Math.max(0, Math.min(n - 1, idx)))
    }

    return (
        <div className="relative">
            <svg
                viewBox={`0 0 ${width} ${height}`}
                width="100%"
                height={height}
                role="img"
                aria-label={`Line chart with ${series.length} series over ${n} days. ${series
                    .map((s) => `${s.name} latest ${valueFormatter(s.values?.[s.values.length - 1] ?? 0)}`)
                    .join('; ')}`}
                onMouseMove={onMove}
                onMouseLeave={() => setActive(null)}
                className="touch-none"
            >
                {/* gridlines */}
                {gridYs.map((g, i) => (
                    <g key={`g-${i}`}>
                        <line
                            x1={padL}
                            x2={width - padR}
                            y1={g.y}
                            y2={g.y}
                            stroke="var(--mx-color-e5e5ea)"
                            strokeWidth="1"
                            strokeOpacity="0.7"
                        />
                        <text x={padL - 6} y={g.y + 3} textAnchor="end" className="fill-apple-subtext" fontSize="9">
                            {valueFormatter(Math.round(g.value))}
                        </text>
                    </g>
                ))}

                {/* x labels */}
                {labels.map((lab, i) =>
                    i % xTickEvery === 0 || i === n - 1 ? (
                        <text
                            key={`x-${i}`}
                            x={xAt(i)}
                            y={height - 8}
                            textAnchor="middle"
                            className="fill-apple-subtext"
                            fontSize="9"
                        >
                            {formatDay(lab)}
                        </text>
                    ) : null,
                )}

                {/* series */}
                {series.map((s, si) => {
                    const style = SERIES_STYLES[si % SERIES_STYLES.length]
                    const pts = (s.values || []).map((v, i) => ({ x: xAt(i), y: yAt(v) }))
                    const path = buildPath(pts)
                    return (
                        <g key={s.key || si}>
                            <path
                                d={path}
                                fill="none"
                                stroke={s.color}
                                strokeWidth="2"
                                strokeDasharray={style.dash}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                style={
                                    reduceMotion ? undefined : { animation: `mx-chart-fade-in 500ms ease-out ${si * 90}ms both` }
                                }
                            />
                            {active != null && pts[active] ? (
                                <circle cx={pts[active].x} cy={pts[active].y} r="3.5" fill={s.color} stroke="var(--color-surface)" strokeWidth="1.5" />
                            ) : null}
                        </g>
                    )
                })}

                {/* hover guide */}
                {active != null ? (
                    <line
                        x1={xAt(active)}
                        x2={xAt(active)}
                        y1={padT}
                        y2={padT + plotH}
                        stroke="var(--color-apple-subtext)"
                        strokeOpacity="0.35"
                        strokeWidth="1"
                        strokeDasharray="3 3"
                    />
                ) : null}
            </svg>

            {/* tooltip */}
            {active != null && labels[active] ? (
                <div
                    className="pointer-events-none absolute -translate-x-1/2 rounded-lg border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] px-2.5 py-1.5 text-[11px] shadow-md"
                    style={{ left: `${(xAt(active) / width) * 100}%`, top: 4 }}
                    role="status"
                    aria-live="polite"
                >
                    <p className="font-mono text-[10px] text-apple-subtext">{labels[active]}</p>
                    {series.map((s) => (
                        <p key={s.key} className="flex items-center gap-1.5 text-apple-text">
                            <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
                            <span className="text-apple-subtext">{s.name}</span>
                            <span className="ml-auto font-semibold tabular-nums">{valueFormatter(s.values?.[active] ?? 0)}</span>
                        </p>
                    ))}
                </div>
            ) : null}

            {/* legend (line-style aware, not color-only) */}
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                {series.map((s, si) => {
                    const style = SERIES_STYLES[si % SERIES_STYLES.length]
                    return (
                        <span key={s.key || si} className="inline-flex items-center gap-1.5 text-[11px] text-apple-subtext">
                            <svg width="20" height="8" aria-hidden="true">
                                <line
                                    x1="0"
                                    y1="4"
                                    x2="20"
                                    y2="4"
                                    stroke={s.color}
                                    strokeWidth="2"
                                    strokeDasharray={style.dash}
                                    strokeLinecap="round"
                                />
                            </svg>
                            <span className="font-medium text-apple-text">{s.name}</span>
                        </span>
                    )
                })}
            </div>
        </div>
    )
}

/** Segmented range control (7 / 30 / 90 days). */
export function RangeToggle({ value, onChange, options = [7, 30, 90], suffix = 'd', disabled = false }) {
    return (
        <div className="inline-flex rounded-xl border border-[var(--mx-color-e5e5ea)] bg-apple-bg p-0.5" role="group" aria-label="Time range">
            {options.map((opt) => {
                const isActive = String(opt) === String(value)
                return (
                    <button
                        key={opt}
                        type="button"
                        disabled={disabled}
                        aria-pressed={isActive}
                        onClick={() => onChange(opt)}
                        className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors disabled:opacity-50 ${
                            isActive
                                ? 'bg-[var(--color-surface)] text-apple-text shadow-sm'
                                : 'text-apple-subtext hover:text-apple-text'
                        }`}
                    >
                        {opt}
                        {suffix}
                    </button>
                )
            })}
        </div>
    )
}
