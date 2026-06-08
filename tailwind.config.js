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
        bg: "#FBFAFF",
        ink: {
          DEFAULT: "#191427",
          soft: "#4A4360",
          faint: "#9A93AE",
        },
        surface: "#FFFFFF",
        violet: { DEFAULT: "#7C3AED", d: "#6D28D9", soft: "#F3EEFE" },
        pink: { DEFAULT: "#EC4899" },
        amber: { DEFAULT: "#F59E0B" },
        teal: { DEFAULT: "#14B8A6" },
        sky: { DEFAULT: "#0EA5E9" },
        lime: { DEFAULT: "#84CC16" },
        ok: "#10B981",
        danger: "#EF4444",
        line: "rgba(25,20,39,.08)",
        "line-2": "rgba(25,20,39,.14)",
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
        s: "0 2px 8px rgba(25,20,39,.06)",
        m: "0 8px 30px rgba(25,20,39,.10), 0 2px 8px rgba(25,20,39,.05)",
        l: "0 24px 60px rgba(124,58,237,.16), 0 8px 24px rgba(25,20,39,.10)",
        "glow-v": "0 10px 34px rgba(124,58,237,.42)",
        "glow-p": "0 10px 34px rgba(236,72,153,.40)",
      },
      backgroundImage: {
        "g-brand": "linear-gradient(120deg,#7C3AED,#EC4899)",
        "g-cool": "linear-gradient(120deg,#7C3AED,#0EA5E9)",
        "g-warm": "linear-gradient(120deg,#F59E0B,#EC4899)",
        "g-teal": "linear-gradient(120deg,#14B8A6,#0EA5E9)",
        "g-multi": "linear-gradient(120deg,#7C3AED,#EC4899,#F59E0B)",
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
