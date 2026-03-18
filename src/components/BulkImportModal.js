import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal,
  ScrollView, StyleSheet, Switch,
} from 'react-native';
import { COLORS } from '../theme';
import { uid, today } from '../utils';

export default function BulkImportModal({ visible, onClose, onImport, idfList }) {
  const [prefix,    setPrefix]    = useState('');
  const [start,     setStart]     = useState('1');
  const [end,       setEnd]       = useState('10');
  const [padZeros,  setPadZeros]  = useState(true);
  const [isDouble,  setIsDouble]  = useState(true);
  const [idf,       setIdf]       = useState('');

  const padNum = (n, max) => {
    if (!padZeros) return String(n);
    const len = String(max).length;
    return String(n).padStart(len, '0');
  };

  const preview = useMemo(() => {
    const s = parseInt(start);
    const e = parseInt(end);
    if (isNaN(s) || isNaN(e) || s < 1 || e < s || e - s > 499) return null;

    const items = [];
    if (isDouble) {
      for (let i = s; i <= e; i += 2) {
        const a = `${prefix}${padNum(i, e)}`;
        const b = i + 1 <= e ? `${prefix}${padNum(i + 1, e)}` : null;
        items.push({ a, b, double: !!b });
      }
    } else {
      for (let i = s; i <= e; i++) {
        items.push({ a: `${prefix}${padNum(i, e)}`, double: false });
      }
    }
    return items;
  }, [prefix, start, end, padZeros, isDouble]);

  const handleImport = () => {
    if (!preview) return;
    const drops = preview.map(item => ({
      id:         uid(),
      isDouble:   item.double,
      cableA:     item.a,
      cableB:     item.b || '',
      idf:        idf,
      roughPull:  false,
      terminated: false,
      tested:     false,
      notes:      '',
      createdAt:  today(),
    }));
    onImport(drops);
    onClose();
  };

  const count = preview ? preview.length : 0;
  const s = parseInt(start);
  const e = parseInt(end);
  const rangeValid = !isNaN(s) && !isNaN(e) && s >= 1 && e >= s && e - s <= 499;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={st.root}>
        {/* Header */}
        <View style={st.header}>
          <View>
            <Text style={st.title}>Bulk Import</Text>
            <Text style={st.subtitle}>GENERATE MULTIPLE DROPS AT ONCE</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={st.closeBtn}>
            <Text style={st.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 14, gap: 14, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">

          {/* Range inputs */}
          <View style={st.section}>
            <Text style={st.sectionTitle}>CABLE ID RANGE</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={st.label}>PREFIX (optional)</Text>
                <TextInput
                  value={prefix}
                  onChangeText={setPrefix}
                  placeholder="e.g. C- or blank"
                  placeholderTextColor={COLORS.textDim}
                  style={st.input}
                  autoCapitalize="characters"
                />
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={st.label}>START NUMBER</Text>
                <TextInput
                  value={start}
                  onChangeText={setStart}
                  keyboardType="number-pad"
                  style={st.input}
                  placeholder="1"
                  placeholderTextColor={COLORS.textDim}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.label}>END NUMBER</Text>
                <TextInput
                  value={end}
                  onChangeText={setEnd}
                  keyboardType="number-pad"
                  style={st.input}
                  placeholder="120"
                  placeholderTextColor={COLORS.textDim}
                />
              </View>
            </View>
            {!rangeValid && (start !== '' || end !== '') && (
              <Text style={st.errorText}>
                {e - s > 499 ? 'Max 500 drops at once' : 'Enter a valid range (start ≤ end)'}
              </Text>
            )}
          </View>

          {/* Options */}
          <View style={st.section}>
            <Text style={st.sectionTitle}>OPTIONS</Text>

            <View style={st.row}>
              <View>
                <Text style={st.optLabel}>Zero Padding</Text>
                <Text style={st.optHint}>01, 02... instead of 1, 2...</Text>
              </View>
              <Switch
                value={padZeros}
                onValueChange={setPadZeros}
                trackColor={{ false: COLORS.surface2, true: COLORS.blue }}
                thumbColor="#fff"
              />
            </View>

            <View style={[st.row, { marginTop: 12 }]}>
              <View>
                <Text style={st.optLabel}>Default to Double Drops</Text>
                <Text style={st.optHint}>Auto-pairs consecutive IDs (01↔02, 03↔04...)</Text>
              </View>
              <Switch
                value={isDouble}
                onValueChange={setIsDouble}
                trackColor={{ false: COLORS.surface2, true: COLORS.purple }}
                thumbColor="#fff"
              />
            </View>
          </View>

          {/* IDF selector */}
          <View style={st.section}>
            <Text style={st.sectionTitle}>ASSIGN IDF (optional)</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {idfList.map(i => (
                <TouchableOpacity
                  key={i}
                  onPress={() => setIdf(idf === i ? '' : i)}
                  style={[st.idfBtn, idf === i && st.idfBtnActive]}
                >
                  <Text style={[st.idfBtnText, idf === i && { color: COLORS.amber }]}>{i}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Live preview */}
          {preview && rangeValid && (
            <View style={st.section}>
              <Text style={st.sectionTitle}>
                PREVIEW — {count} {count === 1 ? 'DROP' : 'DROPS'} WILL BE CREATED
              </Text>
              <View style={{ gap: 5, maxHeight: 200, overflow: 'hidden' }}>
                {preview.slice(0, 8).map((item, i) => (
                  <View key={i} style={st.previewRow}>
                    {item.double && (
                      <View style={st.doublePill}>
                        <Text style={st.doublePillText}>DBL</Text>
                      </View>
                    )}
                    <Text style={st.previewText}>
                      {item.a}{item.double && item.b ? ` ↔ ${item.b}` : ''}
                    </Text>
                    {idf ? (
                      <Text style={st.previewIdf}>{idf}</Text>
                    ) : null}
                  </View>
                ))}
                {preview.length > 8 && (
                  <Text style={st.previewMore}>...and {preview.length - 8} more</Text>
                )}
              </View>
            </View>
          )}

          {/* Import button */}
          <TouchableOpacity
            style={[st.importBtn, (!preview || !rangeValid) && st.importBtnDisabled]}
            onPress={handleImport}
            disabled={!preview || !rangeValid}
            activeOpacity={0.8}
          >
            <Text style={st.importBtnText}>
              ⬇ IMPORT {count > 0 ? count : ''} DROPS
            </Text>
          </TouchableOpacity>

        </ScrollView>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title:    { fontSize: 18, fontWeight: '800', color: COLORS.text },
  subtitle: { fontSize: 9, fontWeight: '700', color: COLORS.textMuted, letterSpacing: 1.5, marginTop: 2 },
  closeBtn: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    width: 34, height: 34,
    alignItems: 'center', justifyContent: 'center',
  },
  closeBtnText: { color: COLORS.textSub, fontSize: 14, fontWeight: '700' },
  section: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 14,
  },
  sectionTitle: {
    fontSize: 10, fontWeight: '800', letterSpacing: 1,
    color: COLORS.textMuted, marginBottom: 12,
  },
  label: {
    fontSize: 10, fontWeight: '800', letterSpacing: 0.8,
    color: COLORS.textMuted, marginBottom: 5,
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
  errorText: {
    color: COLORS.red,
    fontSize: 11,
    marginTop: 6,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optLabel: { fontSize: 13, fontWeight: '700', color: COLORS.textSub },
  optHint:  { fontSize: 10, color: COLORS.textMuted, marginTop: 2 },
  idfBtn: {
    paddingHorizontal: 11, paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'transparent',
  },
  idfBtnActive: {
    backgroundColor: COLORS.amberDim,
    borderColor: 'rgba(245,158,11,0.5)',
  },
  idfBtnText: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 5,
    padding: 7,
  },
  previewText: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: COLORS.text,
    flex: 1,
  },
  previewIdf: {
    fontSize: 10,
    color: COLORS.amber,
    fontWeight: '700',
  },
  previewMore: {
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingVertical: 4,
  },
  doublePill: {
    backgroundColor: 'rgba(124,58,237,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.4)',
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  doublePillText: { fontSize: 7, fontWeight: '800', color: '#a78bfa', letterSpacing: 0.5 },
  importBtn: {
    backgroundColor: COLORS.blue,
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    shadowColor: COLORS.blue,
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 6,
  },
  importBtnDisabled: {
    backgroundColor: COLORS.surface2,
    shadowOpacity: 0,
    elevation: 0,
  },
  importBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.5,
  },
});
