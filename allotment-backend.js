import axios from "axios";
import * as cheerio from "cheerio";
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { 
    syncAllIposFromChittorgarh, 
    get_Chittorgarh_details_data, 
    get_Chittorgarh_subscription_data 
} from "./sync-cron.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3001;
const ACTIVE_IPOS_FILE = path.join(__dirname, "allotment_active_ipos.json");

const httpHeaders = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9"
};

// 16 Master Registrars Directory
export const REGISTRARS = {
    BIGSHARE: {
        id: "BIGSHARE",
        name: "Bigshare Services Private Limited",
        website: "bigshareonline.com",
        allotmentUrl: "https://ipo.bigshareonline.com/IPO_Status.html",
        apiEndpoint: "https://ipo.bigshareonline.com/Data.aspx/FetchIpodetails"
    },
    SKYLINE: {
        id: "SKYLINE",
        name: "Skyline Financial Services Private Limited",
        website: "skylinerta.com",
        allotmentUrl: "https://www.skylinerta.com/ipo.php"
    },
    LINKINTIME: {
        id: "LINKINTIME",
        name: "Link-Intime India Private Ltd",
        website: "linkintime.co.in",
        allotmentUrl: "https://linkintime.co.in/Initial_Offer/public-issues.html"
    },
    KFIN: {
        id: "KFIN",
        name: "Kfin Technologies Private Limited",
        website: "kfintech.com",
        allotmentUrl: "https://ipostatus.kfintech.com/"
    },
    MAASHITLA: {
        id: "MAASHITLA",
        name: "Maashitla Securities Private Limited",
        website: "maashitla.com",
        allotmentUrl: "https://maashitla.com/allotment-status/public-issues"
    },
    PURVA: {
        id: "PURVA",
        name: "Purva Sharegistry (India) Private Limited",
        website: "purvashare.com",
        allotmentUrl: "https://www.purvashare.com/investor-service/ipo-query"
    },
    CAMEO: {
        id: "CAMEO",
        name: "Cameo Corporate Services Limited",
        website: "cameoindia.com",
        allotmentUrl: "https://ipo.cameoindia.com/"
    },
    ACCURATE: {
        id: "ACCURATE",
        name: "Accurate Securities & Registry Private Limited",
        website: "accuratesecurities.com",
        allotmentUrl: "https://www.accuratesecurities.com/ipo-details.php"
    },
    ABHIPRA: {
        id: "ABHIPRA",
        name: "Abhipra Capital Limited",
        website: "abhipra.com",
        allotmentUrl: "https://www.abhipra.com/ipo-status"
    },
    ALANKIT: {
        id: "ALANKIT",
        name: "Alankit Assignments Ltd",
        website: "alankit.com",
        allotmentUrl: "https://ipo.alankit.com/"
    },
    ANKIT: {
        id: "ANKIT",
        name: "Ankit Consultancy Pvt.Ltd",
        website: "ankitonline.com",
        allotmentUrl: "https://www.ankitonline.com/PublicIssue/FrmPublicIssue.aspx"
    },
    BEETALFC: {
        id: "BEETALFC",
        name: "Beetal Financial & Computer Services (P) Limited",
        website: "beetal.in",
        allotmentUrl: "https://beetal.in/investor-services/#IPO_Allotment_Status"
    },
    BSE: {
        id: "BSE",
        name: "BSE India IPO Status Portal",
        website: "bseindia.com",
        allotmentUrl: "https://www.bseindia.com/investors/appli_check"
    },
    NSE: {
        id: "NSE",
        name: "NSE India IPO Bid Verification",
        website: "nseindia.in",
        allotmentUrl: "https://www.nseindia.in/invest/check-trades-bids-verify-ipo-bids"
    },
    INTEGRATED: {
        id: "INTEGRATED",
        name: "Integrated Registry Management Services (P) Limited",
        website: "integratedregistry.in",
        allotmentUrl: "https://www.integratedregistry.in/IRMS_V2/IPOListing.aspx"
    },
    MAS: {
        id: "MAS",
        name: "Mas Services Limited",
        website: "masserv.com",
        allotmentUrl: "https://www.masserv.com/opt.asp"
    },
    MUDRARTA: {
        id: "MUDRA",
        name: "Mudra RTA Ventures Private Limited",
        website: "mudrarta.com",
        allotmentUrl: "https://mudrarta.com/ipo.php"
    },
    MUFG: {
        id: "MUFG",
        name: "MUFG Intime India Private Limited",
        website: "in.mpms.mufg.com",
        allotmentUrl: "https://in.mpms.mufg.com/Initial_Offer/public-issues.html"
    },
    SATELLITE: {
        id: "SATELLITE",
        name: "Satellite Corporate Services Private Limited",
        website: "satellitecorporate.com",
        allotmentUrl: "https://www.satellitecorporate.com/ipo-query.php"
    }
};

// ==========================================================
// 1. SCRAPE ACTIVE IPOS FROM REGISTRARS
// ==========================================================
export async function scrapeActiveRegistrarIpos() {
    console.log("🔄 Scraping live active IPOs from registrars...");
    const activeIpos = [];

    // A. Scrape Bigshare
    try {
        console.log("Fetching Bigshare active IPOs...");
        const res = await axios.get("https://ipo.bigshareonline.com/IPO_Status.html", {
            headers: httpHeaders,
            timeout: 10000
        });
        const $ = cheerio.load(res.data);
        $("select#ddlCompany option").each((i, el) => {
            const code = $(el).val()?.trim();
            const name = $(el).text()?.trim();
            if (code && !code.includes("--") && name && !name.includes("--Select")) {
                activeIpos.push({
                    id: `BIGSHARE_${code}`,
                    code: code,
                    name: `${name} - IPO`,
                    rawName: name,
                    registrarId: "BIGSHARE",
                    registrarName: "Bigshare Services Private Limited",
                    allotmentUrl: "https://ipo.bigshareonline.com/IPO_Status.html"
                });
            }
        });
        console.log(`✓ Bigshare: Found ${activeIpos.length} active IPOs.`);
    } catch (err) {
        console.warn("⚠️ Bigshare scrape error:", err.message);
    }

    // B. Scrape Skyline
    try {
        console.log("Fetching Skyline active IPOs...");
        const res = await axios.get("https://www.skylinerta.com/ipo.php", {
            headers: httpHeaders,
            timeout: 10000
        });
        const $ = cheerio.load(res.data);
        let skylineCount = 0;
        $('select[name="company"] option').each((i, el) => {
            const code = $(el).val()?.trim();
            const name = $(el).text()?.trim();
            if (code && !code.includes("--") && name && !name.toLowerCase().includes("select")) {
                activeIpos.push({
                    id: `SKYLINE_${code}`,
                    code: code,
                    name: `${name} - IPO`,
                    rawName: name,
                    registrarId: "SKYLINE",
                    registrarName: "Skyline Financial Services Private Limited",
                    allotmentUrl: "https://www.skylinerta.com/ipo.php"
                });
                skylineCount++;
            }
        });
        console.log(`✓ Skyline: Found ${skylineCount} active IPOs.`);
    } catch (err) {
        console.warn("⚠️ Skyline scrape error:", err.message);
    }

    // C. Scrape MUFG Intime (formerly Link Intime)
    try {
        console.log("Fetching MUFG Intime active IPOs...");
        const mufgRes = await axios.post("https://in.mpms.mufg.com/Initial_Offer/IPO.aspx/GetDetails", {}, {
            headers: {
                ...httpHeaders,
                "Content-Type": "application/json; charset=utf-8",
                "Referer": "https://in.mpms.mufg.com/Initial_Offer/public-issues.html"
            },
            timeout: 10000
        });
        const xml = String(mufgRes.data?.d || "");
        const $xml = cheerio.load(xml, { xmlMode: true });
        let mufgCount = 0;
        $xml("Table").each((_, tbl) => {
            const code = $xml(tbl).find("company_id").text().trim();
            const name = $xml(tbl).find("companyname").text().trim();
            if (code && name) {
                activeIpos.push({
                    id: `MUFG_${code}`,
                    code: code,
                    name: name.toLowerCase().includes("ipo") ? name : `${name} - IPO`,
                    rawName: name,
                    registrarId: "MUFG",
                    registrarName: "MUFG Intime India Private Limited",
                    allotmentUrl: "https://in.mpms.mufg.com/Initial_Offer/public-issues.html"
                });
                mufgCount++;
            }
        });
        console.log(`✓ MUFG Intime: Found ${mufgCount} active IPOs.`);
    } catch (err) {
        console.warn("⚠️ MUFG Intime scrape error:", err.message);
    }

    // D. Scrape Maashitla Securities
    try {
        console.log("Fetching Maashitla active IPOs...");
        const mRes = await axios.get("https://api.maashitla.com/api/public-issue/companies", {
            headers: httpHeaders,
            timeout: 8000
        });
        if (Array.isArray(mRes.data)) {
            mRes.data.forEach(item => {
                if (item?.company_name) {
                    activeIpos.push({
                        id: `MAASHITLA_${item.company_id || item.company_name}`,
                        code: item.company_name,
                        name: `${item.company_name} - IPO`,
                        rawName: item.company_name,
                        registrarId: "MAASHITLA",
                        registrarName: "Maashitla Securities Private Limited",
                        allotmentUrl: "https://maashitla.com/allotment-status/public-issues"
                    });
                }
            });
            console.log(`✓ Maashitla: Found ${mRes.data.length} active IPOs.`);
        }
    } catch (err) {
        console.warn("⚠️ Maashitla scrape error:", err.message);
    }

    // Save to JSON file
    fs.writeFileSync(ACTIVE_IPOS_FILE, JSON.stringify(activeIpos, null, 2), "utf8");
    console.log(`✓ Total ${activeIpos.length} active registrar IPOs saved to ${ACTIVE_IPOS_FILE}\n`);
    return activeIpos;
}

const CAPTCHA_GATED_REGS = new Set([
    "CAMEO", "INTEGRATED", "BEETALFC", "ALANKIT", "ANKIT", "MUDRA", "NSE", "BSE"
]);

function normalizeLocalRegId(registrarId, registrarUrl) {
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

function normCompanyStr(name) {
    return String(name || "")
        .toLowerCase()
        .replace(/&/g, " and ")
        .replace(/\./g, " ")
        .replace(/\b(ipo\s*details|ipo|fpo|limited|ltd|private|pvt|india|the|server\s*\d+)\b/gi, " ")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function matchCompanyObj(list, targetName, explicitCode) {
    if (!Array.isArray(list) || list.length === 0) return null;
    if (explicitCode) {
        const hit = list.find(c => String(c.code).trim() === String(explicitCode).trim());
        if (hit) return hit;
    }
    const normT = normCompanyStr(targetName);
    if (!normT) return null;
    for (const c of list) {
        if (normCompanyStr(c.name) === normT) return c;
    }
    const compactT = normT.replace(/\s+/g, "");
    for (const c of list) {
        if (normCompanyStr(c.name).replace(/\s+/g, "") === compactT) return c;
    }
    if (compactT.length >= 5) {
        for (const c of list) {
            const cc = normCompanyStr(c.name).replace(/\s+/g, "");
            if (cc.length >= 5 && (cc.includes(compactT) || compactT.includes(cc))) return c;
        }
    }
    const tTokens = normT.split(" ").filter(t => t.length > 1);
    if (tTokens.length > 0) {
        let best = null, bestScore = 0;
        for (const c of list) {
            const cTokens = normCompanyStr(c.name).split(" ").filter(t => t.length > 1);
            if (!cTokens.length) continue;
            const common = tTokens.filter(t => cTokens.includes(t)).length;
            const score = common / Math.max(tTokens.length, cTokens.length);
            if (score > bestScore) { bestScore = score; best = c; }
        }
        if (best && bestScore >= 0.65) return best;
    }
    return null;
}

export async function fetchCompaniesForRegistrar(regId) {
    if (regId === "BIGSHARE") {
        const res = await axios.get("https://ipo.bigshareonline.com/IPO_Status.html", { headers: httpHeaders, timeout: 10000 });
        const $ = cheerio.load(res.data);
        const list = [];
        $("select#ddlCompany option").each((_, el) => {
            const code = $(el).val()?.trim();
            const name = $(el).text()?.trim();
            if (code && !code.includes("--") && code !== "0" && name && !/--?\s*select/i.test(name)) {
                list.push({ code, name });
            }
        });
        return list;
    }
    if (regId === "KFIN") {
        const indexRes = await axios.get("https://ipostatus.kfintech.com/", { headers: httpHeaders, timeout: 10000 });
        const jsMatch = String(indexRes.data).match(/static\/js\/(main\.[a-z0-9]+\.js)/i);
        if (!jsMatch) return [];
        const jsRes = await axios.get(`https://ipostatus.kfintech.com/static/js/${jsMatch[1]}`, {
            headers: { ...httpHeaders, "Accept": "*/*", "Referer": "https://ipostatus.kfintech.com/" },
            timeout: 10000
        });
        const listMatch = String(jsRes.data).match(/JSON\.parse\('(\[\{"clientId"[\s\S]*?\])'\)/);
        if (!listMatch) return [];
        const arr = JSON.parse(listMatch[1]);
        return Array.isArray(arr) ? arr.map(x => ({ code: String(x.clientId), name: String(x.name || "") })) : [];
    }
    if (regId === "MUFG") {
        const res = await axios.post("https://in.mpms.mufg.com/Initial_Offer/IPO.aspx/GetDetails", {}, {
            headers: { ...httpHeaders, "Content-Type": "application/json; charset=utf-8", "Referer": "https://in.mpms.mufg.com/Initial_Offer/public-issues.html" },
            timeout: 10000
        });
        const $xml = cheerio.load(String(res.data?.d || ""), { xmlMode: true });
        const list = [];
        $xml("Table").each((_, tbl) => {
            const code = $xml(tbl).find("company_id").text().trim();
            const name = $xml(tbl).find("companyname").text().trim();
            if (code && name) list.push({ code, name });
        });
        return list;
    }
    if (regId === "MAASHITLA") {
        const merged = [];
        const seen = new Set();
        try {
            const dirRes = await axios.get("https://api.maashitla.com/api/company-directory", { headers: httpHeaders, timeout: 8000 });
            const dirList = Array.isArray(dirRes.data?.companies) ? dirRes.data.companies : [];
            dirList.forEach(x => {
                if (x?.company_slug && x?.company_name) {
                    const k = normCompanyStr(x.company_name);
                    seen.add(k);
                    merged.push({ code: String(x.company_slug), name: String(x.company_name), source: "directory" });
                }
            });
        } catch (_) {}
        try {
            const legRes = await axios.get("https://api.maashitla.com/api/public-issue/companies", { headers: httpHeaders, timeout: 8000 });
            if (Array.isArray(legRes.data)) {
                legRes.data.forEach(x => {
                    if (x?.company_name) {
                        const k = normCompanyStr(x.company_name);
                        if (!seen.has(k)) {
                            seen.add(k);
                            merged.push({ code: String(x.company_name), companyId: x.company_id, name: String(x.company_name), source: "legacy" });
                        }
                    }
                });
            }
        } catch (_) {}
        return merged;
    }
    if (regId === "SKYLINE") {
        const res = await axios.get("https://www.skylinerta.com/ipo.php", { headers: httpHeaders, timeout: 10000 });
        const $ = cheerio.load(res.data);
        const list = [];
        $('select[name="company"] option').each((_, el) => {
            const code = $(el).val()?.trim();
            const name = $(el).text()?.trim();
            if (code && !code.includes("--") && code !== "0" && name && !/select/i.test(name)) {
                list.push({ code, name });
            }
        });
        return list;
    }
    if (regId === "SATELLITE") {
        const res = await axios.get("https://www.satellitecorporate.com/ipo-query.php", { headers: httpHeaders, timeout: 10000 });
        const $ = cheerio.load(res.data);
        const list = [];
        $('select[name="company"] option').each((_, el) => {
            const code = $(el).val()?.trim();
            const name = $(el).text()?.trim();
            if (code && name && !/select/i.test(name)) list.push({ code, name });
        });
        return list;
    }
    if (regId === "PURVA") {
        const res = await axios.get("https://www.purvashare.com/investor-service/ipo-query", { headers: httpHeaders, timeout: 10000 });
        const $ = cheerio.load(res.data);
        const list = [];
        $('select[name="company_id"] option').each((_, el) => {
            const code = $(el).val()?.trim();
            const name = $(el).text()?.trim();
            if (code && name && !/choose|select/i.test(name)) list.push({ code, name });
        });
        return list;
    }
    if (regId === "ABHIPRA") {
        try {
            const apiRes = await axios.get("https://www.abhipra.com/ipo-status-api", {
                headers: { ...httpHeaders, "Referer": "https://www.abhipra.com/ipo-status" },
                timeout: 10000
            });
            if (apiRes.data?.success && Array.isArray(apiRes.data.companies)) {
                return apiRes.data.companies
                    .filter(c => c?.allotmentFileName && c?.issuerCompanyName)
                    .map(c => ({ code: String(c.allotmentFileName), name: String(c.issuerCompanyName) }));
            }
        } catch (_) {}
        const res = await axios.get("https://www.abhipra.com/ipo-status", { headers: httpHeaders, timeout: 10000 });
        const $ = cheerio.load(res.data);
        const list = [];
        $("select#company-select option").each((_, el) => {
            const code = $(el).val()?.trim();
            const name = $(el).text()?.trim();
            if (code && name && !/select/i.test(name)) list.push({ code, name });
        });
        return list;
    }
    if (regId === "ACCURATE") {
        const res = await axios.get("https://www.accuratesecurities.com/ipo-details.php", { headers: httpHeaders, timeout: 10000 });
        const $ = cheerio.load(res.data);
        const list = [];
        $('select[name="company"] option').each((_, el) => {
            const code = $(el).val()?.trim();
            const name = $(el).text()?.trim();
            if (code && name && !/select/i.test(name)) list.push({ code, name });
        });
        return list;
    }
    if (regId === "MAS") {
        const res = await axios.get("https://www.masserv.com/opt.asp", { headers: httpHeaders, timeout: 10000 });
        const html = String(res.data || "").replace(/<!--[\s\S]*?-->/g, " ");
        const list = [];
        const seen = new Set();
        const blockRegex = /IPO\s*[-–:]\s*([^\r\n<]+?)\s*ALLOTMENT\s*STATUS[\s\S]{0,1200}?href\s*=\s*["']?([^"'\s>]*asearch[^"'\s>]*\.asp)["']?/gi;
        let m;
        while ((m = blockRegex.exec(html)) !== null) {
            const name = cheerio.load(m[1]).text().replace(/\s+/g, " ").trim();
            const searchPage = m[2].replace(/^\/+/, "");
            const key = `${searchPage}::${normCompanyStr(name)}`;
            if (name && searchPage && !seen.has(key)) {
                seen.add(key);
                list.push({ code: searchPage, name });
            }
        }
        return list;
    }
    return [];
}

function summarizeLocalBids(regId, resolvedCode, resolvedName, rows, mapRow) {
    let totalAllotted = 0, totalApplied = 0, holderName = "";
    const bidParts = [];
    rows.forEach((rec, idx) => {
        const mapped = mapRow(rec);
        const allot = parseInt(String(mapped.allotted ?? "0").replace(/,/g, ""), 10) || 0;
        const app = parseInt(String(mapped.applied ?? "0").replace(/,/g, ""), 10) || 0;
        if (!holderName && mapped.name) holderName = String(mapped.name).trim();
        totalAllotted += allot;
        totalApplied += app;
        if (rows.length > 1) bidParts.push(allot > 0 ? `Bid ${idx + 1}: ${allot} shares allotted` : `Bid ${idx + 1}: No shares`);
    });
    if (totalAllotted > 0) {
        return { status: "ALLOTTED", registrarId: regId, resolvedCode, resolvedName, sharesAllotted: totalAllotted, sharesApplied: totalApplied, holderName, resultText: rows.length > 1 ? bidParts.join(" | ") : `Bid 1: ${totalAllotted} shares allotted`, isWinner: true };
    }
    return { status: "NO_SHARES", registrarId: regId, resolvedCode, resolvedName, sharesAllotted: 0, sharesApplied: totalApplied, holderName, resultText: totalApplied > 0 ? `Applied (${totalApplied}) — No shares allotted` : "Bid 1: No shares allotted", isWinner: false };
}

// ==========================================================
// 2. CHECK ALLOTMENT STATUS FOR A SINGLE PAN ON REGISTRAR
// ==========================================================
export async function checkSinglePanOnRegistrar(registrarId, companyCode, pan, options = {}) {
    const cleanPan = (pan || "").trim().toUpperCase();
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(cleanPan)) {
        return {
            status: "INVALID_PAN",
            resultText: "Invalid PAN Number",
            sharesAllotted: 0
        };
    }

    const regId = normalizeLocalRegId(registrarId, options.registrarUrl);
    if (CAPTCHA_GATED_REGS.has(regId)) {
        return {
            status: "CAPTCHA_REQUIRED",
            registrarId: regId,
            sharesAllotted: 0,
            resultText: "Captcha required on official registrar portal",
            isWinner: false
        };
    }
    if (regId === "UNKNOWN") {
        return {
            status: "PORTAL_CHECK_REQUIRED",
            registrarId: regId,
            sharesAllotted: 0,
            resultText: "Check directly on official registrar portal",
            isWinner: false
        };
    }

    let resolvedCode = options.resolvedCode || "";
    let resolvedName = options.companyName || "";
    if (!resolvedCode) {
        try {
            const activeList = await fetchCompaniesForRegistrar(regId);
            const matched = matchCompanyObj(activeList, options.companyName || companyCode, companyCode);
            if (!matched) {
                return {
                    status: "IPO_ARCHIVED",
                    registrarId: regId,
                    sharesAllotted: 0,
                    resultText: "IPO not in registrar's live dropdown (archived or awaiting upload)",
                    isWinner: false
                };
            }
            resolvedCode = matched.code;
            resolvedName = matched.name;
        } catch (err) {
            console.warn(`Company list resolve error for ${regId}:`, err.message);
            if (!companyCode) throw err;
            resolvedCode = companyCode;
        }
    }

    // ------------------------------------------------------
    // A. BIGSHARE SERVICES REAL API
    // ------------------------------------------------------
    if (regId === "BIGSHARE") {
        const res = await axios.post("https://ipo.bigshareonline.com/Data.aspx/FetchIpodetails", {
            Applicationno: "",
            Company: String(resolvedCode),
            SelectionType: "PN",
            PanNo: cleanPan,
            txtcsdl: "",
            txtDPID: "",
            txtClId: "",
            ddlType: "1",
            lang: "en"
        }, {
            headers: {
                ...httpHeaders,
                "Content-Type": "application/json; charset=utf-8",
                "Referer": "https://ipo.bigshareonline.com/IPO_Status.html",
                "X-Requested-With": "XMLHttpRequest"
            },
            timeout: 8000
        });

        const d = res.data?.d;
        if (d) {
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
                        registrarId: regId,
                        resolvedCode,
                        resolvedName,
                        sharesAllotted: totalAllotted,
                        sharesApplied: totalApplied,
                        holderName: d.Name || "",
                        resultText: records.length > 1 ? bidParts.join(" | ") : `Bid 1: ${totalAllotted} shares allotted`,
                        isWinner: true
                    };
                }
                return {
                    status: "NO_SHARES",
                    registrarId: regId,
                    resolvedCode,
                    resolvedName,
                    sharesAllotted: 0,
                    sharesApplied: totalApplied,
                    holderName: d.Name || "",
                    resultText: totalApplied > 0 ? `Applied (${totalApplied}) — No shares allotted` : "Bid 1: No shares allotted",
                    isWinner: false
                };
            }
            return {
                status: "NO_RECORD",
                registrarId: regId,
                resolvedCode,
                resolvedName,
                sharesAllotted: 0,
                resultText: "Bid 1: NO RECORD FOUND",
                isWinner: false
            };
        }
    }

    // ------------------------------------------------------
    // B. MUFG INTIME (Link Intime) REAL API
    // ------------------------------------------------------
    if (regId === "MUFG") {
        const res = await axios.post("https://in.mpms.mufg.com/Initial_Offer/IPO.aspx/SearchOnPan", {
            clientid: String(resolvedCode),
            PAN: cleanPan,
            IFSC: "",
            CHKVAL: "1",
            token: ""
        }, {
            headers: {
                ...httpHeaders,
                "Content-Type": "application/json; charset=utf-8",
                "Referer": "https://in.mpms.mufg.com/Initial_Offer/public-issues.html",
                "X-Requested-With": "XMLHttpRequest"
            },
            timeout: 8000
        });

        const $xml = cheerio.load(String(res.data?.d || ""), { xmlMode: true });
        const tables = $xml("Table");
        if (tables.length === 0) {
            return {
                status: "NO_RECORD",
                registrarId: regId,
                resolvedCode,
                resolvedName,
                sharesAllotted: 0,
                resultText: "Bid 1: NO RECORD FOUND",
                isWinner: false
            };
        }

        let totalAllotted = 0;
        let totalApplied = 0;
        let holderName = "";
        const bidParts = [];

        tables.each((idx, tbl) => {
            const allot = parseInt($xml(tbl).find("ALLOT").text().replace(/,/g, ""), 10) || 0;
            const shares = parseInt($xml(tbl).find("SHARES").text().replace(/,/g, ""), 10) || 0;
            const n = $xml(tbl).find("NAME1").text().trim();
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
                registrarId: regId,
                resolvedCode,
                resolvedName,
                sharesAllotted: totalAllotted,
                sharesApplied: totalApplied,
                holderName,
                resultText: tables.length > 1 ? bidParts.join(" | ") : `Bid 1: ${totalAllotted} shares allotted`,
                isWinner: true
            };
        }

        return {
            status: "NO_SHARES",
            registrarId: regId,
            resolvedCode,
            resolvedName,
            sharesAllotted: 0,
            sharesApplied: totalApplied,
            holderName,
            resultText: totalApplied > 0 ? `Applied (${totalApplied}) — No shares allotted` : "Bid 1: No shares allotted",
            isWinner: false
        };
    }

    // ------------------------------------------------------
    // C. MAASHITLA SECURITIES REAL API
    // ------------------------------------------------------
    if (regId === "MAASHITLA") {
        const codeStr = String(resolvedCode || "");
        const isSlug = !/\s/.test(codeStr) && /^[a-z0-9\-]+$/.test(codeStr);
        if (isSlug) {
            const res = await axios.get(`https://pnjbvxj6md.execute-api.ap-south-1.amazonaws.com/prod/check/${encodeURIComponent(codeStr)}?pan=${encodeURIComponent(cleanPan)}`, {
                headers: { ...httpHeaders, "Origin": "https://maashitla.com", "Referer": "https://maashitla.com/" },
                timeout: 8000,
                validateStatus: () => true
            });
            if (res.status === 404 || !res.data || res.data.name == null) {
                return { status: "NO_RECORD", registrarId: regId, resolvedCode, resolvedName, sharesAllotted: 0, resultText: "Bid 1: NO RECORD FOUND", isWinner: false };
            }
            const allotted = parseInt(String(res.data.shares_allotted ?? "0").replace(/,/g, ""), 10) || 0;
            const applied = parseInt(String(res.data.shares_applied ?? "0").replace(/,/g, ""), 10) || 0;
            if (allotted > 0) {
                return { status: "ALLOTTED", registrarId: regId, resolvedCode, resolvedName, sharesAllotted: allotted, sharesApplied: applied, holderName: res.data.name || "", resultText: `Bid 1: ${allotted} shares allotted`, isWinner: true };
            }
            return { status: "NO_SHARES", registrarId: regId, resolvedCode, resolvedName, sharesAllotted: 0, sharesApplied: applied, holderName: res.data.name || "", resultText: applied > 0 ? `Applied (${applied}) — No shares allotted` : "Bid 1: No shares allotted", isWinner: false };
        }

        const res = await axios.get(`https://api.maashitla.com/api/public-issue/search?company_name=${encodeURIComponent(codeStr)}&pan=${encodeURIComponent(cleanPan)}`, {
            headers: httpHeaders,
            timeout: 8000,
            validateStatus: () => true
        });
        if (res.status === 404) {
            return { status: "NO_RECORD", registrarId: regId, resolvedCode, resolvedName, sharesAllotted: 0, resultText: "Bid 1: NO RECORD FOUND", isWinner: false };
        }
        if (res.status === 200 && res.data) {
            const allotted = parseInt(String(res.data.shares_allotted ?? "0").replace(/,/g, ""), 10) || 0;
            const applied = parseInt(String(res.data.shares_applied ?? "0").replace(/,/g, ""), 10) || 0;
            if (allotted > 0) {
                return { status: "ALLOTTED", registrarId: regId, resolvedCode, resolvedName, sharesAllotted: allotted, sharesApplied: applied, holderName: res.data.name || "", resultText: `Bid 1: ${allotted} shares allotted`, isWinner: true };
            }
            return { status: "NO_SHARES", registrarId: regId, resolvedCode, resolvedName, sharesAllotted: 0, sharesApplied: applied, holderName: res.data.name || "", resultText: applied > 0 ? `Applied (${applied}) — No shares allotted` : "Bid 1: No shares allotted", isWinner: false };
        }
    }

    // ------------------------------------------------------
    // D. SKYLINE REAL SCRAPER (2-Step CSRF)
    // ------------------------------------------------------
    if (regId === "SKYLINE") {
        const s1 = await axios.post("https://www.skylinerta.com/display_application.php", `company=${encodeURIComponent(resolvedCode)}`, {
            headers: { ...httpHeaders, "Content-Type": "application/x-www-form-urlencoded", "Referer": "https://www.skylinerta.com/ipo.php" },
            timeout: 8000
        });
        const cookies = (s1.headers["set-cookie"] || []).map(c => c.split(";")[0]).join("; ");
        const $1 = cheerio.load(s1.data);
        const csrf = $1('input[name="csrf_token"]').val() || "";

        const s2 = await axios.post("https://www.skylinerta.com/display_application.php",
            `csrf_token=${encodeURIComponent(csrf)}&company=${encodeURIComponent(resolvedCode)}&action=search&client_id=&application_no=&pan=${encodeURIComponent(cleanPan)}`, {
            headers: { ...httpHeaders, "Content-Type": "application/x-www-form-urlencoded", "Referer": "https://www.skylinerta.com/display_application.php", ...(cookies ? { "Cookie": cookies } : {}) },
            timeout: 8000
        });
        const $2 = cheerio.load(s2.data);
        const bodyText = $2("body").text().replace(/\s+/g, " ");
        if (/no record found|could not find any application|not found/i.test(bodyText)) {
            return { status: "NO_RECORD", registrarId: regId, resolvedCode, resolvedName, sharesAllotted: 0, resultText: "Bid 1: NO RECORD FOUND", isWinner: false };
        }
        const allottedMatch = bodyText.match(/(?:Shares\s*Allotted|Allotted\s*Shares|Allotted)\s*[:\-]?\s*(\d[\d,]*)/i);
        if (allottedMatch) {
            const shares = parseInt(allottedMatch[1].replace(/,/g, ""), 10) || 0;
            if (shares > 0) {
                return { status: "ALLOTTED", registrarId: regId, resolvedCode, resolvedName, sharesAllotted: shares, resultText: `Bid 1: ${shares} shares allotted`, isWinner: true };
            }
            return { status: "NO_SHARES", registrarId: regId, resolvedCode, resolvedName, sharesAllotted: 0, resultText: "Bid 1: No shares allotted", isWinner: false };
        }
        return { status: "PORTAL_CHECK_REQUIRED", registrarId: regId, resolvedCode, resolvedName, sharesAllotted: 0, resultText: "Check directly on Skyline portal", isWinner: false };
    }

    // ------------------------------------------------------
    // E. SATELLITE REAL SCRAPER
    // ------------------------------------------------------
    if (regId === "SATELLITE") {
        const res = await axios.get(`https://www.satellitecorporate.com/mainAjax.php?action=search_applicant&data_search=pan_no&company=${encodeURIComponent(resolvedCode)}&search_no=${encodeURIComponent(cleanPan)}`, {
            headers: { ...httpHeaders, "Referer": "https://www.satellitecorporate.com/ipo-query.php", "X-Requested-With": "XMLHttpRequest" },
            timeout: 8000
        });
        if (res.data && typeof res.data === "object" && res.data.status === "success") {
            const details = res.data.applicantDetails;
            if (!details || (Array.isArray(details) && details.length === 0)) {
                return { status: "NO_RECORD", registrarId: regId, resolvedCode, resolvedName, sharesAllotted: 0, resultText: "Bid 1: NO RECORD FOUND", isWinner: false };
            }
            const rows = Array.isArray(details) ? details : [details];
            return summarizeLocalBids(regId, resolvedCode, resolvedName, rows, d => ({
                allotted: d?.shared_allotted ?? d?.shares_allotted ?? d?.allotted_shares ?? d?.allotted ?? 0,
                applied: d?.shares_applied ?? d?.applied_shares ?? 0,
                name: d?.applicant_name ?? d?.name ?? ""
            }));
        }
        const flatText = typeof res.data === "string" ? res.data : JSON.stringify(res.data);
        if (/no record|not found|invalid/i.test(flatText) && !/(?:shared_allotted|allotted)\D{0,15}[1-9]/i.test(flatText)) {
            return { status: "NO_RECORD", registrarId: regId, resolvedCode, resolvedName, sharesAllotted: 0, resultText: "Bid 1: NO RECORD FOUND", isWinner: false };
        }
        const sharesMatch = flatText.match(/(?:shared_allotted|shares_allotted|allotted|allot_shares|alloted)\D{0,15}(\d[\d,]*)/i);
        if (sharesMatch) {
            const shares = parseInt(sharesMatch[1].replace(/,/g, ""), 10) || 0;
            if (shares > 0) return { status: "ALLOTTED", registrarId: regId, resolvedCode, resolvedName, sharesAllotted: shares, resultText: `Bid 1: ${shares} shares allotted`, isWinner: true };
            return { status: "NO_SHARES", registrarId: regId, resolvedCode, resolvedName, sharesAllotted: 0, resultText: "Bid 1: No shares allotted", isWinner: false };
        }
    }

    // ------------------------------------------------------
    // F. KFINTECH OFFICIAL AWS QUERY API
    // ------------------------------------------------------
    if (regId === "KFIN") {
        const res = await axios.get("https://0uz601ms56.execute-api.ap-south-1.amazonaws.com/prod/api/query?type=pan", {
            headers: {
                ...httpHeaders,
                "Origin": "https://ipostatus.kfintech.com",
                "Referer": "https://ipostatus.kfintech.com/",
                "reqparam": cleanPan,
                "client_id": String(resolvedCode)
            },
            timeout: 8000,
            validateStatus: () => true
        });
        if (res.status === 404) {
            return { status: "NO_RECORD", registrarId: regId, resolvedCode, resolvedName, sharesAllotted: 0, resultText: "Bid 1: NO RECORD FOUND", isWinner: false };
        }
        if (res.status === 200 && Array.isArray(res.data?.data)) {
            const rows = res.data.data;
            if (rows.length === 0) {
                return { status: "NO_RECORD", registrarId: regId, resolvedCode, resolvedName, sharesAllotted: 0, resultText: "Bid 1: NO RECORD FOUND", isWinner: false };
            }
            let totalAllotted = 0, totalApplied = 0, holderName = "";
            const bidParts = [];
            rows.forEach((rec, idx) => {
                const allot = parseInt(String(rec.All_Shares || "0").replace(/,/g, ""), 10) || 0;
                const app = parseInt(String(rec.App_Shares || "0").replace(/,/g, ""), 10) || 0;
                if (!holderName && rec.Name) holderName = String(rec.Name).trim();
                totalAllotted += allot;
                totalApplied += app;
                if (rows.length > 1) bidParts.push(allot > 0 ? `Bid ${idx + 1}: ${allot} shares allotted` : `Bid ${idx + 1}: No shares`);
            });
            if (totalAllotted > 0) {
                return { status: "ALLOTTED", registrarId: regId, resolvedCode, resolvedName, sharesAllotted: totalAllotted, sharesApplied: totalApplied, holderName, resultText: rows.length > 1 ? bidParts.join(" | ") : `Bid 1: ${totalAllotted} shares allotted`, isWinner: true };
            }
            return { status: "NO_SHARES", registrarId: regId, resolvedCode, resolvedName, sharesAllotted: 0, sharesApplied: totalApplied, holderName, resultText: totalApplied > 0 ? `Applied (${totalApplied}) — No shares allotted` : "Bid 1: No shares allotted", isWinner: false };
        }
    }

    // ------------------------------------------------------
    // G. PURVA SHAREGISTRY (Django CSRF + PRG Cookie Flow)
    // ------------------------------------------------------
    if (regId === "PURVA") {
        const purvaUrl = "https://www.purvashare.com/investor-service/ipo-query";
        const jar = {};
        const addJar = (hdrs) => {
            (hdrs["set-cookie"] || []).forEach(c => {
                const eq = c.indexOf("="), semi = c.indexOf(";");
                if (eq > 0) {
                    const k = c.slice(0, eq).trim();
                    const v = c.slice(eq + 1, semi > eq ? semi : undefined).trim();
                    if (k && v) jar[k] = v;
                }
            });
        };
        const getJarStr = () => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");

        const gRes = await axios.get(purvaUrl, { headers: httpHeaders, timeout: 10000 });
        addJar(gRes.headers);
        const $g = cheerio.load(gRes.data);
        const csrf = $g('input[name="csrfmiddlewaretoken"]').val() || "";

        const params = new URLSearchParams({
            csrfmiddlewaretoken: csrf,
            company_id: String(resolvedCode),
            applicationNumber: "",
            panNumber: cleanPan
        });

        const pRes = await axios.post(purvaUrl, params.toString(), {
            headers: {
                ...httpHeaders,
                "Content-Type": "application/x-www-form-urlencoded",
                "Origin": "https://www.purvashare.com",
                "Referer": purvaUrl,
                ...(getJarStr() ? { "Cookie": getJarStr() } : {})
            },
            timeout: 10000,
            maxRedirects: 0,
            validateStatus: () => true
        });
        addJar(pRes.headers);

        let resultHtml = "";
        if (pRes.status >= 300 && pRes.status < 400) {
            const loc = pRes.headers.location || purvaUrl;
            const nextUrl = loc.startsWith("http") ? loc : `https://www.purvashare.com${loc.startsWith("/") ? "" : "/"}${loc}`;
            const rRes = await axios.get(nextUrl, {
                headers: { ...httpHeaders, "Referer": purvaUrl, ...(getJarStr() ? { "Cookie": getJarStr() } : {}) },
                timeout: 10000
            });
            resultHtml = rRes.data;
        } else {
            resultHtml = String(pRes.data || "");
        }

        const $r = cheerio.load(resultHtml);
        $r("style, script, form").remove();
        const notifText = $r(".notification-message").text().replace(/\s+/g, " ").trim();
        const mainText = $r("main").text().replace(/\s+/g, " ").trim();
        const combinedText = `${notifText} ${mainText}`.trim();

        if (/no record found|record not found|please re-check/i.test(combinedText)) {
            return { status: "NO_RECORD", registrarId: regId, resolvedCode, resolvedName, sharesAllotted: 0, resultText: "Bid 1: NO RECORD FOUND", isWinner: false };
        }
        if (/no shares? allotted|not allotted/i.test(combinedText)) {
            return { status: "NO_SHARES", registrarId: regId, resolvedCode, resolvedName, sharesAllotted: 0, resultText: "Bid 1: No shares allotted", isWinner: false };
        }
        const allottedMatch = combinedText.match(/(?:Shares\s*Allotted|Allotted\s*Shares|Allotment\s*Status\s*[:\-]?|Allotted)\D{0,25}(\d[\d,]*)/i)
            || combinedText.match(/(\d[\d,]*)\s*shares?\s*allotted/i);
        if (allottedMatch) {
            const shares = parseInt(allottedMatch[1].replace(/,/g, ""), 10) || 0;
            if (shares > 0) return { status: "ALLOTTED", registrarId: regId, resolvedCode, resolvedName, sharesAllotted: shares, resultText: `Bid 1: ${shares} shares allotted`, isWinner: true };
            return { status: "NO_SHARES", registrarId: regId, resolvedCode, resolvedName, sharesAllotted: 0, resultText: "Bid 1: No shares allotted", isWinner: false };
        }
    }

    // ------------------------------------------------------
    // H. ABHIPRA CAPITAL LIMITED (JSON API, No Captcha)
    // ------------------------------------------------------
    if (regId === "ABHIPRA") {
        const res = await axios.post("https://www.abhipra.com/ipo-status-api", {
            allotmentFileName: String(resolvedCode),
            searchType: "pan",
            searchValue: cleanPan
        }, {
            headers: { ...httpHeaders, "Content-Type": "application/json", "Origin": "https://www.abhipra.com", "Referer": "https://www.abhipra.com/ipo-status" },
            timeout: 10000
        });
        if (!res.data?.success) throw new Error(res.data?.error || "Abhipra API error");
        const rows = Array.isArray(res.data.records) ? res.data.records : [];
        if (!res.data.found || rows.length === 0) {
            return { status: "NO_RECORD", registrarId: regId, resolvedCode, resolvedName, sharesAllotted: 0, resultText: "Bid 1: NO RECORD FOUND", isWinner: false };
        }
        return summarizeLocalBids(regId, resolvedCode, resolvedName, rows, rec => ({
            allotted: rec?.sharesAllotted ?? 0,
            applied: rec?.sharesApplied ?? 0,
            name: rec?.applicantName ?? ""
        }));
    }

    // ------------------------------------------------------
    // I. ACCURATE SECURITIES (JSON API, No Captcha)
    // ------------------------------------------------------
    if (regId === "ACCURATE") {
        const res = await axios.post("https://beta.accurateai.in/check-allotment", {
            company: String(resolvedCode || "1"),
            type: "1",
            number: cleanPan
        }, {
            headers: { ...httpHeaders, "Content-Type": "application/json", "Origin": "https://www.accuratesecurities.com", "Referer": "https://www.accuratesecurities.com/ipo-details.php" },
            timeout: 10000
        });
        const rows = Array.isArray(res.data?.message) ? res.data.message : [];
        if (String(res.data?.status) !== "true" || rows.length === 0) {
            return { status: "NO_RECORD", registrarId: regId, resolvedCode, resolvedName, sharesAllotted: 0, resultText: "Bid 1: NO RECORD FOUND", isWinner: false };
        }
        return summarizeLocalBids(regId, resolvedCode, resolvedName, rows, rec => ({
            allotted: rec?.allottedShares ?? 0,
            applied: rec?.appliedShares ?? 0,
            name: rec?.clientName ?? ""
        }));
    }

    // ------------------------------------------------------
    // J. MAS SERVICES LTD (Direct ASP Form, No Captcha)
    // ------------------------------------------------------
    if (regId === "MAS") {
        const rawPage = String(resolvedCode || "asearch.asp").replace(/^\/+/, "");
        const searchPage = /^[\w\-./]+\.asp$/i.test(rawPage) ? rawPage : "asearch.asp";
        const formUrl = `https://www.masserv.com/${searchPage}`;
        const gRes = await axios.get(formUrl, { headers: httpHeaders, timeout: 10000 });
        const cookies = (gRes.headers["set-cookie"] || []).map(c => c.split(";")[0]).join("; ");
        const formHtml = String(gRes.data || "");
        const actMatch = formHtml.match(/<form[^>]*action\s*=\s*["']?([^\s"'>]+\.asp)/i);
        const actionFile = actMatch ? actMatch[1].replace(/^\/+/, "") : (searchPage.includes("ipo_") ? "ipo_search1.asp" : "search1.asp");
        const postUrl = /^[\w\-./]+\.asp$/i.test(actionFile) ? `https://www.masserv.com/${actionFile}` : "https://www.masserv.com/search1.asp";
        const pRes = await axios.post(postUrl, new URLSearchParams({ texthn: cleanPan, DtLogin: "Search" }).toString(), {
            headers: {
                ...httpHeaders,
                "Content-Type": "application/x-www-form-urlencoded",
                "Origin": "https://www.masserv.com",
                "Referer": formUrl,
                ...(cookies ? { "Cookie": cookies } : {})
            },
            timeout: 10000
        });
        const $m = cheerio.load(String(pRes.data || ""));
        $m("script, style").remove();
        const cleanText = $m("body").text().replace(/<!--[\s\S]*?-->/g, " ").replace(/\s+/g, " ").trim();
        if (/pan\s*no\.?\s*entered\s*by\s*you\s*is\s*not\s*correct|no\s*record|not\s*found|invalid\s*pan|please\s*check\s*the\s*pan/i.test(cleanText)) {
            return { status: "NO_RECORD", registrarId: regId, resolvedCode, resolvedName, sharesAllotted: 0, resultText: "Bid 1: NO RECORD FOUND", isWinner: false };
        }
        const allottedMatch = cleanText.match(/(?:Shares\s*Allotted|Allotted\s*Shares|No\.?\s*of\s*Shares\s*Allotted|Alloted)\D{0,30}(\d[\d,]*)/i);
        if (allottedMatch) {
            const shares = parseInt(allottedMatch[1].replace(/,/g, ""), 10) || 0;
            const appliedMatch = cleanText.match(/(?:Shares\s*Applied|Applied\s*Shares)\D{0,30}(\d[\d,]*)/i);
            const applied = appliedMatch ? parseInt(appliedMatch[1].replace(/,/g, ""), 10) || 0 : 0;
            if (shares > 0) return { status: "ALLOTTED", registrarId: regId, resolvedCode, resolvedName, sharesAllotted: shares, sharesApplied: applied, resultText: `Bid 1: ${shares} shares allotted`, isWinner: true };
            return { status: "NO_SHARES", registrarId: regId, resolvedCode, resolvedName, sharesAllotted: 0, sharesApplied: applied, resultText: applied > 0 ? `Applied (${applied}) — No shares allotted` : "Bid 1: No shares allotted", isWinner: false };
        }
    }

    return {
        status: "PORTAL_CHECK_REQUIRED",
        registrarId: regId,
        resolvedCode,
        resolvedName,
        sharesAllotted: 0,
        resultText: "Check directly on official registrar portal",
        isWinner: false
    };
}

// ==========================================================
// 3. CHECK ALL USER ACCOUNTS ON REGISTRAR (ONE AFTER ANOTHER)
// ==========================================================
export async function checkAllAccountsOnRegistrar(registrarId, companyCode, accounts) {
    console.log(`\n🔍 Checking ${accounts.length} accounts on registrar [${registrarId}] for company code: ${companyCode}...`);
    const results = [];

    for (let i = 0; i < accounts.length; i++) {
        const acc = accounts[i];
        console.log(`[${i + 1}/${accounts.length}] Querying registrar for ${acc.name} (${acc.pan})...`);
        
        const answer = await checkSinglePanOnRegistrar(registrarId, companyCode, acc.pan);
        results.push({
            id: acc.id,
            name: acc.name,
            pan: acc.pan,
            ...answer
        });

        // Slight delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 300));
    }

    // Sort: Allotted accounts (isWinner: true) at the VERY TOP!
    results.sort((a, b) => {
        if (a.isWinner && !b.isWinner) return -1;
        if (!a.isWinner && b.isWinner) return 1;
        return 0;
    });

    const totalAllotted = results.filter(r => r.isWinner).length;
    console.log(`✓ Completed check! Found ${totalAllotted} allotted account(s) out of ${accounts.length}.\n`);
    return results;
}

// ==========================================================
// 4. BUILT-IN LOCAL API SERVER (FOR REAL-TIME FRONTEND COMM)
// ==========================================================
export function startServer() {
    const server = http.createServer(async (req, res) => {
        // Enable CORS
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");

        if (req.method === "OPTIONS") {
            res.writeHead(200);
            res.end();
            return;
        }

        const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);

        // Route 1: GET /api/active-ipos
        if (parsedUrl.pathname === "/api/active-ipos") {
            try {
                if (!fs.existsSync(ACTIVE_IPOS_FILE)) {
                    await scrapeActiveRegistrarIpos();
                }
                const data = JSON.parse(fs.readFileSync(ACTIVE_IPOS_FILE, "utf8"));
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ success: true, count: data.length, ipos: data }));
            } catch (err) {
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ success: false, error: err.message }));
            }
            return;
        }

        // Route 2: GET /api/refresh-ipos
        if (parsedUrl.pathname === "/api/refresh-ipos") {
            try {
                const data = await scrapeActiveRegistrarIpos();
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ success: true, count: data.length, ipos: data }));
            } catch (err) {
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ success: false, error: err.message }));
            }
            return;
        }

        // Route 3: POST /api/check-allotment
        if (parsedUrl.pathname === "/api/check-allotment" && req.method === "POST") {
            let body = "";
            req.on("data", chunk => body += chunk);
            req.on("end", async () => {
                try {
                    const { registrarId, companyCode, accounts } = JSON.parse(body);
                    if (!accounts || !Array.isArray(accounts)) {
                        res.writeHead(400, { "Content-Type": "application/json" });
                        res.end(JSON.stringify({ success: false, error: "Accounts array is required" }));
                        return;
                    }

                    const results = await checkAllAccountsOnRegistrar(registrarId, companyCode, accounts);
                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({
                        success: true,
                        registrarId,
                        companyCode,
                        totalChecked: accounts.length,
                        allottedCount: results.filter(r => r.isWinner).length,
                        results
                    }));
                } catch (err) {
                    res.writeHead(500, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ success: false, error: err.message }));
                }
            });
            return;
        }

        // Route 4: GET /api/check-single
        if (parsedUrl.pathname === "/api/check-single") {
            const registrarId = parsedUrl.searchParams.get("registrar");
            const companyCode = parsedUrl.searchParams.get("company");
            const companyName = parsedUrl.searchParams.get("companyName") || "";
            const registrarUrl = parsedUrl.searchParams.get("registrarUrl") || "";
            const resolvedCode = parsedUrl.searchParams.get("resolvedCode") || "";
            const pan = parsedUrl.searchParams.get("pan");

            try {
                const answer = await checkSinglePanOnRegistrar(registrarId, companyCode, pan, {
                    companyName,
                    registrarUrl,
                    resolvedCode
                });
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ ok: true, success: true, ...answer }));
            } catch (err) {
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ ok: false, success: false, error: err.message }));
            }
            return;
        }

        // Route 4B: GET /api/allotment-companies (Cloudflare Worker parity)
        if (parsedUrl.pathname === "/api/allotment-companies") {
            const regParam = parsedUrl.searchParams.get("registrar") || "";
            const urlParam = parsedUrl.searchParams.get("url") || "";
            const regId = normalizeLocalRegId(regParam, urlParam);
            if (CAPTCHA_GATED_REGS.has(regId) || regId === "UNKNOWN") {
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ ok: true, registrarId: regId, autoSupported: false, captchaRequired: CAPTCHA_GATED_REGS.has(regId), companies: [] }));
                return;
            }
            try {
                const companies = await fetchCompaniesForRegistrar(regId);
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ ok: true, registrarId: regId, autoSupported: true, captchaRequired: false, companies }));
            } catch (err) {
                res.writeHead(502, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ ok: false, registrarId: regId, error: err.message }));
            }
            return;
        }

        // Route 4C: POST /api/allotment-check (Cloudflare Worker parity)
        if (parsedUrl.pathname === "/api/allotment-check" && req.method === "POST") {
            let body = "";
            req.on("data", chunk => body += chunk);
            req.on("end", async () => {
                try {
                    const parsed = JSON.parse(body || "{}");
                    const answer = await checkSinglePanOnRegistrar(parsed.registrarId, parsed.companyCode, parsed.pan, {
                        companyName: parsed.companyName,
                        registrarUrl: parsed.registrarUrl,
                        resolvedCode: parsed.resolvedCode
                    });
                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ ok: true, success: true, ...answer }));
                } catch (err) {
                    res.writeHead(500, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ ok: false, success: false, error: err.message }));
                }
            });
            return;
        }

        // Route 5: POST/GET /api/sync-chittorgarh (Instant Manual Auto-Sync)
        if (parsedUrl.pathname === "/api/sync-chittorgarh") {
            try {
                console.log("\n⚡ Instant Auto-Sync triggered via Admin Panel API...");
                await syncAllIposFromChittorgarh();
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ success: true, message: "Sync completed successfully" }));
            } catch (err) {
                console.error("Local sync error:", err.message);
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ success: false, error: err.message }));
            }
            return;
        }

        // Route 6: GET/POST /api/fetch-chittorgarh-details (Fetch Single IPO Details for Instant Auto-Fill)
        if (parsedUrl.pathname === "/api/fetch-chittorgarh-details") {
            try {
                let targetUrl = parsedUrl.searchParams.get("url") || parsedUrl.searchParams.get("key");
                
                if (!targetUrl && req.method === "POST") {
                    let body = "";
                    req.on("data", chunk => body += chunk);
                    await new Promise(r => req.on("end", r));
                    try {
                        const parsedBody = JSON.parse(body);
                        targetUrl = parsedBody.url || parsedBody.key;
                    } catch (e) {}
                }

                if (!targetUrl) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ success: false, error: "URL or key parameter is required" }));
                    return;
                }

                console.log(`\n⚡ Fetching Chittorgarh details for: ${targetUrl}...`);
                const [details, subscription] = await Promise.all([
                    get_Chittorgarh_details_data(targetUrl),
                    get_Chittorgarh_subscription_data(targetUrl)
                ]);

                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({
                    success: true,
                    targetUrl,
                    details: details || null,
                    subscription: subscription || null
                }));
            } catch (err) {
                console.error("Fetch Chittorgarh details error:", err.message);
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ success: false, error: err.message }));
            }
            return;
        }

        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Endpoint not found" }));
    });

    server.listen(PORT, () => {
        console.log(`\n🚀 Allotment Backend API Server running at http://localhost:${PORT}`);
        console.log(`   - GET  /api/active-ipos`);
        console.log(`   - POST /api/check-allotment`);
        console.log(`   - GET  /api/check-single?registrar=BIGSHARE&company=605&pan=...\n`);
    });

    return server;
}

// CLI Execution entry
if (process.argv[1] && process.argv[1].endsWith("allotment-backend.js")) {
    const arg = process.argv[2];
    if (arg === "--sync-ipos" || arg === "--refresh") {
        scrapeActiveRegistrarIpos();
    } else if (arg === "--server") {
        startServer();
    } else {
        scrapeActiveRegistrarIpos().then(() => {
            console.log("Ready! Use 'node allotment-backend.js --server' to run the API server.");
        });
    }
}
