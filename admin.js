// ==========================================
// ADMIN PANEL SCRIPT (JSONBin.io Cloud Synced)
// ==========================================

const ADMIN_BIN_ID = "6aaf80f9ac6210605ae1bce6";
const ADMIN_API_KEY = "$2a$10$Pl5b/ekYZXhRBmQVY6DwieMC10GztytHM9d7CnR0zqmje7BWYj6yC";

document.addEventListener('DOMContentLoaded', async () => {
    // ૧. પેજ લોડ થતાં જ ક્લાઉડ અને લોકલમાંથી ડેશબોર્ડ ડેટા લોડ કરો
    await loadAdminDashboard();
    loadRegistrarDropdown();
    updateLotCalculations();

    // ૨. IPO ના નામ પરથી ઓટોમેટિક શોર્ટ કોડ (Unique ID) બનાવવા માટે
    const nameInput = document.getElementById('adm_name');
    const idInput = document.getElementById('adm_id');

    if (nameInput && idInput) {
        nameInput.addEventListener('input', function() {
            const val = nameInput.value.trim();
            if (val.length > 0) {
                const words = val.replace(/ipo/gi, '').trim().split(/\s+/);
                let initials = '';
                for (let i = 0; i < Math.min(words.length, 3); i++) {
                    if (words[i].length > 0) {
                        initials += words[i][0].toUpperCase();
                    }
                }
                if (!initials) initials = 'IPO';
                const randomNum = Math.floor(100 + Math.random() * 900);
                idInput.value = initials + randomNum;
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

    // ૫. Form Submit Handler (ક્લાઉડ સેવ સાથે)
    const manageForm = document.getElementById('manageIpoForm');
    if (manageForm) {
        manageForm.addEventListener('submit', async function(e) {
            e.preventDefault(); // Page reload અટકાવવા માટે

            const ipoIdInput = document.getElementById('adm_id');
            if (!ipoIdInput) return;
            const ipoId = ipoIdInput.value.trim().toUpperCase();

            let dbData = await fetchAdminDataFromCloud();
            let existingIpo = dbData[ipoId] || {};

            const pStart = document.getElementById('adm_priceStart').value.trim();
            const pEnd = document.getElementById('adm_priceEnd').value.trim();
            const combinedPriceBand = (pStart && pEnd) ? `${pStart} to ${pEnd}` : (pStart || pEnd || '');

            let exchanges = [];
            const exBse = document.getElementById('ex_bse');
            const exNse = document.getElementById('ex_nse');
            if (exBse && exBse.checked) exchanges.push('BSE');
            if (exNse && exNse.checked) exchanges.push('NSE');
            const listingAtVal = exchanges.length > 0 ? exchanges.join(', ') : 'BSE, NSE';

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
                    fy23: { yr: "FY-2023", ast: document.getElementById('fin_23_ast').value || '-', rev: document.getElementById('fin_23_rev').value || '-', exp: document.getElementById('fin_23_exp').value || '-', prf: document.getElementById('fin_23_prf').value || '-' },
                    fy24: { yr: "FY-2024", ast: document.getElementById('fin_24_ast').value || '-', rev: document.getElementById('fin_24_rev').value || '-', exp: document.getElementById('fin_24_exp').value || '-', prf: document.getElementById('fin_24_prf').value || '-' },
                    fy25: { yr: "FY-2025", ast: document.getElementById('fin_25_ast').value || '-', rev: document.getElementById('fin_25_rev').value || '-', exp: document.getElementById('fin_25_exp').value || '-', prf: document.getElementById('fin_25_prf').value || '-' },
                    fy26: { yr: "FY-2026", ast: document.getElementById('fin_26_ast').value || '-', rev: document.getElementById('fin_26_rev').value || '-', exp: document.getElementById('fin_26_exp').value || '-', prf: document.getElementById('fin_26_prf').value || '-' }
                },

                // મેન્યુઅલ લોક સેટિંગ્સ - ઓટો સિંક ક્રાઉલરથી ઓવરરાઈટ રોકવા માટે
                manualDates: document.getElementById('lock_manual_dates')?.checked || false,
                manualIssueInfo: document.getElementById('lock_manual_issue')?.checked || false,
                manualLots: document.getElementById('lock_manual_lots')?.checked || false,
                manualFin: document.getElementById('lock_manual_fin')?.checked || false,
                manualValuation: document.getElementById('lock_manual_val')?.checked || false,
                manualSub: document.getElementById('lock_manual_sub')?.checked || false,
                manualLockAll: document.getElementById('lock_manual_all')?.checked || false
            };

            dbData[ipoId] = ipoData;
            
            // ક્લાઉડ અને લોકલસ્ટોરેજ બંનેમાં સેવ કરો
            await saveAdminDataToCloud(dbData);

            alert(`✓ IPO "${ipoData.name}" successfully saved & synced to cloud!`);
            toggleDrawer(false);
            await loadAdminDashboard();
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
        await fetch(`https://api.jsonbin.io/v3/b/${ADMIN_BIN_ID}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Master-Key': ADMIN_API_KEY
            },
            body: JSON.stringify({ ipos: dbData, updatedAt: new Date().toISOString() })
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

// ==========================================
// ડેશબોર્ડ ડેટા લોડ અને ટેબલ રેન્ડર કરવા માટેનું ફંક્શન
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

    ipoList.forEach(ipo => {
        total++;

        const statusObj = getIpoStatus(ipo.openDate, ipo.closeDate, ipo.allotmentDate, ipo.listingDate, ipo.isAllotmentOut);

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

        let statusBg = "#dcfce7"; 
        let statusColor = "#166534";

        if (ipo.isAllotmentOut === true) {
            statusBg = "#bbf7d0";
            statusColor = "#065f46";
        } else if (statusObj.text.includes("Live")) {
            statusBg = "#fee2e2"; 
            statusColor = "#dc2626";
        } else if (statusObj.text.includes("Waiting")) {
            statusBg = "#ffedd5";
            statusColor = "#c2410c";
        } else if (statusObj.text.includes("Listing Today")) {
            statusBg = "#e0e7ff";
            statusColor = "#3730a3";
        }

        const isChecked = ipo.isAllotmentOut === true ? 'checked' : '';

        tbody.innerHTML += `
            <tr>
                <td><strong>${ipo.id}</strong></td>
                <td>
                    <span onclick="editIpo('${ipo.id}')" style="color: #1d4ed8; font-weight: 600; cursor: pointer; text-decoration: underline dotted;" title="Click for Full Edit">${ipo.name}</span><br>
                    <span style="font-size: 11px; color: #64748b;">Est: ₹${ipo.estPrice || '-'}</span>
                </td>
                <td><span style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 11px;">${ipo.type || 'Mainboard'}</span></td>
                <td style="text-align: center;">${formatDateReadable(ipo.openDate)}</td>
                <td style="text-align: center;">${formatDateReadable(ipo.closeDate)}</td>
                <td style="text-align: center;">${formatDateReadable(ipo.allotmentDate)}</td>
                <td style="text-align: center;">${formatDateReadable(ipo.listingDate)}</td>
                <td style="text-align: center; font-weight: bold;">₹${ipo.priceBand || '-'}</td>
                <td style="text-align: center;">${ipo.lotSize || (ipo.lotRaw + ' Shares')}</td>
                <td style="text-align: center;">
                    <input type="text" id="dash_gmp_${ipo.id}" value="${ipo.gmp || ''}" placeholder="0" style="width: 70px; padding: 4px; text-align: center; font-weight: 700; color: #166534; border: 1px solid #cbd5e1; border-radius: 4px;">
                </td>
                <td style="text-align: center;">
                    <label style="cursor: pointer; font-size: 11.5px; font-weight: 600; color: #7c3aed; display: inline-flex; align-items: center; gap: 4px;">
                        <input type="checkbox" id="dash_allot_${ipo.id}" ${isChecked} style="width: 15px; height: 15px;"> Out
                    </label>
                </td>
                <td><span style="background: ${statusBg}; color: ${statusColor}; padding: 3px 8px; border-radius: 4px; font-weight: 700; font-size: 11px;">${statusObj.text}</span></td>
                <td style="text-align: center;">
                    <div class="action-btns" style="justify-content: center; gap: 4px;">
                        <button type="button" onclick="quickSaveFromDashboard('${ipo.id}')" class="btn-action-edit" style="background: #166534; color: #fff;" title="Save GMP & Allotment">💾 Save</button>
                        <button type="button" onclick="editIpo('${ipo.id}')" class="btn-action-edit" title="Full Edit">✏️ Edit</button>
                        <button type="button" onclick="deleteIpo('${ipo.id}')" class="btn-action-del" title="Delete">🗑️</button>
                    </div>
                </td>
            </tr>
        `;
    });

    if (document.getElementById('stat_total')) document.getElementById('stat_total').innerText = total;
    if (document.getElementById('stat_live')) document.getElementById('stat_live').innerText = live;
    if (document.getElementById('stat_upcoming')) document.getElementById('stat_upcoming').innerText = upcoming;
    if (document.getElementById('stat_allotment')) document.getElementById('stat_allotment').innerText = allotment;
}

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
    
    const admId = document.getElementById('adm_id');
    if (admId) {
        admId.value = 'IPO' + Math.floor(1000 + Math.random() * 9000);
        admId.readOnly = false;
    }

    // નવા IPO વખતે પર્સન્ટેજ અને ચિતોડગઢ કી બોક્સ ખાલી રાખવા
    if (document.getElementById('res_qib')) document.getElementById('res_qib').value = '';
    if (document.getElementById('res_nii')) document.getElementById('res_nii').value = '';
    if (document.getElementById('res_retail')) document.getElementById('res_retail').value = '';
    if (document.getElementById('adm_chittorgarhKey')) document.getElementById('adm_chittorgarhKey').value = '';

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
    ['lock_manual_dates', 'lock_manual_issue', 'lock_manual_lots', 'lock_manual_fin', 'lock_manual_val', 'lock_manual_sub', 'lock_manual_all'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.checked = false;
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

    document.getElementById('adm_id').value = ipo.id;
    document.getElementById('adm_id').readOnly = true;
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
        if (ipo.fin.fy23) {
            if (document.getElementById('fin_23_yr')) document.getElementById('fin_23_yr').value = ipo.fin.fy23.yr || 'FY-2023';
            document.getElementById('fin_23_ast').value = (ipo.fin.fy23.ast !== '-' ? ipo.fin.fy23.ast : '') || ''; 
            document.getElementById('fin_23_rev').value = (ipo.fin.fy23.rev !== '-' ? ipo.fin.fy23.rev : '') || ''; 
            document.getElementById('fin_23_exp').value = (ipo.fin.fy23.exp !== '-' ? ipo.fin.fy23.exp : '') || ''; 
            document.getElementById('fin_23_prf').value = (ipo.fin.fy23.prf !== '-' ? ipo.fin.fy23.prf : '') || ''; 
        }
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

// રજિસ્ટ્રાર મેનેજમેન્ટ વ્યુ સ્વિચ કરવા માટે
async function switchAdminView(viewName, event) {
    if (event) event.preventDefault();
    
    const masterRecordSec = document.getElementById('masterRecordSection');
    const registrarsSec = document.getElementById('registrarsSection');
    const gmpSec = document.getElementById('gmpManagerSection');
    const statsGrid = document.querySelector('.stats-grid');
    const formDrawer = document.getElementById('ipoFormDrawer');
    
    document.querySelectorAll('.admin-menu a').forEach(a => a.classList.remove('active'));
    if (event && event.currentTarget) event.currentTarget.classList.add('active');

    if (formDrawer) formDrawer.style.display = 'none';

    if (viewName === 'registrars') {
        if (masterRecordSec) masterRecordSec.style.display = 'none';
        if (statsGrid) statsGrid.style.display = 'none';
        if (gmpSec) gmpSec.style.display = 'none';
        if (registrarsSec) {
            registrarsSec.style.display = 'block';
            loadRegistrarsTable();
        }
    } else if (viewName === 'gmp') {
        if (masterRecordSec) masterRecordSec.style.display = 'none';
        if (statsGrid) statsGrid.style.display = 'none';
        if (registrarsSec) registrarsSec.style.display = 'none';
        if (gmpSec) {
            gmpSec.style.display = 'block';
            await loadGmpTable();
        }
    } else {
        // Default: Dashboard
        if (registrarsSec) registrarsSec.style.display = 'none';
        if (gmpSec) gmpSec.style.display = 'none';
        if (statsGrid) statsGrid.style.display = 'grid';
        if (masterRecordSec) masterRecordSec.style.display = 'block';
        await loadAdminDashboard();
    }
}

// ==========================================
// GMP & PRICING MANAGER FUNCTIONS
// ==========================================
async function loadGmpTable() {
    const tbody = document.getElementById('gmpTableBody');
    if (!tbody) return;

    let db = await fetchAdminDataFromCloud();
    tbody.innerHTML = '';

    const keys = Object.keys(db);
    if (keys.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #64748b; padding: 20px;">કોઈ IPO ડેટા ઉપલબ્ધ નથી.</td></tr>`;
        return;
    }

    const ipoList = keys.map(k => db[k]).filter(Boolean);
    ipoList.sort((a, b) => {
        const timeA = new Date(a.openDate || a.closeDate || 0).getTime();
        const timeB = new Date(b.openDate || b.closeDate || 0).getTime();
        if (timeB !== timeA) return timeB - timeA;
        return new Date(b.closeDate || 0).getTime() - new Date(a.closeDate || 0).getTime();
    });

    ipoList.forEach(ipo => {

        const isChecked = ipo.isAllotmentOut === true ? 'checked' : '';
        const cutOffPrice = ipo.cutOff || 0;

        tbody.innerHTML += `
            <tr>
                <td>
                    <strong style="color: #0f172a; font-size: 13.5px;">${ipo.name}</strong><br>
                    <span style="font-size: 11px; color: #64748b; font-weight: 600;">ID: ${ipo.id}</span>
                </td>
                <td style="font-weight: 600; color: #334155;">₹${ipo.priceBand || '-'}</td>
                <td>
                    <input type="text" id="gmp_mgr_${ipo.id}" value="${ipo.gmp || ''}" placeholder="0" 
                        style="width: 80px; padding: 6px; text-align: center; font-weight: 700; color: #166534; border: 1px solid #cbd5e1; border-radius: 4px;"
                        oninput="calcEstListingPrice('${ipo.id}', '${cutOffPrice}')">
                </td>
                <td>
                    <input type="text" id="est_mgr_${ipo.id}" value="${ipo.estPrice || ''}" placeholder="₹0" 
                        style="width: 100px; padding: 6px; text-align: center; font-weight: 600; color: #1e293b; border: 1px solid #cbd5e1; border-radius: 4px;">
                </td>
                <td style="text-align: center;">
                    <label style="cursor: pointer; font-size: 12px; font-weight: 600; color: #7c3aed; display: inline-flex; align-items: center; gap: 5px;">
                        <input type="checkbox" id="allot_mgr_${ipo.id}" ${isChecked} style="width: 16px; height: 16px;"> Out
                    </label>
                </td>
                <td style="text-align: center;">
                    <button type="button" onclick="quickSaveFromGmpManager('${ipo.id}')" class="btn-action-edit" style="background: #166534; color: #fff; padding: 6px 14px;" title="Save GMP, Est Price & Allotment">💾 Save</button>
                </td>
            </tr>
        `;
    });
}

function calcEstListingPrice(ipoId, cutOff) {
    const gmpInput = document.getElementById(`gmp_mgr_${ipoId}`);
    const estInput = document.getElementById(`est_mgr_${ipoId}`);
    if (!gmpInput || !estInput) return;

    const gmpVal = parseFloat(gmpInput.value) || 0;
    const cutOffVal = parseFloat(cutOff) || 0;

    if (cutOffVal > 0) {
        estInput.value = `₹${cutOffVal + gmpVal}`;
    }
}

async function quickSaveFromGmpManager(ipoId) {
    let dbData = await fetchAdminDataFromCloud();
    if (!dbData[ipoId]) return;

    const gmpInput = document.getElementById(`gmp_mgr_${ipoId}`);
    const estInput = document.getElementById(`est_mgr_${ipoId}`);
    const allotCheckbox = document.getElementById(`allot_mgr_${ipoId}`);

    if (gmpInput) dbData[ipoId].gmp = gmpInput.value.trim();
    if (estInput) dbData[ipoId].estPrice = estInput.value.trim();
    if (allotCheckbox) dbData[ipoId].isAllotmentOut = allotCheckbox.checked;

    await saveAdminDataToCloud(dbData);
    alert(`✓ IPO "${dbData[ipoId].name}" ની GMP વિગતો સફળતાપૂર્વક અપડેટ થઈ ગઈ છે!`);
    await loadGmpTable();
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

// ડિફોલ્ટ રજિસ્ટ્રાર ડેટા
function getSavedRegistrars() {
    let regs = JSON.parse(localStorage.getItem('live_ipo_registrars'));
    if (!regs || regs.length === 0) {
        regs = [
            { name: "Link Intime India Pvt Ltd", website: "linkintime.co.in", mobile: "022-49186200", email: "ipo@linkintime.co.in", url: "https://linkintime.co.in/initial_offer/default.aspx" },
            { name: "KFin Technologies Ltd", website: "kfintech.com", mobile: "040-67162222", email: "einward.ris@kfintech.com", url: "https://kosmic.kfintech.com/ipostatus/" },
            { name: "Bigshare Services Pvt Ltd", website: "bigshareonline.com", mobile: "022-62638200", email: "ipo@bigshareonline.com", url: "https://ipo.bigshareonline.com/ipo_status.html" }
        ];
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