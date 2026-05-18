import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLifeSync } from "../../context/LifeSyncContext";
import { lifesyncFetch } from "../../lib/lifesyncApi";
import {
  AnimatePresence,
  lifeSyncDollyPageTransition,
  lifeSyncDollyPageVariants,
  lifeSyncSectionPresenceTransition,
  lifeSyncSectionPresenceVariants,
  MotionDiv,
} from "../../lib/lifesyncMotion";

const DAY_ORDER = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const DAY_LABELS = { monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu", friday: "Fri", saturday: "Sat", sunday: "Sun" };
const DAY_FULL = { monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday", thursday: "Thursday", friday: "Friday", saturday: "Saturday", sunday: "Sunday" };

function getTodayKey() {
  const d = new Date().getDay(); // 0=Sun
  return ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"][d];
}

// ── Icons ──────────────────────────────────────────────────────────────────────
const IconClock = () => (
  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <circle cx="12" cy="12" r="9" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 3" />
  </svg>
);
const IconPlay = () => (
  <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M8 5v14l11-7z" />
  </svg>
);
const IconRefresh = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M20.49 9A9 9 0 0 0 5.64 5.64L4 4m0 16 1.64-1.64A9 9 0 0 0 18.36 18.36L20 20" />
  </svg>
);
const IconCalendar = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);
const IconTv = () => (
  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <rect x="2" y="3" width="20" height="14" rx="2" /><path strokeLinecap="round" d="M8 21h8M12 17v4" />
  </svg>
);

// ── Skeleton ───────────────────────────────────────────────────────────────────
function SkeletonCards({ count = 4 }) {
  return (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse overflow-hidden rounded-2xl border border-(--color-border-soft) bg-(--color-surface)">
          <div className="aspect-2/3 w-full bg-(--color-surface-muted)" />
          <div className="p-2.5 space-y-2">
            <div className="h-3 w-3/4 rounded bg-(--color-surface-muted)" />
            <div className="h-2 w-1/2 rounded bg-(--color-surface-muted)" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Release status badge color helpers ────────────────────────────────────────
function releaseStatusColor(status) {
  if (!status) return null;
  const s = status.toLowerCase();
  if (s.includes("upcoming")) return "bg-amber-500/90 text-white";
  if (s.includes("not released")) return "bg-red-500/85 text-white";
  if (s.includes("released") || s.includes("aired")) return "bg-emerald-500/85 text-white";
  return "bg-black/55 text-white";
}

// ── Anime card in schedule ─────────────────────────────────────────────────────
function ScheduleCard({ entry, onSelect }) {
  const pic = entry?.poster || entry?.image || entry?.main_picture?.large || entry?.main_picture?.medium;
  const airTime = entry?.airTime;
  const airDate = entry?.airDate;
  const releaseStatus = entry?.releaseStatus;
  const statusColor = releaseStatusColor(releaseStatus);

  return (
    <button
      type="button"
      onClick={() => onSelect?.(entry)}
      className="group w-full text-left"
    >
      <div className="relative overflow-hidden rounded-2xl border border-(--color-border-soft) bg-(--color-surface) shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
        <div className="relative aspect-2/3 w-full overflow-hidden bg-(--color-surface-muted)">
          {pic ? (
            <img
              src={pic}
              alt=""
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-(--color-text-secondary)">
              <IconTv />
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/70 via-black/10 to-transparent" />

          {/* Episode badge top-right */}
          {entry?.episodeNumber != null && (
            <span className="absolute right-2 top-2 rounded-lg bg-primary px-1.5 py-0.5 text-[9px] font-black text-(--color-ink-strong)">
              EP {entry.episodeNumber}
            </span>
          )}

          {/* Release status top-left */}
          {releaseStatus && statusColor && (
            <span className={`absolute left-2 top-2 rounded-lg px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide backdrop-blur-sm ${statusColor}`}>
              {releaseStatus}
            </span>
          )}

          {/* Bottom info */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 p-2.5">
            <p className="line-clamp-2 text-[11px] font-bold leading-tight text-white drop-shadow">
              {entry?.title}
            </p>
            {/* Air time / date */}
            {(airTime || airDate) && (
              <span className="mt-1 inline-flex items-center gap-1 text-[9px] font-semibold text-white/75">
                <IconClock />
                {airDate && airTime ? `${airDate} · ${airTime}` : airDate || airTime}
              </span>
            )}
          </div>

          <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/90 text-(--color-ink-strong) shadow-lg">
              <IconPlay />
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}

// ── Format full datetime for display ──────────────────────────────────────────
function formatAirDateTime(fullAirDateTime, airDate, airTime) {
  if (fullAirDateTime) {
    // "2026-05-18 06:30:00" → "May 18, 2026 · 06:30"
    try {
      const [datePart, timePart] = fullAirDateTime.split(" ");
      const d = new Date(datePart + "T" + timePart + "Z");
      if (!isNaN(d.getTime())) {
        const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
        const timeStr = timePart.slice(0, 5);
        return `${dateStr} · ${timeStr} UTC`;
      }
    } catch { /* fallback */ }
  }
  if (airDate && airTime) return `${airDate} · ${airTime}`;
  return airDate || airTime || null;
}

// ── Countdown helper: ms until air datetime ───────────────────────────────────
function useCountdown(fullAirDateTime) {
  const [timeLeft, setTimeLeft] = useState(() => {
    if (!fullAirDateTime) return null;
    return new Date(fullAirDateTime.replace(" ", "T") + "Z").getTime() - Date.now();
  });

  useEffect(() => {
    if (!fullAirDateTime) return;
    const target = new Date(fullAirDateTime.replace(" ", "T") + "Z").getTime();
    const tick = () => setTimeLeft(target - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [fullAirDateTime]);

  return timeLeft;
}

function CountdownDisplay({ fullAirDateTime }) {
  const ms = useCountdown(fullAirDateTime);
  if (ms == null) return null;
  if (ms <= 0) return <span className="text-[11px] font-semibold text-emerald-500">Airing now / aired</span>;

  const totalSecs = Math.floor(ms / 1000);
  const d = Math.floor(totalSecs / 86400);
  const h = Math.floor((totalSecs % 86400) / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;

  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0 || d > 0) parts.push(`${h}h`);
  if (m > 0 || h > 0 || d > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);

  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-primary">
      <svg className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
        <circle cx="12" cy="12" r="9" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 3" />
      </svg>
      {parts.join(" ")}
    </span>
  );
}

// ── Detail drawer ──────────────────────────────────────────────────────────────
function DetailDrawer({ entry, onClose, onWatch }) {
  const pic = entry?.poster || entry?.image || entry?.main_picture?.large;
  const displayTime = formatAirDateTime(entry?.fullAirDateTime, entry?.airDate, entry?.airTime);
  const releaseStatus = entry?.releaseStatus;
  const subStatus = entry?.subStatus;
  const statusColor = releaseStatusColor(releaseStatus);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  return (
    <MotionDiv
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
      onClick={onClose}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="fixed inset-0 bg-black/55 backdrop-blur-sm" />
      <MotionDiv
        className="relative w-full max-w-sm overflow-hidden rounded-t-3xl sm:rounded-3xl bg-(--color-surface) shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 30 }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-(--color-border-soft)" />
        </div>

        <div className="p-5">
          <div className="flex gap-4">
            <div className="relative h-[96px] w-[66px] shrink-0 overflow-hidden rounded-xl bg-(--color-surface-muted)">
              {pic && <img src={pic} alt="" className="h-full w-full object-cover" loading="lazy" />}
            </div>
            <div className="min-w-0 flex-1 pr-6">
              <h2 className="line-clamp-3 text-[15px] font-bold leading-snug text-(--color-text-primary)">
                {entry?.title}
              </h2>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {entry?.episodeNumber != null && (
                  <span className="rounded-lg bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                    EP {entry.episodeNumber}
                  </span>
                )}
                {releaseStatus && statusColor && (
                  <span className={`rounded-lg px-2 py-0.5 text-[10px] font-bold ${statusColor}`}>
                    {releaseStatus}
                  </span>
                )}
                {subStatus && (
                  <span className="rounded-lg bg-(--color-surface-muted) px-2 py-0.5 text-[10px] font-semibold text-(--color-text-secondary)">
                    {subStatus}
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full bg-(--color-surface-muted) text-(--color-text-secondary) hover:text-(--color-text-primary) transition"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Air time + countdown */}
          {(displayTime || entry?.fullAirDateTime) && (
            <div className="mt-3.5 overflow-hidden rounded-xl border border-(--color-border-soft) bg-(--color-surface-muted) px-3 py-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                {displayTime && (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-(--color-text-secondary)">
                    <IconClock />
                    {displayTime}
                  </span>
                )}
                {entry?.fullAirDateTime && <CountdownDisplay fullAirDateTime={entry.fullAirDateTime} />}
              </div>
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => onWatch?.(entry)}
              className="flex flex-1 min-h-11 items-center justify-center gap-2 rounded-2xl bg-primary text-[13px] font-bold text-(--color-ink-strong) transition hover:brightness-95 active:scale-[0.98]"
            >
              <IconPlay />
              Watch Now
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex min-h-11 items-center justify-center rounded-2xl border border-(--color-border-soft) px-4 text-[13px] font-semibold text-(--color-text-secondary) transition hover:bg-(--color-surface-muted)"
            >
              Close
            </button>
          </div>
        </div>
      </MotionDiv>
    </MotionDiv>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function LifeSyncAnimeSchedule() {
  const { isLifeSyncConnected } = useLifeSync();
  const navigate = useNavigate();

  const [schedule, setSchedule] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [activeDay, setActiveDay] = useState(getTodayKey);
  const [selected, setSelected] = useState(null);
  const todayKey = getTodayKey();

  const fetchSchedule = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const res = await lifesyncFetch("/api/v1/anime/schedule");
      setSchedule(res?.schedule || res || null);
    } catch (e) {
      setError(e?.message || "Failed to load schedule");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (isLifeSyncConnected) fetchSchedule();
  }, [isLifeSyncConnected, fetchSchedule]);

  const dayEntries = useMemo(() => {
    if (!schedule) return [];
    return Array.isArray(schedule[activeDay]) ? schedule[activeDay] : [];
  }, [schedule, activeDay]);

  // Sort by air time
  const sortedEntries = useMemo(() => {
    return [...dayEntries].sort((a, b) => {
      const ta = a?.airTime || "";
      const tb = b?.airTime || "";
      if (!ta && !tb) return 0;
      if (!ta) return 1;
      if (!tb) return -1;
      return ta.localeCompare(tb);
    });
  }, [dayEntries]);

  // Day episode counts for badges
  const dayCounts = useMemo(() => {
    if (!schedule) return {};
    const out = {};
    for (const day of DAY_ORDER) {
      out[day] = Array.isArray(schedule[day]) ? schedule[day].length : 0;
    }
    return out;
  }, [schedule]);

  const handleWatch = useCallback((entry) => {
    const slug = entry?.slug || entry?.id;
    if (!slug) return;
    const preview = {
      id: String(slug),
      title: entry?.title || slug,
      poster: entry?.poster || entry?.image || entry?.main_picture?.large,
    };
    navigate(
      `/dashboard/lifesync/anime/anime/home/page/1/detail/${encodeURIComponent(String(slug))}`,
      { state: { animeDetailPreview: preview } },
    );
    setSelected(null);
  }, [navigate]);

  if (!isLifeSyncConnected) {
    return (
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-1 text-[28px] font-bold tracking-tight text-(--color-text-primary)">Anime Schedule</h1>
        <p className="mb-4 max-w-xl text-[13px] leading-relaxed text-(--color-text-secondary)">Connect LifeSync to see the weekly anime schedule.</p>
        <Link
          to="/dashboard/profile?tab=integrations"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-[13px] font-semibold text-(--color-ink-strong) shadow-sm transition-all hover:brightness-95"
        >
          Go to Integrations
        </Link>
      </div>
    );
  }

  return (
    <MotionDiv
      className="space-y-5 sm:space-y-7"
      initial="initial" animate="animate"
      variants={lifeSyncDollyPageVariants}
      transition={lifeSyncDollyPageTransition}
    >
      {/* Header */}
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-(--color-text-secondary)">LifeSync / Anime</p>
          <h1 className="mt-0.5 text-[24px] font-black tracking-tight text-(--color-text-primary) sm:text-[28px]">Schedule</h1>
          <p className="mt-1 text-[13px] text-(--color-text-secondary)">Weekly anime air schedule from Anineko.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/dashboard/lifesync/anime/anime/calendar"
            className="inline-flex items-center gap-2 rounded-xl border border-(--color-border-soft) bg-(--color-surface) px-3 py-2 text-[12px] font-semibold text-(--color-text-secondary) transition hover:bg-(--color-surface-muted)"
          >
            <IconCalendar />
            Calendar
          </Link>
          <button
            type="button"
            onClick={fetchSchedule}
            disabled={busy}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-(--color-border-soft) bg-(--color-surface) text-(--color-text-secondary) transition hover:bg-(--color-surface-muted) disabled:opacity-50"
          >
            <span className={busy ? "animate-spin" : ""}><IconRefresh /></span>
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] font-medium text-red-600">
          {error}
        </div>
      )}

      {/* Day selector tabs */}
      <div className="overflow-hidden rounded-2xl border border-(--color-border-soft) bg-(--color-surface)">
        <div className="flex overflow-x-auto hide-scrollbar">
          {DAY_ORDER.map((day) => {
            const isToday = day === todayKey;
            const isActive = day === activeDay;
            const count = dayCounts[day] || 0;
            return (
              <button
                key={day}
                type="button"
                onClick={() => setActiveDay(day)}
                className={`relative flex min-w-0 flex-1 flex-col items-center gap-1 px-3 py-3 transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-(--color-text-secondary) hover:bg-(--color-surface-muted) hover:text-(--color-text-primary)"
                }`}
              >
                {/* Today indicator */}
                {isToday && (
                  <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
                )}
                <span className={`text-[11px] font-black uppercase tracking-wide ${isActive ? "text-primary" : ""}`}>
                  {DAY_LABELS[day]}
                </span>
                {count > 0 ? (
                  <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold tabular-nums ${
                    isActive ? "bg-primary text-(--color-ink-strong)" : "bg-(--color-surface-muted) text-(--color-text-secondary)"
                  }`}>
                    {count}
                  </span>
                ) : (
                  <span className="h-4 w-4" />
                )}
                {/* Active underline */}
                {isActive && (
                  <MotionDiv
                    layoutId="schedule-day-underline"
                    className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-primary"
                    transition={{ type: "spring", stiffness: 400, damping: 35 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Day heading */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <h2 className="text-[18px] font-black text-(--color-text-primary)">
            {DAY_FULL[activeDay]}
          </h2>
          {activeDay === todayKey && (
            <span className="rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-(--color-ink-strong)">
              Today
            </span>
          )}
        </div>
        {sortedEntries.length > 0 && (
          <span className="text-[12px] text-(--color-text-secondary)">
            {sortedEntries.length} title{sortedEntries.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Grid */}
      <AnimatePresence mode="wait" initial={false}>
        <MotionDiv
          key={activeDay}
          initial="initial" animate="animate" exit="exit"
          variants={lifeSyncSectionPresenceVariants}
          transition={lifeSyncSectionPresenceTransition}
        >
          {busy && !schedule ? (
            <SkeletonCards count={8} />
          ) : sortedEntries.length > 0 ? (
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {sortedEntries.map((entry, i) => (
                <ScheduleCard
                  key={entry?.slug || entry?.id || i}
                  entry={entry}
                  onSelect={setSelected}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-(--color-border-soft) bg-(--color-surface) px-6 py-14 text-center">
              {busy ? (
                <div className="flex items-center justify-center gap-2 text-(--color-text-secondary)">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <span className="text-[13px]">Loading schedule…</span>
                </div>
              ) : (
                <>
                  <p className="text-[14px] font-semibold text-(--color-text-primary)">No episodes scheduled</p>
                  <p className="mt-1 text-[12px] text-(--color-text-secondary)">Nothing airing on {DAY_FULL[activeDay]} this week.</p>
                </>
              )}
            </div>
          )}
        </MotionDiv>
      </AnimatePresence>

      {/* Full week overview strip */}
      {schedule && !busy && (
        <div className="overflow-hidden rounded-2xl border border-(--color-border-soft) bg-(--color-surface)">
          <div className="border-b border-(--color-border-soft) px-4 py-3">
            <p className="text-[11px] font-black uppercase tracking-widest text-(--color-text-secondary)">This Week</p>
          </div>
          <div className="divide-y divide-(--color-border-soft)">
            {DAY_ORDER.map((day) => {
              const entries = Array.isArray(schedule[day]) ? schedule[day] : [];
              const isToday = day === todayKey;
              const isActive = day === activeDay;
              if (entries.length === 0) return null;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => setActiveDay(day)}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-(--color-surface-muted) ${isActive ? "bg-primary/5" : ""}`}
                >
                  <div className="w-20 shrink-0">
                    <span className={`text-[12px] font-bold ${isToday ? "text-primary" : "text-(--color-text-primary)"}`}>
                      {DAY_FULL[day]}
                    </span>
                    {isToday && <span className="ml-1.5 text-[9px] font-black uppercase text-primary">Today</span>}
                  </div>
                  {/* Poster strip */}
                  <div className="flex min-w-0 flex-1 gap-1.5 overflow-hidden">
                    {entries.slice(0, 8).map((entry, i) => {
                      const pic = entry?.poster || entry?.image || entry?.main_picture?.medium;
                      return (
                        <div
                          key={entry?.slug || i}
                          className="h-8 w-6 shrink-0 overflow-hidden rounded-md bg-(--color-surface-muted)"
                        >
                          {pic && <img src={pic} alt="" className="h-full w-full object-cover" loading="lazy" />}
                        </div>
                      );
                    })}
                    {entries.length > 8 && (
                      <div className="flex h-8 w-6 shrink-0 items-center justify-center rounded-md bg-(--color-surface-muted) text-[8px] font-bold text-(--color-text-secondary)">
                        +{entries.length - 8}
                      </div>
                    )}
                  </div>
                  <span className="shrink-0 text-[11px] font-semibold text-(--color-text-secondary)">
                    {entries.length} title{entries.length !== 1 ? "s" : ""}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Detail drawer */}
      <AnimatePresence>
        {selected && (
          <DetailDrawer
            key={selected?.slug || selected?.id}
            entry={selected}
            onClose={() => setSelected(null)}
            onWatch={handleWatch}
          />
        )}
      </AnimatePresence>
    </MotionDiv>
  );
}
