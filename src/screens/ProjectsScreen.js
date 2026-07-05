import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, Alert, Modal, ActivityIndicator, Image,
} from 'react-native';
import { COLORS, DEFAULT_IDFS } from '../theme';
import { uid, today } from '../utils';
import ProjectCard from '../components/ProjectCard';
import { exportGroupToExcel } from '../exportGroupUtils';

const emptyProject = (name) => ({
  id:            uid(),
  name:          name.trim(),
  status:        'active',
  createdAt:     today(),
  drops:         [],
  idfList:       [...DEFAULT_IDFS],
  folders:       [],
  galleryImages: [],
});

function GroupSection({
  group,
  projects,
  isCollapsed,
  onToggle,
  onOpenProject,
  onArchive,
  onUnarchive,
  onDelete,
  onRemoveFromGroup,
  onExportAll,
  onManage,
  exporting,
}) {
  const totalDrops = projects.reduce((s, p) => s + p.drops.length, 0);
  
  // Calculate all pipeline steps across all projects in the group
  const pipelineSteps = projects.reduce((sum, p) => {
    const rp = p.drops.filter(d => d.roughPull || d.overrideComplete).length;
    const dp = p.drops.filter(d => d.dropped || d.overrideComplete).length;
    const ft = p.drops.filter(d => d.terminated || d.overrideComplete).length;
    const rt = p.drops.filter(d => d.rackTerminated || d.overrideComplete).length;
    const ts = p.drops.filter(d => d.tested || d.overrideComplete).length;
    return sum + rp + dp + ft + rt + ts;
  }, 0);

  // Apply the pipeline percentage logic (5 steps)
  const pct = totalDrops > 0 ? Math.round((pipelineSteps / (totalDrops * 5)) * 100) : 0;

  return (
    <View style={gs.container}>
      {/* Header row */}
      <TouchableOpacity style={gs.header} onPress={onToggle} activeOpacity={0.75}>
        <Text style={gs.arrow}>{isCollapsed ? '▶' : '▾'}</Text>

        <View style={{ flex: 1 }}>
          <Text style={gs.name}>{group.name}</Text>
          <Text style={gs.meta}>
            {projects.length} project{projects.length !== 1 ? 's' : ''}
            {totalDrops > 0
              ? `  ·  ${totalDrops} drop${totalDrops !== 1 ? 's' : ''}  ·  ${pct}% done`
              : '  ·  no active drops'}
          </Text>
        </View>

        {/* Export All */}
        <TouchableOpacity
          style={[gs.exportBtn, exporting && { opacity: 0.5 }]}
          onPress={onExportAll}
          activeOpacity={0.8}
          disabled={exporting}
        >
          {exporting
            ? <ActivityIndicator size="small" color={COLORS.green} />
            : <Text style={gs.exportText}>⬆ Export All</Text>
          }
        </TouchableOpacity>

        {/* Manage (⚙) */}
        <TouchableOpacity style={gs.manageBtn} onPress={onManage} activeOpacity={0.8}>
          <Text style={gs.manageText}>⚙</Text>
        </TouchableOpacity>
      </TouchableOpacity>

      {/* Progress bar */}
      {!isCollapsed && totalDrops > 0 && (
        <View style={gs.barTrack}>
          <View style={[gs.barFill, {
            width: `${pct}%`,
            backgroundColor: pct === 100 ? COLORS.green : COLORS.amber,
          }]} />
        </View>
      )}

      {/* Project cards */}
      {!isCollapsed && (
        <View style={gs.body}>
          {projects.length === 0 ? (
            <Text style={gs.emptyHint}>
              No active projects in this group.{'\n'}Tap "↗ Group" on a project below to add one.
            </Text>
          ) : (
            projects.map(project => (
              <ProjectCard
                key={project.id}
                project={project}
                onOpen={onOpenProject}
                onArchive={onArchive}
                onUnarchive={onUnarchive}
                onDelete={onDelete}
                onRemoveFromGroup={() => onRemoveFromGroup(project.id)}
              />
            ))
          )}
        </View>
      )}
    </View>
  );
}

export default function ProjectsScreen({
  projects,
  setProjects,
  onOpenProject,
  groups,
  setGroups,
}) {
  const [showNew,        setShowNew]        = useState(false);
  const [showNewGroup,   setShowNewGroup]   = useState(false);
  const [showGroupPick,  setShowGroupPick]  = useState(null);
  const [showManage,     setShowManage]     = useState(null);

  const [newName,        setNewName]        = useState('');
  const [newGroupName,   setNewGroupName]   = useState('');
  const [renameValue,    setRenameValue]    = useState('');
  const [editingName,    setEditingName]    = useState(false);

  const [collapsed,      setCollapsed]      = useState(() => Object.fromEntries(groups.map(g => [g.id, true])));
  const [showArchived,   setShowArchived]   = useState(false);
  const [exportingGroup, setExportingGroup] = useState(null);

  const activeProjects   = projects.filter(p => p.status === 'active');
  const archivedProjects = projects.filter(p => p.status === 'archived');
  const ungroupedActive  = activeProjects.filter(p => !p.groupId);
  const managedGroup     = groups.find(g => g.id === showManage);

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
        {
          text: 'Archive',
          onPress: () =>
            setProjects(projects.map(p =>
              p.id === id ? { ...p, status: 'archived' } : p
            )),
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
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => setProjects(projects.filter(p => p.id !== id)),
        },
      ]
    );
  };

  const createGroup = () => {
    const name = newGroupName.trim();
    if (!name) return;
    setGroups([...groups, { id: uid(), name, createdAt: today() }]);
    setNewGroupName('');
    setShowNewGroup(false);
  };

  const deleteGroup = (groupId) => {
    Alert.alert(
      'Delete Group',
      'Delete this group? All projects will become ungrouped (no data is lost).',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Group',
          style: 'destructive',
          onPress: () => {
            setProjects(projects.map(p =>
              p.groupId === groupId ? { ...p, groupId: null } : p
            ));
            setGroups(groups.filter(g => g.id !== groupId));
            setShowManage(null);
          },
        },
      ]
    );
  };

  const commitRename = () => {
    if (!renameValue.trim() || !showManage) return;
    setGroups(groups.map(g =>
      g.id === showManage ? { ...g, name: renameValue.trim() } : g
    ));
    setEditingName(false);
  };

  const assignToGroup = (projectId, groupId) => {
    setProjects(projects.map(p =>
      p.id === projectId ? { ...p, groupId } : p
    ));
    setShowGroupPick(null);
  };

  const removeFromGroup = (projectId) => {
    setProjects(projects.map(p =>
      p.id === projectId ? { ...p, groupId: null } : p
    ));
  };

  const toggleCollapsed = (groupId) => {
    setCollapsed(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const handleExportAll = async (group) => {
    const groupProjects = activeProjects.filter(p => p.groupId === group.id);
    if (groupProjects.length === 0) {
      Alert.alert('Nothing to export', 'This group has no active projects with data.');
      return;
    }
    setExportingGroup(group.id);
    try {
      await exportGroupToExcel(group, groupProjects);
    } catch (e) {
      Alert.alert('Export failed', e?.message ?? 'An unexpected error occurred.');
    } finally {
      setExportingGroup(null);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>

      {/* ── Header ── */}
      <View style={s.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Image source={require('../../assets/icon-transparent.png')} style={{ width: 32, height: 32 }} />
          <View>
            <Text style={s.title}>CableTrack</Text>
            <Text style={s.subtitle}>FIELD TRACKER</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          {/* New Group button */}
          <TouchableOpacity style={s.newGroupBtn} onPress={() => setShowNewGroup(true)} activeOpacity={0.8}>
            <Text style={s.newGroupBtnText}>⊞ Group</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.newBtn} onPress={() => setShowNew(true)} activeOpacity={0.8}>
            <Text style={s.newBtnText}>+ Project</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Main list ── */}
      <ScrollView
        contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Empty state */}
        {ungroupedActive.length === 0 && groups.length === 0 && (
          <View style={s.empty}>
            <Text style={{ fontSize: 48 }}>🏗</Text>
            <Text style={s.emptyTitle}>No projects yet</Text>
            <Text style={s.emptyHint}>Tap "+ Project" to create your first job site</Text>
            <TouchableOpacity style={s.emptyBtn} onPress={() => setShowNew(true)}>
              <Text style={s.emptyBtnText}>+ Create Project</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Ungrouped active projects */}
        {ungroupedActive.length > 0 && (
          <Text style={s.sectionLabel}>
            {groups.length > 0 ? 'UNGROUPED — ' : 'ACTIVE PROJECTS — '}{ungroupedActive.length}
          </Text>
        )}
        {ungroupedActive.map(project => (
          <ProjectCard
            key={project.id}
            project={project}
            onOpen={onOpenProject}
            onArchive={archiveProject}
            onUnarchive={unarchiveProject}
            onDelete={deleteProject}
            onMoveToGroup={groups.length > 0 ? () => setShowGroupPick(project.id) : undefined}
          />
        ))}

        {/* Groups */}
        {groups.map(group => (
          <GroupSection
            key={group.id}
            group={group}
            projects={activeProjects.filter(p => p.groupId === group.id)}
            isCollapsed={!!collapsed[group.id]}
            onToggle={() => toggleCollapsed(group.id)}
            onOpenProject={onOpenProject}
            onArchive={archiveProject}
            onUnarchive={unarchiveProject}
            onDelete={deleteProject}
            onRemoveFromGroup={removeFromGroup}
            onExportAll={() => handleExportAll(group)}
            onManage={() => {
              setShowManage(group.id);
              setRenameValue(group.name);
              setEditingName(false);
            }}
            exporting={exportingGroup === group.id}
          />
        ))}

        {/* Archived section */}
        {archivedProjects.length > 0 && (
          <View style={{ marginTop: 8 }}>
            <TouchableOpacity
              onPress={() => setShowArchived(v => !v)}
              style={s.archivedToggle}
            >
              <Text style={s.archivedToggleText}>
                {showArchived ? '▴' : '▾'}{'  '}ARCHIVED PROJECTS ({archivedProjects.length})
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
        )}
      </ScrollView>

      {/* ════════════════════════════════════════════════════════════════════
          MODALS
      ════════════════════════════════════════════════════════════════════ */}

      {/* ── New Project ── */}
      <Modal
        visible={showNew}
        transparent
        animationType="fade"
        onRequestClose={() => { setShowNew(false); setNewName(''); }}
      >
        <View style={m.overlay}>
          <View style={m.box}>
            <Text style={m.title}>New Project</Text>
            <Text style={m.hint}>Enter a name for this job site or project.</Text>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              placeholder="e.g. Walmart Remodel, School Dist. B3"
              placeholderTextColor={COLORS.textDim}
              style={m.input}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={createProject}
            />
            <View style={m.btnRow}>
              <TouchableOpacity
                style={[m.btn, m.cancel]}
                onPress={() => { setShowNew(false); setNewName(''); }}
              >
                <Text style={{ color: COLORS.textMuted, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[m.btn, m.confirm, !newName.trim() && { opacity: 0.4 }]}
                onPress={createProject}
                disabled={!newName.trim()}
              >
                <Text style={{ color: '#fff', fontWeight: '800' }}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── New Group ── */}
      <Modal
        visible={showNewGroup}
        transparent
        animationType="fade"
        onRequestClose={() => { setShowNewGroup(false); setNewGroupName(''); }}
      >
        <View style={m.overlay}>
          <View style={m.box}>
            <Text style={m.title}>New Project Group</Text>
            <Text style={m.hint}>
              Groups let you bundle related projects together (e.g. by location or client).
              Each project stays independent — the group is just for organisation.
            </Text>
            <TextInput
              value={newGroupName}
              onChangeText={setNewGroupName}
              placeholder="e.g. Eastside Campus, Main St. Renovation"
              placeholderTextColor={COLORS.textDim}
              style={m.input}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={createGroup}
            />
            <View style={m.btnRow}>
              <TouchableOpacity
                style={[m.btn, m.cancel]}
                onPress={() => { setShowNewGroup(false); setNewGroupName(''); }}
              >
                <Text style={{ color: COLORS.textMuted, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[m.btn, m.confirm, !newGroupName.trim() && { opacity: 0.4 }]}
                onPress={createGroup}
                disabled={!newGroupName.trim()}
              >
                <Text style={{ color: '#fff', fontWeight: '800' }}>Create Group</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Group Picker (assign project to a group) ── */}
      <Modal
        visible={!!showGroupPick}
        transparent
        animationType="fade"
        onRequestClose={() => setShowGroupPick(null)}
      >
        <View style={m.overlay}>
          <View style={m.box}>
            <Text style={m.title}>Move to Group</Text>
            <Text style={m.hint}>
              Select a group for{' '}
              <Text style={{ color: COLORS.text, fontWeight: '700' }}>
                {projects.find(p => p.id === showGroupPick)?.name}
              </Text>
            </Text>

            {groups.map(group => {
              const memberCount = activeProjects.filter(p => p.groupId === group.id).length;
              return (
                <TouchableOpacity
                  key={group.id}
                  style={m.pickRow}
                  onPress={() => assignToGroup(showGroupPick, group.id)}
                  activeOpacity={0.75}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={m.pickName}>{group.name}</Text>
                    <Text style={m.pickMeta}>
                      {memberCount} project{memberCount !== 1 ? 's' : ''} currently in this group
                    </Text>
                  </View>
                  <Text style={{ color: COLORS.blue, fontWeight: '800', fontSize: 18 }}>›</Text>
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              style={[m.btn, m.cancel, { marginTop: 12, width: '100%' }]}
              onPress={() => setShowGroupPick(null)}
            >
              <Text style={{ color: COLORS.textMuted, fontWeight: '700' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Group Manager ── */}
      <Modal
        visible={!!showManage}
        transparent
        animationType="fade"
        onRequestClose={() => setShowManage(null)}
      >
        <View style={m.overlay}>
          <View style={[m.box, { maxHeight: '80%' }]}>
            <Text style={m.title}>Manage Group</Text>

            {/* Rename */}
            {editingName ? (
              <View style={{ marginBottom: 16 }}>
                <Text style={m.fieldLabel}>Group Name</Text>
                <TextInput
                  value={renameValue}
                  onChangeText={setRenameValue}
                  style={m.input}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={commitRename}
                />
                <View style={[m.btnRow, { marginTop: 10 }]}>
                  <TouchableOpacity style={[m.btn, m.cancel]} onPress={() => setEditingName(false)}>
                    <Text style={{ color: COLORS.textMuted, fontWeight: '700' }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[m.btn, m.confirm, !renameValue.trim() && { opacity: 0.4 }]}
                    onPress={commitRename}
                    disabled={!renameValue.trim()}
                  >
                    <Text style={{ color: '#fff', fontWeight: '800' }}>Save Name</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={m.renameRow}
                onPress={() => { setRenameValue(managedGroup?.name ?? ''); setEditingName(true); }}
                activeOpacity={0.75}
              >
                <View style={{ flex: 1 }}>
                  <Text style={m.fieldLabel}>GROUP NAME</Text>
                  <Text style={m.renameValue}>{managedGroup?.name}</Text>
                </View>
                <Text style={{ color: COLORS.blue, fontSize: 12, fontWeight: '700' }}>✏ Rename</Text>
              </TouchableOpacity>
            )}

            {/* Member projects */}
            {!editingName && (() => {
              const memberProjects = activeProjects.filter(p => p.groupId === showManage);
              return (
                <>
                  <Text style={[m.fieldLabel, { marginBottom: 6 }]}>
                    MEMBER PROJECTS ({memberProjects.length})
                  </Text>
                  <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                    {memberProjects.length === 0 ? (
                      <Text style={m.hint}>
                        No projects in this group yet. Use "↗ Group" on a project card to add one.
                      </Text>
                    ) : (
                      memberProjects.map(p => (
                        <View key={p.id} style={m.memberRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={m.memberName}>{p.name}</Text>
                            <Text style={m.memberMeta}>{p.drops.length} drops</Text>
                          </View>
                          <TouchableOpacity
                            style={m.removeBtn}
                            onPress={() => {
                              removeFromGroup(p.id);
                              // If last project, close modal to avoid stale state
                              if (memberProjects.length === 1) setShowManage(null);
                            }}
                          >
                            <Text style={m.removeBtnText}>↙ Ungroup</Text>
                          </TouchableOpacity>
                        </View>
                      ))
                    )}
                  </ScrollView>
                </>
              );
            })()}

            {/* Footer buttons */}
            {!editingName && (
              <View style={[m.btnRow, { marginTop: 16 }]}>
                <TouchableOpacity style={[m.btn, m.cancel]} onPress={() => setShowManage(null)}>
                  <Text style={{ color: COLORS.textMuted, fontWeight: '700' }}>Close</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[m.btn, m.danger]}
                  onPress={() => deleteGroup(showManage)}
                >
                  <Text style={{ color: COLORS.red, fontWeight: '800' }}>🗑 Delete Group</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── GroupSection styles ───────────────────────────────────────────────────────

const gs = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: COLORS.borderHi ?? COLORS.border,
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  arrow: {
    fontSize: 12,
    color: COLORS.textMuted,
    width: 14,
    textAlign: 'center',
  },
  name: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.2,
  },
  meta: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
    letterSpacing: 0.2,
  },
  exportBtn: {
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
    borderRadius: 7,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 90,
    alignItems: 'center',
  },
  exportText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.green ?? '#22c55e',
    letterSpacing: 0.2,
  },
  manageBtn: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 7,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manageText: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  barTrack: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginHorizontal: 12,
    marginTop: 0,
    marginBottom: 0,
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 2 },
  body: {
    padding: 10,
    paddingTop: 12,
    gap: 0,
  },
  emptyHint: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    lineHeight: 18,
  },
});

// ── ProjectsScreen styles ─────────────────────────────────────────────────────

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
  newBtnText:   { color: COLORS.blue, fontWeight: '800', fontSize: 13 },
  newGroupBtn: {
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  newGroupBtnText: { color: COLORS.amber ?? '#f59e0b', fontWeight: '800', fontSize: 13 },
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
  emptyBtnText:  { color: '#fff', fontWeight: '800', fontSize: 14 },
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
});

// ── Modal styles ──────────────────────────────────────────────────────────────

const m = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  box: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 20,
    width: '100%',
    borderWidth: 1,
    borderColor: COLORS.borderHi ?? COLORS.border,
  },
  title:  { fontSize: 18, fontWeight: '800', color: COLORS.text, marginBottom: 6 },
  hint:   { fontSize: 12, color: COLORS.textMuted, marginBottom: 14, lineHeight: 18 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    color: COLORS.text,
    fontSize: 14,
  },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  btn:    { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center' },
  cancel: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: COLORS.border,
  },
  confirm: { backgroundColor: COLORS.blue },
  danger:  {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
  },
  fieldLabel: {
    fontSize: 10, fontWeight: '800', color: COLORS.textMuted,
    letterSpacing: 1, marginBottom: 4,
  },
  renameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  renameValue: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  pickName: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  pickMeta: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 10,
  },
  memberName: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  memberMeta: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  removeBtn: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  removeBtnText: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted },
});