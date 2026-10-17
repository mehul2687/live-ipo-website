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
        totalSize: "₹680.00 Cr",
        freshIssue: "₹500.00 Cr",
        ofs: "₹180.00 Cr",
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

function formatIssueSizeWithAmount(rawShares, price) {
    if (!rawShares) return 'N/A';
    let rawStr = rawShares.toString().trim();
    if (!/^\d[\d,]*$/.test(rawStr.replace(/,/g, ''))) {
        return rawStr;
    }
    let sharesNum = parseFloat(rawStr.replace(/,/g, '')) || 0;
    let formattedSharesCount = sharesNum.toLocaleString('en-IN');
    if (price > 0 && sharesNum > 0) {
        let totalCr = (sharesNum * price) / 10000000;
        return `${formattedSharesCount} shares (up to ₹${totalCr.toFixed(2)} Cr)`;
    }
    return formattedSharesCount + " shares";
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

    // ૧. લિસ્ટિંગ તારીખ વીતી ગઈ હોય તો હંમેશા 'Listed'
    if (listDate && today > listDate) {
        return { text: "Listed", class: "status-listed-slate" };
    }

    // ૨. લિસ્ટિંગનો દિવસ હોય તો 'Listing Today'
    if (listDate && today.getTime() === listDate.getTime()) {
        return { text: "Listing Today 🚀", class: "status-listing-indigo" };
    }

    // ૩. લિસ્ટિંગ પહેલાં જો અલોટમેન્ટ બહાર આવી ગયું હોય (Checkbox Tick હોય)
    if (isAllotmentOut === true) {
        return { text: "Allotment Out", class: "status-allotment-parrot" };
    }

    // ૪. બાકીના સામાન્ય દિવસો માટેનું ટાઈમલાઈન લોજિક
    if (openDate && today < openDate) {
        return { text: "Upcoming", class: "status-upcoming-green" };
    } else if (openDate && closeDate && today >= openDate && today <= closeDate) {
        return { text: "🔴 Live", class: "status-live-blinking" };
    } else if (closeDate && today > closeDate && (!listDate || today < listDate)) {
        return { text: "Allotment Waiting", class: "status-waiting-orange" };
    }

    return { text: "Closed", class: "status-listed-slate" };
}

function calculateTimelineProgress(openStr, closeStr, allotStr, listStr) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const openDate = new Date(openStr);
    openDate.setHours(0, 0, 0, 0);

    const closeDate = new Date(closeStr);
    closeDate.setHours(0, 0, 0, 0);

    const allotDate = new Date(allotStr);
    allotDate.setHours(0, 0, 0, 0);

    const listDate = new Date(listStr);
    listDate.setHours(0, 0, 0, 0);

    let openStatus = "upcoming", closeStatus = "upcoming", allotStatus = "upcoming", listStatus = "upcoming";
    let progressPercent = "0%";

    if (today.getTime() === openDate.getTime() || (today >= openDate && today <= closeDate)) {
        openStatus = today.getTime() === openDate.getTime() ? "active" : "completed";
    } else if (today > openDate) {
        openStatus = "completed";
    }

    if (today.getTime() === closeDate.getTime()) {
        closeStatus = "active";
        progressPercent = "50%";
    } else if (today > closeDate) {
        closeStatus = "completed";
        progressPercent = "66%";
    } else if (today >= openDate && today < closeDate) {
        closeStatus = "upcoming";
        progressPercent = "33%";
    }

    if (today.getTime() === allotDate.getTime()) {
        allotStatus = "active";
        progressPercent = "83%";
    } else if (today > allotDate) {
        allotStatus = "completed";
        progressPercent = "100%";
    }

    if (today.getTime() === listDate.getTime()) {
        listStatus = "active";
        progressPercent = "100%";
    } else if (today > listDate) {
        listStatus = "completed";
        progressPercent = "100%";
    }

    return { openStatus, closeStatus, allotStatus, listStatus, progressPercent };
}

// ==========================================
// 4. HOME PAGE LOGIC (Cloud Connected)
// ==========================================
let currentHomeFilter = 'all';

async function loadHomeIpoTable(filterType = currentHomeFilter) {
    const tableBody = document.getElementById('homeTableBody');
    if (!tableBody) return;

    currentHomeFilter = filterType;
    let dbData = await getMasterIpoData();
    tableBody.innerHTML = '';

    let renderedCount = 0;

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

    ipoList.forEach(ipo => {

        const ipoType = (ipo.type || 'Mainboard').trim().toLowerCase();
        if (filterType === 'mainboard' && !ipoType.includes('main')) return;
        if (filterType === 'sme' && !ipoType.includes('sme')) return;

        renderedCount++;
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
            homeAllotmentHtml = `<a href="${regLink}" target="_blank" style="background-color: #16a34a; color: #ffffff; text-decoration: none; padding: 5px 10px; border-radius: 6px; font-size: 11.5px; font-weight: 600; display: inline-block;">🔍 Check Allotment</a>`;
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
            <tr>
                <td style="padding: 12px; text-align: center;">${logoHtml}</td>
                <td class="ipo-name-cell" style="text-align: left; padding: 12px 16px;">
                    <a href="ipo-detail.html?id=${ipo.id}" style="text-decoration: none; text-align: left;">
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
                    <span style="background: #dcfce7; color: #166534; padding: 5px 10px; border-radius: 6px; font-weight: 600; font-size: 12px;">+${ipo.gmp}</span>
                </td>
                <td style="text-align: center; font-weight: 600; color: #1e293b;">${overallSubTimes}</td>
                <td style="text-align: center;">${homeAllotmentHtml}</td>
                <td style="text-align: center;">
                    <span class="${statusObj.class}" style="padding: 4px 10px; border-radius: 20px; font-size: 11.5px; font-weight: 700; display: inline-block;">${statusObj.text}</span>
                </td>
                <td style="text-align: center;">
                    <a href="ipo-detail.html?id=${ipo.id}" class="view-details-btn" style="background-color: #1d4ed8; color: #ffffff; text-decoration: none; padding: 7px 14px; border-radius: 6px; font-size: 12.5px; display: inline-block;">View Details →</a>
                </td>
            </tr>
        `;
    });

    if (renderedCount === 0) {
        tableBody.innerHTML = `<tr><td colspan="13" style="text-align: center; color: #64748b; padding: 30px; font-size: 14px;">આ કેટેગરીમાં હાલ કોઈ IPO ઉપલબ્ધ નથી.</td></tr>`;
    }
}

function filterHomeIpos(type, event) {
    if (event) event.preventDefault();
    currentHomeFilter = type;

    const buttons = document.querySelectorAll('.hero-card .filter-buttons .filter-btn');
    buttons.forEach(btn => btn.classList.remove('active-btn'));

    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active-btn');
    }

    const searchInput = document.getElementById('ipoSearchInput');
    if (searchInput) searchInput.value = '';

    loadHomeIpoTable(type);
}

function filterIpoTable() {
    const input = document.getElementById('ipoSearchInput');
    if (!input) return;
    const filter = input.value.toLowerCase();
    const tableBody = document.getElementById('homeTableBody');
    if (!tableBody) return;
    const rows = tableBody.getElementsByTagName('tr');

    for (let i = 0; i < rows.length; i++) {
        const nameCell = rows[i].getElementsByTagName('td')[1];
        if (nameCell) {
            const textValue = nameCell.textContent || nameCell.innerText;
            if (textValue.toLowerCase().indexOf(filter) > -1) {
                rows[i].style.display = "";
            } else {
                rows[i].style.display = "none";
            }
        }
    }
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

    const timeline = calculateTimelineProgress(ipo.openDate, ipo.closeDate, ipo.allotmentDate, ipo.listingDate);
    const progressEl = document.getElementById('d_progress');
    if (progressEl) progressEl.style.width = timeline.progressPercent;

    const timelineStepsEl = document.getElementById('d_timeline_steps');
    if (timelineStepsEl) {
        timelineStepsEl.innerHTML = `
            <div class="step-node ${timeline.openStatus}"><div class="node-circle">${timeline.openStatus === 'completed' ? '✓' : ''}</div><div class="node-label">Open</div><div class="node-date">${openStr.slice(0, 6)}</div></div>
            <div class="step-node ${timeline.closeStatus}"><div class="node-circle">${timeline.closeStatus === 'completed' ? '✓' : ''}</div><div class="node-label">Close</div><div class="node-date">${closeStr.slice(0, 6)}</div></div>
            <div class="step-node ${timeline.allotStatus}"><div class="node-circle">${timeline.allotStatus === 'completed' ? '✓' : ''}</div><div class="node-label">Allotment</div><div class="node-date">${allotStr.slice(0, 6)}</div></div>
            <div class="step-node ${timeline.listStatus}"><div class="node-circle">${timeline.listStatus === 'completed' ? '✓' : ''}</div><div class="node-label">Listing</div><div class="node-date">${listStr.slice(0, 6)}</div></div>
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

    if (document.getElementById('g_gmp')) document.getElementById('g_gmp').innerText = ipo.gmp ? `₹${ipo.gmp}` : 'N/A';

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
        
        // ૧. કુલ શેર્સની સંખ્યા મેળવો (Total Issue Size માંથી)
        let totalSharesCount = 0;
        if (ipo.totalSize) {
            // જો totalSize માંથી માત્ર આંકડા કાઢવાના હોય
            let rawTotal = ipo.totalSize.replace(/[^0-9]/g, '');
            // અથવા જો તમે lotRaw કે બીજા કોઈ ફોર્મેટમાં રાખતા હોવ તો તેને અનુરૂપ
        }
        
        // જો totalSize સીધી જ આંકડાકીય કે શેરમાં હોય તો તેને parse કરો (અથવા lotRaw અને customLots પરથી કુલ શેર ગણો)
        let baseShares = parseFloat(ipo.lotRaw) * 100000 || 5152000; // અંદાજિત અથવા માસ્ટર ડેટામાંથી કુલ શેર્સ
        if (ipo.totalSize && !isNaN(parseFloat(ipo.totalSize.replace(/,/g, '')))) {
            baseShares = parseFloat(ipo.totalSize.replace(/,/g, ''));
        }

        let reservationData = (ipo.reservation && ipo.reservation.length > 0) ? [...ipo.reservation] : [
            { category: "QIB", percentage: "50%" },
            { category: "NII (HNI)", percentage: "15%" },
            { category: "Retail", percentage: "35%" }
        ];

        reservationData.forEach(row => {
            // પર્સન્ટેજ કાઢીને ટકાવારી મુજબ શેર્સ ગણો
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
            finObj.fy23 || { yr: "FY-2023", ast: "-", rev: "-", exp: "-", prf: "-" },
            finObj.fy24 || { yr: "FY-2024", ast: "-", rev: "-", exp: "-", prf: "-" },
            finObj.fy25 || { yr: "FY-2025", ast: "-", rev: "-", exp: "-", prf: "-" },
            finObj.fy26 || { yr: "FY-2026", ast: "-", rev: "-", exp: "-", prf: "-" }
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
        document.getElementById('qs_gmp').innerHTML = `₹${rawGmpVal} <span style="font-size:11px; color:#166534;">(+${gmpPct}%)</span>`;

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
}

// ==========================================
// 7. IMAGE SHARING UTILITIES (html2canvas)
// ==========================================
async function shareSectionAsImage(sectionId, fileNamePrefix) {
    const sectionEl = document.getElementById(sectionId);
    if (!sectionEl) return;

    const shareBtn = sectionEl.querySelector('.btn-share');
    if (shareBtn) shareBtn.style.visibility = 'hidden';

    const brandFooter = sectionEl.querySelector('.export-brand-footer');
    if (brandFooter) brandFooter.style.display = 'block';

    try {
        const canvas = await html2canvas(sectionEl, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
        
        if (shareBtn) shareBtn.style.visibility = 'visible';
        if (brandFooter) brandFooter.style.display = 'none';

        canvas.toBlob(async (blob) => {
            if (!blob) return;
            const fileName = `${fileNamePrefix}_${Date.now()}.png`;
            const file = new File([blob], fileName, { type: 'image/png' });

            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                try {
                    await navigator.share({ files: [file], title: fileNamePrefix, text: `Live IPO Portal - ${fileNamePrefix}:` });
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
        if (shareBtn) shareBtn.style.visibility = 'visible';
        if (brandFooter) brandFooter.style.display = 'none';
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
        // chittorgarhKey ઉદાહરણ તરીકે: /ipo/purple-style-labs-ipo/1782/
        let targetUrl = `https://www.chittorgarh.com/ipo_subscription${chittorgarhKey}`;
        let proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;

        let response = await fetch(proxyUrl);
        if (!response.ok) return null;

        let data = await response.json();
        let htmlText = data.contents;

        // HTML ને પાર્સ કરવા માટે DOMParser નો ઉપયોગ
        let parser = new DOMParser();
        let doc = parser.parseFromString(htmlText, 'text/html');

        // ચિત્તોડગઢના પેજ પરથી સબસ્ક્રિપ્શન ટેબલ શોધો
        let tables = doc.querySelectorAll('table');
        if (tables.length < 2) return null;

        let subTable = tables[1]; // સામાન્ય રીતે બીજું ટેબલ સબસ્ક્રિપ્શનનું હોય છે
        let rows = subTable.querySelectorAll('tbody tr');
        
        let scrapedData = {};

        rows.forEach(row => {
            let cols = row.querySelectorAll('td');
            if (cols.length >= 4) {
                let category = cols[0].textContent.trim().replace(/[\s*]/g, "").toLowerCase();
                let offered = cols[1].textContent.trim().replace(/,/g, '');
                let applied = cols[2].textContent.trim().replace(/,/g, '');
                let times = cols[3].textContent.trim().replace(/,/g, '');

                // કેટેગરી મુજબ મેપિંગ
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