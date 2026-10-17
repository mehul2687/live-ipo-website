import axios from "axios";
import * as cheerio from "cheerio";
import http from "http";
import fs from "fs";
import path from "path";

const PORT = 3001;
const ACTIVE_IPOS_FILE = "D:\\website\\allotment_active_ipos.json";

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
        id: "Accurate",
        name: "Accurate Securities & Registry Private Limited",
        website: "accuratesecurities.com",
        allotmentUrl: "https://www.accuratesecurities.com/ipo-details.php"
    },
    ALANKIT: {
        id: "Alankit",
        name: "Alankit Assignments Ltd",
        website: "alankit.com",
        allotmentUrl: "http://ipo.alankit.com/"
    },
    ANKIT: {
        id: "Ankit Consultancy",
        name: "Ankit Consultancy Pvt.Ltd",
        website: "ankitonline.com",
        allotmentUrl: "https://www.ankitonline.com/PublicIssue/FrmPublicIssue.aspx"
    },
    BEETALFC: {
        id: "BEETALFC",
        name: "Beetal Financial & Computer Services (P) Limited",
        website: "beetalmail.com",
        allotmentUrl: "http://www.beetalmail.com/smeipo"
    },
    INTEGRATED: {
        id: "INTEGRATED",
        name: "Integrated Registry Management Services (P) Limited",
        website: "integratedregistry.in",
        allotmentUrl: "https://www.integratedregistry.in/registrarstostatus.aspx"
    },
    MAS: {
        id: "MAS",
        name: "Mas Services Limited",
        website: "masserv.com",
        allotmentUrl: "https://www.masserv.com/opt.asp"
    },
    MUDRARTA: {
        id: "Mudra RTA",
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

    // C. Add Common Active Link Intime IPOs
    activeIpos.unshift(
        {
            id: "LINKINTIME_VAIBHAV_2",
            code: "VAIBHAV",
            name: "VAIBHAV VYAPAAR LIMITED (Server 2)",
            rawName: "VAIBHAV VYAPAAR LIMITED",
            registrarId: "LINKINTIME",
            registrarName: "Link-Intime India Private Ltd (Server 2)",
            allotmentUrl: "https://linkintime.co.in/Initial_Offer/public-issues.html"
        },
        {
            id: "LINKINTIME_VAIBHAV_1",
            code: "VAIBHAV",
            name: "VAIBHAV VYAPAAR LIMITED (Server 1)",
            rawName: "VAIBHAV VYAPAAR LIMITED",
            registrarId: "LINKINTIME",
            registrarName: "Link-Intime India Private Ltd (Server 1)",
            allotmentUrl: "https://linkintime.co.in/Initial_Offer/public-issues.html"
        }
    );

    // Save to JSON file
    fs.writeFileSync(ACTIVE_IPOS_FILE, JSON.stringify(activeIpos, null, 2), "utf8");
    console.log(`✓ Total ${activeIpos.length} active registrar IPOs saved to ${ACTIVE_IPOS_FILE}\n`);
    return activeIpos;
}

// ==========================================================
// 2. CHECK ALLOTMENT STATUS FOR A SINGLE PAN ON REGISTRAR
// ==========================================================
export async function checkSinglePanOnRegistrar(registrarId, companyCode, pan) {
    const cleanPan = (pan || "").trim().toUpperCase();
    if (!cleanPan || cleanPan.length !== 10) {
        return {
            status: "INVALID_PAN",
            resultText: "Invalid PAN Number",
            sharesAllotted: 0
        };
    }

    const regId = (registrarId || "").toUpperCase();

    // ------------------------------------------------------
    // A. BIGSHARE SERVICES REAL API
    // ------------------------------------------------------
    if (regId.includes("BIGSHARE")) {
        try {
            const payload = {
                Applicationno: "",
                Company: String(companyCode || ""),
                SelectionType: "PN",
                PanNo: cleanPan,
                txtcsdl: "",
                txtDPID: "",
                txtClId: "",
                ddlType: "1",
                lang: "en"
            };

            const res = await axios.post("https://ipo.bigshareonline.com/Data.aspx/FetchIpodetails", payload, {
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
                    const allotted = parseInt(d.ALLOTED || "0", 10);
                    const applied = parseInt(d.APPLIED || "0", 10);
                    const holderName = d.Name || "";

                    if (allotted > 0) {
                        return {
                            status: "ALLOTTED",
                            sharesAllotted: allotted,
                            sharesApplied: applied,
                            holderName: holderName,
                            resultText: `Bid 1: ${allotted} shares allotted`,
                            isWinner: true
                        };
                    } else {
                        return {
                            status: "NO_SHARES",
                            sharesAllotted: 0,
                            sharesApplied: applied,
                            holderName: holderName,
                            resultText: "Bid 1: No shares allotted",
                            isWinner: false
                        };
                    }
                } else if (d.Status === "NOTFOUND") {
                    return {
                        status: "NO_RECORD",
                        sharesAllotted: 0,
                        resultText: "Bid 1: NO RECORD FOUND",
                        isWinner: false
                    };
                }
            }
        } catch (err) {
            console.warn(`Bigshare query error for ${cleanPan}:`, err.message);
        }
    }

    // ------------------------------------------------------
    // B. SKYLINE REAL SCRAPER
    // ------------------------------------------------------
    if (regId.includes("SKYLINE")) {
        try {
            const postData = `company=${encodeURIComponent(companyCode)}&pan=${encodeURIComponent(cleanPan)}`;
            const res = await axios.post("https://www.skylinerta.com/ipo.php", postData, {
                headers: {
                    ...httpHeaders,
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                timeout: 8000
            });

            const $ = cheerio.load(res.data);
            const bodyText = $("body").text();

            if (bodyText.includes("Allotted") || bodyText.includes("Shares")) {
                const allottedMatch = bodyText.match(/Allotted\s*[:\-]?\s*(\d+)/i);
                const shares = allottedMatch ? parseInt(allottedMatch[1], 10) : 0;
                if (shares > 0) {
                    return {
                        status: "ALLOTTED",
                        sharesAllotted: shares,
                        resultText: `Bid 1: ${shares} shares allotted`,
                        isWinner: true
                    };
                } else {
                    return {
                        status: "NO_SHARES",
                        sharesAllotted: 0,
                        resultText: "Bid 1: No shares allotted",
                        isWinner: false
                    };
                }
            } else if (bodyText.includes("No Record") || bodyText.includes("Not Found")) {
                return {
                    status: "NO_RECORD",
                    sharesAllotted: 0,
                    resultText: "Bid 1: NO RECORD FOUND",
                    isWinner: false
                };
            }
        } catch (err) {
            console.warn(`Skyline query error for ${cleanPan}:`, err.message);
        }
    }

    // ------------------------------------------------------
    // C. GENERAL / FALLBACK HANDLER
    // ------------------------------------------------------
    return {
        status: "NO_RECORD",
        sharesAllotted: 0,
        resultText: "Bid 1: NO RECORD FOUND",
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
            const pan = parsedUrl.searchParams.get("pan");

            try {
                const answer = await checkSinglePanOnRegistrar(registrarId, companyCode, pan);
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ success: true, ...answer }));
            } catch (err) {
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
