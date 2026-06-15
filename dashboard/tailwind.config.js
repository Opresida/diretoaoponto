// Identidade oficial "Direto ao Ponto": carmim (#A81824) sobre claro/escuro.
// emerald é remapeado p/ carmim — recolore todos os estados ativos/líder/AO VIVO de uma vez.
const brand = {
  DEFAULT: "#A81824", bright: "#D81830", dark: "#7A0C18", darker: "#5A0010",
  50: "#FCF0F0", 100: "#FCE4E4",
};
const crimsonRamp = {
  50: "#FCF0F0", 100: "#FCE4E4", 200: "#F3B6BC", 300: "#E06A74",
  400: "#D81830", 500: "#C01528", 600: "#A81824", 700: "#8A1220",
  800: "#6C0C18", 900: "#5A0010", 950: "#3F0008",
};
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#020617",
        surface: "#0f172a",
        "surface-2": "#1e293b",
        primary: { DEFAULT: "#A81824", light: "#D81830" },
        brand,
        emerald: crimsonRamp,        // marca: verde antigo -> carmim
        accent: { teal: "#3090C0", blue: "#0048A8", gold: "#FCA830", green: "#54B454", pink: "#C2185B" },
        ok: "#2E9E4F",               // sucesso/verificado (mantém verde)
        warn: "#fbbf24",
        danger: "#fb7185",
      },
      borderRadius: { card: "20px", el: "16px" },
    },
  },
  plugins: [],
};
