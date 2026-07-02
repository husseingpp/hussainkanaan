/**
 * "Trading Floor" design tokens (blueprint §6). Mirrored in tailwind.config.js.
 * Kept here so chart series (Recharts) can read the exact same hex values.
 */
export const tokens = {
  floor: {
    bg: '#0A0E14',
    panel: '#0F1419',
    border: '#1A202D',
    gold: '#D4AF37',
  },
  trade: {
    win: '#22863A',
    loss: '#A91927',
    curve: '#FFA500',
  },
  text: {
    primary: '#E8EAED',
    dim: '#7A8290',
  },
} as const;
