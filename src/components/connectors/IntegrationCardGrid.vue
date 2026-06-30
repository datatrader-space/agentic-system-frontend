<template>
  <!-- 3-col card grid (Aadml). Emits 'open' (item) and 'install' (item). -->
  <div>
    <template v-for="group in groups" :key="group.title">
      <div class="icg-group">
        <div class="icg-group-head">
          <h3 class="icg-group-title">{{ group.title }}</h3>
          <span class="icg-count">{{ group.items.length }}</span>
        </div>
        <p v-if="group.subtitle" class="icg-group-sub">{{ group.subtitle }}</p>

        <div class="icg-grid">
          <div
            v-for="item in group.items"
            :key="item.id"
            class="icg-card"
            @click="$emit('open', item)"
          >
            <div class="icg-card-top">
              <div class="icg-card-id">
                <span class="icg-logo"><Icon :icon="item.icon" class="w-7 h-7" /></span>
                <div class="min-w-0">
                  <div class="icg-name-row">
                    <span class="icg-name">{{ item.name }}</span>
                    <Icon v-if="item.verified" icon="lucide:badge-check" class="icg-verified" />
                  </div>
                  <div class="icg-author">By {{ item.author }}</div>
                </div>
              </div>
              <span v-if="item.soon" class="icg-pill soon">Soon</span>
              <span v-else-if="isInstalled(item)" class="icg-pill on"><Icon icon="lucide:check" class="w-3 h-3" />Installed</span>
            </div>

            <p class="icg-desc">{{ item.desc }}</p>

            <div class="icg-actions">
              <button
                v-if="item.soon"
                disabled
                class="icg-btn ghost"
              >Coming soon</button>
              <button
                v-else-if="isInstalled(item)"
                class="icg-btn ghost"
                @click.stop="$emit('open', item)"
              >Manage</button>
              <button
                v-else
                class="icg-btn primary"
                @click.stop="$emit('install', item)"
              ><Icon icon="lucide:plus" class="w-3.5 h-3.5" />Connect</button>
            </div>
          </div>
        </div>
      </div>
    </template>

    <p v-if="!groups.length" class="icg-empty">No integrations match your filters.</p>
  </div>
</template>

<script setup>
import { Icon } from '@iconify/vue'

defineProps({
  // [{ title, subtitle, items: [ { id, name, author, icon, verified, soon, desc } ] }]
  groups: { type: Array, default: () => [] },
  // (item) => boolean
  isInstalled: { type: Function, default: () => false },
})
defineEmits(['open', 'install'])
</script>

<style scoped>
.icg-group { margin-bottom: 26px; }
.icg-group-head { display: flex; align-items: center; gap: 10px; }
.icg-group-title { font-family: var(--vm-font-display); font-size: 15px; font-weight: 800; color: var(--vm-ink); }
.icg-count { font-size: 11px; font-weight: 700; color: var(--vm-ink-soft); background: var(--vm-bg); border: 1px solid var(--vm-line); border-radius: 999px; padding: 1px 8px; }
.icg-group-sub { font-size: 12px; color: var(--vm-ink-faint); margin: 2px 0 14px; }

.icg-grid { display: grid; grid-template-columns: 1fr; gap: 14px; }
@media (min-width: 768px) { .icg-grid { grid-template-columns: repeat(2, 1fr); } }
@media (min-width: 1200px) { .icg-grid { grid-template-columns: repeat(3, 1fr); } }

.icg-card {
  display: flex; flex-direction: column; gap: 12px;
  padding: 16px; border-radius: var(--vm-r); cursor: pointer;
  background: var(--vm-surface); border: 1px solid var(--vm-line-2);
  box-shadow: var(--vm-shadow-s); transition: transform .15s var(--vm-ease2), box-shadow .15s, border-color .15s;
}
.icg-card:hover { transform: translateY(-2px); border-color: var(--vm-sky); box-shadow: var(--vm-shadow-m); }
.icg-card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
.icg-card-id { display: flex; align-items: center; gap: 11px; min-width: 0; }
.icg-logo { width: 42px; height: 42px; border-radius: 12px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: var(--vm-bg); border: 1px solid var(--vm-line); }
.icg-name-row { display: flex; align-items: center; gap: 5px; min-width: 0; }
.icg-name { font-size: 14px; font-weight: 800; color: var(--vm-ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.icg-verified { width: 15px; height: 15px; color: var(--vm-sky); flex-shrink: 0; }
.icg-author { font-size: 11px; color: var(--vm-ink-faint); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.icg-pill { display: inline-flex; align-items: center; gap: 4px; flex-shrink: 0; font-size: 10px; font-weight: 700; padding: 4px 9px; border-radius: 999px; }
.icg-pill.soon { color: var(--vm-ink-faint); background: var(--vm-bg); border: 1px solid var(--vm-line); }
.icg-pill.on { color: #059669; background: rgba(16,185,129,.12); }

.icg-desc { font-size: 12.5px; color: var(--vm-ink-soft); line-height: 1.5; min-height: 38px;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

.icg-actions { margin-top: auto; }
.icg-btn { width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  font: 700 12.5px var(--vm-font-sans); padding: 8px 12px; border-radius: 11px; cursor: pointer; border: 1px solid transparent; transition: all .15s; }
.icg-btn.primary { color: #fff; background: var(--vm-g-brand); box-shadow: var(--vm-glow-v); }
.icg-btn.primary:hover { transform: translateY(-1px); }
.icg-btn.ghost { color: var(--vm-ink-soft); background: var(--vm-bg); border-color: var(--vm-line-2); }
.icg-btn.ghost:hover:not(:disabled) { background: var(--vm-surface); }
.icg-btn:disabled { cursor: not-allowed; opacity: .6; }

.icg-empty { padding: 48px 0; text-align: center; font-size: 13px; color: var(--vm-ink-faint); }
</style>

