import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../theme';

export default function Toast({ msg, type = 'info', onUndo }) {
  const isError = type === 'error';
  return (
    <View style={[s.toast, isError ? s.toastError : s.toastInfo]}>
      <Text style={s.toastText}>{msg}</Text>
      {onUndo && (
        <TouchableOpacity onPress={onUndo} style={s.undoBtn} activeOpacity={0.7}>
          <Text style={s.undoText}>UNDO</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  toast: {
    position: 'absolute',
    top: 16,
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  toastInfo:  { backgroundColor: '#1a2744', borderColor: COLORS.blue },
  toastError: { backgroundColor: '#7f1d1d', borderColor: COLORS.red  },
  toastText:  { color: COLORS.text, fontSize: 13, fontWeight: '600' },
  undoBtn: {
    backgroundColor: 'rgba(59,130,246,0.25)',
    borderRadius: 5, paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(59,130,246,0.5)',
  },
  undoText: { color: COLORS.blue, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
});
