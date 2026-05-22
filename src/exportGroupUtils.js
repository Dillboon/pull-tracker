/**
 * exportGroupUtils.js
 *
 * Enhanced Group Portfolio "Export All" — Visually polished, fully interactive, 
 * and optimized for Executive Project Manager workflows.
 * 
 * Features:
 *  - Live Sheet-to-Sheet Formula Tracking (Summary updates dynamically when drops change)
 *  - Executive KPI Summary Cards
 *  - Portfolio-Wide Consolidated Attention Summary Log
 *  - Data Validations, Conditional Formatting, & Print-Ready Layouts
 */

import * as FileSystem from 'expo-file-system';
import * as Sharing    from 'expo-sharing';
import ExcelJS         from 'exceljs';

// ── Exact Colour Palette ─────────────────────────────────────────────────────
const C = {
  navyDeep:     'FF0A1628',   // Primary Executive Dark Header
  navyMid:      'FF0F172A',   // Subtitle / Dark Accent
  navyHeader:   'FF0F2744',   // Column-header background
  navySection:  'FF1E2D40',   // Section-divider background
  amber:        'FFFBBF24',   // High-contrast text accent (Gold)
  white:        'FFFFFFFF',
  purple1:      'FFF3EEFF',   // Alternating zebra row A
  purple2:      'FFE9E0FF',   // Alternating zebra row B
  idfBlue:      'FF1E40AF',   // IDF Identifier styling text
  typeViolet:   'FF7C3AED',   // Drop type label color
  slate:        'FF64748B',   // Muted gray for timestamps
  muted:        'FF94A3B8',   // Light gray borders/subtitles
  borderSubtle: 'FFCBD5E1',   // Clean thin gridline border
  
  // Status & Alert Badges
  yesFill:      'FFD1FAE5',   // Soft success green
  yesText:      'FF065F46',   
  noFill:       'FFFEE2E2',   // Soft failure red
  noText:       'FF991B1B',   
  attnFill:     'FFFFF7ED',   // Warm warning amber/yellow
  attnText:     'FFD97706',   
};

// ── Cell Styling Helpers ─────────────────────────────────────────────────────

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

// Master Layout Setup for Print/PDF Engine
function applyStandardPageSetup(ws, printTitlesRow = '1:2') {
  ws.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0, 
    printTitlesRow, // Keeps headers locked on multi-page printouts
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
  return t.charAt(0).toUpperCase() + t.slice(1);
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

// Data validation configurations for fields
const dvYesNo = {
  type: 'list',
  allowBlank: false,
  showErrorMessage: true,
  errorTitle: 'Invalid Data Entry',
  error: 'Please pick a status option from the dropdown list (Yes/No).',
  formulae: ['"Yes,No"'],
};

// ── 1. Portfolio Summary Sheet (With Live Formulas & KPIs) ───────────────────────

function buildSummarySheet(wb, group, projects, projectSheetMap) {
  const ws = wb.addWorksheet('Portfolio Summary', { tabColor: { argb: 'FF0A1628' } });
  applyStandardPageSetup(ws, '1:8');
  
  const COL_COUNT = 7;
  [32, 14, 14, 14, 14, 14, 16].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 8 }]; // Freeze above row 9

  // Title Banner
  ws.mergeCells(1, 1, 1, COL_COUNT);
  const titleCell = ws.getCell('A1');
  titleCell.value = `Portfolio Dashboard  —  ${group.name}`;
  applyFill(titleCell, C.navyDeep);
  applyFont(titleCell, { argb: C.white, bold: true, size: 14 });
  applyAlign(titleCell, 'left');
  ws.getRow(1).height = 28;

  // Subtitle Banner
  ws.mergeCells(2, 1, 2, COL_COUNT);
  const subCell = ws.getCell('A2');
  subCell.value = `Master Portfolio Status  |  Generated: ${new Date().toLocaleString()}  |  Active Target Trackers`;
  applyFill(subCell, C.navyMid);
  applyFont(subCell, { argb: C.muted, size: 9.5, italic: true });
  applyAlign(subCell, 'left');
  ws.getRow(2).height = 20;

  // ── Executive KPI Blocks (Rows 4-6) ──
  ws.getRow(3).height = 8; // Padding Spacer Row
  ws.getRow(4).height = 18;
  ws.getRow(5).height = 24;
  ws.getRow(6).height = 14;

  const kpis = [
    { startCol: 1, endCol: 2, label: 'TOTAL PROJECTS', formula: `="${projects.length} Active"`, fill: C.purple1, textCol: C.navyDeep },
    { startCol: 3, endCol: 4, label: 'TOTAL DROPS', formula: `=SUM(B9:B${8 + projects.length})`, fill: C.purple2, textCol: C.idfBlue },
    { startCol: 5, endCol: 5, label: 'ATTENTION FLAGS', formula: `=SUM(F9:F${8 + projects.length})`, fill: C.noFill, textCol: C.noText },
    { startCol: 6, endCol: 7, label: 'COMPLETION RATE', formula: `=AVERAGE(G9:G${8 + projects.length})`, fill: C.yesFill, textCol: C.yesText, format: '0.0%' }
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

  ws.getRow(7).height = 10; // Padding Spacer

  // ── Main Data Grid Headers ──
  const headers = ['Projects', 'Total Drops', 'Rough Pulled', 'Terminated', 'Tested', 'Attention Flags', 'Progress %'];
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

  // ── Populate Rows via Linked Spreadsheet Formulas ──
  projects.forEach((p, idx) => {
    const rowNum = 9 + idx;
    const targetSheet = projectSheetMap.get(p.id || p.name);
    const escapedSheet = `'${targetSheet.replace(/'/g, "''")}'`;
    const fill = rowFill(idx);
    
    // Detailed tracking sheets have title, subtitle, and headers (Data starts at Row 4)
    const totalDrops = p.drops.length;
    const endDataRow = 3 + totalDrops;[cite: 1, 2]

    const row = ws.getRow(rowNum);
    row.height = 22;

    // Col 1: Link directly to individual tracking sheet tabs
    const nameCell = row.getCell(1);
    nameCell.value = {
      text: p.name,
      hyperlink: `#'${targetSheet}'!A1`,
      tooltip: `Navigate to ${p.name} Details`
    };
    applyFont(nameCell, { argb: C.idfBlue, bold: true, underline: true, size: 10.5 });
    applyAlign(nameCell, 'left');

    // Live Formulas evaluating metrics from target sheets (Data scope matches Row 4 down)
    row.getCell(2).value = totalDrops > 0 ? { formula: `COUNTA(${escapedSheet}!A4:A${endDataRow})` } : 0;[cite: 1, 2]
    row.getCell(3).value = totalDrops > 0 ? { formula: `COUNTIF(${escapedSheet}!D4:D${endDataRow}, "Yes")` } : 0;[cite: 1, 2]
    row.getCell(4).value = totalDrops > 0 ? { formula: `COUNTIF(${escapedSheet}!E4:E${endDataRow}, "Yes")` } : 0;[cite: 1, 2]
    row.getCell(5).value = totalDrops > 0 ? { formula: `COUNTIF(${escapedSheet}!F4:F${endDataRow}, "Yes")` } : 0;[cite: 1, 2]
    row.getCell(6).value = totalDrops > 0 ? { formula: `COUNTIF(${escapedSheet}!I4:I${endDataRow}, "⚠️ Yes")` } : 0;[cite: 1, 2]
    row.getCell(7).value = totalDrops > 0 ? { formula: `IFERROR(COUNTIF(${escapedSheet}!G4:G${endDataRow}, "✓") / B${rowNum}, 0)` } : 0;

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
      if (c === 7) {
        cell.numFmt = '0%';
        applyFont(cell, { bold: true, size: 10.5 });
      }
    }
  });

  // ── Executive Summary Totals Row ──
  const totalRowNum = 9 + projects.length;
  const totRow = ws.getRow(totalRowNum);
  totRow.height = 24;

  totRow.getCell(1).value = 'TOTAL COMPLETION PROGRESS';
  totRow.getCell(2).value = { formula: `SUM(B9:B${totalRowNum - 1})` };
  totRow.getCell(3).value = { formula: `SUM(C9:C${totalRowNum - 1})` };
  totRow.getCell(4).value = { formula: `SUM(D9:D${totalRowNum - 1})` };
  totRow.getCell(5).value = { formula: `SUM(E9:E${totalRowNum - 1})` };
  totRow.getCell(6).value = { formula: `SUM(F9:F${totalRowNum - 1})` };
  totRow.getCell(7).value = { formula: `IFERROR(SUM(E9:E${totalRowNum - 1}) / B${totalRowNum}, 0)` };

  for (let c = 1; c <= COL_COUNT; c++) {
    const cell = totRow.getCell(c);
    applyFill(cell, C.navyHeader);
    applyBorders(cell, 'thin');
    applyFont(cell, { argb: C.amber, bold: true, size: 11 });
    applyAlign(cell, c === 1 ? 'left' : 'center');
    if (c === 7) cell.numFmt = '0%';
  }

  // Dashboard-level Alert Badges / Progress Highlighting rules
  if (projects.length > 0) {
    ws.addConditionalFormatting({
      ref: `G9:G${totalRowNum - 1}`,
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
      ref: `F9:F${totalRowNum - 1}`,
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

// ── 2. Attention Flags Sheet (Attention Log Summary Log) ─────────────────────

function buildAttentionLogSheet(wb, projects, projectSheetMap) {
  const ws = wb.addWorksheet('Attention Flags', { tabColor: { argb: C.noText } });
  applyStandardPageSetup(ws, '1:2');

  const COL_COUNT = 7;
  const widths = [24, 12, 12, 18, 16, 45, 14];
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 2 }];

  bannerRow(ws, 1, 'Attention Log', C.noText, C.white, 13, 26);
  ws.mergeCells(1, 1, 1, COL_COUNT);

  const headerLabels = ['Project', 'IDF Closet', 'Drop Type', 'Cable IDs', 'Patched', 'Notes', 'date'];
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
    const targetSheet = projectSheetMap.get(p.id || p.name);
    
    p.drops.forEach((drop) => {
      if (!isAttention(drop)) return; 

      logCount++;
      const rowNum = 2 + logCount;
      const row = ws.getRow(rowNum);
      row.height = 24;
      
      // Hyperlink straight to the drop record row context on its specific project sheet (Data starts at Row 4)
      const mainSheetRowIndex = drop._mainRowNum || 4; 
      const projCell = row.getCell(1);
      projCell.value = {
        text: p.name,
        hyperlink: `#'${targetSheet}'!A${mainSheetRowIndex}`,
        tooltip: `Jump to drop line record item`
      };
      applyFont(projCell, { argb: C.idfBlue, bold: true, underline: true, size: 9.5 });
      applyFill(projCell, C.attnFill);
      applyBorders(projCell, 'thin');

      row.getCell(2).value = drop.idf || '';
      row.getCell(3).value = typeName(drop);
      row.getCell(4).value = cableIds(drop);
      row.getCell(5).value = getPatchedLabel(drop);
      row.getCell(6).value = drop.notes || 'No blocker details specified by technician.';
      row.getCell(7).value = drop.createdAt || '';

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
    cell.value = '✓ No active attention flags or deployment blockers reported across current projects.';
    applyFill(cell, C.yesFill);
    applyFont(cell, { argb: C.yesText, bold: true, italic: true, size: 11 });
    applyAlign(cell, 'center');
    applyBorders(cell, 'thin');
  }

  autoFitColumns(ws, { 6: { min: 30, max: 50 } }, [4, 6]);
}

// ── 3. Individual Project Detailed Drops Sheet ───────────────────────────────

function buildProjectSheet(wb, project, sheetName) {
  const ws = wb.addWorksheet(sheetName, { tabColor: { argb: 'FF3B82F6' } });
  applyStandardPageSetup(ws, '1:3'); // Lock print header titles (Rows 1 to 3)[cite: 1, 2]
  
  const COL_COUNT = 11;
  const widths = [12, 14, 22, 13, 13, 13, 11, 15, 14, 50, 15];
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 3 }]; // Freeze top 3 rows down (Title, Subtitle, Headers)[cite: 1, 2]

  // Row 1: Title Banner (Full width layout, no back button hyperlink)
  ws.mergeCells(1, 1, 1, COL_COUNT);
  const titleCell = ws.getCell('A1');
  titleCell.value = project.name;
  applyFill(titleCell, C.navyDeep);
  applyFont(titleCell, { argb: C.white, bold: true, size: 13 });
  applyAlign(titleCell, 'left');
  ws.getRow(1).height = 26;

  // Row 2: Formatted Metadata Subtitle Row
  ws.mergeCells(2, 1, 2, COL_COUNT);
  const subCell = ws.getCell('A2');
  
  const totalDrops = project.drops.length;
  const roughCount = project.drops.filter(d => d.roughPull).length;
  const termCount  = project.drops.filter(d => d.terminated).length;
  const testCount  = project.drops.filter(d => d.tested).length;
  const attnCount  = project.drops.filter(isAttention).length;

  subCell.value = `Generated: ${new Date().toLocaleString()}  |  Total: (${totalDrops})  |  Rough pulled: (${roughCount})  |  Terminated: (${termCount})  |  Tested: (${testCount})  |  Attention: (${attnCount})`;
  applyFill(subCell, C.navyMid);
  applyFont(subCell, { argb: C.muted, size: 9.5, italic: true });
  applyAlign(subCell, 'left');
  ws.getRow(2).height = 20;

  // Row 3: Main Data Columns Headers
  const headers = ['IDF Closet', 'Drop Type', 'Cable IDs', 'Rough Pull', 'Terminated', 'Tested', 'Complete', 'Patched', 'Attention', 'Notes', 'Date Added'];
  headerRow(ws, 3, headers, 22);[cite: 1, 2]

  ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: COL_COUNT } };[cite: 1, 2]

  project.drops.forEach((drop, i) => {
    const rowNum = 4 + i; // Data records start strictly on Row 4 down[cite: 1, 2]
    drop._mainRowNum = rowNum; 
    
    const fill = rowFill(i);
    const hasBlocker = isAttention(drop);

    const row = ws.getRow(rowNum);
    row.height = 22;

    // Field value mapping arrays
    row.getCell(1).value = drop.idf || '';
    row.getCell(2).value = typeName(drop);
    row.getCell(3).value = cableIds(drop);
    row.getCell(4).value = drop.roughPull  ? 'Yes' : 'No';
    row.getCell(5).value = drop.terminated ? 'Yes' : 'No';
    row.getCell(6).value = drop.tested     ? 'Yes' : 'No';
    
    // Automatic Live Calculation Formula computing line complete status states
    row.getCell(7).value = { formula: `IF(AND(D${rowNum}="Yes",E${rowNum}="Yes",F${rowNum}="Yes"),"✓","✗")` };
    
    row.getCell(8).value = getPatchedLabel(drop);
    row.getCell(9).value = hasBlocker ? '⚠️ Yes' : 'No';
    row.getCell(10).value = drop.notes || '';
    row.getCell(11).value = drop.createdAt || '';

    // Cell Decorators Array Iteration loop mapping
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
          applyFill(cell, fill); applyFont(cell, { size: 10 }); applyAlign(cell, 'center');
          cell.dataValidation = dvYesNo; 
          break;
        case 7:
          applyFill(cell, fill); applyAlign(cell, 'center');
          break;
        case 8:
          applyFill(cell, fill); applyAlign(cell, 'center');
          applyFont(cell, { size: 9.5, argb: cell.value === 'No' ? C.slate : C.yesText, bold: cell.value !== 'No' });
          break;
        case 9:
          applyFill(cell, hasBlocker ? C.attnFill : fill);
          applyFont(cell, { argb: hasBlocker ? C.attnText : C.muted, bold: hasBlocker, size: 10 });
          applyAlign(cell, 'center');
          break;
        case 10:
          applyFill(cell, fill); applyFont(cell, { argb: C.slate, size: 9 }); applyAlign(cell, 'left', 'middle', true);
          break;
        case 11:
          applyFill(cell, fill); applyFont(cell, { argb: C.slate, size: 9 }); applyAlign(cell, 'center');
          break;
      }
    }
  });

  // Conditional Formatting Matrix Layers (Adjusted for Row 4 start index scope bounds)
  const totalRows = project.drops.length;
  if (totalRows > 0) {
    const endRow = 3 + totalRows;[cite: 1, 2]
    ws.addConditionalFormatting({
      ref: `D4:F${endRow}`,[cite: 1, 2]
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
      ref: `G4:G${endRow}`,[cite: 1, 2]
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

  autoFitColumns(ws, { 10: { min: 22, max: 50 }, 11: { min: 14, max: 20 } }, [10, 11]);
}

// ── Banners & Static Grid Builders ───────────────────────────────────────────

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
    applyAlign(cell, i === 0 || i === 2 || i === 9 ? 'left' : 'center'); 
    cell.border = {
      top: { style: 'medium', color: { argb: C.navyDeep } },
      bottom: { style: 'medium', color: { argb: C.navyDeep } }
    };
  });
  return row;
}

// ── Auto-Fit Matrix Column Engine ────────────────────────────────────────────

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

// Optimized Low Memory base64 encoder array chunk processing
function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let out = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    out += String.fromCharCode(...bytes.subarray(i, Math.min(i + 8192, bytes.length)));
  }
  return btoa(out);
}

// ── Main Controller Export Method Entrypoint ─────────────────────────────────

export async function exportGroupToExcel(group, projects) {
  if (!projects || projects.length === 0) {
    throw new Error('No project database metrics found available to export.');
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = 'CablePull Production Engine';
  wb.created = new Date();

  // Create isolated sanitized identifier map targeting dynamic sheet links safely
  const projectSheetMap = new Map();
  const targetedTabNames = new Set(['Portfolio Summary', 'Attention Flags']);

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

  // 1. Build Executive Portfolio Summary Tab Dashboard
  buildSummarySheet(wb, group, projects, projectSheetMap);

  // 2. Build Unified Attention Flags Critical Alert Log Tab Sheet
  buildAttentionLogSheet(wb, projects, projectSheetMap);

  // 3. Build Sub-level Detailed Drop Tracking sheets
  for (const project of projects) {
    const trackingTabTitle = projectSheetMap.get(project.id || project.name);
    buildProjectSheet(wb, project, trackingTabTitle);
  }

  // File Write System Stream Buffer processing logic
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