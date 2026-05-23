import 'react-native-gesture-handler';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, SafeAreaView, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import ProjectsScreen  from './src/screens/ProjectsScreen';
import DropsScreen     from './src/screens/DropsScreen';
import DevicesScreen   from './src/screens/DevicesScreen'; // ← New Screen
import DashboardScreen from './src/screens/DashboardScreen';
import SettingsScreen  from './src/screens/SettingsScreen';
import GalleryScreen   from './src/screens/GalleryScreen';
import TabBar          from './src/components/TabBar';
import Toast           from './src/components/Toast';
import { COLORS }      from './src/theme';
import { emptyDrop }   from './src/utils';

export default function App() {
  const [projects,       setProjectsState] = useState([]);
  const [groups,         setGroupsState]   = useState([]);   
  const [activeProject,  setActiveProject] = useState(null);
  const [activeTab,      setActiveTab]     = useState('drops');
  const [loaded,         setLoaded]        = useState(false);
  const [toast,          setToast]         = useState(null);
  const toastTimer      = useRef(null);
  const pendingDelete   = useRef(null);
  const persistTimer    = useRef(null);
  const persistGrpTimer = useRef(null);    

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [projectData, groupData] = await Promise.all([
          AsyncStorage.getItem('cable-projects'),
          AsyncStorage.getItem('cable-groups'),      
        ]);
        if (projectData) setProjectsState(JSON.parse(projectData));
        if (groupData)   setGroupsState(JSON.parse(groupData));  
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
    const next = activeProject.drops.map(d => d.id === updated.id ? updated : d);
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

  // ── Device CRUD (New Integration) ─────────────────────────────────────────
  const addDevice = useCallback((deviceType) => {
    const { uid, today } = require('./src/utils');
    const newDevice = {
      id: uid(),
      deviceType: deviceType,
      label: '',
      cableId: '',
      idf: '',
      roughPull: false,
      rfi: false,
      installed: false,
      programmed: false,
      tested: false,
      notes: '',
      attention: false,
      createdAt: today(),
    };
    const next = [...(activeProject.devices ?? []), newDevice];
    updateActiveProject({ devices: next });
    showToast(`+ Added ${deviceType}`);
  }, [activeProject, updateActiveProject, showToast]);

  const updateDevice = useCallback((updated) => {
    const next = (activeProject.devices ?? []).map(d => d.id === updated.id ? updated : d);
    updateActiveProject({ devices: next });
  }, [activeProject, updateActiveProject]);

  const deleteDevice = useCallback((id) => {
    const currentDevices = activeProject.devices ?? [];
    const index = currentDevices.findIndex(d => d.id === id);
    const device = currentDevices[index];
    const next = currentDevices.filter(d => d.id !== id);
    updateActiveProject({ devices: next });
    
    // Separate local execution block to prevent overlap with standard drop deletions
    let localPending = { device, index };
    showToast('Device deleted', 'info', () => {
      if (!localPending) return;
      const { device: d, index: i } = localPending;
      localPending = null;
      if (toastTimer.current) clearTimeout(toastTimer.current);
      setToast(null);
      setActiveProject(prev => {
        if (!prev) return prev;
        const restored = [...(prev.devices ?? [])];
        restored.splice(i, 0, d);
        const updated = { ...prev, devices: restored };
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

  // ── Gallery folder + image deletion ───────────────────────────────────────
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
            groups={groups}          
            setGroups={setGroups}    
          />
          {toast && <Toast msg={toast.msg} type={toast.type} onUndo={toast.onUndo} />}
        </SafeAreaView>
      </GestureHandlerRootView>
    );
  }

  // ── Inside a project ──────────────────────────────────────────────────────
  const screenProps = {
    drops:            activeProject.drops,
    devices:          activeProject.devices ?? [], // Safely handle legacy projects
    idfList:          activeProject.idfList,
    project:          activeProject,
    addDrop, bulkAddDrops, updateDrop, deleteDrop,
    addDevice, updateDevice, deleteDevice, // Inject core CRUD operations
    updateIdfs, clearAllDrops, showToast,
    setProjects, projects,
    updateProjectNotes,
    templates:        activeProject.templates ?? [],
    updateTemplates,
    addDropFromTemplate,
    folders:          activeProject.folders       ?? [],
    galleryImages:    activeProject.galleryImages ?? [],
    setFolders:       (next) => updateActiveProject({ folders: next }),
    setGalleryImages: (next) => updateActiveProject({ galleryImages: next }),
    deleteFolderWithImages,
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
              {activeProject.drops.length} drop{activeProject.drops.length !== 1 ? 's' : ''}  ·  {(activeProject.devices ?? []).length} device{(activeProject.devices ?? []).length !== 1 ? 's' : ''}
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
          {activeTab === 'devices'   && <DevicesScreen   {...screenProps} />} 
          {activeTab === 'dashboard' && <DashboardScreen {...screenProps} />}
          {activeTab === 'settings'  && <SettingsScreen  {...screenProps} />}
          {activeTab === 'gallery'   && <GalleryScreen   {...screenProps} />}
        </View>

        <TabBar activeTab={activeTab} setActiveTab={setActiveTab} />
        {toast && <Toast msg={toast.msg} type={toast.type} onUndo={toast.onUndo} />}
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
});