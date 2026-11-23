<!--
  A searchable command list on Reka UI's Listbox (ADM-1333, plan §4): the node picker, and any "type to find, arrow
  to choose, Enter to run" list. Focus stays in the search box; Up/Down/Home/End move the highlight
  (aria-activedescendant), Enter or a click activates the highlighted item. Items are grouped under labelled headings.

    <AppCommandList :items="items" :groups="[{ id: 'recent', label: 'Recent' }, ...]" label="Add a node"
                    placeholder="Search nodes and tools" @select="add" />

  items: [{ id, label, description?, group?, icon?, badge?, keywords?: string[], disabled? }]
  groups: [{ id, label }] the order and the headings of the groups; a group not listed shows after them, headed by its id.
  filter: true (default) filters `items` by the search words (every word must appear in the label, description,
          badge or keywords); false shows `items` as given, for a caller that searches itself (it reads v-model:search).
  Every item that matches is shown; nothing is cut off.
  Slots: item ({ item }), empty ({ search }), header (above the search box's results, e.g. tabs).
  Emits: select(item), update:search(text). Exposes: focus().
-->
<template>
  <ListboxRoot class="app-cmd" :highlight-on-hover="true" :disabled="disabled">
    <div class="app-cmd__search">
      <Icon icon="lucide:search" class="app-cmd__search-ic" aria-hidden="true" />
      <ListboxFilter
        ref="filterEl"
        v-model="query"
        class="app-cmd__input"
        :placeholder="placeholder"
        :aria-label="placeholder || label"
        :aria-controls="listId"
        role="combobox"
        aria-expanded="true"
        aria-autocomplete="list"
        :auto-focus="autoFocus"
        autocomplete="off"
        spellcheck="false"
      />
    </div>
    <slot name="header" />
    <ListboxContent :id="listId" class="app-cmd__list" :aria-label="label" :aria-busy="loading ? 'true' : undefined">
      <div v-if="loading" class="app-cmd__status" role="status">{{ loadingText }}</div>
      <template v-else>
        <ListboxGroup v-for="section in sections" :key="section.id" class="app-cmd__group">
          <ListboxGroupLabel v-if="section.label" class="app-cmd__group-label">{{ section.label }}</ListboxGroupLabel>
          <ListboxItem
            v-for="item in section.items"
            :key="item.id"
            :value="item.id"
            :disabled="!!item.disabled"
            :aria-disabled="item.disabled ? 'true' : undefined"
            class="app-cmd__item"
            @select="onSelect($event, item)"
          >
            <slot name="item" :item="item">
              <span v-if="item.icon" class="app-cmd__item-ic" aria-hidden="true"><Icon :icon="item.icon" /></span>
              <span class="app-cmd__item-txt">
                <span class="app-cmd__item-label">{{ item.label }}</span>
                <span v-if="item.description" class="app-cmd__item-desc">{{ item.description }}</span>
              </span>
              <span v-if="item.badge" class="app-cmd__item-badge">{{ item.badge }}</span>
            </slot>
          </ListboxItem>
        </ListboxGroup>
        <div v-if="!sections.length" class="app-cmd__status" role="status">
          <slot name="empty" :search="query">{{ query ? `Nothing matches "${query}".` : emptyText }}</slot>
        </div>
      </template>
    </ListboxContent>
  </ListboxRoot>
</template>

<script setup>
import { computed, ref, watch, useId } from 'vue'
import { ListboxRoot, ListboxFilter, ListboxContent, ListboxGroup, ListboxGroupLabel, ListboxItem } from 'reka-ui'
import { Icon } from '@iconify/vue'
import { filterCommandItems, groupCommandItems } from './appCommandItems'

const props = defineProps({
  items: { type: Array, default: () => [] },
  groups: { type: Array, default: () => [] },
  label: { type: String, required: true },
  placeholder: { type: String, default: 'Search' },
  search: { type: String, default: undefined },
  filter: { type: Boolean, default: true },
  loading: { type: Boolean, default: false },
  loadingText: { type: String, default: 'Loading...' },
  emptyText: { type: String, default: 'Nothing to show.' },
  autoFocus: { type: Boolean, default: true },
  disabled: { type: Boolean, default: false },
})
const emit = defineEmits(['select', 'update:search'])
const listId = `app-cmd-${useId()}`

const localQuery = ref(props.search ?? '')
watch(() => props.search, (v) => { if (v !== undefined) localQuery.value = v })
const query = computed({
  get: () => localQuery.value,
  set: (v) => { localQuery.value = v; emit('update:search', v) },
})

const visible = computed(() => (props.filter ? filterCommandItems(props.items, query.value) : props.items))
const sections = computed(() => groupCommandItems(visible.value, props.groups))

function onSelect(event, item) {
  // A command list runs the item; it does not keep a selected value.
  event.preventDefault()
  if (item.disabled) return
  emit('select', item)
}

const filterEl = ref(null)
function focus() {
  const el = filterEl.value?.$el || filterEl.value
  el?.focus?.()
}
defineExpose({ focus })
</script>

<style scoped>
.app-cmd { display: flex; flex-direction: column; min-height: 0; color: var(--vm-ink); font-size: 13px; }
.app-cmd__search { position: relative; flex-shrink: 0; padding: 0 0 8px; }
.app-cmd__search-ic { position: absolute; left: 10px; top: 50%; transform: translateY(calc(-50% - 4px)); width: 16px; height: 16px; color: var(--vm-ink-faint); }
.app-cmd__input {
  width: 100%; min-height: 36px; padding: 8px 10px 8px 34px;
  border: 1px solid var(--vm-line-2); border-radius: 6px;
  background: var(--vm-surface); color: var(--vm-ink); font: inherit;
}
.app-cmd__input::placeholder { color: var(--vm-ink-faint); }
.app-cmd__input:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 1px; }
.app-cmd__list { flex: 1; min-height: 0; overflow: auto; overscroll-behavior: contain; }
.app-cmd__group + .app-cmd__group { margin-top: 8px; }
.app-cmd__group-label {
  padding: 6px 8px; font-size: 11px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase;
  color: var(--vm-ink-faint);
}
.app-cmd__item {
  display: flex; align-items: center; gap: 10px; min-height: 36px;
  padding: 6px 8px; border-radius: 6px; cursor: pointer; outline: none;
}
.app-cmd__item[data-highlighted] { background: var(--vm-primary-soft); }
.app-cmd__item[data-highlighted] .app-cmd__item-label { color: var(--vm-link); }
.app-cmd__item[data-disabled] { opacity: .5; cursor: not-allowed; }
.app-cmd__item-ic {
  display: grid; place-items: center; flex-shrink: 0; width: 28px; height: 28px; border-radius: 6px;
  background: var(--vm-surface-soft); color: var(--vm-ink-soft);
}
.app-cmd__item-ic :deep(svg) { width: 16px; height: 16px; }
.app-cmd__item-txt { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
.app-cmd__item-label { font-weight: 550; color: var(--vm-ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.app-cmd__item-desc { font-size: 12px; color: var(--vm-ink-faint); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.app-cmd__item-badge {
  flex-shrink: 0; font-size: 11px; padding: 2px 6px; border-radius: 4px;
  background: var(--vm-surface-soft); color: var(--vm-ink-soft);
}
.app-cmd__status { padding: 20px 12px; text-align: center; color: var(--vm-ink-faint); }
@media (pointer: coarse) { .app-cmd__item { min-height: 44px; } .app-cmd__input { min-height: 44px; } }
</style>
