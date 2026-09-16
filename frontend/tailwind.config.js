/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: {
          bg: '#F8F9FA',
          surface: '#FFFFFF',
          hover: '#F3F4F6',
          border: '#E5E7EB',
          borderLight: '#F1F5F9',
          dots: '#E2E8F0',
        },
        ink: {
          primary: '#111827',
          secondary: '#4B5563',
          muted: '#9CA3AF',
          faint: '#D1D5DB',
        },
        brand: {
          primary: '#5B58F5',      // Purple/Indigo from Dribbble shot
          primaryHover: '#4B47E6',
          primaryLight: '#EEEDFE',
          blue: '#3B82F6',
          blueLight: '#EFF6FF',
          emerald: '#10B981',
          emeraldLight: '#ECFDF5',
          amber: '#F59E0B',
          amberLight: '#FFFBEB',
          rose: '#EF4444',
          roseLight: '#FEF2F2',
        },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"IBM Plex Mono"', 'SFMono-Regular', 'Menlo', 'Monaco', 'monospace'],
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)',
        'card-hover': '0 4px 6px -1px rgba(0, 0, 0, 0.07), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
        'panel': '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.03)',
        'node-active': '0 0 0 2px #5B58F5, 0 8px 20px -4px rgba(91, 88, 245, 0.25)',
        'node-critical': '0 0 0 2px #EF4444, 0 8px 20px -4px rgba(239, 68, 68, 0.25)',
      },
    },
  },
  plugins: [],
};
