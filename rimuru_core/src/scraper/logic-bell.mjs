import { RIMURU_CORE_CONFIG } from "../../rimuru.mjs";
import axios from "axios";
import config from "../../config.mjs";

function buildHistoryText(history = []) {
  if (!Array.isArray(history) || history.length === 0) {
    return "";
  }

  const lines = history
    .slice(-10)
    .map((item) => {
      const role = item?.role === "assistant" ? "AI" : "User";
      const content = String(item?.content || "").trim();
      return content ? `${role}: ${content}` : "";
    })
    .filter(Boolean);

  if (lines.length === 0) {
    return "";
  }

  return `Riwayat percakapan:\n${lines.join("\n")}`;
}

function buildTextMessage(message, history = [], imageBuffer = null) {
  const parts = [];
  const historyText = buildHistoryText(history);

  if (historyText) {
    parts.push(historyText);
  }

  if (imageBuffer) {
    parts.push("User mengirim gambar. Jika gambar bisa dianalisis, gunakan konteks itu saat menjawab.");
  }

  parts.push(`Pesan user saat ini:\n${String(message || "").trim() || "(gambar tanpa teks)"}`);

  return parts.filter(Boolean).join("\n\n");
}

function getAiNames(aiFullName = "") {
  const fullName = String(aiFullName || RIMURU_CORE_CONFIG.bot?.name || "rimuru AI").trim();
  const nickName = fullName.split(/\s+/)[0] || "rimuru";
  return { fullName, nickName };
}

async function chat({
  message,
  instruction = "",
  imageBuffer = null,
  history = [],
  senderId = "",
  senderName = "",
  aiFullName = "",
  aiNickName = "",
  ownerName = "",
  role = "Temen deket",
  commands = [],
} = {}) {
  if (!message?.trim() && !imageBuffer) {
    throw new Error("Message is required.");
  }

  const apiKey = config.APIkey?.logicBell || config.APIkey?.xterm;
  const baseUrl = String(config.apiBase?.xterm || "https://api.termai.cc").replace(/\/$/, "");
  if (!apiKey) {
    throw new Error("API key Logic Bell belum diisi. Atur RIMURU_API_XTERM / XTERM_KEY di environment.");
  }

  const aiNames = getAiNames(aiFullName);
  const payload = {
    text: buildTextMessage(message, history, imageBuffer),
    id: senderId || "anonymous@s.whatsapp.net",
    fullainame: aiNames.fullName,
    nickainame: String(aiNickName || aiNames.nickName).trim() || aiNames.nickName,
    senderName: String(senderName || "User").trim() || "User",
    ownerName: String(ownerName || config.owner?.name || "Owner").trim() || "Owner",
    date: new Date().toISOString(),
    role: String(role || "Temen deket").trim() || "Temen deket",
    msgtype: imageBuffer ? "image" : "text",
    custom_profile: String(instruction || "").trim() || undefined,
    commands: Array.isArray(commands) ? commands : [],
  };

  if (imageBuffer) {
    payload.image = imageBuffer.toString("base64");
  }

  const response = await axios.post(
    `${baseUrl}/api/chat/logic-bell?key=${encodeURIComponent(apiKey)}`,
    payload,
    {
      headers: {
        "Content-Type": "application/json",
      },
      timeout: 60000,
    },
  );

  const data = response.data;
  if (response.status >= 400) {
    throw new Error(data?.msg || data?.message || `Logic Bell HTTP ${response.status}`);
  }
  if (data?.status === false || data?.success === false) {
    throw new Error(data?.msg || data?.message || "Logic Bell request failed.");
  }

  const nested = data?.data && typeof data.data === "object" ? data.data : {};
  const text = String(
    nested?.msg ??
    nested?.text ??
    nested?.response ??
    nested?.answer ??
    data?.msg ??
    data?.text ??
    data?.response ??
    data?.answer ??
    ""
  ).trim();

  return {
    text,
    msg: text,
    data: nested && Object.keys(nested).length ? nested : data,
    raw: data,
    model: "logic-bell",
    energy: nested?.energy ?? data?.energy ?? null,
  };
}

export { chat };
export default chat;
