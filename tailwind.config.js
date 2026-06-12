/** @type {import('tailwindcss').Config} */
// ============================================================
//  Agentic — "Vibrant Light Mesh" design system (APPROVED)
//  Single source of truth for the new UI. See REDESIGN_PLAN.md §2.
//  Light theme only. Tokens are mirrored as CSS variables in style.css
//  so plain CSS / scoped <style> blocks can use var(--token) too.
// ============================================================
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#F8FAFC",
        ink: {
          DEFAULT: "#0F172A",
          soft: "#475569",
          faint: "#94A3B8",
        },
        surface: { DEFAULT: "#FFFFFF", soft: "#F1F5F9" },
        // Brand blue is kept under the legacy "violet" name so existing utility
        // classes (bg-violet, text-violet-d, …) re-skin to blue automatically.
        violet: { DEFAULT: "#2563EB", d: "#1D4ED8", soft: "#EFF6FF" },
        primary: { DEFAULT: "#2563EB", d: "#1D4ED8", soft: "#EFF6FF" },
        pink: { DEFAULT: "#1E40AF" },          // candy pink → deep navy
        amber: { DEFAULT: "#F59E0B" },         // warning only
        teal: { DEFAULT: "#14B8A6" },          // accent
        accent: { DEFAULT: "#14B8A6", soft: "#CCFBF1" },
        sky: { DEFAULT: "#3B82F6" },           // focus / info
        lime: { DEFAULT: "#14B8A6" },
        ok: "#10B981",
        danger: "#EF4444",
        line: "rgba(15,23,42,.08)",
        "line-2": "rgba(15,23,42,.14)",
        "vm-border": "#E2E8F0",
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', "system-ui", "sans-serif"],
        sans: ['"Plus Jakarta Sans"', "system-ui", "sans-serif"],
      },
      borderRadius: {
        md: "13px",
        lg: "15px",
        xl: "18px",
        "2xl": "26px",
      },
      boxShadow: {
        s: "0 2px 8px rgba(15,23,42,.06)",
        m: "0 8px 30px rgba(15,23,42,.10), 0 2px 8px rgba(15,23,42,.05)",
        l: "0 24px 60px rgba(37,99,235,.14), 0 8px 24px rgba(15,23,42,.10)",
        "glow-v": "0 10px 30px rgba(37,99,235,.30)",
        "glow-p": "0 10px 30px rgba(37,99,235,.22)",
      },
      backgroundImage: {
        "g-brand": "linear-gradient(135deg,#2563EB,#1E40AF)",
        "g-cool": "linear-gradient(135deg,#2563EB,#14B8A6)",
        "g-warm": "linear-gradient(135deg,#F8FAFC,#EEF2FF)",
        "g-teal": "linear-gradient(135deg,#14B8A6,#2563EB)",
        "g-multi": "linear-gradient(135deg,#2563EB,#1D4ED8,#14B8A6)",
      },
      transitionTimingFunction: {
        spring: "cubic-bezier(.34,1.56,.64,1)",
        smooth: "cubic-bezier(.4,0,.2,1)",
      },
      keyframes: {
        drift1: { "50%": { transform: "translate(8vw,6vw) scale(1.15)" } },
        drift2: { "50%": { transform: "translate(-7vw,8vw) scale(1.1)" } },
        drift3: { "50%": { transform: "translate(6vw,-7vw) scale(1.2)" } },
        drift4: { "50%": { transform: "translate(-8vw,-5vw) scale(1.12)" } },
        navIn: { from: { opacity: "0", transform: "translateX(-12px)" }, to: { opacity: "1", transform: "none" } },
        cardIn: { from: { opacity: "0", transform: "translateY(24px) scale(.96)" }, to: { opacity: "1", transform: "none" } },
        floaty: { "50%": { transform: "translateY(-5px)" } },
        shine: { "0%,60%": { left: "-120%" }, "80%,100%": { left: "160%" } },
        flow: { to: { backgroundPosition: "300% 0" } },
        ring: { "0%": { transform: "scale(.6)", opacity: ".5" }, "70%": { transform: "scale(2.4)", opacity: "0" }, "100%": { opacity: "0" } },
        shimmer: { "100%": { transform: "translateX(100%)" } },
        blink: { "0%,100%": { opacity: ".25" }, "50%": { opacity: "1" } },
        spin: { to: { transform: "rotate(360deg)" } },
        pop: { from: { transform: "scale(.4) rotate(-20deg)", opacity: "0" } },
      },
      animation: {
        drift1: "drift1 26s cubic-bezier(.4,0,.2,1) infinite",
        drift2: "drift2 30s cubic-bezier(.4,0,.2,1) infinite",
        drift3: "drift3 32s cubic-bezier(.4,0,.2,1) infinite",
        drift4: "drift4 28s cubic-bezier(.4,0,.2,1) infinite",
        navIn: "navIn .5s cubic-bezier(.4,0,.2,1) forwards",
        cardIn: "cardIn .6s cubic-bezier(.4,0,.2,1) forwards",
        floaty: "floaty 5s ease-in-out infinite",
        shine: "shine 4s ease-in-out infinite",
        flow: "flow 8s linear infinite",
        ring: "ring 1.8s cubic-bezier(.4,0,.2,1) infinite",
        shimmer: "shimmer 1.5s infinite",
        blink: "blink 1.2s infinite",
        spin: "spin .8s linear infinite",
        pop: "pop .7s cubic-bezier(.34,1.56,.64,1) both",
      },
    },
  },
  plugins: [],
}
