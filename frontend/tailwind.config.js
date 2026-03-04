/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        neon: {
          green: '#22c55e',
          orange: '#f97316',
        },
      },
      boxShadow: {
        'neon-green': '0 0 20px rgba(34, 197, 94, 0.5), 0 0 60px rgba(34, 197, 94, 0.2)',
        'neon-green-lg': '0 0 30px rgba(34, 197, 94, 0.6), 0 0 80px rgba(34, 197, 94, 0.3)',
        'neon-orange': '0 0 20px rgba(249, 115, 22, 0.5), 0 0 60px rgba(249, 115, 22, 0.2)',
        'glass': '0 8px 32px rgba(0, 0, 0, 0.4)',
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'gradient-shift': 'gradient-shift 15s ease infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        'gradient-shift': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'glow': {
          '0%': { opacity: '0.5' },
          '100%': { opacity: '1' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};
