import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';

async function inspectFnoPage() {
    try {
        const url = 'https://www.moneycontrol.com/markets/fii-dii-data/futures-and-options/';
        console.log("Inspecting:", url);
        const res = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            },
            timeout: 15000
        });

        const $ = cheerio.load(res.data);
        const nextData = $('#__NEXT_DATA__').html();
        
        let report = {
            hasHtml: res.data.length > 0,
            hasTableHeader: $('table').length,
            hasNextData: !!nextData,
            keysInNextData: []
        };

        if (nextData) {
            try {
                const json = JSON.parse(nextData);
                const pageProps = json.props?.pageProps || {};
                report.pagePropsKeys = Object.keys(pageProps);
                report.pagePropsSample = JSON.stringify(pageProps).substring(0, 3000);
            } catch (err) {
                report.nextDataParseError = err.message;
            }
        }

        // Also check any tables or main sections in HTML
        const tables = [];
        $('table').each((i, el) => {
            const headers = [];
            $(el).find('th').each((j, th) => {
                headers.push($(th).text().trim().replace(/\s+/g, ' '));
            });
            tables.push({ index: i, headers: headers.slice(0, 15) });
        });
        report.tables = tables;

        fs.writeFileSync('fno_inspect_report.json', JSON.stringify(report, null, 2), 'utf8');
        console.log("Inspection complete. Saved to fno_inspect_report.json");
    } catch (e) {
        console.error("Inspect error:", e.message);
        fs.writeFileSync('fno_inspect_report.json', JSON.stringify({ error: e.message }, null, 2), 'utf8');
    }
}

inspectFnoPage();
