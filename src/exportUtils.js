import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import ExcelJS from 'exceljs';

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Natural sort — numeric when possible, trailing-number aware for C-001, IDF-02, R10 etc.
const natSort = (a, b) => {
  const numA = parseInt(a, 10);
  const numB = parseInt(b, 10);
  if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
  const trailA = a.match(/(\d+)$/)?.[1];
  const trailB = b.match(/(\d+)$/)?.[1];
  if (trailA && trailB) {
    const prefixA = a.slice(0, a.length - trailA.length);
    const prefixB = b.slice(0, b.length - trailB.length);
    if (prefixA === prefixB) return parseInt(trailA, 10) - parseInt(trailB, 10);
  }
  return a.localeCompare(b);
};

// 4-level sort: IDF → Custom Type → Rack Number → Cable ID
const sortedDrops = (drops) => [...drops].sort((a, b) => {
  const idfA = (a.idf || '').toLowerCase();
  const idfB = (b.idf || '').toLowerCase();
  if (!idfA && idfB)  return 1;
  if (idfA && !idfB)  return -1;
  if (idfA !== idfB)  return natSort(idfA, idfB);

  const typeA = (a.customType || '').toLowerCase();
  const typeB = (b.customType || '').toLowerCase();
  if (!typeA && typeB)  return -1;
  if (typeA && !typeB)  return 1;
  if (typeA !== typeB)  return natSort(typeA, typeB);

  const rackA = (a.rackNumber || '').toLowerCase();
  const rackB = (b.rackNumber || '').toLowerCase();
  if (!rackA && rackB)  return -1;
  if (rackA && !rackB)  return 1;
  if (rackA !== rackB)  return natSort(rackA, rackB);

  return natSort(a.cableA || '', b.cableA || '');
});

// Escapes a value for safe embedding inside a double-quoted Excel formula
// string literal (e.g. inside COUNTIFS("...")). Prevents a stray " in an
// IDF/cable name from corrupting the generated formula.
const escapeFormulaString = (s) => String(s).replace(/"/g, '""');

const getGroupType = (d) => d.groupType || (d.isDouble ? 'double' : 'single');

const getCableLabel = (d) =>
  [d.cableA, d.cableB, d.cableC, d.cableD].filter(Boolean).join(' / ') || '—';

const getTypeLabel = (d) => {
  const t = getGroupType(d);
  const baseLabel = t.charAt(0).toUpperCase() + t.slice(1);
  return d.customType ? `${d.customType} (${baseLabel})` : baseLabel;
};

const getPatchedLabel = (d) => {
  const p = [];
  if (d.patchedA && d.cableA) p.push(d.cableA);
  if (d.patchedB && d.cableB) p.push(d.cableB);
  if (d.patchedC && d.cableC) p.push(d.cableC);
  if (d.patchedD && d.cableD) p.push(d.cableD);
  return p.length > 0 ? `Yes (${p.join('/')})` : 'No';
};

// ─── PDF Export ──────────────────────────────────────────────────────────────
export async function exportPDF(drops, projectName = '') {
  const sorted = sortedDrops(drops);
  
  // 5-step progress counts
  const rp = sorted.filter(d => d.roughPull || d.overrideComplete).length;
  const dp = sorted.filter(d => d.dropped || d.overrideComplete).length;
  const ft = sorted.filter(d => d.terminated || d.overrideComplete).length;
  const rt = sorted.filter(d => d.rackTerminated || d.overrideComplete).length;
  const ts = sorted.filter(d => d.tested || d.overrideComplete).length;

  const rows = sorted.map((d, i) => {
    const bg = i % 2 === 0 ? '#f8fafc' : '#ffffff';
    const cable = getCableLabel(d);
    const typeLabel = getTypeLabel(d);
    
    const tick = (v) => (v || d.overrideComplete)
      ? `<span style="color:#16a34a;font-weight:700;">✓</span>`
      : `<span style="color:#dc2626;">✗</span>`;
      
    return `
      <tr style="background:${bg}">
        <td>${d.idf ? `${d.idf}${d.rackNumber ? ` · R${d.rackNumber}` : ''}` : '—'}</td>
        <td>${typeLabel !== 'Single' ? `<b style="color:#7c3aed;">${typeLabel}</b>` : 'Single'}</td>
        <td>${cable}</td>
        <td style="text-align:center">${tick(d.roughPull)}</td>
        <td style="text-align:center">${tick(d.dropped)}</td>
        <td style="text-align:center">${tick(d.terminated)}</td>
        <td style="text-align:center">${tick(d.rackTerminated)}</td>
        <td style="text-align:center">${tick(d.tested)}</td>
		<td style="text-align:center">${getPatchedLabel(d)}</td>
        <td style="color:#555;font-size:11px">${d.notes || ''}</td>
        <td style="text-align:center">${d.attention ? '⚠️' : ''}</td>
        <td style="color:#888;font-size:11px">${d.updatedAt || d.createdAt}</td>
      </tr>`;
  }).join('');

  const html = `
    <!DOCTYPE html><html><head><meta charset="UTF-8"/>
    <style>
      @page { margin: 0; }
      body { font-family: -apple-system, Arial, sans-serif; margin: 0; padding: 24px; background: #fff; color: #111; }
      .topbar { background: #0f172a; color: #fbbf24; padding: 14px 18px; border-radius: 8px; margin-bottom: 6px; }
      .topbar h1 { margin: 0; font-size: 20px; }
      .topbar .project { font-size: 13px; color: #94a3b8; margin-top: 3px; }
      .meta { font-size: 11px; color: #64748b; margin-bottom: 10px; }
      .summary { display: flex; gap: 14px; background: #f1f5f9; padding: 12px 16px; border-radius: 8px; margin-bottom: 20px; font-size: 13px; flex-wrap: wrap; }
      .stat { display: flex; flex-direction: column; }
      .stat b { font-size: 20px; color: #0f172a; }
      .stat span { color: #64748b; font-size: 11px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      thead tr { background: #0f172a; color: #fbbf24; }
      thead th { padding: 9px 8px; text-align: left; font-size: 10px; letter-spacing: 0.05em; text-transform: uppercase; }
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
        <div class="stat"><b style="color:#db2777">${dp}/${sorted.length}</b><span>Dropped</span></div>
        <div class="stat"><b style="color:#2563eb">${ft}/${sorted.length}</b><span>Field Term.</span></div>
        <div class="stat"><b style="color:#7c3aed">${rt}/${sorted.length}</b><span>Rack Term.</span></div>
        <div class="stat"><b style="color:#16a34a">${ts}/${sorted.length}</b><span>Tested</span></div>
      </div>
      <table>
        <thead>
          <tr>
            <th>IDF</th><th>Type</th><th>Cable ID(s)</th>
            <th>Rough Pull</th><th>Dropped</th><th>Field Term.</th><th>Rack Term.</th><th>Tested</th><th>Patched</th>
            <th>Notes</th><th>Attn</th><th>Last Updated</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="footer">CablePull Tracker${projectName ? ` · ${projectName}` : ''} · ${sorted.length} total drops</div>
    </body></html>`;

  const { uri } = await Print.printToFileAsync({ html, base64: false });
  await Sharing.shareAsync(uri, {
    UTI: '.pdf', mimeType: 'application/pdf',
    dialogTitle: `Share ${projectName || 'Cable Pull'} Report (PDF)`,
  });
}

// ─── Excel Export ─────────────────────────────────────────────────────────────
export async function exportXLSX(drops, projectName = '') {
  const sorted     = sortedDrops(drops);
  const total      = sorted.length;
  const lastDataRow = 3 + total; 

  const wb = new ExcelJS.Workbook();
  wb.creator = 'CablePull Tracker';
  wb.created = new Date();

  // ── Style constants ───────────────────────────────────────────────────────
  const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F2744' } };
  const subHdrFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E2D40' } };
  const evenFill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3EEFF' } };
  const oddFill    = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE9E0FF' } };

  const headerFont  = { bold: true, color: { argb: 'FFFBBF24' }, size: 10, name: 'Calibri' };
  const subHdrFont  = { bold: true, color: { argb: 'FF94A3B8' }, size: 9,  name: 'Calibri' };
  const bodyFont    = { size: 10, name: 'Calibri' };
  const monoFont    = { size: 10, name: 'Courier New' };
  const dimFont     = { size: 9,  name: 'Calibri', color: { argb: 'FF64748B' } };
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
    tabColor: { argb: 'FF3B82F6' },
    pageSetup: {
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0, 
      printTitlesRow: '1:3',
    }
  });

  // Updated layout to accommodate the 5th progress column
  ws.columns = [
    { key: 'idf',            width: 12 },
    { key: 'type',           width: Math.max(12, ...sorted.map(d => getTypeLabel(d).length)) + 2 },
    { key: 'cable',          width: Math.max(12, ...sorted.map(d => getCableLabel(d).length)) + 2 },
    { key: 'roughPull',      width: 12 },
    { key: 'dropped',        width: 12 },
    { key: 'terminated',     width: 15 },
    { key: 'rackTerminated', width: 15 },
    { key: 'tested',         width: 10 },
    { key: 'complete',       width: 11 },
    { key: 'patched',        width: 16 },
    { key: 'attention',      width: 11 },
    { key: 'notes',          width: 10 },
    { key: 'date',           width: 12 },
    { key: 'idfKey',         width: 4, hidden: true }, // raw IDF value, used by By-IDF lookups below
  ];

  // Title row (A1:M1)
  ws.mergeCells('A1:M1');
  const titleCell     = ws.getCell('A1');
  titleCell.value     = `CablePull Field Tracker${projectName ? `  —  ${projectName}` : ''}`;
  titleCell.font      = { bold: true, size: 13, color: { argb: 'FFFFFFFF' }, name: 'Calibri' };
  titleCell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A1628' } };
  titleCell.alignment = leftAlign;
  ws.getRow(1).height = 26;

  // Subtitle row (A2:M2)
  ws.mergeCells('A2:M2');
  const subCell   = ws.getCell('A2');
  
  const rpCount   = sorted.filter(d => d.roughPull || d.overrideComplete).length;
  const dpCount   = sorted.filter(d => d.dropped || d.overrideComplete).length;
  const ftCount   = sorted.filter(d => d.terminated || d.overrideComplete).length;
  const rtCount   = sorted.filter(d => d.rackTerminated || d.overrideComplete).length;
  const tsCount   = sorted.filter(d => d.tested || d.overrideComplete).length;
  const attnCount = sorted.filter(d => d.attention).length;
  
  subCell.value   = `Generated: ${new Date().toLocaleString()}  |  Total: ${total}  |  Rough pulled: ${rpCount}  |  Dropped: ${dpCount}  |  Field Term.: ${ftCount}  |  Rack Term.: ${rtCount}  |  Tested: ${tsCount}  |  Attention: ${attnCount}`;
  subCell.font    = { size: 9, color: { argb: 'FF94A3B8' }, name: 'Calibri' };
  subCell.fill    = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  subCell.alignment = leftAlign;
  ws.getRow(2).height = 18;

  // Header row (row 3)
  const headerRow = ws.addRow(['IDF', 'Type', 'Cable ID(s)', 'Rough Pull', 'Dropped', 'Field Terminated', 'Rack Terminated', 'Tested', 'Complete', 'Patched', 'Attention', 'Notes', 'Last Updated', 'IDF Key']);
  headerRow.height = 20;
  headerRow.eachCell(cell => {
    cell.font = headerFont; cell.fill = headerFill;
    cell.alignment = centerAlign; cell.border = thinBorder;
  });
  headerRow.getCell(3).alignment = leftAlign;
  headerRow.getCell(12).alignment = leftAlign; // notes

  const dvYesNo = {
    type: 'list', allowBlank: false,
    showErrorMessage: true,
    errorTitle: 'Invalid value', error: 'Please select Yes or No',
    formulae: ['"Yes,No"'],
  };

  // Data rows
  sorted.forEach((d, i) => {
    const rowNum    = 4 + i;
    d._mainRowNum   = rowNum; 
    
    const cable     = getCableLabel(d);
    const typeLabel = getTypeLabel(d);
    const isEven    = i % 2 === 0;
    const baseFill  = isEven ? evenFill : oddFill;

    const row = ws.addRow([
      d.idf ? `${d.idf}${d.rackNumber ? ` · R${d.rackNumber}` : ''}` : '',
      typeLabel,
      cable,
      d.roughPull      ? 'Yes' : 'No',
      d.dropped        ? 'Yes' : 'No',
      d.terminated     ? 'Yes' : 'No',
      d.rackTerminated ? 'Yes' : 'No',
      d.tested         ? 'Yes' : 'No',
      '',  // Complete — evaluated dynamically below
	  getPatchedLabel(d),
      d.attention  ? '⚠ Yes' : 'No',
      d.notes || '',
      d.updatedAt || d.createdAt,
      d.idf || '',
    ]);
    row.height = 18;

    // Evaluate Completion with 5 progress steps (D, E, F, G, H)
    row.getCell(9).value = {
      formula: `IF(OR(${d.overrideComplete ? 'TRUE' : 'FALSE'},AND(D${rowNum}="Yes",E${rowNum}="Yes",F${rowNum}="Yes",G${rowNum}="Yes",H${rowNum}="Yes")),"✓","✗")`,
    };

    row.eachCell((cell, colNum) => {
      cell.border = thinBorder;
      switch (colNum) {
        case 1: cell.font = idfFont; cell.fill = baseFill; cell.alignment = centerAlign; break;
        case 2: cell.font = doubleFont; cell.fill = baseFill; cell.alignment = centerAlign; break;
        case 3: cell.font = monoFont; cell.fill = baseFill; cell.alignment = leftAlign; break;
        case 4:
        case 5:
        case 6:
        case 7:
        case 8:
          cell.fill = baseFill; cell.alignment = centerAlign;
          cell.protection = { locked: false };
          break;
        case 9:
          cell.fill = baseFill; cell.alignment = centerAlign; break;
        case 10:
          cell.fill = baseFill; cell.alignment = centerAlign;
          cell.font = { ...bodyFont, color: { argb: (d.patchedA || d.patchedB || d.patchedC || d.patchedD) ? 'FF065F46' : 'FF64748B' }};
          break;
		case 11:
          cell.fill = d.attention ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7ED' } } : baseFill;
          cell.font = d.attention ? { bold: true, color: { argb: 'FFD97706' }, size: 10, name: 'Calibri' } : { ...dimFont, color: { argb: 'FF94A3B8' } };
          cell.alignment = centerAlign; break;
        case 12:
          cell.font = dimFont; cell.fill = baseFill; cell.alignment = { ...leftAlign, wrapText: true };
          cell.protection = { locked: false };
          break;
        case 13:
          cell.font = dimFont; cell.fill = baseFill; cell.alignment = centerAlign; break;
      }
    });

    row.getCell(4).dataValidation = dvYesNo;
    row.getCell(5).dataValidation = dvYesNo;
    row.getCell(6).dataValidation = dvYesNo;
    row.getCell(7).dataValidation = dvYesNo;
    row.getCell(8).dataValidation = dvYesNo;
  });

  ws.autoFilter = { from: 'A3', to: 'M3' };

  if (total > 0) {
    ws.addConditionalFormatting({
      ref: `D4:H${lastDataRow}`,
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
      ref: `I4:I${lastDataRow}`,
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

  // Formula cell protection
  ws.protect('', {
    selectLockedCells:   true,
    selectUnlockedCells: true,
    sort:                true,
    autoFilter:          true,
    formatCells:         false,
    formatColumns:       false,
    formatRows:          false,
    insertColumns:       false,
    insertRows:          false,
    deleteColumns:       false,
    deleteRows:          false,
  });

  autoFitColumns(ws, {
    12: { min: 20, max: 45 }, 
    13: { min: 14, max: 26 }, 
  }, [12, 13]); 

  // ── Summary sheet ─────────────────────────────────────────────────────────
  const ws2 = wb.addWorksheet('Summary', { 
    tabColor: { argb: 'FF22C55E' },
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '1:2' }
  });
  ws2.columns = [{ width: 10 }, { width: 14 }, { width: 14 }];

  ws2.mergeCells('A1:C1');
  const s2title = ws2.getCell('A1');
  s2title.value = `Summary${projectName ? `  —  ${projectName}` : ''}`;
  s2title.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' }, name: 'Calibri' };
  s2title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A1628' } };
  s2title.alignment = leftAlign;
  ws2.getRow(1).height = 26;

  const s2hdr = ws2.addRow(['Metric', 'Count', '% Complete']);
  s2hdr.height = 20;
  s2hdr.eachCell(cell => {
    cell.font = headerFont; cell.fill = headerFill;
    cell.alignment = centerAlign; cell.border = thinBorder;
  });
  s2hdr.getCell(1).alignment = leftAlign;

  const addSRow = (metric, count, pct) => {
    const row = ws2.addRow([metric, count, pct ?? '']);
    row.height = 18;
    const fill = ws2.rowCount % 2 === 0 ? evenFill : oddFill;
    row.eachCell((cell, col) => {
      cell.fill = fill; cell.border = thinBorder;
      cell.font = col === 2 ? { ...bodyFont, bold: true } : bodyFont;
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
      cell.fill = fill; cell.border = thinBorder;
      cell.font = col === 2 ? { ...bodyFont, bold: true } : bodyFont;
      cell.alignment = col === 1 ? leftAlign : centerAlign;
    });
    row.getCell(3).numFmt = '0.0%';
  };

  // Now points to I for overall completion
  const addCompleteFormulaRow = (metric) => {
    const row = ws2.addRow([
      metric,
      { formula: `COUNTIF('Cable Drops'!I4:I${lastDataRow},"✓")` },
      { formula: `IFERROR(COUNTIF('Cable Drops'!I4:I${lastDataRow},"✓")/${total},0)` },
    ]);
    row.height = 18;
    const fill = ws2.rowCount % 2 === 0 ? evenFill : oddFill;
    row.eachCell((cell, col) => {
      cell.fill = fill; cell.border = thinBorder;
      cell.font = col === 2 ? { ...bodyFont, bold: true } : bodyFont;
      cell.alignment = col === 1 ? leftAlign : centerAlign;
    });
    row.getCell(3).numFmt = '0.0%';
  };

  const addSubHeader = (label) => {
    const row = ws2.addRow([label, '', '']);
    row.height = 16;
    row.eachCell(cell => { cell.font = subHdrFont; cell.fill = subHdrFill; cell.border = thinBorder; });
    ws2.mergeCells(`A${ws2.rowCount}:C${ws2.rowCount}`);
  };

  const addSeparator = () => {
    ws2.addRow(['', '', '']);
    ws2.getRow(ws2.rowCount).height = 6;
  };

  // Blended average across all 5 stages, so this headline number reflects
  // partial progress rather than duplicating the "Fully Complete" row below.
  const blendedProgressFormula = `IFERROR((COUNTIF('Cable Drops'!D4:D${lastDataRow},"Yes")+COUNTIF('Cable Drops'!E4:E${lastDataRow},"Yes")+COUNTIF('Cable Drops'!F4:F${lastDataRow},"Yes")+COUNTIF('Cable Drops'!G4:G${lastDataRow},"Yes")+COUNTIF('Cable Drops'!H4:H${lastDataRow},"Yes"))/(5*${total}),0)`;
  addSRow('Total Drops', total, { formula: blendedProgressFormula });
  addSeparator();

  addSubHeader('Status Progress  (live — updates when you edit Yes/No)');
  addFormulaRow('Rough Pulled', 'D');
  addFormulaRow('Dropped', 'E');
  addFormulaRow('Field Terminated', 'F');
  addFormulaRow('Rack Terminated', 'G');
  addFormulaRow('Tested', 'H');
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
  addSRow('Attention Items', attnCount, null);
  addSRow('Patched Items', sorted.filter(d => d.patchedA || d.patchedB || d.patchedC || d.patchedD).length, null);
  addSeparator();

  const dateRow = ws2.addRow(['Report Generated', new Date().toLocaleString(), '']);
  dateRow.height = 18;
  dateRow.eachCell((cell, col) => {
    cell.fill = oddFill; cell.border = thinBorder; cell.font = dimFont;
    cell.alignment = col === 1 ? leftAlign : centerAlign;
  });

  autoFitColumns(ws2, { 1: { min: 18, max: 36 }, 2: { min: 10, max: 24 }, 3: { min: 12, max: 18 } }, [1]);

  // ── Per-IDF Breakdown sheet ───────────────────────────────────────────────
  // Unique IDFs, preserving the natural sort order `sorted` already has
  // (re-sorting lexicographically here would put "IDF-10" before "IDF-2").
  const idfsInOrder = [];
  {
    const seen = new Set();
    sorted.forEach(d => { if (d.idf && !seen.has(d.idf)) { seen.add(d.idf); idfsInOrder.push(d.idf); } });
  }

  if (idfsInOrder.length > 0) {
    const ws3 = wb.addWorksheet('By IDF', { 
      tabColor: { argb: 'FFF59E0B' },
      views: [{ state: 'frozen', ySplit: 3 }],
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '1:3' }
    });

    ws3.columns = [
      { width: 14 }, { width: 12 }, { width: 13 }, { width: 12 }, { width: 14 },
      { width: 14 }, { width: 11 }, { width: 10 }, { width: 15 },
    ];

    ws3.mergeCells('A1:I1');
    const ws3title = ws3.getCell('A1');
    ws3title.value = `By IDF Closet  (Live View)${projectName ? `  —  ${projectName}` : ''}`;
    ws3title.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' }, name: 'Calibri' };
    ws3title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A1628' } };
    ws3title.alignment = leftAlign;
    ws3.getRow(1).height = 26;

    // ── Precompute where every IDF's detail section will land, so the index
    //    built below can link straight to it (no back-and-forth passes). ──
    const INDEX_HEADER_ROW = 3;
    const idfGroups = idfsInOrder.map(idf => ({ idf, drops: sorted.filter(d => d.idf === idf) }));
    const detailStartRow = INDEX_HEADER_ROW + 1 + idfGroups.length + 1; // header + index rows + spacer
    let cursor = detailStartRow;
    idfGroups.forEach(g => {
      g.bannerRow = cursor;
      cursor += 2 + g.drops.length + 1; // banner + subheader + data rows + spacer
    });
    const lastRow = cursor - 1;

    // ── Navigator banner (row 2) ──
    ws3.mergeCells('A2:I2');
    const navBanner = ws3.getCell('A2');
    navBanner.value = `IDF Navigator  —  ${idfGroups.length} closet${idfGroups.length === 1 ? '' : 's'}  ·  click any row below to jump straight to it`;
    navBanner.font = { bold: true, italic: true, size: 9.5, color: { argb: 'FF94A3B8' }, name: 'Calibri' };
    navBanner.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    navBanner.alignment = leftAlign;
    ws3.getRow(2).height = 18;

    // ── Index header row (row 3) ──
    ws3.mergeCells(`A${INDEX_HEADER_ROW}:B${INDEX_HEADER_ROW}`);
    const idxHdrRow = ws3.getRow(INDEX_HEADER_ROW);
    idxHdrRow.height = 18;
    const idxHeaderLabels = { 1: 'IDF Closet', 3: 'Drops', 4: 'Rough Pull', 5: 'Dropped', 6: 'Field Term.', 7: 'Rack Term.', 8: 'Tested', 9: 'Complete' };
    Object.entries(idxHeaderLabels).forEach(([colNum, label]) => {
      const cell = idxHdrRow.getCell(Number(colNum));
      cell.value = label;
      cell.font = { bold: true, color: { argb: 'FFFBBF24' }, size: 9.5, name: 'Calibri' };
      cell.fill = headerFill;
      cell.border = thinBorder;
      cell.alignment = Number(colNum) === 1 ? leftAlign : centerAlign;
    });

    // ── Index data rows ──
    idfGroups.forEach((g, i) => {
      const r = INDEX_HEADER_ROW + 1 + i;
      ws3.mergeCells(`A${r}:B${r}`);
      const row = ws3.getRow(r);
      row.height = 18;
      const fill = i % 2 === 0 ? evenFill : oddFill;

      const nameCell = row.getCell(1);
      nameCell.value = { text: g.idf, hyperlink: `#'By IDF'!A${g.bannerRow}`, tooltip: `Jump to ${g.idf}` };
      nameCell.font = idfFont;
      nameCell.alignment = leftAlign;

      const idfEscaped = escapeFormulaString(g.idf);
      g.rpFormula = `COUNTIFS('Cable Drops'!$N$4:$N$${lastDataRow}, "${idfEscaped}", 'Cable Drops'!$D$4:$D$${lastDataRow}, "Yes")`;
      g.dpFormula = `COUNTIFS('Cable Drops'!$N$4:$N$${lastDataRow}, "${idfEscaped}", 'Cable Drops'!$E$4:$E$${lastDataRow}, "Yes")`;
      g.ftFormula = `COUNTIFS('Cable Drops'!$N$4:$N$${lastDataRow}, "${idfEscaped}", 'Cable Drops'!$F$4:$F$${lastDataRow}, "Yes")`;
      g.rtFormula = `COUNTIFS('Cable Drops'!$N$4:$N$${lastDataRow}, "${idfEscaped}", 'Cable Drops'!$G$4:$G$${lastDataRow}, "Yes")`;
      g.tsFormula = `COUNTIFS('Cable Drops'!$N$4:$N$${lastDataRow}, "${idfEscaped}", 'Cable Drops'!$H$4:$H$${lastDataRow}, "Yes")`;
      g.cpFormula = `COUNTIFS('Cable Drops'!$N$4:$N$${lastDataRow}, "${idfEscaped}", 'Cable Drops'!$I$4:$I$${lastDataRow}, "✓")`;

      row.getCell(3).value = g.drops.length;
      row.getCell(4).value = { formula: g.rpFormula };
      row.getCell(5).value = { formula: g.dpFormula };
      row.getCell(6).value = { formula: g.ftFormula };
      row.getCell(7).value = { formula: g.rtFormula };
      row.getCell(8).value = { formula: g.tsFormula };
      row.getCell(9).value = { formula: g.cpFormula };

      for (let c = 1; c <= 9; c++) {
        const cell = row.getCell(c);
        cell.border = thinBorder;
        cell.fill = fill;
        if (c >= 3) cell.alignment = centerAlign;
      }
    });

    // spacer row between the index and the first detail section
    ws3.getRow(INDEX_HEADER_ROW + 1 + idfGroups.length).height = 8;

    // ── Detail sections (reusing the precomputed banner rows + formulas) ──
    idfGroups.forEach(g => {
      const bannerRowNum = g.bannerRow;
      ws3.mergeCells(`A${bannerRowNum}:I${bannerRowNum}`);
      const idfHdrCell = ws3.getCell(`A${bannerRowNum}`);
      idfHdrCell.value = {
        formula: `"${escapeFormulaString(g.idf)}  —  ${g.drops.length} drops  |  RP: "&${g.rpFormula}&"  DP: "&${g.dpFormula}&"  FT: "&${g.ftFormula}&"  RT: "&${g.rtFormula}&"  TS: "&${g.tsFormula}&"  Complete: "&${g.cpFormula}&"/${g.drops.length}"`
      };
      idfHdrCell.font = { bold: true, color: { argb: 'FFFBBF24' }, size: 10, name: 'Calibri' };
      idfHdrCell.fill = headerFill;
      idfHdrCell.border = thinBorder;
      idfHdrCell.alignment = leftAlign;
      ws3.getRow(bannerRowNum).height = 18;

      const subRowNum = bannerRowNum + 1;
      const iHdrRow = ws3.getRow(subRowNum);
      iHdrRow.height = 16;
      ['Type', 'Cable ID(s)', 'Rough Pull', 'Dropped', 'Field Term.', 'Rack Term.', 'Tested', 'Complete', 'Notes'].forEach((label, idx) => {
        const cell = iHdrRow.getCell(idx + 1);
        cell.value = label;
        cell.font = subHdrFont; cell.fill = subHdrFill;
        cell.alignment = centerAlign; cell.border = thinBorder;
      });
      iHdrRow.getCell(2).alignment = leftAlign;
      iHdrRow.getCell(9).alignment = leftAlign;

      g.drops.forEach((d, i) => {
        const r = subRowNum + 1 + i;
        const cable = getCableLabel(d);
        const typeLabel = getTypeLabel(d);
        const isEven = i % 2 === 0;
        const baseFill = isEven ? evenFill : oddFill;

        const row = ws3.getRow(r);
        row.height = 18;
        row.getCell(1).value = typeLabel;
        row.getCell(2).value = cable;
        row.getCell(3).value = { formula: `'Cable Drops'!D${d._mainRowNum}` };
        row.getCell(4).value = { formula: `'Cable Drops'!E${d._mainRowNum}` };
        row.getCell(5).value = { formula: `'Cable Drops'!F${d._mainRowNum}` };
        row.getCell(6).value = { formula: `'Cable Drops'!G${d._mainRowNum}` };
        row.getCell(7).value = { formula: `'Cable Drops'!H${d._mainRowNum}` };
        row.getCell(8).value = { formula: `'Cable Drops'!I${d._mainRowNum}` };
        row.getCell(9).value = d.notes || '';

        row.eachCell((cell, col) => {
          cell.border = thinBorder;
          switch (col) {
            case 1: cell.font = doubleFont; cell.fill = baseFill; cell.alignment = centerAlign; break;
            case 2: cell.font = monoFont;   cell.fill = baseFill; cell.alignment = leftAlign;   break;
            case 3:
            case 4:
            case 5:
            case 6:
            case 7:
            case 8:
              cell.fill = baseFill; cell.alignment = centerAlign; break;
            case 9:
              cell.font = dimFont; cell.fill = baseFill; cell.alignment = { ...leftAlign, wrapText: true }; break;
            default:
              cell.fill = baseFill; break;
          }
        });
      });

      // spacer row, doubling as a quick way back up to the navigator
      const spacerRowNum = subRowNum + 1 + g.drops.length;
      const spacerRow = ws3.getRow(spacerRowNum);
      spacerRow.height = 14;
      const backCell = spacerRow.getCell(1);
      backCell.value = { text: '↑ Back to Index', hyperlink: `#'By IDF'!A${INDEX_HEADER_ROW}`, tooltip: 'Back to the IDF Navigator' };
      backCell.font = { italic: true, size: 8.5, color: { argb: 'FF94A3B8' }, name: 'Calibri', underline: true };
      backCell.alignment = leftAlign;
    });

    if (lastRow >= detailStartRow) {
      ws3.addConditionalFormatting({
        ref: `C${detailStartRow}:G${lastRow}`,
        rules: [
          { type: 'cellIs', operator: 'equal', formulae: ['"Yes"'], style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } }, font: { bold: true, color: { argb: 'FF065F46' } } } },
          { type: 'cellIs', operator: 'equal', formulae: ['"No"'], style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } }, font: { bold: true, color: { argb: 'FF991B1B' } } } }
        ],
      });
      ws3.addConditionalFormatting({
        ref: `H${detailStartRow}:H${lastRow}`,
        rules: [
          { type: 'cellIs', operator: 'equal', formulae: ['"✓"'], style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } }, font: { bold: true, color: { argb: 'FF065F46' }, size: 11 } } },
          { type: 'cellIs', operator: 'equal', formulae: ['"✗"'], style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } }, font: { bold: true, color: { argb: 'FF991B1B' }, size: 11 } } }
        ],
      });
    }

    // Highlight fully-complete closets right in the index, at a glance
    ws3.addConditionalFormatting({
      ref: `I${INDEX_HEADER_ROW + 1}:I${INDEX_HEADER_ROW + idfGroups.length}`,
      rules: [
        {
          type: 'expression',
          formulae: [`AND($C${INDEX_HEADER_ROW + 1}>0,$I${INDEX_HEADER_ROW + 1}=$C${INDEX_HEADER_ROW + 1})`],
          style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } }, font: { bold: true, color: { argb: 'FF065F46' } } }
        }
      ]
    });

    autoFitColumns(ws3, { 9: { min: 20, max: 45 } }, [2, 9]);
  }

  // ── Write & share ─────────────────────────────────────────────────────────
  const buffer   = await wb.xlsx.writeBuffer();
  const base64   = _arrayBufferToBase64(buffer);
  const safeName = (projectName || 'cable-pull').replace(/[^a-z0-9]/gi, '-').toLowerCase();
  const fileUri  = FileSystem.cacheDirectory + `${safeName}-tracker.xlsx`;
  await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });
  await Sharing.shareAsync(fileUri, {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    dialogTitle: `Share ${projectName || 'Cable Pull'} Report (Excel)`,
    UTI: 'com.microsoft.excel.xlsx',
  });
}

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
      if (typeof v === 'string')       len = v.length;
      else if (typeof v === 'number')  len = String(v).length;
      else if (v instanceof Date)      len = v.toLocaleString().length;
      else if (typeof v === 'object') {
        if (v.richText) len = v.richText.reduce((acc, r) => acc + (r.text?.length ?? 0), 0);
        else if (v.formula) len = v.result != null ? String(v.result).length : 6;
        else if (v.text != null) len = String(v.text).length;
      }
      if (len > maxLen) maxLen = len;
    });

    column.width = Math.min(maxLen + 3, max);
  });
}

function _arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) { binary += String.fromCharCode(bytes[i]); }
  return btoa(binary);
}