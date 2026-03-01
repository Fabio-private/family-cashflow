const XLSX = require('xlsx');

const workbook = XLSX.readFile('lista_operazioni_31012026.xlsx');
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

console.log('=== ANALISI FILE EXCEL FIDEURAM ===\n');

// Converti in JSON senza header per vedere tutto
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: null });

console.log('Totale righe:', data.length);
console.log('\n=== TUTTE LE RIGHE CON CONTENUTO ===\n');

data.forEach((row, idx) => {
    // Mostra solo righe con almeno un valore non nullo
    if (row.some(cell => cell !== null && cell !== '')) {
        console.log(`\n--- Riga ${idx + 1} ---`);
        row.forEach((cell, colIdx) => {
            if (cell !== null && cell !== '') {
                console.log(`  Col ${colIdx}: "${cell}"`);
            }
        });
    }
});
