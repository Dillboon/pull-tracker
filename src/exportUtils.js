import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import ExcelJS from 'exceljs';

// ─── Sort by IDF alphabetically, then numerically by cable ID ────────────────
const sortedDrops = (drops) => [...drops].sort((a, b) => {
  const idfA = (a.idf || '').toLowerCase();
  const idfB = (b.idf || '').toLowerCase();
  if (idfA < idfB) return -1;
  if (idfA > idfB) return 1;
  return (parseInt(a.cableA) || 0) - (parseInt(b.cableA) || 0);
});

// ─── PDF Export ──────────────────────────────────────────────────────────────
export async function exportPDF(drops, projectName = '') {
  const sorted = sortedDrops(drops);
  const rp = sorted.filter(d => d.roughPull).length;
  const tm = sorted.filter(d => d.terminated).length;
  const ts = sorted.filter(d => d.tested).length;

  const rows = sorted.map((d, i) => {
    const bg = i % 2 === 0 ? '#f8fafc' : '#ffffff';
    const cable = d.isDouble ? `${d.cableA || '—'} / ${d.cableB || '—'}` : (d.cableA || '—');
    const tick = (v) => v
      ? `<span style="color:#16a34a;font-weight:700;">✓</span>`
      : `<span style="color:#dc2626;">✗</span>`;
    return `
      <tr style="background:${bg}">
        <td>${d.idf || '—'}</td>
        <td>${d.isDouble ? '<b style="color:#7c3aed;">Double</b>' : 'Single'}</td>
        <td>${cable}</td>
        <td style="text-align:center">${tick(d.roughPull)}</td>
        <td style="text-align:center">${tick(d.terminated)}</td>
        <td style="text-align:center">${tick(d.tested)}</td>
        <td style="color:#555;font-size:11px">${d.notes || ''}</td>
        <td style="color:#888;font-size:11px">${d.createdAt}</td>
      </tr>`;
  }).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8"/>
      <style>
        body { font-family: -apple-system, Arial, sans-serif; margin: 0; padding: 24px; background: #fff; color: #111; }
        .topbar { background: #0f172a; color: #fbbf24; padding: 14px 18px; border-radius: 8px; margin-bottom: 6px; }
        .topbar h1 { margin: 0; font-size: 20px; }
        .topbar .project { font-size: 13px; color: #94a3b8; margin-top: 3px; }
        .meta { font-size: 11px; color: #64748b; margin-bottom: 10px; }
        .summary { display: flex; gap: 24px; background: #f1f5f9; padding: 12px 16px; border-radius: 8px; margin-bottom: 20px; font-size: 13px; }
        .stat { display: flex; flex-direction: column; }
        .stat b { font-size: 20px; color: #0f172a; }
        .stat span { color: #64748b; font-size: 11px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        thead tr { background: #0f172a; color: #fbbf24; }
        thead th { padding: 9px 8px; text-align: left; font-size: 11px; letter-spacing: 0.05em; text-transform: uppercase; }
        tbody td { padding: 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
        .footer { margin-top: 20px; font-size: 11px; color: #94a3b8; text-align: center; }
      </style>
    </head>
    <body>
      <div class="topbar">
        <h1>CablePull Field Tracker</h1>
        ${projectName ? `<div class="project">Project: ${projectName}</div>` : ''}
      </div>
      <div class="meta">Generated: ${new Date().toLocaleString()}</div>
      <div class="summary">
        <div class="stat"><b>${sorted.length}</b><span>Total Drops</span></div>
        <div class="stat"><b style="color:#d97706">${rp}/${sorted.length}</b><span>Rough Pulled</span></div>
        <div class="stat"><b style="color:#2563eb">${tm}/${sorted.length}</b><span>Terminated</span></div>
        <div class="stat"><b style="color:#16a34a">${ts}/${sorted.length}</b><span>Tested</span></div>
      </div>
      <table>
        <thead>
          <tr>
            <th>IDF</th><th>Type</th><th>Cable ID(s)</th>
            <th>Rough Pull</th><th>Terminated</th><th>Tested</th>
            <th>Notes</th><th>Date</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="footer">CablePull Tracker${projectName ? ` · ${projectName}` : ''} · ${sorted.length} total drops</div>
    </body>
    </html>`;

  const { uri } = await Print.printToFileAsync({ html, base64: false });
  await Sharing.shareAsync(uri, {
    UTI: '.pdf',
    mimeType: 'application/pdf',
    dialogTitle: `Share ${projectName || 'Cable Pull'} Report (PDF)`,
  });
}

// ─── Excel Export with full ExcelJS styling ───────────────────────────────────
export async function exportXLSX(drops, projectName = '') {
  const sorted = sortedDrops(drops);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'CablePull Tracker';
  wb.created = new Date();

  // ── Style constants ───────────────────────────────────────────────────────
  const headerFill    = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F2744' } };
  const evenFill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
  const oddFill       = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F4FA' } };
  const doubleFill    = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3EEFF' } };
  const doubleOddFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE9E0FF' } };

  const headerFont  = { bold: true, color: { argb: 'FFFBBF24' }, size: 10, name: 'Calibri' };
  const bodyFont    = { size: 10, name: 'Calibri' };
  const monoFont    = { size: 10, name: 'Courier New' };
  const dimFont     = { size: 9,  name: 'Calibri', color: { argb: 'FF64748B' } };
  const yesFont     = { bold: true, color: { argb: 'FF16A34A' }, size: 10, name: 'Calibri' };
  const noFont      = { bold: true, color: { argb: 'FFDC2626' }, size: 10, name: 'Calibri' };
  const doubleFont  = { bold: true, color: { argb: 'FF7C3AED' }, size: 10, name: 'Calibri' };
  const idfFont     = { bold: true, color: { argb: 'FF1E40AF' }, size: 10, name: 'Calibri' };

  const thinBorder = {
    top:    { style: 'thin', color: { argb: 'FFE2E8F0' } },
    left:   { style: 'thin', color: { argb: 'FFE2E8F0' } },
    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    right:  { style: 'thin', color: { argb: 'FFE2E8F0' } },
  };

  const centerAlign = { horizontal: 'center', vertical: 'middle' };
  const leftAlign   = { horizontal: 'left',   vertical: 'middle' };

  // ── Cable Drops sheet ─────────────────────────────────────────────────────
  const ws = wb.addWorksheet('Cable Drops', {
    views: [{ state: 'frozen', ySplit: 3 }],
  });

  // Column order: IDF | Type | Cable ID(s) | Rough Pull | Terminated | Tested | Notes | Date
  ws.columns = [
    { key: 'idf',        width: 12 },
    { key: 'type',       width: 10 },
    { key: 'cable',      width: 20 },
    { key: 'roughPull',  width: 13 },
    { key: 'terminated', width: 13 },
    { key: 'tested',     width: 10 },
    { key: 'notes',      width: 40 },
    { key: 'date',       width: 13 },
  ];

  // Title row
  ws.mergeCells('A1:H1');
  const titleCell     = ws.getCell('A1');
  titleCell.value     = `CablePull Field Tracker${projectName ? `  —  ${projectName}` : ''}`;
  titleCell.font      = { bold: true, size: 13, color: { argb: 'FFFFFFFF' }, name: 'Calibri' };
  titleCell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A1628' } };
  titleCell.alignment = leftAlign;
  ws.getRow(1).height = 26;

  // Subtitle row
  ws.mergeCells('A2:H2');
  const subCell     = ws.getCell('A2');
  subCell.value     = `Generated: ${new Date().toLocaleString()}  |  Total: ${sorted.length}  |  Rough pulled: ${sorted.filter(d=>d.roughPull).length}  |  Terminated: ${sorted.filter(d=>d.terminated).length}  |  Tested: ${sorted.filter(d=>d.tested).length}`;
  subCell.font      = { size: 9, color: { argb: 'FF94A3B8' }, name: 'Calibri' };
  subCell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  subCell.alignment = leftAlign;
  ws.getRow(2).height = 18;

  // Header row
  const headers   = ['IDF', 'Type', 'Cable ID(s)', 'Rough Pull', 'Terminated', 'Tested', 'Notes', 'Date Added'];
  const headerRow = ws.addRow(headers);
  headerRow.height = 20;
  headerRow.eachCell(cell => {
    cell.font      = headerFont;
    cell.fill      = headerFill;
    cell.alignment = centerAlign;
    cell.border    = thinBorder;
  });
  // Left-align text columns in header
  headerRow.getCell(3).alignment = leftAlign; // Cable ID(s)
  headerRow.getCell(7).alignment = leftAlign; // Notes

  // Data rows
  sorted.forEach((d, i) => {
    const cable = d.isDouble
      ? `${d.cableA || '—'} / ${d.cableB || '—'}`
      : (d.cableA || '—');

    const row = ws.addRow([
      d.idf || '',
      d.isDouble ? 'Double' : 'Single',
      cable,
      d.roughPull  ? 'Yes' : 'No',
      d.terminated ? 'Yes' : 'No',
      d.tested     ? 'Yes' : 'No',
      d.notes || '',
      d.createdAt,
    ]);

    row.height = 18;

    const isEven   = i % 2 === 0;
    const baseFill = d.isDouble
      ? (isEven ? doubleFill : doubleOddFill)
      : (isEven ? evenFill   : oddFill);

    row.eachCell((cell, colNum) => {
      cell.fill   = baseFill;
      cell.border = thinBorder;
      switch (colNum) {
        case 1: // IDF
          cell.font      = idfFont;
          cell.alignment = centerAlign;
          break;
        case 2: // Type
          cell.font      = d.isDouble ? doubleFont : bodyFont;
          cell.alignment = centerAlign;
          break;
        case 3: // Cable ID(s)
          cell.font      = monoFont;
          cell.alignment = leftAlign;
          break;
        case 4: // Rough Pull
          cell.font      = d.roughPull  ? yesFont : noFont;
          cell.alignment = centerAlign;
          break;
        case 5: // Terminated
          cell.font      = d.terminated ? yesFont : noFont;
          cell.alignment = centerAlign;
          break;
        case 6: // Tested
          cell.font      = d.tested     ? yesFont : noFont;
          cell.alignment = centerAlign;
          break;
        case 7: // Notes
          cell.font      = dimFont;
          cell.alignment = { ...leftAlign, wrapText: true };
          break;
        case 8: // Date
          cell.font      = dimFont;
          cell.alignment = centerAlign;
          break;
      }
    });
  });

  // Auto-filter on header row (row 3)
  ws.autoFilter = { from: 'A3', to: 'H3' };

  // ── Summary sheet ─────────────────────────────────────────────────────────
  const ws2 = wb.addWorksheet('Summary');
  ws2.columns = [{ width: 22 }, { width: 24 }];

  ws2.mergeCells('A1:B1');
  const s2title     = ws2.getCell('A1');
  s2title.value     = `Summary${projectName ? `  —  ${projectName}` : ''}`;
  s2title.font      = { bold: true, size: 13, color: { argb: 'FFFFFFFF' }, name: 'Calibri' };
  s2title.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A1628' } };
  s2title.alignment = leftAlign;
  ws2.getRow(1).height = 26;

  const s2header = ws2.addRow(['Metric', 'Value']);
  s2header.height = 20;
  s2header.eachCell(cell => {
    cell.font      = headerFont;
    cell.fill      = headerFill;
    cell.alignment = centerAlign;
    cell.border    = thinBorder;
  });

  const summaryRows = [
    ['Project',        projectName || '—'],
    ['Total Drops',    sorted.length],
    ['Double Drops',   sorted.filter(d => d.isDouble).length],
    ['Rough Pulled',   sorted.filter(d => d.roughPull).length],
    ['Terminated',     sorted.filter(d => d.terminated).length],
    ['Tested',         sorted.filter(d => d.tested).length],
    ['Fully Complete', sorted.filter(d => d.roughPull && d.terminated && d.tested).length],
    ['Report Date',    new Date().toLocaleString()],
  ];

  summaryRows.forEach(([metric, value], i) => {
    const row = ws2.addRow([metric, value]);
    row.height = 18;
    const fill = i % 2 === 0 ? evenFill : oddFill;
    row.eachCell((cell, col) => {
      cell.fill      = fill;
      cell.border    = thinBorder;
      cell.font      = col === 2 ? { ...bodyFont, bold: true } : bodyFont;
      cell.alignment = col === 2 ? centerAlign : leftAlign;
    });
  });

  // ── Write & share ─────────────────────────────────────────────────────────
  const buffer   = await wb.xlsx.writeBuffer();
  const base64   = _arrayBufferToBase64(buffer);
  const safeName = (projectName || 'cable-pull').replace(/[^a-z0-9]/gi, '-').toLowerCase();
  const fileUri  = FileSystem.cacheDirectory + `${safeName}-tracker.xlsx`;
  await FileSystem.writeAsStringAsync(fileUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  await Sharing.shareAsync(fileUri, {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    dialogTitle: `Share ${projectName || 'Cable Pull'} Report (Excel)`,
    UTI: 'com.microsoft.excel.xlsx',
  });
}

function _arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
