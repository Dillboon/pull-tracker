import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet,
  TextInput, Modal, Image, Alert, Dimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import { COLORS } from '../theme';
import { uid, today } from '../utils';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export default function GalleryScreen({ folders, galleryImages, setFolders, setGalleryImages, showToast, deleteFolderWithImages }) {
  const [activeFolder,  setActiveFolder]  = useState(null);
  const [lightbox,      setLightbox]      = useState(null);
  const [newFolderModal,setNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [editingNotes,  setEditingNotes]  = useState(null); // { imageId, notes }
  const [renamingFolder, setRenamingFolder] = useState(null); // { id, name }
  const [reorderMode,    setReorderMode]    = useState(false);
  const renameInputRef = useRef(null);

  // ── Lightbox navigation helpers ───────────────────────────────────────────
  const resetGesture = () => {
    scale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
  };

  const folderImages = activeFolder
    ? galleryImages.filter(i => i.folderId === activeFolder.id)
    : [];

  const lightboxIndex = lightbox
    ? folderImages.findIndex(i => i.id === lightbox.id)
    : -1;

  const goToImage = (img) => {
    resetGesture();
    setLightbox(img);
  };

  // ── Image reorder ─────────────────────────────────────────────────────────
  const moveImage = (imageId, direction) => {
    const ids = folderImages.map(i => i.id);
    const idx = ids.indexOf(imageId);
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= ids.length) return;
    // Swap in the full galleryImages array
    const next = [...galleryImages];
    const aPos = next.findIndex(i => i.id === ids[idx]);
    const bPos = next.findIndex(i => i.id === ids[newIdx]);
    [next[aPos], next[bPos]] = [next[bPos], next[aPos]];
    setGalleryImages(next);
  };

  // ── Reanimated Shared Values for Gestures ─────────────────────────────────
  const scale = useSharedValue(1);
  const baseScale = useSharedValue(1);
  const initialFocal = useSharedValue({ x: 0, y: 0 });
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const context = useSharedValue({ x: 0, y: 0 });

  const pinchGesture = Gesture.Pinch()
    .onStart((event) => {
      baseScale.value = scale.value;
      initialFocal.value = { x: event.focalX, y: event.focalY };
    })
    .onUpdate((event) => {
      scale.value = baseScale.value * event.scale;
    })
    .onEnd(() => {
      if (scale.value < 1) {
        scale.value = withSpring(1);
      } else if (scale.value > 4) {
        scale.value = withSpring(4);
      }
    });

  const panGesture = Gesture.Pan()
    .onStart(() => {
      context.value = { x: translateX.value, y: translateY.value };
    })
    .onUpdate((event) => {
      if (scale.value > 1) {
        translateX.value = context.value.x + event.translationX;
        translateY.value = context.value.y + event.translationY;
      }
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      scale.value = withSpring(1);
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
    });

  const combinedGesture = Gesture.Race(
    Gesture.Simultaneous(pinchGesture, panGesture),
    doubleTapGesture
  );

  const animatedImageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

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
          deleteFolderWithImages(folderId);
          setActiveFolder(null);
          showToast('Folder deleted');
        }},
      ]
    );
  };

  const renameFolder = (folderId, currentName) => {
    setRenamingFolder({ id: folderId, name: currentName });
  };

  const submitRename = () => {
    const trimmed = renamingFolder?.name?.trim();
    if (!trimmed) { setRenamingFolder(null); return; }
    if (folders.some(f => f.id !== renamingFolder.id && f.name.toLowerCase() === trimmed.toLowerCase())) {
      Alert.alert('Name taken', 'Another folder already has that name.');
      return;
    }
    setFolders(folders.map(f => f.id === renamingFolder.id ? { ...f, name: trimmed } : f));
    setActiveFolder(prev => prev?.id === renamingFolder.id ? { ...prev, name: trimmed } : prev);
    setRenamingFolder(null);
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

  const saveImageToDevice = async (img) => {
    try {
      // Check existing permission first to avoid showing a system dialog
      // over the lightbox Modal (which dismisses it on Android)
      let { status } = await MediaLibrary.getPermissionsAsync();
      if (status !== 'granted') {
        const result = await MediaLibrary.requestPermissionsAsync();
        status = result.status;
      }
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow media library access in your device Settings to save photos.');
        return;
      }
      await MediaLibrary.createAssetAsync(img.uri);
      showToast('📥 Photo saved to device');
    } catch (e) {
      showToast('Failed to save photo', 'error');
    }
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
        <Modal
          visible={!!renamingFolder}
          transparent
          animationType="fade"
          onRequestClose={() => setRenamingFolder(null)}
          onShow={() => renameInputRef.current?.focus()}
        >
          <View style={s.modalOverlay}>
            <View style={s.modalBox}>
              <Text style={s.modalTitle}>Rename Folder</Text>
              <TextInput
                ref={renameInputRef}
                value={renamingFolder?.name ?? ''}
                onChangeText={t => setRenamingFolder(prev => ({ ...prev, name: t }))}
                placeholder="Folder name"
                placeholderTextColor={COLORS.textDim}
                style={s.modalInput}
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

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      {/* Folder header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => { setActiveFolder(null); setReorderMode(false); }} style={s.backBtn} activeOpacity={0.7}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ flex: 1 }} onPress={() => renameFolder(activeFolder.id, activeFolder.name)}>
          <Text style={s.headerTitle} numberOfLines={1}>{activeFolder.name}</Text>
          <Text style={s.headerSub}>{folderImages.length} PHOTO{folderImages.length !== 1 ? 'S' : ''}  ·  TAP TO RENAME</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.headerBtn, reorderMode && { backgroundColor: COLORS.blueDim, borderColor: 'rgba(59,130,246,0.4)' }]}
          onPress={() => setReorderMode(v => !v)}
          activeOpacity={0.8}>
          <Text style={[s.headerBtnText, reorderMode && { color: COLORS.blue }]}>⇅</Text>
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
        renderItem={({ item: img, index }) => (
          <TouchableOpacity
            style={s.imageRow}
            onPress={() => {
              if (reorderMode) return;
              resetGesture();
              setLightbox(img);
            }}
            activeOpacity={reorderMode ? 1 : 0.8}
          >
            <Image source={{ uri: img.uri }} style={s.rowThumb} />
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={s.imageName} numberOfLines={1}>{img.name}</Text>
              <Text style={s.imageDate}>{img.createdAt}</Text>
              {img.notes ? (
                <Text style={s.imageNotes} numberOfLines={3}>{img.notes}</Text>
              ) : (
                !reorderMode && (
                  <TouchableOpacity onPress={() => setEditingNotes({ imageId: img.id, notes: '' })}>
                    <Text style={s.addNotesBtn}>+ Add notes</Text>
                  </TouchableOpacity>
                )
              )}
            </View>
            {reorderMode ? (
              <View style={s.reorderBtns}>
                <TouchableOpacity
                  style={[s.reorderBtn, index === 0 && s.reorderBtnDisabled]}
                  onPress={() => moveImage(img.id, -1)}
                  disabled={index === 0}
                >
                  <Text style={[s.reorderBtnText, index === 0 && { opacity: 0.25 }]}>↑</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.reorderBtn, index === folderImages.length - 1 && s.reorderBtnDisabled]}
                  onPress={() => moveImage(img.id, 1)}
                  disabled={index === folderImages.length - 1}
                >
                  <Text style={[s.reorderBtnText, index === folderImages.length - 1 && { opacity: 0.25 }]}>↓</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={s.editNotesBtn}
                onPress={() => setEditingNotes({ imageId: img.id, notes: img.notes })}>
                <Text style={{ color: COLORS.textMuted, fontSize: 14 }}>✏</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        )}
      />

      {/* Rename folder modal (also needed here — modal lives in component state,
          not tied to which branch is active) */}
      <Modal
        visible={!!renamingFolder}
        transparent
        animationType="fade"
        onRequestClose={() => setRenamingFolder(null)}
        onShow={() => renameInputRef.current?.focus()}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>Rename Folder</Text>
            <TextInput
              ref={renameInputRef}
              value={renamingFolder?.name ?? ''}
              onChangeText={t => setRenamingFolder(prev => ({ ...prev, name: t }))}
              placeholder="Folder name"
              placeholderTextColor={COLORS.textDim}
              style={s.modalInput}
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
        <Modal visible transparent animationType="fade" onRequestClose={() => {
          scale.value = 1;
          translateX.value = 0;
          translateY.value = 0;
          setLightbox(null);
        }}>
          {/*
            Android renders Modal in a separate native window, completely outside
            the app's GestureHandlerRootView. Without this second root, the
            GestureDetector has nothing to attach to and silently ignores all touches.
          */}
          <GestureHandlerRootView style={{ flex: 1 }}>
            <View style={s.lightbox}>

              {/* ── Gesture zone: image only ──────────────────────────────── */}
              <GestureDetector gesture={combinedGesture}>
                <Animated.View style={s.imageCenterContainer}>
                  <Animated.Image
                    source={{ uri: lightbox.uri }}
                    style={[s.lightboxImage, animatedImageStyle]}
                    resizeMode="contain"
                  />
                </Animated.View>
              </GestureDetector>

              {/* ── Close button (outside GestureDetector — no touch conflicts) */}
              <TouchableOpacity
                style={s.lightboxClose}
                onPress={() => {
                  scale.value = 1;
                  translateX.value = 0;
                  translateY.value = 0;
                  setLightbox(null);
                }}
              >
                <Text style={s.lightboxCloseText}>✕</Text>
              </TouchableOpacity>

              {/* ── Meta panel (outside GestureDetector — buttons work normally) */}
              <View style={s.lightboxMeta}>
                {/* Navigation row */}
                {folderImages.length > 1 && (
                  <View style={s.lightboxNavRow}>
                    <TouchableOpacity
                      style={[s.lightboxNavBtn, lightboxIndex === 0 && s.lightboxNavBtnDisabled]}
                      onPress={() => lightboxIndex > 0 && goToImage(folderImages[lightboxIndex - 1])}
                      disabled={lightboxIndex === 0}
                    >
                      <Text style={[s.lightboxNavText, lightboxIndex === 0 && { opacity: 0.25 }]}>←</Text>
                    </TouchableOpacity>
                    <Text style={s.lightboxCounter}>
                      {lightboxIndex + 1} / {folderImages.length}
                    </Text>
                    <TouchableOpacity
                      style={[s.lightboxNavBtn, lightboxIndex === folderImages.length - 1 && s.lightboxNavBtnDisabled]}
                      onPress={() => lightboxIndex < folderImages.length - 1 && goToImage(folderImages[lightboxIndex + 1])}
                      disabled={lightboxIndex === folderImages.length - 1}
                    >
                      <Text style={[s.lightboxNavText, lightboxIndex === folderImages.length - 1 && { opacity: 0.25 }]}>→</Text>
                    </TouchableOpacity>
                  </View>
                )}
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
                    onPress={() => {
                      setEditingNotes({ imageId: lightbox.id, notes: lightbox.notes });
                      setLightbox(null);
                    }}>
                    <Text style={{ color: COLORS.amber, fontWeight: '700' }}>✏  Edit Notes</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.modalBtn, s.lbSaveBtn]}
                    onPress={() => saveImageToDevice(lightbox)}>
                    <Text style={{ color: COLORS.blue, fontWeight: '700' }}>📥  Save</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.modalBtn, s.lbDeleteBtn]}
                    onPress={() => deleteImage(lightbox.id)}>
                    <Text style={{ color: COLORS.red, fontWeight: '700' }}>🗑</Text>
                  </TouchableOpacity>
                </View>
              </View>

            </View>
          </GestureHandlerRootView>
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
  },
  imageCenterContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 170,
  },
  lightboxClose: {
    position: 'absolute', top: 48, right: 20, zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 20, width: 36, height: 36,
    alignItems: 'center', justifyContent: 'center',
  },
  lightboxCloseText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  lightboxImage: { width: SCREEN_W, height: SCREEN_H * 0.62 },
  lightboxMeta: {
    backgroundColor: COLORS.surface,
    borderTopWidth: 1, borderTopColor: COLORS.border,
    padding: 16, gap: 4,
    position: 'absolute', bottom: 0, left: 0, right: 0,
  },
  lightboxName:  { fontSize: 15, fontWeight: '800', color: COLORS.text },
  lightboxDate:  { fontSize: 10, color: COLORS.textMuted, marginBottom: 4 },
  lightboxNotes: { fontSize: 13, color: COLORS.textSub, lineHeight: 19 },
  lbEditBtn:   { flex: 1, backgroundColor: COLORS.amberDim, borderWidth: 1, borderColor: 'rgba(245,158,11,0.4)' },
  lbSaveBtn:   { flex: 1, backgroundColor: COLORS.blueDim,  borderWidth: 1, borderColor: 'rgba(59,130,246,0.4)'  },
  lbDeleteBtn: { flex: 0, paddingHorizontal: 14, backgroundColor: COLORS.redDim, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' },

  // ── Lightbox navigation ───────────────────────────────────────────────────
  lightboxNavRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 10,
  },
  lightboxNavBtn: {
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 8,
    width: 40, height: 36, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  lightboxNavBtnDisabled: { opacity: 0.4 },
  lightboxNavText:   { color: COLORS.blue, fontSize: 18, fontWeight: '700' },
  lightboxCounter:   { fontSize: 12, fontWeight: '700', color: COLORS.textMuted },

  // ── Reorder controls ──────────────────────────────────────────────────────
  reorderBtns: { flexDirection: 'column', gap: 4 },
  reorderBtn: {
    backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 6,
    width: 34, height: 30, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  reorderBtnDisabled: { opacity: 0.4 },
  reorderBtnText: { color: COLORS.blue, fontSize: 16, fontWeight: '800' },

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