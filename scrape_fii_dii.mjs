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
        if (!nextData) throw new Error("No __NEXT_DATA__ found");

        const json = JSON.parse(nextData);
        const rawDaily = json.props.pageProps.FiiDiiData.fiiDiiData || [];

        const parseNum = (str) => {
            if (!str) return 0;
            return parseFloat(str.replace(/,/g, '')) || 0;
        };

        const formatINR = (num) => {
            return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        };

        // 1. Process Daily Records
        const daily = rawDaily.map(item => {
            const [yyyy, mm, dd] = item.date.split('-');
            const displayDate = `${dd}-${mm}-${yyyy}`;

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

        // 2. Process Monthly Summary
        const monthMap = {};
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        daily.forEach(d => {
            const mKey = d.month; // e.g. "2026-11"
            if (!monthMap[mKey]) {
                const [y, m] = mKey.split('-');
                const mIdx = parseInt(m, 10) - 1;
                monthMap[mKey] = {
                    key: mKey,
                    label: `${monthNames[mIdx]} ${y}`,
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
            monthMap[mKey].fiiBuy += d.rawFiiBuy;
            monthMap[mKey].fiiSell += d.rawFiiSell;
            monthMap[mKey].fiiNet += d.rawFiiNet;
            monthMap[mKey].diiBuy += d.rawDiiBuy;
            monthMap[mKey].diiSell += d.rawDiiSell;
            monthMap[mKey].diiNet += d.rawDiiNet;
            monthMap[mKey].totalNet += d.rawTotalNet;
            monthMap[mKey].count++;
        });

        const monthly = Object.values(monthMap).sort((a, b) => b.key.localeCompare(a.key)).map(m => ({
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

        // 3. Process Yearly Summary
        const yearMap = {};
        daily.forEach(d => {
            const y = d.year;
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
            yearMap[y].fiiBuy += d.rawFiiBuy;
            yearMap[y].fiiSell += d.rawFiiSell;
            yearMap[y].fiiNet += d.rawFiiNet;
            yearMap[y].diiBuy += d.rawDiiBuy;
            yearMap[y].diiSell += d.rawDiiSell;
            yearMap[y].diiNet += d.rawDiiNet;
            yearMap[y].totalNet += d.rawTotalNet;
            yearMap[y].count++;
        });

        const yearly = Object.values(yearMap).sort((a, b) => b.year.localeCompare(a.year)).map(y => ({
            date: `FY ${y}`,
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

        const resultData = {
            updatedAt: new Date().toISOString(),
            source: "Moneycontrol Cash Market",
            currency: "₹ in Crores",
            summary: {
                latestDate: daily[0]?.date || '',
                latestFiiNet: daily[0]?.fiiNet || '0',
                latestDiiNet: daily[0]?.diiNet || '0',
                latestTotalNet: daily[0]?.totalNet || '0',
                rawLatestFiiNet: daily[0]?.rawFiiNet || 0,
                rawLatestDiiNet: daily[0]?.rawDiiNet || 0,
                rawLatestTotalNet: daily[0]?.rawTotalNet || 0,
            },
            daily,
            monthly,
            yearly
        };

        fs.writeFileSync('fii-dii-data.json', JSON.stringify(resultData, null, 2), 'utf8');
        console.log(`✓ fii-dii-data.json saved with ${daily.length} daily, ${monthly.length} monthly, and ${yearly.length} yearly records!`);
        return resultData;
    } catch (e) {
        console.error("Error scraping FII/DII data:", e.message);
        return null;
    }
}

if (process.argv[1] && process.argv[1].endsWith("scrape_fii_dii.mjs")) {
    fetchAndSaveFiiDiiData();
}
export { fetchAndSaveFiiDiiData };
