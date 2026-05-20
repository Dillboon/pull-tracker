export const uid = () => Math.random().toString(36).slice(2, 9);

export const today = () => new Date().toLocaleDateString('en-US', {
  year: 'numeric', month: '2-digit', day: '2-digit',
});

export const emptyDrop = (isDouble = false) => ({
  id: uid(),
  isDouble,
  cableA: '',
  cableB: '',
  idf: '',
  roughPull: false,
  terminated: false,
  tested: false,
  notes: '',
  createdAt: today(),
});

export const emptyDevice = () => ({
  id: uid(),
  deviceType: '',
  deviceId: '',
  location: '',
  idf: '',
  roughPull: false,
  rfi: false,
  installed: false,
  programmed: false,
  tested: false,
  notes: '',
  createdAt: today(),
});

export const completionCount = (drop) =>
  [drop.roughPull, drop.terminated, drop.tested].filter(Boolean).length;

export const deviceCompletionCount = (device) =>
  [device.roughPull, device.rfi, device.installed, device.programmed, device.tested].filter(Boolean).length;

export const progressColor = (drop) => {
  const n = completionCount(drop);
  if (n === 0) return '#333';
  if (n === 1) return '#f59e0b';
  if (n === 2) return '#3b82f6';
  return '#22c55e';
};

export const deviceProgressColor = (device) => {
  const n = deviceCompletionCount(device);
  if (n === 0) return '#333';
  if (n === 1) return '#f59e0b';
  if (n === 2) return '#3b82f6';
  if (n === 3) return '#7c3aed';
  if (n === 4) return '#f97316';
  return '#22c55e';
};
