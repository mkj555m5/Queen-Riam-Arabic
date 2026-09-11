const RETRYABLE_CODES = new Set([
  'EAI_AGAIN',
  'ENOTFOUND',
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_SOCKET',
]);

function isNetworkError(error) {
  if (!error) return false;
  const code = String(error.code || error.cause?.code || '').toUpperCase();
  const message = String(error.message || '').toLowerCase();
  return RETRYABLE_CODES.has(code)
    || /enotfound|eai_again|econnreset|econnrefused|etimedout|network error|fetch failed|socket hang up|connect timeout/.test(message);
}

function formatNetworkError(error, service = 'layanan eksternal') {
  if (isNetworkError(error)) {
    return `الخدمة ${service} غير قابلة للوصول حالياً. حاول مجدداً بعد قليل.`;
  }

  const status = error?.response?.status;
  if (status === 429) {
    return `الخدمة ${service} تحدّ من الطلبات حالياً. انتظر قليلاً ثم حاول مجدداً.`;
  }
  if (status >= 500) {
    return `خادم ${service} به مشكلة حالياً (${status}). حاول مرة أخرى لاحقاً.`;
  }

  const message = String(error?.message || 'حدث خطأ.');
  return message.length > 180 ? `${message.slice(0, 177)}...` : message;
}

async function withNetworkRetry(task, {
  retries = 2,
  delayMs = 900,
  factor = 1.8,
  shouldRetry = isNetworkError,
} = {}) {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await task(attempt);
    } catch (error) {
      lastError = error;
      const retryable = shouldRetry(error);
      if (!retryable || attempt >= retries) throw error;
      const delay = Math.round(delayMs * (factor ** attempt));
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error('Network request failed');
}

export { isNetworkError, formatNetworkError, withNetworkRetry };
