import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { COLORS, STATUS_FIELDS } from '../theme';
import { exportPDF, exportXLSX } from '../exportUtils';

const getGroupType = (d) => d.groupType || (d.isDouble ? 'double' : 'single');

// ── Reusable sub-components ───────────────────────────────────────────────────

function StatRow({ label, value, color }) {
  return (
    <View style={s.statRow}>
      <Text style={s.statRowLabel}>{label}</Text>
      <Text style={[s.statRowValue, { color }]}>{value}</Text>
    </View>
  );
}

function ProgressBar({ drops, total, field }) {
  const count = drops.filter(d => d[field.key]).length;
  const pct   = total > 0 ? count / total : 0;
  return (
    <View style={{ marginBottom: 14 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
        <Text style={s.progLabel}>{field.label}</Text>
        <Text style={[s.progVal, { color: field.color }]}>
          {count}/{total} ({Math.round(pct * 100)}%)
        </Text>
      </View>
      <View style={s.barTrack}>
        <View style={[s.barFill, { width: `${pct * 100}%`, backgroundColor: field.color }]} />
      </View>
    </View>
  );
}

function ExportButtons({ drops, label, exporting, onExport }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <TouchableOpacity
        style={[s.idfExportBtn, s.exportPdf]}
        onPress={() => onExport('pdf', drops, label)}
        disabled={!!exporting}
        activeOpacity={0.8}
      >
        <Text style={[s.idfExportLabel, { color: '#f87171' }]}>
          {exporting === `pdf-${label}` ? 'Generating…' : '📄  PDF Report'}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[s.idfExportBtn, s.exportXlsx]}
        onPress={() => onExport('xlsx', drops, label)}
        disabled={!!exporting}
        activeOpacity={0.8}
      >
        <Text style={[s.idfExportLabel, { color: '#4ade80' }]}>
          {exporting === `xlsx-${label}` ? 'Generating…' : '📊  Excel Sheet'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function DashboardScreen({ drops, idfList, showToast, project }) {
  const [exporting,        setExporting]        = useState(null);
  const [progressExpanded, setProgressExpanded] = useState(false);
  const [expandedIdf,      setExpandedIdf]      = useState(null);

  const stats = {
    total:    drops.length,
    rp:       drops.filter(d => d.roughPull).length,
    tm:       drops.filter(d => d.terminated).length,
    ts:       drops.filter(d => d.tested).length,
    complete: drops.filter(d => d.roughPull && d.terminated && d.tested).length,
    singles:  drops.filter(d => getGroupType(d) === 'single').length,
    doubles:  drops.filter(d => getGroupType(d) === 'double').length,
    triples:  drops.filter(d => getGroupType(d) === 'triple').length,
    quads:    drops.filter(d => getGroupType(d) === 'quad').length,
  };

  // Full-project export
  const handleExport = async (type) => {
    if (drops.length === 0) {
      Alert.alert('No Data', 'Add some drops before exporting.');
      return;
    }
    setExporting(type);
    try {
      if (type === 'pdf')  await exportPDF(drops, project.name);
      if (type === 'xlsx') await exportXLSX(drops, project.name);
    } catch (e) {
      showToast('Export failed: ' + e.message, 'error');
    } finally {
      setExporting(null);
    }
  };

  // Per-IDF export — key format "pdf-IDF-1" avoids collision with full export key
  const handleIdfExport = async (type, idfDrops, idf) => {
    const key = `${type}-${idf}`;
    setExporting(key);
    try {
      const label = `${project.name} — ${idf}`;
      if (type === 'pdf')  await exportPDF(idfDrops, label);
      if (type === 'xlsx') await exportXLSX(idfDrops, label);
    } catch (e) {
      showToast('Export failed: ' + e.message, 'error');
    } finally {
      setExporting(null);
    }
  };

  const activeIdfs = idfList.filter(idf => drops.some(d => d.idf === idf));

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: COLORS.bg }}
      contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
    >
      <Text style={s.screenTitle}>Stats</Text>
      <Text style={s.projectLabel} numberOfLines={1}>{project.name}</Text>

      {/* ── Collapsible Completion Progress ── */}
      <View style={s.section}>
        <TouchableOpacity
          style={s.collapsibleHeader}
          onPress={() => setProgressExpanded(v => !v)}
          activeOpacity={0.7}
        >
          <Text style={s.sectionTitle}>COMPLETION PROGRESS</Text>
          <Text style={s.chevron}>{progressExpanded ? '▴' : '▾'}</Text>
        </TouchableOpacity>

        {progressExpanded && (
          <View style={{ marginTop: 12 }}>

            {/* Drop Breakdown */}
            <Text style={s.subTitle}>DROP BREAKDOWN</Text>
            <StatRow label="Total Drops"  value={stats.total}   color={COLORS.textSub} />
            <StatRow label="Single Drops" value={stats.singles} color={COLORS.textSub} />
            <StatRow label="Double Drops" value={stats.doubles} color={COLORS.purple}  />
            {stats.triples > 0 && <StatRow label="Triple Drops" value={stats.triples} color={COLORS.teal}   />}
            {stats.quads   > 0 && <StatRow label="Quad Drops"   value={stats.quads}   color={COLORS.orange} />}

            {/* Status Summary */}
            <Text style={[s.subTitle, { marginTop: 18 }]}>STATUS SUMMARY</Text>
            <StatRow label="Rough Pulled" value={`${stats.rp}/${stats.total}`}       color={COLORS.amber} />
            <StatRow label="Terminated"   value={`${stats.tm}/${stats.total}`}       color={COLORS.blue}  />
            <StatRow label="Tested"       value={`${stats.ts}/${stats.total}`}       color={COLORS.green} />
            <StatRow label="Complete"     value={`${stats.complete}/${stats.total}`} color={COLORS.pink}  />

            {/* Progress Bars */}
            {stats.total > 0 && (
              <View style={{ marginTop: 18 }}>
                <Text style={[s.subTitle, { marginBottom: 12 }]}>PROGRESS</Text>
                {STATUS_FIELDS.map(f => (
                  <ProgressBar key={f.key} drops={drops} total={stats.total} field={f} />
                ))}
              </View>
            )}
          </View>
        )}
      </View>

      {/* ── By IDF Closet ── */}
      {activeIdfs.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>BY IDF CLOSET</Text>
          <Text style={s.sectionHint}>Tap a closet to expand its stats and export options</Text>

          {activeIdfs.map((idf, idx) => {
            const idrops   = drops.filter(d => d.idf === idf);
            const complete = idrops.filter(d => d.roughPull && d.terminated && d.tested).length;
            const isOpen   = expandedIdf === idf;
            const isLast   = idx === activeIdfs.length - 1;

            const iStats = {
              total:    idrops.length,
              rp:       idrops.filter(d => d.roughPull).length,
              tm:       idrops.filter(d => d.terminated).length,
              ts:       idrops.filter(d => d.tested).length,
              singles:  idrops.filter(d => getGroupType(d) === 'single').length,
              doubles:  idrops.filter(d => getGroupType(d) === 'double').length,
              triples:  idrops.filter(d => getGroupType(d) === 'triple').length,
              quads:    idrops.filter(d => getGroupType(d) === 'quad').length,
            };

            return (
              <View
                key={idf}
                style={[
                  s.idfBlock,
                  isLast && { borderBottomWidth: 0 },
                  isOpen && s.idfBlockOpen,
                ]}
              >
                {/* Tappable header row */}
                <TouchableOpacity
                  style={s.idfHeaderRow}
                  onPress={() => setExpandedIdf(isOpen ? null : idf)}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={s.idfLabel}>{idf}</Text>
                    <Text style={s.idfMeta}>
                      {idrops.length} drop{idrops.length !== 1 ? 's' : ''}
                      {'  ·  '}
                      <Text style={{
                        color: complete === idrops.length ? COLORS.green : COLORS.amber,
                        fontWeight: '700',
                      }}>
                        {complete}/{idrops.length} complete
                      </Text>
                    </Text>
                  </View>
                  <Text style={s.chevron}>{isOpen ? '▴' : '▾'}</Text>
                </TouchableOpacity>

                {/* Expanded detail */}
                {isOpen && (
                  <View style={s.idfDetail}>

                    <Text style={s.subTitle}>DROP BREAKDOWN</Text>
                    <StatRow label="Total"   value={iStats.total}   color={COLORS.textSub} />
                    <StatRow label="Singles" value={iStats.singles} color={COLORS.textSub} />
                    <StatRow label="Doubles" value={iStats.doubles} color={COLORS.purple}  />
                    {iStats.triples > 0 && <StatRow label="Triples" value={iStats.triples} color={COLORS.teal}   />}
                    {iStats.quads   > 0 && <StatRow label="Quads"   value={iStats.quads}   color={COLORS.orange} />}

                    <Text style={[s.subTitle, { marginTop: 14 }]}>STATUS</Text>
                    <StatRow label="Rough Pulled" value={`${iStats.rp}/${iStats.total}`} color={COLORS.amber} />
                    <StatRow label="Terminated"   value={`${iStats.tm}/${iStats.total}`} color={COLORS.blue}  />
                    <StatRow label="Tested"       value={`${iStats.ts}/${iStats.total}`} color={COLORS.green} />
                    <StatRow label="Complete"     value={`${complete}/${iStats.total}`}  color={COLORS.pink}  />

                    <Text style={[s.subTitle, { marginTop: 14, marginBottom: 12 }]}>PROGRESS</Text>
                    {STATUS_FIELDS.map(f => (
                      <ProgressBar key={f.key} drops={idrops} total={iStats.total} field={f} />
                    ))}

                    <Text style={[s.subTitle, { marginTop: 4, marginBottom: 10 }]}>EXPORT {idf}</Text>
                    <ExportButtons
                      drops={idrops}
                      label={idf}
                      exporting={exporting}
                      onExport={handleIdfExport}
                    />
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* ── Full Project Export ── */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>EXPORT REPORT</Text>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
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
          Exports all {stats.total} drops for "{project.name}"
        </Text>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screenTitle:  { fontSize: 22, fontWeight: '800', color: COLORS.text, letterSpacing: -0.3 },
  projectLabel: { fontSize: 12, color: COLORS.amber, fontWeight: '600', marginBottom: 14, marginTop: 2 },

  section: {
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 10, padding: 14, marginBottom: 14,
  },
  collapsibleHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  sectionTitle: { fontSize: 10, fontWeight: '800', letterSpacing: 1, color: COLORS.textMuted },
  sectionHint:  { fontSize: 10, color: COLORS.textDim, marginBottom: 4, marginTop: 2 },
  subTitle: {
    fontSize: 9, fontWeight: '800', letterSpacing: 1,
    color: COLORS.textDim, marginBottom: 6,
  },
  chevron: { fontSize: 12, color: COLORS.textMuted, marginLeft: 8 },

  statRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  statRowLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textSub },
  statRowValue: { fontSize: 14, fontWeight: '800', letterSpacing: -0.3 },

  progLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textSub },
  progVal:   { fontSize: 11, fontWeight: '700' },
  barTrack:  { height: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' },
  barFill:   { height: '100%', borderRadius: 3 },

  // IDF rows
  idfBlock: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  idfBlockOpen: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 8,
    marginHorizontal: -4,
    paddingHorizontal: 4,
    marginVertical: 2,
  },
  idfHeaderRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 11,
  },
  idfLabel: { fontSize: 13, fontWeight: '700', color: COLORS.textSub, fontFamily: 'monospace' },
  idfMeta:  { fontSize: 10, color: COLORS.textMuted, marginTop: 2 },
  idfDetail: {
    paddingTop: 10, paddingBottom: 14,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },

  // Compact IDF export buttons
  idfExportBtn: {
    flex: 1, borderRadius: 8, paddingVertical: 10,
    alignItems: 'center', borderWidth: 1,
  },
  idfExportLabel: { fontWeight: '700', fontSize: 11, letterSpacing: 0.2 },

  // Full project export buttons
  exportBtn: {
    flex: 1, borderRadius: 10, padding: 14, alignItems: 'center', gap: 4, borderWidth: 1,
  },
  exportPdf:   { backgroundColor: 'rgba(239,68,68,0.1)',  borderColor: 'rgba(239,68,68,0.3)'  },
  exportXlsx:  { backgroundColor: 'rgba(34,197,94,0.1)',  borderColor: 'rgba(34,197,94,0.3)'  },
  exportIcon:  { fontSize: 26 },
  exportLabel: { fontWeight: '800', fontSize: 13, letterSpacing: 0.3 },
  exportHint:  { fontSize: 10, color: COLORS.textMuted },
});
