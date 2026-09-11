import config from "../../config.mjs";
import { getDatabase } from "./rimuru-database.mjs";
function levenshtein(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = a[j - 1] === b[i - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }
  return matrix[b.length][a.length];
}

function formatAfkDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} يوم و${hours % 24} ساعة`;
  if (hours > 0) return `${hours} ساعة و${minutes % 60} دقيقة`;
  if (minutes > 0) return `${minutes} دقيقة`;
  return `${seconds} ثانية`;
}

function checkPermission(m, pluginConfig) {
  const db = getDatabase();
  const user = db.getUser(m.sender) || {};
  let hasAccess = false;
  if (user.access && m.command) {
    const accessFound = user.access.find(
      (a) => a.cmd === m.command.toLowerCase(),
    );
    if (accessFound) {
      if (accessFound.expired === null || accessFound.expired > Date.now()) {
        hasAccess = true;
      } else {
        user.access = user.access.filter(
          (a) => a.cmd !== m.command.toLowerCase(),
        );
        db.setUser(m.sender, user);
      }
    }
  }

  if (pluginConfig.isOwner && !m.isOwner && !hasAccess) {
    return {
      allowed: false,
      reason: config.messages?.ownerOnly || "👑 همف! هذه الميزة للمالك فقط. لا تخالف أمر رومورو. 💙",
    };
  }

  if (pluginConfig.isPartner && !m.isPartner && !m.isOwner && !hasAccess) {
    return { allowed: false, reason: "💙 هذه الميزة للشركاء فقط. لا تجبر رومورو يا عزيزي.", };
  }

  const overrides = db.setting("capprem") || {};
  const isPremiumFeature = overrides[pluginConfig.name] !== undefined ? overrides[pluginConfig.name] : pluginConfig.isPremium;

  if (
    isPremiumFeature &&
    !m.isPremium &&
    !m.isOwner &&
    !m.isPartner &&
    !hasAccess
  ) {
    return {
      allowed: false,
      reason: config.messages?.premiumOnly || "💎 ميزة البريميوم لم تُفتح لك بعد. لا تجعل رومورو تنتظر. 💙",
    };
  }

  if (pluginConfig.isGroup && !m.isGroup) {
    return {
      allowed: false,
      reason: config.messages?.groupOnly || "👥 همف! هذا الأمر للمجموعات فقط. 💙",
    };
  }

  if (pluginConfig.isPrivate && m.isGroup) {
    return {
      allowed: false,
      reason: config.messages?.privateOnly || "📱 همف! توجه إلى محادثة رومورو الخاصة أولاً. 💙",
    };
  }

  if (
    pluginConfig.isAdmin &&
    m.isGroup &&
    !m.isAdmin &&
    !m.isOwner &&
    !hasAccess
  ) {
    return {
      allowed: false,
      reason: config.messages?.adminOnly || "👑 همف! يجب أن تصبح مشرف المجموعة أولاً. 💙",
    };
  }

  if (pluginConfig.isBotAdmin && m.isGroup && !m.isBotAdmin) {
    return {
      allowed: false,
      reason:
        config.messages?.botAdminOnly || "🤖 اجعل رومورو مشرفة أولاً. يجب أن تتمكن رومورو من حمايتك بحرية. 💙",
    };
  }

  if (m.isGroup) {
    const group = db.getGroup(m.chat);
    if (group) {
      if (pluginConfig.category === "game" && group.game === false) {
        if (!m.isAdmin && !m.isOwner && !hasAccess) {
          return {
            allowed: false,
            reason: "🎮 *همف!* الميزات الترفيهية معطّلة من المشرف. لا تجبر رومورو يا عزيزي. 💙",
          };
        }
      }
      if (pluginConfig.category === "rpg" && group.rpg === false) {
        if (!m.isAdmin && !m.isOwner && !hasAccess) {
          return {
            allowed: false,
            reason: "⚔️ *همف!* ميزات RPG معطّلة من المشرف. إن أردت أن تفتحها رومورو، اطلب من المشرف تفعيلها من جديد. 💙",
          };
        }
      }
    }
  }

  return { allowed: true, reason: "" };
}

function checkMode(m, getActiveJadibots) {
  const db = getDatabase();
  const dbMode = db.setting("botMode");
  const mode = dbMode || config.config.mode || "public";

  const onlyGc = db.setting("onlyGc");
  const onlyPc = db.setting("onlyPc");
  const selfAdmin = db.setting("selfAdmin");
  const publicAdmin = db.setting("publicAdmin");
  const botAfk = db.setting("botAfk");

  if (botAfk && botAfk.active) {
    if (m.fromMe || m.isOwner) {
      return { allowed: true };
    }
    const duration = formatAfkDuration(Date.now() - botAfk.since);
    return {
      allowed: false,
      isAfk: true,
      afkMessage:
        `💤 *البوت في وضع الغياب*\n\n` +
        `╭┈┈⬡「 📋 *المعلومات* 」\n` +
        `┃ 📝 السبب: \`${botAfk.reason || "AFK"}\`\n` +
        `┃ ⏱️ منذ: \`${duration}\`\n` +
        `╰┈┈⬡\n\n` +
        `> لا يستطيع البوت استقبال الأوامر حالياً\n` +
        `> الرجاء الانتظار حتى يعيد المالك تفعيله`,
    };
  }

  if (onlyGc && !m.isGroup && !m.isOwner) return { allowed: false };
  if (onlyPc && m.isGroup && !m.isOwner) return { allowed: false };

  const onlyThisGroup = db.setting("onlyThisGroup");
  if (onlyThisGroup && m.isGroup && !m.isOwner) {
    if (typeof onlyThisGroup === "string" && m.chat !== onlyThisGroup) {
      return { allowed: false };
    } else if (typeof onlyThisGroup === "object" && m.chat !== onlyThisGroup.jid) {
      return {
        allowed: false,
        isOnlyThisGroup: true,
        onlyThisGroupMessage:
          `🔒 *تم رفض الوصول*\n\n` +
          `عذراً، بوتنا حالياً متاح للاستخدام الحصري في المجموعة الرئيسية (*${onlyThisGroup.name}*).\n\n` +
          `انضم إلى مجموعتنا الرئيسية عبر الرابط التالي:\n` +
          `🔗 ${onlyThisGroup.link}\n\n` +
          `بعد الانضمام، ستكون حراً في استخدام جميع ميزات البوت. شكراً لك!`
      };
    }
  }

  const selfGroups = db.setting("selfGroups") || [];
  if (m.isGroup && selfGroups.includes(m.chat)) {
    if (m.fromMe) return { allowed: true };
    if (m.isOwner) return { allowed: true };
    return { allowed: false, isSelfGroup: true };
  }

  const publicGroups = db.setting("publicGroups") || [];
  if (m.isGroup && publicGroups.includes(m.chat)) {
    return { allowed: true };
  }

  if (mode === "self") {
    if (m.fromMe) return { allowed: true };
    if (m.isOwner) return { allowed: true };

    const activeJadibots = getActiveJadibots();
    if (activeJadibots.length > 0) {
      let jadibotList = "";
      activeJadibots.forEach((jb, i) => {
        jadibotList += `┃ ${i + 1}. @${jb.id}\n`;
      });
      const mentions = activeJadibots.map((jb) => jb.id + "@s.whatsapp.net");
      return {
        allowed: false,
        hasJadibots: true,
        jadibotMessage:
          `🤖 *الوضع الخاص*\n\n` +
          `البوت الرئيسي في وضع خاص الآن.\n` +
          `يمكنك استخدام بوتاتنا الفرعية:\n\n` +
          `╭┈┈⬡「 📱 *البوتات المتاحة* 」\n` +
          `${jadibotList}` +
          `╰┈┈⬡\n\n` +
          `> اختر أحد البوتات أعلاه للوصول إلى الميزات.`,
        jadibotMentions: mentions,
      };
    }

    return { allowed: false };
  }

  if (mode === "public") {
    const onlyAdmin = db.setting("onlyAdmin");

    if (onlyAdmin) {
      if (m.fromMe || m.isOwner) return { allowed: true };
      if (!m.isGroup) return { allowed: true };
      if (m.isGroup && m.isAdmin) return { allowed: true };
      return { allowed: false };
    }

    if (selfAdmin) {
      if (m.fromMe || m.isOwner) return { allowed: true };
      if (m.isGroup && m.isAdmin) return { allowed: true };
      return { allowed: false };
    }

    if (publicAdmin) {
      if (m.fromMe || m.isOwner) return { allowed: true };
      if (!m.isGroup) return { allowed: true };
      if (m.isGroup && m.isAdmin) return { allowed: true };
      return { allowed: false };
    }

    return { allowed: true };
  }

  return { allowed: true };
}

export { levenshtein, formatAfkDuration, checkPermission, checkMode };
