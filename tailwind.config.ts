import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#08111f",
          900: "#0f172a",
          800: "#1e293b"
        },
        amber: {
          500: "#f59e0b",
          600: "#d97706"
        }
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(245, 158, 11, 0.12), 0 24px 72px rgba(8, 17, 31, 0.24)"
      }
    }
  },
  plugins: []
} satisfies Config;

