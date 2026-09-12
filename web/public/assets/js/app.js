/* ═══════════════════════════════════════════════════════════════════
   Queen Riam — app.js · أدوات مشتركة لكل صفحات الموقع
   ═══════════════════════════════════════════════════════════════════ */

'use strict';

const QR = {
    /** قراءة توكن الجلسة المحفوظ */
    getToken() { return localStorage.getItem('riam_token') || null; },
    setToken(t) { localStorage.setItem('riam_token', t); },
    clearToken() { localStorage.removeItem('riam_token'); },

    /** استدعاء API موحد */
    async api(path, options = {}) {
        const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
        const token = this.getToken();
        if (token) headers['Authorization'] = 'Bearer ' + token;
        try {
            const res = await fetch(path, Object.assign({}, options, { headers }));
            let data = {};
            try { data = await res.json(); } catch (_) { data = { ok: false, error: 'رد غير صالح من الخادم' }; }
            data._status = res.status;
            return data;
        } catch (err) {
            return { ok: false, _status: 0, error: 'تعذر الاتصال بالخادم — تحقق من الإنترنت.' };
        }
    },
};

/** إشعارات منبثقة */
function toast(message, type = 'info', ms = 3500) {
    let zone = document.querySelector('.toast-zone');
    if (!zone) {
        zone = document.createElement('div');
        zone.className = 'toast-zone';
        document.body.appendChild(zone);
    }
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.textContent = message;
    zone.appendChild(el);
    setTimeout(() => {
        el.style.transition = 'opacity .4s, transform .4s';
        el.style.opacity = '0';
        el.style.transform = 'translateY(10px)';
        setTimeout(() => el.remove(), 420);
    }, ms);
}

/** إظهار/إخفاء خطأ نموذج */
function setFormError(el, message) {
    if (!el) return;
    if (message) {
        el.textContent = message;
        el.classList.add('show');
    } else {
        el.classList.remove('show');
    }
}

/** تنسيق مدة بالثواني إلى نص عربي */
function fmtDuration(seconds) {
    seconds = parseInt(seconds, 10) || 0;
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (d > 0) return `${d} يوم و ${h} ساعة`;
    if (h > 0) return `${h} ساعة و ${m} دقيقة`;
    if (m > 0) return `${m} دقيقة`;
    return `${s} ثانية`;
}

/** اسم الدور بالعربية + شارة */
function roleBadge(role) {
    if (role === 'owner') return '<span class="role-badge owner">👑 المالك</span>';
    if (role === 'premium') return '<span class="role-badge premium">💎 مميز</span>';
    return '<span class="role-badge user">عادي</span>';
}

/** جسيمات ضوئية عائمة في الخلفية */
function spawnSparks(count = 14) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    for (let i = 0; i < count; i++) {
        const s = document.createElement('div');
        s.className = 'spark';
        s.style.left = Math.random() * 100 + 'vw';
        s.style.bottom = '-10px';
        const dur = 9 + Math.random() * 14;
        s.style.animationDuration = dur + 's';
        s.style.animationDelay = (Math.random() * dur) + 's';
        const size = 2 + Math.random() * 3;
        s.style.width = size + 'px';
        s.style.height = size + 'px';
        document.body.appendChild(s);
    }
}

/** تحميل حالة النظام إلى عناصر تذييل/صفحة (عناصر اختيارية) */
async function loadSiteStatus() {
    const data = await QR.api('/api/status');
    if (!data.ok) return;
    document.querySelectorAll('[data-bot-name]').forEach(el => el.textContent = data.botName);
    document.querySelectorAll('[data-bot-version]').forEach(el => el.textContent = data.version);
    document.querySelectorAll('[data-status-dot]').forEach(el => {
        const on = data.sessions.connected > 0;
        el.classList.toggle('on', on);
    });
    document.querySelectorAll('[data-status-text]').forEach(el => {
        const on = data.sessions.connected > 0;
        el.textContent = on ? `الخدمة تعمل — ${data.sessions.connected} بوت متصل` : 'لا يوجد بوت متصل حالياً';
    });
    if (data.announcement) {
        document.querySelectorAll('[data-announce]').forEach(el => {
            el.innerHTML = '📢 ' + data.announcement;
            el.classList.add('show');
        });
    }
    return data;
}

/** حماية صفحة لوحة التحكم: توجيه للدخول إذا لم يكن هناك توكن */
async function requireDashboardAuth() {
    if (!QR.getToken()) {
        window.location.replace('/login');
        return null;
    }
    const me = await QR.api('/api/me');
    if (!me.ok || me._status === 401) {
        QR.clearToken();
        window.location.replace('/login');
        return null;
    }
    return me;
}

/** تسجيل خروج */
async function doLogout() {
    await QR.api('/api/auth/logout', { method: 'POST' });
    QR.clearToken();
    window.location.replace('/login');
}

// تشغيل الجسيمات + حالة الموقع في كل الصفحات
document.addEventListener('DOMContentLoaded', () => {
    spawnSparks();
    loadSiteStatus();
});
