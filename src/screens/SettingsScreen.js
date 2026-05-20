import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, Alert, StyleSheet, Modal,
} from 'react-native';
import { COLORS } from '../theme';

export default function SettingsScreen({
  drops, devices, idfList, deviceTypeList,
  updateIdfs, updateDeviceTypeList, clearAllDrops, clearAllDevices,
  project, setProjects, projects,
}) {
  const [newIdf,        setNewIdf]        = useState('');
  const [newType,       setNewType]       = useState('');
  const [editName,      setEditName]      = useState(project.name);
  const [nameEditing,   setNameEditing]   = useState(false);
  const [editingType,   setEditingType]   = useState(null); // { index, value }
  const isArchived = project.status === 'archived';

  // ── IDF helpers ───────────────────────────────────────────────────────────
  const addIdf = () => {
    const val = newIdf.trim().toUpperCase();
    if (!val) return;
    if (idfList.includes(val)) { Alert.alert('Already exists', `"${val}" is in the list.`); return; }
    updateIdfs([...idfList, val]);
    setNewIdf('');
  };

  const removeIdf = (idf) => {
    const dropUses   = drops.filter(d => d.idf === idf).length;
    const deviceUses = devices.filter(d => d.idf === idf).length;
    const uses = dropUses + deviceUses;
    if (uses > 0) {
      Alert.alert('Cannot Remove', `"${idf}" is assigned to ${uses} item(s). Reassign them first.`);
      return;
    }
    Alert.alert('Remove IDF', `Remove "${idf}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => updateIdfs(idfList.filter(i => i !== idf)) },
    ]);
  };

  // ── Device type helpers ───────────────────────────────────────────────────
  const addDeviceType = () => {
    const val = newType.trim();
    if (!val) return;
    if (deviceTypeList.includes(val)) { Alert.alert('Already exists', `"${val}" is in the list.`); return; }
    updateDeviceTypeList([...deviceTypeList, val]);
    setNewType('');
  };

  const removeDeviceType = (type) => {
    const uses = devices.filter(d => d.deviceType === type).length;
    if (uses > 0) {
      Alert.alert('Cannot Remove', `"${type}" is assigned to ${uses} device(s). Reassign them first.`);
      return;
    }
    Alert.alert('Remove Type', `Remove "${type}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => updateDeviceTypeList(deviceTypeList.filter(t => t !== type)) },
    ]);
  };

  const saveEditType = () => {
    if (!editingType) return;
    const newVal = editingType.value.trim();
    if (!newVal) { setEditingType(null); return; }
    if (deviceTypeList.some((t, i) => i !== editingType.index && t.toLowerCase() === newVal.toLowerCase())) {
      Alert.alert('Already exists', `"${newVal}" is already in the list.`);
      return;
    }
    const next = deviceTypeList.map((t, i) => i === editingType.index ? newVal : t);
    // Also update any devices using the old type
    setProjects(projects.map(p => p.id === project.id ? {
      ...p,
      deviceTypeList: next,
      devices: p.devices.map(d => d.deviceType === deviceTypeList[editingType.index] ? { ...d, deviceType: newVal } : d),
    } : p));
    setEditingType(null);
  };

  // ── Project name ──────────────────────────────────────────────────────────
  const handleRename = () => {
    const name = editName.trim();
    if (!name || name === project.name) { setNameEditing(false); return; }
    if (projects.some(p => p.id !== project.id && p.name.toLowerCase() === name.toLowerCase())) {
      Alert.alert('Name taken', 'Another project already has that name.');
      return;
    }
    setProjects(projects.map(p => p.id === project.id ? { ...p, name } : p));
    setNameEditing(false);
  };

  const handleArchive = () => {
    Alert.alert('Archive Project', `Archive "${project.name}"? You can restore it later.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Archive', onPress: () =>
        setProjects(projects.map(p => p.id === project.id ? { ...p, status: 'archived' } : p))
      },
    ]);
  };

  const handleUnarchive = () => {
    setProjects(projects.map(p => p.id === project.id ? { ...p, status: 'active' } : p));
  };

  const handleDeleteProject = () => {
    Alert.alert('⚠️ Delete Project',
      `Permanently delete "${project.name}", ${drops.length} drops, and ${devices.length} devices?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete Project', style: 'destructive',
          onPress: () => setProjects(projects.filter(p => p.id !== project.id))
        },
      ]
    );
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: COLORS.bg }}
      contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={s.screenTitle}>Project Settings</Text>

      {/* ── Project name ── */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>PROJECT NAME</Text>
        {nameEditing ? (
          <View style={{ gap: 8 }}>
            <TextInput value={editName} onChangeText={setEditName} style={s.input}
              autoFocus returnKeyType="done" onSubmitEditing={handleRename} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={[s.btn, s.cancelBtn, { flex: 1 }]}
                onPress={() => { setEditName(project.name); setNameEditing(false); }}>
                <Text style={{ color: COLORS.textMuted, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, s.saveBtn, { flex: 1 }]} onPress={handleRename}>
                <Text style={{ color: COLORS.blue, fontWeight: '700' }}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.text, flex: 1 }}>{project.name}</Text>
            {!isArchived && (
              <TouchableOpacity style={[s.btn, s.cancelBtn]} onPress={() => setNameEditing(true)}>
                <Text style={{ color: COLORS.textSub, fontWeight: '700', fontSize: 12 }}>✏ Rename</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        <Text style={s.hint}>Created {project.createdAt}</Text>
      </View>

      {/* ── IDF Closets ── */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>IDF CLOSETS</Text>
        <Text style={s.hint}>Used by both cable drops and devices in this project.</Text>
        {idfList.map(idf => {
          const dropCount   = drops.filter(d => d.idf === idf).length;
          const deviceCount = devices.filter(d => d.idf === idf).length;
          return (
            <View key={idf} style={s.listRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.listName}>{idf}</Text>
                {(dropCount > 0 || deviceCount > 0) && (
                  <Text style={s.listCount}>
                    {[dropCount > 0 && `${dropCount} drop${dropCount !== 1 ? 's' : ''}`,
                      deviceCount > 0 && `${deviceCount} device${deviceCount !== 1 ? 's' : ''}`
                    ].filter(Boolean).join('  ·  ')}
                  </Text>
                )}
              </View>
              {!isArchived && (
                <TouchableOpacity onPress={() => removeIdf(idf)} style={s.removeBtn}>
                  <Text style={s.removeBtnText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
        {!isArchived && (
          <View style={s.addRow}>
            <TextInput value={newIdf} onChangeText={t => setNewIdf(t.toUpperCase())}
              placeholder="e.g. IDF-9" placeholderTextColor={COLORS.textDim}
              style={[s.input, { flex: 1 }]} autoCapitalize="characters"
              returnKeyType="done" onSubmitEditing={addIdf} />
            <TouchableOpacity style={s.addBtn} onPress={addIdf}>
              <Text style={s.addBtnText}>+ Add</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ── Device Types ── */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>DEVICE TYPES</Text>
        <Text style={s.hint}>Types available when adding devices to this project. Tap to rename.</Text>
        {deviceTypeList.map((type, index) => {
          const count = devices.filter(d => d.deviceType === type).length;
          return (
            <View key={type} style={s.listRow}>
              <TouchableOpacity
                style={{ flex: 1 }}
                onPress={() => !isArchived && setEditingType({ index, value: type })}
                activeOpacity={isArchived ? 1 : 0.6}
              >
                <Text style={[s.listName, { color: COLORS.teal }]}>{type}</Text>
                {count > 0 && (
                  <Text style={s.listCount}>{count} device{count !== 1 ? 's' : ''} assigned</Text>
                )}
              </TouchableOpacity>
              {!isArchived && (
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TouchableOpacity
                    onPress={() => setEditingType({ index, value: type })}
                    style={[s.removeBtn, { borderColor: 'rgba(20,184,166,0.3)', backgroundColor: COLORS.tealDim }]}
                  >
                    <Text style={{ color: COLORS.teal, fontSize: 11, fontWeight: '700' }}>✏</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => removeDeviceType(type)} style={s.removeBtn}>
                    <Text style={s.removeBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}
        {!isArchived && (
          <View style={s.addRow}>
            <TextInput value={newType} onChangeText={setNewType}
              placeholder="e.g. Gate Controller" placeholderTextColor={COLORS.textDim}
              style={[s.input, { flex: 1 }]}
              returnKeyType="done" onSubmitEditing={addDeviceType} />
            <TouchableOpacity
              style={[s.addBtn, { backgroundColor: COLORS.tealDim, borderColor: 'rgba(20,184,166,0.5)' }]}
              onPress={addDeviceType}
            >
              <Text style={[s.addBtnText, { color: COLORS.teal }]}>+ Add</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ── Project info ── */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>PROJECT INFO</Text>
        {[
          ['Total Drops',   String(drops.length)],
          ['Total Devices', String(devices.length)],
          ['IDF Closets',   String(idfList.length)],
          ['Device Types',  String(deviceTypeList.length)],
          ['Status',        isArchived ? 'Archived' : 'Active'],
          ['Created',       project.createdAt],
        ].map(([k, v]) => (
          <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text style={{ color: COLORS.textMuted, fontSize: 13 }}>{k}</Text>
            <Text style={{ color: COLORS.textSub, fontSize: 13, fontWeight: '600' }}>{v}</Text>
          </View>
        ))}
      </View>

      {/* ── Archive / Restore ── */}
      {!isArchived ? (
        <View style={s.section}>
          <Text style={s.sectionTitle}>ARCHIVE PROJECT</Text>
          <TouchableOpacity onPress={handleArchive} style={[s.btn, s.archiveBtn]}>
            <Text style={{ color: COLORS.textSub, fontWeight: '800', fontSize: 13 }}>📦  ARCHIVE THIS PROJECT</Text>
          </TouchableOpacity>
          <Text style={s.hint}>Hides the project from the active list. All data is preserved.</Text>
        </View>
      ) : (
        <View style={s.section}>
          <Text style={s.sectionTitle}>RESTORE PROJECT</Text>
          <TouchableOpacity onPress={handleUnarchive} style={[s.btn, s.restoreBtn]}>
            <Text style={{ color: COLORS.green, fontWeight: '800', fontSize: 13 }}>↩  RESTORE TO ACTIVE</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Danger zone ── */}
      <View style={[s.section, { borderColor: 'rgba(239,68,68,0.25)' }]}>
        <Text style={[s.sectionTitle, { color: '#f87171' }]}>DANGER ZONE</Text>
        {!isArchived && (
          <>
            <TouchableOpacity
              onPress={() => Alert.alert('Clear All Drops',
                `Delete all ${drops.length} drops?`,
                [{ text: 'Cancel', style: 'cancel' },
                 { text: 'Delete', style: 'destructive', onPress: clearAllDrops }])}
              style={[s.btn, s.dangerBtn, { marginBottom: 8 }]}
              disabled={drops.length === 0}
            >
              <Text style={s.dangerText}>🗑  CLEAR ALL DROPS ({drops.length})</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => Alert.alert('Clear All Devices',
                `Delete all ${devices.length} devices?`,
                [{ text: 'Cancel', style: 'cancel' },
                 { text: 'Delete', style: 'destructive', onPress: clearAllDevices }])}
              style={[s.btn, s.dangerBtn, { marginBottom: 8 }]}
              disabled={devices.length === 0}
            >
              <Text style={s.dangerText}>🗑  CLEAR ALL DEVICES ({devices.length})</Text>
            </TouchableOpacity>
          </>
        )}
        <TouchableOpacity onPress={handleDeleteProject} style={[s.btn, s.dangerBtn]}>
          <Text style={s.dangerText}>✕  DELETE ENTIRE PROJECT</Text>
        </TouchableOpacity>
        <Text style={s.hint}>Deleting permanently removes all drops, devices, and cannot be undone.</Text>
      </View>

      {/* ── Rename device type modal ── */}
      <Modal
        visible={!!editingType}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingType(null)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>Rename Device Type</Text>
            <TextInput
              value={editingType?.value || ''}
              onChangeText={v => setEditingType(e => ({ ...e, value: v }))}
              style={s.input}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={saveEditType}
            />
            <Text style={s.hint}>All devices using this type will be updated automatically.</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <TouchableOpacity style={[s.btn, s.cancelBtn, { flex: 1 }]} onPress={() => setEditingType(null)}>
                <Text style={{ color: COLORS.textMuted, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, s.saveBtn, { flex: 1, backgroundColor: COLORS.tealDim, borderColor: 'rgba(20,184,166,0.4)' }]} onPress={saveEditType}>
                <Text style={{ color: COLORS.teal, fontWeight: '700' }}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screenTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text, marginBottom: 14, letterSpacing: -0.3 },
  section: {
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 10, padding: 14, marginBottom: 14, gap: 10,
  },
  sectionTitle: { fontSize: 10, fontWeight: '800', letterSpacing: 1, color: COLORS.textMuted },
  hint:    { fontSize: 11, color: COLORS.textDim },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 7, padding: 10, color: COLORS.text, fontSize: 13, fontFamily: 'monospace',
  },
  btn: { padding: 11, borderRadius: 8, alignItems: 'center', borderWidth: 1 },
  cancelBtn:  { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: COLORS.border },
  saveBtn:    { backgroundColor: COLORS.blueDim, borderColor: 'rgba(59,130,246,0.4)' },
  archiveBtn: { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: COLORS.border },
  restoreBtn: { backgroundColor: COLORS.greenDim, borderColor: 'rgba(34,197,94,0.3)' },
  dangerBtn:  { backgroundColor: COLORS.redDim, borderColor: 'rgba(239,68,68,0.3)' },
  dangerText: { color: '#f87171', fontWeight: '800', fontSize: 13, letterSpacing: 0.5 },
  listRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  listName:  { fontSize: 14, fontWeight: '700', color: COLORS.textSub, fontFamily: 'monospace' },
  listCount: { fontSize: 10, color: COLORS.textMuted, marginTop: 2 },
  removeBtn: {
    backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)', borderRadius: 5,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  removeBtnText: { color: '#f87171', fontSize: 12, fontWeight: '700' },
  addRow:   { flexDirection: 'row', gap: 8, marginTop: 4 },
  addBtn:   { backgroundColor: COLORS.amberDim, borderWidth: 1, borderColor: 'rgba(245,158,11,0.5)', borderRadius: 7, paddingHorizontal: 16, justifyContent: 'center' },
  addBtnText: { color: COLORS.amber, fontWeight: '800', fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalBox: { backgroundColor: COLORS.surface, borderRadius: 14, padding: 20, width: '100%', borderWidth: 1, borderColor: COLORS.borderHi, gap: 12 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text },
});
