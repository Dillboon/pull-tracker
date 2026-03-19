import React, { useState, useMemo, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  FlatList, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import DropCard from '../components/DropCard';
import BulkImportModal from '../components/BulkImportModal';
import { COLORS } from '../theme';

const STATUS_FILTERS = [
  { key: 'ALL',        label: 'All'         },
  { key: 'COMPLETE',   label: 'Complete'    },
  { key: 'INCOMPLETE', label: 'Incomplete'  },
  { key: 'ROUGH_ONLY', label: 'Pulled Only' },
];

export default function DropsScreen({ drops, idfList, addDrop, bulkAddDrops, updateDrop, deleteDrop }) {
  const [filterIdf,      setFilterIdf]      = useState('ALL');
  const [filterStatus,   setFilterStatus]   = useState('ALL');
  const [search,         setSearch]         = useState('');
  const [showBulk,       setShowBulk]       = useState(false);
  const [fabOpen,        setFabOpen]        = useState(false);
  const [idfDropdown,    setIdfDropdown]    = useState(false);
  const [statusDropdown, setStatusDropdown] = useState(false);

  const [lockedOrder, setLockedOrder] = useState(() => drops.map(d => d.id));

  useEffect(() => {
    setLockedOrder(prev => {
      const newIds = drops.map(d => d.id).filter(id => !prev.includes(id));
      return [...prev, ...newIds];
    });
  }, [drops]);

  const idfLabel    = filterIdf === 'ALL' ? 'All IDFs' : filterIdf;
  const statusLabel = STATUS_FILTERS.find(f => f.key === filterStatus)?.label ?? 'All';
  const hasFilter   = filterIdf !== 'ALL' || filterStatus !== 'ALL';

  const closeDropdowns = () => { setIdfDropdown(false); setStatusDropdown(false); };

  const handleRefresh = () => {
    const sorted = [...drops].sort((a, b) => {
      const numA = parseInt(a.cableA);
      const numB = parseInt(b.cableA);
      const hasA = !isNaN(numA);
      const hasB = !isNaN(numB);
      if (!hasA && !hasB) return 0;
      if (!hasA) return 1;
      if (!hasB) return -1;
      return numA - numB;
    });
    setLockedOrder(sorted.map(d => d.id));
  };

  const filtered = useMemo(() => drops.filter(d => {
    if (filterIdf !== 'ALL' && d.idf !== filterIdf) return false;
    if (filterStatus === 'COMPLETE'   && !(d.roughPull && d.terminated && d.tested)) return false;
    if (filterStatus === 'INCOMPLETE' &&  (d.roughPull && d.terminated && d.tested)) return false;
    if (filterStatus === 'ROUGH_ONLY' && (!d.roughPull || d.terminated || d.tested)) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (
        !d.cableA.toLowerCase().includes(q) &&
        !d.cableB.toLowerCase().includes(q) &&
        !d.notes.toLowerCase().includes(q) &&
        !d.idf.toLowerCase().includes(q)
      ) return false;
    }
    return true;
  }).sort((a, b) => {
    const ai = lockedOrder.indexOf(a.id);
    const bi = lockedOrder.indexOf(b.id);
    return (ai === -1 ? Infinity : ai) - (bi === -1 ? Infinity : bi);
  }), [drops, filterIdf, filterStatus, search, lockedOrder]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ── Filter bar ── */}
      <View style={s.filterBox}>
        <TextInput
          value={search}
          onChangeText={(t) => { setSearch(t); closeDropdowns(); }}
          placeholder="🔍  Search cable IDs, IDF, notes…"
          placeholderTextColor={COLORS.textDim}
          style={s.searchInput}
        />

        {/* Dropdown row */}
        <View style={s.dropdownRow}>
          {/* IDF dropdown */}
          <View style={{ flex: 1 }}>
            <TouchableOpacity
              style={[s.dropBtn, idfDropdown && s.dropBtnActive, filterIdf !== 'ALL' && s.dropBtnAmber]}
              onPress={() => { setIdfDropdown(v => !v); setStatusDropdown(false); }}
              activeOpacity={0.8}
            >
              <Text style={[s.dropBtnText, filterIdf !== 'ALL' && { color: COLORS.amber }]}>
                📍 {idfLabel}
              </Text>
              <Text style={[s.dropCaret, idfDropdown && s.dropCaretOpen]}>▾</Text>
            </TouchableOpacity>

            {idfDropdown && (
              <View style={[s.dropMenu, { zIndex: 20 }]}>
                {['ALL', ...idfList].map(idf => (
                  <TouchableOpacity
                    key={idf}
                    style={[s.dropItem, filterIdf === idf && s.dropItemActive]}
                    onPress={() => { setFilterIdf(idf); setIdfDropdown(false); }}
                  >
                    <Text style={[s.dropItemText, filterIdf === idf && { color: COLORS.amber, fontWeight: '800' }]}>
                      {idf === 'ALL' ? 'All IDFs' : idf}
                    </Text>
                    {filterIdf === idf && <Text style={{ color: COLORS.amber, fontSize: 12 }}>✓</Text>}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Status dropdown */}
          <View style={{ flex: 1 }}>
            <TouchableOpacity
              style={[s.dropBtn, statusDropdown && s.dropBtnActive, filterStatus !== 'ALL' && s.dropBtnBlue]}
              onPress={() => { setStatusDropdown(v => !v); setIdfDropdown(false); }}
              activeOpacity={0.8}
            >
              <Text style={[s.dropBtnText, filterStatus !== 'ALL' && { color: COLORS.blue }]}>
                ◈ {statusLabel}
              </Text>
              <Text style={[s.dropCaret, statusDropdown && s.dropCaretOpen]}>▾</Text>
            </TouchableOpacity>

            {statusDropdown && (
              <View style={[s.dropMenu, { zIndex: 20 }]}>
                {STATUS_FILTERS.map(f => (
                  <TouchableOpacity
                    key={f.key}
                    style={[s.dropItem, filterStatus === f.key && s.dropItemActiveBlue]}
                    onPress={() => { setFilterStatus(f.key); setStatusDropdown(false); }}
                  >
                    <Text style={[s.dropItemText, filterStatus === f.key && { color: COLORS.blue, fontWeight: '800' }]}>
                      {f.label}
                    </Text>
                    {filterStatus === f.key && <Text style={{ color: COLORS.blue, fontSize: 12 }}>✓</Text>}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {hasFilter && (
            <TouchableOpacity
              style={s.clearBtn}
              onPress={() => { setFilterIdf('ALL'); setFilterStatus('ALL'); closeDropdowns(); }}
            >
              <Text style={s.clearBtnText}>✕</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={s.refreshBtn} onPress={handleRefresh}>
            <Text style={s.refreshBtnText}>⟳</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Drop list ── */}
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <DropCard drop={item} onUpdate={updateDrop} onDelete={deleteDrop} idfList={idfList} />
        )}
        contentContainerStyle={{ padding: 12, paddingBottom: 100 }}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={{ fontSize: 44 }}>🔌</Text>
            <Text style={s.emptyTitle}>No drops found</Text>
            <Text style={s.emptyHint}>Tap + to add your first cable drop</Text>
          </View>
        }
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={() => { closeDropdowns(); setFabOpen(false); }}
      />

      {/* Bulk import modal */}
      <BulkImportModal
        visible={showBulk}
        onClose={() => setShowBulk(false)}
        onImport={bulkAddDrops}
        idfList={idfList}
      />

      {/* ── Speed-dial FAB ── */}
      {fabOpen && (
        <TouchableOpacity
          style={s.fabBackdrop}
          activeOpacity={1}
          onPress={() => setFabOpen(false)}
        />
      )}

      <View style={s.fabContainer} pointerEvents="box-none">
        {fabOpen && (
          <View style={s.fabActions}>
            <TouchableOpacity
              style={[s.fabAction, s.fabActionBlue]}
              onPress={() => { setFabOpen(false); addDrop(false); }}
              activeOpacity={0.85}
            >
              <Text style={s.fabActionIcon}>＋</Text>
              <Text style={s.fabActionText}>SINGLE</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.fabAction, s.fabActionPurple]}
              onPress={() => { setFabOpen(false); addDrop(true); }}
              activeOpacity={0.85}
            >
              <Text style={s.fabActionIcon}>⟷</Text>
              <Text style={s.fabActionText}>DOUBLE</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.fabAction, s.fabActionTeal]}
              onPress={() => { setFabOpen(false); setShowBulk(true); }}
              activeOpacity={0.85}
            >
              <Text style={s.fabActionIcon}>⬇</Text>
              <Text style={s.fabActionText}>BULK</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          style={[s.fabMain, fabOpen && s.fabMainOpen]}
          onPress={() => { setFabOpen(v => !v); closeDropdowns(); }}
          activeOpacity={0.85}
        >
          <Text style={[s.fabMainText, fabOpen && s.fabMainTextOpen]}>
            {fabOpen ? '✕' : '+'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  // ── Filter bar ──────────────────────────────────────────────────────────
  filterBox: {
    backgroundColor: COLORS.bg,
    padding: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    zIndex: 10,
  },
  searchInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 8, padding: 10,
    color: COLORS.text, fontSize: 13,
    marginBottom: 8,
  },
  dropdownRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  dropBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  dropBtnActive: {
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  dropBtnAmber: {
    backgroundColor: COLORS.amberDim,
    borderColor: 'rgba(245,158,11,0.4)',
  },
  dropBtnBlue: {
    backgroundColor: COLORS.blueDim,
    borderColor: 'rgba(59,130,246,0.4)',
  },
  dropBtnText: {
    fontSize: 11, fontWeight: '700',
    color: COLORS.textMuted, letterSpacing: 0.3, flex: 1,
  },
  dropCaret: {
    fontSize: 10, color: COLORS.textMuted, marginLeft: 4,
  },
  dropCaretOpen: {
    transform: [{ rotate: '180deg' }],
  },
  dropMenu: {
    position: 'absolute',
    top: '100%',
    left: 0, right: 0,
    marginTop: 4,
    backgroundColor: '#1e2530',
    borderWidth: 1,
    borderColor: COLORS.borderHi,
    borderRadius: 9,
    overflow: 'hidden',
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  dropItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  dropItemActive:     { backgroundColor: COLORS.amberDim },
  dropItemActiveBlue: { backgroundColor: COLORS.blueDim  },
  dropItemText: { fontSize: 12, fontWeight: '600', color: COLORS.textSub },
  clearBtn: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
    borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  clearBtnText: { color: '#f87171', fontSize: 13, fontWeight: '800' },
  refreshBtn: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8,
    justifyContent: 'center',
  },
  refreshBtnText: { color: COLORS.textSub, fontSize: 16 },

  // ── Empty state ──────────────────────────────────────────────────────────
  empty: { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textDim },
  emptyHint:  { fontSize: 12, color: COLORS.textDim, textAlign: 'center', paddingHorizontal: 40 },

  // ── Speed-dial FAB ───────────────────────────────────────────────────────
  fabBackdrop: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 30,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 18,
    right: 18,
    alignItems: 'flex-end',
    zIndex: 40,
  },
  fabActions: {
    alignItems: 'flex-end',
    gap: 10,
    marginBottom: 12,
  },
  fabAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 50,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  fabActionBlue:   { backgroundColor: '#1d4ed8' },
  fabActionPurple: { backgroundColor: '#5b21b6' },
  fabActionTeal:   { backgroundColor: '#0f766e' },
  fabActionIcon:   { color: '#fff', fontSize: 16, fontWeight: '800' },
  fabActionText:   { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  fabMain: {
    width: 56, height: 56,
    borderRadius: 28,
    backgroundColor: '#16a34a',
    alignItems: 'center', justifyContent: 'center',
    elevation: 8,
    shadowColor: '#16a34a',
    shadowOpacity: 0.6,
    shadowRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  fabMainOpen: {
    backgroundColor: '#374151',
    shadowColor: '#000',
    shadowOpacity: 0.4,
  },
  fabMainText:     { color: '#fff', fontSize: 28, fontWeight: '300', lineHeight: 32 },
  fabMainTextOpen: { fontSize: 20, fontWeight: '700' },
});
