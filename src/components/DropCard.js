import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Switch,
  ScrollView, Alert, StyleSheet,
} from 'react-native';
import { COLORS, STATUS_FIELDS } from '../theme';
import { completionCount, progressColor } from '../utils';

// ─── Badge ───────────────────────────────────────────────────────────────────
function Badge({ done, short }) {
  return (
    <View style={[s.badge, done ? s.badgeDone : s.badgeOff]}>
      <Text style={[s.badgeText, { color: done ? COLORS.green : COLORS.textMuted }]}>
        {done ? '✓' : '·'} {short}
      </Text>
    </View>
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
export default function DropCard({ drop, onUpdate, onDelete, idfList }) {
  const [expanded, setExpanded] = useState(false);
  const count = completionCount(drop);
  const pColor = progressColor(drop);
  const isComplete = count === 3;

  const handleDelete = () => {
    Alert.alert(
      'Delete Drop',
      `Delete ${drop.cableA || 'this drop'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onDelete(drop.id) },
      ]
    );
  };

  return (
    <View style={[s.card, { borderLeftColor: pColor, borderColor: isComplete ? 'rgba(34,197,94,0.3)' : COLORS.border }]}>
      {/* ── Header ── */}
      <TouchableOpacity onPress={() => setExpanded(e => !e)} activeOpacity={0.75} style={s.header}>
        <View style={{ flex: 1, gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
            {drop.isDouble && (
              <View style={s.doublePill}>
                <Text style={s.doublePillText}>DOUBLE</Text>
              </View>
            )}
            <Text style={s.cableId} numberOfLines={1}>
              {drop.cableA || <Text style={{ color: COLORS.textDim }}>No ID</Text>}
            </Text>
            {drop.isDouble && drop.cableB ? (
              <>
                <Text style={{ color: COLORS.purple, fontSize: 16, fontWeight: '900' }}>⟷</Text>
                <Text style={s.cableId} numberOfLines={1}>{drop.cableB}</Text>
              </>
            ) : null}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5 }}>
            {drop.idf ? (
              <View style={s.idfPill}>
                <Text style={s.idfPillText}>{drop.idf}</Text>
              </View>
            ) : null}
            {STATUS_FIELDS.map(f => <Badge key={f.key} done={drop[f.key]} short={f.short} />)}
          </View>
        </View>
        <View style={{ alignItems: 'center', gap: 4, marginLeft: 8 }}>
          <View style={[s.ring, { borderColor: pColor }]}>
            <Text style={[s.ringText, { color: pColor }]}>{count}/3</Text>
          </View>
          <Text style={{ color: COLORS.textMuted, fontSize: 12 }}>{expanded ? '▴' : '▾'}</Text>
        </View>
      </TouchableOpacity>

      {/* ── Expanded Edit Panel ── */}
      {expanded && (
        <View style={s.panel}>
          {/* Double toggle */}
          <View style={s.row}>
            <Text style={s.fieldLabel}>DOUBLE DROP</Text>
            <Switch
              value={drop.isDouble}
              onValueChange={v => onUpdate({ ...drop, isDouble: v, cableB: '' })}
              trackColor={{ false: COLORS.surface2, true: COLORS.purple }}
              thumbColor="#fff"
            />
          </View>

          {/* Cable IDs */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={s.fieldLabel}>CABLE ID {drop.isDouble ? 'A' : ''}</Text>
              <TextInput
                value={drop.cableA}
                onChangeText={t => onUpdate({ ...drop, cableA: t })}
                placeholder="e.g. C-001"
                placeholderTextColor={COLORS.textDim}
                style={s.input}
                autoCapitalize="characters"
              />
            </View>
            {drop.isDouble && (
              <View style={{ flex: 1 }}>
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

          {/* Status */}
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
            <Text style={s.fieldLabel}>NOTES</Text>
            <TextInput
              value={drop.notes}
              onChangeText={t => onUpdate({ ...drop, notes: t })}
              placeholder="Field notes, issues, location..."
              placeholderTextColor={COLORS.textDim}
              style={[s.input, { minHeight: 70, textAlignVertical: 'top' }]}
              multiline
            />
          </View>

          {/* Date */}
          <Text style={{ fontSize: 10, color: COLORS.textDim, textAlign: 'right' }}>Added {drop.createdAt}</Text>

          {/* Delete */}
          <TouchableOpacity onPress={handleDelete} style={s.deleteBtn}>
            <Text style={s.deleteBtnText}>✕  DELETE DROP</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
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
  doublePill: {
    backgroundColor: 'rgba(124,58,237,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.4)',
    borderRadius: 3,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  doublePillText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#a78bfa',
    letterSpacing: 0.8,
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
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textSub,
    letterSpacing: 0.5,
  },
  badge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
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
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    fontFamily: 'monospace',
  },
  ring: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringText: {
    fontSize: 9,
    fontWeight: '800',
  },
  panel: {
    padding: 13,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    gap: 14,
    paddingVertical: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    color: COLORS.textMuted,
    marginBottom: 6,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 7,
    padding: 10,
    color: COLORS.text,
    fontSize: 13,
    fontFamily: 'monospace',
  },
  idfBtn: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  idfBtnActive: {
    backgroundColor: COLORS.amberDim,
    borderColor: 'rgba(245,158,11,0.5)',
  },
  idfBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 0.4,
  },
  toggle: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    gap: 4,
  },
  toggleLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  deleteBtn: {
    backgroundColor: COLORS.redDim,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    borderRadius: 8,
    padding: 11,
    alignItems: 'center',
  },
  deleteBtnText: {
    color: '#f87171',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.6,
  },
});
