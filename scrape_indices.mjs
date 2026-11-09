import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';

const DATA_FILE = path.resolve('indices-data.json');
const HISTORY_FILE = path.resolve('indices-history-data.json');

const SYMBOL_MAP = {
    'NIFTY 50': 'in;NSX',
    'NIFTY BANK': 'in;nbx',
    'NIFTY NEXT 50': 'in;nnx',
    'NIFTY MIDCAP 100': 'in;ccx',
    'NIFTY Midcap 100': 'in;ccx',
    'NIFTY 100': 'in;cjn',
    'NIFTY 200': 'in;cnxt',
    'NIFTY 500': 'in;ncx',
    'NIFTY SMALLCAP 100': 'in;cnxs',
    'NIFTY Smallcap 100': 'in;cnxs',
    'NIFTY MIDCAP 50': 'in;mfy',
    'NIFTY SMALLCAP 50': 'mc;nscapf',
    'NIFTY IT': 'in;cnit',
    'NIFTY AUTO': 'in;cnxa',
    'NIFTY PHARMA': 'in;cpr',
    'NIFTY FMCG': 'in;cfm',
    'NIFTY METAL': 'in;CNXM',
    'NIFTY REALTY': 'in;crl',
    'NIFTY ENERGY': 'in;cgy',
    'NIFTY MEDIA': 'in;cnmx',
    'NIFTY PSU BANK': 'in;nxb',
    'NIFTY FINANCIAL SERVICES': 'in;cnxf',
    'NIFTY FIN SERVICE': 'in;cnxf',
    'NIFTY OIL & GAS': 'mc;oilgas',
    'NIFTY HEALTHCARE': 'mc;helcar',
    'NIFTY CONSUMER DURABLES': 'mc;condur',
    'INDIA VIX': 'in;IDXN',
    'India VIX': 'in;IDXN',
    'SENSEX': 'in;SEN',
    'BSE SENSEX': 'in;SEN',
    'BSE 100': 'in;tkx',
    'BSE SENSEX NEXT 30': 'mc;snt'
};

export function normalizeIndexName(rawName) {
    if (!rawName) return '';
    const clean = rawName.trim().toUpperCase().replace(/\s+/g, ' ');
    if (clean === 'INDIA VIX' || clean === 'VIX') return 'INDIA VIX';
    if (clean === 'SENSEX' || clean === 'BSE SENSEX') return 'SENSEX';
    return clean;
}

function parseMoneycontrolTable(html, exchange) {
    if (!html) return [];
    const $ = cheerio.load(html);
    const list = [];
    const seen = new Set();

    $('tr[data-type]').each((idx, el) => {
        const rawCat = ($(el).attr('data-type') || '').trim();
        const rawName = $(el).find('a').first().text().trim();
        if (!rawName) return;

        const name = normalizeIndexName(rawName);
        const uniqueKey = `${name}_${exchange}`;
        if (seen.has(uniqueKey)) return;
        seen.add(uniqueKey);

        const tds = $(el).find('td').map((i, td) => $(td).text().replace(/\s+/g, ' ').trim()).get();
        const ltp = parseFloat((tds[1] || '0').replace(/,/g, '')) || 0;
        const chg = parseFloat((tds[2] || '0').replace(/,/g, '')) || 0;
        const pchg = parseFloat((tds[3] || '0').replace(/,/g, '')) || 0;
        const open = parseFloat((tds[4] || '0').replace(/,/g, '')) || 0;
        const high = parseFloat((tds[5] || '0').replace(/,/g, '')) || 0;
        const low = parseFloat((tds[6] || '0').replace(/,/g, '')) || 0;
        const yHigh = parseFloat((tds[7] || '0').replace(/,/g, '')) || 0;
        const yLow = parseFloat((tds[8] || '0').replace(/,/g, '')) || 0;

        let category = 'Broad Market';
        const upperCat = rawCat.toUpperCase();
        if (upperCat.includes('SECTORAL') || name.includes('BANK') || name.includes('IT') || name.includes('AUTO') || name.includes('METAL') || name.includes('PHARMA') || name.includes('FMCG') || name.includes('REALTY')) {
            category = 'Sectoral';
        } else if (upperCat.includes('THEMATIC')) {
            category = 'Thematic';
        } else if (upperCat.includes('STRATEGY')) {
            category = 'Strategy';
        }

        if (name === 'NIFTY 50' || name === 'SENSEX' || name === 'NIFTY BANK' || name === 'NIFTY NEXT 50' || name === 'NIFTY MIDCAP 100' || name === 'INDIA VIX' || name === 'BSE 100') {
            category = 'Key Indices';
        }

        list.push({
            name,
            exchange,
            category,
            ltp,
            chg,
            percentChange: pchg,
            open,
            high,
            low,
            previousClose: open ? parseFloat((ltp - chg).toFixed(2)) : 0,
            yearHigh: yHigh,
            yearLow: yLow,
            volume: 0,
            symbol: SYMBOL_MAP[name] || ''
        });
    });

    return list;
}

async function fetchLiveFeed(symbol) {
    if (!symbol) return null;
    try {
        const res = await fetch(`https://priceapi.moneycontrol.com/pricefeed/notapplicable/inidicesindia/${encodeURIComponent(symbol)}`, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        if (res.ok) {
            const json = await res.json();
            return json.data;
        }
    } catch (e) {
        // ignore
    }
    return null;
}

export async function scrapeIndices() {
    console.log('=== Starting Indian Indices Scrape (Moneycontrol Live Source) ===');
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'X-Requested-With': 'XMLHttpRequest'
    };

    const urlNse = 'https://www.moneycontrol.com/markets/indian-indices/changeTableData?deviceType=web&exName=N&selTab=o&selPage=marketLive&classic=true';
    const urlBse = 'https://www.moneycontrol.com/markets/indian-indices/changeTableData?deviceType=web&exName=B&selTab=o&selPage=marketLive&classic=true';

    const [resN, resB, feedSensex, feedNifty, feedBank, feedVix] = await Promise.all([
        fetch(urlNse, { headers }).then(r => r.text()).catch(e => { console.warn('NSE table error:', e.message); return ''; }),
        fetch(urlBse, { headers }).then(r => r.text()).catch(e => { console.warn('BSE table error:', e.message); return ''; }),
        fetchLiveFeed('in;SEN'),
        fetchLiveFeed('in;NSX'),
        fetchLiveFeed('in;nbx'),
        fetchLiveFeed('in;IDXN')
    ]);

    const nseList = parseMoneycontrolTable(resN, 'NSE');
    const bseList = parseMoneycontrolTable(resB, 'BSE');
    const combined = [...nseList, ...bseList];

    function applyFeed(item, feed) {
        if (!item || !feed) return;
        if (feed.pricecurrent) item.ltp = parseFloat(feed.pricecurrent) || item.ltp;
        if (feed.pricechange) item.chg = parseFloat(feed.pricechange) || item.chg;
        if (feed.pricepercentchange) item.percentChange = parseFloat(feed.pricepercentchange) || item.percentChange;
        if (feed.OPEN) item.open = parseFloat(feed.OPEN) || item.open;
        if (feed.HIGH) item.high = parseFloat(feed.HIGH) || item.high;
        if (feed.LOW) item.low = parseFloat(feed.LOW) || item.low;
        if (feed['52wkhi']) item.yearHigh = parseFloat(feed['52wkhi']) || item.yearHigh;
        if (feed['52wklow']) item.yearLow = parseFloat(feed['52wklow']) || item.yearLow;
        if (feed.priceprevclose) item.previousClose = parseFloat(feed.priceprevclose) || item.previousClose;
    }

    const n50 = combined.find(i => i.name === 'NIFTY 50');
    const sen = combined.find(i => i.name === 'SENSEX');
    const bnk = combined.find(i => i.name === 'NIFTY BANK');
    const vix = combined.find(i => i.name === 'INDIA VIX');

    applyFeed(n50, feedNifty);
    applyFeed(sen, feedSensex);
    applyFeed(bnk, feedBank);
    applyFeed(vix, feedVix);

    if (!vix && feedVix) {
        combined.push({
            name: 'INDIA VIX',
            exchange: 'NSE',
            category: 'Key Indices',
            ltp: parseFloat(feedVix.pricecurrent) || 0,
            chg: parseFloat(feedVix.pricechange) || 0,
            percentChange: parseFloat(feedVix.pricepercentchange) || 0,
            open: parseFloat(feedVix.OPEN) || 0,
            high: parseFloat(feedVix.HIGH) || 0,
            low: parseFloat(feedVix.LOW) || 0,
            previousClose: parseFloat(feedVix.priceprevclose) || 0,
            yearHigh: parseFloat(feedVix['52wkhi']) || 0,
            yearLow: parseFloat(feedVix['52wklow']) || 0,
            volume: 0,
            symbol: 'in;IDXN'
        });
    }

    const priority = ['NIFTY 50', 'SENSEX', 'NIFTY BANK', 'NIFTY NEXT 50', 'NIFTY MIDCAP 100', 'INDIA VIX', 'BSE 100'];
    combined.sort((a, b) => {
        const idxA = priority.indexOf(a.name);
        const idxB = priority.indexOf(b.name);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.name.localeCompare(b.name);
    });

    const now = new Date();
    // Indian Market hours check (09:15 to 15:30 IST, Mon-Fri)
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + (now.getTimezoneOffset() * 60 * 1000) + istOffset);
    const dayOfWeek = istNow.getDay();
    const curHour = istNow.getHours();
    const curMin = istNow.getMinutes();
    const curMinutesTotal = curHour * 60 + curMin;
    const isTradingHours = (dayOfWeek >= 1 && dayOfWeek <= 5) && (curMinutesTotal >= 9 * 60 + 15 && curMinutesTotal <= 15 * 60 + 30);

    const result = {
        lastUpdated: now.toISOString(),
        lastUpdatedDisplay: istNow.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
        marketStatus: isTradingHours ? 'LIVE' : 'CLOSED',
        summary: {
            nifty50: combined.find(i => i.name === 'NIFTY 50') || {},
            sensex: combined.find(i => i.name === 'SENSEX') || {},
            niftyBank: combined.find(i => i.name === 'NIFTY BANK') || {},
            indiaVix: combined.find(i => i.name === 'INDIA VIX') || {}
        },
        counts: {
            total: combined.length,
            nse: combined.filter(i => i.exchange === 'NSE').length,
            bse: combined.filter(i => i.exchange === 'BSE').length
        },
        indices: combined
    };

    fs.writeFileSync(DATA_FILE, JSON.stringify(result, null, 2), 'utf-8');
    console.log(`Successfully saved ${combined.length} indices to ${DATA_FILE}`);

    // Cumulative Historical Snapshot Retention
    saveDailyIndicesSnapshot(combined);

    return result;
}

export function saveDailyIndicesSnapshot(indices) {
    if (!indices || indices.length === 0) return;
    try {
        let historyData = { dates: [], dailySnapshots: {} };
        if (fs.existsSync(HISTORY_FILE)) {
            historyData = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
        }

        const now = new Date();
        const istOffset = 5.5 * 60 * 60 * 1000;
        const istDate = new Date(now.getTime() + (now.getTimezoneOffset() * 60 * 1000) + istOffset);
        const day = String(istDate.getDate()).padStart(2, '0');
        const month = String(istDate.getMonth() + 1).padStart(2, '0');
        const year = istDate.getFullYear();
        const dateKey = `${day}-${month}-${year}`;

        const snapshot = indices.map(i => ({
            name: i.name,
            exchange: i.exchange,
            category: i.category,
            close: i.ltp,
            chg: i.chg,
            percentChange: i.percentChange,
            open: i.open,
            high: i.high,
            low: i.low,
            yearHigh: i.yearHigh,
            yearLow: i.yearLow,
            volume: i.volume || 0
        }));

        historyData.dailySnapshots = historyData.dailySnapshots || {};
        historyData.dates = historyData.dates || [];

        // Save today's snapshot
        historyData.dailySnapshots[dateKey] = snapshot;
        if (!historyData.dates.includes(dateKey)) {
            historyData.dates.unshift(dateKey);
        }

        historyData.lastUpdated = now.toISOString();
        historyData.lastUpdatedDisplay = istDate.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
        historyData.totalDates = historyData.dates.length;

        fs.writeFileSync(HISTORY_FILE, JSON.stringify(historyData, null, 2), 'utf8');
        console.log(`Saved daily snapshot for ${dateKey} with ${snapshot.length} indices into ${HISTORY_FILE}`);
    } catch (e) {
        console.warn('Error saving daily indices snapshot:', e.message);
    }
}

if (process.argv[1] && process.argv[1].endsWith('scrape_indices.mjs')) {
    scrapeIndices().catch(err => {
        console.error('Fatal scrape error:', err);
        process.exit(1);
    });
}
