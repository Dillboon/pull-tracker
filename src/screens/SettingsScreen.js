import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, Alert, StyleSheet,
} from 'react-native';
import { COLORS } from '../theme';

export default function SettingsScreen({
  drops, idfList, updateIdfs, clearAllDrops,
  project, setProjects, projects,
}) {
  const [newIdf,      setNewIdf]      = useState('');
  const [editName,    setEditName]    = useState(project.name);
  const [nameEditing, setNameEditing] = useState(false);
  const isArchived = project.status === 'archived';

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
    Alert.alert('Remove IDF', `Remove "${idf}" from this project?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => updateIdfs(idfList.filter(i => i !== idf)) },
    ]);
  };

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
    Alert.alert(
      'Archive Project',
      `Archive "${project.name}"? You can restore it later from the projects screen.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Archive', onPress: () =>
          setProjects(projects.map(p => p.id === project.id ? { ...p, status: 'archived' } : p))
        },
      ]
    );
  };

  const handleUnarchive = () => {
    setProjects(projects.map(p => p.id === project.id ? { ...p, status: 'active' } : p));
  };

  const handleClearAll = () => {
    Alert.alert(
      '⚠️ Clear All Drops',
      `Delete all ${drops.length} drops in "${project.name}"? Cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: `Delete All (${drops.length})`, style: 'destructive', onPress: clearAllDrops },
      ]
    );
  };

  const handleDeleteProject = () => {
    Alert.alert(
      '⚠️ Delete Project',
      `Permanently delete "${project.name}" and all ${drops.length} drops? Cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete Project', style: 'destructive', onPress: () =>
          setProjects(projects.filter(p => p.id !== project.id))
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

      {/* Project name */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>PROJECT NAME</Text>
        {nameEditing ? (
          <View style={{ gap: 8 }}>
            <TextInput
              value={editName}
              onChangeText={setEditName}
              style={s.input}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleRename}
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                style={[s.btn, { flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderColor: COLORS.border }]}
                onPress={() => { setEditName(project.name); setNameEditing(false); }}
              >
                <Text style={{ color: COLORS.textMuted, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.btn, { flex: 1, backgroundColor: COLORS.blueDim, borderColor: 'rgba(59,130,246,0.4)' }]}
                onPress={handleRename}
              >
                <Text style={{ color: COLORS.blue, fontWeight: '700' }}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.text, flex: 1 }}>{project.name}</Text>
            {!isArchived && (
              <TouchableOpacity
                style={[s.btn, { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: COLORS.border }]}
                onPress={() => setNameEditing(true)}
              >
                <Text style={{ color: COLORS.textSub, fontWeight: '700', fontSize: 12 }}>✏ Rename</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        <Text style={s.hint}>Created {project.createdAt}</Text>
      </View>

      {/* IDF Closets */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>IDF CLOSETS</Text>
        <Text style={s.hint}>These IDF closets belong to this project only.</Text>
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
            <TouchableOpacity style={s.addBtn} onPress={addIdf}>
              <Text style={s.addBtnText}>+ Add</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Project info */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>PROJECT INFO</Text>
        {[
          ['Total Drops',  String(drops.length)],
          ['Single Drops', String(drops.filter(d => (d.groupType || (d.isDouble ? 'double' : 'single')) === 'single').length)],
		  ['Double Drops', String(drops.filter(d => (d.groupType || (d.isDouble ? 'double' : 'single')) === 'double').length)],
		  ['Triple Drops', String(drops.filter(d => (d.groupType || (d.isDouble ? 'double' : 'single')) === 'triple').length)],
		  ['Quad Drops',   String(drops.filter(d => (d.groupType || (d.isDouble ? 'double' : 'single')) === 'quad').length)],
          ['IDF Closets',  String(idfList.length)],
          ['Status',       isArchived ? 'Archived' : 'Active'],
          ['Created',      project.createdAt],
        ].map(([k, v]) => (
          <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text style={{ color: COLORS.textMuted, fontSize: 13 }}>{k}</Text>
            <Text style={{ color: COLORS.textSub, fontSize: 13, fontWeight: '600' }}>{v}</Text>
          </View>
        ))}
      </View>

      {/* Archive / Restore */}
      {!isArchived ? (
        <View style={s.section}>
          <Text style={s.sectionTitle}>ARCHIVE PROJECT</Text>
          <TouchableOpacity onPress={handleArchive} style={[s.btn, s.archiveBtn]}>
            <Text style={{ color: COLORS.textSub, fontWeight: '800', fontSize: 13 }}>
              📦  ARCHIVE THIS PROJECT
            </Text>
          </TouchableOpacity>
          <Text style={s.hint}>
            Hides this project from the active list. All data is preserved and can be restored at any time.
          </Text>
        </View>
      ) : (
        <View style={s.section}>
          <Text style={s.sectionTitle}>RESTORE PROJECT</Text>
          <TouchableOpacity onPress={handleUnarchive} style={[s.btn, s.restoreBtn]}>
            <Text style={{ color: COLORS.green, fontWeight: '800', fontSize: 13 }}>
              ↩  RESTORE TO ACTIVE
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Danger zone */}
      <View style={[s.section, { borderColor: 'rgba(239,68,68,0.25)' }]}>
        <Text style={[s.sectionTitle, { color: '#f87171' }]}>DANGER ZONE</Text>
        {!isArchived && (
          <TouchableOpacity
            onPress={handleClearAll}
            style={[s.btn, s.dangerBtn, { marginBottom: 10 }]}
            disabled={drops.length === 0}
          >
            <Text style={s.dangerText}>🗑  CLEAR ALL DROPS ({drops.length})</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={handleDeleteProject} style={[s.btn, s.dangerBtn]}>
          <Text style={s.dangerText}>✕  DELETE ENTIRE PROJECT</Text>
        </TouchableOpacity>
        <Text style={s.hint}>Permanently deletes the project and all its drops. Cannot be undone.</Text>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screenTitle: {
    fontSize: 22, fontWeight: '800', color: COLORS.text, marginBottom: 14, letterSpacing: -0.3,
  },
  section: {
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 10, padding: 14, marginBottom: 14, gap: 10,
  },
  sectionTitle: { fontSize: 10, fontWeight: '800', letterSpacing: 1, color: COLORS.textMuted },
  hint: { fontSize: 11, color: COLORS.textDim },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 7, padding: 10, color: COLORS.text, fontSize: 13, fontFamily: 'monospace',
  },
  btn: { padding: 11, borderRadius: 8, alignItems: 'center', borderWidth: 1 },
  idfRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  idfName:      { fontSize: 14, fontWeight: '700', color: COLORS.textSub, fontFamily: 'monospace' },
  idfCount:     { fontSize: 10, color: COLORS.textMuted, marginTop: 2 },
  removeBtn:    { backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)', borderRadius: 5, paddingHorizontal: 10, paddingVertical: 4 },
  removeBtnText:{ color: '#f87171', fontSize: 12, fontWeight: '700' },
  addRow:       { flexDirection: 'row', gap: 8, marginTop: 4 },
  addBtn:       { backgroundColor: COLORS.amberDim, borderWidth: 1, borderColor: 'rgba(245,158,11,0.5)', borderRadius: 7, paddingHorizontal: 16, justifyContent: 'center' },
  addBtnText:   { color: COLORS.amber, fontWeight: '800', fontSize: 13 },
  archiveBtn:   { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: COLORS.border },
  restoreBtn:   { backgroundColor: COLORS.greenDim, borderColor: 'rgba(34,197,94,0.3)' },
  dangerBtn:    { backgroundColor: COLORS.redDim, borderColor: 'rgba(239,68,68,0.3)' },
  dangerText:   { color: '#f87171', fontWeight: '800', fontSize: 13, letterSpacing: 0.5 },
});
