import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Roman-inspired palette (Marmor/Bronze Design)
        marble: {
          50: "#fafafa",
          100: "#f5f5f0",
          200: "#e8e5de",
          900: "#2a2520",
        },
        bronze: {
          400: "#cd7f32",
          500: "#a0522d",
          600: "#7b3a1c",
        },
        parchment: "#f4e4c1",
      },
      fontFamily: {
        serif: ["Georgia", "Cambria", "Times New Roman", "serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
