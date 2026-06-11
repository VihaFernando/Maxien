import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { FaChevronLeft, FaChevronRight, FaStar, FaTimes } from "react-icons/fa";
import { useLifeSync } from "../../context/LifeSyncContext";
import { lifesyncFetch } from "../../lib/lifesyncApi";
import { MediaPageHeader, MediaConnectPrompt } from "../../components/lifesync/MediaPageChrome";
import {
  AnimatePresence,
  lifeSyncDollyPageTransition,
  lifeSyncDollyPageVariants,
  lifeSyncModalSlideProps,
  lifeSyncStaggerContainerDense,
  lifeSyncStaggerItemFade,
  lifeSyncCalendarGridContainer,
  lifeSyncCalendarCellItem,
  lifeSyncSpringPageVariants,
  lifeSyncSpringPageTransition,
  lifeSyncStatBlockContainer,
  lifeSyncStatBlockItem,
  lifeSyncDrawerSpring,
  MotionDiv,
} from "../../lib/lifesyncMotion";

function isoDayKey(d) {
  try {
    const x = new Date(d);
    const y = x.getFullYear();
    const m = String(x.getMonth() + 1).padStart(2, "0");
    const day = String(x.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  } catch {
    return "";
  }
}

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isToday(date) {
  return isSameDay(date, new Date());
}

function clampPriority(n, fallback = 3) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  const i = Math.floor(v);
  return Math.min(Math.max(i, 1), 10);
}

function monthKey(d, tz = "UTC") {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const z = String(tz || "UTC").trim() || "UTC";
  return `${y}-${m}-${z}`;
}

function readMonthCache(key) {
  try {
    const raw = sessionStorage.getItem(`maxien_anime_calendar_month_${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (!parsed.days || typeof parsed.days !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeMonthCache(key, payload) {
  try {
    sessionStorage.setItem(
      `maxien_anime_calendar_month_${key}`,
      JSON.stringify({
        at: Date.now(),
        days: payload?.days && typeof payload.days === "object" ? payload.days : {},
        pins: Array.isArray(payload?.pins) ? payload.pins : [],
      }),
    );
  } catch {
    /* ignore */
  }
}

function normalizeRoute(route) {
  const r = String(route || "").trim().replace(/^\/+|\/+$/g, "");
  if (!r) return "";
  return /^[a-z0-9-]+$/i.test(r) ? r : "";
}

function pinKeyFromItem(item) {
  const animeId = String(item?.animeId ?? "").trim();
  if (animeId) return `anineko:${animeId}`;
  const r = normalizeRoute(item?.route);
  if (r) return `route:${r}`;
  return "";
}

function addDays(date, deltaDays) {
  const d = new Date(date);
  d.setDate(d.getDate() + Number(deltaDays || 0));
  return d;
}

function safeString(x) {
  return typeof x === "string" ? x : x == null ? "" : String(x);
}

function formatClock(ms, tz) {
  if (!ms || !Number.isFinite(ms)) return "";
  try {
    return new Date(ms).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      ...(tz ? { timeZone: tz } : {}),
    });
  } catch {
    return "";
  }
}

export default function LifeSyncAnimeCalendar() {
  const { isLifeSyncConnected } = useLifeSync();
  const location = useLocation();
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [days, setDays] = useState({});
  const [pins, setPins] = useState([]);

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDayOverlay, setShowDayOverlay] = useState(false);
  const [dayPageSize, setDayPageSize] = useState(20);

  const clientTz =
    Intl?.DateTimeFormat?.().resolvedOptions?.().timeZone || "UTC";

  const abortRef = useRef(null);
  const debounceRef = useRef(null);
  const monthKeyRef = useRef(monthKey(currentDate, clientTz));

  useEffect(() => {
    const sp = new URLSearchParams(location.search || "");
    const raw = sp.get("date");
    if (!raw) return;
    const d = new Date(raw);
    if (!Number.isFinite(d.getTime())) return;

    setCurrentDate(new Date(d.getFullYear(), d.getMonth(), 1));
    setSelectedDate(d);
    setShowDayOverlay(true);
  }, [location.search]);

  const pinMap = useMemo(() => {
    const m = new Map();
    for (const p of Array.isArray(pins) ? pins : []) {
      const k = String(p?.key || "").trim();
      if (k) m.set(k, p);
    }
    return m;
  }, [pins]);

  const loadMonth = useCallback(async ({ background = false } = {}) => {
    if (!isLifeSyncConnected) return;
    const key = monthKey(currentDate, clientTz);
    monthKeyRef.current = key;

    const cached = readMonthCache(key);
    if (cached && !background) {
      setDays(cached.days || {});
      setPins(Array.isArray(cached.pins) ? cached.pins : []);
    }

    if (!background) {
      // Show the calendar shell immediately; only the schedules are loading.
      setBusy(true);
      setError("");
    }

    if (abortRef.current) abortRef.current.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const res = await lifesyncFetch(
        `/api/v1/anime/calendar/month?year=${year}&month=${month}&tz=${encodeURIComponent(
          clientTz,
        )}&view=standard`,
        { signal: ac.signal },
      );
      const nextDays = res?.days && typeof res.days === "object" ? res.days : {};
      const nextPins = Array.isArray(res?.pins) ? res.pins : [];
      setDays(nextDays);
      setPins(nextPins);
      writeMonthCache(key, { days: nextDays, pins: nextPins });
    } catch (e) {
      if (e?.name === "AbortError") return;
      if (!background) {
        setError(e?.message || "Failed to load anime calendar.");
        if (!cached) setDays({});
      }
    } finally {
      if (!background) setBusy(false);
    }
  }, [currentDate, isLifeSyncConnected, clientTz]);

  useEffect(() => {
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null;
      // Instant render: show cached data first, then refresh (without blocking UI).
      loadMonth({ background: false });
    }, 150);
    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      if (abortRef.current) abortRef.current.abort();
    };
  }, [loadMonth]);

  const monthLabel = useMemo(() => {
    return currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }, [currentDate]);

  const itemsForSelectedDay = useMemo(() => {
    const key = isoDayKey(selectedDate);
    const arr = Array.isArray(days?.[key]) ? days[key] : [];
    return arr;
  }, [days, selectedDate]);

  const pinOrUpdatePriority = useCallback(
    async (itemOrKey, priority) => {
      const key =
        typeof itemOrKey === "string"
          ? String(itemOrKey).trim()
          : pinKeyFromItem(itemOrKey);
      if (!key) return;
      const nextPriority = clampPriority(priority, 3);

      // Optimistic: update pins + day items immediately.
      const prevPins = pins;
      const prevDays = days;
      const nextPins = (() => {
        const rest = (Array.isArray(prevPins) ? prevPins : []).filter((p) => String(p?.key) !== key);
        const item = typeof itemOrKey === "object" && itemOrKey ? itemOrKey : null;
        const animeId = item?.animeId != null ? String(item.animeId) : null;
        const route = item?.route != null ? String(item.route) : null;
        const title = typeof item?.title === "string" ? item.title : "";
        const imageUrl = typeof item?.imageUrl === "string" ? item.imageUrl : "";
        rest.push({
          key,
          ...(animeId ? { animeId } : {}),
          ...(route && normalizeRoute(route) ? { route: normalizeRoute(route) } : {}),
          ...(title ? { title } : {}),
          ...(imageUrl ? { imageUrl } : {}),
          priority: nextPriority,
          pinnedAt: new Date().toISOString(),
        });
        rest.sort((a, b) => Number(a?.priority || 0) - Number(b?.priority || 0));
        return rest;
      })();
      const nextDays = { ...(prevDays || {}) };
      for (const k of Object.keys(nextDays)) {
        const arr = Array.isArray(nextDays[k]) ? nextDays[k] : [];
        nextDays[k] = arr.map((it) =>
          pinKeyFromItem(it) === key ? { ...it, isPinned: true, priority: nextPriority } : it,
        );
      }
      setPins(nextPins);
      setDays(nextDays);
      writeMonthCache(monthKeyRef.current, { days: nextDays, pins: nextPins });

      try {
        await lifesyncFetch("/api/v1/anime/calendar/pins", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key,
            ...(typeof itemOrKey === "object" && itemOrKey
              ? {
                  animeId: itemOrKey?.animeId ?? null,
                  route: itemOrKey?.route ?? null,
                  title: itemOrKey?.title ?? "",
                  imageUrl: itemOrKey?.imageUrl ?? "",
                }
              : {}),
            priority: nextPriority,
          }),
        });
      } catch (e) {
        setPins(prevPins);
        setDays(prevDays);
        writeMonthCache(monthKeyRef.current, { days: prevDays, pins: prevPins });
        setError(e?.message || "Failed to update pin.");
      }
    },
    [days, pins],
  );

  const unpin = useCallback(
    async (itemOrKey) => {
      const key =
        typeof itemOrKey === "string"
          ? String(itemOrKey).trim()
          : pinKeyFromItem(itemOrKey);
      if (!key) return;
      const prevPins = pins;
      const prevDays = days;

      const nextPins = (Array.isArray(prevPins) ? prevPins : []).filter((p) => String(p?.key) !== key);
      const nextDays = { ...(prevDays || {}) };
      for (const k of Object.keys(nextDays)) {
        const arr = Array.isArray(nextDays[k]) ? nextDays[k] : [];
        nextDays[k] = arr.map((it) =>
          pinKeyFromItem(it) === key ? { ...it, isPinned: false, priority: null } : it,
        );
      }
      setPins(nextPins);
      setDays(nextDays);
      writeMonthCache(monthKeyRef.current, { days: nextDays, pins: nextPins });

      try {
        await lifesyncFetch(`/api/v1/anime/calendar/pins/key/${encodeURIComponent(key)}`, {
          method: "DELETE",
        });
      } catch (e) {
        setPins(prevPins);
        setDays(prevDays);
        writeMonthCache(monthKeyRef.current, { days: prevDays, pins: prevPins });
        setError(e?.message || "Failed to unpin.");
      }
    },
    [days, pins],
  );

  if (!isLifeSyncConnected) {
    return (
      <MediaConnectPrompt
        accent="calendar"
        title="Anime calendar locked"
        body="Connect LifeSync in your profile to track weekly broadcast schedules and pin your shows."
      />
    );
  }

  const MonthGrid = () => {
    const y = currentDate.getFullYear();
    const m = currentDate.getMonth();

    // Render a full 6-week calendar grid (42 cells), including adjacent month days.
    const firstOfMonth = new Date(y, m, 1);
    const gridStart = new Date(firstOfMonth);
    gridStart.setDate(firstOfMonth.getDate() - firstOfMonth.getDay()); // Sunday before (or same day)

    const cells = Array.from({ length: 42 }).map((_, i) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + i);

      const inMonth = date.getMonth() === m;
      const key = isoDayKey(date);
      const list = Array.isArray(days?.[key]) ? days[key] : [];
      const pinnedCount = list.filter((x) => x?.isPinned).length;
      const isCur = isToday(date);

      return (
        <button
          key={key}
          type="button"
          onClick={() => {
            if (!inMonth) {
              setCurrentDate(new Date(date.getFullYear(), date.getMonth(), 1));
            }
            setSelectedDate(date);
            setDayPageSize(20);
            setShowDayOverlay(true);
          }}
          className={`w-full rounded-xl p-1 sm:p-2 md:p-3 min-h-14 sm:min-h-20 md:min-h-28 border text-left transition-all ${
            isCur
              ? "bg-(--mx-color-c6ff00)/10 border-(--mx-color-c6ff00) ring-1 ring-(--mx-color-c6ff00)/50"
              : inMonth
                ? "bg-[var(--color-surface)] border-[var(--mx-color-d2d2d7)]/40 hover:border-[var(--mx-color-d2d2d7)] hover:shadow-sm"
                : "bg-[var(--mx-color-fafafa)] border-[var(--mx-color-e5e5ea)] hover:border-[var(--mx-color-d2d2d7)] hover:shadow-sm opacity-85"
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div
              className={`text-[10px] sm:text-xs md:text-sm font-semibold ${
                isCur ? "text-[var(--mx-color-9ecb00)]" : inMonth ? "text-[var(--mx-color-1d1d1f)]" : "text-[var(--mx-color-86868b)]"
              }`}
            >
              <span
                className={
                  isCur
                    ? "bg-[var(--mx-color-c6ff00)] text-[var(--mx-color-1d1d1f)] px-2 py-0.5 rounded-full"
                    : ""
                }
              >
                {date.getDate()}
              </span>
            </div>
            {pinnedCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--mx-color-c6ff00)]/20 px-2 py-0.5 text-[10px] font-bold text-[var(--mx-color-1d1d1f)]">
                <FaStar className="h-2.5 w-2.5" aria-hidden />
                {pinnedCount}
              </span>
            )}
          </div>

          <div className="mt-1.5 hidden sm:block space-y-1 overflow-hidden">
            {list.slice(0, 2).map((it, idx) => (
              <div
                key={`${it.animeId || it.title}-${it.episodeNumber}-${idx}`}
                className={`w-full truncate rounded-md px-2 py-1 text-[10px] font-medium ${
                  it?.isPinned
                    ? "bg-[var(--mx-color-c6ff00)]/15 text-[var(--mx-color-1d1d1f)]"
                    : "bg-[var(--mx-color-f5f5f7)] text-[var(--mx-color-424245)]"
                }`}
              >
                {it.title} · E{it.episodeNumber}
              </div>
            ))}
            {list.length > 2 && (
              <div className="px-2 text-[10px] font-medium text-[var(--mx-color-86868b)]">
                +{list.length - 2} more
              </div>
            )}
          </div>

          <div className="mt-2 flex flex-wrap gap-1 sm:hidden">
            {list.slice(0, 4).map((it, idx) => (
              <span
                key={`${it.animeId || it.title}-${it.episodeNumber}-${idx}`}
                className={`h-1.5 w-1.5 rounded-full ${
                  it?.isPinned ? "bg-[var(--mx-color-c6ff00)]" : "bg-[var(--mx-color-86868b)]"
                }`}
              />
            ))}
            {list.length > 4 && (
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--mx-color-d2d2d7)]" />
            )}
          </div>
        </button>
      );
    });

    return (
      <AnimatePresence mode="wait" initial={false}>
        <MotionDiv
          key={monthKey(currentDate, clientTz)}
          variants={lifeSyncCalendarGridContainer}
          initial="hidden"
          animate="show"
          exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.18 } }}
          className="grid grid-cols-7 gap-1 sm:gap-2"
        >
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <MotionDiv
              key={d}
              variants={lifeSyncCalendarCellItem}
              className="text-center font-semibold text-(--mx-color-86868b) text-[10px] sm:text-xs md:text-sm py-2 uppercase tracking-wider"
            >
              <span className="hidden sm:inline">{d}</span>
              <span className="sm:hidden">{d.charAt(0)}</span>
            </MotionDiv>
          ))}
          {cells.map((node, i) => (
            <MotionDiv
              key={`cell-${monthKey(currentDate, clientTz)}-${i}`}
              variants={lifeSyncCalendarCellItem}
              className="min-w-0"
            >
              {node}
            </MotionDiv>
          ))}
        </MotionDiv>
      </AnimatePresence>
    );
  };

  const DayOverlay = () => {
    const [filterMode, setFilterMode] = useState("all");
    const [sortMode, setSortMode] = useState("priority");
    const [query, setQuery] = useState("");
    const [activeKey, setActiveKey] = useState("");

    const searchAbortRef = useRef(null);

    const title = selectedDate.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    const normalizedItems = (() => {
      const list = Array.isArray(itemsForSelectedDay) ? itemsForSelectedDay : [];
      return list.map((it, idx) => {
        const key = pinKeyFromItem(it);
        const pin = key ? pinMap.get(key) : null;
        const isPinned = Boolean(it?.isPinned) || Boolean(pin);
        const priority = clampPriority(pin?.priority ?? it?.priority ?? 3, 3);
        const airedAtMs = it?.airedAt ? new Date(it.airedAt).getTime() : 0;
        return {
          ...it,
          _idx: idx,
          _pin: pin,
          _pinKey: key,
          _isPinned: isPinned,
          _priority: priority,
          _airedAtMs: Number.isFinite(airedAtMs) ? airedAtMs : 0,
          _rowKey: `${key || "row"}:${String(it?.animeId || "")}:${String(it?.route || "")}:${String(it?.episodeNumber || "")}:${idx}`,
        };
      });
    })();

    const filteredItems = useMemo(() => {
      let list = normalizedItems;

      if (filterMode === "pinned") {
        list = list.filter((it) => it._isPinned);
      }

      const q = query.trim().toLowerCase();
      if (q) {
        list = list.filter((it) => {
          const t = String(it?.title || "").toLowerCase();
          const e = String(it?.episodeTitle || "").toLowerCase();
          return t.includes(q) || e.includes(q);
        });
      }

      const out = [...list];
      out.sort((a, b) => {
        if (sortMode === "time") {
          if (a._airedAtMs !== b._airedAtMs) return a._airedAtMs - b._airedAtMs;
          if (a._isPinned !== b._isPinned) return a._isPinned ? -1 : 1;
          return a._idx - b._idx;
        }

        if (a._isPinned !== b._isPinned) return a._isPinned ? -1 : 1;
        if (a._isPinned && b._isPinned && a._priority !== b._priority) return a._priority - b._priority;
        if (a._airedAtMs !== b._airedAtMs) return a._airedAtMs - b._airedAtMs;
        return a._idx - b._idx;
      });

      return out;
    }, [filterMode, normalizedItems, query, sortMode]);

    useEffect(() => {
      // Ensure the details panel has a valid selection.
      const first = filteredItems[0];
      const nextKey = first?._rowKey || "";
      setActiveKey((prev) => {
        if (prev && filteredItems.some((x) => x._rowKey === prev)) return prev;
        return nextKey;
      });
    }, [filteredItems]);

    const total = normalizedItems.length;
    const pinnedTotal = normalizedItems.filter((it) => it._isPinned).length;
    const visibleItems = filteredItems.slice(0, Math.max(1, dayPageSize));
    const canMore = visibleItems.length < filteredItems.length;

    const pinnedPreview = useMemo(() => {
      return normalizedItems
        .filter((it) => it._isPinned)
        .sort((a, b) => {
          if (a._priority !== b._priority) return a._priority - b._priority;
          return a._airedAtMs - b._airedAtMs;
        })
        .slice(0, 6);
    }, [normalizedItems]);

    const activeItem = useMemo(() => {
      return filteredItems.find((x) => x._rowKey === activeKey) || null;
    }, [activeKey, filteredItems]);

    const openAnimeDetails = async (it) => {
      if (!it) return;
      const titleForSearch = safeString(it?.title).trim();
      const directSlug = safeString(it?.animeId).trim();

      if (directSlug) {
        const preview = {
          id: directSlug,
          title: titleForSearch || directSlug,
          poster: it?.imageUrl ? String(it.imageUrl) : undefined,
        };
        navigate(
          `/dashboard/lifesync/anime/anime/home/page/1/detail/${encodeURIComponent(directSlug)}`,
          { state: { animeDetailPreview: preview } },
        );
        setShowDayOverlay(false);
        return;
      }

      if (!titleForSearch) {
        navigate(`/dashboard/lifesync/anime/anime/search/page/1?q=`);
        setShowDayOverlay(false);
        return;
      }

      if (searchAbortRef.current) searchAbortRef.current.abort();
      const ac = new AbortController();
      searchAbortRef.current = ac;

      try {
        const res = await lifesyncFetch(
          `/api/v1/anime/search?q=${encodeURIComponent(titleForSearch)}&limit=5&offset=0`,
          { signal: ac.signal },
        );
        const rows = Array.isArray(res?.data) ? res.data : [];
        const top = rows[0]?.node || rows[0] || null;
        const candidateSlug = safeString(top?.slug || top?.id).trim();
        if (!candidateSlug) {
          navigate(`/dashboard/lifesync/anime/anime/search/page/1?q=${encodeURIComponent(titleForSearch)}`);
          setShowDayOverlay(false);
          return;
        }
        const preview = {
          id: candidateSlug,
          title: titleForSearch || candidateSlug,
          poster: it?.imageUrl ? String(it.imageUrl) : undefined,
        };
        navigate(
          `/dashboard/lifesync/anime/anime/home/page/1/detail/${encodeURIComponent(candidateSlug)}`,
          { state: { animeDetailPreview: preview } },
        );
        setShowDayOverlay(false);
      } catch (e) {
        if (e?.name === "AbortError") return;
        navigate(`/dashboard/lifesync/anime/anime/search/page/1?q=${encodeURIComponent(titleForSearch)}`);
        setShowDayOverlay(false);
      }
    };

    return (
      <MotionDiv
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 backdrop-blur-sm sm:items-center sm:p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.22 }}
      >
        <MotionDiv
          initial={{ opacity: 0, y: 40, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 32, scale: 0.97 }}
          transition={{ type: "spring", stiffness: 320, damping: 30 }}
          className="relative flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-t-[34px] border border-[var(--color-border-strong)]/50 bg-[var(--mx-color-f8fbff)] shadow-[0_32px_96px_-24px_rgba(2,6,23,0.75)] sm:rounded-[34px]"
        >
          <div className="relative border-b border-[var(--mx-color-dbe4ef)] bg-[linear-gradient(120deg,rgba(230,244,255,0.92),rgba(240,253,244,0.84),rgba(248,250,252,0.96))] px-5 py-4 sm:px-7 sm:py-5">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-violet-400/50 to-transparent" aria-hidden />
            <div className="pointer-events-none absolute right-0 top-0 h-32 w-48 rounded-full bg-violet-300/8 blur-3xl" />
            <button
              type="button"
              onClick={() => setShowDayOverlay(false)}
              className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border-strong)]/70 bg-[var(--color-surface)]/80 text-[var(--mx-color-475569)] transition-colors hover:bg-[var(--color-surface)] sm:right-5 sm:top-5"
              aria-label="Close"
            >
              <FaTimes className="h-4 w-4" />
            </button>

            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--mx-color-64748b)]">
              Anime day schedule
            </p>
            <h3 className="mt-1 pr-10 text-[19px] font-black tracking-tight text-[var(--mx-color-151418)] sm:text-[23px]">
              {title}
            </h3>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
              <span className="rounded-full border border-[var(--color-border-strong)]/70 bg-[var(--color-surface)]/75 px-2.5 py-1 font-semibold text-[var(--mx-color-1e293b)]">
                {total ? `${total} episodes` : "No episodes"}
              </span>
              {pinnedTotal > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--mx-color-c6ff00)]/20 px-2.5 py-1 font-semibold text-[var(--mx-color-1e293b)]">
                  <FaStar className="h-3 w-3" aria-hidden />
                  {pinnedTotal} pinned
                </span>
              )}
              {busy && (
                <span className="inline-flex items-center gap-2 font-medium text-[var(--mx-color-64748b)]">
                  <span className="h-3 w-3 rounded-full border-2 border-[var(--mx-color-c6ff00)] border-t-transparent animate-spin" />
                  Syncing schedules...
                </span>
              )}
            </div>
          </div>

          <div className="grid min-h-0 flex-1 lg:grid-cols-[280px_1fr]">
            {/* Left rail */}
            <aside className="border-b border-[var(--mx-color-dbe4ef)] bg-[var(--color-surface)]/65 px-5 py-4 sm:px-7 lg:border-b-0 lg:border-r lg:min-h-0 lg:overflow-y-auto">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--mx-color-64748b)]">
                Controls
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const d = addDays(selectedDate, -1);
                    setSelectedDate(d);
                    setDayPageSize(20);
                  }}
                  className="inline-flex items-center justify-center rounded-xl border border-[var(--mx-color-dbe4ef)] bg-[var(--color-surface)] px-3 py-2 text-[12px] font-semibold text-[var(--mx-color-334155)] transition-colors hover:bg-[var(--mx-color-f8fafc)]"
                >
                  Prev
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = addDays(selectedDate, +1);
                    setSelectedDate(d);
                    setDayPageSize(20);
                  }}
                  className="inline-flex items-center justify-center rounded-xl border border-[var(--mx-color-dbe4ef)] bg-[var(--color-surface)] px-3 py-2 text-[12px] font-semibold text-[var(--mx-color-334155)] transition-colors hover:bg-[var(--mx-color-f8fafc)]"
                >
                  Next
                </button>
              </div>

              <div className="mt-3 rounded-2xl border border-[var(--mx-color-dbe4ef)] bg-[var(--color-surface)]/85 p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--mx-color-64748b)]">
                  Selected
                </p>
                <p className="mt-1 text-[13px] font-bold text-[var(--mx-color-151418)]">
                  {selectedDate.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                  <div className="rounded-xl bg-[var(--mx-color-f8fafc)] px-3 py-2 ring-1 ring-[var(--mx-color-e2e8f0)]">
                    <p className="text-[var(--mx-color-64748b)]">Episodes</p>
                    <p className="mt-0.5 text-[17px] font-black text-[var(--mx-color-151418)]">{total}</p>
                  </div>
                  <div className="rounded-xl bg-[var(--mx-color-f8fafc)] px-3 py-2 ring-1 ring-[var(--mx-color-e2e8f0)]">
                    <p className="text-[var(--mx-color-64748b)]">Pinned</p>
                    <p className="mt-0.5 text-[17px] font-black text-[var(--mx-color-151418)]">{pinnedTotal}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-[var(--mx-color-dbe4ef)] bg-[var(--color-surface)]/85 p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--mx-color-64748b)]">
                  Filter & sort
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setFilterMode("all")}
                    className={`rounded-xl px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.08em] transition-colors ${
                      filterMode === "all"
                        ? "bg-[var(--mx-color-151418)] text-white"
                        : "bg-[var(--color-surface)] text-[var(--mx-color-334155)] ring-1 ring-[var(--mx-color-dbe4ef)] hover:bg-[var(--mx-color-f8fafc)]"
                    }`}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterMode("pinned")}
                    className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.08em] transition-colors ${
                      filterMode === "pinned"
                        ? "bg-[var(--mx-color-c6ff00)] text-[var(--mx-color-1e293b)]"
                        : "bg-[var(--color-surface)] text-[var(--mx-color-334155)] ring-1 ring-[var(--mx-color-dbe4ef)] hover:bg-[var(--mx-color-f8fafc)]"
                    }`}
                  >
                    <FaStar className="h-3 w-3" aria-hidden />
                    Pinned
                  </button>
                </div>

                <div className="mt-3 grid gap-2">
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setDayPageSize(20);
                    }}
                    placeholder="Search title or episode…"
                    className="h-10 w-full rounded-xl border border-[var(--mx-color-dbe4ef)] bg-[var(--color-surface)] px-3 text-[13px] text-[var(--mx-color-1e293b)] placeholder:text-[var(--mx-color-94a3b8)] focus:border-[var(--mx-color-c6ff00)]/70 focus:outline-none"
                  />
                  <select
                    value={sortMode}
                    onChange={(e) => setSortMode(String(e.target.value || "priority"))}
                    className="h-10 w-full rounded-xl border border-[var(--mx-color-dbe4ef)] bg-[var(--color-surface)] px-3 text-[12px] font-semibold text-[var(--mx-color-334155)] focus:border-[var(--mx-color-c6ff00)]/70 focus:outline-none"
                  >
                    <option value="priority">Sort: Priority</option>
                    <option value="time">Sort: Air time</option>
                  </select>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-[var(--mx-color-dbe4ef)] bg-[var(--color-surface)]/85 p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--mx-color-64748b)]">
                  Priority Queue
                </p>
                {pinnedPreview.length ? (
                  <ul className="mt-3 space-y-2">
                    {pinnedPreview.map((it) => (
                      <li
                        key={`pin-${it._rowKey}`}
                        className="rounded-xl border border-[var(--mx-color-dbe4ef)] bg-[var(--color-surface)] px-3 py-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-[11px] font-semibold text-[var(--mx-color-151418)]">{it.title}</p>
                          <span className="rounded-full bg-[var(--mx-color-c6ff00)]/30 px-2 py-0.5 text-[10px] font-bold text-[var(--mx-color-1e293b)]">
                            P{it._priority}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[10px] text-[var(--mx-color-64748b)]">
                          Episode {it.episodeNumber || "?"}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-[11px] text-[var(--mx-color-64748b)]">No pinned shows yet for this day.</p>
                )}
              </div>
            </aside>

            {/* Main content: list + details */}
            <div className="grid min-h-0 lg:grid-cols-[1fr_0.9fr]">
              {/* Episode list */}
              <div className="min-h-0 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
                {visibleItems.length ? (
                  <MotionDiv
                    variants={lifeSyncStaggerContainerDense}
                    initial="hidden"
                    animate="show"
                    className="space-y-3"
                  >
                    {visibleItems.map((it) => {
                      const time = formatClock(it?._airedAtMs, clientTz);
                      const selected = it._rowKey === activeKey;

                      return (
                        <MotionDiv
                          key={it._rowKey}
                          variants={lifeSyncStaggerItemFade}
                        >
                          <button
                            type="button"
                            onClick={() => setActiveKey(it._rowKey)}
                            className={`w-full rounded-2xl border p-4 text-left transition-all sm:p-5 ${
                              selected
                                ? "border-[var(--mx-color-151418)]/20 bg-[var(--color-surface)] shadow-md ring-2 ring-[var(--mx-color-c6ff00)]/40"
                                : it._isPinned
                                  ? "border-[var(--mx-color-c6ff00)]/50 bg-[linear-gradient(115deg,rgba(198,255,0,0.15),rgba(255,255,255,0.75))] hover:shadow-sm"
                                  : "border-[var(--mx-color-dbe4ef)] bg-[var(--color-surface)] hover:shadow-sm"
                            }`}
                          >
                            <div className="flex gap-3">
                              <div className="h-[76px] w-[56px] shrink-0 overflow-hidden rounded-2xl bg-[var(--mx-color-f1f5f9)] ring-1 ring-black/5">
                                {it.imageUrl ? (
                                  <img
                                    src={it.imageUrl}
                                    alt=""
                                    className="h-full w-full object-cover"
                                    loading="lazy"
                                  />
                                ) : (
                                  <div className="h-full w-full bg-[linear-gradient(130deg,var(--mx-color-f1f5f9),var(--mx-color-e2e8f0))]" />
                                )}
                              </div>

                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[14px] font-black tracking-tight text-[var(--mx-color-151418)]">
                                  {it.title}
                                </p>

                                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                  <span className="rounded-full bg-[var(--color-surface)]/80 px-2 py-0.5 text-[10px] font-semibold text-[var(--mx-color-334155)] ring-1 ring-[var(--mx-color-e2e8f0)]">
                                    E{it.episodeNumber}
                                  </span>
                                  {time ? (
                                    <span className="rounded-full bg-[var(--color-surface)]/80 px-2 py-0.5 text-[10px] font-semibold text-[var(--mx-color-334155)] ring-1 ring-[var(--mx-color-e2e8f0)]">
                                      {time}
                                    </span>
                                  ) : null}
                                  {it._isPinned ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--mx-color-c6ff00)]/30 px-2 py-0.5 text-[10px] font-bold text-[var(--mx-color-1e293b)]">
                                      <FaStar className="h-2.5 w-2.5" aria-hidden />
                                      Priority {it._priority}
                                    </span>
                                  ) : null}
                                </div>

                                {it.episodeTitle ? (
                                  <p className="mt-2 line-clamp-2 text-[12px] leading-relaxed text-[var(--mx-color-475569)]">
                                    {it.episodeTitle}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          </button>
                        </MotionDiv>
                      );
                    })}

                    {canMore ? (
                      <button
                        type="button"
                        onClick={() => setDayPageSize((n) => n + 20)}
                        className="w-full rounded-xl border border-[var(--mx-color-dbe4ef)] bg-[var(--color-surface)] px-4 py-3 text-[12px] font-semibold text-[var(--mx-color-334155)] transition-colors hover:bg-[var(--mx-color-f8fafc)]"
                      >
                        Load more episodes
                      </button>
                    ) : null}
                  </MotionDiv>
                ) : (
                  <div className="rounded-2xl border border-dashed border-[var(--mx-color-cbd5e1)] bg-[var(--color-surface)]/65 px-4 py-12 text-center text-[var(--mx-color-64748b)]">
                    <p className="text-[14px] font-semibold">No episodes found</p>
                    <p className="mt-1 text-[12px]">Try a different filter, clear search, or pick another date.</p>
                  </div>
                )}
              </div>

              {/* Details panel */}
              <aside className="border-t border-[var(--mx-color-dbe4ef)] bg-[var(--color-surface)]/65 px-5 py-5 sm:px-7 sm:py-6 lg:min-h-0 lg:overflow-y-auto lg:border-l lg:border-t-0">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--mx-color-64748b)]">
                  Details
                </p>

                {activeItem ? (
                  <div className="mt-3 rounded-2xl border border-[var(--mx-color-dbe4ef)] bg-[var(--color-surface)]/85 p-4">
                    <div className="flex gap-3">
                      <div className="h-[96px] w-[70px] shrink-0 overflow-hidden rounded-2xl bg-[var(--mx-color-f1f5f9)] ring-1 ring-black/5">
                        {activeItem.imageUrl ? (
                          <img
                            src={activeItem.imageUrl}
                            alt=""
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="h-full w-full bg-[linear-gradient(130deg,var(--mx-color-f1f5f9),var(--mx-color-e2e8f0))]" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-black tracking-tight text-[var(--mx-color-151418)] line-clamp-2">
                          {activeItem.title}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                          <span className="rounded-full bg-[var(--mx-color-f5f5f7)] px-2.5 py-1 font-semibold text-[var(--mx-color-334155)]">
                            Episode {activeItem.episodeNumber ?? "?"}
                          </span>
                          {activeItem?._airedAtMs ? (
                            <span className="rounded-full bg-[var(--mx-color-f5f5f7)] px-2.5 py-1 font-medium text-[var(--mx-color-64748b)]">
                              {formatClock(activeItem._airedAtMs, clientTz)}
                            </span>
                          ) : null}
                          {activeItem._isPinned ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--mx-color-c6ff00)]/25 px-2.5 py-1 font-bold text-[var(--mx-color-1e293b)]">
                              <FaStar className="h-3 w-3" aria-hidden />
                              P{activeItem._priority}
                            </span>
                          ) : null}
                        </div>
                        {activeItem.episodeTitle ? (
                          <p className="mt-2 text-[12px] leading-relaxed text-[var(--mx-color-475569)] line-clamp-3">
                            {activeItem.episodeTitle}
                          </p>
                        ) : (
                          <p className="mt-2 text-[12px] text-[var(--mx-color-64748b)]">
                            No episode title available.
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-2">
                      <div className="grid grid-cols-[1fr_auto] gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            activeItem._isPinned
                              ? unpin(activeItem)
                              : pinOrUpdatePriority(activeItem, activeItem._priority)
                          }
                          className={`inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl border px-3 text-[12px] font-bold transition-colors ${
                            activeItem._isPinned
                              ? "border-[var(--mx-color-151418)] bg-[var(--mx-color-151418)] text-white"
                              : "border-[var(--mx-color-dbe4ef)] bg-[var(--color-surface)] text-[var(--mx-color-334155)] hover:bg-[var(--mx-color-f8fafc)]"
                          }`}
                        >
                          <FaStar className="h-3.5 w-3.5" aria-hidden />
                          {activeItem._isPinned ? "Unpin" : "Pin"}
                        </button>

                        <select
                          value={activeItem._priority}
                          onChange={(e) => pinOrUpdatePriority(activeItem, e.target.value)}
                          className="min-h-[42px] rounded-xl border border-[var(--mx-color-dbe4ef)] bg-[var(--color-surface)] px-3 text-[12px] font-semibold text-[var(--mx-color-334155)] focus:border-[var(--mx-color-c6ff00)]/70 focus:outline-none"
                          title="Priority"
                        >
                          {Array.from({ length: 10 }).map((_, i) => (
                            <option key={i + 1} value={i + 1}>
                              Priority {i + 1}
                            </option>
                          ))}
                        </select>
                      </div>

                      <button
                        type="button"
                        onClick={() => openAnimeDetails(activeItem)}
                        className="inline-flex min-h-[42px] items-center justify-center rounded-xl bg-[var(--mx-color-2e51a2)] px-3 text-[12px] font-bold text-white transition hover:brightness-95"
                      >
                        Open anime details
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 rounded-2xl border border-dashed border-[var(--mx-color-cbd5e1)] bg-[var(--color-surface)]/65 px-4 py-10 text-center text-[var(--mx-color-64748b)]">
                    <p className="text-[13px] font-semibold">Pick an episode</p>
                    <p className="mt-1 text-[12px]">Select an item from the list to view details.</p>
                  </div>
                )}

                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowDayOverlay(false)}
                    className="inline-flex flex-1 items-center justify-center rounded-xl border border-[var(--mx-color-dbe4ef)] bg-[var(--color-surface)] px-3 py-2.5 text-[12px] font-semibold text-[var(--mx-color-334155)] transition-colors hover:bg-[var(--mx-color-f8fafc)]"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDayOverlay(false)}
                    className="inline-flex flex-1 items-center justify-center rounded-xl bg-[var(--mx-color-c6ff00)] px-3 py-2.5 text-[12px] font-bold text-[var(--mx-color-1a1628)] shadow-sm ring-1 ring-[var(--mx-color-1a1628)]/10 transition-all hover:brightness-95"
                  >
                    Close
                  </button>
                </div>
              </aside>
            </div>
          </div>
        </MotionDiv>
      </MotionDiv>
    );
  };

  return (
    <MotionDiv
      className="space-y-4 sm:space-y-6 max-w-7xl mx-auto"
      initial="initial"
      animate="animate"
      exit="exit"
      variants={lifeSyncSpringPageVariants}
      transition={lifeSyncSpringPageTransition}
    >
      <MediaPageHeader
        accent="calendar"
        kicker="LifeSync · Broadcast"
        title="Anime Calendar"
        subtitle="Weekly schedule powered by Anineko. Pin shows to prioritize them in your calendar."
        icon={
          <svg className="h-5.5 w-5.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" aria-hidden>
            <rect x="3" y="4" width="18" height="18" rx="3" />
            <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        }
      />

      {error && (
        <div className="rounded-2xl border border-red-200/60 bg-red-50 px-4 py-3 text-[12px] font-semibold text-red-600 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </div>
      )}

      <MotionDiv
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 26, delay: 0.08 }}
        className="relative overflow-hidden bg-(--color-surface) rounded-3xl sm:rounded-4xl p-4 sm:p-6 md:p-8 border border-(--mx-color-d2d2d7)/40 shadow-sm"
      >
        <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-linear-to-r from-transparent via-violet-400/60 to-transparent" aria-hidden />
        <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 h-40 w-96 rounded-full bg-violet-400/5 blur-3xl" aria-hidden />
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center justify-between w-full sm:w-auto bg-[var(--mx-color-f5f5f7)] rounded-xl p-1">
            <button
              type="button"
              onClick={() => {
                const d = new Date(currentDate);
                d.setMonth(d.getMonth() - 1);
                setCurrentDate(d);
              }}
              className="p-2 hover:bg-[var(--color-surface)] rounded-lg transition-all shadow-sm hover:shadow active:scale-95"
              aria-label="Previous month"
            >
              <FaChevronLeft className="w-3.5 h-3.5 text-[var(--mx-color-1d1d1f)]" />
            </button>
            <h2 className="text-[14px] sm:text-[18px] font-bold text-[var(--mx-color-1d1d1f)] min-w-[140px] sm:min-w-[200px] text-center tracking-tight">
              {monthLabel}
            </h2>
            <button
              type="button"
              onClick={() => {
                const d = new Date(currentDate);
                d.setMonth(d.getMonth() + 1);
                setCurrentDate(d);
              }}
              className="p-2 hover:bg-[var(--color-surface)] rounded-lg transition-all shadow-sm hover:shadow active:scale-95"
              aria-label="Next month"
            >
              <FaChevronRight className="w-3.5 h-3.5 text-[var(--mx-color-1d1d1f)]" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentDate(new Date())}
              className="text-[12px] font-semibold bg-[var(--color-surface)] border border-[var(--mx-color-e5e5ea)] rounded-xl px-3 py-2 hover:bg-[var(--mx-color-fafafa)] transition-colors"
            >
              Today
            </button>
            <button
              type="button"
              onClick={loadMonth}
              className="text-[12px] font-semibold bg-[var(--mx-color-c6ff00)] text-[var(--mx-color-1a1628)] rounded-xl px-3 py-2 shadow-sm ring-1 ring-[var(--mx-color-1a1628)]/10 hover:brightness-95 transition-all disabled:opacity-60"
              disabled={busy}
            >
              {busy ? "Loading…" : "Refresh"}
            </button>
            {busy && (
              <span className="hidden sm:inline-flex items-center gap-2 text-[12px] font-medium text-[var(--mx-color-86868b)]">
                <span className="h-3 w-3 rounded-full border-2 border-[var(--mx-color-c6ff00)] border-t-transparent animate-spin" />
                Loading schedules…
              </span>
            )}
          </div>
        </div>

        {/* Always render the calendar immediately; schedules fill in as they load. */}
        <MonthGrid />
      </MotionDiv>

      <AnimatePresence mode="sync">
        {showDayOverlay && <DayOverlay />}
      </AnimatePresence>
    </MotionDiv>
  );
}
