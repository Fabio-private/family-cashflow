const XLSX = require('xlsx');

const workbook = XLSX.readFile('lista_operazioni_31012026.xlsx');
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

console.log('=== STRUTTURA FILE EXCEL ===');
console.log('Sheet Name:', sheetName);
console.log('\nRange:', worksheet['!ref']);
console.log('\nPrime celle (raw):');

// Mostra le prime 10 righe e 10 colonne
for (let row = 1; row <= 10; row++) {
    let rowData = [];
    for (let col = 0; col < 10; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row - 1, c: col });
        const cell = worksheet[cellAddress];
        rowData.push(cell ? cell.v : null);
    }
    if (rowData.some(v => v !== null && v !== '')) {
        console.log(`Riga ${row}:`, rowData);
    }
}

// Converti in JSON senza header per vedere tutto
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: null });
console.log('\n=== TUTTE LE RIGHE NON VUOTE ===');
data.forEach((row, idx) => {
    if (row.some(cell => cell !== null && cell !== '')) {
        console.log(`Riga ${idx + 1}:`, row);
    }
});
