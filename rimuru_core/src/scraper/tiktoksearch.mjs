import axios from 'axios'

const TTSEARCH_API = 'https://api.azbry.com/api/search/ttsearch?q='
const TIKWM_SEARCH_API = 'https://www.tikwm.com/api/feed/search'

function normalizeUrl(url) {
    if (!url || typeof url !== 'string') return null
    const matches = url.match(/https?:\/\//g) || []
    if (matches.length <= 1) return url
    const lastIndex = url.lastIndexOf('http')
    return url.slice(lastIndex)
}

function normalizeNumber(value) {
    const number = Number(value)
    return Number.isFinite(number) ? number : 0
}

function normalizeItem(item) {
    return {
        title: item?.title || '',
        cover: normalizeUrl(item?.cover),
        originCover: normalizeUrl(item?.origin_cover),
        link: normalizeUrl(item?.link),
        watermarkLink: normalizeUrl(item?.watermark_link),
        music: normalizeUrl(item?.music),
        author: {
            nickname: item?.author?.nickname || '',
            avatar: normalizeUrl(item?.author?.avatar)
        },
        stats: {
            plays: normalizeNumber(item?.stats?.plays),
            likes: normalizeNumber(item?.stats?.likes),
            comments: normalizeNumber(item?.stats?.comments),
            shares: normalizeNumber(item?.stats?.shares)
        }
    }
}

function normalizeTikwmItem(item) {
    const videoId = item?.video_id || item?.aweme_id || ''
    const authorId = item?.author?.unique_id || ''
    const fallbackPostUrl = videoId && authorId
        ? `https://www.tiktok.com/@${authorId}/video/${videoId}`
        : null

    return {
        title: item?.title || '',
        cover: normalizeUrl(item?.cover || item?.origin_cover),
        originCover: normalizeUrl(item?.origin_cover || item?.cover),
        // Prefer direct playable media for .playtiktok/.ptvsearch/.ttsearch.
        link: normalizeUrl(item?.hdplay || item?.play || item?.wmplay || fallbackPostUrl),
        watermarkLink: normalizeUrl(item?.wmplay),
        music: normalizeUrl(item?.music || item?.music_info?.play),
        author: {
            nickname: item?.author?.nickname || item?.author?.unique_id || '',
            avatar: normalizeUrl(item?.author?.avatar)
        },
        stats: {
            plays: normalizeNumber(item?.play_count),
            likes: normalizeNumber(item?.digg_count),
            comments: normalizeNumber(item?.comment_count),
            shares: normalizeNumber(item?.share_count)
        }
    }
}

async function searchAzbry(query) {
    const response = await axios.get(`${TTSEARCH_API}${encodeURIComponent(query)}`, {
        timeout: 15000,
        headers: {
            'user-agent': 'Mozilla/5.0'
        },
        validateStatus: () => true
    })

    if (response.status < 200 || response.status >= 300) {
        throw new Error(`Azbry HTTP ${response.status}`)
    }

    const data = response.data
    if (!data?.status || !Array.isArray(data?.result)) {
        throw new Error(data?.message || 'TikTok search gagal')
    }

    return data.result.map(normalizeItem).filter((item) => item.link)
}

async function searchTikwm(query) {
    const response = await axios.get(TIKWM_SEARCH_API, {
        timeout: 20000,
        params: {
            keywords: query,
            count: 10,
            cursor: 0,
            hd: 1
        },
        headers: {
            accept: 'application/json, text/plain, */*',
            'accept-language': 'en-US,en;q=0.9',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/148.0.0.0 Safari/537.36',
            referer: 'https://www.tikwm.com/'
        },
        validateStatus: () => true
    })

    if (response.status < 200 || response.status >= 300) {
        throw new Error(`TikWM HTTP ${response.status}`)
    }

    const data = response.data
    if (data?.code !== 0) {
        throw new Error(data?.msg || 'TikWM TikTok search gagal')
    }

    const videos = Array.isArray(data?.data?.videos) ? data.data.videos : []
    return videos.map(normalizeTikwmItem).filter((item) => item.link)
}

async function tiktokSearchVideo(query) {
    const cleanQuery = String(query || '').trim()
    if (!cleanQuery) return []

    let firstError = null

    try {
        const result = await searchAzbry(cleanQuery)
        if (result.length) return result
    } catch (error) {
        firstError = error
    }

    try {
        const fallback = await searchTikwm(cleanQuery)
        if (fallback.length) return fallback
    } catch (fallbackError) {
        if (firstError) {
            throw new Error(`TikTok search gagal: ${firstError.message}; fallback: ${fallbackError.message}`)
        }
        throw fallbackError
    }

    return []
}

export { tiktokSearchVideo }
