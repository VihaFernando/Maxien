import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { lifesyncFetch } from '../lib/lifesyncApi'
import { lifeSyncQueryKeys } from '../lib/lifeSyncQueryKeys'

const EMPTY_CONTENT_LISTS = {
    animeHistory: [],
    mangaReading: [],
}
const CONTENT_LISTS_STALE_MS = 1000 * 60 * 2
const CONTENT_LISTS_GC_MS = 1000 * 60 * 10

const CONTENT_LISTS_QUERY_KEY = lifeSyncQueryKeys.contentLists()

async function fetchBatchContentLists() {
    const [animeRes, mangaRes] = await Promise.all([
        lifesyncFetch('/api/v1/anime/watch-history?limit=100&view=standard').catch(() => ({ entries: [] })),
        lifesyncFetch('/api/v1/manga/reading?view=standard').catch(() => ({ entries: [] })),
    ])

    return {
        animeHistory: Array.isArray(animeRes?.entries) ? animeRes.entries : [],
        mangaReading: Array.isArray(mangaRes?.entries) ? mangaRes.entries : [],
    }
}

/**
 * Dashboard content hook using v1 endpoints directly (no batch content endpoint).
 * @param {{ enabled: boolean }} opts
 */
export function useBatchContentLists({ enabled }) {
    const queryClient = useQueryClient()
    const {
        data,
        error,
        isPending,
        isFetching,
        refetch,
    } = useQuery({
        queryKey: CONTENT_LISTS_QUERY_KEY,
        queryFn: fetchBatchContentLists,
        enabled,
        staleTime: CONTENT_LISTS_STALE_MS,
        gcTime: CONTENT_LISTS_GC_MS,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
    })

    const refresh = useCallback(async () => {
        if (!enabled) {
            queryClient.setQueryData(CONTENT_LISTS_QUERY_KEY, EMPTY_CONTENT_LISTS)
            return EMPTY_CONTENT_LISTS
        }
        const out = await refetch()
        return out?.data || EMPTY_CONTENT_LISTS
    }, [enabled, queryClient, refetch])

    const safeData = enabled ? (data || EMPTY_CONTENT_LISTS) : EMPTY_CONTENT_LISTS

    return {
        animeHistory: safeData.animeHistory,
        mangaReading: safeData.mangaReading,
        loading: enabled ? (isPending || (isFetching && !data)) : false,
        error: enabled ? (error?.message || null) : null,
        refresh,
    }
}
