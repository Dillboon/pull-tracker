import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { COLORS, STATUS_FIELDS, DEVICE_STATUS_FIELDS } from '../theme';
import { exportPDF, exportXLSX } from '../exportUtils';
import { exportDevicesPDF, exportDevicesXLSX } from '../deviceExportUtils';

export default function DashboardScreen({ drops, devices, idfList, showToast, project }) {
  const [exporting, setExporting] = useState(null);

  const dropStats = {
    total:    drops.length,
    rp:       drops.filter(d => d.roughPull).length,
    tm:       drops.filter(d => d.terminated).length,
    ts:       drops.filter(d => d.tested).length,
    complete: drops.filter(d => d.roughPull && d.terminated && d.tested).length,
    doubles:  drops.filter(d => d.isDouble).length,
  };

  const devStats = {
    total:    devices.length,
    rp:       devices.filter(d => d.roughPull).length,
    rfi:      devices.filter(d => d.rfi).length,
    inst:     devices.filter(d => d.installed).length,
    prog:     devices.filter(d => d.programmed).length,
    ts:       devices.filter(d => d.tested).length,
    complete: devices.filter(d => d.roughPull && d.rfi && d.installed && d.programmed && d.tested).length,
  };

  const handleExport = async (type) => {
    const isDevice = type.startsWith('device-');
    const list = isDevice ? devices : drops;
    if (list.length === 0) {
      Alert.alert('No Data', `Add some ${isDevice ? 'devices' : 'drops'} before exporting.`);
      return;
    }
    setExporting(type);
    try {
      if (type === 'drop-pdf')    await exportPDF(drops, project.name);
      if (type === 'drop-xlsx')   await exportXLSX(drops, project.name);
      if (type === 'device-pdf')  await exportDevicesPDF(devices, project.name);
      if (type === 'device-xlsx') await exportDevicesXLSX(devices, project.name);
    } catch (e) {
      showToast('Export failed: ' + e.message, 'error');
    } finally {
      setExporting(null);
    }
  };

  const StatCard = ({ icon, label, value, color }) => (
    <View style={[s.statCard, { borderTopColor: color, borderTopWidth: 2 }]}>
      <Text style={{ fontSize: 20 }}>{icon}</Text>
      <Text style={[s.statVal, { color }]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );

  const ProgressBar = ({ label, count, total, color }) => {
    const pct = total > 0 ? count / total : 0;
    return (
      <View style={{ marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text style={s.progLabel}>{label}</Text>
          <Text style={[s.progVal, { color }]}>
            {count}/{total} ({Math.round(pct * 100)}%)
          </Text>
        </View>
        <View style={s.barTrack}>
          <View style={[s.barFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
        </View>
      </View>
    );
  };

  const ExportRow = ({ label, onPdf, onXlsx, pdfKey, xlsxKey, color }) => (
    <View style={{ marginBottom: 10 }}>
      <Text style={[s.exportSectionLabel, { color }]}>{label}</Text>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <TouchableOpacity
          style={[s.exportBtn, s.exportPdf]}
          onPress={onPdf}
          disabled={!!exporting}
          activeOpacity={0.8}
        >
          <Text style={s.exportIcon}>📄</Text>
          <Text style={[s.exportLabel, { color: '#f87171' }]}>
            {exporting === pdfKey ? 'Generating…' : 'PDF Report'}
          </Text>
          <Text style={s.exportHint}>Print / Share</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.exportBtn, s.exportXlsx]}
          onPress={onXlsx}
          disabled={!!exporting}
          activeOpacity={0.8}
        >
          <Text style={s.exportIcon}>📊</Text>
          <Text style={[s.exportLabel, { color: '#4ade80' }]}>
            {exporting === xlsxKey ? 'Generating…' : 'Excel Sheet'}
          </Text>
          <Text style={s.exportHint}>Open / Email</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: COLORS.bg }}
      contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
    >
      <Text style={s.screenTitle}>Stats</Text>
      <Text style={s.projectLabel} numberOfLines={1}>{project.name}</Text>

      {/* ── Cable Drops section ── */}
      <Text style={s.sectionHeader}>🔌 CABLE DROPS</Text>
      <View style={s.grid}>
        <StatCard icon="📦" label="Total Drops"  value={dropStats.total}   color={COLORS.textSub} />
        <StatCard icon="⟷"  label="Double Drops" value={dropStats.doubles} color={COLORS.purple}  />
        <StatCard icon="🔧" label="Rough Pulled" value={`${dropStats.rp}/${dropStats.total}`}   color={COLORS.amber} />
        <StatCard icon="🔗" label="Terminated"   value={`${dropStats.tm}/${dropStats.total}`}   color={COLORS.blue}  />
        <StatCard icon="✅" label="Tested"        value={`${dropStats.ts}/${dropStats.total}`}   color={COLORS.green} />
        <StatCard icon="🏁" label="Complete"      value={`${dropStats.complete}/${dropStats.total}`} color={COLORS.pink} />
      </View>

      {dropStats.total > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>DROP PROGRESS</Text>
          {STATUS_FIELDS.map(f => (
            <ProgressBar
              key={f.key}
              label={f.label}
              count={drops.filter(d => d[f.key]).length}
              total={dropStats.total}
              color={f.color}
            />
          ))}
        </View>
      )}

      {dropStats.total > 0 && idfList.some(idf => drops.some(d => d.idf === idf)) && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>DROPS BY IDF</Text>
          {idfList.filter(idf => drops.some(d => d.idf === idf)).map(idf => {
            const idrops   = drops.filter(d => d.idf === idf);
            const complete = idrops.filter(d => d.roughPull && d.terminated && d.tested).length;
            return (
              <View key={idf} style={s.idfRow}>
                <Text style={s.idfLabel}>{idf}</Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: COLORS.textSub, fontSize: 11 }}>
                    {idrops.length} drop{idrops.length !== 1 ? 's' : ''}
                  </Text>
                  <Text style={{ color: complete === idrops.length ? COLORS.green : COLORS.amber, fontWeight: '700', fontSize: 12 }}>
                    {complete}/{idrops.length} done
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* ── Devices section ── */}
      <Text style={[s.sectionHeader, { color: COLORS.teal, marginTop: 8 }]}>📟 DEVICES</Text>
      <View style={s.grid}>
        <StatCard icon="📟" label="Total Devices" value={devStats.total}    color={COLORS.teal}   />
        <StatCard icon="🏁" label="Complete"       value={`${devStats.complete}/${devStats.total}`} color={COLORS.green} />
        <StatCard icon="🔧" label="Rough Pulled"   value={`${devStats.rp}/${devStats.total}`}   color={COLORS.amber}  />
        <StatCard icon="📋" label="RFI"            value={`${devStats.rfi}/${devStats.total}`}  color={COLORS.blue}   />
        <StatCard icon="🔩" label="Installed"      value={`${devStats.inst}/${devStats.total}`} color={COLORS.purple} />
        <StatCard icon="💻" label="Programmed"     value={`${devStats.prog}/${devStats.total}`} color={COLORS.orange} />
      </View>

      {devStats.total > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>DEVICE PROGRESS</Text>
          {DEVICE_STATUS_FIELDS.map(f => (
            <ProgressBar
              key={f.key}
              label={f.label}
              count={devices.filter(d => d[f.key]).length}
              total={devStats.total}
              color={f.color}
            />
          ))}
        </View>
      )}

      {devStats.total > 0 && (() => {
        const types = [...new Set(devices.map(d => d.deviceType).filter(Boolean))].sort();
        if (types.length === 0) return null;
        return (
          <View style={s.section}>
            <Text style={s.sectionTitle}>DEVICES BY TYPE</Text>
            {types.map(type => {
              const td       = devices.filter(d => d.deviceType === type);
              const complete = td.filter(d => d.roughPull && d.rfi && d.installed && d.programmed && d.tested).length;
              return (
                <View key={type} style={s.idfRow}>
                  <Text style={[s.idfLabel, { color: COLORS.teal }]}>{type}</Text>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: COLORS.textSub, fontSize: 11 }}>
                      {td.length} device{td.length !== 1 ? 's' : ''}
                    </Text>
                    <Text style={{ color: complete === td.length ? COLORS.green : COLORS.amber, fontWeight: '700', fontSize: 12 }}>
                      {complete}/{td.length} done
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        );
      })()}

      {/* ── Export section ── */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>EXPORT REPORTS</Text>

        <ExportRow
          label="🔌 Cable Drops"
          color={COLORS.blue}
          pdfKey="drop-pdf"
          xlsxKey="drop-xlsx"
          onPdf={()  => handleExport('drop-pdf')}
          onXlsx={() => handleExport('drop-xlsx')}
        />

        <ExportRow
          label="📟 Devices"
          color={COLORS.teal}
          pdfKey="device-pdf"
          xlsxKey="device-xlsx"
          onPdf={()  => handleExport('device-pdf')}
          onXlsx={() => handleExport('device-xlsx')}
        />

        <Text style={{ fontSize: 10, color: COLORS.textDim, textAlign: 'center', marginTop: 4 }}>
          Each export contains only its own data for "{project.name}"
        </Text>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screenTitle:  { fontSize: 22, fontWeight: '800', color: COLORS.text, letterSpacing: -0.3 },
  projectLabel: { fontSize: 12, color: COLORS.amber, fontWeight: '600', marginBottom: 10, marginTop: 2 },
  sectionHeader: {
    fontSize: 11, fontWeight: '800', letterSpacing: 1,
    color: COLORS.blue, marginBottom: 10, marginTop: 4,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  statCard: {
    width: '47%', backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 10, padding: 12, gap: 3,
  },
  statVal:   { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  statLabel: { fontSize: 10, fontWeight: '600', color: COLORS.textMuted, letterSpacing: 0.5 },
  section: {
    backgroundColor: COLORS.surface, borderWidth: 1,
    borderColor: COLORS.border, borderRadius: 10,
    padding: 14, marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 10, fontWeight: '800', letterSpacing: 1,
    color: COLORS.textMuted, marginBottom: 14,
  },
  progLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textSub },
  progVal:   { fontSize: 11, fontWeight: '700' },
  barTrack:  { height: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' },
  barFill:   { height: '100%', borderRadius: 3 },
  idfRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  idfLabel: { fontSize: 13, fontWeight: '700', color: COLORS.textSub, fontFamily: 'monospace' },
  exportSectionLabel: {
    fontSize: 11, fontWeight: '800', letterSpacing: 0.5, marginBottom: 8,
  },
  exportBtn: {
    flex: 1, borderRadius: 10, padding: 12,
    alignItems: 'center', gap: 3, borderWidth: 1,
  },
  exportPdf:   { backgroundColor: 'rgba(239,68,68,0.1)',  borderColor: 'rgba(239,68,68,0.3)'  },
  exportXlsx:  { backgroundColor: 'rgba(34,197,94,0.1)',  borderColor: 'rgba(34,197,94,0.3)'  },
  exportIcon:  { fontSize: 22 },
  exportLabel: { fontWeight: '800', fontSize: 12, letterSpacing: 0.3 },
  exportHint:  { fontSize: 9, color: COLORS.textMuted },
});
