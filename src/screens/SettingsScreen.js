import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, Alert, StyleSheet,
} from 'react-native';
import { COLORS } from '../theme';

export default function SettingsScreen({ drops, idfList, updateIdfs, clearAllDrops }) {
  const [newIdf, setNewIdf] = useState('');

  const addIdf = () => {
    const val = newIdf.trim().toUpperCase();
    if (!val) return;
    if (idfList.includes(val)) {
      Alert.alert('Already exists', `"${val}" is already in the list.`);
      return;
    }
    updateIdfs([...idfList, val]);
    setNewIdf('');
  };

  const removeIdf = (idf) => {
    const uses = drops.filter(d => d.idf === idf).length;
    if (uses > 0) {
      Alert.alert('Cannot Remove', `"${idf}" is assigned to ${uses} drop(s). Reassign them first.`);
      return;
    }
    Alert.alert('Remove IDF', `Remove "${idf}" from the list?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => updateIdfs(idfList.filter(i => i !== idf)) },
    ]);
  };

  const handleClearAll = () => {
    Alert.alert(
      '⚠️ Clear All Drops',
      `This will permanently delete all ${drops.length} drops. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: `Delete All (${drops.length})`, style: 'destructive', onPress: clearAllDrops },
      ]
    );
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: COLORS.bg }}
      contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={s.screenTitle}>Settings</Text>

      {/* IDF Closets */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>IDF CLOSETS</Text>
        <Text style={s.hint}>Manage the IDF locations available for drop assignment.</Text>

        {idfList.map(idf => {
          const count = drops.filter(d => d.idf === idf).length;
          return (
            <View key={idf} style={s.idfRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.idfName}>{idf}</Text>
                {count > 0 && (
                  <Text style={s.idfCount}>{count} drop{count !== 1 ? 's' : ''} assigned</Text>
                )}
              </View>
              <TouchableOpacity onPress={() => removeIdf(idf)} style={s.removeBtn}>
                <Text style={s.removeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          );
        })}

        {/* Add new IDF */}
        <View style={s.addRow}>
          <TextInput
            value={newIdf}
            onChangeText={t => setNewIdf(t.toUpperCase())}
            placeholder="e.g. IDF-9"
            placeholderTextColor={COLORS.textDim}
            style={[s.input, { flex: 1 }]}
            autoCapitalize="characters"
            returnKeyType="done"
            onSubmitEditing={addIdf}
          />
          <TouchableOpacity style={s.addBtn} onPress={addIdf} activeOpacity={0.8}>
            <Text style={s.addBtnText}>+ Add</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* About */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>ABOUT</Text>
        <View style={{ gap: 6 }}>
          {[
            ['Total Drops',   String(drops.length)],
            ['Double Drops',  String(drops.filter(d => d.isDouble).length)],
            ['IDF Closets',   String(idfList.length)],
            ['App Version',   '1.0.0'],
          ].map(([k, v]) => (
            <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: COLORS.textMuted, fontSize: 13 }}>{k}</Text>
              <Text style={{ color: COLORS.textSub, fontSize: 13, fontWeight: '600' }}>{v}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Danger zone */}
      <View style={[s.section, { borderColor: 'rgba(239,68,68,0.25)' }]}>
        <Text style={[s.sectionTitle, { color: '#f87171' }]}>DANGER ZONE</Text>
        <TouchableOpacity
          onPress={handleClearAll}
          style={s.dangerBtn}
          disabled={drops.length === 0}
          activeOpacity={0.8}
        >
          <Text style={s.dangerBtnText}>
            🗑  CLEAR ALL DROPS ({drops.length})
          </Text>
        </TouchableOpacity>
        <Text style={s.hint}>Permanently deletes all cable drops. Cannot be undone.</Text>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screenTitle: {
    fontSize: 22, fontWeight: '800', color: COLORS.text,
    marginBottom: 14, letterSpacing: -0.3,
  },
  section: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 10, fontWeight: '800', letterSpacing: 1, color: COLORS.textMuted,
  },
  hint: { fontSize: 11, color: COLORS.textDim },
  idfRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  idfName:  { fontSize: 14, fontWeight: '700', color: COLORS.textSub, fontFamily: 'monospace' },
  idfCount: { fontSize: 10, color: COLORS.textMuted, marginTop: 2 },
  removeBtn: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
    borderRadius: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  removeBtnText: { color: '#f87171', fontSize: 12, fontWeight: '700' },
  addRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
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
  addBtn: {
    backgroundColor: COLORS.amberDim,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.5)',
    borderRadius: 7,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  addBtnText: { color: COLORS.amber, fontWeight: '800', fontSize: 13 },
  dangerBtn: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    borderRadius: 8,
    padding: 13,
    alignItems: 'center',
  },
  dangerBtnText: { color: '#f87171', fontWeight: '800', fontSize: 13, letterSpacing: 0.5 },
});
