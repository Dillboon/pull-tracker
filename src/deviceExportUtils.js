import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import * as XLSX from 'xlsx';

// ─── Sort by device type then device ID ──────────────────────────────────────
const sortedDevices = (devices) => [...devices].sort((a, b) => {
  if (a.deviceType < b.deviceType) return -1;
  if (a.deviceType > b.deviceType) return 1;
  return (a.deviceId || '').localeCompare(b.deviceId || '');
});

// ─── PDF Export ───────────────────────────────────────────────────────────────
export async function exportDevicesPDF(devices, projectName = '') {
  const sorted   = sortedDevices(devices);
  const total    = sorted.length;
  const rp       = sorted.filter(d => d.roughPull).length;
  const rfi      = sorted.filter(d => d.rfi).length;
  const inst     = sorted.filter(d => d.installed).length;
  const prog     = sorted.filter(d => d.programmed).length;
  const tested   = sorted.filter(d => d.tested).length;
  const complete = sorted.filter(d => d.roughPull && d.rfi && d.installed && d.programmed && d.tested).length;

  // ── Per-type summary ──────────────────────────────────────────────────────
  const types = [...new Set(sorted.map(d => d.deviceType).filter(Boolean))].sort();
  const typeTableRows = types.map(type => {
    const td    = sorted.filter(d => d.deviceType === type);
    const tdone = td.filter(d => d.roughPull && d.rfi && d.installed && d.programmed && d.tested).length;
    const tpct  = td.length > 0 ? Math.round((tdone / td.length) * 100) : 0;
    const barColor = tpct === 100 ? '#16a34a' : tpct >= 50 ? '#d97706' : '#dc2626';
    return `
      <tr>
        <td style="font-weight:700;color:#0f766e">${type}</td>
        <td style="text-align:center">${td.length}</td>
        <td style="text-align:center;color:#d97706;font-weight:600">${td.filter(d=>d.roughPull).length}</td>
        <td style="text-align:center;color:#3b82f6;font-weight:600">${td.filter(d=>d.rfi).length}</td>
        <td style="text-align:center;color:#7c3aed;font-weight:600">${td.filter(d=>d.installed).length}</td>
        <td style="text-align:center;color:#f97316;font-weight:600">${td.filter(d=>d.programmed).length}</td>
        <td style="text-align:center;color:#16a34a;font-weight:600">${tdone}/${td.length}</td>
        <td style="min-width:70px;padding:4px 6px">
          <div style="background:#e2e8f0;border-radius:3px;height:7px;overflow:hidden">
            <div style="width:${tpct}%;background:${barColor};height:100%;border-radius:3px"></div>
          </div>
          <div style="font-size:9px;color:${barColor};font-weight:700;margin-top:2px">${tpct}%</div>
        </td>
      </tr>`;
  }).join('');

  // ── Main rows ─────────────────────────────────────────────────────────────
  const tick = (v) => v
    ? `<span style="color:#16a34a;font-weight:700">✓</span>`
    : `<span style="color:#dc2626">✗</span>`;

  const rows = sorted.map((d, i) => {
    const bg = i % 2 === 0 ? '#f8fafc' : '#ffffff';
    return `
      <tr style="background:${bg}">
        <td style="font-weight:700;color:#0f766e">${d.deviceType || '—'}</td>
        <td style="font-family:monospace">${d.deviceId || '—'}</td>
        <td style="color:#555">${d.location || '—'}</td>
        <td style="font-weight:600;color:#1e40af">${d.idf || '—'}</td>
        <td style="text-align:center">${tick(d.roughPull)}</td>
        <td style="text-align:center">${tick(d.rfi)}</td>
        <td style="text-align:center">${tick(d.installed)}</td>
        <td style="text-align:center">${tick(d.programmed)}</td>
        <td style="text-align:center">${tick(d.tested)}</td>
        <td style="color:#555;font-size:10px">${d.notes || ''}</td>
        <td style="color:#94a3b8;font-size:10px;text-align:center">${d.createdAt}</td>
      </tr>`;
  }).join('');

  const pBar = (count, label, color) => {
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return `
      <div style="margin-bottom:9px">
        <div style="display:flex;justify-content:space-between;margin-bottom:3px">
          <span style="font-size:11px;font-weight:600;color:#475569">${label}</span>
          <span style="font-size:11px;font-weight:700;color:${color}">${count}/${total} (${pct}%)</span>
        </div>
        <div style="background:#e2e8f0;border-radius:4px;height:7px;overflow:hidden">
          <div style="width:${pct}%;background:${color};height:100%;border-radius:4px"></div>
        </div>
      </div>`;
  };

  const html = `
    <!DOCTYPE html><html><head><meta charset="UTF-8"/>
    <style>
      @page { size: A4 landscape; margin: 14mm; }
      body { font-family: -apple-system, Arial, sans-serif; margin:0; padding:0; color:#111; font-size:12px; }
      .topbar { background:#0f172a; color:#14b8a6; padding:11px 16px; border-radius:6px; margin-bottom:6px; display:flex; justify-content:space-between; align-items:center; }
      .topbar h1 { margin:0; font-size:17px; color:#14b8a6; }
      .topbar .project { font-size:11px; color:#94a3b8; margin-top:2px; }
      .topbar .meta { font-size:10px; color:#64748b; text-align:right; }
      .section-title { font-size:10px; font-weight:800; letter-spacing:0.08em; color:#475569; margin:12px 0 5px; text-transform:uppercase; }
      .two-col { display:flex; gap:14px; margin-bottom:12px; }
      .col-left { flex:1; }
      .col-right { width:240px; flex-shrink:0; }
      .stats-grid { display:flex; gap:8px; margin-bottom:12px; }
      .stat-box { flex:1; background:#f8fafc; border:1px solid #e2e8f0; border-radius:5px; padding:8px 10px; }
      .stat-box b { display:block; font-size:18px; font-weight:800; }
      .stat-box span { font-size:9px; color:#64748b; font-weight:600; }
      table { width:100%; border-collapse:collapse; font-size:11px; }
      thead tr { background:#0f172a; color:#14b8a6; }
      thead th { padding:6px; text-align:left; font-size:9px; letter-spacing:0.05em; text-transform:uppercase; white-space:nowrap; }
      thead th.c { text-align:center; }
      tbody td { padding:5px 6px; border-bottom:1px solid #e2e8f0; vertical-align:middle; }
      .type-table { border:1px solid #e2e8f0; border-radius:5px; overflow:hidden; }
      .type-table thead tr { background:#134e4a; }
      .footer { margin-top:12px; font-size:9px; color:#94a3b8; text-align:center; border-top:1px solid #e2e8f0; padding-top:7px; }
    </style></head><body>

      <div class="topbar">
        <div>
          <h1>📟 Device Tracker</h1>
          ${projectName ? `<div class="project">Project: ${projectName}</div>` : ''}
        </div>
        <div class="meta">Generated: ${new Date().toLocaleString()}<br/>${total} total devices</div>
      </div>

      <div class="two-col">
        <div class="col-left">
          <div class="section-title">Overview</div>
          <div class="stats-grid">
            <div class="stat-box"><b>${total}</b><span>Total Devices</span></div>
            <div class="stat-box"><b style="color:#d97706">${rp}</b><span>Rough Pulled</span></div>
            <div class="stat-box"><b style="color:#3b82f6">${rfi}</b><span>RFI</span></div>
            <div class="stat-box"><b style="color:#7c3aed">${inst}</b><span>Installed</span></div>
            <div class="stat-box"><b style="color:#f97316">${prog}</b><span>Programmed</span></div>
            <div class="stat-box"><b style="color:#16a34a">${complete}</b><span>Complete</span></div>
          </div>
          <div class="section-title">Completion Progress</div>
          ${pBar(rp,       'Rough Pulled', '#d97706')}
          ${pBar(rfi,      'RFI',          '#3b82f6')}
          ${pBar(inst,     'Installed',    '#7c3aed')}
          ${pBar(prog,     'Programmed',   '#f97316')}
          ${pBar(tested,   'Tested',       '#16a34a')}
          ${pBar(complete, 'Complete',     '#14b8a6')}
        </div>
        ${types.length > 0 ? `
        <div class="col-right">
          <div class="section-title">By Device Type</div>
          <table class="type-table">
            <thead><tr>
              <th>Type</th><th class="c">Total</th><th class="c">RP</th>
              <th class="c">RFI</th><th class="c">IN</th><th class="c">PG</th>
              <th class="c">Done</th><th class="c">%</th>
            </tr></thead>
            <tbody>${typeTableRows}</tbody>
          </table>
        </div>` : ''}
      </div>

      <div class="section-title">All Devices</div>
      <table>
        <thead>
          <tr>
            <th>Type</th><th>Device ID</th><th>Location</th><th>IDF</th>
            <th class="c">Rough Pull</th><th class="c">RFI</th>
            <th class="c">Installed</th><th class="c">Programmed</th><th class="c">Tested</th>
            <th>Notes</th><th class="c">Date</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <div class="footer">
        Device Tracker${projectName ? ` · ${projectName}` : ''} · ${total} devices · ${new Date().toLocaleString()}
      </div>
    </body></html>`;

  const { uri } = await Print.printToFileAsync({ html, base64: false });
  await Sharing.shareAsync(uri, {
    UTI: '.pdf', mimeType: 'application/pdf',
    dialogTitle: `Share ${projectName || 'Device'} Report (PDF)`,
  });
}

// ─── Excel Export ─────────────────────────────────────────────────────────────
export async function exportDevicesXLSX(devices, projectName = '') {
  const sorted = sortedDevices(devices);

  const data = sorted.map(d => ({
    'Device Type':  d.deviceType  || '',
    'Device ID':    d.deviceId    || '',
    'Location':     d.location    || '',
    'IDF / Panel':  d.idf         || '',
    'Rough Pull':   d.roughPull   ? 'Yes' : 'No',
    'RFI':          d.rfi         ? 'Yes' : 'No',
    'Installed':    d.installed   ? 'Yes' : 'No',
    'Programmed':   d.programmed  ? 'Yes' : 'No',
    'Tested':       d.tested      ? 'Yes' : 'No',
    'Notes':        d.notes       || '',
    'Date Added':   d.createdAt,
  }));

  const headers = ['Device Type', 'Device ID', 'Location', 'IDF / Panel',
    'Rough Pull', 'RFI', 'Installed', 'Programmed', 'Tested', 'Notes', 'Date Added'];

  const ws = XLSX.utils.json_to_sheet(data, { header: headers });
  ws['!cols'] = [14, 14, 18, 10, 12, 8, 11, 13, 9, 40, 13].map(w => ({ wch: w }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Devices');

  // Summary sheet
  const total    = sorted.length;
  const complete = sorted.filter(d => d.roughPull && d.rfi && d.installed && d.programmed && d.tested).length;
  const summaryData = [
    { 'Metric': 'Project',       'Value': projectName || '—' },
    { 'Metric': 'Total Devices', 'Value': String(total) },
    { 'Metric': 'Rough Pulled',  'Value': String(sorted.filter(d => d.roughPull).length) },
    { 'Metric': 'RFI',           'Value': String(sorted.filter(d => d.rfi).length) },
    { 'Metric': 'Installed',     'Value': String(sorted.filter(d => d.installed).length) },
    { 'Metric': 'Programmed',    'Value': String(sorted.filter(d => d.programmed).length) },
    { 'Metric': 'Tested',        'Value': String(sorted.filter(d => d.tested).length) },
    { 'Metric': 'Fully Complete','Value': String(complete) },
    { 'Metric': 'Report Date',   'Value': new Date().toLocaleString() },
  ];
  const wsSummary = XLSX.utils.json_to_sheet(summaryData, { header: ['Metric', 'Value'] });
  wsSummary['!cols'] = [{ wch: 20 }, { wch: 24 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  const wbout   = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  const safeName = (projectName || 'devices').replace(/[^a-z0-9]/gi, '-').toLowerCase();
  const fileUri  = FileSystem.cacheDirectory + `${safeName}-devices.xlsx`;
  await FileSystem.writeAsStringAsync(fileUri, wbout, {
    encoding: FileSystem.EncodingType.Base64,
  });
  await Sharing.shareAsync(fileUri, {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    dialogTitle: `Share ${projectName || 'Device'} Report (Excel)`,
    UTI: 'com.microsoft.excel.xlsx',
  });
}
