import { RIMURU_CORE_CONFIG } from "../../rimuru.mjs";

import config from '../../config.mjs'
import * as timeHelper from './rimuru-time.mjs'
/**
 * @typedef {Object} DashboardData
 * @property {string} userName - اسم المستخدم
 * @property {string} userStatus - حالة المستخدم (Owner/Premium/Free)
 * @property {string} mode - وضع البوت (Public/Self)
 * @property {number} totalUsers - إجمالي مستخدمي البوت
 * @property {number} userLimit - حد المستخدم
 */

/**
 * @typedef {Object} BotInfoData
 * @property {string} botName - اسم البوت
 * @property {string} developer - اسم المطور
 * @property {string} version - إصدار البوت
 * @property {string} uptime - مدة تشغيل البوت
 * @property {number} totalFeatures - إجمالي الميزات
 * @property {string} mode - وضع البوت
 * @property {string} platform - منصة البوت
 */

/**
 * @typedef {Object} UserProfileData
 * @property {string} name - اسم المستخدم
 * @property {string} number - رقم المستخدم
 * @property {string} status - الحالة (Owner/Premium/Free)
 * @property {number} limit - الحد المتبقي
 * @property {string} registeredAt - تاريخ التسجيل
 */

/**
 * @typedef {Object} MenuCategory
 * @property {string} name - اسم الفئة
 * @property {string} emoji - إيموجي الفئة
 * @property {string} description - وصف الفئة
 * @property {string[]} commands - مصفوفة الأوامر في الفئة
 */

/**
 * رموز تنسيق القائمة
 * @constant
 */
const CHARS = {
  cornerTopLeft: "╭",
  cornerTopRight: "╮",
  cornerBottomLeft: "╰",
  cornerBottomRight: "╯",
  horizontal: "─",
  vertical: "│",
  arrow: "➣",
  bullet: "◦",
  star: "✦",
  diamond: "◇",
  dot: "•",
  check: "",
  cross: "✗",
  line: "━",
};

/**
 * إيموجي للاستخدامات المختلفة
 * @constant
 */
const EMOJIS = {
  dashboard: "📊",
  info: "ℹ️",
  user: "👤",
  bot: "🤖",
  owner: "👑",
  premium: "💎",
  free: "🆓",
  public: "🌐",
  self: "🔒",
  commands: "🖥️",
  utilities: "🔧",
  fun: "🎮",
  group: "👥",
  time: "⏰",
  uptime: "⏱️",
  version: "📌",
  speed: "⚡",
  limit: "📊",
  status: "📋",
  mode: "🔄",
  name: "📝",
  number: "📱",
  developer: "👨‍💻",
  total: "📈",
  tip: "💡",
  warning: "⚠️",
  success: "✅",
  error: "❌",
  loading: "🕕",
};

/**
 * تنسيق مدة التشغيل إلى نص سهل القراءة
 * @param {number} ms - المدة بالمللي ثانية
 * @returns {string} نص مدة التشغيل منسقًا
 * @example
 * formatUptime(3661000); // "1h 1m 1s"
 * formatUptime(86400000); // "1d 0h 0m"
 */
function formatUptime(ms) {
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

  return parts.join(" ");
}

/**
 * تنسيق التاريخ إلى الصيغة المحلية
 * @param {Date|number|string} date - التاريخ المراد تنسيقه
 * @returns {string} نص التاريخ منسقًا
 * @example
 * formatDate(new Date()); // "17/12/2024, 12:30:45"
 */
function formatDate(date) {
  return timeHelper.fromTimestamp(date, "DD/MM/YYYY HH:mm:ss");
}

/**
 * تنسيق رقم الهاتف إلى صيغة أوضح
 * @param {string} number - رقم الهاتف
 * @returns {string} الرقم منسقًا
 * @example
 * formatNumber('6281234567890'); // '62 812-3456-7890'
 */
function formatNumber(number) {
  if (!number) return "";
  const cleaned = number.replace(/[^0-9]/g, "");
  if (cleaned.length < 10) return cleaned;

  if (cleaned.startsWith("62")) {
    const withoutCode = cleaned.slice(2);
    const formatted = withoutCode.replace(/(\d{3})(\d{4})(\d+)/, "$1-$2-$3");
    return `62 ${formatted}`;
  }

  return cleaned;
}

/**
 * تنسيق حجم الملف إلى صيغة مقروءة
 * @param {number} bytes - الحجم بالبايت
 * @returns {string} نص الحجم منسقًا
 * @example
 * formatFileSize(1024); // "1.00 KB"
 * formatFileSize(1048576); // "1.00 MB"
 */
function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * إنشاء خط أفقي
 * @param {number} length - طول الخط
 * @param {string} [char='─'] - حرف الخط
 * @returns {string} نص الخط
 */
function createLine(length = 20, char = CHARS.horizontal) {
  return char.repeat(length);
}

/**
 * إنشاء ترويسة صندوق
 * @param {string} title - عنوان الترويسة
 * @param {number} [width=20] - عرض الصندوق
 * @returns {string} نص الترويسة
 * @example
 * createHeader('DASHBOARD');
 * // "╭─「 DASHBOARD 」─────╮"
 */
function createHeader(title, width = 20) {
  const titlePart = `${CHARS.horizontal}「 ${title} 」`;
  const remainingWidth = Math.max(0, width - titlePart.length - 2);
  return `${CHARS.cornerTopLeft}${titlePart}${createLine(remainingWidth)}${CHARS.cornerTopRight}`;
}

/**
 * إنشاء تذييل صندوق
 * @param {number} [width=20] - عرض الصندوق
 * @returns {string} نص التذييل
 * @example
 * createFooter(); // "╰────────────────────╯"
 */
function createFooter(width = 20) {
  return `${CHARS.cornerBottomLeft}${createLine(width)}${CHARS.cornerBottomRight}`;
}

/**
 * إنشاء سطر محتوى بنقطة
 * @param {string} text - نص السطر
 * @param {string} [prefix='│'] - بادئة السطر
 * @param {string} [bullet='◦'] - حرف النقطة
 * @returns {string} سطر المحتوى منسقًا
 */
function createBodyLine(text, prefix = CHARS.vertical, bullet = CHARS.bullet) {
  return `${prefix} ${bullet} ${text}`;
}

/**
 * إنشاء سطر بسهم
 * @param {string} label - التسمية
 * @param {string} value - القيمة
 * @returns {string} سطر منسق بسهم
 * @example
 * createArrowLine('الاسم', 'rimuru-AI'); // "│ ➣ الاسم: rimuru-AI"
 */
function createArrowLine(label, value) {
  return `${CHARS.vertical} ${CHARS.arrow} ${label}: ${value}`;
}

/**
 * إنشاء لوحة معلومات
 * @param {DashboardData} data - بيانات لوحة المعلومات
 * @returns {string} نص لوحة المعلومات منسقًا
 */
function createDashboard(data) {
  const {
    userName = "User",
    userStatus = "Free User",
    mode = "Public",
    totalUsers = 0,
    userLimit = 25,
  } = data;

  const lines = [
    `${CHARS.cornerTopLeft}${CHARS.horizontal}「 ${EMOJIS.dashboard} لوحة التحكم 」${CHARS.horizontal}`,
    `${CHARS.vertical}`,
    createArrowLine("الاسم", userName),
    createArrowLine("حالة المستخدم", userStatus),
    createArrowLine("الوضع", mode),
    createArrowLine("المستخدمون", totalUsers.toString()),
    createArrowLine("الحد اليومي", userLimit.toString()),
    `${CHARS.vertical}`,
    `${CHARS.cornerBottomLeft}${createLine(24)}`,
  ];

  return lines.join("\n");
}

/**
 * إنشاء معلومات البوت
 * @param {BotInfoData} data - بيانات معلومات البوت
 * @returns {string} نص معلومات البوت منسقًا
 */
function createBotInfo(data) {
  const {
    botName = RIMURU_CORE_CONFIG.bot?.name || "rimuru-AI",
    developer = config.owner?.name || "Owner",
    version = RIMURU_CORE_CONFIG.bot?.version || "1.0.0",
    uptime = "0s",
    totalFeatures = 0,
    mode = config.mode || "public",
    platform = "Node.js",
  } = data;

  const lines = [
    `${CHARS.horizontal} *معلومات البوت* ${CHARS.horizontal}`,
    ``,
    `${CHARS.dot} اسم البوت : ${botName} 🌿`,
    `${CHARS.dot} المطور : ${developer}`,
    `${CHARS.dot} الوضع : ${mode.charAt(0).toUpperCase() + mode.slice(1)}`,
    `${CHARS.dot} الإصدار : ${version}`,
    `${CHARS.dot} مدة التشغيل : ${uptime}`,
    `${CHARS.dot} عدد الميزات : ${totalFeatures}`,
    `${CHARS.dot} المنصة : ${platform}`,
    ``,
  ];

  return lines.join("\n");
}

/**
 * إنشاء الملف الشخصي للمستخدم
 * @param {UserProfileData} data - بيانات الملف الشخصي
 * @returns {string} نص الملف الشخصي منسقًا
 */
function createUserProfile(data) {
  const {
    name = "User",
    number = "",
    status = "Free",
    limit = 25,
    registeredAt = "",
  } = data;

  const statusEmoji =
    status === "Owner"
      ? EMOJIS.owner
      : status === "Premium"
        ? EMOJIS.premium
        : EMOJIS.free;

  const lines = [
    `【 الملف الشخصي 】`,
    `${EMOJIS.name} الاسم   : ${name}`,
    `${EMOJIS.number} الرقم  : ${formatNumber(number)}`,
    `${statusEmoji} الحالة : ${status}`,
    `${EMOJIS.limit} الحد اليومي  : ${limit}`,
    ``,
  ];

  if (registeredAt) {
    lines.splice(5, 0, `${EMOJIS.time} التسجيل : ${registeredAt}`);
  }

  return lines.join("\n");
}

/**
 * إنشاء حالة البوت
 * @param {Object} data - بيانات حالة البوت
 * @returns {string} نص حالة البوت منسقًا
 */
function createBotStatus(data) {
  const {
    botName = RIMURU_CORE_CONFIG.bot?.name || "rimuru-AI",
    uptime = "0s",
    mode = "Public",
    totalCommands = 0,
    totalUsers = 0,
    speed = "0.00s",
  } = data;

  const lines = [
    `【 حالة البوت 】`,
    `${EMOJIS.bot} البوت      : ${botName}`,
    `${EMOJIS.uptime} مدة التشغيل   : ${uptime}`,
    `${EMOJIS.mode} الوضع     : ${mode}`,
    `${EMOJIS.commands} الأوامر : ${totalCommands} ميزة`,
    `${EMOJIS.user} المستخدمون : ${totalUsers} مستخدم`,
    `${EMOJIS.speed} السرعة    : ${speed}`,
    ``,
  ];

  return lines.join("\n");
}

/**
 * إنشاء قائمة فئة
 * @param {MenuCategory} category - بيانات الفئة
 * @param {string} prefix - بادئة الأوامر
 * @returns {string} قائمة الفئة منسقًا
 */
function createCategoryMenu(category, prefix = config.command?.prefix || ".") {
  const { name, emoji, description = "", commands = [] } = category;

  if (commands.length === 0) {
    return "";
  }

  const header = `${emoji} *${name}*`;
  const commandList = commands
    .map((cmd) => `${CHARS.vertical} ${prefix}${cmd}`)
    .join("\n");
  const footer = `${CHARS.cornerBottomLeft}${createLine(15)}`;

  return `${header}\n${commandList}\n${footer}`;
}

/**
 * إنشاء قسم فئة مع وصف فرعي
 * @param {Object} data - بيانات قسم الفئة
 * @returns {string} قسم الفئة منسقًا
 */
function createCategorySection(data) {
  const { emoji, title, command, description, prefix = "." } = data;

  const lines = [
    `${emoji} *${title}*`,
    `  اكتب: ${prefix}${command}`,
    `  ${CHARS.vertical} ( ${description} )`,
    ``,
  ];

  return lines.join("\n");
}

/**
 * إنشاء القائمة الرئيسية كاملة
 * @param {Object} data - بيانات القائمة الرئيسية
 * @returns {string} نص القائمة الرئيسية منسقًا
 */
function createMainMenu(data) {
  const {
    greeting = "",
    userName = "User",
    userStatus = "Free User",
    categories = [],
    botInfo = {},
    prefix = config.command?.prefix || ".",
  } = data;

  const parts = [];

  if (greeting) {
    parts.push(greeting);
    parts.push("");
  }

  parts.push(createDashboard({ userName, userStatus, ...data }));
  parts.push("");

  parts.push(createBotInfo(botInfo));
  parts.push("");

  for (const category of categories) {
    parts.push(
      createCategorySection({
        ...category,
        prefix,
      }),
    );
  }

  parts.push(`${EMOJIS.tip} *نصيحة:* إذا كنت لا تعرف كيف تستخدم البوت`);
  parts.push(`يمكنك السؤال إلى المالك`);
  parts.push(`${CHARS.vertical} الوضع: ${data.mode || "Public"}`);

  return parts.join("\n");
}

/**
 * إنشاء قائمة أوامر لفئة معينة
 * @param {string} categoryName - اسم الفئة
 * @param {string[]} commands - مصفوفة الأوامر
 * @param {string} prefix - بادئة الأوامر
 * @returns {string} قائمة الأوامر منسقًا
 */
function createCommandList(categoryName, commands, prefix = ".") {
  const emoji = config.categoryEmojis?.[categoryName.toLowerCase()] || "📋";

  const lines = [
    `${CHARS.cornerTopLeft}${CHARS.horizontal}❏ ${emoji} *${categoryName.toUpperCase()}*`,
    "",
  ];

  for (const cmd of commands) {
    lines.push(`${CHARS.vertical} ${prefix}${cmd}`);
  }

  lines.push("");
  lines.push(`${CHARS.cornerBottomLeft}${createLine(20)}`);

  return lines.join("\n");
}

/**
 * إنشاء رسالة انتظار/تحميل
 * @param {string} [message='انتظر لحظة...'] - رسالة التحميل
 * @returns {string} رسالة الانتظار منسقًا
 */
function createWaitMessage(message = "انتظر لحظة...") {
  return `${EMOJIS.loading} *${message}*`;
}

/**
 * إنشاء رسالة نجاح
 * @param {string} [message='تم بنجاح!'] - رسالة النجاح
 * @returns {string} رسالة النجاح منسقًا
 */
function createSuccessMessage(message = "تم بنجاح!") {
  return `${EMOJIS.success} *${message}*`;
}

/**
 * إنشاء رسالة خطأ
 * @param {string} [message='حدث خطأ!'] - رسالة الخطأ
 * @returns {string} رسالة الخطأ منسقًا
 */
function createErrorMessage(message = "حدث خطأ!") {
  return `${EMOJIS.error} *${message}*`;
}

/**
 * إنشاء رسالة تحذير
 * @param {string} message - نص التحذير
 * @returns {string} رسالة التحذير منسقًا
 */
function createWarningMessage(message) {
  return `${EMOJIS.warning} *${message}*`;
}

/**
 * الحصول على تحية حسب الوقت
 * @returns {string} رسالة التحية
 * @example
 * getTimeGreeting(); // "صباح الخير" (في الصباح)
 */
function getTimeGreeting() {
  const hour = timeHelper.getHour();

  if (hour >= 4 && hour < 10) return "صباح الخير 🌅";
  if (hour >= 10 && hour < 15) return "نهارك سعيد ☀️";
  if (hour >= 15 && hour < 18) return "مساء الخير 🌇";
  return "طابت ليلتك 🌙";
}

/**
 * تكبير الحرف الأول من كل كلمة في النص
 * @param {string} str - النص المراد تكبيره
 * @returns {string} النص بعد التكبير
 * @example
 * capitalize('hello world'); // "Hello World"
 */
function capitalize(str) {
  if (!str) return "";
  return str.replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * اقتطاع النص إذا كان طويلاً جدًا
 * @param {string} text - النص المراد اقتطاعه
 * @param {number} maxLength - الطول الأقصى
 * @param {string} [suffix='...'] - اللاحقة عند الاقتطاع
 * @returns {string} النص بعد الاقتطاع
 */
function truncate(text, maxLength, suffix = "...") {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength - suffix.length) + suffix;
}

export { CHARS, EMOJIS, formatUptime, formatDate, formatNumber, formatFileSize, createLine, createHeader, createFooter, createBodyLine, createArrowLine, createDashboard, createBotInfo, createUserProfile, createBotStatus, createCategoryMenu, createCategorySection, createMainMenu, createCommandList, createWaitMessage, createSuccessMessage, createErrorMessage, createWarningMessage, getTimeGreeting, capitalize, truncate }
