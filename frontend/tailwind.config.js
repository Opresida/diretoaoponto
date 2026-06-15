// Espelha os tokens do PROMPT §14.5 (dark slate + emerald).
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#020617",
        surface: "#0f172a",
        "surface-2": "#1e293b",
        primary: { DEFAULT: "#10b981", light: "#34d399" },
        warn: "#fbbf24",
        danger: "#fb7185",
      },
      borderRadius: { card: "20px", el: "16px" },
    },
  },
  plugins: [],
};
