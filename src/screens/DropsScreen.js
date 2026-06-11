import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  FlatList, StyleSheet, KeyboardAvoidingView, Platform, Modal,
} from 'react-native';
import DropCard from '../components/DropCard';
import BulkImportModal from '../components/BulkImportModal';
import { COLORS } from '../theme';

const STATUS_FILTERS = [
  { key: 'ALL',        label: 'All'            },
  { key: 'COMPLETE',   label: 'Complete'       },
  { key: 'INCOMPLETE', label: 'Incomplete'     },
  { key: 'TERMINATED', label: 'Terminated'     },
  { key: 'ROUGH_ONLY', label: 'Pulled Only'    },
  { key: 'PATCHED',    label: 'Patched'        },
  { key: 'NOTES',      label: 'Notes'          },
  { key: 'ATTENTION',  label: 'Attention Notes'},
];

export default function DropsScreen({ drops, idfList, addDrop, bulkAddDrops, updateDrop, deleteDrop, addDropFromTemplate, templates, customTypeList = [], onEditCustomTypes }) {
  const [filterIdf,         setFilterIdf]         = useState('ALL');
  const [filterStatus,      setFilterStatus]      = useState('ALL');
  const [filterRack,        setFilterRack]        = useState('ALL');
  const [filterCustomType,  setFilterCustomType]  = useState('ALL');
  const [search,            setSearch]            = useState('');
  const [showBulk,          setShowBulk]          = useState(false);
  const [showTemplates,     setShowTemplates]     = useState(false);
  const [fabOpen,           setFabOpen]           = useState(false);
  const [idfDropdown,       setIdfDropdown]       = useState(false);
  const [statusDropdown,    setStatusDropdown]    = useState(false);
  const [rackDropdown,      setRackDropdown]      = useState(false);
  const [customTypeDropdown, setCustomTypeDropdown] = useState(false);
  const [searchOpen,        setSearchOpen]        = useState(false);
  const searchInputRef = useRef(null);
  const flatListRef    = useRef(null);
  const scrollTimer    = useRef(null);
  const [showScrollUp,   setShowScrollUp]   = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const scrollY        = useRef(0);
  const prevScrollY    = useRef(0);
  const contentHeight  = useRef(0);
  const layoutHeight   = useRef(0);
  const [collapseKey,    setCollapseKey]    = useState(0);
  const [expandedCount,  setExpandedCount]  = useState(0);

  const [lockedOrder, setLockedOrder] = useState(() => drops.map(d => d.id));

  useEffect(() => {
    setLockedOrder(prev => {
      const newIds = drops.map(d => d.id).filter(id => !prev.includes(id));
      return [...prev, ...newIds];
    });
  }, [drops]);

  const idfLabel = filterIdf === 'ALL' ? 'All' : filterIdf;
  const statusLabel = STATUS_FILTERS.find(f => f.key === filterStatus)?.label ?? 'All';
  
  const activeRacks = filterIdf !== 'ALL'
    ? [...new Set(drops.filter(d => d.idf === filterIdf).map(d => d.rackNumber).filter(Boolean))].sort()
    : [];
  const showRackFilter = filterIdf !== 'ALL' && activeRacks.length >= 2;

  const activeCustomTypes = useMemo(() => {
    return [...new Set(drops.map(d => d.customType).filter(Boolean))].sort();
  }, [drops]);
  const showCustomTypeFilter = activeCustomTypes.length >= 1;

  const hasFilter = filterIdf !== 'ALL' || filterStatus !== 'ALL' || filterRack !== 'ALL' || filterCustomType !== 'ALL';

  const closeDropdowns = () => { 
    setIdfDropdown(false); 
    setStatusDropdown(false); 
    setRackDropdown(false); 
    setCustomTypeDropdown(false); 
  };

  useEffect(() => {
    if (searchOpen) {
      const t = setTimeout(() => searchInputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [searchOpen]);

  const handleScroll = (e) => {
    const y       = e.nativeEvent.contentOffset.y;
    const content = e.nativeEvent.contentSize.height;
    const layout  = e.nativeEvent.layoutMeasurement.height;
    const prev    = prevScrollY.current;

    contentHeight.current = content;
    layoutHeight.current  = layout;

    const scrollingDown = y > prev;
    const atTop         = y <= 10;
    const atBottom      = y + layout >= content - 10;

    prevScrollY.current = y;
    scrollY.current     = y;

    if (scrollingDown && !atBottom) {
      setShowScrollDown(true);
      setShowScrollUp(false);
    } else if (!scrollingDown && !atTop) {
      setShowScrollUp(true);
      setShowScrollDown(false);
    }

    if (atTop)    setShowScrollUp(false);
    if (atBottom) setShowScrollDown(false);

    if (scrollTimer.current) clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(() => {
      setShowScrollUp(false);
      setShowScrollDown(false);
    }, 1500);
  };

  const handleCollapseAll = () => {
    setCollapseKey(k => k + 1);
    setExpandedCount(0);
  };

  const handleRefresh = () => {
    const sorted = [...drops].sort((a, b) => {
      const idfA = (a.idf || '').toLowerCase();
      const idfB = (b.idf || '').toLowerCase();
      if (idfA < idfB) return -1;
      if (idfA > idfB) return 1;
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
    if (filterRack !== 'ALL' && (d.rackNumber || '') !== filterRack) return false;
    if (filterCustomType !== 'ALL' && (d.customType || '') !== filterCustomType) return false;
    if (filterStatus === 'COMPLETE'   && !(d.overrideComplete || (d.roughPull && d.terminated && d.tested))) return false;
    if (filterStatus === 'INCOMPLETE' &&  (d.overrideComplete || (d.roughPull && d.terminated && d.tested))) return false;
    if (filterStatus === 'TERMINATED' && !(d.roughPull && d.terminated && !d.tested)) return false;
    if (filterStatus === 'ROUGH_ONLY' && (!d.roughPull || d.terminated || d.tested)) return false;
    if (filterStatus === 'PATCHED'    && !(d.patchedA || d.patchedB || d.patchedC || d.patchedD)) return false;
    if (filterStatus === 'NOTES' && (!d.notes?.trim() || d.attention))               return false;
    if (filterStatus === 'ATTENTION'  && !d.attention)                               return false;
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
  }), [drops, filterIdf, filterStatus, filterRack, filterCustomType, search, lockedOrder]);

  const conflictIds = useMemo(() => {
    const seenByIdf = new Map();
    for (const d of drops) {
      const idf = d.idf || '';
      if (!seenByIdf.has(idf)) seenByIdf.set(idf, new Map());
      const seen = seenByIdf.get(idf);
      for (const id of [d.cableA, d.cableB, d.cableC, d.cableD]) {
        if (!id?.trim()) continue;
        seen.set(id, (seen.get(id) ?? 0) + 1);
      }
    }
    const dupes = new Set();
    for (const seen of seenByIdf.values()) {
      for (const [id, count] of seen) {
        if (count > 1) dupes.add(id);
      }
    }
    return dupes;
  }, [drops]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ── Filter Bar Hub ── */}
      <View style={s.filterHub}>
        {searchOpen ? (
          <View style={s.searchRowExpanded}>
            <TouchableOpacity
              style={s.searchBackBtn}
              onPress={() => { setSearchOpen(false); setSearch(''); closeDropdowns(); }}
            >
              <Text style={s.searchBackArrow}>←</Text>
            </TouchableOpacity>
            <View style={s.searchInputWrapper}>
              <TextInput
                ref={searchInputRef}
                value={search}
                onChangeText={setSearch}
                placeholder="Search cable IDs, IDF, notes…"
                placeholderTextColor={COLORS.textDim}
                style={s.searchFieldInline}
                returnKeyType="search"
                onSubmitEditing={() => searchInputRef.current?.blur()}
              />
              {search.length > 0 && (
                <TouchableOpacity style={s.searchClearInline} onPress={() => setSearch('')}>
                  <Text style={s.searchClearInlineText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ) : (
          <View style={s.mainHubLayout}>
            
            {/* Horizontal Pill Track for Filters */}
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              contentContainerStyle={s.pillRailContainer}
            >
              {/* Clear All Capsule */}
              {hasFilter && (
                <TouchableOpacity
                  style={s.clearCapsule}
                  onPress={() => { setFilterIdf('ALL'); setFilterStatus('ALL'); setFilterRack('ALL'); setFilterCustomType('ALL'); closeDropdowns(); }}
                >
                  <Text style={s.clearCapsuleText}>Reset ✕</Text>
                </TouchableOpacity>
              )}

              {/* IDF Capsule */}
              <TouchableOpacity
                style={[s.capsuleBtn, idfDropdown && s.capsuleBtnActive, filterIdf !== 'ALL' && s.capsuleBtnAmber]}
                onPress={() => { setIdfDropdown(v => !v); setStatusDropdown(false); setRackDropdown(false); setCustomTypeDropdown(false); }}
                activeOpacity={0.8}
              >
                <Text style={[s.capsuleLabel, filterIdf !== 'ALL' && { color: COLORS.amber }]}>
                  IDF: <Text style={s.capsuleVal}>{idfLabel}</Text>
                </Text>
                <Text style={[s.capsuleCaret, idfDropdown && s.capsuleCaretOpen]}>▾</Text>
              </TouchableOpacity>

              {/* Rack Capsule */}
              {showRackFilter && (
                <TouchableOpacity
                  style={[s.capsuleBtn, rackDropdown && s.capsuleBtnActive, filterRack !== 'ALL' && s.capsuleBtnGreen]}
                  onPress={() => { setRackDropdown(v => !v); setIdfDropdown(false); setStatusDropdown(false); setCustomTypeDropdown(false); }}
                  activeOpacity={0.8}
                >
                  <Text style={[s.capsuleLabel, filterRack !== 'ALL' && { color: COLORS.green }]}>
                    Rack: <Text style={s.capsuleVal}>{filterRack === 'ALL' ? 'All' : filterRack}</Text>
                  </Text>
                  <Text style={[s.capsuleCaret, rackDropdown && s.capsuleCaretOpen]}>▾</Text>
                </TouchableOpacity>
              )}

              {/* Custom Drop Type Capsule */}
              {showCustomTypeFilter && (
                <TouchableOpacity
                  style={[s.capsuleBtn, customTypeDropdown && s.capsuleBtnActive, filterCustomType !== 'ALL' && s.capsuleBtnPurple]}
                  onPress={() => { setCustomTypeDropdown(v => !v); setIdfDropdown(false); setStatusDropdown(false); setRackDropdown(false); }}
                  activeOpacity={0.8}
                >
                  <Text style={[s.capsuleLabel, filterCustomType !== 'ALL' && { color: '#a78bfa' }]}>
                    Type: <Text style={s.capsuleVal}>{filterCustomType === 'ALL' ? 'All' : filterCustomType}</Text>
                  </Text>
                  <Text style={[s.capsuleCaret, customTypeDropdown && s.capsuleCaretOpen]}>▾</Text>
                </TouchableOpacity>
              )}

              {/* Status Capsule */}
              <TouchableOpacity
                style={[s.capsuleBtn, statusDropdown && s.capsuleBtnActive, filterStatus !== 'ALL' && s.capsuleBtnBlue]}
                onPress={() => { setStatusDropdown(v => !v); setIdfDropdown(false); setRackDropdown(false); setCustomTypeDropdown(false); }}
                activeOpacity={0.8}
              >
                <Text style={[s.capsuleLabel, filterStatus !== 'ALL' && { color: COLORS.blue }]}>
                  Status: <Text style={s.capsuleVal}>{statusLabel}</Text>
                </Text>
                <Text style={[s.capsuleCaret, statusDropdown && s.capsuleCaretOpen]}>▾</Text>
              </TouchableOpacity>
            </ScrollView>

            {/* Fixed Utility Panel on Right */}
            <View style={s.utilityFixedDock}>
              {expandedCount > 0 && (
                <TouchableOpacity style={s.dockIconButton} onPress={handleCollapseAll}>
                  <Text style={s.dockIconText}>⊟</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[s.dockIconButton, search.length > 0 && s.dockIconActiveBlue]}
                onPress={() => { setSearchOpen(true); closeDropdowns(); }}
              >
                <Text style={[s.dockIconText, search.length > 0 && { color: COLORS.blue }]}>⌕</Text>
              </TouchableOpacity>

              <TouchableOpacity style={s.dockIconButton} onPress={handleRefresh}>
                <Text style={s.dockIconText}>⟳</Text>
              </TouchableOpacity>
            </View>

          </View>
        )}

        {/* ── Floating Dropdown Panels (Layered over Content Area) ── */}
        {idfDropdown && (
          <View style={[s.floatingMenuOverlay, { left: 8 }]}>
            {['ALL', ...idfList].map(idf => (
              <TouchableOpacity
                key={idf}
                style={[s.menuItemRow, filterIdf === idf && s.menuItemActiveAmber]}
                onPress={() => { setFilterIdf(idf); setFilterRack('ALL'); setIdfDropdown(false); }}
              >
                <Text style={[s.menuItemText, filterIdf === idf && { color: COLORS.amber, fontWeight: '700' }]}>
                  {idf === 'ALL' ? 'All IDFs' : `IDF ${idf}`}
                </Text>
                {filterIdf === idf && <Text style={{ color: COLORS.amber, fontSize: 11 }}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {rackDropdown && (
          <View style={[s.floatingMenuOverlay, { left: 60 }]}>
            <TouchableOpacity
              style={[s.menuItemRow, filterRack === 'ALL' && s.menuItemActiveGreen]}
              onPress={() => { setFilterRack('ALL'); setRackDropdown(false); }}
            >
              <Text style={[s.menuItemText, filterRack === 'ALL' && { color: COLORS.green, fontWeight: '700' }]}>All Racks</Text>
              {filterRack === 'ALL' && <Text style={{ color: COLORS.green, fontSize: 11 }}>✓</Text>}
            </TouchableOpacity>
            {activeRacks.map(rack => (
              <TouchableOpacity
                key={rack}
                style={[s.menuItemRow, filterRack === rack && s.menuItemActiveGreen]}
                onPress={() => { setFilterRack(rack); setRackDropdown(false); }}
              >
                <Text style={[s.menuItemText, filterRack === rack && { color: COLORS.green, fontWeight: '700' }]}>Rack {rack}</Text>
                {filterRack === rack && <Text style={{ color: COLORS.green, fontSize: 11 }}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {customTypeDropdown && (
          <View style={[s.floatingMenuOverlay, { left: 100 }]}>
            <TouchableOpacity
              style={[s.menuItemRow, filterCustomType === 'ALL' && s.menuItemActivePurple]}
              onPress={() => { setFilterCustomType('ALL'); setCustomTypeDropdown(false); }}
            >
              <Text style={[s.menuItemText, filterCustomType === 'ALL' && { color: '#a78bfa', fontWeight: '700' }]}>All Types</Text>
              {filterCustomType === 'ALL' && <Text style={{ color: '#a78bfa', fontSize: 11 }}>✓</Text>}
            </TouchableOpacity>
            {activeCustomTypes.map(type => (
              <TouchableOpacity
                key={type}
                style={[s.menuItemRow, filterCustomType === type && s.menuItemActivePurple]}
                onPress={() => { setFilterCustomType(type); setCustomTypeDropdown(false); }}
              >
                <Text style={[s.menuItemText, filterCustomType === type && { color: '#a78bfa', fontWeight: '700' }]}>{type}</Text>
                {filterCustomType === type && <Text style={{ color: '#a78bfa', fontSize: 11 }}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {statusDropdown && (
          <View style={[s.floatingMenuOverlay, { right: 8, left: undefined }]}>
            {STATUS_FILTERS.map(f => (
              <TouchableOpacity
                key={f.key}
                style={[s.menuItemRow, filterStatus === f.key && s.menuItemActiveBlue]}
                onPress={() => { setFilterStatus(f.key); setStatusDropdown(false); }}
              >
                <Text style={[s.menuItemText, filterStatus === f.key && { color: COLORS.blue, fontWeight: '700' }]}>{f.label}</Text>
                {filterStatus === f.key && <Text style={{ color: COLORS.blue, fontSize: 11 }}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* ── Drop List Content Area ── */}
      <FlatList
        ref={flatListRef}
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <DropCard
            drop={item}
            onUpdate={updateDrop}
            onDelete={deleteDrop}
            idfList={idfList}
            collapseKey={collapseKey}
            conflictIds={conflictIds}
            customTypeList={customTypeList}
            onEditCustomTypes={onEditCustomTypes}
            onExpandChange={(isExpanded) =>
              setExpandedCount(n => isExpanded ? n + 1 : Math.max(0, n - 1))
            }
          />
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
        removeClippedSubviews={true}
        windowSize={5}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onScrollBeginDrag={() => { closeDropdowns(); setFabOpen(false); }}
      />

      <BulkImportModal
        visible={showBulk}
        onClose={() => setShowBulk(false)}
        onImport={bulkAddDrops}
        idfList={idfList}
      />

      {/* Speed-dial FAB Layer */}
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

            {templates?.length > 0 && (
              <TouchableOpacity
                style={[s.fabAction, { backgroundColor: '#92400e' }]}
                onPress={() => { setFabOpen(false); setShowTemplates(true); }}
                activeOpacity={0.85}
              >
                <Text style={s.fabActionIcon}>⊞</Text>
                <Text style={s.fabActionText}>TEMPLATE</Text>
              </TouchableOpacity>
            )}
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

      {/* Template picker Modal */}
      {showTemplates && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setShowTemplates(false)}>
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 }}
            activeOpacity={1}
            onPress={() => setShowTemplates(false)}
          >
            <View style={s.templateModal}>
              <Text style={s.templateModalTitle}>ADD FROM TEMPLATE</Text>
              {templates.map(t => (
                <TouchableOpacity
                  key={t.id}
                  style={s.templateRow}
                  onPress={() => { addDropFromTemplate(t); setShowTemplates(false); }}
                  activeOpacity={0.75}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={s.templateName}>{t.name}</Text>
                    <Text style={s.templateMeta}>
                      {t.groupType.charAt(0).toUpperCase() + t.groupType.slice(1)}
                      {t.idf ? `  ·  ${t.idf}` : ''}
                    </Text>
                  </View>
                  <Text style={{ color: COLORS.textMuted, fontSize: 18 }}>+</Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Scroll Navigation Controls */}
      {showScrollUp && (
        <TouchableOpacity
          style={s.scrollArrowTop}
          onPress={() => {
            flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
            setShowScrollUp(false);
          }}
          activeOpacity={0.8}
        >
          <Text style={s.scrollArrowText}>▲</Text>
        </TouchableOpacity>
      )}
      {showScrollDown && (
        <TouchableOpacity
          style={s.scrollArrowBottom}
          onPress={() => {
            flatListRef.current?.scrollToEnd({ animated: true });
            setShowScrollDown(false);
          }}
          activeOpacity={0.8}
        >
          <Text style={s.scrollArrowText}>▼</Text>
        </TouchableOpacity>
      )}

    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  filterHub: {
    backgroundColor: COLORS.bg,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    zIndex: 100,
    position: 'relative',
  },
  mainHubLayout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 36,
  },
  pillRailContainer: {
    alignItems: 'center',
    paddingRight: 10,
    gap: 6,
  },
  utilityFixedDock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.bg,
    paddingLeft: 6,
  },
  dockIconButton: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 8,
    height: 34,
    width: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dockIconActiveBlue: {
    backgroundColor: COLORS.blueDim,
    borderColor: 'rgba(59,130,246,0.3)',
  },
  dockIconText: {
    color: COLORS.textSub,
    fontSize: 14,
    fontWeight: '600',
  },
  capsuleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 20,
    paddingHorizontal: 12,
    height: 32,
    gap: 4,
  },
  capsuleBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.2)',
  },
  capsuleBtnAmber: {
    backgroundColor: 'rgba(245,158,11,0.06)',
    borderColor: 'rgba(245,158,11,0.25)',
  },
  capsuleBtnBlue: {
    backgroundColor: 'rgba(59,130,246,0.06)',
    borderColor: 'rgba(59,130,246,0.25)',
  },
  capsuleBtnGreen: {
    backgroundColor: 'rgba(34,197,94,0.06)',
    borderColor: 'rgba(34,197,94,0.25)',
  },
  capsuleBtnPurple: {
    backgroundColor: 'rgba(124,58,237,0.06)',
    borderColor: 'rgba(124,58,237,0.25)',
  },
  capsuleLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.textMuted,
  },
  capsuleVal: {
    fontWeight: '700',
    color: COLORS.textSub,
  },
  capsuleCaret: {
    fontSize: 10,
    color: COLORS.textDim,
    marginTop: 1,
  },
  capsuleCaretOpen: {
    transform: [{ rotate: '180deg' }],
  },
  clearCapsule: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
    borderRadius: 20,
    height: 32,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearCapsuleText: {
    color: '#f87171',
    fontSize: 11,
    fontWeight: '700',
  },
  searchRowExpanded: {
    flexDirection: 'row',
    height: 36,
    alignItems: 'center',
    gap: 8,
  },
  searchBackBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBackArrow: {
    color: COLORS.textSub,
    fontSize: 18,
    fontWeight: '600',
  },
  searchInputWrapper: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
  },
  searchFieldInline: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    paddingLeft: 10,
    paddingRight: 32,
    height: 36,
    color: COLORS.text,
    fontSize: 13,
  },
  searchClearInline: {
    position: 'absolute',
    right: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchClearInlineText: {
    color: COLORS.textDim,
    fontSize: 11,
  },
  floatingMenuOverlay: {
    position: 'absolute',
    top: 50,
    minWidth: 130,
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    overflow: 'hidden',
    elevation: 16,
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 12,
  },
  menuItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  menuItemActiveAmber:  { backgroundColor: 'rgba(245,158,11,0.05)' },
  menuItemActiveBlue:   { backgroundColor: 'rgba(59,130,246,0.05)' },
  menuItemActiveGreen:  { backgroundColor: 'rgba(34,197,94,0.05)' },
  menuItemActivePurple: { backgroundColor: 'rgba(124,58,237,0.05)' },
  menuItemText: {
    fontSize: 13,
    color: COLORS.textSub,
  },
  empty: { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textDim },
  emptyHint:  { fontSize: 12, color: COLORS.textDim, textAlign: 'center', paddingHorizontal: 40 },
  fabBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 30 },
  fabContainer: { position: 'absolute', bottom: 18, right: 18, alignItems: 'flex-end', zIndex: 40 },
  fabActions: { alignItems: 'flex-end', gap: 10, marginBottom: 12 },
  fabAction: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 11, borderRadius: 50,
    elevation: 6, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 6,
  },
  fabActionBlue:   { backgroundColor: '#1d4ed8' },
  fabActionPurple: { backgroundColor: '#5b21b6' },
  fabActionTeal:   { backgroundColor: '#0f766e' },
  fabActionIcon:   { color: '#fff', fontSize: 16, fontWeight: '800' },
  fabActionText:   { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  fabMain: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#16a34a',
    alignItems: 'center', justifyContent: 'center', elevation: 8,
    shadowColor: '#16a34a', shadowOpacity: 0.6, shadowRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  fabMainOpen: { backgroundColor: '#374151', shadowColor: '#000', shadowOpacity: 0.4 },
  fabMainText:     { color: '#fff', fontSize: 28, fontWeight: '300', lineHeight: 32 },
  fabMainTextOpen: { fontSize: 20, fontWeight: '700' },
  scrollArrowTop: {
    position: 'absolute', top: 58, alignSelf: 'center', left: '50%', marginLeft: -20,
    width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(30,37,48,0.92)',
    borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center',
    elevation: 8, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 6, zIndex: 25,
  },
  scrollArrowBottom: {
    position: 'absolute', bottom: 58, alignSelf: 'center', left: '50%', marginLeft: -20,
    width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(30,37,48,0.92)',
    borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center',
    elevation: 8, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 6, zIndex: 25,
  },
  scrollArrowText: { color: COLORS.blue, fontSize: 13, fontWeight: '800' },
  templateModal: {
    backgroundColor: COLORS.surface, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.borderHi, overflow: 'hidden',
  },
  templateModalTitle: {
    fontSize: 10, fontWeight: '800', letterSpacing: 1,
    color: COLORS.textMuted, padding: 14, paddingBottom: 8,
  },
  templateRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', gap: 10,
  },
  templateName: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  templateMeta: { fontSize: 10, color: COLORS.textMuted, marginTop: 2 },
});