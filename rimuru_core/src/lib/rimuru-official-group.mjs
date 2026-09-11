import { RIMURU_CORE_CONFIG } from "../../rimuru.mjs";
import config from "../../config.mjs";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function normalizeNumber(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (raw.endsWith("@s.whatsapp.net")) return raw;
  if (raw.endsWith("@lid")) return raw;
  const digits = raw.replace(/[^0-9]/g, "");
  return digits ? `${digits}@s.whatsapp.net` : null;
}

function getBotJid(sock) {
  const id = sock?.user?.id || "";
  if (!id) return null;
  const base = id.split(":")[0].split("@")[0];
  return base ? `${base}@s.whatsapp.net` : null;
}

function participantMatches(jid, candidate, sock) {
  if (!jid || !candidate) return false;
  if (jid === candidate) return true;
  const a = jid.split(":")[0].split("@")[0].replace(/[^0-9]/g, "");
  const b = candidate.split(":")[0].split("@")[0].replace(/[^0-9]/g, "");
  if (a && b && (a === b || a.endsWith(b) || b.endsWith(a))) return true;
  if (sock?.user?.id && jid.includes(sock.user.id.split(":")[0])) return true;
  return false;
}

function ownerJids() {
  const configured = config?.owner?.number;
  const list = Array.isArray(configured) ? configured : [configured];
  return [...new Set(list.map(normalizeNumber).filter(Boolean))];
}

async function getOfficialMeta(sock, groupJid) {
  return await sock.groupMetadata(groupJid);
}

async function ensureOwnerInOfficialGroup(sock, groupJid) {
  if (!sock?.groupMetadata || !sock?.groupParticipantsUpdate) return { added: [], failed: [] };
  const meta = await getOfficialMeta(sock, groupJid);
  const participants = meta?.participants || [];
  const added = [];
  const failed = [];

  for (const ownerJid of ownerJids()) {
    const exists = participants.some((p) => {
      const ids = [p?.id, p?.jid, p?.lid, p?.phoneNumber].filter(Boolean);
      return ids.some((id) => participantMatches(id, ownerJid, sock));
    });
    if (exists) continue;

    try {
      await sock.groupParticipantsUpdate(groupJid, [ownerJid], "add");
      added.push(ownerJid);
    } catch (error) {
      failed.push({ jid: ownerJid, error: error?.message || String(error) });
    }
  }
  return { added, failed };
}

async function leaveSilently(sock, groupJid) {
  try {
    await sock.groupLeave(groupJid);
    return true;
  } catch {
    return false;
  }
}

export async function handleOfficialRimuruGroupParticipantUpdate(sock, update, logger = console) {
  const cfg = RIMURU_CORE_CONFIG.officialRimuruGroup;
  if (!cfg?.enabled || update?.id !== cfg.id || update?.action !== "add") return false;

  const botJid = getBotJid(sock);
  const participants = Array.isArray(update.participants) ? update.participants : [];
  const botAdded = participants.some((p) => {
    const id = typeof p === "string" ? p : (p?.id || p?.jid || p?.phoneNumber || p?.lid);
    return participantMatches(String(id || ""), botJid || "", sock);
  });
  if (!botAdded) return false;

  // عند بدء التشغيل، قد يدخل حدث الإضافة نفسه مع الإقلاع في وقت واحد.
  // دع الإقلاع يُكمل إضافة المالك + المغادرة كي لا يتكرر الأمر.
  if (globalThis.__RIMURU_OFFICIAL_GROUP_BOOTSTRAP__) return true;

  try {
    await sleep(1200);
    if (cfg.addOwnerOnJoin) await ensureOwnerInOfficialGroup(sock, cfg.id);
  } catch (error) {
    try { logger.warn("official-group", `فشلت معالجة المالك: ${error.message}`); } catch {}
  }

  if (cfg.leaveAfterOwnerHandling) {
    await sleep(800);
    const left = await leaveSilently(sock, cfg.id);
    try {
      logger.info?.("official-group", left ? "غادر البوت بصمت مجموعة Rimuru-MD الرسمية" : "فشل خروج البوت من مجموعة Rimuru-MD الرسمية");
    } catch {}
  }
  return true;
}

export async function autoJoinOfficialRimuruGroup(sock, logger = console) {
  const cfg = RIMURU_CORE_CONFIG.officialRimuruGroup;
  if (!cfg?.enabled || !cfg.autoJoinOnStartup || !cfg.id || !cfg.inviteCode) return;

  await sleep(Math.max(0, Number(cfg.startupDelayMs) || 0));
  globalThis.__RIMURU_OFFICIAL_GROUP_BOOTSTRAP__ = true;
  try {
    let inGroup = false;
    try {
      const meta = await getOfficialMeta(sock, cfg.id);
      const botJid = getBotJid(sock);
      inGroup = !!meta && (meta.participants || []).some((p) => {
        const ids = [p?.id, p?.jid, p?.lid].filter(Boolean);
        return ids.some((id) => participantMatches(id, botJid || "", sock));
      });
    } catch {}

    if (!inGroup && typeof sock.groupAcceptInvite === "function") {
      await sock.groupAcceptInvite(cfg.inviteCode);
      await sleep(1200);
    }

    if (cfg.addOwnerOnJoin) {
      const result = await ensureOwnerInOfficialGroup(sock, cfg.id);
      if (result.failed.length) {
        try { logger.warn?.("official-group", `لم يمكن بعد إضافة المالك: ${result.failed.map((x) => x.error).join(" | ")}`); } catch {}
      }
    }

    if (cfg.leaveAfterOwnerHandling) {
      await sleep(800);
      await leaveSilently(sock, cfg.id);
    }
  } catch (error) {
    try { logger.warn?.("official-group", `فشل الانضمام عند الإقلاع: ${error.message}`); } catch {}
  } finally {
    delete globalThis.__RIMURU_OFFICIAL_GROUP_BOOTSTRAP__;
  }
}

export { ownerJids };
