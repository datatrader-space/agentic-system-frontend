<template>
  <!-- Editor Step 3 — Knowledge & Tools (Screen 15). Knowledge source column cards + tool
       category cards. Backed by existing endpoints; tool toggles save via the top-bar Save. -->
  <div class="mx-auto w-full max-w-[1840px] px-6 pb-8 font-[Inter,system-ui,sans-serif]">
    <div class="mb-4">
      <h2 class="text-[20px] font-bold tracking-tight text-[#0F172A]">Add Knowledge &amp; Tools</h2>
      <p class="mt-0.5 text-[13.5px] text-[#64748B]">Give your agent the knowledge sources and tools it needs to be effective.</p>
    </div>

    <!-- ============ Knowledge Sources ============ -->
    <section class="mb-4 rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <h3 class="text-base font-semibold text-[#0F172A]">Knowledge &amp; Connectors</h3>
      <p class="mb-4 text-[13px] text-[#64748B]">Attach knowledge bases and connectors your agent can use to answer questions and take action.</p>

      <div class="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <!-- Card 1: attach any of the user's Knowledge & RAG resources to this agent. Creation/upload
           lives on the standalone Knowledge & RAG page; here the user only picks what to attach. -->
      <div class="flex flex-col rounded-xl border border-[#E5E7EB] p-4">
        <div class="mb-3 flex items-center justify-between gap-3 flex-wrap">
          <div class="relative flex-1 min-w-[200px] max-w-md">
            <Search :size="15" :stroke-width="2" class="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#98A2B3]" />
            <input v-model="kbFilter" placeholder="Search your knowledge bases…"
                   class="w-full rounded-lg border border-[#E5E7EB] bg-white py-2 pl-8 pr-3 text-[13px] focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
          </div>
          <div class="flex items-center gap-3">
            <span class="text-[12px] font-semibold text-[#667085]">{{ attachedKsIds.length }} attached</span>
            <router-link to="/dashboard/knowledge" class="text-[12px] font-semibold text-indigo-600 hover:text-indigo-700">
              + Create / manage in Knowledge &amp; RAG →
            </router-link>
          </div>
        </div>

        <div v-if="userKbLoading" class="py-10 text-center text-[12.5px] text-[#98A2B3]">Loading your knowledge…</div>
        <div v-else-if="!filteredUserKb.length" class="py-10 text-center">
          <Database :size="26" :stroke-width="1.5" class="mx-auto text-[#CBD5E1]" />
          <p class="mt-2 text-[13px] font-semibold text-[#475467]">{{ userKbResources.length ? 'No matches' : 'No knowledge bases yet' }}</p>
          <router-link to="/dashboard/knowledge" class="mt-1 inline-block text-[12px] font-semibold text-indigo-600 hover:text-indigo-700">
            {{ userKbResources.length ? '' : 'Create your first knowledge base →' }}
          </router-link>
        </div>

        <ul v-else class="divide-y divide-[#F2F4F7]">
          <li v-for="r in pagedUserKb" :key="r.id" class="flex items-center gap-3 py-2.5">
            <span class="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
                  :class="r.kind === 'website' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'">
              <Globe v-if="r.kind === 'website'" :size="15" :stroke-width="2" />
              <FileText v-else :size="15" :stroke-width="2" />
            </span>
            <div class="min-w-0 flex-1">
              <div class="truncate text-[13px] font-medium text-[#0F172A]" :title="r.name">{{ r.name }}</div>
              <div class="truncate text-[11px] text-[#98A2B3]">
                {{ r.kind }} · {{ r.chunk_count }} chunks<template v-if="r.status"> · {{ r.status }}</template>
              </div>
            </div>
            <button @click="toggleAttach(r)" :disabled="ksSaving"
                    class="shrink-0 rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition disabled:opacity-50"
                    :class="isAttached(r.id) ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                             : 'border-indigo-200 bg-white text-indigo-600 hover:bg-indigo-50'">
              {{ isAttached(r.id) ? '✓ Attached' : 'Attach' }}
            </button>
          </li>
        </ul>
        <div v-if="!userKbLoading && filteredUserKb.length && kbTotalPages > 1"
             class="mt-2 flex items-center justify-end gap-2 text-[12px] text-[#667085]">
          <button @click="kbPage > 1 && kbPage--" :disabled="kbPage <= 1"
                  class="h-7 w-7 grid place-items-center rounded-lg border border-[#E5E7EB] text-[#475467] hover:bg-[#F8FAFC] disabled:opacity-40">←</button>
          <span>Page {{ kbPage }} of {{ kbTotalPages }}</span>
          <button @click="kbPage < kbTotalPages && kbPage++" :disabled="kbPage >= kbTotalPages"
                  class="h-7 w-7 grid place-items-center rounded-lg border border-[#E5E7EB] text-[#475467] hover:bg-[#F8FAFC] disabled:opacity-40">→</button>
        </div>
        <p class="mt-auto border-t border-[#F2F4F7] pt-3 text-[11.5px] text-[#98A2B3]">
          Attaching is by reference — updates to a knowledge base reflect on every agent using it. Memories are captured automatically.
        </p>
      </div>

      <!-- Card 2: Connectors — assign a connected connector; ALL its tools are added to this agent. -->
      <div class="flex flex-col rounded-xl border border-[#E5E7EB] p-4">
        <div class="mb-3 flex items-start justify-between gap-3">
          <div>
            <p class="text-[14px] font-semibold text-[#0F172A]">Connectors</p>
            <p class="text-[11.5px] text-[#64748B]">Assign a connector — its tools are added to this agent. Click <strong>Assign</strong> again to unassign.</p>
          </div>
          <button class="btn-outline shrink-0" @click="openConnectorsHub"><Link2 :size="15" :stroke-width="2" /> Manage</button>
        </div>

        <p v-if="connectorsLoading" class="py-8 text-center text-[12px] text-[#98A2B3]">Loading connectors…</p>
        <div v-else-if="connectorsError" class="rounded-xl border border-dashed border-red-200 bg-red-50/60 px-4 py-4 text-center">
          <p class="text-[12.5px] font-medium text-red-600">Couldn't load connectors: {{ connectorsError }}</p>
          <button class="mt-2 rounded-lg bg-white px-3 py-1.5 text-[12px] font-semibold text-[#344054] border border-[#E5E7EB]" @click="loadConnectors">Retry</button>
        </div>
        <div v-else-if="!connectors.length" class="flex-1 rounded-xl border border-dashed border-[#E5E7EB] bg-[#F8FAFC] px-4 py-8 text-center">
          <p class="text-[13px] font-medium text-[#475569]">No connected connectors yet</p>
          <button class="mt-2 rounded-lg bg-[#EEF2FF] px-3 py-1.5 text-[12px] font-semibold text-[#4338CA]" @click="openConnectorsHub">Browse &amp; connect</button>
        </div>
        <div v-else class="flex-1">
          <div class="space-y-2">
            <div v-for="c in displayedConnectors" :key="c.kind + ':' + c.id"
                 class="flex items-center gap-3 rounded-xl border border-[#E5E7EB] px-3.5 py-2.5">
              <ToolIcon :name="String(c.slug || c.name || c.id || '')" :group="String(c.slug || c.id || c.name || '')" :size="30" :inner="16" />
              <div class="min-w-0 flex-1">
                <p class="truncate text-[13px] font-semibold text-[#0F172A]">{{ c.name }}</p>
                <p class="text-[11px] text-[#98A2B3]">
                  {{ connectorKindLabel(c) }} · {{ connectorTools(c).length }} tools
                  <span v-if="!connectorTools(c).length" class="text-amber-500">(none synced yet)</span>
                </p>
              </div>
              <button type="button" :disabled="!connectorTools(c).length" @click="toggleConnector(c)"
                      :class="['rounded-lg px-3 py-1.5 text-[12px] font-semibold transition',
                               connectorAssigned(c) ? 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                                    : 'border border-[#E5E7EB] bg-white text-[#344054] hover:bg-[#F8FAFC]',
                               !connectorTools(c).length ? 'opacity-50 !cursor-not-allowed' : '']">
                {{ connectorAssigned(c) ? '✓ Assigned' : 'Assign' }}
              </button>
            </div>
          </div>
          <div v-if="connTotalPages > 1" class="mt-2 flex items-center justify-end gap-2 text-[12px] text-[#667085]">
            <button @click="connPage > 1 && connPage--" :disabled="connPage <= 1"
                    class="h-7 w-7 grid place-items-center rounded-lg border border-[#E5E7EB] text-[#475467] hover:bg-[#F8FAFC] disabled:opacity-40">←</button>
            <span>Page {{ connPage }} of {{ connTotalPages }}</span>
            <button @click="connPage < connTotalPages && connPage++" :disabled="connPage >= connTotalPages"
                    class="h-7 w-7 grid place-items-center rounded-lg border border-[#E5E7EB] text-[#475467] hover:bg-[#F8FAFC] disabled:opacity-40">→</button>
          </div>
        </div>
      </div>
      </div>
    </section>

    <!-- ============ Agent Tools & Capabilities ============ -->
    <section class="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div class="flex items-start justify-between gap-4">
        <div>
          <h3 class="text-base font-semibold text-[#0F172A]">Agent Tools &amp; Capabilities</h3>
          <p class="text-[13px] text-[#64748B]">Enable tools and capabilities to allow your agent to take action and get work done.</p>
        </div>
        <button class="btn-outline" @click="go('/dashboard/tools')">Manage Tools</button>
      </div>

      <div v-if="loadingTools" class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div v-for="n in 4" :key="n" class="h-44 animate-pulse rounded-xl bg-slate-100" />
      </div>

      <div v-else class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div v-for="grp in toolGroups" :key="grp.key" class="flex min-h-[220px] flex-col rounded-xl border border-[#E5E7EB] p-4">
          <div class="mb-1 flex items-start justify-between">
            <ToolIcon :name="grp.key" :group="grp.key" :size="38" :inner="20" />
            <span class="badge" :class="grp.tint">{{ grp.tools.length }} tools</span>
          </div>
          <p class="mt-1 text-[14px] font-semibold text-[#0F172A]">{{ grp.label }}</p>
          <p class="mb-3 text-[11.5px] text-[#667085]">{{ grp.desc }}</p>
          <ul class="flex-1 space-y-2.5">
            <li v-for="t in grp.tools.slice(0, 3)" :key="t.id" class="flex items-start gap-2">
              <ToolIcon :name="t.name" :group="t.category || t.name" :size="22" :inner="14" class="mt-0.5" />
              <span class="min-w-0">
                <span class="block text-[12.5px] font-medium text-[#0F172A]">{{ t.display_name || t.name }}</span>
                <span class="block truncate text-[11px] text-[#98A2B3]">{{ shortDesc(t) }}</span>
              </span>
            </li>
          </ul>
          <div class="mt-auto flex items-center justify-between border-t border-[#F2F4F7] pt-3">
            <button class="view-link" @click="openToolsModal(grp)">View tools</button>
            <button type="button" class="grid h-5 w-9 place-items-center rounded-full transition" :class="catOn(grp) ? 'bg-[#2563EB]' : 'bg-[#E5E7EB]'" @click="toggleCategory(grp)">
              <span class="h-4 w-4 rounded-full bg-white shadow transition" :class="catOn(grp) ? 'translate-x-2' : '-translate-x-2'" />
            </button>
          </div>
        </div>
        <p v-if="!toolGroups.length" class="text-[13px] text-[#667085]">No tools available.</p>
      </div>

    </section>

    <Teleport to="body">
      <div v-if="toolsModalOpen" class="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 px-5 py-8 backdrop-blur-sm" @click.self="closeToolsModal">
        <section class="flex max-h-[88vh] w-full max-w-[1040px] flex-col overflow-hidden rounded-[18px] border border-white/70 bg-white shadow-[0_28px_90px_rgba(15,23,42,0.34)]">
          <header class="flex items-start justify-between gap-5 px-8 pb-4 pt-7">
            <div>
              <h3 class="text-[25px] font-bold tracking-tight text-[#111827]">Add tools to this agent</h3>
              <p class="mt-1.5 text-[15px] text-[#53627A]">Choose the capabilities this agent can use during conversations.</p>
            </div>
            <button class="modal-close border-0" aria-label="Close tools dialog" @click="closeToolsModal"><X :size="23" :stroke-width="1.8" /></button>
          </header>

          <div class="px-8 pb-4">
            <div class="relative">
              <Search :size="20" :stroke-width="2" class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#667085]" />
              <input v-model="toolSearch" class="modal-search h-12 rounded-[9px] pl-12 text-[15px]" placeholder="Search tools, functions, capabilities..." />
            </div>
            <div class="mt-4 flex flex-wrap items-center gap-2">
              <button
                v-for="filter in modalFilters"
                :key="filter.key"
                type="button"
                class="modal-filter-chip"
                :class="toolFilter === filter.key ? 'border-[#DAD7FF] bg-[#F1F0FF] text-[#4338CA]' : 'border-[#E2E8F0] bg-white text-[#344054]'"
                @click="toolFilter = filter.key"
              >
                <component v-if="filter.icon" :is="filter.icon" :size="16" :stroke-width="2" />
                {{ filter.label }}
              </button>
            </div>
          </div>

          <div class="grid min-h-[500px] grid-cols-[270px_minmax(0,1fr)] overflow-hidden border-y border-[#E5E7EB]">
            <aside class="overflow-y-auto border-r border-[#E5E7EB] bg-white p-6">
              <p class="mb-5 text-[14px] font-semibold text-[#111827]">Categories</p>
              <div class="space-y-1">
                <button
                  v-for="group in modalGroups"
                  :key="group.key"
                  type="button"
                  class="modal-category-row"
                  :class="selectedGroup?.key === group.key ? 'bg-[#F0EEFF] text-[#4338CA] shadow-[inset_4px_0_0_#4F46E5]' : 'text-[#475569] hover:bg-[#F8FAFC]'"
                  @click="selectedGroup = group"
                >
                  <ToolIcon :name="group.key" :group="group.key" :size="32" :inner="18" />
                  <span class="min-w-0 flex-1 truncate text-left">{{ group.label }}</span>
                  <span class="rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[11px] font-bold text-[#667085]">{{ group.tools.length }}</span>
                </button>
                <p v-if="!modalGroups.length" class="px-3 py-4 text-[13px] text-[#98A2B3]">No tools available.</p>
              </div>
            </aside>

            <main class="overflow-y-auto bg-white p-5">
              <h4 class="mb-3 text-[15px] font-semibold text-[#111827]">{{ toolSearch.trim() ? `Search results (${filteredModalTools.length})` : (selectedGroup?.label || 'Tools') }}</h4>
              <div v-if="filteredModalTools.length" class="overflow-hidden rounded-[10px] border border-[#E5E7EB]">
                <article
                  v-for="tool in filteredModalTools"
                  :key="tool.id"
                  class="tool-row"
                >
                  <ToolIcon :name="tool.name" :group="tool.category || tool.name" :size="52" :inner="26" />
                  <div class="min-w-0 flex-1">
                    <div class="flex min-w-0 flex-wrap items-center gap-2">
                      <p class="truncate text-[16px] font-bold text-[#111827]">{{ tool.display_name || tool.name }}</p>
                      <span class="tool-chip">{{ tool.category_label || tool.category || 'Tool' }}</span>
                    </div>
                    <p class="mt-1 line-clamp-2 text-[14px] leading-5 text-[#475569]" :title="tool.description || ''">{{ tool.description || 'No description available.' }}</p>
                    <div class="mt-2 flex flex-wrap items-center gap-2">
                      <span v-for="tag in toolTags(tool)" :key="tag" class="tool-chip">{{ tag }}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    class="tool-add-btn"
                    :class="toolOn(tool) ? 'border-[#E4E1FF] bg-[#EFEDFF] text-[#4F46E5]' : 'border-[#D7D5FF] bg-white text-[#4338CA]'"
                    @click="toggleTool(tool)"
                  >
                    <span v-if="toolOn(tool)">Added</span>
                    <span v-else>+ Add</span>
                    <span v-if="toolOn(tool)" class="text-[15px]">✓</span>
                  </button>
                </article>
              </div>
              <div v-else class="rounded-xl border border-dashed border-[#D0D5DD] bg-[#F8FAFC] px-5 py-12 text-center text-[14px] text-[#64748B]">
                No tools match your search.
              </div>
            </main>
          </div>

          <footer class="flex flex-wrap items-center justify-between gap-4 px-8 py-5">
            <div class="flex min-w-0 flex-wrap items-center gap-3">
              <span class="text-[14px] font-medium text-[#475569]">{{ selectedModalTools.length }} tools selected</span>
              <span v-for="tool in selectedModalTools.slice(0, 4)" :key="tool.id" class="selected-tool-chip">
                {{ tool.display_name || tool.name }}
                <button type="button" class="text-[#4F46E5]" @click="toggleTool(tool)"><X :size="13" :stroke-width="2" /></button>
              </span>
            </div>
            <div class="flex items-center gap-3">
              <button class="modal-secondary" @click="closeToolsModal">Cancel</button>
              <button class="modal-primary min-w-[126px]" @click="closeToolsModal">Add {{ selectedModalTools.length }} tools</button>
            </div>
          </footer>
        </section>
      </div>
    </Teleport>

    <!-- View all files — full list with live index status, chunks, cost, retry & delete -->
    <Teleport to="body">
      <div v-if="filesModalOpen" class="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 px-5 py-8 backdrop-blur-sm" @click.self="filesModalOpen = false">
        <section class="flex max-h-[86vh] w-full max-w-[720px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
          <header class="flex items-center justify-between gap-4 border-b border-[#F1F5F9] px-6 py-4">
            <div>
              <h3 class="text-[17px] font-bold text-[#0F172A]">Uploaded Files</h3>
              <p class="text-[12.5px] text-[#64748B]">{{ files.length }} file(s) · KB cost so far: <span class="font-semibold text-indigo-600">{{ fmtCost(kbCost) }}</span></p>
            </div>
            <button class="modal-close border-0" aria-label="Close" @click="filesModalOpen = false"><X :size="20" :stroke-width="1.8" /></button>
          </header>
          <div class="flex-1 divide-y divide-[#F1F5F9] overflow-y-auto">
            <div v-if="!files.length" class="px-6 py-10 text-center text-[13px] text-[#98A2B3]">No files uploaded yet.</div>
            <div v-for="f in files" :key="f.id" class="flex items-center gap-3 px-6 py-3">
              <FileType :size="18" :stroke-width="2" class="shrink-0 text-[#98A2B3]" />
              <div class="min-w-0 flex-1">
                <p class="truncate text-[13px] font-medium text-[#0F172A]">{{ f.filename || f.name || 'file' }}</p>
                <p class="text-[11.5px] text-[#98A2B3]">
                  {{ fileMeta(f) }}
                  <span v-if="fileIndex(f).stage === 'ready' && fileIndex(f).chunkCount"> · {{ fileIndex(f).chunkCount }} chunks</span>
                  <span v-if="kbCostFor('file', f.id) > 0" class="text-[#667085]"> · {{ fmtCost(kbCostFor('file', f.id)) }}</span>
                </p>
                <div v-if="!['ready','failed'].includes(fileIndex(f).stage)" class="mt-1 h-1 w-full overflow-hidden rounded-full bg-[#EEF2F7]">
                  <div class="h-full rounded-full bg-indigo-500 transition-all" :style="{ width: (fileIndex(f).percent || 8) + '%' }" />
                </div>
              </div>
              <button v-if="fileIndex(f).stage === 'failed'" class="modal-action" @click="retryIndex(f)"><RefreshCw :size="13" :stroke-width="2" /> Retry</button>
              <button class="icon-x" @click="removeFile(f)"><X :size="14" :stroke-width="2" /></button>
            </div>
          </div>
          <footer class="flex items-center justify-end gap-3 border-t border-[#F1F5F9] px-6 py-4">
            <label class="add-btn cursor-pointer"><Plus :size="13" :stroke-width="2" /> {{ uploading ? 'Uploading…' : 'Add Files' }}<input type="file" class="hidden" :disabled="uploading" @change="onUpload" /></label>
            <button class="modal-secondary" @click="filesModalOpen = false">Close</button>
          </footer>
        </section>
      </div>
    </Teleport>

    <!-- View all URLs — full list of website sources with status, chunks, cost, re-index / cancel / remove -->
    <Teleport to="body">
      <div v-if="urlsModalOpen" class="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 px-5 py-8 backdrop-blur-sm" @click.self="urlsModalOpen = false">
        <section class="flex max-h-[86vh] w-full max-w-[760px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
          <header class="flex items-center justify-between gap-4 border-b border-[#F1F5F9] px-6 py-4">
            <div>
              <h3 class="text-[17px] font-bold text-[#0F172A]">Website Sources</h3>
              <p class="text-[12.5px] text-[#64748B]">{{ webSources.length }} source(s) · KB cost so far: <span class="font-semibold text-indigo-600">{{ fmtCost(kbCost) }}</span></p>
            </div>
            <button class="modal-close border-0" aria-label="Close" @click="urlsModalOpen = false"><X :size="20" :stroke-width="1.8" /></button>
          </header>
          <div class="flex-1 divide-y divide-[#F1F5F9] overflow-y-auto">
            <div v-if="!webSources.length" class="px-6 py-10 text-center text-[13px] text-[#98A2B3]">No website sources yet.</div>
            <div v-for="w in webSources" :key="w.id" class="flex items-center gap-3 px-6 py-3">
              <Globe :size="18" :stroke-width="2" class="shrink-0 text-[#98A2B3]" />
              <button class="min-w-0 flex-1 text-left" @click="openPages(w)">
                <p class="truncate text-[13px] font-medium text-[#0F172A] hover:text-indigo-600">{{ w.display_name || w.root_url }}</p>
                <p class="truncate text-[11.5px] text-[#98A2B3]">
                  {{ urlMeta(w) }}
                  <span v-if="kbCostFor('web', w.id) > 0" class="text-[#667085]"> · {{ fmtCost(kbCostFor('web', w.id)) }}</span>
                </p>
              </button>
              <button v-if="WS_INDEXING.has(w.status)" class="modal-action" @click="cancelUrl(w)"><Ban :size="13" :stroke-width="2" /> Cancel</button>
              <button v-else class="modal-action" @click="reindexUrl(w)"><RefreshCw :size="13" :stroke-width="2" /> Re-index</button>
              <button class="icon-x" @click="removeUrl(w)"><X :size="14" :stroke-width="2" /></button>
            </div>
          </div>
          <footer class="flex items-center justify-end gap-3 border-t border-[#F1F5F9] px-6 py-4">
            <button class="add-btn" @click="openAddWebsite"><Plus :size="13" :stroke-width="2" /> Add website</button>
            <button class="modal-secondary" @click="urlsModalOpen = false">Close</button>
          </footer>
        </section>
      </div>
    </Teleport>

    <!-- View all sources — attached (shared) knowledge bases, with detach -->
    <Teleport to="body">
      <div v-if="sourcesModalOpen" class="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 px-5 py-8 backdrop-blur-sm" @click.self="sourcesModalOpen = false">
        <section class="flex max-h-[86vh] w-full max-w-[680px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
          <header class="flex items-center justify-between gap-4 border-b border-[#F1F5F9] px-6 py-4">
            <div>
              <h3 class="text-[17px] font-bold text-[#0F172A]">Attached Knowledge Bases</h3>
              <p class="text-[12.5px] text-[#64748B]">Shared bases + reused from your other agents — {{ allAttachedSources.length }} attached.</p>
            </div>
            <button class="modal-close border-0" aria-label="Close" @click="sourcesModalOpen = false"><X :size="20" :stroke-width="1.8" /></button>
          </header>
          <div class="flex-1 divide-y divide-[#F1F5F9] overflow-y-auto">
            <div v-if="!allAttachedSources.length" class="px-6 py-10 text-center text-[13px] text-[#98A2B3]">Nothing attached yet. Use “Add Source” to attach a shared knowledge base (e.g. Help Center) or reuse one from another agent.</div>
            <div v-for="s in allAttachedSources" :key="`${s.kind}:${s.id}`" class="flex items-center gap-3 px-6 py-3">
              <component :is="s.kind === 'website' ? Globe : (s.kind === 'shared' ? Sparkles : FileType)" :size="18" :stroke-width="2" class="shrink-0 text-[#98A2B3]" />
              <div class="min-w-0 flex-1">
                <p class="truncate text-[13px] font-medium text-[#0F172A]">{{ s.name }}</p>
                <p class="truncate text-[11.5px] text-[#98A2B3]">{{ s.owner_agent ? s.owner_agent + ' · ' : '' }}{{ s.chunk_count || 0 }} chunks</p>
              </div>
              <button v-if="s.kind !== 'shared'" class="modal-action" :disabled="refreshingSource === `${s.kind}:${s.id}`" @click="refreshSource(s)"><RefreshCw :size="13" :stroke-width="2" /> {{ refreshingSource === `${s.kind}:${s.id}` ? 'Syncing…' : 'Refresh' }}</button>
              <button class="modal-action" @click="detachSource(s)">Detach</button>
            </div>
          </div>
          <footer class="flex items-center justify-end gap-3 border-t border-[#F1F5F9] px-6 py-4">
            <button class="add-btn" @click="openSourcePicker"><Plus :size="13" :stroke-width="2" /> Add Source</button>
            <button class="modal-secondary" @click="sourcesModalOpen = false">Close</button>
          </footer>
        </section>
      </div>
    </Teleport>

    <!-- Add Source picker — attach an existing KB (file/website) from the user's other agents -->
    <Teleport to="body">
      <div v-if="sourcePickerOpen" class="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/45 px-5 py-8 backdrop-blur-sm" @click.self="sourcePickerOpen = false">
        <section class="flex max-h-[86vh] w-full max-w-[680px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
          <header class="flex items-center justify-between gap-4 border-b border-[#F1F5F9] px-6 py-4">
            <div>
              <h3 class="text-[17px] font-bold text-[#0F172A]">Attach a Knowledge Base</h3>
              <p class="text-[12.5px] text-[#64748B]">Attach a shared knowledge base (e.g. Help Center) or reuse a file/website already indexed on another of your agents — no re-upload, no re-crawl.</p>
            </div>
            <button class="modal-close border-0" aria-label="Close" @click="sourcePickerOpen = false"><X :size="20" :stroke-width="1.8" /></button>
          </header>
          <div class="flex-1 overflow-y-auto">
            <div v-if="libraryLoading" class="px-6 py-10 text-center text-[13px] text-[#98A2B3]">Loading your knowledge bases…</div>
            <div v-else-if="!libraryItems.length" class="px-6 py-10 text-center text-[13px] text-[#98A2B3]">No reusable knowledge bases found on your other agents yet.</div>
            <div v-else class="divide-y divide-[#F1F5F9]">
              <button v-for="it in pagedLibraryItems" :key="pickKey(it)" type="button" class="flex w-full items-center gap-3 px-6 py-3 text-left hover:bg-[#FCFCFF]" :class="it.attached ? 'opacity-60' : ''" @click="togglePick(it)">
                <component :is="it.kind === 'website' ? Globe : (it.kind === 'shared' ? Sparkles : FileType)" :size="18" :stroke-width="2" class="shrink-0 text-[#98A2B3]" />
                <div class="min-w-0 flex-1">
                  <p class="truncate text-[13px] font-medium text-[#0F172A]">{{ it.name }}</p>
                  <p class="truncate text-[11.5px] text-[#98A2B3]">{{ it.owner_agent ? it.owner_agent + ' · ' : '' }}{{ it.chunk_count || 0 }} chunks</p>
                </div>
                <span v-if="it.attached" class="text-[11.5px] font-semibold text-emerald-600">Attached</span>
                <span v-else-if="picked.has(pickKey(it))" class="grid h-5 w-5 place-items-center rounded-full bg-indigo-600 text-white text-[12px]">✓</span>
                <span v-else class="grid h-5 w-5 place-items-center rounded-full border border-[#D0D5DD] text-[#98A2B3]"><Plus :size="12" :stroke-width="2.5" /></span>
              </button>
            </div>
          </div>
          <footer class="flex items-center justify-between gap-3 border-t border-[#F1F5F9] px-6 py-4">
            <div class="flex items-center gap-3">
              <span class="text-[12.5px] text-[#64748B]">{{ picked.size }} selected</span>
              <div v-if="libTotalPages > 1" class="flex items-center gap-1.5">
                <button class="pg-btn" :disabled="libPage <= 1" @click="libPage--"><ChevronRight :size="14" :stroke-width="2" class="rotate-180" /></button>
                <span class="text-[12px] text-[#64748B]">Page {{ libPage }} of {{ libTotalPages }}</span>
                <button class="pg-btn" :disabled="libPage >= libTotalPages" @click="libPage++"><ChevronRight :size="14" :stroke-width="2" /></button>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <button class="modal-secondary" @click="sourcePickerOpen = false">Cancel</button>
              <button class="modal-primary min-w-[110px]" :disabled="!picked.size || attaching" @click="attachPicked">{{ attaching ? 'Attaching…' : `Attach ${picked.size || ''}`.trim() }}</button>
            </div>
          </footer>
        </section>
      </div>
    </Teleport>

    <!-- Reused legacy knowledge modals: discover-website flow + per-source pages detail -->
    <AddWebsiteSourceModal v-if="addWebsiteOpen" :agent-id="agentId" @close="addWebsiteOpen = false" @added="onWebsiteAdded" @discarded="onWebsiteDiscarded" @doc-added="onDocAdded" />
    <WebSourcePagesModal v-if="pagesModalSource" :source="pagesModalSource" @close="pagesModalSource = null" @updated="loadUrls" />
    <!-- Connect / manage connectors inline (no redirect) -->
    <IntegrationHubModal v-if="showHub" :connectors="allConnectors" @close="showHub = false" @installed="onHubInstalled" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRouter } from 'vue-router'
import { FileText, FileType, Link2, Globe, Database, BarChart3, Plus, X, ChevronRight, Folder, Search, Sparkles, Terminal, Star, Shield, Braces, RefreshCw, Ban, Zap, Cloud, Bug, Network, Wrench } from 'lucide-vue-next'
import api from '../../services/api'
import { notify } from '@/composables/useNotify'
import { confirm } from '@/composables/useConfirm'
import { ago } from '../dashboard/time'
import AddWebsiteSourceModal from '../knowledge/AddWebsiteSourceModal.vue'
import WebSourcePagesModal from '../knowledge/WebSourcePagesModal.vue'
import IntegrationHubModal from '../connectors/IntegrationHubModal.vue'
import ToolIcon from '../knowledge/ToolIcon.js'

const props = defineProps({ agent: { type: Object, required: true } })
const router = useRouter()
const go = (to) => router.push(to)
const agentId = computed(() => props.agent.id)

// View-all modal open state (card visuals stay untouched; rich detail lives in these overlays)
const filesModalOpen = ref(false)
const urlsModalOpen = ref(false)

// ── KB embedding cost (surfaced inside the View-all modals only) ──
const kbCost = ref(0)
const kbCostBySource = ref([])   // [{ kb_kind, kb_id, kb_name, cost, tokens, requests }]
async function loadKbCost() {
  const id = agentId.value
  if (!id) { kbCost.value = 0; kbCostBySource.value = []; return }
  try {
    const r = await api.getLlmUsage({ agent_id: id })
    kbCost.value = r.data?.kb_cost || 0
    kbCostBySource.value = r.data?.kb_cost_by_source || []
  } catch (e) { /* non-fatal — cost is informational */ }
}
function kbCostFor(kind, id) {
  const row = kbCostBySource.value.find(s => s.kb_kind === kind && String(s.kb_id) === String(id))
  return row ? (row.cost || 0) : 0
}
function fmtCost(v) {
  const n = Number(v || 0)
  if (n > 0 && n < 0.0001) return '<$0.0001'
  return '$' + n.toFixed(4)
}

// ── Files ──
const files = ref([])
const uploading = ref(false)
const indexProgress = ref({})   // { [docId]: { stage, percent, message, chunkCount } }
// Unified MarkItDown pipeline statuses (DocumentSource.conversion_status): queued → converting →
// chunking → embedding → ready | failed. 'reading' kept for backward-compat with older events.
const STAGE_LABELS = { queued: 'Queued…', pending: 'Preparing…', converting: 'Converting document…', reading: 'Converting document…', chunking: 'Splitting into chunks…', embedding: 'Generating embeddings…' }
async function loadFiles() {
  try { const r = await api.get('/context_files/', { params: { agent_id: agentId.value } }); files.value = Array.isArray(r.data) ? r.data : (r.data?.results || []) } catch (e) { files.value = [] }
  // Resume the status poll for anything still indexing (e.g. the page was reloaded mid-index), so the
  // card always reaches ready/failed even without a live socket.
  for (const f of files.value) {
    if (f.index_status && !['ready', 'failed'].includes(f.index_status)) pollFileStatus(f.id)
  }
}
async function onUpload(e) {
  const file = e.target.files && e.target.files[0]
  if (!file) { return }
  // Confirm before adding to the knowledge base (indexing costs embedding tokens).
  const ok = await confirm({ title: 'Add to knowledge base?',
    message: `Save “${file.name}” and index it so your agent can answer from it? This embeds the file (small cost).`,
    confirmText: 'Save & Index' })
  if (!ok) { e.target.value = ''; return }
  uploading.value = true
  try {
    const res = await api.uploadAgentFile(agentId.value, file)
    const doc = res.data || {}
    doc.index_status = doc.index_status || 'queued'
    if (doc.id != null) files.value.unshift(doc)
    notify.success('File uploaded — indexing started')
    if (doc.id != null) await triggerIndex(doc.id)
    else await loadFiles()
  }
  catch (err) { notify.error('Upload failed') }
  finally { uploading.value = false; e.target.value = '' }
}
// Poll fallback: flip the card to ready/failed even if the live WS event is missed (freshly-mounted
// step, dropped socket, etc.). Stops early once the WS has already resolved the file.
async function pollFileStatus(docId, tries = 45) {
  for (let i = 0; i < tries; i++) {
    const cur = fileIndex({ id: docId, index_status: (files.value.find(f => f.id === docId) || {}).index_status })
    if (cur.stage === 'ready' || cur.stage === 'failed') return
    await new Promise(r => setTimeout(r, 2000))
    let st
    try { st = (await api.getAgentFileStatus(docId)).data } catch (e) { continue }
    if (st.index_status === 'ready' || st.index_status === 'failed') { applyFileStatus(docId, st); return }
    if (st.index_status) setProgress(docId, st.index_status, indexProgress.value[docId]?.percent || 0, '', st.chunk_count || 0)
  }
}
function setProgress(docId, stage, percent, message, chunkCount) {
  indexProgress.value = { ...indexProgress.value, [docId]: { stage, percent, message, chunkCount } }
}
function fileIndex(f) {
  const p = indexProgress.value[f.id]
  if (p) return p
  const stage = f.index_status || 'pending'
  return { stage, percent: stage === 'ready' ? 100 : 0, message: '', chunkCount: f.chunk_count || 0 }
}
async function triggerIndex(docId) {
  setProgress(docId, 'queued', 0, 'Queued…')
  connectKbWs()
  try {
    const r = await api.indexAgentFile(docId)
    if (r.data && r.data.queued === false) {
      // No-Celery env: index ran synchronously → read the final status now.
      try { const st = await api.getAgentFileStatus(docId); applyFileStatus(docId, st.data) } catch (e) { /* WS may still deliver */ }
    } else {
      // Async (Celery): WS pushes live progress; poll as a backstop so the card always flips.
      pollFileStatus(docId)
    }
  } catch (e) {
    setProgress(docId, 'failed', 0, 'Index trigger failed')
    notify.error('Could not start indexing')
  }
}
function applyFileStatus(docId, st) {
  if (!st) return
  const stage = st.index_status || 'ready'
  setProgress(docId, stage, stage === 'ready' ? 100 : 0, st.index_error || '', st.chunk_count || 0)
  const i = files.value.findIndex(f => f.id === docId)
  if (i !== -1) files.value[i] = { ...files.value[i], index_status: stage, chunk_count: st.chunk_count ?? files.value[i].chunk_count }
  if (stage === 'ready') loadKbCost()
}
function retryIndex(f) { triggerIndex(f.id) }
async function removeFile(f) {
  if (!(await confirm({ title: 'Delete file?', message: `Remove "${f.filename || f.name || 'this file'}" and its indexed chunks?`, confirmText: 'Delete', danger: true }))) return
  try { await api.deleteGenericFile(f.id); files.value = files.value.filter(x => x.id !== f.id); loadKbCost() } catch (e) { notify.error('Could not remove file') }
}
function fileMeta(f) {
  // Same line/style as before — reflects live index status while embedding, else type · size.
  const p = fileIndex(f)
  if (p.stage && p.stage !== 'ready' && p.stage !== 'failed') {
    const label = STAGE_LABELS[p.stage] || 'Indexing…'
    return p.percent ? `${label} ${p.percent}%` : label
  }
  if (p.stage === 'failed') return 'Indexing failed'
  const ext = (f.filename || f.name || '').split('.').pop()
  const type = ext ? ext.toUpperCase() : (f.file_type || 'FILE')
  return `${type} · ${formatSize(f.size ?? f.file_size ?? f.size_bytes)}`
}
function formatSize(b) {
  if (!b && b !== 0) return '—'
  if (b >= 1048576) return `${(b / 1048576).toFixed(1)} MB`
  if (b >= 1024) return `${Math.round(b / 1024)} KB`
  return `${b} B`
}

// ── URLs (website knowledge sources) ──
const webSources = ref([])
const addWebsiteOpen = ref(false)
const pagesModalSource = ref(null)
async function loadUrls() {
  try { const r = await api.listWebSources(agentId.value); webSources.value = Array.isArray(r.data) ? r.data : (r.data?.results || []) } catch (e) { webSources.value = [] }
}
function openAddWebsite() {
  if (!agentId.value) { notify.info('Give your agent a name first so it can save — then add a website.'); return }
  addWebsiteOpen.value = true
}
function onWebsiteAdded() { addWebsiteOpen.value = false; connectKbWs(); loadUrls() }
function onWebsiteDiscarded() { loadUrls() }
// A single URL/YouTube document was queued from inside the Add-URL modal (it converts + indexes
// itself and lands in the Files list). Keep the modal open; just refresh Files + live progress.
function onDocAdded() { connectKbWs(); loadFiles() }
function openPages(w) { pagesModalSource.value = w }
async function reindexUrl(w) {
  try { await api.reindexWebSource(w.id); notify.success('Re-indexing started'); connectKbWs(); loadUrls() } catch (e) { notify.error(e.response?.data?.error || 'Could not re-index') }
}
async function cancelUrl(w) {
  try { await api.cancelWebSource(w.id); notify.success('Cancelled'); loadUrls() } catch (e) { notify.error('Could not cancel') }
}
async function removeUrl(w) {
  if (!(await confirm({ title: 'Remove website?', message: `Remove "${w.display_name || w.root_url || 'this source'}" and its indexed pages?`, confirmText: 'Remove', danger: true }))) return
  try { await api.deleteWebSource(w.id); webSources.value = webSources.value.filter(x => x.id !== w.id); loadKbCost() } catch (e) { notify.error('Could not remove URL') }
}
const WS_INDEXING = new Set(['discovering', 'indexing'])
function urlMeta(w) {
  const st = w.status
  if (st === 'discovering') return w.last_url ? `Discovering… ${w.last_url}` : 'Discovering pages…'
  if (st === 'indexing') return `Indexing ${w.indexed_count || 0}/${w.selected_count || w.discovered_count || 0}…`
  if (st === 'failed') return 'Failed'
  if (st === 'cancelled') return `Cancelled · ${w.indexed_count || 0} indexed`
  if (st === 'partial') return `Partial · ${w.indexed_count || 0} page(s) · ${w.chunk_count || 0} chunks`
  if (st === 'ready') return `Indexed ${w.indexed_count || 0} page(s) · ${w.chunk_count || 0} chunks`
  if (st === 'discovered') return `${w.discovered_count || 0} page(s) discovered — not added`
  const t = w.created_at || w.updated_at
  return t ? `Added ${ago(t)}` : 'Queued'
}

// ── Memory Sources card = attached (shared) knowledge bases from the user's other agents ──
const attachedSources = ref([])       // [{ kind, id, name, chunk_count, owner_agent }]
const sourcesModalOpen = ref(false)   // View all sources
const sourcePickerOpen = ref(false)   // Add Source (library picker)
const library = ref({ files: [], websites: [] })
const libraryLoading = ref(false)
const picked = ref(new Set())         // "file:<id>" | "web:<id>"
const attaching = ref(false)
// Attached shared KnowledgeSources (Help Center etc.) shown alongside cloned file/website KBs.
const attachedSharedSources = computed(() => sharedSources.value
  .filter(s => attachedKsIds.value.includes(s.id))
  .map(s => ({ kind: 'shared', id: s.id, name: s.name, chunk_count: s.chunk_count,
    owner_agent: s.scope === 'system' ? 'Shared' : (s.scope === 'admin' ? 'Admin' : 'You') })))
const allAttachedSources = computed(() => [...attachedSharedSources.value, ...attachedSources.value])
const memorySources = computed(() => allAttachedSources.value.map(s => ({
  id: `${s.kind}:${s.id}`, name: s.name,
  meta: `${s.owner_agent ? s.owner_agent + ' · ' : ''}${s.chunk_count || 0} chunks`,
})))
async function loadAttachedSources() {
  if (!agentId.value) { attachedSources.value = []; return }
  try { const r = await api.getAgentKnowledgeAttachments(agentId.value); attachedSources.value = r.data?.attached || [] } catch (e) { attachedSources.value = [] }
}
async function openSourcePicker() {
  if (!agentId.value) { notify.info('Give your agent a name first so it can save — then attach a knowledge base.'); return }
  sourcePickerOpen.value = true
  picked.value = new Set()
  libPage.value = 1
  libraryLoading.value = true
  ensureKsIds()
  try {
    const [lib] = await Promise.all([api.getAgentKnowledgeLibrary(agentId.value), loadSharedSources()])
    library.value = { files: lib.data?.files || [], websites: lib.data?.websites || [] }
  }
  catch (e) { library.value = { files: [], websites: [] }; notify.error('Could not load your knowledge bases') }
  finally { libraryLoading.value = false }
}
const libraryItems = computed(() => [...sharedLibraryItems.value, ...library.value.websites, ...library.value.files])
// Picker pagination — 10 sources per page (selections persist across pages; picked is keyed by id).
const LIB_PAGE_SIZE = 10
const libPage = ref(1)
const libTotalPages = computed(() => Math.max(1, Math.ceil(libraryItems.value.length / LIB_PAGE_SIZE)))
const pagedLibraryItems = computed(() => libraryItems.value.slice((libPage.value - 1) * LIB_PAGE_SIZE, libPage.value * LIB_PAGE_SIZE))
function pickKey(it) { return `${it.kind === 'shared' ? 'ks' : (it.kind === 'website' ? 'web' : 'file')}:${it.id}` }
function togglePick(it) {
  if (it.attached) return
  const k = pickKey(it); const s = new Set(picked.value)
  s.has(k) ? s.delete(k) : s.add(k)
  picked.value = s
}
async function attachPicked() {
  if (!picked.value.size || attaching.value) return
  attaching.value = true
  const web_source_ids = [], context_file_ids = [], ks_ids = []
  for (const k of picked.value) {
    const [kind, id] = k.split(':')
    if (kind === 'web') web_source_ids.push(Number(id))
    else if (kind === 'ks') ks_ids.push(Number(id))
    else context_file_ids.push(Number(id))
  }
  try {
    // Shared KnowledgeSources attach via the agent's M2M (no chunk clone) — a single PATCH.
    if (ks_ids.length) {
      const next = [...new Set([...attachedKsIds.value, ...ks_ids])]
      await saveKsIds(next)
    }
    // Files/websites still clone chunks onto this agent.
    if (web_source_ids.length || context_file_ids.length) {
      const r = await api.attachAgentKnowledge(agentId.value, { web_source_ids, context_file_ids })
      attachedSources.value = r.data?.attached || attachedSources.value
    }
    await loadAttachedSources()
    notify.success('Attached — now searchable by this agent')
    sourcePickerOpen.value = false
  } catch (e) { notify.error('Could not attach knowledge base') }
  finally { attaching.value = false }
}
const refreshingSource = ref('')
async function refreshSource(s) {
  refreshingSource.value = `${s.kind}:${s.id}`
  const body = s.kind === 'website' ? { web_source_ids: [s.id] } : { context_file_ids: [s.id] }
  try {
    const r = await api.refreshAgentKnowledge(agentId.value, body)
    attachedSources.value = r.data?.attached || attachedSources.value
    notify.success(`Re-synced — ${r.data?.cloned_chunks || 0} chunks`)
  } catch (e) { notify.error('Could not refresh') }
  finally { refreshingSource.value = '' }
}
async function detachSource(s) {
  if (s.kind === 'shared') {
    try { await saveKsIds(attachedKsIds.value.filter(id => id !== s.id)); notify.success('Detached') }
    catch (e) { notify.error('Could not detach') }
    return
  }
  const body = s.kind === 'website' ? { web_source_ids: [s.id] } : { context_file_ids: [s.id] }
  try {
    const r = await api.detachAgentKnowledge(agentId.value, body)
    attachedSources.value = r.data?.attached || attachedSources.value.filter(x => !(x.kind === s.kind && x.id === s.id))
    notify.success('Detached')
  } catch (e) { notify.error('Could not detach') }
}

// ── Shared Knowledge Bases (system/admin KnowledgeSource records — e.g. Help Center) ──
// These are NOT per-agent clones; the agent references them via the knowledge_source_ids M2M.
// They appear INSIDE the same "Add Source" picker (kind: 'shared') and attach via a PATCH.
const sharedSources = ref([])       // [{ id, name, kind, scope, chunk_count }]
async function loadSharedSources() {
  try { const r = await api.listKnowledgeSources(); sharedSources.value = r.data?.sources || r.data?.results || (Array.isArray(r.data) ? r.data : []) }
  catch (e) { sharedSources.value = [] }
}
function ensureKsIds() {
  if (!Array.isArray(props.agent.knowledge_source_ids)) {
    props.agent.knowledge_source_ids = Array.isArray(props.agent.knowledge_sources)
      ? props.agent.knowledge_sources.map(s => s.id) : []
  }
}
const attachedKsIds = computed(() => Array.isArray(props.agent.knowledge_source_ids) ? props.agent.knowledge_source_ids : [])
// The shared sources as picker rows (marked attached from the agent's M2M).
const sharedLibraryItems = computed(() => sharedSources.value.map(s => ({
  kind: 'shared', id: s.id, name: s.name, chunk_count: s.chunk_count,
  owner_agent: s.scope === 'system' ? 'Shared' : (s.scope === 'admin' ? 'Admin' : 'You'),
  attached: attachedKsIds.value.includes(s.id),
})))
// Persist the agent's knowledge_source_ids (partial PATCH) after a shared attach/detach.
async function saveKsIds(next) {
  await api.patch(`/agents/${agentId.value}/`, { knowledge_source_ids: next })
  props.agent.knowledge_source_ids = next
}

// ── User Knowledge & RAG resources (the single "attach" card) ──
// Lists the user's standalone KB resources (files + websites) from /api/knowledge/. Attaching adds the
// resource's KnowledgeSource id to the agent's knowledge_source_ids (reference, no chunk copy).
const userKbResources = ref([])
const userKbLoading = ref(true)
const kbFilter = ref('')
const ksSaving = ref(false)

const filteredUserKb = computed(() => {
  const t = kbFilter.value.trim().toLowerCase()
  if (!t) return userKbResources.value
  return userKbResources.value.filter(r =>
    (r.name || '').toLowerCase().includes(t) || (r.root_url || '').toLowerCase().includes(t))
})
const KB_PAGE_SIZE = 5
const kbPage = ref(1)
const kbTotalPages = computed(() => Math.max(1, Math.ceil(filteredUserKb.value.length / KB_PAGE_SIZE)))
const pagedUserKb = computed(() =>
  filteredUserKb.value.slice((kbPage.value - 1) * KB_PAGE_SIZE, kbPage.value * KB_PAGE_SIZE))
watch(kbFilter, () => { kbPage.value = 1 })
watch(kbTotalPages, (tp) => { if (kbPage.value > tp) kbPage.value = tp })
function isAttached(id) { return attachedKsIds.value.includes(id) }

async function loadUserKb() {
  userKbLoading.value = true
  try {
    const r = await api.listKnowledge()
    userKbResources.value = r.data?.resources || []
  } catch (e) {
    userKbResources.value = []
  } finally {
    userKbLoading.value = false
  }
}

async function toggleAttach(r) {
  ensureKsIds()
  ksSaving.value = true
  const wasAttached = isAttached(r.id)
  const cur = [...attachedKsIds.value]
  const next = wasAttached ? cur.filter(x => x !== r.id) : [...cur, r.id]
  try {
    await saveKsIds(next)
    notify.success(wasAttached ? `Detached “${r.name}”` : `Attached “${r.name}”`)
  } catch (e) {
    notify.error('Could not update attachment')
  } finally {
    ksSaving.value = false
  }
}

// ── Live indexing WebSocket (files + web sources), unified per agent ──
const kbWs = ref(null)
function kbWsUrl(id) {
  const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${scheme}://${window.location.host}/ws/knowledge-index/${id}/`
}
function connectKbWs() {
  const id = agentId.value
  if (!id) return
  if (kbWs.value && kbWs.value.readyState === WebSocket.OPEN) return
  if (kbWs.value) { try { kbWs.value.close() } catch (e) { /* noop */ } kbWs.value = null }
  try {
    const sock = new WebSocket(kbWsUrl(id))
    kbWs.value = sock
    sock.onmessage = (e) => {
      let evt; try { evt = JSON.parse(e.data) } catch { return }
      if (evt.type === 'index_progress') handleIndexProgress(evt)
      else if (typeof evt.type === 'string' && evt.type.startsWith('web_source.')) upsertWebSource(evt)
    }
    sock.onclose = () => { if (kbWs.value === sock) kbWs.value = null }
    sock.onerror = () => { /* noop — status poll is the fallback */ }
  } catch (err) { /* noop */ }
}
function handleIndexProgress(evt) {
  setProgress(evt.document_id, evt.stage, evt.percent, evt.message, evt.total)
  const i = files.value.findIndex(f => f.id === evt.document_id)
  if (i !== -1) files.value[i] = { ...files.value[i], index_status: evt.stage, chunk_count: evt.total ?? files.value[i].chunk_count }
  if (evt.stage === 'ready') { notify.success(`Knowledge base ready: ${evt.name || 'file'}`); loadKbCost() }
  else if (evt.stage === 'failed') notify.error(`Indexing failed: ${evt.name || 'file'}`)
}
function upsertWebSource(payload) {
  const i = webSources.value.findIndex(w => String(w.id) === String(payload.source_id))
  if (i === -1) { loadUrls(); return }
  const cur = webSources.value[i]
  webSources.value[i] = {
    ...cur,
    status: payload.status ?? cur.status,
    discovered_count: payload.discovered ?? cur.discovered_count,
    selected_count: payload.selected ?? cur.selected_count,
    indexed_count: payload.indexed ?? cur.indexed_count,
    failed_count: payload.failed ?? cur.failed_count,
    chunk_count: payload.chunk_count ?? cur.chunk_count,
    last_url: payload.last_url || cur.last_url,
    updated_at: new Date().toISOString(),
  }
  if (payload.type === 'web_source.done' && (payload.status === 'ready' || payload.status === 'partial')) {
    notify.success(`Website indexed: ${webSources.value[i].display_name || webSources.value[i].root_url}`)
    loadKbCost()
  }
}

// ── Tools (grouped into category cards) ──
const toolDefs = ref([])
const loadingTools = ref(true)
const toolsModalOpen = ref(false)
const selectedGroup = ref(null)
const toolSearch = ref('')
const toolFilter = ref('all')
const modalFilters = [
  { key: 'all', label: 'All' },
  { key: 'recommended', label: 'Recommended', icon: Star },
  { key: 'connected', label: 'Connected', icon: Link2 },
  { key: 'approval', label: 'Requires approval', icon: Shield },
  { key: 'code', label: 'Code', icon: Braces },
  { key: 'database', label: 'Database', icon: Database },
]
async function loadTools() {
  loadingTools.value = true
  try {
    // The definitions endpoint is paginated — follow `next` so every category/count is complete.
    let all = []
    let next = '/tools/definitions/'
    let guard = 0
    while (next && guard++ < 60) {
      const r = await api.get(next)
      const d = r.data
      if (Array.isArray(d)) { all = all.concat(d); break }
      all = all.concat(d.results || [])
      if (d.next) { const u = new URL(d.next, window.location.origin); next = u.pathname.replace(/^\/api/, '') + u.search }
      else next = null
    }
    toolDefs.value = all
  }
  catch (e) { toolDefs.value = [] }
  finally { loadingTools.value = false }
}

// ── Connectors: assign a connected connector (all its tools) to THIS agent. Assigning just bulk-adds
// the connector's tool ids to agent.tool_ids (the same selection the tool cards use). ──
const connectors = ref([])
const allConnectors = ref([])        // full list (connected + available) for the hub modal
const showHub = ref(false)           // IntegrationHubModal open state
const connectorsLoading = ref(false)
const connectorsError = ref('')
const showAllConnectors = ref(false)
const CONN_PAGE_SIZE = 5
const connPage = ref(1)
const connTotalPages = computed(() => Math.max(1, Math.ceil(connectors.value.length / CONN_PAGE_SIZE)))
const displayedConnectors = computed(() =>
  connectors.value.slice((connPage.value - 1) * CONN_PAGE_SIZE, connPage.value * CONN_PAGE_SIZE))
watch(connTotalPages, (tp) => { if (connPage.value > tp) connPage.value = tp })
async function loadConnectors() {
  connectorsLoading.value = true
  connectorsError.value = ''
  try {
    const scope = props.agent?.id ? `agent:${props.agent.id}` : 'global'
    const { data } = await api.getConnectors(scope)
    const list = Array.isArray(data?.connectors) ? data.connectors : []
    allConnectors.value = list
    connectors.value = list.filter(c => c && c.connected)
  } catch (e) {
    console.error('[KnowledgeToolsStep] loadConnectors failed:', e)
    connectors.value = []
    connectorsError.value = e?.response?.data?.error || e?.message || 'Failed to load connectors'
  } finally { connectorsLoading.value = false }
}
const connectorKindLabel = (c) => ({ builtin: 'Built-in service', mcp: 'MCP server', service: 'Service' }[c.kind] || 'Connector')
// Map a connector to the tool objects it owns (built-in by category prefix, MCP by name prefix, service by id).
function connectorTools(c) {
  const tools = toolDefs.value || []
  if (c.kind === 'builtin') {
    const k = String(c.id).toLowerCase()
    return tools.filter(t => { const cat = (t.category || '').toLowerCase(); return cat === k || cat.startsWith(k + '.') })
  }
  if (c.kind === 'mcp') {
    // Use the backend's EXACT per-server tool ids. The old `startsWith('MCP_'+slug+'_')` over the GLOBAL
    // tool list wrongly swept in sibling servers whose slug extends this one (e.g. 'kurumera' matched
    // 'kurumera-mcp-server', 'kurumera-*-store', …) — inflating the count AND mis-assigning their tools.
    if (Array.isArray(c.tool_ids)) {
      const idset = new Set(c.tool_ids.map(String))
      return tools.filter(t => idset.has(String(t.id)))
    }
    // Fallback for an older API response without tool_ids (kept only so nothing breaks pre-deploy).
    const slug = String(c.slug || '').toUpperCase().replace(/[-\s]/g, '_')
    if (!slug) return []
    return tools.filter(t => String(t.name || '').toUpperCase().startsWith('MCP_' + slug + '_'))
  }
  if (c.kind === 'service') {
    return tools.filter(t => String(t.service_id ?? (t.service && t.service.id) ?? t.service ?? '') === String(c.id))
  }
  return []
}
function connectorAssigned(c) {
  const ts = connectorTools(c)
  return ts.length > 0 && ts.every(t => Array.isArray(props.agent.tool_ids) && props.agent.tool_ids.includes(t.id))
}
function toggleConnector(c) {
  const ts = connectorTools(c)
  if (!ts.length) { notify.info(`No tools synced for ${c.name} yet`); return }
  ensureToolIds()
  const cur = Array.isArray(props.agent.tool_ids) ? props.agent.tool_ids : []
  if (connectorAssigned(c)) {
    const remove = new Set(ts.map(t => t.id))
    props.agent.tool_ids = cur.filter(id => !remove.has(id))          // unassign ALL its tools
    notify.info(`Unassigned ${ts.length} tool(s) from ${c.name}`)
  } else {
    const have = new Set(cur)
    props.agent.tool_ids = [...cur, ...ts.map(t => t.id).filter(id => !have.has(id))]  // assign ALL its tools
    notify.success(`Assigned ${ts.length} tool(s) from ${c.name}`)
  }
}
// Open the connector hub as an inline MODAL (connect/manage without leaving the editor) — no redirect.
function openConnectorsHub() { showHub.value = true }
function onHubInstalled() { loadConnectors(); loadTools() }
// The category CARDS feature a curated set of categories (in this order); the full category list stays
// available in the "View tools" modal. Categories with no tools for this agent are simply omitted.
const CARD_CATEGORIES = ['aws', 'media', 'infrastructure', 'web']
const toolGroups = computed(() => {
  const byKey = new Map(modalGroups.value.map(g => [g.key, g]))
  return CARD_CATEGORIES.map(k => byKey.get(k)).filter(Boolean)
})
// ── Categories = the tool's REAL backend category (like the legacy picker), not hardcoded buckets ──
function groupKey(t) {
  if (t.category) return t.category
  if (t.name && String(t.name).startsWith('MCP_')) return 'mcp'
  if (t.service) return typeof t.service === 'string' ? t.service : 'services'
  return 'general'
}
const ACRONYMS = new Set(['mcp', 'api', 'llm', 'ai', 'sdk', 'url', 'http', 'https', 'db', 'sql', 'crm', 'ui', 'id', 'ip', 'os', 'aws', 'gcp', 'cli', 'ssh', 'dns', 'ml', 'nlp', 'io'])
function prettyCat(key) {
  if (!key) return 'General'
  return String(key).split(/[_\s-]+/).filter(Boolean)
    .map(w => ACRONYMS.has(w.toLowerCase()) ? w.toUpperCase() : (w.charAt(0).toUpperCase() + w.slice(1))).join(' ')
}
const CAT_ICONS = [
  { re: /automat|webhook|schedule|cron|signal|trigger|\bflow\b/, icon: Zap, tint: 'bg-amber-50 text-amber-600' },
  { re: /aws|cloud|gcp|azure/, icon: Cloud, tint: 'bg-orange-50 text-orange-600' },
  { re: /llm|gpt|claude|embed|vision|nlp|\bai\b/, icon: Sparkles, tint: 'bg-violet-50 text-violet-600' },
  { re: /shell|terminal|command|bash/, icon: Terminal, tint: 'bg-slate-100 text-slate-600' },
  { re: /code|index|analysis|python|script|lint/, icon: Braces, tint: 'bg-blue-50 text-blue-600' },
  { re: /diagnos|debug|introspect|\blog\b|monitor/, icon: Bug, tint: 'bg-rose-50 text-rose-600' },
  { re: /data|db|sql|database|query|store/, icon: Database, tint: 'bg-teal-50 text-teal-600' },
  { re: /discover|search|retriev|knowledge|crawl|\burl\b/, icon: Search, tint: 'bg-cyan-50 text-cyan-600' },
  { re: /file|document|upload|folder|filesystem/, icon: Folder, tint: 'bg-blue-50 text-blue-600' },
  { re: /network|http|\bapi\b|remote|service|integration|connect|web/, icon: Network, tint: 'bg-indigo-50 text-indigo-600' },
  { re: /content|text|writ|memory/, icon: FileType, tint: 'bg-emerald-50 text-emerald-600' },
  { re: /mcp/, icon: Link2, tint: 'bg-fuchsia-50 text-fuchsia-600' },
  { re: /security|permission|guard|auth/, icon: Shield, tint: 'bg-red-50 text-red-600' },
]
function catVisual(key, label) {
  const h = `${key} ${label}`.toLowerCase()
  return CAT_ICONS.find(r => r.re.test(h)) || { icon: Wrench, tint: 'bg-slate-100 text-slate-600' }
}
const modalGroups = computed(() => {
  const map = new Map()
  for (const t of toolDefs.value) {
    const k = groupKey(t)
    if (!map.has(k)) {
      const label = t.category_label || prettyCat(k)
      const v = catVisual(k, label)
      map.set(k, { key: k, label, icon: v.icon, tint: v.tint, desc: `Enable and manage ${label} tools.`, tools: [] })
    }
    map.get(k).tools.push(t)
  }
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label))
})
const filteredModalTools = computed(() => {
  const q = toolSearch.value.trim().toLowerCase()
  // Search spans ALL tools (across categories); otherwise show the selected category's tools.
  let tools = q ? toolDefs.value : (selectedGroup.value?.tools || [])
  const filter = toolFilter.value
  if (filter === 'connected') tools = tools.filter(toolOn)
  if (filter === 'approval') tools = tools.filter(t => toolText(t).includes('approval') || toolText(t).includes('credential') || toolText(t).includes('permission'))
  if (filter === 'code') tools = tools.filter(t => toolText(t).includes('code') || toolText(t).includes('python') || toolText(t).includes('terminal'))
  if (filter === 'database') tools = tools.filter(t => toolText(t).includes('database') || toolText(t).includes('sql') || toolText(t).includes('query'))
  if (q) tools = tools.filter(t => toolText(t).includes(q))
  return tools
})
const selectedCount = computed(() => filteredModalTools.value.filter(toolOn).length)
const selectedModalTools = computed(() => toolDefs.value.filter(toolOn))
function shortDesc(t) {
  const d = t.description || ''
  return d.length > 40 ? d.slice(0, 40) + '…' : d
}
function toolText(t) {
  return [t.display_name, t.name, t.description, t.category, t.category_label, t.permission].filter(Boolean).join(' ').toLowerCase()
}
function toolTags(tool) {
  const source = [tool.category_label, tool.category, tool.permission].filter(Boolean)
  const nameBits = String(tool.display_name || tool.name || '').split(/[\s_/-]+/).filter(Boolean)
  return [...new Set([...source, ...nameBits])].map(t => String(t).toLowerCase()).filter(Boolean).slice(0, 3)
}
function ensureToolIds() { if (!Array.isArray(props.agent.tool_ids)) props.agent.tool_ids = [] }
const toolOn = (tool) => Array.isArray(props.agent.tool_ids) && props.agent.tool_ids.includes(tool.id)
const catOn = (grp) => grp.tools.length > 0 && grp.tools.every(t => Array.isArray(props.agent.tool_ids) && props.agent.tool_ids.includes(t.id))
function toggleCategory(grp) {
  ensureToolIds()
  const ids = props.agent.tool_ids
  if (catOn(grp)) {
    props.agent.tool_ids = ids.filter(id => !grp.tools.some(t => t.id === id))
  } else {
    for (const t of grp.tools) if (!ids.includes(t.id)) ids.push(t.id)
  }
}
function toggleTool(tool) {
  ensureToolIds()
  if (toolOn(tool)) {
    props.agent.tool_ids = props.agent.tool_ids.filter(id => id !== tool.id)
  } else {
    props.agent.tool_ids.push(tool.id)
  }
}
function openToolsModal(group) {
  // Open on the clicked category (cards pass a real group), else the first category.
  const groups = modalGroups.value
  selectedGroup.value = (group?.key && groups.find(g => g.key === group.key)) || groups[0] || null
  toolSearch.value = ''
  toolFilter.value = 'all'
  toolsModalOpen.value = true
}
function closeToolsModal() {
  toolsModalOpen.value = false
}
function enableAllModalTools() {
  ensureToolIds()
  for (const tool of filteredModalTools.value) {
    if (!props.agent.tool_ids.includes(tool.id)) props.agent.tool_ids.push(tool.id)
  }
}
function disableAllModalTools() {
  ensureToolIds()
  const remove = new Set(filteredModalTools.value.map(t => t.id))
  props.agent.tool_ids = props.agent.tool_ids.filter(id => !remove.has(id))
}

onMounted(() => { loadFiles(); loadUrls(); loadTools(); loadKbCost(); loadAttachedSources(); loadSharedSources(); loadUserKb(); ensureKsIds(); connectKbWs(); loadConnectors() })
// The agent prop can populate AFTER mount (parent fetches it async) — (re)connect the WS + reload the
// per-agent data when the id first becomes available, mirroring the legacy builder.
watch(agentId, (id, prev) => {
  if (id && id !== prev) { connectKbWs(); loadFiles(); loadUrls(); loadKbCost(); loadAttachedSources(); loadSharedSources(); ensureKsIds(); loadConnectors() }
})
// When the agent object hydrates late, derive the attached shared-source ids so toggles show as ON.
watch(() => props.agent.knowledge_sources, () => ensureKsIds())
onBeforeUnmount(() => { if (kbWs.value) { try { kbWs.value.close() } catch (e) { /* noop */ } kbWs.value = null } })
</script>

<style scoped>
.field { border: 1px solid #D0D5DD; border-radius: 9px; padding: 8px 11px; font-size: 12.5px; color: #0F172A; background: #fff; outline: none; transition: box-shadow .15s, border-color .15s; }
.field:focus { border-color: #2563EB; box-shadow: 0 0 0 3px #EAF0FF; }
.badge { font-size: 11px; font-weight: 600; padding: 2px 9px; border-radius: 999px; white-space: nowrap; }
.btn-outline { display: inline-flex; align-items: center; gap: 7px; border: 1px solid #E5E7EB; background: #fff; border-radius: 10px; padding: 8px 13px; font-size: 13px; font-weight: 600; color: #344054; cursor: pointer; }
.btn-outline:hover { border-color: #cdd5e0; color: #0F172A; }
.view-link { display: inline-flex; align-items: center; gap: 3px; background: none; border: none; cursor: pointer; color: #2563EB; font-size: 12.5px; font-weight: 600; padding: 0; }
.view-link:hover { color: #1D4ED8; }
.add-btn { display: inline-flex; align-items: center; gap: 5px; border: 1px solid #E5E7EB; background: #fff; border-radius: 9px; padding: 6px 11px; font-size: 12px; font-weight: 600; color: #344054; cursor: pointer; }
.add-btn:hover { border-color: #2563EB; color: #2563EB; }
.add-btn-sm { display: grid; place-items: center; height: 34px; width: 36px; border: none; border-radius: 9px; background: #2563EB; color: #fff; cursor: pointer; flex-shrink: 0; }
.add-btn-sm:hover:not(:disabled) { background: #1D4ED8; }
.add-btn-sm:disabled { opacity: .5; cursor: not-allowed; }
.icon-x { display: grid; place-items: center; height: 22px; width: 22px; border-radius: 6px; color: #98A2B3; cursor: pointer; flex-shrink: 0; }
.icon-x:hover { background: #FEECEB; color: #F04438; }
.modal-close { display: grid; height: 36px; width: 36px; place-items: center; border: 1px solid #E5E7EB; border-radius: 10px; color: #475569; background: #fff; }
.modal-close:hover { border-color: #CBD5E1; color: #0F172A; }
.modal-search { height: 38px; width: 100%; border: 1px solid #D9E0EA; border-radius: 10px; background: #fff; padding: 0 12px 0 38px; font-size: 13px; color: #0F172A; outline: none; box-shadow: 0 1px 2px rgba(16,24,40,.03); }
.modal-search:focus { border-color: #2563EB; box-shadow: 0 0 0 3px #EAF0FF; }
.modal-filter-chip { display: inline-flex; height: 38px; align-items: center; gap: 8px; border: 1px solid; border-radius: 7px; padding: 0 18px; font-size: 14px; font-weight: 650; transition: border-color .15s, background .15s, color .15s, box-shadow .15s; }
.modal-filter-chip:hover { border-color: #C7D2FE; box-shadow: 0 1px 2px rgba(15,23,42,.05); }
.modal-category-row { display: flex; width: 100%; align-items: center; gap: 12px; border: 0; border-radius: 8px; padding: 10px 12px; font-size: 15px; font-weight: 650; transition: background .15s, color .15s, box-shadow .15s; }
.tool-row { display: flex; align-items: center; gap: 18px; border-bottom: 1px solid #E5E7EB; padding: 20px 22px; background: #fff; }
.tool-row:last-child { border-bottom: 0; }
.tool-row:hover { background: #FCFCFF; }
.tool-add-btn { display: inline-flex; min-width: 96px; height: 38px; flex-shrink: 0; align-items: center; justify-content: center; gap: 8px; border: 1px solid; border-radius: 8px; padding: 0 16px; font-size: 14px; font-weight: 750; transition: background .15s, border-color .15s, color .15s; }
.modal-action { height: 34px; border: 1px solid #D9E0EA; border-radius: 9px; background: #fff; padding: 0 12px; font-size: 12.5px; font-weight: 700; color: #344054; }
.modal-action:hover { border-color: #2563EB; color: #2563EB; }
.modal-primary { height: 38px; border: none; border-radius: 10px; background: #2563EB; padding: 0 18px; font-size: 13px; font-weight: 700; color: #fff; box-shadow: 0 1px 2px rgba(37,99,235,.25); }
.modal-primary:hover { background: #1D4ED8; }
.modal-secondary { height: 38px; border: 1px solid #D9E0EA; border-radius: 9px; background: #fff; padding: 0 20px; font-size: 13px; font-weight: 700; color: #344054; }
.modal-secondary:hover { border-color: #CBD5E1; color: #0F172A; }
.modal-toggle { position: relative; height: 22px; width: 42px; flex-shrink: 0; border-radius: 999px; transition: background .15s; }
.modal-toggle-dot { display: block; height: 18px; width: 18px; border-radius: 999px; background: #fff; box-shadow: 0 1px 2px rgba(16,24,40,.22); transition: transform .15s; }
.tool-chip { border-radius: 999px; background: #F1F5F9; padding: 3px 8px; font-size: 11px; font-weight: 700; color: #475569; }
.selected-tool-chip { display: inline-flex; height: 34px; max-width: 170px; align-items: center; gap: 8px; border: 1px solid #DCD9FF; border-radius: 7px; background: #F2F0FF; padding: 0 11px; font-size: 12px; font-weight: 700; color: #4338CA; }
.selected-tool-chip button { display: grid; place-items: center; flex-shrink: 0; }
.pg-btn { display: grid; place-items: center; height: 28px; width: 28px; border: 1px solid #E5E7EB; border-radius: 8px; color: #475569; background: #fff; }
.pg-btn:hover:not(:disabled) { border-color: #2563EB; color: #2563EB; }
.pg-btn:disabled { opacity: .4; cursor: not-allowed; }
.line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
</style>
