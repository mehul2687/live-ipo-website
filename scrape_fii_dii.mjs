import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';

async function fetchAndSaveFiiDiiData() {
    try {
        console.log("Fetching FII/DII data from Moneycontrol...");
        const url = 'https://www.moneycontrol.com/markets/fii-dii-data/cash/';
        const res = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            },
            timeout: 12000
        });

        const $ = cheerio.load(res.data);
        const nextData = $('#__NEXT_DATA__').html();
        if (!nextData) throw new Error("No __NEXT_DATA__ found on Moneycontrol");

        const json = JSON.parse(nextData);
        const rawDaily = json.props?.pageProps?.FiiDiiData?.fiiDiiData || [];

        const parseNum = (val) => {
            if (val === null || val === undefined) return 0;
            if (typeof val === 'number') return val;
            return parseFloat(String(val).replace(/,/g, '')) || 0;
        };

        const formatINR = (num) => {
            return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        };

        // 1. Process Newly Scraped Daily Records
        const newlyFetchedDaily = rawDaily.map(item => {
            const parts = (item.date || '').split('-');
            const yyyy = parts[0] || '';
            const mm = parts[1] || '';
            const dd = parts[2] || '';
            const displayDate = dd && mm && yyyy ? `${dd}-${mm}-${yyyy}` : item.date;

            const fiiBuy = parseNum(item.fiiPurchase);
            const fiiSell = parseNum(item.fiiSales);
            const fiiNet = parseNum(item.fiiNet);

            const diiBuy = parseNum(item.diiPurchase);
            const diiSell = parseNum(item.diiSale);
            const diiNet = parseNum(item.diiNet);

            const totalNet = fiiNet + diiNet;

            return {
                date: displayDate,
                isoDate: item.date,
                year: yyyy,
                month: `${yyyy}-${mm}`,
                monthName: item.graphToolTipRecordDate ? item.graphToolTipRecordDate.split(',')[0] : displayDate,
                fiiBuy: formatINR(fiiBuy),
                fiiSell: formatINR(fiiSell),
                fiiNet: formatINR(fiiNet),
                diiBuy: formatINR(diiBuy),
                diiSell: formatINR(diiSell),
                diiNet: formatINR(diiNet),
                totalNet: formatINR(totalNet),
                rawFiiBuy: fiiBuy,
                rawFiiSell: fiiSell,
                rawFiiNet: fiiNet,
                rawDiiBuy: diiBuy,
                rawDiiSell: diiSell,
                rawDiiNet: diiNet,
                rawTotalNet: totalNet,
                niftyClose: item.niftyClose || '-'
            };
        });

        // 2. Load Existing Historical Records from Storage (Permanent History Retention)
        const historyMap = new Map();
        if (fs.existsSync('fii-dii-data.json')) {
            try {
                const oldContent = fs.readFileSync('fii-dii-data.json', 'utf8');
                const oldJson = JSON.parse(oldContent);
                if (Array.isArray(oldJson.daily)) {
                    oldJson.daily.forEach(item => {
                        const key = item.isoDate || item.date;
                        if (key) {
                            historyMap.set(key, item);
                        }
                    });
                    console.log(`ℹ Found ${historyMap.size} existing historical records in storage.`);
                }
            } catch (err) {
                console.warn("⚠️ Notice: Could not read previous history, initializing new dataset:", err.message);
            }
        }

        // 3. Merge Strategy:
        // Update current records with latest figures, but PRESERVE all older historical records
        // even if Moneycontrol stops showing them after 30-60 days.
        newlyFetchedDaily.forEach(item => {
            const key = item.isoDate || item.date;
            if (key) {
                historyMap.set(key, item);
            }
        });

        // 4. Sort All Combined Records Descending (Latest date first)
        const cumulativeDaily = Array.from(historyMap.values()).sort((a, b) => {
            const dateA = a.isoDate || a.date || '';
            const dateB = b.isoDate || b.date || '';
            return dateB.localeCompare(dateA);
        });

        console.log(`✓ Cumulative total daily records preserved: ${cumulativeDaily.length}`);

        // 5. Compute Permanent Monthly Aggregates across Entire History
        const monthMap = {};
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

        cumulativeDaily.forEach(d => {
            const mKey = d.month; // e.g. "2026-11"
            if (!mKey) return;

            if (!monthMap[mKey]) {
                const [y, m] = mKey.split('-');
                const mIdx = parseInt(m, 10) - 1;
                const label = mIdx >= 0 && mIdx < 12 ? `${monthNames[mIdx]} ${y}` : mKey;

                monthMap[mKey] = {
                    key: mKey,
                    label: label,
                    fiiBuy: 0,
                    fiiSell: 0,
                    fiiNet: 0,
                    diiBuy: 0,
                    diiSell: 0,
                    diiNet: 0,
                    totalNet: 0,
                    count: 0
                };
            }

            monthMap[mKey].fiiBuy += (d.rawFiiBuy || parseNum(d.fiiBuy));
            monthMap[mKey].fiiSell += (d.rawFiiSell || parseNum(d.fiiSell));
            monthMap[mKey].fiiNet += (d.rawFiiNet || parseNum(d.fiiNet));
            monthMap[mKey].diiBuy += (d.rawDiiBuy || parseNum(d.diiBuy));
            monthMap[mKey].diiSell += (d.rawDiiSell || parseNum(d.diiSell));
            monthMap[mKey].diiNet += (d.rawDiiNet || parseNum(d.diiNet));
            monthMap[mKey].totalNet += (d.rawTotalNet || parseNum(d.totalNet));
            monthMap[mKey].count++;
        });

        const cumulativeMonthly = Object.values(monthMap).sort((a, b) => b.key.localeCompare(a.key)).map(m => ({
            date: m.label,
            fiiBuy: formatINR(m.fiiBuy),
            fiiSell: formatINR(m.fiiSell),
            fiiNet: formatINR(m.fiiNet),
            diiBuy: formatINR(m.diiBuy),
            diiSell: formatINR(m.diiSell),
            diiNet: formatINR(m.diiNet),
            totalNet: formatINR(m.totalNet),
            rawFiiNet: m.fiiNet,
            rawDiiNet: m.diiNet,
            rawTotalNet: m.totalNet,
            tradingDays: m.count
        }));

        // 6. Compute Permanent Yearly Aggregates across Entire History
        const yearMap = {};
        cumulativeDaily.forEach(d => {
            const y = d.year;
            if (!y) return;

            if (!yearMap[y]) {
                yearMap[y] = {
                    year: y,
                    fiiBuy: 0,
                    fiiSell: 0,
                    fiiNet: 0,
                    diiBuy: 0,
                    diiSell: 0,
                    diiNet: 0,
                    totalNet: 0,
                    count: 0
                };
            }

            yearMap[y].fiiBuy += (d.rawFiiBuy || parseNum(d.fiiBuy));
            yearMap[y].fiiSell += (d.rawFiiSell || parseNum(d.fiiSell));
            yearMap[y].fiiNet += (d.rawFiiNet || parseNum(d.fiiNet));
            yearMap[y].diiBuy += (d.rawDiiBuy || parseNum(d.diiBuy));
            yearMap[y].diiSell += (d.rawDiiSell || parseNum(d.diiSell));
            yearMap[y].diiNet += (d.rawDiiNet || parseNum(d.diiNet));
            yearMap[y].totalNet += (d.rawTotalNet || parseNum(d.totalNet));
            yearMap[y].count++;
        });

        const cumulativeYearly = Object.values(yearMap).sort((a, b) => b.year.localeCompare(a.year)).map(y => ({
            date: `FY ${y.year}`,
            fiiBuy: formatINR(y.fiiBuy),
            fiiSell: formatINR(y.fiiSell),
            fiiNet: formatINR(y.fiiNet),
            diiBuy: formatINR(y.diiBuy),
            diiSell: formatINR(y.diiSell),
            diiNet: formatINR(y.diiNet),
            totalNet: formatINR(y.totalNet),
            rawFiiNet: y.fiiNet,
            rawDiiNet: y.diiNet,
            rawTotalNet: y.totalNet,
            tradingDays: y.count
        }));

        // 7. Assemble Permanent Cumulative Dataset
        const latestRow = cumulativeDaily[0] || {};
        const resultData = {
            updatedAt: new Date().toISOString(),
            source: "Moneycontrol Cash Market (Permanent Cumulative Storage)",
            currency: "₹ in Crores",
            summary: {
                latestDate: latestRow.date || '',
                latestFiiNet: latestRow.fiiNet || '0',
                latestDiiNet: latestRow.diiNet || '0',
                latestTotalNet: latestRow.totalNet || '0',
                rawLatestFiiNet: latestRow.rawFiiNet || 0,
                rawLatestDiiNet: latestRow.rawDiiNet || 0,
                rawLatestTotalNet: latestRow.rawTotalNet || 0,
                totalRecordedDays: cumulativeDaily.length
            },
            daily: cumulativeDaily,
            monthly: cumulativeMonthly,
            yearly: cumulativeYearly
        };

        fs.writeFileSync('fii-dii-data.json', JSON.stringify(resultData, null, 2), 'utf8');
        console.log(`✓ fii-dii-data.json permanently saved! Cumulative totals: ${cumulativeDaily.length} days, ${cumulativeMonthly.length} months, ${cumulativeYearly.length} years.`);
        return resultData;
    } catch (e) {
        console.error("Error scraping and saving FII/DII data:", e.message);
        return null;
    }
}

if (process.argv[1] && process.argv[1].endsWith("scrape_fii_dii.mjs")) {
    fetchAndSaveFiiDiiData();
}

export { fetchAndSaveFiiDiiData };
