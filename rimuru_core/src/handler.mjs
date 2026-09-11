import { RIMURU_CORE_ROOT } from "../rimuru_paths.mjs";
import { RIMURU_CORE_CONFIG, RIMURU_DEVELOPER } from "../rimuru.mjs";
import {
  makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
  fetchLatestWaWebVersion,
} from "../ourin_shim.mjs";
import { Boom } from "@hapi/boom";
import pino from "pino";
import fs from "fs";
import path from "path";
import readline from "readline";
import NodeCache from "node-cache";
import config, { isOwner as isOwners, setBotNumber } from "../config.mjs";
import * as colors from "./lib/rimuru-logger.mjs";
import { extendSocket } from "./lib/rimuru-socket.mjs";
import {
  isLid,
  lidToJid,
  decodeAndNormalize,
  cacheLidJid,
  resolveAnyLidToJid,
  resolveFromSock,
  isLidConverted,
} from "./lib/rimuru-lid.mjs";
import { initAutoBackup } from "./lib/rimuru-auto-backup.mjs";
import { handleOfficialRimuruGroupParticipantUpdate } from "./lib/rimuru-official-group.mjs";
import { followOfficialRimuruChannels } from "./connection.mjs";
const groupCache = new NodeCache({ stdTTL: 5 * 60, useClones: false });
const processedMessages = new NodeCache({ stdTTL: 30, useClones: false });
const msgRetryCounterCache = new NodeCache({ stdTTL: 60, useClones: false });

let lastMessageReceived = Date.now();
let watchdogTimer = null;
const WATCHDOG_TIMEOUT = 30 * 60 * 1000;
const WATCHDOG_CHECK_INTERVAL = 60 * 1000;

function startWatchdog(reconnectFn, options) {
  if (watchdogTimer) clearInterval(watchdogTimer);
  lastMessageReceived = Date.now();

  watchdogTimer = setInterval(() => {
    const silentMs = Date.now() - lastMessageReceived;
    if (silentMs > WATCHDOG_TIMEOUT && connectionState.isReady) {
      colors.logger.warn(
        "watchdog",
        `لم تصل أي رسائل منذ فترة، سيُعاد تشغيل البوت لتنشيطه`,
      );
      connectionState.isReady = false;
      connectionState.isConnected = false;
      try {
        connectionState.sock?.end();
      } catch { }
    }
  }, WATCHDOG_CHECK_INTERVAL);

  if (watchdogTimer.unref) watchdogTimer.unref();
  colors.logger.success(
    "watchdog",
    `المراقب مُفعّل الآن، مدة الانتظار ${WATCHDOG_TIMEOUT / 60000} دقيقة`,
  );
}

function stopWatchdog() {
  if (watchdogTimer) {
    clearInterval(watchdogTimer);
    watchdogTimer = null;
  }
}

const store = {
  messages: new Map(),
  chats: new Map(),
  contacts: {},
  bind(ev) {
    ev.on("messages.upsert", ({ messages: msgs }) => {

      for (const msg of msgs) {
        const jid = msg.key?.remoteJid;
        if (!jid) continue;
        if (!this.messages.has(jid)) this.messages.set(jid, new Map());
        const chat = this.messages.get(jid);
        if (msg.key?.id) {
          chat.set(msg.key.id, msg);
          if (chat.size > 200) {
            const keys = [...chat.keys()];
            for (let i = 0; i < keys.length - 150; i++) chat.delete(keys[i]);
          }
        }
        if (msg.key?.participantAlt && msg.key?.participant) {
          const alt = decodeAndNormalize(msg.key.participantAlt);
          const primary = decodeAndNormalize(msg.key.participant);
          if (alt && primary && !isLid(alt) && !isLidConverted(alt)) {
            cacheLidJid(primary, alt);
          }
        }
        if (msg.key?.remoteJidAlt && msg.key?.remoteJid) {
          const alt = decodeAndNormalize(msg.key.remoteJidAlt);
          const primary = decodeAndNormalize(msg.key.remoteJid);
          if (alt && primary && !isLid(alt) && !isLidConverted(alt)) {
            cacheLidJid(primary, alt);
          }
        }
        if (!this.chats.has(jid)) {
          this.chats.set(jid, { id: jid });
        }
        if (msg.pushName && jid.endsWith("@s.whatsapp.net")) {
          this.contacts[jid] = { ...this.contacts[jid], notify: msg.pushName };
        }
      }
    });
    ev.on("chats.upsert", (chats) => {
      for (const chat of chats) {
        if (chat.id) this.chats.set(chat.id, chat);
      }
    });
    ev.on("contacts.upsert", (contacts) => {
      for (const contact of contacts) {
        if (contact.id)
          this.contacts[contact.id] = {
            ...this.contacts[contact.id],
            ...contact,
          };
      }
    });
  },
  async loadMessage(jid, id) {
    return this.messages.get(jid)?.get(id) || undefined;
  },
};

/**
 * @typedef {Object} ConnectionState
 * @property {boolean} isConnected - حالة الاتصال
 * @property {Object|null} sock - نسخة الاتصال
 * @property {number} reconnectAttempts - عدد محاولات إعادة الاتصال
 * @property {Date|null} connectedAt - وقت نجاح الاتصال
 */

/**
 * حالة الاتصال العامة
 * @type {ConnectionState}
 */
const connectionState = {
  isConnected: false,
  isReady: false, // Flag to prevent premature message handling
  sock: null,
  reconnectAttempts: 0,
  connectedAt: null,
};

/**
 * Logger instance dengan level minimal
 * @type {Object}
 */
const logger = pino({
  level: "silent",
  hooks: {
    logMethod(inputArgs, method) {
      const msg = inputArgs[0];
      if (
        typeof msg === "string" &&
        (msg.includes("Closing") ||
          msg.includes("session") ||
          msg.includes("SessionEntry") ||
          msg.includes("prekey"))
      ) {
        return;
      }
      return method.apply(this, inputArgs);
    },
  },
});

/**
 * واجهة إدخال التيرمنال
 * @type {readline.Interface|null}
 */
let rl = null;

/**
 * إنشاء واجهة readline
 * @returns {readline.Interface}
 */
function createReadlineInterface() {
  if (rl) {
    rl.close();
  }
  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return rl;
}

/**
 * سؤال الإدخال من المستخدم
 * @param {string} question - السؤال
 * @returns {Promise<string>} الإدخال من المستخدم
 */
function askQuestion(question) {
  return new Promise((resolve) => {
    const rlIntf = createReadlineInterface();
    rlIntf.question(question, (answer) => {
      rlIntf.close();
      resolve(answer.trim());
    });
  });
}

/**
 * بدء الاتصال بواتساب
 * @param {Object} options - خيارات الاتصال
 * @param {Function} [options.onMessage] - دالة استدعاء للرسائل الجديدة
 * @param {Function} [options.onConnectionUpdate] - دالة استدعاء لتحديثات الاتصال
 * @param {Function} [options.onGroupUpdate] - دالة استدعاء لتحديثات المجموعات
 * @returns {Promise<Object>} اتصال السوكِت
 * @example
 * const sock = await startConnection({
 *   onMessage: async (m) => {
 *     console.log('رسالة جديدة:', m.body);
 *   }
 * });
 */
async function startConnection(options = {}) {
  if (connectionState.sock) {
    try {
      connectionState.sock.end();
      colors.logger.debug("whatsapp", "تم إغلاق الاتصال السابق");
    } catch (e) { }
    connectionState.sock = null;
  }

  const sessionPath = path.join(
    RIMURU_CORE_ROOT,
    "storage",
    config.session?.folderName || "session",
  );

  if (!fs.existsSync(sessionPath)) {
    fs.mkdirSync(sessionPath, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
  const { version, isLatest } = await fetchLatestWaWebVersion()
  const usePairingCode = config.session?.usePairingCode === true;
  const pairingNumber = config.session?.pairingNumber || "";
  const sock = makeWASocket({
    version: version,
    logger,
    printQRInTerminal:
      !usePairingCode && (config.session?.printQRInTerminal ?? true),
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    browser: ["Mac OS", "Chrome", "14.4.1"],
    syncFullHistory: false,
    markOnlineOnConnect: false,
    generateHighQualityLinkPreview: false,
    shouldIgnoreJid: (jid) => (jid ? jid.includes("meta_ai") : false),
    getMessage: async (key) => {
      if (store) {
        const msg = store.messages.get(key.remoteJid)?.get(key.id);
        return msg?.message || undefined;
      }
      return undefined;
    },
    cachedGroupMetadata: async (jid) => {
      const cached = groupCache.get(jid);
      if (cached) return cached;
      try {
        const fresh = await sock.groupMetadata(jid);
        groupCache.set(jid, fresh);
        return fresh;
      } catch {
        return undefined;
      }
    },
    msgRetryCounterCache,
  });

  store.bind(sock.ev);
  sock.store = store;

  connectionState.sock = sock;
  extendSocket(sock);

  if (usePairingCode && !sock.authState.creds.registered) {
    let phoneNumber = pairingNumber;

    if (!phoneNumber || phoneNumber === "") {
      console.log("");
      colors.logger.warn("pairing", "رقم الربط غير مُعدّ في config.js — ضعه في session.pairingNumber");
      console.log("");
      phoneNumber = await askQuestion(
        colors.chalk.cyan(
          "📱 أدخل رقم واتساب البوت بالصيغة الدولية (مثال: 966512345678): ",
        ),
      );
    }

    phoneNumber = phoneNumber.replace(/[^0-9]/g, "");

    colors.logger.info("pairing", `جاري طلب كود الربط للرقم ${phoneNumber}`);

    try {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const code = await sock.requestPairingCode(phoneNumber, "RIMURUMD");
      console.log("");
      console.log(
        colors.createBanner(
          [
            "",
            "   كــود الــربــط   PAIRING CODE   ",
            "",
            `   ${colors.chalk.bold(colors.chalk.greenBright(code))}   `,
            "",
            "  أدخل هذا الكود في واتساب البوت:  ",
            "  الإعدادات ← الأجهزة المرتبطة ← ربط جهاز ← ربط برقم الهاتف  ",
            "",
          ],
          "green",
        ),
      );
      console.log("");
    } catch (error) {
      colors.logger.error("pairing", `فشل الربط: ${error.message}`);
    }
  }

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (u) => {
    const { connection: c, lastDisconnect: d, qr: q } = u;

    if (q && !usePairingCode) {
      colors.logger.info("qr", "كود QR جاهز، قم بمسحه ضوئياً");
      const { default: qrcode } = await import("qrcode");
      qrcode.toString(q, { type: "terminal", small: true }, (err, qrText) => {
        if (!err) console.log(qrText);
      });
    }

    const S = {
      C: "close",
      O: "open",
      N: "@newsletter",
    };

    if (c === S.C) {
      connectionState.isConnected = false;
      connectionState.isReady = false;
      stopWatchdog();

      const r =
        d?.error instanceof Boom
          ? d.error.output?.statusCode !== DisconnectReason.loggedOut
          : true;

      const sc = d?.error?.output?.statusCode;

      const STATUS_MESSAGES = {
        400: "⚠️ طلب غير صالح — الرسالة/الطلب غير صحيح، أعد التشغيل",
        401: "🔐 غير مصرح — انتهت الجلسة، يلزم تسجيل دخول جديد",
        403: "🚫 مرفوض — واتساب رفض الوصول، تحقق من الرقم",
        404: "❓ غير موجود — لم يتم العثور على المورد",
        405: "🚧 طريقة غير مسموحة — العملية غير مسموح بها",
        408: "⏱️ انتهاء المهلة — تحقق من اتصال الإنترنت",
        410: "📛 منتهي — تم حذف الجلسة من السيرفر، أعد التشغيل",
        428: "🔄 يلزم إعادة الاتصال",
        440: "⚡ تعارض جلسات — تم تسجيل الدخول من جهاز آخر",
        500: "💥 خطأ داخلي — خطأ في سيرفر واتساب",
        501: "📦 غير مدعوم — الميزة غير مدعومة من السيرفر بعد",
        502: "🌐 بوابة خاطئة — سيرفر واتساب لا يستجيب",
        503: "🔧 الخدمة غير متاحة — واتساب تحت الصيانة",
        504: "🕐 انتهت مهلة البوابة — سيرفر واتساب بطيء جداً في الاستجابة",
        515: "🔁 يلزم إعادة التشغيل — واتساب يطلب إعادة تشغيل الاتصال",
      };

      const statusMsg = STATUS_MESSAGES[sc] || `❔ غير معروف (الكود: ${sc})`;
      colors.logger.warn("whatsapp", `انقطع الاتصال — ${statusMsg}`);
      if (sc === DisconnectReason.loggedOut || sc === 401) {
        colors.logger.error(
          "whatsapp",
          "انتهت الجلسة — احذف مجلد storage ثم أعد التشغيل",
        );
        connectionState.reconnectAttempts = 0;
        return;
      }

      if (sc === 440) {
        connectionState.reconnectAttempts++;
        if (connectionState.reconnectAttempts <= 3) {
          colors.logger.info(
            "whatsapp",
            `محاولة إعادة الاتصال ${connectionState.reconnectAttempts}/3 خلال 10 ثوانٍ`,
          );
          setTimeout(() => startConnection(options), 1e4);
        } else {
          colors.logger.error(
            "whatsapp",
            "تعارض جلسات — تم كشف جهاز آخر، أوقف البوت الآخر",
          );
          connectionState.reconnectAttempts = 0;
        }
        return;
      }

      if (r) {
        connectionState.reconnectAttempts++;
        const m = config.session?.maxReconnectAttempts || 5;
        if (connectionState.reconnectAttempts <= m) {
          colors.logger.info(
            "whatsapp",
            `محاولة إعادة الاتصال ${connectionState.reconnectAttempts}/${m}`,
          );
          setTimeout(
            () => startConnection(options),
            config.session?.reconnectInterval || 15e3,
          );
        } else {
          colors.logger.error(
            "whatsapp",
            `فشل إعادة الاتصال بعد ${m} محاولات`,
          );
        }
      } else {
        connectionState.reconnectAttempts = 0;
      }
    }

    if (c === S.O) {
      connectionState.isConnected = true;
      connectionState.isReady = true;
      connectionState.reconnectAttempts = 0;
      connectionState.connectedAt = new Date();

      try {
        await sock.uploadPreKeys();
        colors.logger.success("session", "تمام، تم إرسال مفاتيح pre-keys إلى السيرفر");
      } catch (e) {
        colors.logger.warn("session", `فشل إرسال pre-keys: ${e.message}`);
      }

      const n = sock.user?.id?.split(":")[0] || sock.user?.id?.split("@")[0];

      n && setBotNumber(n);

      colors.logger.info(
        "bot",
        `تم الاتصال بـ: ${RIMURU_CORE_CONFIG.bot?.name || "rimuru-AI"} (${n || "?"}) · WA v${version.join(".")}`,
      );

      setTimeout(async () => {
        try {
          const { reloadAllPlugins: R, getPluginCount: G } =
            await import("./lib/rimuru-plugins.mjs");
          !G() && (await R());
        } catch { }
      }, 100);

      startWatchdog(startConnection, options);

      if (config.fake_call?.active && !global.voipClient) {
        try {
          const { VoipClient } = await import("../ourin_shim.mjs");
          global.voipClient = new VoipClient();
          await global.voipClient.connectWithSocket(sock);
          colors.logger.success("voip", "محرك المكالمات VoIP يعمل الآن (اتصال مشترك)");
        } catch (e) {
          colors.logger.warn("voip", `فشل تهيئة VoIP: ${e.message}`);
        }
      }

      setTimeout(() => {
        followOfficialRimuruChannels(sock, colors.logger).catch(() => {});
      }, 8000);

      colors.logger.success("whatsapp", "البوت جاهز لاستقبال الرسائل الآن!");
      try {
        initAutoBackup(sock);
      } catch (e) {
        colors.logger.debug("backup", "skipped: " + e.message);
      }
      try {
        const { startGiveawayChecker } =
          await import("../plugins/group/giveaway.mjs");
        const db = (await import("./lib/rimuru-database.mjs")).getDatabase();
        startGiveawayChecker(sock, db);
      } catch (e) {
        colors.logger.debug("giveaway", "skipped: " + e.message);
      }
      try {
        const { startAutoBioChecker } = await import("./lib/rimuru-scheduler.mjs");
        startAutoBioChecker(sock);
      } catch (e) {
        colors.logger.debug("autobio", "skipped: " + e.message);
      }
    }

    options.onConnectionUpdate && (await options.onConnectionUpdate(u, sock));
  });

  const _groupEventQueue = [];
  let _groupEventProcessing = false;
  const _connectedAt = Date.now();

  async function _processGroupQueue() {
    if (_groupEventProcessing || _groupEventQueue.length === 0) return;
    _groupEventProcessing = true;
    while (_groupEventQueue.length > 0) {
      const { handler: fn, args } = _groupEventQueue.shift();
      try {
        await fn(...args);
      } catch (e) {
        if (
          e?.message?.includes("rate-overlimit") ||
          e?.output?.statusCode === 429
        ) {
          colors.logger.warn("rate-limit", "throttled, waiting 5s...");
          await new Promise((r) => setTimeout(r, 5000));
          try {
            await fn(...args);
          } catch { }
        }
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    _groupEventProcessing = false;
  }

  sock.ev.on("groups.update", async ([event]) => {
    if (options.onGroupUpdate) {
      _groupEventQueue.push({
        handler: async (ev, s) => {
          try {
            const m = await s.groupMetadata(ev.id);
            groupCache.set(ev.id, m);
          } catch { }
          await options.onGroupUpdate(ev, s);
        },
        args: [event, sock],
      });
      _processGroupQueue();
    }
  });

  sock.ev.on("group-participants.update", async (event) => {
    // Jalur khusus grup resmi Rimuru-MD. Tidak mengirim chat/presence.
    try {
      const handledOfficial = await handleOfficialRimuruGroupParticipantUpdate(sock, event, colors.logger);
      if (handledOfficial) return;
    } catch {}

    if (Date.now() - _connectedAt < 15000) return;
    let metadata = groupCache.get(event.id);
    if (!metadata) {
      try {
        metadata = await sock.groupMetadata(event.id);
        groupCache.set(event.id, metadata);
      } catch { }
    }

    const botNumber =
      sock.user?.id?.split(":")[0] || sock.user?.id?.split("@")[0];
    const botLid = sock.user?.id;
    if (event.action === "add") {
      await sock.sendPresenceUpdate("available", event.id);
      const addedParticipants = event.participants || [];
      const isBotAdded = addedParticipants.some((p) => {
        const rJid =
          typeof p === "object" && p !== null ? p.phoneNumber || p.id : p;
        if (typeof rJid !== "string") return false;

        const pNum = rJid.split("@")[0].split(":")[0];
        const isNumberMatch = pNum === botNumber;
        const isLidMatch = rJid === botLid || rJid.includes(botNumber);
        const isFullMatch =
          sock.user?.id &&
          (rJid.includes(sock.user.id.split(":")[0]) ||
            rJid.includes(sock.user.id.split("@")[0]));

        return isNumberMatch || isLidMatch || isFullMatch;
      });
      if (isBotAdded) {
        try {
          const { getDatabase } = await import("./lib/rimuru-database.mjs");
          const db = getDatabase();

          try {
            const { handleAntiCulik } =
              await import("../plugins/group/anticulik.mjs");
            const culikHandled = await handleAntiCulik(event, sock, db);
            if (culikHandled) return;
          } catch { }

          const sewaData = db?.db?.data?.sewa;

          if (sewaData?.enabled) {
            const groupSewa = sewaData.groups?.[event.id];
            const isWhitelisted =
              groupSewa &&
              (groupSewa.isLifetime || groupSewa.expiredAt > Date.now());

            if (!isWhitelisted) {
              const ownerContact =
                config.bot?.support || RIMURU_DEVELOPER || "owner";
              await sock.sendMessage(event.id, {
                text:
                  `⛔ *بــوت الــإيجــار*\n\n` +
                  `> هذه المجموعة غير مسجلة في نظام الإيجار.\n` +
                  `> سيغادر البوت هذه المجموعة.\n\n` +
                  `_راسل ${ownerContact} لاستئجار البوت._`,
              });
              await new Promise((r) => setTimeout(r, 2000));
              await sock.groupLeave(event.id);
              colors.logger.warn(
                "sewa",
                `غادر تلقائياً مجموعة غير مسجلة: ${event.id}`,
              );
              return;
            }
          }

          const inviter = event.author || "";
          const inviterMention = inviter
            ? `@${inviter.split("@")[0]}`
            : "أحدهم";
          const prefix = config.command?.prefix || ".";

          let groupName = "هذه المجموعة";
          try {
            const meta = await sock.groupMetadata(event.id);
            groupName = meta.subject || "هذه المجموعة";
          } catch { }

          const saluranId =
            RIMURU_CORE_CONFIG.saluran?.id || "120363400911374213@newsletter";
          const saluranName =
            RIMURU_CORE_CONFIG.saluran?.name || RIMURU_CORE_CONFIG.bot?.name || "rimuru-AI";

          const welcomeText =
            `👋 *مــرحــبــاً بــكــم!*\n\n` +
            `أنا *${RIMURU_CORE_CONFIG.bot?.name || "rimuru-AI"}* 🤖\n\n` +
            `شكراً لدعوتي إلى *${groupName}*!\n` +
            `تمت دعوتي بواسطة ${inviterMention} ✨\n\n` +
            `╭┈┈⬡「 📋 *مــعــلــومــات* 」\n` +
            `┃ 🔧 المطور: *${RIMURU_DEVELOPER || "ShowyWharf27322"}*\n` +
            `┃ 📢 البادئة: \`${prefix}\`\n` +
            `┃ 📩 الدعم: ${config.bot?.support || "-"}\n` +
            `╰┈┈⬡\n\n` +
            `> اكتب \`${prefix}menu\` لعرض قائمة الميزات\n` +
            `> اكتب \`${prefix}help\` للمساعدة`;

          await sock.sendMessage(event.id, {
            text: welcomeText,
            contextInfo: {
              mentionedJid: inviter ? [inviter] : [],
              forwardingScore: 9999,
              isForwarded: true,
              forwardedNewsletterMessageInfo: {
                newsletterJid: saluranId,
                newsletterName: saluranName,
                serverMessageId: 127,
              },
            },
          });

          colors.logger.success("grup", `انضم البوت إلى: ${groupName}`);
        } catch (e) {
          colors.logger.error(
            "BotJoin",
            `فشل معالجة انضمام البوت: ${e.message}`,
          );
        }
      }
    }

    if (options.onParticipantsUpdate) {
      await options.onParticipantsUpdate(event, sock);
    }
  });

  sock.ev.on("chats.upsert", async (chats) => {
    for (const chat of chats) {
      const chatId = chat?.id;
      if (!chatId) continue;

      if (chatId.endsWith("@g.us")) {
        if (!global.groupMetadataCache) {
          global.groupMetadataCache = new Map();
        }

        const now = Date.now();
        if (global.groupMetadataCache.size > 100) {
          for (const [k, v] of global.groupMetadataCache) {
            if (now - v.timestamp > 10 * 60 * 1000)
              global.groupMetadataCache.delete(k);
          }
        }

        if (!global.groupMetadataCache.has(chatId)) {
          sock
            .groupMetadata(chatId)
            .then((metadata) => {
              if (metadata) {
                global.groupMetadataCache.set(chatId, {
                  data: metadata,
                  timestamp: now,
                });
              }
            })
            .catch(() => { });
        }
      }
    }
  });

  sock.ev.on("contacts.upsert", () => { });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    lastMessageReceived = Date.now();
    if (config.dev?.debugLog) {
      colors.logger.debug("pesan", `${messages.length} رسالة، النوع=${type}`);
    }
    if (type !== "notify" && type !== "append") return;

    if (!connectionState.isReady) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (!connectionState.isReady) return;
    }

    const currentSock = connectionState.sock;
    if (!currentSock) return;

    for (const msg of messages) {
      const stubType = msg.messageStubType;
      const groupJid = msg.key?.remoteJid;

      if (!msg.message && (stubType === 1 || stubType === 132)) {
        if (options.onStubMessage) {
          options.onStubMessage(msg, currentSock).catch(() => { });
        }
        continue;
      }

      if (!msg.message) continue;

      const msgId = msg.key?.id;
      if (msgId && processedMessages.has(msgId)) continue;
      if (msgId) processedMessages.set(msgId, true);

      let msgTimestamp = 0;
      if (msg.messageTimestamp) {
        if (typeof msg.messageTimestamp.toNumber === "function") {
          msgTimestamp = msg.messageTimestamp.toNumber() * 1000;
        } else {
          msgTimestamp = Number(msg.messageTimestamp) * 1000;
        }
      }

      const msgAge = Date.now() - msgTimestamp;
      if (msgAge > 5 * 60 * 1000) {
        continue;
      }

      const metadataKeys = [
        "senderKeyDistributionMessage",
        "messageContextInfo",
      ];
      const msgType =
        Object.keys(msg.message).find((k) => !metadataKeys.includes(k)) ||
        Object.keys(msg.message)[0];
      const hasInteractiveResponse = msg.message.interactiveResponseMessage;

      if (msgType === "protocolMessage") {
        const protocolMessage = msg.message.protocolMessage;
        if (protocolMessage?.type === 30 && protocolMessage?.memberLabel) {
          try {
            const { handleLabelChange } =
              await import("../plugins/group/notifgantitag.mjs");
            if (handleLabelChange) {
              await handleLabelChange(msg, currentSock);
            }
          } catch (e) { }
        }

        if (
          protocolMessage?.type === "MESSAGE_EDIT" ||
          protocolMessage?.type === 14
        ) {
          const edited = protocolMessage.editedMessage;
          if (edited) {
            const originalKey = protocolMessage.key || msg.key;
            const syntheticMsg = {
              key: {
                remoteJid: originalKey.remoteJid || msg.key.remoteJid,
                fromMe: msg.key.fromMe,
                id: originalKey.id,
                participant: msg.key.participant,
              },
              message: edited,
              messageTimestamp: Math.floor(Date.now() / 1000),
              pushName: msg.pushName || "User",
            };

            if (options.onMessage) {
              await options.onMessage(syntheticMsg, currentSock);
            }
          }
        }

        continue;
      }

      const allMsgKeys = Object.keys(msg.message || {});

      const isStatusMention =
        allMsgKeys.includes("groupStatusMessage") ||
        allMsgKeys.includes("groupStatusMessageV2") ||
        allMsgKeys.includes("groupStatusMentionMessage") ||
        allMsgKeys.includes("groupMentionedMessage") ||
        allMsgKeys.includes("statusMentionMessage") ||
        msg.message?.viewOnceMessage?.message?.groupStatusMessage ||
        msg.message?.viewOnceMessage?.message?.groupStatusMessageV2 ||
        msg.message?.viewOnceMessageV2?.message?.groupStatusMessage ||
        msg.message?.viewOnceMessageV2?.message?.groupStatusMessageV2 ||
        msg.message?.viewOnceMessageV2Extension?.message?.groupStatusMessage ||
        msg.message?.viewOnceMessageV2Extension?.message
          ?.groupStatusMessageV2 ||
        msg.message?.ephemeralMessage?.message?.groupStatusMessage ||
        msg.message?.ephemeralMessage?.message?.groupStatusMessageV2 ||
        msg.message?.viewOnceMessage?.message?.groupStatusMentionMessage ||
        msg.message?.viewOnceMessageV2?.message?.groupStatusMentionMessage ||
        msg.message?.viewOnceMessageV2Extension?.message
          ?.groupStatusMentionMessage ||
        msg.message?.ephemeralMessage?.message?.groupStatusMentionMessage ||
        msg.message?.[msgType]?.message?.groupStatusMessage ||
        msg.message?.[msgType]?.message?.groupStatusMessageV2 ||
        msg.message?.[msgType]?.message?.groupStatusMentionMessage ||
        msg.message?.[msgType]?.contextInfo?.groupMentions?.length > 0;

      const hasGroupMentionInContext = (() => {
        const content = msg.message?.[msgType];
        if (content?.contextInfo?.groupMentions?.length > 0) return true;

        const viewOnce =
          msg.message?.viewOnceMessage?.message ||
          msg.message?.viewOnceMessageV2?.message ||
          msg.message?.viewOnceMessageV2Extension?.message;
        if (viewOnce) {
          const vType = Object.keys(viewOnce)[0];
          if (viewOnce[vType]?.contextInfo?.groupMentions?.length > 0)
            return true;
        }
        return false;
      })();

      if (isStatusMention || hasGroupMentionInContext) {
        const groupJid = msg.key.remoteJid;

        try {
          const { getDatabase } = await import("./lib/rimuru-database.mjs");
          const { handleAntiTagSW, handleAntiSwGc } =
            await import("./lib/rimuru-group-protection.mjs");
          const db = getDatabase();
          if (groupJid?.endsWith("@g.us")) {
            const antiTagHandled = await handleAntiTagSW(msg, currentSock, db);
            if (!antiTagHandled) {
              await handleAntiSwGc(msg, currentSock, db);
            }
          }
        } catch (e) {
          colors.logger.error("antitagsw", e.message);
        }
      }

      const ignoredTypes = [
        "protocolMessage",
        "reactionMessage",
        "senderKeyDistributionMessage",
        "stickerSyncRmrMessage",
        "encReactionMessage",
        "keepInChatMessage",
        "deviceSentMessage",
        "call",
        "peerDataOperationRequestMessage",
        "bcallMessage",
      ];
      if (ignoredTypes.includes(msgType) && !hasInteractiveResponse) {
        continue;
      }

      let jid = msg.key.remoteJid || "";

      if (msg.key.fromMe && type === "append" && jid !== "status@broadcast") {
        continue;
      }

      if (jid === "status@broadcast") {
        try {
          let participant = msg.key.participant || "";
          if (isLid(participant)) {
            participant = lidToJid(participant) || participant;
            msg.key.participant = participant;
          }

          const { getDatabase } = await import("./lib/rimuru-database.mjs");
          const db = getDatabase();
          const autoReadSW = db.setting("autoReadSW") || {};
          const autoReactSW = db.setting("autoReactSW") || {};
          if (
            autoReadSW.enabled &&
            participant &&
            !participant.endsWith("@lid")
          ) {
            await currentSock
              .sendReceipt(
                "status@broadcast",
                participant,
                [msg.key.id],
                "read",
              )
              .catch(() => { });
          }

          if (
            autoReactSW.enabled &&
            participant &&
            !participant.endsWith("@lid")
          ) {
            const emoji = autoReactSW.emoji || "🔥";
            await currentSock
              .sendMessage(
                "status@broadcast",
                {
                  react: { text: emoji, key: msg.key },
                },
                {
                  statusJidList: [participant],
                },
              )
              .catch(() => { });
          }
        } catch (e) {
          colors.logger.debug("story", `خطأ في الحالة التلقائية: ${e.message}`);
        }
        continue;
      }

      if (isLid(jid)) {
        // لا تستبدل إلى @s.whatsapp.net مباشرة إذا لم تكن مجموعة
        const resolved = await resolveFromSock(jid, currentSock);
        if (resolved && !isLid(resolved) && !isLidConverted(resolved)) {
          jid = resolved;
          msg.key.remoteJid = jid;
        }
      }

      if (msg.key.participant && isLid(msg.key.participant)) {
        const resolvedPart = await resolveFromSock(msg.key.participant, currentSock);
        if (resolvedPart && !isLid(resolvedPart) && !isLidConverted(resolvedPart)) {
          msg.key.participant = resolvedPart;
        }
      }
      if (jid.endsWith("@broadcast")) {
        continue;
      }
      if (!jid || jid === "undefined" || jid.length < 5) {
        continue;
      }
      if (options.onRawMessage) {
        try {
          await options.onRawMessage(msg, currentSock);
        } catch (error) { }
      }

      const messageBody = (() => {
        const m = msg.message;
        if (!m) return "";
        const type = Object.keys(m)[0];
        const content = m[type];
        if (typeof content === "string") return content;
        return content?.text || content?.caption || content?.conversation || "";
      })();

      const isGroup = msg.key.remoteJid?.endsWith("@g.us");
      const senderJid = isGroup
        ? msg.key.participantAlt || msg.key.participant
        : msg.key.remoteJidAlt || msg.key.remoteJid || "";
      const isOwner = isOwners(senderJid);
      if (isOwner && messageBody.startsWith("=>")) {
        console.log("Owner", "Executing code");
        const code = messageBody.slice(2).trim();
        if (code) {
          try {
            const { serialize } = await import("./lib/rimuru-serialize.mjs");
            const m = await serialize(currentSock, msg, {});
            const { getDatabase: _getDb } =
              await import("./lib/rimuru-database.mjs");
            const db = _getDb();
            const sock = currentSock;
            const { default: sharp } = await import("sharp");

            let result;
            if (code.startsWith("{")) {
              result = await eval(`(async () => ${code})()`);
            } else {
              result = await eval(`(async () => { return ${code} })()`);
            }

            if (typeof result !== "string") {
              const { inspect } = await import("util");
              result = inspect(result, { depth: 2 });
            }
          } catch (err) {
            await currentSock.sendMessage(
              jid,
              {
                text: `❌ *ᴇᴠᴀʟ ᴇʀʀᴏʀ*\n\n\`\`\`\n${err.message}\n\`\`\``,
              },
              { quoted: msg },
            );
          }
          continue;
        }
      }

      if (isOwner && messageBody.startsWith("$")) {
        const command = messageBody.slice(1).trim();
        if (command) {
          try {
            const { exec } = await import("child_process");
            const { promisify } = await import("util");
            const execAsync = promisify(exec);

            const isWindows = process.platform === "win32";
            const shell = isWindows ? "powershell.exe" : "/bin/bash";

            await currentSock.sendMessage(
              jid,
              {
                text: `🕕 *ᴇxᴇᴄᴜᴛɪɴɢ...*\n\n\`$ ${command}\``,
              },
              { quoted: msg },
            );

            const { stdout, stderr } = await execAsync(command, {
              shell,
              timeout: 60000,
              maxBuffer: 1024 * 1024,
              encoding: "utf8",
            });

            const output = stdout || stderr || "No output";

            await currentSock.sendMessage(jid, {
              text: `✅ *ᴛᴇʀᴍɪɴᴀʟ*\n\n\`$ ${command}\`\n\n\`\`\`\n${output.slice(0, 3500)}\n\`\`\``,
            });
          } catch (err) {
            const errorMsg = err.stderr || err.stdout || err.message;
            await currentSock.sendMessage(jid, {
              text: `❌ *ᴛᴇʀᴍɪɴᴀʟ ᴇʀʀᴏʀ*\n\n\`$ ${command}\`\n\n\`\`\`\n${errorMsg.slice(0, 3500)}\n\`\`\``,
            });
          }
          continue;
        }
      }

      if (options.onMessage) {
        options.onMessage(msg, currentSock).catch((error) => {
          colors.logger.error("Message", error.message);
        });
      }
    }
  });

  sock.ev.on("group-participants.update", async (update) => {
    if (options.onGroupUpdate) {
      _groupEventQueue.push({
        handler: options.onGroupUpdate,
        args: [update, sock],
      });
      _processGroupQueue();
    }
  });

  sock.ev.on("groups.update", async (updates) => {
    for (const update of updates) {
      if (options.onGroupSettingsUpdate) {
        try {
          await options.onGroupSettingsUpdate(update, sock);
        } catch (error) {
          console.error("[GroupsUpdate] Error:", error.message);
        }
      }
    }
  });

  sock.ev.on("messages.update", async (updates) => {
    if (options.onMessageUpdate) {
      await options.onMessageUpdate(updates, sock);
    }
  });

  {
    const { getDatabase: _getDb } = await import("./lib/rimuru-database.mjs");
    const _db = _getDb();
    if (_db.setting("antiCall") ?? config.features?.antiCall) {
      sock.ev.on("call", async (calls) => {
        for (const call of calls) {
          if (call.status === "offer") {
            colors.logger.warn("Call", `رفض مكالمة من ${call.from}`);
            await sock.rejectCall(call.id, call.from);

            await sock.sendMessage(call.from, {
              text: config.messages?.rejectCall,
            });

            if (config.features?.blockIfCall) {
              let targetJid = call.from;

              if (targetJid.endsWith("@lid")) {
                try {
                  const pn =
                    await sock.signalRepository?.lidMapping?.getPNForLID(
                      targetJid,
                    );
                  if (pn) {
                    targetJid = pn;
                    colors.logger.info(
                      "Call",
                      `تم تحويل @lid إلى الرقم الأصلي: ${targetJid}`,
                    );
                  }
                } catch (e) {
                  colors.logger.warn(
                    "Call",
                    `فشل تحويل LID إلى رقم: ${e.message}`,
                  );
                }
              }

              if (!targetJid.endsWith("@lid")) {
                try {
                  const sanitizedJid = targetJid.replace(/:\d+@/, "@");
                  await _db.setUser(sanitizedJid, { isBlocked: true });

                  try {
                    await sock.updateBlockStatus(
                      sanitizedJid.split("@")[0],
                      "block",
                    );
                    colors.logger.info(
                      "Call",
                      `تم حظر المتصل في واتساب والبوت: ${sanitizedJid}`,
                    );
                  } catch (waErr) {
                    colors.logger.warn(
                      "Call",
                      `تم الحظر في قاعدة بيانات البوت لكن فشل في سيرفر واتساب (${sanitizedJid}): ${waErr.message}`,
                    );
                  }
                } catch (e) {
                  colors.logger.error(
                    "Call",
                    `فشل الحظر في قاعدة البيانات: ${e.message}`,
                  );
                }
              } else {
                colors.logger.warn(
                  "Call",
                  `تم تجاوز الحظر لأنه فشل الحصول على الرقم الأصلي من @lid: ${targetJid}`,
                );
              }
            }
          }
        }
      });
    }
  }

  process.nextTick(() => {
    try {
      sock.ev?.flush?.();
    } catch { }
  });

  setTimeout(() => {
    try {
      sock.ev?.flush?.();
    } catch { }
  }, 2000);

  const flushInterval = setInterval(() => {
    if (!connectionState.isConnected) {
      clearInterval(flushInterval);
      return;
    }
    try {
      sock.ev?.flush?.();
    } catch { }
  }, 30000);
  if (flushInterval.unref) flushInterval.unref();

  return sock;
}

/**
 * Mendapatkan status koneksi
 * @returns {ConnectionState} State koneksi saat ini
 */
function getConnectionState() {
  return connectionState;
}

/**
 * Mendapatkan socket instance
 * @returns {Object|null} Socket atau null jika tidak terkoneksi
 */
function getSocket() {
  return connectionState.sock;
}

/**
 * Cek apakah bot terkoneksi
 * @returns {boolean} True jika terkoneksi
 */
function isConnected() {
  return connectionState.isConnected;
}

/**
 * Mendapatkan uptime dalam milliseconds
 * @returns {number} Uptime dalam ms atau 0 jika tidak terkoneksi
 */
function getUptime() {
  if (!connectionState.connectedAt) return 0;
  return Date.now() - connectionState.connectedAt.getTime();
}

/**
 * Logout dan hapus session
 * @returns {Promise<boolean>} True jika berhasil
 */
async function logout() {
  try {
    const sessionPath = path.join(
      RIMURU_CORE_ROOT,
      "storage",
      config.session?.folderName || "session",
    );

    if (connectionState.sock) {
      await connectionState.sock.logout();
    }

    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true, force: true });
    }

    connectionState.isConnected = false;
    connectionState.sock = null;
    connectionState.connectedAt = null;

    colors.logger.success("koneksi", "تم تسجيل الخروج وحذف الجلسة");
    return true;
  } catch (error) {
    colors.logger.error("koneksi", "فشل تسجيل الخروج:", error.message);
    return false;
  }
}

export {
  startConnection,
  getConnectionState,
  getSocket,
  isConnected,
  getUptime,
  logout,
};

// Backward-compatible handler exports: the handler implementation now lives in src/connection.js.
export {
  messageHandler,
  groupHandler,
  messageUpdateHandler,
  groupSettingsHandler,
  checkPermission,
  checkMode,
  isSpamming,
  handleAntiRemoveFromUpsert,
} from "./connection.mjs";
