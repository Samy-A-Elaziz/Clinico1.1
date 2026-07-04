/**
 * Clinico Comprehensive Application Control Engine
 * Orchestrates cloud database synchronization, layout mapping, and system actions.
 */

const PLACEHOLDER_PET_IMAGE = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512' fill='%230d9488'><path d='M226.5 92.9c14.3 42.9-.3 86.6-32.6 107.4-32.4 20.8-74.8 14.5-97.3-14.8-22.5-29.3-16-74.7 14.3-100.7c30.2-26 77.2-20.7 95.6 18.1zM50.4 278.6c0-39.6 33.3-71.7 74.2-71.7 41 0 74.2 32.1 74.2 71.7s-33.3 71.7-74.2 71.7c-41 .1-74.2-32-74.2-71.7zm387.4-185.7c18.4-38.8 65.4-44.1 95.6-18.1 30.3 26 36.8 71.4 14.3 100.7-22.5 29.3-64.9 35.6-97.3 14.8-32.3-20.8-46.9-64.5-32.6-107.4zm74.2 271.7c0 39.6-33.3 71.7-74.2 71.7-41 0-74.2-32.1-74.2-71.7s33.3-71.7 74.2-71.7c41 0 74.2 32.1 74.2 71.7zM362.4 174.4c-11.4-11.4-29.9-11.4-41.3 0l-2.4 2.4-2.4-2.4c-11.4-11.4-29.9-11.4-41.3 0-11.4 11.4-11.4 29.9 0 41.3l23.7 23.7c11.4 11.4 29.9 11.4 41.3 0l23.7-23.7c11.1-11.4 11.1-29.9-1.3-41.3zM256 244c-19.4 0-35.1 15.7-35.1 35.1s15.7 35.1 35.1 35.1 35.1-15.7 35.1-35.1S275.4 244 256 244z'/></svg>";
const SECURITY_KEY = "clinico123";

// ⚠️ PASTE YOUR DEPLOYED GOOGLE APPS SCRIPT WEB APP URL HERE:
const GOOGLE_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwb2pWSzqZk81Y9j1w3HAZGaAmLITn1NDkGYKQcFxAU3M02J7eTWmkfXJG0GBRJET55/exec";

const DYNAMIC_LINK_FIELDS = [
    'xray', 'ct', 'mri', 'fluoroscopy', 'ultrasound', 'echography',
    'cbc', 'biochemistry', 'urinalysis', 'cytology', 'otherLab',
    'pdf', 'word', 'excel', 'externalFiles'
];

class ClinicoApp {
    constructor() {
        this.currentView = 'home';
        this.selectedPatientId = null;
        this.runtime_db = [];
        this.initEventListeners();
        this.verifyAndHydrateStorage();
    }

    initEventListeners() {
        // Form submission interceptor
        const form = document.getElementById('patient-form');
        if (form) {
            form.addEventListener('submit', (e) => this.handleFormSubmit(e));
        }

        // Live Search Input Interceptors
        const searchInput = document.getElementById('search-input');
        if (searchInput) searchInput.addEventListener('input', () => this.renderHistory());

        const speciesSelect = document.getElementById('filter-species-select');
        if (speciesSelect) speciesSelect.addEventListener('change', () => this.renderHistory());

        // Event interceptor to listen for clicks on your updated "Save XLSX" button UI element
        document.addEventListener('click', (e) => {
            const button = e.target.closest('button');
            if (button && button.textContent.includes('Save XLSX')) {
                this.exportDatabaseToXLSX();
            }
        });
    }

    async verifyAndHydrateStorage() {
        if (!GOOGLE_WEB_APP_URL || GOOGLE_WEB_APP_URL.includes("YOUR_GOOGLE_APPS_SCRIPT")) {
            console.error("Database initialization stopped. Google Web App API URL is unconfigured.");
            return;
        }

        try {
            const response = await fetch(GOOGLE_WEB_APP_URL);
            if (!response.ok) throw new Error("Cloud sync response failure.");
            const matrix = await response.json();
            
            if (matrix && matrix.length > 1) {
                const headers = matrix[0];
                this.runtime_db = matrix.slice(1).map(row => {
                    let record = {};
                    headers.forEach((header, index) => {
                        let value = row[index];
                        if (DYNAMIC_LINK_FIELDS.includes(header)) {
                            try { value = JSON.parse(value); } catch(e) { value = []; }
                        }
                        record[header] = value;
                    });
                    return record;
                });
                console.log("Database synchronized successfully from cloud registry.");
                if (this.currentView === 'history') this.renderHistory();
            }
        } catch (error) {
            console.error("Cloud synchronization channel offline.", error);
        }
    }

    switchView(viewName, targetId = null) {
        this.currentView = viewName;
        this.selectedPatientId = targetId;

        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        const activeNav = document.getElementById(`nav-${viewName}`);
        if (activeNav) activeNav.classList.add('active');

        document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
        
        if (viewName === 'home') {
            document.getElementById('view-home').classList.add('active');
        } else if (viewName === 'add') {
            this.prepareFormView(targetId);
            document.getElementById('view-add').classList.add('active');
        } else if (viewName === 'history') {
            this.renderHistory();
            document.getElementById('view-history').classList.add('active');
        } else if (viewName === 'details') {
            this.renderDetailsView(targetId);
            document.getElementById('view-details').classList.add('active');
        }
        window.scrollTo(0, 0);
    }

    prepareFormView(id = null) {
        const form = document.getElementById('patient-form');
        form.reset();
        
        DYNAMIC_LINK_FIELDS.forEach(field => {
            const container = document.getElementById(`wrapper-${field}`);
            if (container) {
                const label = container.querySelector('label');
                container.innerHTML = '';
                if (label) container.appendChild(label);
            }
        });

        if (!id) {
            document.getElementById('form-view-title').innerHTML = `<i class="fa-solid fa-file-medical"></i> New Patient Clinical Admission`;
            document.getElementById('field-id').value = '';
            DYNAMIC_LINK_FIELDS.forEach(field => this.appendDynamicLinkFieldRow(field, ''));
        } else {
            document.getElementById('form-view-title').innerHTML = `<i class="fa-solid fa-user-pen"></i> Edit Patient Medical Profile Record`;
            const record = this.runtime_db.find(r => r.id === id);
            if (!record) return;

            document.getElementById('field-id').value = record.id;
            document.getElementById('field-petName').value = record.petName || '';
            document.getElementById('field-ownerName').value = record.ownerName || '';
            document.getElementById('field-age').value = record.age || '';
            document.getElementById('field-weight').value = record.weight || '';
            document.getElementById('field-species').value = record.species || '';
            document.getElementById('field-breed').value = record.breed || '';
            document.getElementById('field-sex').value = record.sex || '';
            document.getElementById('field-neutered').value = record.neutered || '';
            document.getElementById('field-imageUrl').value = record.imageUrl || '';
            document.getElementById('field-about').value = record.about || '';
            document.getElementById('field-complain').value = record.complain || '';
            document.getElementById('field-symptoms').value = record.symptoms || '';
            document.getElementById('field-syndrome').value = record.syndrome || '';
            document.getElementById('field-diagnosis').value = record.diagnosis || '';
            document.getElementById('field-treatment').value = record.treatment || '';

            DYNAMIC_LINK_FIELDS.forEach(field => {
                const linksArray = record[field];
                if (Array.isArray(linksArray) && linksArray.length > 0) {
                    linksArray.forEach(url => this.appendDynamicLinkFieldRow(field, url));
                } else {
                    this.appendDynamicLinkFieldRow(field, '');
                }
            });
        }
    }

    appendDynamicLinkFieldRow(fieldId, value = '') {
        const wrapper = document.getElementById(`wrapper-${fieldId}`);
        if (!wrapper) return;
        const row = document.createElement('div');
        row.className = 'link-input-row';
        row.innerHTML = `
            <input type="url" placeholder="https://external-cloud-vault-storage/file_path" value="${value}" class="input-url-element">
            <button type="button" class="btn-row-action btn-remove-row" onclick="this.parentElement.remove()"><i class="fa-solid fa-trash-can"></i></button>
        `;
        wrapper.appendChild(row);

        if (!wrapper.querySelector('.btn-add-row')) {
            const addBtn = document.createElement('button');
            addBtn.type = 'button';
            addBtn.className = 'btn-row-action btn-add-row';
            addBtn.innerHTML = `<i class="fa-solid fa-plus"></i> Add Link`;
            addBtn.onclick = () => this.appendDynamicLinkFieldRow(fieldId, '');
            wrapper.appendChild(addBtn);
        } else {
            wrapper.appendChild(wrapper.querySelector('.btn-add-row'));
        }
    }

    async handleFormSubmit(event) {
        event.preventDefault();
        const idField = document.getElementById('field-id').value;

        const recordData = {
            id: idField || 'CLN-' + Math.floor(100000 + Math.random() * 900000),
            petName: document.getElementById('field-petName').value,
            ownerName: document.getElementById('field-ownerName').value,
            age: document.getElementById('field-age').value,
            weight: document.getElementById('field-weight').value,
            species: document.getElementById('field-species').value,
            breed: document.getElementById('field-breed').value,
            sex: document.getElementById('field-sex').value,
            neutered: document.getElementById('field-neutered').value,
            imageUrl: document.getElementById('field-imageUrl').value,
            about: document.getElementById('field-about').value,
            complain: document.getElementById('field-complain').value,
            symptoms: document.getElementById('field-symptoms').value,
            syndrome: document.getElementById('field-syndrome').value,
            diagnosis: document.getElementById('field-diagnosis').value,
            treatment: document.getElementById('field-treatment').value,
        };

        DYNAMIC_LINK_FIELDS.forEach(field => {
            const container = document.getElementById(`wrapper-${field}`);
            const inputs = container ? container.querySelectorAll('.input-url-element') : [];
            const values = [];
            inputs.forEach(input => {
                if (input.value.trim() !== '') values.push(input.value.trim());
            });
            recordData[field] = values;
        });

        try {
            const response = await fetch(GOOGLE_WEB_APP_URL, {
                method: "POST",
                mode: "no-cors",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "SAVE", data: recordData })
            });

            const idx = this.runtime_db.findIndex(r => r.id === recordData.id);
            if (idx !== -1) this.runtime_db[idx] = recordData;
            else this.runtime_db.unshift(recordData);

            alert("Clinical record synchronized cleanly with Google Sheets database cloud.");
            this.switchView('history');
        } catch (error) {
            alert("Error trying to commit data pipeline record modifications to cloud endpoint.");
            console.error(error);
        }
    }

    /**
     * Converts application memory database layers directly into native .xlsx files using SheetJS
     */
    exportDatabaseToXLSX() {
        if (!this.runtime_db || this.runtime_db.length === 0) {
            alert("Export cancelled. The active runtime database record index is empty.");
            return;
        }

        const runCompilationPipeline = () => {
            const headersOrder = [
                'id', 'petName', 'ownerName', 'age', 'weight', 'species', 'breed', 'sex', 'neutered',
                'imageUrl', 'about', 'complain', 'symptoms', 'syndrome', 'diagnosis', 'treatment',
                'xray', 'ct', 'mri', 'fluoroscopy', 'ultrasound', 'echography',
                'cbc', 'biochemistry', 'urinalysis', 'cytology', 'otherLab',
                'pdf', 'word', 'excel', 'externalFiles'
            ];

            // Normalize structured javascript fields into predictable matrix cells
            const sheetRows = this.runtime_db.map(record => {
                let rowData = {};
                headersOrder.forEach(header => {
                    let value = record[header];
                    if (value === undefined || value === null) {
                        value = '';
                    } else if (Array.isArray(value)) {
                        value = value.join('; '); // Flatten document link collection arrays nicely using semi-colons
                    }
                    rowData[header] = value;
                });
                return rowData;
            });

            const worksheet = XLSX.utils.json_to_sheet(sheetRows, { header: headersOrder });
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Clinical Registry Data");

            const dateStamp = new Date().toISOString().slice(0, 10);
            XLSX.writeFile(workbook, `clinico_export_${dateStamp}.xlsx`);
        };

        // Fallback injector checking if SheetJS exists; dynamically pulls from verified CDN channel if missing
        if (typeof XLSX === 'undefined') {
            const scriptNode = document.createElement('script');
            scriptNode.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
            scriptNode.onload = runCompilationPipeline;
            document.head.appendChild(scriptNode);
        } else {
            runCompilationPipeline();
        }
    }

    /**
     * Compiles and prints textual and multi-media photo layers into a single clean PDF report
     */
    exportPatientToPDF(id) {
        const rec = this.runtime_db.find(r => r.id === id);
        if (!rec) {
            alert("Error locating requested patient record execution track.");
            return;
        }

        const runPdfPipeline = async () => {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
            
            // --- PAGE 1: TEXT DATA COMPILATION ---
            doc.setFillColor(13, 148, 136); // Clinico Primary Teal Theme Accent
            doc.rect(0, 0, 210, 35, 'F');
            
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(22);
            doc.text("CLINICO MEDICAL CASE PROFILE", 15, 18);
            
            doc.setFontSize(11);
            doc.setFont('helvetica', 'normal');
            doc.text(`Patient ID Reference: ${rec.id || 'N/A'}`, 15, 26);
            doc.text(`Report Generation Date: ${new Date().toLocaleDateString()}`, 140, 26);

            doc.setTextColor(40, 40, 40);
            let yCursor = 48;

            const printSectionHeader = (title) => {
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(13);
                doc.setTextColor(13, 148, 136);
                doc.text(title.toUpperCase(), 15, yCursor);
                yCursor += 4;
                doc.setDrawColor(200, 200, 200);
                doc.line(15, yCursor, 195, yCursor);
                yCursor += 6;
                doc.setTextColor(60, 60, 60);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(10);
            };

            // 1. Biometrics Panel
            printSectionHeader("1. Patient Details");
            doc.text(`Pet Name: ${rec.petName || 'N/A'}`, 15, yCursor);
            doc.text(`Species: ${rec.species || 'N/A'}`, 75, yCursor);
            doc.text(`Breed: ${rec.breed || 'Unclassified'}`, 140, yCursor);
            yCursor += 6;
            doc.text(`Age: ${rec.age || 'N/A'} Yrs`, 15, yCursor);
            doc.text(`Mass: ${rec.weight || 'N/A'} Kg`, 75, yCursor);
            doc.text(`Sex: ${rec.sex || 'N/A'}`, 140, yCursor);
            yCursor += 6;     
            doc.text(`Neutered: ${rec.neutered || 'N/A'}`, 15, yCursor);
            doc.text(`Agent/Owner: ${rec.ownerName || 'N/A'}`, 75, yCursor);
            yCursor += 12;

            // 2. Clinical Findings & Assessment Summary
            printSectionHeader("2. Medical Assessment Summary");
            const assessmentText = doc.splitTextToSize(`${rec.about || 'None documented.'}`, 180);
            doc.text(assessmentText, 15, yCursor);
            yCursor += (assessmentText.length * 5) + 4;

            doc.setFont('helvetica', 'bold');
            doc.text(`Complaint: ${rec.complain || 'None.'}`, 15, yCursor);
            yCursor += 6;
            doc.text(`Symptoms: ${rec.symptoms || 'None.'}`, 15, yCursor);
            yCursor += 6;
            doc.text(`Syndromes: ${rec.syndrome || 'None.'}`, 15, yCursor);
            yCursor += 6;
            
            
            doc.text(`Diagnosis: ${rec.diagnosis || 'Pending deployment.'}`, 15, yCursor);
            yCursor += 12;

            // 3. Treatment
            printSectionHeader("3. Therapeutic / Treatment Protocol");
            doc.setFont('helvetica', 'normal');
            const treatmentText = doc.splitTextToSize(rec.treatment || 'No proactive execution treatment tracks configured at this juncture.', 180);
            doc.text(treatmentText, 15, yCursor);
            yCursor += (treatmentText.length * 5) + 12;

            // 4. Asset Links Reference List
            if (yCursor < 260) {
                printSectionHeader("4. Medical File Attachments");
    
                let allLinks = [];
                DYNAMIC_LINK_FIELDS.forEach(field => {
                    if (Array.isArray(rec[field]) && rec[field].length > 0) {
                        rec[field].forEach(link => {
                            allLinks.push({ field: field.toUpperCase(), url: link });
                        });
                    }
                });

                if (allLinks.length === 0) {
                    doc.text("No files attachements are registered to this patient.", 15, yCursor);
                    yCursor += 10;
                } else {
                    const xPositions = [15, 75, 140];
                    const qrSize = 30; 
                    yCursor += 5; 

                    for (let i = 0; i < allLinks.length; i++) {
                        const item = allLinks[i];
                        const colIndex = i % 3;
                        const currentX = xPositions[colIndex];

                        if (colIndex === 0 && yCursor > 230) {
                            doc.addPage();
                            yCursor = 20; 
                        }

                        // Print the label
                        doc.text(`${item.field}:`, currentX, yCursor);

                        try {
                            // 1. Initialize synchronous QR code generator
                            // Type 0 auto-detects size; 'M' is standard error correction
                            var qr = qrcode(0, 'M');
                            qr.addData(item.url);
                            qr.make();
                            
                            // 2. Generate the base64 image data string directly
                            var qrCodeDataUrl = qr.createDataURL(4); 
                            
                            // 3. Draw the square QR code on the PDF
                            doc.addImage(qrCodeDataUrl, 'GIF', currentX, yCursor + 5, qrSize, qrSize);

                        } catch (err) {
                            // If it STILL errors, print the actual reason to your browser console to see it
                            console.error("QR Code Error details:", err);
                            doc.text("Link Error", currentX, yCursor + 15);
                        }

                        if (colIndex === 2 || i === allLinks.length - 1) {
                            yCursor += 60; 
                        }
                    }
                }
            }

            // --- PAGES 2+: SINGLE IMAGE PER PAGE ARCHITECTURE INTERCEPTOR ---
            // const collectImages = [];
            // if (rec.imageUrl && !rec.imageUrl.startsWith("data:image/svg+xml")) {
            //     collectImages.push({ title: "Primary Patient Avatar Profile Photo", src: rec.imageUrl });
            // }
            // DYNAMIC_LINK_FIELDS.forEach(field => {
            //     if (Array.isArray(rec[field])) {
            //         rec[field].forEach((url, index) => {
            //             const lowUrl = url.toLowerCase();
            //             if (lowUrl.includes('.jpg') || lowUrl.includes('.jpeg') || lowUrl.includes('.png') || lowUrl.includes('.webp') || url.startsWith('data:image/')) {
            //                 collectImages.push({ title: `${field.toUpperCase()} Diagnostics Scan Asset #${index + 1}`, src: url });
            //             }
            //         });
            //     }
            // });

            // Helper function to render image to canvas bypassing basic format crashes
            const fitImageOnPage = (imgDataUrl, assetTitle) => {
                doc.addPage();
                // Banner header on dynamic media sheets
                doc.setFillColor(240, 245, 245);
                doc.rect(0, 0, 210, 20, 'F');
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(10);
                doc.setTextColor(13, 148, 136);
                doc.text(`Patient Asset Layer: ${assetTitle}`, 15, 13);
                
                try {
                    // Injecting image with fallback box scale limits
                    doc.addImage(imgDataUrl, 'JPEG', 15, 30, 180, 240, undefined, 'FAST');
                } catch (e) {
                    doc.setDrawColor(220, 100, 100);
                    doc.rect(15, 30, 180, 100);
                    doc.setTextColor(200, 50, 50);
                    doc.text("Failed to securely render multi-media asset directly inside the native PDF container.", 20, 50);
                    doc.setFont('helvetica', 'normal');
                    doc.text(`Verify external path configurations manually: ${imgDataUrl.substring(0, 65)}...`, 20, 60);
                }
            };

            // Process image pipeline sequentially
            for (const item of collectImages) {
                if (item.src.startsWith('data:image/')) {
                    fitImageOnPage(item.src, item.title);
                } else {
                    // Try parsing cross-origin safe imagery objects natively
                    await new Promise((resolve) => {
                        const imgEl = new Image();
                        imgEl.crossOrigin = "Anonymous";
                        imgEl.onload = function() {
                            const canvas = document.createElement("canvas");
                            canvas.width = this.width;
                            canvas.height = this.height;
                            const ctx = canvas.getContext("2d");
                            ctx.drawImage(this, 0, 0);
                            try {
                                const dataUrl = canvas.toDataURL("image/jpeg");
                                fitImageOnPage(dataUrl, item.title);
                            } catch (err) {
                                console.warn("Canvas conversion interrupted by security architecture bounds.");
                            }
                            resolve();
                        };
                        imgEl.onerror = () => { resolve(); }; // Continue loop safety trace execution
                        imgEl.src = item.src;
                    });
                }
            }

            doc.save(`clinico_report_${rec.id || 'export'}.pdf`);
        };

        if (typeof window.jspdf === 'undefined') {
            const scriptNode = document.createElement('script');
            scriptNode.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
            scriptNode.onload = runPdfPipeline;
            document.head.appendChild(scriptNode);
        } else {
            runPdfPipeline();
        }
    }

    renderHistory() {
        const grid = document.getElementById('history-grid');
        if (!grid) return;
        grid.innerHTML = '';

        const searchQuery = document.getElementById('search-input').value.toLowerCase().trim();
        const speciesFilter = document.getElementById('filter-species-select').value;

        const filtered = this.runtime_db.filter(rec => {
            const matchesSearch = rec.petName.toLowerCase().includes(searchQuery) || 
                                  rec.id.toLowerCase().includes(searchQuery) ||
                                  (rec.ownerName && rec.ownerName.toLowerCase().includes(searchQuery));
            const matchesSpecies = (speciesFilter === 'ALL') || (rec.species === speciesFilter);
            return matchesSearch && matchesSpecies;
        });

        if (filtered.length === 0) {
            grid.innerHTML = `
                <div class="no-records-fallback">
                    <i class="fa-solid fa-folder-open"></i>
                    <p>No active case sheets fall under specified clinical lookup arguments.</p>
                </div>`;
            return;
        }

        filtered.forEach(rec => {
            const imgTarget = rec.imageUrl ? rec.imageUrl : PLACEHOLDER_PET_IMAGE;
            const card = document.createElement('div');
            card.className = 'patient-horizontal-card';
            card.onclick = () => this.switchView('details', rec.id);
            
            card.innerHTML = `
                <div class="card-thumbnail-container">
                    <img src="${imgTarget}" onerror="this.src='${PLACEHOLDER_PET_IMAGE}'" alt="Patient Thumbnail">
                </div>
                <div class="card-body-content">
                    <div class="card-meta-top">
                        <div class="card-title-block">
                            <h3>${rec.petName}</h3>
                            <div class="card-taxonomic-badges">
                                <span class="badge-species">${rec.species}</span>
                                ${rec.breed ? `<span class="badge-breed">${rec.breed}</span>` : ''}
                            </div>
                        </div>
                        <span class="card-id-badge">${rec.id}</span>
                    </div>
                    <p class="card-preview-text"><strong>Summary:</strong> ${rec.about}</p>
                    <div class="card-meta-bottom">
                        <span><i class="fa-solid fa-weight-hanging"></i> Mass(Kg): <strong>${rec.weight}</strong></span>
                        <span><i class="fa-solid fa-cake-candles"></i> Age(year): <strong>${rec.age}</strong></span>
                        <span><i class="fa-solid fa-user"></i> Agent: <strong>${rec.ownerName || 'N/A'}</strong></span>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });
    }

    renderDetailsView(id) {
        const target = document.getElementById('details-view-target');
        const rec = this.runtime_db.find(r => r.id === id);

        if (!rec) {
            target.innerHTML = `<div class="no-records-fallback"><p>Requested patient file path cannot be extracted.</p></div>`;
            return;
        }

        const profileImg = rec.imageUrl ? rec.imageUrl : PLACEHOLDER_PET_IMAGE;

        const buildHyperlinkNodes = (linkArray) => {
            if (!Array.isArray(linkArray) || linkArray.length === 0) {
                return `<span class="empty-link-txt">No recorded asset telemetry logs mapped.</span>`;
            }
            return linkArray.map((url, index) => `
                <a href="${url}" target="_blank" class="clinical-hyperlink">
                    <i class="fa-solid fa-arrow-up-right-from-square"></i> Record Link #${index + 1}
                </a>
            `).join('');
        };

        target.innerHTML = `
            <div class="profile-action-header">
                <button class="btn btn-secondary" onclick="app.switchView('history')"><i class="fa-solid fa-chevron-left"></i> Return to Registry</button>
                <div class="profile-action-cluster">
                    <button class="btn btn-success" onclick="app.exportPatientToPDF('${rec.id}')" style="background-color: var(--secondary, #0d9488); color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600;"><i class="fa-solid fa-file-pdf"></i> Export</button>
                    <button class="btn btn-primary" onclick="app.requestSecurityAccess('EDIT', '${rec.id}')"><i class="fa-solid fa-user-gear"></i> Unlock & Edit</button>
                    <button class="btn btn-danger" onclick="app.requestSecurityAccess('DELETE', '${rec.id}')"><i class="fa-solid fa-trash-can"></i> Terminate Case</button>
                </div>
            </div>

            <div class="profile-master-grid">
                <div class="profile-sidebar-panel">
                    <div class="profile-avatar-card">
                        <div class="profile-avatar-wrapper">
                            <img src="${profileImg}" onerror="this.src='${PLACEHOLDER_PET_IMAGE}'" alt="Patient Profile">
                        </div>
                        <div class="profile-identity-block">
                            <h2>${rec.petName}</h2>
                            <span class="system-id">${rec.id}</span>
                        </div>
                    </div>

                    <div class="vitals-list-panel">
                        <h4><i class="fa-solid fa-fingerprint"></i> Biometric Profile</h4>
                        <div class="vital-row"><span class="vital-label">Type:</span><span class="vital-value">${rec.species}</span></div>
                        <div class="vital-row"><span class="vital-label">Breed:</span><span class="vital-value">${rec.breed || 'Unclassified'}</span></div>
                        <div class="vital-row"><span class="vital-label">Age(year):</span><span class="vital-value">${rec.age}</span></div>
                        <div class="vital-row"><span class="vital-label">Mass(Kg)(Kg):</span><span class="vital-value">${rec.weight}</span></div>
                        <div class="vital-row"><span class="vital-label">Sex:</span><span class="vital-value">${rec.sex}</span></div>
                        <div class="vital-row"><span class="vital-label">Neutered Status:</span><span class="vital-value">${rec.neutered}</span></div>
                        <div class="vital-row"><span class="vital-label">Owner/Agent:</span><span class="vital-value">${rec.ownerName || 'N/A'}</span></div>
                    </div>
                </div>

                <div class="profile-main-report">
                    <div class="clinical-block-card">
                        <h3><i class="fa-solid fa-clipboard-list"></i> Clinical Assessment History</h3>
                        <p class="narrative-p"><strong>Assessment:</strong>\n${rec.about}</p>
                    </div>

                    <div class="clinical-block-card">
                        <h3><i class="fa-solid fa-stethoscope"></i> Symptom Profile & Diagnosis</h3>
                        <div class="clinical-subgrid">
                            <div class="subgrid-cell"><h4>Complaint</h4><p>${rec.complain || 'None documented.'}</p></div>
                            <div class="subgrid-cell"><h4>Symptoms</h4><p>${rec.symptoms || 'None recorded.'}</p></div>
                            <div class="subgrid-cell"><h4>Syndrome</h4><p>${rec.syndrome || 'None isolated.'}</p></div>
                            <div class="subgrid-cell"><h4>Diagnosis</h4><p style="color: var(--secondary); font-weight: 600;">${rec.diagnosis || 'Pending configuration.'}</p></div>
                        </div>
                    </div>

                    <div class="clinical-block-card">
                        <h3><i class="fa-solid fa-kit-medical"></i>Therapeutic / Treatment Protocols</h3>
                        <p class="narrative-p" style="border-left-color: var(--accent);">${rec.treatment || 'No clinical intervention tracks configured at this juncture.'}</p>
                    </div>

                    <div class="clinical-block-card">
                        <h3><i class="fa-solid fa-folder-tree"></i> Cloud Diagnostics Data</h3>
                        <div class="asset-link-matrix">
                            <div class="asset-card-node"><h4>X-Ray</h4><div class="asset-hyperlinks-list">${buildHyperlinkNodes(rec.xray)}</div></div>
                            <div class="asset-card-node"><h4>Computed Tomography (CT)</h4><div class="asset-hyperlinks-list">${buildHyperlinkNodes(rec.ct)}</div></div>
                            <div class="asset-card-node"><h4>Magnetic Resonance Imaging (MRI)</h4><div class="asset-hyperlinks-list">${buildHyperlinkNodes(rec.mri)}</div></div>
                            <div class="asset-card-node"><h4>Fluoroscopy Stream Array</h4><div class="asset-hyperlinks-list">${buildHyperlinkNodes(rec.fluoroscopy)}</div></div>
                            <div class="asset-card-node"><h4>Sonar Ultrasound Nodes</h4><div class="asset-hyperlinks-list">${buildHyperlinkNodes(rec.ultrasound)}</div></div>
                            <div class="asset-card-node"><h4>Echography Maps</h4><div class="asset-hyperlinks-list">${buildHyperlinkNodes(rec.echography)}</div></div>
                        </div>
                    </div>

                    <div class="clinical-block-card">
                        <h3><i class="fa-solid fa-microscope"></i> Pathology Laboratory Manifests</h3>
                        <div class="asset-link-matrix">
                            <div class="asset-card-node"><h4>CBC</h4><div class="asset-hyperlinks-list">${buildHyperlinkNodes(rec.cbc)}</div></div>
                            <div class="asset-card-node"><h4>Biochemistry</h4><div class="asset-hyperlinks-list">${buildHyperlinkNodes(rec.biochemistry)}</div></div>
                            <div class="asset-card-node"><h4>Urinalysis</h4><div class="asset-hyperlinks-list">${buildHyperlinkNodes(rec.urinalysis)}</div></div>
                            <div class="asset-card-node"><h4>Cytology</h4><div class="asset-hyperlinks-list">${buildHyperlinkNodes(rec.cytology)}</div></div>
                        </div>
                        <div class="asset-card-node" style="margin-top: 16px;">
                            <h4><i class="fa-solid fa-vial"></i> Alternative Specialized Labs</h4>
                            <div class="asset-hyperlinks-list">${buildHyperlinkNodes(rec.otherLab)}</div>
                        </div>
                    </div>

                    <div class="clinical-block-card">
                        <h3><i class="fa-solid fa-paperclip"></i> Documentation & Structured Attachments</h3>
                        <div class="asset-link-matrix">
                            <div class="asset-card-node"><h4>PDF Clinical Files</h4><div class="asset-hyperlinks-list">${buildHyperlinkNodes(rec.pdf)}</div></div>
                            <div class="asset-card-node"><h4>Word Files (.docx)</h4><div class="asset-hyperlinks-list">${buildHyperlinkNodes(rec.word)}</div></div>
                            <div class="asset-card-node"><h4>Excel Sheets (.xlsx)</h4><div class="asset-hyperlinks-list">${buildHyperlinkNodes(rec.excel)}</div></div>
                            <div class="asset-card-node"><h4>External Files</h4><div class="asset-hyperlinks-list">${buildHyperlinkNodes(rec.externalFiles)}</div></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    requestSecurityAccess(mode, id) {
        const modal = document.getElementById('security-modal');
        const passInput = document.getElementById('security-password-input');
        const errorMsg = document.getElementById('security-error');
        const promptTxt = document.getElementById('security-prompt-text');
        const confirmBtn = document.getElementById('security-confirm-btn');

        passInput.value = '';
        errorMsg.style.display = 'none';
        
        if (mode === 'EDIT') {
            promptTxt.innerText = "You are attempting to modify an active clinical case record. Enter auth key:";
        } else if (mode === 'DELETE') {
            promptTxt.innerText = "WARNING: Critical destructive deletion track initialized. Provide authorization credentials to execute:";
        }

        modal.classList.add('active');
        passInput.focus();

        confirmBtn.onclick = async () => {
            if (passInput.value === SECURITY_KEY) {
                modal.classList.remove('active');
                if (mode === 'EDIT') {
                    this.switchView('add', id);
                } else if (mode === 'DELETE') {
                    if (confirm("Confirm permanently purging this patient case record from the cloud spreadsheet?")) {
                        try {
                            await fetch(GOOGLE_WEB_APP_URL, {
                                method: "POST",
                                mode: "no-cors",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ action: "DELETE", id: id })
                            });
                            this.runtime_db = this.runtime_db.filter(r => r.id !== id);
                            alert("Case sheet deleted successfully.");
                            this.switchView('history');
                        } catch (err) {
                            alert("Failed to sync structural delete operation with cloud registry.");
                        }
                    }
                }
            } else {
                errorMsg.style.display = 'block';
                passInput.select();
            }
        };
    }

    closeSecurityModal() {
        document.getElementById('security-modal').classList.remove('active');
    }
}

const app = new ClinicoApp();

document.addEventListener('DOMContentLoaded', () => {
    const navToggleBtn = document.getElementById('navToggleBtn');
    const navButtonsMenu = document.getElementById('navButtonsMenu');

    if (navToggleBtn && navButtonsMenu) {
        navToggleBtn.addEventListener('click', () => {
            navButtonsMenu.classList.toggle('active');
            const icon = navToggleBtn.querySelector('i');
            if (icon) {
                icon.className = navButtonsMenu.classList.contains('active') ? 'fas fa-times' : 'fas fa-bars';
            }
        });
    }
});
