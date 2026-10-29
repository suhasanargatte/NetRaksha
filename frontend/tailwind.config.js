/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // ── Peach Precision: Cyber Operations Palette ─────────────────────
        surface: {
          950: "#0D0D10", // Deepest canvas background
          900: "#111114", // Main application background
          850: "#17171C", // Sidebar & input background
          800: "#1D1D23", // Primary card background
          750: "#24242B", // Elevated panel & header background
          700: "#35353E", // Borders and separators
          600: "#454550", // Interactive borders & subtle hover
          500: "#5A5968", // Muted structural outlines
        },
        peach: {
          DEFAULT: "#FFB69E",
          primary: "#FFB69E",
          hover:   "#FFC7B4",
          surface: "#392A29",
          50:      "#FFF5F2",
          100:     "#FFEBE5",
          200:     "#FFD6CA",
          300:     "#FFC7B4",
          400:     "#FFB69E",
          500:     "#F59578",
          600:     "#E0775A",
          700:     "#B8553C",
          800:     "#7A3423",
          900:     "#4D1F15",
          950:     "#392A29",
        },
        accent: {
          DEFAULT: "#FFB69E",
          primary: "#FFB69E",
          hover:   "#FFC7B4",
          surface: "#392A29",
          100:     "#FFF0EB",
          200:     "#FFE0D6",
          300:     "#FFC7B4",
          400:     "#FFB69E",
          500:     "#FFB69E",
          600:     "#E0775A",
          700:     "#B8553C",
          800:     "#7A3423",
          900:     "#4D1F15",
          950:     "#392A29",
        },
        brand: {
          text:      "#F4F1EF",
          secondary: "#B5B0B0",
          muted:     "#89858A",
        },
        status: {
          success:  "#65C99A",
          warning:  "#F2B85B",
          critical: "#FF6B72",
          info:     "#79B9F4",
        },
        severity: {
          critical: "#FF6B72",
          high:     "#F2B85B",
          medium:   "#F2B85B",
          low:      "#89858A",
        },
        success: "#65C99A",
        warning: "#F2B85B",
        danger:  "#FF6B72",
        muted:   "#89858A",
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
      },
      fontSize: {
        "3xs": ["0.5625rem", { lineHeight: "0.75rem" }],
        "2xs": ["0.625rem", { lineHeight: "0.875rem" }],
      },
      borderRadius: {
        card: "10px",
        panel: "12px",
      },
      boxShadow: {
        "peach-glow": "0 0 12px rgba(255, 182, 158, 0.35)",
        "peach-focus": "0 0 0 2px #111114, 0 0 14px rgba(255, 182, 158, 0.45)",
        "card": "0 2px 8px -2px rgba(0, 0, 0, 0.5), 0 1px 4px -1px rgba(0, 0, 0, 0.4)",
        "card-hover": "0 4px 14px -2px rgba(0, 0, 0, 0.6), 0 2px 6px -1px rgba(0, 0, 0, 0.5)",
        "tactical": "0 1px 3px 0 rgba(0, 0, 0, 0.4), 0 1px 2px -1px rgba(0, 0, 0, 0.4)",
        "tactical-lg": "0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -4px rgba(0, 0, 0, 0.5)",
      },
      transitionDuration: {
        "150": "150ms",
        "200": "200ms",
      },
    },
  },
  plugins: [],
};
