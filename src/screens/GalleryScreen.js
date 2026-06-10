import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Image,
  FlatList,
  Alert
} from 'react-native';
import { COLORS } from '../theme';
import { uid } from '../utils';

export default function GalleryScreen({
  project,
  folders,
  galleryImages,
  setFolders,
  setGalleryImages,
  deleteFolderWithImages,
  projects,
  groups,
  showToast
}) {
  const [activeFolder, setActiveFolder] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedPeerProject, setSelectedPeerProject] = useState(null);
  const [selectedFolders, setSelectedFolders] = useState({});
  const [selectedImages, setSelectedImages] = useState({});

  // ── Find Group and Companion Peer Projects ────────────────────────────────
  const currentGroup = groups?.find(g => 
    g.projectIds?.includes(project.id) || project.groupId === g.id
  );

  const peerProjects = currentGroup
    ? projects.filter(p => p.id !== project.id && (currentGroup.projectIds?.includes(p.id) || p.groupId === currentGroup.id))
    : [];

  const resetImportState = () => {
    setSelectedPeerProject(null);
    setSelectedFolders({});
    setSelectedImages({});
  };

  const toggleFolderSelection = (folderId) => {
    setSelectedFolders(prev => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  const toggleImageSelection = (imageId) => {
    setSelectedImages(prev => ({ ...prev, [imageId]: !prev[imageId] }));
  };

  // ── Import Execution Core Logic ───────────────────────────────────────────
  const handleImport = () => {
    if (!selectedPeerProject) return;

    let updatedFolders = [...folders];
    let updatedImages = [...galleryImages];
    let importedFoldersCount = 0;
    let importedImagesCount = 0;

    // 1. Process and clone selected folders + their nested images
    selectedPeerProject.folders?.forEach(folder => {
      if (selectedFolders[folder.id]) {
        const newFolderId = uid();
        updatedFolders.push({
          ...folder,
          id: newFolderId, // Generate new unique ID to avoid cross-project mutations
        });
        importedFoldersCount++;

        // Find all images matching this old folder and map them to the new folder ID
        const folderImages = (selectedPeerProject.galleryImages ?? []).filter(
          img => img.folderId === folder.id
        );
        folderImages.forEach(img => {
          updatedImages.push({
            ...img,
            id: uid(),
            folderId: newFolderId,
          });
          importedImagesCount++;
        });
      }
    });

    // 2. Process individually selected loose/unassigned images
    selectedPeerProject.galleryImages?.forEach(img => {
      if (selectedImages[img.id]) {
        updatedImages.push({
          ...img,
          id: uid(),
          // Import to the root or inside the folder currently open
          folderId: activeFolder ? activeFolder.id : null, 
        });
        importedImagesCount++;
      }
    });

    if (importedFoldersCount === 0 && importedImagesCount === 0) {
      showToast('No items selected', 'info');
      return;
    }

    // Persist changes back up to state
    setFolders(updatedFolders);
    setGalleryImages(updatedImages);
    setShowImportModal(false);
    resetImportState();
    showToast(`✓ Imported ${importedFoldersCount} folders and ${importedImagesCount} files`);
  };

  // Current view images filter
  const currentImages = galleryImages.filter(img => 
    activeFolder ? img.folderId === activeFolder.id : !img.folderId
  );

  return (
    <View style={st.container}>
      {/* ── Gallery Action Header ── */}
      <View style={st.actionBar}>
        {activeFolder ? (
          <TouchableOpacity style={st.backBtn} onPress={() => setActiveFolder(null)}>
            <Text style={st.backText}>← Back to Folders</Text>
          </TouchableOpacity>
        ) : (
          <Text style={st.sectionTitle}>PROJECT BLUEPRINTS & GALLERIES</Text>
        )}

        {/* Display action button only at root view if project has group companions */}
        {!activeFolder && peerProjects.length > 0 && (
          <TouchableOpacity 
            style={st.importGroupBtn} 
            onPress={() => setShowImportModal(true)}
            activeOpacity={0.7}
          >
            <Text style={st.importGroupBtnText}>🔗 Import From Group</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Main Workspace Scroll Content ── */}
      <ScrollView style={st.scrollContainer} contentContainerStyle={st.scrollContent}>
        {activeFolder ? (
          <View>
            <Text style={st.folderHeaderTitle}>📁 {activeFolder.name}</Text>
            {currentImages.length === 0 ? (
              <Text style={st.emptyText}>No blueprint designs inside this folder.</Text>
            ) : (
              <View style={st.imageGrid}>
                {currentImages.map(img => (
                  <View key={img.id} style={st.imageCard}>
                    <Image source={{ uri: img.uri }} style={st.blueprintImage} resizeMode="cover" />
                    {img.name && <Text style={st.imageName} numberOfLines={1}>{img.name}</Text>}
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : (
          <View>
            {folders.length === 0 && (
              <Text style={st.emptyText}>No folders created yet. Add folders or utilize group syncing.</Text>
            )}
            
            {folders.length > 0 && (
              <View style={st.folderList}>
                {folders.map(f => {
                  const count = galleryImages.filter(img => img.folderId === f.id).length;
                  return (
                    <TouchableOpacity 
                      key={f.id} 
                      style={st.folderCard} 
                      onPress={() => setActiveFolder(f)}
                      activeOpacity={0.7}
                    >
                      <View style={st.folderIconInfo}>
                        <Text style={st.folderIcon}>📁</Text>
                        <View>
                          <Text style={st.folderName}>{f.name}</Text>
                          <Text style={st.folderMeta}>{count} sheet{count !== 1 ? 's' : ''}</Text>
                        </View>
                      </View>
                      <TouchableOpacity 
                        style={st.deleteBtn} 
                        onPress={() => {
                          Alert.alert(
                            "Delete Folder",
                            `Delete "${f.name}" and all internal documents?`,
                            [
                              { text: "Cancel", style: "cancel" },
                              { text: "Delete", style: "destructive", onPress: () => deleteFolderWithImages(f.id) }
                            ]
                          );
                        }}
                      >
                        <Text style={st.deleteBtnText}>✕</Text>
                      </TouchableOpacity>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Root/Unassigned Blueprints */}
            {currentImages.length > 0 && (
              <View style={{ marginTop: 24 }}>
                <Text style={st.sectionTitle}>UNASSIGNED FILES</Text>
                <View style={st.imageGrid}>
                  {currentImages.map(img => (
                    <View key={img.id} style={st.imageCard}>
                      <Image source={{ uri: img.uri }} style={st.blueprintImage} resizeMode="cover" />
                      {img.name && <Text style={st.imageName} numberOfLines={1}>{img.name}</Text>}
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* ── Import From Group Context Modal ── */}
      <Modal 
        visible={showImportModal} 
        transparent 
        animationType="slide" 
        onRequestClose={() => { setShowImportModal(false); resetImportState(); }}
      >
        <View style={st.modalOverlay}>
          <View style={st.modalBox}>
            <View style={st.modalHeader}>
              <Text style={st.modalTitle}>IMPORT FROM: {currentGroup?.name?.toUpperCase() || 'SHARED GROUP'}</Text>
              <TouchableOpacity onPress={() => { setShowImportModal(false); resetImportState(); }}>
                <Text style={st.closeModalX}>✕</Text>
              </TouchableOpacity>
            </View>

            {!selectedPeerProject ? (
              /* STEP 1: Choose Peer Project */
              <View style={{ flex: 1 }}>
                <Text style={st.modalSubtitle}>Select a project group member to source blueprints from:</Text>
                <FlatList
                  data={peerProjects}
                  keyExtractor={item => item.id}
                  renderItem={({ item }) => {
                    const fCount = item.folders?.length || 0;
                    const iCount = item.galleryImages?.length || 0;
                    return (
                      <TouchableOpacity 
                        style={st.projectSelectCard} 
                        onPress={() => setSelectedPeerProject(item)}
                      >
                        <View>
                          <Text style={st.projectSelectName}>{item.name}</Text>
                          <Text style={st.projectSelectMeta}>{fCount} folders · {iCount} documents</Text>
                        </View>
                        <Text style={st.arrowRight}>→</Text>
                      </TouchableOpacity>
                    );
                  }}
                  ListEmptyComponent={<Text style={st.emptyText}>No other companion projects in this group.</Text>}
                />
              </View>
            ) : (
              /* STEP 2: Pick items from chosen project */
              <View style={{ flex: 1 }}>
                <TouchableOpacity style={st.backToProjectsBtn} onPress={() => resetImportState()}>
                  <Text style={st.backToProjectsText}>← Change Sourcing Project</Text>
                </TouchableOpacity>

                <Text style={st.browsingTitle}>Sourcing: <Text style={{ color: COLORS.text }}>{selectedPeerProject.name}</Text></Text>
                
                <ScrollView style={{ flex: 1, marginTop: 10 }}>
                  {/* Folders List Selection */}
                  <Text style={st.modalSectionHeading}>FOLDERS (Copies folder & all internal sheets)</Text>
                  {(selectedPeerProject.folders || []).length === 0 ? (
                    <Text style={st.modalEmptyText}>No folders available inside this project.</Text>
                  ) : (
                    selectedPeerProject.folders.map(f => {
                      const imgCount = (selectedPeerProject.galleryImages || []).filter(img => img.folderId === f.id).length;
                      const isChecked = !!selectedFolders[f.id];
                      return (
                        <TouchableOpacity 
                          key={f.id} 
                          style={[st.checkboxRow, isChecked && st.checkboxRowActive]} 
                          onPress={() => toggleFolderSelection(f.id)}
                        >
                          <View style={st.checkbox}>
                            {isChecked && <View style={st.checkboxChecked} />}
                          </View>
                          <Text style={st.checkboxLabel}>📁 {f.name} ({imgCount} images)</Text>
                        </TouchableOpacity>
                      );
                    })
                  )}

                  {/* Loose Images Selection */}
                  <Text style={[st.modalSectionHeading, { marginTop: 18 }]}>LOOSE / SINGLE BLUEPRINTS</Text>
                  {(() => {
                    const looseImages = (selectedPeerProject.galleryImages || []).filter(img => !img.folderId);
                    if (looseImages.length === 0) {
                      return <Text style={st.modalEmptyText}>No unassigned blueprints available.</Text>;
                    }
                    return looseImages.map(img => {
                      const isChecked = !!selectedImages[img.id];
                      return (
                        <TouchableOpacity 
                          key={img.id} 
                          style={[st.checkboxRow, isChecked && st.checkboxRowActive]} 
                          onPress={() => toggleImageSelection(img.id)}
                        >
                          <View style={st.checkbox}>
                            {isChecked && <View style={st.checkboxChecked} />}
                          </View>
                          <Image source={{ uri: img.uri }} style={st.thumbnail} />
                          <Text style={st.checkboxLabel} numberOfLines={1}>
                            {img.name || 'Blueprint Layout Sheet'}
                          </Text>
                        </TouchableOpacity>
                      );
                    });
                  })()}
                </ScrollView>

                {/* Footer Modal Controls */}
                <View style={st.modalActions}>
                  <TouchableOpacity 
                    style={[st.modalBtn, st.modalBtnCancel]} 
                    onPress={() => { setShowImportModal(false); resetImportState(); }}
                  >
                    <Text style={st.modalBtnCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[st.modalBtn, st.modalBtnSave]} 
                    onPress={handleImport}
                  >
                    <Text style={st.modalBtnSaveText}>Import Selected</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  sectionTitle: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, color: COLORS.textMuted },
  folderHeaderTitle: { fontSize: 15, fontWeight: '800', color: COLORS.text, marginBottom: 12 },
  importGroupBtn: {
    backgroundColor: 'rgba(59,130,246,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.35)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  importGroupBtnText: { color: COLORS.blue, fontSize: 11, fontWeight: '700' },
  backBtn: { paddingVertical: 2 },
  backText: { color: COLORS.blue, fontSize: 13, fontWeight: '600' },
  scrollContainer: { flex: 1 },
  scrollContent: { padding: 14 },
  emptyText: { color: COLORS.textMuted, fontSize: 12, textAlign: 'center', marginTop: 32 },
  folderList: { gap: 8 },
  folderCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  folderIconInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  folderIcon: { fontSize: 22 },
  folderName: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  folderMeta: { fontSize: 11, color: COLORS.textMuted, marginTop: 1 },
  deleteBtn: { padding: 4 },
  deleteBtnText: { color: '#ef4444', fontSize: 14, fontWeight: '600' },
  imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  imageCard: {
    width: '48%',
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    marginBottom: 4,
  },
  blueprintImage: { width: '100%', height: 110, backgroundColor: '#1e293b' },
  imageName: { fontSize: 11, color: COLORS.text, padding: 6, fontWeight: '500' },
  
  // Modal layout structural components
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  modalBox: {
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderTopWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    height: '82%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: COLORS.border,
    paddingBottom: 10,
    marginBottom: 12,
  },
  modalTitle: { fontSize: 11, fontWeight: '800', color: COLORS.textMuted, letterSpacing: 0.5 },
  closeModalX: { color: COLORS.textMuted, fontSize: 16, fontWeight: '600', paddingHorizontal: 6 },
  modalSubtitle: { color: COLORS.textMuted, fontSize: 12, marginBottom: 12, lineHeight: 16 },
  projectSelectCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  projectSelectName: { color: COLORS.text, fontSize: 14, fontWeight: '700' },
  projectSelectMeta: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
  arrowRight: { color: COLORS.blue, fontSize: 15, fontWeight: '700' },
  backToProjectsBtn: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    paddingVertical: 7,
    alignItems: 'center',
    marginBottom: 10,
  },
  backToProjectsText: { color: COLORS.text, fontSize: 11, fontWeight: '600' },
  browsingTitle: { fontSize: 12, color: COLORS.textMuted, fontWeight: '600' },
  modalSectionHeading: { fontSize: 9, fontWeight: '800', color: COLORS.textMuted, letterSpacing: 0.5, marginTop: 14, marginBottom: 6 },
  modalEmptyText: { color: COLORS.textMuted, fontSize: 11, fontStyle: 'italic', paddingLeft: 4 },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    padding: 10,
    marginBottom: 6,
    gap: 10,
  },
  checkboxRowActive: { borderColor: 'rgba(245,158,11,0.3)', backgroundColor: 'rgba(245,158,11,0.02)' },
  checkbox: { width: 16, height: 16, borderRadius: 4, borderWidth: 1.5, borderColor: COLORS.textMuted, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { width: 9, height: 9, borderRadius: 2, backgroundColor: COLORS.amber },
  checkboxLabel: { color: COLORS.text, fontSize: 13, fontWeight: '500', flex: 1 },
  thumbnail: { width: 28, height: 28, borderRadius: 4, backgroundColor: '#1e293b' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 14, borderTopWidth: 1, borderColor: COLORS.border, paddingTop: 12 },
  modalBtn: { flex: 1, paddingVertical: 11, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  modalBtnCancel: { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: COLORS.border },
  modalBtnCancelText: { color: COLORS.textMuted, fontWeight: '700', fontSize: 13 },
  modalBtnSave: { backgroundColor: 'rgba(245,158,11,0.12)', borderColor: 'rgba(245,158,11,0.35)' },
  modalBtnSaveText: { color: COLORS.amber, fontWeight: '800', fontSize: 13 },
});