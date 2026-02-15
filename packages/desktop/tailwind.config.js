/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        tokyo: {
          bg: '#1a1b26',
          surface: '#32344a',
          'surface-alt': '#24283b',
          border: '#444b6a',
          'border-light': '#565f89',
          text: '#a9b1d6',
          'text-muted': '#787c99',
          'text-dim': '#444b6a',
          'text-bright': '#c0caf5',
          blue: '#7aa2f7',
          'blue-hover': '#7da6ff',
          'blue-bg': 'rgba(122,162,247,0.15)',
          red: '#f7768e',
          green: '#9ece6a',
          yellow: '#e0af68',
          magenta: '#bb9af7',
          cyan: '#0db9d7',
        },
      },
      fontSize: {
        'base': '15px',
      },
    },
  },
  plugins: [],
}
