'use strict';
/**
 * lib/messageQueue.js — طابور إرسال لكل جلسة (حماية من تقييد واتساب)
 *
 * v2 — إصلاح «البوت يعلق عند فيديو كبير»:
 *   • مهلة قصوى لكل مهمة: نصوص 90 ثانية — وسائط 5 دقائق
 *     (قبلها المهمة العالقة كانت تجمّد الطابور للأبد)
 *   • تزامن مزدوج: مهمة وسائط ضخمة لا تحجب الردود النصية الصغيرة
 *   • انتهاء المهلة لا يُعاد المحاولة بعده (تجنب رفع ملف عملاق مرتين)
 */

const SEND_DELAY       = 800;            // ms بين بداية الإرسالات (حماية من التقييد)
const MAX_RETRIES      = 3;
const RETRY_BASE       = 3000;           // ms — multiplied by attempt number
const TEXT_TIMEOUT     = 90 * 1000;      // نصوص/تفاعلات/استطلاعات
const MEDIA_TIMEOUT    = 5 * 60 * 1000;  // فيديو/صوت/صور/ملفات ضخمة
const CONCURRENCY      = 2;              // مهام متزامنة (وسائط + نص معاً)

const MEDIA_KEYS = ['video', 'audio', 'image', 'document', 'sticker', 'ppt', 'contact', 'location', 'poll'];

function _taskTimeout(content) {
    if (!content || typeof content !== 'object') return TEXT_TIMEOUT;
    return MEDIA_KEYS.some((k) => content[k] != null) ? MEDIA_TIMEOUT : TEXT_TIMEOUT;
}

function _withTimeout(promise, ms, label) {
    return new Promise((resolve, reject) => {
        const t = setTimeout(() => {
            const err = new Error(`انتهت مهلة الإرسال (${Math.round(ms / 1000)} ثانية) — ${label || 'مهمة'}`);
            err.isTimeout = true;
            reject(err);
        }, ms);
        if (t.unref) t.unref();
        promise.then(
            (v) => { clearTimeout(t); resolve(v); },
            (e) => { clearTimeout(t); reject(e); }
        );
    });
}

class SessionQueue {
    constructor(sessionId) {
        this.sessionId  = sessionId;
        this.queue      = [];
        this.active     = 0;
        this.stats      = { sent: 0, failed: 0, retried: 0, timeouts: 0 };
    }

    enqueue(task, content) {
        return new Promise((resolve, reject) => {
            this.queue.push({ task, content, resolve, reject, retries: 0, noRetry: false });
            if (this.active < CONCURRENCY) this._drain();
        });
    }

    async _drain() {
        if (this.active >= CONCURRENCY) return;
        this.active++;

        try {
            while (this.queue.length > 0) {
                const item = this.queue.shift();
                const label = item.content && item.content.video != null ? 'فيديو'
                    : item.content && (item.content.audio != null || item.content.image != null || item.content.document != null) ? 'وسائط'
                    : 'رسالة';
                try {
                    const result = await _withTimeout(item.task(), _taskTimeout(item.content), label);
                    this.stats.sent++;
                    item.resolve(result);
                } catch (err) {
                    const timedOut = !!err.isTimeout;
                    if (timedOut) this.stats.timeouts++;

                    if (!timedOut && !item.noRetry && item.retries < MAX_RETRIES) {
                        item.retries++;
                        this.stats.retried++;
                        // إعادة للمقدمة — إعادة محاولة فورية بعد مهلة تصاعدية
                        this.queue.unshift(item);
                        await _sleep(RETRY_BASE * item.retries);
                        continue;
                    }
                    this.stats.failed++;
                    item.reject(err);
                }
                if (this.queue.length > 0) await _sleep(SEND_DELAY);
            }
        } finally {
            this.active--;
            // إذا أُضيفت مهام أثناء الخروج وهناك سعة — استمر
            if (this.queue.length > 0 && this.active < CONCURRENCY) this._drain();
        }
    }

    stats_snapshot() {
        return { ...this.stats, pending: this.queue.length, session: this.sessionId };
    }
}

function _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// registry: sessionId → SessionQueue
const _queues = new Map();

function _getQueue(sessionId) {
    const key = String(sessionId || 'main');
    if (!_queues.has(key)) _queues.set(key, new SessionQueue(key));
    return _queues.get(key);
}

/**
 * Monkey-patch sock.sendMessage so every call goes through the queue.
 * Call once right after makeWASocket().
 */
function patchSocket(sock, sessionId) {
    const id  = sessionId || sock._sessionNumber || 'main';
    const q   = _getQueue(id);
    const orig = sock.sendMessage.bind(sock);

    sock.sendMessage = (jid, content, opts) =>
        q.enqueue(() => orig(jid, content, opts), content);

    sock._queueId = id;
    return sock;
}

/** Get stats for all sessions or a specific one. */
function getStats(sessionId) {
    if (sessionId) return _queues.get(String(sessionId))?.stats_snapshot() || null;
    return Array.from(_queues.values()).map(q => q.stats_snapshot());
}

module.exports = { patchSocket, getStats };
