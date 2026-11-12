let currentEditingId = null;
let isManualId = false;
let adminCurrentPage = 1;
let adminPageSize = 50; // બાય ડિફોલ્ટ ૫૦ IPO
let adminSearchQuery = '';
// ==========================================
// ADMIN PANEL SCRIPT (JSONBin.io Cloud Synced)
// ==========================================

const ADMIN_BIN_ID = "6aaf80f9ac6210605ae1bce6";
const ADMIN_API_KEY = "$2a$10$Pl5b/ekYZXhRBmQVY6DwieMC10GztytHM9d7CnR0zqmje7BWYj6yC";

document.addEventListener('DOMContentLoaded', async () => {
    // ૦. સૌથી પહેલા Cloudflare Cloud Worker અને/અથવા Local Token સ્ટેટસ ચકાસી બટન અપડેટ કરો
    updateSyncTokenButtonUi();
    checkSyncWorkerHealth(true).then(wh => {
        updateSyncTokenButtonUi();
        if (!wh.hasToken) {
            const storedGhToken = getStoredGithubToken();
            if (storedGhToken) {
                validateGithubToken(storedGhToken).then(res => {
                    if (!res.valid && res.reason !== 'network') {
                        updateSyncTokenButtonUi(false);
                    }
                }).catch(() => {});
            }
        }
    }).catch(() => {});

    // ૧. પેજ લોડ થતાં જ ક્લાઉડ અને લોકલમાંથી ડેશબોર્ડ ડેટા લોડ કરો
    await loadAdminDashboard();
    loadRegistrarDropdown();
    updateLotCalculations();

    // ૨. IPO ના નામ પરથી ઓટોમેટિક શોર્ટ કોડ (Unique ID) બનાવવા માટે
    const nameInput = document.getElementById('adm_name');
    const idInput = document.getElementById('adm_id');

    window.generateUniqueCodeFromName = function(name) {
        if (!name) return '';
        const words = name.replace(/ipo/gi, '').trim().split(/\s+/).filter(Boolean);
        let initials = '';
        for (let i = 0; i < Math.min(words.length, 3); i++) {
            if (words[i].length > 0) {
                initials += words[i][0].toUpperCase();
            }
        }
        if (!initials) initials = 'IPO';
        const randomNum = Math.floor(100 + Math.random() * 900);
        return initials + randomNum;
    };

    window.autoGenerateIpoCode = function() {
        const nInput = document.getElementById('adm_name');
        const iInput = document.getElementById('adm_id');
        if (iInput) {
            const nameVal = nInput ? nInput.value.trim() : '';
            iInput.value = window.generateUniqueCodeFromName(nameVal || 'IPO');
            isManualId = false;
        }
    };

    if (nameInput && idInput) {
        nameInput.addEventListener('input', function() {
            // જો યુઝરે જાતે કોડ એડિટ કર્યો હોય, તો નામ બદલવાથી તેને ઓવરરાઈટ ન કરવું
            if (isManualId) return;

            const val = nameInput.value.trim();
            if (val.length > 0) {
                idInput.value = window.generateUniqueCodeFromName(val);
            } else {
                idInput.value = '';
            }
        });

        // જો યુઝર જાતે કોડમાં કોઈ ટાઇપિંગ કે એડિટ કરે તો તે માન્ય રહેશે
        idInput.addEventListener('input', function() {
            if (idInput.value.trim().length > 0) {
                isManualId = true; // યુઝરે પોતાનો કસ્ટમ કોડ દાખલ કર્યો
            } else {
                isManualId = false; // જો સંપૂર્ણ ખાલી કરી નાખે, તો ફરી કંપની નામ પરથી આવી શકે
            }
        });
    }

    // ૩. IPO Type બદલાય ત્યારે એક્સચેન્જ ઓટોમેટિક સેટ કરવા માટે
    const typeSelect = document.getElementById('adm_type');
    const cbBse = document.getElementById('ex_bse');
    const cbNse = document.getElementById('ex_nse');

    if (typeSelect && cbBse && cbNse) {
        typeSelect.addEventListener('change', function() {
            if (this.value === 'Mainboard') {
                cbBse.checked = true;
                cbNse.checked = true;
            } else if (this.value === 'SME') {
                cbBse.checked = true;
                cbNse.checked = false;
            }
        });
    }

    // ૪. Price Band End માં વેલ્યુ નાખતા જ કટ-ઓફ પ્રાઇઝમાં ઓટોમેટિક આવી જાય
    const priceEndInput = document.getElementById('adm_priceEnd');
    const cutOffInput = document.getElementById('adm_cutOff');

    if (priceEndInput && cutOffInput) {
        priceEndInput.addEventListener('input', function() {
            cutOffInput.value = priceEndInput.value;
            updateLotCalculations();
        });
    }

    // ૪.૧ લોટ સાઈઝ અને ઇન્વેસ્ટમેન્ટ રકમની ઓટોમેટિક ગણતરી માટે લિસનર્સ
    ['adm_cutOff', 'adm_priceStart', 'adm_lotRaw', 'lot_retail', 'lot_shni', 'lot_bhni'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', updateLotCalculations);
        }
    });

    // ૪.૨ યુઝર જ્યારે મેન્યુઅલ ડેટા ટાઈપ કરે ત્યારે તે સેક્શનનું "Lock Manual" ચેકબોક્સ ઓટોમેટિક ઓન થઈ જાય
    const markManualLock = (selector, lockCheckboxId) => {
        document.querySelectorAll(selector).forEach(input => {
            input.addEventListener('input', () => {
                const lockCb = document.getElementById(lockCheckboxId);
                if (lockCb && !lockCb.checked) {
                    lockCb.checked = true;
                }
            });
        });
    };

    markManualLock('input[id^="fin_"]', 'lock_manual_fin');
    markManualLock('input[id^="val_"]', 'lock_manual_val');
    markManualLock('#lot_retail, #lot_shni, #lot_bhni, #app_name_retail, #app_name_shni, #app_name_bhni', 'lock_manual_lots');
    markManualLock('input[id^="sub_"], input[id^="app_"]', 'lock_manual_sub');
    markManualLock('#adm_openDate, #adm_closeDate, #adm_allotmentDate, #adm_listingDate', 'lock_manual_dates');
    markManualLock('#adm_priceStart, #adm_priceEnd, #adm_cutOff, #adm_lotRaw, #adm_faceValue, #adm_totalSize, #adm_freshissue, #adm_ofs', 'lock_manual_issue');
    markManualLock('#adm_bseCode, #adm_nseCode, #adm_isinCode, #adm_mcScId, #adm_listingPriceNse, #adm_listingPriceBse', 'lock_manual_listing');

    // ૫. Form Save Helper & Submit Handler (ક્લાઉડ સેવ સાથે)
    window.saveCurrentFormToCloud = async function({ silent = false, closeDrawer = true } = {}) {
            const ipoIdInput = document.getElementById('adm_id');
            if (!ipoIdInput) return null;
            const ipoId = ipoIdInput.value.trim().toUpperCase();
            if (!ipoId) {
                alert("કૃપા કરીને Unique IPO Code / ID દાખલ કરો.");
                return null;
            }

            let dbData = await fetchAdminDataFromCloud();

            // જો એડિટ કરતી વખતે યુઝરે આઈડી બદલ્યો હોય, તો જૂનો આઈડી ડીલીટ કરવો જેથી ડુપ્લિકેટ ન બને
            if (currentEditingId && currentEditingId !== ipoId) {
                if (dbData[currentEditingId]) {
                    delete dbData[currentEditingId];
                }
            }
            let existingIpo = dbData[ipoId] || (currentEditingId ? dbData[currentEditingId] || {} : {});

            const pStart = document.getElementById('adm_priceStart').value.trim();
            const pEnd = document.getElementById('adm_priceEnd').value.trim();
            const combinedPriceBand = (pStart && pEnd) ? `${pStart} to ${pEnd}` : (pStart || pEnd || '');

            let exchanges = [];
            const exBse = document.getElementById('ex_bse');
            const exNse = document.getElementById('ex_nse');
            if (exBse && exBse.checked) exchanges.push('BSE');
            if (exNse && exNse.checked) exchanges.push('NSE');
            const listingAtVal = exchanges.length > 0 ? exchanges.join(', ') : 'BSE, NSE';

            const listPriceNseRaw = document.getElementById('adm_listingPriceNse')?.value.trim() || '';
            const listPriceBseRaw = document.getElementById('adm_listingPriceBse')?.value.trim() || '';

            const ipoData = {
                id: ipoId,
                name: document.getElementById('adm_name').value,
                logo: document.getElementById('adm_logo').value || existingIpo.logo || ipoId,
                type: document.getElementById('adm_type').value,
                about: document.getElementById('adm_about').value,
                priceBand: combinedPriceBand,
                cutOff: parseFloat(document.getElementById('adm_cutOff').value) || 0,
                lotRaw: parseInt(document.getElementById('adm_lotRaw').value) || 26,
                lotSize: (document.getElementById('adm_lotRaw').value || 26) + " Shares",
                faceValue: document.getElementById('adm_faceValue').value || "₹10 per share",
                empDiscount: document.getElementById('adm_empDiscount').value || "Nil",
                totalSize: document.getElementById('adm_totalSize').value || "N/A",
                freshIssue: document.getElementById('adm_freshissue').value || "N/A",
                ofs: document.getElementById('adm_ofs').value || "N/A",
                listingAt: listingAtVal,
                bseCode: document.getElementById('adm_bseCode')?.value.trim() || existingIpo.bseCode || '',
                nseCode: (document.getElementById('adm_nseCode')?.value.trim() || existingIpo.nseCode || '').toUpperCase(),
                isinCode: (document.getElementById('adm_isinCode')?.value.trim() || existingIpo.isinCode || '').toUpperCase(),
                mcScId: document.getElementById('adm_mcScId')?.value.trim() || existingIpo.mcScId || '',
                listingPriceNse: listPriceNseRaw ? (parseFloat(listPriceNseRaw) || existingIpo.listingPriceNse || null) : (existingIpo.listingPriceNse || null),
                listingPriceBse: listPriceBseRaw ? (parseFloat(listPriceBseRaw) || existingIpo.listingPriceBse || null) : (existingIpo.listingPriceBse || null),
                openDate: document.getElementById('adm_openDate').value,
                closeDate: document.getElementById('adm_closeDate').value,
                allotmentDate: document.getElementById('adm_allotmentDate').value,
                listingDate: document.getElementById('adm_listingDate').value,
                gmp: document.getElementById('adm_gmp').value,
                estPrice: document.getElementById('adm_estPrice').value,
                bookProfit: document.getElementById('adm_bookProfit').value,
                
                // Chittorgarh Key સેવ કરવા માટે
                chittorgarhKey: document.getElementById('adm_chittorgarhKey')?.value.trim() || '',
                
                isAllotmentOut: document.getElementById('adm_isAllotmentOut').checked,
                registrarUrl: document.getElementById('adm_allotmentLink').value || document.getElementById('adm_registrarSelect').value || '',
                valuation: {
                    eps: document.getElementById('val_eps')?.value.trim() || existingIpo.valuation?.eps || '-',
                    pe: document.getElementById('val_pe')?.value.trim() || existingIpo.valuation?.pe || '-',
                    ronw: document.getElementById('val_ronw')?.value.trim() || existingIpo.valuation?.ronw || '-',
                    nav: document.getElementById('val_nav')?.value.trim() || existingIpo.valuation?.nav || '-',
                    ebitdaMargin: document.getElementById('val_ebitda')?.value.trim() || existingIpo.valuation?.ebitdaMargin || '-',
                    patMargin: document.getElementById('val_pat')?.value.trim() || existingIpo.valuation?.patMargin || '-'
                },
                
                // રિઝર્વેશન પર્સન્ટેજ ડેટા સેવ કરવા માટે
                reservation: [
                    { category: "QIB", percentage: (document.getElementById('res_qib')?.value || '50') + "%" },
                    { category: "NII (HNI)", percentage: (document.getElementById('res_nii')?.value || '15') + "%" },
                    { category: "Retail", percentage: (document.getElementById('res_retail')?.value || '35') + "%" }
                ],
                
                // સબસ્ક્રિપ્શન શેર ડેટા સેવ કરવા માટે
                subShares: [
                    { cat: "QIB", off: parseInt(document.getElementById('sub_qib_off')?.value) || 0, app: parseInt(document.getElementById('sub_qib_app')?.value) || 0 },
                    { cat: "NII", off: parseInt(document.getElementById('sub_nii_off')?.value) || 0, app: parseInt(document.getElementById('sub_nii_app')?.value) || 0 },
                    { cat: "B-NII(₹10L+)", off: parseInt(document.getElementById('sub_bnii_off')?.value) || 0, app: parseInt(document.getElementById('sub_bnii_app')?.value) || 0 },
                    { cat: "S-NII(₹2-10L)", off: parseInt(document.getElementById('sub_snii_off')?.value) || 0, app: parseInt(document.getElementById('sub_snii_app')?.value) || 0 },
                    { cat: "Retail", off: parseInt(document.getElementById('sub_retail_off')?.value) || 0, app: parseInt(document.getElementById('sub_retail_app')?.value) || 0 },
                    { cat: "Employee", off: parseInt(document.getElementById('sub_emp_off')?.value) || 0, app: parseInt(document.getElementById('sub_emp_app')?.value) || 0 },
                    { cat: "Shareholder", off: parseInt(document.getElementById('sub_sh_off')?.value) || 0, app: parseInt(document.getElementById('sub_sh_app')?.value) || 0 }
                ],

                // એપ્લિકેશન બ્રેકઅપ ડેટા સેવ કરવા માટે
                subApps: [
                    { cat: "B-NII(₹10L+)", off: parseInt(document.getElementById('app_bnii_off')?.value) || 0, app: parseInt(document.getElementById('app_bnii_app')?.value) || 0 },
                    { cat: "S-NII(₹2-10L)", off: parseInt(document.getElementById('app_snii_off')?.value) || 0, app: parseInt(document.getElementById('app_snii_app')?.value) || 0 },
                    { cat: "Retail", off: parseInt(document.getElementById('app_retail_off')?.value) || 0, app: parseInt(document.getElementById('app_retail_app')?.value) || 0 }
                ],
                
                customLots: [
                    { app: document.getElementById('app_name_retail').value || "Retail Min", lot: parseInt(document.getElementById('lot_retail').value) || 1 },
                    { app: document.getElementById('app_name_shni').value || "Small HNI", lot: parseInt(document.getElementById('lot_shni').value) || 14 },
                    { app: document.getElementById('app_name_bhni').value || "Big HNI", lot: parseInt(document.getElementById('lot_bhni').value) || 68 }
                ],

                fin: {
                    fy24: { yr: document.getElementById('fin_24_yr')?.value || "FY-2024", ast: document.getElementById('fin_24_ast')?.value || '-', rev: document.getElementById('fin_24_rev')?.value || '-', exp: document.getElementById('fin_24_exp')?.value || '-', prf: document.getElementById('fin_24_prf')?.value || '-' },
                    fy25: { yr: document.getElementById('fin_25_yr')?.value || "FY-2025", ast: document.getElementById('fin_25_ast')?.value || '-', rev: document.getElementById('fin_25_rev')?.value || '-', exp: document.getElementById('fin_25_exp')?.value || '-', prf: document.getElementById('fin_25_prf')?.value || '-' },
                    fy26: { yr: document.getElementById('fin_26_yr')?.value || "FY-2026", ast: document.getElementById('fin_26_ast')?.value || '-', rev: document.getElementById('fin_26_rev')?.value || '-', exp: document.getElementById('fin_26_exp')?.value || '-', prf: document.getElementById('fin_26_prf')?.value || '-' },
                    jun26: { yr: document.getElementById('fin_jun_yr')?.value || "30 Jun 2026", ast: document.getElementById('fin_jun_ast')?.value || '-', rev: document.getElementById('fin_jun_rev')?.value || '-', exp: document.getElementById('fin_jun_exp')?.value || '-', prf: document.getElementById('fin_jun_prf')?.value || '-' }
                },

                // મેન્યુઅલ લોક સેટિંગ્સ - ઓટો સિંક ક્રાઉલરથી ઓવરરાઈટ રોકવા માટે
                manualDates: document.getElementById('lock_manual_dates')?.checked || false,
                manualIssueInfo: document.getElementById('lock_manual_issue')?.checked || false,
                manualLots: document.getElementById('lock_manual_lots')?.checked || false,
                manualFin: document.getElementById('lock_manual_fin')?.checked || false,
                manualValuation: document.getElementById('lock_manual_val')?.checked || false,
                manualSub: document.getElementById('lock_manual_sub')?.checked || false,
                manualListingInfo: document.getElementById('lock_manual_listing')?.checked || false,
                manualLockAll: document.getElementById('lock_manual_all')?.checked || false
            };

            dbData[ipoId] = ipoData;
            
            // ક્લાઉડ અને લોકલસ્ટોરેજ બંનેમાં સેવ કરો
            await saveAdminDataToCloud(dbData);
            currentEditingId = ipoId;

            if (!silent && !window._isSaveAndSyncTriggered) {
                alert(`✓ IPO "${ipoData.name}" successfully saved & synced to cloud!`);
            }
            if (closeDrawer) {
                toggleDrawer(false);
            }
            await loadAdminDashboard();
            return ipoId;
    };

    const manageForm = document.getElementById('manageIpoForm');
    if (manageForm) {
        manageForm.addEventListener('submit', async function(e) {
            e.preventDefault(); // Page reload અટકાવવા માટે
            await window.saveCurrentFormToCloud({ silent: false, closeDrawer: true });
        });
    }
});

// ==========================================
// JSONBIN.IO CLOUD SYNC FUNCTIONS
// ==========================================
async function fetchAdminDataFromCloud() {
    try {
        const response = await fetch(`https://api.jsonbin.io/v3/b/${ADMIN_BIN_ID}/latest?t=${Date.now()}`, {
            cache: 'no-store',
            headers: { 'X-Master-Key': ADMIN_API_KEY }
        });
        if (response.ok) {
            const result = await response.json();
            if (result.record && result.record.ghToken) {
                window._cloudToken = result.record.ghToken;
            }
            const cloudData = result.record.ipos || result.record;
            if (cloudData && typeof cloudData === 'object' && Object.keys(cloudData).length > 0) {
                localStorage.setItem('live_ipo_master_cloud_data', JSON.stringify(cloudData));
                return cloudData;
            }
        }
    } catch (err) {
        console.error("Cloud fetch error, falling back to local storage:", err);
    }
    
    let local = JSON.parse(localStorage.getItem('live_ipo_master_cloud_data'));
    if (local && Object.keys(local).length > 0) return local;

    // Default Fallback
    return {
        "PSL": {
            id: "PSL",
            name: "Purple Style Labs IPO Details",
            logo: "https://www.liveipo.in/liveipo_logo.jpg",
            type: "Mainboard",
            priceBand: "546 to 575",
            lotRaw: 26,
            lotSize: "26 Shares",
            openDate: "2026-08-31",
            closeDate: "2026-09-02",
            allotmentDate: "2026-09-03",
            listingDate: "2026-09-07",
            gmp: "50",
            isAllotmentOut: false
        }
    };
}

async function saveAdminDataToCloud(dbData) {
    localStorage.setItem('live_ipo_master_cloud_data', JSON.stringify(dbData));
    try {
        const payload = {
            ipos: dbData,
            updatedAt: new Date().toISOString()
        };
        if (window._cloudToken) {
            payload.ghToken = window._cloudToken;
        }
        await fetch(`https://api.jsonbin.io/v3/b/${ADMIN_BIN_ID}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Master-Key': ADMIN_API_KEY
            },
            body: JSON.stringify(payload)
        });
    } catch (err) {
        console.error("Cloud sync error during save:", err);
    }
}

// ==========================================
// IPO સ્ટેટસ નક્કી કરવા માટેનું કોમન ફંક્શન
// ==========================================
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

// ==========================================
// ડેશબોર્ડ ડેટા લોડ અને ટેબલ રેન્ડર કરવા માટેનું ફંક્શન (વિથ પેજિનેશન અને સર્ચ)
// ==========================================
async function loadAdminDashboard() {
    const tbody = document.getElementById('adminTableBody');
    if (!tbody) return;

    let db = await fetchAdminDataFromCloud();

    tbody.innerHTML = '';
    let total = 0, live = 0, upcoming = 0, allotment = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const ipoList = Object.keys(db).map(key => db[key]).filter(Boolean);
    ipoList.sort((a, b) => {
        const timeA = new Date(a.openDate || a.closeDate || 0).getTime();
        const timeB = new Date(b.openDate || b.closeDate || 0).getTime();
        if (timeB !== timeA) return timeB - timeA;
        const closeA = new Date(a.closeDate || 0).getTime();
        const closeB = new Date(b.closeDate || 0).getTime();
        return closeB - closeA;
    });

    // ગણતરી કરો કુલ આંકડાઓ
    ipoList.forEach(ipo => {
        total++;
        const openD = ipo.openDate ? new Date(ipo.openDate) : null;
        const closeD = ipo.closeDate ? new Date(ipo.closeDate) : null;
        if (openD) openD.setHours(0, 0, 0, 0);
        if (closeD) closeD.setHours(0, 0, 0, 0);

        if (ipo.isAllotmentOut === true || (closeD && today > closeD)) {
            allotment++;
        } else if (openD && closeD && today >= openD && today <= closeD) {
            live++;
        } else if (openD && today < openD) {
            upcoming++;
        }
    });

    if (document.getElementById('stat_total')) document.getElementById('stat_total').innerText = total;
    if (document.getElementById('stat_live')) document.getElementById('stat_live').innerText = live;
    if (document.getElementById('stat_upcoming')) document.getElementById('stat_upcoming').innerText = upcoming;
    if (document.getElementById('stat_allotment')) document.getElementById('stat_allotment').innerText = allotment;

    // સર્ચ ફિલ્ટર
    let filteredList = ipoList;
    if (adminSearchQuery) {
        const q = adminSearchQuery.toLowerCase();
        filteredList = ipoList.filter(ipo => 
            (ipo.name && ipo.name.toLowerCase().includes(q)) || 
            (ipo.id && ipo.id.toLowerCase().includes(q)) ||
            (ipo.type && ipo.type.toLowerCase().includes(q))
        );
    }

    const totalFiltered = filteredList.length;
    let totalPages = adminPageSize === -1 ? 1 : Math.ceil(totalFiltered / adminPageSize);
    if (totalPages < 1) totalPages = 1;
    if (adminCurrentPage > totalPages) adminCurrentPage = totalPages;
    if (adminCurrentPage < 1) adminCurrentPage = 1;

    const startIndex = adminPageSize === -1 ? 0 : (adminCurrentPage - 1) * adminPageSize;
    const endIndex = adminPageSize === -1 ? totalFiltered : Math.min(startIndex + adminPageSize, totalFiltered);
    const pageItems = filteredList.slice(startIndex, endIndex);

    if (pageItems.length === 0) {
        tbody.innerHTML = `<tr><td colspan="13" style="text-align: center; color: #64748b; padding: 25px; font-size: 13px;">કોઈ IPO રેકોર્ડ મળ્યો નથી.</td></tr>`;
    } else {
        pageItems.forEach(ipo => {
            const statusObj = getIpoStatus(ipo.openDate, ipo.closeDate, ipo.allotmentDate, ipo.listingDate, ipo.isAllotmentOut);
            const isChecked = ipo.isAllotmentOut === true ? 'checked' : '';
            const isSme = (ipo.type || '').toLowerCase().includes('sme');
            const typeText = isSme ? 'SME' : 'Mainboard';
            const typeColor = isSme ? '#7c3aed' : '#1d4ed8';
            const typeHtml = `<span style="color: ${typeColor}; font-weight: 700; font-size: 12px; background: transparent;">${typeText}</span>`;

            tbody.innerHTML += `
                <tr class="${statusObj.rowClass}">
                    <td style="text-align: center;"><strong>${ipo.id}</strong></td>
                    <td style="text-align: left; padding-left: 14px;">
                        <span onclick="editIpo('${ipo.id}')" style="color: #1d4ed8; font-weight: 600; cursor: pointer; text-decoration: none;" title="Click for Full Edit">${ipo.name}</span>
                    </td>
                    <td style="text-align: center;">${typeHtml}</td>
                    <td style="text-align: center;">${formatDateReadable(ipo.openDate)}</td>
                    <td style="text-align: center;">${formatDateReadable(ipo.closeDate)}</td>
                    <td style="text-align: center;">${formatDateReadable(ipo.allotmentDate)}</td>
                    <td style="text-align: center;">${formatDateReadable(ipo.listingDate)}</td>
                    <td style="text-align: center; font-weight: bold;">₹${ipo.priceBand || '-'}</td>
                    <td style="text-align: center;">${ipo.lotSize || (ipo.lotRaw + ' Shares')}</td>
                    <td style="text-align: center;">
                        <input type="text" id="dash_gmp_${ipo.id}" value="${ipo.gmp || ''}" placeholder="0" style="width: 70px; padding: 4px; text-align: center; font-weight: 700; color: ${parseFloat(ipo.gmp) < 0 ? '#dc2626' : (parseFloat(ipo.gmp) > 0 ? '#16a34a' : '#64748b')}; border: 1px solid #cbd5e1; border-radius: 4px;">
                    </td>
                    <td style="text-align: center;">
                        <label style="cursor: pointer; font-size: 11.5px; font-weight: 600; color: #7c3aed; display: inline-flex; align-items: center; gap: 4px;">
                            <input type="checkbox" id="dash_allot_${ipo.id}" ${isChecked} style="width: 15px; height: 15px;"> Out
                        </label>
                    </td>
                    <td style="text-align: center;">
                        <span class="${statusObj.class}">${statusObj.text}</span>
                    </td>
                    <td style="text-align: center;">
                        <div class="action-btns" style="justify-content: center; gap: 4px;">
                            <button type="button" onclick="quickSaveFromDashboard('${ipo.id}')" class="btn-action-edit" style="background: #166534; color: #fff;" title="Save GMP & Allotment">💾 Save</button>
                            <button type="button" onclick="editIpo('${ipo.id}')" class="btn-action-edit" title="Full Edit">✏️ Edit</button>
                            <button type="button" onclick="syncSingleIpo('${ipo.id}')" class="btn-action-edit" style="background: #0284c7; color: #fff;" title="Auto-Sync data from Chittorgarh">⚡ Sync</button>
                            <button type="button" onclick="deleteIpo('${ipo.id}')" class="btn-action-del" title="Delete">🗑️</button>
                        </div>
                    </td>
                </tr>
            `;
        });
    }

    // પેજિનેશન કંટ્રોલ અને માહિતી અપડેટ કરો
    const infoEl = document.getElementById('adminPaginationInfo');
    if (infoEl) {
        if (totalFiltered === 0) {
            infoEl.innerText = 'Showing 0 to 0 of 0 IPOs';
        } else {
            infoEl.innerText = `Showing ${startIndex + 1} to ${endIndex} of ${totalFiltered} IPOs (Page ${adminCurrentPage} of ${totalPages})`;
        }
    }

    const controlsEl = document.getElementById('adminPaginationControls');
    if (controlsEl) {
        if (adminPageSize === -1 || totalPages <= 1) {
            controlsEl.innerHTML = '';
        } else {
            let btnsHtml = '';
            btnsHtml += `<button type="button" onclick="setAdminPage(1)" ${adminCurrentPage === 1 ? 'disabled' : ''} title="First Page">⏮ First</button>`;
            btnsHtml += `<button type="button" onclick="setAdminPage(${adminCurrentPage - 1})" ${adminCurrentPage === 1 ? 'disabled' : ''} title="Previous Page">◀ Prev</button>`;

            const maxVisible = 5;
            let startP = Math.max(1, adminCurrentPage - Math.floor(maxVisible / 2));
            let endP = Math.min(totalPages, startP + maxVisible - 1);
            if (endP - startP + 1 < maxVisible) {
                startP = Math.max(1, endP - maxVisible + 1);
            }

            for (let p = startP; p <= endP; p++) {
                btnsHtml += `<button type="button" class="${p === adminCurrentPage ? 'active' : ''}" onclick="setAdminPage(${p})">${p}</button>`;
            }

            btnsHtml += `<button type="button" onclick="setAdminPage(${adminCurrentPage + 1})" ${adminCurrentPage === totalPages ? 'disabled' : ''} title="Next Page">Next ▶</button>`;
            btnsHtml += `<button type="button" onclick="setAdminPage(${totalPages})" ${adminCurrentPage === totalPages ? 'disabled' : ''} title="Last Page">Last ⏭</button>`;

            controlsEl.innerHTML = btnsHtml;
        }
    }
}

// પેજ સાઈઝ બદલવા માટેનું ફંક્શન
window.changeAdminPageSize = function(val) {
    adminPageSize = parseInt(val);
    adminCurrentPage = 1;
    loadAdminDashboard();
};

// પેજ નંબર બદલવા માટેનું ફંક્શન
window.setAdminPage = function(pageNum) {
    adminCurrentPage = pageNum;
    loadAdminDashboard();
    const section = document.getElementById('masterRecordSection');
    if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

// એડમિન સર્ચ ફંક્શન
window.handleAdminSearch = function(val) {
    adminSearchQuery = (val || '').trim();
    adminCurrentPage = 1;
    loadAdminDashboard();
};

// ડેશબોર્ડ ટેબલ પરથી જ ડાયરેક્ટ GMP અને અલોટમેન્ટ સેવ કરવા માટે
async function quickSaveFromDashboard(ipoId) {
    let dbData = await fetchAdminDataFromCloud();
    if (!dbData[ipoId]) return;

    const gmpInput = document.getElementById(`dash_gmp_${ipoId}`);
    const allotCheckbox = document.getElementById(`dash_allot_${ipoId}`);

    if (gmpInput) dbData[ipoId].gmp = gmpInput.value.trim();
    if (allotCheckbox) dbData[ipoId].isAllotmentOut = allotCheckbox.checked;

    await saveAdminDataToCloud(dbData);

    alert(`✓ IPO "${dbData[ipoId].name}" સફળતાપૂર્વક ક્લાઉડ પર અપડેટ થઈ ગયો છે!`);
    await loadAdminDashboard();
}

// ડ્રોઅર ઓપન/ક્લોઝ કરવા માટે
function toggleDrawer(show) {
    const drawer = document.getElementById('ipoFormDrawer');
    if (drawer) {
        drawer.style.display = show ? 'block' : 'none';
        if (show) window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

// બટન ક્લિક થતાં ફોર્મ ખોલવા માટેનું મુખ્ય ફંક્શન (+ Add New IPO)
function openAddDrawer() {
    const form = document.getElementById('manageIpoForm');
    if (form) form.reset();
    
    currentEditingId = null;
    isManualId = false;
    const admId = document.getElementById('adm_id');
    if (admId) {
        admId.value = '';
        admId.readOnly = false;
    }

    // નવા IPO વખતે પર્સન્ટેજ અને ચિતોડગઢ કી બોક્સ ખાલી રાખવા
    if (document.getElementById('res_qib')) document.getElementById('res_qib').value = '';
    if (document.getElementById('res_nii')) document.getElementById('res_nii').value = '';
    if (document.getElementById('res_retail')) document.getElementById('res_retail').value = '';
    if (document.getElementById('adm_chittorgarhKey')) document.getElementById('adm_chittorgarhKey').value = '';
    if (document.getElementById('formFetchStatus')) {
        document.getElementById('formFetchStatus').style.display = 'none';
        document.getElementById('formFetchStatus').innerText = '';
    }

    // વેલ્યુએશન રેશિયો બોક્સ ખાલી કરવા
    ['val_eps', 'val_pe', 'val_ronw', 'val_nav', 'val_ebitda', 'val_pat'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    // ડિફોલ્ટ લોટ ઇનપુટ રીસેટ અને ગણતરી અપડેટ
    if (document.getElementById('lot_retail')) document.getElementById('lot_retail').value = 1;
    if (document.getElementById('lot_shni')) document.getElementById('lot_shni').value = 14;
    if (document.getElementById('lot_bhni')) document.getElementById('lot_bhni').value = 68;
    updateLotCalculations();

    // મેન્યુઅલ લોક ચેકબોક્સ અનચેક કરવા (નવા IPO માટે ઓટો-સિંક ચાલુ રહે)
    ['lock_manual_dates', 'lock_manual_issue', 'lock_manual_lots', 'lock_manual_fin', 'lock_manual_val', 'lock_manual_sub', 'lock_manual_listing', 'lock_manual_all'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.checked = false;
    });
    ['adm_bseCode', 'adm_nseCode', 'adm_isinCode', 'adm_mcScId', 'adm_listingPriceNse', 'adm_listingPriceBse'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    const drawerTitle = document.getElementById('drawerTitle');
    const saveBtn = document.getElementById('saveBtn');
    if (drawerTitle) drawerTitle.innerText = '➕ Add New IPO Complete Profile';
    if (saveBtn) saveBtn.innerText = '💾 Save & Publish IPO';
    
    toggleDrawer(true);
}

// એડિટ કરવા માટે
async function editIpo(id) {
    let db = await fetchAdminDataFromCloud();
    const ipo = db[id];
    if (!ipo) return;

    currentEditingId = id;
    isManualId = true;
    const admIdEl = document.getElementById('adm_id');
    if (admIdEl) {
        admIdEl.value = ipo.id;
        admIdEl.readOnly = false; // હવે એડિટ કરી શકાય છે!
    }
    document.getElementById('adm_name').value = ipo.name || '';
    document.getElementById('adm_logo').value = ipo.logo || '';
    document.getElementById('adm_type').value = ipo.type || 'Mainboard';
    document.getElementById('adm_about').value = ipo.about || '';
    
    document.getElementById('adm_isAllotmentOut').checked = ipo.isAllotmentOut || false;
    document.getElementById('adm_allotmentLink').value = ipo.registrarUrl || '';

    if (ipo.priceBand) {
        const parts = ipo.priceBand.split('to');
        if (parts.length === 2) {
            document.getElementById('adm_priceStart').value = parts[0].trim();
            document.getElementById('adm_priceEnd').value = parts[1].trim();
        } else {
            document.getElementById('adm_priceStart').value = ipo.priceBand;
        }
    }

    document.getElementById('adm_cutOff').value = ipo.cutOff || '';
    document.getElementById('adm_lotRaw').value = ipo.lotRaw || '';
    document.getElementById('adm_faceValue').value = ipo.faceValue || '';
    document.getElementById('adm_empDiscount').value = ipo.empDiscount || '';
    document.getElementById('adm_totalSize').value = ipo.totalSize || '';
    document.getElementById('adm_freshissue').value = ipo.freshIssue || '';
    document.getElementById('adm_ofs').value = ipo.ofs || '';
    document.getElementById('adm_listingAt').value = ipo.listingAt || '';
    if (document.getElementById('adm_bseCode')) document.getElementById('adm_bseCode').value = ipo.bseCode || '';
    if (document.getElementById('adm_nseCode')) document.getElementById('adm_nseCode').value = ipo.nseCode || '';
    if (document.getElementById('adm_isinCode')) document.getElementById('adm_isinCode').value = ipo.isinCode || '';
    if (document.getElementById('adm_mcScId')) document.getElementById('adm_mcScId').value = ipo.mcScId || '';
    if (document.getElementById('adm_listingPriceNse')) document.getElementById('adm_listingPriceNse').value = ipo.listingPriceNse || '';
    if (document.getElementById('adm_listingPriceBse')) document.getElementById('adm_listingPriceBse').value = ipo.listingPriceBse || '';
    
    if (ipo.listingAt) {
        document.getElementById('ex_bse').checked = ipo.listingAt.includes('BSE');
        document.getElementById('ex_nse').checked = ipo.listingAt.includes('NSE');
    }

    document.getElementById('adm_openDate').value = ipo.openDate || '';
    document.getElementById('adm_closeDate').value = ipo.closeDate || '';
    document.getElementById('adm_allotmentDate').value = ipo.allotmentDate || '';
    document.getElementById('adm_listingDate').value = ipo.listingDate || '';
    document.getElementById('adm_gmp').value = ipo.gmp || '';
    document.getElementById('adm_estPrice').value = ipo.estPrice || '';
    document.getElementById('adm_bookProfit').value = ipo.bookProfit || '';
    
    // Chittorgarh Key લોડ કરવા માટે
    if (document.getElementById('adm_chittorgarhKey')) {
        document.getElementById('adm_chittorgarhKey').value = ipo.chittorgarhKey || ipo.chittorgarh_key || '';
    }
    if (document.getElementById('formFetchStatus')) {
        document.getElementById('formFetchStatus').style.display = 'none';
        document.getElementById('formFetchStatus').innerText = '';
    }

    // એડિટ વખતે રિઝર્વેશન પર્સન્ટેજ બોક્સમાં ભરવા માટે
    if (ipo.reservation) {
        ipo.reservation.forEach(r => {
            if (r.category === "QIB" && document.getElementById('res_qib')) {
                document.getElementById('res_qib').value = parseFloat(r.percentage) || '';
            }
            if (r.category === "NII (HNI)" && document.getElementById('res_nii')) {
                document.getElementById('res_nii').value = parseFloat(r.percentage) || '';
            }
            if (r.category === "Retail" && document.getElementById('res_retail')) {
                document.getElementById('res_retail').value = parseFloat(r.percentage) || '';
            }
        });
    }

    // એડિટ વખતે સબસ્ક્રિપ્શન શેર ડેટા ઇનપુટ બોક્સમાં ભરવા માટે
    if (ipo.subShares) {
        ipo.subShares.forEach(row => {
            if (row.cat === "QIB" && document.getElementById('sub_qib_off')) { document.getElementById('sub_qib_off').value = row.off; document.getElementById('sub_qib_app').value = row.app; }
            if (row.cat === "NII" && document.getElementById('sub_nii_off')) { document.getElementById('sub_nii_off').value = row.off; document.getElementById('sub_nii_app').value = row.app; }
            if (row.cat === "B-NII(₹10L+)" && document.getElementById('sub_bnii_off')) { document.getElementById('sub_bnii_off').value = row.off; document.getElementById('sub_bnii_app').value = row.app; }
            if (row.cat === "S-NII(₹2-10L)" && document.getElementById('sub_snii_off')) { document.getElementById('sub_snii_off').value = row.off; document.getElementById('sub_snii_app').value = row.app; }
            if (row.cat === "Retail" && document.getElementById('sub_retail_off')) { document.getElementById('sub_retail_off').value = row.off; document.getElementById('sub_retail_app').value = row.app; }
            if (row.cat === "Employee" && document.getElementById('sub_emp_off')) { document.getElementById('sub_emp_off').value = row.off; document.getElementById('sub_emp_app').value = row.app; }
            if (row.cat === "Shareholder" && document.getElementById('sub_sh_off')) { document.getElementById('sub_sh_off').value = row.off; document.getElementById('sub_sh_app').value = row.app; }
        });
    }

    // એડિટ વખતે એપ્લિકેશન બ્રેકઅપ ડેટા બોક્સમાં ભરવા માટે
    if (ipo.subApps) {
        ipo.subApps.forEach(row => {
            if (row.cat === "B-NII(₹10L+)" && document.getElementById('app_bnii_off')) { document.getElementById('app_bnii_off').value = row.off; document.getElementById('app_bnii_app').value = row.app; }
            if (row.cat === "S-NII(₹2-10L)" && document.getElementById('app_snii_off')) { document.getElementById('app_snii_off').value = row.off; document.getElementById('app_snii_app').value = row.app; }
            if (row.cat === "Retail" && document.getElementById('app_retail_off')) { document.getElementById('app_retail_off').value = row.off; document.getElementById('app_retail_app').value = row.app; }
        });
    }

    if (ipo.fin) {
        if (ipo.fin.fy24) { 
            if (document.getElementById('fin_24_yr')) document.getElementById('fin_24_yr').value = ipo.fin.fy24.yr || 'FY-2024';
            document.getElementById('fin_24_ast').value = (ipo.fin.fy24.ast !== '-' ? ipo.fin.fy24.ast : '') || ''; 
            document.getElementById('fin_24_rev').value = (ipo.fin.fy24.rev !== '-' ? ipo.fin.fy24.rev : '') || ''; 
            document.getElementById('fin_24_exp').value = (ipo.fin.fy24.exp !== '-' ? ipo.fin.fy24.exp : '') || ''; 
            document.getElementById('fin_24_prf').value = (ipo.fin.fy24.prf !== '-' ? ipo.fin.fy24.prf : '') || ''; 
        }
        if (ipo.fin.fy25) { 
            if (document.getElementById('fin_25_yr')) document.getElementById('fin_25_yr').value = ipo.fin.fy25.yr || 'FY-2025';
            document.getElementById('fin_25_ast').value = (ipo.fin.fy25.ast !== '-' ? ipo.fin.fy25.ast : '') || ''; 
            document.getElementById('fin_25_rev').value = (ipo.fin.fy25.rev !== '-' ? ipo.fin.fy25.rev : '') || ''; 
            document.getElementById('fin_25_exp').value = (ipo.fin.fy25.exp !== '-' ? ipo.fin.fy25.exp : '') || ''; 
            document.getElementById('fin_25_prf').value = (ipo.fin.fy25.prf !== '-' ? ipo.fin.fy25.prf : '') || ''; 
        }
        if (ipo.fin.fy26) { 
            if (document.getElementById('fin_26_yr')) document.getElementById('fin_26_yr').value = ipo.fin.fy26.yr || 'FY-2026';
            document.getElementById('fin_26_ast').value = (ipo.fin.fy26.ast !== '-' ? ipo.fin.fy26.ast : '') || ''; 
            document.getElementById('fin_26_rev').value = (ipo.fin.fy26.rev !== '-' ? ipo.fin.fy26.rev : '') || ''; 
            document.getElementById('fin_26_exp').value = (ipo.fin.fy26.exp !== '-' ? ipo.fin.fy26.exp : '') || ''; 
            document.getElementById('fin_26_prf').value = (ipo.fin.fy26.prf !== '-' ? ipo.fin.fy26.prf : '') || ''; 
        }
        const junData = ipo.fin.jun26 || ipo.fin.latest;
        if (junData) {
            if (document.getElementById('fin_jun_yr')) document.getElementById('fin_jun_yr').value = junData.yr || '30 Jun 2026';
            document.getElementById('fin_jun_ast').value = (junData.ast !== '-' ? junData.ast : '') || ''; 
            document.getElementById('fin_jun_rev').value = (junData.rev !== '-' ? junData.rev : '') || ''; 
            document.getElementById('fin_jun_exp').value = (junData.exp !== '-' ? junData.exp : '') || ''; 
            document.getElementById('fin_jun_prf').value = (junData.prf !== '-' ? junData.prf : '') || ''; 
        } else {
            if (document.getElementById('fin_jun_yr')) document.getElementById('fin_jun_yr').value = '30 Jun 2026';
            document.getElementById('fin_jun_ast').value = ''; 
            document.getElementById('fin_jun_rev').value = ''; 
            document.getElementById('fin_jun_exp').value = ''; 
            document.getElementById('fin_jun_prf').value = ''; 
        }
    }

    // Valuation Ratios લોડ કરવા
    if (ipo.valuation) {
        if (document.getElementById('val_eps')) document.getElementById('val_eps').value = ipo.valuation.eps || '';
        if (document.getElementById('val_pe')) document.getElementById('val_pe').value = ipo.valuation.pe || '';
        if (document.getElementById('val_ronw')) document.getElementById('val_ronw').value = ipo.valuation.ronw || '';
        if (document.getElementById('val_nav')) document.getElementById('val_nav').value = ipo.valuation.nav || '';
        if (document.getElementById('val_ebitda')) document.getElementById('val_ebitda').value = ipo.valuation.ebitdaMargin || '';
        if (document.getElementById('val_pat')) document.getElementById('val_pat').value = ipo.valuation.patMargin || '';
    } else {
        ['val_eps', 'val_pe', 'val_ronw', 'val_nav', 'val_ebitda', 'val_pat'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
    }

    // Custom Lots લોડ કરવા અને ગણતરી અપડેટ કરવી
    if (ipo.customLots && Array.isArray(ipo.customLots)) {
        ipo.customLots.forEach(cl => {
            const name = (cl.app || '').toLowerCase();
            if (name.includes('retail') && (name.includes('min') || !name.includes('max')) && document.getElementById('lot_retail')) {
                document.getElementById('lot_retail').value = cl.lot || 1;
            } else if ((name.includes('small') || name.includes('s-hni') || name.includes('s-nii')) && (name.includes('min') || !name.includes('max')) && document.getElementById('lot_shni')) {
                document.getElementById('lot_shni').value = cl.lot || 14;
            } else if ((name.includes('big') || name.includes('b-hni') || name.includes('b-nii')) && document.getElementById('lot_bhni')) {
                document.getElementById('lot_bhni').value = cl.lot || 68;
            }
        });
    }
    updateLotCalculations();

    // મેન્યુઅલ લોક ચેકબોક્સ લોડ કરવા
    if (document.getElementById('lock_manual_dates')) document.getElementById('lock_manual_dates').checked = !!ipo.manualDates;
    if (document.getElementById('lock_manual_issue')) document.getElementById('lock_manual_issue').checked = !!ipo.manualIssueInfo;
    if (document.getElementById('lock_manual_lots')) document.getElementById('lock_manual_lots').checked = !!ipo.manualLots;
    if (document.getElementById('lock_manual_fin')) document.getElementById('lock_manual_fin').checked = !!ipo.manualFin;
    if (document.getElementById('lock_manual_val')) document.getElementById('lock_manual_val').checked = !!ipo.manualValuation;
    if (document.getElementById('lock_manual_sub')) document.getElementById('lock_manual_sub').checked = !!ipo.manualSub;
    if (document.getElementById('lock_manual_listing')) document.getElementById('lock_manual_listing').checked = !!ipo.manualListingInfo;
    if (document.getElementById('lock_manual_all')) document.getElementById('lock_manual_all').checked = !!ipo.manualLockAll;

    const drawerTitle = document.getElementById('drawerTitle');
    const saveBtn = document.getElementById('saveBtn');
    if (drawerTitle) drawerTitle.innerText = `✏️ Edit IPO Profile: ${ipo.id}`;
    if (saveBtn) saveBtn.innerText = 'Update IPO Details';
    toggleDrawer(true);
}

// ડીલીટ કરવા માટે
async function deleteIpo(id) {
    if (confirm(`Are you sure you want to delete IPO: ${id}?`)) {
        let dbData = await fetchAdminDataFromCloud();
        delete dbData[id];
        
        await saveAdminDataToCloud(dbData);

        await loadAdminDashboard();
        alert(`✓ IPO ${id} deleted successfully from cloud.`);
    }
}

// તારીખ રીડેબલ ફોર્મેટ કરવા માટે
function formatDateReadable(dateStr) {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    const options = { day: '2-digit', month: 'short', year: 'numeric' };
    return d.toLocaleDateString('en-GB', options);
}

// નવો રજિસ્ટ્રાર ઉમેરવાનું બોક્સ ખોલવા/બંધ કરવા માટે
function toggleNewRegistrarBox() {
    const box = document.getElementById('newRegistrarBox');
    if (box) {
        box.style.display = box.style.display === 'none' ? 'block' : 'none';
    }
}

// પેજ લોડ થાય ત્યારે અને એડિટ ફોર્મ ખૂલે ત્યારે ડ્રોપડાઉન અપડેટ કરવા માટેનું ફંક્શન
function loadRegistrarDropdown() {
    const selectEl = document.getElementById('adm_registrarSelect');
    if (!selectEl) return;

    let registrars = getSavedRegistrars();
    selectEl.innerHTML = '<option value="">-- Select Registrar --</option>';
    registrars.forEach(reg => {
        const option = document.createElement('option');
        option.value = reg.url;
        option.textContent = reg.name;
        selectEl.appendChild(option);
    });
}

// જ્યારે ડ્રોપડાઉનમાંથી કોઈ રજિસ્ટ્રાર સિલેક્ટ કરીએ ત્યારે તેની URL ઓટોમેટિક ઇનપુટમાં આવી જાય
function setRegistrarLink(url) {
    const linkInput = document.getElementById('adm_allotmentLink');
    if (linkInput && url) {
        linkInput.value = url;
    }
}

// નવો રજિસ્ટ્રાર ડ્રોપડાઉનમાં એડ કરવા માટે
function addNewRegistrarOption() {
    const nameInput = document.getElementById('newRegName');
    const urlInput = document.getElementById('newRegUrl');

    const name = nameInput.value.trim();
    const url = urlInput.value.trim();

    if (!name || !url) {
        alert('કૃપા કરીને રજિસ્ટ્રારનું નામ અને યુઆરએલ બંને દાખલ કરો.');
        return;
    }

    let registrars = getSavedRegistrars();
    registrars.push({ name: name, url: url });
    localStorage.setItem('live_ipo_registrars', JSON.stringify(registrars));

    loadRegistrarDropdown();
    document.getElementById('adm_registrarSelect').value = url;

    nameInput.value = '';
    urlInput.value = '';
    toggleNewRegistrarBox();

    alert(`✓ નવો રજિસ્ટ્રાર "${name}" સફળતાપૂર્વક ઉમેરાઈ ગયો છે!`);
}

// રજિસ્ટ્રાર અને ડેશબોર્ડ વ્યુ સ્વિચ કરવા માટે
async function switchAdminView(viewName, event) {
    if (event) event.preventDefault();
    
    const masterRecordSec = document.getElementById('masterRecordSection');
    const registrarsSec = document.getElementById('registrarsSection');
    const statsGrid = document.querySelector('.stats-grid');
    const formDrawer = document.getElementById('ipoFormDrawer');
    
    document.querySelectorAll('.admin-menu a').forEach(a => a.classList.remove('active'));
    if (event && event.currentTarget) event.currentTarget.classList.add('active');

    if (formDrawer) formDrawer.style.display = 'none';

    if (viewName === 'registrars') {
        if (masterRecordSec) masterRecordSec.style.display = 'none';
        if (statsGrid) statsGrid.style.display = 'none';
        if (registrarsSec) {
            registrarsSec.style.display = 'block';
            loadRegistrarsTable();
        }
    } else {
        // Default: Dashboard
        if (registrarsSec) registrarsSec.style.display = 'none';
        if (statsGrid) statsGrid.style.display = 'grid';
        if (masterRecordSec) masterRecordSec.style.display = 'block';
        await loadAdminDashboard();
    }
}

// રજિસ્ટ્રાર ટેબલ લોડ કરવા માટે
function loadRegistrarsTable() {
    const tbody = document.getElementById('registrarsTableBody');
    if (!tbody) return;

    let registrars = getSavedRegistrars();
    tbody.innerHTML = '';

    registrars.forEach((reg, index) => {
        tbody.innerHTML += `
            <tr>
                <td><strong>${reg.name}</strong></td>
                <td>${reg.website ? `<a href="https://${reg.website.replace(/^https?:\/\//, '')}" target="_blank" style="color: #0284c7; text-decoration: none;">${reg.website}</a>` : '-'}</td>
                <td>${reg.mobile || '-'}</td>
                <td>${reg.email ? `<a href="mailto:${reg.email}" style="color: #0284c7; text-decoration: none;">${reg.email}</a>` : '-'}</td>
                <td>${reg.url ? `<a href="${reg.url}" target="_blank" style="color: #0284c7; text-decoration: underline;">${reg.url}</a>` : '-'}</td>
                <td style="text-align: center;">
                    <button type="button" onclick="editRegistrar(${index})" class="btn-action-edit">✏️ Edit</button>
                    <button type="button" onclick="deleteRegistrar(${index})" class="btn-action-del">🗑️ Delete</button>
                </td>
            </tr>
        `;
    });
}

// રજિસ્ટ્રાર એડિટ કરવા માટે મોડલ ફોર્મ ઓપન કરવા માટે
function editRegistrar(index) {
    let registrars = getSavedRegistrars();
    const reg = registrars[index];
    if (!reg) return;

    document.getElementById('editRegIndex').value = index;
    document.getElementById('editRegName').value = reg.name || '';
    document.getElementById('editRegWeb').value = reg.website || '';
    document.getElementById('editRegMobile').value = reg.mobile || '';
    document.getElementById('editRegEmail').value = reg.email || '';
    document.getElementById('editRegUrl').value = reg.url || '';

    const modal = document.getElementById('registrarEditModal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

// એડિટ ફોર્મ બંધ કરવા માટે
function closeRegistrarModal() {
    const modal = document.getElementById('registrarEditModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// એડિટ કરેલા રજિસ્ટ્રારના ફેરફારો સેવ કરવા માટે
function saveUpdatedRegistrar() {
    const index = document.getElementById('editRegIndex').value;
    const name = document.getElementById('editRegName').value.trim();
    const website = document.getElementById('editRegWeb').value.trim();
    const mobile = document.getElementById('editRegMobile').value.trim();
    const email = document.getElementById('editRegEmail').value.trim();
    const url = document.getElementById('editRegUrl').value.trim();

    if (!name || !url) {
        alert('રજિસ્ટ્રારનું નામ અને એલોટમેન્ટ URL ખાલી ન હોઈ શકે.');
        return;
    }

    let registrars = getSavedRegistrars();
    registrars[index] = { 
        name: name, 
        website: website, 
        mobile: mobile, 
        email: email, 
        url: url 
    };

    localStorage.setItem('live_ipo_registrars', JSON.stringify(registrars));
    
    loadRegistrarsTable();
    loadRegistrarDropdown();
    closeRegistrarModal();
    
    alert("✓ રજિસ્ટ્રાર સફળતાપૂર્વક અપડેટ થઈ ગયો છે!");
}

// રજિસ્ટ્રાર ડિલીટ કરવા માટે
function deleteRegistrar(index) {
    let registrars = getSavedRegistrars();
    if (confirm("શું તમે ખરેખર આ રજિસ્ટ્રારને ડિલીટ કરવા માંગો છો?")) {
        registrars.splice(index, 1);
        localStorage.setItem('live_ipo_registrars', JSON.stringify(registrars));
        loadRegistrarsTable();
        loadRegistrarDropdown();
        alert("✓ રજિસ્ટ્રાર ડિલીટ થઈ ગયો છે.");
    }
}

// ડિફોલ્ટ રજિસ્ટ્રાર ડેટા (૧૬ માન્યતા પ્રાપ્ત રજિસ્ટ્રાર કંપનીઓ)
const defaultMasterRegistrars = [
    { id: "Accurate", name: "Accurate Securities & Registry Private Limited", website: "accuratesecurities.com", url: "https://www.accuratesecurities.com/ipo-details.php" },
    { id: "Alankit", name: "Alankit Assignments Ltd", website: "alankit.com", url: "http://ipo.alankit.com/" },
    { id: "Ankit Consultancy", name: "Ankit Consultancy Pvt.Ltd", website: "ankitonline.com", url: "https://www.ankitonline.com/PublicIssue/FrmPublicIssue.aspx" },
    { id: "BEETALFC", name: "Beetal Financial & Computer Services (P) Limited", website: "beetalmail.com", url: "http://www.beetalmail.com/smeipo" },
    { id: "BIGSHARE", name: "Bigshare Services Private Limited", website: "bigshareonline.com", url: "https://ipo.bigshareonline.com/IPO_Status.html" },
    { id: "CAMEO", name: "Cameo Corporate Services Limited", website: "cameoindia.com", url: "https://ipo.cameoindia.com/" },
    { id: "INTEGRATED", name: "Integrated Registry Management Services (P) Limited", website: "integratedregistry.in", url: "https://www.integratedregistry.in/registrarstostatus.aspx" },
    { id: "KFIN", name: "Kfin Technologies Private Limited", website: "kfintech.com", url: "https://ipostatus.kfintech.com/" },
    { id: "LINKINTIME", name: "Link-Intime India Private Ltd", website: "linkintime.co.in", url: "https://linkintime.co.in/Initial_Offer/public-issues.html" },
    { id: "MAASHITLA", name: "Maashitla Securities Private Limited", website: "maashitla.com", url: "https://maashitla.com/allotment-status/public-issues" },
    { id: "MAS", name: "Mas Services Limited", website: "masserv.com", url: "https://www.masserv.com/opt.asp" },
    { id: "Mudra RTA", name: "Mudra RTA Ventures Private Limited", website: "mudrarta.com", url: "https://mudrarta.com/ipo.php" },
    { id: "MUFG", name: "MUFG Intime India Private Limited", website: "in.mpms.mufg.com", url: "https://in.mpms.mufg.com/Initial_Offer/public-issues.html" },
    { id: "PURVA", name: "Purva Sharegistry (India) Private Limited", website: "purvashare.com", url: "https://www.purvashare.com/investor-service/ipo-query" },
    { id: "SATELLITE", name: "Satellite Corporate Services Private Limited", website: "satellitecorporate.com", url: "https://www.satellitecorporate.com/ipo-query.php" },
    { id: "SKYLINE", name: "Skyline Financial Services Private Limited", website: "skylinerta.com", url: "https://www.skylinerta.com/ipo.php" }
];

function getSavedRegistrars() {
    let regs = JSON.parse(localStorage.getItem('live_ipo_registrars'));
    if (!regs || regs.length === 0 || regs.length < 5) {
        regs = defaultMasterRegistrars;
        localStorage.setItem('live_ipo_registrars', JSON.stringify(regs));
    }
    return regs;
}

// મેનેજર સેક્શનમાંથી નવો રજિસ્ટ્રાર સેવ કરવા માટે
function addNewRegistrarFromManager() {
    const name = document.getElementById('manageNewRegName').value.trim();
    const website = document.getElementById('manageNewRegWeb').value.trim();
    const mobile = document.getElementById('manageNewRegMobile').value.trim();
    const email = document.getElementById('manageNewRegEmail').value.trim();
    const url = document.getElementById('manageNewRegUrl').value.trim();

    if (!name || !url) {
        alert('કૃપા કરીને રજિસ્ટ્રારનું નામ અને એલોટમેન્ટ URL અવશ્ય દાખલ કરો.');
        return;
    }

    let registrars = getSavedRegistrars();
    registrars.push({ 
        name: name, 
        website: website, 
        mobile: mobile, 
        email: email, 
        url: url 
    });
    
    localStorage.setItem('live_ipo_registrars', JSON.stringify(registrars));

    document.getElementById('manageNewRegName').value = '';
    document.getElementById('manageNewRegWeb').value = '';
    document.getElementById('manageNewRegMobile').value = '';
    document.getElementById('manageNewRegEmail').value = '';
    document.getElementById('manageNewRegUrl').value = '';

    loadRegistrarsTable();
    loadRegistrarDropdown();
    alert(`✓ રજિસ્ટ્રાર "${name}" સફળતાપૂર્વક સેવ થઈ ગયો છે!`);
}

// ==========================================
// AUTO LOTS & INVESTMENT CALCULATION
// ==========================================
function updateLotCalculations() {
    const cutOff = parseFloat(document.getElementById('adm_cutOff')?.value) || 
                   parseFloat(document.getElementById('adm_priceEnd')?.value) || 0;
    const lotSize = parseInt(document.getElementById('adm_lotRaw')?.value) || 0;

    const lotRetail = parseInt(document.getElementById('lot_retail')?.value) || 1;
    const lotShni = parseInt(document.getElementById('lot_shni')?.value) || 14;
    const lotBhni = parseInt(document.getElementById('lot_bhni')?.value) || 68;

    const sharesRetail = lotRetail * lotSize;
    const amtRetail = sharesRetail * cutOff;
    const sharesShni = lotShni * lotSize;
    const amtShni = sharesShni * cutOff;
    const sharesBhni = lotBhni * lotSize;
    const amtBhni = sharesBhni * cutOff;

    const elSharesRetail = document.getElementById('preview_shares_retail');
    const elAmtRetail = document.getElementById('preview_amt_retail');
    const elSharesShni = document.getElementById('preview_shares_shni');
    const elAmtShni = document.getElementById('preview_amt_shni');
    const elSharesBhni = document.getElementById('preview_shares_bhni');
    const elAmtBhni = document.getElementById('preview_amt_bhni');

    if (elSharesRetail) elSharesRetail.innerText = sharesRetail > 0 ? sharesRetail.toLocaleString('en-IN') : '-';
    if (elAmtRetail) elAmtRetail.innerText = amtRetail > 0 ? `₹${amtRetail.toLocaleString('en-IN')}` : '-';
    if (elSharesShni) elSharesShni.innerText = sharesShni > 0 ? sharesShni.toLocaleString('en-IN') : '-';
    if (elAmtShni) elAmtShni.innerText = amtShni > 0 ? `₹${amtShni.toLocaleString('en-IN')}` : '-';
    if (elSharesBhni) elSharesBhni.innerText = sharesBhni > 0 ? sharesBhni.toLocaleString('en-IN') : '-';
    if (elAmtBhni) elAmtBhni.innerText = amtBhni > 0 ? `₹${amtBhni.toLocaleString('en-IN')}` : '-';
}

// ==========================================
// ADMIN LOGOUT FUNCTION
// ==========================================
function adminLogout(event) {
    if (event) event.preventDefault();
    if (confirm("શું તમે ખરેખર એડમિન પેનલમાંથી Logout કરવા માંગો છો?")) {
        localStorage.removeItem('live_ipo_admin_logged');
        window.location.href = 'login.html';
    }
}

// ==========================================
// CHITTORGARH SCRAPING & CLIENT-SIDE PARSER ENGINE
// ==========================================

function cleanChittorgarhUrl(input) {
    if (!input) return { fullUrl: '', pathKey: '', id: '' };
    let clean = input.trim();
    let fullUrl = '';
    let pathKey = '';

    if (clean.startsWith('http://') || clean.startsWith('https://')) {
        fullUrl = clean;
        try {
            const u = new URL(clean);
            pathKey = u.pathname;
        } catch (e) {
            pathKey = clean;
        }
    } else {
        pathKey = clean.startsWith('/') ? clean : '/' + clean;
        if (!pathKey.startsWith('/ipo/')) pathKey = '/ipo' + pathKey;
        fullUrl = 'https://www.chittorgarh.com' + pathKey;
    }

    if (!fullUrl.endsWith('/')) fullUrl += '/';
    if (!pathKey.endsWith('/')) pathKey += '/';

    const match = fullUrl.match(/\/(\d+)\//);
    const id = match ? match[1] : '';

    return { fullUrl, pathKey, id };
}

function parseIpoDateSingle(str) {
    if (!str) return null;
    let clean = str.replace(/[Tt]$/, '').replace(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[,\s]*/i, '').trim();
    const d = new Date(clean);
    if (!isNaN(d.getTime())) {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }
    return null;
}

function parseIpoDateRangeStr(str) {
    if (!str) return { openDate: null, closeDate: null };
    const parts = str.split(/\s+to\s+/i);
    if (parts.length === 2) {
        let part1 = parts[0].trim();
        let part2 = parts[1].trim();

        const yearMatch = part2.match(/\b(20\d\d)\b/);
        const year = yearMatch ? yearMatch[1] : new Date().getFullYear();

        const monthMatch = part2.match(/([a-zA-Z]+)/);
        const month2 = monthMatch ? monthMatch[1] : '';

        if (/^\d+$/.test(part1)) {
            part1 = `${part1} ${month2} ${year}`;
        } else if (!/\b20\d\d\b/.test(part1)) {
            part1 = `${part1} ${year}`;
        }

        return {
            openDate: parseIpoDateSingle(part1),
            closeDate: parseIpoDateSingle(part2)
        };
    }
    return { openDate: null, closeDate: null };
}

function parseChittorgarhHtml(html, pageUrl) {
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Extract Title / Name
        let name = '';
        const h1 = doc.querySelector('h1');
        if (h1 && h1.textContent) {
            name = h1.textContent.replace(/IPO\s*(Details|Review|Dates|Allotment|GMP|Price).*/i, 'IPO Details').trim();
            if (!name.toLowerCase().includes('ipo')) name += ' IPO Details';
        }
        if (!name && doc.title) {
            name = doc.title.replace(/IPO\s*(Details|Review|Dates|Allotment|GMP|Price).*/i, 'IPO Details').trim();
        }

        // Detect Type (Mainboard vs SME)
        let type = 'Mainboard';
        const pageText = doc.body ? doc.body.textContent || '' : '';
        if (pageText.includes('SME IPO') || (pageUrl && pageUrl.toLowerCase().includes('sme'))) {
            type = 'SME';
        }

        const dates = {};
        const issue = {};

        // Parse Main Tables
        const tables = doc.querySelectorAll('table');
        tables.forEach(table => {
            let priceDetailsCols = null;
            const rows = table.querySelectorAll('tr');
            rows.forEach(tr => {
                const cells = Array.from(tr.querySelectorAll('th, td')).map(c => c.textContent.trim().replace(/\s+/g, ' '));
                if (cells.length >= 2) {
                    const k = cells[0].toLowerCase();
                    const v = cells[1];

                    if (k === 'ipo date') {
                        const range = parseIpoDateRangeStr(v);
                        if (range.openDate) dates.openDate = range.openDate;
                        if (range.closeDate) dates.closeDate = range.closeDate;
                    }

                    if ((k === 'listing date' || k.includes('listed on') || k === 'listing') && !dates.listingDate) {
                        const parsed = parseIpoDateSingle(v);
                        if (parsed) dates.listingDate = parsed;
                    }

                    if ((k.includes('basis of allotment') || k.includes('allotment date')) && !dates.allotmentDate) {
                        const parsed = parseIpoDateSingle(v);
                        if (parsed) dates.allotmentDate = parsed;
                    }

                    if (k === 'price band' && !issue.priceBand) {
                        const nums = v.match(/\d+(\.\d+)?/g);
                        if (nums && nums.length >= 2) {
                            issue.priceStart = nums[0];
                            issue.priceEnd = nums[nums.length - 1];
                            issue.cutOff = parseFloat(nums[nums.length - 1]);
                            issue.priceBand = `${nums[0]} to ${nums[nums.length - 1]}`;
                        } else if (nums && nums.length === 1) {
                            issue.priceStart = nums[0];
                            issue.priceEnd = nums[0];
                            issue.cutOff = parseFloat(nums[0]);
                            issue.priceBand = nums[0];
                        }
                    }

                    if (k === 'lot size' && !issue.lotRaw) {
                        const match = v.match(/(\d+)\s*Shares?/i);
                        if (match) {
                            issue.lotRaw = parseInt(match[1]);
                            issue.lotSize = `${match[1]} Shares`;
                        }
                    }

                    if (k === 'face value' && !issue.faceValue) {
                        issue.faceValue = v;
                    }

                    if (k.includes('employee discount') && !issue.empDiscount) {
                        issue.empDiscount = v;
                    }

                    if ((k.includes('total issue size') || k === 'issue size') && !issue.totalSize) {
                        issue.totalSize = v.replace(/\uFFFD/g, '₹').trim();
                    }

                    if (k.includes('fresh issue') && !issue.freshIssue) {
                        issue.freshIssue = v.replace(/\uFFFD/g, '₹').trim();
                    }

                    if (k.includes('offer for sale') && !issue.ofs) {
                        issue.ofs = v.replace(/\uFFFD/g, '₹').trim();
                    }

                    if (k === 'listing at' && !issue.listingAt) {
                        issue.listingAt = v;
                    }

                    if (k.includes('bse script code') || k.includes('bse scrip code') || k.includes('nse symbol') || k === 'nse code' || k === 'bse code') {
                        const parts = v.split('/').map(p => p.trim()).filter(Boolean);
                        for (const p of parts) {
                            if (/^\d{6}$/.test(p) && !issue.bseCode) {
                                issue.bseCode = p;
                            } else if (/^[A-Z0-9&-]{2,20}$/i.test(p) && !['N/A', 'NIL', 'TBA', 'DESCRIPTION'].includes(p.toUpperCase()) && !issue.nseCode) {
                                issue.nseCode = p.toUpperCase();
                            }
                        }
                    }

                    if (k === 'isin' && !issue.isinCode) {
                        const isinMatch = v.match(/\b(IN[A-Z0-9]{10})\b/i);
                        if (isinMatch) issue.isinCode = isinMatch[1].toUpperCase();
                    }

                    if (k === 'price details') {
                        priceDetailsCols = cells.slice(1).map(c => c.toUpperCase());
                    } else if (priceDetailsCols && k === 'open') {
                        priceDetailsCols.forEach((colName, idx) => {
                            const rawCell = (cells[idx + 1] || '').replace(/,/g, '');
                            const num = parseFloat(rawCell.replace(/[^0-9.]/g, ''));
                            if (!isNaN(num) && num > 0) {
                                if (colName.includes('BSE') && !issue.listingPriceBse) {
                                    issue.listingPriceBse = num;
                                }
                                if (colName.includes('NSE') && !issue.listingPriceNse) {
                                    issue.listingPriceNse = num;
                                }
                            }
                        });
                    }
                }
            });
        });

        // Derive Tentative Allotment date if missing
        if (!dates.allotmentDate && dates.closeDate) {
            const close = new Date(dates.closeDate);
            close.setDate(close.getDate() + 1);
            dates.allotmentDate = close.toISOString().slice(0, 10);
        }

        // Parse Financials
        let headerRow = null;
        let assetRow = null;
        let revRow = null;
        let expRow = null;
        let prfRow = null;

        tables.forEach(table => {
            const text = table.textContent || '';
            if (text.includes('Period Ended') && (text.includes('Assets') || text.includes('Total Income') || text.includes('Profit After Tax'))) {
                const rows = table.querySelectorAll('tr');
                rows.forEach(tr => {
                    const cells = Array.from(tr.querySelectorAll('th, td')).map(c => c.textContent.trim().replace(/\s+/g, ' '));
                    if (cells.length > 1) {
                        const label = cells[0].toLowerCase();
                        if (label.includes('period ended')) headerRow = cells;
                        else if (label.includes('asset')) assetRow = cells;
                        else if (label.includes('total income') || label.includes('total revenue') || label.includes('revenue')) {
                            if (!revRow) revRow = cells;
                        }
                        else if (label.includes('expense')) expRow = cells;
                        else if (label.includes('profit after tax') || label.includes('pat') || label.includes('net profit')) {
                            if (!prfRow) prfRow = cells;
                        }
                    }
                });
            }
        });

        let fin = null;
        if (headerRow) {
            const periods = [];
            for (let i = 1; i < headerRow.length; i++) {
                const periodName = headerRow[i];
                if (!periodName) continue;
                periods.push({
                    rawPeriod: periodName,
                    ast: (assetRow && assetRow[i]) ? assetRow[i] : '-',
                    rev: (revRow && revRow[i]) ? revRow[i] : '-',
                    exp: (expRow && expRow[i]) ? expRow[i] : '-',
                    prf: (prfRow && prfRow[i]) ? prfRow[i] : '-'
                });
            }

            fin = {
                fy24: { yr: "FY-2024", ast: "-", rev: "-", exp: "-", prf: "-" },
                fy25: { yr: "FY-2025", ast: "-", rev: "-", exp: "-", prf: "-" },
                fy26: { yr: "FY-2026", ast: "-", rev: "-", exp: "-", prf: "-" },
                jun26: { yr: "30 Jun 2026", ast: "-", rev: "-", exp: "-", prf: "-" }
            };

            periods.forEach(p => {
                const text = p.rawPeriod;
                if ((text.includes('2024') && (text.includes('Mar') || text.includes('FY24'))) || text.includes('31 Mar 2024')) {
                    fin.fy24 = { yr: "FY-2024", ast: p.ast, rev: p.rev, exp: p.exp, prf: p.prf };
                } else if ((text.includes('2025') && (text.includes('Mar') || text.includes('FY25'))) || text.includes('31 Mar 2025')) {
                    fin.fy25 = { yr: "FY-2025", ast: p.ast, rev: p.rev, exp: p.exp, prf: p.prf };
                } else if ((text.includes('2026') && (text.includes('Mar') || text.includes('FY26'))) || text.includes('31 Mar 2026')) {
                    fin.fy26 = { yr: "FY-2026", ast: p.ast, rev: p.rev, exp: p.exp, prf: p.prf };
                } else if (text.toLowerCase().includes('jun') || text.toLowerCase().includes('sep') || text.toLowerCase().includes('dec') || text.toLowerCase().includes('q1') || text.toLowerCase().includes('q2')) {
                    fin.jun26 = { yr: p.rawPeriod, ast: p.ast, rev: p.rev, exp: p.exp, prf: p.prf };
                }
            });

            if (fin.fy26.ast === '-') {
                const p26 = periods.find(p => p.rawPeriod.includes('2026') && !p.rawPeriod.toLowerCase().includes('jun') && !p.rawPeriod.toLowerCase().includes('sep'));
                if (p26) {
                    fin.fy26 = { yr: "FY-2026", ast: p26.ast, rev: p26.rev, exp: p26.exp, prf: p26.prf };
                }
            }
            if (fin.jun26.ast === '-' && periods.length > 0) {
                const pFirst = periods[0];
                if (pFirst.rawPeriod.toLowerCase().includes('jun') || pFirst.rawPeriod.includes('30 Jun')) {
                    fin.jun26 = { yr: pFirst.rawPeriod, ast: pFirst.ast, rev: pFirst.rev, exp: pFirst.exp, prf: pFirst.prf };
                }
            }
        }

        // Parse Lots
        let lotRows = [];
        tables.forEach(table => {
            const text = table.textContent || '';
            if (text.includes('Retail (Min)') || (text.includes('Application') && text.includes('Lots') && text.includes('Shares'))) {
                const rows = table.querySelectorAll('tr');
                rows.forEach(tr => {
                    const cells = Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim());
                    if (cells.length >= 2) {
                        const appName = cells[0];
                        const lotNum = parseInt(cells[1].replace(/,/g, ''));
                        if (appName && !isNaN(lotNum) && lotNum > 0) {
                            lotRows.push({ app: appName, lot: lotNum });
                        }
                    }
                });
            }
        });

        let customLots = null;
        if (lotRows.length > 0) {
            let retailLot = 1, shniLot = 14, bhniLot = 68;
            lotRows.forEach(r => {
                const n = r.app.toLowerCase();
                if (n.includes('retail') && (n.includes('min') || !n.includes('max'))) {
                    retailLot = r.lot;
                } else if ((n.includes('small') || n.includes('s-hni') || n.includes('s-nii')) && (n.includes('min') || !n.includes('max'))) {
                    shniLot = r.lot;
                } else if (n.includes('big') || n.includes('b-hni') || n.includes('b-nii')) {
                    bhniLot = r.lot;
                }
            });
            customLots = [
                { app: "Retail Min", lot: retailLot },
                { app: "Small HNI", lot: shniLot },
                { app: "Big HNI", lot: bhniLot }
            ];
        }

        // Parse Valuation Ratios
        let valuation = {};
        tables.forEach(table => {
            const rows = table.querySelectorAll('tr');
            rows.forEach(tr => {
                const cells = Array.from(tr.querySelectorAll('th, td')).map(c => c.textContent.trim().replace(/\s+/g, ' '));
                if (cells.length >= 2) {
                    const label = cells[0].toLowerCase();
                    if (label.includes('ronw') && !valuation.ronw) valuation.ronw = cells[cells.length - 1] || cells[1];
                    else if (label.includes('pat margin') && !valuation.patMargin) valuation.patMargin = cells[cells.length - 1] || cells[1];
                    else if (label.includes('ebitda margin') && !valuation.ebitdaMargin) valuation.ebitdaMargin = cells[cells.length - 1] || cells[1];
                    else if (label.includes('nav') && !valuation.nav) valuation.nav = cells[cells.length - 1] || cells[1];
                    else if (label.includes('eps') && !valuation.eps) valuation.eps = cells[cells.length - 1] || cells[1];
                    else if (label.includes('p/e') && !valuation.pe) valuation.pe = cells[cells.length - 1] || cells[1];
                }
            });
        });

        return {
            name,
            type,
            dates: Object.keys(dates).length > 0 ? dates : null,
            issue: Object.keys(issue).length > 0 ? issue : null,
            fin,
            customLots,
            valuation: Object.keys(valuation).length > 0 ? valuation : null
        };
    } catch (err) {
        console.error("DOMParser Chittorgarh Error:", err);
        return null;
    }
}

// લોકલ ડેવલપમેન્ટ પર હોઈએ ત્યારે જ Port 3001 બેકએન્ડ અજમાવો (લાઈવ સાઈટ પર 3.5s વેડફ્યા વગર સીધા ક્લાઉડ પર જશે)
async function tryLocalBackendChittorgarh(keyOrUrl) {
    const host = (typeof window !== 'undefined' && window.location && window.location.hostname) || '';
    if (host !== 'localhost' && host !== '127.0.0.1') return null;

    const { fullUrl } = cleanChittorgarhUrl(keyOrUrl);
    if (!fullUrl) return null;

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1500);
        const res = await fetch(`http://localhost:3001/api/fetch-chittorgarh-details?url=${encodeURIComponent(fullUrl)}`, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (res.ok) {
            const json = await res.json();
            if (json.success && (json.details || json.subscription)) {
                return {
                    details: json.details || null,
                    subscription: json.subscription || null,
                    source: 'local-backend'
                };
            }
        }
    } catch (e) {
        console.log("Local backend not active, switching to Cloud Sync:", e.message);
    }
    return null;
}

// ==========================================
// UNIFIED CLOUD RUNNER & CLOUDFLARE WORKER ENGINE
// ==========================================
const GH_OWNER_REPO = 'mehul2687/live-ipo-website';
const GH_SYNC_WORKFLOW = 'sync.yml';
const GH_TOKEN_STORAGE_KEY = 'live_ipo_github_token';
const SYNC_WORKER_URL = 'https://liveipo-sync.mehul2687.workers.dev';
const SYNC_ADMIN_PIN_KEY = 'live_ipo_sync_pin';

function getStoredGithubToken() {
    return (localStorage.getItem(GH_TOKEN_STORAGE_KEY) || '').trim();
}

function getStoredAdminPin() {
    return (localStorage.getItem(SYNC_ADMIN_PIN_KEY) || '').trim();
}

async function checkSyncWorkerHealth(force = false) {
    if (!force && window._workerHealth && window._workerHealth.reachable) {
        return window._workerHealth;
    }
    try {
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), 3500);
        const res = await fetch(`${SYNC_WORKER_URL}/health?_t=${Date.now()}`, {
            signal: controller.signal,
            cache: 'no-store'
        });
        clearTimeout(tid);
        if (res.ok) {
            const j = await res.json();
            window._workerHealth = {
                reachable: true,
                hasToken: Boolean(j && j.hasToken),
                requiresPin: Boolean(j && j.requiresPin)
            };
            return window._workerHealth;
        }
    } catch (e) {
        console.log("Worker health probe skipped/failed:", e.message);
    }
    window._workerHealth = { reachable: false, hasToken: false, requiresPin: false };
    return window._workerHealth;
}

function updateSyncTokenButtonUi(verifiedOk = null) {
    const btn = document.getElementById('btnGithubToken');
    if (!btn) return;

    if (window._workerHealth && window._workerHealth.hasToken) {
        btn.innerText = '☁️ Cloud Ready ✅';
        btn.style.background = '#dcfce7';
        btn.style.color = '#166534';
        btn.style.borderColor = '#bbf7d0';
        btn.title = 'Cloudflare Cloud Sync સક્રિય છે — બધા બ્રાઉઝરમાં GitHub Token વગર કામ કરશે';
        return;
    }

    const token = getStoredGithubToken();
    if (!token) {
        btn.innerText = '🔑 Connect Token ⚠️';
        btn.style.background = '#fef3c7';
        btn.style.color = '#92400e';
        btn.style.borderColor = '#fde68a';
        btn.title = 'ક્લાઉડ ઓટો-સિંક ચાલુ કરવા માટે એકવાર GitHub Token સેટ કરો';
        return;
    }

    if (verifiedOk === false) {
        btn.innerText = '🔑 Token Invalid ⚠️';
        btn.style.background = '#fee2e2';
        btn.style.color = '#991b1b';
        btn.style.borderColor = '#fecaca';
        btn.title = 'સેવ કરેલો GitHub Token અમાન્ય છે — ક્લિક કરીને નવો ટોકન દાખલ કરો';
        return;
    }

    btn.innerText = '🔑 Sync Ready ✅';
    btn.style.background = '#dcfce7';
    btn.style.color = '#166534';
    btn.style.borderColor = '#bbf7d0';
    btn.title = 'GitHub Cloud Sync સક્રિય છે (ટોકન બદલવા માટે ક્લિક કરો)';
}

async function validateGithubToken(token) {
    const clean = (token || '').trim();
    if (!clean) {
        return { valid: false, reason: 'missing', message: 'GitHub Token ખાલી છે.' };
    }

    try {
        const res = await fetch(`https://api.github.com/repos/${GH_OWNER_REPO}`, {
            headers: {
                'Authorization': `Bearer ${clean}`,
                'Accept': 'application/vnd.github+json'
            },
            cache: 'no-store'
        });

        if (res.status === 401) {
            return {
                valid: false,
                reason: 'invalid',
                message: 'આ GitHub Token અમાન્ય અથવા એક્સપાયર (401) થયો છે.'
            };
        }
        if (res.status === 403 || res.status === 404) {
            return {
                valid: false,
                reason: 'no_access',
                message: `આ ટોકનને ${GH_OWNER_REPO} રિપોઝિટરીની એક્સેસ નથી (HTTP ${res.status}).`
            };
        }
        if (!res.ok) {
            return {
                valid: false,
                reason: 'http_error',
                message: `GitHub ચકાસણીમાં ક્ષતિ આવી (HTTP ${res.status}).`
            };
        }

        // Classic PAT returns x-oauth-scopes; Fine-Grained PAT returns null
        const scopesHeader = res.headers.get('x-oauth-scopes');
        if (scopesHeader !== null) {
            const scopes = scopesHeader.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
            const hasRepo = scopes.includes('repo') || scopes.includes('public_repo');
            const hasWorkflow = scopes.includes('workflow');
            if (!hasRepo || !hasWorkflow) {
                return {
                    valid: false,
                    reason: 'missing_scopes',
                    message: `આ Classic Token માં જરૂરી સ્કોપ ખૂટે છે! GitHub માં 'repo' અને 'workflow' બંને ચેકબોક્સ ટીક હોવા જરૂરી છે. (મળેલા સ્કોપ: ${scopesHeader || 'કોઈ નહીં'})`
                };
            }
        }

        return { valid: true };
    } catch (e) {
        return {
            valid: false,
            reason: 'network',
            message: `GitHub સાથે કનેક્ટ ન થઈ શક્યું: ${e.message}`
        };
    }
}

async function ensureSyncTransport() {
    // ૧. પહેલા Cloudflare Worker ચકાસો (જેથી બ્રાઉઝરમાં કોઈ GitHub Token વગર જ Sync ચાલે)
    const wh = await checkSyncWorkerHealth(true);
    updateSyncTokenButtonUi();

    if (wh.hasToken) {
        let pin = getStoredAdminPin();
        if (wh.requiresPin && !pin) {
            const entered = prompt('🔐 Cloudflare Worker માટે તમારો Admin Sync PIN દાખલ કરો:');
            if (entered === null || !entered.trim()) {
                throw new Error('Admin Sync PIN દાખલ કરેલો નથી.');
            }
            pin = entered.trim();
            localStorage.setItem(SYNC_ADMIN_PIN_KEY, pin);
        }
        return { mode: 'worker', pin };
    }

    // ૨. Fallback: જો Worker માં GITHUB_PAT હજુ સેટ ન થયું હોય તો Local GitHub Token વાપરો
    let token = getStoredGithubToken();
    if (!token) {
        await window.configureGithubToken(true);
        token = getStoredGithubToken();
        if (!token) {
            throw new Error(
                wh.reachable
                    ? 'Cloudflare Worker માં GITHUB_PAT Secret હજુ સેટ નથી અને લોકલ ટોકન પણ નથી. Cloudflare Settings માં GITHUB_PAT સેવ કરો અથવા "🔑 Connect Token" થી PAT નાખો.'
                    : 'GitHub Token સેટ કરેલો નથી. ઓટો-સિંક ચલાવવા માટે ઉપર "🔑 Connect Token" પર ક્લિક કરીને PAT ટોકન સેટ કરો.'
            );
        }
    }
    return { mode: 'direct', token };
}

async function dispatchCloudSync(targetIpoId = '', syncMode = 'all', transport = null) {
    try {
        const activeTransport = transport || await ensureSyncTransport();

        if (activeTransport.mode === 'worker') {
            const headers = { 'Content-Type': 'application/json' };
            if (activeTransport.pin) headers['x-admin-key'] = activeTransport.pin;

            const res = await fetch(`${SYNC_WORKER_URL}/dispatch`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    targetIpoId: targetIpoId || '',
                    syncMode: targetIpoId ? 'single' : (syncMode || 'all')
                })
            });

            let data = {};
            try { data = await res.json(); } catch (_) {}

            if (res.ok && data.ok) {
                updateSyncTokenButtonUi(true);
                return {
                    ok: true,
                    status: res.status,
                    dispatchStartedAt: data.dispatchStartedAt || (Date.now() - 8000)
                };
            }

            if (res.status === 401) {
                localStorage.removeItem(SYNC_ADMIN_PIN_KEY);
            }
            return {
                ok: false,
                status: res.status,
                error: data.error || `Cloudflare Worker HTTP ${res.status}`
            };
        }

        const activeToken = (activeTransport.token || getStoredGithubToken() || '').trim();
        if (!activeToken) {
            return {
                ok: false,
                status: 401,
                error: 'GitHub Token સેટ કરેલો નથી. ઉપર "🔑 Connect Token" બટનથી એકવાર ટોકન સેટ કરો.'
            };
        }

        const inputs = {
            sync_mode: targetIpoId ? 'single' : (syncMode || 'all')
        };
        if (targetIpoId) {
            inputs.target_ipo_id = targetIpoId;
        }

        const dispatchStartedAt = Date.now() - 8000;
        const res = await fetch(`https://api.github.com/repos/${GH_OWNER_REPO}/actions/workflows/${GH_SYNC_WORKFLOW}/dispatches`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${activeToken}`,
                'Accept': 'application/vnd.github+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ref: 'main',
                inputs
            })
        });

        if (res.status === 204 || res.ok) {
            updateSyncTokenButtonUi(true);
            return { ok: true, status: res.status, dispatchStartedAt };
        }

        let errMsg = `HTTP ${res.status}`;
        try {
            const errJson = await res.json();
            if (errJson && errJson.message) errMsg = `${errJson.message} (HTTP ${res.status})`;
        } catch (_) {}

        if (res.status === 401) {
            updateSyncTokenButtonUi(false);
            errMsg = 'GitHub Token અમાન્ય અથવા એક્સપાયર (401) છે. "🔑 Token" બટન પર ક્લિક કરીને નવો PAT ટોકન અપડેટ કરો.';
        } else if (res.status === 403) {
            updateSyncTokenButtonUi(false);
            errMsg = 'GitHub Token ને "workflow" / Actions (Read & Write) પરમિશન નથી (403).';
        }

        return { ok: false, status: res.status, error: errMsg };
    } catch (e) {
        return { ok: false, status: 0, error: `નેટવર્ક ક્ષતિ: ${e.message}` };
    }
}

async function fetchLatestWorkflowRun(transport, dispatchStartedAt, matchedRunId = null) {
    try {
        if (transport && transport.mode === 'worker') {
            const headers = {};
            if (transport.pin) headers['x-admin-key'] = transport.pin;
            const qs = new URLSearchParams({
                since: String(dispatchStartedAt || 0),
                runId: matchedRunId ? String(matchedRunId) : '',
                _t: String(Date.now())
            });
            const res = await fetch(`${SYNC_WORKER_URL}/status?${qs.toString()}`, {
                headers,
                cache: 'no-store'
            });
            if (!res.ok) return { apiOk: false, status: res.status, run: null };
            const json = await res.json();
            return { apiOk: Boolean(json && json.ok), status: res.status, run: (json && json.run) || null };
        }

        const token = transport && transport.token ? transport.token : getStoredGithubToken();
        const res = await fetch(
            `https://api.github.com/repos/${GH_OWNER_REPO}/actions/workflows/${GH_SYNC_WORKFLOW}/runs?event=workflow_dispatch&per_page=6&_t=${Date.now()}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github+json'
                },
                cache: 'no-store'
            }
        );
        if (!res.ok) return { apiOk: false, status: res.status, run: null };
        const json = await res.json();
        const runs = Array.isArray(json.workflow_runs) ? json.workflow_runs : [];
        let run = null;
        if (matchedRunId) {
            run = runs.find(r => r.id === matchedRunId) || null;
        }
        if (!run) {
            run = runs.find(r => new Date(r.created_at).getTime() >= dispatchStartedAt) || null;
        }
        return { apiOk: true, status: res.status, run };
    } catch (e) {
        return { apiOk: false, status: 0, run: null };
    }
}

async function runUnifiedCloudSync({ ipoId = '', syncMode = 'all', onStatus = null } = {}) {
    const transport = await ensureSyncTransport();

    const notify = (msg, phase = 'info') => {
        if (typeof onStatus === 'function') onStatus(msg, phase);
    };

    notify('⏳ GitHub Cloud Runner શરૂ થઈ રહ્યું છે...', 'dispatch');

    const preCloudData = await fetchAdminDataFromCloud();
    const preUpdatedAt = ipoId && preCloudData[ipoId] ? (preCloudData[ipoId].lastUpdated || null) : null;

    const dispatch = await dispatchCloudSync(ipoId, syncMode, transport);
    if (!dispatch.ok) {
        throw new Error(dispatch.error || 'GitHub Actions ટ્રિગર થઈ શક્યું નહીં.');
    }

    const startTime = Date.now();
    const maxAttempts = 36; // 36 * 2.5s = 90s max
    let matchedRunId = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        await new Promise(r => setTimeout(r, 2500));
        const elapsedSec = Math.round((Date.now() - startTime) / 1000);

        const { apiOk, run } = await fetchLatestWorkflowRun(transport, dispatch.dispatchStartedAt, matchedRunId);
        if (run) {
            matchedRunId = run.id;
            if (run.status === 'completed') {
                if (run.conclusion === 'success') {
                    notify('✅ Cloud Sync પૂર્ણ! નવો ડેટા લોડ થઈ રહ્યો છે...', 'success');
                    const freshData = await fetchAdminDataFromCloud();
                    return {
                        ok: true,
                        allData: freshData,
                        ipo: ipoId ? (freshData[ipoId] || null) : null,
                        run
                    };
                }
                throw new Error(`GitHub Cloud Sync નિષ્ફળ ગયો (${run.conclusion}). Logs: ${run.html_url}`);
            } else if (run.status === 'in_progress') {
                notify(`🚀 Chittorgarh પરથી લાઈવ ડેટા સ્ક્રૅપ થઈ રહ્યો છે... (${elapsedSec}s)`, 'running');
            } else {
                notify(`⏳ Cloud Runner કતારમાં છે (${run.status})... (${elapsedSec}s)`, 'queued');
            }
        } else {
            notify(`⏳ Cloud Runner કનેક્ટ થઈ રહ્યું છે... (${elapsedSec}s)`, 'queued');
            // Fallback check ONLY if GitHub Runs API wasn't reachable and JSONBin updated cleanly
            if (!apiOk && ipoId) {
                const fresh = await fetchAdminDataFromCloud();
                if (fresh[ipoId] && fresh[ipoId].lastUpdated && fresh[ipoId].lastUpdated !== preUpdatedAt) {
                    return { ok: true, allData: fresh, ipo: fresh[ipoId], run: null };
                }
            }
        }
    }

    throw new Error('90 સેકન્ડ પછી પણ Cloud Sync પૂર્ણ થયું નથી. GitHub Actions હજુ બેકગ્રાઉન્ડમાં ચાલુ હોઈ શકે છે — થોડીવાર પછી Page Refresh કરો.');
}

// ફોર્મમાં Chittorgarh પરથી ઓટો-ફેચ કરીને તમામ ઇનપુટ ભરવા માટેનું મુખ્ય ફંક્શન
window.fetchAndAutoFillFromChittorgarh = async function() {
    const keyInput = document.getElementById('adm_chittorgarhKey');
    const rawVal = keyInput ? keyInput.value.trim() : '';

    if (!rawVal) {
        alert('⚠️ કૃપા કરીને પહેલા Chittorgarh IPO ની URL અથવા Key પેસ્ટ કરો.\nઉદાહરણ તરીકે: https://www.chittorgarh.com/ipo/mksons-fine-jewels-ipo/3100/');
        if (keyInput) keyInput.focus();
        return;
    }

    const btn = document.getElementById('btnFetchChittorgarhForm');
    const icon = document.getElementById('fetchSpinIcon');
    const txt = document.getElementById('fetchBtnText');
    const statusSpan = document.getElementById('formFetchStatus');

    const setStatus = (msg, color = '#0284c7') => {
        if (!statusSpan) return;
        statusSpan.style.display = 'inline-block';
        statusSpan.style.color = color;
        statusSpan.innerText = msg;
    };

    if (btn) btn.disabled = true;
    if (icon) icon.className = 'spin-anim';
    if (txt) txt.innerText = 'Fetching Live Data...';
    setStatus('⏳ Chittorgarh કનેક્શન તપાસી રહ્યા છીએ...', '#0284c7');

    try {
        // ૧. Unique Code અને Name સુનિશ્ચિત કરો
        const idInput = document.getElementById('adm_id');
        let ipoId = idInput ? idInput.value.trim().toUpperCase() : '';
        if (!ipoId) {
            autoGenerateIpoCode();
            ipoId = idInput ? idInput.value.trim().toUpperCase() : 'IPO' + Math.floor(100 + Math.random() * 900);
            if (idInput) idInput.value = ipoId;
        }

        const nameInput = document.getElementById('adm_name');
        let companyName = nameInput ? nameInput.value.trim() : '';
        if (!companyName || companyName.includes('Test')) {
            const slugMatch = rawVal.match(/\/ipo\/([^\/]+)/);
            if (slugMatch) {
                const words = slugMatch[1].replace(/-ipo$/i, '').split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                companyName = words + ' IPO Details';
                if (nameInput) nameInput.value = companyName;
            }
        }

        // ૨. લોકલહોસ્ટ પર લોકલ બેકએન્ડ ચાલુ હોય તો તેનો ઉપયોગ કરો, નહીંતર Cloud Sync પહેલા ટોકન ચકાસો
        const localData = await tryLocalBackendChittorgarh(rawVal);
        let populatedIpo = null;

        if (localData && localData.details) {
            let dbData = await fetchAdminDataFromCloud();
            let existing = dbData[ipoId] || {};
            const d = localData.details;
            existing = {
                ...existing,
                id: ipoId,
                name: d.name || companyName || existing.name || 'New IPO',
                chittorgarhKey: rawVal,
                type: d.type || document.getElementById('adm_type')?.value || existing.type || 'Mainboard'
            };
            const fillFields = ['openDate', 'closeDate', 'allotmentDate', 'listingDate', 'priceBand', 'cutOff', 'lotRaw', 'lotSize', 'totalSize', 'freshIssue', 'ofs', 'faceValue', 'listingAt', 'bseCode', 'nseCode', 'isinCode', 'about', 'fin', 'valuation', 'reservation', 'subShares', 'subApps'];
            for (const f of fillFields) {
                if (d[f] !== undefined && d[f] !== null && d[f] !== '') {
                    existing[f] = d[f];
                }
            }
            dbData[ipoId] = existing;
            await saveAdminDataToCloud(dbData);
            populatedIpo = existing;
        } else {
            // Cloud Sync માટે પહેલા Worker અથવા Local ટોકન ચકાસો (જેથી ટોકન વગર JSONBin માં અધૂરો રેકોર્ડ ન બને)
            await ensureSyncTransport();

            setStatus('⏳ IPO લિંક ક્લાઉડ પર સેવ થઈ રહી છે...', '#0284c7');
            let dbData = await fetchAdminDataFromCloud();
            let existing = dbData[ipoId] || {};
            existing.id = ipoId;
            existing.name = companyName || existing.name || 'New IPO';
            existing.chittorgarhKey = rawVal;
            existing.type = document.getElementById('adm_type')?.value || existing.type || 'Mainboard';
            dbData[ipoId] = existing;
            await saveAdminDataToCloud(dbData);

            const syncResult = await runUnifiedCloudSync({
                ipoId,
                syncMode: 'single',
                onStatus: (msg) => setStatus(msg, '#0284c7')
            });
            populatedIpo = syncResult.ipo;
        }

        // ૩. ફોર્મ અને ટેબલ તાત્કાલિક અપડેટ કરો
        await editIpo(ipoId);
        updateLotCalculations();
        await loadAdminDashboard();

        const hasCoreData = Boolean(
            populatedIpo &&
            ((populatedIpo.openDate && populatedIpo.openDate !== 'N/A') ||
             (populatedIpo.priceBand && populatedIpo.priceBand !== '₹-') ||
             (populatedIpo.totalSize && populatedIpo.totalSize !== 'N/A'))
        );

        if (hasCoreData) {
            setStatus('✅ Chittorgarh પરથી તમામ ડેટા સફળતાપૂર્વક ફોર્મમાં ભરાઈ ગયો!', '#166534');
            alert(`🎉 Chittorgarh પરથી તમામ વિગતો સફળતાપૂર્વક ફોર્મમાં ભરાઈ ગઈ છે!\n\n✓ Name: ${populatedIpo.name}\n✓ Open Date: ${formatDateReadable(populatedIpo.openDate)}\n✓ Close Date: ${formatDateReadable(populatedIpo.closeDate)}\n✓ Price Band: ${populatedIpo.priceBand || '₹-'}\n✓ Lot Size: ${populatedIpo.lotSize || '-'}\n\nહવે તમે ફોર્મ ચકાસીને "Save & Publish" કરી શકો છો.`);
        } else {
            setStatus('⚠️ Sync પૂર્ણ થયું, પણ Chittorgarh પર હજુ તારીખ/પ્રાઈસ (TBE) ઉપલબ્ધ નથી અથવા URL ખોટી છે.', '#b45309');
            alert('⚠️ Cloud Sync સફળતાપૂર્વક પૂર્ણ થયું, પરંતુ આ IPO ની Chittorgarh લિંક પર હજુ તારીખો અને પ્રાઈસ બેન્ડ અપલોડ થયા નથી (અથવા URL ચકાસો).');
        }
    } catch (err) {
        console.error("Auto-fetch error:", err);
        setStatus(`❌ Error: ${err.message}`, '#dc2626');
        alert(`❌ Auto-Fetch નિષ્ફળ:\n${err.message}`);
    } finally {
        if (btn) btn.disabled = false;
        if (icon) icon.className = '';
        if (txt) txt.innerText = 'Auto-Fetch & Fill Form Now';
    }
};

// ==========================================
// સિંગલ IPO માટે તાત્કાલિક ૧-ક્લિક ઓન-ધ-સ્પોટ સિંક
// ==========================================
window.syncSingleIpo = async function(ipoId) {
    let dbData = await fetchAdminDataFromCloud();
    const ipo = dbData[ipoId];
    if (!ipo) {
        alert("⚠️ આ IPO નો રેકોર્ડ મળ્યો નથી.");
        return;
    }

    const key = ipo.chittorgarhKey || ipo.chittorgarh_key;
    if (!key) {
        alert(`⚠️ IPO "${ipo.name}" માં Chittorgarh URL/Key દાખલ કરેલ નથી.\n\nકૃપા કરીને '✏️ Edit' બટન પર ક્લિક કરીને Chittorgarh Link ઉમેરો.`);
        return;
    }

    const rowBtns = document.querySelectorAll(`button[onclick*="syncSingleIpo('${ipoId}')"]`);
    rowBtns.forEach(b => {
        b.innerHTML = '🔄 Syncing...';
        b.disabled = true;
    });

    const badge = document.getElementById('syncStatusBadge');
    const setBadge = (text, bg = '#fef3c7', color = '#92400e') => {
        if (!badge) return;
        badge.style.display = 'inline-block';
        badge.innerText = text;
        badge.style.background = bg;
        badge.style.color = color;
    };

    try {
        setBadge(`⏳ "${ipo.name}" માટે Cloud Sync શરૂ થઈ રહ્યું છે...`);

        const syncResult = await runUnifiedCloudSync({
            ipoId,
            syncMode: 'single',
            onStatus: (msg) => {
                setBadge(`${msg} — ${ipo.name}`);
                const secMatch = msg.match(/\((\d+s)\)/);
                if (secMatch) {
                    rowBtns.forEach(b => b.innerHTML = `🔄 (${secMatch[1]})`);
                }
            }
        });

        await loadAdminDashboard();

        const updatedIpo = syncResult.ipo;
        const hasCoreData = Boolean(
            updatedIpo &&
            ((updatedIpo.openDate && updatedIpo.openDate !== 'N/A') ||
             (updatedIpo.priceBand && updatedIpo.priceBand !== '₹-') ||
             (updatedIpo.totalSize && updatedIpo.totalSize !== 'N/A'))
        );

        if (hasCoreData) {
            setBadge('✅ Synced Successfully!', '#dcfce7', '#166534');
            alert(`🎉 IPO "${updatedIpo.name}" નો તમામ ડેટા Chittorgarh પરથી સફળતાપૂર્વક અપડેટ થઈ ગયો છે!\n\n✓ Open Date: ${formatDateReadable(updatedIpo.openDate)}\n✓ Close Date: ${formatDateReadable(updatedIpo.closeDate)}\n✓ Price Band: ${updatedIpo.priceBand || '₹-'}\n✓ Lot Size: ${updatedIpo.lotSize || '-'}\n✓ Financials & Valuations Synced!`);
        } else {
            setBadge('⚠️ Sync Done (Dates Pending on Source)', '#fef3c7', '#92400e');
            alert(`⚠️ IPO "${ipo.name}" માટે Cloud Sync પૂર્ણ થયું, પરંતુ Chittorgarh પેજ પર હજુ તારીખો કે પ્રાઈસ બેન્ડ જાહેર થયા નથી (અથવા URL ચકાસો).`);
        }
    } catch (err) {
        console.error("Single IPO sync error:", err);
        setBadge('❌ Sync Failed', '#fee2e2', '#991b1b');
        alert(`❌ Sync કરવામાં ક્ષતિ આવી:\n${err.message}`);
    } finally {
        rowBtns.forEach(b => {
            b.innerHTML = '⚡ Sync';
            b.disabled = false;
        });
        setTimeout(() => { if (badge) badge.style.display = 'none'; }, 6000);
    }
};

// ==========================================
// INSTANT AUTO-SYNC ENGINE (All IPOs)
// ==========================================
let isSyncInProgress = false;

async function triggerInstantSync(event) {
    if (event && event.preventDefault) event.preventDefault();
    if (isSyncInProgress) {
        alert("⚠️ Auto-Sync પહેલાથી ચાલુ છે. કૃપા કરીને થોડીવાર રાહ જુઓ.");
        return;
    }

    const btn = document.getElementById('btnSyncNow');
    const syncText = document.getElementById('syncText');
    const syncIcon = document.getElementById('syncIcon');
    const badge = document.getElementById('syncStatusBadge');

    const setBadge = (text, bg = '#fef3c7', color = '#92400e') => {
        if (!badge) return;
        badge.style.display = 'inline-block';
        badge.innerText = text;
        badge.style.background = bg;
        badge.style.color = color;
    };

    isSyncInProgress = true;
    if (btn) btn.disabled = true;
    if (syncIcon) {
        syncIcon.innerHTML = '🔄';
        syncIcon.className = 'spin-anim';
    }
    if (syncText) syncText.innerText = 'Syncing...';

    try {
        await runUnifiedCloudSync({
            syncMode: 'ipos',
            onStatus: (msg) => setBadge(msg)
        });

        await loadAdminDashboard();
        setBadge('✅ All IPOs Synced Successfully!', '#dcfce7', '#166534');
        alert('🎉 Auto-Sync સફળ! Chittorgarh પરથી તમામ IPOs ની તારીખો, પ્રાઇસ બેન્ડ અને વિગતો ક્લાઉડ પરથી ઓન-ધ-સ્પોટ અપડેટ થઈ ગઈ છે.');
    } catch (err) {
        console.error("Auto-sync error:", err);
        setBadge('❌ Sync Failed', '#fee2e2', '#991b1b');
        alert(`❌ Auto-Sync નિષ્ફળ:\n${err.message}`);
    } finally {
        isSyncInProgress = false;
        if (btn) btn.disabled = false;
        if (syncIcon) {
            syncIcon.innerHTML = '⚡';
            syncIcon.className = '';
        }
        if (syncText) syncText.innerText = 'Auto-Sync Data Now';
        setTimeout(() => {
            if (badge) badge.style.display = 'none';
        }, 6000);
    }
}

// GitHub Personal Access Token (PAT) / Cloudflare Worker સ્ટેટસ સેટ કરવા માટેનું ફંક્શન
async function configureGithubToken(isFromSyncPrompt = false) {
    const wh = await checkSyncWorkerHealth(true);
    updateSyncTokenButtonUi();

    if (wh.hasToken) {
        if (wh.requiresPin && !isFromSyncPrompt) {
            const currentPin = getStoredAdminPin();
            const newPin = prompt(
                '☁️ Cloudflare Cloud Sync સક્રિય છે!\n\nઅહીં તમે સેવ કરેલો Admin Sync PIN બદલી કે દૂર કરી શકો છો (ખાલી રાખીને OK આપવાથી દૂર થશે):',
                currentPin
            );
            if (newPin === null) return true;
            if (newPin.trim()) {
                localStorage.setItem(SYNC_ADMIN_PIN_KEY, newPin.trim());
                alert('✅ Admin Sync PIN સેવ થઈ ગયો!');
            } else {
                localStorage.removeItem(SYNC_ADMIN_PIN_KEY);
                alert('ℹ️ Admin Sync PIN દૂર કર્યો છે.');
            }
            return true;
        }
        if (!isFromSyncPrompt) {
            const wantLocal = confirm(
                '☁️ Cloudflare Cloud Sync પહેલેથી જ સક્રિય છે!\n\nહવે કોઈ પણ બ્રાઉઝર કે ફોનમાં અલગથી GitHub Token નાખવાની જરૂર નથી.\n\nશું તમારે તેમ છતાં વધારાનો બેકઅપ Local GitHub Token સેટ કરવો છે? (સામાન્ય રીતે Cancel દબાવો)'
            );
            if (!wantLocal) return true;
        }
    }

    const current = getStoredGithubToken();
    const intro = isFromSyncPrompt
        ? (wh.reachable
            ? '⚠️ Cloudflare Worker માં GITHUB_PAT Secret હજુ સેટ થયેલ નથી.\nઅત્યારે ચલાવવા માટે GitHub Token અહીં પેસ્ટ કરો (અથવા Cloudflare Settings માં GITHUB_PAT મૂકો):\n\n'
            : '⚠️ Live Auto-Sync ચલાવવા માટે GitHub Token જરૂરી છે (ફક્ત ૧ વખત આ બ્રાઉઝરમાં સેટ કરવો પડશે):\n\n')
        : '🔑 GitHub Personal Access Token (PAT) સેટિંગ્સ:\n\n';
    const guide =
        intro +
        'કેવી રીતે બનાવવો?\n' +
        '1) GitHub -> Settings -> Developer settings -> Personal access tokens -> Tokens (classic)\n' +
        '2) "Generate new token (classic)" પર ક્લિક કરી [repo] અને [workflow] બંને ટીક કરો\n' +
        '3) મળેલો ટોકન (ghp_...) નીચે પેસ્ટ કરીને OK આપો.\n\n' +
        'લોકલ ટોકન દૂર કરવા માટે ખાલી રાખીને OK આપો:';

    const input = prompt(guide, current);
    if (input === null) return false;

    const clean = input.trim();
    if (!clean) {
        localStorage.removeItem(GH_TOKEN_STORAGE_KEY);
        updateSyncTokenButtonUi(false);
        alert('ℹ️ લોકલ GitHub Token દૂર કર્યો છે.');
        return false;
    }

    const check = await validateGithubToken(clean);
    if (!check.valid) {
        updateSyncTokenButtonUi(Boolean(current));
        alert(`❌ Token વેરિફિકેશન નિષ્ફળ (સેવ કરેલ નથી):\n\n${check.message}`);
        return false;
    }

    localStorage.setItem(GH_TOKEN_STORAGE_KEY, clean);
    updateSyncTokenButtonUi(true);
    if (!isFromSyncPrompt) {
        alert('✅ GitHub Token વેરિફાઈ અને સેવ થઈ ગયો છે!\nહવે ત્રણેય Auto-Sync બટન સીધા કામ કરશે.');
    }
    return true;
}
window.configureGithubToken = configureGithubToken;

// ફોર્મ સેવ કર્યા પછી તરત જ ઓટો-સિંક કરવા માટેનું ફંક્શન
window.saveAndSyncIpo = async function(event) {
    if (event) event.preventDefault();
    const manageForm = document.getElementById('manageIpoForm');
    if (!manageForm) return;

    if (!manageForm.checkValidity()) {
        manageForm.reportValidity();
        return;
    }

    if (typeof window.saveCurrentFormToCloud !== 'function') {
        alert('⚠️ Form save helper લોડ થઈ રહ્યું છે — કૃપા કરીને Page Refresh કરો.');
        return;
    }

    const savedId = await window.saveCurrentFormToCloud({ silent: true, closeDrawer: true });
    if (savedId) {
        await window.syncSingleIpo(savedId);
    }
};