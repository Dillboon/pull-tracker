import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../theme';

export default function ProjectCard({ project, onOpen, onArchive, onUnarchive, onDelete }) {
  const total    = project.drops.length;
  const complete = project.drops.filter(d => d.roughPull && d.terminated && d.tested).length;
  const rp       = project.drops.filter(d => d.roughPull).length;
  const tm       = project.drops.filter(d => d.terminated).length;
  const ts       = project.drops.filter(d => d.tested).length;
  const pct      = total > 0 ? Math.round((complete / total) * 100) : 0;
  const isArchived = project.status === 'archived';

  return (
    <TouchableOpacity
      onPress={() => !isArchived && onOpen(project)}
      activeOpacity={isArchived ? 1 : 0.75}
      style={[s.card, isArchived && s.cardArchived]}
    >
      {/* Top row */}
      <View style={s.topRow}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Text style={[s.name, isArchived && { color: COLORS.textMuted }]} numberOfLines={1}>
              {project.name}
            </Text>
            {isArchived && (
              <View style={s.archivePill}>
                <Text style={s.archivePillText}>ARCHIVED</Text>
              </View>
            )}
          </View>
          <Text style={s.meta}>
            Created {project.createdAt}
            {project.idfList.length > 0 ? `  ·  ${project.idfList.length} IDF closets` : ''}
          </Text>
        </View>
        {/* Progress ring */}
        <View style={[s.ring, { borderColor: pct === 100 ? COLORS.green : pct > 0 ? COLORS.amber : '#333' }]}>
          <Text style={[s.ringText, { color: pct === 100 ? COLORS.green : pct > 0 ? COLORS.amber : '#444' }]}>
            {pct}%
          </Text>
        </View>
      </View>

      {/* Stats row */}
      {total > 0 && (
        <View style={s.statsRow}>
          {[
            { label: 'Drops', val: total,  color: COLORS.textSub },
            { label: 'Pulled', val: rp,    color: COLORS.amber },
            { label: 'Term.',  val: tm,     color: COLORS.blue  },
            { label: 'Tested', val: ts,     color: COLORS.green },
            { label: 'Done',   val: complete, color: COLORS.pink },
          ].map(({ label, val, color }) => (
            <View key={label} style={s.stat}>
              <Text style={[s.statVal, { color }]}>{val}</Text>
              <Text style={s.statLabel}>{label}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Progress bar */}
      {total > 0 && (
        <View style={s.barTrack}>
          <View style={[s.barFill, {
            width: `${pct}%`,
            backgroundColor: pct === 100 ? COLORS.green : COLORS.amber,
          }]} />
        </View>
      )}

      {/* Action buttons */}
      <View style={s.actions}>
        {!isArchived ? (
          <>
            <TouchableOpacity style={[s.actionBtn, s.openBtn]} onPress={() => onOpen(project)}>
              <Text style={[s.actionText, { color: COLORS.blue }]}>▶ Open</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.actionBtn, s.archiveBtn]} onPress={() => onArchive(project.id)}>
              <Text style={[s.actionText, { color: COLORS.textMuted }]}>📦 Archive</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity style={[s.actionBtn, s.openBtn]} onPress={() => onOpen(project)}>
              <Text style={[s.actionText, { color: COLORS.blue }]}>👁 View</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.actionBtn, s.archiveBtn]} onPress={() => onUnarchive(project.id)}>
              <Text style={[s.actionText, { color: COLORS.green }]}>↩ Restore</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.actionBtn, s.deleteBtn]} onPress={() => onDelete(project.id)}>
              <Text style={[s.actionText, { color: COLORS.red }]}>🗑 Delete</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  cardArchived: {
    opacity: 0.7,
    borderStyle: 'dashed',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 10,
  },
  name: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.3,
    flex: 1,
  },
  meta: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 3,
    letterSpacing: 0.3,
  },
  archivePill: {
    backgroundColor: 'rgba(148,163,184,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  archivePillText: {
    fontSize: 8,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 0.8,
  },
  ring: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  ringText: { fontSize: 10, fontWeight: '800' },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 8,
    padding: 10,
  },
  stat: { alignItems: 'center' },
  statVal:   { fontSize: 16, fontWeight: '800' },
  statLabel: { fontSize: 9, color: COLORS.textMuted, marginTop: 2, fontWeight: '600' },
  barTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 12,
  },
  barFill: { height: '100%', borderRadius: 2 },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 7,
    alignItems: 'center',
    borderWidth: 1,
  },
  openBtn:    { backgroundColor: COLORS.blueDim,  borderColor: 'rgba(59,130,246,0.3)' },
  archiveBtn: { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: COLORS.border },
  deleteBtn:  { backgroundColor: COLORS.redDim,   borderColor: 'rgba(239,68,68,0.3)' },
  actionText: { fontSize: 12, fontWeight: '700' },
});
