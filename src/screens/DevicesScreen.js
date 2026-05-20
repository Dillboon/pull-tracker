import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  FlatList, StyleSheet, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import DeviceCard from '../components/DeviceCard';
import { COLORS, DEVICE_STATUS_FIELDS } from '../theme';

const STATUS_FILTERS = [
  { key: 'ALL',        label: 'All'          },
  { key: 'COMPLETE',   label: 'Complete'     },
  { key: 'INCOMPLETE', label: 'Incomplete'   },
  { key: 'RP_ONLY',    label: 'Pulled Only'  },
];

export default function DevicesScreen({
  devices, idfList, deviceTypeList,
  addDevice, updateDevice, deleteDevice,
}) {
  const [filterIdf,    setFilterIdf]    = useState('ALL');
  const [filterType,   setFilterType]   = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [search,       setSearch]       = useState('');

  const filtered = useMemo(() => devices.filter(d => {
    if (filterIdf  !== 'ALL' && d.idf        !== filterIdf)  return false;
    if (filterType !== 'ALL' && d.deviceType !== filterType) return false;
    if (filterStatus === 'COMPLETE'   && !(d.roughPull && d.rfi && d.installed && d.programmed && d.tested)) return false;
    if (filterStatus === 'INCOMPLETE' &&  (d.roughPull && d.rfi && d.installed && d.programmed && d.tested)) return false;
    if (filterStatus === 'RP_ONLY'    && (!d.roughPull || d.rfi)) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (
        !d.deviceId.toLowerCase().includes(q) &&
        !d.deviceType.toLowerCase().includes(q) &&
        !d.location.toLowerCase().includes(q) &&
        !d.notes.toLowerCase().includes(q) &&
        !d.idf.toLowerCase().includes(q)
      ) return false;
    }
    return true;
  }).sort((a, b) => {
    if (a.deviceType < b.deviceType) return -1;
    if (a.deviceType > b.deviceType) return 1;
    return (a.deviceId || '').localeCompare(b.deviceId || '');
  }), [devices, filterIdf, filterType, filterStatus, search]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Filters */}
      <View style={s.filterBox}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="🔍  Search ID, type, location, notes…"
          placeholderTextColor={COLORS.textDim}
          style={s.searchInput}
        />

        {/* IDF filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 7 }}>
          {['ALL', ...idfList].map(idf => (
            <TouchableOpacity
              key={idf}
              onPress={() => setFilterIdf(idf)}
              style={[s.chip, filterIdf === idf && s.chipAmber]}
            >
              <Text style={[s.chipText, filterIdf === idf && { color: COLORS.amber }]}>{idf}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Type filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
          {['ALL', ...deviceTypeList].map(type => (
            <TouchableOpacity
              key={type}
              onPress={() => setFilterType(type)}
              style={[s.chip, filterType === type && s.chipTeal]}
            >
              <Text style={[s.chipText, filterType === type && { color: COLORS.teal }]}>{type}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Status filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
          {STATUS_FILTERS.map(f => (
            <TouchableOpacity
              key={f.key}
              onPress={() => setFilterStatus(f.key)}
              style={[s.chip, filterStatus === f.key && s.chipBlue]}
            >
              <Text style={[s.chipText, filterStatus === f.key && { color: COLORS.blue }]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Device list */}
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <DeviceCard
            device={item}
            onUpdate={updateDevice}
            onDelete={deleteDevice}
            idfList={idfList}
            deviceTypeList={deviceTypeList}
          />
        )}
        contentContainerStyle={{ padding: 12, paddingBottom: 100 }}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={{ fontSize: 44 }}>📟</Text>
            <Text style={s.emptyTitle}>No devices found</Text>
            <Text style={s.emptyHint}>Tap the button below to add your first device</Text>
          </View>
        }
        keyboardShouldPersistTaps="handled"
      />

      {/* Floating add button */}
      <View style={s.fab}>
        <TouchableOpacity
          style={[s.fabBtn, s.fabTeal]}
          onPress={addDevice}
          activeOpacity={0.85}
        >
          <Text style={s.fabText}>+ ADD DEVICE</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  filterBox: {
    backgroundColor: COLORS.bg,
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  searchInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 8, padding: 10,
    color: COLORS.text, fontSize: 13,
  },
  chip: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'transparent', marginRight: 6,
  },
  chipAmber: { backgroundColor: COLORS.amberDim, borderColor: 'rgba(245,158,11,0.4)' },
  chipBlue:  { backgroundColor: COLORS.blueDim,  borderColor: 'rgba(59,130,246,0.4)' },
  chipTeal:  { backgroundColor: COLORS.tealDim,  borderColor: 'rgba(20,184,166,0.4)' },
  chipText:  { fontSize: 10, fontWeight: '700', color: COLORS.textMuted, letterSpacing: 0.4 },
  empty: { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textDim },
  emptyHint: { fontSize: 12, color: COLORS.textDim, textAlign: 'center', paddingHorizontal: 40 },
  fab: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 10, paddingBottom: 14,
    backgroundColor: 'rgba(13,17,23,0.95)',
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  fabBtn:  { paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  fabTeal: { backgroundColor: '#0f766e', elevation: 6 },
  fabText: { color: '#fff', fontWeight: '800', fontSize: 14, letterSpacing: 0.5 },
});
