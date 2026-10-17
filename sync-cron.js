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

function getDetailUrl(key) {
    if (!key) return null;
    let clean = key.trim();
    if (clean.startsWith('http')) {
        clean = clean.replace('/ipo_subscription/', '/ipo/');
    } else {
        if (!clean.startsWith('/')) clean = '/' + clean;
        if (!clean.startsWith('/ipo/')) clean = '/ipo' + clean;
        clean = 'https://www.chittorgarh.com' + clean;
    }
    if (!clean.endsWith('/')) clean += '/';
    return clean;
}

function getSubscriptionUrl(key) {
    if (!key) return null;
    let clean = key.trim();
    if (clean.startsWith('http')) {
        clean = clean.replace('/ipo/', '/ipo_subscription/');
    } else {
        if (!clean.startsWith('/')) clean = '/' + clean;
        if (!clean.startsWith('/ipo_subscription/')) clean = '/ipo_subscription' + clean;
        clean = 'https://www.chittorgarh.com' + clean;
    }
    if (!clean.endsWith('/')) clean += '/';
    return clean;
}

function parseSingleDate(str) {
    if (!str) return null;
    const clean = str.replace(/[Tt]$/, '').trim();
    const d = new Date(clean);
    if (!isNaN(d.getTime())) {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }
    return null;
}

function parseIpoDateRange(str) {
    if (!str) return { openDate: null, closeDate: null };
    const parts = str.split(/\s+to\s+/i);
    if (parts.length === 2) {
        let part1 = parts[0].trim();
        let part2 = parts[1].trim();
        if (/^\d+$/.test(part1)) {
            const monthYearMatch = part2.match(/([a-zA-Z]+)[,\s]+(\d{4})/);
            if (monthYearMatch) {
                part1 = `${part1} ${monthYearMatch[1]}, ${monthYearMatch[2]}`;
            }
        }
        return {
            openDate: parseSingleDate(part1),
            closeDate: parseSingleDate(part2)
        };
    }
    return { openDate: null, closeDate: null };
}

function parseCrAmount(val) {
    if (!val) return null;
    const fullMatch = val.match(/₹[\d,.]+\s*(?:Cr|crore)/i);
    if (fullMatch) return fullMatch[0];
    const aggMatch = val.match(/up to\s*(₹[\d,.]+\s*(?:Cr|crore)?)/i);
    if (aggMatch) return aggMatch[1];
    const anyMatch = val.match(/₹[\d,.]+/);
    return anyMatch ? anyMatch[0] + " Cr" : val;
}

async function get_Chittorgarh_subscription_data(key) {
    try {
        if (!key) return null;
        const id = extractIdFromChittorgarh(key);
        if (!id) return null;

        const subUrl = getSubscriptionUrl(key);

        const [res1, res2] = await Promise.all([
            axios.get(`https://www.chittorgarh.net/documents/subscription/${id}/subscriptions.html`, {
                validateStatus: () => true,
                headers: httpHeaders,
                timeout: 10000
            }),
            axios.get(subUrl, {
                validateStatus: () => true,
                headers: httpHeaders,
                timeout: 10000
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
                if (data === "[.]" || data === "-" || data === "") data = "";
                curr.push(data.replace(/,/g, "").trim());
            });
            curr = curr.map((val, i) => {
                if (i <= 0) return val;
                else if (val === "" || val === "-") return null;
                else return parseFloat(val);
            });

            if (curr.length >= 4 && curr[0]) {
                let catName = curr[0].replace(/[\s*]/g, "").toLowerCase();
                let mappedKey = "";

                if (catName.includes("qib")) {
                    mappedKey = "QIB";
                } else if (catName.includes("bnii") || (catName.includes("b-nii") || (catName.includes("10l") && catName.includes(">")) || (catName.includes("above") && catName.includes("10")))) {
                    mappedKey = "B-NII";
                } else if (catName.includes("snii") || catName.includes("s-nii") || catName.includes("<") || catName.includes("below") || catName.includes("2-10")) {
                    mappedKey = "S-NII";
                } else if (catName.includes("nii") && !catName.includes("bnii") && !catName.includes("snii") && !catName.includes("b-nii") && !catName.includes("s-nii")) {
                    mappedKey = "NII";
                } else if (catName.includes("retail")) {
                    mappedKey = "Retail";
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
        console.error("Chittorgarh Subscription Scraping Error:", error.message);
        return null;
    }
}

async function get_Chittorgarh_details_data(key) {
    try {
        const detailUrl = getDetailUrl(key);
        if (!detailUrl) return null;

        const response = await axios.get(detailUrl, {
            headers: httpHeaders,
            validateStatus: () => true,
            timeout: 10000
        });

        if (response.status !== 200 || !response.data) return null;

        const $ = cheerio.load(response.data);

        // 1. Important Dates & Key Issue Details Scraping
        const dates = {};
        const issue = {};

        $('table').each((_, table) => {
            $(table).find('tr').each((_, tr) => {
                const cells = $(tr).find('th, td').map((_, c) => $(c).text().trim().replace(/\s+/g, ' ')).get();
                if (cells.length >= 2) {
                    const k = cells[0].toLowerCase();
                    const v = cells[1];

                    // Open / Close Date
                    if (k === 'ipo date') {
                        const range = parseIpoDateRange(v);
                        if (range.openDate) dates.openDate = range.openDate;
                        if (range.closeDate) dates.closeDate = range.closeDate;
                    }

                    // Listing Date
                    if (k === 'listing date' && !dates.listingDate) {
                        const parsed = parseSingleDate(v);
                        if (parsed) dates.listingDate = parsed;
                    }

                    // Price Band
                    if (k === 'price band' && !issue.priceBand) {
                        const nums = v.match(/\d+(\.\d+)?/g);
                        if (nums && nums.length >= 2) {
                            issue.priceStart = nums[0];
                            issue.priceEnd = nums[nums.length - 1];
                            issue.cutOff = parseFloat(nums[nums.length - 1]);
                            issue.priceBand = `${nums[0]} to ${nums[nums.length - 1]}`;
                        } else if (nums && nums.length === 1) {
                            issue.priceStart = nums[0];
                            issue.priceEnd = nums[0];
                            issue.cutOff = parseFloat(nums[0]);
                            issue.priceBand = nums[0];
                        }
                    }

                    // Lot Size
                    if (k === 'lot size' && !issue.lotRaw) {
                        const match = v.match(/(\d+)\s*Shares?/i);
                        if (match) {
                            issue.lotRaw = parseInt(match[1]);
                            issue.lotSize = `${match[1]} Shares`;
                        }
                    }

                    // Face Value
                    if (k === 'face value' && !issue.faceValue) {
                        issue.faceValue = v;
                    }

                    // Employee Discount
                    if (k.includes('employee discount') && !issue.empDiscount) {
                        issue.empDiscount = v;
                    }

                    // Total Size
                    if (k.includes('total issue size') && !issue.totalSize) {
                        const amt = parseCrAmount(v);
                        if (amt) issue.totalSize = amt;
                    }

                    // Fresh Issue
                    if (k.includes('fresh issue') && !issue.freshIssue) {
                        const amt = parseCrAmount(v);
                        if (amt) issue.freshIssue = amt;
                    }

                    // OFS
                    if (k.includes('offer for sale') && !issue.ofs) {
                        const amt = parseCrAmount(v);
                        if (amt) issue.ofs = amt;
                    }

                    // Listing At
                    if (k === 'listing at' && !issue.listingAt) {
                        issue.listingAt = v;
                    }
                }
            });
        });

        // Basis of Allotment date from FAQ or text
        $('p, div, td').each((_, el) => {
            const text = $(el).text().trim().replace(/\s+/g, ' ');
            if (text.includes('Basis of Allotment') && text.includes('done on') && !dates.allotmentDate) {
                const match = text.match(/done on\s+([A-Za-z]+,\s+[A-Za-z]+\s+\d{1,2},\s+\d{4}|[A-Za-z]+\s+\d{1,2},\s+\d{4})/i);
                if (match) {
                    const parsed = parseSingleDate(match[1]);
                    if (parsed) dates.allotmentDate = parsed;
                }
            }
        });

        // 2. Financial Information Table Scraping
        let headerRow = null;
        let assetRow = null;
        let revRow = null;
        let expRow = null;
        let prfRow = null;

        $('table').each((_, table) => {
            const text = $(table).text();
            if (text.includes('Period Ended') && (text.includes('Assets') || text.includes('Total Income') || text.includes('Profit After Tax'))) {
                $(table).find('tr').each((_, tr) => {
                    const cells = $(tr).find('th, td').map((_, c) => $(c).text().trim().replace(/\s+/g, ' ')).get();
                    if (cells.length > 1) {
                        const label = cells[0].toLowerCase();
                        if (label.includes('period ended')) headerRow = cells;
                        else if (label.includes('asset')) assetRow = cells;
                        else if (label.includes('total income') || label.includes('total revenue') || label.includes('revenue')) {
                            if (!revRow) revRow = cells;
                        }
                        else if (label.includes('expense')) expRow = cells;
                        else if (label.includes('profit after tax') || label.includes('pat') || label.includes('net profit')) {
                            if (!prfRow) prfRow = cells;
                        }
                    }
                });
            }
        });

        let fin = null;
        if (headerRow) {
            const periods = [];
            for (let i = 1; i < headerRow.length; i++) {
                const periodName = headerRow[i];
                if (!periodName) continue;
                periods.push({
                    rawPeriod: periodName,
                    ast: (assetRow && assetRow[i]) ? assetRow[i] : '-',
                    rev: (revRow && revRow[i]) ? revRow[i] : '-',
                    exp: (expRow && expRow[i]) ? expRow[i] : '-',
                    prf: (prfRow && prfRow[i]) ? prfRow[i] : '-'
                });
            }

            fin = {
                fy23: { yr: "FY-2023", ast: "-", rev: "-", exp: "-", prf: "-" },
                fy24: { yr: "FY-2024", ast: "-", rev: "-", exp: "-", prf: "-" },
                fy25: { yr: "FY-2025", ast: "-", rev: "-", exp: "-", prf: "-" },
                fy26: { yr: "FY-2026", ast: "-", rev: "-", exp: "-", prf: "-" }
            };

            periods.forEach(p => {
                const text = p.rawPeriod;
                let mappedKey = null;
                if (text.includes('2023') || text.includes('Mar 2023') || text.includes('FY23')) mappedKey = 'fy23';
                else if (text.includes('2024') || text.includes('Mar 2024') || text.includes('FY24')) mappedKey = 'fy24';
                else if (text.includes('2025') || text.includes('Mar 2025') || text.includes('FY25')) mappedKey = 'fy25';
                else if ((text.includes('2026') && text.includes('Mar')) || text.includes('FY26')) mappedKey = 'fy26';

                if (mappedKey) {
                    fin[mappedKey] = {
                        yr: mappedKey.toUpperCase().replace('FY', 'FY-20'),
                        ast: p.ast,
                        rev: p.rev,
                        exp: p.exp,
                        prf: p.prf
                    };
                }
            });

            // If fy26 wasn't filled by Mar 2026, fallback to any available 2026 period
            if (fin.fy26.ast === '-') {
                const p26 = periods.find(p => p.rawPeriod.includes('2026'));
                if (p26) {
                    fin.fy26 = {
                        yr: "FY-2026",
                        ast: p26.ast,
                        rev: p26.rev,
                        exp: p26.exp,
                        prf: p26.prf
                    };
                }
            }
        }

        // 3. Application Lot Size Table Scraping
        let lotRows = [];
        $('table').each((_, table) => {
            const text = $(table).text();
            if (text.includes('Retail (Min)') || (text.includes('Application') && text.includes('Lots') && text.includes('Shares'))) {
                $(table).find('tr').each((_, tr) => {
                    const cells = $(tr).find('td').map((_, td) => $(td).text().trim()).get();
                    if (cells.length >= 2) {
                        const appName = cells[0];
                        const lotNum = parseInt(cells[1].replace(/,/g, ''));
                        if (appName && !isNaN(lotNum) && lotNum > 0) {
                            lotRows.push({ app: appName, lot: lotNum });
                        }
                    }
                });
            }
        });

        let customLots = null;
        if (lotRows.length > 0) {
            let retailLot = 1;
            let shniLot = 14;
            let bhniLot = 68;

            lotRows.forEach(r => {
                const n = r.app.toLowerCase();
                if (n.includes('retail') && (n.includes('min') || !n.includes('max'))) {
                    retailLot = r.lot;
                } else if ((n.includes('small') || n.includes('s-hni') || n.includes('s-nii')) && (n.includes('min') || !n.includes('max'))) {
                    shniLot = r.lot;
                } else if (n.includes('big') || n.includes('b-hni') || n.includes('b-nii')) {
                    bhniLot = r.lot;
                }
            });

            customLots = [
                { app: "Retail Min", lot: retailLot },
                { app: "Small HNI", lot: shniLot },
                { app: "Big HNI", lot: bhniLot }
            ];
        }

        // 4. Valuation Ratios & KPI Scraping
        let val = {};
        $('table').each((_, table) => {
            $(table).find('tr').each((_, tr) => {
                const cells = $(tr).find('th, td').map((_, c) => $(c).text().trim().replace(/\s+/g, ' ')).get();
                if (cells.length >= 2) {
                    const label = cells[0].toLowerCase();
                    if (label.includes('ronw') && !val.ronw) {
                        val.ronw = cells[cells.length - 1] || cells[1];
                    } else if (label.includes('pat margin') && !val.patMargin) {
                        val.patMargin = cells[cells.length - 1] || cells[1];
                    } else if (label.includes('ebitda margin') && !val.ebitdaMargin) {
                        val.ebitdaMargin = cells[cells.length - 1] || cells[1];
                    } else if (label.includes('nav') && !val.nav) {
                        val.nav = cells[cells.length - 1] || cells[1];
                    } else if (label.includes('eps') && !val.eps) {
                        val.eps = cells[cells.length - 1] || cells[1];
                    } else if (label.includes('p/e') && !val.pe) {
                        val.pe = cells[cells.length - 1] || cells[1];
                    }
                }
            });
        });

        return {
            dates: Object.keys(dates).length > 0 ? dates : null,
            issue: Object.keys(issue).length > 0 ? issue : null,
            fin,
            customLots,
            valuation: Object.keys(val).length > 0 ? val : null
        };
    } catch (err) {
        console.error("Chittorgarh Detail Scraping Error:", err.message);
        return null;
    }
}

async function syncAllIposFromChittorgarh() {
    try {
        console.log("🔄 Fetching Master IPO data from JSONBin.io...");
        const response = await axios.get(`https://api.jsonbin.io/v3/b/${ADMIN_BIN_ID}/latest?t=${Date.now()}`, {
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
                if (ipo.manualLockAll) {
                    console.log(`\n🔒 Skipping ${ipo.name} - Entire IPO is manually locked.`);
                    continue;
                }

                console.log(`\n📡 Checking live data for IPO: ${ipo.name} (${ipo.chittorgarhKey})...`);
                
                // 1. Live Subscription Data
                if (!ipo.manualSub) {
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
                            if (row.cat === "B-NII(₹10L+)") {
                                if (liveData['B-NII']) {
                                    row.off = liveData['B-NII'].off;
                                    row.app = liveData['B-NII'].app;
                                } else {
                                    row.off = 0;
                                    row.app = 0;
                                }
                            }
                            if (row.cat === "S-NII(₹2-10L)") {
                                if (liveData['S-NII']) {
                                    row.off = liveData['S-NII'].off;
                                    row.app = liveData['S-NII'].app;
                                } else {
                                    row.off = 0;
                                    row.app = 0;
                                }
                            }
                            if (row.cat === "Retail" && liveData['Retail']) {
                                row.off = liveData['Retail'].off;
                                row.app = liveData['Retail'].app;
                            }
                        });
                        updated = true;
                        console.log(`  ✓ Updated subscription data for ${ipo.name}`);
                    }
                } else {
                    console.log(`  🔒 Subscription is manually locked for ${ipo.name} (Kept custom data)`);
                }

                // 2. Dates, Issue Info, Financials, Lot Sizes & Valuation Ratios
                let detailData = await get_Chittorgarh_details_data(ipo.chittorgarhKey);
                if (detailData) {
                    // DATES AUTO-SYNC
                    if (!ipo.manualDates && detailData.dates) {
                        let dateUpdated = false;
                        if (detailData.dates.openDate && ipo.openDate !== detailData.dates.openDate) {
                            ipo.openDate = detailData.dates.openDate;
                            dateUpdated = true;
                        }
                        if (detailData.dates.closeDate && ipo.closeDate !== detailData.dates.closeDate) {
                            ipo.closeDate = detailData.dates.closeDate;
                            dateUpdated = true;
                        }
                        if (detailData.dates.allotmentDate && ipo.allotmentDate !== detailData.dates.allotmentDate) {
                            ipo.allotmentDate = detailData.dates.allotmentDate;
                            dateUpdated = true;
                        }
                        if (detailData.dates.listingDate && ipo.listingDate !== detailData.dates.listingDate) {
                            ipo.listingDate = detailData.dates.listingDate;
                            dateUpdated = true;
                        }
                        if (dateUpdated) {
                            updated = true;
                            console.log(`  ✓ Updated Dates for ${ipo.name} (Open: ${ipo.openDate}, Close: ${ipo.closeDate}, Allot: ${ipo.allotmentDate}, List: ${ipo.listingDate})`);
                        }
                    } else if (ipo.manualDates) {
                        console.log(`  🔒 Dates manually locked for ${ipo.name} (Kept custom data)`);
                    }

                    // ISSUE DETAILS & PRICE BAND AUTO-SYNC
                    if (!ipo.manualIssueInfo && detailData.issue) {
                        let issueUpdated = false;
                        if (detailData.issue.priceBand && (!ipo.priceBand || ipo.priceBand === '546 to 575' || !ipo.priceBand.includes('to') || detailData.issue.priceBand !== ipo.priceBand)) {
                            ipo.priceBand = detailData.issue.priceBand;
                            if (detailData.issue.cutOff) ipo.cutOff = detailData.issue.cutOff;
                            issueUpdated = true;
                        }
                        if (detailData.issue.lotRaw && (!ipo.lotRaw || ipo.lotRaw === 26 || ipo.lotRaw <= 1 || detailData.issue.lotRaw !== ipo.lotRaw)) {
                            ipo.lotRaw = detailData.issue.lotRaw;
                            ipo.lotSize = detailData.issue.lotSize;
                            issueUpdated = true;
                        }
                        if (detailData.issue.faceValue && (!ipo.faceValue || ipo.faceValue === '₹10 per share' || detailData.issue.faceValue !== ipo.faceValue)) {
                            ipo.faceValue = detailData.issue.faceValue;
                            issueUpdated = true;
                        }
                        if (detailData.issue.totalSize && (!ipo.totalSize || ipo.totalSize === 'N/A' || detailData.issue.totalSize !== ipo.totalSize)) {
                            ipo.totalSize = detailData.issue.totalSize;
                            issueUpdated = true;
                        }
                        if (detailData.issue.freshIssue && (!ipo.freshIssue || ipo.freshIssue === 'N/A' || detailData.issue.freshIssue !== ipo.freshIssue)) {
                            ipo.freshIssue = detailData.issue.freshIssue;
                            issueUpdated = true;
                        }
                        if (detailData.issue.ofs && (!ipo.ofs || ipo.ofs === 'N/A' || detailData.issue.ofs !== ipo.ofs)) {
                            ipo.ofs = detailData.issue.ofs;
                            issueUpdated = true;
                        }
                        if (detailData.issue.listingAt && (!ipo.listingAt || ipo.listingAt === 'BSE, NSE' || detailData.issue.listingAt !== ipo.listingAt)) {
                            ipo.listingAt = detailData.issue.listingAt;
                            issueUpdated = true;
                        }
                        if (detailData.issue.empDiscount && (!ipo.empDiscount || ipo.empDiscount === 'Nil')) {
                            ipo.empDiscount = detailData.issue.empDiscount;
                            issueUpdated = true;
                        }
                        if (issueUpdated) {
                            updated = true;
                            console.log(`  ✓ Updated Issue Details & Price Band for ${ipo.name}`);
                        }
                    } else if (ipo.manualIssueInfo) {
                        console.log(`  🔒 Issue Info manually locked for ${ipo.name} (Kept custom data)`);
                    }

                    // Update custom lots
                    if (!ipo.manualLots && detailData.customLots) {
                        ipo.customLots = detailData.customLots;
                        updated = true;
                        console.log(`  ✓ Updated Lot Sizes for ${ipo.name}:`, JSON.stringify(detailData.customLots));
                    } else if (ipo.manualLots) {
                        console.log(`  🔒 Lot Sizes manually locked for ${ipo.name} (Kept custom data)`);
                    }

                    // Update Company Financials
                    if (!ipo.manualFin && detailData.fin) {
                        const hasExisting = ipo.fin && Object.values(ipo.fin).some(f => f && f.ast && f.ast !== '-');
                        if (!hasExisting) {
                            ipo.fin = detailData.fin;
                            updated = true;
                            console.log(`  ✓ Updated Financials (full) for ${ipo.name}`);
                        } else {
                            let filledAny = false;
                            ['fy23', 'fy24', 'fy25', 'fy26'].forEach(fy => {
                                if (detailData.fin[fy] && detailData.fin[fy].ast !== '-') {
                                    if (!ipo.fin[fy] || ipo.fin[fy].ast === '-' || ipo.fin[fy].ast === '') {
                                        ipo.fin[fy] = detailData.fin[fy];
                                        filledAny = true;
                                    }
                                }
                            });
                            if (filledAny) {
                                updated = true;
                                console.log(`  ✓ Merged missing Financials for ${ipo.name}`);
                            }
                        }
                    } else if (ipo.manualFin) {
                        console.log(`  🔒 Financials manually locked for ${ipo.name} (Kept custom data)`);
                    }

                    // Update Valuation Ratios
                    if (!ipo.manualValuation && detailData.valuation) {
                        if (!ipo.valuation) ipo.valuation = {};
                        let valFilled = false;
                        Object.keys(detailData.valuation).forEach(vk => {
                            if (!ipo.valuation[vk] || ipo.valuation[vk] === '-' || ipo.valuation[vk] === '') {
                                ipo.valuation[vk] = detailData.valuation[vk];
                                valFilled = true;
                            }
                        });
                        if (valFilled) {
                            updated = true;
                            console.log(`  ✓ Updated Valuation Ratios for ${ipo.name}`);
                        }
                    } else if (ipo.manualValuation) {
                        console.log(`  🔒 Valuation manually locked for ${ipo.name} (Kept custom data)`);
                    }
                }
            }
        }

        if (updated) {
            console.log("\n☁️ Saving updated data back to JSONBin.io...");
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

// Arguments & Auto-Repeat Configuration
const args = process.argv.slice(2);
const runOnce = args.includes('--once') || args.includes('-1');

let intervalMinutes = 30;
const intervalArgIndex = args.findIndex(arg => arg === '--interval' || arg === '-i');
if (intervalArgIndex !== -1 && args[intervalArgIndex + 1]) {
    const parsed = parseInt(args[intervalArgIndex + 1], 10);
    if (!isNaN(parsed) && parsed > 0) intervalMinutes = parsed;
}

let isRunning = false;

async function executeSync() {
    if (isRunning) {
        console.log("⚠️ Previous sync still in progress, skipping duplicate run.");
        return;
    }
    isRunning = true;
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    console.log(`\n======================================================`);
    console.log(`🚀 [${timeStr}] Starting IPO sync check...`);
    console.log(`======================================================`);

    try {
        await syncAllIposFromChittorgarh();
    } catch (e) {
        console.error("❌ Sync execution error:", e.message);
    } finally {
        isRunning = false;
    }

    if (!runOnce) {
        const nextDate = new Date(Date.now() + intervalMinutes * 60 * 1000);
        const nextTimeStr = nextDate.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit' });
        console.log(`\n⏳ Next auto-sync scheduled at: ${nextTimeStr} (in ${intervalMinutes} minutes)`);
        console.log(`💡 Press Ctrl+C in this terminal anytime to stop.`);
        console.log(`------------------------------------------------------\n`);
    }
}

async function main() {
    console.log(`\n======================================================`);
    console.log(`📊 IPO AUTO-SYNC SERVICE`);
    console.log(`⏰ Mode: ${runOnce ? 'Single Run (--once)' : `Continuous Auto-Sync (Every ${intervalMinutes} mins)`}`);
    console.log(`======================================================`);

    await executeSync();

    if (!runOnce) {
        setInterval(executeSync, intervalMinutes * 60 * 1000);
    }
}

main();