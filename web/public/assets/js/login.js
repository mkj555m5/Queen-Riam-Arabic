/* login.js — منطق صفحة تسجيل الدخول: رقم + رمز سري ← توكن ← لوحة التحكم */
'use strict';

const el = (id) => document.getElementById(id);
const phoneInput = el('phoneInput');
const secretInput = el('secretInput');
const loginBtn = el('loginBtn');
const loginError = el('loginError');

// منع الدخول المكرر — لو مسجل أصلاً روح اللوحة
if (QR.getToken()) {
    QR.api('/api/me').then((me) => {
        if (me.ok) window.location.replace('/dashboard');
    });
}

phoneInput.addEventListener('input', () => {
    phoneInput.value = phoneInput.value.replace(/[^\d]/g, '').slice(0, 15);
    setFormError(loginError, null);
});

secretInput.addEventListener('input', () => {
    secretInput.value = secretInput.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8);
    setFormError(loginError, null);
});

el('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const phone = phoneInput.value.trim();
    const secret = secretInput.value.trim().toUpperCase();

    if (phone.length < 10) {
        setFormError(loginError, 'أدخل رقمك بالصيغة الدولية — مثال: 201270221253');
        return;
    }
    if (secret.length < 6) {
        setFormError(loginError, 'أدخل الرمز السري المكوّن من 8 أحرف (وصلك في واتساب بعد الربط)');
        return;
    }

    setFormError(loginError, null);
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<div class="spinner"></div> جاري التحقق…';

    const data = await QR.api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ phone, secret }),
    });

    if (!data.ok) {
        loginBtn.disabled = false;
        loginBtn.textContent = '🔐 دخول لوحة التحكم';
        setFormError(loginError, data.error || 'فشل تسجيل الدخول.');
        return;
    }

    QR.setToken(data.token);
    loginBtn.textContent = '✅ أهلاً بك! جاري الدخول…';
    toast(`أهلاً ${data.user.name} 👋`, 'ok', 2500);
    setTimeout(() => window.location.replace('/dashboard'), 700);
});
