/**
 * LiveIPO Cloud Sync & Allotment Proxy - Cloudflare Worker
 * Safely holds GITHUB_PAT (and optional ADMIN_KEY) in Cloudflare Secrets,
 * AND provides live CORS-enabled Registrar Allotment Lookup endpoints for LiveIPO.in.
 *
 * Required Cloudflare Secret:
 *   - GITHUB_PAT : Classic PAT with `repo` and `workflow` scopes
 * Optional Cloudflare Secret:
 *   - ADMIN_KEY  : Custom PIN required from Admin UI (leave unset for origin-locked one-click sync)
 */

const OWNER_REPO = "mehul2687/live-ipo-website";
const WORKFLOW_FILE = "sync.yml";

const ALLOWED_ORIGINS = [
  "https://liveipo.in",
  "https://www.liveipo.in",
  "https://mehul2687.github.io"
];

const CAPTCHA_GATED_REGISTRARS = new Set([
  "CAMEO",
  "INTEGRATED",
  "BEETALFC",
  "ALANKIT",
  "ANKIT",
  "MUDRA",
  "NSE",
  "BSE"
]);

const DEFAULT_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9"
};

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
}

function corsHeaders(origin) {
  const allowOrigin = isAllowedOrigin(origin) ? origin : "https://liveipo.in";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-admin-key",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

function jsonResponse(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...corsHeaders(origin)
    }
  });
}

function authorizeRequest(request, env, origin, { checkPin = true } = {}) {
  if (origin && !isAllowedOrigin(origin)) {
    return { ok: false, status: 403, error: "Forbidden origin." };
  }
  if (checkPin) {
    const requiredPin = (env.ADMIN_KEY || "").trim();
    if (requiredPin) {
      const provided = (request.headers.get("x-admin-key") || "").trim();
      if (!provided || provided !== requiredPin) {
        return { ok: false, status: 401, error: "Admin Sync PIN અમાન્ય અથવા ખૂટે છે." };
      }
    }
  }
  return { ok: true };
}

function githubHeaders(token) {
  return {
    "Authorization": `Bearer ${token}`,
    "Accept": "application/vnd.github+json",
    "User-Agent": "LiveIPO-Cloudflare-Sync-Worker",
    "Content-Type": "application/json"
  };
}

// ==========================================================
// ALLOTMENT CHECKER HELPERS (Pure Web APIs - No DOMParser)
// ==========================================================

function decodeHtmlEntities(str) {
  return String(str || "")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeRegistrarId(registrarId, registrarUrl) {
  const combined = `${registrarId || ""} ${registrarUrl || ""}`.toUpperCase();
  if (combined.includes("BIGSHARE")) return "BIGSHARE";
  if (combined.includes("MPMS.MUFG") || combined.includes("MUFG") || combined.includes("LINKINTIME")) return "MUFG";
  if (combined.includes("MAASHITLA")) return "MAASHITLA";
  if (combined.includes("SKYLINERTA") || combined.includes("SKYLINE")) return "SKYLINE";
  if (combined.includes("SATELLITECORPORATE") || combined.includes("SATELLITE")) return "SATELLITE";
  if (combined.includes("KFIN") || combined.includes("KOSMIC") || combined.includes("KPRISM")) return "KFIN";
  if (combined.includes("ABHIPRA")) return "ABHIPRA";
  if (combined.includes("ACCURATE")) return "ACCURATE";
  if (combined.includes("MASSERV") || /\bMAS\b/.test(combined)) return "MAS";
  if (combined.includes("PURVA")) return "PURVA";
  if (combined.includes("CAMEO")) return "CAMEO";
  if (combined.includes("BEETAL")) return "BEETALFC";
  if (combined.includes("INTEGRATED")) return "INTEGRATED";
  if (combined.includes("ALANKIT")) return "ALANKIT";
  if (combined.includes("ANKIT")) return "ANKIT";
  if (combined.includes("MUDRA")) return "MUDRA";
  if (combined.includes("NSEINDIA") || /\bNSE\b/.test(combined)) return "NSE";
  if (combined.includes("BSEINDIA") || /\bBSE\b/.test(combined)) return "BSE";
  return "UNKNOWN";
}

function getRegistrarPortalUrl(regId, fallbackUrl) {
  switch (regId) {
    case "BIGSHARE": return "https://ipo.bigshareonline.com/IPO_Status.html";
    case "MUFG": return "https://in.mpms.mufg.com/Initial_Offer/public-issues.html";
    case "MAASHITLA": return "https://maashitla.com/allotment-status/public-issues";
    case "SKYLINE": return "https://www.skylinerta.com/ipo.php";
    case "SATELLITE": return "https://www.satellitecorporate.com/ipo-query.php";
    case "KFIN": return "https://ipostatus.kfintech.com/";
    case "PURVA": return "https://www.purvashare.com/investor-service/ipo-query";
    case "ABHIPRA": return "https://www.abhipra.com/ipo-status";
    case "ACCURATE": return "https://www.accuratesecurities.com/ipo-details.php";
    case "MAS": return "https://www.masserv.com/opt.asp";
    case "BEETALFC": return "https://beetal.in/investor-services/#IPO_Allotment_Status";
    case "CAMEO": return "https://ipostatus1.cameoindia.com/";
    case "ALANKIT": return "https://ipo.alankit.com/";
    case "INTEGRATED": return "https://www.integratedregistry.in/IRMS_V2/IPOListing.aspx";
    case "MUDRA": return "https://mudrarta.com/ipo.php";
    case "NSE": return "https://www.nseindia.in/invest/check-trades-bids-verify-ipo-bids";
    case "BSE": return "https://www.bseindia.com/investors/appli_check";
    default: return fallbackUrl || "";
  }
}

function normalizeCompanyName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\./g, " ")
    .replace(/\b(ipo\s*details|ipo|fpo|limited|ltd|private|pvt|india|the|server\s*\d+)\b/gi, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchCompanyFromList(companies, targetName, explicitCode) {
  if (!Array.isArray(companies) || companies.length === 0) return null;

  // 1. Exact registrar internal code match
  if (explicitCode) {
    const byCode = companies.find(c => String(c.code).trim() === String(explicitCode).trim());
    if (byCode) return byCode;
  }

  const normTarget = normalizeCompanyName(targetName);
  if (!normTarget) return null;

  // 2. Exact normalized name match
  for (const c of companies) {
    if (normalizeCompanyName(c.name) === normTarget) return c;
  }

  // 3. Compact alphanumeric match (handles "M.K.Sons" vs "M K Sons" vs "MKSons")
  const compactTarget = normTarget.replace(/\s+/g, "");
  for (const c of companies) {
    if (normalizeCompanyName(c.name).replace(/\s+/g, "") === compactTarget) return c;
  }

  // 4. Prefix / substring match (when names differ slightly like "Engineering Services" vs "Engineering")
  if (compactTarget.length >= 5) {
    for (const c of companies) {
      const compactCand = normalizeCompanyName(c.name).replace(/\s+/g, "");
      if (compactCand.length >= 5 && (compactCand.includes(compactTarget) || compactTarget.includes(compactCand))) {
        return c;
      }
    }
  }

  // 5. Token overlap fallback
  const targetTokens = normTarget.split(" ").filter(t => t.length > 1);
  if (targetTokens.length > 0) {
    let best = null;
    let bestScore = 0;
    for (const c of companies) {
      const candTokens = normalizeCompanyName(c.name).split(" ").filter(t => t.length > 1);
      if (candTokens.length === 0) continue;
      const common = targetTokens.filter(t => candTokens.includes(t)).length;
      const score = common / Math.max(targetTokens.length, candTokens.length);
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
    if (best && bestScore >= 0.65) return best;
  }

  return null;
}

function parseSelectOptions(html, selectRegex) {
  const match = html.match(selectRegex);
  if (!match) return [];
  const selectHtml = match[0];
  const options = [];
  const optRegex = /<option[^>]*value\s*=\s*["']([^"']*)["'][^>]*>([\s\S]*?)<\/option>/gi;
  let m;
  while ((m = optRegex.exec(selectHtml)) !== null) {
    const code = decodeHtmlEntities(m[1]);
    const name = decodeHtmlEntities(m[2]);
    if (code && !code.includes("--") && code !== "0" && name && !/^--?\s*select/i.test(name) && !/^choose/i.test(name)) {
      options.push({ code, name });
    }
  }
  return options;
}

async function fetchRegistrarCompanies(regId) {
  if (regId === "BIGSHARE") {
    const res = await fetch("https://ipo.bigshareonline.com/IPO_Status.html", { headers: DEFAULT_HEADERS });
    if (!res.ok) throw new Error(`Bigshare HTTP ${res.status}`);
    const html = await res.text();
    return parseSelectOptions(html, /<select[^>]*id\s*=\s*["']ddlCompany["'][\s\S]*?<\/select>/i);
  }

  if (regId === "KFIN") {
    const indexRes = await fetch("https://ipostatus.kfintech.com/", { headers: DEFAULT_HEADERS });
    if (!indexRes.ok) throw new Error(`KFintech HTTP ${indexRes.status}`);
    const indexHtml = await indexRes.text();
    const jsMatch = indexHtml.match(/static\/js\/(main\.[a-z0-9]+\.js)/i);
    if (!jsMatch) throw new Error("KFintech app bundle reference not found");

    const jsRes = await fetch(`https://ipostatus.kfintech.com/static/js/${jsMatch[1]}`, {
      headers: {
        ...DEFAULT_HEADERS,
        "Accept": "*/*",
        "Referer": "https://ipostatus.kfintech.com/"
      }
    });
    if (!jsRes.ok) throw new Error(`KFintech JS bundle HTTP ${jsRes.status}`);
    const jsText = await jsRes.text();

    const listMatch = jsText.match(/JSON\.parse\('(\[\{"clientId"[\s\S]*?\])'\)/);
    if (!listMatch) return [];
    const arr = JSON.parse(listMatch[1]);
    return Array.isArray(arr) ? arr.map(item => ({ code: String(item.clientId), name: String(item.name || "") })) : [];
  }

  if (regId === "MUFG") {
    const res = await fetch("https://in.mpms.mufg.com/Initial_Offer/IPO.aspx/GetDetails", {
      method: "POST",
      headers: {
        ...DEFAULT_HEADERS,
        "Content-Type": "application/json; charset=utf-8",
        "Referer": "https://in.mpms.mufg.com/Initial_Offer/public-issues.html"
      },
      body: "{}"
    });
    if (!res.ok) throw new Error(`MUFG GetDetails HTTP ${res.status}`);
    const data = await res.json();
    const xml = String(data?.d || "");
    const list = [];
    const tableRegex = /<Table>[\s\S]*?<company_id>([\s\S]*?)<\/company_id>[\s\S]*?<companyname>([\s\S]*?)<\/companyname>[\s\S]*?<\/Table>/gi;
    let m;
    while ((m = tableRegex.exec(xml)) !== null) {
      const code = decodeHtmlEntities(m[1]);
      const name = decodeHtmlEntities(m[2]);
      if (code && name) list.push({ code, name });
    }
    return list;
  }

  if (regId === "MAASHITLA") {
    const merged = [];
    const seen = new Set();

    try {
      const dirRes = await fetch("https://api.maashitla.com/api/company-directory", { headers: DEFAULT_HEADERS });
      if (dirRes.ok) {
        const dirJson = await dirRes.json();
        const dirList = Array.isArray(dirJson?.companies) ? dirJson.companies : [];
        dirList.forEach(item => {
          if (item?.company_slug && item?.company_name) {
            const key = normalizeCompanyName(item.company_name);
            seen.add(key);
            merged.push({
              code: String(item.company_slug),
              name: String(item.company_name),
              source: "directory"
            });
          }
        });
      }
    } catch (_) {}

    try {
      const legRes = await fetch("https://api.maashitla.com/api/public-issue/companies", { headers: DEFAULT_HEADERS });
      if (legRes.ok) {
        const arr = await legRes.json();
        if (Array.isArray(arr)) {
          arr.forEach(item => {
            if (item?.company_name) {
              const key = normalizeCompanyName(item.company_name);
              if (!seen.has(key)) {
                seen.add(key);
                merged.push({
                  code: String(item.company_name),
                  companyId: item.company_id,
                  name: String(item.company_name),
                  source: "legacy"
                });
              }
            }
          });
        }
      }
    } catch (_) {}

    return merged;
  }

  if (regId === "SKYLINE") {
    const res = await fetch("https://www.skylinerta.com/ipo.php", { headers: DEFAULT_HEADERS });
    if (!res.ok) throw new Error(`Skyline HTTP ${res.status}`);
    const html = await res.text();
    return parseSelectOptions(html, /<select[^>]*name\s*=\s*["']company["'][\s\S]*?<\/select>/i);
  }

  if (regId === "SATELLITE") {
    const res = await fetch("https://www.satellitecorporate.com/ipo-query.php", { headers: DEFAULT_HEADERS });
    if (!res.ok) throw new Error(`Satellite HTTP ${res.status}`);
    const html = await res.text();
    return parseSelectOptions(html, /<select[^>]*name\s*=\s*["']company["'][\s\S]*?<\/select>/i);
  }

  if (regId === "PURVA") {
    const res = await fetch("https://www.purvashare.com/investor-service/ipo-query", { headers: DEFAULT_HEADERS });
    if (!res.ok) throw new Error(`Purva HTTP ${res.status}`);
    const html = await res.text();
    return parseSelectOptions(html, /<select[^>]*name\s*=\s*["']company_id["'][\s\S]*?<\/select>/i);
  }

  if (regId === "ABHIPRA") {
    try {
      const apiRes = await fetch("https://www.abhipra.com/ipo-status-api", {
        headers: { ...DEFAULT_HEADERS, "Referer": "https://www.abhipra.com/ipo-status" }
      });
      if (apiRes.ok) {
        const json = await apiRes.json();
        if (json?.success && Array.isArray(json.companies)) {
          return json.companies
            .filter(c => c?.allotmentFileName && c?.issuerCompanyName)
            .map(c => ({ code: String(c.allotmentFileName), name: String(c.issuerCompanyName) }));
        }
      }
    } catch (_) {}
    const res = await fetch("https://www.abhipra.com/ipo-status", { headers: DEFAULT_HEADERS });
    if (!res.ok) throw new Error(`Abhipra HTTP ${res.status}`);
    const html = await res.text();
    return parseSelectOptions(html, /<select[^>]*id\s*=\s*["']company-select["'][\s\S]*?<\/select>/i);
  }

  if (regId === "ACCURATE") {
    const res = await fetch("https://www.accuratesecurities.com/ipo-details.php", { headers: DEFAULT_HEADERS });
    if (!res.ok) throw new Error(`Accurate HTTP ${res.status}`);
    const html = await res.text();
    return parseSelectOptions(html, /<select[^>]*name\s*=\s*["']company["'][\s\S]*?<\/select>/i);
  }

  if (regId === "MAS") {
    const res = await fetch("https://www.masserv.com/opt.asp", { headers: DEFAULT_HEADERS });
    if (!res.ok) throw new Error(`MAS HTTP ${res.status}`);
    const html = (await res.text()).replace(/<!--[\s\S]*?-->/g, " ");
    const list = [];
    const seen = new Set();
    const blockRegex = /IPO\s*[-–:]\s*([^\r\n<]+?)\s*ALLOTMENT\s*STATUS[\s\S]{0,1200}?href\s*=\s*["']?([^"'\s>]*asearch[^"'\s>]*\.asp)["']?/gi;
    let m;
    while ((m = blockRegex.exec(html)) !== null) {
      const name = decodeHtmlEntities(m[1]);
      const searchPage = m[2].replace(/^\/+/, "");
      const key = `${searchPage}::${normalizeCompanyName(name)}`;
      if (name && searchPage && !seen.has(key)) {
        seen.add(key);
        list.push({ code: searchPage, name });
      }
    }
    return list;
  }

  return [];
}

function summarizeBidRows(rows, mapRow) {
  let totalAllotted = 0;
  let totalApplied = 0;
  let holderName = "";
  const bidParts = [];

  rows.forEach((rec, idx) => {
    const mapped = mapRow(rec);
    const allotted = parseInt(String(mapped.allotted ?? "0").replace(/,/g, ""), 10) || 0;
    const applied = parseInt(String(mapped.applied ?? "0").replace(/,/g, ""), 10) || 0;
    if (!holderName && mapped.name) holderName = String(mapped.name).trim();
    totalAllotted += allotted;
    totalApplied += applied;
    if (rows.length > 1) {
      bidParts.push(allotted > 0 ? `Bid ${idx + 1}: ${allotted} shares allotted` : `Bid ${idx + 1}: No shares`);
    }
  });

  if (totalAllotted > 0) {
    return {
      status: "ALLOTTED",
      sharesAllotted: totalAllotted,
      sharesApplied: totalApplied,
      holderName,
      resultText: rows.length > 1 ? bidParts.join(" | ") : `Bid 1: ${totalAllotted} shares allotted`
    };
  }
  return {
    status: "NO_SHARES",
    sharesAllotted: 0,
    sharesApplied: totalApplied,
    holderName,
    resultText: totalApplied > 0 ? `Applied (${totalApplied}) — No shares allotted` : "Bid 1: No shares allotted"
  };
}

function extractXmlTag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return m ? decodeHtmlEntities(m[1]) : "";
}

function extractSetCookieList(headers) {
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }
  const raw = headers.get("set-cookie") || "";
  if (!raw) return [];
  return raw.split(/,(?=[^;]+=[^;]+)/).map(s => s.trim()).filter(Boolean);
}

function mergeCookiesIntoJar(jar, headers) {
  extractSetCookieList(headers).forEach(c => {
    const eq = c.indexOf("=");
    const semi = c.indexOf(";");
    if (eq > 0) {
      const k = c.slice(0, eq).trim();
      const v = c.slice(eq + 1, semi > eq ? semi : undefined).trim();
      if (k && v) jar[k] = v;
    }
  });
}

function serializeCookieJar(jar) {
  return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");
}

function extractSetCookieHeader(headers) {
  return extractSetCookieList(headers).map(c => c.split(";")[0].trim()).filter(Boolean).join("; ");
}

async function queryRegistrarSinglePan(regId, companyItem, pan) {
  // 1. BIGSHARE
  if (regId === "BIGSHARE") {
    const res = await fetch("https://ipo.bigshareonline.com/Data.aspx/FetchIpodetails", {
      method: "POST",
      headers: {
        ...DEFAULT_HEADERS,
        "Content-Type": "application/json; charset=utf-8",
        "Referer": "https://ipo.bigshareonline.com/IPO_Status.html",
        "X-Requested-With": "XMLHttpRequest"
      },
      body: JSON.stringify({
        Applicationno: "",
        Company: String(companyItem.code),
        SelectionType: "PN",
        PanNo: pan,
        txtcsdl: "",
        txtDPID: "",
        txtClId: "",
        ddlType: "1",
        lang: "en"
      })
    });
    if (!res.ok) throw new Error(`Bigshare API HTTP ${res.status}`);
    const json = await res.json();
    const d = json?.d;
    if (!d) throw new Error("Empty Bigshare response");

    if (d.Status === "FOUND") {
      const records = Array.isArray(d.Records) && d.Records.length > 0 ? d.Records : [d];
      let totalAllotted = 0;
      let totalApplied = 0;
      const bidParts = [];

      records.forEach((rec, idx) => {
        const alloted = parseInt(String(rec.ALLOTED || rec.Alloted || "0").replace(/,/g, ""), 10) || 0;
        const applied = parseInt(String(rec.APPLIED || rec.Applied || "0").replace(/,/g, ""), 10) || 0;
        totalAllotted += alloted;
        totalApplied += applied;
        if (records.length > 1) {
          bidParts.push(alloted > 0 ? `Bid ${idx + 1}: ${alloted} shares allotted` : `Bid ${idx + 1}: No shares`);
        }
      });

      if (totalAllotted > 0) {
        return {
          status: "ALLOTTED",
          sharesAllotted: totalAllotted,
          sharesApplied: totalApplied,
          holderName: d.Name || "",
          resultText: records.length > 1 ? bidParts.join(" | ") : `Bid 1: ${totalAllotted} shares allotted`
        };
      }
      return {
        status: "NO_SHARES",
        sharesAllotted: 0,
        sharesApplied: totalApplied,
        holderName: d.Name || "",
        resultText: totalApplied > 0 ? `Applied (${totalApplied}) — No shares allotted` : "Bid 1: No shares allotted"
      };
    }

    return {
      status: "NO_RECORD",
      sharesAllotted: 0,
      resultText: "Bid 1: NO RECORD FOUND"
    };
  }

  // 2. MUFG INTIME (Link Intime)
  if (regId === "MUFG") {
    const res = await fetch("https://in.mpms.mufg.com/Initial_Offer/IPO.aspx/SearchOnPan", {
      method: "POST",
      headers: {
        ...DEFAULT_HEADERS,
        "Content-Type": "application/json; charset=utf-8",
        "Referer": "https://in.mpms.mufg.com/Initial_Offer/public-issues.html",
        "X-Requested-With": "XMLHttpRequest"
      },
      body: JSON.stringify({
        clientid: String(companyItem.code),
        PAN: pan,
        IFSC: "",
        CHKVAL: "1",
        token: ""
      })
    });
    if (!res.ok) throw new Error(`MUFG API HTTP ${res.status}`);
    const json = await res.json();
    const xml = String(json?.d || "");

    const tables = xml.match(/<Table>[\s\S]*?<\/Table>/gi) || [];
    if (tables.length === 0) {
      return {
        status: "NO_RECORD",
        sharesAllotted: 0,
        resultText: "Bid 1: NO RECORD FOUND"
      };
    }

    let totalAllotted = 0;
    let totalApplied = 0;
    let holderName = "";
    const bidParts = [];

    tables.forEach((tbl, idx) => {
      const allot = parseInt(extractXmlTag(tbl, "ALLOT").replace(/,/g, ""), 10) || 0;
      const shares = parseInt(extractXmlTag(tbl, "SHARES").replace(/,/g, ""), 10) || 0;
      const n = extractXmlTag(tbl, "NAME1");
      if (!holderName && n) holderName = n;
      totalAllotted += allot;
      totalApplied += shares;
      if (tables.length > 1) {
        bidParts.push(allot > 0 ? `Bid ${idx + 1}: ${allot} shares allotted` : `Bid ${idx + 1}: No shares`);
      }
    });

    if (totalAllotted > 0) {
      return {
        status: "ALLOTTED",
        sharesAllotted: totalAllotted,
        sharesApplied: totalApplied,
        holderName,
        resultText: tables.length > 1 ? bidParts.join(" | ") : `Bid 1: ${totalAllotted} shares allotted`
      };
    }

    return {
      status: "NO_SHARES",
      sharesAllotted: 0,
      sharesApplied: totalApplied,
      holderName,
      resultText: totalApplied > 0 ? `Applied (${totalApplied}) — No shares allotted` : "Bid 1: No shares allotted"
    };
  }

  // 3. MAASHITLA SECURITIES
  if (regId === "MAASHITLA") {
    const codeStr = String(companyItem.code || "");
    const isDirectorySlug = companyItem.source === "directory" || (!/\s/.test(codeStr) && /^[a-z0-9\-]+$/.test(codeStr));

    if (isDirectorySlug) {
      const checkUrl = `https://pnjbvxj6md.execute-api.ap-south-1.amazonaws.com/prod/check/${encodeURIComponent(codeStr)}?pan=${encodeURIComponent(pan)}`;
      const res = await fetch(checkUrl, {
        headers: {
          ...DEFAULT_HEADERS,
          "Origin": "https://maashitla.com",
          "Referer": "https://maashitla.com/"
        }
      });
      if (res.status === 404) {
        return { status: "NO_RECORD", sharesAllotted: 0, resultText: "Bid 1: NO RECORD FOUND" };
      }
      if (!res.ok) throw new Error(`Maashitla AWS API HTTP ${res.status}`);
      const data = await res.json().catch(() => null);
      if (!data || data.name == null) {
        return { status: "NO_RECORD", sharesAllotted: 0, resultText: "Bid 1: NO RECORD FOUND" };
      }
      const allotted = parseInt(String(data.shares_allotted ?? "0").replace(/,/g, ""), 10) || 0;
      const applied = parseInt(String(data.shares_applied ?? "0").replace(/,/g, ""), 10) || 0;
      if (allotted > 0) {
        return { status: "ALLOTTED", sharesAllotted: allotted, sharesApplied: applied, holderName: data.name || "", resultText: `Bid 1: ${allotted} shares allotted` };
      }
      return { status: "NO_SHARES", sharesAllotted: 0, sharesApplied: applied, holderName: data.name || "", resultText: applied > 0 ? `Applied (${applied}) — No shares allotted` : "Bid 1: No shares allotted" };
    }

    const queryUrl = `https://api.maashitla.com/api/public-issue/search?company_name=${encodeURIComponent(codeStr)}&pan=${encodeURIComponent(pan)}`;
    const res = await fetch(queryUrl, { headers: DEFAULT_HEADERS });
    if (res.status === 404) {
      return {
        status: "NO_RECORD",
        sharesAllotted: 0,
        resultText: "Bid 1: NO RECORD FOUND"
      };
    }
    if (!res.ok) throw new Error(`Maashitla API HTTP ${res.status}`);
    const data = await res.json();
    const allotted = parseInt(String(data?.shares_allotted ?? "0").replace(/,/g, ""), 10) || 0;
    const applied = parseInt(String(data?.shares_applied ?? "0").replace(/,/g, ""), 10) || 0;

    if (allotted > 0) {
      return {
        status: "ALLOTTED",
        sharesAllotted: allotted,
        sharesApplied: applied,
        holderName: data?.name || "",
        resultText: `Bid 1: ${allotted} shares allotted`
      };
    }
    return {
      status: "NO_SHARES",
      sharesAllotted: 0,
      sharesApplied: applied,
      holderName: data?.name || "",
      resultText: applied > 0 ? `Applied (${applied}) — No shares allotted` : "Bid 1: No shares allotted"
    };
  }

  // 4. SKYLINE FINANCIAL SERVICES
  if (regId === "SKYLINE") {
    const s1 = await fetch("https://www.skylinerta.com/display_application.php", {
      method: "POST",
      headers: {
        ...DEFAULT_HEADERS,
        "Content-Type": "application/x-www-form-urlencoded",
        "Referer": "https://www.skylinerta.com/ipo.php"
      },
      body: `company=${encodeURIComponent(companyItem.code)}`
    });
    const cookieHeader = extractSetCookieHeader(s1.headers);
    const html1 = await s1.text();
    const csrfMatch = html1.match(/name\s*=\s*["']csrf_token["'][^>]*value\s*=\s*["']([^"']+)["']/i)
      || html1.match(/value\s*=\s*["']([^"']+)["'][^>]*name\s*=\s*["']csrf_token["']/i);
    const csrf = csrfMatch ? csrfMatch[1] : "";

    const postParams = new URLSearchParams({
      csrf_token: csrf,
      company: String(companyItem.code),
      action: "search",
      client_id: "",
      application_no: "",
      pan: pan
    });

    const s2 = await fetch("https://www.skylinerta.com/display_application.php", {
      method: "POST",
      headers: {
        ...DEFAULT_HEADERS,
        "Content-Type": "application/x-www-form-urlencoded",
        "Referer": "https://www.skylinerta.com/display_application.php",
        ...(cookieHeader ? { "Cookie": cookieHeader } : {})
      },
      body: postParams.toString()
    });
    if (!s2.ok) throw new Error(`Skyline HTTP ${s2.status}`);
    const html2 = await s2.text();
    const cleanText = decodeHtmlEntities(html2);

    if (/no record found|could not find any application|not found/i.test(cleanText)) {
      return {
        status: "NO_RECORD",
        sharesAllotted: 0,
        resultText: "Bid 1: NO RECORD FOUND"
      };
    }

    const allottedMatch = cleanText.match(/(?:Shares\s*Allotted|Allotted\s*Shares|Allotted)\s*[:\-]?\s*(\d[\d,]*)/i);
    if (allottedMatch) {
      const shares = parseInt(allottedMatch[1].replace(/,/g, ""), 10) || 0;
      if (shares > 0) {
        return {
          status: "ALLOTTED",
          sharesAllotted: shares,
          resultText: `Bid 1: ${shares} shares allotted`
        };
      }
      return {
        status: "NO_SHARES",
        sharesAllotted: 0,
        resultText: "Bid 1: No shares allotted"
      };
    }

    return {
      status: "PORTAL_CHECK_REQUIRED",
      sharesAllotted: 0,
      resultText: "Check directly on Skyline portal"
    };
  }

  // 5. SATELLITE CORPORATE SERVICES
  if (regId === "SATELLITE") {
    const satUrl = `https://www.satellitecorporate.com/mainAjax.php?action=search_applicant&data_search=pan_no&company=${encodeURIComponent(companyItem.code)}&search_no=${encodeURIComponent(pan)}`;
    const res = await fetch(satUrl, {
      headers: {
        ...DEFAULT_HEADERS,
        "Referer": "https://www.satellitecorporate.com/ipo-query.php",
        "X-Requested-With": "XMLHttpRequest"
      }
    });
    if (!res.ok) throw new Error(`Satellite HTTP ${res.status}`);
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch (_) {}

    if (json && json.status === "success") {
      const details = json.applicantDetails;
      if (!details || (Array.isArray(details) && details.length === 0)) {
        return {
          status: "NO_RECORD",
          sharesAllotted: 0,
          resultText: "Bid 1: NO RECORD FOUND"
        };
      }
      const rows = Array.isArray(details) ? details : [details];
      return summarizeBidRows(rows, d => ({
        allotted: d?.shared_allotted ?? d?.shares_allotted ?? d?.allotted_shares ?? d?.allotted ?? 0,
        applied: d?.shares_applied ?? d?.applied_shares ?? 0,
        name: d?.applicant_name ?? d?.name ?? ""
      }));
    }

    const flatText = decodeHtmlEntities(json ? JSON.stringify(json) : text);
    if (/no record|not found|invalid/i.test(flatText) && !/(?:allotted|shared_allotted)\D{0,15}[1-9]/i.test(flatText)) {
      return {
        status: "NO_RECORD",
        sharesAllotted: 0,
        resultText: "Bid 1: NO RECORD FOUND"
      };
    }
    const sharesMatch = flatText.match(/(?:shared_allotted|shares_allotted|allotted|allot_shares|alloted)\D{0,15}(\d[\d,]*)/i);
    if (sharesMatch) {
      const shares = parseInt(sharesMatch[1].replace(/,/g, ""), 10) || 0;
      if (shares > 0) {
        return { status: "ALLOTTED", sharesAllotted: shares, resultText: `Bid 1: ${shares} shares allotted` };
      }
      return { status: "NO_SHARES", sharesAllotted: 0, resultText: "Bid 1: No shares allotted" };
    }
    return { status: "PORTAL_CHECK_REQUIRED", sharesAllotted: 0, resultText: "Check directly on Satellite portal" };
  }

  // 6. KFINTECH (ipostatus.kfintech.com — Official AWS Prod Query API)
  if (regId === "KFIN") {
    const res = await fetch("https://0uz601ms56.execute-api.ap-south-1.amazonaws.com/prod/api/query?type=pan", {
      method: "GET",
      headers: {
        ...DEFAULT_HEADERS,
        "Origin": "https://ipostatus.kfintech.com",
        "Referer": "https://ipostatus.kfintech.com/",
        "reqparam": pan,
        "client_id": String(companyItem.code)
      }
    });

    if (res.status === 404) {
      return {
        status: "NO_RECORD",
        sharesAllotted: 0,
        resultText: "Bid 1: NO RECORD FOUND"
      };
    }

    if (!res.ok) throw new Error(`KFintech API HTTP ${res.status}`);
    const json = await res.json();
    const rows = Array.isArray(json?.data) ? json.data : [];
    if (rows.length === 0) {
      return {
        status: "NO_RECORD",
        sharesAllotted: 0,
        resultText: "Bid 1: NO RECORD FOUND"
      };
    }

    let totalAllotted = 0;
    let totalApplied = 0;
    let holderName = "";
    const bidParts = [];

    rows.forEach((rec, idx) => {
      const allot = parseInt(String(rec.All_Shares || "0").replace(/,/g, ""), 10) || 0;
      const app = parseInt(String(rec.App_Shares || "0").replace(/,/g, ""), 10) || 0;
      if (!holderName && rec.Name) holderName = String(rec.Name).trim();
      totalAllotted += allot;
      totalApplied += app;
      if (rows.length > 1) {
        bidParts.push(allot > 0 ? `Bid ${idx + 1}: ${allot} shares allotted` : `Bid ${idx + 1}: No shares`);
      }
    });

    if (totalAllotted > 0) {
      return {
        status: "ALLOTTED",
        sharesAllotted: totalAllotted,
        sharesApplied: totalApplied,
        holderName,
        resultText: rows.length > 1 ? bidParts.join(" | ") : `Bid 1: ${totalAllotted} shares allotted`
      };
    }

    return {
      status: "NO_SHARES",
      sharesAllotted: 0,
      sharesApplied: totalApplied,
      holderName,
      resultText: totalApplied > 0 ? `Applied (${totalApplied}) — No shares allotted` : "Bid 1: No shares allotted"
    };
  }

  // 7. PURVA SHAREGISTRY (purvashare.com — Django CSRF + PRG Cookie Flow, No Captcha)
  if (regId === "PURVA") {
    const purvaUrl = "https://www.purvashare.com/investor-service/ipo-query";
    const jar = {};

    const gRes = await fetch(purvaUrl, {
      method: "GET",
      headers: {
        ...DEFAULT_HEADERS,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      }
    });
    if (!gRes.ok) throw new Error(`Purva GET HTTP ${gRes.status}`);
    mergeCookiesIntoJar(jar, gRes.headers);
    const html1 = await gRes.text();

    const csrfMatch = html1.match(/name\s*=\s*["']csrfmiddlewaretoken["'][^>]*value\s*=\s*["']([^"']+)["']/i)
      || html1.match(/value\s*=\s*["']([^"']+)["'][^>]*name\s*=\s*["']csrfmiddlewaretoken["']/i);
    const csrfToken = csrfMatch ? csrfMatch[1] : "";
    if (!csrfToken) throw new Error("Purva CSRF token missing");

    const formBody = new URLSearchParams({
      csrfmiddlewaretoken: csrfToken,
      company_id: String(companyItem.code),
      applicationNumber: "",
      panNumber: pan
    });

    const pRes = await fetch(purvaUrl, {
      method: "POST",
      headers: {
        ...DEFAULT_HEADERS,
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Origin": "https://www.purvashare.com",
        "Referer": purvaUrl,
        ...(serializeCookieJar(jar) ? { "Cookie": serializeCookieJar(jar) } : {})
      },
      body: formBody.toString(),
      redirect: "manual"
    });
    mergeCookiesIntoJar(jar, pRes.headers);

    let resultHtml = "";
    if (pRes.status >= 300 && pRes.status < 400) {
      const loc = pRes.headers.get("location") || purvaUrl;
      const nextUrl = loc.startsWith("http") ? loc : `https://www.purvashare.com${loc.startsWith("/") ? "" : "/"}${loc}`;
      const rRes = await fetch(nextUrl, {
        method: "GET",
        headers: {
          ...DEFAULT_HEADERS,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Referer": purvaUrl,
          ...(serializeCookieJar(jar) ? { "Cookie": serializeCookieJar(jar) } : {})
        }
      });
      if (!rRes.ok) throw new Error(`Purva result GET HTTP ${rRes.status}`);
      resultHtml = await rRes.text();
    } else if (pRes.ok) {
      resultHtml = await pRes.text();
    } else {
      throw new Error(`Purva POST HTTP ${pRes.status}`);
    }

    // Strip styles and scripts before text inspection
    const strippedHtml = resultHtml
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ");

    const msgMatch = strippedHtml.match(/<div[^>]*class\s*=\s*["'][^"']*notification-message[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    const notifText = msgMatch ? decodeHtmlEntities(msgMatch[1]) : "";
    const mainMatch = strippedHtml.match(/<main[\s\S]*?<\/main>/i);
    const mainNoForm = (mainMatch ? mainMatch[0] : strippedHtml).replace(/<form[\s\S]*?<\/form>/gi, " ");
    const cleanMainText = decodeHtmlEntities(mainNoForm);
    const combinedText = `${notifText} ${cleanMainText}`.trim();

    if (/no record found|record not found|please re-check/i.test(combinedText)) {
      return {
        status: "NO_RECORD",
        sharesAllotted: 0,
        resultText: "Bid 1: NO RECORD FOUND"
      };
    }

    if (/no shares? allotted|not allotted/i.test(combinedText)) {
      return {
        status: "NO_SHARES",
        sharesAllotted: 0,
        resultText: "Bid 1: No shares allotted"
      };
    }

    const allottedMatch = combinedText.match(/(?:Shares\s*Allotted|Allotted\s*Shares|Allotment\s*Status\s*[:\-]?|Allotted)\D{0,25}(\d[\d,]*)/i)
      || combinedText.match(/(\d[\d,]*)\s*shares?\s*allotted/i);
    if (allottedMatch) {
      const shares = parseInt(allottedMatch[1].replace(/,/g, ""), 10) || 0;
      if (shares > 0) {
        return {
          status: "ALLOTTED",
          sharesAllotted: shares,
          resultText: `Bid 1: ${shares} shares allotted`
        };
      }
      return {
        status: "NO_SHARES",
        sharesAllotted: 0,
        resultText: "Bid 1: No shares allotted"
      };
    }

    return {
      status: "PORTAL_CHECK_REQUIRED",
      sharesAllotted: 0,
      resultText: notifText || "Check directly on Purva Sharegistry portal"
    };
  }

  // 8. ABHIPRA CAPITAL LIMITED (abhipra.com/ipo-status — Official JSON API, No Captcha)
  if (regId === "ABHIPRA") {
    const res = await fetch("https://www.abhipra.com/ipo-status-api", {
      method: "POST",
      headers: {
        ...DEFAULT_HEADERS,
        "Content-Type": "application/json",
        "Origin": "https://www.abhipra.com",
        "Referer": "https://www.abhipra.com/ipo-status"
      },
      body: JSON.stringify({
        allotmentFileName: String(companyItem.code),
        searchType: "pan",
        searchValue: pan
      })
    });
    if (!res.ok) throw new Error(`Abhipra API HTTP ${res.status}`);
    const data = await res.json();
    if (!data?.success) throw new Error(data?.error || "Abhipra API error");
    const rows = Array.isArray(data.records) ? data.records : [];
    if (!data.found || rows.length === 0) {
      return { status: "NO_RECORD", sharesAllotted: 0, resultText: "Bid 1: NO RECORD FOUND" };
    }
    return summarizeBidRows(rows, rec => ({
      allotted: rec?.sharesAllotted ?? 0,
      applied: rec?.sharesApplied ?? 0,
      name: rec?.applicantName ?? ""
    }));
  }

  // 9. ACCURATE SECURITIES (accuratesecurities.com — Official JSON API, No Captcha)
  if (regId === "ACCURATE") {
    const res = await fetch("https://beta.accurateai.in/check-allotment", {
      method: "POST",
      headers: {
        ...DEFAULT_HEADERS,
        "Content-Type": "application/json",
        "Origin": "https://www.accuratesecurities.com",
        "Referer": "https://www.accuratesecurities.com/ipo-details.php"
      },
      body: JSON.stringify({
        company: String(companyItem.code || "1"),
        type: "1",
        number: pan
      })
    });
    if (!res.ok) throw new Error(`Accurate API HTTP ${res.status}`);
    const data = await res.json();
    const rows = Array.isArray(data?.message) ? data.message : [];
    if (String(data?.status) !== "true" || rows.length === 0) {
      return { status: "NO_RECORD", sharesAllotted: 0, resultText: "Bid 1: NO RECORD FOUND" };
    }
    return summarizeBidRows(rows, rec => ({
      allotted: rec?.allottedShares ?? 0,
      applied: rec?.appliedShares ?? 0,
      name: rec?.clientName ?? ""
    }));
  }

  // 10. MAS SERVICES LTD (masserv.com/opt.asp — Direct ASP Form Flow, No Captcha)
  if (regId === "MAS") {
    const rawPage = String(companyItem.code || "asearch.asp").replace(/^\/+/, "");
    const searchPage = /^[\w\-./]+\.asp$/i.test(rawPage) ? rawPage : "asearch.asp";
    const formUrl = `https://www.masserv.com/${searchPage}`;
    const gRes = await fetch(formUrl, { headers: DEFAULT_HEADERS });
    if (!gRes.ok) throw new Error(`MAS GET HTTP ${gRes.status}`);
    const cookieHeader = extractSetCookieHeader(gRes.headers);
    const formHtml = await gRes.text();

    const actMatch = formHtml.match(/<form[^>]*action\s*=\s*["']?([^\s"'>]+\.asp)/i);
    const actionFile = actMatch ? actMatch[1].replace(/^\/+/, "") : (searchPage.includes("ipo_") ? "ipo_search1.asp" : "search1.asp");
    const postUrl = /^[\w\-./]+\.asp$/i.test(actionFile) ? `https://www.masserv.com/${actionFile}` : "https://www.masserv.com/search1.asp";

    const formBody = new URLSearchParams({ texthn: pan, DtLogin: "Search" });
    const pRes = await fetch(postUrl, {
      method: "POST",
      headers: {
        ...DEFAULT_HEADERS,
        "Content-Type": "application/x-www-form-urlencoded",
        "Origin": "https://www.masserv.com",
        "Referer": formUrl,
        ...(cookieHeader ? { "Cookie": cookieHeader } : {})
      },
      body: formBody.toString()
    });
    if (!pRes.ok) throw new Error(`MAS POST HTTP ${pRes.status}`);
    const resultHtml = (await pRes.text()).replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ");
    const cleanText = decodeHtmlEntities(resultHtml);

    if (/pan\s*no\.?\s*entered\s*by\s*you\s*is\s*not\s*correct|no\s*record|not\s*found|invalid\s*pan|please\s*check\s*the\s*pan/i.test(cleanText)) {
      return { status: "NO_RECORD", sharesAllotted: 0, resultText: "Bid 1: NO RECORD FOUND" };
    }
    const allottedMatch = cleanText.match(/(?:Shares\s*Allotted|Allotted\s*Shares|No\.?\s*of\s*Shares\s*Allotted|Alloted)\D{0,30}(\d[\d,]*)/i);
    if (allottedMatch) {
      const shares = parseInt(allottedMatch[1].replace(/,/g, ""), 10) || 0;
      const appliedMatch = cleanText.match(/(?:Shares\s*Applied|Applied\s*Shares)\D{0,30}(\d[\d,]*)/i);
      const applied = appliedMatch ? parseInt(appliedMatch[1].replace(/,/g, ""), 10) || 0 : 0;
      if (shares > 0) {
        return { status: "ALLOTTED", sharesAllotted: shares, sharesApplied: applied, resultText: `Bid 1: ${shares} shares allotted` };
      }
      return {
        status: "NO_SHARES",
        sharesAllotted: 0,
        sharesApplied: applied,
        resultText: applied > 0 ? `Applied (${applied}) — No shares allotted` : "Bid 1: No shares allotted"
      };
    }
    return { status: "PORTAL_CHECK_REQUIRED", sharesAllotted: 0, resultText: "Check directly on MAS Services portal" };
  }

  throw new Error(`Unsupported automated registrar: ${regId}`);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (request.method === "OPTIONS") {
      if (origin && !isAllowedOrigin(origin)) {
        return new Response("Forbidden", { status: 403 });
      }
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    const token = (env.GITHUB_PAT || "").trim();

    // 1. Health & configuration check (no secrets returned)
    if (request.method === "GET" && (path === "/health" || path === "/")) {
      const auth = authorizeRequest(request, env, origin, { checkPin: false });
      if (!auth.ok) return jsonResponse({ ok: false, error: auth.error }, auth.status, origin);
      return jsonResponse({
        ok: true,
        hasToken: Boolean(token),
        requiresPin: Boolean((env.ADMIN_KEY || "").trim()),
        allotmentProxy: true,
        kfinAuto: true,
        purvaAuto: true,
        maashitlaV2: true,
        abhipraAuto: true,
        accurateAuto: true,
        masAuto: true,
        repo: OWNER_REPO
      }, 200, origin);
    }

    // 2. Get active company list from a specific registrar (public origin-locked)
    if (request.method === "GET" && path === "/allotment-companies") {
      const auth = authorizeRequest(request, env, origin, { checkPin: false });
      if (!auth.ok) return jsonResponse({ ok: false, error: auth.error }, auth.status, origin);

      const regParam = url.searchParams.get("registrar") || "";
      const regUrlParam = url.searchParams.get("url") || "";
      const regId = normalizeRegistrarId(regParam, regUrlParam);

      if (CAPTCHA_GATED_REGISTRARS.has(regId) || regId === "UNKNOWN") {
        return jsonResponse({
          ok: true,
          registrarId: regId,
          autoSupported: false,
          captchaRequired: CAPTCHA_GATED_REGISTRARS.has(regId),
          companies: []
        }, 200, origin);
      }

      try {
        const companies = await fetchRegistrarCompanies(regId);
        return jsonResponse({
          ok: true,
          registrarId: regId,
          autoSupported: true,
          captchaRequired: false,
          companies
        }, 200, origin);
      } catch (err) {
        return jsonResponse({ ok: false, registrarId: regId, error: err.message }, 502, origin);
      }
    }

    // 3. Query Single PAN allotment status on registrar (public origin-locked)
    if (request.method === "POST" && path === "/allotment-check") {
      const auth = authorizeRequest(request, env, origin, { checkPin: false });
      if (!auth.ok) return jsonResponse({ ok: false, error: auth.error }, auth.status, origin);

      let body = {};
      try {
        body = await request.json();
      } catch (_) {
        return jsonResponse({ ok: false, error: "Invalid JSON payload." }, 400, origin);
      }

      const pan = String(body.pan || "").trim().toUpperCase();
      if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) {
        return jsonResponse({ ok: false, error: "Invalid PAN format." }, 400, origin);
      }

      const regId = normalizeRegistrarId(body.registrarId, body.registrarUrl);
      const portalUrl = getRegistrarPortalUrl(regId, body.registrarUrl);

      if (CAPTCHA_GATED_REGISTRARS.has(regId)) {
        return jsonResponse({
          ok: true,
          status: "CAPTCHA_REQUIRED",
          registrarId: regId,
          registrarUrl: portalUrl,
          sharesAllotted: 0,
          resultText: "Captcha required on official registrar portal"
        }, 200, origin);
      }

      if (regId === "UNKNOWN") {
        return jsonResponse({
          ok: true,
          status: "PORTAL_CHECK_REQUIRED",
          registrarId: regId,
          registrarUrl: portalUrl,
          sharesAllotted: 0,
          resultText: "Check directly on official registrar portal"
        }, 200, origin);
      }

      try {
        let resolvedCompany = null;
        if (body.resolvedCode) {
          resolvedCompany = { code: String(body.resolvedCode), name: body.companyName || "" };
        } else {
          const companies = await fetchRegistrarCompanies(regId);
          resolvedCompany = matchCompanyFromList(companies, body.companyName, body.companyCode);
          if (!resolvedCompany) {
            return jsonResponse({
              ok: true,
              status: "IPO_ARCHIVED",
              registrarId: regId,
              registrarUrl: portalUrl,
              sharesAllotted: 0,
              activeCompaniesCount: companies.length,
              resultText: "IPO not in registrar's live dropdown (archived or awaiting upload)"
            }, 200, origin);
          }
        }

        const answer = await queryRegistrarSinglePan(regId, resolvedCompany, pan);
        return jsonResponse({
          ok: true,
          registrarId: regId,
          registrarUrl: portalUrl,
          resolvedCode: resolvedCompany.code,
          resolvedName: resolvedCompany.name,
          ...answer
        }, 200, origin);
      } catch (err) {
        return jsonResponse({
          ok: false,
          registrarId: regId,
          error: err.message || "Registrar lookup failed"
        }, 502, origin);
      }
    }

    // 4. Dispatch GitHub Actions sync workflow
    if (request.method === "POST" && path === "/dispatch") {
      const auth = authorizeRequest(request, env, origin, { checkPin: true });
      if (!auth.ok) return jsonResponse({ ok: false, error: auth.error }, auth.status, origin);

      if (!token) {
        return jsonResponse({
          ok: false,
          status: 500,
          error: "Cloudflare Worker માં GITHUB_PAT Secret સેટ કરેલું નથી."
        }, 500, origin);
      }

      let body = {};
      try {
        body = await request.json();
      } catch (_) {}

      const cleanId = String(body.targetIpoId || "").trim().toUpperCase();
      const inputs = {
        sync_mode: cleanId ? "single" : String(body.syncMode || "all")
      };
      if (cleanId) {
        inputs.target_ipo_id = cleanId;
      }

      const dispatchStartedAt = Date.now() - 8000;
      const ghRes = await fetch(
        `https://api.github.com/repos/${OWNER_REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
        {
          method: "POST",
          headers: githubHeaders(token),
          body: JSON.stringify({ ref: "main", inputs })
        }
      );

      if (ghRes.status === 204 || ghRes.ok) {
        return jsonResponse({ ok: true, status: ghRes.status, dispatchStartedAt }, 200, origin);
      }

      let errMsg = `GitHub HTTP ${ghRes.status}`;
      try {
        const errJson = await ghRes.json();
        if (errJson && errJson.message) errMsg = `${errJson.message} (HTTP ${ghRes.status})`;
      } catch (_) {}

      if (ghRes.status === 401 || ghRes.status === 403) {
        errMsg = `Cloudflare માં સેવ કરેલ GITHUB_PAT અમાન્ય છે અથવા 'workflow' પરમિશન ખૂટે છે (${errMsg}).`;
      }

      return jsonResponse({ ok: false, status: ghRes.status, error: errMsg }, ghRes.status, origin);
    }

    // 5. Poll latest workflow run status
    if (request.method === "GET" && path === "/status") {
      const auth = authorizeRequest(request, env, origin, { checkPin: true });
      if (!auth.ok) return jsonResponse({ ok: false, error: auth.error }, auth.status, origin);

      if (!token) {
        return jsonResponse({ ok: false, status: 500, run: null, error: "Missing GITHUB_PAT secret" }, 500, origin);
      }

      const sinceMs = Number(url.searchParams.get("since") || 0);
      const runIdParam = Number(url.searchParams.get("runId") || 0);

      const ghRes = await fetch(
        `https://api.github.com/repos/${OWNER_REPO}/actions/workflows/${WORKFLOW_FILE}/runs?event=workflow_dispatch&per_page=6`,
        { headers: githubHeaders(token) }
      );

      if (!ghRes.ok) {
        return jsonResponse({ ok: false, status: ghRes.status, run: null }, ghRes.status, origin);
      }

      const data = await ghRes.json();
      const runs = Array.isArray(data.workflow_runs) ? data.workflow_runs : [];
      let matched = null;
      if (runIdParam) {
        matched = runs.find(r => r.id === runIdParam) || null;
      }
      if (!matched && sinceMs) {
        matched = runs.find(r => new Date(r.created_at).getTime() >= sinceMs) || null;
      }

      return jsonResponse({
        ok: true,
        run: matched ? {
          id: matched.id,
          status: matched.status,
          conclusion: matched.conclusion,
          html_url: matched.html_url,
          created_at: matched.created_at,
          updated_at: matched.updated_at
        } : null
      }, 200, origin);
    }

    return jsonResponse({ ok: false, error: "Not found" }, 404, origin);
  }
};
