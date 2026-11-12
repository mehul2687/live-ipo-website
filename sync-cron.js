import axios from "axios";
import * as cheerio from "cheerio";
import dns from "dns";
import { fetchAndSaveFiiDiiData } from "./scrape_fii_dii.mjs";
import { fetchAndSaveFnoData } from "./scrape_fii_fno.mjs";
import { scrapeIndices } from "./scrape_indices.mjs";
import { scrapeIndexStocks } from "./scrape_index_stocks.mjs";

if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
}

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
    let clean = str.replace(/[Tt]$/, '').replace(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[,\s]*/i, '').trim();
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

        // Extract 4-digit year from part2 (e.g. "2026")
        const yearMatch = part2.match(/\b(20\d\d)\b/);
        const year = yearMatch ? yearMatch[1] : new Date().getFullYear();

        // Extract month name from part2 (e.g. "Nov")
        const monthMatch = part2.match(/([a-zA-Z]+)/);
        const month2 = monthMatch ? monthMatch[1] : '';

        // If part1 is just a day number (e.g. "30") -> "30 Nov 2026"
        if (/^\d+$/.test(part1)) {
            part1 = `${part1} ${month2} ${year}`;
        }
        // If part1 has day and month (e.g. "30 Oct") but no year -> "30 Oct 2026"
        else if (!/\b20\d\d\b/.test(part1)) {
            part1 = `${part1} ${year}`;
        }

        return {
            openDate: parseSingleDate(part1),
            closeDate: parseSingleDate(part2)
        };
    }
    return { openDate: null, closeDate: null };
}

function parseIssueSize(val) {
    if (!val) return null;
    let clean = val.replace(/\s+/g, ' ').trim();
    if (!clean || clean === '-' || clean === '[.]' || clean.toLowerCase() === 'n/a') return null;
    if (clean.toLowerCase() === 'nil') return 'Nil';

    // Normalize corrupted replacement characters to ₹ (never corrupt numeric ",1" sequences like 2,23,24,120)
    clean = clean.replace(/\uFFFD/g, '₹');

    return clean;
}

function parseCrAmount(val) {
    return parseIssueSize(val);
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
                } else if ((catName.includes("nii") || catName.includes("non-institutional") || catName.includes("noninstitutional")) && !catName.includes("bnii") && !catName.includes("snii") && !catName.includes("b-nii") && !catName.includes("s-nii")) {
                    mappedKey = "NII";
                } else if (catName.includes("retail") || catName.includes("individual") || catName.includes("rii")) {
                    mappedKey = "Retail";
                } else if (catName.includes("employee") || catName === "emp") {
                    mappedKey = "Employee";
                } else if (catName.includes("shareholder") || catName.includes("shareholders")) {
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
            let priceDetailsCols = null;

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

                    // Listing Date / Listed on
                    if ((k === 'listing date' || k.includes('listed on') || k === 'listing') && !dates.listingDate) {
                        const parsed = parseSingleDate(v);
                        if (parsed) dates.listingDate = parsed;
                    }

                    // Basis of Allotment in table
                    if ((k.includes('basis of allotment') || k.includes('allotment date')) && !dates.allotmentDate) {
                        const parsed = parseSingleDate(v);
                        if (parsed) dates.allotmentDate = parsed;
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
                    if ((k.includes('total issue size') || k === 'issue size') && !issue.totalSize) {
                        const amt = parseIssueSize(v);
                        if (amt) issue.totalSize = amt;
                    }

                    // Fresh Issue
                    if (k.includes('fresh issue') && !issue.freshIssue) {
                        const amt = parseIssueSize(v);
                        if (amt) issue.freshIssue = amt;
                    }

                    // OFS
                    if (k.includes('offer for sale') && !issue.ofs) {
                        const amt = parseIssueSize(v);
                        if (amt) issue.ofs = amt;
                    }

                    // Listing At
                    if (k === 'listing at' && !issue.listingAt) {
                        issue.listingAt = v;
                    }

                    // BSE Script Code / NSE Symbol
                    if (k.includes('bse script code') || k.includes('bse scrip code') || k.includes('nse symbol') || k === 'nse code' || k === 'bse code') {
                        const parts = v.split('/').map(p => p.trim()).filter(Boolean);
                        for (const p of parts) {
                            if (/^\d{6}$/.test(p) && !issue.bseCode) {
                                issue.bseCode = p;
                            } else if (/^[A-Z0-9&-]{2,20}$/i.test(p) && !['N/A', 'NIL', 'TBA', 'DESCRIPTION'].includes(p.toUpperCase()) && !issue.nseCode) {
                                issue.nseCode = p.toUpperCase();
                            }
                        }
                    }

                    // ISIN
                    if (k === 'isin' && !issue.isinCode) {
                        const isinMatch = v.match(/\b(IN[A-Z0-9]{10})\b/i);
                        if (isinMatch) issue.isinCode = isinMatch[1].toUpperCase();
                    }

                    // Listing Day Price Details Table (BSE / NSE / BSE SME / NSE SME)
                    if (k === 'price details') {
                        priceDetailsCols = cells.slice(1).map(c => c.toUpperCase());
                    } else if (priceDetailsCols && k === 'open') {
                        priceDetailsCols.forEach((colName, idx) => {
                            const rawCell = (cells[idx + 1] || '').replace(/,/g, '');
                            const num = parseFloat(rawCell.replace(/[^0-9.]/g, ''));
                            if (!isNaN(num) && num > 0) {
                                if (colName.includes('BSE') && !issue.listingPriceBse) {
                                    issue.listingPriceBse = num;
                                }
                                if (colName.includes('NSE') && !issue.listingPriceNse) {
                                    issue.listingPriceNse = num;
                                }
                            }
                        });
                    }
                }
            });
        });

        // Fallback ISIN scan across page text if row label differed
        if (!issue.isinCode && typeof response.data === 'string') {
            const fallbackIsin = response.data.match(/\bINE[A-Z0-9]{9}\b/);
            if (fallbackIsin) issue.isinCode = fallbackIsin[0].toUpperCase();
        }

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

        // If allotment date is still missing but close date exists
        if (!dates.allotmentDate && dates.closeDate) {
            const close = new Date(dates.closeDate);
            close.setDate(close.getDate() + 1);
            dates.allotmentDate = close.toISOString().slice(0, 10);
        }

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
                fy24: { yr: "FY-2024", ast: "-", rev: "-", exp: "-", prf: "-" },
                fy25: { yr: "FY-2025", ast: "-", rev: "-", exp: "-", prf: "-" },
                fy26: { yr: "FY-2026", ast: "-", rev: "-", exp: "-", prf: "-" },
                jun26: { yr: "30 Jun 2026", ast: "-", rev: "-", exp: "-", prf: "-" }
            };

            periods.forEach(p => {
                const text = p.rawPeriod;
                if ((text.includes('2024') && (text.includes('Mar') || text.includes('FY24'))) || text.includes('31 Mar 2024')) {
                    fin.fy24 = { yr: "FY-2024", ast: p.ast, rev: p.rev, exp: p.exp, prf: p.prf };
                } else if ((text.includes('2025') && (text.includes('Mar') || text.includes('FY25'))) || text.includes('31 Mar 2025')) {
                    fin.fy25 = { yr: "FY-2025", ast: p.ast, rev: p.rev, exp: p.exp, prf: p.prf };
                } else if ((text.includes('2026') && (text.includes('Mar') || text.includes('FY26'))) || text.includes('31 Mar 2026')) {
                    fin.fy26 = { yr: "FY-2026", ast: p.ast, rev: p.rev, exp: p.exp, prf: p.prf };
                } else if (text.toLowerCase().includes('jun') || text.toLowerCase().includes('sep') || text.toLowerCase().includes('dec') || text.toLowerCase().includes('q1') || text.toLowerCase().includes('q2')) {
                    fin.jun26 = { yr: p.rawPeriod, ast: p.ast, rev: p.rev, exp: p.exp, prf: p.prf };
                }
            });

            // If fy26 wasn't filled by Mar 2026, fallback to any non-stub 2026 period
            if (fin.fy26.ast === '-') {
                const p26 = periods.find(p => p.rawPeriod.includes('2026') && !p.rawPeriod.toLowerCase().includes('jun') && !p.rawPeriod.toLowerCase().includes('sep'));
                if (p26) {
                    fin.fy26 = { yr: "FY-2026", ast: p26.ast, rev: p26.rev, exp: p26.exp, prf: p26.prf };
                }
            }

            // If jun26 wasn't filled, check if the first period in the table is a latest stub period
            if (fin.jun26.ast === '-' && periods.length > 0) {
                const pFirst = periods[0];
                if (pFirst.rawPeriod.toLowerCase().includes('jun') || pFirst.rawPeriod.includes('30 Jun')) {
                    fin.jun26 = { yr: pFirst.rawPeriod, ast: pFirst.ast, rev: pFirst.rev, exp: pFirst.exp, prf: pFirst.prf };
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

        const h1Text = ($('h1').first().text() || '').trim();
        let detectedName = '';
        if (h1Text) {
            detectedName = h1Text.replace(/IPO\s*(Details|Review|Dates|Allotment|GMP|Price).*/i, 'IPO Details').trim();
            if (detectedName && !detectedName.toLowerCase().includes('ipo')) detectedName += ' IPO Details';
        }
        const detectedType = (/SME/i.test(issue.listingAt || '') || /\bSME\s+IPO\b/i.test(h1Text) || /\/ipo\/[^/]*sme[^/]*\//i.test(detailUrl))
            ? 'SME'
            : 'Mainboard';

        return {
            name: detectedName || null,
            type: detectedType,
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

function normalizeMarketName(str) {
    return (str || '')
        .toLowerCase()
        .replace(/\b(ipo|details|limited|ltd\.?|private|pvt\.?|india)\b/g, ' ')
        .replace(/[^a-z0-9]/g, '');
}

function cleanIpoNameForSearch(str) {
    return (str || '')
        .replace(/\b(ipo|details|limited|ltd\.?|private|pvt\.?)\b/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

async function queryMoneycontrolSuggest(q) {
    if (!q) return [];
    try {
        const res = await axios.get(`https://www.moneycontrol.com/mccode/common/autosuggestion_solr.php?classic=true&query=${encodeURIComponent(q)}&type=1&format=json`, {
            headers: httpHeaders,
            timeout: 8000,
            validateStatus: () => true
        });
        const list = Array.isArray(res.data) ? res.data : [];
        return list.filter(x => x && x.sc_id && x.sc_id !== '0');
    } catch {
        return [];
    }
}

async function resolveMoneycontrolStockId({ isinCode, nseCode, bseCode, name }) {
    // 1. Highest reliability: unique ISIN
    if (isinCode) {
        const hits = await queryMoneycontrolSuggest(isinCode);
        if (hits.length > 0) {
            const exactIsin = hits.find(h => (h.pdt_dis_nm || '').toUpperCase().includes(isinCode.toUpperCase()));
            return (exactIsin || hits[0]).sc_id;
        }
    }

    // 2. NSE Symbol match
    if (nseCode) {
        const hits = await queryMoneycontrolSuggest(nseCode);
        const targetNse = nseCode.toUpperCase();
        const exactNse = hits.find(h => (h.pdt_dis_nm || '').toUpperCase().includes(targetNse));
        if (exactNse) return exactNse.sc_id;
    }

    // 3. BSE Script Code match
    if (bseCode) {
        const hits = await queryMoneycontrolSuggest(bseCode);
        const exactBse = hits.find(h => (h.pdt_dis_nm || '').includes(bseCode));
        if (exactBse) return exactBse.sc_id;
    }

    // 4. Fallback: exact normalized company name only (avoids wrong partial matches)
    const cleaned = cleanIpoNameForSearch(name);
    const targetNorm = normalizeMarketName(name);
    if (cleaned && targetNorm) {
        const hits = await queryMoneycontrolSuggest(cleaned);
        const exactName = hits.find(h => normalizeMarketName(h.stock_name || h.name) === targetNorm);
        if (exactName) return exactName.sc_id;
    }

    return null;
}

function isValidExchangeFeed(resData, expectedIsin, expectedCode, codeField) {
    if (!resData || String(resData.code) !== '200' || !resData.data) return false;
    const d = resData.data;
    const price = parseFloat(d.pricecurrent);
    if (isNaN(price) || price <= 0) return false;
    if (expectedIsin && d.isinid && d.isinid.toUpperCase() !== expectedIsin.toUpperCase()) {
        return false;
    }
    if (expectedCode && d[codeField] && String(d[codeField]).toUpperCase() !== String(expectedCode).toUpperCase()) {
        return false;
    }
    return true;
}

async function fetchMoneycontrolExchangeFeeds(scId, expectedIsin, listingAtStr, bseCode, nseCode) {
    if (!scId) return { nse: null, bse: null };
    const exUpper = (listingAtStr || 'BSE, NSE').toUpperCase();
    const allowBse = exUpper.includes('BSE') || !!bseCode;
    const allowNse = exUpper.includes('NSE') || !!nseCode;

    const reqs = [];
    reqs.push(allowNse
        ? axios.get(`https://priceapi.moneycontrol.com/pricefeed/nse/equitycash/${encodeURIComponent(scId)}`, {
            headers: httpHeaders, timeout: 8000, validateStatus: () => true
        }).catch(() => null)
        : Promise.resolve(null));
    reqs.push(allowBse
        ? axios.get(`https://priceapi.moneycontrol.com/pricefeed/bse/equitycash/${encodeURIComponent(scId)}`, {
            headers: httpHeaders, timeout: 8000, validateStatus: () => true
        }).catch(() => null)
        : Promise.resolve(null));

    const [nseRes, bseRes] = await Promise.all(reqs);
    const nseData = nseRes && isValidExchangeFeed(nseRes.data, expectedIsin, nseCode, 'NSEID') ? nseRes.data.data : null;
    const bseData = bseRes && isValidExchangeFeed(bseRes.data, expectedIsin, bseCode, 'BSEID') ? bseRes.data.data : null;
    return { nse: nseData, bse: bseData };
}

function applyExchangeFeedMeta(ipo, feedData, codeProp, feedCodeKey, listPriceProp, effectiveListingDate) {
    if (!feedData) return false;
    let changed = false;
    const exCode = feedData[feedCodeKey] ? String(feedData[feedCodeKey]).toUpperCase() : '';
    if (!ipo[codeProp] && exCode) {
        ipo[codeProp] = exCode;
        changed = true;
    }
    if (!ipo.isinCode && feedData.isinid) {
        ipo.isinCode = String(feedData.isinid).toUpperCase();
        changed = true;
    }
    if (!ipo[listPriceProp]) {
        const lastUpdDate = String(feedData.lastupd || '').slice(0, 10);
        const opn = parseFloat(feedData.OPN);
        const isDay1 = (lastUpdDate && effectiveListingDate && lastUpdDate === effectiveListingDate) ||
            !feedData.PREVDATE ||
            (feedData.clMaxDt && lastUpdDate && feedData.clMaxDt === lastUpdDate);
        if (isDay1 && !isNaN(opn) && opn > 0) {
            ipo[listPriceProp] = opn;
            changed = true;
        }
    }
    return changed;
}

/** Auto-resolves exchange codes, ISIN, Moneycontrol sc_id, and listing prices for an IPO. */
async function enrichIpoMarketData(ipo, detailData, istTodayStr) {
    if (ipo.manualListingInfo) return false;
    let marketUpdated = false;
    const chIssue = (detailData && detailData.issue) ? detailData.issue : {};
    const chListDate = (detailData && detailData.dates && detailData.dates.listingDate) ? detailData.dates.listingDate : '';
    const effectiveListingDate = chListDate || ipo.listingDate || '';

    for (const field of ['bseCode', 'nseCode', 'isinCode', 'listingPriceBse', 'listingPriceNse']) {
        if (chIssue[field] && ipo[field] !== chIssue[field]) {
            ipo[field] = chIssue[field];
            marketUpdated = true;
        }
    }

    if (!ipo.mcScId && (ipo.isinCode || ipo.nseCode || ipo.bseCode || (effectiveListingDate && effectiveListingDate <= istTodayStr))) {
        const resolvedScId = await resolveMoneycontrolStockId({
            isinCode: ipo.isinCode,
            nseCode: ipo.nseCode,
            bseCode: ipo.bseCode,
            name: ipo.name
        });
        if (resolvedScId) {
            ipo.mcScId = resolvedScId;
            marketUpdated = true;
        }
    }

    const shouldProbeFeeds = ipo.mcScId && (
        !effectiveListingDate ||
        effectiveListingDate <= istTodayStr ||
        ipo.listingPriceBse ||
        ipo.listingPriceNse
    );
    if (shouldProbeFeeds && (!ipo.bseCode || !ipo.nseCode || !ipo.listingPriceBse || !ipo.listingPriceNse)) {
        const effectiveListingAt = chIssue.listingAt || ipo.listingAt;
        const feeds = await fetchMoneycontrolExchangeFeeds(ipo.mcScId, ipo.isinCode, effectiveListingAt, ipo.bseCode, ipo.nseCode);
        if (applyExchangeFeedMeta(ipo, feeds.nse, 'nseCode', 'NSEID', 'listingPriceNse', effectiveListingDate)) marketUpdated = true;
        if (applyExchangeFeedMeta(ipo, feeds.bse, 'bseCode', 'BSEID', 'listingPriceBse', effectiveListingDate)) marketUpdated = true;
    }

    if (marketUpdated) {
        console.log(`  ✓ Synced Market Data for ${ipo.name}: ISIN=${ipo.isinCode || '-'}, BSE=${ipo.bseCode || '-'}(List:${ipo.listingPriceBse ?? '-'}), NSE=${ipo.nseCode || '-'}(List:${ipo.listingPriceNse ?? '-'}), MC=${ipo.mcScId || '-'}`);
    }
    return marketUpdated;
}

function isIpoHistoricalComplete(ipo, istTodayStr) {
    if (!ipo || !ipo.listingDate || ipo.listingDate === 'N/A') return false;
    const listMs = new Date(ipo.listingDate).getTime();
    const todayMs = new Date(istTodayStr).getTime();
    if (isNaN(listMs) || isNaN(todayMs)) return false;
    const daysSinceListing = (todayMs - listMs) / (1000 * 60 * 60 * 24);
    if (daysSinceListing <= 7) return false;

    const hasDates = Boolean(ipo.openDate && ipo.closeDate && ipo.openDate !== 'N/A');
    const hasPrice = Boolean(ipo.priceBand && ipo.priceBand !== '₹-' && ipo.lotRaw > 0);
    const hasFin = Boolean(ipo.fin && Object.values(ipo.fin).some(f => f && f.ast && f.ast !== '-'));
    const hasCodes = Boolean(ipo.isinCode || ipo.bseCode || ipo.nseCode);
    const hasListingPx = Boolean(ipo.listingPriceBse || ipo.listingPriceNse);
    return hasDates && hasPrice && hasFin && hasCodes && hasListingPx;
}

async function syncSingleIpoRecord(ipo, istTodayStr) {
    if (!ipo) return false;
    if (ipo.manualLockAll) {
        console.log(`\n🔒 Skipping ${ipo.name} - Entire IPO is manually locked.`);
        return false;
    }

    let updated = false;
    let detailData = null;

    if (ipo.chittorgarhKey) {
        console.log(`\n📡 Checking live data for IPO: ${ipo.name} (${ipo.chittorgarhKey})...`);

        // 1. Live Subscription Data + Details in parallel for speed
        const [liveData, fetchedDetails] = await Promise.all([
            !ipo.manualSub ? get_Chittorgarh_subscription_data(ipo.chittorgarhKey) : Promise.resolve(null),
            get_Chittorgarh_details_data(ipo.chittorgarhKey)
        ]);
        detailData = fetchedDetails;

        if (!ipo.manualSub && liveData) {
            if (!ipo.subShares) ipo.subShares = [];
            const standardCats = ["QIB", "NII", "B-NII(₹10L+)", "S-NII(₹2-10L)", "Retail", "Employee", "Shareholder"];
            standardCats.forEach(catName => {
                if (!ipo.subShares.some(r => r.cat === catName)) {
                    ipo.subShares.push({ cat: catName, off: 0, app: 0 });
                }
            });

            ipo.subShares.forEach(row => {
                if (row.cat === "QIB" && liveData['QIB']) {
                    row.off = liveData['QIB'].off;
                    row.app = liveData['QIB'].app;
                } else if (row.cat === "NII" && liveData['NII']) {
                    row.off = liveData['NII'].off;
                    row.app = liveData['NII'].app;
                } else if (row.cat === "B-NII(₹10L+)") {
                    row.off = liveData['B-NII'] ? liveData['B-NII'].off : 0;
                    row.app = liveData['B-NII'] ? liveData['B-NII'].app : 0;
                } else if (row.cat === "S-NII(₹2-10L)") {
                    row.off = liveData['S-NII'] ? liveData['S-NII'].off : 0;
                    row.app = liveData['S-NII'] ? liveData['S-NII'].app : 0;
                } else if (row.cat === "Retail" && liveData['Retail']) {
                    row.off = liveData['Retail'].off;
                    row.app = liveData['Retail'].app;
                } else if (row.cat === "Employee") {
                    row.off = liveData['Employee'] ? liveData['Employee'].off : 0;
                    row.app = liveData['Employee'] ? liveData['Employee'].app : 0;
                } else if (row.cat === "Shareholder") {
                    row.off = liveData['Shareholder'] ? liveData['Shareholder'].off : 0;
                    row.app = liveData['Shareholder'] ? liveData['Shareholder'].app : 0;
                }
            });
            updated = true;
            console.log(`  ✓ Updated subscription data for ${ipo.name}`);
        } else if (ipo.manualSub) {
            console.log(`  🔒 Subscription is manually locked for ${ipo.name} (Kept custom data)`);
        }

        // 2. Dates, Issue Info, Financials, Lot Sizes & Valuation Ratios
        if (detailData) {
            if (detailData.name && (!ipo.name || ipo.name === 'New IPO' || /\btest\b/i.test(ipo.name))) {
                ipo.name = detailData.name;
                updated = true;
            }
            if (!ipo.manualIssueInfo && detailData.type && (!ipo.type || (ipo.type === 'Mainboard' && detailData.type === 'SME'))) {
                ipo.type = detailData.type;
                updated = true;
            }

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
                    ['fy24', 'fy25', 'fy26', 'jun26'].forEach(fy => {
                        if (detailData.fin[fy] && detailData.fin[fy].ast !== '-') {
                            if (!ipo.fin[fy] || ipo.fin[fy].ast === '-' || ipo.fin[fy].ast === '') {
                                ipo.fin[fy] = detailData.fin[fy];
                                filledAny = true;
                            }
                        }
                    });
                    if (ipo.fin && ipo.fin.fy23) {
                        delete ipo.fin.fy23;
                        filledAny = true;
                    }
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

    if (await enrichIpoMarketData(ipo, detailData, istTodayStr)) {
        updated = true;
    }
    return updated;
}

async function syncAllIposFromChittorgarh(targetIpoId = '') {
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
        const istTodayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

        if (targetIpoId) {
            const matchedKey = Object.keys(dbData).find(k => k.toUpperCase() === targetIpoId.toUpperCase());
            if (!matchedKey) {
                console.warn(`⚠️ Target IPO ID "${targetIpoId}" not found in JSONBin.`);
                return;
            }
            console.log(`🎯 Fast Single-IPO Sync mode for: ${matchedKey}`);
            updated = await syncSingleIpoRecord(dbData[matchedKey], istTodayStr);
        } else {
            const allIds = Object.keys(dbData).filter(id => !isIpoHistoricalComplete(dbData[id], istTodayStr));
            console.log(`📋 Syncing ${allIds.length}/${Object.keys(dbData).length} active or incomplete IPO(s) in batches of 5...`);
            for (let i = 0; i < allIds.length; i += 5) {
                const batch = allIds.slice(i, i + 5);
                const results = await Promise.all(batch.map(id => syncSingleIpoRecord(dbData[id], istTodayStr)));
                if (results.some(Boolean)) updated = true;
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
            console.log("🎉 Successfully synced IPO data to cloud!");
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
const ipoArg = args.find(a => a.startsWith('--ipo='));
const cliTargetIpoId = ipoArg ? ipoArg.split('=')[1].trim().toUpperCase() : '';
const iposOnly = args.includes('--ipos-only') || Boolean(cliTargetIpoId);

let intervalMinutes = 1;
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
        await syncAllIposFromChittorgarh(cliTargetIpoId);
        if (!iposOnly) {
            try {
                await fetchAndSaveFiiDiiData();
            } catch (fiiErr) {
                console.error("⚠️ FII/DII sync error:", fiiErr.message);
            }
            try {
                await fetchAndSaveFnoData();
            } catch (fnoErr) {
                console.error("⚠️ FII F&O sync error:", fnoErr.message);
            }
            try {
                await scrapeIndices();
            } catch (indErr) {
                console.error("⚠️ Indices sync error:", indErr.message);
            }
            try {
                await scrapeIndexStocks();
            } catch (stkErr) {
                console.error("⚠️ Index Stocks sync error:", stkErr.message);
            }
        } else {
            console.log("⚡ Skipped FII/Indices scrapes (fast IPO-only sync mode).");
        }
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

if (process.argv[1] && process.argv[1].endsWith("sync-cron.js")) {
    main();
}

export { 
    syncAllIposFromChittorgarh,
    get_Chittorgarh_details_data,
    get_Chittorgarh_subscription_data,
    getDetailUrl,
    getSubscriptionUrl,
    parseSingleDate,
    parseIpoDateRange
};