/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
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
      },
      fontFamily: {
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        ui: ['system-ui', '"Segoe UI"', '"SF Pro Text"', 'Helvetica', 'Arial', 'sans-serif'],
      },
      fontVariantNumeric: {
        tabular: 'tabular-nums',
      },
      keyframes: {
        'bar-rise': {
          '0%': { transform: 'scaleY(0)', opacity: '0' },
          '100%': { transform: 'scaleY(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
