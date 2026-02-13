/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      boxShadow: {
        neon: '0 0 25px rgba(136, 129, 255, 0.35)',
      },
    },
  },
  plugins: [],
};
