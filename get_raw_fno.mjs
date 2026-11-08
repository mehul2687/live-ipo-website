import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';

async function getFullFnoData() {
    const url = 'https://www.moneycontrol.com/markets/fii-dii-data/futures-and-options/';
    const res = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });

    const $ = cheerio.load(res.data);
    const nextData = $('#__NEXT_DATA__').html();
    const json = JSON.parse(nextData);
    const fiiDiiData = json.props.pageProps.FiiDiiData;

    fs.writeFileSync('fno_raw_sample.json', JSON.stringify({
        totalRecords: fiiDiiData.fiiDiiData?.length,
        firstRecord: fiiDiiData.fiiDiiData?.[0],
        secondRecord: fiiDiiData.fiiDiiData?.[1],
        sectorName: fiiDiiData.sectorName,
        tabs: fiiDiiData.tabs
    }, null, 2));
    console.log("Saved raw sample.");
}

getFullFnoData();
