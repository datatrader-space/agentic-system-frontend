<template>
  <!-- Animated hero backdrop: drifting aurora + faint engineering grid + soft orbs.
       Pure CSS (transform/opacity/background-position only → GPU-cheap). Sits behind
       hero content (give the content `position: relative; z-index: 1`). -->
  <div class="hero-bg" aria-hidden="true">
    <div class="hb-grid"></div>
    <div class="hb-aurora a1"></div>
    <div class="hb-aurora a2"></div>
    <span class="hb-orb o1"></span>
    <span class="hb-orb o2"></span>
    <span class="hb-orb o3"></span>
    <div class="hb-fade"></div>
  </div>
</template>

<script setup>
// Presentational only.
</script>

<style scoped>
.hero-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
}

/* Faint engineering grid that slowly pans, masked to fade at the edges. */
.hb-grid {
  position: absolute;
  inset: -2px;
  background-image:
    linear-gradient(to right, rgba(37, 99, 235, .07) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(37, 99, 235, .07) 1px, transparent 1px);
  background-size: 46px 46px;
  -webkit-mask: radial-gradient(ellipse 75% 65% at 50% 32%, #000 35%, transparent 82%);
  mask: radial-gradient(ellipse 75% 65% at 50% 32%, #000 35%, transparent 82%);
  animation: hbGridPan 26s linear infinite;
}
@keyframes hbGridPan { to { background-position: 46px 46px; } }

/* Soft colored aurora washes that breathe + drift. */
.hb-aurora {
  position: absolute;
  border-radius: 50%;
  filter: blur(70px);
  mix-blend-mode: multiply;
  opacity: .55;
  will-change: transform;
}
.a1 {
  width: 60vw; height: 42vw; left: -12vw; top: -22vw;
  background: radial-gradient(circle, rgba(37, 99, 235, .38), transparent 62%);
  animation: hbFloatA 20s ease-in-out infinite;
}
.a2 {
  width: 52vw; height: 40vw; right: -14vw; top: -16vw;
  background: radial-gradient(circle, rgba(20, 184, 166, .32), transparent 62%);
  animation: hbFloatB 26s ease-in-out infinite;
}
@keyframes hbFloatA { 50% { transform: translate(7vw, 5vw) scale(1.16); } }
@keyframes hbFloatB { 50% { transform: translate(-6vw, 6vw) scale(1.12); } }

/* Small drifting orbs for depth. */
.hb-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(34px);
  opacity: .5;
  will-change: transform;
}
.o1 { width: 16vw; height: 16vw; left: 12%; top: 8%;  background: radial-gradient(circle, rgba(59,130,246,.5), transparent 70%); animation: hbDrift1 18s ease-in-out infinite; }
.o2 { width: 12vw; height: 12vw; right: 16%; top: 24%; background: radial-gradient(circle, rgba(20,184,166,.45), transparent 70%); animation: hbDrift2 22s ease-in-out infinite; }
.o3 { width: 10vw; height: 10vw; left: 42%; top: 40%; background: radial-gradient(circle, rgba(99,102,241,.4), transparent 70%); animation: hbDrift3 16s ease-in-out infinite; }
@keyframes hbDrift1 { 50% { transform: translate(3vw, 4vw); } }
@keyframes hbDrift2 { 50% { transform: translate(-4vw, 3vw); } }
@keyframes hbDrift3 { 50% { transform: translate(2vw, -3vw); } }

/* Fade the whole backdrop into the page background at the bottom so it blends. */
.hb-fade {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent 55%, var(--vm-bg) 100%);
}

@media (prefers-reduced-motion: reduce) {
  .hb-grid, .hb-aurora, .hb-orb { animation: none; }
}
</style>
