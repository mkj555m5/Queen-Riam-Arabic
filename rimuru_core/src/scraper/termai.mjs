import axios from "axios";
import config from "../../config.mjs";

const baseUrl = String(config.apiBase?.xterm || "https://api.termai.cc").replace(/\/$/, "");
const apiKey = config.APIkey?.xterm || "";

function assertKey() {
  if (!apiKey) throw new Error("API key xterm belum dikonfigurasi");
}

export async function logicBell(body = {}) {
  assertKey();
  const { data } = await axios.post(`${baseUrl}/api/chat/logic-bell?key=${encodeURIComponent(apiKey)}`, body, {
    headers: { "Content-Type": "application/json" },
    timeout: 120000,
    validateStatus: () => true,
  });
  if (typeof data === "string") return { msg: data, data };
  if (data?.status === false || data?.success === false) {
    throw new Error(data?.message || data?.msg || "Termai logic-bell gagal");
  }
  return data;
}

export async function transcribeAudio(buffer) {
  assertKey();
  const { data } = await axios.post(`${baseUrl}/api/audioProcessing/transcribe?key=${encodeURIComponent(apiKey)}`, buffer, {
    headers: { "Content-Type": "application/octet-stream" },
    timeout: 120000,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    validateStatus: () => true,
  });
  if (data?.status === false || data?.success === false) {
    throw new Error(data?.message || data?.msg || "Transkripsi gagal");
  }
  return data?.data?.text || data?.text || data?.data || "";
}

export async function enhanceVideo(buffer, { task = "VIDEO_UHD", model = "63031" } = {}) {
  assertKey();
  return axios.post(`${baseUrl}/api/tools/video-enhancer?key=${encodeURIComponent(apiKey)}&task=${encodeURIComponent(task)}&model=${encodeURIComponent(model)}`, buffer, {
    headers: { "Content-Type": "application/octet-stream" },
    responseType: "stream",
    timeout: 180000,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    validateStatus: () => true,
  });
}

export { baseUrl as termaiBaseUrl, apiKey as termaiApiKey };
