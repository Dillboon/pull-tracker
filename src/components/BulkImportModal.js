import React, { useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert
} from 'react-native';
import { COLORS } from '../theme';
import { uid, today } from '../utils';

const GROUP_TYPES = ['single', 'double', 'triple', 'quad'];

export default function BulkImportModal({ visible, onClose, onImport, idfList }) {
  const [importMode, setImportMode] = useState('text'); // 'text' or 'range'
  const [groupType, setGroupType] = useState('single');
  const [selectedIdf, setSelectedIdf] = useState('');
  
  // Text input mode states
  const [textInput, setTextInput] = useState('');
  
  // Range generator mode states
  const [prefix, setPrefix] = useState('');
  const [startNum, setStartNum] = useState('');
  const [endNum, setEndNum] = useState('');
  const [padWidth, setPadWidth] = useState('3'); // e.g., 001, 002

  const handleImport = () => {
    let cableIds = [];

    if (importMode === 'text') {
      // Parse text input split by commas, newlines, tabs, or spaces
      cableIds = textInput
        .split(/[\n,\t ]+/)
        .map(id => id.trim().toUpperCase())
        .filter(Boolean);

      if (cableIds.length === 0) {
        Alert.alert('Error', 'Please enter or paste some cable IDs.');
        return;
      }
    } else {
      // Sequential range generation
      const start = parseInt(startNum, 10);
      const end = parseInt(endNum, 10);
      const pad = parseInt(padWidth, 10) || 0;

      if (isNaN(start) || isNaN(end) || start > end) {
        Alert.alert('Error', 'Please enter a valid starting and ending numeric range.');
        return;
      }

      for (let i = start; i <= end; i++) {
        const numString = pad > 0 ? String(i).padStart(pad, '0') : String(i);
        cableIds.push(`${prefix.toUpperCase()}${numString}`);
      }
    }

    // Determine target chunk size based on group type configuration
    let chunkSize = 1;
    if (groupType === 'double') chunkSize = 2;
    if (groupType === 'triple') chunkSize = 3;
    if (groupType === 'quad')   chunkSize = 4;

    const newDrops = [];
    
    // Chunk parsed cable IDs into single, double, triple, or quad drops
    for (let i = 0; i < cableIds.length; i += chunkSize) {
      const chunk = cableIds.slice(i, i + chunkSize);
      
      newDrops.push({
        id: uid(),
        groupType: groupType,
        isDouble: groupType === 'double', // maintain retro-compatibility for context rules
        cableA: chunk[0] || '',
        cableB: chunk[1] || '',
        cableC: chunk[2] || '',
        cableD: chunk[3] || '',
        idf: selectedIdf,
        roughPull: false,
        terminated: false,
        tested: false,
        patchedA: false,
        patchedB: false,
        patchedC: false,
        patchedD: false,
        notes: '',
        attention: false,
        createdAt: today(),
      });
    }

    onImport(newDrops);
    resetForm();
    onClose();
  };

  const resetForm = () => {
    setTextInput('');
    setPrefix('');
    setStartNum('');
    setEndNum('');
    setSelectedIdf('');
    setGroupType('single');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.modalContainer}>
          
          {/* Header */}
          <View style={s.header}>
            <Text style={s.headerTitle}>BULK IMPORT DROPS</Text>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Text style={s.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled">
            
            {/* Mode Switcher */}
            <View style={s.tabRow}>
              <TouchableOpacity 
                style={[s.tab, importMode === 'text' && s.tabActive]} 
                onPress={() => setImportMode('text')}
              >
                <Text style={[s.tabText, importMode === 'text' && s.tabTextActive]}>📋 PASTE LIST</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[s.tab, importMode === 'range' && s.tabActive]} 
                onPress={() => setImportMode('range')}
              >
                <Text style={[s.tabText, importMode === 'range' && s.tabTextActive]}>🔢 GENERATE RANGE</Text>
              </TouchableOpacity>
            </View>

            {/* Drop Configuration Type */}
            <View style={s.section}>
              <Text style={s.fieldLabel}>BUNDLE TYPE</Text>
              <View style={s.typeRow}>
                {GROUP_TYPES.map(type => (
                  <TouchableOpacity
                    key={type}
                    style={[s.typeBtn, groupType === type && {
                      backgroundColor:
                        type === 'double' ? 'rgba(124,58,237,0.18)' :
                        type === 'triple' ? 'rgba(13,148,136,0.18)' :
                        type === 'quad'   ? 'rgba(249,115,22,0.18)' :
                        'rgba(59,130,246,0.15)',
                      borderColor:
                        type === 'double' ? 'rgba(124,58,237,0.4)' :
                        type === 'triple' ? 'rgba(13,148,136,0.4)' :
                        type === 'quad'   ? 'rgba(249,115,22,0.4)' :
                        'rgba(59,130,246,0.4)',
                    }]}
                    onPress={() => setGroupType(type)}
                  >
                    <Text style={[s.typeBtnText, groupType === type && {
                      color:
                        type === 'double' ? '#a78bfa' :
                        type === 'triple' ? '#2dd4bf' :
                        type === 'quad'   ? '#fb923c' :
                        '#60a5fa',
                    }]}>
                      {type.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* IDF Closet Selection */}
            {idfList && idfList.length > 0 && (
              <View style={s.section}>
                <Text style={s.fieldLabel}>ASSIGN TO IDF CLOSET</Text>
                <View style={s.idfRow}>
                  {idfList.map(idf => (
                    <TouchableOpacity
                      key={idf}
                      onPress={() => setSelectedIdf(selectedIdf === idf ? '' : idf)}
                      style={[s.idfBtn, selectedIdf === idf && s.idfBtnActive]}
                    >
                      <Text style={[s.idfBtnText, selectedIdf === idf && { color: COLORS.amber }]}>
                        {idf}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Conditional Input UI Panel */}
            {importMode === 'text' ? (
              <View style={s.section}>
                <Text style={s.fieldLabel}>PASTE CABLE IDS</Text>
                <Text style={s.hintText}>
                  Separated by spaces, commas, or newlines. {groupType !== 'single' && `Every ${chunkSize} IDs will automatically be grouped into a single ${groupType} card.`}
                </Text>
                <TextInput
                  value={textInput}
                  onChangeText={setTextInput}
                  placeholder={
                    groupType === 'triple' ? "C-001 C-002 C-003\nC-004 C-005 C-006" :
                    groupType === 'quad' ? "C-001, C-002, C-003, C-004" :
                    "C-001\nC-002\nC-003"
                  }
                  placeholderTextColor={COLORS.textDim}
                  multiline
                  style={[s.input, s.textArea]}
                  autoCapitalize="characters"
                />
              </View>
            ) : (
              <View style={s.section}>
                <Text style={s.fieldLabel}>RANGE SETTINGS</Text>
                
                <View style={s.row}>
                  <View style={{ flex: 2 }}>
                    <Text style={s.subLabel}>Prefix</Text>
                    <TextInput
                      value={prefix}
                      onChangeText={setPrefix}
                      placeholder="e.g. C-"
                      placeholderTextColor={COLORS.textDim}
                      style={s.input}
                      autoCapitalize="characters"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.subLabel}>Zero Pad</Text>
                    <TextInput
                      value={padWidth}
                      onChangeText={setPadWidth}
                      placeholder="3"
                      keyboardType="numeric"
                      placeholderTextColor={COLORS.textDim}
                      style={[s.input, { textAlign: 'center' }]}
                    />
                  </View>
                </View>

                <View style={[s.row, { marginTop: 10 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.subLabel}>Start Number</Text>
                    <TextInput
                      value={startNum}
                      onChangeText={setStartNum}
                      placeholder="1"
                      keyboardType="numeric"
                      placeholderTextColor={COLORS.textDim}
                      style={s.input}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.subLabel}>End Number</Text>
                    <TextInput
                      value={endNum}
                      onChangeText={setEndNum}
                      placeholder="48"
                      keyboardType="numeric"
                      placeholderTextColor={COLORS.textDim}
                      style={s.input}
                    />
                  </View>
                </View>
                <Text style={[s.hintText, { marginTop: 10 }]}>
                  Generates sequential IDs. {groupType !== 'single' && `Groups consecutive sequences into blocks of ${chunkSize} per card.`}
                </Text>
              </View>
            )}

          </ScrollView>

          {/* Action Footer Button */}
          <View style={s.footer}>
            <TouchableOpacity style={s.importBtn} onPress={handleImport}>
              <Text style={s.importBtnText}>⬇ IMPORT CONFIGURATION</Text>
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#161b22',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.borderHi,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: 1,
  },
  closeBtn: {
    padding: 4,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 6,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    gap: 20,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 8,
    padding: 3,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 6,
  },
  tabActive: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  tabText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  tabTextActive: {
    color: COLORS.text,
  },
  section: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    color: COLORS.textMuted,
  },
  subLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textDim,
    marginBottom: 4,
  },
  hintText: {
    fontSize: 11,
    color: COLORS.textDim,
    lineHeight: 15,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  typeBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 0.5,
  },
  idfRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  idfBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
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
  },
  row: {
    flexDirection: 'row',
    gap: 10,
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
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  importBtn: {
    backgroundColor: '#16a34a',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  importBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.6,
  },
});