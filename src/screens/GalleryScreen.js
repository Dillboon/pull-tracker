import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet,
  TextInput, Modal, Image, Alert, Dimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
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
  const [renamingFolder, setRenamingFolder] = useState(null);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [noteText, setNoteText] = useState('');

  // ── Gesture State ──
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

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

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      // Only allow panning if zoomed in
      if (scale.value > 1) {
        translateX.value = savedTranslateX.value + e.translationX;
        translateY.value = savedTranslateY.value + e.translationY;
      }
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const combinedGesture = Gesture.Simultaneous(pinchGesture, panGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const closeLightbox = () => {
    scale.value = 1;
    savedScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
    setIsEditingNotes(false);
    setLightbox(null);
  };

  // ── CRUD Logic ──
  const submitRename = () => {
    if (!renamingFolder?.name.trim()) return;
    const trimmed = renamingFolder.name.trim();
    setFolders(folders.map(f => f.id === renamingFolder.id ? { ...f, name: trimmed } : f));
    setActiveFolder(prev => prev?.id === renamingFolder.id ? { ...prev, name: trimmed } : prev);
    setRenamingFolder(null);
    showToast('Folder renamed');
  };

  const saveNotes = () => {
    setGalleryImages(galleryImages.map(img => 
      img.id === lightbox.id ? { ...img, notes: noteText } : img
    ));
    setLightbox({ ...lightbox, notes: noteText });
    setIsEditingNotes(false);
    showToast('Notes updated');
  };

  const pickImages = async (folderId) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (result.canceled) return;
    const added = result.assets.map(asset => ({
      id: uid(),
      folderId,
      uri: asset.uri,
      name: `Photo ${today()}`,
      notes: '',
      createdAt: today(),
    }));
    setGalleryImages([...galleryImages, ...added]);
  };

  if (!activeFolder) {
    return (
      <View style={s.container}>
        <View style={s.header}>
          <Text style={s.headerTitle}>Gallery</Text>
          <TouchableOpacity style={s.headerBtn} onPress={() => setNewFolderModal(true)}>
            <Text style={s.headerBtnText}>+ Folder</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          data={folders}
          keyExtractor={f => f.id}
          renderItem={({ item: folder }) => (
            <TouchableOpacity style={s.folderCard} onPress={() => setActiveFolder(folder)}>
              <Text style={{ fontSize: 24 }}>📁</Text>
              <View>
                <Text style={s.folderName}>{folder.name}</Text>
                <Text style={s.folderMeta}>{folder.createdAt}</Text>
              </View>
            </TouchableOpacity>
          )}
          contentContainerStyle={{ padding: 15 }}
        />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={s.container}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => setActiveFolder(null)}><Text style={s.backArrow}>←</Text></TouchableOpacity>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setRenamingFolder({ id: activeFolder.id, name: activeFolder.name })}>
            <Text style={s.headerTitle}>{activeFolder.name}</Text>
            <Text style={s.headerSub}>TAP TO RENAME</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.headerBtn} onPress={() => pickImages(activeFolder.id)}><Text style={s.headerBtnText}>+ Photo</Text></TouchableOpacity>
        </View>

        <FlatList
          data={galleryImages.filter(i => i.folderId === activeFolder.id)}
          numColumns={3}
          keyExtractor={i => i.id}
          renderItem={({ item: img }) => (
            <TouchableOpacity style={s.gridItem} onPress={() => {
              setLightbox(img);
              setNoteText(img.notes);
            }}>
              <Image source={{ uri: img.uri }} style={s.gridImage} />
            </TouchableOpacity>
          )}
        />

        {/* Rename Modal */}
        <Modal visible={!!renamingFolder} transparent animationType="fade">
          <View style={s.modalOverlay}>
            <View style={s.modalBox}>
              <Text style={s.modalTitle}>Rename Folder</Text>
              <TextInput value={renamingFolder?.name} onChangeText={t => setRenamingFolder({...renamingFolder, name: t})} style={s.modalInput} autoFocus />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity style={s.modalBtn} onPress={() => setRenamingFolder(null)}><Text style={{ color: COLORS.textMuted }}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity style={[s.modalBtn, { backgroundColor: COLORS.blue }]} onPress={submitRename}><Text style={{ color: '#fff' }}>Save</Text></TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Lightbox with Restored Notes & Panning */}
        {lightbox && (
          <Modal visible transparent animationType="slide">
            <View style={s.lightbox}>
              <TouchableOpacity style={s.lightboxClose} onPress={closeLightbox}><Text style={s.lightboxCloseText}>✕</Text></TouchableOpacity>
              
              <GestureDetector gesture={combinedGesture}>
                <Animated.Image source={{ uri: lightbox.uri }} style={[s.lightboxImage, animatedStyle]} resizeMode="contain" />
              </GestureDetector>

              <View style={s.noteContainer}>
                {isEditingNotes ? (
                  <View>
                    <TextInput value={noteText} onChangeText={setNoteText} style={s.noteInput} multiline autoFocus />
                    <TouchableOpacity style={s.saveNoteBtn} onPress={saveNotes}><Text style={{ color: '#fff', fontWeight: 'bold' }}>Save Notes</Text></TouchableOpacity>
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ color: '#fff', flex: 1 }}>{lightbox.notes || "No notes added..."}</Text>
                    <TouchableOpacity onPress={() => setIsEditingNotes(true)} style={s.editBtn}>
                      <Text style={{ color: COLORS.blue, fontWeight: 'bold' }}>Edit Notes</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          </Modal>
        )}
      </View>
    </GestureHandlerRootView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { backgroundColor: COLORS.surface, padding: 16, paddingTop: 50, flexDirection: 'row', alignItems: 'center', gap: 15, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  headerSub: { fontSize: 10, color: COLORS.textMuted },
  headerBtn: { backgroundColor: COLORS.blueDim, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  headerBtnText: { color: COLORS.blue, fontWeight: 'bold' },
  backArrow: { color: COLORS.blue, fontSize: 24 },
  folderCard: { backgroundColor: COLORS.surface, borderRadius: 12, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 15, marginBottom: 10 },
  folderName: { color: COLORS.text, fontWeight: 'bold' },
  folderMeta: { color: COLORS.textMuted, fontSize: 11 },
  gridItem: { width: SCREEN_W / 3, height: SCREEN_W / 3, padding: 1 },
  gridImage: { width: '100%', height: '100%' },
  lightbox: { flex: 1, backgroundColor: '#000' },
  lightboxImage: { width: SCREEN_W, height: SCREEN_H - 150 },
  lightboxClose: { position: 'absolute', top: 50, right: 20, zIndex: 10, backgroundColor: 'rgba(255,255,255,0.2)', width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  lightboxCloseText: { color: '#fff', fontSize: 18 },
  noteContainer: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: COLORS.surface, padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  noteInput: { backgroundColor: COLORS.bg, color: COLORS.text, padding: 12, borderRadius: 10, marginBottom: 10, minHeight: 60 },
  saveNoteBtn: { backgroundColor: COLORS.blue, padding: 12, borderRadius: 10, alignItems: 'center' },
  editBtn: { padding: 8, backgroundColor: COLORS.blueDim, borderRadius: 6 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 25 },
  modalBox: { backgroundColor: COLORS.surface, borderRadius: 15, padding: 20 },
  modalTitle: { color: COLORS.text, fontSize: 17, fontWeight: 'bold', marginBottom: 10 },
  modalInput: { backgroundColor: COLORS.bg, color: COLORS.text, padding: 12, borderRadius: 10, marginBottom: 20 },
  modalBtn: { flex: 1, padding: 12, alignItems: 'center', borderRadius: 10 },
});