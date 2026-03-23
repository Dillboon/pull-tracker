import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Switch,
  Alert, StyleSheet, Animated,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { COLORS, STATUS_FIELDS } from '../theme';
import { completionCount, progressColor, getGroupType } from '../utils';

const GROUP_TYPES = ['single', 'double', 'triple', 'quad'];

// ─── Tappable Badge ───────────────────────────────────────────────────────────
function Badge({ done, short, onToggle }) {
  return (
    <TouchableOpacity
      onPress={onToggle}
      activeOpacity={0.6}
      style={[s.badge, done ? s.badgeDone : s.badgeOff]}
    >
      <Text style={[s.badgeText, { color: done ? COLORS.green : COLORS.textMuted }]}>
        {done ? '✓' : '·'} {short}
      </Text>
    </TouchableOpacity>
  );
}

// ─── StatusToggle ─────────────────────────────────────────────────────────────
function StatusToggle({ label, value, onChange, color }) {
  return (
    <TouchableOpacity
      onPress={() => onChange(!value)}
      style={[s.toggle, { borderColor: value ? color : COLORS.border, backgroundColor: value ? color + '22' : COLORS.surface2 }]}
      activeOpacity={0.7}
    >
      <Text style={{ fontSize: 20, color: value ? color : COLORS.textMuted }}>{value ? '✓' : '○'}</Text>
      <Text style={[s.toggleLabel, { color: value ? color : COLORS.textMuted }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── DropCard ─────────────────────────────────────────────────────────────────
export default function DropCard({ drop, onUpdate, onDelete, idfList, collapseKey, onExpandChange, conflictIds }) {
  const [expanded, setExpanded] = useState(false);
  const swipeableRef = useRef(null);
  const count      = completionCount(drop);
  const pColor     = progressColor(drop);
  const isComplete = count === 3;
  const groupType  = getGroupType(drop);

  // Check if any cable ID on this card is a duplicate
  const hasConflict = conflictIds && [drop.cableA, drop.cableB, drop.cableC, drop.cableD]
    .filter(Boolean)
    .some(id => conflictIds.has(id));

  // Collapse when parent fires collapse-all
  useEffect(() => {
    if (collapseKey > 0) setExpanded(false);
  }, [collapseKey]);

  const toggleExpanded = () => {
    const next = !expanded;
    setExpanded(next);
    onExpandChange?.(next);
  };

  const handleDelete = () => {
    swipeableRef.current?.close();
    Alert.alert(
      'Delete Drop',
      `Delete ${drop.cableA || 'this drop'}?`,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => swipeableRef.current?.close() },
        { text: 'Delete', style: 'destructive', onPress: () => onDelete(drop.id) },
      ]
    );
  };

  const quickCompleteAll = () => {
    const allDone = drop.roughPull && drop.terminated && drop.tested;
    onUpdate({ ...drop, roughPull: !allDone, terminated: !allDone, tested: !allDone });
  };

  const quickToggle = (key) => onUpdate({ ...drop, [key]: !drop[key] });

  const changeGroupType = (type) => {
    onUpdate({
      ...drop,
      groupType: type,
      isDouble: type === 'double',
      cableB: type === 'single' ? '' : drop.cableB,
      cableC: (type === 'single' || type === 'double') ? '' : drop.cableC,
      cableD: type !== 'quad' ? '' : drop.cableD,
    });
  };

  // Cable IDs to display in header
  const headerIds = [drop.cableA];
  if (groupType !== 'single') headerIds.push(drop.cableB);
  if (groupType === 'triple' || groupType === 'quad') headerIds.push(drop.cableC);
  if (groupType === 'quad') headerIds.push(drop.cableD);

  const renderRightActions = (progress, dragX) => {
    const scale = dragX.interpolate({
      inputRange: [-80, 0],
      outputRange: [1, 0.7],
      extrapolate: 'clamp',
    });
    return (
      <TouchableOpacity
        style={s.swipeDelete}
        onPress={handleDelete}
        activeOpacity={0.8}
      >
        <Animated.Text style={[s.swipeDeleteIcon, { transform: [{ scale }] }]}>🗑</Animated.Text>
        <Animated.Text style={[s.swipeDeleteText, { transform: [{ scale }] }]}>DELETE</Animated.Text>
      </TouchableOpacity>
    );
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      rightThreshold={40}
      overshootRight={false}
      friction={2}
    >
    <View style={[s.card, { borderLeftColor: pColor, borderColor: isComplete ? 'rgba(34,197,94,0.3)' : COLORS.border }]}>
      {/* ── Header ── */}
      <TouchableOpacity onPress={toggleExpanded} activeOpacity={0.75} style={s.header}>
        <View style={{ flex: 1, gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
            {groupType !== 'single' && (
              <View style={[s.groupPill, {
                backgroundColor:
                  groupType === 'double' ? 'rgba(124,58,237,0.18)' :
                  groupType === 'triple' ? 'rgba(13,148,136,0.18)' :
                  'rgba(249,115,22,0.18)',
                borderColor:
                  groupType === 'double' ? 'rgba(124,58,237,0.4)' :
                  groupType === 'triple' ? 'rgba(13,148,136,0.4)' :
                  'rgba(249,115,22,0.4)',
              }]}>
                <Text style={[s.groupPillText, {
                  color:
                    groupType === 'double' ? '#a78bfa' :
                    groupType === 'triple' ? '#2dd4bf' :
                    '#fb923c',
                }]}>{groupType.toUpperCase()}</Text>
              </View>
            )}
            {headerIds.map((id, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && (
                  <Text style={{ color: COLORS.purple, fontSize: 16, fontWeight: '900' }}>⟷</Text>
                )}
                <Text style={s.cableId} numberOfLines={1}>
                  {id || <Text style={{ color: COLORS.textDim }}>No ID</Text>}
                </Text>
              </React.Fragment>
            ))}
          </View>

          {/* Badge row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5 }}>
            {drop.idf ? (
              <View style={s.idfPill}>
                <Text style={s.idfPillText}>{drop.idf}</Text>
              </View>
            ) : null}
            {STATUS_FIELDS.map(f => (
              <Badge
                key={f.key}
                done={drop[f.key]}
                short={f.short}
                onToggle={() => quickToggle(f.key)}
              />
            ))}
            {drop.notes ? (
              <View style={s.notePill}>
                <Text style={s.notePillText}>📝</Text>
              </View>
            ) : null}
            {drop.attention ? (
              <View style={s.attentionPill}>
                <Text style={s.notePillText}>⚠️</Text>
              </View>
            ) : null}
            {hasConflict && (
              <View style={s.conflictPill}>
                <Text style={s.conflictPillText}>⚠ DUPE ID</Text>
              </View>
            )}
          </View>
        </View>

        {/* Progress ring + chevron */}
        <View style={{ alignItems: 'center', gap: 4, marginLeft: 8 }}>
          <TouchableOpacity
            onPress={toggleExpanded}
            onLongPress={quickCompleteAll}
            delayLongPress={400}
            activeOpacity={0.7}
          >
            <View style={[s.ring, { borderColor: pColor }]}>
              <Text style={[s.ringText, { color: pColor }]}>{count}/3</Text>
            </View>
          </TouchableOpacity>
          <Text style={{ color: COLORS.textMuted, fontSize: 12 }}>{expanded ? '▴' : '▾'}</Text>
        </View>
      </TouchableOpacity>

      {/* ── Expanded Edit Panel ── */}
      {expanded && (
        <View style={s.panel}>

          {/* Drop type selector */}
          <View>
            <Text style={s.fieldLabel}>DROP TYPE</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {GROUP_TYPES.map(type => (
                <TouchableOpacity
                  key={type}
                  style={[s.typeBtn, groupType === type && {
                    backgroundColor:
                      type === 'double' ? 'rgba(124,58,237,0.18)' :
                      type === 'triple' ? 'rgba(13,148,136,0.18)' :
                      type === 'quad'   ? 'rgba(249,115,22,0.18)' :
                      'rgba(255,255,255,0.08)',
                    borderColor:
                      type === 'double' ? 'rgba(124,58,237,0.4)' :
                      type === 'triple' ? 'rgba(13,148,136,0.4)' :
                      type === 'quad'   ? 'rgba(249,115,22,0.4)' :
                      'rgba(255,255,255,0.2)',
                  }]}
                  onPress={() => changeGroupType(type)}
                >
                  <Text style={[s.typeBtnText, groupType === type && {
                    color:
                      type === 'double' ? '#a78bfa' :
                      type === 'triple' ? '#2dd4bf' :
                      type === 'quad'   ? '#fb923c' :
                      COLORS.text,
                  }]}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Cable IDs */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <View style={{ flex: 1, minWidth: '45%' }}>
              <Text style={s.fieldLabel}>CABLE ID {groupType !== 'single' ? 'A' : ''}</Text>
              <TextInput
                value={drop.cableA}
                onChangeText={t => onUpdate({ ...drop, cableA: t })}
                placeholder="e.g. C-001"
                placeholderTextColor={COLORS.textDim}
                style={s.input}
                autoCapitalize="characters"
              />
            </View>
            {groupType !== 'single' && (
              <View style={{ flex: 1, minWidth: '45%' }}>
                <Text style={s.fieldLabel}>CABLE ID B</Text>
                <TextInput
                  value={drop.cableB}
                  onChangeText={t => onUpdate({ ...drop, cableB: t })}
                  placeholder="e.g. C-002"
                  placeholderTextColor={COLORS.textDim}
                  style={s.input}
                  autoCapitalize="characters"
                />
              </View>
            )}
            {(groupType === 'triple' || groupType === 'quad') && (
              <View style={{ flex: 1, minWidth: '45%' }}>
                <Text style={s.fieldLabel}>CABLE ID C</Text>
                <TextInput
                  value={drop.cableC || ''}
                  onChangeText={t => onUpdate({ ...drop, cableC: t })}
                  placeholder="e.g. C-003"
                  placeholderTextColor={COLORS.textDim}
                  style={s.input}
                  autoCapitalize="characters"
                />
              </View>
            )}
            {groupType === 'quad' && (
              <View style={{ flex: 1, minWidth: '45%' }}>
                <Text style={s.fieldLabel}>CABLE ID D</Text>
                <TextInput
                  value={drop.cableD || ''}
                  onChangeText={t => onUpdate({ ...drop, cableD: t })}
                  placeholder="e.g. C-004"
                  placeholderTextColor={COLORS.textDim}
                  style={s.input}
                  autoCapitalize="characters"
                />
              </View>
            )}
          </View>

          {/* IDF selector */}
          <View>
            <Text style={s.fieldLabel}>IDF CLOSET</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {idfList.map(idf => (
                <TouchableOpacity
                  key={idf}
                  onPress={() => onUpdate({ ...drop, idf: drop.idf === idf ? '' : idf })}
                  style={[s.idfBtn, drop.idf === idf && s.idfBtnActive]}
                >
                  <Text style={[s.idfBtnText, drop.idf === idf && { color: COLORS.amber }]}>{idf}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Status toggles */}
          <View>
            <Text style={s.fieldLabel}>STATUS</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {STATUS_FIELDS.map(f => (
                <StatusToggle
                  key={f.key}
                  label={f.label}
                  value={drop[f.key]}
                  color={f.color}
                  onChange={v => onUpdate({ ...drop, [f.key]: v })}
                />
              ))}
            </View>
          </View>

          {/* Notes */}
          <View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <Text style={s.fieldLabel}>NOTES</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: drop.attention ? '#fbbf24' : COLORS.textMuted }}>
                  ⚠️  ATTENTION
                </Text>
                <Switch
                  value={!!drop.attention}
                  onValueChange={v => onUpdate({ ...drop, attention: v })}
                  trackColor={{ false: COLORS.surface2, true: 'rgba(251,191,36,0.4)' }}
                  thumbColor={drop.attention ? '#fbbf24' : '#6b7280'}
                  style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                />
              </View>
            </View>
            <TextInput
              value={drop.notes}
              onChangeText={t => onUpdate({ ...drop, notes: t })}
              placeholder="Field notes, issues, location..."
              placeholderTextColor={COLORS.textDim}
              style={[s.input, { minHeight: 70, textAlignVertical: 'top' }]}
              multiline
            />
          </View>

          <Text style={{ fontSize: 10, color: COLORS.textDim, textAlign: 'right' }}>Added {drop.createdAt}</Text>

          {/* Delete */}
          <TouchableOpacity onPress={handleDelete} style={s.deleteBtn}>
            <Text style={s.deleteBtnText}>✕  DELETE DROP</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
    </Swipeable>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderLeftWidth: 3,
    borderRadius: 10,
    marginBottom: 10,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 13,
  },
  cableId: {
    fontFamily: 'monospace',
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: 0.5,
  },
  groupPill: {
    backgroundColor: 'rgba(124,58,237,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.4)',
    borderRadius: 3,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  groupPillText: {
    fontSize: 8, fontWeight: '800', color: '#a78bfa', letterSpacing: 0.8,
  },
  idfPill: {
    backgroundColor: 'rgba(148,163,184,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.15)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  idfPillText: {
    fontSize: 10, fontWeight: '600', color: COLORS.textSub, letterSpacing: 0.5,
  },
  badge: {
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
  },
  badgeDone: {
    backgroundColor: COLORS.greenDim,
    borderColor: 'rgba(34,197,94,0.4)',
  },
  badgeOff: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  badgeText: {
    fontSize: 9, fontWeight: '700', letterSpacing: 0.5, fontFamily: 'monospace',
  },
  notePill: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 3,
  },
  attentionPill: {
    backgroundColor: 'rgba(251,191,36,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.35)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 3,
  },
  conflictPill: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.4)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 3,
  },
  conflictPillText: {
    fontSize: 8, fontWeight: '800', color: '#f87171', letterSpacing: 0.5,
  },
  notePillText: { fontSize: 9 },
  ring: {
    width: 34, height: 34, borderRadius: 17, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  ringText: { fontSize: 9, fontWeight: '800' },
  panel: {
    padding: 13, paddingTop: 0,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
    gap: 14, paddingVertical: 14,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  fieldLabel: {
    fontSize: 10, fontWeight: '800', letterSpacing: 1,
    color: COLORS.textMuted, marginBottom: 6,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 7, padding: 10,
    color: COLORS.text, fontSize: 13, fontFamily: 'monospace',
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'transparent',
    alignItems: 'center',
  },
  typeBtnActive: {
    backgroundColor: 'rgba(124,58,237,0.18)',
    borderColor: 'rgba(124,58,237,0.4)',
  },
  typeBtnText: {
    fontSize: 11, fontWeight: '700', color: COLORS.textMuted,
  },
  idfBtn: {
    paddingHorizontal: 11, paddingVertical: 5, borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'transparent',
  },
  idfBtnActive: {
    backgroundColor: COLORS.amberDim,
    borderColor: 'rgba(245,158,11,0.5)',
  },
  idfBtnText: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted, letterSpacing: 0.4 },
  toggle: {
    flex: 1, alignItems: 'center', paddingVertical: 10,
    borderRadius: 8, borderWidth: 1.5, gap: 4,
  },
  toggleLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },
  deleteBtn: {
    backgroundColor: COLORS.redDim,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
    borderRadius: 8, padding: 11, alignItems: 'center',
  },
  deleteBtnText: { color: '#f87171', fontWeight: '800', fontSize: 12, letterSpacing: 0.6 },
  swipeDelete: {
    backgroundColor: '#7f1d1d',
    borderRadius: 10,
    marginBottom: 10,
    width: 72,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  swipeDeleteIcon: { fontSize: 18 },
  swipeDeleteText: { color: '#f87171', fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
});
