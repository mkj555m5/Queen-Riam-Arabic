import { RIMURU_CORE_CONFIG } from "../../rimuru.mjs";
import { getDatabase } from "./rimuru-database.mjs";
import { logger } from "./rimuru-logger.mjs";
import { CronJob } from "cron";
import moment from "moment-timezone";
import { saluranCtx } from "./rimuru-context.mjs";
import config from "../../config.mjs";

const scheduledTasks = new Map();
const activeCronJobs = new Map();
const TZ = "Asia/Jakarta";

function getMsUntilTime(hour, minute = 0) {
  const now = moment.tz(TZ);
  const target = moment
    .tz(TZ)
    .hour(hour)
    .minute(minute)
    .second(0)
    .millisecond(0);
  if (target.isSameOrBefore(now)) target.add(1, "day");
  return target.diff(now);
}

function formatTimeRemaining(ms) {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
}

function startDailyLimitReset(options = {}) {
  const hour = options.hour ?? 0;
  const minute = options.minute ?? 0;
  const defaultLimit = options.defaultLimit ?? 25;

  if (activeCronJobs.has("dailyLimitReset")) {
    activeCronJobs.get("dailyLimitReset").stop();
    activeCronJobs.delete("dailyLimitReset");
  }

  const job = new CronJob(
    `${minute} ${hour} * * *`,
    async () => {
      try {
        const db = getDatabase();
        const resetCount = db.resetAllEnergi(defaultLimit, -1);
        logger.success(
          "Scheduler",
          `اكتملت إعادة تعيين الحد اليومي! أُعيد تعيين ${resetCount} مستخدماً (عادي: ${defaultLimit}، بريميوم: ∞)`,
        );
        db.incrementStat("dailyResets");
        db.setting("lastLimitReset", new Date().toISOString());
      } catch (error) {
        logger.error("Scheduler", `Daily limit reset failed: ${error.message}`);
      }
    },
    null,
    true,
    TZ,
  );

  activeCronJobs.set("dailyLimitReset", job);
  logger.info(
    "Scheduler",
    `أُنشئت مهمة إعادة تعيين الحد اليومي على الساعة ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} (${TZ})`,
  );
}

async function scheduleMessage(options, sock) {
  const {
    id,
    jid,
    message,
    hour,
    minute = 0,
    repeat = false,
    createdAt = null,
    ...meta
  } = options;

  if (!id || !jid || !message || hour === undefined) {
    throw new Error("Missing required options: id, jid, message, hour");
  }

  if (scheduledTasks.has(id)) cancelScheduledMessage(id);

  const task = {
    id,
    jid,
    message,
    hour,
    minute,
    repeat,
    createdAt: createdAt || new Date().toISOString(),
    nextRun: null,
    ...meta,
  };

  if (activeCronJobs.has(id)) {
    activeCronJobs.get(id).stop();
    activeCronJobs.delete(id);
  }

  const job = new CronJob(
    `${minute} ${hour} * * *`,
    async () => {
      try {
        await sock.sendMessage(jid, message);
        logger.success("Scheduler", `Scheduled message sent: ${id}`);
        const db = getDatabase();
        db.incrementStat("scheduledMessagesSent");

        if (!repeat) {
          job.stop();
          scheduledTasks.delete(id);
          activeCronJobs.delete(id);
        } else {
          task.nextRun = job.nextDate().toISO();
        }
      } catch (error) {
        logger.error(
          "Scheduler",
          `Failed to send scheduled message ${id}: ${error.message}`,
        );
      }
    },
    null,
    true,
    TZ,
  );

  task.nextRun = job.nextDate().toISO();
  activeCronJobs.set(id, job);
  scheduledTasks.set(id, task);

  logger.info(
    "Scheduler",
    `Message scheduled: ${id} at ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
  );
  return task;
}

function cancelScheduledMessage(id) {
  if (activeCronJobs.has(id)) {
    activeCronJobs.get(id).stop();
    activeCronJobs.delete(id);
  }
  if (scheduledTasks.has(id)) {
    scheduledTasks.delete(id);
    logger.info("Scheduler", `Cancelled scheduled message: ${id}`);
    return true;
  }
  return false;
}

function getScheduledMessages() {
  return Array.from(scheduledTasks.values());
}

function getScheduledMessage(id) {
  return scheduledTasks.get(id) || null;
}

function saveScheduledMessages() {
  try {
    const db = getDatabase();
    const tasks = Array.from(scheduledTasks.values());
    db.setting("scheduledMessages", tasks);
    logger.debug("Scheduler", `Saved ${tasks.length} scheduled messages`);
  } catch (error) {
    logger.error(
      "Scheduler",
      `Failed to save scheduled messages: ${error.message}`,
    );
  }
}

function loadScheduledMessages(sock) {
  try {
    const db = getDatabase();
    const savedTasks = db.setting("scheduledMessages") || [];
    for (const task of savedTasks) {
      if (task.repeat || new Date(task.nextRun) > new Date()) {
        scheduleMessage(task, sock);
      }
    }
    logger.info("Scheduler", `حُمّلت ${savedTasks.length} رسالة مجدولة بنجاح`);
  } catch (error) {
    logger.error(
      "Scheduler",
      `Failed to load scheduled messages: ${error.message}`,
    );
  }
}

function stopAllSchedulers() {
  saveScheduledMessages();
  for (const [id, job] of activeCronJobs) {
    job.stop();
    logger.debug("Scheduler", `Stopped: ${id}`);
  }
  activeCronJobs.clear();
  if (groupScheduleSock) groupScheduleSock = null;
  sewaSock = null;
  logger.info("Scheduler", "تم إيقاف جميع المجدولات");
}

function getSchedulerStatus() {
  const db = getDatabase();
  return {
    dailyResetEnabled: activeCronJobs.has("dailyLimitReset"),
    lastLimitReset: db.setting("lastLimitReset") || "أبداً",
    scheduledMessagesCount: scheduledTasks.size,
    totalResets: db.getStats("dailyResets"),
    totalMessagesSent: db.getStats("scheduledMessagesSent"),
  };
}

const schedulerRegistry = {
  dailyLimitReset: {
    name: "إعادة تعيين الحد اليومي",
    key: "dailyLimitReset",
    description: "إعادة تعيين حد المستخدمين على الساعة 00:00",
  },
  groupSchedule: {
    name: "جدولة المجموعات",
    key: "groupSchedule",
    description: "فتح وإغلاق المجموعات تلقائياً",
  },
  sewaChecker: {
    name: "فاحص الإيجار",
    key: "sewaChecker",
    description: "فحص انتهاء الإيجار كل 10 دقائق",
  },
  scheduledMessages: {
    name: "مخطط الجدولة",
    key: "scheduledMessages",
    description: "تذكيرات وجداول حرة يحددها المالك",
  },
};

function isSchedulerRunning(name) {
  const key = name.toLowerCase().replace(/[\s-]/g, "");
  if (key === "dailylimitreset" || key === "limitreset" || key === "limit")
    return activeCronJobs.has("dailyLimitReset");
  if (key === "groupschedule" || key === "groupsched" || key === "group")
    return activeCronJobs.has("groupSchedule");
  if (key === "sewachecker" || key === "sewa")
    return activeCronJobs.has("sewaChecker");
  if (key === "scheduledmessages" || key === "messages" || key === "msg")
    return scheduledTasks.size > 0;
  return false;
}

function getFullSchedulerStatus() {
  const db = getDatabase();
  const status = {
    schedulers: [
      {
        name: "إعادة تعيين الحد اليومي",
        key: "limitreset",
        running: activeCronJobs.has("dailyLimitReset"),
        description: "إعادة تعيين حد المستخدمين على الساعة 00:00",
        lastRun: db.setting("lastLimitReset") || "أبداً",
        stats: { totalResets: db.getStats("dailyResets") || 0 },
      },
      {
        name: "جدولة المجموعات",
        key: "groupschedule",
        running: activeCronJobs.has("groupSchedule"),
        description: "فتح وإغلاق المجموعات تلقائياً حسب الجدول",
        lastRun: "-",
        stats: {},
      },
      {
        name: "فاحص الإيجار",
        key: "sewa",
        running: activeCronJobs.has("sewaChecker"),
        description: "فحص انتهاء الإيجار كل 10 دقائق",
        lastRun: "-",
        stats: {},
      },
      {
        name: "مخطط الجدولة",
        key: "messages",
        running: scheduledTasks.size > 0,
        description: "تذكيرات وجداول مخصصة من المالك",
        lastRun: "-",
        stats: {
          activeMessages: scheduledTasks.size,
          totalSent: db.getStats("scheduledMessagesSent") || 0,
        },
      },
    ],
    summary: { totalActive: 0, totalInactive: 0 },
  };
  status.schedulers.forEach((s) => {
    if (s.running) status.summary.totalActive++;
    else status.summary.totalInactive++;
  });
  return status;
}

function stopSchedulerByName(name) {
  const key = name.toLowerCase().replace(/[\s-]/g, "");
  let stopped = false;
  let schedulerName = "";

  if (key === "dailylimitreset" || key === "limitreset" || key === "limit") {
    if (activeCronJobs.has("dailyLimitReset")) {
      activeCronJobs.get("dailyLimitReset").stop();
      activeCronJobs.delete("dailyLimitReset");
      stopped = true;
      schedulerName = "Daily Limit Reset";
    }
  }

  if (key === "groupschedule" || key === "groupsched" || key === "group") {
    if (activeCronJobs.has("groupSchedule")) {
      activeCronJobs.get("groupSchedule").stop();
      activeCronJobs.delete("groupSchedule");
    }
    groupScheduleSock = null;
    stopped = true;
    schedulerName = "Group Schedule";
  }

  if (key === "sewachecker" || key === "sewa") {
    if (activeCronJobs.has("sewaChecker")) {
      activeCronJobs.get("sewaChecker").stop();
      activeCronJobs.delete("sewaChecker");
      stopped = true;
      schedulerName = "Sewa Checker";
    }
    sewaSock = null;
  }

  if (key === "scheduledmessages" || key === "messages" || key === "msg") {
    for (const [id] of scheduledTasks) cancelScheduledMessage(id);
    stopped = true;
    schedulerName = "Schedule Planner";
  }

  if (key === "all") {
    stopAllSchedulers();
    return { stopped: true, name: "All Schedulers" };
  }

  if (stopped) logger.info("Scheduler", `Stopped: ${schedulerName}`);
  return { stopped, name: schedulerName };
}

function startSchedulerByName(name, sock, config = null) {
  const key = name.toLowerCase().replace(/[\s-]/g, "");
  let started = false;
  let schedulerName = "";
  const cfg = config;

  if (key === "dailylimitreset" || key === "limitreset" || key === "limit") {
    if (!activeCronJobs.has("dailyLimitReset")) {
      startDailyLimitReset({
        hour: cfg.scheduler?.resetHour ?? 0,
        minute: cfg.scheduler?.resetMinute ?? 0,
        defaultLimit: cfg.energi?.default ?? 25,
      });
      started = true;
      schedulerName = "Daily Limit Reset";
    }
  }

  if (key === "groupschedule" || key === "groupsched" || key === "group") {
    if (sock) {
      startGroupScheduleChecker(sock);
      started = true;
      schedulerName = "Group Schedule";
    }
  }

  if (key === "sewachecker" || key === "sewa") {
    if (sock && !activeCronJobs.has("sewaChecker")) {
      startSewaChecker(sock);
      started = true;
      schedulerName = "Sewa Checker";
    }
  }

  if (key === "scheduledmessages" || key === "messages" || key === "msg") {
    if (sock) {
      loadScheduledMessages(sock);
      started = true;
      schedulerName = "Schedule Planner";
    }
  }

  if (key === "all") {
    if (sock) {
      initScheduler(cfg, sock);
      startGroupScheduleChecker(sock);
      startSewaChecker(sock);
      return { started: true, name: "All Schedulers" };
    }
  }

  if (started) logger.info("Scheduler", `Started: ${schedulerName}`);
  return { started, name: schedulerName };
}

function initScheduler(config, sock = null) {
  if (config.features?.dailyLimitReset !== false) {
    startDailyLimitReset({
      hour: config.scheduler?.resetHour ?? 0,
      minute: config.scheduler?.resetMinute ?? 0,
      defaultLimit: config.energi?.default ?? 25,
    });
  }
  if (sock) loadScheduledMessages(sock);

  new CronJob(
    "*/5 * * * *",
    () => {
      if (scheduledTasks.size > 0) saveScheduledMessages();
    },
    null,
    true,
    TZ,
  );

  logger.success("Scheduler", "Scheduler initialized");
}

let groupScheduleSock = null;
const notifiedGroups = new Set();

async function startGroupScheduleChecker(sock) {
  if (activeCronJobs.has("groupSchedule")) {
    activeCronJobs.get("groupSchedule").stop();
    activeCronJobs.delete("groupSchedule");
  }

  groupScheduleSock = sock;
  notifiedGroups.clear();

  const job = new CronJob(
    "* * * * *",
    async () => {
      if (!groupScheduleSock) return;

      try {
        const db = getDatabase();
        const now = moment.tz(TZ);
        const currentTime = now.format("HH:mm");
        const groups = db.db?.data?.groups || {};
        if (!groups || typeof groups !== "object") return;

        for (const [groupId, group] of Object.entries(groups)) {
          if (!group || typeof group !== "object") continue;
          const notifyKey = `${groupId}_${currentTime}`;
          if (notifiedGroups.has(notifyKey)) continue;

          if (group.scheduleOpen === currentTime) {
            try {
              await groupScheduleSock.groupSettingUpdate(
                groupId,
                "not_announcement",
              );
              await groupScheduleSock.sendMessage(groupId, {
                text: `🔓 *فتح تلقائي*\n\n> فُتحت المجموعة تلقائياً حسب الجدول.\n> الوقت: ${currentTime} بتوقيت جاكرتا`,
              });
              notifiedGroups.add(notifyKey);
              logger.success(
                "GroupSchedule",
                `Opened group ${groupId} at ${currentTime}`,
              );
            } catch (e) {
              if (
                e.message?.includes("not-authorized") ||
                e.message?.includes("admin")
              ) {
                logger.warn(
                  "GroupSchedule",
                  `البوت ليس مشرفاً في ${groupId}، لا يمكنه فتح المجموعة`,
                );
                try {
                  await groupScheduleSock.sendMessage(groupId, {
                    text: `⚠️ *فشل الفتح التلقائي*\n\n> البوت ليس مشرفاً، لا يمكنه تغيير إعدادات المجموعة.\n> اجعل البوت مشرفاً لتفعيل هذه الميزة.`,
                  });
                } catch { }
              } else {
                logger.error(
                  "GroupSchedule",
                  `Failed to open ${groupId}: ${e.message}`,
                );
              }
              notifiedGroups.add(notifyKey);
            }
          }

          if (group.scheduleClose === currentTime) {
            try {
              await groupScheduleSock.groupSettingUpdate(
                groupId,
                "announcement",
              );
              await groupScheduleSock.sendMessage(groupId, {
                text: `🔒 *إغلاق تلقائي*\n\n> أُغلقت المجموعة تلقائياً حسب الجدول.\n> الوقت: ${currentTime} بتوقيت جاكرتا`,
              });
              notifiedGroups.add(notifyKey);
              logger.success(
                "GroupSchedule",
                `Closed group ${groupId} at ${currentTime}`,
              );
            } catch (e) {
              if (
                e.message?.includes("not-authorized") ||
                e.message?.includes("admin")
              ) {
                logger.warn(
                  "GroupSchedule",
                  `البوت ليس مشرفاً في ${groupId}، لا يمكنه إغلاق المجموعة`,
                );
                try {
                  await groupScheduleSock.sendMessage(groupId, {
                    text: `⚠️ *فشل الإغلاق التلقائي*\n\n> البوت ليس مشرفاً، لا يمكنه تغيير إعدادات المجموعة.\n> اجعل البوت مشرفاً لتفعيل هذه الميزة.`,
                  });
                } catch { }
              } else {
                logger.error(
                  "GroupSchedule",
                  `Failed to close ${groupId}: ${e.message}`,
                );
              }
              notifiedGroups.add(notifyKey);
            }
          }
        }

        if (now.second() === 0 && now.minute() === 0) notifiedGroups.clear();
      } catch (error) {
        logger.error("GroupSchedule", `Checker error: ${error.message}`);
      }
    },
    null,
    true,
    TZ,
  );

  activeCronJobs.set("groupSchedule", job);
  logger.info(
    "Scheduler",
    "فاحص جداول المجموعات يعمل (كل دقيقة)",
  );
}

let sewaSock = null;

async function startSewaChecker(sock) {
  sewaSock = sock;

  const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
  const ONE_HOUR_MS = 60 * 60 * 1000;

  if (activeCronJobs.has("sewaChecker")) {
    activeCronJobs.get("sewaChecker").stop();
    activeCronJobs.delete("sewaChecker");
  }

  const doCheck = async () => {
    try {
      const db = getDatabase();
      const sewaData = db.db.data.sewa;
      if (
        !sewaData ||
        !sewaData.enabled ||
        !sewaData.groups ||
        Object.keys(sewaData.groups).length === 0
      )
        return;

      const sewaGroups = db.db.data.sewa.groups || {};
      const now = Date.now();
      let expiredCount = 0;
      let warnedCount = 0;

      for (const [groupId, data] of Object.entries(sewaGroups)) {
        if (data.isLifetime) continue;
        if (data.status === "expired") continue;

        if (data.expiredAt <= now) {
          try {
            await sewaSock.sendText(
              groupId,
              `⏰ *انتهى الإيجار*\n\nانتهت مدة إيجار البوت في هذه المجموعة.\nسيغادر البوت المجموعة.\n\nتواصل مع المالك لتجديد الإيجار.`,
              null,
              {
                contextInfo: saluranCtx(),
              },
            ).catch(() => { });
            await new Promise((r) => setTimeout(r, 2000));
            await sewaSock.groupLeave(groupId).catch(() => { });
          } catch (e) {
            logger.error(
              "Scheduler",
              `Failed to leave expired group: ${e.message}`,
            );
          } finally {
            data.status = "expired";
            data.expiredLeftAt = Date.now();
            expiredCount++;
            await new Promise((r) => setTimeout(r, 3000));
          }
          continue;
        }

        const remaining = data.expiredAt - now;

        if (remaining <= ONE_HOUR_MS && !data._warned1h) {
          try {
            const minutes = Math.floor(remaining / 60000);
            await sewaSock.sendText(
              groupId,
              `⚠️ *تحذير الإيجار*\n\nالمتبقي من مدة الإيجار *${minutes} دقيقة* فقط!\nسارع بالتواصل مع المالك للتجديد.\n\nإذا لم يُجدد، سيغادر البوت تلقائياً.`,
              null,
              {
                contextInfo: saluranCtx(),
              },
            );
            data._warned1h = true;
            warnedCount++;
            await new Promise((r) => setTimeout(r, 2000));
          } catch { }
        } else if (
          remaining <= THREE_DAYS_MS &&
          remaining > ONE_HOUR_MS &&
          !data._warned3d
        ) {
          try {
            const days = Math.floor(remaining / 86400000);
            const hours = Math.floor((remaining % 86400000) / 3600000);
            await sewaSock.sendText(
              groupId,
              `⚠️ *تحذير الإيجار*\n\nالمتبقي من الإيجار *${days}ي ${hours}س*\nسارع بالتواصل مع المالك للتجديد.\n\nإذا لم يُجدد، سيغادر البوت تلقائياً.`,
              null,
              {
                contextInfo: saluranCtx(),
              },
            );
            data._warned3d = true;
            warnedCount++;
            await new Promise((r) => setTimeout(r, 2000));
          } catch { }
        }
      }

      if (expiredCount > 0 || warnedCount > 0) {
        db.db.write();
        logger.success(
          "Scheduler",
          `فحص الإيجار: ${expiredCount} منتهي، ${warnedCount} مُنبّه`,
        );
      }
    } catch (error) {
      logger.error("Scheduler", `Sewa check failed: ${error.message}`);
    }
  };

  doCheck();

  const job = new CronJob("*/10 * * * *", doCheck, null, true, TZ);
  activeCronJobs.set("sewaChecker", job);
  logger.info("Scheduler", "نظام فحص الإيجار يعمل (كل 10 دقائق)");
}

function startAutoBioChecker(sock) {
  if (activeCronJobs.has("autoBioChecker")) {
    activeCronJobs.get("autoBioChecker").stop();
    activeCronJobs.delete("autoBioChecker");
  }

  function formatUptime(seconds) {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    let res = "";
    if (d > 0) res += `${d}d `;
    if (h > 0) res += `${h}h `;
    res += `${m}m ${s}s`;
    return res.trim();
  }

  const doCheck = async () => {
    try {
      const db = getDatabase();
      const status = db.setting("autobio_status");
      if (!status) return;

      const template = db.setting("autobio_text") || "البوت نشط | 🕒 {clock} | ⏳ {runtime}";

      const clock = moment().tz(TZ).format("HH:mm");
      const runtime = formatUptime(process.uptime());
      const botname = RIMURU_CORE_CONFIG.bot?.name || "Bot";
      const version = RIMURU_CORE_CONFIG.bot?.version || "1.0.0";

      const newBio = template
        .replace(/{clock}/gi, clock)
        .replace(/{runtime}/gi, runtime)
        .replace(/{botname}/gi, botname)
        .replace(/{version}/gi, version);

      await sock.updateProfileStatus(newBio);
    } catch (error) {
      logger.error("Scheduler", `AutoBio check failed: ${error.message}`);
    }
  };

  const intervalMs = getDatabase().setting("autobio_interval") || 60000;

  doCheck();
  const timerId = setInterval(doCheck, intervalMs);
  activeCronJobs.set("autoBioChecker", {
    stop: () => clearInterval(timerId)
  });
  logger.info("Scheduler", `النبذة التلقائية مُفعّلة (تحديث كل ${intervalMs / 1000} ثانية)`);
}

export {
  initScheduler,
  stopAllSchedulers,
  startDailyLimitReset,
  startGroupScheduleChecker,
  startSewaChecker,
  startAutoBioChecker,
  scheduleMessage,
  cancelScheduledMessage,
  getScheduledMessages,
  getScheduledMessage,
  saveScheduledMessages,
  loadScheduledMessages,
  getMsUntilTime,
  formatTimeRemaining,
  getSchedulerStatus,
  getFullSchedulerStatus,
  isSchedulerRunning,
  startSchedulerByName,
  stopSchedulerByName,
};
