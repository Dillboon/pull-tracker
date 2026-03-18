import React, { useState, useEffect, useCallback } from 'react';
import { View, SafeAreaView, StyleSheet, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';

import DropsScreen    from './src/screens/DropsScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import SettingsScreen  from './src/screens/SettingsScreen';
import TabBar          from './src/components/TabBar';
import Toast           from './src/components/Toast';
import { COLORS, DEFAULT_IDFS } from './src/theme';
import { emptyDrop } from './src/utils';

export default function App() {
  const [drops,     setDrops]     = useState([]);
  const [idfList,   setIdfList]   = useState(DEFAULT_IDFS);
  const [activeTab, setActiveTab] = useState('drops');
  const [loaded,    setLoaded]    = useState(false);
  const [toast,     setToast]     = useState(null);

  // ── Load persisted data on mount ─────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [dropsData, idfsData] = await Promise.all([
          AsyncStorage.getItem('cable-drops'),
          AsyncStorage.getItem('cable-idfs'),
        ]);
        if (dropsData) setDrops(JSON.parse(dropsData));
        if (idfsData)  setIdfList(JSON.parse(idfsData));
      } catch (e) {
        console.error('Load error:', e);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  // ── Toast helper ──────────────────────────────────────────────────────────
  const showToast = useCallback((msg, type = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  }, []);

  // ── Persist helpers ───────────────────────────────────────────────────────
  const persistDrops = useCallback(async (next) => {
    try { await AsyncStorage.setItem('cable-drops', JSON.stringify(next)); }
    catch { showToast('Save failed', 'error'); }
  }, [showToast]);

  const persistIdfs = useCallback(async (next) => {
    try { await AsyncStorage.setItem('cable-idfs', JSON.stringify(next)); }
    catch { showToast('Save failed', 'error'); }
  }, [showToast]);

  // ── Drop CRUD ─────────────────────────────────────────────────────────────
  const addDrop = useCallback((isDouble) => {
    const next = [emptyDrop(isDouble), ...drops];
    setDrops(next);
    persistDrops(next);
    showToast(isDouble ? '⟷ Double drop added' : '+ Single drop added');
  }, [drops, persistDrops, showToast]);
  
  const bulkAddDrops = useCallback((newDrops) => {
    const next = [...newDrops, ...drops];
    setDrops(next);
    persistDrops(next);
    showToast(`⬇ ${newDrops.length} drops imported`);
  }, [drops, persistDrops, showToast]);

  const updateDrop = useCallback((updated) => {
    const next = drops.map(d => d.id === updated.id ? updated : d);
    setDrops(next);
    persistDrops(next);
  }, [drops, persistDrops]);

  const deleteDrop = useCallback((id) => {
    const next = drops.filter(d => d.id !== id);
    setDrops(next);
    persistDrops(next);
    showToast('Drop deleted');
  }, [drops, persistDrops, showToast]);

  // ── IDF management ────────────────────────────────────────────────────────
  const updateIdfs = useCallback((next) => {
    setIdfList(next);
    persistIdfs(next);
  }, [persistIdfs]);

  // ── Clear all ─────────────────────────────────────────────────────────────
  const clearAllDrops = useCallback(() => {
    setDrops([]);
    persistDrops([]);
    showToast('All drops cleared');
  }, [persistDrops, showToast]);

  // ── Render ────────────────────────────────────────────────────────────────
  if (!loaded) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
        <StatusBar style="light" backgroundColor={COLORS.bg} />
      </View>
    );
  }

  const screenProps = { drops, idfList, addDrop, bulkAddDrops, updateDrop, deleteDrop, updateIdfs, clearAllDrops, showToast };

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" backgroundColor="#161b22" translucent={false} />
      <View style={{ flex: 1 }}>
        {activeTab === 'drops'     && <DropsScreen     {...screenProps} />}
        {activeTab === 'dashboard' && <DashboardScreen {...screenProps} />}
        {activeTab === 'settings'  && <SettingsScreen  {...screenProps} />}
      </View>
      <TabBar activeTab={activeTab} setActiveTab={setActiveTab} />
      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
});
