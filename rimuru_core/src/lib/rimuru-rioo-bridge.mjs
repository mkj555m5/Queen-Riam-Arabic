// جسر توافق: ميزات منفذ Rimuru تعمل إلزامياً فوق نواة Rimuru.
import { getDatabase } from "./rimuru-database.mjs";
import { f as httpRequest } from "./rimuru-http.mjs";
import { fetchJson, randomInt, md5 } from "./rimuru-utils.mjs";
import { sendText } from "./rimuru-message.mjs";
import { rimuruApiManager } from "./rimuru-apimanager.mjs";
import config from "../../config.mjs";

export { getDatabase, httpRequest, fetchJson, randomInt, md5, sendText, rimuruApiManager, config };

export async function riooJson(url, options = {}) {
  const { method = "GET", headers = {}, body = null, timeout } = options;
  if (timeout) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, {
        method,
        headers,
        body,
        signal: controller.signal,
      });
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }
  return fetchJson(url, options.fetchOptions || {});
}
