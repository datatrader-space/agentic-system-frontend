<template>
  <teleport to="body">
    <transition name="wm-fade">
      <div v-if="show" class="wm-overlay" @click.self="$emit('later')">
        <div class="wm-card" role="dialog" aria-modal="true" aria-labelledby="wm-title">
          <div class="wm-mark">
            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7" /></svg>
          </div>
          <h2 id="wm-title" class="wm-title">Welcome to Agentic{{ name ? `, ${name}` : '' }}!</h2>
          <p class="wm-sub">
            This is your workspace for building AI agents that chat, run tools, automate workflows, and write code.
          </p>
          <ol class="wm-steps">
            <li><span class="wm-num">1</span> Connect an <strong>AI provider</strong> &amp; activate models</li>
            <li><span class="wm-num">2</span> Create an <strong>agent</strong> that uses a model</li>
            <li><span class="wm-num">3</span> Start <strong>chatting</strong> with your agent</li>
          </ol>
          <div class="wm-actions">
            <button type="button" class="wm-primary" @click="$emit('tour')">Take a quick tour</button>
            <button type="button" class="wm-secondary" @click="$emit('create')">Set up AI provider</button>
          </div>
          <button type="button" class="wm-later" @click="$emit('later')">Maybe later</button>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup>
defineProps({
  show: { type: Boolean, default: false },
  name: { type: String, default: '' },
})
defineEmits(['create', 'tour', 'later'])
</script>

<style scoped>
.wm-overlay {
  position: fixed; inset: 0; z-index: 3900;
  display: flex; align-items: center; justify-content: center; padding: 20px;
  background: rgba(15, 23, 42, 0.5); backdrop-filter: blur(4px);
  font-family: var(--vm-font-sans);
}
.wm-card {
  width: 100%; max-width: 440px; padding: 30px 28px 22px; text-align: center;
  background: var(--vm-surface, #fff); border: 1.5px solid var(--vm-line, #e7eaf0);
  border-radius: 22px; box-shadow: var(--vm-shadow-l, 0 24px 60px rgba(15, 23, 42, .3));
  animation: wmPop .35s var(--vm-ease, cubic-bezier(.2,.8,.2,1)) both;
}
.wm-mark {
  width: 56px; height: 56px; margin: 0 auto 18px; border-radius: 16px;
  display: flex; align-items: center; justify-content: center;
  background: var(--vm-g-brand, linear-gradient(135deg,#7c3aed,#0ea5e9)); box-shadow: var(--vm-glow-v, 0 8px 24px rgba(124,58,237,.4));
}
.wm-mark svg { width: 28px; height: 28px; }
.wm-title { font-family: var(--vm-font-display, inherit); font-size: 1.375rem; font-weight: 700; color: var(--vm-ink, #0f172a); margin: 0 0 10px; }
.wm-sub { font-size: 0.9375rem; line-height: 1.55; color: var(--vm-ink-soft, #475569); margin: 0 0 16px; }
.wm-steps {
  list-style: none; margin: 0 0 22px; padding: 0; text-align: left;
  display: flex; flex-direction: column; gap: 9px;
}
.wm-steps li {
  display: flex; align-items: center; gap: 10px;
  font-size: 0.875rem; color: var(--vm-ink, #0f172a);
}
.wm-num {
  display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;
  width: 22px; height: 22px; border-radius: 50%;
  font-size: 0.75rem; font-weight: 700; color: #fff;
  background: var(--vm-g-brand, linear-gradient(135deg,#7c3aed,#0ea5e9));
}
.wm-actions { display: flex; flex-direction: column; gap: 10px; }
.wm-primary {
  padding: 12px 18px; font-size: 0.9375rem; font-weight: 700; color: #fff; cursor: pointer;
  background: var(--vm-g-cool, linear-gradient(90deg,#0ea5e9,#7c3aed)); border: none; border-radius: 13px;
  box-shadow: var(--vm-glow-v, 0 8px 20px rgba(124,58,237,.35)); transition: transform .16s var(--vm-ease, ease);
}
.wm-primary:hover { transform: translateY(-2px); }
.wm-secondary {
  padding: 12px 18px; font-size: 0.9375rem; font-weight: 700; cursor: pointer;
  color: var(--vm-violet-d, #6d28d9); background: var(--vm-violet-soft, #f5f3ff);
  border: 1px solid var(--vm-line, #e7eaf0); border-radius: 13px; transition: background .16s;
}
.wm-secondary:hover { background: #ede9fe; }
.wm-later {
  margin-top: 14px; font-size: 0.8125rem; font-weight: 600; color: var(--vm-ink-faint, #94a3b8);
  background: none; border: none; cursor: pointer;
}
.wm-later:hover { color: var(--vm-ink-soft, #475569); }

@keyframes wmPop { from { opacity: 0; transform: translateY(10px) scale(.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
.wm-fade-enter-active, .wm-fade-leave-active { transition: opacity .2s ease; }
.wm-fade-enter-from, .wm-fade-leave-to { opacity: 0; }
</style>
