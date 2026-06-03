import { cpSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";

const PALACE_ORIGIN = "https://fmcapp.com";
const PALACE_BASE_PATH = "/palace";
const PALACE_SESSION_COOKIE = "yiding_palace_session";

function parseCookies(headerValue) {
  return String(headerValue || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((result, part) => {
      const separatorIndex = part.indexOf("=");
      if (separatorIndex === -1) {
        return result;
      }
      const key = part.slice(0, separatorIndex).trim();
      const value = part.slice(separatorIndex + 1).trim();
      result[key] = value;
      return result;
    }, {});
}

async function readRequestJson(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const payload = Buffer.concat(chunks).toString("utf8");
  return payload ? JSON.parse(payload) : {};
}

function extractCookieJarFromResponse(response) {
  const setCookies = typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie()
    : [];
  const fallback = response.headers.get("set-cookie");
  const source = setCookies.length ? setCookies : (fallback ? [fallback] : []);

  return source
    .map((cookieLine) => String(cookieLine).split(";")[0].trim())
    .filter(Boolean)
    .join("; ");
}

function sendJson(res, statusCode, payload, headers = {}) {
  res.statusCode = statusCode;
  Object.entries(headers).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function decodeFlightChunk(chunk) {
  return JSON.parse('"' + String(chunk || "") + '"');
}

function extractBalancedJsonObject(source, marker) {
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1) {
    return "";
  }
  let start = source.lastIndexOf('{"initialCustomers"', markerIndex);
  if (start === -1) {
    start = source.lastIndexOf("{", markerIndex);
  }
  if (start === -1) {
    return "";
  }
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === "{" || char === "[") {
      depth += 1;
    } else if (char === "}" || char === "]") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }
  return "";
}

function parseGameSettlementSnapshot(html) {
  const scriptPattern = /self\.__next_f\.push\(\[1,"([\s\S]*?)"\]\)/g;
  let match;
  while ((match = scriptPattern.exec(String(html || "")))) {
    let decoded;
    try {
      decoded = decodeFlightChunk(match[1]);
    } catch {
      continue;
    }
    if (!decoded.includes('"settlementRows"')) {
      continue;
    }
    const jsonText = extractBalancedJsonObject(decoded, '"settlementRows"');
    if (!jsonText) {
      continue;
    }
    const payload = JSON.parse(jsonText);
    return {
      rows: Array.isArray(payload.settlementRows) ? payload.settlementRows : [],
      total: Number(payload.settlementTotal || 0),
      page: Number(payload.settlementPage || 1),
      totalPages: Number(payload.settlementTotalPages || 1),
      filters: payload.settlementQueryParams || {},
      emptyLabel: String(payload.emptyLabel || "No rows"),
      recentAccounts: Array.isArray(payload.initialRecentOperationalAccounts) ? payload.initialRecentOperationalAccounts : []
    };
  }
  throw new Error("Unable to parse Palace settlement snapshot");
}

async function forwardPalaceRequest(req, pathname, queryString = "") {
  const cookies = parseCookies(req.headers.cookie);
  const encodedSession = cookies[PALACE_SESSION_COOKIE];
  const sessionCookie = encodedSession ? decodeURIComponent(encodedSession) : "";

  if (!sessionCookie) {
    return {
      status: 401,
      body: { message: "Palace session not connected" },
      contentType: "application/json; charset=utf-8",
      isJson: true,
      clearCookie: true
    };
  }

  const targetUrl = PALACE_ORIGIN + PALACE_BASE_PATH + pathname + queryString;
  const method = req.method || "GET";
  const headers = {
    Cookie: sessionCookie
  };
  const init = { method, headers };

  if (!["GET", "HEAD"].includes(method)) {
    const rawBody = await readRequestJson(req);
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(rawBody);
  }

  const response = await fetch(targetUrl, init);
  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const body = isJson
    ? await response.json().catch(() => ({}))
    : Buffer.from(await response.arrayBuffer());

  const nextCookieJar = extractCookieJarFromResponse(response);

  return {
    status: response.status,
    body,
    contentType,
    contentDisposition: response.headers.get("content-disposition") || "",
    isJson,
    nextCookieJar,
    clearCookie: response.status === 401
  };
}

function createPalaceProxyPlugin() {
  return {
    name: "palace-dev-proxy",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        try {
          const requestUrl = new URL(req.url || "/", "http://127.0.0.1");
          if (!requestUrl.pathname.startsWith("/api/palace")) {
            next();
            return;
          }

          if (requestUrl.pathname === "/api/palace/login" && req.method === "POST") {
            const payload = await readRequestJson(req);
            const response = await fetch(PALACE_ORIGIN + PALACE_BASE_PATH + "/api/auth/login", {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                staffAccount: String(payload.staffAccount || "").trim(),
                password: String(payload.password || "")
              })
            });
            const bodyText = await response.text();
            let body;
            try {
              body = JSON.parse(bodyText);
            } catch {
              body = { text: bodyText };
            }

            const cookieJar = extractCookieJarFromResponse(response);
            const cookieHeaders = [];
            if (cookieJar && response.ok) {
              cookieHeaders.push(`${PALACE_SESSION_COOKIE}=${encodeURIComponent(cookieJar)}; Path=/; HttpOnly; SameSite=Lax`);
            } else if (!response.ok) {
              cookieHeaders.push(`${PALACE_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
            }

            sendJson(res, response.status, body, cookieHeaders.length ? { "Set-Cookie": cookieHeaders } : {});
            return;
          }

          if (requestUrl.pathname === "/api/palace/logout" && req.method === "POST") {
            sendJson(
              res,
              200,
              { ok: true },
              { "Set-Cookie": `${PALACE_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0` }
            );
            return;
          }

          if (requestUrl.pathname === "/api/palace/snapshots/game-settlement" && req.method === "GET") {
            const cookies = parseCookies(req.headers.cookie);
            const encodedSession = cookies[PALACE_SESSION_COOKIE];
            const sessionCookie = encodedSession ? decodeURIComponent(encodedSession) : "";
            if (!sessionCookie) {
              sendJson(
                res,
                401,
                { message: "Palace session not connected" },
                { "Set-Cookie": `${PALACE_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0` }
              );
              return;
            }
            const htmlResponse = await fetch(
              PALACE_ORIGIN + PALACE_BASE_PATH + "/dashboard/game-settlement" + (requestUrl.search || ""),
              {
                method: "GET",
                headers: {
                  Cookie: sessionCookie
                }
              }
            );
            const html = await htmlResponse.text();
            const nextCookieJar = extractCookieJarFromResponse(htmlResponse);
            const responseHeaders = {};
            if (nextCookieJar) {
              responseHeaders["Set-Cookie"] = `${PALACE_SESSION_COOKIE}=${encodeURIComponent(nextCookieJar)}; Path=/; HttpOnly; SameSite=Lax`;
            } else if (htmlResponse.status === 401) {
              responseHeaders["Set-Cookie"] = `${PALACE_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
            }
            if (!htmlResponse.ok) {
              sendJson(
                res,
                htmlResponse.status,
                { message: "Unable to load Palace settlement dashboard" },
                responseHeaders
              );
              return;
            }
            sendJson(res, 200, parseGameSettlementSnapshot(html), responseHeaders);
            return;
          }

          const upstreamPath = requestUrl.pathname.replace("/api/palace", "/api");
          const result = await forwardPalaceRequest(req, upstreamPath, requestUrl.search || "");
          const responseHeaders = {};
          if (result.nextCookieJar) {
            responseHeaders["Set-Cookie"] = `${PALACE_SESSION_COOKIE}=${encodeURIComponent(result.nextCookieJar)}; Path=/; HttpOnly; SameSite=Lax`;
          } else if (result.clearCookie) {
            responseHeaders["Set-Cookie"] = `${PALACE_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
          }
          if (result.isJson) {
            sendJson(res, result.status, result.body, responseHeaders);
            return;
          }
          res.statusCode = result.status;
          Object.entries(responseHeaders).forEach(([key, value]) => {
            res.setHeader(key, value);
          });
          if (result.contentType) {
            res.setHeader("Content-Type", result.contentType);
          }
          if (result.contentDisposition) {
            res.setHeader("Content-Disposition", result.contentDisposition);
          }
          res.end(result.body);
        } catch (error) {
          sendJson(res, 500, { message: error instanceof Error ? error.message : "Palace proxy error" });
        }
      });
    }
  };
}

function copyRootImageDirectory() {
  return {
    name: "copy-root-image-directory",
    closeBundle() {
      const sourceDir = resolve(process.cwd(), "image");
      const targetDir = resolve(process.cwd(), "dist/image");

      if (!existsSync(sourceDir)) {
        return;
      }

      cpSync(sourceDir, targetDir, { recursive: true, force: true });
    }
  };
}

function copyAssetsJsDirectory() {
  return {
    name: "copy-assets-js-directory",
    closeBundle() {
      const sourceDir = resolve(process.cwd(), "assets/js");
      const targetDir = resolve(process.cwd(), "dist/assets/js");

      if (!existsSync(sourceDir)) {
        return;
      }

      cpSync(sourceDir, targetDir, { recursive: true, force: true });
    }
  };
}

export default defineConfig({
  appType: "mpa",
  plugins: [copyRootImageDirectory(), copyAssetsJsDirectory(), createPalaceProxyPlugin()],
  server: {
    host: "127.0.0.1",
    port: 4173
  },
  preview: {
    host: "127.0.0.1",
    port: 4173
  },
  build: {
    rollupOptions: {
      input: {
        login: resolve(process.cwd(), "index.html"),
        dashboard: resolve(process.cwd(), "home/home.html"),
        employees: resolve(process.cwd(), "home/employees.html"),
        schedule: resolve(process.cwd(), "home/edit/index.html"),
        training: resolve(process.cwd(), "home/training/index.html")
      }
    }
  }
});
