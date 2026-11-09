import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';

const STOCKS_DATA_FILE = path.resolve('index-stocks-data.json');
const INDICES_DATA_FILE = path.resolve('indices-data.json');

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
    { name: 'NIFTY SMLCAP 250', id: '114', ex: 'N', category: 'Broad Market' },
    { name: 'NIFTY IT', id: '19', ex: 'N', category: 'Sectoral' },
    { name: 'NIFTY AUTO', id: '52', ex: 'N', category: 'Sectoral' },
    { name: 'NIFTY PHARMA', id: '41', ex: 'N', category: 'Sectoral' },
    { name: 'NIFTY FMCG', id: '39', ex: 'N', category: 'Sectoral' },
    { name: 'NIFTY METAL', id: '51', ex: 'N', category: 'Sectoral' },
    { name: 'NIFTY REALTY', id: '34', ex: 'N', category: 'Sectoral' },
    { name: 'NIFTY ENERGY', id: '40', ex: 'N', category: 'Sectoral' },
    { name: 'NIFTY PSU BANK', id: '43', ex: 'N', category: 'Sectoral' },
    { name: 'NIFTY MIDCAP 100', id: '27', ex: 'N', category: 'Broad Market' },
    { name: 'NIFTY 100', id: '28', ex: 'N', category: 'Broad Market' },
    { name: 'NIFTY 200', id: '49', ex: 'N', category: 'Broad Market' },
    { name: 'NIFTY 500', id: '7', ex: 'N', category: 'Broad Market' },
    { name: 'BSE 100', id: '1', ex: 'B', category: 'Key Indices' },
    { name: 'BSE 200', id: '2', ex: 'B', category: 'Broad Market' },
    { name: 'BSE 500', id: '12', ex: 'B', category: 'Broad Market' }
];

function cleanNumber(str) {
    if (!str) return 0;
    return parseFloat(str.replace(/,/g, '').replace(/%/g, '').trim()) || 0;
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
        // Extract sector from href: /india/stockpricequote/<sector>/<name>/<code>
        let sector = 'Equity';
        const secMatch = href.match(/\/stockpricequote\/([^\/]+)\//);
        if (secMatch && secMatch[1]) {
            sector = secMatch[1]
                .replace(/-/g, ' ')
                .replace(/\b\w/g, l => l.toUpperCase());
        }

        // Symbol guess or fallback
        const codeMatch = href.match(/\/([^\/]+)$/);
        const symbol = codeMatch && codeMatch[1] ? codeMatch[1].toUpperCase() : rawName.split(' ')[0].toUpperCase();

        const ltp = cleanNumber($(tds[1]).text());
        const pchg = cleanNumber($(tds[2]).text());
        const chg = cleanNumber($(tds[3]).text());
        const vol = parseInt(($(tds[4]).text() || '0').replace(/,/g, ''), 10) || 0;

        if (ltp > 0) {
            stocks.push({
                symbol: symbol.length <= 15 ? symbol : rawName.split(' ')[0].toUpperCase(),
                name: rawName,
                sector,
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

export async function scrapeIndexStocks() {
    console.log('🔄 Starting Index Constituent Stocks scrape from Moneycontrol...');

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

    for (const item of TARGET_INDICES) {
        try {
            const endpoint = `https://www.moneycontrol.com/markets/indian-indices/changeTableData?deviceType=web&exName=${item.ex}&indicesID=${item.id}&selTab=o&selPage=marketTerminal&classic=true`;
            console.log(`Fetching constituents for ${item.name} (ID: ${item.id})...`);
            
            const res = await fetch(endpoint, { headers: BROWSER_HEADERS });
            if (res.ok) {
                const html = await res.text();
                const stocks = parseConstituentStocks(html);
                if (stocks.length > 0) {
                    const normName = item.name.toUpperCase().trim();
                    const liveIdx = indicesDataMap[normName] || {};

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
            }
        } catch (err) {
            console.warn(`Could not fetch constituents for ${item.name}: ${err.message}`);
        }
    }

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
    existingData.marketStatus = 'CLOSED';

    fs.writeFileSync(STOCKS_DATA_FILE, JSON.stringify(existingData, null, 2), 'utf8');
    console.log('🎉 Index constituent stocks data updated successfully!');
}

if (process.argv[1] && process.argv[1].endsWith('scrape_index_stocks.mjs')) {
    scrapeIndexStocks();
}
