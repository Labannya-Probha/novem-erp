/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        forest: 'var(--theme-primary, #2E7D32)',
        pine: 'var(--theme-dark, #1B4D2E)',
        ink: '#20241F',
        paper: '#FAFAF6',
        leaf: 'var(--theme-light, #E8F0E4)',
        amber: 'var(--theme-accent, #C9802D)',
      },
      fontFamily: {
        display: ['Fraunces', 'serif'],
        body: ['"IBM Plex Sans"', 'sans-serif'],
        money: ['"IBM Plex Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}
