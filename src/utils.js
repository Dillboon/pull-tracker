export const uid = () => Math.random().toString(36).slice(2, 9);

export const today = () => new Date().toLocaleDateString('en-US', {
  year: 'numeric', month: '2-digit', day: '2-digit',
});

// Accepts boolean (legacy) or groupType string
export const emptyDrop = (groupTypeOrIsDouble = 'single') => {
  const groupType =
    groupTypeOrIsDouble === true  ? 'double' :
    groupTypeOrIsDouble === false ? 'single' :
    groupTypeOrIsDouble;
  return {
    id: uid(),
    groupType,
    isDouble: groupType === 'double', // kept for backwards compat
    cableA: '',
    cableB: '',
    cableC: '',
    cableD: '',
    idf: '',
    roughPull: false,
    terminated: false,
    tested: false,
    notes: '',
    createdAt: today(),
  };
};

export const getGroupType = (drop) =>
  drop.groupType || (drop.isDouble ? 'double' : 'single');

export const completionCount = (drop) =>
  [drop.roughPull, drop.terminated, drop.tested].filter(Boolean).length;

export const progressColor = (drop) => {
  const n = completionCount(drop);
  if (n === 0) return '#333';
  if (n === 1) return '#f59e0b';
  if (n === 2) return '#3b82f6';
  return '#22c55e';
};
