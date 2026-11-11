import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';

const STOCKS_DATA_FILE = path.resolve('index-stocks-data.json');
const INDICES_DATA_FILE = path.resolve('indices-data.json');
const STOCK_MASTER_FILE = path.resolve('stock_master.json');

const BROWSER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'X-Requested-With': 'XMLHttpRequest'
};

// Key Indices to pre-scrape into index-stocks-data.json
const TARGET_INDICES = [
    { name: 'NIFTY 50', id: '9', ex: 'N', category: 'Key Indices' },
    { name: 'NIFTY BANK', id: '23', ex: 'N', category: 'Key Indices' },
    { name: 'SENSEX', id: '4', ex: 'B', category: 'Key Indices' },
    { name: 'NIFTY NEXT 50', id: '6', ex: 'N', category: 'Key Indices' },
    { name: 'NIFTY FINANCIAL SERVICES', id: '47', ex: 'N', category: 'Key Indices' },
    { name: 'NIFTY MIDCAP SELECT', id: '128', ex: 'N', category: 'Key Indices' },
    { name: 'NIFTY INDIA FPI 150', id: '143', ex: 'N', category: 'Broad Market' },
    { name: 'NIFTY SMLCAP 250', id: '114', ex: 'N', category: 'Broad Market' },
    { name: 'NIFTY IT', id: '19', ex: 'N', category: 'Sectoral' },
    { name: 'NIFTY AUTO', id: '52', ex: 'N', category: 'Sectoral' },
    { name: 'NIFTY PHARMA', id: '41', ex: 'N', category: 'Sectoral' },
    { name: 'NIFTY FMCG', id: '39', ex: 'N', category: 'Sectoral' },
    { name: 'NIFTY METAL', id: '51', ex: 'N', category: 'Sectoral' },
    { name: 'NIFTY REALTY', id: '34', ex: 'N', category: 'Sectoral' },
    { name: 'NIFTY ENERGY', id: '38', ex: 'N', category: 'Sectoral' },
    { name: 'NIFTY PSU BANK', id: '43', ex: 'N', category: 'Sectoral' },
    { name: 'NIFTY MIDCAP 100', id: '27', ex: 'N', category: 'Broad Market' },
    { name: 'NIFTY 100', id: '28', ex: 'N', category: 'Broad Market' },
    { name: 'NIFTY 200', id: '49', ex: 'N', category: 'Broad Market' },
    { name: 'NIFTY 500', id: '7', ex: 'N', category: 'Broad Market' },
    { name: 'BSE 100', id: '1', ex: 'B', category: 'Key Indices' },
    { name: 'BSE 200', id: '2', ex: 'B', category: 'Broad Market' },
    { name: 'BSE 500', id: '12', ex: 'B', category: 'Broad Market' },
    { name: 'BSE SME IPO', id: '58', ex: 'B', category: 'Thematic' }
];

let stockMaster = {};
if (fs.existsSync(STOCK_MASTER_FILE)) {
    try {
        stockMaster = JSON.parse(fs.readFileSync(STOCK_MASTER_FILE, 'utf8'));
    } catch (e) {
        stockMaster = {};
    }
}

function cleanNumber(str) {
    if (!str) return 0;
    return parseFloat(str.replace(/,/g, '').replace(/%/g, '').trim()) || 0;
}

export function resolveStockIdentity(rawName, master = stockMaster) {
    if (!rawName) return { symbol: 'STOCK', name: 'Unknown', sector: 'Equity' };

    const cleanRaw = rawName.toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

    if (master) {
        if (master[cleanRaw]) return master[cleanRaw];
        const words = cleanRaw.split(' ');
        if (words.length >= 2) {
            const first2 = words.slice(0, 2).join(' ');
            if (master[first2]) return master[first2];
        }
        for (const [k, v] of Object.entries(master)) {
            if (k.length >= 6 && (cleanRaw.startsWith(k) || k.startsWith(cleanRaw))) {
                return v;
            }
        }
    }

    // Clean uppercase name for SME IPO / newly listed companies (NEVER internal codes!)
    let displayTitle = rawName.toUpperCase().trim();
    let displaySubtitle = rawName.trim();
    if (!displaySubtitle.toLowerCase().includes('ltd') && !displaySubtitle.toLowerCase().includes('limited')) {
        displaySubtitle += ' Ltd.';
    }

    return {
        symbol: displayTitle,
        name: displaySubtitle,
        sector: 'Equity'
    };
}

function parseConstituentStocks(html) {
    if (!html) return [];
    const $ = cheerio.load(html);
    const stocks = [];

    $('tr').each((idx, el) => {
        if ($(el).find('th').length > 0) return;
        const tds = $(el).find('td');
        if (tds.length < 5) return;

        const firstTd = $(tds[0]);
        const aTag = firstTd.find('a');
        const rawName = (aTag.length ? aTag.text() : firstTd.text()).trim();
        if (!rawName || rawName === 'No Data Available') return;

        const href = aTag.attr('href') || '';
        let parsedSector = 'Equity';
        const secMatch = href.match(/\/stockpricequote\/([^\/]+)\//);
        if (secMatch && secMatch[1]) {
            parsedSector = secMatch[1]
                .replace(/-/g, ' ')
                .replace(/\b\w/g, l => l.toUpperCase());
        }

        // Resolve clean company identity and real ticker (NEVER codes like MTL11, PPE01, AE13)
        const identity = resolveStockIdentity(rawName, stockMaster);

        const ltpIdAttr = $(el).find('td[id^="ltp_"]').attr('id') || '';
        const scIdMatch = ltpIdAttr.match(/^ltp_([^_]+)_/);
        const mcScId = scIdMatch ? scIdMatch[1] : '';

        const ltp = cleanNumber($(tds[1]).text());
        const pchg = cleanNumber($(tds[2]).text());
        const chg = cleanNumber($(tds[3]).text());
        const vol = parseInt(($(tds[4]).text() || '0').replace(/,/g, ''), 10) || 0;

        if (ltp > 0) {
            stocks.push({
                mcScId,
                symbol: identity.symbol,
                name: identity.name,
                sector: identity.sector && identity.sector !== 'Equity' ? identity.sector : parsedSector,
                ltp,
                chg,
                percentChange: pchg,
                open: 0,
                high: 0,
                low: 0,
                yearHigh: 0,
                yearLow: 0,
                volume: vol
            });
        }
    });

    return stocks;
}

async function runWithConcurrency(items, concurrency, worker) {
    let idx = 0;
    const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
        while (idx < items.length) {
            const current = idx++;
            await worker(items[current]);
        }
    });
    await Promise.all(workers);
}

async function fetchLiveStockQuote(exPath, mcScId) {
    if (!mcScId) return null;
    try {
        const url = `https://priceapi.moneycontrol.com/pricefeed/${exPath}/equitycash/${encodeURIComponent(mcScId)}`;
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            signal: AbortSignal.timeout(5000)
        });
        if (!res.ok) return null;
        const json = await res.json();
        return json && json.data ? json.data : null;
    } catch {
        return null;
    }
}

export async function scrapeIndexStocks() {
    console.log('🔄 Starting Index Constituent Stocks scrape from Moneycontrol with proper names...');

    let existingData = { lastUpdated: '', indices: {} };
    if (fs.existsSync(STOCKS_DATA_FILE)) {
        try {
            existingData = JSON.parse(fs.readFileSync(STOCKS_DATA_FILE, 'utf8'));
        } catch (e) {
            existingData = { indices: {} };
        }
    }
    if (!existingData.indices) existingData.indices = {};

    // Read latest index prices from indices-data.json
    let indicesDataMap = {};
    if (fs.existsSync(INDICES_DATA_FILE)) {
        try {
            const rawIdx = JSON.parse(fs.readFileSync(INDICES_DATA_FILE, 'utf8'));
            if (rawIdx.indices && Array.isArray(rawIdx.indices)) {
                rawIdx.indices.forEach(idx => {
                    indicesDataMap[idx.name.toUpperCase().trim()] = idx;
                });
            }
        } catch (e) {
            console.warn('Could not read indices-data.json:', e.message);
        }
    }

    const scrapedEntries = [];
    const uniqueQuoteRequests = new Map();

    await runWithConcurrency(TARGET_INDICES, 6, async (item) => {
        try {
            const endpoint = `https://www.moneycontrol.com/markets/indian-indices/changeTableData?deviceType=web&exName=${item.ex}&indicesID=${item.id}&selTab=o&selPage=marketTerminal&classic=true&_=${Date.now()}`;
            console.log(`Fetching constituents for ${item.name} (ID: ${item.id})...`);

            const res = await fetch(endpoint, { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(10000) });
            if (res.ok) {
                const html = await res.text();
                const stocks = parseConstituentStocks(html);
                if (stocks.length > 0) {
                    const exPath = item.ex === 'B' ? 'bse' : 'nse';
                    stocks.forEach(s => {
                        if (s.mcScId) {
                            const cacheKey = `${exPath}:${s.mcScId}`;
                            if (!uniqueQuoteRequests.has(cacheKey)) {
                                uniqueQuoteRequests.set(cacheKey, { exPath, mcScId: s.mcScId });
                            }
                        }
                    });
                    scrapedEntries.push({ item, stocks, exPath });
                }
            }
        } catch (err) {
            console.warn(`Could not fetch constituents for ${item.name}: ${err.message}`);
        }
    });

    // Enrich unique constituent stocks with Open, High, Low, 52W High/Low and latest live PriceAPI ticks
    const liveQuoteMap = new Map();
    const quoteList = Array.from(uniqueQuoteRequests.entries());
    console.log(`⚡ Fetching live OHLC/52W quotes for ${quoteList.length} unique stocks...`);

    await runWithConcurrency(quoteList, 35, async ([cacheKey, req]) => {
        const d = await fetchLiveStockQuote(req.exPath, req.mcScId);
        if (d) liveQuoteMap.set(cacheKey, d);
    });

    for (const { item, stocks, exPath } of scrapedEntries) {
        stocks.forEach(s => {
            const d = s.mcScId ? liveQuoteMap.get(`${exPath}:${s.mcScId}`) : null;
            if (!d) return;

            const ltp = cleanNumber(d.pricecurrent);
            if (ltp > 0) s.ltp = ltp;
            if (d.pricechange !== undefined && d.pricechange !== '-') {
                s.chg = cleanNumber(d.pricechange);
            }
            if (d.pricepercentchange !== undefined && d.pricepercentchange !== '-') {
                s.percentChange = cleanNumber(d.pricepercentchange);
            }
            const opn = cleanNumber(d.OPN);
            const hp = cleanNumber(d.HP);
            const lp = cleanNumber(d.LP);
            const yh = cleanNumber(d['52H']);
            const yl = cleanNumber(d['52L']);
            const vol = parseInt(String(d.VOL || '0').replace(/,/g, ''), 10) || 0;
            if (opn > 0) s.open = opn;
            if (hp > 0) s.high = hp;
            if (lp > 0) s.low = lp;
            if (yh > 0) s.yearHigh = yh;
            if (yl > 0) s.yearLow = yl;
            if (vol > 0) s.volume = vol;

            if (exPath === 'nse' && d.NSEID && /^[A-Z0-9&-]{2,20}$/.test(d.NSEID.trim())) {
                if (!s.symbol || s.symbol.includes(' ') || s.symbol.length > 14) {
                    s.symbol = d.NSEID.trim();
                }
            }
        });

        const normName = item.name.toUpperCase().trim();
        const aliasMap = { 'NIFTY FINANCIAL SERVICES': 'NIFTY FIN SERVICE', 'NIFTY MIDCAP SELECT': 'NIFTY MID SELECT' };
        const liveIdx = indicesDataMap[normName] || indicesDataMap[aliasMap[normName]] || {};

        let advances = 0;
        let declines = 0;
        stocks.forEach(s => {
            if (s.chg >= 0) advances++;
            else declines++;
        });

        existingData.indices[item.name] = {
            name: item.name,
            exchange: item.ex === 'B' ? 'BSE' : 'NSE',
            category: item.category || 'Index',
            ltp: liveIdx.ltp || (existingData.indices[item.name] ? existingData.indices[item.name].ltp : 0),
            chg: liveIdx.chg !== undefined ? liveIdx.chg : 0,
            percentChange: liveIdx.percentChange !== undefined ? liveIdx.percentChange : 0,
            open: liveIdx.open || 0,
            high: liveIdx.high || 0,
            low: liveIdx.low || 0,
            yearHigh: liveIdx.yearHigh || 0,
            yearLow: liveIdx.yearLow || 0,
            advances,
            declines,
            totalStocks: stocks.length,
            stocks
        };
        console.log(`✅ Updated ${stocks.length} stocks for ${item.name}`);
    }

    const istDate = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
    const day = istDate.getUTCDay();
    const mins = istDate.getUTCHours() * 60 + istDate.getUTCMinutes();
    const isMarketOpen = day >= 1 && day <= 5 && mins >= 555 && mins <= 930;

    existingData.lastUpdated = new Date().toISOString();
    existingData.lastUpdatedDisplay = new Date().toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
    existingData.marketStatus = isMarketOpen ? 'LIVE' : 'CLOSED';

    fs.writeFileSync(STOCKS_DATA_FILE, JSON.stringify(existingData, null, 2), 'utf8');
    console.log('🎉 Index constituent stocks data updated successfully with proper names!');
}

if (process.argv[1] && process.argv[1].endsWith('scrape_index_stocks.mjs')) {
    scrapeIndexStocks();
}
