// ==========================================
// 1. JSONBin.io & VERSION CONFIGURATION
// ==========================================
const BIN_ID = "6aaf80f9ac6210605ae1bce6";
const API_KEY = "$2a$10$Pl5b/ekYZXhRBmQVY6DwieMC10GztytHM9d7CnR0zqmje7BWYj6yC";

const MASTER_IPO_KEY = 'live_ipo_master_cloud_data';
const DATA_VERSION_KEY = 'live_ipo_data_version_v1';
const CURRENT_VERSION = '2026.09.19-V1';

const initialDefaultData = {
    "PSL": {
        id: "PSL",
        name: "Purple Style Labs IPO Details",
        logo: "https://www.liveipo.in/liveipo_logo.jpg",
        type: "Mainboard",
        about: "Purple Style Labs IPO is a book build issue of ₹680.00 crores...",
        priceBand: "546 to 575",
        cutOff: 575,
        lotRaw: 26,
        lotSize: "26 Shares",
        faceValue: "₹10 per share",
        minInvestment: "₹14,950",
        empDiscount: "Nil",
        totalSize: "1,18,26,087 shares (agg. up to ₹680.00 Cr)",
        freshIssue: "86,95,652 shares (agg. up to ₹500.00 Cr)",
        ofs: "31,30,435 shares (agg. up to ₹180.00 Cr)",
        listingAt: "BSE, NSE",
        openDate: "2026-08-31",
        closeDate: "2026-09-02",
        allotmentDate: "2026-09-03",
        listingDate: "2026-09-07",
        gmp: "50",
        estPrice: "₹625",
        kostak: "₹500",
        ss: "₹3,000",
        bseCode: "544123",
        nseCode: "PSL",
        isinCode: "INE0XYZ12345",
        expectedListingPrice: "₹625",
        bookProfit: "₹1,300",
        stopLoss: "₹530",
        drhpLink: "https://www.sebi.gov.in/",
        rhpLink: "https://www.nseindia.com/",
        anchorLink: "https://www.bseindia.com/",
        valuation: {
            eps: "₹15.24",
            pe: "37.72x",
            ronw: "24.50%",
            nav: "₹62.10",
            ebitdaMargin: "18.40%",
            patMargin: "9.20%"
        },
        reservation: [
            { category: "QIB", shares: "2,576,000", percentage: "50.00%" },
            { category: "NII (HNI)", shares: "772,800", percentage: "15.00%" },
            { category: "Retail", shares: "1,803,200", percentage: "35.00%" }
        ],
        subShares: [
            { cat: "QIB", off: 0, app: 0 },
            { cat: "NII", off: 2576000, app: 2236000 },
            { cat: "B-NII(₹10L+)", off: 0, app: 0 },
            { cat: "S-NII(₹2-10L)", off: 0, app: 0 },
            { cat: "Retail", off: 2576000, app: 800000 },
            { cat: "Employee", off: 0, app: 0 },
            { cat: "Shareholder", off: 0, app: 0 }
        ],
        subApps: [
            { cat: "B-NII(₹10L+)", off: 0, app: 0 },
            { cat: "S-NII(₹2-10L)", off: 0, app: 0 },
            { cat: "Retail", off: 0, app: 0 }
        ],
        fin: {
            fy23: { yr: "FY-2023", ast: "-", rev: "-", exp: "-", prf: "-" },
            fy24: { yr: "FY-2024", ast: "31.76", rev: "62.75", exp: "53.54", prf: "6.16" },
            fy25: { yr: "FY-2025", ast: "69.32", rev: "79.98", exp: "70.32", prf: "6.66" },
            fy26: { yr: "FY-2026", ast: "99.84", rev: "90.84", exp: "79.99", prf: "7.53" }
        },
        customLots: [
            { app: "Retail Min", lot: 1 },
            { app: "Small HNI", lot: 14 },
            { app: "Big HNI", lot: 68 }
        ],
        regName: "Link Intime India Private Ltd",
        regWeb: "linkintime.co.in",
        regEmail: "psl.ipo@linkintime.co.in",
        leadManagers: "Axis Capital"
    }
};

// ==========================================
// MASTER DATA FETCHING (Cloud & Local Sync)
// ==========================================
async function getMasterIpoData() {
    try {
        const response = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest?t=${Date.now()}`, {
            cache: 'no-store',
            headers: { 'X-Master-Key': API_KEY }
        });
        if (response.ok) {
            const result = await response.json();
            const cloudData = result.record?.ipos || result.record;
            if (cloudData && typeof cloudData === 'object' && Object.keys(cloudData).length > 0) {
                localStorage.setItem(MASTER_IPO_KEY, JSON.stringify(cloudData));
                return cloudData;
            }
        }
    } catch (err) {
        console.warn("Cloud fetch error, falling back to local storage:", err);
    }

    try {
        let localData = JSON.parse(localStorage.getItem(MASTER_IPO_KEY));
        if (localData && typeof localData === 'object' && Object.keys(localData).length > 0) {
            return localData;
        }
    } catch (err) {
        console.error("Local storage parse error:", err);
    }

    // Default Fallback
    localStorage.setItem(MASTER_IPO_KEY, JSON.stringify(initialDefaultData));
    return initialDefaultData;
}

// ==========================================
// 3. HELPER UTILITY FUNCTIONS
// ==========================================
function formatDateReadable(dateStr) {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    const options = { day: '2-digit', month: 'short', year: 'numeric' };
    return d.toLocaleDateString('en-GB', options);
}

function formatFaceValue(val) {
    if (!val) return '₹10 per share';
    let valStr = val.toString().trim();
    if (valStr.includes('per share') || valStr.includes('₹')) {
        return valStr;
    }
    return `₹${valStr} per share`;
}

function formatIssueSizeWithAmount(rawVal, price) {
    if (!rawVal || rawVal === 'N/A' || rawVal === '-') return 'N/A';
    let str = rawVal.toString().trim();
    if (str.toLowerCase() === 'nil') return 'Nil';

    // 1. If it already has both shares and ₹ amount:
    // e.g. "27,00,00,000 shares (agg. up to ₹30,213 Cr)" or "1,19,00,000 shares of ₹2 (agg. up to ₹113 Cr)"
    if (/\d[\d,]*\s*shares/i.test(str) && /₹/i.test(str)) {
        return str.replace(/\s+/g, ' ');
    }

    // 2. If it is purely numeric shares (e.g. "270000000" or "27,00,00,000" or "27,00,00,000 shares")
    let cleanNumberStr = str.replace(/shares?/i, '').replace(/,/g, '').trim();
    if (/^\d+(\.\d+)?$/.test(cleanNumberStr)) {
        let sharesNum = Math.round(parseFloat(cleanNumberStr));
        let formattedShares = sharesNum.toLocaleString('en-IN');
        let cutOff = parseFloat(price) || 0;
        if (cutOff > 0 && sharesNum > 0) {
            let totalCr = (sharesNum * cutOff) / 10000000;
            let crStr = (totalCr >= 100 && totalCr % 1 === 0) ? totalCr.toLocaleString('en-IN') : totalCr.toFixed(2);
            return `${formattedShares} shares (agg. up to ₹${crStr} Cr)`;
        }
        return `${formattedShares} shares`;
    }

    // 3. If it only has amount, e.g. "₹30,213 Cr" or "₹680.00 Cr" or "[.] shares (agg. up to ₹30,213 Cr)"
    // If cutOff price is available, calculate the shares count!
    const crMatch = str.match(/₹?\s*([\d,]+(?:\.\d+)?)\s*(?:Cr|crore)?/i);
    let cutOff = parseFloat(price) || 0;
    if (crMatch && cutOff > 0) {
        let crVal = parseFloat(crMatch[1].replace(/,/g, ''));
        if (crVal > 0) {
            let totalRupees = crVal * 10000000;
            let calculatedShares = Math.round(totalRupees / cutOff);
            if (calculatedShares > 0) {
                let formattedShares = calculatedShares.toLocaleString('en-IN');
                let crFormatted = (crVal >= 100 && crVal % 1 === 0) ? crVal.toLocaleString('en-IN') : crVal;
                return `${formattedShares} shares (agg. up to ₹${crFormatted} Cr)`;
            }
        }
    }

    return str;
}

function formatGmpBadge(gmpVal) {
    if (gmpVal === null || gmpVal === undefined) {
        return `<span style="color: #94a3b8; font-weight: 600; font-size: 13px;">-</span>`;
    }
    const str = gmpVal.toString().trim();
    if (str === '' || str === '-' || str === '--' || str.toLowerCase() === 'n/a' || str === '+') {
        return `<span style="color: #94a3b8; font-weight: 600; font-size: 13px;">-</span>`;
    }

    const clean = str.replace(/₹/g, '').replace(/,/g, '').trim();
    const num = parseFloat(clean);
    if (isNaN(num)) {
        return `<span style="color: #94a3b8; font-weight: 600; font-size: 13px;">${str}</span>`;
    }

    if (num > 0) {
        return `<span style="color: #16a34a; font-weight: 700; font-size: 13.5px;">+${num}</span>`;
    } else if (num < 0) {
        return `<span style="color: #dc2626; font-weight: 700; font-size: 13.5px;">${num}</span>`;
    } else {
        return `<span style="color: #64748b; font-weight: 600; font-size: 13px;">0</span>`;
    }
}

function getIpoStatus(openStr, closeStr, allotStr, listStr, isAllotmentOut) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const openDate = openStr ? new Date(openStr) : null;
    const closeDate = closeStr ? new Date(closeStr) : null;
    const allotDate = allotStr ? new Date(allotStr) : null;
    const listDate = listStr ? new Date(listStr) : null;

    if (openDate) openDate.setHours(0, 0, 0, 0);
    if (closeDate) closeDate.setHours(0, 0, 0, 0);
    if (allotDate) allotDate.setHours(0, 0, 0, 0);
    if (listDate) listDate.setHours(0, 0, 0, 0);

    // ૧. લિસ્ટિંગ તારીખ વીતી ગઈ હોય તો 'Listed'
    if (listDate && today > listDate) {
        return { text: "Listed", class: "status-listed-slate", rowClass: "row-neutral" };
    }

    // ૨. લિસ્ટિંગનો દિવસ હોય તો 'Listing Today'
    if (listDate && today.getTime() === listDate.getTime()) {
        return { text: "Listing Today 🚀", class: "status-listing-indigo", rowClass: "row-neutral" };
    }

    // ૩. લિસ્ટિંગ પહેલાં જો અલોટમેન્ટ જાહેર થઈ ગયું હોય (Checkbox Tick હોય)
    if (isAllotmentOut === true) {
        return { text: "Allotment Out 🎉", class: "status-allotment-parrot", rowClass: "row-neutral" };
    }

    // ૪. ક્લોઝિંગનો દિવસ (ક્લોઝ ડેટના દિવસે રાત્રે 12:00 વાગ્યાથી આખો દિવસ 'Closing Today')
    if (closeDate && today.getTime() === closeDate.getTime()) {
        return { text: "Closing Today ⏳", class: "status-closing-today", rowClass: "row-live" };
    }

    // ૫. Bidding ચાલુ હોય (ઓપન ડેટથી ક્લોઝ ડેટ પહેલાં સુધી 'Live')
    if (openDate && closeDate && today >= openDate && today < closeDate) {
        return { text: "🔴 Live", class: "status-live-green", rowClass: "row-live" };
    }

    // ૬. ક્લોઝ થઈ ગયા પછી લિસ્ટિંગ સુધી 'Allotment Waiting'
    if (closeDate && today > closeDate && (!listDate || today < listDate)) {
        return { text: "Allotment Waiting", class: "status-waiting-amber", rowClass: "row-neutral" };
    }

    // ૭. ઓપન ડેટ પહેલાંનો સમય 'Upcoming'
    if (openDate && today < openDate) {
        return { text: "Upcoming", class: "status-upcoming-orange", rowClass: "row-upcoming" };
    }

    return { text: "Upcoming", class: "status-upcoming-orange", rowClass: "row-upcoming" };
}

function calculateTimelineProgress(openStr, closeStr, allotStr, listStr, isAllotmentOut = false) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const openDate = openStr ? new Date(openStr) : null;
    const closeDate = closeStr ? new Date(closeStr) : null;
    const allotDate = allotStr ? new Date(allotStr) : null;
    const listDate = listStr ? new Date(listStr) : null;

    if (openDate) openDate.setHours(0, 0, 0, 0);
    if (closeDate) closeDate.setHours(0, 0, 0, 0);
    if (allotDate) allotDate.setHours(0, 0, 0, 0);
    if (listDate) listDate.setHours(0, 0, 0, 0);

    let openStatus = "upcoming", closeStatus = "upcoming", allotStatus = "upcoming", listStatus = "upcoming";
    let progressPercent = "0%";

    // ૧. Upcoming (આજે ઓપન ડેટ પહેલાંનો દિવસ છે)
    if (openDate && today < openDate) {
        openStatus = "active pulsing upcoming";
        closeStatus = "upcoming";
        allotStatus = "upcoming";
        listStatus = "upcoming";
        progressPercent = "0%";
    }
    // ૨. Live / Bidding ચાલુ છે (ઓપન ડેટથી ક્લોઝ ડેટ સુધી)
    else if (openDate && closeDate && today >= openDate && today <= closeDate) {
        openStatus = "completed";
        closeStatus = "active pulsing";
        allotStatus = "upcoming";
        listStatus = "upcoming";
        progressPercent = "33.33%";
    }
    // ૩. ક્લોઝ થઈ ગયું છે અને અલોટમેન્ટ ડેટ/સ્ટેટસ ની રાહ જોવાઈ રહી છે
    else if (closeDate && today > closeDate && !isAllotmentOut && (!allotDate || today < allotDate)) {
        openStatus = "completed";
        closeStatus = "completed";
        allotStatus = "active pulsing";
        listStatus = "upcoming";
        progressPercent = "66.66%";
    }
    // ૪. અલોટમેન્ટ જાહેર થઈ ગયું છે (અથવા તારીખ આવી ગઈ છે) અને લિસ્ટિંગની રાહ છે
    else if ((isAllotmentOut || (allotDate && today >= allotDate)) && (!listDate || today < listDate)) {
        openStatus = "completed";
        closeStatus = "completed";
        allotStatus = "completed";
        listStatus = "active pulsing";
        progressPercent = "100%";
    }
    // ૫. લિસ્ટિંગ થઈ ગયું (Listed)
    else if (listDate && today >= listDate) {
        openStatus = "completed";
        closeStatus = "completed";
        allotStatus = "completed";
        listStatus = "completed";
        progressPercent = "100%";
    }
    // ૬. સામાન્ય ફોલબેક
    else {
        openStatus = "completed";
        closeStatus = "completed";
        allotStatus = "active pulsing";
        listStatus = "upcoming";
        progressPercent = "66.66%";
    }

    return { openStatus, closeStatus, allotStatus, listStatus, progressPercent };
}

// ==========================================
// 4. HOME PAGE LOGIC (Cloud Connected with Pagination & Page Size Control)
// ==========================================
let currentHomeFilter = 'all';
let homeCurrentPage = 1;
let homePageSize = parseInt(localStorage.getItem('live_ipo_home_page_size')) || 50; // બાય ડિફોલ્ટ ૫૦ IPO
let homeSearchQuery = '';

async function loadHomeIpoTable(filterType = currentHomeFilter) {
    const tableBody = document.getElementById('homeTableBody');
    if (!tableBody) return;

    currentHomeFilter = filterType;
    let dbData = await getMasterIpoData();
    tableBody.innerHTML = '';

    // તારીખ મુજબ સોર્ટિંગ: સૌથી લેટેસ્ટ Open / Close ડેટ ધરાવતા IPO સૌથી ઉપર (Top) આવશે
    const ipoList = Object.keys(dbData).map(key => dbData[key]).filter(Boolean);
    ipoList.sort((a, b) => {
        const timeA = new Date(a.openDate || a.closeDate || 0).getTime();
        const timeB = new Date(b.openDate || b.closeDate || 0).getTime();
        if (timeB !== timeA) return timeB - timeA;
        const closeA = new Date(a.closeDate || 0).getTime();
        const closeB = new Date(b.closeDate || 0).getTime();
        return closeB - closeA;
    });

    // કેટેગરી અને સર્ચ ફિલ્ટર
    let filteredList = ipoList.filter(ipo => {
        const ipoType = (ipo.type || 'Mainboard').trim().toLowerCase();
        if (filterType === 'mainboard' && !ipoType.includes('main')) return false;
        if (filterType === 'sme' && !ipoType.includes('sme')) return false;

        if (homeSearchQuery) {
            const q = homeSearchQuery.toLowerCase();
            const nameMatch = ipo.name && ipo.name.toLowerCase().includes(q);
            const idMatch = ipo.id && ipo.id.toLowerCase().includes(q);
            if (!nameMatch && !idMatch) return false;
        }
        return true;
    });

    const totalFiltered = filteredList.length;
    let totalPages = Math.ceil(totalFiltered / homePageSize);
    if (totalPages < 1) totalPages = 1;
    if (homeCurrentPage > totalPages) homeCurrentPage = totalPages;
    if (homeCurrentPage < 1) homeCurrentPage = 1;

    const startIndex = (homeCurrentPage - 1) * homePageSize;
    const endIndex = Math.min(startIndex + homePageSize, totalFiltered);
    const pageItems = filteredList.slice(startIndex, endIndex);

    if (pageItems.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="12" style="text-align: center; color: #64748b; padding: 30px; font-size: 14px;">આ કેટેગરીમાં હાલ કોઈ IPO ઉપલબ્ધ નથી.</td></tr>`;
    } else {
        pageItems.forEach(ipo => {
            const logoVal = ipo.logo ? ipo.logo.trim() : '';
            
            let logoHtml = '';
            if (logoVal.startsWith("http://") || logoVal.startsWith("https://") || logoVal.startsWith("data:image/")) {
                logoHtml = `<div style="background: #ffffff; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden;"><img src="${logoVal}" alt="Logo" style="width: 100%; height: 100%; object-fit: contain;"></div>`;
            } else {
                logoHtml = `<div style="background: #ffffff; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border-radius: 8px; border: 1px solid #e2e8f0; font-weight: bold; color: #1e3a8a; font-size: 10px;">${logoVal || ipo.id}</div>`;
            }

            const statusObj = getIpoStatus(ipo.openDate, ipo.closeDate, ipo.allotmentDate, ipo.listingDate, ipo.isAllotmentOut);

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const allotDate = ipo.allotmentDate ? new Date(ipo.allotmentDate) : null;
            if (allotDate) allotDate.setHours(0, 0, 0, 0);

            let homeAllotmentHtml = '';
            if (ipo.isAllotmentOut === true || (allotDate && today >= allotDate)) {
                const regLink = ipo.registrarUrl || (ipo.regWeb ? `https://${ipo.regWeb}` : '#');
                homeAllotmentHtml = `<a href="${regLink}" target="_blank" onclick="event.stopPropagation();" style="background-color: #16a34a; color: #ffffff; text-decoration: none; padding: 5px 10px; border-radius: 6px; font-size: 11.5px; font-weight: 600; display: inline-block;">🔍 Check Allotment</a>`;
            } else {
                homeAllotmentHtml = `<span style="color: #c2410c; background-color: #ffedd5; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 700;">Waiting</span>`;
            }

            let totalOff = 0, totalApp = 0;
            if (ipo.subShares) {
                ipo.subShares.forEach(row => {
                    if (row.cat !== "B-NII(₹10L+)" && row.cat !== "S-NII(₹2-10L)") {
                        totalOff += (row.off || 0);
                        totalApp += (row.app || 0);
                    }
                });
            }
            let overallSubTimes = totalOff > 0 ? (totalApp / totalOff).toFixed(2) + 'x' : '0.00x';

            tableBody.innerHTML += `
                <tr class="${statusObj.rowClass}" onclick="window.location.href='ipo-detail.html?id=${ipo.id}'">
                    <td style="padding: 12px; text-align: center;">${logoHtml}</td>
                    <td class="ipo-name-cell" style="text-align: left; padding: 12px 16px;">
                        <a href="ipo-detail.html?id=${ipo.id}" onclick="event.stopPropagation();" style="text-decoration: none; text-align: left;">
                            <strong style="color: #1d4ed8; display: block; cursor: pointer; text-align: left; margin-bottom: 3px;">${ipo.name}</strong>
                        </a>
                        <span style="background: #f1f5f9; color: #475569; padding: 2px 6px; border-radius: 4px; font-size: 11px; display: inline-block;">${ipo.type || 'Mainboard'}</span>
                    </td>
                    <td style="text-align: center;">${formatDateReadable(ipo.openDate)}</td>
                    <td style="text-align: center;">${formatDateReadable(ipo.closeDate)}</td>
                    <td style="text-align: center;">${formatDateReadable(ipo.allotmentDate)}</td>
                    <td style="text-align: center;">${formatDateReadable(ipo.listingDate)}</td>
                    <td style="text-align: center; font-weight: bold;">₹${ipo.priceBand}</td>
                    <td style="text-align: center;">${ipo.lotSize}</td>
                    <td style="text-align: center;">
                        ${formatGmpBadge(ipo.gmp)}
                    </td>
                    <td style="text-align: center; font-weight: 600; color: #1e293b;">${overallSubTimes}</td>
                    <td style="text-align: center;">${homeAllotmentHtml}</td>
                    <td style="text-align: center;">
                        <span class="${statusObj.class}">${statusObj.text}</span>
                    </td>
                </tr>
            `;
        });
    }

    // ફ્રન્ટ પેજ પેજિનેશન કંટ્રોલ અને માહિતી અપડેટ
    const infoEl = document.getElementById('homePaginationInfo');
    if (infoEl) {
        if (totalFiltered === 0) {
            infoEl.innerText = 'Showing 0 of 0 IPOs';
        } else {
            infoEl.innerText = `Showing ${startIndex + 1} to ${endIndex} of ${totalFiltered} IPOs (Page ${homeCurrentPage} of ${totalPages})`;
        }
    }

    const controlsEl = document.getElementById('homePaginationControls');
    if (controlsEl) {
        if (totalPages <= 1) {
            controlsEl.innerHTML = '';
        } else {
            let btnsHtml = '';
            btnsHtml += `<button type="button" onclick="setHomePage(1)" ${homeCurrentPage === 1 ? 'disabled' : ''} title="First Page">⏮ First</button>`;
            btnsHtml += `<button type="button" onclick="setHomePage(${homeCurrentPage - 1})" ${homeCurrentPage === 1 ? 'disabled' : ''} title="Previous Page">◀ Prev</button>`;

            const maxVisible = 5;
            let startP = Math.max(1, homeCurrentPage - Math.floor(maxVisible / 2));
            let endP = Math.min(totalPages, startP + maxVisible - 1);
            if (endP - startP + 1 < maxVisible) {
                startP = Math.max(1, endP - maxVisible + 1);
            }

            for (let p = startP; p <= endP; p++) {
                btnsHtml += `<button type="button" class="${p === homeCurrentPage ? 'active' : ''}" onclick="setHomePage(${p})">${p}</button>`;
            }

            btnsHtml += `<button type="button" onclick="setHomePage(${homeCurrentPage + 1})" ${homeCurrentPage === totalPages ? 'disabled' : ''} title="Next Page">Next ▶</button>`;
            btnsHtml += `<button type="button" onclick="setHomePage(${totalPages})" ${homeCurrentPage === totalPages ? 'disabled' : ''} title="Last Page">Last ⏭</button>`;

            controlsEl.innerHTML = btnsHtml;
        }
    }

    // પેજ સાઇઝ ડ્રોપડાઉન સિન્ક
    const sizeSelect = document.getElementById('homePageSizeSelect');
    if (sizeSelect && sizeSelect.value !== String(homePageSize)) {
        sizeSelect.value = String(homePageSize);
    }
}

function filterHomeIpos(type, event) {
    if (event) event.preventDefault();
    currentHomeFilter = type;
    homeCurrentPage = 1;

    const buttons = document.querySelectorAll('.hero-card .filter-buttons .filter-btn');
    buttons.forEach(btn => btn.classList.remove('active-btn'));

    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active-btn');
    }

    const searchInput = document.getElementById('ipoSearchInput');
    if (searchInput) searchInput.value = '';
    homeSearchQuery = '';

    loadHomeIpoTable(type);
}

function filterIpoTable() {
    const input = document.getElementById('ipoSearchInput');
    homeSearchQuery = input ? input.value.trim() : '';
    homeCurrentPage = 1;
    loadHomeIpoTable(currentHomeFilter);
}

function changeHomePageSize(val) {
    homePageSize = parseInt(val) || 50;
    localStorage.setItem('live_ipo_home_page_size', homePageSize);
    homeCurrentPage = 1;
    loadHomeIpoTable(currentHomeFilter);
}

function setHomePage(pageNum) {
    homeCurrentPage = pageNum;
    loadHomeIpoTable(currentHomeFilter);
    const tableEl = document.querySelector('.card-detail');
    if (tableEl) tableEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ==========================================
// 5. IPO CALENDAR PAGE LOGIC (Cloud Connected)
// ==========================================
async function loadCalendarTable(filterType = 'all') {
    const tableBody = document.getElementById('calendarTableBody');
    if (!tableBody) return;

    let dbData = await getMasterIpoData();
    tableBody.innerHTML = '';

    const ipoList = Object.keys(dbData).map(key => dbData[key]).filter(Boolean);
    ipoList.sort((a, b) => {
        const timeA = new Date(a.openDate || a.closeDate || 0).getTime();
        const timeB = new Date(b.openDate || b.closeDate || 0).getTime();
        if (timeB !== timeA) return timeB - timeA;
        return new Date(b.closeDate || 0).getTime() - new Date(a.closeDate || 0).getTime();
    });

    ipoList.forEach(ipo => {
        const statusObj = getIpoStatus(ipo.openDate, ipo.closeDate, ipo.allotmentDate, ipo.listingDate, ipo.isAllotmentOut);
        
        let matchesFilter = true;
        const today = new Date();
        today.setHours(0,0,0,0);
        const openDate = new Date(ipo.openDate);
        const closeDate = new Date(ipo.closeDate);

        if (filterType === 'live') {
            matchesFilter = (today >= openDate && today <= closeDate);
        } else if (filterType === 'upcoming') {
            matchesFilter = (today < openDate);
        } else if (filterType === 'closed') {
            matchesFilter = (today > closeDate);
        }

        if (matchesFilter) {
            tableBody.innerHTML += `
                <tr>
                    <td style="text-align: left; padding: 12px;">
                        <a href="ipo-detail.html?id=${ipo.id}" style="text-decoration: none;">
                            <strong style="color: #1d4ed8; display: block; cursor: pointer;">${ipo.name}</strong>
                        </a>
                        <span style="background: #f1f5f9; color: #475569; padding: 2px 6px; border-radius: 4px; font-size: 11px;">${ipo.type || 'Mainboard'}</span>
                    </td>
                    <td style="text-align: center;">
                        <span class="${statusObj.class}" style="padding: 4px 10px; border-radius: 20px; font-size: 11.5px; font-weight: 700; display: inline-block;">${statusObj.text}</span>
                    </td>
                    <td style="text-align: center;">${formatDateReadable(ipo.openDate)}</td>
                    <td style="text-align: center;">${formatDateReadable(ipo.closeDate)}</td>
                    <td style="text-align: center;">${formatDateReadable(ipo.allotmentDate)}</td>
                    <td style="text-align: center;">${formatDateReadable(ipo.listingDate)}</td>
                    <td style="text-align: center; font-weight: bold;">₹${ipo.priceBand}</td>
                    <td style="text-align: center;">
                        <a href="ipo-detail.html?id=${ipo.id}" class="view-details-btn" style="background-color: #1d4ed8; color: #ffffff; text-decoration: none; padding: 7px 14px; border-radius: 6px; font-size: 12.5px; display: inline-block;">View Details →</a>
                    </td>
                </tr>
            `;
        }
    });
}

function filterCalendar(type) {
    const buttons = document.querySelectorAll('.hero-card .filter-buttons button, .hero-card .filter-buttons a');
    buttons.forEach(btn => {
        btn.classList.remove('active-btn');
        btn.style.background = '#ffffff';
        btn.style.color = '#334155';
        btn.style.borderColor = '#cbd5e1';
    });

    if (window.event && window.event.currentTarget) {
        const clickedBtn = window.event.currentTarget;
        clickedBtn.classList.add('active-btn');
        clickedBtn.style.background = '#1d4ed8';
        clickedBtn.style.color = '#fff';
        clickedBtn.style.borderColor = '#1d4ed8';
    }

    loadCalendarTable(type);
}

// ==========================================
// 6. IPO DETAIL PAGE LOGIC (Cloud Connected)
// ==========================================
async function loadDynamicIpoDetails() {
    const urlParams = new URLSearchParams(window.location.search);
    let ipoId = urlParams.get('id');

    let dbData = await getMasterIpoData();
    if (!ipoId || !dbData[ipoId]) {
        ipoId = Object.keys(dbData)[0];
    }

    const ipo = dbData[ipoId];
    if (!ipo) return;

    const lotSizeNum = ipo.lotRaw || parseInt(ipo.lotSize) || 26;
    const cutOffPrice = ipo.cutOff || 0;
    const minInvestCalc = cutOffPrice * lotSizeNum;

    let retailLotCount = (ipo.customLots && ipo.customLots[0]) ? parseInt(ipo.customLots[0].lot) || 1 : 1;
    let hniLotCount = (ipo.customLots && ipo.customLots[1]) ? parseInt(ipo.customLots[1].lot) || 14 : 14;

    let retailTotalShares = retailLotCount * lotSizeNum;
    let hniTotalShares = hniLotCount * lotSizeNum;

    const logoWrap = document.getElementById('d_logo_wrap');
    if (logoWrap) {
        const logoVal = ipo.logo ? ipo.logo.trim() : '';
        if (logoVal.startsWith("http://") || logoVal.startsWith("https://") || logoVal.startsWith("data:image/")) {
            logoWrap.innerHTML = `<img src="${logoVal}" alt="Logo">`;
        } else {
            logoWrap.innerText = logoVal || ipo.id || "IPO";
        }
    }

    if (document.getElementById('d_name')) document.getElementById('d_name').innerText = ipo.name || "IPO Details";
    if (document.getElementById('d_type')) document.getElementById('d_type').innerText = (ipo.type || "Mainboard") + " IPO";
    if (document.getElementById('d_about')) document.getElementById('d_about').innerText = ipo.about || "No description available.";

    const openStr = formatDateReadable(ipo.openDate);
    const closeStr = formatDateReadable(ipo.closeDate);
    const allotStr = formatDateReadable(ipo.allotmentDate);
    const listStr = formatDateReadable(ipo.listingDate);

    if (document.getElementById('d_dates')) document.getElementById('d_dates').innerText = `${openStr} to ${closeStr}`;
    if (document.getElementById('d_priceband')) document.getElementById('d_priceband').innerText = ipo.priceBand ? `₹${ipo.priceBand}` : 'N/A';

    const timeline = calculateTimelineProgress(ipo.openDate, ipo.closeDate, ipo.allotmentDate, ipo.listingDate, ipo.isAllotmentOut);
    const progressEl = document.getElementById('d_progress');
    if (progressEl) progressEl.style.width = timeline.progressPercent;

    const timelineStepsEl = document.getElementById('d_timeline_steps');
    if (timelineStepsEl) {
        const renderCircle = (status) => {
            if (status.includes('upcoming')) return '';
            if (status.includes('completed') || status.includes('pulsing') || status.includes('active')) return '✓';
            return '';
        };

        timelineStepsEl.innerHTML = `
            <div class="step-node ${timeline.openStatus}"><div class="node-circle">${renderCircle(timeline.openStatus)}</div><div class="node-label">Open</div><div class="node-date">${openStr ? openStr.slice(0, 6) : '-'}</div></div>
            <div class="step-node ${timeline.closeStatus}"><div class="node-circle">${renderCircle(timeline.closeStatus)}</div><div class="node-label">Close</div><div class="node-date">${closeStr ? closeStr.slice(0, 6) : '-'}</div></div>
            <div class="step-node ${timeline.allotStatus}"><div class="node-circle">${renderCircle(timeline.allotStatus)}</div><div class="node-label">Allotment</div><div class="node-date">${allotStr ? allotStr.slice(0, 6) : '-'}</div></div>
            <div class="step-node ${timeline.listStatus}"><div class="node-circle">${renderCircle(timeline.listStatus)}</div><div class="node-label">Listing</div><div class="node-date">${listStr ? listStr.slice(0, 6) : '-'}</div></div>
        `;
    }

    if (document.getElementById('t_open')) document.getElementById('t_open').innerText = openStr;
    if (document.getElementById('t_close')) document.getElementById('t_close').innerText = closeStr;
    if (document.getElementById('t_allotment')) document.getElementById('t_allotment').innerText = allotStr;
    if (document.getElementById('t_listing')) document.getElementById('t_listing').innerText = listStr;

    if (document.getElementById('k_priceband')) document.getElementById('k_priceband').innerText = ipo.priceBand ? `₹${ipo.priceBand}` : 'N/A';
    if (document.getElementById('k_cutoff')) document.getElementById('k_cutoff').innerText = cutOffPrice ? `₹${cutOffPrice} per share` : 'N/A';
    if (document.getElementById('k_lotsize')) document.getElementById('k_lotsize').innerText = lotSizeNum.toLocaleString('en-IN') + " Shares";
    if (document.getElementById('k_mininvest')) document.getElementById('k_mininvest').innerText = minInvestCalc ? `₹${minInvestCalc.toLocaleString('en-IN')}` : ipo.minInvestment || 'N/A';
    if (document.getElementById('k_facevalue')) document.getElementById('k_facevalue').innerText = formatFaceValue(ipo.faceValue);
    if (document.getElementById('k_empdiscount')) document.getElementById('k_empdiscount').innerText = ipo.empDiscount || "Nil";
    
    if (document.getElementById('k_totalsize')) document.getElementById('k_totalsize').innerText = formatIssueSizeWithAmount(ipo.totalSize, cutOffPrice);
    if (document.getElementById('k_freshissue')) document.getElementById('k_freshissue').innerText = formatIssueSizeWithAmount(ipo.freshIssue, cutOffPrice);
    if (document.getElementById('k_ofs')) document.getElementById('k_ofs').innerText = formatIssueSizeWithAmount(ipo.ofs, cutOffPrice);
    if (document.getElementById('k_listingat')) document.getElementById('k_listingat').innerText = ipo.listingAt || "BSE, NSE";

    if (document.getElementById('l_date')) document.getElementById('l_date').innerText = listStr;
    if (document.getElementById('l_bse')) document.getElementById('l_bse').innerText = ipo.bseCode || 'N/A';
    if (document.getElementById('l_nse')) document.getElementById('l_nse').innerText = ipo.nseCode || 'N/A';
    if (document.getElementById('l_isin')) document.getElementById('l_isin').innerText = ipo.isinCode || 'N/A';
    if (document.getElementById('l_price')) document.getElementById('l_price').innerText = cutOffPrice ? `₹${cutOffPrice}` : 'N/A';
    if (document.getElementById('l_lotsize')) document.getElementById('l_lotsize').innerText = lotSizeNum.toLocaleString('en-IN') + " Shares";
    if (document.getElementById('l_expprice')) document.getElementById('l_expprice').innerText = ipo.expectedListingPrice || ipo.estPrice || 'N/A';
    if (document.getElementById('l_profit')) document.getElementById('l_profit').innerText = ipo.bookProfit || 'N/A';
    if (document.getElementById('l_stoploss')) document.getElementById('l_stoploss').innerText = ipo.stopLoss || 'N/A';

    if (document.getElementById('doc_drhp')) document.getElementById('doc_drhp').href = ipo.drhpLink || "#";
    if (document.getElementById('doc_rhp')) document.getElementById('doc_rhp').href = ipo.rhpLink || "#";
    if (document.getElementById('doc_anchor')) document.getElementById('doc_anchor').href = ipo.anchorLink || "#";

    const val = ipo.valuation || {};
    if (document.getElementById('v_eps')) document.getElementById('v_eps').innerText = val.eps || 'N/A';
    if (document.getElementById('v_pe')) document.getElementById('v_pe').innerText = val.pe || 'N/A';
    if (document.getElementById('v_ronw')) document.getElementById('v_ronw').innerText = val.ronw || 'N/A';
    if (document.getElementById('v_nav')) document.getElementById('v_nav').innerText = val.nav || 'N/A';
    if (document.getElementById('v_ebitda')) document.getElementById('v_ebitda').innerText = val.ebitdaMargin || 'N/A';
    if (document.getElementById('v_pat')) document.getElementById('v_pat').innerText = val.patMargin || 'N/A';

    if (document.getElementById('g_gmp')) {
        const rawGmp = parseFloat((ipo.gmp || '').toString().replace(/₹/g, '').replace(/,/g, '').trim());
        if (!isNaN(rawGmp) && rawGmp > 0) {
            document.getElementById('g_gmp').innerHTML = `<strong style="color: #16a34a; font-size: 15px;">+₹${rawGmp}</strong>`;
        } else if (!isNaN(rawGmp) && rawGmp < 0) {
            document.getElementById('g_gmp').innerHTML = `<strong style="color: #dc2626; font-size: 15px;">-₹${Math.abs(rawGmp)}</strong>`;
        } else {
            document.getElementById('g_gmp').innerHTML = `<span style="color: #94a3b8; font-weight: 600;">-</span>`;
        }
    }

    const rawGmpVal = parseFloat(ipo.gmp) || 0;
    let issuePriceVal = cutOffPrice;
    if (!issuePriceVal && ipo.priceBand) {
        const parts = ipo.priceBand.split('to');
        issuePriceVal = parseFloat(parts[parts.length - 1].trim()) || 0;
    }
    const estimatedListingPriceCalc = (issuePriceVal > 0 && rawGmpVal > 0) ? issuePriceVal + rawGmpVal : 0;
    
    if (document.getElementById('g_estprice')) {
        document.getElementById('g_estprice').innerText = estimatedListingPriceCalc > 0 ? `₹${estimatedListingPriceCalc.toLocaleString('en-IN')}` : (ipo.estPrice || 'N/A');
    }
    
    const exactRetailProfit = rawGmpVal * retailTotalShares;
    if (document.getElementById('g_profit')) {
        document.getElementById('g_profit').innerText = rawGmpVal > 0 ? `₹${exactRetailProfit.toLocaleString('en-IN')}` : 'N/A';
    }

    if (document.getElementById('g_kostak')) document.getElementById('g_kostak').innerText = ipo.kostak || 'N/A';
    if (document.getElementById('g_ss')) document.getElementById('g_ss').innerText = ipo.ss || 'N/A';

    const hniProfitTotal = rawGmpVal * hniTotalShares;

    if (document.getElementById('g_hni_profit')) {
        document.getElementById('g_hni_profit').innerText = `₹${hniProfitTotal.toLocaleString('en-IN')}`;
    }
    
    const reservationTbody = document.getElementById('reservationTableBody');
    if (reservationTbody) {
        reservationTbody.innerHTML = '';
        
        let totalSharesCount = 0;
        if (ipo.totalSize) {
            let rawTotal = ipo.totalSize.replace(/[^0-9]/g, '');
        }
        
        let baseShares = parseFloat(ipo.lotRaw) * 100000 || 5152000;
        if (ipo.totalSize) {
            const sharesMatch = ipo.totalSize.match(/([\d,]+)\s*shares/i);
            if (sharesMatch) {
                let parsed = parseFloat(sharesMatch[1].replace(/,/g, ''));
                if (parsed > 0) baseShares = parsed;
            } else if (!isNaN(parseFloat(ipo.totalSize.replace(/,/g, '')))) {
                baseShares = parseFloat(ipo.totalSize.replace(/,/g, ''));
            }
        }

        let reservationData = (ipo.reservation && ipo.reservation.length > 0) ? [...ipo.reservation] : [
            { category: "QIB", percentage: "50%" },
            { category: "NII (HNI)", percentage: "15%" },
            { category: "Retail", percentage: "35%" }
        ];

        reservationData.forEach(row => {
            let pct = parseFloat(row.percentage) || 0;
            let calculatedShares = Math.round((baseShares * pct) / 100);
            let formattedShares = calculatedShares > 0 ? calculatedShares.toLocaleString('en-IN') : row.shares || '0';

            reservationTbody.innerHTML += `
                <tr>
                    <td style="text-align:left;"><strong>${row.category}</strong></td>
                    <td style="text-align:center;">${row.percentage}</td>
                    <td style="text-align:center;">${formattedShares}</td>
                </tr>
            `;
        });
    }

    const subSharesTbody = document.getElementById('subSharesTableBody');
    if (subSharesTbody) {
        subSharesTbody.innerHTML = '';
        let totalOfferedShares = 0, totalAppliedShares = 0;
        const sharesData = ipo.subShares || [];

        sharesData.forEach(row => {
            if (row.cat !== "B-NII(₹10L+)" && row.cat !== "S-NII(₹2-10L)") {
                totalOfferedShares += (row.off || 0);
                totalAppliedShares += (row.app || 0);
            }
            
            let times = (row.off > 0 && row.app > 0) ? (row.app / row.off).toFixed(2) : '-';
            let offText = row.off > 0 ? row.off.toLocaleString('en-IN') : '-';
            let appText = row.app > 0 ? row.app.toLocaleString('en-IN') : '-';

            subSharesTbody.innerHTML += `
                <tr>
                    <td style="text-align:left;">${row.cat}</td>
                    <td style="text-align:center;">${offText}</td>
                    <td style="text-align:center;">${appText}</td>
                    <td style="text-align:center; font-weight: 600;">${times !== '-' ? times + 'x' : '-'}</td>
                </tr>
            `;
        });

        let totalShareTimes = totalOfferedShares > 0 ? (totalAppliedShares / totalOfferedShares).toFixed(2) + 'x' : '0.00x';
        subSharesTbody.innerHTML += `
            <tr style="background-color: #f8fafc; font-weight: 700;">
                <td style="text-align:left;">Total</td>
                <td style="text-align:center;">${totalOfferedShares.toLocaleString('en-IN')}</td>
                <td style="text-align:center;">${totalAppliedShares.toLocaleString('en-IN')}</td>
                <td style="text-align:center; color: #1d4ed8;">${totalShareTimes}</td>
            </tr>
        `;
    }

    const lotBody = document.getElementById('lotMatrixBody');
    if (lotBody) {
        lotBody.innerHTML = '';
        
        let lotsList = (ipo.customLots && ipo.customLots.length > 0) ? [...ipo.customLots] : [
            { app: "Retail Min", lot: 1 },
            { app: "Small HNI", lot: 14 },
            { app: "Big HNI", lot: 68 }
        ];

        lotsList.forEach(row => {
            const lotVal = parseInt(row.lot) || 1;
            const totalShares = lotVal * lotSizeNum;
            const totalAmt = totalShares * cutOffPrice;
            
            lotBody.innerHTML += `
                <tr>
                    <td style="text-align:left;"><strong>${row.app}</strong></td>
                    <td style="text-align:center;">${lotVal}</td>
                    <td style="text-align:center;">${totalShares.toLocaleString('en-IN')}</td>
                    <td style="text-align:center;">${totalAmt ? '₹' + totalAmt.toLocaleString('en-IN') : 'N/A'}</td>
                </tr>
            `;
        });
    }

    const subAppsTbody = document.getElementById('subAppsTableBody');
    if (subAppsTbody) {
        subAppsTbody.innerHTML = '';
        const appsData = ipo.subApps || [];
        const lotSizeNum = ipo.lotRaw || parseInt(ipo.lotSize) || 1;

        let retailTotalShares = lotSizeNum;
        let sHniTotalShares = lotSizeNum * 14;
        let bHniTotalShares = lotSizeNum * 68;

        if (ipo.customLots && ipo.customLots.length > 0) {
            ipo.customLots.forEach(cl => {
                const appName = cl.app ? cl.app.toLowerCase() : '';
                const lotVal = parseInt(cl.lot) || 1;
                const totalSh = lotVal * lotSizeNum;

                if (appName.includes('retail')) {
                    retailTotalShares = totalSh;
                } else if (appName.includes('small') || appName.includes('s-nii') || appName.includes('s-hni')) {
                    sHniTotalShares = totalSh;
                } else if (appName.includes('big') || appName.includes('b-nii') || appName.includes('b-hni')) {
                    bHniTotalShares = totalSh;
                }
            });
        }

        let calculatedApps = [];
        if (ipo.subShares && ipo.subShares.length > 0) {
            ipo.subShares.forEach(s => {
                if (s.cat === "B-NII(₹10L+)" || s.cat === "S-NII(₹2-10L)" || s.cat === "Retail") {
                    calculatedApps.push({ cat: s.cat, off: s.off || 0, app: s.app || 0 });
                }
            });
        } else if (appsData.length > 0) {
            calculatedApps = appsData;
        }

        if (calculatedApps.length === 0) {
            calculatedApps = [
                { cat: "B-NII(₹10L+)", off: 0, app: 0 },
                { cat: "S-NII(₹2-10L)", off: 0, app: 0 },
                { cat: "Retail", off: 0, app: 0 }
            ];
        }

        calculatedApps.forEach(row => {
            let reserveDivisor = retailTotalShares;
            let appliedDivisor = retailTotalShares;

            if (row.cat.includes("B-NII")) {
                reserveDivisor = sHniTotalShares;
                appliedDivisor = bHniTotalShares;
            } else if (row.cat.includes("S-NII")) {
                reserveDivisor = sHniTotalShares;
                appliedDivisor = sHniTotalShares;
            } else if (row.cat.includes("Retail")) {
                reserveDivisor = retailTotalShares;
                appliedDivisor = retailTotalShares;
            }

            let reserveApps = (row.off > 0 && reserveDivisor > 0) ? Math.round(row.off / reserveDivisor) : '-';
            let appliedApps = (row.app > 0 && appliedDivisor > 0) ? Math.round(row.app / appliedDivisor) : '-';
            
            let appTimes = (typeof reserveApps === 'number' && typeof appliedApps === 'number' && reserveApps > 0) ? (appliedApps / reserveApps).toFixed(2) : '-';

            let resText = typeof reserveApps === 'number' ? reserveApps.toLocaleString('en-IN') : '-';
            let appText = typeof appliedApps === 'number' ? appliedApps.toLocaleString('en-IN') : '-';

            subAppsTbody.innerHTML += `
                <tr>
                    <td style="text-align:left;">${row.cat}</td>
                    <td style="text-align:center;">${resText}</td>
                    <td style="text-align:center;">${appText}</td>
                    <td style="text-align:center; font-weight: 600;">${appTimes !== '-' ? appTimes + 'x' : '-'}</td>
                </tr>
            `;
        });
    }

    // Company Financials rendering fix
    const finTbody = document.getElementById('financialsTableBody');
    if (finTbody && ipo.fin) {
        finTbody.innerHTML = '';
        const finObj = ipo.fin || {};
        const fList = [
            finObj.fy24 || { yr: "FY-2024", ast: "-", rev: "-", exp: "-", prf: "-" },
            finObj.fy25 || { yr: "FY-2025", ast: "-", rev: "-", exp: "-", prf: "-" },
            finObj.fy26 || { yr: "FY-2026", ast: "-", rev: "-", exp: "-", prf: "-" },
            finObj.jun26 || finObj.latest || { yr: "30 Jun 2026", ast: "-", rev: "-", exp: "-", prf: "-" }
        ];

        fList.forEach(f => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="text-align:left;"><strong>${f.yr || 'FY'}</strong></td>
                <td style="text-align:center;">${f.ast || '-'}</td>
                <td style="text-align:center;">${f.rev || '-'}</td>
                <td style="text-align:center;">${f.exp || '-'}</td>
                <td style="text-align:center;">${f.prf || '-'}</td>
            `;
            finTbody.appendChild(tr);
        });
    }

    // ==========================================
    // IPO Registrar (Dynamic Sync from Manage Registrars)
    // ==========================================
    const savedRegistrars = JSON.parse(localStorage.getItem('live_ipo_registrars')) || [];
    let matchedReg = savedRegistrars.find(r => r.url === ipo.registrarUrl || r.name === ipo.regName);

    if (matchedReg) {
        if (document.getElementById('reg_name')) document.getElementById('reg_name').innerText = matchedReg.name || 'N/A';
        
        const webEl = document.getElementById('reg_web');
        if (webEl) {
            webEl.innerText = matchedReg.website || matchedReg.url || 'N/A';
            webEl.href = matchedReg.url || '#';
        }

        if (document.getElementById('reg_mobile')) document.getElementById('reg_mobile').innerText = matchedReg.mobile || 'N/A';

        const emailEl = document.getElementById('reg_email');
        if (emailEl) {
            emailEl.innerText = matchedReg.email || 'N/A';
            emailEl.href = matchedReg.email ? `mailto:${matchedReg.email}` : '#';
        }

        const allotUrlEl = document.getElementById('reg_allotment_url');
        if (allotUrlEl) {
            allotUrlEl.href = ipo.registrarUrl || matchedReg.url || '#';
            allotUrlEl.innerHTML = "🔍 Check Allotment";
        }
    } else {
        if (document.getElementById('reg_name')) document.getElementById('reg_name').innerText = ipo.regName || "Link Intime India Private Ltd";
        const webEl = document.getElementById('reg_web');
        if (webEl) {
            webEl.innerText = ipo.regWeb || "linkintime.co.in";
            webEl.href = ipo.registrarUrl || "https://" + (ipo.regWeb || "#");
        }
        if (document.getElementById('reg_mobile')) document.getElementById('reg_mobile').innerText = ipo.regMobile || 'N/A';
        if (document.getElementById('reg_email')) document.getElementById('reg_email').innerText = ipo.regEmail || "ipo@linkintime.co.in";
        
        const allotUrlEl = document.getElementById('reg_allotment_url');
        if (allotUrlEl) {
            allotUrlEl.href = ipo.registrarUrl || '#';
            allotUrlEl.innerText = "Click to Check Allotment ↗";
        }
    }

    if (document.getElementById('reg_leads')) document.getElementById('reg_leads').innerText = ipo.leadManagers || "Kotak Mahindra Capital, Axis Capital";

    if (document.getElementById('qs_priceband')) {
        document.getElementById('qs_priceband').innerText = ipo.priceBand ? `₹${ipo.priceBand}` : 'N/A';
        
        document.getElementById('qs_lotsize').innerHTML = `Retail: <strong>${retailTotalShares.toLocaleString('en-IN')} Shares</strong><br>HNI: <strong>${hniTotalShares.toLocaleString('en-IN')} Shares (${hniLotCount} Lots)</strong>`;

        let retailTotalInv = retailTotalShares * cutOffPrice;
        let hniTotalInv = hniTotalShares * cutOffPrice;

        document.getElementById('qs_investment').innerHTML = `Retail: <strong>₹${retailTotalInv.toLocaleString('en-IN')}</strong><br>HNI: <strong>₹${hniTotalInv.toLocaleString('en-IN')}</strong>`;

        let totalOff = 0, totalApp = 0;
        if (ipo.subShares) {
            ipo.subShares.forEach(row => {
                if (row.cat !== "B-NII(₹10L+)" && row.cat !== "S-NII(₹2-10L)") {
                    totalOff += (row.off || 0);
                    totalApp += (row.app || 0);
                }
            });
        }
        let overallSubTimes = totalOff > 0 ? (totalApp / totalOff).toFixed(2) + 'x' : '0.00x';
        document.getElementById('qs_subscribed').innerText = overallSubTimes;

        const upperPriceVal = ipo.priceBand ? parseFloat(ipo.priceBand.split('to')[1] || ipo.priceBand) : 0;
        const gmpPct = upperPriceVal > 0 ? ((rawGmpVal / upperPriceVal) * 100).toFixed(1) : '0.0';
        if (rawGmpVal > 0) {
            document.getElementById('qs_gmp').innerHTML = `<span style="color: #16a34a; font-weight: 700;">+₹${rawGmpVal}</span> <span style="font-size:11px; color:#16a34a; font-weight: 600;">(+${gmpPct}%)</span>`;
        } else if (rawGmpVal < 0) {
            document.getElementById('qs_gmp').innerHTML = `<span style="color: #dc2626; font-weight: 700;">-₹${Math.abs(rawGmpVal)}</span> <span style="font-size:11px; color:#dc2626; font-weight: 600;">(${gmpPct}%)</span>`;
        } else {
            document.getElementById('qs_gmp').innerHTML = `<span style="color: #94a3b8; font-weight: 600;">-</span>`;
        }

        document.getElementById('qs_profit').innerHTML = `Retail: <strong style="color: #166534;">₹${exactRetailProfit.toLocaleString('en-IN')}</strong><br>HNI: <strong style="color: #166534;">₹${hniProfitTotal.toLocaleString('en-IN')}</strong>`;

        const currentStatusObj = getIpoStatus(ipo.openDate, ipo.closeDate, ipo.allotmentDate, ipo.listingDate, ipo.isAllotmentOut);
        document.getElementById('qs_status').innerHTML = `<span class="${currentStatusObj.class}" style="padding: 4px 10px; border-radius: 20px; font-size: 11.5px; display: inline-block;">${currentStatusObj.text}</span>`;
        
        const allotmentCell = document.getElementById('qs_allotment_btn');
        if (allotmentCell) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const allotDate = ipo.allotmentDate ? new Date(ipo.allotmentDate) : null;
            if (allotDate) allotDate.setHours(0, 0, 0, 0);

            if (ipo.isAllotmentOut === true || (allotDate && today >= allotDate)) {
                const regLink = ipo.registrarUrl || (ipo.regWeb ? `https://${ipo.regWeb}` : '#');
                allotmentCell.innerHTML = `
                    <a href="${regLink}" target="_blank" style="background-color: #16a34a; color: #ffffff; text-decoration: none; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        🔍 Check Allotment
                    </a>
                `;
            } else {
                allotmentCell.innerHTML = `<span style="color: #c2410c; background-color: #ffedd5; padding: 3px 8px; border-radius: 4px; font-size: 11.5px; font-weight: 700;">Waiting</span>`;
            }
        }
    }

    initLiveIpoPriceTracker(ipo, issuePriceVal);
    try {
        initPageViewsCounter(ipoId);
    } catch (_) {}
}

// ==========================================
// 6.1 LIVE LISTING & CURRENT PRICE ENGINE (NSE & BSE)
// ==========================================
function formatStockPriceInr(val) {
    const num = parseFloat(val);
    if (isNaN(num) || num <= 0) return null;
    return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function normalizeIpoCompanyName(str) {
    return (str || '')
        .toLowerCase()
        .replace(/\b(ipo|details|limited|ltd\.?|private|pvt\.?|india)\b/g, ' ')
        .replace(/[^a-z0-9]/g, '');
}

function cleanIpoNameQuery(str) {
    return (str || '')
        .replace(/\b(ipo|details|limited|ltd\.?|private|pvt\.?)\b/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function buildExchangePriceLine(label, priceVal, pctVal, tooltip, useDayColorForPct) {
    const formatted = formatStockPriceInr(priceVal);
    if (!formatted) return '';
    let badgeHtml = '';
    if (pctVal !== null && pctVal !== undefined && !isNaN(pctVal)) {
        const sign = pctVal > 0 ? '+' : '';
        const color = pctVal > 0 ? '#16a34a' : (pctVal < 0 ? '#dc2626' : '#64748b');
        const decimals = useDayColorForPct ? 2 : 1;
        badgeHtml = ` <span style="font-size:11px; color:${color}; font-weight:600;">(${sign}${pctVal.toFixed(decimals)}%)</span>`;
    }
    const titleAttr = tooltip ? ` title="${tooltip.replace(/"/g, '&quot;')}"` : '';
    return `<span${titleAttr} style="display:inline-block;"><span style="color:#64748b; font-size:11px; font-weight:700;">${label}:</span> <strong style="color:#0f172a;">₹${formatted}</strong>${badgeHtml}</span>`;
}

function renderQuickListingPrices(listEl, nsePrice, bsePrice, issuePrice) {
    if (!listEl) return;
    const rows = [];
    const calcPct = (p) => (issuePrice > 0 && p > 0) ? (((p - issuePrice) / issuePrice) * 100) : null;
    if (nsePrice > 0) {
        const pct = calcPct(nsePrice);
        const tip = issuePrice > 0 ? `NSE Listing Open: ₹${formatStockPriceInr(nsePrice)} vs IPO Issue Price ₹${issuePrice}` : '';
        rows.push(buildExchangePriceLine('NSE', nsePrice, pct, tip, false));
    }
    if (bsePrice > 0) {
        const pct = calcPct(bsePrice);
        const tip = issuePrice > 0 ? `BSE Listing Open: ₹${formatStockPriceInr(bsePrice)} vs IPO Issue Price ₹${issuePrice}` : '';
        rows.push(buildExchangePriceLine('BSE', bsePrice, pct, tip, false));
    }
    listEl.innerHTML = rows.length > 0 ? rows.join('<br>') : `<span style="color:#94a3b8; font-weight:600;">-</span>`;
}

function renderQuickCurrentPrices(currEl, nseQuote, bseQuote, issuePrice, prevState) {
    if (!currEl) return;
    const rows = [];
    const buildLiveRow = (label, quote) => {
        if (!quote || !(quote.price > 0)) return '';
        const overallPct = issuePrice > 0 ? (((quote.price - issuePrice) / issuePrice) * 100) : null;
        const overallStr = overallPct !== null ? ` | Overall IPO Return: ${overallPct > 0 ? '+' : ''}${overallPct.toFixed(2)}%` : '';
        const chgStr = quote.chg !== null && !isNaN(quote.chg) ? ` | Day: ${quote.chg > 0 ? '+' : ''}${quote.chg.toFixed(2)} (${quote.pct > 0 ? '+' : ''}${quote.pct.toFixed(2)}%)` : '';
        const updStr = quote.lastupd ? ` | Updated: ${quote.lastupd}` : '';
        const tip = `${label} Live: ₹${formatStockPriceInr(quote.price)}${chgStr}${overallStr}${updStr}`;
        return buildExchangePriceLine(label, quote.price, quote.pct, tip, true);
    };

    const nseRow = buildLiveRow('NSE', nseQuote);
    const bseRow = buildLiveRow('BSE', bseQuote);
    if (nseRow) rows.push(nseRow);
    if (bseRow) rows.push(bseRow);

    if (rows.length === 0) {
        currEl.innerHTML = `<span style="color:#94a3b8; font-weight:600;">-</span>`;
        return;
    }
    currEl.innerHTML = rows.join('<br>');

    // Flash subtle tick highlight when either exchange price moves live
    const nextNse = nseQuote?.price || 0;
    const nextBse = bseQuote?.price || 0;
    if (prevState.initialized && (nextNse !== prevState.nse || nextBse !== prevState.bse)) {
        const wentUp = (nextNse > prevState.nse) || (nextBse > prevState.bse);
        currEl.style.transition = 'background-color 0.25s ease';
        currEl.style.backgroundColor = wentUp ? '#dcfce7' : '#fee2e2';
        setTimeout(() => { currEl.style.backgroundColor = ''; }, 650);
    }
    prevState.nse = nextNse;
    prevState.bse = nextBse;
    prevState.initialized = true;
}

async function queryMoneycontrolSuggestBrowser(q) {
    if (!q) return [];
    try {
        const r = await fetch(`https://www.moneycontrol.com/mccode/common/autosuggestion_solr.php?classic=true&query=${encodeURIComponent(q)}&type=1&format=json`, {
            cache: 'no-store'
        });
        if (!r.ok) return [];
        const data = await r.json();
        return Array.isArray(data) ? data.filter(x => x && x.sc_id && x.sc_id !== '0') : [];
    } catch {
        return [];
    }
}

async function resolveMoneycontrolIdInBrowser(ipo) {
    if (ipo.mcScId) return ipo.mcScId;
    if (ipo.isinCode) {
        const hits = await queryMoneycontrolSuggestBrowser(ipo.isinCode);
        if (hits.length > 0) {
            const match = hits.find(h => (h.pdt_dis_nm || '').toUpperCase().includes(ipo.isinCode.toUpperCase()));
            return (match || hits[0]).sc_id;
        }
    }
    if (ipo.nseCode) {
        const hits = await queryMoneycontrolSuggestBrowser(ipo.nseCode);
        const match = hits.find(h => (h.pdt_dis_nm || '').toUpperCase().includes(ipo.nseCode.toUpperCase()));
        if (match) return match.sc_id;
    }
    if (ipo.bseCode) {
        const hits = await queryMoneycontrolSuggestBrowser(ipo.bseCode);
        const match = hits.find(h => (h.pdt_dis_nm || '').includes(ipo.bseCode));
        if (match) return match.sc_id;
    }
    const cleanQ = cleanIpoNameQuery(ipo.name);
    const targetNorm = normalizeIpoCompanyName(ipo.name);
    if (cleanQ && targetNorm) {
        const hits = await queryMoneycontrolSuggestBrowser(cleanQ);
        const match = hits.find(h => normalizeIpoCompanyName(h.stock_name || h.name) === targetNorm);
        if (match) return match.sc_id;
    }
    return null;
}

function parseMoneycontrolPriceFeed(resJson, expectedIsin, expectedCode, codeField) {
    if (!resJson || String(resJson.code) !== '200' || !resJson.data) return null;
    const d = resJson.data;
    const price = parseFloat(d.pricecurrent);
    if (isNaN(price) || price <= 0) return null;
    if (expectedIsin && d.isinid && d.isinid.toUpperCase() !== expectedIsin.toUpperCase()) return null;
    if (expectedCode && d[codeField] && String(d[codeField]).toUpperCase() !== String(expectedCode).toUpperCase()) return null;
    return {
        price,
        chg: parseFloat(d.pricechange),
        pct: parseFloat(d.pricepercentchange),
        opn: parseFloat(d.OPN),
        prevdate: d.PREVDATE,
        clMaxDt: d.clMaxDt,
        lastupd: d.lastupd || '',
        code: d[codeField] ? String(d[codeField]).toUpperCase() : '',
        isin: d.isinid ? String(d.isinid).toUpperCase() : ''
    };
}

async function initLiveIpoPriceTracker(ipo, issuePrice) {
    if (window._ipoDetailLiveTimer) {
        clearInterval(window._ipoDetailLiveTimer);
        window._ipoDetailLiveTimer = null;
    }

    const listEl = document.getElementById('qs_listing_price');
    const currEl = document.getElementById('qs_current_price');
    if (!listEl && !currEl) return;

    const listAtUpper = (ipo.listingAt || 'BSE, NSE').toUpperCase();
    const allowNse = listAtUpper.includes('NSE') || !!ipo.nseCode || !!ipo.listingPriceNse;
    const allowBse = listAtUpper.includes('BSE') || !!ipo.bseCode || !!ipo.listingPriceBse;

    let nseListing = allowNse ? (parseFloat(ipo.listingPriceNse) || 0) : 0;
    let bseListing = allowBse ? (parseFloat(ipo.listingPriceBse) || 0) : 0;

    // Immediately render saved listing prices (zero wait)
    renderQuickListingPrices(listEl, nseListing, bseListing, issuePrice);

    const istTodayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const mightBeListed = !ipo.listingDate || ipo.listingDate <= istTodayStr || !!ipo.mcScId || nseListing > 0 || bseListing > 0;
    if (!mightBeListed) {
        renderQuickCurrentPrices(currEl, null, null, issuePrice, { initialized: false, nse: 0, bse: 0 });
        return;
    }

    const scId = await resolveMoneycontrolIdInBrowser(ipo);
    if (!scId) {
        renderQuickCurrentPrices(currEl, null, null, issuePrice, { initialized: false, nse: 0, bse: 0 });
        return;
    }

    const tickState = { initialized: false, nse: 0, bse: 0 };
    let isFetching = false;

    const refreshPrices = async () => {
        if (isFetching) return false;
        isFetching = true;
        try {
            const ts = Date.now();
            const [nseRaw, bseRaw] = await Promise.all([
                allowNse ? fetch(`https://priceapi.moneycontrol.com/pricefeed/nse/equitycash/${encodeURIComponent(scId)}?_=${ts}`, { cache: 'no-store' }).then(r => r.json()).catch(() => null) : Promise.resolve(null),
                allowBse ? fetch(`https://priceapi.moneycontrol.com/pricefeed/bse/equitycash/${encodeURIComponent(scId)}?_=${ts}`, { cache: 'no-store' }).then(r => r.json()).catch(() => null) : Promise.resolve(null)
            ]);

            const nseQ = parseMoneycontrolPriceFeed(nseRaw, ipo.isinCode, ipo.nseCode, 'NSEID');
            const bseQ = parseMoneycontrolPriceFeed(bseRaw, ipo.isinCode, ipo.bseCode, 'BSEID');

            // Fill Listing Details card (#section-listing) live if JSONBin didn't have codes yet
            const bseEl = document.getElementById('l_bse');
            const nseEl = document.getElementById('l_nse');
            const isinEl = document.getElementById('l_isin');
            if (bseEl && bseEl.innerText === 'N/A' && bseQ?.code) bseEl.innerText = bseQ.code;
            if (nseEl && nseEl.innerText === 'N/A' && nseQ?.code) nseEl.innerText = nseQ.code;
            const liveIsin = nseQ?.isin || bseQ?.isin;
            if (isinEl && isinEl.innerText === 'N/A' && liveIsin) isinEl.innerText = liveIsin;

            // Listing Day Fallback (if Chittorgarh Open row isn't saved yet)
            let listingChanged = false;
            if (nseQ && !(nseListing > 0) && nseQ.opn > 0) {
                const updDate = nseQ.lastupd.slice(0, 10);
                if (!nseQ.prevdate || (updDate && ipo.listingDate && updDate === ipo.listingDate) || (nseQ.clMaxDt && updDate && nseQ.clMaxDt === updDate)) {
                    nseListing = nseQ.opn;
                    listingChanged = true;
                }
            }
            if (bseQ && !(bseListing > 0) && bseQ.opn > 0) {
                const updDate = bseQ.lastupd.slice(0, 10);
                if (!bseQ.prevdate || (updDate && ipo.listingDate && updDate === ipo.listingDate) || (bseQ.clMaxDt && updDate && bseQ.clMaxDt === updDate)) {
                    bseListing = bseQ.opn;
                    listingChanged = true;
                }
            }
            if (listingChanged) {
                renderQuickListingPrices(listEl, nseListing, bseListing, issuePrice);
            }

            renderQuickCurrentPrices(currEl, nseQ, bseQ, issuePrice, tickState);
            return Boolean(nseQ || bseQ);
        } finally {
            isFetching = false;
        }
    };

    const hasLiveFeed = await refreshPrices();
    if (hasLiveFeed) {
        window._ipoDetailLiveTimer = setInterval(() => {
            if (!document.hidden) refreshPrices();
        }, 5000);
    }
}

// ==========================================
// 7. IMAGE SHARING UTILITIES (html2canvas)
// ==========================================
async function shareSectionAsImage(sectionId, fileNamePrefix) {
    const sectionEl = document.getElementById(sectionId);
    if (!sectionEl) return;

    const shareBtn = sectionEl.querySelector('.btn-share');
    if (shareBtn) shareBtn.style.display = 'none';

    // Hide any existing static footer
    const existingFooters = sectionEl.querySelectorAll('.export-brand-footer');
    existingFooters.forEach(f => f.style.display = 'none');

    // Get IPO details from page
    const ipoName = (document.getElementById('d_name') ? document.getElementById('d_name').innerText.trim() : '') || 'IPO Details';
    const ipoType = (document.getElementById('d_type') ? document.getElementById('d_type').innerText.trim() : '') || 'Mainboard IPO';
    const ipoDates = (document.getElementById('d_dates') ? document.getElementById('d_dates').innerText.trim() : '');
    const ipoPrice = (document.getElementById('d_priceband') ? document.getElementById('d_priceband').innerText.trim() : '');
    const isSme = ipoType.toLowerCase().includes('sme');

    // Meta details line
    let metaParts = [];
    if (ipoPrice) metaParts.push(`Price: ${ipoPrice}`);
    if (ipoDates) metaParts.push(`Dates: ${ipoDates}`);
    const metaLine = metaParts.join('  •  ');

    // 1. Create Branded Header at the TOP of the section (Centered IPO Name)
    const exportHeader = document.createElement('div');
    exportHeader.className = 'dynamic-export-header';
    exportHeader.style.cssText = `
        background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
        color: #ffffff;
        padding: 16px 18px;
        border-radius: 9px 9px 0 0;
        margin: -16px -18px 14px -18px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        border-bottom: 2.5px solid #0284c7;
        font-family: inherit;
        box-sizing: border-box;
    `;
    exportHeader.innerHTML = `
        <div style="text-align: center; width: 100%;">
            <div style="display: flex; align-items: center; justify-content: center; gap: 8px; flex-wrap: wrap;">
                <span style="font-size: 18px; font-weight: 800; color: #ffffff; letter-spacing: -0.2px;">${ipoName}</span>
                <span style="background: ${isSme ? '#9333ea' : '#0284c7'}; color: #ffffff; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700;">${ipoType}</span>
            </div>
            ${metaLine ? `<div style="font-size: 12px; color: #94a3b8; margin-top: 4px; font-weight: 500;">${metaLine}</div>` : ''}
        </div>
    `;

    // 2. Create Branded Footer at the BOTTOM of the section
    const exportFooter = document.createElement('div');
    exportFooter.className = 'dynamic-export-footer';
    exportFooter.style.cssText = `
        background: #f8fafc;
        border-top: 1.5px solid #e2e8f0;
        padding: 10px 18px;
        margin: 14px -18px -16px -18px;
        border-radius: 0 0 9px 9px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-family: inherit;
        box-sizing: border-box;
    `;
    exportFooter.innerHTML = `
        <div style="display: flex; align-items: center; gap: 6px; text-align: left;">
            <span style="font-size: 13px; font-weight: 800; color: #1d4ed8;">📊 Live IPO Portal</span>
            <span style="font-size: 11px; color: #64748b; font-weight: 500;">• Real-Time IPO Tracking, Live GMP & Subscriptions</span>
        </div>
        <div style="font-size: 11.5px; font-weight: 700; color: #0284c7; background: #e0f2fe; padding: 3px 10px; border-radius: 20px; border: 1px solid #bae6fd; white-space: nowrap;">
            🌐 www.liveipo.in
        </div>
    `;

    // Temporarily insert header & footer into DOM
    sectionEl.insertBefore(exportHeader, sectionEl.firstChild);
    sectionEl.appendChild(exportFooter);

    try {
        const canvas = await html2canvas(sectionEl, {
            scale: 2,
            backgroundColor: '#ffffff',
            useCORS: true,
            logging: false
        });

        // Clean up temporary DOM elements
        exportHeader.remove();
        exportFooter.remove();
        if (shareBtn) shareBtn.style.display = '';

        canvas.toBlob(async (blob) => {
            if (!blob) return;
            const safeName = ipoName.replace(/[^a-zA-Z0-9]/g, '_');
            const fileName = `${safeName}_${fileNamePrefix}.png`;
            const file = new File([blob], fileName, { type: 'image/png' });

            const shareText = `📊 ${ipoName}\n${fileNamePrefix.replace(/[-_]/g, ' ')}\n👉 Track Live on Live IPO Portal: https://liveipo.in`;

            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                try {
                    await navigator.share({
                        files: [file],
                        title: ipoName,
                        text: shareText
                    });
                } catch (err) {
                    if (err.name !== 'AbortError') downloadImageBlob(blob, fileName);
                }
            } else {
                downloadImageBlob(blob, fileName);
                alert('✓ Image downloaded successfully!');
            }
        }, 'image/png');
    } catch (error) {
        console.error('Error generating image:', error);
        exportHeader.remove();
        exportFooter.remove();
        if (shareBtn) shareBtn.style.display = '';
    }
}

function downloadImageBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ==========================================
// 8. AUTO INITIALIZATION (DOMContentLoaded)
// ==========================================
window.addEventListener('DOMContentLoaded', async () => {
    const savedVersion = localStorage.getItem(DATA_VERSION_KEY);
    if (savedVersion !== CURRENT_VERSION) {
        localStorage.setItem(DATA_VERSION_KEY, CURRENT_VERSION);
    }

    // Initialize Page Views Counter widget across all pages
    try {
        initPageViewsCounter();
    } catch (pvErr) {
        console.warn("Page views counter init warning:", pvErr);
    }

    if (document.getElementById('homeTableButton') || document.getElementById('homeTableBody')) {
        await loadHomeIpoTable();
    }
    if (document.getElementById('calendarTableBody')) {
        await loadCalendarTable('all');
    }
    if (document.getElementById('d_logo_wrap') || document.getElementById('section-hero')) {
        await loadDynamicIpoDetails();
    }
});

// ચિત્તોડગઢ પરથી સબસ્ક્રિપ્શન ડેટા ઓટોમેટિક ફેચ કરવા માટેનું ફંક્શન
async function fetchChittorgarhData(chittorgarhKey) {
    if (!chittorgarhKey) return null;
    try {
        let targetUrl = `https://www.chittorgarh.com/ipo_subscription${chittorgarhKey}`;
        let proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;

        let response = await fetch(proxyUrl);
        if (!response.ok) return null;

        let data = await response.json();
        let htmlText = data.contents;

        let parser = new DOMParser();
        let doc = parser.parseFromString(htmlText, 'text/html');

        let tables = doc.querySelectorAll('table');
        if (tables.length < 2) return null;

        let subTable = tables[1];
        let rows = subTable.querySelectorAll('tbody tr');
        
        let scrapedData = {};

        rows.forEach(row => {
            let cols = row.querySelectorAll('td');
            if (cols.length >= 4) {
                let category = cols[0].textContent.trim().replace(/[\s*]/g, "").toLowerCase();
                let offered = cols[1].textContent.trim().replace(/,/g, '');
                let applied = cols[2].textContent.trim().replace(/,/g, '');
                let times = cols[3].textContent.trim().replace(/,/g, '');

                if (category.includes('qib')) {
                    scrapedData['QIB'] = { off: parseFloat(offered) || 0, app: parseFloat(applied) || 0, times: parseFloat(times) || 0 };
                } else if (category.includes('non') || category.includes('nii')) {
                    scrapedData['NII'] = { off: parseFloat(offered) || 0, app: parseFloat(applied) || 0, times: parseFloat(times) || 0 };
                } else if (category.includes('retail')) {
                    scrapedData['Retail'] = { off: parseFloat(offered) || 0, app: parseFloat(applied) || 0, times: parseFloat(times) || 0 };
                }
            }
        });

        return scrapedData;
    } catch (error) {
        console.error("Chittorgarh fetch error:", error);
        return null;
    }
}

// ==========================================
// 8.1 REALISTIC SMART PAGE VIEWS COUNTER
// ==========================================
const PAGE_VIEWS_STORAGE_KEY = 'live_ipo_page_views_v1';

function hashStringForViews(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

function resolvePageViewKey(explicitKey = null) {
    if (explicitKey) return `ipo_${String(explicitKey).trim().toUpperCase()}`;

    const pathname = window.location.pathname.toLowerCase();
    const filename = pathname.substring(pathname.lastIndexOf('/') + 1) || 'index.html';

    if (filename === 'ipo-detail.html' || pathname.includes('ipo-detail')) {
        const urlParams = new URLSearchParams(window.location.search);
        const id = urlParams.get('id');
        if (id) {
            return `ipo_${id.trim().toUpperCase()}`;
        }
        return 'page_ipo_detail';
    }

    if (filename === '' || filename === 'index.html') return 'page_home';
    if (filename.includes('calendar')) return 'page_calendar';
    if (filename.includes('allotment')) return 'page_allotment';
    if (filename.includes('fii-dii')) return 'page_fiidii';
    if (filename.includes('indices-history')) return 'page_indices_history';
    if (filename.includes('indices')) return 'page_indices';
    if (filename.includes('index-stocks')) return 'page_index_stocks';
    if (filename.includes('demat')) return 'page_demat';

    const clean = filename.replace(/\.html$/i, '').replace(/[^a-z0-9_-]/g, '_');
    return `page_${clean || 'default'}`;
}

function getPageViewStats(pageKey) {
    // Current IST date (YYYY-MM-DD)
    const istDateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

    // Deterministic base derived from page key & today's date
    const keyHash = hashStringForViews(pageKey);
    const dayHash = hashStringForViews(pageKey + '_' + istDateStr);

    let minToday = 1400;
    let maxToday = 3200;

    if (pageKey === 'page_home') {
        minToday = 2600;
        maxToday = 4200;
    } else if (pageKey.startsWith('ipo_')) {
        minToday = 1800;
        maxToday = 3400;
    } else if (pageKey.includes('allotment') || pageKey.includes('calendar')) {
        minToday = 2000;
        maxToday = 3500;
    }

    const baseToday = minToday + (dayHash % (maxToday - minToday));
    const totalMultiplier = 2.8 + ((keyHash % 15) / 10);
    const baseTotal = Math.round(baseToday * totalMultiplier) + (keyHash % 850);

    // Read stored user live increments from localStorage
    let storedData = { date: istDateStr, pages: {} };
    try {
        const raw = localStorage.getItem(PAGE_VIEWS_STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
                storedData = parsed;
            }
        }
    } catch (_) {}

    // Check if new day: reset daily deltas if date changed
    if (storedData.date !== istDateStr) {
        storedData.date = istDateStr;
        if (storedData.pages) {
            for (const p in storedData.pages) {
                if (storedData.pages[p]) {
                    storedData.pages[p].today = 0;
                }
            }
        }
    }

    if (!storedData.pages) storedData.pages = {};
    if (!storedData.pages[pageKey]) {
        storedData.pages[pageKey] = { today: 0, total: 0 };
    }

    // Session debounce: increment once per session (15 minutes expiry)
    const sessionKey = `pv_seen_${pageKey}`;
    const now = Date.now();
    let shouldIncrement = false;

    try {
        const lastSeen = sessionStorage.getItem(sessionKey);
        if (!lastSeen || (now - parseInt(lastSeen, 10)) > 15 * 60 * 1000) {
            shouldIncrement = true;
            sessionStorage.setItem(sessionKey, String(now));
        }
    } catch (_) {
        shouldIncrement = true;
    }

    if (shouldIncrement) {
        storedData.pages[pageKey].today = (storedData.pages[pageKey].today || 0) + 1;
        storedData.pages[pageKey].total = (storedData.pages[pageKey].total || 0) + 1;
        try {
            localStorage.setItem(PAGE_VIEWS_STORAGE_KEY, JSON.stringify(storedData));
        } catch (_) {}
    }

    const finalToday = baseToday + (storedData.pages[pageKey].today || 0);
    const finalTotal = baseTotal + (storedData.pages[pageKey].total || 0);

    return {
        today: finalToday,
        total: finalTotal,
        todayFormatted: finalToday.toLocaleString('en-IN'),
        totalFormatted: finalTotal.toLocaleString('en-IN')
    };
}

function initPageViewsCounter(explicitIpoId = null) {
    const pageKey = resolvePageViewKey(explicitIpoId);
    const stats = getPageViewStats(pageKey);

    let container = document.getElementById('pageViewsContainer');
    if (!container) {
        container = document.createElement('div');
        container.className = 'page-views-wrapper';
        container.id = 'pageViewsContainer';

        const mainEl = document.querySelector('main.main-content') || document.querySelector('main') || document.body;
        const lastP = mainEl ? mainEl.querySelector('p:last-of-type') : null;
        if (lastP && lastP.textContent && (lastP.textContent.includes('Privacy Policy') || lastP.textContent.includes('By proceeding') || lastP.textContent.includes('Disclaimer'))) {
            mainEl.insertBefore(container, lastP);
        } else if (mainEl) {
            mainEl.appendChild(container);
        } else {
            document.body.appendChild(container);
        }
    }

    container.innerHTML = `
        <div class="page-views-pill" title="Page traffic: ${stats.todayFormatted} views today • ${stats.totalFormatted} all-time">
            <span class="page-views-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="#059669" stroke-width="2.1" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                    <circle cx="12" cy="12" r="3.4" fill="#059669"/>
                </svg>
            </span>
            <span class="page-views-item">
                <span class="page-views-count" id="pv_today_count">${stats.todayFormatted}</span>
                <span class="page-views-label">today</span>
            </span>
            <span class="page-views-divider" aria-hidden="true"></span>
            <span class="page-views-item">
                <span class="page-views-count" id="pv_total_count">${stats.totalFormatted}</span>
                <span class="page-views-label">total</span>
            </span>
        </div>
    `;
}

window.initPageViewsCounter = initPageViewsCounter;
window.getPageViewStats = getPageViewStats;

// ==========================================
// GOOGLE SIGN-IN (GOOGLE IDENTITY SERVICES)
// ==========================================
const GOOGLE_CLIENT_ID = "207372613533-2lvj2glt01tn79f5tnd38kcc6d74h2ch.apps.googleusercontent.com";

function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error("Error parsing JWT:", e);
        return null;
    }
}

window.handleGoogleSignIn = function(response) {
    if (!response || !response.credential) return;
    const payload = parseJwt(response.credential);
    if (payload) {
        const user = {
            id: payload.sub,
            name: payload.name || payload.given_name || "User",
            email: payload.email,
            avatar: payload.picture || ""
        };
        localStorage.setItem('live_ipo_user', JSON.stringify(user));
        renderUserAuthState();
        console.log(`✓ Welcome, ${user.name}! Successfully signed in with Google.`);
        window.dispatchEvent(new CustomEvent('live_ipo_auth_changed', { detail: { user } }));
    }
};

window.handleCustomLogin = function(emailOrId, name) {
    const clean = (emailOrId || '').trim();
    if (!clean) return;
    const user = {
        id: 'user_' + encodeURIComponent(clean.toLowerCase()),
        name: name || clean.split('@')[0],
        email: clean.toLowerCase(),
        avatar: "https://www.gravatar.com/avatar/?d=mp"
    };
    localStorage.setItem('live_ipo_user', JSON.stringify(user));
    renderUserAuthState();
    console.log(`✓ Welcome, ${user.name}! Successfully signed in.`);
    window.dispatchEvent(new CustomEvent('live_ipo_auth_changed', { detail: { user } }));
};

window.handleUserLogout = function() {
    localStorage.removeItem('live_ipo_user');
    if (window.google && google.accounts && google.accounts.id) {
        google.accounts.id.disableAutoSelect();
    }
    renderUserAuthState();
    window.dispatchEvent(new CustomEvent('live_ipo_auth_changed', { detail: { user: null } }));
};

function renderUserAuthState() {
    const userStr = localStorage.getItem('live_ipo_user');
    const btnContainer = document.getElementById('googleSignInBtn');
    const badge = document.getElementById('userProfileBadge');
    const avatarImg = document.getElementById('userAvatarImg');
    const nameText = document.getElementById('userNameText');

    if (userStr) {
        try {
            const user = JSON.parse(userStr);
            if (btnContainer) btnContainer.style.display = 'none';
            if (badge) badge.style.display = 'inline-flex';
            if (avatarImg) avatarImg.src = user.avatar || "https://www.gravatar.com/avatar/?d=mp";
            if (nameText) nameText.innerText = user.name || "User";
            return;
        } catch (e) {
            console.error("User state parse error:", e);
        }
    }

    // Not logged in
    if (badge) badge.style.display = 'none';
    if (btnContainer) btnContainer.style.display = 'block';
}

function initGoogleSignIn() {
    renderUserAuthState();

    let attempts = 0;
    const checkGis = setInterval(() => {
        attempts++;
        if (window.google && google.accounts && google.accounts.id) {
            clearInterval(checkGis);
            try {
                google.accounts.id.initialize({
                    client_id: GOOGLE_CLIENT_ID,
                    callback: window.handleGoogleSignIn,
                    auto_select: false,
                    cancel_on_tap_outside: true
                });

                const btnEl = document.getElementById("googleSignInBtn");
                if (btnEl) {
                    google.accounts.id.renderButton(
                        btnEl,
                        {
                            type: "standard",
                            theme: "outline",
                            size: "medium",
                            text: "signin_with",
                            shape: "pill",
                            logo_alignment: "left"
                        }
                    );
                }

                if (!localStorage.getItem('live_ipo_user')) {
                    google.accounts.id.prompt();
                }
            } catch (err) {
                console.error("GIS initialization error:", err);
            }
        } else if (attempts > 30) {
            clearInterval(checkGis);
        }
    }, 200);
}

// Auto init on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGoogleSignIn);
} else {
    initGoogleSignIn();
}