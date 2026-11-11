/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/renderer/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          midnight: '#0a0e1a',
          navy: '#0e1426',
          surface: '#121829',
          surfaceHover: '#18223a',
          border: '#1e2942',
          cobalt: '#2563eb',
          cobaltHover: '#1d4ed8',
          cobaltLight: '#3b82f6',
          violet: '#7c3aed',
          violetHover: '#6d28d9',
          violetLight: '#8b5cf6',
        },
        studio: {
          950: '#0a0e1a', // Midnight Navy deep
          900: '#0e1426', // Midnight Navy dark
          850: '#121829', // Midnight Navy card surface
          800: '#18223a', // Midnight Navy hover surface
          700: '#1e2942', // Midnight Navy borders
          600: '#2c3c61',
          500: '#3e5488',
          accent: '#2563eb', // Electric Cobalt Blue
          accentHover: '#1d4ed8',
          accentViolet: '#7c3aed', // Vibrant Violet
          violetHover: '#6d28d9',
          cyan: '#00f0ff',
          success: '#10b981',
          warning: '#f59e0b',
          danger: '#ef4444',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      }
    },
  },
  plugins: [],
}
