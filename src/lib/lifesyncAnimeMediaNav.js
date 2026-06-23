import { isLifeSyncHManhwaVisible, isLifeSyncHentaiHubVisible, isPluginEnabled } from './lifesyncApi'

/**
 * Sidebar destinations under `/dashboard/lifesync/anime/*` (Anime / Manga / Hentai).
 */
export function animeMediaSidebarItems(prefs) {
    const items = []
    const hManhwaVisible = isLifeSyncHManhwaVisible(prefs)
    if (isPluginEnabled(prefs, 'pluginAnimeEnabled')) {
        items.push({ id: 'anime', to: '/dashboard/lifesync/anime/anime', label: 'Anime' })
        items.push({ id: 'my-list', to: '/dashboard/lifesync/anime/anime/library', label: 'My List' })
        items.push({ id: 'schedule', to: '/dashboard/lifesync/anime/anime/schedule', label: 'Schedule' })
        items.push({ id: 'calendar', to: '/dashboard/lifesync/anime/anime/calendar', label: 'Calendar' })
    }
    if (isPluginEnabled(prefs, 'pluginMangaEnabled')) {
        items.push({ id: 'manga-home', to: '/dashboard/lifesync/anime/manga/home', label: 'Manga Home' })
        items.push({ id: 'manga', to: '/dashboard/lifesync/anime/manga', label: 'Browse Manga' })
    }
    if (hManhwaVisible) {
        items.push({ id: 'h-manhwa', to: '/dashboard/lifesync/anime/manga/mangadistrict/latest/page/1', label: 'H manhwa' })
    }
    if (isLifeSyncHentaiHubVisible(prefs)) {
        items.push({ id: 'hentai-home', to: '/dashboard/lifesync/anime/hentai/home', label: 'Hentai Home' })
        items.push({ id: 'hentai', to: '/dashboard/lifesync/anime/hentai', label: 'Browse Hentai' })
    }
    return items
}
