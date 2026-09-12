/* dashboard.js — لوحة التحكم: إعدادات البوت + لوحة المالك */
'use strict';

const $ = (id) => document.getElementById(id);

// ── حالة اللوحة ──
let ME = null;              // بياناتي من /api/me
let SETTINGS_META = null;   // وصف الإعدادات من الخادم
let CURRENT_SETTINGS = {};  // القيم الحالية المعدلة

// ═══════════════════ التهيئة ═══════════════════

(async function init() {
    const me = await requireDashboardAuth();
    if (!me) return;
    ME = me;
    renderMe(me);
    await loadSettings();
    if (ME.user.role === 'owner') {
        $('ownerZone').style.display = 'block';
        $('unlinkBtn').style.display = 'none';
        $('dangerDesc').textContent = 'جلسة المالك محمية — لا يمكن فصلها من اللوحة';
        await loadOwnerData();
    } else {
        $('unlinkBtn').style.display = 'inline-flex';
    }
    // تحديث حالة البوت كل 15 ثانية
    setInterval(refreshBotState, 15000);
})();

// ═══════════════════ عرض بياناتي ═══════════════════

function renderMe(me) {
    const u = me.user;
    $('userName').textContent = u.name || 'مستخدم';
    $('userRole').innerHTML = roleBadge(u.role);
    $('myNumber').textContent = '+' + u.number;
    $('myRole').innerHTML = roleBadge(u.role);
    refreshBotState();
}

async function refreshBotState() {
    const me = await QR.api('/api/me');
    if (!me.ok) return;
    const conn = me.bot.connection;
    const el = $('botState');
    if (conn === 'connected') {
        el.textContent = '🟢 متصل ويعمل';
        el.className = 'v green';
    } else if (conn === 'registered') {
        el.textContent = '🟡 مسجل — يعيد الاتصال';
        el.className = 'v';
    } else {
        el.textContent = '🔴 غير متصل';
        el.className = 'v red';
    }
    $('uptime').textContent = fmtDuration(me.bot.uptimeSeconds);
    $('uptime').className = 'v purple';
}

// ═══════════════════ إعدادات البوت ═══════════════════

async function loadSettings() {
    const data = await QR.api('/api/settings');
    if (!data.ok) {
        toast('تعذر تحميل الإعدادات', 'err');
        return;
    }
    SETTINGS_META = data.meta;
    CURRENT_SETTINGS = Object.assign({}, data.settings);
    buildSettingsUI();
}

function buildSettingsUI() {
    const grid = $('settingsGrid');
    grid.innerHTML = '';
    const labels = SETTINGS_META.labels;

    // مفاتيح التبديل
    for (const key of SETTINGS_META.toggles) {
        const row = document.createElement('div');
        row.className = 'setting-row';
        row.innerHTML = `
            <div>
                <div class="lbl">${labels[key] || key}</div>
                <div class="sub">${settingSub(key)}</div>
            </div>
            <label class="switch">
                <input type="checkbox" data-key="${key}" ${CURRENT_SETTINGS[key] === 'true' ? 'checked' : ''}>
                <span class="track"></span>
            </label>`;
        grid.appendChild(row);
    }

    // القوائم المنسدلة
    for (const [key, options] of Object.entries(SETTINGS_META.choices)) {
        const row = document.createElement('div');
        row.className = 'setting-row';
        const optsHtml = options.map(o =>
            `<option value="${o}" ${CURRENT_SETTINGS[key] === o ? 'selected' : ''}>${choiceLabel(key, o)}</option>`
        ).join('');
        row.innerHTML = `
            <div>
                <div class="lbl">${labels[key] || key}</div>
                <div class="sub">${settingSub(key)}</div>
            </div>
            <select class="select" data-key="${key}">${optsHtml}</select>`;
        grid.appendChild(row);
    }

    // الحقول النصية
    for (const key of ['AUTO_STATUS_MSG', 'PREFIX']) {
        const row = document.createElement('div');
        row.className = 'setting-row';
        row.style.gridColumn = '1 / -1';
        row.innerHTML = `
            <div style="flex:1">
                <div class="lbl">${labels[key] || key}</div>
                <div class="sub">${settingSub(key)}</div>
                <input type="text" class="input ${key === 'PREFIX' ? '' : 'rtl'}" data-key="${key}"
                       style="margin-top:8px; max-width:420px" value="${escapeHtml(CURRENT_SETTINGS[key] || '')}"
                       maxlength="${key === 'PREFIX' ? 3 : 100}" ${key === 'PREFIX' ? 'style="direction:ltr; text-align:left"' : ''}>
            </div>`;
        grid.appendChild(row);
    }

    // ربط التغييرات
    grid.querySelectorAll('[data-key]').forEach(input => {
        input.addEventListener('change', () => {
            const key = input.dataset.key;
            if (input.type === 'checkbox') CURRENT_SETTINGS[key] = input.checked ? 'true' : 'false';
            else CURRENT_SETTINGS[key] = input.value;
            // حفظ تلقائي فوري
            saveSettings([key]);
        });
    });
}

function settingSub(key) {
    const subs = {
        AUTOREAD: 'يقرأ رسائلك تلقائياً (علامتان زرقاوان)',
        AUTOTYPE: 'يظهر "يكتب..." قبل الرد',
        AUTORECORD: 'يظهر "يسجل صوت..." تلقائياً',
        AUTORECORDTYPE: 'تسجيل وكتابة معاً',
        ALWAYSONLINE: 'يظهر متصلاً دائماً للجميع',
        AUTO_STATUS_REACT: 'يضع تفاعلاً على الحالات تلقائياً',
        AUTO_STATUS_REPLY: 'يرد على الحالات تلقائياً',
        BUTTONMODE: 'ردود بأزرار تفاعلية بدل النص',
        ANTICALL: 'سلوك البوت عند receiving مكالمة',
        LANGUAGE: 'لغة رسائل البوت (العربية حالياً)',
        AUTO_STATUS_MSG: 'نص الرد المرسل على الحالات',
        PREFIX: 'رمز الأوامر — مثال: . أو ! (فارغ = بدون بادئة)',
    };
    return subs[key] || '';
}

function choiceLabel(key, val) {
    if (key === 'ANTICALL') {
        return { off: 'مسموحة', decline: 'رفض تلقائي', block: 'رفض + حظر' }[val] || val;
    }
    if (key === 'LANGUAGE') return { ar: 'العربية 🇪🇬' }[val] || val;
    return val;
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function saveSettings(keys) {
    const payload = {};
    for (const k of keys) payload[k] = CURRENT_SETTINGS[k];
    const data = await QR.api('/api/settings', {
        method: 'POST',
        body: JSON.stringify({ settings: payload }),
    });
    if (data.ok) {
        toast(data.message, 'ok');
        if (data.rejected && Object.keys(data.rejected).length) {
            toast('بعض القيم مرفوضة: ' + Object.keys(data.rejected).join(', '), 'err');
        }
    } else {
        toast(data.error || 'فشل الحفظ', 'err');
    }
}

$('saveSettingsBtn').addEventListener('click', () => saveSettings(Object.keys(CURRENT_SETTINGS)));
$('reloadSettingsBtn').addEventListener('click', async () => {
    await loadSettings();
    toast('تمت استعادة القيم المحفوظة', 'info');
});
$('saveAllBtn').addEventListener('click', async () => {
    await saveSettings(Object.keys(CURRENT_SETTINGS));
    if (ME && ME.user.role === 'owner') await saveSiteSettings();
});

// ═══════════════════ لوحة المالك ═══════════════════

async function loadOwnerData() {
    const data = await QR.api('/api/admin/overview');
    if (!data.ok) return;
    $('regLimit').value = data.site.registrationLimit;
    $('allowLinks').checked = !!data.site.allowNewLinks;
    $('announcement').value = data.site.announcement || '';
    renderUsers(data.users);
}

async function saveSiteSettings() {
    const payload = {
        registrationLimit: parseInt($('regLimit').value, 10),
        allowNewLinks: $('allowLinks').checked,
        announcement: $('announcement').value.trim(),
    };
    const data = await QR.api('/api/admin/site-settings', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
    if (data.ok) {
        toast(data.message, 'ok');
    } else {
        toast(data.error || 'فشل حفظ إعدادات الموقع', 'err');
    }
}

$('saveSiteBtn').addEventListener('click', saveSiteSettings);

function renderUsers(users) {
    $('usersCount').textContent = `الإجمالي: ${users.total} · مميزون: ${users.premium} · عاديون: ${users.regular}`;
    const body = $('usersBody');
    if (!users.users.length) {
        body.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-faint)">لا يوجد مستخدمون بعد</td></tr>';
        return;
    }
    body.innerHTML = users.users.map(u => {
        const role = u.role === 'owner' ? 'owner' : u.role;
        const status = u.status === 'linked'
            ? '<span style="color:var(--green); font-weight:700">🟢 مرتبط</span>'
            : '<span style="color:var(--amber)">🟡 معلق</span>';
        const date = u.linkedAt ? new Date(u.linkedAt).toLocaleDateString('ar-EG') : '—';
        const actions = u.role === 'owner'
            ? '<span style="color:var(--gold); font-size:.75rem">حساب محمي</span>'
            : `
            <div class="actions">
                ${role === 'premium'
                    ? `<button class="btn btn-ghost btn-sm" onclick="setRole('${u.number}','user')">↩️ إرجاع لعادي</button>`
                    : `<button class="btn btn-primary btn-sm" onclick="setRole('${u.number}','premium')">💎 ترقية</button>`}
                <button class="btn btn-ghost btn-sm" onclick="resetSecret('${u.number}')">🔑 رمز جديد</button>
                <button class="btn btn-danger btn-sm" onclick="removeUser('${u.number}')">🗑️</button>
            </div>`;
        return `
            <tr>
                <td style="direction:ltr">+${u.number}</td>
                <td>${escapeHtml(u.name || '—')}</td>
                <td>${roleBadge(role)}</td>
                <td>${status}</td>
                <td>${date}</td>
                <td>${actions}</td>
            </tr>`;
    }).join('');
}

window.setRole = async function (number, role) {
    const data = await QR.api('/api/admin/users/role', {
        method: 'POST',
        body: JSON.stringify({ number, role }),
    });
    toast(data.ok ? data.message : (data.error || 'فشل'), data.ok ? 'ok' : 'err');
    if (data.ok) await loadOwnerData();
};

window.resetSecret = async function (number) {
    if (!confirm(`إعادة تعيين الرمز السري لـ +${number}؟\nسيُرسل رمز جديد له عبر واتساب.`)) return;
    const data = await QR.api('/api/admin/users/reset-secret', {
        method: 'POST',
        body: JSON.stringify({ number }),
    });
    toast(data.ok ? data.message : (data.error || 'فشل'), data.ok ? 'ok' : 'err');
};

window.removeUser = async function (number) {
    if (!confirm(`حذف +${number} نهائياً؟\nسيتم فصل جلسته وحذف بياناته بالكامل.`)) return;
    const data = await QR.api('/api/admin/users/remove', {
        method: 'POST',
        body: JSON.stringify({ number }),
    });
    toast(data.ok ? data.message : (data.error || 'فشل'), data.ok ? 'ok' : 'err');
    if (data.ok) await loadOwnerData();
};

// ═══════════════════ الخطر + الخروج ═══════════════════

$('unlinkBtn').addEventListener('click', async () => {
    if (!confirm('⚠️ فصل البوت سيحذف جلستك ورمزك السري نهائياً!\nستحتاج لربط جديد كاملاً. متأكد؟')) return;
    const data = await QR.api('/api/unlink', { method: 'POST' });
    if (data.ok) {
        QR.clearToken();
        toast(data.message, 'ok', 4000);
        setTimeout(() => window.location.replace('/link'), 1600);
    } else {
        toast(data.error || 'فشل الفصل', 'err');
    }
});

$('logoutBtn').addEventListener('click', (e) => {
    e.preventDefault();
    doLogout();
});
