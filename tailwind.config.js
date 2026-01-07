/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        kyoto: {
          red: '#c53d2d',
          light: '#fef2f1',
          medium: '#f8d7d4',
        },
      },
      fontSize: {
        'base': '15px',
      },
    },
  },
  plugins: [],
}
