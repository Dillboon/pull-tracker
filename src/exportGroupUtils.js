/**
 * exportGroupUtils.js
 *
 * Enhanced Group "Export All" — visually polished and optimized for project
 * manager workflows.
 *
 * Ported from exportUtils:
 *  • IDF sort (drops sorted by IDF then cable number on every project sheet)
 *  • Data validation — Yes/No dropdown enforced on Rough Pull / Terminated / Tested
 *  • Conditional formatting — green Yes / red No; green ✓ / red ✗ on Complete
 *  • Formula-driven Complete column — recalculates live when a PM edits Yes/No
 *  • autoFitColumns — Notes and Date columns fit to content automatically
 *  • Tab colors — each sheet type has a distinct colour for instant navigation
 *  • Print-ready pageSetup — landscape, fit-to-width, repeating title rows
 *
 * Additional PM-grade features:
 *  • Data bars on % Done in Group Summary — at-a-glance portfolio health
 *  • ⚠ Attention Items sheet — every flagged drop across all projects in one view
 *  • Not Started sheet — every drop with zero progress, cross-project punch list
 *  • Per-project By IDF sheet — drops grouped by closet with live COUNTIFS headers
 *  • Live summary footer — COUNTIF totals row at the bottom of each project sheet
 *  • Tab colour by completion — green ✓ / amber ◑ / red ✗ per project health
 */

import * as FileSystem from 'expo-file-system';
import * as Sharing    from 'expo-sharing';
import ExcelJS         from 'exceljs';

// ── Colour palette ───────────────────────────────────────────────────────────
const C = {
  navyDeep:        'FF0A1628',
  navyMid:         'FF0F172A',
  navyHeader:      'FF0F2744',
  navySection:     'FF1E2D40',
  amber:           'FFFBBF24',
  white:           'FFFFFFFF',
  purple1:         'FFF3EEFF',   // row alt A
  purple2:         'FFE9E0FF',   // row alt B
  idfBlue:         'FF1E40AF',
  typeViolet:      'FF7C3AED',
  slate:           'FF64748B',
  muted:           'FF94A3B8',
  attnFill:        'FFFFF7ED',
  attnText:        'FFD97706',
  greenText:       'FF16A34A',
  greenFill:       'FFD1FAE5',
  greenDark:       'FF065F46',
  redFill:         'FFFEE2E2',
  redDark:         'FF991B1B',
  notStartedFill:  'FFFEF2F2',   // soft red for not-started rows
  borderSubtle:    'FFCBD5E1',
  borderLight:     'FFE2E8F0',
};

// Tab colours by project completion (read at a glance from the sheet strip)
function tabColorByPct(pct) {
  if (pct >= 1)  return 'FF16A34A';   // green  — fully done
  if (pct >  0)  return 'FFF59E0B';   // amber  — in progress
  return                'FFEF4444';   // red    — nothing started
}

// ── Drop sorting — by IDF (alpha) then cable-A (numeric) ────────────────────
function sortedDrops(drops) {
  return [...drops].sort((a, b) => {
    const idfA = (a.idf || '').toLowerCase();
    const idfB = (b.idf || '').toLowerCase();
    if (idfA < idfB) return -1;
    if (idfA > idfB) return 1;
    return (parseInt(a.cableA) || 0) - (parseInt(b.cableA) || 0);
  });
}

// Escape a sheet name for use inside an Excel formula string reference.
// Single quotes inside a sheet name are doubled: O'Brien → O''Brien
function escapeSheetName(name) {
  return name.replace(/'/g, "''");
}

// ── Utility: ArrayBuffer → base64 ───────────────────────────────────────────
function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let out = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    out += String.fromCharCode(...bytes.subarray(i, Math.min(i + 8192, bytes.length)));
  }
  return btoa(out);
}

// ── Auto-fit column widths ───────────────────────────────────────────────────
/**
 * Scans every cell and measures its string length to set a sensible column width.
 * ExcelJS has no built-in auto-fit; this replicates the logic from exportUtils.
 *
 * @param {ExcelJS.Worksheet} ws
 * @param {Object}   overrides  – map of 1-based col index → { min, max }
 * @param {number[]} only       – if provided, only these 1-based cols are resized
 */
function autoFitColumns(ws, overrides = {}, only = null) {
  const DEFAULT_MIN = 8;
  const DEFAULT_MAX = 50;

  ws.columns.forEach((column, colIdx) => {
    if (!column || !column.eachCell) return;
    const colNum = colIdx + 1;
    if (only && !only.includes(colNum)) return;

    const { min = DEFAULT_MIN, max = DEFAULT_MAX } = overrides[colNum] || {};
    let maxLen = min;

    column.eachCell({ includeEmpty: false }, (cell) => {
      const v = cell.value;
      let len = 0;
      if (v === null || v === undefined) return;
      if (typeof v === 'string')      len = v.length;
      else if (typeof v === 'number') len = String(v).length;
      else if (v instanceof Date)     len = v.toLocaleString().length;
      else if (typeof v === 'object') {
        if (v.richText)     len = v.richText.reduce((a, r) => a + (r.text?.length ?? 0), 0);
        else if (v.formula) len = v.result != null ? String(v.result).length : 6;
        else if (v.text != null) len = String(v.text).length;
      }
      if (len > maxLen) maxLen = len;
    });

    column.width = Math.min(maxLen, max);
  });
}

// ── Cell styling helpers ─────────────────────────────────────────────────────

function applyFill(cell, argb) {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

function applyFont(cell, { argb, bold = false, size = 10, italic = false } = {}) {
  cell.font = { name: 'Calibri', size, bold, italic, color: argb ? { argb } : undefined };
}

function applyAlign(cell, horizontal = 'left', vertical = 'middle', wrapText = false) {
  cell.alignment = { horizontal, vertical, wrapText };
}

function applyBorders(cell, style = 'thin', argb = C.borderLight) {
  cell.border = {
    top:    { style, color: { argb } },
    left:   { style, color: { argb } },
    bottom: { style, color: { argb } },
    right:  { style, color: { argb } },
  };
}

// Full-width banner row (title / subtitle)
function bannerRow(ws, rowNum, text, bgArgb, fgArgb, sz, height) {
  const row  = ws.getRow(rowNum);
  row.height = height;
  const cell = row.getCell(1);
  cell.value = text;
  applyFill(cell, bgArgb);
  applyFont(cell, { argb: fgArgb, bold: true, size: sz });
  applyAlign(cell, 'left');
  return row;
}

// Column-header row — amber text on deep navy
function headerRow(ws, rowNum, labels, leftAlignCols = [], height = 20) {
  const row  = ws.getRow(rowNum);
  row.height = height;
  labels.forEach((label, i) => {
    const cell = row.getCell(i + 1);
    cell.value = label;
    applyFill(cell, C.navyHeader);
    applyFont(cell, { argb: C.amber, bold: true, size: 10 });
    applyAlign(cell, leftAlignCols.includes(i) ? 'left' : 'center');
    cell.border = {
      top:    { style: 'medium', color: { argb: C.navyDeep } },
      bottom: { style: 'medium', color: { argb: C.navyDeep } },
    };
  });
  return row;
}

// ── Data helpers ─────────────────────────────────────────────────────────────

function rowFill(i) { return i % 2 === 0 ? C.purple1 : C.purple2; }

function cableIds(drop) {
  return [drop.cableA, drop.cableB, drop.cableC, drop.cableD]
    .filter(Boolean).join(' / ') || '—';
}

function typeName(drop) {
  const t = drop.groupType || (drop.isDouble ? 'double' : 'single');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function isAttention(drop)  { return drop.attention === true; }
function isNotStarted(drop) { return !drop.roughPull && !drop.terminated && !drop.tested; }

function getPatchedLabel(drop) {
  const ids = [];
  if (drop.patchedA && drop.cableA) ids.push(drop.cableA);
  if (drop.patchedB && drop.cableB) ids.push(drop.cableB);
  if (drop.patchedC && drop.cableC) ids.push(drop.cableC);
  if (drop.patchedD && drop.cableD) ids.push(drop.cableD);
  return ids.length > 0 ? `Yes (${ids.join('/')})` : 'No';
}

// ── Group Summary sheet ──────────────────────────────────────────────────────

function buildSummarySheet(wb, group, projects) {
  const ws  = wb.addWorksheet('Group Summary', {
    tabColor: { argb: 'FF3B82F6' },   // Blue — the top-level hub
    pageSetup: {
      orientation: 'landscape', fitToPage: true,
      fitToWidth: 1, fitToHeight: 0, printTitlesRow: '1:3',
    },
  });
  const NUM = 7;

  [36, 12, 12, 14, 12, 12, 12].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 3 }];

  // ── Row 1: Title ───────────────────────────────────────────────────────────
  bannerRow(ws, 1, `Group Export  —  ${group.name}  |  Generated: ${new Date().toLocaleString()}`, C.navyDeep, C.white, 13, 26);
  ws.mergeCells(1, 1, 1, NUM);

  // ── Portfolio totals ───────────────────────────────────────────────────────
  const allDrops  = projects.reduce((s, p) => s + p.drops.length, 0);
  const allPulled = projects.reduce((s, p) => s + p.drops.filter(d => d.roughPull).length, 0);
  const allTerm   = projects.reduce((s, p) => s + p.drops.filter(d => d.terminated).length, 0);
  const allTested = projects.reduce((s, p) => s + p.drops.filter(d => d.tested).length, 0);
  const allDone   = projects.reduce((s, p) => s + p.drops.filter(d => d.roughPull && d.terminated && d.tested).length, 0);
  const allAttn   = projects.reduce((s, p) => s + p.drops.filter(d => isAttention(d)).length, 0);
  const allNS     = projects.reduce((s, p) => s + p.drops.filter(d => isNotStarted(d)).length, 0);

  // ── Row 2: Subtitle ────────────────────────────────────────────────────────
  bannerRow(ws, 2,
    `${projects.length} projects  |  Total: ${allDrops}  |  Rough pulled: ${allPulled}  |  Terminated: ${allTerm}  |  Tested: ${allTested}  |  Complete: ${allDone}  |  Attention: ${allAttn}  |  Not Started: ${allNS}`,
    C.navyMid, C.muted, 9, 18);
  ws.mergeCells(2, 1, 2, NUM);

  // ── Row 3: Headers ─────────────────────────────────────────────────────────
  headerRow(ws, 3, ['Project', 'Total Drops', 'Rough Pulled', 'Terminated', 'Tested', 'Completed', '% Done'], [0], 20);
  ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: NUM } };

  // ── Data rows ──────────────────────────────────────────────────────────────
  projects.forEach((p, i) => {
    const total  = p.drops.length;
    const pulled = p.drops.filter(d => d.roughPull).length;
    const term   = p.drops.filter(d => d.terminated).length;
    const tested = p.drops.filter(d => d.tested).length;
    const done   = p.drops.filter(d => d.roughPull && d.terminated && d.tested).length;
    const pct    = total > 0 ? done / total : 0;
    const fill   = rowFill(i);

    const row  = ws.getRow(i + 4);
    row.height = 20;

    [p.name, total, pulled, term, tested, done, pct].forEach((v, ci) => {
      const cell = row.getCell(ci + 1);
      cell.value = v;
      applyFill(cell, fill);
      applyBorders(cell);
      applyFont(cell, { size: 10, bold: ci === 0 });
      applyAlign(cell, ci === 0 ? 'left' : 'center');
      if (ci === 6) {
        cell.numFmt = '0%';
        applyFont(cell, { argb: pct === 1 ? C.greenText : pct > 0 ? C.attnText : C.redDark, bold: true, size: 10 });
      }
    });
  });

  // ── Data bars on % Done — visual portfolio health without reading numbers ──
  const lastSummaryDataRow = projects.length + 3;
  if (projects.length > 0) {
    ws.addConditionalFormatting({
      ref: `G4:G${lastSummaryDataRow}`,
      rules: [{ type: 'dataBar', dataBar: { minLength: 0, maxLength: 100, color: { argb: 'FF1E40AF' } } }],
    });
  }

  // ── Totals footer ──────────────────────────────────────────────────────────
  const totRow  = ws.getRow(projects.length + 4);
  totRow.height = 22;
  const totalPct = allDrops > 0 ? allDone / allDrops : 0;
  ['TOTAL PORTFOLIO', allDrops, allPulled, allTerm, allTested, allDone, totalPct].forEach((v, ci) => {
    const cell = totRow.getCell(ci + 1);
    cell.value = v;
    applyFill(cell, C.navyHeader);
    applyBorders(cell, 'medium', C.navyDeep);
    applyFont(cell, { argb: C.amber, bold: true, size: 11 });
    applyAlign(cell, ci === 0 ? 'left' : 'center');
    if (ci === 6) cell.numFmt = '0%';
  });
}

// ── Per-project drop sheet ───────────────────────────────────────────────────

function buildProjectSheet(wb, project, sheetName) {
  // Sort drops and compute completion for tab colour
  const sorted      = sortedDrops(project.drops);
  const total       = sorted.length;
  const lastDataRow = 3 + total;

  const pulled  = sorted.filter(d => d.roughPull).length;
  const term    = sorted.filter(d => d.terminated).length;
  const tested  = sorted.filter(d => d.tested).length;
  const done    = sorted.filter(d => d.roughPull && d.terminated && d.tested).length;
  const attn    = sorted.filter(d => isAttention(d)).length;
  const patched = sorted.filter(d => d.patchedA || d.patchedB || d.patchedC || d.patchedD).length;
  const pct     = total > 0 ? done / total : 0;

  const ws = wb.addWorksheet(sheetName, {
    tabColor: { argb: tabColorByPct(pct) },   // ← green / amber / red by completion
    pageSetup: {
      orientation: 'landscape', fitToPage: true,
      fitToWidth: 1, fitToHeight: 0, printTitlesRow: '1:3',
    },
  });
  const NUM = 11;

  ws.columns = [
    { key: 'idf',       width: 12 },
    { key: 'type',      width: 14 },
    { key: 'cable',     width: 22 },
    { key: 'roughPull', width: 13 },
    { key: 'term',      width: 13 },
    { key: 'tested',    width: 13 },
    { key: 'complete',  width: 11 },
    { key: 'patched',   width: 15 },
    { key: 'attn',      width: 14 },
    { key: 'notes',     width: 50 },
    { key: 'date',      width: 15 },
  ];

  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 3 }];

  // ── Banners ────────────────────────────────────────────────────────────────
  bannerRow(ws, 1, `CablePull Field Tracker  —  ${project.name}`, C.navyDeep, C.white, 13, 26);
  ws.mergeCells(1, 1, 1, NUM);

  bannerRow(ws, 2,
    `Generated: ${new Date().toLocaleString()}  |  Total: ${total}  |  Rough pulled: ${pulled}  |  Terminated: ${term}  |  Tested: ${tested}  |  Attention: ${attn}`,
    C.navyMid, C.muted, 9, 18);
  ws.mergeCells(2, 1, 2, NUM);

  // ── Column headers ─────────────────────────────────────────────────────────
  headerRow(ws, 3,
    ['IDF', 'Type', 'Cable ID(s)', 'Rough Pull', 'Terminated', 'Tested', 'Complete', 'Patched', 'Attention', 'Notes', 'Date Added'],
    [0, 2, 9], 22);
  ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: NUM } };

  // ── Data validation: enforced Yes/No dropdowns (PM-editable in Excel) ─────
  const dvYesNo = {
    type: 'list', allowBlank: false, showErrorMessage: true,
    errorTitle: 'Invalid value', error: 'Please select Yes or No',
    formulae: ['"Yes,No"'],
  };

  // ── Data rows ──────────────────────────────────────────────────────────────
  sorted.forEach((drop, i) => {
    const rowNum     = 4 + i;
    drop._mainRowNum = rowNum;   // Stored for By IDF formula links

    const row  = ws.getRow(rowNum);
    row.height = 22;
    const fill = rowFill(i);

    // A – IDF
    const idfCell = row.getCell(1);
    idfCell.value = drop.idf || '';
    applyFill(idfCell, fill); applyBorders(idfCell);
    applyFont(idfCell, { argb: C.idfBlue, bold: true, size: 10 });
    applyAlign(idfCell, 'center');

    // B – Type
    const typeCell = row.getCell(2);
    typeCell.value = typeName(drop);
    applyFill(typeCell, fill); applyBorders(typeCell);
    applyFont(typeCell, { argb: C.typeViolet, bold: true, size: 10 });
    applyAlign(typeCell, 'center');

    // C – Cable ID(s)
    const cableCell = row.getCell(3);
    cableCell.value = cableIds(drop);
    applyFill(cableCell, fill); applyBorders(cableCell);
    applyFont(cableCell, { size: 10 }); applyAlign(cableCell, 'left');

    // D, E, F – Tracking states with Yes/No dropdown validation
    [{ col: 4, val: drop.roughPull }, { col: 5, val: drop.terminated }, { col: 6, val: drop.tested }]
      .forEach(({ col, val }) => {
        const cell = row.getCell(col);
        cell.value = val ? 'Yes' : 'No';
        applyFill(cell, fill); applyBorders(cell);
        applyFont(cell, { size: 10 }); applyAlign(cell, 'center');
        cell.dataValidation = dvYesNo;
      });

    // G – Complete — formula-driven: auto-updates when PM edits D/E/F
    const completeCell = row.getCell(7);
    completeCell.value = { formula: `IF(AND(D${rowNum}="Yes",E${rowNum}="Yes",F${rowNum}="Yes"),"✓","✗")` };
    applyFill(completeCell, fill); applyBorders(completeCell);
    applyAlign(completeCell, 'center');

    // H – Patched
    const patchedText = getPatchedLabel(drop);
    const isPatched   = patchedText !== 'No';
    const patchedCell = row.getCell(8);
    patchedCell.value = patchedText;
    applyFill(patchedCell, fill); applyBorders(patchedCell);
    applyFont(patchedCell, { size: 10, argb: isPatched ? C.greenDark : C.muted });
    applyAlign(patchedCell, 'center');

    // I – Attention
    const attnCell = row.getCell(9);
    if (isAttention(drop)) {
      attnCell.value = '⚠ Yes';
      applyFill(attnCell, C.attnFill);
      applyFont(attnCell, { argb: C.attnText, bold: true, size: 10 });
    } else {
      attnCell.value = 'No';
      applyFill(attnCell, fill);
      applyFont(attnCell, { argb: C.muted, size: 10 });
    }
    applyBorders(attnCell); applyAlign(attnCell, 'center');

    // J – Notes (word-wrap)
    const notesCell = row.getCell(10);
    notesCell.value = drop.notes || '';
    applyFill(notesCell, fill); applyBorders(notesCell);
    applyFont(notesCell, { argb: C.slate, size: 9 });
    applyAlign(notesCell, 'left', 'middle', true);

    // K – Date Added
    const dateCell = row.getCell(11);
    dateCell.value = drop.createdAt || '';
    applyFill(dateCell, fill); applyBorders(dateCell);
    applyFont(dateCell, { argb: C.slate, size: 9 });
    applyAlign(dateCell, 'center');
  });

  // ── Conditional formatting ─────────────────────────────────────────────────
  if (total > 0) {
    // D:F → Yes = green, No = red
    ws.addConditionalFormatting({
      ref: `D4:F${lastDataRow}`,
      rules: [
        { type: 'cellIs', operator: 'equal', formulae: ['"Yes"'], style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: C.greenFill } }, font: { bold: true, color: { argb: C.greenDark } } } },
        { type: 'cellIs', operator: 'equal', formulae: ['"No"'],  style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: C.redFill }   }, font: { bold: true, color: { argb: C.redDark }   } } },
      ],
    });
    // G → ✓ = green, ✗ = red
    ws.addConditionalFormatting({
      ref: `G4:G${lastDataRow}`,
      rules: [
        { type: 'cellIs', operator: 'equal', formulae: ['"✓"'], style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: C.greenFill } }, font: { bold: true, color: { argb: C.greenDark }, size: 11 } } },
        { type: 'cellIs', operator: 'equal', formulae: ['"✗"'], style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: C.redFill }   }, font: { bold: true, color: { argb: C.redDark },   size: 11 } } },
      ],
    });
  }

  // ── Live summary footer ────────────────────────────────────────────────────
  // Spacer row — visually separates data from the totals footer
  if (total > 0) {
    const spacerRow  = ws.getRow(lastDataRow + 1);
    spacerRow.height = 6;
    for (let c = 1; c <= NUM; c++) applyFill(spacerRow.getCell(c), C.navyMid);

    const footerRow  = ws.getRow(lastDataRow + 2);
    footerRow.height = 22;

    // Col 1: Label
    const labelCell = footerRow.getCell(1);
    labelCell.value = 'TOTALS';
    applyFill(labelCell, C.navyHeader); applyBorders(labelCell, 'medium', C.navyDeep);
    applyFont(labelCell, { argb: C.amber, bold: true, size: 11 });
    applyAlign(labelCell, 'left');

    // Col 2-3: Empty (Type, Cable) — not meaningful as totals
    [2, 3].forEach(c => {
      const cell = footerRow.getCell(c);
      applyFill(cell, C.navyHeader); applyBorders(cell, 'medium', C.navyDeep);
    });

    // Col 4: Rough Pull count — live COUNTIF
    const rpCell = footerRow.getCell(4);
    rpCell.value = { formula: `COUNTIF(D4:D${lastDataRow},"Yes")` };
    applyFill(rpCell, C.navyHeader); applyBorders(rpCell, 'medium', C.navyDeep);
    applyFont(rpCell, { argb: C.amber, bold: true, size: 11 });
    applyAlign(rpCell, 'center');

    // Col 5: Terminated count — live COUNTIF
    const tmCell = footerRow.getCell(5);
    tmCell.value = { formula: `COUNTIF(E4:E${lastDataRow},"Yes")` };
    applyFill(tmCell, C.navyHeader); applyBorders(tmCell, 'medium', C.navyDeep);
    applyFont(tmCell, { argb: C.amber, bold: true, size: 11 });
    applyAlign(tmCell, 'center');

    // Col 6: Tested count — live COUNTIF
    const tsCell = footerRow.getCell(6);
    tsCell.value = { formula: `COUNTIF(F4:F${lastDataRow},"Yes")` };
    applyFill(tsCell, C.navyHeader); applyBorders(tsCell, 'medium', C.navyDeep);
    applyFont(tsCell, { argb: C.amber, bold: true, size: 11 });
    applyAlign(tsCell, 'center');

    // Col 7: Complete count — live COUNTIFS (all three "Yes")
    const cmpCell = footerRow.getCell(7);
    cmpCell.value = { formula: `COUNTIFS(D4:D${lastDataRow},"Yes",E4:E${lastDataRow},"Yes",F4:F${lastDataRow},"Yes")` };
    applyFill(cmpCell, C.navyHeader); applyBorders(cmpCell, 'medium', C.navyDeep);
    applyFont(cmpCell, { argb: C.amber, bold: true, size: 11 });
    applyAlign(cmpCell, 'center');

    // Col 8: Patched count (static — patched state doesn't change in Excel)
    const ptCell = footerRow.getCell(8);
    ptCell.value = patched;
    applyFill(ptCell, C.navyHeader); applyBorders(ptCell, 'medium', C.navyDeep);
    applyFont(ptCell, { argb: C.amber, bold: true, size: 11 });
    applyAlign(ptCell, 'center');

    // Col 9: Attention count (static)
    const attnFootCell = footerRow.getCell(9);
    attnFootCell.value = attn;
    applyFill(attnFootCell, C.navyHeader); applyBorders(attnFootCell, 'medium', C.navyDeep);
    applyFont(attnFootCell, { argb: C.amber, bold: true, size: 11 });
    applyAlign(attnFootCell, 'center');

    // Cols 10-11: Empty (Notes, Date)
    [10, 11].forEach(c => {
      const cell = footerRow.getCell(c);
      applyFill(cell, C.navyHeader); applyBorders(cell, 'medium', C.navyDeep);
    });
  }

  // Auto-fit Notes and Date columns; all others use fixed widths
  autoFitColumns(ws, {
    10: { min: 20, max: 45 },
    11: { min: 14, max: 26 },
  }, [10, 11]);
}

// ── Per-project By IDF sheet ─────────────────────────────────────────────────
/**
 * Groups the project's drops by IDF closet. Each closet gets a live section
 * header (COUNTIFS formula referencing the main project sheet) so the PM can
 * see closet-level progress without needing to filter. Data cells link back
 * to the main sheet so edits on either tab stay in sync.
 *
 * Must be called AFTER buildProjectSheet so that drop._mainRowNum is populated.
 *
 * @param {ExcelJS.Workbook}  wb
 * @param {Object}            project           - project data
 * @param {string}            projectSheetName  - exact name of the main project tab
 * @param {string}            idfSheetName      - name for this new IDF tab
 */
function buildProjectIdfSheet(wb, project, projectSheetName, idfSheetName) {
  const sorted  = sortedDrops(project.drops);   // _mainRowNum already set by buildProjectSheet
  const idfs    = [...new Set(sorted.map(d => d.idf).filter(Boolean))].sort();
  if (idfs.length === 0) return;                // No IDF data — skip the sheet

  const esc         = escapeSheetName(projectSheetName);
  const lastDataRow = 3 + sorted.length;        // Matches the main project sheet's data range

  const ws = wb.addWorksheet(idfSheetName, {
    tabColor: { argb: 'FF0D9488' },   // Teal — distinct from every other sheet type
    pageSetup: {
      orientation: 'landscape', fitToPage: true,
      fitToWidth: 1, fitToHeight: 0, printTitlesRow: '1:1',
    },
  });

  ws.columns = [
    { width: 12 },   // A – Type
    { width: 22 },   // B – Cable ID(s)
    { width: 13 },   // C – Rough Pull  (formula link)
    { width: 13 },   // D – Terminated  (formula link)
    { width: 11 },   // E – Tested      (formula link)
    { width: 11 },   // F – Complete    (formula link)
    { width: 10 },   // G – Notes       (auto-fit below)
    { width: 4  },   // H – spacer
  ];

  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];

  // Row 1: Title banner
  ws.mergeCells('A1:H1');
  const titleCell = ws.getCell('A1');
  titleCell.value = `By IDF Closet  —  ${project.name}`;
  applyFill(titleCell, C.navyDeep);
  applyFont(titleCell, { argb: C.white, bold: true, size: 13 });
  applyAlign(titleCell, 'left');
  ws.getRow(1).height = 26;

  let wsRow = 1;

  idfs.forEach(idf => {
    const idrops     = sorted.filter(d => d.idf === idf);
    const idfEscaped = idf.replace(/"/g, '""');   // Escape for use inside Excel formula strings

    // ── Section header: COUNTIFS formulas give live closet-level stats ────────
    wsRow++;
    const rpFormula  = `COUNTIFS('${esc}'!$A$4:$A$${lastDataRow},"${idfEscaped}",'${esc}'!$D$4:$D$${lastDataRow},"Yes")`;
    const tmFormula  = `COUNTIFS('${esc}'!$A$4:$A$${lastDataRow},"${idfEscaped}",'${esc}'!$E$4:$E$${lastDataRow},"Yes")`;
    const tsFormula  = `COUNTIFS('${esc}'!$A$4:$A$${lastDataRow},"${idfEscaped}",'${esc}'!$F$4:$F$${lastDataRow},"Yes")`;
    const cmpFormula = `COUNTIFS('${esc}'!$A$4:$A$${lastDataRow},"${idfEscaped}",'${esc}'!$D$4:$D$${lastDataRow},"Yes",'${esc}'!$E$4:$E$${lastDataRow},"Yes",'${esc}'!$F$4:$F$${lastDataRow},"Yes")`;

    ws.mergeCells(`A${wsRow}:H${wsRow}`);
    const hdrCell   = ws.getCell(`A${wsRow}`);
    hdrCell.value   = {
      formula: `"${idf}  —  ${idrops.length} drops  |  RP: "&${rpFormula}&"  TM: "&${tmFormula}&"  TS: "&${tsFormula}&"  Done: "&${cmpFormula}&"/${idrops.length}"`,
    };
    applyFill(hdrCell, C.navyHeader);
    applyFont(hdrCell, { argb: C.amber, bold: true, size: 10 });
    applyAlign(hdrCell, 'left');
    applyBorders(hdrCell, 'thin', C.navyDeep);
    ws.getRow(wsRow).height = 18;

    // ── Column sub-header row ────────────────────────────────────────────────
    wsRow++;
    const subHdr = ws.getRow(wsRow);
    subHdr.height = 16;
    ['Type', 'Cable ID(s)', 'Rough Pull', 'Terminated', 'Tested', 'Complete', 'Notes', ''].forEach((label, ci) => {
      const cell = subHdr.getCell(ci + 1);
      cell.value = label;
      applyFill(cell, C.navySection);
      applyFont(cell, { argb: C.muted, bold: true, size: 9 });
      applyAlign(cell, ci === 1 || ci === 6 ? 'left' : 'center');
      applyBorders(cell);
    });

    // ── Drop rows for this IDF: link back to main project sheet ──────────────
    idrops.forEach((d, di) => {
      wsRow++;
      const isEven  = di % 2 === 0;
      const baseFill = isEven ? C.purple1 : C.purple2;

      const r = ws.addRow([
        typeName(d),
        cableIds(d),
        { formula: `'${esc}'!D${d._mainRowNum}` },   // Rough Pull  — live link
        { formula: `'${esc}'!E${d._mainRowNum}` },   // Terminated  — live link
        { formula: `'${esc}'!F${d._mainRowNum}` },   // Tested      — live link
        { formula: `'${esc}'!G${d._mainRowNum}` },   // Complete ✓✗ — live link
        d.notes || '',
        '',
      ]);
      r.height = 18;

      r.eachCell((cell, col) => {
        applyBorders(cell);
        switch (col) {
          case 1:
            applyFont(cell, { argb: C.typeViolet, bold: true, size: 10 });
            applyFill(cell, baseFill); applyAlign(cell, 'center'); break;
          case 2:
            applyFont(cell, { size: 10 });
            applyFill(cell, baseFill); applyAlign(cell, 'left'); break;
          case 3: case 4: case 5:
            applyFill(cell, baseFill); applyAlign(cell, 'center'); break;
          case 6:
            applyFill(cell, baseFill); applyAlign(cell, 'center'); break;
          case 7:
            applyFont(cell, { argb: C.slate, size: 9 });
            applyFill(cell, baseFill);
            applyAlign(cell, 'left', 'middle', true); break;
          default:
            applyFill(cell, baseFill); break;
        }
      });
    });

    // Spacer between closets
    wsRow++;
    ws.addRow(['', '', '', '', '', '', '', '']);
    ws.getRow(ws.rowCount).height = 8;
  });

  // ── Conditional formatting across the full sheet ──────────────────────────
  // Columns C:E contain formula-linked Yes/No; F contains ✓/✗
  if (ws.rowCount > 1) {
    ws.addConditionalFormatting({
      ref: `C1:E${ws.rowCount}`,
      rules: [
        { type: 'cellIs', operator: 'equal', formulae: ['"Yes"'], style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: C.greenFill } }, font: { bold: true, color: { argb: C.greenDark } } } },
        { type: 'cellIs', operator: 'equal', formulae: ['"No"'],  style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: C.redFill }   }, font: { bold: true, color: { argb: C.redDark }   } } },
      ],
    });
    ws.addConditionalFormatting({
      ref: `F1:F${ws.rowCount}`,
      rules: [
        { type: 'cellIs', operator: 'equal', formulae: ['"✓"'], style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: C.greenFill } }, font: { bold: true, color: { argb: C.greenDark }, size: 11 } } },
        { type: 'cellIs', operator: 'equal', formulae: ['"✗"'], style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: C.redFill }   }, font: { bold: true, color: { argb: C.redDark },   size: 11 } } },
      ],
    });
  }

  // Auto-fit Cable ID and Notes columns
  autoFitColumns(ws, {
    7: { min: 20, max: 45 },
  }, [2, 7]);
}

// ── ⚠ Attention Items sheet ──────────────────────────────────────────────────
/**
 * Aggregates every drop flagged for attention across ALL projects into a single
 * sheet. Gives a PM one place to review outstanding issues without jumping between
 * project tabs. Sheet is skipped entirely if there are no attention items.
 */
function buildAttentionSheet(wb, projects) {
  const attnDrops = [];
  projects.forEach(p => {
    sortedDrops(p.drops).forEach(d => {
      if (isAttention(d)) attnDrops.push({ ...d, _projectName: p.name });
    });
  });
  if (attnDrops.length === 0) return;

  const ws = wb.addWorksheet('⚠ Attention Items', {
    tabColor: { argb: 'FFF59E0B' },   // Amber — visually urgent
    pageSetup: {
      orientation: 'landscape', fitToPage: true,
      fitToWidth: 1, fitToHeight: 0, printTitlesRow: '1:3',
    },
  });
  const NUM = 9;

  ws.columns = [
    { key: 'project', width: 28 }, { key: 'idf',      width: 12 },
    { key: 'type',    width: 14 }, { key: 'cable',    width: 22 },
    { key: 'rp',      width: 13 }, { key: 'term',     width: 13 },
    { key: 'tested',  width: 13 }, { key: 'complete', width: 11 },
    { key: 'notes',   width: 50 },
  ];
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 3 }];

  bannerRow(ws, 1, `⚠  Attention Items  —  ${attnDrops.length} flagged across ${projects.length} projects`, C.navyDeep, C.amber, 13, 26);
  ws.mergeCells(1, 1, 1, NUM);
  bannerRow(ws, 2, `Generated: ${new Date().toLocaleString()}  |  Review all flagged drops below`, C.navyMid, C.muted, 9, 18);
  ws.mergeCells(2, 1, 2, NUM);

  headerRow(ws, 3, ['Project', 'IDF', 'Type', 'Cable ID(s)', 'Rough Pull', 'Terminated', 'Tested', 'Complete', 'Notes'], [0, 3, 8], 20);
  ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: NUM } };

  attnDrops.forEach((drop, i) => {
    const row  = ws.getRow(i + 4);
    row.height = 22;
    const done = drop.roughPull && drop.terminated && drop.tested;
    const vals = [
      drop._projectName, drop.idf || '', typeName(drop), cableIds(drop),
      drop.roughPull ? 'Yes' : 'No', drop.terminated ? 'Yes' : 'No',
      drop.tested    ? 'Yes' : 'No', done ? '✓' : '✗', drop.notes || '',
    ];

    vals.forEach((v, ci) => {
      const cell = row.getCell(ci + 1);
      cell.value = v;
      applyFill(cell, C.attnFill); applyBorders(cell);
      switch (ci) {
        case 0: applyFont(cell, { bold: true, size: 10 });                      applyAlign(cell, 'left'); break;
        case 1: applyFont(cell, { argb: C.idfBlue, bold: true, size: 10 });    applyAlign(cell, 'center'); break;
        case 2: applyFont(cell, { argb: C.typeViolet, bold: true, size: 10 }); applyAlign(cell, 'center'); break;
        case 3: applyFont(cell, { size: 10 });                                  applyAlign(cell, 'left'); break;
        case 4: case 5: case 6: applyFont(cell, { size: 10 });                 applyAlign(cell, 'center'); break;
        case 7: applyFont(cell, { size: 11, bold: true });                      applyAlign(cell, 'center'); break;
        case 8: applyFont(cell, { argb: C.slate, size: 9 });                   applyAlign(cell, 'left', 'middle', true); break;
        default: applyFont(cell, { size: 10 }); break;
      }
    });
  });

  const lastRow = attnDrops.length + 3;
  ws.addConditionalFormatting({
    ref: `E4:G${lastRow}`,
    rules: [
      { type: 'cellIs', operator: 'equal', formulae: ['"Yes"'], style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: C.greenFill } }, font: { bold: true, color: { argb: C.greenDark } } } },
      { type: 'cellIs', operator: 'equal', formulae: ['"No"'],  style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: C.redFill }   }, font: { bold: true, color: { argb: C.redDark }   } } },
    ],
  });
  ws.addConditionalFormatting({
    ref: `H4:H${lastRow}`,
    rules: [
      { type: 'cellIs', operator: 'equal', formulae: ['"✓"'], style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: C.greenFill } }, font: { bold: true, color: { argb: C.greenDark }, size: 11 } } },
      { type: 'cellIs', operator: 'equal', formulae: ['"✗"'], style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: C.redFill }   }, font: { bold: true, color: { argb: C.redDark },   size: 11 } } },
    ],
  });

  autoFitColumns(ws, { 1: { min: 20, max: 40 }, 9: { min: 20, max: 50 } }, [1, 9]);
}

// ── Not Started sheet ────────────────────────────────────────────────────────
/**
 * Cross-project punch list of every drop where zero progress has been logged
 * (roughPull, terminated, AND tested are all false). A PM can hand this sheet
 * directly to a crew lead as a "what still needs scheduling" list. Sheet is
 * skipped if every drop across all projects has at least one step done.
 */
function buildNotStartedSheet(wb, projects) {
  const nsDrops = [];
  projects.forEach(p => {
    sortedDrops(p.drops).forEach(d => {
      if (isNotStarted(d)) nsDrops.push({ ...d, _projectName: p.name });
    });
  });
  if (nsDrops.length === 0) return;

  const ws = wb.addWorksheet('Not Started', {
    tabColor: { argb: 'FFEF4444' },   // Red — nothing done, needs attention
    pageSetup: {
      orientation: 'landscape', fitToPage: true,
      fitToWidth: 1, fitToHeight: 0, printTitlesRow: '1:3',
    },
  });
  const NUM = 7;

  ws.columns = [
    { key: 'project', width: 28 }, { key: 'idf',   width: 12 },
    { key: 'type',    width: 14 }, { key: 'cable', width: 22 },
    { key: 'attn',    width: 13 }, { key: 'notes', width: 50 },
    { key: 'date',    width: 15 },
  ];
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 3 }];

  bannerRow(ws, 1,
    `Not Started  —  ${nsDrops.length} drops with zero progress logged across ${projects.length} projects`,
    C.navyDeep, C.white, 13, 26);
  ws.mergeCells(1, 1, 1, NUM);

  bannerRow(ws, 2,
    `Generated: ${new Date().toLocaleString()}  |  No rough pull, termination, or testing recorded on these runs`,
    C.navyMid, C.muted, 9, 18);
  ws.mergeCells(2, 1, 2, NUM);

  headerRow(ws, 3, ['Project', 'IDF', 'Type', 'Cable ID(s)', 'Attention', 'Notes', 'Date Added'], [0, 3, 5], 20);
  ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: NUM } };

  nsDrops.forEach((drop, i) => {
    const row  = ws.getRow(i + 4);
    row.height = 22;
    const vals = [
      drop._projectName, drop.idf || '', typeName(drop), cableIds(drop),
      isAttention(drop) ? '⚠ Yes' : 'No', drop.notes || '', drop.createdAt || '',
    ];

    vals.forEach((v, ci) => {
      const cell = row.getCell(ci + 1);
      cell.value = v;
      // Soft red background — visually distinct from attention (amber) and normal (purple)
      applyFill(cell, C.notStartedFill); applyBorders(cell);
      switch (ci) {
        case 0: applyFont(cell, { bold: true, size: 10 });                      applyAlign(cell, 'left'); break;
        case 1: applyFont(cell, { argb: C.idfBlue, bold: true, size: 10 });    applyAlign(cell, 'center'); break;
        case 2: applyFont(cell, { argb: C.typeViolet, bold: true, size: 10 }); applyAlign(cell, 'center'); break;
        case 3: applyFont(cell, { size: 10 });                                  applyAlign(cell, 'left'); break;
        case 4:
          if (isAttention(drop)) {
            applyFill(cell, C.attnFill);
            applyFont(cell, { argb: C.attnText, bold: true, size: 10 });
          } else {
            applyFont(cell, { argb: C.muted, size: 10 });
          }
          applyAlign(cell, 'center'); break;
        case 5: applyFont(cell, { argb: C.slate, size: 9 });  applyAlign(cell, 'left', 'middle', true); break;
        case 6: applyFont(cell, { argb: C.slate, size: 9 });  applyAlign(cell, 'center'); break;
        default: applyFont(cell, { size: 10 }); break;
      }
    });
  });

  autoFitColumns(ws, { 1: { min: 20, max: 40 }, 6: { min: 20, max: 50 }, 7: { min: 14, max: 26 } }, [1, 6, 7]);
}

// ── Main export function ─────────────────────────────────────────────────────

export async function exportGroupToExcel(group, projects) {
  if (!projects || projects.length === 0) {
    throw new Error('No projects to export.');
  }

  const wb   = new ExcelJS.Workbook();
  wb.creator = 'CablePull Tracker';
  wb.created = new Date();

  // ── Sheet build order ─────────────────────────────────────────────────────
  // 1. Group Summary (blue tab)
  // 2. ⚠ Attention Items (amber tab, if any flagged)
  // 3. Not Started (red tab, if any unstarted)
  // 4. Per-project pairs: main drop sheet (coloured tab) + By IDF sheet (teal tab)
  buildSummarySheet(wb, group, projects);
  buildAttentionSheet(wb, projects);
  buildNotStartedSheet(wb, projects);

  // Track all sheet names to prevent duplicates
  const usedNames = new Set(['Group Summary', '⚠ Attention Items', 'Not Started']);

  for (const project of projects) {
    // ── Main project sheet name ─────────────────────────────────────────────
    let baseName  = project.name.replace(/[\\/*?[\]:]/g, '').trim().slice(0, 31);
    let candidate = baseName;
    let suffix    = 2;
    while (usedNames.has(candidate)) {
      candidate = baseName.slice(0, 28) + ` ${suffix++}`;
    }
    usedNames.add(candidate);

    // buildProjectSheet mutates each drop: sets drop._mainRowNum
    // This MUST run before buildProjectIdfSheet which reads those row numbers.
    buildProjectSheet(wb, project, candidate);

    // ── By IDF sheet name — teal tab paired with its project sheet ──────────
    // Capped at 31 chars: 26 chars of project name + ' IDF' (4 chars) = 30 max
    const idfBase      = candidate.slice(0, 26) + ' IDF';
    let   idfCandidate = idfBase;
    let   idfSuffix    = 2;
    while (usedNames.has(idfCandidate)) {
      idfCandidate = idfBase.slice(0, 26) + ` ${idfSuffix++}`;
    }
    usedNames.add(idfCandidate);

    buildProjectIdfSheet(wb, project, candidate, idfCandidate);
  }

  // ── Write & share ─────────────────────────────────────────────────────────
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
