import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import * as XLSX from 'xlsx';

// ─── PDF Export ──────────────────────────────────────────────────────────────
export async function exportPDF(drops) {
  const rp = drops.filter(d => d.roughPull).length;
  const tm = drops.filter(d => d.terminated).length;
  const ts = drops.filter(d => d.tested).length;

  const rows = drops.map((d, i) => {
    const bg = i % 2 === 0 ? '#f8fafc' : '#ffffff';
    const cable = d.isDouble ? `${d.cableA || '—'} / ${d.cableB || '—'}` : (d.cableA || '—');
    const tick = (v) => v
      ? `<span style="color:#16a34a;font-weight:700;">✓</span>`
      : `<span style="color:#dc2626;">✗</span>`;
    return `
      <tr style="background:${bg}">
        <td>${cable}</td>
        <td>${d.idf || '—'}</td>
        <td>${d.isDouble ? '<b style="color:#7c3aed;">Double</b>' : 'Single'}</td>
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
        h1 { font-size: 22px; margin: 0 0 4px; color: #0f172a; }
        .meta { font-size: 12px; color: #64748b; margin-bottom: 6px; }
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
      <h1>🔌 CablePull Field Tracker — Report</h1>
      <div class="meta">Generated: ${new Date().toLocaleString()}</div>
      <div class="summary">
        <div class="stat"><b>${drops.length}</b><span>Total Drops</span></div>
        <div class="stat"><b style="color:#d97706">${rp}/${drops.length}</b><span>Rough Pulled</span></div>
        <div class="stat"><b style="color:#2563eb">${tm}/${drops.length}</b><span>Terminated</span></div>
        <div class="stat"><b style="color:#16a34a">${ts}/${drops.length}</b><span>Tested</span></div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Cable ID(s)</th><th>IDF</th><th>Type</th>
            <th>Rough Pull</th><th>Terminated</th><th>Tested</th>
            <th>Notes</th><th>Date</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="footer">CablePull Tracker • ${drops.length} total drops</div>
    </body>
    </html>`;

  const { uri } = await Print.printToFileAsync({ html, base64: false });
  await Sharing.shareAsync(uri, {
    UTI: '.pdf',
    mimeType: 'application/pdf',
    dialogTitle: 'Share Cable Pull Report (PDF)',
  });
}

// ─── Excel Export ─────────────────────────────────────────────────────────────
export async function exportXLSX(drops) {
  const data = drops.map(d => ({
    'Cable ID(s)':  d.isDouble ? `${d.cableA} / ${d.cableB}` : d.cableA,
    'IDF':          d.idf || '',
    'Type':         d.isDouble ? 'Double' : 'Single',
    'Rough Pull':   d.roughPull  ? 'Yes' : 'No',
    'Terminated':   d.terminated ? 'Yes' : 'No',
    'Tested':       d.tested     ? 'Yes' : 'No',
    'Notes':        d.notes || '',
    'Date Added':   d.createdAt,
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = [22, 10, 9, 12, 13, 9, 40, 13].map(w => ({ wch: w }));

  // Bold header row styling
  const headerKeys = ['A1','B1','C1','D1','E1','F1','G1','H1'];
  headerKeys.forEach(k => {
    if (ws[k]) ws[k].s = { font: { bold: true }, fill: { fgColor: { rgb: '0F172A' } } };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Cable Drops');

  // Summary sheet
  const summaryData = [
    { 'Metric': 'Total Drops',    'Count': drops.length },
    { 'Metric': 'Double Drops',   'Count': drops.filter(d => d.isDouble).length },
    { 'Metric': 'Rough Pulled',   'Count': drops.filter(d => d.roughPull).length },
    { 'Metric': 'Terminated',     'Count': drops.filter(d => d.terminated).length },
    { 'Metric': 'Tested',         'Count': drops.filter(d => d.tested).length },
    { 'Metric': 'Fully Complete', 'Count': drops.filter(d => d.roughPull && d.terminated && d.tested).length },
    { 'Metric': 'Report Date',    'Count': new Date().toLocaleString() },
  ];
  const wsSummary = XLSX.utils.json_to_sheet(summaryData);
  wsSummary['!cols'] = [{ wch: 20 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  const fileUri = FileSystem.cacheDirectory + 'cable-pull-tracker.xlsx';
  await FileSystem.writeAsStringAsync(fileUri, wbout, {
    encoding: FileSystem.EncodingType.Base64,
  });
  await Sharing.shareAsync(fileUri, {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    dialogTitle: 'Share Cable Pull Report (Excel)',
    UTI: 'com.microsoft.excel.xlsx',
  });
}
