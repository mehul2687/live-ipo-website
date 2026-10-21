import axios from "axios";
import * as cheerio from "cheerio";

const ADMIN_BIN_ID = "6aaf80f9ac6210605ae1bce6";
const ADMIN_API_KEY = "$2a$10$Pl5b/ekYZXhRBmQVY6DwieMC10GztytHM9d7CnR0zqmje7BWYj6yC";

const httpHeaders = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};

function extractIdFromChittorgarh(url) {
    if (!url) return "";
    const match = url.match(/\/(\d+)\//);
    return match ? match[1] : "";
}

async function get_Chittorgarh_subscription_data(key) {
    try {
        if (!key) return null;
        const id = extractIdFromChittorgarh(key);
        if (!id) return null;

        const [res1, res2] = await Promise.all([
            axios.get(`https://www.chittorgarh.net/documents/subscription/${id}/subscriptions.html`, {
                validateStatus: () => true,
                headers: httpHeaders,
            }),
            axios.get(`https://www.chittorgarh.com/ipo_subscription${key}`, {
                validateStatus: () => true,
                headers: httpHeaders,
            }),
        ]);

        let $ = cheerio.load(res1.data);
        let table = $("table").eq(0);
        if (table.length === 0 || table.html() === null) {
            $ = cheerio.load(res2.data, {});
            table = $("table").eq(1);
        }

        const results = {};

        table.find("tbody > tr").each((index, element) => {
            const children = cheerio.load(element);
            let curr = [];
            children("td").each((_, el) => {
                let data = children(el).text().trim();
                if (data === "[.]") data = "";
                curr.push(data.replace(/,/g, "").trim());
            });
            curr = curr.map((val, i) => {
                if (i <= 0) return val;
                else if (val === "") return null;
                else return parseFloat(val);
            });

            if (curr.length >= 4 && curr[0]) {
                let catName = curr[0].replace(/[\s*]/g, "").toLowerCase();
                let mappedKey = "";

                if (catName.includes("qib")) {
                    mappedKey = "QIB";
                } else if (catName.includes("nii") || catName.includes("non-institutional") || catName.includes("above") || catName.includes("10") || catName.includes("2")) {
                    // અહી તમામ NII ડેટાને હાલ પૂરता B-NII કી માં લઈએ જેથી તેને S-NII માં મોકલી શકીએ
                    mappedKey = "B-NII";
                } else if (catName.includes("retail")) {
                    mappedKey = "Retail";
                } else if (catName.includes("employee") || catName === "emp") {
                    mappedKey = "Employee";
                } else if (catName.includes("shareholder")) {
                    mappedKey = "Shareholder";
                }

                if (mappedKey) {
                    results[mappedKey] = {
                        off: curr[2] || 0,
                        app: curr[3] || 0
                    };
                }
            }
        });

        return results;
    } catch (error) {
        console.error("Chittorgarh Scraping Error:", error);
        return null;
    }
}

async function syncAllIposFromChittorgarh() {
    try {
        console.log("🔄 Fetching Master IPO data from JSONBin.io...");
        const response = await axios.get(`https://api.jsonbin.io/v3/b/${ADMIN_BIN_ID}/latest`, {
            headers: { 'X-Master-Key': ADMIN_API_KEY }
        });

        let dbData = response.data.record.ipos || response.data.record;
        if (!dbData) {
            console.log("❌ No IPO data found in cloud.");
            return;
        }

        let updated = false;

        for (const ipoId of Object.keys(dbData)) {
            let ipo = dbData[ipoId];
            if (ipo.chittorgarhKey) {
                console.log(`📡 Fetching live data for IPO: ${ipo.name} (${ipo.chittorgarhKey})...`);
                let liveData = await get_Chittorgarh_subscription_data(ipo.chittorgarhKey);

                if (liveData) {
                    if (!ipo.subShares) ipo.subShares = [];
                    ipo.subShares.forEach(row => {
                        if (row.cat === "QIB" && liveData['QIB']) {
                            row.off = liveData['QIB'].off;
                            row.app = liveData['QIB'].app;
                        }
                        if (row.cat === "NII" && liveData['NII']) {
                            row.off = liveData['NII'].off;
                            row.app = liveData['NII'].app;
                        }
                        // અહી મુખ્ય ફેરફાર: B-NII નો ડેટા હવે S-NII(₹2-10L) બોક્સમાં સેવ થશે
                        if (row.cat === "S-NII(₹2-10L)" && liveData['B-NII']) {
                            row.off = liveData['B-NII'].off;
                            row.app = liveData['B-NII'].app;
                        }
                        // B-NII બોક્સને હાલ ખાલી અથવા 0 રાખીશું જેથી ત્યાં ડેટા ન જાય
                        if (row.cat === "B-NII(₹10L+)") {
                            row.off = 0;
                            row.app = 0;
                        }
                        if (row.cat === "Retail" && liveData['Retail']) {
                            row.off = liveData['Retail'].off;
                            row.app = liveData['Retail'].app;
                        }
                        if (row.cat === "Employee") {
                            row.off = liveData['Employee'] ? liveData['Employee'].off : 0;
                            row.app = liveData['Employee'] ? liveData['Employee'].app : 0;
                        }
                        if (row.cat === "Shareholder") {
                            row.off = liveData['Shareholder'] ? liveData['Shareholder'].off : 0;
                            row.app = liveData['Shareholder'] ? liveData['Shareholder'].app : 0;
                        }
                    });
                    updated = true;
                    console.log(`✓ Updated subscription data for ${ipo.name}`);
                }
            }
        }

        if (updated) {
            console.log("☁️ Saving updated data back to JSONBin.io...");
            await axios.put(`https://api.jsonbin.io/v3/b/${ADMIN_BIN_ID}`, {
                ipos: dbData,
                updatedAt: new Date().toISOString()
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': ADMIN_API_KEY
                }
            });
            console.log("🎉 Successfully synced all IPO data to cloud!");
        } else {
            console.log("ℹ️ No updates needed or keys missing.");
        }

    } catch (err) {
        console.error("Sync error:", err);
    }
}

syncAllIposFromChittorgarh();