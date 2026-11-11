/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      keyframes: {
        marquee: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
        'vu-bar': {
          from: { transform: 'scaleY(0.12)' },
          to: { transform: 'scaleY(1)' },
        },
      },
      animation: {
        marquee: 'marquee 14s linear infinite',
        'vu-bar': 'vu-bar 1s ease-in-out infinite alternate',
      },
    },
  },
  plugins: [],
};
