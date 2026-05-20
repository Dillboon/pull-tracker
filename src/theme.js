export const COLORS = {
  bg:         '#0d1117',
  surface:    '#161b22',
  surface2:   '#1c2333',
  border:     'rgba(255,255,255,0.08)',
  borderHi:   'rgba(255,255,255,0.15)',
  text:       '#e2e8f0',
  textSub:    '#94a3b8',
  textMuted:  '#475569',
  textDim:    '#334155',
  amber:      '#f59e0b',
  amberDim:   'rgba(245,158,11,0.2)',
  blue:       '#3b82f6',
  blueDim:    'rgba(59,130,246,0.18)',
  green:      '#22c55e',
  greenDim:   'rgba(34,197,94,0.18)',
  purple:     '#7c3aed',
  purpleDim:  'rgba(124,58,237,0.18)',
  red:        '#ef4444',
  redDim:     'rgba(239,68,68,0.15)',
  pink:       '#f472b6',
  orange:     '#f97316',
  orangeDim:  'rgba(249,115,22,0.18)',
  teal:       '#14b8a6',
  tealDim:    'rgba(20,184,166,0.18)',
};

export const STATUS_FIELDS = [
  { key: 'roughPull',  label: 'Rough Pull',  short: 'RP', color: COLORS.amber },
  { key: 'terminated', label: 'Terminated',  short: 'TM', color: COLORS.blue  },
  { key: 'tested',     label: 'Tested',      short: 'TS', color: COLORS.green },
];

export const DEVICE_STATUS_FIELDS = [
  { key: 'roughPull',  label: 'Rough Pull',  short: 'RP',  color: COLORS.amber  },
  { key: 'rfi',        label: 'RFI',         short: 'RFI', color: COLORS.blue   },
  { key: 'installed',  label: 'Installed',   short: 'IN',  color: COLORS.purple },
  { key: 'programmed', label: 'Programmed',  short: 'PG',  color: COLORS.orange },
  { key: 'tested',     label: 'Tested',      short: 'TS',  color: COLORS.green  },
];

export const DEFAULT_IDFS = [
  'IDF-1','IDF-2','IDF-3','IDF-4','IDF-5',
  'IDF-6','IDF-7','IDF-8','MDF',
];

export const DEFAULT_DEVICE_TYPES = [
  'Camera',
  'Card Reader',
  'Access Point',
  'Door Controller',
  'Intercom',
  'Motion Sensor',
  'Speaker',
  'Display/Monitor',
  'Other',
];
