<template>
  <aside class="space-y-5">
    <section class="rounded-[10px] border border-[#DDE6F2] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div class="flex items-center gap-3">
        <span class="grid h-8 w-8 place-items-center rounded-[8px] bg-blue-50 text-[#2457F5]">
          <Info :size="16" :stroke-width="2.2" />
        </span>
        <h3 class="text-[15px] font-bold text-[#0F172A]">About Tools</h3>
      </div>

      <p class="mt-5 text-[13px] leading-relaxed text-[#52627A]">
        Tools are capabilities that agents can call to get things done--search the web, run code,
        read files, and more.
      </p>

      <div class="mt-6 rounded-[8px] border border-[#DDE6F2] p-4">
        <h4 class="text-[13px] font-bold text-[#0F172A]">Tools vs Connectors</h4>
        <div class="mt-4 space-y-5">
          <div class="flex items-start gap-3">
            <Wrench :size="18" class="mt-0.5 shrink-0 text-[#52627A]" :stroke-width="2" />
            <div>
              <p class="text-[13px] font-bold text-[#0F172A]">Connectors</p>
              <p class="mt-1 text-[12px] leading-relaxed text-[#64748B]">
                Manage connections to external services (Slack, GitHub, Notion, etc.).
              </p>
            </div>
          </div>
          <div class="flex items-start gap-3">
            <Wrench :size="18" class="mt-0.5 shrink-0 text-[#52627A]" :stroke-width="2" />
            <div>
              <p class="text-[13px] font-bold text-[#0F172A]">Tools</p>
              <p class="mt-1 text-[12px] leading-relaxed text-[#64748B]">
                Capabilities that agents use to perform actions (search, run code, send messages).
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="rounded-[10px] border border-[#DDE6F2] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <h3 class="text-[15px] font-bold text-[#0F172A]">How to use tools</h3>
      <ol class="mt-5 space-y-5">
        <li v-for="(step, i) in steps" :key="step.title" class="flex items-start gap-3">
          <span class="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#EEF2FF] text-[12px] font-bold text-[#2457F5]">
            {{ i + 1 }}
          </span>
          <div>
            <p class="text-[13px] font-bold text-[#0F172A]">{{ step.title }}</p>
            <p class="mt-1 text-[12px] leading-relaxed text-[#64748B]">{{ step.copy }}</p>
          </div>
        </li>
      </ol>

      <RouterLink
        to="/dashboard/agents"
        class="mt-5 flex h-9 w-full items-center justify-between rounded-[8px] border border-[#DDE6F2] bg-white px-3.5 text-[12px] font-bold text-[#2457F5] hover:bg-blue-50"
      >
        Go to Agents
        <ArrowRight :size="15" :stroke-width="2.2" />
      </RouterLink>
    </section>

    <section class="rounded-[10px] border border-[#DDE6F2] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <h3 class="text-[15px] font-bold text-[#0F172A]">Need a custom tool?</h3>
      <p class="mt-5 text-[13px] leading-relaxed text-[#64748B]">
        Build a custom tool to connect to any API or automation.
      </p>
      <button
        class="mt-5 flex h-9 w-full items-center justify-between rounded-[8px] border border-[#DDE6F2] bg-white px-3.5 text-[12px] font-bold text-[#2457F5] hover:bg-blue-50"
        @click="$emit('create')"
      >
        Create Custom Tool
        <ArrowRight :size="15" :stroke-width="2.2" />
      </button>
    </section>
  </aside>
</template>

<script setup>
import { ArrowRight, Info, Wrench } from 'lucide-vue-next'
import { RouterLink } from 'vue-router'

defineEmits(['create'])

const steps = [
  {
    title: 'Enable a tool',
    copy: 'Turn on the tools you want your agents to use.',
  },
  {
    title: 'Add credentials',
    copy: 'Some tools require credentials to work.',
  },
  {
    title: 'Assign to agents',
    copy: 'Go to an agent and choose which tools it can access.',
  },
]
</script>
