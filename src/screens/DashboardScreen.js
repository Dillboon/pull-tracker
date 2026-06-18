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

function TypePill({ label, count, color, onPress, isExpanded }) {
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        s.typePill,
        { borderColor: color + '44' },
        isExpanded && { borderColor: color + 'aa', backgroundColor: color + '1a' },
      ]}
    >
      <Text style={[s.typePillCount, { color }]}>{count}</Text>
      <Text style={s.typePillLabel}>{label}</Text>
      {onPress && (
        <Text style={{ fontSize: 8, color, opacity: 0.8, marginLeft: 1 }}>
          {isExpanded ? '▴' : '▾'}
        </Text>
      )}
    </Wrapper>
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

function RackRow({ label, drops }) {
  const total = drops.length;
  const rp    = drops.filter(d => d.roughPull   || d.overrideComplete).length;
  const tm    = drops.filter(d => d.terminated  || d.overrideComplete).length;
  const ts    = drops.filter(d => d.tested      || d.overrideComplete).length;
  const done  = drops.filter(d => d.overrideComplete || (d.roughPull && d.terminated && d.tested)).length;
  const score = drops.reduce((sum, d) => {
    if (d.overrideComplete) return sum + 3;
    return sum + (d.roughPull ? 1 : 0) + (d.terminated ? 1 : 0) + (d.tested ? 1 : 0);
  }, 0);
  const pct   = total > 0 ? Math.round((score / (total * 3)) * 100) : 0;
  const color = pct === 100 ? COLORS.green : pct > 0 ? COLORS.amber : COLORS.textMuted;

  return (
    <View style={s.rackRow}>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Text style={s.rackLabel}>{label}</Text>
          <Text style={[s.rackMeta, { color }]}>{done}/{total} done</Text>
          <View style={{ flex: 1 }} />
          <View style={[s.idfPctPill, { backgroundColor: color + '22', borderColor: color + '44' }]}>
            <Text style={[s.idfPctText, { color }]}>{pct}%</Text>
          </View>
        </View>
        <View style={[s.barTrack, { height: 2 }]}>
          <View style={[s.barFill, { width: `${pct}%`, backgroundColor: color }]} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
          {[
            { label: 'RP', val: rp, color: COLORS.amber },
            { label: 'TM', val: tm, color: COLORS.blue  },
            { label: 'TS', val: ts, color: COLORS.green },
          ].map(({ label: l, val, color: c }) => (
            <Text key={l} style={{ fontSize: 9, color: c, fontWeight: '700' }}>
              {l}: {val}
            </Text>
          ))}
        </View>
      </View>
    </View>
  );
}

function TypeDetailCard({ typeKey, isCustom, drops }) {
  const typeDrops = isCustom
    ? drops.filter(d => d.customType === typeKey)
    : drops.filter(d => getGroupType(d) === typeKey);

  const total = typeDrops.length;
  const rp    = typeDrops.filter(d => d.roughPull   || d.overrideComplete).length;
  const tm    = typeDrops.filter(d => d.terminated  || d.overrideComplete).length;
  const ts    = typeDrops.filter(d => d.tested      || d.overrideComplete).length;
  const done  = typeDrops.filter(d => d.overrideComplete || (d.roughPull && d.terminated && d.tested)).length;
  const score = typeDrops.reduce((sum, d) => {
    if (d.overrideComplete) return sum + 3;
    return sum + (d.roughPull ? 1 : 0) + (d.terminated ? 1 : 0) + (d.tested ? 1 : 0);
  }, 0);
  const pct   = total > 0 ? Math.round((score / (total * 3)) * 100) : 0;

  // IDF breakdown for this type
  const typeIdfs = [...new Set(typeDrops.map(d => d.idf).filter(Boolean))].sort();

  return (
    <View style={{ gap: 10, marginTop: 4 }}>
      {/* Mini stat row */}
      <View style={s.idfMiniStats}>
        {[
          { label: 'Pulled', val: rp,   color: COLORS.amber },
          { label: 'Term.',  val: tm,   color: COLORS.blue  },
          { label: 'Tested', val: ts,   color: COLORS.green },
          { label: 'Done',   val: done, color: COLORS.pink  },
        ].map(({ label, val, color }) => (
          <View key={label} style={s.idfMiniStat}>
            <Text style={[s.idfMiniVal, { color }]}>{val}</Text>
            <Text style={s.idfMiniLabel}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Pipeline bars */}
      <View>
        {[
          { label: 'Rough Pull', count: rp,   color: COLORS.amber },
          { label: 'Terminated', count: tm,   color: COLORS.blue  },
          { label: 'Tested',     count: ts,   color: COLORS.green },
          { label: 'Complete',   count: done, color: COLORS.pink  },
        ].map(stage => (
          <PipelineBar key={stage.label} {...stage} total={total} />
        ))}
      </View>

      {/* By IDF breakdown for this type */}
      {typeIdfs.length > 0 && (
        <>
          <Text style={s.subLabel}>BY IDF</Text>
          <View style={{ gap: 5 }}>
            {typeIdfs.map(idf => {
              const idfTypeDrops = typeDrops.filter(d => d.idf === idf);
              const idfRp    = idfTypeDrops.filter(d => d.roughPull   || d.overrideComplete).length;
              const idfTm    = idfTypeDrops.filter(d => d.terminated  || d.overrideComplete).length;
              const idfTs    = idfTypeDrops.filter(d => d.tested      || d.overrideComplete).length;
              const idfDone  = idfTypeDrops.filter(d => d.overrideComplete || (d.roughPull && d.terminated && d.tested)).length;
              const idfScore = idfTypeDrops.reduce((sum, d) => {
                if (d.overrideComplete) return sum + 3;
                return sum + (d.roughPull ? 1 : 0) + (d.terminated ? 1 : 0) + (d.tested ? 1 : 0);
              }, 0);
              const idfPct   = idfTypeDrops.length > 0 ? Math.round((idfScore / (idfTypeDrops.length * 3)) * 100) : 0;
              const idfColor = idfPct === 100 ? COLORS.green : idfPct > 0 ? COLORS.amber : COLORS.textMuted;
              return (
                <View key={idf} style={s.rackRow}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <Text style={s.rackLabel}>{idf}</Text>
                      <Text style={[s.rackMeta, { color: idfColor }]}>
                        {idfDone}/{idfTypeDrops.length} done
                      </Text>
                      <View style={{ flex: 1 }} />
                      <View style={[s.idfPctPill, { backgroundColor: idfColor + '22', borderColor: idfColor + '44' }]}>
                        <Text style={[s.idfPctText, { color: idfColor }]}>{idfPct}%</Text>
                      </View>
                    </View>
                    <View style={[s.barTrack, { height: 2 }]}>
                      <View style={[s.barFill, { width: `${idfPct}%`, backgroundColor: idfColor }]} />
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                      {[
                        { label: 'RP', val: idfRp, color: COLORS.amber },
                        { label: 'TM', val: idfTm, color: COLORS.blue  },
                        { label: 'TS', val: idfTs, color: COLORS.green },
                      ].map(({ label: l, val, color: c }) => (
                        <Text key={l} style={{ fontSize: 9, color: c, fontWeight: '700' }}>
                          {l}: {val}
                        </Text>
                      ))}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function DashboardScreen({ drops, idfList, showToast, project }) {
  const [exporting,    setExporting]    = useState(null);
  const [expandedIdf,  setExpandedIdf]  = useState(null);
  const [expandedType, setExpandedType] = useState(null);

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
            <Text style={{ color: COLORS.textMuted }}> of {total} drop{total !== 1 ? 's' : ''} complete</Text>
          </Text>
          <View style={[s.barTrack, { marginTop: 10, height: 5 }]}>
            <View style={[s.barFill, { width: `${pct}%`, backgroundColor: pctColor }]} />
          </View>
        </View>
      </View>

      {/* ── Quick stat grid ── */}
      <View style={s.statGrid}>
        {[
          { label: 'Total',      val: total,            color: COLORS.textSub },
          { label: 'Complete',   val: complete,          color: pctColor },
		  { label: 'Incomplete', val: total - complete,  color: (total - complete) > 0 ? COLORS.red : COLORS.textMuted },
          { label: 'Attention',  val: attention,         color: attention > 0 ? COLORS.amber : COLORS.textMuted },
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
            <TypePill label="Single" count={singles} color={COLORS.textSub}
              onPress={() => setExpandedType(expandedType === 'single' ? null : 'single')}
              isExpanded={expandedType === 'single'} />
            {doubles > 0 && <TypePill label="Double" count={doubles} color={COLORS.purple}
              onPress={() => setExpandedType(expandedType === 'double' ? null : 'double')}
              isExpanded={expandedType === 'double'} />}
            {triples > 0 && <TypePill label="Triple" count={triples} color={COLORS.teal}
              onPress={() => setExpandedType(expandedType === 'triple' ? null : 'triple')}
              isExpanded={expandedType === 'triple'} />}
            {quads > 0 && <TypePill label="Quad" count={quads} color={COLORS.orange}
              onPress={() => setExpandedType(expandedType === 'quad' ? null : 'quad')}
              isExpanded={expandedType === 'quad'} />}
          </View>

          {/* Expanded detail for standard types */}
          {expandedType && ['single','double','triple','quad'].includes(expandedType) && (
            <>
              <View style={s.divider} />
              <TypeDetailCard typeKey={expandedType} isCustom={false} drops={drops} />
            </>
          )}

          {Object.keys(customTypeCounts).length > 0 && (
            <>
              <View style={s.divider} />
              <Text style={[s.subLabel, { marginBottom: 8 }]}>CUSTOM TYPES</Text>
              <View style={s.typeRow}>
                {Object.entries(customTypeCounts).map(([type, count]) => (
                  <TypePill key={type} label={type} count={count} color={COLORS.teal}
                    onPress={() => setExpandedType(expandedType === type ? null : type)}
                    isExpanded={expandedType === type} />
                ))}
              </View>

              {/* Expanded detail for custom types */}
              {expandedType && !['single','double','triple','quad'].includes(expandedType) && (
                <>
                  <View style={[s.divider, { marginTop: 10 }]} />
                  <TypeDetailCard typeKey={expandedType} isCustom={true} drops={drops} />
                </>
              )}
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

                      {/* Rack breakdown — only when racks are used within this IDF */}
                      {(() => {
                        const idfRacks = [...new Set(idrops.map(d => d.rackNumber).filter(Boolean))].sort();
                        const unracked = idrops.filter(d => !d.rackNumber);
                        if (idfRacks.length === 0) return null;
                        return (
                          <>
                            <View style={[s.divider, { marginTop: 14 }]} />
                            <Text style={[s.subLabel, { marginBottom: 8 }]}>BY RACK</Text>
                            <View style={{ gap: 6 }}>
                              {unracked.length > 0 && (
                                <RackRow label="Unassigned" drops={unracked} />
                              )}
                              {idfRacks.map(rack => (
                                <RackRow
                                  key={rack}
                                  label={`Rack ${rack}`}
                                  drops={idrops.filter(d => d.rackNumber === rack)}
                                />
                              ))}
                            </View>
                          </>
                        );
                      })()}
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
  statGrid: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statCard: {
    flex: 1, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 10, padding: 10, alignItems: 'center',
  },
  statVal:   { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  statLabel: { fontSize: 8, color: COLORS.textMuted, fontWeight: '700', marginTop: 3, letterSpacing: 0.3, textTransform: 'uppercase' },

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
  rackRow: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 7,
    padding: 9,
  },
  rackLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textSub, fontFamily: 'monospace' },
  rackMeta:  { fontSize: 10, fontWeight: '600' },

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
