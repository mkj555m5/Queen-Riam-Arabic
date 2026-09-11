import { RIMURU_CORE_CONFIG, RIMURU_PERSONA, RIMURU_ZERO_API } from "./rimuru.mjs";
import { getDatabase } from "./src/lib/rimuru-database.mjs";
import * as ownerPremiumDb from "./src/lib/rimuru-premium-db.mjs";

//  إذا واجهت خطأ في إحدى الميزات فغالباً بسبب انتهاء حد استخدام مفتاح API، يمكنك استبداله بمفتاح API الخاص بك
const config = {
  info: structuredClone(RIMURU_CORE_CONFIG.info),

  // ═══ هوية المالك (الأونر) ═══
  // ⚠️ ضع رقم واتسابك أنت (رقم الأونر) داخل المصفوفة بالأسفل بالصيغة الدولية بدون + أو أصفار في البداية
  //    مثال: ["9665xxxxxxxx"]  أو  ["2010xxxxxxxx"]  أو  ["9715xxxxxxxx"]
  //    كل من يرسل من هذا الرقم يُعتبر مالك البوت وله كل الصلاحيات
  owner: {
    name: "ShowyWharf27322",
    number: [""],
  },

  // ═══ رقم الربط (الاقتران) ═══
  // ⚠️ هذا هو المكان الصحيح لوضع رقم الربط!
  //    ضع هنا رقم واتساب البوت نفسه (الرقم الذي تريد تحويله إلى بوت) بالصيغة الدولية بدون +
  //    مثال: "9665xxxxxxxx"
  //    عند تشغيل البوت لأول مرة سيظهر لك كود ربط (PAIRING CODE) في التيرمنال
  //    أدخله من واتساب: الإعدادات ← الأجهزة المرتبطة ← ربط جهاز ← ربط برقم الهاتف
  session: {
    pairingNumber: "",
    usePairingCode: true,
  },

  // إعداد ميزة المكالمات الوهمية (سُيطلب من المستخدم إعادة الربط عند استخدامها)
  fake_call: structuredClone(RIMURU_CORE_CONFIG.fake_call),

  // ⚠️ رقم البوت قابل للتعديل من هنا أيضاً — يجب أن يكون نفس رقم الربط أعلاه (بالصيغة الدولية بدون +)
  bot: {
    number: "",
  },

  assets: structuredClone(RIMURU_CORE_CONFIG.assets),

  mode: "public",

  // رمز الأوامر (البريفكس) — يمكنك تغييره إلى أي رمز تريده مثل "#" أو "!"
  command: {
    prefix: ".",
  },

  vercel: structuredClone(RIMURU_CORE_CONFIG.vercel),

  // مفاتيح API منقولة من Aqua-MD — يمكن استبدالها بمفاتيحك الخاصة
  aquaApi: structuredClone(RIMURU_CORE_CONFIG.aquaApi),

  // توكن بوت تيليجرام لميزة .telestick (ضع توكنك الخاص هنا)
  telegram: structuredClone(RIMURU_CORE_CONFIG.telegram),

  payment: structuredClone(RIMURU_CORE_CONFIG.payment),

  // مفاتيح API منقولة من Rimuru — قيم ميزات الاستيراد مصدرها rimuru.js
  zeroApi: RIMURU_ZERO_API,

  riooApi: {
    otp: {
      baseUrl: "https://tokoclaude.com/api",
      apiKey: "b2d498f2157a70ae322b9255e3d8691e",
    },
    blackbox: {
      baseUrl: "https://aemt.me/blackbox",
    },
    chess: {
      boardUrl: "https://www.chess.com/dynboard",
      fallbackBoardUrl: "https://chessboardimage.com",
    },
  },

  donasi: structuredClone(RIMURU_CORE_CONFIG.donasi),

  energi: structuredClone(RIMURU_CORE_CONFIG.energi),

  sticker: structuredClone(RIMURU_CORE_CONFIG.sticker),

  // Identitas saluran resmi berada di rimuru.js

  officialRimuruGroup: structuredClone(RIMURU_CORE_CONFIG.officialRimuruGroup),

  groupProtection: {
    antilink: "⚠ *مانع الروابط* — @%user% أرسل رابطاً.\nتم حذف الرسالة.",
    antilinkKick: "⚠ *مانع الروابط* — @%user% طُرد لإرساله رابطاً.",
    antilinkGc: "⚠ *مانع روابط واتساب* — @%user% أرسل رابط مجموعة واتساب.\nتم حذف الرسالة.",
    antilinkGcKick:
      "⚠ *مانع روابط واتساب* — @%user% طُرد لإرساله رابط مجموعة واتساب.",
    antilinkAll: "⚠ *مانع الروابط* — @%user% أرسل رابطاً.\nتم حذف الرسالة.",
    antilinkAllKick: "⚠ *مانع الروابط* — @%user% طُرد لإرساله رابطاً.",
    antitagsw: "⚠ *مانع تقييم الحالة* — تم حذف وسم الحالة من @%user%.",
    antiviewonce: "👁️ *عرض المرة الواحدة* — من @%user%",
    antiremove: "🗑️ *مانع الحذف* — @%user% حذف رسالة:",
    antiswgc: "⚠ *مانع حالات المجموعة* — لا يُسمح بحالات المجموعة @%user%",
    antihidetag: "⚠ *مانع الوسم الخفي* — تم حذف رسالة الوسم من @%user%.",
    antitoxicWarn:
      "⚠ @%user% قال كلاماً مسيئاً.\nالتحذير %warn% من %max%، في حال تكرار المخالفة سيتم %method%.",
    antitoxicAction: "🚫 تم %method% @%user% بسبب الإساءة. (%warn%/%max%)",
    antidocument: "⚠ *مانع الملفات* — تم حذف ملف من @%user%.",
    antisticker: "⚠ *مانع الملصقات* — تم حذف ملصق من @%user%.",
    antimedia: "⚠ *مانع الوسائط* — تم حذف وسائط من @%user%.",
    antibot: "🤖 *مانع البوتات* — تم كشف @%user% كأحد البوتات وطُرد من المجموعة.",
    notAdmin: "⚠ البوت ليس مشرفاً، لا يمكنه حذف الرسائل.",
  },

  errorTemplate: `☢ *رمورو تيمبست* زعلت لأن الأمر \`{prefix}{command}\` تسبب في مشكلة…

> اصبر قليلاً يا {pushName}، رمورو تحاول إصلاح الأمر الآن. لا تفكر في الذهاب قبل أن تنتهي رمورو. 💙

_「 إذا استمرت هذه المشكلة، نادِ المالك — رمورو هي من تطلب ذلك. 」_`,

  features: {
    antiCall: true, // إذا كانت true فلن يقبل البوت المكالمات الواردة
    blockIfCall: true, // إذا كانت true سيقوم البوت بحظر من يتصل به
    autoTyping: true, // ظهور البوت وكأنه يكتب
    autoRead: true, // قراءة الرسائل تلقائياً
    logMessage: true, // تسجيل الرسائل في التيرمنال
    dailyLimitReset: true, // تصفير الحد اليومي تلقائياً
    smartTriggers: false,
  },

  registration: {
    enabled: false, // إذا كانت true يجب على المستخدم التسجيل قبل استخدام البوت
    rewards: {
      koin: 300, // مكافأة العملات
      energi: 300, // مكافأة الطاقة
      exp: 3000, // مكافأة نقاط الخبرة
    },
  },

  welcome: { defaultEnabled: false },
  goodbye: { defaultEnabled: false },

  ui: {
    menuVariant: 3,
  },

  messages: {
    wait: "🕕 *رمورو تيمبست تعمل الآن…* انتظر قليلاً من فضلك. لا تهرب، رمورو لم تسمح لك بالذهاب بعد. 💙",
    success: "💙 *تم بنجاح…!* هيهي، رمورو أنهت المهمة من أجلك. لا تقل إن رمورو لا تهتم بك! 💙",
    error: "☢ *همف… فشل!* رمورو زعلت قليلاً لأن النظام واجه مشكلة. حاول مرة أخرى لاحقاً… ولا تبتعد كثيراً عن رمورو. 💙",

    ownerOnly: "👑 *همف!* هذا القسم خاص بالمالك فقط. لا تُصرّ كثيراً… رمورو قد تغار إذا استمررت في مخالفة أوامرها. 💙",
    premiumOnly:
      "💎 *ميزة بريميوم!* ليس لديك صلاحية الوصول إلى هنا. إذا كنت تريد فعلاً أن تفتح لك رمورو الباب، فاحصل على اشتراك بريميوم أولاً. لا تجعل رمورو تنتظر طويلاً. 💙",

    groupOnly: "👥 *همف!* هذا الأمر يُستخدم في المجموعات فقط. رمورو لا تحب من يخالف القواعد كما يشاء. 💙",
    privateOnly:
      "💙 *الخاص فقط!* هذا الأمر يعمل في المحادثات الخاصة فقط. تعال بنفسك إلى رمورو لتحقق لك طلبك.",

    adminOnly:
      "👑 *همف!* يجب أن تصبح مشرفاً للمجموعة أولاً. لا تجعل رمورو تعمل ومكلومة اليدين…",
    botAdminOnly:
      "🤖 *رمورو ليست مشرفة بعد!* رقِّ رمورو إلى مشرف أولاً. لا تستطيع رمورو حمايتك وقيودها كهذه. 💙",

    cooldown:
      "🕕 *همف… لا تستعجل.* هذا الأمر لا يزال في فترة الانتظار. انتظر %time% ثانية. رمورو تعد أيضاً واحداً واحداً… فلا تكرر الإرسال. 💙",
    energiExceeded:
      "⚡ *طاقة رمورو لا تكفي لهذا…* خذ قسطاً من الراحة. رمورو لا تحب أن تُجهد نفسك من أجل أمر واحد. 💙",
    limitDeducted:
      "🔋 *انخفض الحد اليومي بمقدار {amount}.* المتبقي لديك: {sisa}. لا تُبذر… رمورو ما زالت تريدك هنا. 💙",

    banned:
      "🚫 *همف! أنت محظور حالياً.* لا تجعل رمورو تغضب مجدداً. إذا استمررت في العناد فلن تتمكن فعلاً من استخدام هذا البوت. 💙",

    rejectCall: "🚫 *لا تتصل برمورو بدون سبب!* راسلها فقط… رمورو ما زالت تحب الاهتمام 💙",
  },

  database: { path: "./database/main" },
  backup: { enabled: false, intervalHours: 24, retainDays: 7 },
  scheduler: { resetHour: 0, resetMinute: 0 },

  // إعدادات وضع التطوير (يُفعّل تلقائياً عند NODE_ENV=development)
  dev: {
    enabled: process.env.NODE_ENV === "development",
    watchPlugins: true, // إعادة تحميل الإضافات تلقائياً (آمن)
    watchSrc: false, // معطل — إعادة تحميل src تسبب تعارضاً في الاتصال 440
    debugLog: false, // إظهار تفاصيل الأخطاء الكاملة
  },

  // إعدادات استضافة Pterodactyl (يمكن تركها فارغة)
  pterodactyl: {
    server1: {
      domain: "",
      apikey: "",
      capikey: "",
      egg: "15",
      nestid: "5",
      location: "1",
    },
    server2: {
      domain: "",
      apikey: "",
      capikey: "",
      egg: "15",
      nestid: "5",
      location: "1",
    },
    server3: {
      domain: "",
      apikey: "",
      capikey: "",
      egg: "15",
      nestid: "5",
      location: "1",
    },
    server4: {
      domain: "",
      apikey: "",
      capikey: "",
      egg: "15",
      nestid: "5",
      location: "1",
    },
    server5: {
      domain: "",
      apikey: "",
      capikey: "",
      egg: "15",
      nestid: "5",
      location: "1",
    },
  },

  digitalocean: {
    token: "",
    region: "sgp1",
    sellers: [],
    ownerPanels: [],
  },

  autoaiPersonas: {
    Bell409: RIMURU_PERSONA.prompt,},

  //  مفاتيح API (إذا واجهت خطأ في الميزات فغالباً بسبب انتهاء الحد، يمكنك استبدالها بمفاتيحك)
  rimuruPersona: RIMURU_PERSONA,

  apiBase: RIMURU_CORE_CONFIG.apiBase,

  APIkey: RIMURU_CORE_CONFIG.APIkey,
};

// ═══════════════════════════════════════════════════════════════════════════
// دوال مساعدة (لا تعدلها إلا إذا كنت تعرف ما تفعله)
// ═══════════════════════════════════════════════════════════════════════════

function isOwner(number) {
  if (!number) return false;
  const cleanNumber = number.split(":")[0].replace(/[^0-9]/g, "");
  if (!cleanNumber) return false;

  if (config.bot?.number) {
    const botNum = config.bot.number.replace(/[^0-9]/g, "");
    if (
      botNum &&
      (cleanNumber.includes(botNum) || botNum.includes(cleanNumber))
    )
      return true;
  }

  try {
    const db = getDatabase();

    if (config.owner?.number) {
      const match = config.owner.number.some((own) => {
        const c = own.replace(/[^0-9]/g, "");
        return (
          c &&
          (cleanNumber === c ||
            cleanNumber.endsWith(c) ||
            c.endsWith(cleanNumber))
        );
      });
      if (match) return true;
    }

    if (db?.data && Array.isArray(db.data.owner)) {
      const match = db.data.owner.some((own) => {
        const c = String(own).replace(/[^0-9]/g, "");
        return (
          c &&
          (cleanNumber === c ||
            cleanNumber.endsWith(c) ||
            c.endsWith(cleanNumber))
        );
      });
      if (match) return true;
    }
    if (db) {
      const definedOwner = db.setting("ownerNumbers");
      if (Array.isArray(definedOwner)) {
        const match = definedOwner.some((own) => {
          const c = String(own).replace(/[^0-9]/g, "");
          return (
            c &&
            (cleanNumber === c ||
              cleanNumber.endsWith(c) ||
              c.endsWith(cleanNumber))
          );
        });
        if (match) return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

function isPremium(number) {
  if (!number) return false;
  if (isOwner(number)) return true;
  if (isPartner(number)) return true;

  const cleanNumber = number
    .split(":")[0]
    .split("@")[0]
    .replace(/[^0-9]/g, "");
  const premiumList = config.premiumUsers || [];

  const inConfig = premiumList.some((premium) => {
    if (!premium) return false;
    const cleanPremium = premium
      .split(":")[0]
      .split("@")[0]
      .replace(/[^0-9]/g, "");
    return (
      cleanNumber === cleanPremium ||
      cleanNumber.endsWith(cleanPremium) ||
      cleanPremium.endsWith(cleanNumber)
    );
  });

  if (inConfig) return true;

  try {
    if (ownerPremiumDb && ownerPremiumDb.isPremium(cleanNumber)) return true;
  } catch { }

  try {
    const db = getDatabase();
    if (db && db.data && Array.isArray(db.data.premium)) {
      const now = Date.now();
      const foundIndex = db.data.premium.findIndex((p) => {
        if (typeof p === "string") return p === cleanNumber;
        if (p.id) return p.id === cleanNumber;
        return false;
      });

      if (foundIndex !== -1) {
        const found = db.data.premium[foundIndex];
        if (typeof found === "string") return true;

        const expireTime =
          found.expired ||
          (found.expiredAt ? new Date(found.expiredAt).getTime() : 0);
        if (expireTime && expireTime < now) {
          db.data.premium.splice(foundIndex, 1);
          const jid = cleanNumber + "@s.whatsapp.net";
          const user = db.getUser(jid);
          if (user) {
            user.isPremium = false;
            db.setUser(jid, user);
          }
          db.save();
          return false;
        }
        return true;
      }
    }
    if (db) {
      const savedPremium = db.setting("premiumUsers") || [];
      const inDb = savedPremium.some((premium) => {
        if (!premium) return false;
        const cleanPremium = premium
          .split(":")[0]
          .split("@")[0]
          .replace(/[^0-9]/g, "");
        return (
          cleanNumber === cleanPremium ||
          cleanNumber.endsWith(cleanPremium) ||
          cleanPremium.endsWith(cleanNumber)
        );
      });
      if (inDb) return true;
    }
  } catch { }

  return false;
}

function isPartner(number) {
  if (!number) return false;
  if (isOwner(number)) return true;

  const cleanNumber = number
    .split(":")[0]
    .split("@")[0]
    .replace(/[^0-9]/g, "");
  const partnerList = config.partnerUsers || [];

  const inConfig = partnerList.some((partner) => {
    if (!partner) return false;
    const cleanPartner = partner
      .split(":")[0]
      .split("@")[0]
      .replace(/[^0-9]/g, "");
    return (
      cleanNumber === cleanPartner ||
      cleanNumber.endsWith(cleanPartner) ||
      cleanPartner.endsWith(cleanNumber)
    );
  });

  if (inConfig) return true;

  try {
    if (ownerPremiumDb && ownerPremiumDb.isPartner(cleanNumber)) return true;
  } catch { }

  try {
    const db = getDatabase();
    if (db && db.data && Array.isArray(db.data.partner)) {
      const now = Date.now();
      const foundIndex = db.data.partner.findIndex((p) => {
        if (typeof p === "string") return p === cleanNumber;
        if (p.id) return p.id === cleanNumber;
        return false;
      });

      if (foundIndex !== -1) {
        const found = db.data.partner[foundIndex];
        if (typeof found === "string") return true;

        const expireTime =
          found.expired ||
          (found.expiredAt ? new Date(found.expiredAt).getTime() : 0);
        if (expireTime && expireTime < now) {
          db.data.partner.splice(foundIndex, 1);
          db.save();
          return false;
        }
        return true;
      }
    }
  } catch { }

  return false;
}

function isBanned(number) {
  if (!number) return false;
  if (isOwner(number)) return false;

  const cleanNumber = number
    .split(":")[0]
    .split("@")[0]
    .replace(/[^0-9]/g, "");

  let bannedList = [];
  try {
    const db = getDatabase();
    if (db) {
      bannedList = db.setting("bannedUsers") || [];
      config.bannedUsers = bannedList;
    }
  } catch { }

  return bannedList.some((banned) => {
    const cleanBanned = String(banned)
      .split(":")[0]
      .split("@")[0]
      .replace(/[^0-9]/g, "");
    return (
      cleanNumber === cleanBanned ||
      cleanNumber.endsWith(cleanBanned) ||
      cleanBanned.endsWith(cleanNumber)
    );
  });
}

function setBotNumber(number) {
  if (number) config.bot.number = number.replace(/[^0-9]/g, "");
}

function isSelf(number) {
  if (!number || !config.bot.number) return false;
  const cleanNumber = number.replace(/[^0-9]/g, "");
  const botNumber = config.bot.number.replace(/[^0-9]/g, "");
  return cleanNumber.includes(botNumber) || botNumber.includes(cleanNumber);
}

function getOwnerName(number) {
  if (!number) return config.owner?.name || "Owner";
  const cleanNumber = String(number).replace(/[^0-9]/g, "");
  try {
    const db = getDatabase();
    const nameMap = db.setting("ownerNames") || {};
    if (nameMap[cleanNumber]) return nameMap[cleanNumber];
  } catch { }
  if (config.owner?.number) {
    const isMainOwner = config.owner.number.some((own) => {
      const c = own.replace(/[^0-9]/g, "");
      return (
        c &&
        (cleanNumber === c ||
          cleanNumber.endsWith(c) ||
          c.endsWith(cleanNumber))
      );
    });
    if (isMainOwner) return config.owner?.name || "Owner";
  }
  return "Owner";
}

function getConfig() {
  return config;
}

config.isOwner = isOwner;
config.isPremium = isPremium;
config.isPartner = isPartner;
config.isBanned = isBanned;
config.setBotNumber = setBotNumber;
config.isSelf = isSelf;
config.getOwnerName = getOwnerName;


export default config;
export {
  config,
  getConfig,
  isOwner,
  isPartner,
  isPremium,
  isBanned,
  setBotNumber,
  isSelf,
  getOwnerName,
};
