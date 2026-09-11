/**
 * Safe JSON response parser for external APIs.
 * Prevents raw "Unexpected token <" / invalid JSON errors when an API
 * returns HTML, empty content, or a non-JSON response.
 */
export async function safeJson(response, fallback = null) {
  if (!response) return fallback;

  let text = "";
  try {
    if (typeof response.text === "function") text = await response.text();
    else if (typeof response.json === "function") return await response.json();
  } catch {
    return fallback;
  }

  if (!text || !text.trim()) return fallback;

  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

export default safeJson;
