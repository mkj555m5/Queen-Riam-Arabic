/* link.js — منطق صفحة الربط: رقم ← كود RIAMBOOT ← متابعة حتى النجاح */
'use strict';

const el = (id) => document.getElementById(id);
const phoneInput = el('phoneInput');
const linkBtn = el('linkBtn');
const linkError = el('linkError');
const codeBox = el('codeBox');
const codeValue = el('codeValue');
const codePhone = el('codePhone');
const codeTimer = el('codeTimer');
const copyBtn = el('copyBtn');
const miniSteps = el('miniSteps');
const waitingBox = el('waitingBox');
const successBox = el('successBox');
const alreadyBox = el('alreadyBox');
const altRow = el('altRow');
const resendBtn = el('resendBtn');
const serviceChip = el('serviceChip');
const serviceText = el('serviceText');

let pollTimer = null;
let countdownTimer = null;
let currentPhone = '';

// ── فحص حالة الخدمة عند الفتح ──
(async function checkService() {
    const s = await QR.api('/api/status');
    if (s.ok) {
        const on = s.sessions.connected > 0;
        serviceChip.classList.toggle('on', on);
        serviceText.textContent = on ? 'الخدمة تعمل — جاهز للربط' : 'الخدمة قيد الإقلاع — حاول بعد لحظات';
        if (!s.registration.open) {
            serviceText.textContent = 'الربط مغلق مؤقتاً من الإدارة';
        } else if (s.registration.registered >= s.registration.limit) {
            serviceText.textContent = `تم اكتمال العدد (${s.registration.registered}/${s.registration.limit})`;
        }
    } else {
        serviceText.textContent = 'تعذر الاتصال بالخادم';
    }
})();

// ── تنظيف رقم الإدخال ──
phoneInput.addEventListener('input', () => {
    phoneInput.value = phoneInput.value.replace(/[^\d]/g, '').slice(0, 15);
    setFormError(linkError, null);
});

// ── طلب كود الربط ──
el('linkForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const phone = phoneInput.value.trim();
    if (phone.length < 10) {
        setFormError(linkError, 'أدخل رقماً صحيحاً بالصيغة الدولية — مثال: 201270221253');
        return;
    }
    currentPhone = phone;
    setFormError(linkError, null);
    linkBtn.disabled = true;
    linkBtn.innerHTML = '<div class="spinner"></div> جاري توليد الكود…';

    const data = await QR.api('/api/link/request', {
        method: 'POST',
        body: JSON.stringify({ phone }),
    });

    linkBtn.disabled = false;
    linkBtn.textContent = '🔗 توليد كود الربط';

    if (!data.ok) {
        setFormError(linkError, data.error || 'تعذر توليد الكود — حاول مرة أخرى.');
        return;
    }

    // الرقم مرتبط بالفعل؟
    if (data.alreadyLinked) {
        el('linkForm').style.display = 'none';
        alreadyBox.style.display = 'block';
        toast(data.message, 'ok');
        return;
    }

    // عرض الكود
    codePhone.textContent = '+' + phone;
    codeValue.textContent = data.code;
    codeBox.classList.add('show');
    miniSteps.classList.add('show');
    waitingBox.classList.add('show');
    successBox.classList.remove('show');
    toast('تم توليد كود الربط — أدخله في واتساب الآن ⏳', 'info', 5000);

    // عداد 3 دقائق
    let left = data.expiresIn || 180;
    clearInterval(countdownTimer);
    countdownTimer = setInterval(() => {
        left -= 1;
        if (left <= 0) {
            clearInterval(countdownTimer);
            codeTimer.textContent = '⌛ انتهت صلاحية الكود — أعد المحاولة';
            stopPolling();
            waitingBox.classList.remove('show');
            return;
        }
        codeTimer.textContent = `⏰ الصلاحية المتبقية: ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    }, 1000);

    // متابعة الحالة كل 3 ثوانٍ
    startPolling();
});

// ── نسخ الكود ──
copyBtn.addEventListener('click', async () => {
    const raw = codeValue.textContent.replace(/-/g, '');
    try {
        await navigator.clipboard.writeText(raw);
        copyBtn.textContent = '✅ تم النسخ';
    } catch (_) {
        copyBtn.textContent = raw;
    }
    setTimeout(() => (copyBtn.textContent = '📋 نسخ الكود'), 2200);
});

// ── متابعة حالة الربط ──
function startPolling() {
    stopPolling();
    pollTimer = setInterval(checkLinked, 3000);
    checkLinked();
}
function stopPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
}

async function checkLinked() {
    if (!currentPhone) return;
    const s = await QR.api('/api/link/status?phone=' + currentPhone);
    if (!s.ok) return;
    if (s.state === 'registered' || s.state === 'connected') {
        stopPolling();
        clearInterval(countdownTimer);
        waitingBox.classList.remove('show');
        codeTimer.textContent = '✅ اكتمل الربط';
        successBox.classList.add('show');
        linkBtn.disabled = true;
        toast('تم ربط البوت بنجاح! 🎉', 'ok', 6000);
    }
}

// ── إعادة إرسال الرمز السري ──
resendBtn.addEventListener('click', async () => {
    resendBtn.disabled = true;
    resendBtn.innerHTML = '<div class="spinner"></div> جاري الإرسال…';
    const data = await QR.api('/api/link/resend-secret', {
        method: 'POST',
        body: JSON.stringify({ phone: currentPhone }),
    });
    resendBtn.disabled = false;
    resendBtn.textContent = '📨 إعادة إرسال الرمز السري إلى واتسابي';
    if (data.ok) {
        toast(data.message, 'ok', 5000);
    } else {
        setFormError(linkError, data.error || 'تعذر الإرسال الآن.');
    }
});
