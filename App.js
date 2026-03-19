import React, { useState, useEffect, useCallback } from 'react';
import { View, SafeAreaView, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';

import ProjectsScreen  from './src/screens/ProjectsScreen';
import DropsScreen     from './src/screens/DropsScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import SettingsScreen  from './src/screens/SettingsScreen';
import GalleryScreen   from './src/screens/GalleryScreen';
import TabBar          from './src/components/TabBar';
import Toast           from './src/components/Toast';
import { COLORS }      from './src/theme';
import { emptyDrop }   from './src/utils';

export default function App() {
  const [projects,       setProjectsState] = useState([]);
  const [activeProject,  setActiveProject] = useState(null);
  const [activeTab,      setActiveTab]     = useState('drops');
  const [loaded,         setLoaded]        = useState(false);
  const [toast,          setToast]         = useState(null);

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const data = await AsyncStorage.getItem('cable-projects');
        if (data) setProjectsState(JSON.parse(data));
      } catch (e) {
        console.error('Load error:', e);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  // ── Persist ───────────────────────────────────────────────────────────────
  const persistProjects = useCallback(async (next) => {
    try { await AsyncStorage.setItem('cable-projects', JSON.stringify(next)); }
    catch { showToast('Save failed', 'error'); }
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

  // ── Update a single project's fields ─────────────────────────────────────
  const updateActiveProject = useCallback((changes) => {
    const updated = { ...activeProject, ...changes };
    setActiveProject(updated);
    const next = projects.map(p => p.id === updated.id ? updated : p);
    setProjectsState(next);
    persistProjects(next);
  }, [activeProject, projects, persistProjects]);

  // ── Toast ─────────────────────────────────────────────────────────────────
  const showToast = useCallback((msg, type = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
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
    const next = activeProject.drops.map(d => d.id === updated.id ? updated : d);
    updateActiveProject({ drops: next });
  }, [activeProject, updateActiveProject]);

  const deleteDrop = useCallback((id) => {
    const next = activeProject.drops.filter(d => d.id !== id);
    updateActiveProject({ drops: next });
    showToast('Drop deleted');
  }, [activeProject, updateActiveProject, showToast]);

  // ── IDF management ────────────────────────────────────────────────────────
  const updateIdfs = useCallback((next) => {
    updateActiveProject({ idfList: next });
  }, [updateActiveProject]);

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
      <SafeAreaView style={st.root}>
        <StatusBar style="light" backgroundColor={COLORS.surface} translucent={false} />
        <ProjectsScreen
          projects={projects}
          setProjects={setProjects}
          onOpenProject={openProject}
        />
        {toast && <Toast msg={toast.msg} type={toast.type} />}
      </SafeAreaView>
    );
  }

  // ── Inside a project ──────────────────────────────────────────────────────
  const screenProps = {
    drops:        activeProject.drops,
  idfList:      activeProject.idfList,
  project:      activeProject,
  addDrop, bulkAddDrops, updateDrop, deleteDrop,
  updateIdfs, clearAllDrops, showToast,
  setProjects, projects,
  folders:          activeProject.folders       ?? [],
  galleryImages:    activeProject.galleryImages  ?? [],
  setFolders:       (next) => updateActiveProject({ folders: next }),
  setGalleryImages: (next) => updateActiveProject({ galleryImages: next }),
  };

  return (
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
		{activeTab === 'gallery' && <GalleryScreen {...screenProps} />}
      </View>

      <TabBar activeTab={activeTab} setActiveTab={setActiveTab} />
      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </SafeAreaView>
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
});
