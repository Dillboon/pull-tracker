import * as Print      from 'expo-print';
import * as Sharing    from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import ExcelJS         from 'exceljs';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const sortedDrops = (drops) =>
  [...(drops || [])].sort((a, b) => {
    const idfA = (a.idf || '').toLowerCase();
    const idfB = (b.idf || '').toLowerCase();
    if (idfA < idfB) return -1;
    if (idfA > idfB) return 1;
    return (parseInt(a.cableA) || 0) - (parseInt(b.cableA) || 0);
  });

const getGroupType   = (d) => d.groupType || (d.isDouble ? 'double' : 'single');
const getCableLabel  = (d) => [d.cableA, d.cableB, d.cableC, d.cableD].filter(Boolean).join(' / ') || '—';
const getTypeLabel   = (d) => { const t = getGroupType(d); return t.charAt(0).toUpperCase() + t.slice(1); };
const isAttention    = (d) => d.attention === true; // Centralised so both export paths agree

const getPatchedLabel = (d) => {
  const p = [];
  if (d.patchedA && d.cableA) p.push(d.cableA);
  if (d.patchedB && d.cableB) p.push(d.cableB);
  if (d.patchedC && d.cableC) p.push(d.cableC);
  if (d.patchedD && d.cableD) p.push(d.cableD);
  return p.length > 0 ? `Yes (${p.join('/')})` : 'No';
};

// Chunked base64 — avoids stack-overflow on large XLSX buffers
function _arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let out = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    out += String.fromCharCode(...bytes.subarray(i, Math.min(i + 8192, bytes.length)));
  }
  return btoa(out);
}

// ─── PDF Export ───────────────────────────────────────────────────────────────
export async function exportPDF(drops, projectName = '') {
  if (!drops || drops.length === 0) throw new Error('No drops to export.');
  const sorted = sortedDrops(drops);
  const rp     = sorted.filter(d => d.roughPull).length;
  const tm     = sorted.filter(d => d.terminated).length;
  const ts     = sorted.filter(d => d.tested).length;
  const done   = sorted.filter(d => d.roughPull && d.terminated && d.tested).length;
  const attn   = sorted.filter(d => isAttention(d)).length;
  const patched = sorted.filter(d => d.patchedA || d.patchedB || d.patchedC || d.patchedD).length;
  const donePct = sorted.length > 0 ? Math.round((done / sorted.length) * 100) : 0;

  const tick = (v) =>
    v ? `<span style="color:#16a34a;font-weight:700;">✓</span>`
      : `<span style="color:#dc2626;">✗</span>`;

  const rows = sorted.map((d, i) => {
    const attnRow = isAttention(d);
    const bg      = attnRow ? '#fffbeb' : (i % 2 === 0 ? '#f8fafc' : '#ffffff');
    const cable   = getCableLabel(d);
    const pLabel  = getPatchedLabel(d);
    return `
      <tr style="background:${bg}">
        <td>${d.idf || '—'}</td>
        <td>${getTypeLabel(d) !== 'Single' ? `<b style="color:#7c3aed;">${getTypeLabel(d)}</b>` : 'Single'}</td>
        <td>${cable}</td>
        <td style="text-align:center">${tick(d.roughPull)}</td>
        <td style="text-align:center">${tick(d.terminated)}</td>
        <td style="text-align:center">${tick(d.tested)}</td>
        <td style="text-align:center;font-size:11px;color:${pLabel !== 'No' ? '#065f46' : '#94a3b8'}">${pLabel}</td>
        <td style="color:#555;font-size:11px">${d.notes || ''}</td>
        <td style="text-align:center">${attnRow ? '<span style="color:#d97706;font-weight:700;">⚠️</span>' : ''}</td>
        <td style="color:#888;font-size:11px">${d.createdAt || ''}</td>
      </tr>`;
  }).join('');

  const html = `
    <!DOCTYPE html><html><head><meta charset="UTF-8"/>
    <style>
      body { font-family: -apple-system, Arial, sans-serif; margin: 0; padding: 24px; background: #fff; color: #111; }
      .topbar { background: #0f172a; color: #fbbf24; padding: 14px 18px; border-radius: 8px; margin-bottom: 6px; }
      .topbar h1 { margin: 0; font-size: 20px; }
      .topbar .project { font-size: 13px; color: #94a3b8; margin-top: 3px; }
      .meta { font-size: 11px; color: #64748b; margin-bottom: 10px; }
      .summary { display: flex; flex-wrap: wrap; gap: 16px; background: #f1f5f9; padding: 12px 16px; border-radius: 8px; margin-bottom: 20px; font-size: 13px; }
      .stat { display: flex; flex-direction: column; }
      .stat b { font-size: 20px; color: #0f172a; }
      .stat span { color: #64748b; font-size: 11px; }
      .progress-wrap { background: #e2e8f0; border-radius: 999px; height: 8px; width: 100%; margin-top: 12px; }
      .progress-bar { background: #22c55e; border-radius: 999px; height: 8px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      thead tr { background: #0f172a; color: #fbbf24; }
      thead th { padding: 9px 8px; text-align: left; font-size: 11px; letter-spacing: 0.05em; text-transform: uppercase; }
      tbody td { padding: 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
      .footer { margin-top: 20px; font-size: 11px; color: #94a3b8; text-align: center; }
    </style></head><body>
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
        <div class="stat"><b style="color:#16a34a">${done}/${sorted.length}</b><span>Complete (${donePct}%)</span></div>
        ${patched > 0 ? `<div class="stat"><b style="color:#0891b2">${patched}</b><span>Patched</span></div>` : ''}
        ${attn    > 0 ? `<div class="stat"><b style="color:#d97706">${attn}</b><span>⚠ Attention</span></div>` : ''}
      </div>
      <div class="progress-wrap"><div class="progress-bar" style="width:${donePct}%"></div></div>
      <br/>
      <table>
        <thead>
          <tr>
            <th>IDF</th><th>Type</th><th>Cable ID(s)</th>
            <th>Rough Pull</th><th>Terminated</th><th>Tested</th><th>Patched</th>
            <th>Notes</th><th>Attn</th><th>Date</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="footer">CablePull Tracker${projectName ? ` · ${projectName}` : ''} · ${sorted.length} total drops · ${donePct}% complete</div>
    </body></html>`;

  const { uri } = await Print.printToFileAsync({ html, base64: false });
  await Sharing.shareAsync(uri, {
    UTI: '.pdf',
    mimeType: 'application/pdf',
    dialogTitle: `Share ${projectName || 'Cable Pull'} Report (PDF)`,
  });
}

// ─── Excel Export ─────────────────────────────────────────────────────────────
export async function exportXLSX(drops, projectName = '') {
  if (!drops || drops.length === 0) throw new Error('No drops to export.');
  const sorted      = sortedDrops(drops);
  const total       = sorted.length;
  const lastDataRow = 3 + total; // rows 1–3 = title/subtitle/header; data = 4..lastDataRow

  const wb = new ExcelJS.Workbook();
  wb.creator        = 'CablePull Tracker';
  wb.lastModifiedBy = 'CablePull Tracker';
  wb.created        = new Date();
  wb.modified       = new Date();
  wb.description    = `Field tracker export${projectName ? ` — ${projectName}` : ''}`;

  // ── Style constants ─────────────────────────────────────────────────────────
  const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F2744' } };
  const subHdrFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E2D40' } };
  const evenFill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3EEFF' } };
  const oddFill    = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE9E0FF' } };

  const headerFont = { bold: true, color: { argb: 'FFFBBF24' }, size: 10, name: 'Calibri' };
  const subHdrFont = { bold: true, color: { argb: 'FF94A3B8' }, size: 9,  name: 'Calibri' };
  const bodyFont   = { size: 10, name: 'Calibri' };
  const monoFont   = { size: 10, name: 'Courier New' };
  const dimFont    = { size: 9,  name: 'Calibri', color: { argb: 'FF64748B' } };
  const doubleFont = { bold: true, color: { argb: 'FF7C3AED' }, size: 10, name: 'Calibri' };
  const idfFont    = { bold: true, color: { argb: 'FF1E40AF' }, size: 10, name: 'Calibri' };

  const thinBorder = {
    top:    { style: 'thin', color: { argb: 'FFE2E8F0' } },
    left:   { style: 'thin', color: { argb: 'FFE2E8F0' } },
    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    right:  { style: 'thin', color: { argb: 'FFE2E8F0' } },
  };
  const centerAlign = { horizontal: 'center', vertical: 'middle' };
  const leftAlign   = { horizontal: 'left',   vertical: 'middle' };

  // ── Cable Drops sheet ───────────────────────────────────────────────────────
  const ws = wb.addWorksheet('Cable Drops', {
    views: [{ state: 'frozen', ySplit: 3 }],
    tabColor: { argb: 'FF3B82F6' },
    pageSetup: {
      orientation:    'landscape',
      fitToPage:      true,
      fitToWidth:     1,
      fitToHeight:    0,
      printTitlesRow: '1:3',
    },
  });

  ws.columns = [
    { key: 'idf',        width: 12 },
    { key: 'type',       width: 10 },
    { key: 'cable',      width: Math.max(12, ...sorted.map(d => getCableLabel(d).length)) + 2 },
    { key: 'roughPull',  width: 13 },
    { key: 'terminated', width: 13 },
    { key: 'tested',     width: 10 },
    { key: 'complete',   width: 11 },
    { key: 'patched',    width: 18 },
    { key: 'attention',  width: 11 },
    { key: 'notes',      width: 10 }, // auto-fit below
    { key: 'date',       width: 10 }, // auto-fit below
  ];

  // ── Title row (A1:K1) ───────────────────────────────────────────────────────
  ws.mergeCells('A1:K1');
  const titleCell     = ws.getCell('A1');
  titleCell.value     = `CablePull Field Tracker${projectName ? `  —  ${projectName}` : ''}`;
  titleCell.font      = { bold: true, size: 13, color: { argb: 'FFFFFFFF' }, name: 'Calibri' };
  titleCell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A1628' } };
  titleCell.alignment = leftAlign;
  ws.getRow(1).height = 26;

  // ── Subtitle row (A2:K2) ────────────────────────────────────────────────────
  ws.mergeCells('A2:K2');
  const subCell   = ws.getCell('A2');
  const rpCount   = sorted.filter(d => d.roughPull).length;
  const tmCount   = sorted.filter(d => d.terminated).length;
  const tsCount   = sorted.filter(d => d.tested).length;
  const doneCount = sorted.filter(d => d.roughPull && d.terminated && d.tested).length;
  const attnCount = sorted.filter(d => isAttention(d)).length;
  subCell.value   = `Generated: ${new Date().toLocaleString()}  |  Total: ${total}  |  Rough pulled: ${rpCount}  |  Terminated: ${tmCount}  |  Tested: ${tsCount}  |  Completed: ${doneCount}  |  Attention: ${attnCount}`;
  subCell.font    = { size: 9, color: { argb: 'FF94A3B8' }, name: 'Calibri' };
  subCell.fill    = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  subCell.alignment = leftAlign;
  ws.getRow(2).height = 18;

  // ── Header row (row 3) ──────────────────────────────────────────────────────
  const hdr = ws.addRow(['IDF', 'Type', 'Cable ID(s)', 'Rough Pull', 'Terminated', 'Tested', 'Complete', 'Patched', 'Attention', 'Notes', 'Date Added']);
  hdr.height = 20;
  hdr.eachCell(cell => {
    cell.font = headerFont; cell.fill = headerFill;
    cell.alignment = centerAlign; cell.border = thinBorder;
  });
  // FIX: col 3 = Cable ID(s) → left; col 10 = Notes → left (was incorrectly col 9)
  hdr.getCell(3).alignment  = leftAlign;
  hdr.getCell(10).alignment = leftAlign;

  const dvYesNo = {
    type: 'list', allowBlank: false,
    showErrorMessage: true,
    errorTitle: 'Invalid value', error: 'Please select Yes or No',
    formulae: ['"Yes,No"'],
  };

  // ── Data rows ───────────────────────────────────────────────────────────────
  sorted.forEach((d, i) => {
    const rowNum    = 4 + i;
    d._mainRowNum   = rowNum; // Used by the By IDF sheet to create live formula links

    const cable     = getCableLabel(d);
    const typeLabel = getTypeLabel(d);
    const isEven    = i % 2 === 0;
    const baseFill  = isEven ? evenFill : oddFill;
    const attnYes   = isAttention(d);
    const pLabel    = getPatchedLabel(d);
    const isPatched = d.patchedA || d.patchedB || d.patchedC || d.patchedD;

    const row = ws.addRow([
      d.idf || '',
      typeLabel,
      cable,
      d.roughPull  ? 'Yes' : 'No',
      d.terminated ? 'Yes' : 'No',
      d.tested     ? 'Yes' : 'No',
      '',              // Complete — formula below
      pLabel,
      attnYes ? '⚠ Yes' : 'No',
      d.notes || '',
      d.createdAt || '',
    ]);
    row.height = 18;

    row.getCell(7).value = {
      formula: `IF(AND(D${rowNum}="Yes",E${rowNum}="Yes",F${rowNum}="Yes"),"✓","✗")`,
    };

    row.eachCell((cell, colNum) => {
      cell.border = thinBorder;
      switch (colNum) {
        case 1:
          cell.font = idfFont; cell.fill = baseFill; cell.alignment = centerAlign; break;
        case 2:
          cell.font = doubleFont; cell.fill = baseFill; cell.alignment = centerAlign; break;
        case 3:
          cell.font = monoFont; cell.fill = baseFill; cell.alignment = leftAlign; break;
        case 4:
        case 5:
        case 6:
        case 7:
          cell.fill = baseFill; cell.alignment = centerAlign; break;
        case 8: // Patched
          cell.fill      = baseFill;
          cell.alignment = centerAlign;
          cell.font      = { ...bodyFont, color: { argb: isPatched ? 'FF065F46' : 'FF94A3B8' } };
          break;
        case 9: // Attention
          cell.fill      = attnYes ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7ED' } } : baseFill;
          cell.font      = attnYes
            ? { bold: true, color: { argb: 'FFD97706' }, size: 10, name: 'Calibri' }
            : { ...dimFont, color: { argb: 'FF94A3B8' } };
          cell.alignment = centerAlign;
          break;
        case 10: // Notes
          cell.font      = dimFont;
          cell.fill      = baseFill;
          cell.alignment = { ...leftAlign, wrapText: true };
          break;
        case 11: // Date Added
          cell.font      = dimFont;
          cell.fill      = baseFill;
          cell.alignment = centerAlign;
          break;
      }
    });

    row.getCell(4).dataValidation = dvYesNo;
    row.getCell(5).dataValidation = dvYesNo;
    row.getCell(6).dataValidation = dvYesNo;
  });

  ws.autoFilter = { from: 'A3', to: 'K3' };

  // ── Conditional formatting ──────────────────────────────────────────────────
  if (total > 0) {
    ws.addConditionalFormatting({
      ref: `D4:F${lastDataRow}`,
      rules: [
        {
          type: 'cellIs', operator: 'equal', formulae: ['"Yes"'],
          style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } }, font: { bold: true, color: { argb: 'FF065F46' } } },
        },
        {
          type: 'cellIs', operator: 'equal', formulae: ['"No"'],
          style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } }, font: { bold: true, color: { argb: 'FF991B1B' } } },
        },
      ],
    });
    ws.addConditionalFormatting({
      ref: `G4:G${lastDataRow}`,
      rules: [
        {
          type: 'cellIs', operator: 'equal', formulae: ['"✓"'],
          style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } }, font: { bold: true, color: { argb: 'FF065F46' }, size: 11 } },
        },
        {
          type: 'cellIs', operator: 'equal', formulae: ['"✗"'],
          style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } }, font: { bold: true, color: { argb: 'FF991B1B' }, size: 11 } },
        },
      ],
    });
  }

  // FIX: only array corrected to [10, 11] (Notes = col 10, Date = col 11)
  autoFitColumns(ws, {
    10: { min: 20, max: 45 }, // Notes — wrap is on, so cap width
    11: { min: 14, max: 26 }, // Date  — locale strings can be ~22 chars
  }, [10, 11]);

  // ── Summary sheet ────────────────────────────────────────────────────────────
  const ws2 = wb.addWorksheet('Summary', {
    tabColor: { argb: 'FF22C55E' },
    pageSetup: {
      orientation:    'landscape',
      fitToPage:      true,
      fitToWidth:     1,
      fitToHeight:    0,
      printTitlesRow: '1:2',
    },
  });
  [22, 14, 14].forEach((w, i) => {
    ws2.getColumn(i + 1).width = w;
  });

  ws2.mergeCells('A1:C1');
  const s2title     = ws2.getCell('A1');
  s2title.value     = `Summary${projectName ? `  —  ${projectName}` : ''}`;
  s2title.font      = { bold: true, size: 13, color: { argb: 'FFFFFFFF' }, name: 'Calibri' };
  s2title.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A1628' } };
  s2title.alignment = leftAlign;
  ws2.getRow(1).height = 26;

  const s2hdr = ws2.addRow(['Metric', 'Count', '% of Total']);
  s2hdr.height = 20;
  s2hdr.eachCell(cell => {
    cell.font = headerFont; cell.fill = headerFill;
    cell.alignment = centerAlign; cell.border = thinBorder;
  });
  s2hdr.getCell(1).alignment = leftAlign;

  const addSRow = (metric, count, pct) => {
    const row  = ws2.addRow([metric, count, pct ?? '']);
    row.height = 18;
    const fill = ws2.rowCount % 2 === 0 ? evenFill : oddFill;
    row.eachCell((cell, col) => {
      cell.fill      = fill; cell.border = thinBorder;
      cell.font      = col === 2 ? { ...bodyFont, bold: true } : bodyFont;
      cell.alignment = col === 1 ? leftAlign : centerAlign;
    });
    if (pct !== null && pct !== undefined && pct !== '') row.getCell(3).numFmt = '0.0%';
  };

  const addFormulaRow = (metric, colLetter) => {
    const row = ws2.addRow([
      metric,
      { formula: `COUNTIF('Cable Drops'!${colLetter}4:${colLetter}${lastDataRow},"Yes")` },
      { formula: `IFERROR(COUNTIF('Cable Drops'!${colLetter}4:${colLetter}${lastDataRow},"Yes")/${total},0)` },
    ]);
    row.height = 18;
    const fill = ws2.rowCount % 2 === 0 ? evenFill : oddFill;
    row.eachCell((cell, col) => {
      cell.fill      = fill; cell.border = thinBorder;
      cell.font      = col === 2 ? { ...bodyFont, bold: true } : bodyFont;
      cell.alignment = col === 1 ? leftAlign : centerAlign;
    });
    row.getCell(3).numFmt = '0.0%';
  };

  const addCompleteFormulaRow = (metric) => {
    const ref = `'Cable Drops'!D4:D${lastDataRow},"Yes",'Cable Drops'!E4:E${lastDataRow},"Yes",'Cable Drops'!F4:F${lastDataRow},"Yes"`;
    const row = ws2.addRow([
      metric,
      { formula: `COUNTIFS(${ref})` },
      { formula: `IFERROR(COUNTIFS(${ref})/${total},0)` },
    ]);
    row.height = 18;
    const fill = ws2.rowCount % 2 === 0 ? evenFill : oddFill;
    row.eachCell((cell, col) => {
      cell.fill      = fill; cell.border = thinBorder;
      cell.font      = col === 2 ? { ...bodyFont, bold: true } : bodyFont;
      cell.alignment = col === 1 ? leftAlign : centerAlign;
    });
    row.getCell(3).numFmt = '0.0%';
  };

  const addSubHeader = (label) => {
    const row = ws2.addRow([label, '', '']);
    row.height = 16;
    row.eachCell(cell => {
      cell.font = subHdrFont; cell.fill = subHdrFill; cell.border = thinBorder;
    });
    ws2.mergeCells(`A${ws2.rowCount}:C${ws2.rowCount}`);
  };

  const addSeparator = () => {
    ws2.addRow(['', '', '']);
    ws2.getRow(ws2.rowCount).height = 6;
  };

  const completionRef = `'Cable Drops'!D4:D${lastDataRow},"Yes",'Cable Drops'!E4:E${lastDataRow},"Yes",'Cable Drops'!F4:F${lastDataRow},"Yes"`;
  addSRow('Total Drops', total, {
    formula: `IFERROR(COUNTIFS(${completionRef})/${total},0)`,
  });
  addSeparator();

  addSubHeader('Status Progress  (live — updates when you edit Yes / No)');
  addFormulaRow('Rough Pulled',   'D');
  addFormulaRow('Terminated',     'E');
  addFormulaRow('Tested',         'F');
  addCompleteFormulaRow('Fully Complete');
  addSeparator();

  addSubHeader('Drop Types');
  const singles = sorted.filter(d => getGroupType(d) === 'single').length;
  const doubles = sorted.filter(d => getGroupType(d) === 'double').length;
  const triples = sorted.filter(d => getGroupType(d) === 'triple').length;
  const quads   = sorted.filter(d => getGroupType(d) === 'quad').length;
  addSRow('Single Drops', singles, null);
  addSRow('Double Drops', doubles, null);
  if (triples > 0) addSRow('Triple Drops', triples, null);
  if (quads   > 0) addSRow('Quad Drops',   quads,   null);
  addSeparator();

  addSubHeader('Flags');
  addSRow('Attention Items', attnCount,  null);
  addSRow('Patched Items',   sorted.filter(d => d.patchedA || d.patchedB || d.patchedC || d.patchedD).length, null);
  addSeparator();

  const dateRow = ws2.addRow(['Report Generated', new Date().toLocaleString(), '']);
  dateRow.height = 18;
  dateRow.eachCell((cell, col) => {
    cell.fill = oddFill; cell.border = thinBorder; cell.font = dimFont;
    cell.alignment = col === 1 ? leftAlign : centerAlign;
  });
  ws2.mergeCells(`B${ws2.rowCount}:C${ws2.rowCount}`);

  // Color-scale on % of Total column — red → yellow → green
  const pctFirstRow = 3; // header row; data starts row 4 (index offset is handled by addRow)
  if (total > 0) {
    ws2.addConditionalFormatting({
      ref: `C${pctFirstRow}:C${ws2.rowCount}`,
      rules: [{
        type: 'colorScale',
        colorScale: {
          cfvo:  [{ type: 'num', value: 0 }, { type: 'num', value: 0.5 }, { type: 'num', value: 1 }],
          color: [{ argb: 'FFFCA5A5' }, { argb: 'FFFDE68A' }, { argb: 'FF86EFAC' }],
        },
      }],
    });
  }

  // ── "Flagged Items" section (Attention drops — quick PM reference) ──────────
  const attnDrops = sorted.filter(d => isAttention(d));
  if (attnDrops.length > 0) {
    addSeparator();
    addSubHeader(`⚠  Flagged Items  (${attnDrops.length})`);

    const flagHdr = ws2.addRow(['IDF / Cable ID(s)', 'Notes', '']);
    flagHdr.height = 16;
    flagHdr.eachCell(cell => {
      cell.font = subHdrFont; cell.fill = subHdrFill; cell.border = thinBorder;
      cell.alignment = leftAlign;
    });
    ws2.mergeCells(`B${ws2.rowCount}:C${ws2.rowCount}`);

    attnDrops.forEach((d, i) => {
      const label = `${d.idf || '?'}  —  ${getCableLabel(d)}`;
      const row   = ws2.addRow([label, d.notes || '', '']);
      row.height  = 18;
      const fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7ED' } };
      row.eachCell((cell, col) => {
        cell.fill   = fill;
        cell.border = thinBorder;
        cell.font   = col === 1
          ? { bold: true, color: { argb: 'FFD97706' }, size: 10, name: 'Calibri' }
          : { size: 9, color: { argb: 'FF64748B' }, name: 'Calibri' };
        cell.alignment = col === 1 ? leftAlign : { ...leftAlign, wrapText: true };
      });
      ws2.mergeCells(`B${ws2.rowCount}:C${ws2.rowCount}`);
    });
  }

// ─── Auto-fit column widths ───────────────────────────────────────────────────
/**
 * Sizes columns to fit their longest cell value.
 * ExcelJS has no built-in auto-fit, so we scan every cell manually.
 */
function autoFitColumns(worksheet, overrides = {}, only = null) {
  const DEFAULT_MIN = 8;
  const DEFAULT_MAX = 50;

  // ExcelJS quirk: `worksheet.columns` can be undefined if columns were created
  // without 'key' or 'header' properties. Using a 1-based loop is safer.
  const maxCol = worksheet.columnCount || 20; // Fallback to 20 if empty

  for (let colNum = 1; colNum <= maxCol; colNum++) {
    // If 'only' array is provided, skip columns not in the array
    if (only && !only.includes(colNum)) continue;

    const column = worksheet.getColumn(colNum);
    if (!column || !column.eachCell) continue;

    const { min = DEFAULT_MIN, max = DEFAULT_MAX } = overrides[colNum] || {};
    let maxLen = min;

    column.eachCell({ includeEmpty: false }, (cell) => {
      const v = cell.value;
      let len = 0;

      if (v === null || v === undefined) return;
      if (typeof v === 'string')         len = v.length;
      else if (typeof v === 'number')    len = String(v).length;
      else if (v instanceof Date)        len = v.toLocaleString().length;
      else if (typeof v === 'object') {
        if (v.richText) {
          len = v.richText.reduce((acc, r) => acc + (r.text?.length ?? 0), 0);
        } else if (v.formula) {
          len = v.result != null ? String(v.result).length : 6;
        } else if (v.text != null) {
          len = String(v.text).length;
        }
      }
      if (len > maxLen) maxLen = len;
    });

    // Add +2 for breathing room
    column.width = Math.min(maxLen + 2, max);
  }
}

  // ── Per-IDF Breakdown sheet ─────────────────────────────────────────────────
  const idfs = [...new Set(sorted.map(d => d.idf).filter(Boolean))].sort();
  if (idfs.length > 0) {
    const ws3 = wb.addWorksheet('By IDF', {
      tabColor: { argb: 'FFF59E0B' },
      pageSetup: {
        orientation:    'landscape',
        fitToPage:      true,
        fitToWidth:     1,
        fitToHeight:    0,
        printTitlesRow: '1:1',
      },
    });
    
    [10, 10, 13, 13, 10, 11, 10, 10].forEach((w, i) => {
      ws3.getColumn(i + 1).width = w;
    });
    ws3.mergeCells('A1:H1');
    const ws3title     = ws3.getCell('A1');
    ws3title.value     = `By IDF Closet  (Live View)${projectName ? `  —  ${projectName}` : ''}`;
    ws3title.font      = { bold: true, size: 13, color: { argb: 'FFFFFFFF' }, name: 'Calibri' };
    ws3title.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A1628' } };
    ws3title.alignment = leftAlign;
    ws3.getRow(1).height = 26;

    let ws3Row = 1;

    idfs.forEach(idf => {
      const idrops = sorted.filter(d => d.idf === idf);
      ws3Row++;

      const rpFormula   = `COUNTIFS('Cable Drops'!$A$4:$A$${lastDataRow}, "${idf}", 'Cable Drops'!$D$4:$D$${lastDataRow}, "Yes")`;
      const tmFormula   = `COUNTIFS('Cable Drops'!$A$4:$A$${lastDataRow}, "${idf}", 'Cable Drops'!$E$4:$E$${lastDataRow}, "Yes")`;
      const tsFormula   = `COUNTIFS('Cable Drops'!$A$4:$A$${lastDataRow}, "${idf}", 'Cable Drops'!$F$4:$F$${lastDataRow}, "Yes")`;
      const compFormula = `COUNTIFS('Cable Drops'!$A$4:$A$${lastDataRow}, "${idf}", 'Cable Drops'!$D$4:$D$${lastDataRow}, "Yes", 'Cable Drops'!$E$4:$E$${lastDataRow}, "Yes", 'Cable Drops'!$F$4:$F$${lastDataRow}, "Yes")`;

      ws3.mergeCells(`A${ws3Row}:H${ws3Row}`);
      const idfHdrCell = ws3.getCell(`A${ws3Row}`);
      idfHdrCell.value = {
        formula: `"${idf}  —  ${idrops.length} drops  |  RP: "&${rpFormula}&"  TM: "&${tmFormula}&"  TS: "&${tsFormula}&"  Complete: "&${compFormula}&"/${idrops.length}"`,
      };
      idfHdrCell.font      = { bold: true, color: { argb: 'FFFBBF24' }, size: 10, name: 'Calibri' };
      idfHdrCell.fill      = headerFill;
      idfHdrCell.border    = thinBorder;
      idfHdrCell.alignment = leftAlign;
      ws3.getRow(ws3Row).height = 18;
      ws3Row++;

      const iHdrRow = ws3.addRow(['Type', 'Cable ID(s)', 'Rough Pull', 'Terminated', 'Tested', 'Complete', 'Notes', '']);
      ws3Row = ws3.rowCount;
      iHdrRow.height = 16;
      iHdrRow.eachCell(cell => {
        cell.font = subHdrFont; cell.fill = subHdrFill;
        cell.alignment = centerAlign; cell.border = thinBorder;
      });
      iHdrRow.getCell(2).alignment = leftAlign;
      iHdrRow.getCell(7).alignment = leftAlign;

      idrops.forEach((d, i) => {
        ws3Row++;
        const cable     = getCableLabel(d);
        const typeLabel = getTypeLabel(d);
        const baseFill  = i % 2 === 0 ? evenFill : oddFill;

        const r = ws3.addRow([
          typeLabel, cable,
          { formula: `'Cable Drops'!D${d._mainRowNum}` },
          { formula: `'Cable Drops'!E${d._mainRowNum}` },
          { formula: `'Cable Drops'!F${d._mainRowNum}` },
          { formula: `'Cable Drops'!G${d._mainRowNum}` },
          d.notes || '',
          '',
        ]);
        r.height = 18;
        r.eachCell((cell, col) => {
          cell.border = thinBorder;
          switch (col) {
            case 1: cell.font = doubleFont; cell.fill = baseFill; cell.alignment = centerAlign; break;
            case 2: cell.font = monoFont;   cell.fill = baseFill; cell.alignment = leftAlign;   break;
            case 3:
            case 4:
            case 5:
            case 6:
              cell.fill = baseFill; cell.alignment = centerAlign; break;
            case 7:
              cell.font = dimFont; cell.fill = baseFill; cell.alignment = { ...leftAlign, wrapText: true }; break;
            default:
              cell.fill = baseFill; break;
          }
        });
      });

      ws3Row++;
      ws3.addRow(['', '', '', '', '', '', '', '']);
      ws3.getRow(ws3.rowCount).height = 8;
    });

    if (ws3.rowCount > 1) {
      ws3.addConditionalFormatting({
        ref: `C1:E${ws3.rowCount}`,
        rules: [
          { type: 'cellIs', operator: 'equal', formulae: ['"Yes"'], style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } }, font: { bold: true, color: { argb: 'FF065F46' } } } },
          { type: 'cellIs', operator: 'equal', formulae: ['"No"'],  style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } }, font: { bold: true, color: { argb: 'FF991B1B' } } } },
        ],
      });
      ws3.addConditionalFormatting({
        ref: `F1:F${ws3.rowCount}`,
        rules: [
          { type: 'cellIs', operator: 'equal', formulae: ['"✓"'], style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } }, font: { bold: true, color: { argb: 'FF065F46' }, size: 11 } } },
          { type: 'cellIs', operator: 'equal', formulae: ['"✗"'], style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } }, font: { bold: true, color: { argb: 'FF991B1B' }, size: 11 } } },
        ],
      });
    }

    autoFitColumns(ws3, { 7: { min: 20, max: 45 } }, [2, 7]);
  }

  // ── Write & share ───────────────────────────────────────────────────────────
  const buffer   = await wb.xlsx.writeBuffer();
  const base64   = _arrayBufferToBase64(buffer);
  const safeName = (projectName || 'cable-pull').replace(/[^a-z0-9]/gi, '-').toLowerCase();
  const fileUri  = FileSystem.cacheDirectory + `${safeName}-tracker.xlsx`;
  await FileSystem.writeAsStringAsync(fileUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  await Sharing.shareAsync(fileUri, {
    mimeType:    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    dialogTitle: `Share ${projectName || 'Cable Pull'} Report (Excel)`,
    UTI:         'com.microsoft.excel.xlsx',
  });
}

// ─── Auto-fit column widths ───────────────────────────────────────────────────
/**
 * Sizes columns to fit their longest cell value.
 * ExcelJS has no built-in auto-fit, so we scan every cell manually.
 *
 * @param {ExcelJS.Worksheet} worksheet
 * @param {Object}   [overrides]  1-based col index → { min, max } clamps
 * @param {number[]} [only]       if provided, only these 1-based col indices are resized
 */
function autoFitColumns(worksheet, overrides = {}, only = null) {
  const DEFAULT_MIN = 8;
  const DEFAULT_MAX = 50;

  worksheet.columns.forEach((column, colIdx) => {
    if (!column || !column.eachCell) return;

    const colNum = colIdx + 1;
    if (only && !only.includes(colNum)) return;

    const { min = DEFAULT_MIN, max = DEFAULT_MAX } = overrides[colNum] || {};
    let maxLen = min;

    column.eachCell({ includeEmpty: false }, (cell) => {
      const v = cell.value;
      let len = 0;

      if (v === null || v === undefined) return;
      if (typeof v === 'string')         len = v.length;
      else if (typeof v === 'number')    len = String(v).length;
      else if (v instanceof Date)        len = v.toLocaleString().length;
      else if (typeof v === 'object') {
        if (v.richText) {
          len = v.richText.reduce((acc, r) => acc + (r.text?.length ?? 0), 0);
        } else if (v.formula) {
          len = v.result != null ? String(v.result).length : 6;
        } else if (v.text != null) {
          len = String(v.text).length;
        }
      }
      if (len > maxLen) maxLen = len;
    });

    // FIX: +2 breathing room (was missing — comment existed but code did not add it)
    column.width = Math.min(maxLen + 2, max);
  });
}
