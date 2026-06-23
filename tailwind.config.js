/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        forest: 'rgb(var(--color-forest-rgb) / <alpha-value>)',
        pine: 'rgb(var(--color-pine-rgb) / <alpha-value>)',
        ink: 'rgb(var(--color-ink-rgb) / <alpha-value>)',
        paper: 'rgb(var(--color-paper-rgb) / <alpha-value>)',
        leaf: 'rgb(var(--color-leaf-rgb) / <alpha-value>)',
        amber: 'rgb(var(--color-amber-rgb) / <alpha-value>)',
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
