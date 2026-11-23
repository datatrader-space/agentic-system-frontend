<!--
  A for-each's inner step drawn from the server's registry (ADM-1351): the step's own `fields` through SchemaForm, on a
  scoped node editor (nodeEditor.js `scoped`) whose data is the inner step's and whose every change writes the
  for-each's `do` whole, through the history. No per-step form is written here; the vision steps use it.
-->
<template>
  <SchemaForm :fields="fields" />
</template>

<script setup>
import { computed, toRef } from 'vue'
import SchemaForm from '../SchemaForm.vue'
import { provideNodeEditor, useNodeEditor } from './nodeEditor'
import { wfFields } from '@/config/wfNodeDefinitions'

const props = defineProps({
  // The inner step's type and its data; `write(nextData, title)` writes the for-each's `do` whole.
  type: { type: String, required: true },
  data: { type: Object, required: true },
  write: { type: Function, required: true },
})

const editor = useNodeEditor()
const scoped = editor.scoped({ type: toRef(props, 'type'), data: toRef(props, 'data'), write: (next, title) => props.write(next, title) })
provideNodeEditor(scoped)
const fields = computed(() => wfFields(props.type) || [])
</script>
