import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { COLORS } from '../theme';
import { exportPDF, exportXLSX } from '../exportUtils';

const getGroupType = (d) => d.groupType || (d.isDouble ? 'double' : 'single');

// ── Sub-components ────────────────────────────────────────────────────────────

function PipelineBar({ label, count, total, color }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <View style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
        <Text style={s.pipeLabel}>{label}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
          <Text style={[s.pipeCount, { color }]}>
            {count}<Text style={s.pipeTotal}>/{total}</Text>
          </Text>
          <Text style={[s.pipePct, { color }]}>{pct}%</Text>
        </View>
      </View>
      <View style={s.barTrack}>
        <View style={[s.barFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function TypePill({ label, count, color }) {
  return (
    <View style={[s.typePill, { borderColor: color + '44' }]}>
      <Text style={[s.typePillCount, { color }]}>{count}</Text>
      <Text style={s.typePillLabel}>{label}</Text>
    </View>
  );
}

function ExportButtons({ drops, label, exporting, onExport }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <TouchableOpacity
        style={[s.idfExportBtn, s.exportPdfSm]}
        onPress={() => onExport('pdf', drops, label)}
        disabled={!!exporting}
        activeOpacity={0.8}
      >
        <Text style={[s.idfExportLabel, { color: '#f87171' }]}>
          {exporting === `pdf-${label}` ? 'Generating…' : '📄  PDF Report'}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[s.idfExportBtn, s.exportXlsxSm]}
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
  const [exporting,   setExporting]   = useState(null);
  const [expandedIdf, setExpandedIdf] = useState(null);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const total    = drops.length;
  const complete = drops.filter(d => d.overrideComplete || (d.roughPull && d.terminated && d.tested)).length;
  const rp       = drops.filter(d => d.roughPull   || d.overrideComplete).length;
  const tm       = drops.filter(d => d.terminated  || d.overrideComplete).length;
  const ts       = drops.filter(d => d.tested      || d.overrideComplete).length;
  const attention = drops.filter(d => d.attention).length;
  const patched   = drops.filter(d => d.patchedA || d.patchedB || d.patchedC || d.patchedD).length;
  const singles  = drops.filter(d => getGroupType(d) === 'single').length;
  const doubles  = drops.filter(d => getGroupType(d) === 'double').length;
  const triples  = drops.filter(d => getGroupType(d) === 'triple').length;
  const quads    = drops.filter(d => getGroupType(d) === 'quad').length;

  const customTypeCounts = {};
  drops.forEach(d => {
    if (d.customType?.trim()) {
      customTypeCounts[d.customType] = (customTypeCounts[d.customType] || 0) + 1;
    }
  });

  // ── Device Stats ──────────────────────────────────────────────────────────
  const devices = project?.devices || [];
  const totalDev = devices.length;
  const onlineDev = devices.filter(d => d.online).length;

  // Calculate percentage based on total pipeline steps (3 steps per drop)
  const pct      = total > 0 ? Math.round(((rp + tm + ts) / (total * 3)) * 100) : 0;
  const pctColor = pct === 100 ? COLORS.green : pct > 0 ? COLORS.amber : COLORS.textMuted;

  const activeIdfs = idfList.filter(idf => drops.some(d => d.idf === idf));

  // ── Exports ───────────────────────────────────────────────────────────────
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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: COLORS.bg }}
      contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
    >

      {/* ── Hero completion card ── */}
      <View style={s.heroCard}>
        <View style={[s.heroRing, { borderColor: pctColor }]}>
          <Text style={[s.heroPct, { color: pctColor }]}>{pct}%</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.heroProject} numberOfLines={2}>{project.name}</Text>
          <Text style={s.heroSub}>
            <Text style={{ color: pctColor, fontWeight: '800' }}>{complete}</Text>
            <Text style={{ color: COLORS.textMuted }}> of {total} drops 100% complete</Text>
          </Text>
          <View style={[s.barTrack, { marginTop: 10, height: 5 }]}>
            <View style={[s.barFill, { width: `${pct}%`, backgroundColor: pctColor }]} />
          </View>
        </View>
      </View>

      {/* ── Quick stat grid ── */}
      <View style={s.statGrid}>
        {[
          { label: 'Drops',     val: total,     color: COLORS.textSub },
          { label: 'Attention', val: attention, color: attention > 0 ? COLORS.amber : COLORS.textMuted },
          { label: 'Patched',   val: patched,   color: patched  > 0 ? COLORS.green : COLORS.textMuted },
          { label: 'Complete',  val: complete,  color: pctColor },
          { label: 'Devices',   val: totalDev,  color: COLORS.blue },
          { label: 'Online',    val: onlineDev, color: onlineDev === totalDev && totalDev > 0 ? COLORS.green : COLORS.amber },
        ].map(({ label, val, color }) => (
          <View key={label} style={s.statCard}>
            <Text style={[s.statVal, { color }]}>{val}</Text>
            <Text style={s.statLabel}>{label}</Text>
          </View>
        ))}
      </View>

      {/* ── Pipeline ── */}
      {total > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>COMPLETION PIPELINE</Text>
          <View style={{ marginTop: 14 }}>
            {[
              { label: 'Rough Pull', count: rp,       color: COLORS.amber },
              { label: 'Terminated', count: tm,       color: COLORS.blue  },
              { label: 'Tested',     count: ts,       color: COLORS.green },
              { label: 'Complete',   count: complete, color: COLORS.pink  },
            ].map(stage => (
              <PipelineBar key={stage.label} {...stage} total={total} />
            ))}
          </View>
        </View>
      )}

      {/* ── Drop types ── */}
      {total > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>DROP TYPES</Text>
          <View style={[s.typeRow, { marginTop: 10 }]}>
            <TypePill label="Single" count={singles} color={COLORS.textSub} />
            {doubles > 0 && <TypePill label="Double" count={doubles} color={COLORS.purple} />}
            {triples > 0 && <TypePill label="Triple" count={triples} color={COLORS.teal}   />}
            {quads   > 0 && <TypePill label="Quad"   count={quads}   color={COLORS.orange} />}
          </View>
          {Object.keys(customTypeCounts).length > 0 && (
            <>
              <View style={s.divider} />
              <Text style={[s.subLabel, { marginBottom: 8 }]}>CUSTOM TYPES</Text>
              <View style={s.typeRow}>
                {Object.entries(customTypeCounts).map(([type, count]) => (
                  <TypePill key={type} label={type} count={count} color={COLORS.teal} />
                ))}
              </View>
            </>
          )}
        </View>
      )}

      {/* ── By IDF ── */}
      {activeIdfs.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>BY IDF CLOSET</Text>
          <View style={{ marginTop: 10, gap: 8 }}>
           {activeIdfs.map(idf => {
              const idrops   = drops.filter(d => d.idf === idf);
              const idfDone  = idrops.filter(d => d.overrideComplete || (d.roughPull && d.terminated && d.tested)).length;
              
              const idfRp    = idrops.filter(d => d.roughPull   || d.overrideComplete).length;
              const idfTm    = idrops.filter(d => d.terminated  || d.overrideComplete).length;
              const idfTs    = idrops.filter(d => d.tested      || d.overrideComplete).length;
              
              // Calculate percentage based on pipeline steps for this specific IDF
              const idfPct   = idrops.length > 0 ? Math.round(((idfRp + idfTm + idfTs) / (idrops.length * 3)) * 100) : 0;
              const idfColor = idfPct === 100 ? COLORS.green : idfPct > 0 ? COLORS.amber : COLORS.textMuted;
              const isOpen   = expandedIdf === idf;

              return (
                <View key={idf} style={[s.idfCard, isOpen && s.idfCardOpen]}>

                  {/* Header row */}
                  <TouchableOpacity
                    style={s.idfCardRow}
                    onPress={() => setExpandedIdf(isOpen ? null : idf)}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <Text style={s.idfName}>{idf}</Text>
                        <View style={[s.idfPctPill, { backgroundColor: idfColor + '22', borderColor: idfColor + '55' }]}>
                          <Text style={[s.idfPctText, { color: idfColor }]}>{idfPct}%</Text>
                        </View>
                      </View>
                      <Text style={s.idfMeta}>
                        {idrops.length} drop{idrops.length !== 1 ? 's' : ''}{'  ·  '}
                        {idfDone}/{idrops.length} complete
                      </Text>
                      <View style={[s.barTrack, { marginTop: 6, height: 3 }]}>
                        <View style={[s.barFill, { width: `${idfPct}%`, backgroundColor: idfColor }]} />
                      </View>
                    </View>
                    <Text style={s.chevron}>{isOpen ? '▴' : '▾'}</Text>
                  </TouchableOpacity>

                  {/* Expanded detail */}
                  {isOpen && (
                    <View style={s.idfDetail}>

                      {/* Mini stat row */}
                      <View style={s.idfMiniStats}>
                        {[
                          { label: 'Pulled', val: idfRp,   color: COLORS.amber },
                          { label: 'Term.',  val: idfTm,   color: COLORS.blue  },
                          { label: 'Tested', val: idfTs,   color: COLORS.green },
                          { label: 'Done',   val: idfDone, color: COLORS.pink  },
                        ].map(({ label, val, color }) => (
                          <View key={label} style={s.idfMiniStat}>
                            <Text style={[s.idfMiniVal, { color }]}>{val}</Text>
                            <Text style={s.idfMiniLabel}>{label}</Text>
                          </View>
                        ))}
                      </View>

                      {/* Progress bars */}
                      <View style={{ marginTop: 14, marginBottom: 14 }}>
                        {[
                          { label: 'Rough Pull', count: idfRp,   color: COLORS.amber },
                          { label: 'Terminated', count: idfTm,   color: COLORS.blue  },
                          { label: 'Tested',     count: idfTs,   color: COLORS.green },
                          { label: 'Complete',   count: idfDone, color: COLORS.pink  },
                        ].map(stage => (
                          <PipelineBar key={stage.label} {...stage} total={idrops.length} />
                        ))}
                      </View>

                      <Text style={[s.subLabel, { marginBottom: 8 }]}>EXPORT {idf}</Text>
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
        </View>
      )}

      {/* ── Full project export ── */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>EXPORT FULL PROJECT</Text>
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
        {total > 0 && (
          <Text style={s.exportFooter}>
            Exports all {total} drops for "{project.name}"
          </Text>
        )}
      </View>

    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({

  // Hero
  heroCard: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 14, padding: 16, marginBottom: 12,
  },
  heroRing: {
    width: 82, height: 82, borderRadius: 41,
    borderWidth: 3.5, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  heroPct:     { fontSize: 19, fontWeight: '800', letterSpacing: -0.5 },
  heroProject: { fontSize: 15, fontWeight: '800', color: COLORS.text, letterSpacing: -0.3 },
  heroSub:     { fontSize: 11, color: COLORS.textMuted, marginTop: 3 },

  // Stat grid
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  statCard: {
    flexBasis: '30%', flexGrow: 1, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 10, padding: 10, alignItems: 'center',
  },
  statVal:   { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  statLabel: { fontSize: 9, color: COLORS.textMuted, fontWeight: '700', marginTop: 3, letterSpacing: 0.3, textTransform: 'uppercase' },

  // Sections
  section: {
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 12, padding: 14, marginBottom: 12,
  },
  sectionTitle: { fontSize: 10, fontWeight: '800', letterSpacing: 1, color: COLORS.textMuted },
  subLabel:     { fontSize: 9,  fontWeight: '800', letterSpacing: 1, color: COLORS.textDim },

  // Pipeline
  pipeLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textSub },
  pipeCount: { fontSize: 13, fontWeight: '800', letterSpacing: -0.3 },
  pipeTotal: { fontSize: 11, fontWeight: '400', color: COLORS.textMuted },
  pipePct:   { fontSize: 11, fontWeight: '700', minWidth: 34, textAlign: 'right' },
  barTrack:  { height: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' },
  barFill:   { height: '100%', borderRadius: 3 },

  // Type pills
  typeRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typePill: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  typePillCount: { fontSize: 16, fontWeight: '800', letterSpacing: -0.5 },
  typePillLabel: { fontSize: 10, color: COLORS.textMuted, fontWeight: '600' },
  divider:       { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 12 },

  // IDF cards
  idfCard: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, overflow: 'hidden',
  },
  idfCardOpen:  { borderColor: 'rgba(255,255,255,0.12)' },
  idfCardRow:   { flexDirection: 'row', alignItems: 'center', padding: 12 },
  idfName:      { fontSize: 13, fontWeight: '700', color: COLORS.text, fontFamily: 'monospace' },
  idfMeta:      { fontSize: 10, color: COLORS.textMuted, marginTop: 1 },
  idfPctPill:   { borderWidth: 1, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  idfPctText:   { fontSize: 10, fontWeight: '800' },
  idfDetail: {
    padding: 12, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  idfMiniStats: {
    flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 10,
  },
  idfMiniStat:  { alignItems: 'center' },
  idfMiniVal:   { fontSize: 16, fontWeight: '800' },
  idfMiniLabel: { fontSize: 9, color: COLORS.textMuted, marginTop: 2, fontWeight: '600' },
  chevron:      { fontSize: 12, color: COLORS.textMuted, marginLeft: 8 },

  // IDF export buttons
  idfExportBtn:  { flex: 1, borderRadius: 8, paddingVertical: 10, alignItems: 'center', borderWidth: 1 },
  idfExportLabel:{ fontWeight: '700', fontSize: 11, letterSpacing: 0.2 },
  exportPdfSm:   { backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)' },
  exportXlsxSm:  { backgroundColor: 'rgba(34,197,94,0.08)', borderColor: 'rgba(34,197,94,0.25)' },

  // Full export buttons
  exportBtn:    { flex: 1, borderRadius: 10, padding: 14, alignItems: 'center', gap: 4, borderWidth: 1 },
  exportPdf:    { backgroundColor: 'rgba(239,68,68,0.1)',  borderColor: 'rgba(239,68,68,0.3)'  },
  exportXlsx:   { backgroundColor: 'rgba(34,197,94,0.1)',  borderColor: 'rgba(34,197,94,0.3)'  },
  exportIcon:   { fontSize: 26 },
  exportLabel:  { fontWeight: '800', fontSize: 13, letterSpacing: 0.3 },
  exportHint:   { fontSize: 10, color: COLORS.textMuted },
  exportFooter: { fontSize: 10, color: COLORS.textDim, textAlign: 'center', marginTop: 8 },
});