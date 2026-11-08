import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';

async function fetchAndSaveFnoData() {
    try {
        console.log("Fetching FII F&O data from Moneycontrol...");
        const url = 'https://www.moneycontrol.com/markets/fii-dii-data/futures-and-options/';
        const res = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            },
            timeout: 15000
        });

        const $ = cheerio.load(res.data);
        const nextData = $('#__NEXT_DATA__').html();
        if (!nextData) throw new Error("No __NEXT_DATA__ found on Moneycontrol F&O page");

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

        // 1. Process Newly Scraped Daily F&O Records
        const newlyFetchedDaily = rawDaily.map(item => {
            const parts = (item.date || '').split('-');
            const yyyy = parts[0] || '';
            const mm = parts[1] || '';
            const dd = parts[2] || '';
            const displayDate = dd && mm && yyyy ? `${dd}-${mm}-${yyyy}` : item.date;

            const futBuy = parseNum(item.futPurchase);
            const futSell = parseNum(item.futSales);
            const futNet = parseNum(item.futNet);

            const optBuy = parseNum(item.optPurchase);
            const optSell = parseNum(item.optSale);
            const optNet = parseNum(item.optNet);

            const totalNet = futNet + optNet;

            return {
                date: displayDate,
                isoDate: item.date,
                year: yyyy,
                month: `${yyyy}-${mm}`,
                monthName: item.graphToolTipRecordDate ? item.graphToolTipRecordDate.split(',')[0] : displayDate,
                futBuy: formatINR(futBuy),
                futSell: formatINR(futSell),
                futNet: formatINR(futNet),
                optBuy: formatINR(optBuy),
                optSell: formatINR(optSell),
                optNet: formatINR(optNet),
                totalNet: formatINR(totalNet),
                rawFutBuy: futBuy,
                rawFutSell: futSell,
                rawFutNet: futNet,
                rawOptBuy: optBuy,
                rawOptSell: optSell,
                rawOptNet: optNet,
                rawTotalNet: totalNet,
                indexClose: item.indexClose || '-',
                indexPrevClose: item.indexPrevClose || '-',
                indexChangePer: item.indexChangePer || '0'
            };
        });

        // 2. Load Existing Historical F&O Records from Storage (Permanent History Retention)
        const historyMap = new Map();
        if (fs.existsSync('fii-dii-fno-data.json')) {
            try {
                const oldContent = fs.readFileSync('fii-dii-fno-data.json', 'utf8');
                const oldJson = JSON.parse(oldContent);
                if (Array.isArray(oldJson.daily)) {
                    oldJson.daily.forEach(item => {
                        const key = item.isoDate || item.date;
                        if (key) {
                            historyMap.set(key, item);
                        }
                    });
                    console.log(`ℹ Found ${historyMap.size} existing historical F&O records in storage.`);
                }
            } catch (err) {
                console.warn("⚠️ Notice: Could not read previous F&O history, initializing new dataset:", err.message);
            }
        }

        // 3. Merge Strategy (Update latest figures, preserve all older history)
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

        console.log(`✓ Cumulative total daily F&O records preserved: ${cumulativeDaily.length}`);

        // 5. Compute Permanent Monthly Aggregates across Entire History
        const monthMap = {};
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

        cumulativeDaily.forEach(d => {
            const mKey = d.month;
            if (!mKey) return;

            if (!monthMap[mKey]) {
                const [y, m] = mKey.split('-');
                const mIdx = parseInt(m, 10) - 1;
                const label = mIdx >= 0 && mIdx < 12 ? `${monthNames[mIdx]} ${y}` : mKey;

                monthMap[mKey] = {
                    key: mKey,
                    label: label,
                    futBuy: 0,
                    futSell: 0,
                    futNet: 0,
                    optBuy: 0,
                    optSell: 0,
                    optNet: 0,
                    totalNet: 0,
                    count: 0
                };
            }

            monthMap[mKey].futBuy += (d.rawFutBuy || parseNum(d.futBuy));
            monthMap[mKey].futSell += (d.rawFutSell || parseNum(d.futSell));
            monthMap[mKey].futNet += (d.rawFutNet || parseNum(d.futNet));
            monthMap[mKey].optBuy += (d.rawOptBuy || parseNum(d.optBuy));
            monthMap[mKey].optSell += (d.rawOptSell || parseNum(d.optSell));
            monthMap[mKey].optNet += (d.rawOptNet || parseNum(d.optNet));
            monthMap[mKey].totalNet += (d.rawTotalNet || parseNum(d.totalNet));
            monthMap[mKey].count++;
        });

        const cumulativeMonthly = Object.values(monthMap).sort((a, b) => b.key.localeCompare(a.key)).map(m => ({
            date: m.label,
            futBuy: formatINR(m.futBuy),
            futSell: formatINR(m.futSell),
            futNet: formatINR(m.futNet),
            optBuy: formatINR(m.optBuy),
            optSell: formatINR(m.optSell),
            optNet: formatINR(m.optNet),
            totalNet: formatINR(m.totalNet),
            rawFutNet: m.futNet,
            rawOptNet: m.optNet,
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
                    futBuy: 0,
                    futSell: 0,
                    futNet: 0,
                    optBuy: 0,
                    optSell: 0,
                    optNet: 0,
                    totalNet: 0,
                    count: 0
                };
            }

            yearMap[y].futBuy += (d.rawFutBuy || parseNum(d.futBuy));
            yearMap[y].futSell += (d.rawFutSell || parseNum(d.futSell));
            yearMap[y].futNet += (d.rawFutNet || parseNum(d.futNet));
            yearMap[y].optBuy += (d.rawOptBuy || parseNum(d.optBuy));
            yearMap[y].optSell += (d.rawOptSell || parseNum(d.optSell));
            yearMap[y].optNet += (d.rawOptNet || parseNum(d.optNet));
            yearMap[y].totalNet += (d.rawTotalNet || parseNum(d.totalNet));
            yearMap[y].count++;
        });

        const cumulativeYearly = Object.values(yearMap).sort((a, b) => b.year.localeCompare(a.year)).map(y => ({
            date: `FY ${y.year}`,
            futBuy: formatINR(y.futBuy),
            futSell: formatINR(y.futSell),
            futNet: formatINR(y.futNet),
            optBuy: formatINR(y.optBuy),
            optSell: formatINR(y.optSell),
            optNet: formatINR(y.optNet),
            totalNet: formatINR(y.totalNet),
            rawFutNet: y.futNet,
            rawOptNet: y.optNet,
            rawTotalNet: y.totalNet,
            tradingDays: y.count
        }));

        // 7. Assemble Permanent Cumulative F&O Dataset
        const latestRow = cumulativeDaily[0] || {};
        const resultData = {
            updatedAt: new Date().toISOString(),
            source: "Moneycontrol Futures & Options (Permanent Cumulative Storage)",
            currency: "₹ in Crores",
            summary: {
                latestDate: latestRow.date || '',
                latestFutNet: latestRow.futNet || '0',
                latestOptNet: latestRow.optNet || '0',
                latestTotalNet: latestRow.totalNet || '0',
                rawLatestFutNet: latestRow.rawFutNet || 0,
                rawLatestOptNet: latestRow.rawOptNet || 0,
                rawLatestTotalNet: latestRow.rawTotalNet || 0,
                totalRecordedDays: cumulativeDaily.length,
                indexClose: latestRow.indexClose || '-',
                indexChangePer: latestRow.indexChangePer || '0'
            },
            daily: cumulativeDaily,
            monthly: cumulativeMonthly,
            yearly: cumulativeYearly
        };

        fs.writeFileSync('fii-dii-fno-data.json', JSON.stringify(resultData, null, 2), 'utf8');
        console.log(`✓ fii-dii-fno-data.json permanently saved! Cumulative totals: ${cumulativeDaily.length} days, ${cumulativeMonthly.length} months, ${cumulativeYearly.length} years.`);
        return resultData;
    } catch (e) {
        console.error("Error scraping and saving FII F&O data:", e.message);
        return null;
    }
}

if (process.argv[1] && process.argv[1].endsWith("scrape_fii_fno.mjs")) {
    fetchAndSaveFnoData();
}

export { fetchAndSaveFnoData };
