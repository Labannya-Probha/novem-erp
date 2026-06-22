/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        forest: '#2E7D32',
        pine: '#1F1F1C',
        ink: '#20241F',
        paper: '#F7F5F2',
        leaf: '#E5DFD6',
        amber: '#C89B5C',
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
