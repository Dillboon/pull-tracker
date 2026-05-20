/**
 * exportGroupUtils.js
 *
 * Exports all projects in a group as a single Excel workbook:
 *   Sheet 1  →  Summary (all projects, high-level stats)
 *   Sheet 2+ →  One sheet per project (all drops, styled)
 *
 * Place this file at:  src/exportGroupUtils.js
 * Import in ProjectsScreen:  import { exportGroupToExcel } from '../exportGroupUtils';
 */

import * as FileSystem from 'expo-file-system';
import * as Sharing    from 'expo-sharing';
import ExcelJS         from 'exceljs';

// ── Helpers ────────────────────────────────────────────────────────────────

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary  = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + 8192, bytes.length)));
  }
  return btoa(binary);
}

function styleHeader(row, hexColor = '1E3A5F') {
  row.height = 22;
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.font      = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${hexColor}` } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border    = { bottom: { style: 'thin', color: { argb: 'FF93C5FD' } } };
  });
}

function checkCell(cell) {
  cell.font      = { bold: true, color: { argb: 'FF16A34A' }, size: 12 };
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
}

function setColWidths(ws, widths) {
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
}

// ── Summary sheet ──────────────────────────────────────────────────────────

function buildSummarySheet(wb, group, projects) {
  const ws = wb.addWorksheet('Summary');
  setColWidths(ws, [28, 8, 9, 10, 9, 8, 9]);

  // Title row
  const title = ws.addRow([
    `Group Export: ${group.name}  ·  ${new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    })}`,
  ]);
  title.getCell(1).font      = { bold: true, size: 14, color: { argb: 'FF1E40AF' } };
  title.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
  title.height               = 28;
  ws.mergeCells('A1:G1');

  ws.addRow([]); // spacer

  // Header
  const headerRow = ws.addRow(['Project', 'Drops', 'Pulled', 'Terminated', 'Tested', 'Done', '% Done']);
  styleHeader(headerRow, '1E3A5F');

  // Data rows
  projects.forEach((p, i) => {
    const total    = p.drops.length;
    const pulled   = p.drops.filter(d => d.roughPull).length;
    const term     = p.drops.filter(d => d.terminated).length;
    const tested   = p.drops.filter(d => d.tested).length;
    const done     = p.drops.filter(d => d.roughPull && d.terminated && d.tested).length;
    const pct      = total > 0 ? Math.round((done / total) * 100) : 0;

    const row = ws.addRow([p.name, total, pulled, term, tested, done, total > 0 ? `${pct}%` : '—']);
    row.height = 18;

    if (i % 2 === 1) {
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F4FF' } };
      });
    }
    // Colour the % cell
    const pctCell = row.getCell(7);
    pctCell.font = {
      bold: true,
      color: { argb: pct === 100 ? 'FF16A34A' : pct > 0 ? 'FFD97706' : 'FF94A3B8' },
    };
    pctCell.alignment = { horizontal: 'center' };

    // Align number columns
    [2, 3, 4, 5, 6].forEach(col => {
      row.getCell(col).alignment = { horizontal: 'center' };
    });
  });

  // Totals row
  const allDrops  = projects.reduce((s, p) => s + p.drops.length, 0);
  const allPulled = projects.reduce((s, p) => s + p.drops.filter(d => d.roughPull).length, 0);
  const allTerm   = projects.reduce((s, p) => s + p.drops.filter(d => d.terminated).length, 0);
  const allTest   = projects.reduce((s, p) => s + p.drops.filter(d => d.tested).length, 0);
  const allDone   = projects.reduce((s, p) => s + p.drops.filter(d => d.roughPull && d.terminated && d.tested).length, 0);
  const totalPct  = allDrops > 0 ? Math.round((allDone / allDrops) * 100) : 0;

  ws.addRow([]); // spacer before totals
  const totalsRow = ws.addRow(['TOTAL', allDrops, allPulled, allTerm, allTest, allDone, `${totalPct}%`]);
  styleHeader(totalsRow, '1E3A5F');
  totalsRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
}

// ── Per-project sheet ──────────────────────────────────────────────────────

function buildProjectSheet(wb, project) {
  // Sanitise sheet name: max 31 chars, no special chars Excel won't accept
  const sheetName = project.name
    .replace(/[\\/*?[\]:]/g, '')
    .trim()
    .slice(0, 31);

  const ws = wb.addWorksheet(sheetName);
  setColWidths(ws, [5, 9, 14, 14, 14, 14, 12, 11, 12, 9, 26, 12]);

  // Title
  const title = ws.addRow([
    `Project: ${project.name}  ·  Exported ${new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    })}`,
  ]);
  title.getCell(1).font      = { bold: true, size: 12, color: { argb: 'FF1E40AF' } };
  title.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
  title.height               = 24;
  ws.mergeCells(`A1:L1`);

  // Stats mini-bar
  const total  = project.drops.length;
  const pulled = project.drops.filter(d => d.roughPull).length;
  const term   = project.drops.filter(d => d.terminated).length;
  const tested = project.drops.filter(d => d.tested).length;
  const done   = project.drops.filter(d => d.roughPull && d.terminated && d.tested).length;
  const pct    = total > 0 ? Math.round((done / total) * 100) : 0;

  const stats = ws.addRow([
    `${total} drops  ·  ${pulled} pulled  ·  ${term} terminated  ·  ${tested} tested  ·  ${done} done  (${pct}% complete)`,
  ]);
  stats.getCell(1).font      = { italic: true, color: { argb: 'FF64748B' }, size: 10 };
  stats.getCell(1).alignment = { horizontal: 'left' };
  ws.mergeCells(`A2:L2`);

  ws.addRow([]); // spacer

  // Header
  const headers = ['#', 'Type', 'Cable A', 'Cable B', 'Cable C', 'Cable D',
    'IDF', 'Rough Pull', 'Terminated', 'Tested', 'Notes', 'Created'];
  const headerRow = ws.addRow(headers);
  styleHeader(headerRow, '1E3A5F');
  headerRow.height = 22;

  // Data rows
  project.drops.forEach((d, i) => {
    const type = d.groupType
      ? (d.groupType.charAt(0).toUpperCase() + d.groupType.slice(1))
      : (d.isDouble ? 'Double' : 'Single');

    const row = ws.addRow([
      i + 1,
      type,
      d.cableA    || '',
      d.cableB    || '',
      d.cableC    || '',
      d.cableD    || '',
      d.idf       || '',
      d.roughPull  ? '✓' : '',
      d.terminated ? '✓' : '',
      d.tested     ? '✓' : '',
      d.notes     || '',
      d.createdAt || '',
    ]);
    row.height = 18;

    // Alternate row tint
    if (i % 2 === 1) {
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F4FF' } };
      });
    }

    // Centre + colour checkmark cells (cols 8, 9, 10)
    [8, 9, 10].forEach(col => {
      const cell = row.getCell(col);
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      if (cell.value === '✓') checkCell(cell);
    });

    // Centre # and Type columns
    [1, 2].forEach(col => {
      row.getCell(col).alignment = { horizontal: 'center', vertical: 'middle' };
    });
  });

  // IDF list footnote
  if (project.idfList?.length > 0) {
    ws.addRow([]);
    const idfRow = ws.addRow([`IDF Closets: ${project.idfList.join(', ')}`]);
    idfRow.getCell(1).font      = { italic: true, color: { argb: 'FF64748B' }, size: 10 };
    idfRow.getCell(1).alignment = { horizontal: 'left' };
    ws.mergeCells(`A${idfRow.number}:L${idfRow.number}`);
  }
}

// ── Main export function ───────────────────────────────────────────────────

export async function exportGroupToExcel(group, projects) {
  if (!projects || projects.length === 0) {
    throw new Error('No projects to export.');
  }

  const wb    = new ExcelJS.Workbook();
  wb.creator  = 'CablePull Tracker';
  wb.created  = new Date();

  // Summary tab first, then one tab per project
  buildSummarySheet(wb, group, projects);
  for (const project of projects) {
    buildProjectSheet(wb, project);
  }

  // Write → base64 → cache file → share
  const buffer   = await wb.xlsx.writeBuffer();
  const base64   = arrayBufferToBase64(buffer);
  const safeName = group.name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
  const filename = `${safeName}_export_${Date.now()}.xlsx`;
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
