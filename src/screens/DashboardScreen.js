import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { COLORS, STATUS_FIELDS } from '../theme';
import { exportPDF, exportXLSX } from '../exportUtils';

export default function DashboardScreen({ drops, idfList, showToast }) {
  const [exporting, setExporting] = useState(null);

  const stats = {
    total:    drops.length,
    rp:       drops.filter(d => d.roughPull).length,
    tm:       drops.filter(d => d.terminated).length,
    ts:       drops.filter(d => d.tested).length,
    complete: drops.filter(d => d.roughPull && d.terminated && d.tested).length,
    doubles:  drops.filter(d => d.isDouble).length,
  };

  const handleExport = async (type) => {
    if (drops.length === 0) {
      Alert.alert('No Data', 'Add some drops before exporting.');
      return;
    }
    setExporting(type);
    try {
      if (type === 'pdf')  await exportPDF(drops);
      if (type === 'xlsx') await exportXLSX(drops);
    } catch (e) {
      showToast('Export failed: ' + e.message, 'error');
    } finally {
      setExporting(null);
    }
  };

  const StatCard = ({ icon, label, value, color }) => (
    <View style={[s.statCard, { borderTopColor: color, borderTopWidth: 2 }]}>
      <Text style={{ fontSize: 22 }}>{icon}</Text>
      <Text style={[s.statVal, { color }]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.bg }} contentContainerStyle={{ padding: 14, paddingBottom: 40 }}>
      <Text style={s.screenTitle}>Project Stats</Text>

      {/* Stat grid */}
      <View style={s.grid}>
        <StatCard icon="📦" label="Total Drops"   value={stats.total}   color={COLORS.textSub} />
        <StatCard icon="⟷"  label="Double Drops"  value={stats.doubles} color={COLORS.purple} />
        <StatCard icon="🔧" label="Rough Pulled"  value={`${stats.rp}/${stats.total}`}   color={COLORS.amber} />
        <StatCard icon="🔗" label="Terminated"    value={`${stats.tm}/${stats.total}`}   color={COLORS.blue} />
        <StatCard icon="✅" label="Tested"         value={`${stats.ts}/${stats.total}`}   color={COLORS.green} />
        <StatCard icon="🏁" label="Complete"       value={`${stats.complete}/${stats.total}`} color={COLORS.pink} />
      </View>

      {/* Progress bars */}
      {stats.total > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>COMPLETION PROGRESS</Text>
          {STATUS_FIELDS.map(f => {
            const count = drops.filter(d => d[f.key]).length;
            const pct   = stats.total > 0 ? count / stats.total : 0;
            return (
              <View key={f.key} style={{ marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                  <Text style={s.progLabel}>{f.label}</Text>
                  <Text style={[s.progVal, { color: f.color }]}>
                    {count}/{stats.total} ({Math.round(pct * 100)}%)
                  </Text>
                </View>
                <View style={s.barTrack}>
                  <View style={[s.barFill, { width: `${pct * 100}%`, backgroundColor: f.color }]} />
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Per-IDF breakdown */}
      {stats.total > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>BY IDF CLOSET</Text>
          {idfList
            .filter(idf => drops.some(d => d.idf === idf))
            .map(idf => {
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
          {idfList.every(idf => !drops.some(d => d.idf === idf)) && (
            <Text style={{ color: COLORS.textDim, fontSize: 12 }}>No IDF assigned yet</Text>
          )}
        </View>
      )}

      {/* Export */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>EXPORT REPORT</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity
            style={[s.exportBtn, s.exportPdf]}
            onPress={() => handleExport('pdf')}
            disabled={!!exporting}
            activeOpacity={0.8}
          >
            <Text style={s.exportIcon}>📄</Text>
            <Text style={[s.exportLabel, { color: '#f87171' }]}>
              {exporting === 'pdf' ? 'Generating…' : 'PDF Report'}
            </Text>
            <Text style={s.exportHint}>Print / Share</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.exportBtn, s.exportXlsx]}
            onPress={() => handleExport('xlsx')}
            disabled={!!exporting}
            activeOpacity={0.8}
          >
            <Text style={s.exportIcon}>📊</Text>
            <Text style={[s.exportLabel, { color: '#4ade80' }]}>
              {exporting === 'xlsx' ? 'Generating…' : 'Excel Sheet'}
            </Text>
            <Text style={s.exportHint}>Open / Email</Text>
          </TouchableOpacity>
        </View>
        <Text style={{ fontSize: 10, color: COLORS.textDim, textAlign: 'center', marginTop: 8 }}>
          Exports all {stats.total} drops
        </Text>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screenTitle: {
    fontSize: 22, fontWeight: '800', color: COLORS.text,
    marginBottom: 14, letterSpacing: -0.3,
  },
  grid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14,
  },
  statCard: {
    width: '47%',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 14,
    gap: 4,
  },
  statVal:   { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  statLabel: { fontSize: 10, fontWeight: '600', color: COLORS.textMuted, letterSpacing: 0.5 },
  section: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  idfLabel: { fontSize: 13, fontWeight: '700', color: COLORS.textSub, fontFamily: 'monospace' },
  exportBtn: {
    flex: 1, borderRadius: 10, padding: 14,
    alignItems: 'center', gap: 4, borderWidth: 1,
  },
  exportPdf:  { backgroundColor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)' },
  exportXlsx: { backgroundColor: 'rgba(34,197,94,0.1)', borderColor: 'rgba(34,197,94,0.3)' },
  exportIcon:  { fontSize: 26 },
  exportLabel: { fontWeight: '800', fontSize: 13, letterSpacing: 0.3 },
  exportHint:  { fontSize: 10, color: COLORS.textMuted },
});
