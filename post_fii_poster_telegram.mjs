import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchAndSaveFiiDiiData } from './scrape_fii_dii.mjs';
import { fetchAndSaveFnoData } from './scrape_fii_fno.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_CHANNEL_ID = '@liveipotrader';
const DEFAULT_STATE_FILE = path.join(__dirname, '.poster-state.json');
const DEFAULT_OUTPUT_PNG = path.join(__dirname, 'fii-poster-preview.png');

function parseArgs(argv) {
    const opts = {
        force: process.env.FORCE_POST === 'true',
        dryRun: process.env.DRY_RUN === 'true',
        stateFile: process.env.POSTER_STATE_FILE || DEFAULT_STATE_FILE,
        outputPng: process.env.POSTER_OUTPUT_PNG || DEFAULT_OUTPUT_PNG
    };

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--force' || arg === '-f') opts.force = true;
        else if (arg === '--dry-run' || arg === '-d') opts.dryRun = true;
        else if (arg === '--state-file' && argv[i + 1]) opts.stateFile = path.resolve(argv[++i]);
        else if (arg === '--output' && argv[i + 1]) opts.outputPng = path.resolve(argv[++i]);
    }
    return opts;
}

function getIstTodayIso() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function parseNum(val) {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    const n = parseFloat(String(val).replace(/,/g, '').trim());
    return isNaN(n) ? 0 : n;
}

function formatSignedInrCr(rawValStr, rawNumFallback = null) {
    const num = (typeof rawNumFallback === 'number' && !isNaN(rawNumFallback))
        ? rawNumFallback
        : parseNum(rawValStr);
    const absFormatted = Math.abs(num).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    if (num > 0) return `+₹${absFormatted} Cr`;
    if (num < 0) return `-₹${absFormatted} Cr`;
    return `₹0.00 Cr`;
}

function formatDisplayDate(isoDate, fallbackDate) {
    if (isoDate && /^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
        const [yyyy, mm, dd] = isoDate.split('-');
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const mLabel = months[parseInt(mm, 10) - 1] || mm;
        return `${dd} ${mLabel} ${yyyy}`;
    }
    return fallbackDate || 'Today';
}

function escapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function readState(stateFile) {
    try {
        if (fs.existsSync(stateFile)) {
            return JSON.parse(fs.readFileSync(stateFile, 'utf8'));
        }
    } catch (err) {
        console.warn(`⚠️ Could not read state file (${stateFile}):`, err.message);
    }
    return {};
}

function writeState(stateFile, stateObj) {
    fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    fs.writeFileSync(stateFile, JSON.stringify(stateObj, null, 2), 'utf8');
}

function pickMatchingRecords(cashData, fnoData, forcePost) {
    const cashList = Array.isArray(cashData?.daily) ? cashData.daily : [];
    const fnoList = Array.isArray(fnoData?.daily) ? fnoData.daily : [];
    const istToday = getIstTodayIso();

    if (cashList.length === 0 || fnoList.length === 0) {
        return { error: 'Cash or F&O daily dataset is empty.' };
    }

    const fnoByIso = new Map(fnoList.filter(r => r && r.isoDate).map(r => [r.isoDate, r]));

    if (!forcePost) {
        const todayCash = cashList.find(r => r && r.isoDate === istToday);
        const todayFno = fnoByIso.get(istToday);
        if (!todayCash || !todayFno) {
            return {
                pending: true,
                istToday,
                latestCashIso: cashList[0]?.isoDate || 'N/A',
                latestFnoIso: fnoList[0]?.isoDate || 'N/A'
            };
        }
        return { isoDate: istToday, cashRow: todayCash, fnoRow: todayFno };
    }

    // Force mode: pick latest date available across both Cash & F&O (or fallback to latest Cash + matching/latest F&O)
    const matchedCash = cashList.find(r => r && r.isoDate && fnoByIso.has(r.isoDate));
    if (matchedCash) {
        return {
            isoDate: matchedCash.isoDate,
            cashRow: matchedCash,
            fnoRow: fnoByIso.get(matchedCash.isoDate)
        };
    }

    const fallbackCash = cashList[0];
    const fallbackFno = fnoList[0];
    return {
        isoDate: fallbackCash.isoDate || fallbackFno.isoDate || istToday,
        cashRow: fallbackCash,
        fnoRow: fallbackFno
    };
}

function loadLogoDataUri() {
    const logoPath = path.join(__dirname, 'liveipo-logo.jpg');
    if (fs.existsSync(logoPath)) {
        const b64 = fs.readFileSync(logoPath).toString('base64');
        return `data:image/jpeg;base64,${b64}`;
    }
    return '';
}

function buildPosterHtml(cashRow, fnoRow, logoDataUri) {
    const cFiiNet = parseNum(cashRow.rawFiiNet ?? cashRow.fiiNet);
    const cDiiNet = parseNum(cashRow.rawDiiNet ?? cashRow.diiNet);
    const cTotalNet = parseNum(cashRow.rawTotalNet ?? cashRow.totalNet);

    const fFutNet = parseNum(fnoRow.rawFutNet ?? fnoRow.futNet);
    const fOptNet = parseNum(fnoRow.rawOptNet ?? fnoRow.optNet);
    const fTotalNet = parseNum(fnoRow.rawTotalNet ?? fnoRow.totalNet);

    const dateBadge = escapeHtml(cashRow.date || fnoRow.date || formatDisplayDate(cashRow.isoDate));
    const niftyClose = escapeHtml(fnoRow.indexClose || cashRow.niftyClose || '-');
    const niftyChg = escapeHtml(fnoRow.indexChangePer ?? '');
    const niftyText = niftyClose !== '-'
        ? `Nifty 50: ${niftyClose}${niftyChg ? ` (${niftyChg}%)` : ''}`
        : 'Derivatives Segment';

    const valClass = (n) => (n > 0 ? 'val-positive' : (n < 0 ? 'val-negative' : 'val-neutral'));
    const badgeStyle = (n) => (n >= 0
        ? 'background:#dcfce7; color:#15803d;'
        : 'background:#fee2e2; color:#b91c1c;');
    const dotBadge = (n, posLabel, negLabel) => (n >= 0
        ? `${posLabel}<span class="poster-status-dot dot-green"></span>`
        : `${negLabel}<span class="poster-status-dot dot-red"></span>`);

    const svgCalendar = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
    const svgCash = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/></svg>`;
    const svgChart = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>`;
    const svgGlobe = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`;
    const flowBadge = (n, posLabel, negLabel) => (n >= 0
        ? `${posLabel}<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><polyline points="18 15 12 9 6 15"/></svg>`
        : `${negLabel}<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><polyline points="6 9 12 15 18 9"/></svg>`);

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Noto+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
    * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
        font-family: 'Inter', 'Noto Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'DejaVu Sans', 'Liberation Sans', Arial, sans-serif;
        -webkit-font-smoothing: antialiased;
    }
    body {
        margin: 0;
        background: #ffffff;
        display: inline-block;
    }
    #posterCaptureRoot {
        background: #ffffff;
        display: inline-block;
        padding: 10px;
    }
    #fiiPosterTemplate {
        width: 480px;
        background: #ffffff;
        border-radius: 20px;
        border: 3.5px solid #0284c7;
        overflow: hidden;
        position: relative;
    }
    .poster-header-frame {
        background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
        padding: 10px 16px;
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 2.5px solid #38bdf8;
        gap: 12px;
    }
    .poster-logo-container {
        display: flex;
        align-items: center;
        background: #ffffff;
        padding: 2px 6px;
        border-radius: 6px;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
    }
    .poster-official-logo {
        height: 32px;
        width: auto;
        display: block;
        object-fit: contain;
    }
    .poster-center-title {
        font-size: 16px;
        font-weight: 900;
        color: #ffffff;
        text-transform: uppercase;
        letter-spacing: 0.3px;
        text-align: center;
        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
        flex: 1;
    }
    .poster-date-badge {
        background: rgba(255, 255, 255, 0.2);
        border: 1px solid rgba(255, 255, 255, 0.35);
        padding: 5px 11px;
        border-radius: 20px;
        font-size: 11.5px;
        font-weight: 800;
        white-space: nowrap;
        color: #ffffff;
        display: inline-flex;
        align-items: center;
        gap: 5px;
    }
    .poster-body {
        padding: 16px 18px;
        display: flex;
        flex-direction: column;
        gap: 14px;
        background: #ffffff;
    }
    .poster-section-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 6px;
    }
    .poster-section-title {
        font-size: 12.5px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.3px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 3px 9px;
        border-radius: 6px;
    }
    .poster-cash-pill {
        background: #ecfdf5;
        color: #047857;
        border: 1px solid #a7f3d0;
    }
    .poster-fno-pill {
        background: #eff6ff;
        color: #1d4ed8;
        border: 1px solid #bfdbfe;
    }
    .poster-grid-3 {
        display: grid;
        grid-template-columns: 1fr 1fr 1.15fr;
        gap: 8px;
    }
    .poster-mini-card {
        background: #f8fafc;
        border-radius: 8px;
        border: 1px solid #e2e8f0;
        padding: 8px 10px;
        display: flex;
        flex-direction: column;
        gap: 3px;
    }
    .poster-mini-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 4px;
        font-size: 10px;
        font-weight: 700;
        color: #64748b;
    }
    .poster-mini-badge {
        font-size: 8.5px;
        padding: 2px 5.5px;
        border-radius: 8px;
        font-weight: 800;
        white-space: nowrap;
        flex-shrink: 0;
        display: inline-flex;
        align-items: center;
        gap: 3px;
    }
    .poster-status-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        display: inline-block;
        flex-shrink: 0;
    }
    .dot-green {
        background: radial-gradient(circle at 30% 30%, #86efac, #16a34a 70%);
    }
    .dot-red {
        background: radial-gradient(circle at 30% 30%, #fca5a5, #dc2626 70%);
    }
    .poster-mini-val {
        font-size: 14.5px;
        font-weight: 800;
        letter-spacing: -0.3px;
        font-variant-numeric: tabular-nums;
    }
    .val-positive { color: #16a34a; }
    .val-negative { color: #dc2626; }
    .val-neutral { color: #64748b; }
    .poster-mini-sub {
        font-size: 8.8px;
        color: #475569;
        font-weight: 600;
        line-height: 1.35;
        margin-top: 3px;
        display: flex;
        flex-direction: column;
        gap: 1.5px;
    }
    .poster-sub-row {
        display: flex;
        align-items: center;
        gap: 4px;
        white-space: nowrap;
    }
    .poster-dot-buy { color: #16a34a; font-size: 7.5px; line-height: 1; flex-shrink: 0; }
    .poster-dot-sell { color: #dc2626; font-size: 7.5px; line-height: 1; flex-shrink: 0; }
    .poster-total-dark-card {
        background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
        border: 1px solid #334155;
        border-top: 2.5px solid #38bdf8;
        color: #ffffff;
    }
    .poster-total-dark-card .poster-mini-header { color: #94a3b8; }
    .poster-total-dark-card .poster-mini-val { color: #ffffff; font-size: 15px; }
    .poster-total-dark-card .poster-mini-sub { color: #cbd5e1; }
    .poster-footer-frame {
        background: #f0fdf4;
        border-top: 1.5px solid #bbf7d0;
        padding: 9px 18px;
        display: flex;
        align-items: center;
        justify-content: space-between;
    }
    .poster-footer-url {
        font-size: 12px;
        font-weight: 900;
        color: #047857;
        display: flex;
        align-items: center;
        gap: 5px;
    }
    .poster-footer-tagline {
        font-size: 9.5px;
        color: #64748b;
        font-weight: 600;
    }
</style>
</head>
<body>
<div id="posterCaptureRoot">
    <div id="fiiPosterTemplate">
        <div class="poster-header-frame">
            <div class="poster-logo-container">
                ${logoDataUri ? `<img src="${logoDataUri}" alt="Live IPO" class="poster-official-logo">` : `<span style="font-weight:900;color:#047857;font-size:15px;">LiveIPO</span>`}
            </div>
            <div class="poster-center-title">FII &amp; DII Activity</div>
            <div class="poster-date-badge">${svgCalendar}<span>${dateBadge}</span></div>
        </div>

        <div class="poster-body">
            <div>
                <div class="poster-section-header">
                    <span class="poster-section-title poster-cash-pill">${svgCash}<span>Cash Market Activity</span></span>
                    <span style="font-size: 10px; color: #64748b; font-weight: 600;">NSE + BSE Cash</span>
                </div>
                <div class="poster-grid-3">
                    <div class="poster-mini-card">
                        <div class="poster-mini-header">
                            <span>FII Net</span>
                            <span class="poster-mini-badge" style="${badgeStyle(cFiiNet)}">${dotBadge(cFiiNet, 'BUYING', 'SELLING')}</span>
                        </div>
                        <div class="poster-mini-val ${valClass(cFiiNet)}">${escapeHtml(formatSignedInrCr(cashRow.fiiNet, cFiiNet))}</div>
                        <div class="poster-mini-sub">
                            <div class="poster-sub-row"><span class="poster-dot-buy">●</span><span>Buy: ₹${escapeHtml(cashRow.fiiBuy || '-')} Cr</span></div>
                            <div class="poster-sub-row"><span class="poster-dot-sell">●</span><span>Sell: ₹${escapeHtml(cashRow.fiiSell || '-')} Cr</span></div>
                        </div>
                    </div>

                    <div class="poster-mini-card">
                        <div class="poster-mini-header">
                            <span>DII Net</span>
                            <span class="poster-mini-badge" style="${badgeStyle(cDiiNet)}">${dotBadge(cDiiNet, 'BUYING', 'SELLING')}</span>
                        </div>
                        <div class="poster-mini-val ${valClass(cDiiNet)}">${escapeHtml(formatSignedInrCr(cashRow.diiNet, cDiiNet))}</div>
                        <div class="poster-mini-sub">
                            <div class="poster-sub-row"><span class="poster-dot-buy">●</span><span>Buy: ₹${escapeHtml(cashRow.diiBuy || '-')} Cr</span></div>
                            <div class="poster-sub-row"><span class="poster-dot-sell">●</span><span>Sell: ₹${escapeHtml(cashRow.diiSell || '-')} Cr</span></div>
                        </div>
                    </div>

                    <div class="poster-mini-card poster-total-dark-card">
                        <div class="poster-mini-header">
                            <span>Total Cash Net</span>
                            <span class="poster-mini-badge" style="${badgeStyle(cTotalNet)}">${flowBadge(cTotalNet, 'NET INFLOW', 'NET OUTFLOW')}</span>
                        </div>
                        <div class="poster-mini-val">${escapeHtml(formatSignedInrCr(cashRow.totalNet, cTotalNet))}</div>
                        <div class="poster-mini-sub">FII + DII Combined</div>
                    </div>
                </div>
            </div>

            <div>
                <div class="poster-section-header">
                    <span class="poster-section-title poster-fno-pill">${svgChart}<span>Futures &amp; Options (F&amp;O)</span></span>
                    <span style="font-size: 10px; color: #64748b; font-weight: 600;">${niftyText}</span>
                </div>
                <div class="poster-grid-3">
                    <div class="poster-mini-card">
                        <div class="poster-mini-header">
                            <span>Futures Net</span>
                            <span class="poster-mini-badge" style="${badgeStyle(fFutNet)}">${dotBadge(fFutNet, 'BULLISH', 'BEARISH')}</span>
                        </div>
                        <div class="poster-mini-val ${valClass(fFutNet)}">${escapeHtml(formatSignedInrCr(fnoRow.futNet, fFutNet))}</div>
                        <div class="poster-mini-sub">
                            <div class="poster-sub-row"><span class="poster-dot-buy">●</span><span>Buy: ₹${escapeHtml(fnoRow.futBuy || '-')} Cr</span></div>
                            <div class="poster-sub-row"><span class="poster-dot-sell">●</span><span>Sell: ₹${escapeHtml(fnoRow.futSell || '-')} Cr</span></div>
                        </div>
                    </div>

                    <div class="poster-mini-card">
                        <div class="poster-mini-header">
                            <span>Options Net</span>
                            <span class="poster-mini-badge" style="${badgeStyle(fOptNet)}">${dotBadge(fOptNet, 'BULLISH', 'BEARISH')}</span>
                        </div>
                        <div class="poster-mini-val ${valClass(fOptNet)}">${escapeHtml(formatSignedInrCr(fnoRow.optNet, fOptNet))}</div>
                        <div class="poster-mini-sub">
                            <div class="poster-sub-row"><span class="poster-dot-buy">●</span><span>Buy: ₹${escapeHtml(fnoRow.optBuy || '-')} Cr</span></div>
                            <div class="poster-sub-row"><span class="poster-dot-sell">●</span><span>Sell: ₹${escapeHtml(fnoRow.optSell || '-')} Cr</span></div>
                        </div>
                    </div>

                    <div class="poster-mini-card poster-total-dark-card" style="border-top: 2.5px solid #a855f7;">
                        <div class="poster-mini-header">
                            <span>Total F&amp;O Net</span>
                            <span class="poster-mini-badge" style="${badgeStyle(fTotalNet)}">${flowBadge(fTotalNet, 'NET LONG', 'NET SHORT')}</span>
                        </div>
                        <div class="poster-mini-val">${escapeHtml(formatSignedInrCr(fnoRow.totalNet, fTotalNet))}</div>
                        <div class="poster-mini-sub">Derivatives Net</div>
                    </div>
                </div>
            </div>
        </div>

        <div class="poster-footer-frame">
            <div class="poster-footer-url">${svgGlobe}<span>www.liveipo.in</span></div>
            <div class="poster-footer-tagline">Live IPO GMP • Subscriptions • FII Tracker</div>
        </div>
    </div>
</div>
</body>
</html>`;
}

function buildTelegramCaption(isoDate, cashRow, fnoRow) {
    const cFiiNet = parseNum(cashRow.rawFiiNet ?? cashRow.fiiNet);
    const cDiiNet = parseNum(cashRow.rawDiiNet ?? cashRow.diiNet);
    const cTotalNet = parseNum(cashRow.rawTotalNet ?? cashRow.totalNet);

    const fFutNet = parseNum(fnoRow.rawFutNet ?? fnoRow.futNet);
    const fOptNet = parseNum(fnoRow.rawOptNet ?? fnoRow.optNet);
    const fTotalNet = parseNum(fnoRow.rawTotalNet ?? fnoRow.totalNet);

    const displayDate = escapeHtml(formatDisplayDate(isoDate, cashRow.date));
    const niftyClose = fnoRow.indexClose && fnoRow.indexClose !== '-' ? escapeHtml(fnoRow.indexClose) : null;
    const rawChg = parseNum(fnoRow.indexChangePer);
    const chgPrefix = rawChg > 0 ? '+' : '';
    const niftyLine = niftyClose
        ? `\n• Nifty 50: <b>${niftyClose}</b> (${escapeHtml(`${chgPrefix}${fnoRow.indexChangePer || '0'}%`)})`
        : '';

    const caption = [
        `📊 <b>FII &amp; DII Activity Report — ${displayDate}</b>`,
        '',
        `💵 <b>Cash Market (NSE + BSE)</b>`,
        `• FII Net: <b>${escapeHtml(formatSignedInrCr(cashRow.fiiNet, cFiiNet))}</b> (${cFiiNet >= 0 ? 'Buying 🟢' : 'Selling 🔴'})`,
        `• DII Net: <b>${escapeHtml(formatSignedInrCr(cashRow.diiNet, cDiiNet))}</b> (${cDiiNet >= 0 ? 'Buying 🟢' : 'Selling 🔴'})`,
        `• Total Cash Net: <b>${escapeHtml(formatSignedInrCr(cashRow.totalNet, cTotalNet))}</b> (${cTotalNet >= 0 ? 'Net Inflow' : 'Net Outflow'})`,
        '',
        `📈 <b>F&amp;O Derivatives</b>`,
        `• Futures Net: <b>${escapeHtml(formatSignedInrCr(fnoRow.futNet, fFutNet))}</b> (${fFutNet >= 0 ? 'Bullish 🟢' : 'Bearish 🔴'})`,
        `• Options Net: <b>${escapeHtml(formatSignedInrCr(fnoRow.optNet, fOptNet))}</b> (${fOptNet >= 0 ? 'Bullish 🟢' : 'Bearish 🔴'})`,
        `• Total F&amp;O Net: <b>${escapeHtml(formatSignedInrCr(fnoRow.totalNet, fTotalNet))}</b> (${fTotalNet >= 0 ? 'Net Long' : 'Net Short'})${niftyLine}`,
        '',
        `🌐 <b>Track Live Data &amp; Charts:</b>`,
        `https://liveipo.in/fii-dii-activity.html`,
        '',
        `#FIIDII #Nifty50 #Sensex #StockMarketIndia #LiveIPO`
    ].join('\n');

    return caption.length <= 1024 ? caption : caption.slice(0, 1020) + '...';
}

function findBrowserExecutable() {
    const envCandidates = [
        process.env.CHROME_PATH,
        process.env.PUPPETEER_EXECUTABLE_PATH
    ].filter(Boolean);

    for (const candidate of envCandidates) {
        if (!candidate.includes('/') && !candidate.includes('\\')) return candidate;
        if (fs.existsSync(candidate)) return candidate;
    }

    const pathCandidates = [
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
    ];

    for (const candidate of pathCandidates) {
        if (fs.existsSync(candidate)) return candidate;
    }

    return process.platform !== 'win32' ? 'google-chrome-stable' : null;
}

async function renderPosterPng(html, outputPath) {
    const { default: puppeteer } = await import('puppeteer-core');
    const executablePath = findBrowserExecutable();
    if (!executablePath) {
        throw new Error('Chrome/Edge executable not found. Set CHROME_PATH or run on GitHub Actions ubuntu-latest.');
    }

    const browser = await puppeteer.launch({
        executablePath,
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--font-render-hinting=medium'
        ]
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 640, height: 800, deviceScaleFactor: 3 });
        await page.setContent(html, { waitUntil: 'networkidle0', timeout: 10000 }).catch(() => {});
        await page.evaluate(() => document.fonts ? document.fonts.ready : Promise.resolve());

        const captureEl = await page.$('#posterCaptureRoot');
        if (!captureEl) throw new Error('#posterCaptureRoot not found in rendered HTML.');

        await captureEl.screenshot({ path: outputPath, type: 'png' });
        console.log(`🖼️ Rendered HD FII/DII poster PNG: ${outputPath}`);
    } finally {
        await browser.close();
    }
}

async function sendTelegramPhoto(botToken, chatId, imagePath, captionHtml) {
    const pngBuffer = fs.readFileSync(imagePath);
    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('photo', new Blob([pngBuffer], { type: 'image/png' }), path.basename(imagePath));
    form.append('caption', captionHtml);
    form.append('parse_mode', 'HTML');

    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
        method: 'POST',
        body: form
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
        throw new Error(`Telegram API sendPhoto failed (${res.status}): ${json.description || JSON.stringify(json)}`);
    }
    return json.result;
}

async function main() {
    const opts = parseArgs(process.argv.slice(2));
    const channelId = (process.env.TELEGRAM_CHANNEL_ID || DEFAULT_CHANNEL_ID).trim();
    const botToken = (process.env.TELEGRAM_BOT_TOKEN || '').trim();

    if (!opts.dryRun && !botToken) {
        throw new Error('TELEGRAM_BOT_TOKEN secret is missing! Add it under GitHub Repository Settings -> Secrets and variables -> Actions.');
    }

    console.log(`📡 Fetching latest Moneycontrol FII/DII (Cash & F&O) datasets...`);
    const [cashData, fnoData] = await Promise.all([
        fetchAndSaveFiiDiiData(),
        fetchAndSaveFnoData()
    ]);

    const selection = pickMatchingRecords(cashData, fnoData, opts.force);
    if (selection.error) {
        console.warn(`⚠️ ${selection.error}`);
        if (opts.force) process.exit(1);
        return;
    }

    if (selection.pending) {
        console.log(`⏳ Today's (${selection.istToday}) data not yet available on Moneycontrol (Latest Cash: ${selection.latestCashIso}, Latest F&O: ${selection.latestFnoIso}). Skipping until next check.`);
        return;
    }

    const { isoDate, cashRow, fnoRow } = selection;
    const state = readState(opts.stateFile);

    if (!opts.force && !opts.dryRun && state.lastPostedIsoDate === isoDate) {
        console.log(`✅ Poster for ${isoDate} already posted to ${channelId}. Skipping duplicate.`);
        return;
    }

    console.log(`🎨 Preparing poster for ${isoDate} (Cash=${cashRow.date}, F&O=${fnoRow.date})...`);
    const html = buildPosterHtml(cashRow, fnoRow, loadLogoDataUri());
    await renderPosterPng(html, opts.outputPng);

    const caption = buildTelegramCaption(isoDate, cashRow, fnoRow);
    console.log(`\n📝 Telegram Caption Preview (${caption.length}/1024 chars):\n${caption}\n`);

    if (opts.dryRun) {
        console.log(`🧪 Dry-run completed cleanly. Skipping Telegram API call.`);
        return;
    }

    const tgResult = await sendTelegramPhoto(botToken, channelId, opts.outputPng, caption);
    console.log(`🚀 Posted FII/DII poster to ${channelId}! Telegram Message ID: ${tgResult?.message_id}`);

    writeState(opts.stateFile, {
        lastPostedIsoDate: isoDate,
        lastPostedAt: new Date().toISOString(),
        channel: channelId,
        messageId: tgResult?.message_id || null
    });
    console.log(`💾 Saved post state to ${opts.stateFile}`);
}

main().catch(err => {
    console.error('❌ Auto-Poster Error:', err.message);
    process.exit(1);
});
