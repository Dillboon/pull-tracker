import 'react-native-gesture-handler';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, SafeAreaView, TouchableOpacity, Text, StyleSheet, Modal, TextInput, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as Sharing    from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import ProjectsScreen  from './src/screens/ProjectsScreen';
import DropsScreen     from './src/screens/DropsScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import SettingsScreen  from './src/screens/SettingsScreen';
import GalleryScreen   from './src/screens/GalleryScreen';
import TabBar          from './src/components/TabBar';
import Toast           from './src/components/Toast';
import { COLORS }      from './src/theme';
import { emptyDrop, today } from './src/utils';

export default function App() {
  const [projects,       setProjectsState] = useState([]);
  const [groups,         setGroupsState]   = useState([]);   // ← new
  const [activeProject,  setActiveProject] = useState(null);
  const [activeTab,      setActiveTab]     = useState('drops');
  const [loaded,         setLoaded]        = useState(false);
  const [toast,          setToast]         = useState(null);
  const toastTimer      = useRef(null);
  const pendingDelete   = useRef(null);
  const persistTimer    = useRef(null);
  const persistGrpTimer = useRef(null);    // ← new

  // Custom drop types configuration state
  const [showCustomTypesModal, setShowCustomTypesModal] = useState(false);
  const [customTypesInput, setCustomTypesInput] = useState('');

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [projectData, groupData] = await Promise.all([
          AsyncStorage.getItem('cable-projects'),
          AsyncStorage.getItem('cable-groups'),      // ← new
        ]);
        if (projectData) setProjectsState(JSON.parse(projectData));
        if (groupData)   setGroupsState(JSON.parse(groupData));  // ← new
      } catch (e) {
        console.error('Load error:', e);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  // ── Persist projects ───────────────────────────────────────────────────────
  const persistProjects = useCallback((next) => {
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(async () => {
      try { await AsyncStorage.setItem('cable-projects', JSON.stringify(next)); }
      catch { showToast('Save failed', 'error'); }
    }, 400);
  }, []);

  // ── Persist groups (debounced) ─────────────────────────────────────────────
  const persistGroups = useCallback((next) => {
    if (persistGrpTimer.current) clearTimeout(persistGrpTimer.current);
    persistGrpTimer.current = setTimeout(async () => {
      try { await AsyncStorage.setItem('cable-groups', JSON.stringify(next)); }
      catch { showToast('Group save failed', 'error'); }
    }, 400);
  }, []);

  // ── Update projects list + keep activeProject in sync ─────────────────────
  const setProjects = useCallback((next) => {
    const resolved = typeof next === 'function' ? next(projects) : next;
    setProjectsState(resolved);
    persistProjects(resolved);
    if (activeProject) {
      const updated = resolved.find(p => p.id === activeProject.id);
      if (updated) setActiveProject(updated);
    }
  }, [projects, activeProject, persistProjects]);

  // ── Update groups list ─────────────────────────────────────────────────────
  const setGroups = useCallback((next) => {
    const resolved = typeof next === 'function' ? next(groups) : next;
    setGroupsState(resolved);
    persistGroups(resolved);
  }, [groups, persistGroups]);

  // ── Update a single project's fields ──────────────────────────────────────
  const updateActiveProject = useCallback((changes) => {
    const updated = { ...activeProject, ...changes };
    setActiveProject(updated);
    const next = projects.map(p => p.id === updated.id ? updated : p);
    setProjectsState(next);
    persistProjects(next);
  }, [activeProject, projects, persistProjects]);

  // ── Toast ─────────────────────────────────────────────────────────────────
  const showToast = useCallback((msg, type = 'info', onUndo = null) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, type, onUndo });
    toastTimer.current = setTimeout(() => {
      setToast(null);
      pendingDelete.current = null;
    }, onUndo ? 5000 : 2500);
  }, []);

  // ── Drop CRUD ─────────────────────────────────────────────────────────────
  const addDrop = useCallback((isDouble) => {
    const next = [...activeProject.drops, emptyDrop(isDouble)];
    updateActiveProject({ drops: next });
    showToast(isDouble ? '⟷ Double drop added' : '+ Single drop added');
  }, [activeProject, updateActiveProject, showToast]);

  const bulkAddDrops = useCallback((newDrops) => {
    const next = [...activeProject.drops, ...newDrops];
    updateActiveProject({ drops: next });
    showToast(`⬇ ${newDrops.length} drops imported`);
  }, [activeProject, updateActiveProject, showToast]);

  const updateDrop = useCallback((updated) => {
    const stamped = { ...updated, updatedAt: today() };
    const next = activeProject.drops.map(d => d.id === stamped.id ? stamped : d);
    updateActiveProject({ drops: next });
  }, [activeProject, updateActiveProject]);

  const deleteDrop = useCallback((id) => {
    const index = activeProject.drops.findIndex(d => d.id === id);
    const drop  = activeProject.drops[index];
    const next  = activeProject.drops.filter(d => d.id !== id);
    updateActiveProject({ drops: next });
    pendingDelete.current = { drop, index };
    showToast('Drop deleted', 'info', () => {
      if (!pendingDelete.current) return;
      const { drop: d, index: i } = pendingDelete.current;
      pendingDelete.current = null;
      if (toastTimer.current) clearTimeout(toastTimer.current);
      setToast(null);
      setActiveProject(prev => {
        if (!prev) return prev;
        const restored = [...prev.drops];
        restored.splice(i, 0, d);
        const updated = { ...prev, drops: restored };
        const nextProjects = projects.map(p => p.id === updated.id ? updated : p);
        persistProjects(nextProjects);
        setProjectsState(nextProjects);
        return updated;
      });
      showToast('↩ Delete undone');
    });
  }, [activeProject, updateActiveProject, showToast, projects, persistProjects]);

  // ── IDF management ────────────────────────────────────────────────────────
  const updateIdfs = useCallback((next) => {
    updateActiveProject({ idfList: next });
  }, [updateActiveProject]);

  // ── Project notes ─────────────────────────────────────────────────────────
  const updateProjectNotes = useCallback((notes) => {
    updateActiveProject({ notes });
  }, [updateActiveProject]);

  // ── Templates ─────────────────────────────────────────────────────────────
  const updateTemplates = useCallback((templates) => {
    updateActiveProject({ templates });
  }, [updateActiveProject]);

  const addDropFromTemplate = useCallback((template) => {
    const { uid, today } = require('./src/utils');
    const drop = {
      id:         uid(),
      groupType:  template.groupType,
      isDouble:   template.groupType === 'double',
      cableA: '', cableB: '', cableC: '', cableD: '',
      idf:        template.idf || '',
      roughPull:  false, terminated: false, tested: false,
      notes:      '', createdAt: today(),
    };
    const next = [...activeProject.drops, drop];
    updateActiveProject({ drops: next });
    showToast(`+ Drop added from "${template.name}"`);
  }, [activeProject, updateActiveProject, showToast]);

  // ── Custom Drop Types Handlers ────────────────────────────────────────────
  const handleEditCustomTypes = useCallback(() => {
    const currentList = activeProject.customTypeList ?? ['WAP', 'Camera', 'Card Reader'];
    setCustomTypesInput(currentList.join(', '));
    setShowCustomTypesModal(true);
  }, [activeProject]);

  const saveCustomTypes = useCallback(() => {
    const parsed = customTypesInput
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);
    updateActiveProject({ customTypeList: parsed });
    setShowCustomTypesModal(false);
    showToast('✓ Custom shortcuts updated');
  }, [customTypesInput, updateActiveProject, showToast]);

  // ── Backup & Restore ──────────────────────────────────────────────────────
  const backupData = useCallback(async () => {
    try {
      const backup = {
        version:    1,
        exportedAt: new Date().toISOString(),
        projects:   projects.map(p => ({
          ...p,
          // Gallery images are device file paths — preserve folder structure but strip URIs
          galleryImages: [],
        })),
        groups,
      };
      const json     = JSON.stringify(backup, null, 2);
      const fileName = `cabletrack-backup-${today().replace(/\//g, '-')}.json`;
      const filePath = FileSystem.documentDirectory + fileName;
      await FileSystem.writeAsStringAsync(filePath, json, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(filePath, {
          mimeType:    'application/json',
          dialogTitle: 'Save CableTrack Backup',
          UTI:         'public.json',
        });
      } else {
        showToast('Sharing not available on this device', 'error');
      }
    } catch (e) {
      showToast('Backup failed: ' + e.message, 'error');
    }
  }, [projects, groups, showToast]);

  const restoreData = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type:                 'application/json',
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;

      const file    = result.assets[0];
      const content = await FileSystem.readAsStringAsync(file.uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      let backup;
      try {
        backup = JSON.parse(content);
      } catch {
        showToast('Invalid backup file', 'error');
        return;
      }

      if (!backup.version || !Array.isArray(backup.projects)) {
        showToast('Unrecognised backup format', 'error');
        return;
      }

      const dateStr = backup.exportedAt
        ? new Date(backup.exportedAt).toLocaleDateString()
        : 'unknown date';

      Alert.alert(
        'Restore Backup',
        `Restoring will replace ALL current projects and groups with the backup from ${dateStr}.\n\n` +
        `${backup.projects.length} project(s) will be restored.\n\nThis cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text:  'Restore',
            style: 'destructive',
            onPress: async () => {
              try {
                const restoredProjects = backup.projects ?? [];
                const restoredGroups   = backup.groups   ?? [];
                await AsyncStorage.setItem('cable-projects', JSON.stringify(restoredProjects));
                await AsyncStorage.setItem('cable-groups',   JSON.stringify(restoredGroups));
                setProjectsState(restoredProjects);
                setGroupsState(restoredGroups);
                setActiveProject(null);
                showToast(`✓ ${restoredProjects.length} project${restoredProjects.length !== 1 ? 's' : ''} restored`);
              } catch (e) {
                showToast('Restore failed: ' + e.message, 'error');
              }
            },
          },
        ]
      );
    } catch (e) {
      showToast('Could not read backup file', 'error');
    }
  }, [showToast]);
  const deleteFolderWithImages = useCallback((folderId) => {
    updateActiveProject({
      folders:       (activeProject.folders       ?? []).filter(f => f.id !== folderId),
      galleryImages: (activeProject.galleryImages ?? []).filter(i => i.folderId !== folderId),
    });
  }, [activeProject, updateActiveProject]);

  // ── Clear all drops ───────────────────────────────────────────────────────
  const clearAllDrops = useCallback(() => {
    updateActiveProject({ drops: [] });
    showToast('All drops cleared');
  }, [updateActiveProject, showToast]);

  // ── Navigation ────────────────────────────────────────────────────────────
  const openProject = useCallback((project) => {
    setActiveProject(project);
    setActiveTab('drops');
  }, []);

  const closeProject = useCallback(() => {
    setActiveProject(null);
    setActiveTab('drops');
  }, []);

  if (!loaded) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
        <StatusBar style="light" backgroundColor={COLORS.bg} translucent={false} />
      </View>
    );
  }

  // ── Projects screen ───────────────────────────────────────────────────────
  if (!activeProject) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaView style={st.root}>
          <StatusBar style="light" backgroundColor={COLORS.surface} translucent={false} />
          <ProjectsScreen
            projects={projects}
            setProjects={setProjects}
            onOpenProject={openProject}
            groups={groups}          // ← new
            setGroups={setGroups}    // ← new
          />
          {toast && <Toast msg={toast.msg} type={toast.type} onUndo={toast.onUndo} />}
        </SafeAreaView>
      </GestureHandlerRootView>
    );
  }

  // ── Inside a project ──────────────────────────────────────────────────────
  const screenProps = {
    drops:            activeProject.drops,
    idfList:          activeProject.idfList,
    project:          activeProject,
    addDrop, bulkAddDrops, updateDrop, deleteDrop,
    updateIdfs, clearAllDrops, showToast,
    setProjects, projects,
	groups,
    backupData,
    restoreData,
    updateProjectNotes,
    templates:        activeProject.templates ?? [],
    updateTemplates,
    addDropFromTemplate,
    customTypeList:    activeProject.customTypeList ?? ['WAP', 'Camera', 'Card Reader'],
    onEditCustomTypes: handleEditCustomTypes,
    folders:          activeProject.folders       ?? [],
    galleryImages:    activeProject.galleryImages ?? [],
    setFolders:       (next) => updateActiveProject({ folders: next }),
    setGalleryImages: (next) => updateActiveProject({ galleryImages: next }),
    deleteFolderWithImages,
	updateGalleryData: (f, i) => updateActiveProject({ folders: f, galleryImages: i }),
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={st.root}>
        <StatusBar style="light" backgroundColor={COLORS.surface} translucent={false} />

        {/* Project header bar */}
        <View style={st.projectBar}>
          <TouchableOpacity onPress={closeProject} style={st.backBtn} activeOpacity={0.7}>
            <Text style={st.backArrow}>←</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={st.projectName} numberOfLines={1}>{activeProject.name}</Text>
            <Text style={st.projectMeta}>
              {activeProject.drops.length} drop{activeProject.drops.length !== 1 ? 's' : ''}
              {activeProject.status === 'archived' ? '  ·  ARCHIVED' : ''}
            </Text>
          </View>
          {activeProject.status === 'archived' && (
            <View style={st.archivedBadge}>
              <Text style={st.archivedBadgeText}>ARCHIVED</Text>
            </View>
          )}
        </View>

        <View style={{ flex: 1 }}>
          {activeTab === 'drops'     && <DropsScreen     {...screenProps} />}
          {activeTab === 'dashboard' && <DashboardScreen {...screenProps} />}
          {activeTab === 'settings'  && <SettingsScreen  {...screenProps} />}
          {activeTab === 'gallery'   && <GalleryScreen   {...screenProps} />}
        </View>

        <TabBar activeTab={activeTab} setActiveTab={setActiveTab} />
        {toast && <Toast msg={toast.msg} type={toast.type} onUndo={toast.onUndo} />}

        {/* ── Custom Types Edit Modal (Cross-platform safe) ── */}
        {showCustomTypesModal && (
          <Modal visible transparent animationType="fade" onRequestClose={() => setShowCustomTypesModal(false)}>
            <TouchableOpacity
              style={st.modalOverlay}
              activeOpacity={1}
              onPress={() => setShowCustomTypesModal(false)}
            >
              <TouchableOpacity activeOpacity={1} style={st.modalBox}>
                <Text style={st.modalTitle}>MANAGE CUSTOM TYPES</Text>
                <Text style={st.modalHint}>Enter a comma-separated list of shortcuts to display as buttons on your drop cards:</Text>
                
                <TextInput
                  value={customTypesInput}
                  onChangeText={setCustomTypesInput}
                  placeholder="e.g. WAP, Camera, Card Reader, Intercom"
                  placeholderTextColor="#4b5563"
                  style={st.modalInput}
                  autoCapitalize="words"
                  autoFocus
                />

                <View style={st.modalActions}>
                  <TouchableOpacity
                    style={[st.modalBtn, st.modalBtnCancel]}
                    onPress={() => setShowCustomTypesModal(false)}
                  >
                    <Text style={st.modalBtnCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[st.modalBtn, st.modalBtnSave]}
                    onPress={saveCustomTypes}
                  >
                    <Text style={st.modalBtnSaveText}>Save Shortcuts</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>
        )}
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  projectBar: {
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  backBtn: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    width: 36, height: 36,
    alignItems: 'center', justifyContent: 'center',
  },
  backArrow:    { color: COLORS.blue, fontSize: 20, fontWeight: '700' },
  projectName:  { fontSize: 15, fontWeight: '800', color: COLORS.text, letterSpacing: -0.2 },
  projectMeta:  { fontSize: 10, color: COLORS.textMuted, marginTop: 1 },
  archivedBadge: {
    backgroundColor: 'rgba(148,163,184,0.15)',
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
  },
  archivedBadgeText: {
    fontSize: 9, fontWeight: '800', color: COLORS.textMuted, letterSpacing: 0.8,
  },

  // Custom Types Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 24,
  },
  modalBox: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 16,
    gap: 12,
  },
  modalTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    color: COLORS.textMuted,
  },
  modalHint: {
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 16,
  },
  modalInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 7,
    padding: 10,
    color: COLORS.text,
    fontSize: 13,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  modalBtnCancel: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: COLORS.border,
  },
  modalBtnCancelText: {
    color: COLORS.textMuted,
    fontWeight: '700',
    fontSize: 13,
  },
  modalBtnSave: {
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderColor: 'rgba(245,158,11,0.4)',
  },
  modalBtnSaveText: {
    color: COLORS.amber,
    fontWeight: '800',
    fontSize: 13,
  },
});