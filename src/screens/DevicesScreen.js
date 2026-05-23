import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  FlatList, StyleSheet, KeyboardAvoidingView, Platform, Modal,
} from 'react-native';
import DeviceCard from '../components/DeviceCard';
import { COLORS } from '../theme';
import BulkImportModal from './BulkImportModal'; // Verbatim reference to your bulk component

const DEVICE_STATUS_FILTERS = [
  { key: 'ALL',        label: 'All Devices' },
  { key: 'COMPLETE',   label: 'Complete' },
  { key: 'INCOMPLETE', label: 'Incomplete' },
  { key: 'ROUGH',      label: 'Rough Pull' },
  { key: 'RFI',        label: 'RFI Ready' },
  { key: 'INSTALLED',  label: 'Installed' },
  { key: 'PROGRAMMED', label: 'Programmed' },
  { key: 'TESTED',     label: 'Tested' },
  { key: 'ATTENTION',  label: 'Attention Required' },
];

const PRESET_DEVICES = ['Card Reader', 'Camera', 'Speaker', 'Intercom Station'];

export default function DevicesScreen({ devices, idfList, addDevice, updateDevice, deleteDevice }) {
  const [filterIdf,      setFilterIdf]      = useState('ALL');
  const [filterStatus,   setFilterStatus]   = useState('ALL');
  const [search,         setSearch]         = useState('');
  const [fabOpen,        setFabOpen]        = useState(false);
  const [idfDropdown,    setIdfDropdown]    = useState(false);
  const [statusDropdown, setStatusDropdown] = useState(false);
  const [searchOpen,     setSearchOpen]     = useState(false);
  const [customModal,    setCustomModal]    = useState(false);
  const [customType,     setCustomType]     = useState('');
  
  // New state to manage the Bulk Import Modal visibility
  const [bulkModalVisible, setBulkModalVisible] = useState(false);
  
  const searchInputRef = useRef(null);
  const flatListRef    = useRef(null);

  const idfLabel    = filterIdf === 'ALL' ? 'All IDFs' : filterIdf;
  const statusLabel = DEVICE_STATUS_FILTERS.find(f => f.key === filterStatus)?.label ?? 'All';
  const hasFilter   = filterIdf !== 'ALL' || filterStatus !== 'ALL';

  const closeDropdowns = () => { setIdfDropdown(false); setStatusDropdown(false); };

  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [searchOpen]);

  const filtered = useMemo(() => {
    return devices.filter(d => {
      if (filterIdf !== 'ALL' && d.idf !== filterIdf) return false;
      
      const isDone = d.roughPull && d.rfi && d.installed && d.programmed && d.tested;
      if (filterStatus === 'COMPLETE'   && !isDone) return false;
      if (filterStatus === 'INCOMPLETE' && isDone) return false;
      if (filterStatus === 'ROUGH'      && !d.roughPull) return false;
      if (filterStatus === 'RFI'        && !d.rfi) return false;
      if (filterStatus === 'INSTALLED'  && !d.installed) return false;
      if (filterStatus === 'PROGRAMMED' && !d.programmed) return false;
      if (filterStatus === 'TESTED'     && !d.tested) return false;
      if (filterStatus === 'ATTENTION'  && !d.attention) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          d.deviceType.toLowerCase().includes(q) ||
          d.label.toLowerCase().includes(q) ||
          d.cableId.toLowerCase().includes(q) ||
          d.notes.toLowerCase().includes(q) ||
          d.idf.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [devices, filterIdf, filterStatus, search]);

  // Processes the generated bulk array items from the Modal
  const handleBulkImport = (importedDrops) => {
    importedDrops.forEach(drop => {
      // Passes each generated drop object straight to your data handler
      addDevice(drop);
    });
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.filterBox}>
        {searchOpen ? (
          <View style={s.dropdownRow}>
            <TouchableOpacity style={s.iconBtn} onPress={() => { setSearchOpen(false); setSearch(''); closeDropdowns(); }}>
              <Text style={s.iconBtnText}>←</Text>
            </TouchableOpacity>
            <TextInput
              ref={searchInputRef}
              value={search}
              onChangeText={setSearch}
              placeholder="Search devices, cables, areas, notes..."
              placeholderTextColor={COLORS.textDim}
              style={s.searchInputInline}
            />
            {search.length > 0 && (
              <TouchableOpacity style={s.iconBtn} onPress={() => setSearch('')}>
                <Text style={s.iconBtnText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={s.dropdownRow}>
            <View style={{ flex: 1 }}>
              <TouchableOpacity style={[s.dropBtn, filterIdf !== 'ALL' && s.dropBtnAmber]} onPress={() => { setIdfDropdown(v => !v); setStatusDropdown(false); }}>
                <Text style={[s.dropBtnText, filterIdf !== 'ALL' && { color: COLORS.amber }]}>📍 {idfLabel}</Text>
                <Text style={s.dropCaret}>▾</Text>
              </TouchableOpacity>
              {idfDropdown && (
                <View style={[s.dropMenu, { zIndex: 20 }]}>
                  {['ALL', ...idfList].map(idf => (
                    <TouchableOpacity key={idf} style={s.dropItem} onPress={() => { setFilterIdf(idf); setIdfDropdown(false); }}>
                      <Text style={s.dropItemText}>{idf === 'ALL' ? 'All IDFs' : idf}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            <View style={{ flex: 1 }}>
              <TouchableOpacity style={[s.dropBtn, filterStatus !== 'ALL' && s.dropBtnBlue]} onPress={() => { setStatusDropdown(v => !v); setIdfDropdown(false); }}>
                <Text style={[s.dropBtnText, filterStatus !== 'ALL' && { color: COLORS.blue }]}>◈ {statusLabel}</Text>
                <Text style={s.dropCaret}>▾</Text>
              </TouchableOpacity>
              {statusDropdown && (
                <View style={[s.dropMenu, { zIndex: 20 }]}>
                  {DEVICE_STATUS_FILTERS.map(f => (
                    <TouchableOpacity key={f.key} style={s.dropItem} onPress={() => { setFilterStatus(f.key); setStatusDropdown(false); }}>
                      <Text style={s.dropItemText}>{f.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {hasFilter && (
              <TouchableOpacity style={s.clearBtn} onPress={() => { setFilterIdf('ALL'); setFilterStatus('ALL'); closeDropdowns(); }}>
                <Text style={s.clearBtnText}>✕</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={s.iconBtn} onPress={() => { setSearchOpen(true); closeDropdowns(); }}>
              <Text style={s.iconBtnText}>🔍</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <FlatList
        ref={flatListRef}
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <DeviceCard device={item} onUpdate={updateDevice} onDelete={deleteDevice} idfList={idfList} />
        )}
        contentContainerStyle={{ padding: 12, paddingBottom: 100 }}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={{ fontSize: 44 }}>🎛️</Text>
            <Text style={s.emptyTitle}>No devices found</Text>
            <Text style={s.emptyHint}>Tap + to track hardware assets and device lines</Text>
          </View>
        }
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={() => { closeDropdowns(); setFabOpen(false); }}
      />

      {fabOpen && <TouchableOpacity style={s.fabBackdrop} activeOpacity={1} onPress={() => setFabOpen(false)} />}

      <View style={s.fabContainer} pointerEvents="box-none">
        {fabOpen && (
          <View style={s.fabActions}>
            {/* NEW BULK IMPORT OPTION */}
            <TouchableOpacity style={[s.fabAction, s.fabActionBulk]} onPress={() => { setFabOpen(false); setBulkModalVisible(true); }}>
              <Text style={s.fabActionText}>📦 BULK IMPORT...</Text>
            </TouchableOpacity>

            {PRESET_DEVICES.map(type => (
              <TouchableOpacity key={type} style={[s.fabAction, s.fabActionBlue]} onPress={() => { setFabOpen(false); addDevice(type); }}>
                <Text style={s.fabActionText}>{type.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[s.fabAction, s.fabActionExotic]} onPress={() => { setFabOpen(false); setCustomModal(true); }}>
              <Text style={s.fabActionText}>⚙️ CUSTOM TYPE...</Text>
            </TouchableOpacity>
          </View>
        )}
        <TouchableOpacity style={[s.fabMain, fabOpen && s.fabMainOpen]} onPress={() => { setFabOpen(v => !v); closeDropdowns(); }}>
          <Text style={s.fabMainText}>{fabOpen ? '✕' : '+'}</Text>
        </TouchableOpacity>
      </View>

      {/* Bulk Import Modal Integration */}
      <BulkImportModal
        visible={bulkModalVisible}
        onClose={() => setBulkModalVisible(false)}
        onImport={handleBulkImport}
        idfList={idfList}
      />

      {/* Cross-platform Android Safe Modal for Exotic/Custom Device Input */}
      <Modal visible={customModal} transparent animationType="fade" onRequestClose={() => setCustomModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>NEW SITUATIONAL DEVICE</Text>
            <TextInput
              value={customType}
              onChangeText={setCustomType}
              placeholder="e.g. Duct Detector, Biometric, Strobe"
              placeholderTextColor={COLORS.textDim}
              style={s.modalInput}
              autoCapitalize="words"
            />
            <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'end' }}>
              <TouchableOpacity style={[s.modalBtn, { backgroundColor: '#374151' }]} onPress={() => { setCustomModal(false); setCustomType(''); }}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalBtn, { backgroundColor: COLORS.blue }]} onPress={() => { if(customType.trim()){ addDevice(customType.trim()); setCustomType(''); setCustomModal(false); } }}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>CREATE</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  filterBox: { backgroundColor: COLORS.bg, padding: 10, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)', zIndex: 10 },
  searchInputInline: { flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: COLORS.text, fontSize: 13 },
  iconBtn: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, alignItems: 'center', justifyContent: 'center', minWidth: 36 },
  iconBtnText: { color: COLORS.textSub, fontSize: 16 },
  dropdownRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  dropBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  dropBtnAmber: { backgroundColor: COLORS.amberDim, borderColor: 'rgba(245,158,11,0.4)' },
  dropBtnBlue: { backgroundColor: COLORS.blueDim, borderColor: 'rgba(59,130,246,0.4)' },
  dropBtnText: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted, flex: 1 },
  dropCaret: { fontSize: 10, color: COLORS.textMuted, marginLeft: 4 },
  dropMenu: { position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, backgroundColor: '#1e2530', borderWidth: 1, borderColor: COLORS.borderHi, borderRadius: 9, overflow: 'hidden', elevation: 12 },
  dropItem: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  dropItemText: { fontSize: 12, fontWeight: '600', color: COLORS.textSub },
  clearBtn: { backgroundColor: 'rgba(239,68,68,0.15)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, alignItems: 'center', justifyContent: 'center' },
  clearBtnText: { color: '#f87171', fontSize: 13, fontWeight: '800' },
  empty: { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textDim },
  emptyHint:  { fontSize: 12, color: COLORS.textDim, textAlign: 'center', paddingHorizontal: 40 },
  fabBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 30 },
  fabContainer: { position: 'absolute', bottom: 18, right: 18, alignItems: 'flex-end', zIndex: 40 },
  fabActions: { alignItems: 'flex-end', gap: 10, marginBottom: 12 },
  fabAction: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 50, elevation: 6 },
  fabActionBlue: { backgroundColor: '#1d4ed8' },
  fabActionExotic: { backgroundColor: '#7c3aed' },
  fabActionBulk: { backgroundColor: '#0284c7' }, // Custom color for distinct bulk accent
  fabActionText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  fabMain: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#16a34a', alignItems: 'center', justifyContent: 'center', elevation: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  fabMainOpen: { backgroundColor: '#374151' },
  fabMainText: { color: '#fff', fontSize: 24, fontWeight: '400' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
  modalContent: { backgroundColor: COLORS.surface, borderRadius: 12, borderWidth: 1, borderColor: COLORS.borderHi, padding: 16, gap: 12 },
  modalTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 1, color: COLORS.textMuted },
  modalInput: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: COLORS.border, borderRadius: 7, padding: 10, color: COLORS.text, fontSize: 13 },
  modalBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6 }
});