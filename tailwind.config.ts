import type { Config } from "tailwindcss";

// Tailwind v4 — la configuration vit dans src/styles.css via @theme.
// Ce fichier existe uniquement pour la compatibilité avec les outils qui
// s'attendent à un fichier de config classique.
const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
