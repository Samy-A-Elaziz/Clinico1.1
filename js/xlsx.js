/**
 * Clinico Structured RFC-4180 Compliant xlsx Engine
 * Manages bidirectional translation between internal state arrays and flat tabular xlsx strings.
 */
const xlsxEngine = {
    
    /**
     * Converts a flat array of key-value client records into an RFC-4180 compliant xlsx string.
     * Handles complex string serialization, quotation masking, and structured object nesting.
     * @param {Array<Object>} records - Raw application patient arrays
     * @returns {string} Fully structured output xlsx string
     */
    stringify: function(records) {
        if (records.length === 0) return '';
        
        const headers = [
            'id', 'petName', 'ownerName', 'age', 'weight', 'species', 'breed', 'sex', 'neutered',
            'imageUrl', 'about', 'complain', 'symptoms', 'syndrome', 'diagnosis', 'treatment',
            'xray', 'ct', 'mri', 'fluoroscopy', 'ultrasound', 'echography',
            'cbc', 'biochemistry', 'urinalysis', 'cytology', 'otherLab',
            'pdf', 'word', 'excel', 'externalFiles'
        ];

        let xlsxLines = [];
        xlsxLines.push(headers.join(','));

        records.forEach(rec => {
            let lineValues = headers.map(header => {
                let value = rec[header] || '';
                
                if (Array.isArray(value)) {
                    value = value.filter(str => str.trim() !== '').join(';');
                }
                
                let cleanStr = String(value).replace(/"/g, '""');
                if (cleanStr.includes(',') || cleanStr.includes('"') || cleanStr.includes('\n') || cleanStr.includes(';')) {
                    cleanStr = `"${cleanStr}"`;
                }
                return cleanStr;
            });
            xlsxLines.push(lineValues.join(','));
        });

        return xlsxLines.join('\n');
    },

    /**
     * Parses standard compliant tabular xlsx strings into nested JavaScript data objects.
     * @param {string} xlsxText - Input tabular database stream content
     * @returns {Array<Object>} Extracted and structured patient record objects
     */
    parse: function(xlsxText) {
        const records = [];
        if (!xlsxText || xlsxText.trim() === '') return records;

        let lines = [];
        let row = [''];
        let inQuotes = false;

        for (let i = 0; i < xlsxText.length; i++) {
            let c = xlsxText[i];
            let next = xlsxText[i+1];

            if (c === '"') {
                if (inQuotes && next === '"') { 
                    row[row.length - 1] += '"'; 
                    i++; 
                } else { 
                    inQuotes = !inQuotes; 
                }
            } else if (c === ',' && !inQuotes) {
                row.push('');
            } else if ((c === '\r' || c === '\n') && !inQuotes) {
                if (c === '\r' && next === '\n') { i++; }
                lines.push(row);
                row = [''];
            } else {
                row[row.length - 1] += c;
            }
        }
        if (row.length > 1 || row[0] !== '') {
            lines.push(row);
        }

        if (lines.length < 2) return records;
        
        const headers = lines[0].map(h => h.trim());
        
        const arrayFields = [
            'xray', 'ct', 'mri', 'fluoroscopy', 'ultrasound', 'echography',
            'cbc', 'biochemistry', 'urinalysis', 'cytology', 'otherLab',
            'pdf', 'word', 'excel', 'externalFiles'
        ];

        for (let j = 1; j < lines.length; j++) {
            let values = lines[j];
            if (values.length !== headers.length) continue; 

            let patientObj = {};
            headers.forEach((header, idx) => {
                let rawVal = values[idx] || '';
                
                if (arrayFields.includes(header)) {
                    patientObj[header] = rawVal ? rawVal.split(';').map(u => u.trim()).filter(u => u !== '') : [];
                } else {
                    patientObj[header] = rawVal;
                }
            });

            if (patientObj.id && patientObj.petName) {
                records.push(patientObj);
            }
        }

        return records;
    },

    /**
     * Handover bypass channel redirecting execution down into the application workbook engine.
     */
    exportToxlsx: function() {
        // Fallback interface compatibility layer link
        if (app && typeof app.exportDatabaseToXLSX === 'function') {
            app.exportDatabaseToXLSX();
        } else {
            console.warn("Spreadsheet pipeline redirection failed. Core exporter script components are inaccessible.");
        }
    }
};
