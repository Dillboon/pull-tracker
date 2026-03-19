import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet,
  TextInput, Modal, Image, Alert, Dimensions,
  Animated, PanResponder,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { COLORS } from '../theme';
import { uid, today } from '../utils';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ─── Zoomable Image (pinch-to-zoom + pan, Android-safe) ──────────────────────
function ZoomableImage({ uri }) {
  const scale    = React.useRef(new Animated.Value(1)).current;
  const translateX = React.useRef(new Animated.Value(0)).current;
  const translateY = React.useRef(new Animated.Value(0)).current;

  // Raw tracked values outside Animated (for calculations)
  const state = React.useRef({
    scale: 1,
    tx: 0,
    ty: 0,
    lastScale: 1,
    lastTx: 0,
    lastTy: 0,
    initialDistance: null,
    initialMidX: 0,
    initialMidY: 0,
  }).current;

  const getDistance = (touches) => {
    const dx = touches[0].pageX - touches[1].pageX;
    const dy = touches[0].pageY - touches[1].pageY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getMid = (touches) => ({
    x: (touches[0].pageX + touches[1].pageX) / 2,
    y: (touches[0].pageY + touches[1].pageY) / 2,
  });

  const panResponder = React.useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,
    onPanResponderGrant: (evt) => {
      state.lastScale = state.scale;
      state.lastTx    = state.tx;
      state.lastTy    = state.ty;
      state.initialDistance = null;
    },
    onPanResponderMove: (evt, gestureState) => {
      const touches = evt.nativeEvent.touches;

      if (touches.length === 2) {
        // ── Pinch ──
        const dist = getDistance(touches);
        const mid  = getMid(touches);

        if (state.initialDistance === null) {
          state.initialDistance = dist;
          state.initialMidX     = mid.x;
          state.initialMidY     = mid.y;
          return;
        }

        const newScale = Math.max(1, Math.min(state.lastScale * (dist / state.initialDistance), 5));
        state.scale = newScale;
        scale.setValue(newScale);

        // Pan to keep pinch midpoint stable
        const newTx = state.lastTx + (mid.x - state.initialMidX);
        const newTy = state.lastTy + (mid.y - state.initialMidY);
        state.tx = newTx;
        state.ty = newTy;
        translateX.setValue(newTx);
        translateY.setValue(newTy);

      } else if (touches.length === 1 && state.scale > 1) {
        // ── Pan (only when zoomed in) ──
        state.tx = state.lastTx + gestureState.dx;
        state.ty = state.lastTy + gestureState.dy;
        translateX.setValue(state.tx);
        translateY.setValue(state.ty);
      }
    },
    onPanResponderRelease: () => {
      // Snap back to fit if scale went below 1
      if (state.scale <= 1) {
        state.scale = 1;
        state.tx    = 0;
        state.ty    = 0;
        Animated.parallel([
          Animated.spring(scale,      { toValue: 1, useNativeDriver: true }),
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }),
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true }),
        ]).start();
      }
      state.lastScale = state.scale;
      state.lastTx    = state.tx;
      state.lastTy    = state.ty;
      state.initialDistance = null;
    },
  })).current;

  // Double-tap to reset
  const lastTap = React.useRef(0);
  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      state.scale = 1; state.tx = 0; state.ty = 0;
      state.lastScale = 1; state.lastTx = 0; state.lastTy = 0;
      Animated.parallel([
        Animated.spring(scale,      { toValue: 1, useNativeDriver: true }),
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true }),
      ]).start();
    }
    lastTap.current = now;
  };

  return (
    <View
      style={{ width: SCREEN_W, height: SCREEN_H * 0.62, marginTop: 60, overflow: 'hidden' }}
      {...panResponder.panHandlers}
      onTouchEnd={handleDoubleTap}
    >
      <Animated.Image
        source={{ uri }}
        style={{
          width: SCREEN_W,
          height: SCREEN_H * 0.62,
          transform: [{ scale }, { translateX }, { translateY }],
        }}
        resizeMode="contain"
      />
    </View>
  );
}

export default function GalleryScreen({ folders, galleryImages, setFolders, setGalleryImages, showToast }) {
  const [activeFolder,  setActiveFolder]  = useState(null);
  const [lightbox,      setLightbox]      = useState(null);
  const [newFolderModal,setNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [editingNotes,  setEditingNotes]  = useState(null); // { imageId, notes }
  const [renamingFolder, setRenamingFolder] = useState(null); // { id, name }

  // ── Folder CRUD ───────────────────────────────────────────────────────────
  const createFolder = () => {
    const name = newFolderName.trim();
    if (!name) return;
    if (folders.some(f => f.name.toLowerCase() === name.toLowerCase())) {
      Alert.alert('Name taken', 'A folder with that name already exists.');
      return;
    }
    setFolders([...folders, { id: uid(), name, createdAt: today() }]);
    setNewFolderName('');
    setNewFolderModal(false);
    showToast('📁 Folder created');
  };

  const deleteFolder = (folderId) => {
    const count = galleryImages.filter(i => i.folderId === folderId).length;
    Alert.alert(
      'Delete Folder',
      `Delete this folder and its ${count} photo${count !== 1 ? 's' : ''}? Cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => {
          setFolders(folders.filter(f => f.id !== folderId));
          setGalleryImages(galleryImages.filter(i => i.folderId !== folderId));
          setActiveFolder(null);
          showToast('Folder deleted');
        }},
      ]
    );
  };

  const submitRename = () => {
    if (!renamingFolder || !renamingFolder.name.trim()) return;

    const trimmed = renamingFolder.name.trim();

    // Check if the new name is taken by a DIFFERENT folder
    if (folders.some(f => f.id !== renamingFolder.id && f.name.toLowerCase() === trimmed.toLowerCase())) {
      Alert.alert('Name taken', 'Another folder already has that name.');
      return;
    }

    // Update the master folder list
    const updated = folders.map(f => 
      f.id === renamingFolder.id ? { ...f, name: trimmed } : f
    );
    setFolders(updated);

    // Keep the header updated if we are currently inside that folder
    setActiveFolder(prev => 
      prev?.id === renamingFolder.id ? { ...prev, name: trimmed } : prev
    );

    // Close modal and notify
    setRenamingFolder(null);
    showToast('Folder renamed');
  };
  
  // ── Image CRUD ────────────────────────────────────────────────────────────
  const pickImages = async (folderId) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo library access in your device Settings.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.85,
    });
    if (result.canceled) return;

    try {
      const added = await Promise.all(result.assets.map(async (asset) => {
        const filename = `gallery-${uid()}.jpg`;
        const dest = FileSystem.documentDirectory + filename;
        await FileSystem.copyAsync({ from: asset.uri, to: dest });
        return {
          id:        uid(),
          folderId,
          uri:       dest,
          name:      asset.fileName?.replace(/\.[^.]+$/, '') || `Photo ${today()}`,
          notes:     '',
          createdAt: today(),
        };
      }));
      setGalleryImages([...galleryImages, ...added]);
      showToast(`📷 ${added.length} photo${added.length !== 1 ? 's' : ''} added`);
    } catch (e) {
      showToast('Failed to save photos', 'error');
    }
  };

  const updateNotes = (imageId, notes) => {
    setGalleryImages(galleryImages.map(i => i.id === imageId ? { ...i, notes } : i));
  };

  const deleteImage = (imageId) => {
    Alert.alert('Delete Photo', 'Remove this photo permanently?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
        setGalleryImages(galleryImages.filter(i => i.id !== imageId));
        setLightbox(null);
        showToast('Photo deleted');
      }},
    ]);
  };

  // ── Folder list (root view) ───────────────────────────────────────────────
  if (!activeFolder) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
        <View style={s.header}>
          <View>
            <Text style={s.headerTitle}>Gallery</Text>
            <Text style={s.headerSub}>{folders.length} FOLDER{folders.length !== 1 ? 'S' : ''}</Text>
          </View>
          <TouchableOpacity style={s.headerBtn} onPress={() => setNewFolderModal(true)} activeOpacity={0.8}>
            <Text style={s.headerBtnText}>+ New Folder</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={folders}
          keyExtractor={f => f.id}
          contentContainerStyle={{ padding: 14, paddingBottom: 40, gap: 10 }}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={{ fontSize: 48 }}>🗂</Text>
              <Text style={s.emptyTitle}>No folders yet</Text>
              <Text style={s.emptyHint}>Organize job photos by area, room, or purpose</Text>
              <TouchableOpacity style={s.emptyBtn} onPress={() => setNewFolderModal(true)}>
                <Text style={s.emptyBtnText}>+ Create Folder</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item: folder }) => {
            const imgs   = galleryImages.filter(i => i.folderId === folder.id);
            const latest = imgs.slice(-3).reverse();
            return (
              <TouchableOpacity style={s.folderCard} onPress={() => setActiveFolder(folder)} activeOpacity={0.75}>
                {/* Stacked thumbnail preview */}
                <View style={s.thumbStack}>
                  {imgs.length === 0 ? (
                    <View style={s.thumbEmpty}><Text style={{ fontSize: 26 }}>📁</Text></View>
                  ) : (
                    latest.map((img, idx) => (
                      <Image
                        key={img.id}
                        source={{ uri: img.uri }}
                        style={[s.stackThumb, {
                          marginLeft: idx === 0 ? 0 : -22,
                          zIndex: latest.length - idx,
                          opacity: idx === 0 ? 1 : idx === 1 ? 0.75 : 0.5,
                        }]}
                      />
                    ))
                  )}
                </View>

                {/* Folder info */}
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={s.folderName} numberOfLines={1}>{folder.name}</Text>
                  <Text style={s.folderMeta}>
                    {imgs.length} photo{imgs.length !== 1 ? 's' : ''}  ·  Created {folder.createdAt}
                  </Text>
                  {imgs.length > 0 && imgs[imgs.length - 1].notes ? (
                    <Text style={s.folderLatestNote} numberOfLines={1}>
                      Latest: {imgs[imgs.length - 1].notes}
                    </Text>
                  ) : null}
                </View>

                <Text style={{ color: COLORS.textMuted, fontSize: 20, paddingLeft: 4 }}>›</Text>
              </TouchableOpacity>
            );
          }}
        />

        {/* Rename folder modal */}
        <Modal visible={!!renamingFolder} transparent animationType="fade" onRequestClose={() => setRenamingFolder(null)}>
          <View style={s.modalOverlay}>
            <View style={s.modalBox}>
              <Text style={s.modalTitle}>Rename Folder</Text>
              <TextInput
                value={renamingFolder?.name ?? ''}
                onChangeText={t => setRenamingFolder(prev => ({ ...prev, name: t }))}
                placeholder="Folder name"
                placeholderTextColor={COLORS.textDim}
                style={s.modalInput}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={submitRename}
              />
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <TouchableOpacity style={[s.modalBtn, s.modalCancel]} onPress={() => setRenamingFolder(null)}>
                  <Text style={{ color: COLORS.textMuted, fontWeight: '700' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.modalBtn, s.modalCreate, !renamingFolder?.name?.trim() && { opacity: 0.4 }]}
                  disabled={!renamingFolder?.name?.trim()}
                  onPress={submitRename}>
                  <Text style={{ color: '#fff', fontWeight: '800' }}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* New folder modal */}
        <Modal visible={newFolderModal} transparent animationType="fade" onRequestClose={() => setNewFolderModal(false)}>
          <View style={s.modalOverlay}>
            <View style={s.modalBox}>
              <Text style={s.modalTitle}>New Folder</Text>
              <Text style={s.modalHint}>Name by area, floor, panel, or purpose.</Text>
              <TextInput
                value={newFolderName}
                onChangeText={setNewFolderName}
                placeholder="e.g. Panel Room, Floor 2, Roof"
                placeholderTextColor={COLORS.textDim}
                style={s.modalInput}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={createFolder}
              />
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <TouchableOpacity style={[s.modalBtn, s.modalCancel]}
                  onPress={() => { setNewFolderModal(false); setNewFolderName(''); }}>
                  <Text style={{ color: COLORS.textMuted, fontWeight: '700' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.modalBtn, s.modalCreate, !newFolderName.trim() && { opacity: 0.4 }]}
                  onPress={createFolder} disabled={!newFolderName.trim()}>
                  <Text style={{ color: '#fff', fontWeight: '800' }}>Create</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // ── Inside a folder ───────────────────────────────────────────────────────
  const folderImages = galleryImages.filter(i => i.folderId === activeFolder.id);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      {/* Folder header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => setActiveFolder(null)} style={s.backBtn} activeOpacity={0.7}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ flex: 1 }} onPress={() => setRenamingFolder({ id: activeFolder.id, name: activeFolder.name })}>
          <Text style={s.headerTitle} numberOfLines={1}>{activeFolder.name}</Text>
          <Text style={s.headerSub}>{folderImages.length} PHOTO{folderImages.length !== 1 ? 'S' : ''}  ·  TAP TO RENAME</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.headerBtn, { backgroundColor: COLORS.redDim, borderColor: 'rgba(239,68,68,0.3)' }]}
          onPress={() => deleteFolder(activeFolder.id)}>
          <Text style={{ color: COLORS.red, fontWeight: '700', fontSize: 13 }}>🗑</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.headerBtn} onPress={() => pickImages(activeFolder.id)} activeOpacity={0.8}>
          <Text style={s.headerBtnText}>+ Photo</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={folderImages}
        keyExtractor={i => i.id}
        contentContainerStyle={{ padding: 12, paddingBottom: 40, gap: 10 }}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={{ fontSize: 44 }}>📷</Text>
            <Text style={s.emptyTitle}>No photos yet</Text>
            <Text style={s.emptyHint}>Tap "+ Photo" to add from your library</Text>
          </View>
        }
        renderItem={({ item: img }) => (
          <TouchableOpacity style={s.imageRow} onPress={() => setLightbox(img)} activeOpacity={0.8}>
            <Image source={{ uri: img.uri }} style={s.rowThumb} />
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={s.imageName} numberOfLines={1}>{img.name}</Text>
              <Text style={s.imageDate}>{img.createdAt}</Text>
              {img.notes ? (
                <Text style={s.imageNotes} numberOfLines={3}>{img.notes}</Text>
              ) : (
                <TouchableOpacity onPress={() => setEditingNotes({ imageId: img.id, notes: '' })}>
                  <Text style={s.addNotesBtn}>+ Add notes</Text>
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              style={s.editNotesBtn}
              onPress={() => setEditingNotes({ imageId: img.id, notes: img.notes })}>
              <Text style={{ color: COLORS.textMuted, fontSize: 14 }}>✏</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        )}
      />

      {/* Edit notes modal */}
      {editingNotes && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setEditingNotes(null)}>
          <View style={s.modalOverlay}>
            <View style={s.modalBox}>
              <Text style={s.modalTitle}>Photo Notes</Text>
              <Text style={s.modalHint}>Location, what's shown, issues, panel info…</Text>
              <TextInput
                value={editingNotes.notes}
                onChangeText={t => setEditingNotes({ ...editingNotes, notes: t })}
                placeholder="e.g. North wall panel, circuits 1-20"
                placeholderTextColor={COLORS.textDim}
                style={[s.modalInput, { minHeight: 90, textAlignVertical: 'top' }]}
                multiline
                autoFocus
              />
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <TouchableOpacity style={[s.modalBtn, s.modalCancel]} onPress={() => setEditingNotes(null)}>
                  <Text style={{ color: COLORS.textMuted, fontWeight: '700' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.modalBtn, s.modalCreate]}
                  onPress={() => { updateNotes(editingNotes.imageId, editingNotes.notes); setEditingNotes(null); }}>
                  <Text style={{ color: '#fff', fontWeight: '800' }}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Lightbox */}
      {lightbox && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setLightbox(null)}>
          <View style={s.lightbox}>
            <TouchableOpacity style={s.lightboxClose} onPress={() => setLightbox(null)}>
              <Text style={s.lightboxCloseText}>✕</Text>
            </TouchableOpacity>

            <ZoomableImage uri={lightbox.uri} />

            <View style={s.lightboxMeta}>
              <Text style={s.lightboxName}>{lightbox.name}</Text>
              <Text style={s.lightboxDate}>{lightbox.createdAt}</Text>
              {lightbox.notes ? (
                <Text style={s.lightboxNotes}>{lightbox.notes}</Text>
              ) : (
                <Text style={{ color: COLORS.textMuted, fontSize: 12, fontStyle: 'italic' }}>No notes</Text>
              )}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                <TouchableOpacity
                  style={[s.modalBtn, s.lbEditBtn]}
                  onPress={() => { setEditingNotes({ imageId: lightbox.id, notes: lightbox.notes }); setLightbox(null); }}>
                  <Text style={{ color: COLORS.amber, fontWeight: '700' }}>✏  Edit Notes</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.modalBtn, s.lbDeleteBtn]}
                  onPress={() => deleteImage(lightbox.id)}>
                  <Text style={{ color: COLORS.red, fontWeight: '700' }}>🗑  Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text, letterSpacing: -0.2 },
  headerSub:   { fontSize: 9,  fontWeight: '700', color: COLORS.textMuted, letterSpacing: 1, marginTop: 1 },
  headerBtn: {
    backgroundColor: COLORS.blueDim,
    borderWidth: 1, borderColor: 'rgba(59,130,246,0.4)',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7,
  },
  headerBtnText: { color: COLORS.blue, fontWeight: '800', fontSize: 12 },
  backBtn: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8, width: 34, height: 34,
    alignItems: 'center', justifyContent: 'center',
  },
  backArrow: { color: COLORS.blue, fontSize: 18, fontWeight: '700' },

  // ── Folder cards ──────────────────────────────────────────────────────────
  folderCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  thumbStack:  { flexDirection: 'row', alignItems: 'center', width: 80 },
  stackThumb:  { width: 46, height: 46, borderRadius: 8, borderWidth: 2, borderColor: COLORS.surface },
  thumbEmpty:  { width: 46, height: 46, borderRadius: 8, backgroundColor: COLORS.surface2, alignItems: 'center', justifyContent: 'center' },
  folderName:  { fontSize: 15, fontWeight: '800', color: COLORS.text },
  folderMeta:  { fontSize: 10, color: COLORS.textMuted },
  folderLatestNote: { fontSize: 11, color: COLORS.textSub, fontStyle: 'italic' },

  // ── Image rows ────────────────────────────────────────────────────────────
  imageRow: {
    backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 10,
    padding: 10,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  rowThumb:     { width: 72, height: 72, borderRadius: 8, backgroundColor: COLORS.surface2 },
  imageName:    { fontSize: 13, fontWeight: '700', color: COLORS.text },
  imageDate:    { fontSize: 10, color: COLORS.textMuted },
  imageNotes:   { fontSize: 12, color: COLORS.textSub, lineHeight: 17 },
  addNotesBtn:  { fontSize: 11, color: COLORS.blue, fontWeight: '600' },
  editNotesBtn: {
    padding: 6, backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 6, borderWidth: 1, borderColor: COLORS.border,
  },

  // ── Lightbox ──────────────────────────────────────────────────────────────
  lightbox: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.96)',
    justifyContent: 'space-between',
  },
  lightboxClose: {
    position: 'absolute', top: 48, right: 20, zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 20, width: 36, height: 36,
    alignItems: 'center', justifyContent: 'center',
  },
  lightboxCloseText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  lightboxMeta: {
    backgroundColor: COLORS.surface,
    borderTopWidth: 1, borderTopColor: COLORS.border,
    padding: 16, gap: 4,
  },
  lightboxName:  { fontSize: 15, fontWeight: '800', color: COLORS.text },
  lightboxDate:  { fontSize: 10, color: COLORS.textMuted, marginBottom: 4 },
  lightboxNotes: { fontSize: 13, color: COLORS.textSub, lineHeight: 19 },
  lbEditBtn:   { flex: 1, backgroundColor: COLORS.amberDim, borderWidth: 1, borderColor: 'rgba(245,158,11,0.4)' },
  lbDeleteBtn: { flex: 1, backgroundColor: COLORS.redDim,   borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)'  },

  // ── Empty states ──────────────────────────────────────────────────────────
  empty:        { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyTitle:   { fontSize: 18, fontWeight: '800', color: COLORS.textDim },
  emptyHint:    { fontSize: 12, color: COLORS.textDim, textAlign: 'center', paddingHorizontal: 40 },
  emptyBtn:     { marginTop: 8, backgroundColor: COLORS.blue, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 },
  emptyBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  // ── Modals ────────────────────────────────────────────────────────────────
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalBox:     { backgroundColor: COLORS.surface, borderRadius: 14, padding: 20, width: '100%', borderWidth: 1, borderColor: COLORS.borderHi },
  modalTitle:   { fontSize: 17, fontWeight: '800', color: COLORS.text, marginBottom: 4 },
  modalHint:    { fontSize: 11, color: COLORS.textMuted, marginBottom: 14 },
  modalInput:   { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 12, color: COLORS.text, fontSize: 13 },
  modalBtn:     { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center' },
  modalCancel:  { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: COLORS.border },
  modalCreate:  { backgroundColor: COLORS.blue },
});
