import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet,
  TextInput, Modal, Image, Alert, Dimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { GestureHandlerRootView, GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { COLORS } from '../theme';
import { uid, today } from '../utils';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export default function GalleryScreen({ folders, galleryImages, setFolders, setGalleryImages, showToast }) {
  const [activeFolder, setActiveFolder] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const [newFolderModal, setNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [editingNotes, setEditingNotes] = useState(null);
  const [renamingFolder, setRenamingFolder] = useState(null);

  // ── Gesture State ────────────────────────────────────────────────────────
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = savedScale.value * e.scale;
    })
    .onEnd(() => {
      if (scale.value < 1) {
        scale.value = withSpring(1);
        savedScale.value = 1;
      } else {
        savedScale.value = scale.value;
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const closeLightbox = () => {
    scale.value = 1;
    savedScale.value = 1;
    setLightbox(null);
  };

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

  const submitRename = () => {
    if (!renamingFolder || !renamingFolder.name.trim()) return;
    const trimmed = renamingFolder.name.trim();
    if (folders.some(f => f.id !== renamingFolder.id && f.name.toLowerCase() === trimmed.toLowerCase())) {
      Alert.alert('Name taken', 'Another folder already has that name.');
      return;
    }
    setFolders(folders.map(f => f.id === renamingFolder.id ? { ...f, name: trimmed } : f));
    setActiveFolder(prev => prev?.id === renamingFolder.id ? { ...prev, name: trimmed } : prev);
    setRenamingFolder(null);
    showToast('Folder renamed');
  };

  const deleteFolder = (folderId) => {
    const count = galleryImages.filter(i => i.folderId === folderId).length;
    Alert.alert('Delete Folder', `Delete folder and ${count} photos?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
        setFolders(prev => prev.filter(f => f.id !== folderId));
        setGalleryImages(prev => prev.filter(i => i.folderId !== folderId));
        setActiveFolder(null);
        showToast('Folder deleted');
      }},
    ]);
  };

  // ── Image CRUD ────────────────────────────────────────────────────────────
  const pickImages = async (folderId) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo library access in Settings.');
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
          id: uid(),
          folderId,
          uri: dest,
          name: asset.fileName?.replace(/\.[^.]+$/, '') || `Photo ${today()}`,
          notes: '',
          createdAt: today(),
        };
      }));
      setGalleryImages([...galleryImages, ...added]);
      showToast(`📷 ${added.length} photos added`);
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
        closeLightbox();
        showToast('Photo deleted');
      }},
    ]);
  };

  if (!activeFolder) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
        <View style={s.header}>
          <View>
            <Text style={s.headerTitle}>Gallery</Text>
            <Text style={s.headerSub}>{folders.length} FOLDER{folders.length !== 1 ? 'S' : ''}</Text>
          </View>
          <TouchableOpacity style={s.headerBtn} onPress={() => setNewFolderModal(true)}>
            <Text style={s.headerBtnText}>+ New Folder</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={folders}
          keyExtractor={f => f.id}
          contentContainerStyle={{ padding: 14, gap: 10 }}
          renderItem={({ item: folder }) => {
            const imgs = galleryImages.filter(i => i.folderId === folder.id);
            const latest = imgs.slice(-3).reverse();
            return (
              <TouchableOpacity style={s.folderCard} onPress={() => setActiveFolder(folder)}>
                <View style={s.thumbStack}>
                  {imgs.length === 0 ? (
                    <View style={s.thumbEmpty}><Text style={{ fontSize: 26 }}>📁</Text></View>
                  ) : (
                    latest.map((img, idx) => (
                      <Image key={img.id} source={{ uri: img.uri }} style={[s.stackThumb, { marginLeft: idx === 0 ? 0 : -22, zIndex: latest.length - idx }]} />
                    ))
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.folderName}>{folder.name}</Text>
                  <Text style={s.folderMeta}>{imgs.length} photos · {folder.createdAt}</Text>
                </View>
                <Text style={{ color: COLORS.textMuted, fontSize: 20 }}>›</Text>
              </TouchableOpacity>
            );
          }}
        />

        <Modal visible={newFolderModal} transparent animationType="fade">
          <View style={s.modalOverlay}>
            <View style={s.modalBox}>
              <Text style={s.modalTitle}>New Folder</Text>
              <TextInput value={newFolderName} onChangeText={setNewFolderName} placeholder="Folder name" placeholderTextColor={COLORS.textDim} style={s.modalInput} autoFocus />
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <TouchableOpacity style={[s.modalBtn, s.modalCancel]} onPress={() => setNewFolderModal(false)}><Text style={{ color: COLORS.textMuted }}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity style={[s.modalBtn, s.modalCreate]} onPress={createFolder}><Text style={{ color: '#fff' }}>Create</Text></TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  const folderImages = galleryImages.filter(i => i.folderId === activeFolder.id);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => setActiveFolder(null)} style={s.backBtn}><Text style={s.backArrow}>←</Text></TouchableOpacity>
        <TouchableOpacity style={{ flex: 1 }} onPress={() => setRenamingFolder({ id: activeFolder.id, name: activeFolder.name })}>
          <Text style={s.headerTitle}>{activeFolder.name}</Text>
          <Text style={s.headerSub}>{folderImages.length} PHOTOS · TAP TO RENAME</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.headerBtn} onPress={() => pickImages(activeFolder.id)}><Text style={s.headerBtnText}>+ Photo</Text></TouchableOpacity>
      </View>

      <FlatList
        data={folderImages}
        keyExtractor={i => i.id}
        contentContainerStyle={{ padding: 12, gap: 10 }}
        renderItem={({ item: img }) => (
          <TouchableOpacity style={s.imageRow} onPress={() => setLightbox(img)}>
            <Image source={{ uri: img.uri }} style={s.rowThumb} />
            <View style={{ flex: 1 }}>
              <Text style={s.imageName}>{img.name}</Text>
              <Text style={s.imageNotes}>{img.notes || 'No notes'}</Text>
            </View>
          </TouchableOpacity>
        )}
      />

      {/* Rename Modal */}
      <Modal visible={!!renamingFolder} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>Rename Folder</Text>
            <TextInput value={renamingFolder?.name} onChangeText={t => setRenamingFolder({...renamingFolder, name: t})} style={s.modalInput} autoFocus />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity style={[s.modalBtn, s.modalCancel]} onPress={() => setRenamingFolder(null)}><Text style={{ color: COLORS.textMuted }}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[s.modalBtn, s.modalCreate]} onPress={submitRename}><Text style={{ color: '#fff' }}>Save</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Lightbox with Gestures */}
      {lightbox && (
        <Modal visible transparent animationType="fade">
          <View style={s.lightbox}>
            <TouchableOpacity style={s.lightboxClose} onPress={closeLightbox}><Text style={s.lightboxCloseText}>✕</Text></TouchableOpacity>
            <GestureDetector gesture={pinchGesture}>
              <Animated.Image source={{ uri: lightbox.uri }} style={[s.lightboxImage, animatedStyle]} resizeMode="contain" />
            </GestureDetector>
            <View style={s.lightboxMeta}>
              <Text style={s.lightboxName}>{lightbox.name}</Text>
              <Text style={s.lightboxNotes}>{lightbox.notes}</Text>
              <TouchableOpacity style={[s.modalBtn, s.lbDeleteBtn]} onPress={() => deleteImage(lightbox.id)}><Text style={{ color: COLORS.red }}>🗑 Delete</Text></TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </GestureHandlerRootView>
  );
}

const s = StyleSheet.create({
  header: { backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text },
  headerSub: { fontSize: 9, fontWeight: '700', color: COLORS.textMuted },
  headerBtn: { backgroundColor: COLORS.blueDim, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  headerBtnText: { color: COLORS.blue, fontWeight: '800' },
  backBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  backArrow: { color: COLORS.blue, fontSize: 18 },
  folderCard: { backgroundColor: COLORS.surface, borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 14 },
  thumbStack: { flexDirection: 'row', width: 80 },
  stackThumb: { width: 46, height: 46, borderRadius: 8, borderWidth: 2, borderColor: COLORS.surface },
  thumbEmpty: { width: 46, height: 46, borderRadius: 8, backgroundColor: COLORS.surface2, alignItems: 'center', justifyContent: 'center' },
  folderName: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  folderMeta: { fontSize: 10, color: COLORS.textMuted },
  imageRow: { backgroundColor: COLORS.surface, borderRadius: 10, padding: 10, flexDirection: 'row', gap: 12 },
  rowThumb: { width: 72, height: 72, borderRadius: 8 },
  imageName: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  imageNotes: { fontSize: 12, color: COLORS.textSub },
  lightbox: { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
  lightboxClose: { position: 'absolute', top: 50, right: 20, zIndex: 10, width: 40, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20 },
  lightboxCloseText: { color: '#fff', fontSize: 20 },
  lightboxImage: { width: SCREEN_W, height: SCREEN_H * 0.7 },
  lightboxMeta: { backgroundColor: COLORS.surface, padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  lightboxName: { color: COLORS.text, fontWeight: 'bold' },
  lightboxNotes: { color: COLORS.textSub, marginVertical: 10 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 },
  modalBox: { backgroundColor: COLORS.surface, borderRadius: 15, padding: 20 },
  modalTitle: { color: COLORS.text, fontSize: 18, fontWeight: 'bold' },
  modalInput: { backgroundColor: COLORS.surface2, color: COLORS.text, padding: 12, borderRadius: 8, marginTop: 10 },
  modalBtn: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center' },
  modalCreate: { backgroundColor: COLORS.blue },
  lbDeleteBtn: { marginTop: 10, borderWidth: 1, borderColor: COLORS.red },
});