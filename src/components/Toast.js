import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../theme';

export default function Toast({ msg, type = 'info' }) {
  const isError = type === 'error';
  return (
    <View style={[s.toast, isError ? s.toastError : s.toastInfo]}>
      <Text style={s.toastText}>{msg}</Text>
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
  },
  toastInfo: {
    backgroundColor: '#1a2744',
    borderColor: COLORS.blue,
  },
  toastError: {
    backgroundColor: '#7f1d1d',
    borderColor: COLORS.red,
  },
  toastText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600',
  },
});
