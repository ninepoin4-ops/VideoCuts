/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Japanese SaaS palette = low saturation indigo + sage green
        cream: "#FBF9F4",
        "warm-white": "#FAF7F2",
        charcoal: "#3D3D3D",
        "dark-charcoal": "#2A2A2A",
        indigo: {
          DEFAULT: "#6B7DB3",
          light: "#E8ECF4",
          dark: "#4A5A8A",
        },
        sage: {
          DEFAULT: "#7D9B76",
          light: "#EAF0E8",
          dark: "#5A7A53",
        },
      },
      fontFamily: {
        sans: [
          "'Inter'",
          "'Noto Sans JP'",
          "'Hiragino Sans'",
          "system-ui",
          "sans-serif",
        ],
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.875rem" }],
      },
      borderRadius: {
        soft: "0.5rem",
      },
      boxShadow: {
        card: "0 1px 2px 0 rgba(0, 0, 0, 0.04)",
        subtle: "0 1px 3px 0 rgba(0, 0, 0, 0.06)",
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
        "pulse-soft": "pulseSoft 2s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
      },
    },
  },
  plugins: [],
};
