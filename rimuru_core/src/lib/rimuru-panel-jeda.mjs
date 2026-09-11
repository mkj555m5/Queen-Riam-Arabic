import { getDatabase } from '../../src/lib/rimuru-database.mjs'
const DEFAULT_JEDA = 5 * 60 * 1000

function formatTime(ms) {
    if (ms <= 0) return '0 ثانية'
    
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    
    if (hours > 0) return `${hours} ساعة و${minutes % 60} دقيقة`
    if (minutes > 0) return `${minutes} دقيقة و${seconds % 60} ثانية`
    return `${seconds} ثانية`
}

function checkPanelJeda(m) {
    const db = getDatabase()
    
    const storedJeda = db.setting('panelCreateJeda')
    const jedaMs = storedJeda !== undefined && storedJeda !== null ? storedJeda : DEFAULT_JEDA
    
    if (jedaMs === 0) return { allowed: true }
    
    const lastUsed = db.setting('panelCreateLastUsed') || 0
    const now = Date.now()
    const elapsed = now - lastUsed
    
    if (elapsed < jedaMs) {
        const remaining = jedaMs - elapsed
        return {
            allowed: false,
            remaining: remaining,
            message: `⏱️ *فترة انتظار مُفعّلة*\n\n` +
                `> الرجاء الانتظار *${formatTime(remaining)}* قبل إنشاء لوحة جديدة.\n\n` +
                `> _تنطبق هذه الفترة على جميع المستخدمين._\n` +
                `> _استخدم \`.cekjeda\` لفحص الحالة._`
        }
    }
    
    return { allowed: true }
}

async function setPanelLastUsed() {
    const db = getDatabase()
    db.setting('panelCreateLastUsed', Date.now())
    await db.save()
}

function getJedaInfo() {
    const db = getDatabase()
    const storedJeda = db.setting('panelCreateJeda')
    const jedaMs = storedJeda !== undefined && storedJeda !== null ? storedJeda : DEFAULT_JEDA
    const lastUsed = db.setting('panelCreateLastUsed') || 0
    const now = Date.now()
    const elapsed = now - lastUsed
    const remaining = Math.max(0, jedaMs - elapsed)
    
    return {
        jedaMs,
        lastUsed,
        elapsed,
        remaining,
        isReady: remaining === 0 || jedaMs === 0
    }
}

export { checkPanelJeda, setPanelLastUsed, formatTime, getJedaInfo, DEFAULT_JEDA }
