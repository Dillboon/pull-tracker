/**
 * exportGroupUtils.js
 *
 * Enhanced Group "Export All" — visually polished and optimized for project 
 * manager workflows (frozen panes, auto-filters, true numeric percentages, wrapping).
 */

import * as FileSystem from 'expo-file-system';
import * as Sharing    from 'expo-sharing';
import ExcelJS         from 'exceljs';

// ── Exact colour palette from the reference export ──────────────────────────
const C = {
  navyDeep:   'FF0A1628',   // title banner bg
  navyMid:    'FF0F172A',   // subtitle bar bg
  navyHeader: 'FF0F2744',   // column-header bg
  navySection:'FF1E2D40',   // section-label bg (By IDF style)
  amber:      'FFFBBF24',   // column header text
  white:      'FFFFFFFF',
  purple1:    'FFF3EEFF',   // row alt A (lighter)
  purple2:    'FFE9E0FF',   // row alt B (slightly deeper)
  idfBlue:    'FF1E40AF',   // IDF cell text
  typeViolet: 'FF7C3AED',   // Type cell text
  slate:      'FF64748B',   // notes / date text
  muted:      'FF94A3B8',   // subtitle / section-label text
  attnFill:   'FFFFF7ED',   // attention row bg (warm yellow)
  attnText:   'FFD97706',   // attention text (amber)
  greenText:  'FF16A34A',   // ✓ colour (kept for summary %)
  borderSubtle: 'FFCBD5E1'  // subtle grey for cell borders
};

// ── Utility: ArrayBuffer → base64 ───────────────────────────────────────────
function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let out = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    out += String.fromCharCode(...bytes.subarray(i, Math.min(i + 8192, bytes.length)));
  }
  return btoa(out);
}

// ── Cell styling helpers ─────────────────────────────────────────────────────

function applyFill(cell, argb) {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

function applyFont(cell, { argb, bold = false, size = 10, italic = false } = {}) {
  cell.font = {
    name: 'Calibri',
    size,
    bold,
    italic,
    color: argb ? { argb } : undefined,
  };
}

function applyAlign(cell, horizontal = 'left', vertical = 'middle', wrapText = false) {
  cell.alignment = { horizontal, vertical, wrapText };
}

function applyBorders(cell) {
  cell.border = {
    top: { style: 'thin', color: { argb: C.borderSubtle } },
    left: { style: 'thin', color: { argb: C.borderSubtle } },
    bottom: { style: 'thin', color: { argb: C.borderSubtle } },
    right: { style: 'thin', color: { argb: C.borderSubtle } }
  };
}

// Stamp a full banner row (title / subtitle style)
function bannerRow(ws, rowNum, text, bgArgb, fgArgb, sz, height) {
  const row = ws.getRow(rowNum);
  row.height = height;
  const cell = row.getCell(1);
  cell.value = text;
  applyFill(cell, bgArgb);
  applyFont(cell, { argb: fgArgb, bold: true, size: sz });
  applyAlign(cell, 'left');
  return row;
}

// Column-header row (amber text on navy)
function headerRow(ws, rowNum, labels, height = 20) {
  const row = ws.getRow(rowNum);
  row.height = height;
  labels.forEach((label, i) => {
    const cell = row.getCell(i + 1);
    cell.value = label;
    applyFill(cell, C.navyHeader);
    applyFont(cell, { argb: C.amber, bold: true, size: 10 });
    applyAlign(cell, i === 0 || i === 2 || i === 8 ? 'left' : 'center'); 
    // Borders on headers add a crisp finish
    cell.border = {
      top: { style: 'medium', color: { argb: C.navyDeep } },
      bottom: { style: 'medium', color: { argb: C.navyDeep } }
    };
  });
  return row;
}

function rowFill(i) {
  return i % 2 === 0 ? C.purple1 : C.purple2;
}

function cableIds(drop) {
  return [drop.cableA, drop.cableB, drop.cableC, drop.cableD]
    .filter(Boolean)
    .join(' / ');
}

function typeName(drop) {
  const t = drop.groupType || (drop.isDouble ? 'double' : 'single');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// Ensure logical separation of states
function isAttention(drop) {
  // Directly read the explicit attention state from the app data
  return drop.attention === true; 
}

// ── Group Summary sheet ──────────────────────────────────────────────────────

function buildSummarySheet(wb, group, projects) {
  const ws  = wb.addWorksheet('Group Summary');
  const NUM = 7; 

  [36, 12, 12, 14, 12, 12, 12].forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });

  // Freeze top 3 rows (banners and headers)
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 3 }];

  const titleText = `Group Export  —  ${group.name}  |  Generated: ${new Date().toLocaleString()}`;
  bannerRow(ws, 1, titleText, C.navyDeep, C.white, 13, 26);
  ws.mergeCells(1, 1, 1, NUM);

  const allDrops   = projects.reduce((s, p) => s + p.drops.length, 0);
  const allPulled  = projects.reduce((s, p) => s + p.drops.filter(d => d.roughPull).length, 0);
  const allTerm    = projects.reduce((s, p) => s + p.drops.filter(d => d.terminated).length, 0);
  const allTested  = projects.reduce((s, p) => s + p.drops.filter(d => d.tested).length, 0);
  const allDone    = projects.reduce((s, p) => s + p.drops.filter(d => d.roughPull && d.terminated && d.tested).length, 0);
  const allAttn    = projects.reduce((s, p) => s + p.drops.filter(d => isAttention(d)).length, 0);

  const subtitleText = `${projects.length} projects  |  Total: ${allDrops}  |  Rough pulled: ${allPulled}  |  Terminated: ${allTerm}  |  Tested: ${allTested}  |  Complete: ${allDone}  |  Attention: ${allAttn}`;
  bannerRow(ws, 2, subtitleText, C.navyMid, C.muted, 9, 18);
  ws.mergeCells(2, 1, 2, NUM);

  headerRow(ws, 3, ['Project', 'Total Drops', 'Rough Pulled', 'Terminated', 'Tested', 'Completed', '% Done'], 20);

  // Auto-filter for the summary data
  ws.autoFilter = {
    from: { row: 3, column: 1 },
    to: { row: 3, column: NUM }
  };

  projects.forEach((p, i) => {
    const total  = p.drops.length;
    const pulled = p.drops.filter(d => d.roughPull).length;
    const term   = p.drops.filter(d => d.terminated).length;
    const tested = p.drops.filter(d => d.tested).length;
    const done   = p.drops.filter(d => d.roughPull && d.terminated && d.tested).length;
    const pct    = total > 0 ? (done / total) : 0; // Export as raw decimal for native Excel % format
    const fill   = rowFill(i);

    const row  = ws.getRow(i + 4);
    row.height = 20;

    const vals   = [p.name, total, pulled, term, tested, done, total > 0 ? pct : 0];
    const aligns = ['left','center','center','center','center','center','center'];

    vals.forEach((v, ci) => {
      const cell = row.getCell(ci + 1);
      cell.value = v;
      applyFill(cell, fill);
      applyBorders(cell);
      applyFont(cell, { size: 10, bold: ci === 0 });
      applyAlign(cell, aligns[ci]);
      
      // True Excel percentage formatting
      if (ci === 6) { 
        cell.numFmt = '0%'; 
        const pctColor = pct === 1 ? C.greenText : pct > 0 ? C.attnText : C.muted;
        applyFont(cell, { argb: pctColor, bold: true, size: 10 });
      }
    });
  });

  // Totals row at the bottom
  const totRow = ws.getRow(projects.length + 4);
  totRow.height = 22;
  const totalPct = allDrops > 0 ? (allDone / allDrops) : 0;
  const totVals = ['TOTAL PORTFOLIO', allDrops, allPulled, allTerm, allTested, allDone, totalPct];
  
  totVals.forEach((v, ci) => {
    const cell = totRow.getCell(ci + 1);
    cell.value = v;
    applyFill(cell, C.navyHeader);
    applyBorders(cell);
    applyFont(cell, { argb: C.amber, bold: true, size: 11 });
    applyAlign(cell, ci === 0 ? 'left' : 'center');
    if (ci === 6) cell.numFmt = '0%';
  });
}

// ── Per-project drop sheet ───────────────────────────────────────────────────

function buildProjectSheet(wb, project, sheetName) {
  const ws  = wb.addWorksheet(sheetName);
  const NUM = 10; 

  const widths = [12, 14, 22, 13, 13, 13, 11, 14, 50, 15];
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  // Freeze panes so PMs don't lose headers while scrolling through drops
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 3 }];

  const total   = project.drops.length;
  const pulled  = project.drops.filter(d => d.roughPull).length;
  const term    = project.drops.filter(d => d.terminated).length;
  const tested  = project.drops.filter(d => d.tested).length;
  const attn    = project.drops.filter(d => isAttention(d)).length;

  const titleText = `CablePull Field Tracker  —  ${project.name}`;
  bannerRow(ws, 1, titleText, C.navyDeep, C.white, 13, 26);
  ws.mergeCells(1, 1, 1, NUM);

  const subtitle = `Generated: ${new Date().toLocaleString()}  |  Total: ${total}  |  Rough pulled: ${pulled}  |  Terminated: ${term}  |  Tested: ${tested}  |  Attention: ${attn}`;
  bannerRow(ws, 2, subtitle, C.navyMid, C.muted, 9, 18);
  ws.mergeCells(2, 1, 2, NUM);

  const headers = ['IDF', 'Type', 'Cable ID(s)', 'Rough Pull', 'Terminated', 'Tested', 'Complete', 'Attention', 'Notes', 'Date Added'];
  headerRow(ws, 3, headers, 22);

  // Auto-filter applied to the data columns
  ws.autoFilter = {
    from: { row: 3, column: 1 },
    to: { row: 3, column: NUM }
  };

  project.drops.forEach((drop, i) => {
    const row     = ws.getRow(i + 4);
    // Allow dynamic height if notes are long, but set a comfortable minimum
    row.height    = 22; 
    const fill    = rowFill(i);
    const attnYes = isAttention(drop);
    const done    = drop.roughPull && drop.terminated && drop.tested;

    // A – IDF
    const idfCell = row.getCell(1);
    idfCell.value = drop.idf || '';
    applyFill(idfCell, fill);
    applyBorders(idfCell);
    applyFont(idfCell, { argb: C.idfBlue, bold: true, size: 10 });
    applyAlign(idfCell, 'center');

    // B – Type
    const typeCell = row.getCell(2);
    typeCell.value = typeName(drop);
    applyFill(typeCell, fill);
    applyBorders(typeCell);
    applyFont(typeCell, { argb: C.typeViolet, bold: true, size: 10 });
    applyAlign(typeCell, 'center');

    // C – Cable ID(s)
    const cableCell = row.getCell(3);
    cableCell.value = cableIds(drop);
    applyFill(cableCell, fill);
    applyBorders(cableCell);
    applyFont(cableCell, { size: 10 });
    applyAlign(cableCell, 'left');

    // D, E, F, G – Tracking States
    const states = [
      { col: 4, val: drop.roughPull },
      { col: 5, val: drop.terminated },
      { col: 6, val: drop.tested },
      { col: 7, val: done }
    ];

    states.forEach(({ col, val }) => {
      const cell = row.getCell(col);
      cell.value = val ? 'Yes' : 'No';
      applyFill(cell, fill);
      applyBorders(cell);
      // Give visual weight to completed steps
      applyFont(cell, { size: 10, argb: val ? undefined : C.muted });
      applyAlign(cell, 'center');
    });

    // H – Attention
    const attnCell = row.getCell(8);
    if (attnYes) {
      attnCell.value = '⚠ Yes';
      applyFill(attnCell, C.attnFill);
      applyFont(attnCell, { argb: C.attnText, bold: true, size: 10 });
    } else {
      attnCell.value = 'No';
      applyFill(attnCell, fill);
      applyFont(attnCell, { argb: C.muted, size: 10 });
    }
    applyBorders(attnCell);
    applyAlign(attnCell, 'center');

    // I – Notes (Word Wrap Enabled)
    const notesCell = row.getCell(9);
    notesCell.value = drop.notes || '';
    applyFill(notesCell, fill);
    applyBorders(notesCell);
    applyFont(notesCell, { argb: C.slate, size: 9 });
    applyAlign(notesCell, 'left', 'middle', true); // True = wrap text

    // J – Date Added
    const dateCell = row.getCell(10);
    dateCell.value = drop.createdAt || '';
    applyFill(dateCell, fill);
    applyBorders(dateCell);
    applyFont(dateCell, { argb: C.slate, size: 9 });
    applyAlign(dateCell, 'center');
  });
}

// ── Main export function ─────────────────────────────────────────────────────

export async function exportGroupToExcel(group, projects) {
  if (!projects || projects.length === 0) {
    throw new Error('No projects to export.');
  }

  const wb   = new ExcelJS.Workbook();
  wb.creator = 'CablePull Tracker';
  wb.created = new Date();

  buildSummarySheet(wb, group, projects);

  const usedNames = new Set(['Group Summary']);
  for (const project of projects) {
    let name = project.name.replace(/[\\/*?[\]:]/g, '').trim().slice(0, 31);
    let candidate = name;
    let suffix = 2;
    while (usedNames.has(candidate)) {
      candidate = name.slice(0, 28) + ` ${suffix++}`;
    }
    usedNames.add(candidate);
    buildProjectSheet(wb, project, candidate);
  }

  const buffer   = await wb.xlsx.writeBuffer();
  const base64   = toBase64(buffer);
  const safeName = group.name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
  const filename = `${safeName}_GroupExport_${Date.now()}.xlsx`;
  const uri      = FileSystem.cacheDirectory + filename;

  await FileSystem.writeAsStringAsync(uri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) throw new Error('Sharing is not available on this device.');

  await Sharing.shareAsync(uri, {
    mimeType:    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    dialogTitle: `Export: ${group.name}`,
    UTI:         'com.microsoft.excel.xlsx',
  });
}