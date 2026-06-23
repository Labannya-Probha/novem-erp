/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    // Direct assignment restricts to brand palette only (no unused default colors in bundle).
    // transparent, current, white, black are kept as Tailwind internals require them.
    // If any page uses default Tailwind colors (gray-100, red-500, etc.), switch back to extend.
    colors: {
      transparent: 'transparent',
      current:     'currentColor',
      white:       '#ffffff',
      black:       '#000000',
      forest: 'rgb(var(--color-forest-rgb) / <alpha-value>)',
      pine:   'rgb(var(--color-pine-rgb)   / <alpha-value>)',
      ink:    'rgb(var(--color-ink-rgb)    / <alpha-value>)',
      paper:  'rgb(var(--color-paper-rgb)  / <alpha-value>)',
      leaf:   'rgb(var(--color-leaf-rgb)   / <alpha-value>)',
      amber:  'rgb(var(--color-amber-rgb)  / <alpha-value>)',
    },
    extend: {
      fontFamily: {
        display: ['Inter', 'sans-serif'],
        body:    ['Inter', 'sans-serif'],
        money:   ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
