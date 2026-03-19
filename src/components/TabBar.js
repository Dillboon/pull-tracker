import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../theme';

const TABS = [
  { key: 'drops',     icon: '≡',  label: 'Drops'   },
  { key: 'dashboard', icon: '◈',  label: 'Stats'   },
  { key: 'gallery',   icon: '📷', label: 'Gallery' },
  { key: 'settings',  icon: '⚙',  label: 'Config'  },
];

export default function TabBar({ activeTab, setActiveTab }) {
  return (
    <View style={s.bar}>
      {TABS.map(tab => {
        const active = activeTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={s.tab}
            onPress={() => setActiveTab(tab.key)}
            activeOpacity={0.7}
          >
            <Text style={[s.icon, active && { color: COLORS.amber }]}>{tab.icon}</Text>
            <Text style={[s.label, active && { color: COLORS.amber }]}>{tab.label}</Text>
            {active && <View style={s.indicator} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: '#161b22',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingBottom: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    gap: 2,
    position: 'relative',
  },
  icon:  { fontSize: 18, color: COLORS.textMuted },
  label: { fontSize: 10, fontWeight: '700', color: COLORS.textMuted, letterSpacing: 0.5 },
  indicator: {
    position: 'absolute',
    top: 0, left: '25%', right: '25%',
    height: 2,
    backgroundColor: COLORS.amber,
    borderRadius: 1,
  },
});
