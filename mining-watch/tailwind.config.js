/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        dark: {
          950: '#0a0c12',
          900: '#0f1117',
          800: '#12151e',
          700: '#1a1d2e',
          600: '#1e2437',
        },
      },
    },
  },
  plugins: [],
}
