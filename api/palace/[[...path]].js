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
      result[part.slice(0, separatorIndex).trim()] = part.slice(separatorIndex + 1).trim();
      return result;
    }, {});
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

function writeJson(res, statusCode, payload, setCookie) {
  res.status(statusCode);
  if (setCookie) {
    res.setHeader("Set-Cookie", setCookie);
  }
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.send(JSON.stringify(payload));
}

function writeBinary(res, statusCode, body, headers = {}) {
  res.status(statusCode);
  Object.entries(headers).forEach(([key, value]) => {
    if (value) {
      res.setHeader(key, value);
    }
  });
  res.send(Buffer.isBuffer(body) ? body : Buffer.from(body));
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

module.exports = async function handler(req, res) {
  try {
    const segments = Array.isArray(req.query.path)
      ? req.query.path
      : req.query.path
        ? [req.query.path]
        : [];
    const tailPath = "/" + segments.join("/");
    const search = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";

    if (tailPath === "/login" && req.method === "POST") {
      const payload = typeof req.body === "object" && req.body ? req.body : {};
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
      const cookieHeader = response.ok && cookieJar
        ? `${PALACE_SESSION_COOKIE}=${encodeURIComponent(cookieJar)}; Path=/; HttpOnly; SameSite=Lax`
        : `${PALACE_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
      writeJson(res, response.status, body, cookieHeader);
      return;
    }

    if (tailPath === "/logout" && req.method === "POST") {
      writeJson(res, 200, { ok: true }, `${PALACE_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
      return;
    }

    const cookies = parseCookies(req.headers.cookie);
    const encodedSession = cookies[PALACE_SESSION_COOKIE];
    const sessionCookie = encodedSession ? decodeURIComponent(encodedSession) : "";
    if (!sessionCookie) {
      writeJson(res, 401, { message: "Palace session not connected" }, `${PALACE_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
      return;
    }

    if (tailPath === "/snapshots/game-settlement" && req.method === "GET") {
      const htmlResponse = await fetch(PALACE_ORIGIN + PALACE_BASE_PATH + "/dashboard/game-settlement" + search, {
        method: "GET",
        headers: {
          Cookie: sessionCookie
        }
      });
      const html = await htmlResponse.text();
      const nextCookieJar = extractCookieJarFromResponse(htmlResponse);
      const setCookie = nextCookieJar
        ? `${PALACE_SESSION_COOKIE}=${encodeURIComponent(nextCookieJar)}; Path=/; HttpOnly; SameSite=Lax`
        : htmlResponse.status === 401
          ? `${PALACE_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
          : "";
      if (!htmlResponse.ok) {
        writeJson(res, htmlResponse.status, { message: "Unable to load Palace settlement dashboard" }, setCookie || undefined);
        return;
      }
      writeJson(res, 200, parseGameSettlementSnapshot(html), setCookie || undefined);
      return;
    }

    const upstreamPath = "/api" + (tailPath === "/" ? "" : tailPath);
    const response = await fetch(PALACE_ORIGIN + PALACE_BASE_PATH + upstreamPath + search, {
      method: req.method,
      headers: {
        ...(req.method === "GET" || req.method === "HEAD" ? {} : { "Content-Type": "application/json" }),
        Cookie: sessionCookie
      },
      body: req.method === "GET" || req.method === "HEAD" ? undefined : JSON.stringify(req.body || {})
    });

    const contentType = response.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");
    const body = isJson
      ? await response.json().catch(() => ({}))
      : Buffer.from(await response.arrayBuffer());

    const nextCookieJar = extractCookieJarFromResponse(response);
    const setCookie = nextCookieJar
      ? `${PALACE_SESSION_COOKIE}=${encodeURIComponent(nextCookieJar)}; Path=/; HttpOnly; SameSite=Lax`
      : response.status === 401
        ? `${PALACE_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
        : "";
    if (isJson) {
      writeJson(res, response.status, body, setCookie || undefined);
      return;
    }
    writeBinary(res, response.status, body, {
      "Set-Cookie": setCookie || undefined,
      "Content-Type": contentType,
      "Content-Disposition": response.headers.get("content-disposition") || undefined
    });
  } catch (error) {
    writeJson(res, 500, { message: error instanceof Error ? error.message : "Palace proxy error" });
  }
};
