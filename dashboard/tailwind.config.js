/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "Segoe UI", "system-ui", "sans-serif"],
      },
      colors: {
        terminal: {
          bg: "#000000",
          surface1: "#0A0A0A",
          surface2: "#111111",
          card: "#171717",
          border: "#262626",
          text: "#FAFAFA",
          muted: "#A1A1AA",
          bull: "#22C55E",
          bear: "#EF4444",
          accent: "#6366F1",
        },
        brand: {
          indigo: "#6366f1",
          violet: "#7c3aed",
        },
      },
      animation: {
        "spin-slow": "spin 3s linear infinite",
      },
    },
  },
  plugins: [],
};
