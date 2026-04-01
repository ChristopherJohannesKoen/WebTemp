import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        canvas: '#f4f1ea',
        ink: '#0f172a',
        accent: '#f97316'
      },
      boxShadow: {
        card: '0 20px 60px -40px rgba(15, 23, 42, 0.35)'
      }
    }
  },
  plugins: []
};

export default config;
