import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["var(--font-inter)", "ui-sans-serif", "system-ui"] },
    },
  },
  plugins: [],
} satisfies Config;
