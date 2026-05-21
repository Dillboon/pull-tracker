/**
 * exportGroupUtils.js
 *
 * Enhanced Group "Export All" — visually polished and optimised for project
 * manager workflows (frozen panes, auto-filters, true numeric percentages,
 * word-wrap, colour-scale % Done, per-project attention flags).
 */

import * as FileSystem from 'expo-file-system';
import * as Sharing    from 'expo-sharing';
import ExcelJS         from 'exceljs';

// ── Colour palette (matches exportUtils.js exactly) ─────────────────────────
const C = {
  navyDeep:      'FF0A1628',
  navyMid:       'FF0F172A',
  navyHeader:    'FF0F2744',
  navySection:   'FF1E2D40',
  amber:         'FFFBBF24',
  white:         'FFFFFFFF',
  purple1:       'FFF3EEFF',
  purple2:       'FFE9E0FF',
  idfBlue:       'FF1E40AF',
  typeViolet:    'FF7C3AED',
  slate:         'FF64748B',
  muted:         'FF94A3B8',
  attnFill:      'FFFFF7ED',
  attnText:      'FFD97706',
  greenText:     'FF16A34A',
  patchedText:   'FF065F46',
  borderSubtle:  'FFCBD5E1',
};

// Tab colours rotated across per-project sheets
const TAB_PALETTE = [
  'FF3B82F6', 'FF8B5CF6', 'FF10B981', 'FFF59E0B',
  'FFEF4444', 'FF06B6D4', 'FFD946EF', 'FF84CC16',
];

// ── Utility: ArrayBuffer → base64 (chunked to avoid stack overflow) ──────────
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
    name:   'Calibri',
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
    top:    { style: 'thin', color: { argb: C.borderSubtle } },
    left:   { style: 'thin', color: { argb: C.borderSubtle } },
    bottom: { style: 'thin', color: { argb: C.borderSubtle } },
    right:  { style: 'thin', color: { argb: C.borderSubtle } },
  };
}

// Full-width banner row (title / subtitle style)
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

// Column-header row (amber text on navy)
function headerRow(ws, rowNum, labels, height = 20) {
  const row  = ws.getRow(rowNum);
  row.height = height;
  labels.forEach((label, i) => {
    const cell  = row.getCell(i + 1);
    cell.value  = label;
    applyFill(cell, C.navyHeader);
    applyFont(cell, { argb: C.amber, bold: true, size: 10 });
    applyAlign(cell, i === 0 ? 'left' : 'center');
    cell.border = {
      top:    { style: 'medium', color: { argb: C.navyDeep } },
      bottom: { style: 'medium', color: { argb: C.navyDeep } },
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

function isAttention(drop) {
  return drop.attention === true;
}

function getPatchedLabel(drop) {
  const ids = [];
  if (drop.patchedA && drop.cableA) ids.push(drop.cableA);
  if (drop.patchedB && drop.cableB) ids.push(drop.cableB);
  if (drop.patchedC && drop.cableC) ids.push(drop.cableC);
  if (drop.patchedD && drop.cableD) ids.push(drop.cableD);
  return ids.length > 0 ? `Yes (${ids.join('/')})` : 'No';
}

function isPatched(drop) {
  return drop.patchedA || drop.patchedB || drop.patchedC || drop.patchedD;
}

// ── Group Summary sheet ──────────────────────────────────────────────────────

function buildSummarySheet(wb, group, projects) {
  const ws = wb.addWorksheet('Group Summary', { tabColor: { argb: 'FF22C55E' } });

  // 9 columns: Project | Total | RP | Term | Tested | Completed | Attention | Patched | % Done
  const NUM = 9;
  [36, 12, 14, 14, 12, 12, 12, 12, 12].forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });

  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 3 }];

  // ── Portfolio totals for the subtitle ──
  const allDrops   = projects.reduce((s, p) => s + p.drops.length, 0);
  const allPulled  = projects.reduce((s, p) => s + p.drops.filter(d => d.roughPull).length, 0);
  const allTerm    = projects.reduce((s, p) => s + p.drops.filter(d => d.terminated).length, 0);
  const allTested  = projects.reduce((s, p) => s + p.drops.filter(d => d.tested).length, 0);
  const allDone    = projects.reduce((s, p) => s + p.drops.filter(d => d.roughPull && d.terminated && d.tested).length, 0);
  const allAttn    = projects.reduce((s, p) => s + p.drops.filter(d => isAttention(d)).length, 0);
  const allPatched = projects.reduce((s, p) => s + p.drops.filter(d => isPatched(d)).length, 0);

  const titleText = `Group Export  —  ${group.name}  |  Generated: ${new Date().toLocaleString()}`;
  bannerRow(ws, 1, titleText, C.navyDeep, C.white, 13, 26);
  ws.mergeCells(1, 1, 1, NUM);

  const subtitleText = `${projects.length} projects  |  Total: ${allDrops}  |  Rough pulled: ${allPulled}  |  Terminated: ${allTerm}  |  Tested: ${allTested}  |  Complete: ${allDone}  |  Attention: ${allAttn}  |  Patched: ${allPatched}`;
  bannerRow(ws, 2, subtitleText, C.navyMid, C.muted, 9, 18);
  ws.mergeCells(2, 1, 2, NUM);

  headerRow(ws, 3, ['Project', 'Total', 'Rough Pulled', 'Terminated', 'Tested', 'Completed', 'Attention', 'Patched', '% Done'], 20);

  ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: NUM } };

  projects.forEach((p, i) => {
    const total   = p.drops.length;
    const pulled  = p.drops.filter(d => d.roughPull).length;
    const term    = p.drops.filter(d => d.terminated).length;
    const tested  = p.drops.filter(d => d.tested).length;
    const done    = p.drops.filter(d => d.roughPull && d.terminated && d.tested).length;
    const attn    = p.drops.filter(d => isAttention(d)).length;
    const patched = p.drops.filter(d => isPatched(d)).length;
    const pct     = total > 0 ? (done / total) : 0;
    const fill    = rowFill(i);

    const row  = ws.getRow(i + 4);
    row.height = 20;

    const vals   = [p.name, total, pulled, term, tested, done, attn, patched, total > 0 ? pct : 0];
    const aligns = ['left','center','center','center','center','center','center','center','center'];

    vals.forEach((v, ci) => {
      const cell = row.getCell(ci + 1);
      cell.value = v;
      applyFill(cell, fill);
      applyBorders(cell);
      applyFont(cell, { size: 10, bold: ci === 0 });
      applyAlign(cell, aligns[ci]);

      // % Done column (index 8 = col 9)
      if (ci === 8) {
        cell.numFmt = '0%';
        const pctColor = pct === 1 ? C.greenText : pct > 0 ? C.attnText : C.muted;
        applyFont(cell, { argb: pctColor, bold: true, size: 10 });
      }

      // Attention count — highlight if non-zero
      if (ci === 6 && attn > 0) {
        applyFont(cell, { argb: C.attnText, bold: true, size: 10 });
      }
    });
  });

  // Totals row
  const totalPct  = allDrops > 0 ? (allDone / allDrops) : 0;
  const totRow    = ws.getRow(projects.length + 4);
  totRow.height   = 22;
  const totVals   = ['TOTAL PORTFOLIO', allDrops, allPulled, allTerm, allTested, allDone, allAttn, allPatched, totalPct];

  totVals.forEach((v, ci) => {
    const cell = totRow.getCell(ci + 1);
    cell.value = v;
    applyFill(cell, C.navyHeader);
    applyBorders(cell);
    applyFont(cell, { argb: C.amber, bold: true, size: 11 });
    applyAlign(cell, ci === 0 ? 'left' : 'center');
    if (ci === 8) cell.numFmt = '0%';
  });

  // Color-scale on % Done (col 9 = I) — red → yellow → green
  if (projects.length > 0) {
    ws.addConditionalFormatting({
      ref: `I4:I${projects.length + 3}`,
      rules: [{
        type: 'colorScale',
        colorScale: {
          cfvo:  [{ type: 'num', value: 0 }, { type: 'num', value: 0.5 }, { type: 'num', value: 1 }],
          color: [{ argb: 'FFFCA5A5' }, { argb: 'FFFDE68A' }, { argb: 'FF86EFAC' }],
        },
      }],
    });
  }

  // ── Flagged Items section — PM quick-reference ──────────────────────────────
  const flaggedDrops = projects.flatMap(p =>
    p.drops
      .filter(d => isAttention(d))
      .map(d => ({ project: p.name, drop: d }))
  );

  if (flaggedDrops.length > 0) {
    const sepRow = ws.addRow(Array(NUM).fill(''));
    sepRow.height = 10;

    const flagBannerRow = ws.getRow(ws.rowCount + 1);
    flagBannerRow.height = 20;
    const flagBannerCell = flagBannerRow.getCell(1);
    flagBannerCell.value = `⚠  Flagged Items Across Group  (${flaggedDrops.length})`;
    applyFill(flagBannerCell, C.navySection);
    applyFont(flagBannerCell, { argb: C.attnText, bold: true, size: 10 });
    applyAlign(flagBannerCell, 'left');
    ws.mergeCells(ws.rowCount, 1, ws.rowCount, NUM);

    const flagHdrRow = ws.getRow(ws.rowCount + 1);
    flagHdrRow.height = 18;
    ['Project', 'IDF', 'Cable ID(s)', 'Notes', '', '', '', '', ''].forEach((label, i) => {
      const cell = flagHdrRow.getCell(i + 1);
      cell.value = label;
      applyFill(cell, C.navySection);
      applyFont(cell, { argb: C.muted, bold: true, size: 9 });
      applyAlign(cell, 'left');
      applyBorders(cell);
    });
    ws.mergeCells(ws.rowCount, 4, ws.rowCount, NUM); // Notes spans remaining cols

    flaggedDrops.forEach(({ project, drop }, i) => {
      const flagRow  = ws.getRow(ws.rowCount + 1);
      flagRow.height = 18;
      const fill     = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.attnFill } };

      [project, drop.idf || '—', cableIds(drop), drop.notes || ''].forEach((v, ci) => {
        const cell = flagRow.getCell(ci + 1);
        cell.value = v;
        applyFill(cell, C.attnFill);
        applyBorders(cell);
        applyFont(cell, { argb: ci === 0 ? C.attnText : C.slate, bold: ci === 0, size: 9 });
        applyAlign(cell, 'left', 'middle', ci === 3);
      });
      // Merge notes across remaining cols
      const r = ws.rowCount;
      ws.mergeCells(r, 4, r, NUM);
      // Fill the merged cells
      for (let col = 5; col <= NUM; col++) {
        const c = flagRow.getCell(col);
        applyFill(c, C.attnFill);
        applyBorders(c);
      }
    });
  }
}

// ── Per-project drop sheet ───────────────────────────────────────────────────

function buildProjectSheet(wb, project, sheetName, tabColorArgb) {
  const ws  = wb.addWorksheet(sheetName, {
    tabColor: { argb: tabColorArgb },
    pageSetup: {
      orientation:    'landscape',
      fitToPage:      true,
      fitToWidth:     1,
      fitToHeight:    0,
      printTitlesRow: '1:3',
    },
  });

  // 11 columns: IDF | Type | Cable ID(s) | RP | Term | Tested | Complete | Patched | Attention | Notes | Date
  const NUM = 11;
  [12, 14, 22, 13, 13, 13, 11, 18, 14, 50, 15].forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });

  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 3 }];

  const total   = project.drops.length;
  const pulled  = project.drops.filter(d => d.roughPull).length;
  const term    = project.drops.filter(d => d.terminated).length;
  const tested  = project.drops.filter(d => d.tested).length;
  const done    = project.drops.filter(d => d.roughPull && d.terminated && d.tested).length;
  const patched = project.drops.filter(d => isPatched(d)).length;
  const attn    = project.drops.filter(d => isAttention(d)).length;

  const titleText = `CablePull Field Tracker  —  ${project.name}`;
  bannerRow(ws, 1, titleText, C.navyDeep, C.white, 13, 26);
  ws.mergeCells(1, 1, 1, NUM);

  const subtitle = `Generated: ${new Date().toLocaleString()}  |  Total: ${total}  |  Rough pulled: ${pulled}  |  Terminated: ${term}  |  Tested: ${tested}  |  Completed: ${done}  |  Patched: ${patched}  |  Attention: ${attn}`;
  bannerRow(ws, 2, subtitle, C.navyMid, C.muted, 9, 18);
  ws.mergeCells(2, 1, 2, NUM);

  headerRow(ws, 3, ['IDF', 'Type', 'Cable ID(s)', 'Rough Pull', 'Terminated', 'Tested', 'Complete', 'Patched', 'Attention', 'Notes', 'Date Added'], 22);

  ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: NUM } };

  const lastDataRow = 3 + total;

  project.drops.forEach((drop, i) => {
    const row     = ws.getRow(i + 4);
    row.height    = 22;
    const fill    = rowFill(i);
    const attnYes = isAttention(drop);
    const done    = drop.roughPull && drop.terminated && drop.tested;
    const pLabel  = getPatchedLabel(drop);

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

    // D, E, F, G – Tracking states
    [
      { col: 4, val: drop.roughPull },
      { col: 5, val: drop.terminated },
      { col: 6, val: drop.tested },
      { col: 7, val: done },
    ].forEach(({ col, val }) => {
      const cell = row.getCell(col);
      cell.value = val ? 'Yes' : 'No';
      applyFill(cell, fill);
      applyBorders(cell);
      applyFont(cell, { size: 10, argb: val ? undefined : C.muted });
      applyAlign(cell, 'center');
    });

    // H – Patched
    // FIX: was passing `color: { argb: ... }` — applyFont expects `argb` directly
    const patchedCell = row.getCell(8);
    patchedCell.value = pLabel;
    applyFill(patchedCell, fill);
    applyBorders(patchedCell);
    applyFont(patchedCell, { size: 10, argb: pLabel === 'No' ? C.muted : C.patchedText });
    applyAlign(patchedCell, 'center');

    // I – Attention
    const attnCell = row.getCell(9);
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

    // J – Notes (word-wrap enabled)
    const notesCell = row.getCell(10);
    notesCell.value = drop.notes || '';
    applyFill(notesCell, fill);
    applyBorders(notesCell);
    applyFont(notesCell, { argb: C.slate, size: 9 });
    applyAlign(notesCell, 'left', 'middle', true);

    // K – Date Added
    const dateCell = row.getCell(11);
    dateCell.value = drop.createdAt || '';
    applyFill(dateCell, fill);
    applyBorders(dateCell);
    applyFont(dateCell, { argb: C.slate, size: 9 });
    applyAlign(dateCell, 'center');
  });

  // Conditional formatting on status columns
  if (total > 0) {
    ws.addConditionalFormatting({
      ref: `D4:G${lastDataRow}`,
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
  }

  // ── Project-level totals footer ─────────────────────────────────────────────
  const footerRow = ws.getRow(lastDataRow + 1);
  footerRow.height = 20;
  const footVals = ['TOTALS', total, '', pulled, term, tested, project.drops.filter(d => d.roughPull && d.terminated && d.tested).length, patched, attn, '', ''];
  footVals.forEach((v, ci) => {
    const cell = footerRow.getCell(ci + 1);
    cell.value = v;
    applyFill(cell, C.navyHeader);
    applyBorders(cell);
    applyFont(cell, { argb: C.amber, bold: true, size: 10 });
    applyAlign(cell, ci === 0 ? 'left' : 'center');
  });
}

// ── Main export function ─────────────────────────────────────────────────────

export async function exportGroupToExcel(group, projects) {
  if (!projects || projects.length === 0) {
    throw new Error('No projects to export.');
  }

  const wb = new ExcelJS.Workbook();
  wb.creator        = 'CablePull Tracker';
  wb.lastModifiedBy = 'CablePull Tracker';
  wb.created        = new Date();
  wb.modified       = new Date();
  wb.description    = `Group export — ${group.name}`;

  buildSummarySheet(wb, group, projects);

  const usedNames = new Set(['Group Summary']);
  projects.forEach((project, idx) => {
    let name      = project.name.replace(/[\\/*?[\]:]/g, '').trim().slice(0, 31);
    let candidate = name;
    let suffix    = 2;
    while (usedNames.has(candidate)) {
      candidate = name.slice(0, 28) + ` ${suffix++}`;
    }
    usedNames.add(candidate);

    const tabColor = TAB_PALETTE[idx % TAB_PALETTE.length];
    buildProjectSheet(wb, project, candidate, tabColor);
  });

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
