<!-- The keyboard shortcuts sheet (plan §3.5), from the same table the keyboard handler follows (wfKeyboard.js). -->
<template>
  <AppSheet :open="open" title="Keyboard shortcuts" description="Shortcuts do nothing while you type in a field, except save, add and run." side="right" size="sm" @update:open="emit('update:open', $event)">
    <div class="wfb-root wfb-layer wfb-shortcuts">
      <section v-for="g in groups" :key="g.title" class="wfb-shortcuts__group">
        <h3 class="wfb-shortcuts__title">{{ g.title }}</h3>
        <dl class="wfb-shortcuts__list">
          <div v-for="(row, i) in g.rows" :key="i" class="wfb-shortcuts__row">
            <dt><template v-for="(k, j) in row[0]" :key="j"><kbd>{{ k }}</kbd><span v-if="j < row[0].length - 1" aria-hidden="true">+</span></template></dt>
            <dd>{{ row[1] }}</dd>
          </div>
        </dl>
      </section>
    </div>
  </AppSheet>
</template>

<script setup>
import { computed } from 'vue'
import AppSheet from '@/components/common/AppSheet.vue'
import { shortcutGroups } from './wfKeyboard'

const props = defineProps({ open: { type: Boolean, default: false }, mod: { type: String, default: 'Ctrl' } })
const emit = defineEmits(['update:open'])
const groups = computed(() => shortcutGroups(props.mod))
</script>
