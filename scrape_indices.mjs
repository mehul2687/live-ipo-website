import fs from 'fs';
import path from 'path';

const DATA_FILE = path.resolve('indices-data.json');

const BROWSER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9'
};

// Known Moneycontrol symbol map for live browser websocket/priceapi
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
    'SENSEX': 'in;SEN',
    'BSE SENSEX': 'in;SEN',
    'BSE 100': 'in;tkx',
    'BSE SENSEX NEXT 30': 'mc;snt'
};

async function fetchNseIndices() {
    console.log('Fetching official NSE allIndices...');
    try {
        const homeRes = await fetch('https://www.nseindia.com', {
            headers: BROWSER_HEADERS
        });
        const setCookies = homeRes.headers.getSetCookie ? homeRes.headers.getSetCookie() : [homeRes.headers.get('set-cookie')];
        const cookieHeader = (setCookies || []).map(c => c ? c.split(';')[0] : '').filter(Boolean).join('; ');

        const apiRes = await fetch('https://www.nseindia.com/api/allIndices', {
            headers: {
                ...BROWSER_HEADERS,
                'Accept': 'application/json, text/plain, */*',
                'Referer': 'https://www.nseindia.com/market-data/live-market-indices',
                'Cookie': cookieHeader
            }
        });

        if (!apiRes.ok) throw new Error(`NSE API status ${apiRes.status}`);
        const data = await apiRes.json();
        return data.data || [];
    } catch (err) {
        console.warn('NSE fetch error:', err.message);
        return [];
    }
}

async function fetchBseSensexPrice() {
    try {
        const res = await fetch('https://priceapi.moneycontrol.com/pricefeed/notapplicable/inidicesindia/in%3BSEN', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        if (res.ok) {
            const json = await res.json();
            return json.data;
        }
    } catch (e) {
        console.warn('SENSEX fetch warning:', e.message);
    }
    return null;
}

async function fetchMoneycontrolBseIndices() {
    console.log('Fetching Moneycontrol BSE indices...');
    try {
        const res = await fetch('https://www.moneycontrol.com/markets/indian-indices/changeTableData?deviceType=web&exName=B&selTab=o&selPage=marketLive&classic=true', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'X-Requested-With': 'XMLHttpRequest'
            }
        });
        if (!res.ok) return [];
        const html = await res.text();
        const trRegex = /<tr[^>]*data-type=["']([^"']+)["'][^>]*>([\s\S]*?)<\/tr>/gi;
        const bseList = [];
        let m;
        while ((m = trRegex.exec(html)) !== null) {
            const category = m[1].trim();
            const row = m[2];
            const nameMatch = row.match(/<a[^>]*>([^<]+)<\/a>/i);
            if (!nameMatch) continue;
            const name = nameMatch[1].trim();

            const tds = [];
            const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
            let tdMatch;
            while ((tdMatch = tdRegex.exec(row)) !== null) {
                tds.push(tdMatch[1].replace(/<[^>]+>/g, '').trim());
            }

            const ltp = tds[1] || '0.00';
            const chg = tds[2] || '0.00';
            const pchg = tds[3] || '0.00';
            const open = tds[4] || '0.00';
            const high = tds[5] || '0.00';
            const low = tds[6] || '0.00';
            const yHigh = tds[7] || '0.00';
            const yLow = tds[8] || '0.00';

            bseList.push({
                name,
                exchange: 'BSE',
                category: category.replace(' Indices', ''),
                ltp: parseFloat(ltp.replace(/,/g, '')) || 0,
                chg: parseFloat(chg.replace(/,/g, '')) || 0,
                percentChange: parseFloat(pchg.replace(/,/g, '')) || 0,
                open: parseFloat(open.replace(/,/g, '')) || 0,
                high: parseFloat(high.replace(/,/g, '')) || 0,
                low: parseFloat(low.replace(/,/g, '')) || 0,
                yearHigh: parseFloat(yHigh.replace(/,/g, '')) || 0,
                yearLow: parseFloat(yLow.replace(/,/g, '')) || 0,
                volume: 0,
                symbol: SYMBOL_MAP[name] || ''
            });
        }
        return bseList;
    } catch (e) {
        console.warn('Moneycontrol BSE fetch warning:', e.message);
        return [];
    }
}

export async function scrapeIndices() {
    console.log('=== Starting Indian Indices Scrape ===');
    const [nseRaw, bseRaw, sensexLive] = await Promise.all([
        fetchNseIndices(),
        fetchMoneycontrolBseIndices(),
        fetchBseSensexPrice()
    ]);

    const formattedList = [];

    // 1. Process NSE Indices
    for (const item of nseRaw) {
        if (!item.index || item.index.includes('NIFTY GS') || item.index.includes('NIFTY BHARAT')) continue;

        let category = 'Broad Market';
        const key = (item.key || '').toUpperCase();
        if (key.includes('SECTORAL') || item.index.includes('AUTO') || item.index.includes('BANK') || item.index.includes('IT') || item.index.includes('METAL') || item.index.includes('PHARMA') || item.index.includes('FMCG') || item.index.includes('REALTY')) {
            category = 'Sectoral';
        } else if (key.includes('THEMATIC')) {
            category = 'Thematic';
        } else if (item.index === 'NIFTY 50' || item.index === 'NIFTY BANK' || item.index === 'NIFTY NEXT 50' || item.index === 'NIFTY MIDCAP 100' || item.index === 'INDIA VIX') {
            category = 'Key Indices';
        }

        formattedList.push({
            name: item.index,
            exchange: 'NSE',
            category,
            ltp: item.last || 0,
            chg: item.variation || 0,
            percentChange: item.percentChange || 0,
            open: item.open || 0,
            high: item.high || 0,
            low: item.low || 0,
            previousClose: item.previousClose || 0,
            yearHigh: item.yearHigh || 0,
            yearLow: item.yearLow || 0,
            volume: item.volume || 0,
            pe: item.pe || '-',
            pb: item.pb || '-',
            advances: item.advances || 0,
            declines: item.declines || 0,
            symbol: SYMBOL_MAP[item.index] || ''
        });
    }

    // 2. Process BSE Indices
    if (bseRaw && bseRaw.length > 0) {
        for (const item of bseRaw) {
            // If SENSEX, use rich live data from priceapi
            if (item.name === 'SENSEX' && sensexLive) {
                item.ltp = parseFloat(sensexLive.pricecurrent) || item.ltp;
                item.chg = parseFloat(sensexLive.pricechange) || item.chg;
                item.percentChange = parseFloat(sensexLive.pricepercentchange) || item.percentChange;
                item.open = parseFloat(sensexLive.OPEN) || item.open;
                item.high = parseFloat(sensexLive.HIGH) || item.high;
                item.low = parseFloat(sensexLive.LOW) || item.low;
                item.yearHigh = parseFloat(sensexLive['52wkhi']) || item.yearHigh;
                item.yearLow = parseFloat(sensexLive['52wklow']) || item.yearLow;
                item.advances = sensexLive.adv || 0;
                item.declines = sensexLive.decl || 0;
                item.symbol = 'in;SEN';
            }
            formattedList.push(item);
        }
    } else if (sensexLive) {
        // Fallback single SENSEX
        formattedList.push({
            name: 'SENSEX',
            exchange: 'BSE',
            category: 'Key Indices',
            ltp: parseFloat(sensexLive.pricecurrent) || 0,
            chg: parseFloat(sensexLive.pricechange) || 0,
            percentChange: parseFloat(sensexLive.pricepercentchange) || 0,
            open: parseFloat(sensexLive.OPEN) || 0,
            high: parseFloat(sensexLive.HIGH) || 0,
            low: parseFloat(sensexLive.LOW) || 0,
            yearHigh: parseFloat(sensexLive['52wkhi']) || 0,
            yearLow: parseFloat(sensexLive['52wklow']) || 0,
            symbol: 'in;SEN'
        });
    }

    // Sort to prioritize Key Indices first (NIFTY 50, SENSEX, NIFTY BANK, etc.)
    const priority = ['NIFTY 50', 'SENSEX', 'NIFTY BANK', 'NIFTY NEXT 50', 'NIFTY MIDCAP 100', 'INDIA VIX', 'BSE 100'];
    formattedList.sort((a, b) => {
        const idxA = priority.indexOf(a.name);
        const idxB = priority.indexOf(b.name);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.name.localeCompare(b.name);
    });

    // Summary Cards Data
    const nifty50 = formattedList.find(i => i.name === 'NIFTY 50') || {};
    const sensex = formattedList.find(i => i.name === 'SENSEX') || {};
    const niftyBank = formattedList.find(i => i.name === 'NIFTY BANK') || {};
    const indiaVix = formattedList.find(i => i.name === 'INDIA VIX') || {};

    const now = new Date();
    const result = {
        lastUpdated: now.toISOString(),
        lastUpdatedDisplay: now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }),
        marketStatus: (now.getDay() === 0 || now.getDay() === 6) ? 'CLOSED' : 'LIVE',
        summary: {
            nifty50,
            sensex,
            niftyBank,
            indiaVix
        },
        counts: {
            total: formattedList.length,
            nse: formattedList.filter(i => i.exchange === 'NSE').length,
            bse: formattedList.filter(i => i.exchange === 'BSE').length
        },
        indices: formattedList
    };

    fs.writeFileSync(DATA_FILE, JSON.stringify(result, null, 2), 'utf-8');
    console.log(`Successfully saved ${formattedList.length} indices to ${DATA_FILE}`);
    return result;
}

if (process.argv[1] && process.argv[1].endsWith('scrape_indices.mjs')) {
    scrapeIndices().catch(err => {
        console.error('Fatal scrape error:', err);
        process.exit(1);
    });
}
