import fs from 'fs';

const report = JSON.parse(fs.readFileSync('fno_inspect_report.json', 'utf8'));
const sample = JSON.parse(report.pagePropsSample + '"}'); // complete the json if possible or load fresh
console.log("Keys in FiiDiiData:", Object.keys(sample.FiiDiiData || {}));
console.log("First item:", sample.FiiDiiData?.fiiDiiData?.[0]);
