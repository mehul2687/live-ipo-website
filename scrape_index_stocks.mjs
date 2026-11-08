import fs from 'fs';
import path from 'path';

const STOCKS_DATA_FILE = path.resolve('index-stocks-data.json');

const BROWSER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9'
};

// Moneycontrol index constituents endpoint mapping
const INDEX_ENDPOINTS = [
    {
        name: 'NIFTY 50',
        url: 'https://www.moneycontrol.com/markets/indian-indices/top-nse-50-companies-list/9?classic=true&categoryId=1&ex=N'
    },
    {
        name: 'NIFTY BANK',
        url: 'https://www.moneycontrol.com/markets/indian-indices/top-nsebank-companies-list/23?classic=true&categoryId=1&ex=N'
    },
    {
        name: 'SENSEX',
        url: 'https://www.moneycontrol.com/markets/indian-indices/top-bse-sensex-companies-list/4?classic=true&categoryId=1&ex=B'
    },
    {
        name: 'NIFTY NEXT 50',
        url: 'https://www.moneycontrol.com/markets/indian-indices/top-nsenext-50-companies-list/6?classic=true&categoryId=1&ex=N'
    },
    {
        name: 'NIFTY FINANCIAL SERVICES',
        url: 'https://www.moneycontrol.com/markets/indian-indices/top-nifty-financial-services-companies-list/35?classic=true&categoryId=1&ex=N'
    },
    {
        name: 'NIFTY MIDCAP SELECT',
        url: 'https://www.moneycontrol.com/markets/indian-indices/top-nifty-midcap-select-companies-list/127?classic=true&categoryId=1&ex=N'
    },
    {
        name: 'NIFTY SMLCAP 250',
        url: 'https://www.moneycontrol.com/markets/indian-indices/top-nsesmlcap-250-companies-list/114?classic=true&categoryId=6&ex=N'
    },
    {
        name: 'NIFTY IT',
        url: 'https://www.moneycontrol.com/markets/indian-indices/top-nse-it-companies-list/24?classic=true&categoryId=1&ex=N'
    },
    {
        name: 'NIFTY AUTO',
        url: 'https://www.moneycontrol.com/markets/indian-indices/top-nseauto-companies-list/14?classic=true&categoryId=1&ex=N'
    }
];

function parseMoneycontrolTable(html) {
    const stocks = [];
    try {
        const rows = html.match(/<tr[\s\S]*?<\/tr>/gi) || [];
        for (const row of rows) {
            if (row.includes('<th') || !row.includes('<td')) continue;

            const cells = [];
            const tdMatches = row.match(/<td[\s\S]*?<\/td>/gi) || [];
            for (const td of tdMatches) {
                const text = td.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                cells.push(text);
            }

            if (cells.length >= 6) {
                // Typical table: [Company Name, Industry, Last Price, Change, % Change, Open, High, Low, ...]
                const rawName = cells[0];
                const symbolMatch = rawName.match(/\(([^)]+)\)/) || rawName.match(/^([A-Z0-9&-]+)/);
                const symbol = symbolMatch ? symbolMatch[1] : rawName.split(' ')[0];

                const ltp = parseFloat(cells[2].replace(/,/g, '')) || 0;
                const chg = parseFloat(cells[3].replace(/,/g, '')) || 0;
                const pchg = parseFloat(cells[4].replace(/,/g, '').replace(/%/g, '')) || 0;
                const open = parseFloat((cells[5] || '').replace(/,/g, '')) || 0;
                const high = parseFloat((cells[6] || '').replace(/,/g, '')) || 0;
                const low = parseFloat((cells[7] || '').replace(/,/g, '')) || 0;
                const yearHigh = parseFloat((cells[8] || '').replace(/,/g, '')) || 0;
                const yearLow = parseFloat((cells[9] || '').replace(/,/g, '')) || 0;
                const volume = parseInt((cells[10] || '').replace(/,/g, ''), 10) || 0;

                if (ltp > 0) {
                    stocks.push({
                        symbol,
                        name: rawName,
                        sector: cells[1] || 'Equity',
                        ltp,
                        chg,
                        percentChange: pchg,
                        open,
                        high,
                        low,
                        yearHigh,
                        yearLow,
                        volume
                    });
                }
            }
        }
    } catch (err) {
        console.warn('Error parsing MC table:', err.message);
    }
    return stocks;
}

export async function scrapeIndexStocks() {
    console.log('🔄 Starting Index Constituent Stocks scrape...');
    let existingData = {};
    if (fs.existsSync(STOCKS_DATA_FILE)) {
        try {
            existingData = JSON.parse(fs.readFileSync(STOCKS_DATA_FILE, 'utf8'));
        } catch (e) {
            existingData = {};
        }
    }

    if (!existingData.indices) {
        existingData.indices = {};
    }

    for (const item of INDEX_ENDPOINTS) {
        try {
            console.log(`Fetching constituents for ${item.name}...`);
            const res = await fetch(item.url, { headers: BROWSER_HEADERS });
            if (res.ok) {
                const html = await res.text();
                const stocks = parseMoneycontrolTable(html);
                if (stocks.length > 0) {
                    if (!existingData.indices[item.name]) {
                        existingData.indices[item.name] = { name: item.name };
                    }
                    existingData.indices[item.name].stocks = stocks;
                    console.log(`✅ Updated ${stocks.length} stocks for ${item.name}`);
                }
            }
        } catch (err) {
            console.warn(`Could not fetch ${item.name}: ${err.message}`);
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

    fs.writeFileSync(STOCKS_DATA_FILE, JSON.stringify(existingData, null, 2), 'utf8');
    console.log('🎉 Index constituent stocks data updated successfully!');
}

// If run directly: node scrape_index_stocks.mjs
if (process.argv[1] && process.argv[1].endsWith('scrape_index_stocks.mjs')) {
    scrapeIndexStocks();
}
