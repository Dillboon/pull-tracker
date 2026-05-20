import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  Switch, Alert, StyleSheet,
} from 'react-native';
import { COLORS, DEVICE_STATUS_FIELDS } from '../theme';
import { deviceCompletionCount, deviceProgressColor } from '../utils';

function Badge({ done, short, color }) {
  return (
    <View style={[s.badge, done
      ? { backgroundColor: color + '22', borderColor: color + '66' }
      : { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' }
    ]}>
      <Text style={[s.badgeText, { color: done ? color : COLORS.textMuted }]}>
        {done ? '✓' : '·'} {short}
      </Text>
    </View>
  );
}

function StatusToggle({ label, value, onChange, color }) {
  return (
    <TouchableOpacity
      onPress={() => onChange(!value)}
      style={[s.toggle, {
        borderColor: value ? color : COLORS.border,
        backgroundColor: value ? color + '22' : COLORS.surface2,
      }]}
      activeOpacity={0.7}
    >
      <Text style={{ fontSize: 18, color: value ? color : COLORS.textMuted }}>
        {value ? '✓' : '○'}
      </Text>
      <Text style={[s.toggleLabel, { color: value ? color : COLORS.textMuted }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function DeviceCard({ device, onUpdate, onDelete, idfList, deviceTypeList }) {
  const [expanded, setExpanded] = useState(false);
  const count   = deviceCompletionCount(device);
  const pColor  = deviceProgressColor(device);
  const isDone  = count === 5;

  const handleDelete = () => {
    Alert.alert(
      'Delete Device',
      `Delete "${device.deviceId || device.deviceType || 'this device'}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onDelete(device.id) },
      ]
    );
  };

  return (
    <View style={[s.card, {
      borderLeftColor: pColor,
      borderColor: isDone ? 'rgba(34,197,94,0.3)' : COLORS.border,
    }]}>
      {/* ── Header ── */}
      <TouchableOpacity onPress={() => setExpanded(e => !e)} activeOpacity={0.75} style={s.header}>
        <View style={{ flex: 1, gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {device.deviceType ? (
              <View style={s.typePill}>
                <Text style={s.typePillText}>{device.deviceType}</Text>
              </View>
            ) : null}
            <Text style={s.deviceId} numberOfLines={1}>
              {device.deviceId || <Text style={{ color: COLORS.textDim }}>No ID</Text>}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5 }}>
            {device.location ? (
              <View style={s.locationPill}>
                <Text style={s.locationPillText}>📍 {device.location}</Text>
              </View>
            ) : null}
            {device.idf ? (
              <View style={s.idfPill}>
                <Text style={s.idfPillText}>{device.idf}</Text>
              </View>
            ) : null}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
            {DEVICE_STATUS_FIELDS.map(f => (
              <Badge key={f.key} done={device[f.key]} short={f.short} color={f.color} />
            ))}
          </View>
        </View>
        <View style={{ alignItems: 'center', gap: 4, marginLeft: 8 }}>
          <View style={[s.ring, { borderColor: pColor }]}>
            <Text style={[s.ringText, { color: pColor }]}>{count}/5</Text>
          </View>
          <Text style={{ color: COLORS.textMuted, fontSize: 12 }}>{expanded ? '▴' : '▾'}</Text>
        </View>
      </TouchableOpacity>

      {/* ── Expanded panel ── */}
      {expanded && (
        <View style={s.panel}>

          {/* Device type selector */}
          <View>
            <Text style={s.fieldLabel}>DEVICE TYPE</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {deviceTypeList.map(type => (
                <TouchableOpacity
                  key={type}
                  onPress={() => onUpdate({ ...device, deviceType: device.deviceType === type ? '' : type })}
                  style={[s.typeBtn, device.deviceType === type && s.typeBtnActive]}
                >
                  <Text style={[s.typeBtnText, device.deviceType === type && { color: COLORS.teal }]}>
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Device ID and Location */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={s.fieldLabel}>DEVICE ID / LABEL</Text>
              <TextInput
                value={device.deviceId}
                onChangeText={t => onUpdate({ ...device, deviceId: t })}
                placeholder="e.g. CAM-01"
                placeholderTextColor={COLORS.textDim}
                style={s.input}
                autoCapitalize="characters"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.fieldLabel}>LOCATION</Text>
              <TextInput
                value={device.location}
                onChangeText={t => onUpdate({ ...device, location: t })}
                placeholder="e.g. Door 3, Room 101"
                placeholderTextColor={COLORS.textDim}
                style={s.input}
              />
            </View>
          </View>

          {/* IDF selector */}
          <View>
            <Text style={s.fieldLabel}>IDF / PANEL</Text>
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

          {/* Status toggles — row 1 */}
          <View>
            <Text style={s.fieldLabel}>STATUS</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6 }}>
              {DEVICE_STATUS_FIELDS.slice(0, 3).map(f => (
                <StatusToggle
                  key={f.key}
                  label={f.label}
                  value={device[f.key]}
                  color={f.color}
                  onChange={v => onUpdate({ ...device, [f.key]: v })}
                />
              ))}
            </View>
            {/* Status toggles — row 2 */}
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {DEVICE_STATUS_FIELDS.slice(3).map(f => (
                <StatusToggle
                  key={f.key}
                  label={f.label}
                  value={device[f.key]}
                  color={f.color}
                  onChange={v => onUpdate({ ...device, [f.key]: v })}
                />
              ))}
            </View>
          </View>

          {/* Notes */}
          <View>
            <Text style={s.fieldLabel}>NOTES</Text>
            <TextInput
              value={device.notes}
              onChangeText={t => onUpdate({ ...device, notes: t })}
              placeholder="Serial number, issues, install notes..."
              placeholderTextColor={COLORS.textDim}
              style={[s.input, { minHeight: 70, textAlignVertical: 'top' }]}
              multiline
            />
          </View>

          <Text style={{ fontSize: 10, color: COLORS.textDim, textAlign: 'right' }}>
            Added {device.createdAt}
          </Text>

          {/* Delete */}
          <TouchableOpacity onPress={handleDelete} style={s.deleteBtn}>
            <Text style={s.deleteBtnText}>✕  DELETE DEVICE</Text>
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
  typePill: {
    backgroundColor: COLORS.tealDim,
    borderWidth: 1,
    borderColor: 'rgba(20,184,166,0.4)',
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  typePillText: { fontSize: 9, fontWeight: '800', color: COLORS.teal, letterSpacing: 0.5 },
  deviceId: {
    fontFamily: 'monospace',
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: 0.5,
  },
  locationPill: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  locationPillText: { fontSize: 10, color: COLORS.textSub },
  idfPill: {
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.2)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  idfPillText: { fontSize: 10, fontWeight: '600', color: COLORS.amber, letterSpacing: 0.5 },
  badge: {
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 1,
  },
  badgeText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5, fontFamily: 'monospace' },
  ring: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringText: { fontSize: 9, fontWeight: '800' },
  panel: {
    padding: 13,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    gap: 14,
    paddingVertical: 14,
  },
  fieldLabel: {
    fontSize: 10, fontWeight: '800', letterSpacing: 1,
    color: COLORS.textMuted, marginBottom: 6,
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
  typeBtn: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  typeBtnActive: {
    backgroundColor: COLORS.tealDim,
    borderColor: 'rgba(20,184,166,0.5)',
  },
  typeBtnText: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted },
  idfBtn: {
    paddingHorizontal: 11, paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  idfBtnActive: {
    backgroundColor: COLORS.amberDim,
    borderColor: 'rgba(245,158,11,0.5)',
  },
  idfBtnText: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted },
  toggle: {
    flex: 1, alignItems: 'center',
    paddingVertical: 9,
    borderRadius: 8, borderWidth: 1.5, gap: 3,
  },
  toggleLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.3, textAlign: 'center' },
  deleteBtn: {
    backgroundColor: COLORS.redDim,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
    borderRadius: 8, padding: 11, alignItems: 'center',
  },
  deleteBtnText: { color: '#f87171', fontWeight: '800', fontSize: 12, letterSpacing: 0.6 },
});
