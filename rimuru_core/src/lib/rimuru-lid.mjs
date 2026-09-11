import { RIMURU_CORE_ROOT } from "../../rimuru_paths.mjs";
import { jidDecode } from "../../ourin_shim.mjs";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const lidCache = new Map();
const LID_CACHE_PATH = join(RIMURU_CORE_ROOT, "database", "lid-cache.json");
let _persistDirty = false;
let _persistTimer = null;

function loadPersistentCache() {
  try {
    if (existsSync(LID_CACHE_PATH)) {
      const data = JSON.parse(readFileSync(LID_CACHE_PATH, "utf8"));
      if (data && typeof data === "object") {
        for (const [k, v] of Object.entries(data)) {
          if (!lidCache.has(k)) lidCache.set(k, v);
        }
      }
    }
  } catch {}
}

function savePersistentCache() {
  if (!_persistDirty) return;
  try {
    const dirPath = join(RIMURU_CORE_ROOT, "database");
    if (!existsSync(dirPath)) mkdirSync(dirPath, { recursive: true });
    const obj = Object.fromEntries(lidCache);
    writeFileSync(LID_CACHE_PATH, JSON.stringify(obj));
    _persistDirty = false;
  } catch {}
}

function markDirty() {
  _persistDirty = true;
  if (!_persistTimer) {
    _persistTimer = setTimeout(() => {
      _persistTimer = null;
      savePersistentCache();
    }, 10000);
  }
}

loadPersistentCache();
process.on("exit", savePersistentCache);
process.on("SIGINT", () => {
  savePersistentCache();
  process.exit(0);
});
process.on("uncaughtException", (err) => {
  savePersistentCache();
});

/**
 * تخزين مؤقت لربط LID بـ JID
 * استدعِ هذه الدالة عند معالجة بيانات المجموعة لحفظ الربط
 *
 * HANDLES TWO DIFFERENT STRUCTURES:
 * 1. groupMetadata.participants: { id: PN, lid: LID, admin }
 * 2. GroupHandler events:        { id: LID, phoneNumber: PN, admin }
 *
 * @param {Object[]} participants - Array participant
 */
function cacheParticipantLids(participants = []) {
  for (const p of participants) {
    let pLid = "";
    let pJid = "";

    if (p.lid && p.lid.endsWith("@lid")) {
      pLid = p.lid;
      pJid = p.id || p.jid || "";
    } else if (p.phoneNumber) {
      pLid = p.id || "";
      pJid = p.phoneNumber;
    } else if (p.id && p.id.endsWith("@lid")) {
      pLid = p.id;
      pJid = p.jid || "";
    } else {
      pLid = p.lid || "";
      pJid = p.id || p.jid || "";
    }

    if (
      pLid &&
      pJid &&
      pLid.endsWith("@lid") &&
      !pJid.endsWith("@lid") &&
      !isLidConverted(pJid)
    ) {
      lidCache.set(pLid, pJid);
      const lidNumber = pLid.replace("@lid", "");
      lidCache.set(lidNumber + "@s.whatsapp.net", pJid);
      markDirty();
    }
  }
}

/**
 * Get cached JID for a LID
 * @param {string} lid - LID atau LID-converted JID
 * @returns {string|null} الـ JID المخزّن أو null إذا لم يوجد
 */
function getCachedJid(lid) {
  return lidCache.get(lid) || null;
}

/**
 * Cek apakah JID adalah format LID
 * @param {string} jid - الـ JID المُراد فحصه
 * @returns {boolean} True jika LID
 */
function isLid(jid) {
  if (!jid) return false;
  return jid.endsWith("@lid");
}

/**
 * التحقق مما إذا كان الـ JID ناتج تحويل LID خاطئ
 * (JID بلاحقة @s.whatsapp.net لكن رقمه هو رقم LID وليس رقم هاتف)
 * رقم LID عادة: طويل جداً ولا يبدأ ببادئة دولة طبيعية
 * @param {string} jid - الـ JID المُراد فحصه
 * @returns {boolean} صحيح إذا كان على الأرجح LID تم تحويله
 */
function isLidConverted(jid) {
  if (!jid) return false;
  if (!jid.endsWith("@s.whatsapp.net")) return false;

  const number = jid.replace("@s.whatsapp.net", "");

  if (number.length > 14) return true;
  const validCountryCodes = [
    "1",
    "7",
    "20",
    "27",
    "30",
    "31",
    "32",
    "33",
    "34",
    "36",
    "39",
    "40",
    "41",
    "43",
    "44",
    "45",
    "46",
    "47",
    "48",
    "49",
    "51",
    "52",
    "53",
    "54",
    "55",
    "56",
    "57",
    "58",
    "60",
    "61",
    "62",
    "63",
    "64",
    "65",
    "66",
    "81",
    "82",
    "84",
    "86",
    "90",
    "91",
    "92",
    "93",
    "94",
    "95",
    "98",
    "212",
    "213",
    "216",
    "218",
    "220",
    "221",
    "234",
    "249",
    "254",
    "255",
    "256",
    "260",
    "263",
    "351",
    "352",
    "353",
    "354",
    "355",
    "356",
    "357",
    "358",
    "359",
    "370",
    "371",
    "372",
    "373",
    "374",
    "375",
    "376",
    "377",
    "378",
    "380",
    "381",
    "382",
    "383",
    "385",
    "386",
    "387",
    "389",
    "420",
    "421",
    "423",
    "852",
    "853",
    "855",
    "856",
    "880",
    "886",
    "960",
    "961",
    "962",
    "963",
    "964",
    "965",
    "966",
    "967",
    "968",
    "970",
    "971",
    "972",
    "973",
    "974",
    "975",
    "976",
    "977",
    "992",
    "993",
    "994",
    "995",
    "996",
    "998",
  ];
  for (const code of validCountryCodes) {
    if (
      number.startsWith(code) &&
      number.length >= code.length + 6 &&
      number.length <= code.length + 12
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Convert LID ke format JID standard
 * ملاحظة: LID له معرّف فريد مختلف عن رقم الهاتف.
 * هذه الدالة تستبدل اللاحقة فقط، وللحصول على الرقم الأصلي
 * استخدم resolveLidFromParticipants مع بيانات المجموعة.
 * @param {string} jid - الـ JID الذي قد يكون LID
 * @returns {string} JID dalam format @s.whatsapp.net
 */
function lidToJid(jid) {
  if (!jid) return jid;
  const cached = lidCache.get(jid);
  if (cached && !isLidConverted(cached)) return cached;
  if (jid.endsWith("@lid")) {
    const swJid = jid.replace("@lid", "@s.whatsapp.net");
    const cached2 = lidCache.get(swJid);
    if (cached2 && !isLidConverted(cached2)) return cached2;
    return swJid;
  }
  return jid;
}

function lidToJidSafe(jid) {
  if (!jid) return null;
  const cached = lidCache.get(jid);
  if (cached && !isLidConverted(cached)) return cached;
  if (jid.endsWith("@lid")) {
    const swJid = jid.replace("@lid", "@s.whatsapp.net");
    const cached2 = lidCache.get(swJid);
    if (cached2 && !isLidConverted(cached2)) return cached2;
  }
  return null;
}

/**
 * Extract nomor dari JID apapun (termasuk LID)
 * @param {string} jid - JID
 * @returns {string} Nomor telepon
 */
async function extractNumber(jid) {
  if (!jid) return "";
  return jid.replace(/@.+/g, "");
}

/**
 * تحويل LID أو JID المحوَّل من LID إلى JID أصلي باستخدام بيانات المجموعة
 * Participant structure dari rimuru (groups.js):
 * - id: phone_number atau jid (tergantung addressingMode)
 * - lid: LID format
 * - admin: type admin
 * @param {string} jid - الـ JID الذي قد يكون LID أو محوَّلاً منه
 * @param {Object[]} participants - Array participant dari group metadata
 * @returns {string} الـ JID بعد التحويل إلى الرقم الأصلي
 */
function resolveLidFromParticipants(jid, participants = []) {
  if (!jid) return jid;
  if (!participants || participants.length === 0) return jid;

  const lidNumber = jid.replace(/@.*$/, "");
  const lidFormat = lidNumber + "@lid";

  for (const p of participants) {
    let pLid = "";
    let pJid = "";

    if (p.lid && p.lid.endsWith("@lid")) {
      pLid = p.lid;
      pJid = p.id || p.jid || "";
    } else if (p.phoneNumber) {
      pLid = p.id || "";
      pJid = p.phoneNumber;
    } else if (p.id && p.id.endsWith("@lid")) {
      pLid = p.id;
      pJid = p.jid || "";
    } else {
      pLid = p.lid || "";
      pJid = p.id || p.jid || "";
    }

    const pLidNumber = pLid.replace("@lid", "");

    if (pLid === lidFormat || pLid === jid || pLidNumber === lidNumber) {
      if (pJid && !pJid.endsWith("@lid") && !isLidConverted(pJid)) {
        return pJid;
      }
    }
  }

  return isLid(jid) ? lidToJid(jid) : jid;
}

/**
 * تحويل JID المحوَّل من LID إلى JID أصلي
 * تعالج هذه الدالة حالة وجود @s.whatsapp.net في الـ JID لكن رقمه هو رقم LID
 * @param {string} jid - الـ JID المُراد تحويله
 * @param {Object[]} participants - Array participant dari group metadata
 * @returns {string} الـ JID برقم الهاتف الأصلي
 */
function resolveAnyLidToJid(jid, participants = []) {
  if (!jid) return jid;

  // فحص المخزن المؤقت أولاً (مهم لرسائل الوداع حيث يكون العضو قد غادر)
  const cached = getCachedJid(jid);
  if (cached) {
    return cached;
  }

  // فحص صيغة LID في المخزن أيضاً
  if (jid.endsWith("@s.whatsapp.net")) {
    const lidFormat = jid.replace("@s.whatsapp.net", "@lid");
    const cachedFromLid = getCachedJid(lidFormat);
    if (cachedFromLid) {
      return cachedFromLid;
    }
  }

  if (!participants || participants.length === 0) return jid;

  cacheParticipantLids(participants);

  if (isLid(jid)) {
    const resolved = resolveLidFromParticipants(jid, participants);
    if (resolved !== jid && !isLidConverted(resolved)) {
      lidCache.set(jid, resolved);
    }
    return resolved;
  }

  if (isLidConverted(jid)) {
    const lidNumber = jid.replace("@s.whatsapp.net", "");
    const lidFormat = lidNumber + "@lid";
    for (const p of participants) {
      let pLid = "";
      let pJid = "";

      if (p.lid && p.lid.endsWith("@lid")) {
        pLid = p.lid;
        pJid = p.id || p.jid || "";
      } else if (p.phoneNumber) {
        pLid = p.id || "";
        pJid = p.phoneNumber;
      } else if (p.id && p.id.endsWith("@lid")) {
        pLid = p.id;
        pJid = p.jid || "";
      } else {
        pLid = p.lid || "";
        pJid = p.id || p.jid || "";
      }

      if (pLid === lidFormat || pLid === jid) {
        if (pJid && !pJid.endsWith("@lid") && !isLidConverted(pJid)) {
          lidCache.set(jid, pJid);
          lidCache.set(lidFormat, pJid);
          return pJid;
        }
      }

      const pLidNumber = pLid.replace("@lid", "");
      if (pLidNumber === lidNumber) {
        if (pJid && !pJid.endsWith("@lid") && !isLidConverted(pJid)) {
          lidCache.set(jid, pJid);
          lidCache.set(pLid, pJid);
          return pJid;
        }
      }
    }
  }

  return jid;
}

/**
 * تحويل مصفوفة JIDs مع استبدال أي LIDs أو JIDs محوَّلة
 * @param {string[]} jids - مصفوفة من الـ JIDs
 * @param {Object[]} participants - Optional group participants
 * @returns {string[]} Array of converted JIDs
 */
function convertLidArray(jids, participants = []) {
  if (!Array.isArray(jids)) return [];

  return jids.map((jid) => resolveAnyLidToJid(jid, participants));
}

/**
 * Decode JID dan kembalikan dalam format standard
 * @param {string} jid - الـ JID المُراد فك ترميزه
 * @returns {string|null} الـ JID بعد فك الترميز أو null
 */
function decodeAndNormalize(jid) {
  if (!jid) return null;
  if (isLid(jid)) {
    jid = lidToJid(jid);
  }
  if (/:\d+@/gi.test(jid)) {
    const decoded = jidDecode(jid) || {};
    if (decoded.user && decoded.server) {
      return decoded.user + "@" + decoded.server;
    }
  }
  return jid;
}

/**
 * Konversi participant JID dari message
 * @param {Object} msg - Message object
 * @param {Object} sock - Socket connection
 * @returns {Promise<string>} Resolved participant JID
 */
async function resolveParticipant(msg, sock) {
  const participant = msg.key?.participant;
  if (!participant) return null;
  if (!isLid(participant)) return participant;
  if (msg.participantPn) {
    return msg.participantPn;
  }
  if (msg.key?.remoteJid?.endsWith("@g.us") && sock) {
    try {
      const metadata = await sock.groupMetadata(msg.key.remoteJid);
      return resolveLidFromParticipants(participant, metadata.participants);
    } catch {
      // Fallback
    }
  }
  return lidToJid(participant);
}

/**
 * أداة مساعدة للحصول على JID أصلي من العضو (مع بيانات المجموعة)
 * Berdasarkan struktur participant dari Baileys:
 * - id: bisa LID atau JID asli
 * - jid: JID asli (nomor telepon)
 * - lid: LID untuk participant
 * @param {Object} participant - Participant object dari groupMetadata.participants
 * @returns {string} الـ JID القابل للاستخدام في الإشارة
 */
function getParticipantJid(participant) {
  if (!participant) return "";

  // Prefer p.jid (real phone number) - this is the most reliable
  if (
    participant.jid &&
    !participant.jid.endsWith("@lid") &&
    !isLidConverted(participant.jid)
  ) {
    return participant.jid;
  }

  // الرجوع إلى p.id إذا كان JID حقيقياً (ليس LID وليس محوَّلاً منه)
  if (
    participant.id &&
    !participant.id.endsWith("@lid") &&
    !isLidConverted(participant.id)
  ) {
    return participant.id;
  }

  // احتياطي: تحويل LID إلى صيغة JID (قد لا يكون دقيقاً)
  return lidToJid(participant.id || participant.lid || "");
}

/**
 * تحويل كل معرّفات الأعضاء إلى صيغة قابلة للإشارة
 * @param {Object[]} participants - مصفوفة الأعضاء من groupMetadata
 * @returns {string[]} مصفوفة من الـ JIDs
 */
function getParticipantJids(participants = []) {
  return participants.map((p) => getParticipantJid(p));
}

function findParticipantByNumber(participants, targetJid) {
  if (!participants || !targetJid) return null;

  const targetNumber = targetJid.replace(/@.*$/, "");

  for (const p of participants) {
    const pId = (p.id || "").replace(/@.*$/, "");
    const pJid = (p.jid || "").replace(/@.*$/, "");
    const pLid = (p.lid || "").replace(/@.*$/, "");

    if (
      pId === targetNumber ||
      pJid === targetNumber ||
      pLid === targetNumber
    ) {
      return p;
    }
  }

  return null;
}

function normalizeToPhoneNumber(jid, participants = []) {
  if (!jid) return "";

  const cached = getCachedJid(jid);
  if (cached && !isLidConverted(cached)) {
    return cached.replace(/@.+/g, "").replace(/[^0-9]/g, "");
  }

  if (isLid(jid) || isLidConverted(jid)) {
    const resolved = resolveAnyLidToJid(jid, participants);
    if (resolved && !isLidConverted(resolved)) {
      return resolved.replace(/@.+/g, "").replace(/[^0-9]/g, "");
    }
  }

  return jid.replace(/@.+/g, "").replace(/[^0-9]/g, "");
}

function cacheLidJid(lid, jid) {
  if (!lid || !jid) return;
  if (isLid(jid) || isLidConverted(jid)) return;
  lidCache.set(lid, jid);
  markDirty();
}

async function resolveFromSock(jid, sock) {
  if (!jid || !sock) return jid;
  try {
    const repo = sock.signalRepository || sock.repository;
    if (repo?.lidMapping?.getPNForLID) {
      const pn = await repo.lidMapping.getPNForLID(jid);
      if (pn && !isLid(pn) && !isLidConverted(pn)) {
        cacheLidJid(jid, pn);
        return pn;
      }
    }

    if (sock.store && sock.store.contacts) {
      for (const [pnJid, contact] of Object.entries(sock.store.contacts)) {
        if (contact.lid === jid || contact.id === jid) {
          if (pnJid && !isLid(pnJid) && !isLidConverted(pnJid) && pnJid !== "status@broadcast") {
            cacheLidJid(jid, pnJid);
            return pnJid;
          }
        }
      }
    }
  } catch {}
  return jid;
}

function getLidCacheSize() {
  return lidCache.size;
}

export {
  isLid,
  isLidConverted,
  lidToJid,
  lidToJidSafe,
  extractNumber,
  resolveLidFromParticipants,
  resolveAnyLidToJid,
  convertLidArray,
  decodeAndNormalize,
  resolveParticipant,
  getParticipantJid,
  getParticipantJids,
  findParticipantByNumber,
  cacheParticipantLids,
  getCachedJid,
  normalizeToPhoneNumber,
  cacheLidJid,
  resolveFromSock,
  getLidCacheSize,
  savePersistentCache,
};
