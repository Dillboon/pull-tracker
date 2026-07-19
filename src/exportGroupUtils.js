import * as FileSystem from 'expo-file-system';
import * as Sharing    from 'expo-sharing';
import ExcelJS         from 'exceljs';

const C = {
  navyDeep:     'FF0A1628',
  navyMid:      'FF0F172A',
  navyHeader:   'FF0F2744',
  navySection:  'FF1E2D40',
  amber:        'FFFBBF24',
  white:        'FFFFFFFF',
  purple1:      'FFF3EEFF',
  purple2:      'FFE9E0FF',
  idfBlue:      'FF1E40AF',
  typeViolet:   'FF7C3AED',
  slate:        'FF64748B',
  muted:        'FF94A3B8',
  borderSubtle: 'FFCBD5E1',
  yesFill:      'FFD1FAE5',
  yesText:      'FF065F46',   
  noFill:       'FFFEE2E2',
  noText:       'FF991B1B',   
  attnFill:     'FFFFF7ED',
  attnText:     'FFD97706',   
};

// Shared literal markers — defined once so every formula/value that needs to
// match them (COUNTIFS criteria, cell values) is guaranteed to use the exact
// same characters. "⚠️ Yes" includes a variation-selector byte that's easy to
// mistype if re-entered by hand, which would silently break exact-match formulas.
const CHECK_MARK    = '✓';
const CROSS_MARK    = '✗';
const ATTENTION_YES = '⚠️ Yes';

// Escapes a value for safe embedding inside a double-quoted Excel formula
// string literal (e.g. inside COUNTIFS("...")). Prevents a stray " in an
// IDF/project name from corrupting the generated formula.
function escapeFormulaString(s) {
  return String(s).replace(/"/g, '""');
}

function applyFill(cell, argb) {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

function applyFont(cell, { argb, bold = false, size = 10, italic = false, underline = false, name = 'Calibri' } = {}) {
  cell.font = { name, size, bold, italic, underline, color: argb ? { argb } : undefined };
}

function applyAlign(cell, horizontal = 'left', vertical = 'middle', wrapText = false) {
  cell.alignment = { horizontal, vertical, wrapText };
}

function applyBorders(cell, type = 'thin') {
  const style = type;
  cell.border = {
    top:    { style, color: { argb: C.borderSubtle } },
    left:   { style, color: { argb: C.borderSubtle } },
    bottom: { style, color: { argb: C.borderSubtle } },
    right:  { style, color: { argb: C.borderSubtle } }
  };
}

function applyStandardPageSetup(ws, printTitlesRow = '1:2') {
  ws.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0, 
    printTitlesRow,
  };
}

function rowFill(i) {
  return i % 2 === 0 ? C.purple1 : C.purple2;
}

function cableIds(drop) {
  return [drop.cableA, drop.cableB, drop.cableC, drop.cableD].filter(Boolean).join(' / ') || '—';
}

function typeName(drop) {
  const t = drop.groupType || (drop.isDouble ? 'double' : 'single');
  const baseLabel = t.charAt(0).toUpperCase() + t.slice(1);
  return drop.customType ? `${drop.customType} (${baseLabel})` : baseLabel;
}

function isAttention(drop) {
  return drop.attention === true; 
}

function getPatchedLabel(drop) {
  const patchedIds = [];
  if (drop.patchedA && drop.cableA) patchedIds.push(drop.cableA);
  if (drop.patchedB && drop.cableB) patchedIds.push(drop.cableB);
  if (drop.patchedC && drop.cableC) patchedIds.push(drop.cableC);
  if (drop.patchedD && drop.cableD) patchedIds.push(drop.cableD);
  return patchedIds.length > 0 ? `Yes (${patchedIds.join('/')})` : 'No';
}

function natSort(a, b) {
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
}

function getSortedDrops(drops) {
  return [...drops].sort((a, b) => {
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
}

// Computes, purely from a project's already-sorted drops, the row each drop
// will occupy in buildProjectSheet's table (data starts at `startRow`) and
// the first row each IDF appears on. Both buildProjectSheet and any sheet
// that needs to link into it (Attention Flags, By IDF) read from this same
// precomputed layout, so every sheet agrees on row numbers regardless of the
// order the sheets happen to be built in.
function computeRowLayout(sortedDrops, startRow = 4) {
  const dropRow = new Map();
  const idfFirstRow = new Map();
  sortedDrops.forEach((drop, i) => {
    const rowNum = startRow + i;
    dropRow.set(drop, rowNum);
    if (drop.idf && !idfFirstRow.has(drop.idf)) idfFirstRow.set(drop.idf, rowNum);
  });
  return { dropRow, idfFirstRow };
}

const dvYesNo = {
  type: 'list',
  allowBlank: false,
  showErrorMessage: true,
  errorTitle: 'Invalid Data Entry',
  error: 'Please pick a status option from the dropdown list (Yes/No).',
  formulae: ['"Yes,No"'],
};

// ── 1. Portfolio Summary Sheet ───────────────────────

function buildSummarySheet(wb, group, projects, projectSheetMap) {
  const ws = wb.addWorksheet('Portfolio Summary', { tabColor: { argb: 'FF0A1628' } });
  applyStandardPageSetup(ws, '1:8');
  
  const COL_COUNT = 9;
  [30, 13, 13, 12, 14, 14, 13, 13, 15].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 8 }];

  ws.mergeCells(1, 1, 1, COL_COUNT);
  const titleCell = ws.getCell('A1');
  titleCell.value = `Portfolio Dashboard  —  ${group.name}`;
  applyFill(titleCell, C.navyDeep);
  applyFont(titleCell, { argb: C.white, bold: true, size: 14 });
  applyAlign(titleCell, 'left');
  ws.getRow(1).height = 28;

  ws.mergeCells(2, 1, 2, COL_COUNT - 1);
  const subCell = ws.getCell('A2');
  subCell.value = `Master Portfolio Status  |  Generated: ${new Date().toLocaleString()}  |  Active Target Trackers`;
  applyFill(subCell, C.navyMid);
  applyFont(subCell, { argb: C.muted, size: 9.5, italic: true });
  applyAlign(subCell, 'left');

  const idfNavCell = ws.getCell(2, COL_COUNT);
  idfNavCell.value = { text: '🔗 By IDF Index', hyperlink: `#'By IDF'!A1`, tooltip: 'Jump to the IDF Closet Index to find and open any closet' };
  applyFill(idfNavCell, C.navyMid);
  applyFont(idfNavCell, { argb: C.amber, bold: true, size: 9.5, underline: true });
  applyAlign(idfNavCell, 'right');

  ws.getRow(2).height = 20;

  ws.getRow(3).height = 8;
  ws.getRow(4).height = 18;
  ws.getRow(5).height = 24;
  ws.getRow(6).height = 14;

  const kpis = [
    { startCol: 1, endCol: 2, label: 'TOTAL PROJECTS', formula: `="${projects.length} Active"`, fill: C.purple1, textCol: C.navyDeep },
    { startCol: 3, endCol: 4, label: 'TOTAL DROPS', formula: `=SUM(B9:B${8 + projects.length})`, fill: C.purple2, textCol: C.idfBlue },
    { startCol: 5, endCol: 6, label: 'ATTENTION FLAGS', formula: `=SUM(H9:H${8 + projects.length})`, fill: C.noFill, textCol: C.noText },
    { startCol: 7, endCol: 9, label: 'COMPLETION RATE', formula: `=AVERAGE(I9:I${8 + projects.length})`, fill: C.yesFill, textCol: C.yesText, format: '0.0%' }
  ];

  kpis.forEach(kpi => {
    ws.mergeCells(4, kpi.startCol, 4, kpi.endCol);
    ws.mergeCells(5, kpi.startCol, 5, kpi.endCol);
    ws.mergeCells(6, kpi.startCol, 6, kpi.endCol);

    const lblCell = ws.getCell(4, kpi.startCol);
    lblCell.value = kpi.label;
    applyFont(lblCell, { size: 8.5, bold: true, argb: C.slate });
    applyAlign(lblCell, 'center');

    const valCell = ws.getCell(5, kpi.startCol);
    valCell.value = kpi.formula.startsWith('=') ? { formula: kpi.formula.substring(1) } : kpi.formula;
    applyFont(valCell, { size: 16, bold: true, argb: kpi.textCol });
    applyAlign(valCell, 'center');
    if (kpi.format) valCell.numFmt = kpi.format;

    for (let r = 4; r <= 6; r++) {
      for (let c = kpi.startCol; c <= kpi.endCol; c++) {
        const cell = ws.getCell(r, c);
        applyFill(cell, kpi.fill);
        applyBorders(cell, 'thin');
      }
    }
  });

  ws.getRow(7).height = 10;

  const headers = ['Projects', 'Total Drops', 'Rough Pulled', 'Dropped', 'Field Terminated', 'Rack Terminated', 'Tested', 'Attention Flags', 'Progress %'];
  const hRow = ws.getRow(8);
  hRow.height = 24;
  headers.forEach((lbl, i) => {
    const cell = hRow.getCell(i + 1);
    cell.value = lbl;
    applyFill(cell, C.navyHeader);
    applyFont(cell, { argb: C.amber, bold: true, size: 10 });
    applyAlign(cell, i === 0 ? 'left' : 'center');
    applyBorders(cell, 'thin');
  });

  ws.autoFilter = { from: { row: 8, column: 1 }, to: { row: 8, column: COL_COUNT } };

  projects.forEach((p, idx) => {
    const rowNum = 9 + idx;
    const targetSheet = projectSheetMap.get(p.id || p.name);
    const escapedSheet = `'${targetSheet.replace(/'/g, "''")}'`;
    const fill = rowFill(idx);
    
    const totalDrops = p.drops.length;
    const endDataRow = 3 + totalDrops;

    const row = ws.getRow(rowNum);
    row.height = 22;

    const nameCell = row.getCell(1);
    nameCell.value = {
      text: p.name,
      hyperlink: `#'${targetSheet}'!A1`,
      tooltip: `Maps to ${p.name} Details`
    };
    applyFont(nameCell, { argb: C.idfBlue, bold: true, underline: true, size: 10.5 });
    applyAlign(nameCell, 'left');

    row.getCell(2).value = totalDrops > 0 ? { formula: `COUNTA(${escapedSheet}!A4:A${endDataRow})` } : 0;
    row.getCell(3).value = totalDrops > 0 ? { formula: `COUNTIF(${escapedSheet}!D4:D${endDataRow}, "Yes")` } : 0;
    row.getCell(4).value = totalDrops > 0 ? { formula: `COUNTIF(${escapedSheet}!E4:E${endDataRow}, "Yes")` } : 0;
    row.getCell(5).value = totalDrops > 0 ? { formula: `COUNTIF(${escapedSheet}!F4:F${endDataRow}, "Yes")` } : 0;
    row.getCell(6).value = totalDrops > 0 ? { formula: `COUNTIF(${escapedSheet}!G4:G${endDataRow}, "Yes")` } : 0;
    row.getCell(7).value = totalDrops > 0 ? { formula: `COUNTIF(${escapedSheet}!H4:H${endDataRow}, "Yes")` } : 0;
    row.getCell(8).value = totalDrops > 0 ? { formula: `COUNTIF(${escapedSheet}!K4:K${endDataRow}, "${ATTENTION_YES}")` } : 0;
    // Average completion across all 5 stages (Rough Pull, Dropped, Field
    // Term, Rack Term, Tested) rather than only counting drops that are
    // 100% done — reuses the live counts already sitting in C:G on this row.
    row.getCell(9).value = totalDrops > 0 ? { formula: `IFERROR((C${rowNum}+D${rowNum}+E${rowNum}+F${rowNum}+G${rowNum})/(5*B${rowNum}),0)` } : 0;

    for (let c = 1; c <= COL_COUNT; c++) {
      const cell = row.getCell(c);
      applyBorders(cell, 'thin');
      if (c > 1) {
        applyFill(cell, fill);
        applyAlign(cell, 'center');
        applyFont(cell, { size: 10 });
      } else {
        applyFill(cell, fill);
      }
      if (c === 9) {
        cell.numFmt = '0%';
        applyFont(cell, { bold: true, size: 10.5 });
      }
    }
  });

  const totalRowNum = 9 + projects.length;
  const totRow = ws.getRow(totalRowNum);
  totRow.height = 24;

  totRow.getCell(1).value = 'TOTAL COMPLETION PROGRESS';
  totRow.getCell(2).value = { formula: `SUM(B9:B${totalRowNum - 1})` };
  totRow.getCell(3).value = { formula: `SUM(C9:C${totalRowNum - 1})` };
  totRow.getCell(4).value = { formula: `SUM(D9:D${totalRowNum - 1})` };
  totRow.getCell(5).value = { formula: `SUM(E9:E${totalRowNum - 1})` };
  totRow.getCell(6).value = { formula: `SUM(F9:F${totalRowNum - 1})` };
  totRow.getCell(7).value = { formula: `SUM(G9:G${totalRowNum - 1})` };
  totRow.getCell(8).value = { formula: `SUM(H9:H${totalRowNum - 1})` };
  totRow.getCell(9).value = { formula: `IFERROR(SUMPRODUCT(B9:B${totalRowNum - 1}, I9:I${totalRowNum - 1}) / B${totalRowNum}, 0)` };

  for (let c = 1; c <= COL_COUNT; c++) {
    const cell = totRow.getCell(c);
    applyFill(cell, C.navyHeader);
    applyBorders(cell, 'thin');
    applyFont(cell, { argb: C.amber, bold: true, size: 11 });
    applyAlign(cell, c === 1 ? 'left' : 'center');
    if (c === 9) cell.numFmt = '0%';
  }

  if (projects.length > 0) {
    ws.addConditionalFormatting({
      ref: `I9:I${totalRowNum - 1}`,
      rules: [
        {
          type: 'cellIs', operator: 'equal', formulae: ['1'],
          style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: C.yesFill } }, font: { bold: true, color: { argb: C.yesText } } }
        },
        {
          type: 'cellIs', operator: 'between', formulae: ['0.01', '0.99'],
          style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: C.attnFill } }, font: { bold: true, color: { argb: C.attnText } } }
        }
      ]
    });
    ws.addConditionalFormatting({
      ref: `H9:H${totalRowNum - 1}`,
      rules: [
        {
          type: 'cellIs', operator: 'greaterThan', formulae: ['0'],
          style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: C.noFill } }, font: { bold: true, color: { argb: C.noText } } }
        }
      ]
    });
  }

  autoFitColumns(ws, { 1: { min: 32, max: 45 } }, [1]);
}

// ── 2. By IDF Index Sheet ─────────────────────
// A flat, filterable table — one row per (Project, IDF Closet) pair — rather
// than the stacked/banner layout used in the single-project export. At
// portfolio scale a stacked layout is exactly what makes many closets
// tedious to scroll through, so here every closet is a single row you can
// filter, sort, or click straight into. Each row links two levels deep:
// the Project cell jumps to that project's sheet, and the IDF Closet cell
// jumps straight to that closet's first row within it.
function buildIdfIndexSheet(wb, group, projects, projectSheetMap, projectSortedDrops, projectRowLayouts) {
  const ws = wb.addWorksheet('By IDF', { tabColor: { argb: 'FFF59E0B' } });
  applyStandardPageSetup(ws, '1:3');

  const COL_COUNT = 10;
  const widths = [26, 20, 9, 12, 12, 12, 12, 10, 11, 12];
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 3 }];

  ws.mergeCells(1, 1, 1, COL_COUNT);
  const titleCell = ws.getCell('A1');
  titleCell.value = `IDF Closet Index  —  ${group.name}`;
  applyFill(titleCell, C.navyDeep);
  applyFont(titleCell, { argb: C.white, bold: true, size: 14 });
  applyAlign(titleCell, 'left');
  ws.getRow(1).height = 28;

  ws.mergeCells(2, 1, 2, COL_COUNT);
  const subCell = ws.getCell('A2');
  subCell.value = `Every IDF closet across the portfolio  |  Click a row to jump straight to it  |  Generated: ${new Date().toLocaleString()}`;
  applyFill(subCell, C.navyMid);
  applyFont(subCell, { argb: C.muted, size: 9.5, italic: true });
  applyAlign(subCell, 'left');
  ws.getRow(2).height = 20;

  const headers = ['Project', 'IDF Closet', 'Drops', 'Rough Pull', 'Dropped', 'Field Term.', 'Rack Term.', 'Tested', 'Attention', 'Progress %'];
  const hRow = ws.getRow(3);
  hRow.height = 22;
  headers.forEach((label, i) => {
    const cell = hRow.getCell(i + 1);
    cell.value = label;
    applyFill(cell, C.navyHeader);
    applyFont(cell, { argb: C.amber, bold: true, size: 10 });
    applyAlign(cell, i <= 1 ? 'left' : 'center');
    applyBorders(cell, 'thin');
  });

  ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: COL_COUNT } };

  let rowNum = 3;
  let idfRowCount = 0;

  projects.forEach(p => {
    const key = p.id || p.name;
    const targetSheet = projectSheetMap.get(key);
    const escapedSheet = `'${targetSheet.replace(/'/g, "''")}'`;
    const sortedDrops = projectSortedDrops.get(key) || [];
    const rowLayout = projectRowLayouts.get(key);
    const endDataRow = 3 + sortedDrops.length;

    // Unique IDFs for this project, preserving the natural sort order
    // getSortedDrops already established (re-sorting lexicographically here
    // would put "IDF-10" before "IDF-2").
    const seen = new Set();
    const idfsInOrder = [];
    sortedDrops.forEach(d => { if (d.idf && !seen.has(d.idf)) { seen.add(d.idf); idfsInOrder.push(d.idf); } });

    idfsInOrder.forEach((idf, idx) => {
      rowNum++;
      idfRowCount++;
      const targetRow = (rowLayout && rowLayout.idfFirstRow.get(idf)) || 4;
      const idfEscaped = escapeFormulaString(idf);
      const totalCount = sortedDrops.filter(d => d.idf === idf).length;
      const fill = rowFill(idx);

      const rpFormula = `COUNTIFS(${escapedSheet}!$N$4:$N$${endDataRow}, "${idfEscaped}", ${escapedSheet}!$D$4:$D$${endDataRow}, "Yes")`;
      const dpFormula = `COUNTIFS(${escapedSheet}!$N$4:$N$${endDataRow}, "${idfEscaped}", ${escapedSheet}!$E$4:$E$${endDataRow}, "Yes")`;
      const ftFormula = `COUNTIFS(${escapedSheet}!$N$4:$N$${endDataRow}, "${idfEscaped}", ${escapedSheet}!$F$4:$F$${endDataRow}, "Yes")`;
      const rtFormula = `COUNTIFS(${escapedSheet}!$N$4:$N$${endDataRow}, "${idfEscaped}", ${escapedSheet}!$G$4:$G$${endDataRow}, "Yes")`;
      const tsFormula = `COUNTIFS(${escapedSheet}!$N$4:$N$${endDataRow}, "${idfEscaped}", ${escapedSheet}!$H$4:$H$${endDataRow}, "Yes")`;
      const atFormula = `COUNTIFS(${escapedSheet}!$N$4:$N$${endDataRow}, "${idfEscaped}", ${escapedSheet}!$K$4:$K$${endDataRow}, "${ATTENTION_YES}")`;

      const row = ws.getRow(rowNum);
      row.height = 20;

      const projCell = row.getCell(1);
      projCell.value = { text: p.name, hyperlink: `#${escapedSheet}!A1`, tooltip: `Jump to ${p.name}` };
      applyFont(projCell, { argb: C.idfBlue, bold: true, underline: true, size: 9.5 });

      const idfCell = row.getCell(2);
      idfCell.value = { text: idf, hyperlink: `#${escapedSheet}!A${targetRow}`, tooltip: `Jump to ${idf} in ${p.name}` };
      applyFont(idfCell, { argb: C.typeViolet, bold: true, underline: true, size: 10 });

      row.getCell(3).value = totalCount;
      row.getCell(4).value = { formula: rpFormula };
      row.getCell(5).value = { formula: dpFormula };
      row.getCell(6).value = { formula: ftFormula };
      row.getCell(7).value = { formula: rtFormula };
      row.getCell(8).value = { formula: tsFormula };
      row.getCell(9).value = { formula: atFormula };
      // Average completion across all 5 stages (Rough Pull, Dropped, Field
      // Term, Rack Term, Tested) rather than only counting drops that are
      // 100% done — a drop that's 4 of 5 stages finished now contributes
      // 80%, not 0%.
      row.getCell(10).value = { formula: `IFERROR((${rpFormula}+${dpFormula}+${ftFormula}+${rtFormula}+${tsFormula})/(5*${totalCount || 1}),0)` };
      row.getCell(10).numFmt = '0%';


      for (let c = 1; c <= COL_COUNT; c++) {
        const cell = row.getCell(c);
        applyBorders(cell, 'thin');
        applyFill(cell, fill);
        if (c > 2) applyAlign(cell, 'center');
        if (c === 3 || c === 9) applyFont(cell, { size: 10 });
      }
    });
  });

  if (idfRowCount === 0) {
    const emptyRow = ws.getRow(4);
    emptyRow.height = 30;
    ws.mergeCells(4, 1, 4, COL_COUNT);
    const cell = emptyRow.getCell(1);
    cell.value = 'No IDF closets have been assigned to any drops yet.';
    applyFill(cell, C.attnFill);
    applyFont(cell, { argb: C.attnText, bold: true, italic: true, size: 11 });
    applyAlign(cell, 'center');
    applyBorders(cell, 'thin');
  } else {
    ws.addConditionalFormatting({
      ref: `J4:J${rowNum}`,
      rules: [
        { type: 'cellIs', operator: 'equal', formulae: ['1'], style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: C.yesFill } }, font: { bold: true, color: { argb: C.yesText } } } }
      ]
    });
    ws.addConditionalFormatting({
      ref: `I4:I${rowNum}`,
      rules: [
        { type: 'cellIs', operator: 'greaterThan', formulae: ['0'], style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: C.noFill } }, font: { bold: true, color: { argb: C.noText } } } }
      ]
    });
  }

  autoFitColumns(ws, {}, [1, 2]);
}

// ── 3. Attention Flags Sheet ─────────────────────

function buildAttentionLogSheet(wb, group, projects, projectSheetMap, projectSortedDrops, projectRowLayouts) {
  const ws = wb.addWorksheet('Attention Flags', { tabColor: { argb: C.noText } });
  applyStandardPageSetup(ws, '1:2');

  const COL_COUNT = 7;
  const widths = [24, 12, 16, 18, 16, 45, 14];
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 2 }];

  bannerRow(ws, 1, 'Attention Log', C.noText, C.white, 13, 26);
  ws.mergeCells(1, 1, 1, COL_COUNT);

  const headerLabels = ['Project', 'IDF Closet', 'Drop Type', 'Cable IDs', 'Patched', 'Notes', 'Last Updated'];
  const hRow = ws.getRow(2);
  hRow.height = 22;
  headerLabels.forEach((lbl, i) => {
    const cell = hRow.getCell(i + 1);
    cell.value = lbl;
    applyFill(cell, C.navyHeader);
    applyFont(cell, { argb: C.amber, bold: true, size: 10 });
    applyAlign(cell, i === 0 || i === 3 || i === 5 ? 'left' : 'center');
    applyBorders(cell, 'thin');
  });

  ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: COL_COUNT } };

  let logCount = 0;

  projects.forEach((p) => {
    const key = p.id || p.name;
    const targetSheet = projectSheetMap.get(key);
    const sortedLogDrops = projectSortedDrops.get(key) || getSortedDrops(p.drops);
    const rowLayout = projectRowLayouts.get(key);
    
    sortedLogDrops.forEach((drop) => {
      if (!isAttention(drop)) return; 

      logCount++;
      const rowNum = 2 + logCount;
      const row = ws.getRow(rowNum);
      row.height = 24;
      
      const mainSheetRowIndex = (rowLayout && rowLayout.dropRow.get(drop)) || 4; 
      const projCell = row.getCell(1);
      projCell.value = {
        text: p.name,
        hyperlink: `#'${targetSheet}'!A${mainSheetRowIndex}`,
        tooltip: `Jump to drop line record item`
      };
      applyFont(projCell, { argb: C.idfBlue, bold: true, underline: true, size: 9.5 });
      applyFill(projCell, C.attnFill);
      applyBorders(projCell, 'thin');

      row.getCell(2).value = drop.idf ? `${drop.idf}${drop.rackNumber ? ` · R${drop.rackNumber}` : ''}` : '';
      row.getCell(3).value = typeName(drop);
      row.getCell(4).value = cableIds(drop);
      row.getCell(5).value = getPatchedLabel(drop);
      row.getCell(6).value = drop.notes || 'No blocker details specified by technician.';
      row.getCell(7).value = drop.updatedAt || drop.createdAt || '';

      for (let c = 2; c <= COL_COUNT; c++) {
        const cell = row.getCell(c);
        applyFill(cell, C.attnFill);
        applyBorders(cell, 'thin');
        applyFont(cell, { argb: c === 6 ? C.noText : C.navyDeep, size: 9.5, bold: c === 2 || c === 6 });
        applyAlign(cell, c === 4 || c === 6 ? 'left' : 'center', 'middle', c === 6);
      }
    });
  });

  if (logCount === 0) {
    const emptyRow = ws.getRow(3);
    emptyRow.height = 30;
    ws.mergeCells(3, 1, 3, COL_COUNT);
    const cell = emptyRow.getCell(1);
    cell.value = `${CHECK_MARK} No active attention flags or deployment blockers reported across current projects.`;
    applyFill(cell, C.yesFill);
    applyFont(cell, { argb: C.yesText, bold: true, italic: true, size: 11 });
    applyAlign(cell, 'center');
    applyBorders(cell, 'thin');
  }

  autoFitColumns(ws, { 6: { min: 30, max: 50 } }, [3, 4, 6]);
}

// ── 4. Individual Project Detailed Drops Sheet ───────────────────────────────

function buildProjectSheet(wb, project, sheetName, sortedDrops, rowLayout) {
  const ws = wb.addWorksheet(sheetName, { tabColor: { argb: 'FF3B82F6' } });
  applyStandardPageSetup(ws, '1:3');
  
  const COL_COUNT = 13;
  const widths = [12, 14, 22, 13, 12, 14, 14, 11, 11, 15, 14, 50, 15, 4];
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  ws.getColumn(14).hidden = true; // raw IDF value, used by the By IDF index's lookups
  
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 3 }];

  ws.mergeCells(1, 1, 1, COL_COUNT);
  const titleCell = ws.getCell('A1');
  titleCell.value = project.name;
  applyFill(titleCell, C.navyDeep);
  applyFont(titleCell, { argb: C.white, bold: true, size: 13 });
  applyAlign(titleCell, 'left');
  ws.getRow(1).height = 26;

  ws.mergeCells(2, 1, 2, COL_COUNT);
  const subCell = ws.getCell('A2');
  
  const totalDrops = project.drops.length;
  const roughCount = project.drops.filter(d => d.roughPull || d.overrideComplete).length;
  const dropCount  = project.drops.filter(d => d.dropped || d.overrideComplete).length;
  const termCount  = project.drops.filter(d => d.terminated || d.overrideComplete).length;
  const rackCount  = project.drops.filter(d => d.rackTerminated || d.overrideComplete).length;
  const testCount  = project.drops.filter(d => d.tested || d.overrideComplete).length;
  const attnCount  = project.drops.filter(isAttention).length;

  subCell.value = `Generated: ${new Date().toLocaleString()}  |  Total: (${totalDrops})  |  Rough pulled: (${roughCount})  |  Dropped: (${dropCount})  |  Field Terminated: (${termCount})  |  Rack Terminated: (${rackCount})  |  Tested: (${testCount})  |  Attention: (${attnCount})`;
  applyFill(subCell, C.navyMid);
  applyFont(subCell, { argb: C.muted, size: 9.5, italic: true });
  applyAlign(subCell, 'left');
  ws.getRow(2).height = 20;

  const headers = ['IDF Closet', 'Drop Type', 'Cable IDs', 'Rough Pull', 'Dropped', 'Field Term.', 'Rack Term.', 'Tested', 'Complete', 'Patched', 'Attention', 'Notes', 'Last Updated', 'IDF Key'];
  headerRow(ws, 3, headers, 22);

  ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: COL_COUNT } };

  const sortedProjectDrops = sortedDrops || getSortedDrops(project.drops);

  sortedProjectDrops.forEach((drop, i) => {
    const rowNum = 4 + i;
    
    const fill = rowFill(i);
    const hasBlocker = isAttention(drop);

    const row = ws.getRow(rowNum);
    row.height = 22;

    row.getCell(1).value = drop.idf ? `${drop.idf}${drop.rackNumber ? ` · R${drop.rackNumber}` : ''}` : '';
    row.getCell(2).value = typeName(drop);
    row.getCell(3).value = cableIds(drop);
    row.getCell(4).value = (drop.roughPull      || drop.overrideComplete) ? 'Yes' : 'No';
    row.getCell(5).value = (drop.dropped        || drop.overrideComplete) ? 'Yes' : 'No';
    row.getCell(6).value = (drop.terminated     || drop.overrideComplete) ? 'Yes' : 'No';
    row.getCell(7).value = (drop.rackTerminated || drop.overrideComplete) ? 'Yes' : 'No';
    row.getCell(8).value = (drop.tested         || drop.overrideComplete) ? 'Yes' : 'No';
    
    // Fallback OR check block
    row.getCell(9).value = { 
      formula: `IF(OR(${drop.overrideComplete ? 'TRUE' : 'FALSE'},AND(D${rowNum}="Yes",E${rowNum}="Yes",F${rowNum}="Yes",G${rowNum}="Yes",H${rowNum}="Yes")),"${CHECK_MARK}","${CROSS_MARK}")` 
    };
    
    row.getCell(10).value = getPatchedLabel(drop);
    row.getCell(11).value = hasBlocker ? ATTENTION_YES : 'No';
    row.getCell(12).value = drop.notes || '';
    row.getCell(13).value = drop.updatedAt || drop.createdAt || '';
    row.getCell(14).value = drop.idf || '';

    for (let c = 1; c <= COL_COUNT; c++) {
      const cell = row.getCell(c);
      cell.border = {
        top:    { style: 'thin', color: { argb: C.borderSubtle } },
        left:   { style: 'thin', color: { argb: C.borderSubtle } },
        bottom: { style: 'thin', color: { argb: C.borderSubtle } },
        right:  { style: 'thin', color: { argb: C.borderSubtle } }
      };
      
      switch (c) {
        case 1:
          applyFill(cell, fill); applyFont(cell, { argb: C.idfBlue, bold: true, size: 10 }); applyAlign(cell, 'center');
          break;
        case 2:
          applyFill(cell, fill); applyFont(cell, { argb: C.typeViolet, bold: true, size: 10 }); applyAlign(cell, 'center');
          break;
        case 3:
          applyFill(cell, fill); applyFont(cell, { size: 10, name: 'Courier New' }); applyAlign(cell, 'left');
          break;
        case 4:
        case 5:
        case 6:
        case 7:
        case 8:
          applyFill(cell, fill); applyFont(cell, { size: 10 }); applyAlign(cell, 'center');
          cell.dataValidation = dvYesNo;
          cell.protection = { locked: false };
          break;
        case 9:
          applyFill(cell, fill); applyAlign(cell, 'center');
          break;
        case 10:
          applyFill(cell, fill); applyAlign(cell, 'center');
          applyFont(cell, { size: 9.5, argb: cell.value === 'No' ? C.slate : C.yesText, bold: cell.value !== 'No' });
          break;
        case 11:
          applyFill(cell, hasBlocker ? C.attnFill : fill);
          applyFont(cell, { argb: hasBlocker ? C.attnText : C.muted, bold: hasBlocker, size: 10 });
          applyAlign(cell, 'center');
          break;
        case 12:
          applyFill(cell, fill); applyFont(cell, { argb: C.slate, size: 9 }); applyAlign(cell, 'left', 'middle', true);
          cell.protection = { locked: false };
          break;
        case 13:
          applyFill(cell, fill); applyFont(cell, { argb: C.slate, size: 9 }); applyAlign(cell, 'center');
          break;
      }
    }
  });

  const totalRows = project.drops.length;
  if (totalRows > 0) {
    const endRow = 3 + totalRows;
    ws.addConditionalFormatting({
      ref: `D4:H${endRow}`,
      rules: [
        {
          type: 'cellIs', operator: 'equal', formulae: ['"Yes"'],
          style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: C.yesFill } }, font: { bold: true, color: { argb: C.yesText } } }
        },
        {
          type: 'cellIs', operator: 'equal', formulae: ['"No"'],
          style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: C.noFill } }, font: { bold: true, color: { argb: C.noText } } }
        }
      ]
    });
    ws.addConditionalFormatting({
      ref: `I4:I${endRow}`,
      rules: [
        {
          type: 'cellIs', operator: 'equal', formulae: ['"✓"'],
          style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: C.yesFill } }, font: { bold: true, color: { argb: C.yesText }, size: 11 } }
        },
        {
          type: 'cellIs', operator: 'equal', formulae: ['"✗"'],
          style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: C.noFill } }, font: { bold: true, color: { argb: C.noText }, size: 11 } }
        }
      ]
    });
  }

  // These previously lived inside the `if (totalRows > 0)` block above, which
  // meant a brand-new project with zero drops yet was left unprotected and
  // un-autofit. They should apply regardless of whether drops exist yet.
  autoFitColumns(ws, { 12: { min: 22, max: 50 }, 13: { min: 14, max: 20 } }, [2, 12, 13]);

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
}

function bannerRow(ws, rowNum, text, bgTransformColor, fgTransformColor, sz, height) {
  const row = ws.getRow(rowNum);
  row.height = height;
  const cell = row.getCell(1);
  cell.value = text;
  applyFill(cell, bgTransformColor);
  applyFont(cell, { argb: fgTransformColor, bold: true, size: sz });
  applyAlign(cell, 'left');
  return row;
}

function headerRow(ws, rowNum, labels, height = 20) {
  const row = ws.getRow(rowNum);
  row.height = height;
  labels.forEach((label, i) => {
    const cell = row.getCell(i + 1);
    cell.value = label;
    applyFill(cell, C.navyHeader);
    applyFont(cell, { argb: C.amber, bold: true, size: 10 });
    applyAlign(cell, i === 0 || i === 2 || i === 11 ? 'left' : 'center'); 
    cell.border = {
      top: { style: 'medium', color: { argb: C.navyDeep } },
      bottom: { style: 'medium', color: { argb: C.navyDeep } }
    };
  });
  return row;
}

function autoFitColumns(worksheet, overrides = {}, only = null) {
  const DEFAULT_MIN = 9;
  const DEFAULT_MAX = 45;

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
        if (v.richText) {
          len = v.richText.reduce((acc, r) => acc + (r.text?.length ?? 0), 0);
        } else if (v.formula) {
          len = v.result != null ? String(v.result).length : 7;
        } else if (v.text != null) {
          len = String(v.text).length;
        }
      }

      if (len > maxLen) maxLen = len;
    });

    column.width = Math.min(maxLen + 3, max);
  });
}

function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let out = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    out += String.fromCharCode(...bytes.subarray(i, Math.min(i + 8192, bytes.length)));
  }
  return btoa(out);
}

export async function exportGroupToExcel(group, projects) {
  if (!projects || projects.length === 0) {
    throw new Error('No project database metrics found available to export.');
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = 'CablePull Production Engine';
  wb.created = new Date();

  const projectSheetMap = new Map();
  const targetedTabNames = new Set(['Portfolio Summary', 'By IDF', 'Attention Flags']);

  projects.forEach(p => {
    let sanitizedName = p.name.replace(/[\\/*?[\]:]/g, '').trim().slice(0, 26);
    let potentialTabTitle = sanitizedName;
    let fallbackSalt = 2;
    
    while (targetedTabNames.has(potentialTabTitle)) {
      potentialTabTitle = `${sanitizedName.slice(0, 22)} ${fallbackSalt++}`;
    }
    targetedTabNames.add(potentialTabTitle);
    projectSheetMap.set(p.id || p.name, potentialTabTitle);
  });

  // Precompute sorted drops + row layout for every project once, up front.
  // Attention Flags, By IDF, and each project's own sheet all read from this
  // same source of truth, so their jump-to-row links are correct regardless
  // of which order the sheets below are actually built in.
  const projectSortedDrops = new Map();
  const projectRowLayouts  = new Map();
  projects.forEach(p => {
    const key = p.id || p.name;
    const sorted = getSortedDrops(p.drops);
    projectSortedDrops.set(key, sorted);
    projectRowLayouts.set(key, computeRowLayout(sorted, 4));
  });

  buildSummarySheet(wb, group, projects, projectSheetMap);
  buildIdfIndexSheet(wb, group, projects, projectSheetMap, projectSortedDrops, projectRowLayouts);
  buildAttentionLogSheet(wb, group, projects, projectSheetMap, projectSortedDrops, projectRowLayouts);

  for (const project of projects) {
    const key = project.id || project.name;
    const trackingTabTitle = projectSheetMap.get(key);
    buildProjectSheet(wb, project, trackingTabTitle, projectSortedDrops.get(key), projectRowLayouts.get(key));
  }

  const buffer = await wb.xlsx.writeBuffer();
  const base64 = toBase64(buffer);
  const safeFilenameToken = group.name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 35);
  const targetURIPath = `${FileSystem.cacheDirectory}${safeFilenameToken}_PortfolioReport_${Date.now()}.xlsx`;

  await FileSystem.writeAsStringAsync(targetURIPath, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const deviceSharingReady = await Sharing.isAvailableAsync();
  if (!deviceSharingReady) throw new Error('OS native sharing utility dialog system handles are unreachable.');

  await Sharing.shareAsync(targetURIPath, {
    mimeType:    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    dialogTitle: `Executive Portfolio Delivery Share: ${group.name}`,
    UTI:         'com.microsoft.excel.xlsx',
  });
}