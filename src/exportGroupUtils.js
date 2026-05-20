/**
 * exportGroupUtils.js
 *
 * Group "Export All" — replicates the exact visual style of the individual
 * project export (dark navy banner, amber headers, purple alternating rows,
 * amber attention flags, etc.).
 *
 * Sheet layout per workbook:
 *   Sheet 1  →  Group Summary  (all projects, combined stats)
 *   Sheet 2+ →  One "Cable Drops" style sheet per project
 *
 * Place at:  src/exportGroupUtils.js
 * Import:    import { exportGroupToExcel } from '../exportGroupUtils';
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

function applyAlign(cell, horizontal = 'left', vertical = 'middle') {
  cell.alignment = { horizontal, vertical, wrapText: false };
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
    applyAlign(cell, i === 0 || i === 2 || i === 8 ? 'left' : 'center');  // Notes left; rest center
  });
  return row;
}

// Alternating row fill (purple1 / purple2)
function rowFill(i) {
  return i % 2 === 0 ? C.purple1 : C.purple2;
}

// Derive cable ID string from a drop object
function cableIds(drop) {
  return [drop.cableA, drop.cableB, drop.cableC, drop.cableD]
    .filter(Boolean)
    .join(' / ');
}

// Capitalise first letter of groupType
function typeName(drop) {
  const t = drop.groupType || (drop.isDouble ? 'double' : 'single');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// Attention logic: started but not complete
function isAttention(drop) {
  const any  = drop.roughPull || drop.terminated || drop.tested;
  const done = drop.roughPull && drop.terminated && drop.tested;
  return any && !done;
}

// ── Group Summary sheet ──────────────────────────────────────────────────────

function buildSummarySheet(wb, group, projects) {
  const ws  = wb.addWorksheet('Group Summary');
  const NUM = 7; // number of columns

  // Column widths
  [36, 9, 10, 13, 10, 8, 10].forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });

  // Row 1 — title banner
  const titleText =
    `Group Export  —  ${group.name}  |  Generated: ${new Date().toLocaleString()}`;
  bannerRow(ws, 1, titleText, C.navyDeep, C.white, 13, 26);
  ws.mergeCells(1, 1, 1, NUM);

  // Row 2 — combined stats bar
  const allDrops   = projects.reduce((s, p) => s + p.drops.length, 0);
  const allPulled  = projects.reduce((s, p) => s + p.drops.filter(d => d.roughPull).length, 0);
  const allTerm    = projects.reduce((s, p) => s + p.drops.filter(d => d.terminated).length, 0);
  const allTested  = projects.reduce((s, p) => s + p.drops.filter(d => d.tested).length, 0);
  const allDone    = projects.reduce((s, p) =>
    s + p.drops.filter(d => d.roughPull && d.terminated && d.tested).length, 0);
  const allAttn    = projects.reduce((s, p) => s + p.drops.filter(d => isAttention(d)).length, 0);

  const subtitleText =
    `${projects.length} projects  |  Total: ${allDrops}  |  Rough pulled: ${allPulled}  |  Terminated: ${allTerm}  |  Tested: ${allTested}  |  Complete: ${allDone}  |  Attention: ${allAttn}`;
  bannerRow(ws, 2, subtitleText, C.navyMid, C.muted, 9, 18);
  ws.mergeCells(2, 1, 2, NUM);

  // Row 3 — column headers
  headerRow(ws, 3, ['Project', 'Drops', 'Pulled', 'Terminated', 'Tested', 'Done', '% Done'], 20);
  // Override col 1 (Project) alignment to left already done above

  // Rows 4+ — one per project
  projects.forEach((p, i) => {
    const total  = p.drops.length;
    const pulled = p.drops.filter(d => d.roughPull).length;
    const term   = p.drops.filter(d => d.terminated).length;
    const tested = p.drops.filter(d => d.tested).length;
    const done   = p.drops.filter(d => d.roughPull && d.terminated && d.tested).length;
    const pct    = total > 0 ? Math.round((done / total) * 100) : 0;
    const fill   = rowFill(i);

    const row  = ws.getRow(i + 4);
    row.height = 18;

    const vals  = [p.name, total, pulled, term, tested, done, total > 0 ? `${pct}%` : '—'];
    const aligns = ['left','center','center','center','center','center','center'];

    vals.forEach((v, ci) => {
      const cell = row.getCell(ci + 1);
      cell.value = v;
      applyFill(cell, fill);
      applyFont(cell, { size: 10, bold: ci === 0 });
      applyAlign(cell, aligns[ci]);
    });

    // Colour the % cell
    const pctCell = row.getCell(7);
    const pctColor = pct === 100 ? C.greenText : pct > 0 ? C.attnText : C.muted;
    applyFont(pctCell, { argb: pctColor, bold: true, size: 10 });
  });

  // Totals row
  const totRow = ws.getRow(projects.length + 4);
  totRow.height = 20;
  const totalPct = allDrops > 0 ? Math.round((allDone / allDrops) * 100) : 0;
  const totVals = ['TOTAL', allDrops, allPulled, allTerm, allTested, allDone, `${totalPct}%`];
  totVals.forEach((v, ci) => {
    const cell = totRow.getCell(ci + 1);
    cell.value = v;
    applyFill(cell, C.navyHeader);
    applyFont(cell, { argb: C.amber, bold: true, size: 10 });
    applyAlign(cell, ci === 0 ? 'left' : 'center');
  });
}

// ── Per-project drop sheet (Cable Drops format) ──────────────────────────────

function buildProjectSheet(wb, project, sheetName) {
  const ws  = wb.addWorksheet(sheetName);
  const NUM = 10; // columns A–J

  // Column widths (match reference exactly)
  const widths = [12, 10, 19, 13, 13, 10, 11, 13, 45, 13];
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  // ── Row 1: Title banner ──
  const total   = project.drops.length;
  const pulled  = project.drops.filter(d => d.roughPull).length;
  const term    = project.drops.filter(d => d.terminated).length;
  const tested  = project.drops.filter(d => d.tested).length;
  const attn    = project.drops.filter(d => isAttention(d)).length;

  const titleText = `CablePull Field Tracker  —  ${project.name}`;
  bannerRow(ws, 1, titleText, C.navyDeep, C.white, 13, 26);
  ws.mergeCells(1, 1, 1, NUM);

  // ── Row 2: Stats subtitle ──
  const subtitle = `Generated: ${new Date().toLocaleString()}  |  Total: ${total}  |  Rough pulled: ${pulled}  |  Terminated: ${term}  |  Tested: ${tested}  |  Attention: ${attn}`;
  bannerRow(ws, 2, subtitle, C.navyMid, C.muted, 9, 18);
  ws.mergeCells(2, 1, 2, NUM);

  // ── Row 3: Column headers ──
  const headers = ['IDF', 'Type', 'Cable ID(s)', 'Rough Pull', 'Terminated', 'Tested', 'Complete', 'Attention', 'Notes', 'Date Added'];
  const hdrAligns = ['center','center','left','center','center','center','center','center','left','center'];
  const hRow = ws.getRow(3);
  hRow.height = 20;
  headers.forEach((label, i) => {
    const cell = hRow.getCell(i + 1);
    cell.value = label;
    applyFill(cell, C.navyHeader);
    applyFont(cell, { argb: C.amber, bold: true, size: 10 });
    applyAlign(cell, hdrAligns[i]);
  });

  // ── Data rows (row 4+) ──
  project.drops.forEach((drop, i) => {
    const row     = ws.getRow(i + 4);
    row.height    = 18;
    const fill    = rowFill(i);
    const attnYes = isAttention(drop);
    const done    = drop.roughPull && drop.terminated && drop.tested;

    // A – IDF
    const idfCell = row.getCell(1);
    idfCell.value = drop.idf || '';
    applyFill(idfCell, fill);
    applyFont(idfCell, { argb: C.idfBlue, bold: true, size: 10 });
    applyAlign(idfCell, 'center');

    // B – Type
    const typeCell = row.getCell(2);
    typeCell.value = typeName(drop);
    applyFill(typeCell, fill);
    applyFont(typeCell, { argb: C.typeViolet, bold: true, size: 10 });
    applyAlign(typeCell, 'center');

    // C – Cable ID(s)
    const cableCell = row.getCell(3);
    cableCell.value = cableIds(drop);
    applyFill(cableCell, fill);
    applyFont(cableCell, { size: 10 });
    applyAlign(cableCell, 'left');

    // D – Rough Pull
    const rpCell = row.getCell(4);
    rpCell.value = drop.roughPull ? 'Yes' : 'No';
    applyFill(rpCell, fill);
    applyFont(rpCell, { size: 11 });
    applyAlign(rpCell, 'center');

    // E – Terminated
    const tmCell = row.getCell(5);
    tmCell.value = drop.terminated ? 'Yes' : 'No';
    applyFill(tmCell, fill);
    applyFont(tmCell, { size: 11 });
    applyAlign(tmCell, 'center');

    // F – Tested
    const tsCell = row.getCell(6);
    tsCell.value = drop.tested ? 'Yes' : 'No';
    applyFill(tsCell, fill);
    applyFont(tsCell, { size: 11 });
    applyAlign(tsCell, 'center');

    // G – Complete
    const compCell = row.getCell(7);
    compCell.value = done ? 'Yes' : '';
    applyFill(compCell, fill);
    applyFont(compCell, { size: 11 });
    applyAlign(compCell, 'center');

    // H – Attention (special style when flagged)
    const attnCell = row.getCell(8);
    if (attnYes) {
      attnCell.value = '⚠ Yes';
      applyFill(attnCell, C.attnFill);
      applyFont(attnCell, { argb: C.attnText, bold: true, size: 10 });
    } else {
      attnCell.value = 'No';
      applyFill(attnCell, fill);
      applyFont(attnCell, { argb: C.muted, size: 9 });
    }
    applyAlign(attnCell, 'center');

    // I – Notes
    const notesCell = row.getCell(9);
    notesCell.value = drop.notes || '';
    applyFill(notesCell, fill);
    applyFont(notesCell, { argb: C.slate, size: 9 });
    applyAlign(notesCell, 'left');

    // J – Date Added
    const dateCell = row.getCell(10);
    dateCell.value = drop.createdAt || '';
    applyFill(dateCell, fill);
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

  // Sheet 1: group-level summary
  buildSummarySheet(wb, group, projects);

  // Sheets 2+: one per project (match individual export layout)
  const usedNames = new Set(['Group Summary']);
  for (const project of projects) {
    // Sanitise to Excel's 31-char, no-special-chars rule
    let name = project.name.replace(/[\\/*?[\]:]/g, '').trim().slice(0, 31);
    // Deduplicate if two projects share a truncated name
    let candidate = name;
    let suffix = 2;
    while (usedNames.has(candidate)) {
      candidate = name.slice(0, 28) + ` ${suffix++}`;
    }
    usedNames.add(candidate);
    buildProjectSheet(wb, project, candidate);
  }

  // Serialize → base64 → cache → share
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
