import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Switch, Alert, StyleSheet, Animated } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { COLORS } from '../theme';

const STAGES = [
  { key: 'roughPull',  label: 'Rough Pull', short: 'RP',  color: '#f59e0b' },
  { key: 'rfi',        label: 'RFI (Ready)',short: 'RFI', color: '#3b82f6' },
  { key: 'installed',  label: 'Installed',  short: 'INS', color: '#10b981' },
  { key: 'programmed', label: 'Programmed', short: 'PRG', color: '#8b5cf6' },
  { key: 'tested',     label: 'Tested',     short: 'TST', color: '#ec4899' },
];

export default function DeviceCard({ device, onUpdate, onDelete, idfList }) {
  const [expanded, setExpanded] = useState(false);
  const swipeableRef = React.useRef(null);

  const doneCount = STAGES.reduce((acc, stage) => acc + (device[stage.key] ? 1 : 0), 0);
  const isComplete = doneCount === 5;
  const progressPercent = (doneCount / 5) * 100;

  // Compute live visual ring and left border colors dynamically
  const statusColor = isComplete ? '#10b981' : doneCount > 0 ? '#f59e0b' : '#4b5563';

  const handleDelete = () => {
    swipeableRef.current?.close();
    Alert.alert('Delete Device', `Permanently delete ${device.label || device.deviceType}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(device.id) },
    ]);
  };

  const renderRightActions = (progress, dragX) => {
    const scale = dragX.interpolate({ inputRange: [-80, 0], outputRange: [1, 0.7], extrapolate: 'clamp' });
    return (
      <TouchableOpacity style={s.swipeDelete} onPress={handleDelete} activeOpacity={0.8}>
        <Animated.Text style={[s.swipeDeleteText, { transform: [{ scale }] }]}>🗑 DELETE</Animated.Text>
      </TouchableOpacity>
    );
  };

  return (
    <Swipeable ref={swipeableRef} renderRightActions={renderRightActions} overshootRight={false} friction={2}>
      <View style={[s.card, { borderLeftColor: statusColor, borderColor: isComplete ? 'rgba(34,197,94,0.3)' : COLORS.border }]}>
        
        {/* Card Header Top Bar */}
        <TouchableOpacity onPress={() => setExpanded(!expanded)} style={s.header} activeOpacity={0.75}>
          <View style={{ flex: 1, gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={s.typePill}>
                <Text style={s.typePillText}>{device.deviceType.toUpperCase()}</Text>
              </View>
              <Text style={s.headerTitle} numberOfLines={1}>
                {device.label ? device.label : <Text style={{ color: COLORS.textDim, fontWeight: '400' }}>No Location Label</Text>}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {device.cableId ? (
                <Text style={s.cableMeta}>🔌 {device.cableId}</Text>
              ) : null}
              {device.idf ? (
                <View style={s.idfTag}><Text style={s.idfTagText}>{device.idf}</Text></View>
              ) : null}
              
              {/* Status Badge Toggles */}
              <View style={{ flexDirection: 'row', gap: 4, marginTop: 2 }}>
                {STAGES.map(stg => (
                  <View key={stg.key} style={[s.miniBadge, device[stg.key] && { backgroundColor: stg.color + '22', borderColor: stg.color }]}>
                    <Text style={[s.miniBadgeText, { color: device[stg.key] ? stg.color : COLORS.textDim }]}>{stg.short}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          {/* Circle Ring Progress Tracker */}
          <View style={{ alignItems: 'center', justifyContent: 'center', marginLeft: 8 }}>
            <View style={[s.ring, { borderColor: statusColor }]}>
              <Text style={[s.ringText, { color: statusColor }]}>{doneCount}/5</Text>
            </View>
            <Text style={{ color: COLORS.textMuted, fontSize: 10, marginTop: 2 }}>{expanded ? '▴' : '▾'}</Text>
          </View>
        </TouchableOpacity>

        {/* Expanded Edit Panel Workspace */}
        {expanded && (
          <View style={s.panel}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.fieldLabel}>LOCATION LABEL / ROOM</Text>
                <TextInput
                  value={device.label}
                  onChangeText={t => onUpdate({ ...device, label: t })}
                  placeholder="e.g. Back Door Entry, Room 104"
                  placeholderTextColor={COLORS.textDim}
                  style={s.input}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.fieldLabel}>CABLE ID Run</Text>
                <TextInput
                  value={device.cableId}
                  onChangeText={t => onUpdate({ ...device, cableId: t })}
                  placeholder="e.g. G-104"
                  placeholderTextColor={COLORS.textDim}
                  style={[s.input, { fontFamily: 'monospace' }]}
                  autoCapitalize="characters"
                />
              </View>
            </View>

            {/* Closet Target Mapping Selector */}
            <View>
              <Text style={s.fieldLabel}>IDF CLOSET LOCATION</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {idfList.map(idf => (
                  <TouchableOpacity
                    key={idf}
                    onPress={() => onUpdate({ ...device, idf: device.idf === idf ? '' : idf })}
                    style={[s.idfBtn, device.idf === idf && s.idfBtnActive]}
                  >
                    <Text style={[s.idfBtnText, device.idf === idf && { color: COLORS.amber }]}>{idf}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Complete Device Multi-Stage Pipeline Controls */}
            <View>
              <Text style={s.fieldLabel}>WORK PIPELINE CHECKS</Text>
              <View style={{ gap: 6 }}>
                {STAGES.map(stage => {
                  const active = !!device[stage.key];
                  return (
                    <TouchableOpacity
                      key={stage.key}
                      style={[s.stageRow, active && { backgroundColor: stage.color + '15', borderColor: stage.color }]}
                      onPress={() => onUpdate({ ...device, [stage.key]: !active })}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 16, color: active ? stage.color : COLORS.textDim }}>{active ? '✓' : '○'}</Text>
                      <Text style={[s.stageLabel, { color: active ? COLORS.text : COLORS.textSub }]}>{stage.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Card Internal Field Notes */}
            <View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <Text style={s.fieldLabel}>DEVICE ISSUES / NOTES</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: device.attention ? '#fbbf24' : COLORS.textMuted }}>⚠️ FLAG ATTENTION</Text>
                  <Switch
                    value={!!device.attention}
                    onValueChange={v => onUpdate({ ...device, attention: v })}
                    style={{ transform: [{ scaleX: 0.7 }, { scaleY: 0.7 }] }}
                  />
                </View>
              </View>
              <TextInput
                value={device.notes}
                onChangeText={t => onUpdate({ ...device, notes: t })}
                placeholder="Mounting height constraints, custom backing boxes needed, or part numbers..."
                placeholderTextColor={COLORS.textDim}
                style={[s.input, { minHeight: 60, textAlignVertical: 'top' }]}
                multiline
              />
            </View>

            <TouchableOpacity onPress={handleDelete} style={s.deleteBtn}>
              <Text style={s.deleteBtnText}>✕ REMOVE DEVICE ASSET</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Swipeable>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: '#161b22', borderWidth: 1, borderLeftWidth: 4, borderRadius: 10, marginBottom: 10, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  typePill: { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  typePillText: { fontSize: 8, fontWeight: '800', color: COLORS.blue, letterSpacing: 0.4 },
  headerTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text, flex: 1 },
  cableMeta: { fontSize: 11, fontWeight: '600', color: COLORS.textSub, fontFamily: 'monospace' },
  idfTag: { backgroundColor: 'rgba(245,158,11,0.08)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.2)', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  idfTagText: { fontSize: 9, color: COLORS.amber, fontWeight: '700' },
  miniBadge: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 3, paddingHorizontal: 4, paddingVertical: 1 },
  miniBadgeText: { fontSize: 8, fontWeight: '700' },
  ring: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  ringText: { fontSize: 10, fontWeight: '800' },
  panel: { padding: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', gap: 12, backgroundColor: 'rgba(0,0,0,0.1)' },
  fieldLabel: { fontSize: 9, fontWeight: '800', color: COLORS.textMuted, letterSpacing: 0.5, marginBottom: 4 },
  input: { backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, padding: 8, color: COLORS.text, fontSize: 13 },
  idfBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'transparent' },
  idfBtnActive: { backgroundColor: COLORS.amberDim, borderColor: 'rgba(245,158,11,0.3)' },
  idfBtnText: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted },
  stageRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, borderRadius: 6, borderWidth: 1, borderColor: COLORS.border, backgroundColor: 'rgba(255,255,255,0.02)' },
  stageLabel: { fontSize: 12, fontWeight: '600' },
  deleteBtn: { padding: 10, borderRadius: 6, alignItems: 'center', backgroundColor: 'rgba(239,68,68,0.06)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' },
  deleteBtnText: { color: '#f87171', fontSize: 11, fontWeight: '800' },
  swipeDelete: { backgroundColor: '#7f1d1d', justifyContent: 'center', alignItems: 'center', width: 80, height: '100%' },
  swipeDeleteText: { color: '#fff', fontSize: 10, fontWeight: '800' }
});