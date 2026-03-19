import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  FlatList, StyleSheet, Alert, Modal, ScrollView,
} from 'react-native';
import { COLORS, DEFAULT_IDFS } from '../theme';
import { uid, today } from '../utils';
import ProjectCard from '../components/ProjectCard';

const emptyProject = (name) => ({
  id:        uid(),
  name:      name.trim(),
  status:    'active',
  createdAt: today(),
  drops:     [],
  idfList:   [...DEFAULT_IDFS],
});

export default function ProjectsScreen({ projects, setProjects, onOpenProject }) {
  const [showNew,     setShowNew]     = useState(false);
  const [newName,     setNewName]     = useState('');
  const [showArchived, setShowArchived] = useState(false);

  const activeProjects   = projects.filter(p => p.status === 'active');
  const archivedProjects = projects.filter(p => p.status === 'archived');

  const createProject = () => {
    const name = newName.trim();
    if (!name) return;
    if (projects.some(p => p.name.toLowerCase() === name.toLowerCase())) {
      Alert.alert('Name taken', 'A project with that name already exists.');
      return;
    }
    setProjects([emptyProject(name), ...projects]);
    setNewName('');
    setShowNew(false);
  };

  const archiveProject = (id) => {
    Alert.alert(
      'Archive Project',
      'Archive this project? You can restore it later from the Archived section.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Archive', onPress: () =>
          setProjects(projects.map(p => p.id === id ? { ...p, status: 'archived' } : p))
        },
      ]
    );
  };

  const unarchiveProject = (id) => {
    setProjects(projects.map(p => p.id === id ? { ...p, status: 'active' } : p));
  };

  const deleteProject = (id) => {
    const proj = projects.find(p => p.id === id);
    Alert.alert(
      '⚠️ Delete Project',
      `Permanently delete "${proj?.name}" and all ${proj?.drops.length} drops? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () =>
          setProjects(projects.filter(p => p.id !== id))
        },
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 22 }}>🔌</Text>
            <View>
              <Text style={s.title}>CablePull</Text>
              <Text style={s.subtitle}>FIELD TRACKER</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity style={s.newBtn} onPress={() => setShowNew(true)} activeOpacity={0.8}>
          <Text style={s.newBtnText}>+ New Project</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={activeProjects}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          activeProjects.length > 0 ? (
            <Text style={s.sectionLabel}>ACTIVE PROJECTS — {activeProjects.length}</Text>
          ) : null
        }
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={{ fontSize: 48 }}>🏗</Text>
            <Text style={s.emptyTitle}>No projects yet</Text>
            <Text style={s.emptyHint}>Tap "+ New Project" to create your first job site</Text>
            <TouchableOpacity style={s.emptyBtn} onPress={() => setShowNew(true)}>
              <Text style={s.emptyBtnText}>+ Create Project</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <ProjectCard
            project={item}
            onOpen={onOpenProject}
            onArchive={archiveProject}
            onUnarchive={unarchiveProject}
            onDelete={deleteProject}
          />
        )}
        ListFooterComponent={
          archivedProjects.length > 0 ? (
            <View style={{ marginTop: 8 }}>
              <TouchableOpacity
                onPress={() => setShowArchived(v => !v)}
                style={s.archivedToggle}
              >
                <Text style={s.archivedToggleText}>
                  {showArchived ? '▴' : '▾'}  ARCHIVED PROJECTS ({archivedProjects.length})
                </Text>
              </TouchableOpacity>
              {showArchived && archivedProjects.map(item => (
                <ProjectCard
                  key={item.id}
                  project={item}
                  onOpen={onOpenProject}
                  onArchive={archiveProject}
                  onUnarchive={unarchiveProject}
                  onDelete={deleteProject}
                />
              ))}
            </View>
          ) : null
        }
      />

      {/* New Project Modal */}
      <Modal
        visible={showNew}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNew(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>New Project</Text>
            <Text style={s.modalHint}>Enter a name for this job site or project.</Text>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              placeholder="e.g. Walmart Remodel, School Dist. B3"
              placeholderTextColor={COLORS.textDim}
              style={s.modalInput}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={createProject}
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                style={[s.modalBtn, s.modalCancel]}
                onPress={() => { setShowNew(false); setNewName(''); }}
              >
                <Text style={{ color: COLORS.textMuted, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalBtn, s.modalCreate, !newName.trim() && { opacity: 0.4 }]}
                onPress={createProject}
                disabled={!newName.trim()}
              >
                <Text style={{ color: '#fff', fontWeight: '800' }}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title:    { fontSize: 18, fontWeight: '800', color: COLORS.text, letterSpacing: -0.3 },
  subtitle: { fontSize: 9,  fontWeight: '700', color: COLORS.textMuted, letterSpacing: 1.5 },
  newBtn: {
    backgroundColor: COLORS.blueDim,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.4)',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  newBtnText: { color: COLORS.blue, fontWeight: '800', fontSize: 13 },
  sectionLabel: {
    fontSize: 10, fontWeight: '800', letterSpacing: 1,
    color: COLORS.textMuted, marginBottom: 12,
  },
  empty: {
    alignItems: 'center', paddingTop: 80, gap: 10,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textDim },
  emptyHint:  { fontSize: 12, color: COLORS.textDim, textAlign: 'center', paddingHorizontal: 40 },
  emptyBtn: {
    marginTop: 8,
    backgroundColor: COLORS.blue,
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  emptyBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  archivedToggle: {
    padding: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 10,
  },
  archivedToggleText: {
    fontSize: 11, fontWeight: '800', color: COLORS.textMuted, letterSpacing: 0.8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalBox: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 20,
    width: '100%',
    borderWidth: 1,
    borderColor: COLORS.borderHi,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text, marginBottom: 6 },
  modalHint:  { fontSize: 12, color: COLORS.textMuted, marginBottom: 14 },
  modalInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    color: COLORS.text,
    fontSize: 14,
  },
  modalBtn: {
    flex: 1, padding: 12, borderRadius: 8, alignItems: 'center',
  },
  modalCancel: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: COLORS.border,
  },
  modalCreate: {
    backgroundColor: COLORS.blue,
  },
});
