import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';

async function checkFnoHtml() {
    const url = 'https://www.moneycontrol.com/markets/fii-dii-data/futures-and-options/';
    const res = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });

    const $ = cheerio.load(res.data);
    const ths = [];
    $('thead th').each((i, el) => {
        ths.push($(el).text().trim());
    });

    const rows = [];
    $('tbody tr').slice(0, 3).each((i, tr) => {
        const row = [];
        $(tr).find('td').each((j, td) => {
            row.push($(td).text().trim());
        });
        rows.push(row);
    });

    fs.writeFileSync('fno_table_inspect.json', JSON.stringify({ ths, rows }, null, 2), 'utf8');
    console.log("Table inspected.");
}

checkFnoHtml();
