import { isLifeSyncHentaiHubVisible, isPluginEnabled } from './lifesyncApi'

/**
 * Sidebar destinations under `/dashboard/lifesync/anime/*` (Anime / Manga / Hentai).
 */
export function animeMediaSidebarItems(prefs) {
    const items = []
    if (isPluginEnabled(prefs, 'pluginAnimeEnabled')) {
        items.push({ id: 'anime', to: '/dashboard/lifesync/anime/anime', label: 'Anime' })
    }
    if (isPluginEnabled(prefs, 'pluginMangaEnabled')) {
        items.push({ id: 'manga', to: '/dashboard/lifesync/anime/manga', label: 'Manga' })
    }
    if (isLifeSyncHentaiHubVisible(prefs)) {
        items.push({ id: 'hentai', to: '/dashboard/lifesync/anime/hentai', label: 'Hentai' })
    }
    return items
}
