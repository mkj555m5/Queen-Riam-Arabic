import axios from "axios";
import FormData from "form-data";
import config from "../../config.mjs";

const baseUrl = String(config.apiBase?.xterm || "https://api.termai.cc").replace(/\/$/, "");
const apiKey = String(config.APIkey?.xterm || "");
const cdnKey = String(config.APIkey?.termaiCdn || "");
const cdnBaseUrl = String(config.apiBase?.termaiCdn || "https://c.termai.cc").replace(/\/$/, "");

function requireKey() { if (!apiKey) throw new Error("XTerm/Termai API key belum diatur di config.js"); }

export async function xtermImageUrl(pathname, params = {}) {
  requireKey();
  const qs = new URLSearchParams({ ...params, key: apiKey });
  return `${baseUrl}${pathname}?${qs.toString()}`;
}

export async function xtermJson(pathname, body) {
  requireKey();
  const res = await axios.post(`${baseUrl}${pathname}?key=${encodeURIComponent(apiKey)}`, body, {
    headers: { "Content-Type": "application/json" },
    timeout: 120000,
    validateStatus: () => true,
  });
  if (res.status >= 400) throw new Error(`XTerm HTTP ${res.status}`);
  return res.data;
}

export async function uploadToTermaiCdn(buffer, filename = "image.jpg") {
  if (!cdnKey) throw new Error("Termai CDN key belum diatur di config.js");
  const form = new FormData();
  form.append("file", buffer, { filename });
  const res = await axios.post(`${cdnBaseUrl}/api/upload?key=${encodeURIComponent(cdnKey)}`, form, {
    headers: form.getHeaders(), timeout: 60000, maxBodyLength: Infinity,
  });
  if (!res.data?.path) throw new Error("Upload Termai CDN gagal");
  return res.data.path;
}

export { baseUrl as xtermBaseUrl, apiKey as xtermApiKey };
