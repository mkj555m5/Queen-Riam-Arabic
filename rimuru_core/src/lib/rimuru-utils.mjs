
import fs from 'fs'
import path from 'path'
import axios from 'axios'
import crypto from 'crypto'
/**
 * توليد نص عشوائي بطول محدد
 * @param {number} length - الطول المطلوب
 * @param {string} [charset='alphanumeric'] - نوع الأحرف ('alphanumeric', 'numeric', 'alpha', 'hex')
 * @returns {string} نص عشوائي
 * @example
 * randomString(8); // "aB3dE7fG"
 * randomString(6, 'numeric'); // "472839"
 */
function randomString(length, charset = 'alphanumeric') {
    const charsets = {
        alphanumeric: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
        numeric: '0123456789',
        alpha: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
        hex: '0123456789abcdef'
    };
    
    const chars = charsets[charset] || charsets.alphanumeric;
    let result = '';
    
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return result;
}

/**
 * توليد عدد صحيح عشوائي بين min و max (شامل)
 * @param {number} min - القيمة الدنيا
 * @param {number} max - القيمة العليا
 * @returns {number} عدد صحيح عشوائي
 * @example
 * randomInt(1, 10); // 7
 */
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * اختيار عنصر عشوائي من مصفوفة
 * @param {Array} array - المصفوفة المراد الاختيار منها
 * @returns {*} عنصر عشوائي من المصفوفة
 * @example
 * randomPick(['a', 'b', 'c']); // 'b'
 */
function randomPick(array) {
    if (!Array.isArray(array) || array.length === 0) return null;
    return array[Math.floor(Math.random() * array.length)];
}

/**
 * تأخير التنفيذ لمدة محددة
 * @param {number} ms - المدة بالمللي ثانية
 * @returns {Promise<void>} وعد يتحقق بعد التأخير
 * @example
 * await delay(1000); // انتظر ثانية واحدة
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * التحقق هل النص رابط صالح
 * @param {string} str - النص المراد فحصه
 * @returns {boolean} صحيح إذا كان رابطًا صالحًا
 * @example
 * isUrl('https://google.com'); // true
 * isUrl('not a url'); // false
 */
function isUrl(str) {
    try {
        new URL(str);
        return true;
    } catch {
        return false;
    }
}

/**
 * التحقق هل النص رقم هاتف صالح
 * @param {string} str - النص المراد فحصه
 * @returns {boolean} صحيح إذا كان رقم هاتف صالحًا
 * @example
 * isPhoneNumber('6281234567890'); // true
 */
function isPhoneNumber(str) {
    return /^[0-9]{10,15}$/.test(str.replace(/[^0-9]/g, ''));
}

/**
 * التحقق هل النص بريد إلكتروني صالح
 * @param {string} str - النص المراد فحصه
 * @returns {boolean} صحيح إذا كان بريدًا صالحًا
 */
function isEmail(str) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
}

/**
 * استخراج المنشن من النص
 * @param {string} text - النص الذي يحتوي منشن
 * @returns {string[]} مصفوفة الأرقام المذكورة
 * @example
 * parseMention('@6281234567890 hello'); // ['6281234567890']
 */
function parseMention(text) {
    if (!text) return [];
    const matches = text.match(/@([0-9]+)/g);
    if (!matches) return [];
    return matches.map(m => m.replace('@', ''));
}

/**
 * تهريب أحرف التعبير النمطي الخاصة
 * @param {string} str - النص المراد تهريبه
 * @returns {string} النص بعد التهريب
 */
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * استنساخ عميق لكائن
 * @param {Object} obj - الكائن المراد استنساخه
 * @returns {Object} الكائن المستنسخ
 */
function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

/**
 * دمج كائنات بعمق
 * @param {Object} target - الكائن الهدف
 * @param {Object} source - الكائن المصدر
 * @returns {Object} الكائن المدموج
 */
function deepMerge(target, source) {
    const result = { ...target };
    
    for (const key of Object.keys(source)) {
        if (source[key] instanceof Object && key in target) {
            result[key] = deepMerge(target[key], source[key]);
        } else {
            result[key] = source[key];
        }
    }
    
    return result;
}

/**
 * جلب Buffer من رابط
 * @param {string} url - الرابط المراد جلبه
 * @param {Object} [options={}] - خيارات Axios
 * @returns {Promise<Buffer>} Buffer من الاستجابة
 * @example
 * const buffer = await fetchBuffer('https://example.com/image.png');
 */
async function fetchBuffer(url, options = {}) {
    try {
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            ...options
        });
        return Buffer.from(response.data);
    } catch (error) {
        throw new Error(`Failed to fetch buffer: ${error.message}`);
    }
}

/**
 * جلب JSON من رابط
 * @param {string} url - الرابط المراد جلبه
 * @param {Object} [options={}] - خيارات Axios
 * @returns {Promise<Object>} استجابة JSON
 * @example
 * const data = await fetchJson('https://api.example.com/data');
 */
async function fetchJson(url, options = {}) {
    try {
        const response = await axios.get(url, {
            responseType: 'json',
            ...options
        });
        return response.data;
    } catch (error) {
        throw new Error(`Failed to fetch JSON: ${error.message}`);
    }
}

/**
 * جلب نص من رابط
 * @param {string} url - الرابط المراد جلبه
 * @param {Object} [options={}] - خيارات Axios
 * @returns {Promise<string>} نص الاستجابة
 */
async function fetchText(url, options = {}) {
    try {
        const response = await axios.get(url, {
            responseType: 'text',
            ...options
        });
        return response.data;
    } catch (error) {
        throw new Error(`Failed to fetch text: ${error.message}`);
    }
}

/**
 * تنزيل ملف من رابط وحفظه في مسار
 * @param {string} url - رابط الملف
 * @param {string} filePath - المسار للحفظ
 * @returns {Promise<string>} مسار الملف المحفوظ
 */
async function downloadFile(url, filePath) {
    try {
        const buffer = await fetchBuffer(url);
        const dir = path.dirname(filePath);
        
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        fs.writeFileSync(filePath, buffer);
        return filePath;
    } catch (error) {
        throw new Error(`Failed to download file: ${error.message}`);
    }
}

/**
 * توليد بصمة MD5 من نص
 * @param {string} str - النص المراد تجزئته
 * @returns {string} بصمة MD5
 */
function md5(str) {
    return crypto.createHash('md5').update(str).digest('hex');
}

/**
 * توليد بصمة SHA256 من نص
 * @param {string} str - النص المراد تجزئته
 * @returns {string} بصمة SHA256
 */
function sha256(str) {
    return crypto.createHash('sha256').update(str).digest('hex');
}

/**
 * ترميز نص إلى Base64
 * @param {string} str - النص المراد ترميزه
 * @returns {string} نص مشفر بـ Base64
 */
function toBase64(str) {
    return Buffer.from(str).toString('base64');
}

/**
 * فك ترميز Base64 إلى نص
 * @param {string} str - نص Base64 المراد فكه
 * @returns {string} النص بعد فك الترميز
 */
function fromBase64(str) {
    return Buffer.from(str, 'base64').toString('utf-8');
}

/**
 * التحقق هل المسار ملف
 * @param {string} filePath - المسار المراد فحصه
 * @returns {boolean} صحيح إذا كان ملفًا موجودًا
 */
function isFile(filePath) {
    try {
        return fs.statSync(filePath).isFile();
    } catch {
        return false;
    }
}

/**
 * التحقق هل المسار مجلد
 * @param {string} dirPath - المسار المراد فحصه
 * @returns {boolean} صحيح إذا كان مجلدًا موجودًا
 */
function isDirectory(dirPath) {
    try {
        return fs.statSync(dirPath).isDirectory();
    } catch {
        return false;
    }
}

/**
 * إنشاء مجلد إن لم يكن موجودًا
 * @param {string} dirPath - مسار المجلد
 * @returns {boolean} صحيح عند النجاح
 */
function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
    return true;
}

/**
 * قراءة ملف JSON بأمان
 * @param {string} filePath - مسار ملف JSON
 * @param {*} [defaultValue={}] - القيمة الافتراضية إن لم يوجد الملف
 * @returns {Object} JSON المحلل أو القيمة الافتراضية
 */
function readJsonFile(filePath, defaultValue = {}) {
    try {
        if (!fs.existsSync(filePath)) return defaultValue;
        const content = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(content);
    } catch {
        return defaultValue;
    }
}

/**
 * كتابة كائن إلى ملف JSON
 * @param {string} filePath - مسار ملف JSON
 * @param {Object} data - البيانات المراد كتابتها
 * @param {boolean} [pretty=true] - هل يُنسق بمسافات بادئة
 * @returns {boolean} صحيح عند النجاح
 */
function writeJsonFile(filePath, data, pretty = true) {
    try {
        const dir = path.dirname(filePath);
        ensureDir(dir);
        
        const content = pretty 
            ? JSON.stringify(data, null, 2) 
            : JSON.stringify(data);
        fs.writeFileSync(filePath, content, 'utf-8');
        return true;
    } catch {
        return false;
    }
}

/**
 * الحصول على نوع MIME من Buffer
 * @param {Buffer} buffer - الـ Buffer المراد فحصه
 * @returns {string} نوع MIME
 */
function getMimeType(buffer) {
    const signatures = {
        'ffd8ff': 'image/jpeg',
        '89504e47': 'image/png',
        '47494638': 'image/gif',
        '52494646': 'image/webp',
        '00000020': 'video/mp4',
        '00000018': 'video/mp4',
        '00000014': 'video/mp4',
        '1a45dfa3': 'video/webm',
        '4f676753': 'audio/ogg',
        'fff3': 'audio/mpeg',
        'fff2': 'audio/mpeg',
        'fffb': 'audio/mpeg',
        '494433': 'audio/mpeg',
        '25504446': 'application/pdf'
    };
    
    const hex = buffer.slice(0, 4).toString('hex');
    
    for (const [sig, mime] of Object.entries(signatures)) {
        if (hex.startsWith(sig)) {
            return mime;
        }
    }
    
    return 'application/octet-stream';
}

/**
 * الحصول على امتداد الملف من نوع MIME
 * @param {string} mimeType - نوع MIME
 * @returns {string} امتداد الملف (بدون نقطة)
 */
function getExtension(mimeType) {
    const extensions = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/webp': 'webp',
        'video/mp4': 'mp4',
        'video/webm': 'webm',
        'audio/mpeg': 'mp3',
        'audio/ogg': 'ogg',
        'audio/opus': 'opus',
        'application/pdf': 'pdf'
    };
    
    return extensions[mimeType] || 'bin';
}

/**
 * سكون بمدة عشوائية
 * @param {number} minMs - أدنى مدة
 * @param {number} maxMs - أقصى مدة
 * @returns {Promise<void>}
 */
async function randomDelay(minMs, maxMs) {
    const ms = randomInt(minMs, maxMs);
    return delay(ms);
}

/**
 * إعادة المحاولة مع تراجع أسي
 * @param {Function} fn - الدالة المراد إعادة محاولتها
 * @param {number} [maxRetries=3] - أقصى عدد محاولات
 * @param {number} [baseDelay=1000] - التأخير الأساسي بالمللي ثانية
 * @returns {Promise<*>} نتيجة الدالة
 */
async function retry(fn, maxRetries = 3, baseDelay = 1000) {
    let lastError;
    
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            if (i < maxRetries - 1) {
                await delay(baseDelay * Math.pow(2, i));
            }
        }
    }
    
    throw lastError;
}

/**
 * تقسيم مصفوفة إلى مصفوفات بحجم محدد
 * @param {Array} array - المصفوفة المراد تقسيمها
 * @param {number} size - حجم كل مقطع
 * @returns {Array<Array>} مصفوفة المقاطع
 * @example
 * chunk([1,2,3,4,5], 2); // [[1,2], [3,4], [5]]
 */
function chunk(array, size) {
    const result = [];
    for (let i = 0; i < array.length; i += size) {
        result.push(array.slice(i, i + size));
    }
    return result;
}

/**
 * تسطيح مصفوفة متداخلة
 * @param {Array} array - المصفوفة المتداخلة
 * @param {number} [depth=1] - عمق التسطيح
 * @returns {Array} المصفوفة المسطحة
 */
function flatten(array, depth = 1) {
    return array.flat(depth);
}

/**
 * إزالة التكرار من مصفوفة
 * @param {Array} array - المصفوفة التي قد تحتوي تكرارًا
 * @returns {Array} المصفوفة بدون تكرار
 */
function unique(array) {
    return [...new Set(array)];
}

/**
 * تجميع مصفوفة حسب مفتاح
 * @param {Array<Object>} array - مصفوفة كائنات
 * @param {string} key - مفتاح التجميع
 * @returns {Object} كائن مجمّع
 */
function groupBy(array, key) {
    return array.reduce((result, item) => {
        const groupKey = item[key];
        if (!result[groupKey]) {
            result[groupKey] = [];
        }
        result[groupKey].push(item);
        return result;
    }, {});
}

/**
 * فرز مصفوفة كائنات حسب مفتاح
 * @param {Array<Object>} array - مصفوفة كائنات
 * @param {string} key - مفتاح الفرز
 * @param {string} [order='asc'] - الترتيب: 'asc' أو 'desc'
 * @returns {Array<Object>} المصفوفة المرتبة
 */
function sortBy(array, key, order = 'asc') {
    const multiplier = order === 'desc' ? -1 : 1;
    return [...array].sort((a, b) => {
        if (a[key] < b[key]) return -1 * multiplier;
        if (a[key] > b[key]) return 1 * multiplier;
        return 0;
    });
}

export { randomString, randomInt, randomPick, delay, isUrl, isPhoneNumber, isEmail, parseMention, escapeRegex, deepClone, deepMerge, fetchBuffer, fetchJson, fetchText, downloadFile, md5, sha256, toBase64, fromBase64, isFile, isDirectory, ensureDir, readJsonFile, writeJsonFile, getMimeType, getExtension, randomDelay, retry, chunk, flatten, unique, groupBy, sortBy }
