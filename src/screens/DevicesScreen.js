import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Alert } from 'react-native';
import { COLORS } from '../theme';

export default function DevicesScreen({ 
  devices, 
  addDevice, 
  updateDevice, 
  deleteDevice, 
  customDeviceTypes, 
  onEditCustomDevTypes 
}) {
  const [expandedId, setExpandedId] = useState(null);

  const handleDelete = (id) => {
    Alert.alert('Delete Device', 'Are you sure you want to delete this device?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteDevice(id) }
    ]);
  };

  return (
    <View style={s.root}>
      {/* Top Action Bar */}
      <View style={s.header}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.typeScroll}>
          {customDeviceTypes.map(type => (
            <TouchableOpacity key={type} style={s.typeBtn} onPress={() => addDevice(type)}>
              <Text style={s.typeBtnText}>+ {type}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={s.editTypesBtn} onPress={onEditCustomDevTypes}>
            <Text style={s.editTypesText}>⚙ Edit</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14, paddingBottom: 40, gap: 12 }}>
        {devices.length === 0 && (
          <Text style={s.emptyText}>No devices added yet. Tap a type above to start tracking hardware.</Text>
        )}

        {devices.map(device => {
          const isExpanded = expandedId === device.id;
          const isComplete = device.installed && device.configured && device.online;
          const statusColor = isComplete ? COLORS.green : (device.installed ? COLORS.amber : COLORS.textMuted);

          return (
            <View key={device.id} style={[s.card, isExpanded && s.cardExpanded]}>
              
              {/* Header */}
              <TouchableOpacity style={s.cardHeader} onPress={() => setExpandedId(isExpanded ? null : device.id)} activeOpacity={0.7}>
                <View style={s.cardTitleRow}>
                  <View style={[s.typePill, { borderColor: statusColor + '55', backgroundColor: statusColor + '15' }]}>
                    <Text style={[s.typePillText, { color: statusColor }]}>{device.type}</Text>
                  </View>
                  <TextInput
                    style={s.nameInput}
                    placeholder="Device Name / ID"
                    placeholderTextColor={COLORS.textDim}
                    value={device.name}
                    onChangeText={(val) => updateDevice({ ...device, name: val })}
                    onPressIn={(e) => e.stopPropagation()}
                  />
                </View>
                <Text style={s.chevron}>{isExpanded ? '▴' : '▾'}</Text>
              </TouchableOpacity>

              {/* Expanded Content */}
              {isExpanded && (
                <View style={s.cardBody}>
                  {/* Network Details */}
                  <View style={s.inputGrid}>
                    <View style={s.inputWrapper}>
                      <Text style={s.inputLabel}>MAC ADDRESS</Text>
                      <TextInput
                        style={s.textInput}
                        placeholder="00:00:00:00:00:00"
                        placeholderTextColor={COLORS.textDim}
                        value={device.macAddress}
                        onChangeText={(val) => updateDevice({ ...device, macAddress: val })}
                      />
                    </View>
                    <View style={s.inputWrapper}>
                      <Text style={s.inputLabel}>IP ADDRESS</Text>
                      <TextInput
                        style={s.textInput}
                        placeholder="192.168.1.x"
                        placeholderTextColor={COLORS.textDim}
                        value={device.ipAddress}
                        onChangeText={(val) => updateDevice({ ...device, ipAddress: val })}
                        keyboardType="decimal-pad"
                      />
                    </View>
                    <View style={[s.inputWrapper, { width: '100%' }]}>
                      <Text style={s.inputLabel}>LOCATION / ROOM</Text>
                      <TextInput
                        style={s.textInput}
                        placeholder="e.g. Lobby Ceiling"
                        placeholderTextColor={COLORS.textDim}
                        value={device.location}
                        onChangeText={(val) => updateDevice({ ...device, location: val })}
                      />
                    </View>
                  </View>

                  {/* Device Pipeline */}
                  <View style={s.pipelineBox}>
                    <Text style={s.pipelineTitle}>DEPLOYMENT PROGRESS</Text>
                    <View style={s.pipelineStages}>
                      {[
                        { key: 'installed', label: 'Mounted', color: COLORS.amber },
                        { key: 'configured', label: 'Configured', color: COLORS.blue },
                        { key: 'online', label: 'Online', color: COLORS.green },
                      ].map(stage => {
                        const active = device[stage.key];
                        return (
                          <TouchableOpacity
                            key={stage.key}
                            style={[s.stageBtn, active && { backgroundColor: stage.color + '22', borderColor: stage.color }]}
                            onPress={() => updateDevice({ ...device, [stage.key]: !active })}
                          >
                            <Text style={[s.stageText, active && { color: stage.color }]}>
                              {active ? '✓ ' : ''}{stage.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* Footer Notes & Delete */}
                  <View style={s.footerRow}>
                    <TextInput
                      style={s.notesInput}
                      placeholder="Add device notes..."
                      placeholderTextColor={COLORS.textDim}
                      value={device.notes}
                      onChangeText={(val) => updateDevice({ ...device, notes: val })}
                    />
                    <TouchableOpacity style={s.deleteBtn} onPress={() => handleDelete(device.id)}>
                      <Text style={s.deleteBtnText}>🗑</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    paddingVertical: 10,
  },
  typeScroll: { paddingHorizontal: 12, gap: 8, alignItems: 'center' },
  typeBtn: {
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderWidth: 1, borderColor: 'rgba(56, 189, 248, 0.3)',
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
  },
  typeBtnText: { color: '#38bdf8', fontWeight: '700', fontSize: 13 },
  editTypesBtn: { paddingHorizontal: 12 },
  editTypesText: { color: COLORS.textMuted, fontSize: 12, fontWeight: '700' },
  emptyText: { textAlign: 'center', color: COLORS.textMuted, marginTop: 40, paddingHorizontal: 20 },
  
  // Card
  card: {
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 12, overflow: 'hidden',
  },
  cardExpanded: { borderColor: 'rgba(255,255,255,0.15)' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  typePill: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  typePillText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  nameInput: { flex: 1, color: COLORS.text, fontSize: 16, fontWeight: '700' },
  chevron: { color: COLORS.textMuted, fontSize: 14, marginLeft: 10 },
  
  // Card Body
  cardBody: { padding: 12, paddingTop: 0 },
  inputGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  inputWrapper: { flexGrow: 1, minWidth: '45%' },
  inputLabel: { fontSize: 9, color: COLORS.textMuted, fontWeight: '800', marginBottom: 4, letterSpacing: 0.5 },
  textInput: {
    backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8, color: COLORS.text, fontSize: 13,
  },
  
  // Pipeline
  pipelineBox: { backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: 10, marginBottom: 14 },
  pipelineTitle: { fontSize: 9, color: COLORS.textMuted, fontWeight: '800', letterSpacing: 1, marginBottom: 8 },
  pipelineStages: { flexDirection: 'row', gap: 8 },
  stageBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 6,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: 'rgba(255,255,255,0.02)',
  },
  stageText: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted },
  
  // Footer
  footerRow: { flexDirection: 'row', gap: 8 },
  notesInput: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 6,
    paddingHorizontal: 12, paddingVertical: 8, color: COLORS.text, fontSize: 13, fontStyle: 'italic',
  },
  deleteBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 6, width: 40, alignItems: 'center', justifyContent: 'center',
  },
  deleteBtnText: { fontSize: 16 },
});