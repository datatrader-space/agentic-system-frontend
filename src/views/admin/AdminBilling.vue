<template>
  <div class="ab admin-page">
    <header class="ab-head admin-page-header">
      <div class="heading-main"><span class="page-icon"><WalletCards :size="25" aria-hidden="true" /></span>
        <div><div class="eyebrow">PLATFORM FINANCE</div><h1 class="admin-page-title">Billing &amp; Wallets</h1>
          <p>Understand usage, manage prepaid balances, and keep pricing in check.</p></div>
      </div>
      <span class="context-badge"><CircleDollarSign :size="14" aria-hidden="true" /> All amounts in USD</span>
    </header>
    <div class="billing-note"><Info :size="15" aria-hidden="true" /><span>Prepaid billing · Paid API calls use provider cost × markup. Platform staff are exempt.</span></div>

    <div class="tabs admin-tabs" role="tablist" aria-label="Billing">
      <button v-for="t in TABS" :id="`tab-${t.key}`" :key="t.key" class="tab" role="tab" type="button"
              :aria-selected="tab === t.key" :aria-controls="`panel-${t.key}`" :class="{ on: tab === t.key }"
              :tabindex="tab === t.key ? 0 : -1" @keydown="navigateTabs($event, t.key)"
              @click="setTab(t.key)"><component :is="t.icon" :size="16" aria-hidden="true" />{{ t.label }}</button>
    </div>

    <div class="workspace-heading"><div><h2 class="admin-section-title">{{ activeTab.title }}</h2><p>{{ activeTab.description }}</p></div>
      <button v-if="tab === 'usage'" class="btn" type="button" :disabled="exporting" @click="exportCsv"><Download :size="15" aria-hidden="true" />{{ exporting ? 'Exporting…' : 'Export CSV' }}</button>
      <RouterLink v-if="tab === 'pricing'" class="btn" to="/admin-dashboard/model-pricing">Manage model pricing <ArrowUpRight :size="15" aria-hidden="true" /></RouterLink>
    </div>
    <div v-if="tabErrors[tab]" class="billing-load-error" role="alert"><AlertTriangle :size="17" aria-hidden="true" /><span>{{ tabErrors[tab] }}</span><button type="button" class="btn" @click="reloadActiveTab">Try again</button></div>

    <!-- Usage & charges: every cent traced -->
    <section v-if="tab === 'usage'" id="panel-usage" class="card admin-surface" role="tabpanel" aria-labelledby="tab-usage">
      <div v-if="summary" class="kpis usage-kpis admin-metrics">
        <div class="kpi admin-metric"><span><ReceiptText :size="16" aria-hidden="true" /> Charged</span><strong>${{ exactUsd(summary.total_charged_usd) }}</strong><small>Usage charges in this selection</small></div>
        <div class="kpi admin-metric"><span><Layers :size="16" aria-hidden="true" /> Provider cost</span><strong>${{ exactUsd(summary.total_cost_usd) }}</strong><small>Underlying platform API costs</small></div>
        <div class="kpi accent admin-metric"><span><TrendingUp :size="16" aria-hidden="true" /> Margin</span><strong>${{ exactUsd(summary.total_margin_usd) }}</strong><small>Charged less provider cost</small></div>
      </div>
      <div v-else-if="!tabErrors.usage" class="vm-skel" style="height:120px" role="status" aria-label="Loading usage totals"></div>
      <div class="surface filter-surface">
      <div class="section-heading"><div><h3 class="admin-section-title">Filter activity</h3><p>Find charges by person, source, or date.</p></div><SlidersHorizontal :size="17" aria-hidden="true" /></div>
      <form class="usage-filters admin-toolbar" @submit.prevent="loadUsage">
        <label class="field"><span>Person (name or email)</span><input v-model="filters.q" placeholder="Anyone" /></label>
        <label class="field"><span>Entry</span>
          <select v-model="filters.kind"><option v-for="k in ENTRY_KINDS" :key="k" :value="k">{{ k === 'all' ? 'Everything' : k.replace('_', ' ') }}</option></select></label>
        <label class="field"><span>Kind of usage</span>
          <select v-model="filters.usage_kind"><option v-for="k in USAGE_KINDS" :key="k" :value="k">{{ k ? kindLabel(k) : 'All kinds' }}</option></select></label>
        <label class="field"><span>From</span><input v-model="filters.date_from" type="date" /></label>
        <label class="field"><span>To</span><input v-model="filters.date_to" type="date" /></label>
        <details class="advanced-filters">
          <summary>Advanced filters <span v-if="advancedFilterCount" class="count-label">{{ advancedFilterCount }} active</span><ChevronDown :size="14" aria-hidden="true" /></summary>
          <div class="advanced-grid">
        <label class="field"><span>Provider</span><input v-model="filters.provider" placeholder="e.g. openrouter" /></label>
        <label class="field"><span>Model</span><input v-model="filters.model" placeholder="exact model id" /></label>
        <label class="field"><span>Agent id</span><input v-model="filters.agent" inputmode="numeric" /></label>
        <label class="field"><span>Chat id</span><input v-model="filters.conversation" inputmode="numeric" /></label>
          </div>
        </details>
        <div class="actions">
          <button class="btn primary" type="submit" :disabled="chargesLoading">{{ chargesLoading ? 'Loading…' : 'Apply' }}</button>
          <button class="btn" type="button" @click="resetFilters">Clear</button>

          <span v-if="filters.user" class="muted admin-muted">Person #{{ filters.user }} <button class="linkish" type="button" @click="filters.user = ''; loadUsage()">remove</button></span>
        </div>
      </form>
      </div>

      <div class="surface">
      <div class="section-heading group-heading">
        <div><h3 class="admin-section-title">Usage breakdown</h3><p>Select a row to narrow the activity below.</p></div>
        <div class="filters admin-toolbar" role="group" aria-label="Group by">
          <button v-for="g in GROUPS" :key="g.key" type="button" class="chip" :class="{ on: groupBy === g.key }"
                  :aria-pressed="groupBy === g.key" @click="groupBy = g.key; loadUsage()">{{ g.label }}</button>
        </div>
      </div>
      <div class="table-wrap admin-table-scroll">
        <table class="tbl admin-table">
          <thead><tr><th>{{ GROUPS.find(g => g.key === groupBy).label }}</th><th class="num">Entries</th><th class="num">Tokens in / out</th>
            <th class="num">Provider cost</th><th class="num">Charged</th><th class="num">Margin</th></tr></thead>
          <tbody>
            <tr v-for="(g, i) in summary?.groups || []" :key="i" class="clickable" tabindex="0" @click="drill(g)" @keydown.enter="drill(g)">
              <td>{{ groupLabel(g) }}</td><td class="num">{{ g.count }}</td>
              <td class="num">{{ g.prompt_tokens.toLocaleString() }} / {{ g.completion_tokens.toLocaleString() }}</td>
              <td class="num">${{ g.cost_usd }}</td><td class="num">${{ g.charged_usd }}</td><td class="num">${{ g.margin_usd }}</td>
            </tr>
            <tr v-if="summary && !summary.groups.length"><td colspan="6" class="muted admin-muted">Nothing matches these filters.</td></tr>
          </tbody>
        </table>
      </div>

      </div>
      <div class="surface">
      <div class="section-heading"><div><h3 class="admin-section-title">Transaction activity</h3><p>Every entry, with its cost and balance. Select a row for the full trace.</p></div><span class="count-label">{{ charges.length }} loaded</span></div>
      <p v-if="chargesLoading" class="loading-line" role="status">Loading activity…</p>
      <div class="table-wrap admin-table-scroll">
        <table class="tbl admin-table">
          <thead><tr><th>When</th><th>Person</th><th>What</th><th>Model / provider</th><th class="num">Cost</th><th class="num">Charged</th><th class="num">Balance</th></tr></thead>
          <tbody>
            <template v-for="c in charges" :key="c.id">
              <tr class="clickable" tabindex="0" :aria-expanded="openCharge === c.id" @click="openCharge = openCharge === c.id ? null : c.id" @keydown.enter="openCharge = openCharge === c.id ? null : c.id">
                <td class="nowrap">{{ when(c.created_at) }}</td>
                <td>{{ c.username }}<div class="muted admin-muted">{{ c.email }}</div></td>
                <td>{{ c.description || c.kind }}<div class="muted admin-muted">{{ c.usage_kind ? kindLabel(c.usage_kind) : c.kind }}<template v-if="c.agent_name"> · {{ c.agent_name }}</template></div></td>
                <td>{{ c.model || '—' }}<div class="muted admin-muted">{{ c.provider }}</div></td>
                <td class="num">{{ c.provider_cost_usd != null ? `$${c.provider_cost_usd}` : '—' }}</td>
                <td class="num" :class="Number(c.amount_usd) >= 0 ? 'pos' : ''">{{ signedUsd(c.amount_usd) }}</td>
                <td class="num">{{ signedUsd(c.balance_after_usd, false) }}</td>
              </tr>
              <tr v-if="openCharge === c.id" class="detail">
                <td colspan="7">
                  <dl class="trace">
                    <div><dt>Entry</dt><dd>#{{ c.id }} · {{ c.kind }} · key <code>{{ c.idempotency_key }}</code></dd></div>
                    <div><dt>Person</dt><dd>{{ c.username }} (user {{ c.user_id }})</dd></div>
                    <div><dt>Source</dt><dd>{{ c.source_type || '—' }} {{ c.source_id }}<template v-if="c.llm_request_log_id"> · request log #{{ c.llm_request_log_id }}</template></dd></div>
                    <div><dt>Agent / chat / run</dt><dd>{{ c.agent_name || c.agent_id || '—' }} · {{ c.conversation_id || '—' }} · {{ c.billing_run_id || '—' }}</dd></div>
                    <div><dt>Tokens</dt><dd>{{ c.prompt_tokens }} in · {{ c.completion_tokens }} out</dd></div>
                    <div><dt>Money</dt><dd>cost ${{ c.provider_cost_usd ?? '—' }} × markup {{ c.markup ?? '—' }} = {{ c.amount_usd }}</dd></div>
                    <div v-if="c.reason"><dt>Reason</dt><dd>{{ c.reason }}<template v-if="c.actor_id"> (by user {{ c.actor_id }})</template></dd></div>
                  </dl>
                </td>
              </tr>
            </template>
            <tr v-if="!chargesLoading && !charges.length && !tabErrors.usage"><td colspan="7" class="muted admin-muted">No entries.</td></tr>
          </tbody>
        </table>
      </div>
      <button v-if="chargesNext" class="btn ghost more" type="button" :disabled="chargesMoreLoading" @click="moreCharges">{{ chargesMoreLoading ? 'Loading…' : 'Show older' }}</button>
      </div>
    </section>

    <!-- Settings -->
    <section v-if="tab === 'settings'" id="panel-settings" class="card admin-surface" role="tabpanel" aria-labelledby="tab-settings">
      <div v-if="!form && !tabErrors.settings" class="vm-skel" style="height:160px"></div>
      <form v-if="form" class="grid-form admin-responsive-grid" @submit.prevent="saveSettings">
        <div class="settings-section"><div class="settings-intro"><span class="section-icon"><Percent :size="19" aria-hidden="true" /></span><h3 class="admin-section-title">Pricing &amp; top-ups</h3><p>Set the platform markup and limits for prepaid payments.</p></div><div class="settings-fields admin-responsive-grid">
        <label class="field">
          <span>Markup</span>
          <input v-model="form.markup" inputmode="decimal" aria-describedby="h-markup" />
          <small id="h-markup">Price = provider cost × this. 1 = cost price; 1.25 adds 25% (covers Stripe's fee).</small>
          <em v-if="errors.markup" role="alert">{{ errors.markup }}</em>
        </label>
        <label class="field">
          <span>Smallest top-up ($)</span>
          <input v-model="form.min_topup_usd" inputmode="decimal" />
          <em v-if="errors.min_topup_usd" role="alert">{{ errors.min_topup_usd }}</em>
        </label>
        <label class="field">
          <span>Largest top-up ($)</span>
          <input v-model="form.max_topup_usd" inputmode="decimal" />
          <em v-if="errors.max_topup_usd" role="alert">{{ errors.max_topup_usd }}</em>
        </label>
        <label class="field">
          <span>Preset amounts ($, comma separated)</span>
          <input v-model="form.presets" />
          <em v-if="errors.preset_amounts" role="alert">{{ errors.preset_amounts }}</em>
        </label>
        </div></div>
        <div class="settings-section"><div class="settings-intro"><span class="section-icon"><Wallet :size="19" aria-hidden="true" /></span><h3 class="admin-section-title">Credit &amp; notifications</h3><p>Manage the starting balance and when people receive a low-balance notification.</p></div><div class="settings-fields admin-responsive-grid">
        <label class="field">
          <span>Starting credit for a new person ($)</span>
          <input v-model="form.starting_credit_usd" inputmode="decimal" />
          <small>Given once per email address, after the email is verified. Platform staff get none.</small>
          <em v-if="errors.starting_credit_usd" role="alert">{{ errors.starting_credit_usd }}</em>
        </label>
        <label class="field">
          <span>Low-balance notification under ($)</span>
          <input v-model="form.low_balance_usd" inputmode="decimal" />
          <em v-if="errors.low_balance_usd" role="alert">{{ errors.low_balance_usd }}</em>
        </label>
        </div></div>
        <fieldset class="group" aria-describedby="h-training">
          <legend>Training API prices</legend>
          <p id="h-training" class="muted admin-muted">Optional. What the shared Cloud API for trained models costs the platform, in dollars.</p>
          <div class="group-grid admin-responsive-grid">
            <label v-for="f in TRAINING_PRICE_FIELDS" :key="f.key" class="field" :for="`f-${f.key}`">
              <span>{{ f.label }} ($)</span>
              <input :id="`f-${f.key}`" v-model="form[f.key]" inputmode="decimal" placeholder="Not set"
                     :aria-invalid="errors[f.key] ? 'true' : undefined"
                     :aria-describedby="errors[f.key] ? `h-${f.key} e-${f.key}` : `h-${f.key}`" />
              <small :id="`h-${f.key}`">{{ f.help }}</small>
              <em v-if="errors[f.key]" :id="`e-${f.key}`" role="alert">{{ errors[f.key] }}</em>
            </label>
          </div>
        </fieldset>
        <div class="actions save-bar">
          <button class="btn primary" type="submit" :disabled="saving"><Save :size="15" aria-hidden="true" />{{ saving ? 'Saving…' : 'Save settings' }}</button>
          <span class="muted admin-muted">Every change is recorded with your name.</span>
        </div>
      </form>
    </section>

    <!-- Wallets -->
    <section v-if="tab === 'wallets'" id="panel-wallets" class="card admin-surface" role="tabpanel" aria-labelledby="tab-wallets">
      <template v-if="!selected">
        <div class="surface">
        <div class="section-heading"><div><h3 class="admin-section-title">Workspace wallets</h3><p>Search for a person to review their balance and ledger.</p></div><span class="count-label">{{ wallets.length }} loaded</span></div>
        <div class="wallet-toolbar"><label class="search">
          <Search :size="16" aria-hidden="true" />
          <span class="sr-only">Search people</span>
          <input v-model="q" placeholder="Search by username or email…" @input="debouncedSearch" />
        </label><span class="muted admin-muted">Held funds are reserved for work in progress.</span></div>
        <div v-if="walletsLoading && !wallets.length" class="vm-skel" style="height:120px"></div>
        <div v-else class="table-wrap admin-table-scroll">
          <table class="tbl admin-table">
            <thead><tr><th>Person</th><th class="num">Balance</th><th class="num">Held</th><th></th></tr></thead>
            <tbody>
              <tr v-for="w in wallets" :key="w.wallet_id">
                <td><div class="person-cell"><span class="avatar" aria-hidden="true">{{ (w.username || '?').slice(0, 1).toUpperCase() }}</span><div><strong>{{ w.username }}</strong><div class="muted admin-muted">{{ w.email }}</div></div></div></td>
                <td class="num" :class="{ neg: Number(w.balance_usd) <= 0 }">${{ w.balance_usd }}<span v-if="w.exempt" class="tag">staff</span></td>
                <td class="num">${{ w.held_usd }}</td>
                <td class="num"><button class="btn sm" type="button" @click="openWallet(w.user_id)" :aria-label="`Open wallet for ${w.username}`">View wallet <ArrowUpRight :size="14" aria-hidden="true" /></button></td>
              </tr>
              <tr v-if="!wallets.length"><td colspan="4" class="muted admin-muted">No wallets found.</td></tr>
            </tbody>
          </table>
        </div>
        <button v-if="walletsNext" class="btn ghost more" type="button" @click="loadWallets(false)">Show more</button>
        </div>
      </template>

      <template v-else>
        <button class="back" type="button" @click="closeWallet"><ArrowLeft :size="16" aria-hidden="true" /> All wallets</button>
        <div class="who surface">
          <div>
            <h2 class="admin-section-title">{{ selected.user.username }}</h2>
            <div class="muted admin-muted">{{ selected.user.email }}</div>
          </div>
          <div><span class="balance-label">Current balance</span><div class="big">${{ selected.wallet.balance_usd }}</div></div>
        </div>

        <form class="adjust surface" @submit.prevent="adjust">
          <div class="section-heading"><div><h3 class="admin-section-title">Adjust the balance</h3><p>Add or remove credit. A reason is required and recorded with the adjustment.</p></div><CircleDollarSign :size="19" aria-hidden="true" /></div>
          <div class="adjust-row">
            <label class="field">
              <span>Amount ($, negative to take away)</span>
              <input v-model="adj.amount" inputmode="decimal" placeholder="5.00" />
            </label>
            <label class="field grow">
              <span>Reason (required, recorded)</span>
              <input v-model="adj.reason" maxlength="2000" placeholder="e.g. goodwill credit for an outage" />
            </label>
            <button class="btn primary" type="submit" :disabled="adjusting || !adj.amount || !adj.reason.trim()">
              {{ adjusting ? 'Saving…' : 'Apply' }}
            </button>
          </div>
        </form>

        <div v-if="selected.holds.length" class="holds surface">
          <h3 class="admin-section-title">Money held for work in progress</h3>
          <ul>
            <li v-for="h in selected.holds" :key="h.id">
              <span>{{ h.description || h.usage_kind }} · ${{ h.amount_usd }} · <span :class="['state', h.state]">{{ h.state }}</span></span>
              <button v-if="h.state === 'unsettled'" class="btn sm" type="button" @click="releaseHold(h)">Release</button>
            </li>
          </ul>
        </div>

        <div class="surface"><div class="section-heading"><div><h3 class="admin-section-title">Wallet ledger</h3><p>Balance changes and usage charges for this person.</p></div></div>
        <div class="table-wrap admin-table-scroll">
          <table class="tbl admin-table">
            <thead><tr><th>When</th><th>What</th><th class="num">Cost</th><th class="num">Charged</th><th class="num">Balance</th></tr></thead>
            <tbody>
              <tr v-for="e in selected.entries" :key="e.id">
                <td class="nowrap">{{ when(e.created_at) }}</td>
                <td>{{ e.description || e.kind }}<div v-if="e.reason" class="muted admin-muted">Reason: {{ e.reason }}</div></td>
                <td class="num">{{ e.provider_cost_usd != null ? `$${e.provider_cost_usd}` : '—' }}</td>
                <td class="num" :class="Number(e.amount_usd) >= 0 ? 'pos' : ''">{{ signedUsd(e.amount_usd) }}</td>
                <td class="num">{{ signedUsd(e.balance_after_usd, false) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <button v-if="selected.next_before" class="btn ghost more" type="button" @click="moreEntries">Show older</button>
        </div>
      </template>
    </section>

    <!-- Pricing coverage -->
    <section v-if="tab === 'pricing'" id="panel-pricing" class="card admin-surface" role="tabpanel" aria-labelledby="tab-pricing">
      <div v-if="!coverage && !tabErrors.pricing" class="vm-skel" style="height:120px"></div>
      <template v-if="coverage">
        <div class="kpis coverage-kpis admin-metrics">
          <div class="kpi admin-metric"><span><Layers :size="16" aria-hidden="true" /> Active models</span><strong>{{ coverage.total }}</strong><small>In the pricing inventory</small></div>
          <div class="kpi admin-metric"><span><CheckCircle2 :size="16" aria-hidden="true" /> Priced models</span><strong>{{ coverage.models.filter(m => m.status === 'priced').length }}</strong><small>Have a configured price</small></div>
          <div class="kpi admin-metric" :class="{ warning: coverage.missing }"><span><AlertTriangle :size="16" aria-hidden="true" /> Missing a price</span><strong>{{ coverage.missing }}</strong><small>Calls are blocked until priced</small></div>
        </div>
        <div class="surface">
        <div class="cover-sum" :class="coverage.missing ? 'bad' : 'good'" role="status">
          <component :is="coverage.missing ? AlertTriangle : CheckCircle2" :size="18" aria-hidden="true" />
          <span v-if="coverage.missing">{{ coverage.missing }} of {{ coverage.total }} models have no price. People cannot
            use them: a call on an unpriced model is refused, never run for free. Set prices on
            <RouterLink to="/admin-dashboard/model-pricing">Model Pricing</RouterLink>.</span>
          <span v-else>{{ coverage.total === 1 ? 'The one active model has a price.' : `All ${coverage.total} active models have a price.` }}</span>
        </div>
        <div class="section-heading"><div><h3 class="admin-section-title">Model pricing inventory</h3><p>Review availability and provider rates.</p></div><div class="filters admin-toolbar">
          <button v-for="f in ['missing', 'all']" :key="f" type="button" class="chip" :class="{ on: coverFilter === f }"
                  :aria-pressed="coverFilter === f" @click="coverFilter = f">{{ f === 'all' ? 'All models' : 'Missing a price' }}</button>
        </div></div>
        <div class="table-wrap admin-table-scroll">
          <table class="tbl admin-table">
            <thead><tr><th>Model</th><th>Platform API</th><th>Kind</th><th>Price</th></tr></thead>
            <tbody>
              <tr v-for="m in coverRows" :key="`${m.provider_id}:${m.model_id}`">
                <td><strong>{{ m.name }}</strong><div class="muted mono admin-muted">{{ m.model_id }}</div></td>
                <td>{{ m.provider }}</td>
                <td>{{ m.kind }}</td>
                <td>
                  <span :class="['pill', m.status]">{{ STATUS[m.status] }}</span>
                  <span v-if="m.price?.input_per_1m_usd != null" class="muted admin-muted"> ${{ m.price.input_per_1m_usd }} / ${{ m.price.output_per_1m_usd }} per 1M</span>
                  <span v-else-if="m.price?.per_item_usd != null" class="muted admin-muted"> ${{ m.price.per_item_usd }} each</span>
                </td>
              </tr>
              <tr v-if="!coverRows.length"><td colspan="4" class="muted admin-muted">Nothing to show.</td></tr>
            </tbody>
          </table>
        </div>
        </div>
      </template>
    </section>

    <!-- Revenue -->
    <section v-if="tab === 'revenue'" id="panel-revenue" class="card admin-surface" role="tabpanel" aria-labelledby="tab-revenue">
      <div class="period-toolbar"><span class="muted admin-muted"><CalendarDays :size="15" aria-hidden="true" /> Reporting period</span>
        <label class="days"><span class="sr-only">Period</span>
          <select v-model.number="days" aria-label="Period" @change="loadRevenue">
            <option :value="7">Last 7 days</option><option :value="30">Last 30 days</option>
            <option :value="90">Last 90 days</option><option :value="365">Last year</option>
          </select>
        </label>
      </div>
      <div v-if="!revenue && !tabErrors.revenue" class="vm-skel" style="height:120px"></div>
      <template v-if="revenue">
        <div class="kpis revenue-kpis admin-metrics">
          <div class="kpi admin-metric"><span>Top-ups</span><strong>${{ exactUsd(revenue.topups_usd) }}</strong><small>{{ revenue.topup_count }} {{ revenue.topup_count === 1 ? 'payment' : 'payments' }}</small></div>
          <div class="kpi admin-metric"><span>Charged for usage</span><strong>${{ exactUsd(revenue.charged_usd) }}</strong></div>
          <div class="kpi admin-metric"><span>Provider cost</span><strong>${{ exactUsd(revenue.provider_cost_usd) }}</strong></div>
          <div class="kpi accent admin-metric"><span>Margin</span><strong>${{ margin }}</strong><small>Charged less provider cost</small></div>
        </div>
        <div class="surface"><div class="section-heading"><div><h3 class="admin-section-title">Balance &amp; adjustments</h3><p>Credits, reversals, and costs absorbed by the platform.</p></div></div><div class="kpis secondary-kpis admin-metrics">
          <div class="kpi admin-metric"><span>Paid by the platform</span><strong>${{ exactUsd(revenue.platform_paid_usd) }}</strong><small>failed renders nobody was charged for</small></div>
          <div class="kpi admin-metric"><span>Refunds</span><strong>${{ exactUsd(revenue.refunds_usd) }}</strong></div>
          <div class="kpi admin-metric"><span>Disputes</span><strong>${{ exactUsd(revenue.disputes_usd) }}</strong></div>
          <div class="kpi admin-metric"><span>Starting credit given</span><strong>${{ exactUsd(revenue.starting_credit_usd) }}</strong></div>
          <div class="kpi admin-metric"><span>Balances held by people</span><strong>${{ exactUsd(revenue.balances_outstanding_usd) }}</strong></div>
        </div>
        </div>
        <div class="surface"><div class="section-heading"><div><h3 class="admin-section-title">Revenue by usage</h3><p>Compare customer charges with provider costs for each type of usage.</p></div><span class="legend"><i></i> Charged <i></i> Cost</span></div>
        <div v-if="Object.keys(revenue.by_usage_kind).length" class="usage-chart" aria-label="Usage cost comparison">
          <div v-for="(v, k) in revenue.by_usage_kind" :key="k" class="chart-row"><span>{{ kindLabel(k) }}</span><div class="chart-tracks"><div class="chart-bar charged" :style="{ width: revenueBar(v.charged_usd) + '%' }"></div><div class="chart-bar cost" :style="{ width: revenueBar(v.cost_usd) + '%' }"></div></div><strong>${{ exactUsd(v.charged_usd) }}</strong></div>
        </div>
        <div class="table-wrap admin-table-scroll">
          <table class="tbl admin-table">
            <thead><tr><th>Kind</th><th class="num">Provider cost</th><th class="num">Charged</th></tr></thead>
            <tbody>
              <tr v-for="(v, k) in revenue.by_usage_kind" :key="k"><td>{{ kindLabel(k) }}</td><td class="num">${{ exactUsd(v.cost_usd) }}</td><td class="num">${{ exactUsd(v.charged_usd) }}</td></tr>
              <tr v-if="!Object.keys(revenue.by_usage_kind).length"><td colspan="3" class="muted admin-muted">No usage in this period.</td></tr>
            </tbody>
          </table>
        </div>
        </div>
      </template>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Search, ArrowLeft, AlertTriangle, CheckCircle2, WalletCards, CircleDollarSign, Info, ReceiptText, Layers, TrendingUp, Download, ArrowUpRight, SlidersHorizontal, ChevronDown, Percent, Wallet, Save, CalendarDays, Settings2, ChartNoAxesCombined } from 'lucide-vue-next'
import api from '../../services/api'
import { notify } from '../../composables/useNotify'

const TABS = [
  { key: 'usage', label: 'Usage & charges', icon: ReceiptText, title: 'Usage & charges', description: 'Follow every charge from provider cost to customer balance.' },
  { key: 'settings', label: 'Settings', icon: Settings2, title: 'Billing settings', description: 'Configure pricing rules, prepaid payments, and starting credit.' },
  { key: 'wallets', label: 'Wallets', icon: Wallet, title: 'Customer wallets', description: 'Review prepaid balances, reserved funds, and transaction history.' },
  { key: 'pricing', label: 'Pricing coverage', icon: Layers, title: 'Pricing coverage', description: 'Make sure active models have the prices they need to serve paid calls.' },
  { key: 'revenue', label: 'Revenue', icon: ChartNoAxesCombined, title: 'Revenue overview', description: 'See payments, usage revenue, and platform costs in one place.' },
]
const STATUS = { priced: 'Priced', missing: 'No price', local_free: 'Free (local)' }

const route = useRoute()
const router = useRouter()
const tab = ref(TABS.some(t => t.key === route.query.tab) ? route.query.tab : 'usage')
const activeTab = computed(() => TABS.find(t => t.key === tab.value))
const tabErrors = ref({})
const chargesMoreLoading = ref(false)
let usageRequest = 0, walletRequest = 0, walletDetailRequest = 0, revenueRequest = 0, coverageRequest = 0
let disposed = false
function loadError(key, message) { tabErrors.value[key] = message; notify.error(message) }
function reloadActiveTab() { ({ usage: loadUsage, settings: loadSettings, wallets: () => loadWallets(true), pricing: loadCoverage, revenue: loadRevenue })[tab.value]() }
function navigateTabs(event, key) {
  const index = TABS.findIndex(t => t.key === key)
  const next = event.key === 'ArrowRight' ? (index + 1) % TABS.length : event.key === 'ArrowLeft' ? (index + TABS.length - 1) % TABS.length : event.key === 'Home' ? 0 : event.key === 'End' ? TABS.length - 1 : -1
  if (next < 0) return
  event.preventDefault()
  setTab(TABS[next].key)
  event.currentTarget.parentElement.querySelector(`#tab-${TABS[next].key}`)?.focus()
}
function revenueBar(value) {
  const max = Math.max(0, ...Object.values(revenue.value?.by_usage_kind || {}).flatMap(v => [Number(v.cost_usd) || 0, Number(v.charged_usd) || 0]))
  return max ? Math.max(0, Number(value) || 0) / max * 100 : 0
}

// ── Usage & charges: every cent, who spent it, on what, where, and what it cost the platform ──
const USAGE_KINDS = ['', 'llm', 'embedding', 'image', 'video', 'audio', 'search', 'sandbox', 'training']
// The same names the person's Billing page uses.
const KIND_LABEL = { llm: 'AI models', embedding: 'Embeddings', image: 'Images', video: 'Video', audio: 'Audio',
  search: 'Web search', sandbox: 'Sandboxes', training: 'Training', serving: 'Model serving' }
function kindLabel(k) { return KIND_LABEL[k] || k }
// An exact amount with its sign and a dollar sign: -$0.00148625, +$10 (sign only when asked).
function signedUsd(v, sign = true) {
  const n = Number(v)
  if (!Number.isFinite(n)) return ''
  return (n < 0 ? '−' : sign && n > 0 ? '+' : '') + '$' + exactUsd(Math.abs(n))
}
const ENTRY_KINDS = ['charge', 'topup', 'refund', 'dispute', 'adjustment', 'starting_credit', 'all']
const GROUPS = [{ key: 'user', label: 'Person' }, { key: 'usage_kind', label: 'Kind' }, { key: 'model', label: 'Model' },
  { key: 'provider', label: 'Provider' }, { key: 'agent', label: 'Agent' }, { key: 'conversation', label: 'Chat' },
  { key: 'day', label: 'Day' }]
const filters = ref({ q: '', user: '', kind: 'charge', usage_kind: '', provider: '', model: '', agent: '',
  conversation: '', date_from: '', date_to: '' })
const advancedFilterCount = computed(() => ['provider', 'model', 'agent', 'conversation'].filter(k => filters.value[k] !== '').length)
const groupBy = ref('user')
const summary = ref(null)
const charges = ref([])
const chargesNext = ref(null)
const chargesLoading = ref(false)
const openCharge = ref(null)
const exporting = ref(false)
function cleanFilters() {
  const out = {}
  for (const [k, v] of Object.entries(filters.value)) if (v !== '' && v != null) out[k] = v
  return out
}
// Money as it really is: cents for ordinary amounts, every digit when a cent would hide it (one AI call can cost
// $0.0002, and "$0.00" would say it cost nothing).
function exactUsd(v) {
  const n = Number(v || 0)
  if (n === 0) return '0.00'
  const cents = n.toFixed(2)
  return Number(cents) === n ? cents : n.toFixed(8).replace(/0+$/, '')
}
function groupLabel(g) {
  const k = g.key || {}
  if (groupBy.value === 'user') return `${k.wallet__user__username || '?'} (${k.wallet__user__email || 'no email'})`
  if (groupBy.value === 'model') return `${k.model_name || '—'} · ${k.provider_type || '—'}`
  if (groupBy.value === 'agent') return k.agent_name || (k.agent_id ? `Agent ${k.agent_id}` : 'No agent')
  if (groupBy.value === 'conversation') return k.conversation_id ? `Chat ${k.conversation_id}` : 'No chat'
  return Object.values(k)[0] || '—'
}
function drill(g) {
  const k = g.key || {}
  if (groupBy.value === 'user') filters.value.user = k.wallet__user_id
  else if (groupBy.value === 'usage_kind') filters.value.usage_kind = k.usage_kind || ''
  else if (groupBy.value === 'model') { filters.value.model = k.model_name || ''; filters.value.provider = k.provider_type || '' }
  else if (groupBy.value === 'provider') filters.value.provider = k.provider_type || ''
  else if (groupBy.value === 'agent') filters.value.agent = k.agent_id || ''
  else if (groupBy.value === 'conversation') filters.value.conversation = k.conversation_id || ''
  else if (groupBy.value === 'day') { filters.value.date_from = k.day; filters.value.date_to = k.day }
  loadUsage()
}
function resetFilters() {
  filters.value = { q: '', user: '', kind: 'charge', usage_kind: '', provider: '', model: '', agent: '', conversation: '',
    date_from: '', date_to: '' }
  loadUsage()
}
async function loadUsage() {
  const request = ++usageRequest
  tabErrors.value.usage = ''
  chargesLoading.value = true
  openCharge.value = null
  try {
    const params = cleanFilters()
    const [s, c] = await Promise.all([api.billingAdminSpendSummary({ ...params, group_by: groupBy.value }),
      api.billingAdminCharges(params)])
    if (disposed || request !== usageRequest) return
    summary.value = s.data
    charges.value = c.data.charges
    chargesNext.value = c.data.next_before
  } catch (e) { if (!disposed && request === usageRequest) loadError('usage', apiError(e, 'Could not load usage')) } finally { if (request === usageRequest) chargesLoading.value = false }
}
async function moreCharges() {
  if (chargesMoreLoading.value || !chargesNext.value) return
  const request = usageRequest
  chargesMoreLoading.value = true
  try {
    const { data } = await api.billingAdminCharges({ ...cleanFilters(), before: chargesNext.value })
    if (disposed || request !== usageRequest) return
    charges.value = [...charges.value, ...data.charges]
    chargesNext.value = data.next_before
  } catch (e) { if (!disposed && request === usageRequest) loadError('usage', apiError(e, 'Could not load older entries')) }
  finally { chargesMoreLoading.value = false }
}
async function exportCsv() {
  if (exporting.value) return
  exporting.value = true
  try {
    const { data } = await api.billingAdminChargesCsv(cleanFilters())
    const url = URL.createObjectURL(new Blob([data], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url; a.download = `aadml-charges-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
    URL.revokeObjectURL(url)
  } catch (e) { notify.error(apiError(e, 'Could not export')) } finally { exporting.value = false }
}

// Prices of the shared Cloud API for trained models. Optional: an empty field saves as null, and then those calls
// are refused (never free).
const CHAT_HELP = 'People pay this × the markup. Empty: chat calls are refused.'
const TRAINING_PRICE_FIELDS = [
  { key: 'training_photo_call_usd', label: 'Cost of one photo call',
    help: 'What one call to a model on the shared Cloud API costs the platform. People pay this × the markup. Empty: photo calls are refused.' },
  { key: 'training_chat_input_per_1m_usd', label: 'Chat cost per 1M input tokens', help: CHAT_HELP },
  { key: 'training_chat_output_per_1m_usd', label: 'Chat cost per 1M output tokens', help: CHAT_HELP },
]
function optionalPrice(v) { const s = v == null ? '' : String(v).trim(); return s === '' ? null : s }

const form = ref(null)
const errors = ref({})
const saving = ref(false)

const q = ref('')
const wallets = ref([])
const walletsNext = ref(null)
const walletsLoading = ref(false)
const selected = ref(null)
const adj = ref({ amount: '', reason: '' })
const adjusting = ref(false)

const coverage = ref(null)
const coverFilter = ref('missing')
const coverRows = computed(() => (coverage.value?.models || []).filter(m => coverFilter.value === 'all' || m.status === 'missing'))

const revenue = ref(null)
const days = ref(30)
const margin = computed(() => exactUsd(Number(revenue.value?.charged_usd || 0) - Number(revenue.value?.provider_cost_usd || 0)))

function setTab(k) { tab.value = k; router.replace({ query: { ...route.query, tab: k } }); loadTab() }
function when(s) { return new Date(s).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) }
function apiError(e, fallback) { return e.response?.data?.detail || e.response?.data?.error || fallback }

async function loadSettings() {
  tabErrors.value.settings = ''
  try {
    const { data } = await api.billingAdminSettings()
    if (disposed) return
    const s = data.settings
    form.value = { markup: s.markup, min_topup_usd: s.min_topup_usd, max_topup_usd: s.max_topup_usd,
      presets: (s.preset_amounts || []).join(', '), starting_credit_usd: s.starting_credit_usd, low_balance_usd: s.low_balance_usd }
    for (const f of TRAINING_PRICE_FIELDS) form.value[f.key] = s[f.key] ?? ''
  } catch (e) { if (!disposed) loadError('settings', apiError(e, 'Could not load billing settings')) }
}
async function saveSettings() {
  if (saving.value || !form.value) return
  saving.value = true
  errors.value = {}
  const presets = form.value.presets.split(',').map(v => v.trim()).filter(Boolean).map(Number)
  try {
    await api.billingAdminSaveSettings({ markup: form.value.markup, min_topup_usd: form.value.min_topup_usd,
      max_topup_usd: form.value.max_topup_usd, preset_amounts: presets,
      starting_credit_usd: form.value.starting_credit_usd, low_balance_usd: form.value.low_balance_usd,
      ...Object.fromEntries(TRAINING_PRICE_FIELDS.map(f => [f.key, optionalPrice(form.value[f.key])])) })
    notify.success('Billing settings saved')
    await loadSettings()
  } catch (e) {
    errors.value = e.response?.data?.fields || {}
    notify.error(apiError(e, 'Could not save the settings'))
  } finally { saving.value = false }
}

let searchTimer = null
function debouncedSearch() { clearTimeout(searchTimer); searchTimer = setTimeout(() => loadWallets(true), 300) }
async function loadWallets(reset = true) {
  if (!reset && walletsLoading.value) return
  const request = ++walletRequest
  tabErrors.value.wallets = ''
  walletsLoading.value = true
  try {
    const params = { q: q.value || undefined }
    if (!reset && walletsNext.value) params.before = walletsNext.value
    const { data } = await api.billingAdminWallets(params)
    if (disposed || request !== walletRequest) return
    wallets.value = reset ? data.wallets : [...wallets.value, ...data.wallets]
    walletsNext.value = data.next_before
  } catch (e) { if (!disposed && request === walletRequest) loadError('wallets', apiError(e, 'Could not load wallets')) } finally { if (request === walletRequest) walletsLoading.value = false }
}
function closeWallet() { walletDetailRequest++; selected.value = null }
async function openWallet(userId) {
  const request = ++walletDetailRequest
  try {
    const { data } = await api.billingAdminWallet(userId)
    if (disposed || request !== walletDetailRequest) return
    selected.value = data
    adj.value = { amount: '', reason: '' }
  } catch (e) { notify.error(apiError(e, 'Could not open the wallet')) }
}
async function moreEntries() {
  const { data } = await api.billingAdminWallet(selected.value.user.id, { before: selected.value.next_before })
  selected.value = { ...selected.value, entries: [...selected.value.entries, ...data.entries], next_before: data.next_before }
}
async function adjust() {
  if (adjusting.value || !selected.value || !adj.value.amount || !adj.value.reason.trim()) return
  const userId = selected.value.user.id
  adjusting.value = true
  try {
    await api.billingAdminAdjust(userId, adj.value.amount, adj.value.reason.trim())
    notify.success('Balance adjusted')
    await loadWallets(true)
    if (selected.value?.user.id === userId) await openWallet(userId)
  } catch (e) { notify.error(apiError(e, 'Could not adjust the balance')) } finally { adjusting.value = false }
}
async function releaseHold(h) {
  try {
    await api.billingAdminReleaseHold(h.id)
    notify.success('Hold released')
    await openWallet(selected.value.user.id)
  } catch (e) { notify.error(apiError(e, 'Could not release the hold')) }
}

async function loadCoverage() {
  const request = ++coverageRequest
  tabErrors.value.pricing = ''
  try { const { data } = await api.billingAdminPricingCoverage(); if (!disposed && request === coverageRequest) coverage.value = data } catch (e) { if (!disposed && request === coverageRequest) loadError('pricing', apiError(e, 'Could not load pricing coverage')) }
}
async function loadRevenue() {
  const request = ++revenueRequest
  tabErrors.value.revenue = ''
  revenue.value = null
  try { const { data } = await api.billingAdminRevenue(days.value); if (!disposed && request === revenueRequest) revenue.value = data } catch (e) { if (!disposed && request === revenueRequest) loadError('revenue', apiError(e, 'Could not load revenue')) }
}

function loadTab() {
  if (tab.value === 'usage' && !summary.value) loadUsage()
  if (tab.value === 'settings' && !form.value) loadSettings()
  if (tab.value === 'wallets' && !wallets.value.length) loadWallets(true)
  if (tab.value === 'pricing') loadCoverage()
  if (tab.value === 'revenue') loadRevenue()
}
onMounted(loadTab)
onBeforeUnmount(() => { disposed = true; clearTimeout(searchTimer) })
</script>

<style scoped>
.ab { max-width: 1100px; margin: 0 auto; padding: 24px 20px 64px; display: flex; flex-direction: column; gap: 16px; }
.ab-head h1 { margin: 0; font-size: 1.5rem; font-weight: 800; color: var(--vm-ink); }
.ab-head p { margin: 6px 0 0; color: var(--vm-ink-soft); font-size: .92rem; max-width: 75ch; line-height: 1.5; }
.card { background: var(--vm-surface); border: 1px solid var(--vm-border); border-radius: 14px; padding: 20px; }
.card h2 { margin: 0 0 4px; font-size: 1.1rem; color: var(--vm-ink); }
.card h3 { margin: 20px 0 10px; font-size: .95rem; color: var(--vm-ink); }
.muted { color: var(--vm-ink-soft); font-size: .8rem; }
.mono { font-family: var(--vm-font-mono); }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.row.between { justify-content: space-between; }

.tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--vm-border); overflow-x: auto; }
.tab { border: 0; background: none; padding: 10px 14px; min-height: 44px; font-weight: 600; font-size: .9rem; color: var(--vm-ink-soft);
  border-bottom: 2px solid transparent; cursor: pointer; white-space: nowrap; transition: color .15s, border-color .15s; }
.tab:hover { color: var(--vm-ink); }
.tab.on { color: var(--vm-primary); border-bottom-color: var(--vm-primary); }
.tab:focus-visible, .btn:focus-visible, .chip:focus-visible, .back:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 2px; }

.grid-form { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px 20px; }
.field { display: flex; flex-direction: column; gap: 6px; }
.field > span { font-size: .85rem; font-weight: 600; color: var(--vm-ink); }
.field input { min-height: 42px; padding: 0 12px; border-radius: 10px; border: 1px solid var(--vm-border); background: var(--vm-surface);
  color: var(--vm-ink); font-size: .95rem; }
.field input:focus { outline: none; border-color: var(--vm-focus); box-shadow: 0 0 0 3px rgba(46,144,250,.18); }
.field small { color: var(--vm-ink-soft); font-size: .78rem; line-height: 1.4; }
.field em { color: var(--vm-danger); font-style: normal; font-size: .8rem; }
.field.grow { flex: 1; }
.group { grid-column: 1 / -1; margin: 0; padding: 14px 16px 16px; border: 1px solid var(--vm-border); border-radius: 12px; min-width: 0; }
.group legend { padding: 0 6px; font-size: .9rem; font-weight: 700; color: var(--vm-ink); }
.group > p { margin: 0 0 12px; line-height: 1.4; }
.group-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px 20px; }
.group .field input { min-height: 44px; }
.field input[aria-invalid="true"] { border-color: var(--vm-danger); }
.actions { grid-column: 1 / -1; display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }

.btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 42px; padding: 8px 16px; border-radius: 10px;
  font-weight: 600; font-size: .88rem; cursor: pointer; border: 1px solid var(--vm-border); background: var(--vm-surface); color: var(--vm-ink);
  transition: opacity .15s; }
.btn.primary { background: var(--vm-g-brand); color: #fff; border: none; }
.btn.primary:hover:not(:disabled) { opacity: .92; }
.btn.sm { min-height: 34px; padding: 4px 12px; font-size: .8rem; }
.btn:disabled { opacity: .55; cursor: not-allowed; }
.btn.more { margin-top: 12px; }

.search { display: flex; align-items: center; gap: 8px; max-width: 420px; border: 1px solid var(--vm-border); border-radius: 10px;
  padding: 0 12px; margin-bottom: 14px; color: var(--vm-ink-soft); background: var(--vm-surface); }
.search input { border: 0; outline: 0; background: transparent; color: var(--vm-ink); min-height: 42px; width: 100%; font-size: .92rem; }
.search:focus-within { border-color: var(--vm-focus); }

.table-wrap { overflow-x: auto; }
.tbl { width: 100%; border-collapse: collapse; font-size: .88rem; }
.tbl th { text-align: left; font-size: .76rem; text-transform: uppercase; letter-spacing: .03em; color: var(--vm-ink-soft); font-weight: 700;
  padding: 8px 10px; border-bottom: 1px solid var(--vm-border); }
.tbl td { padding: 10px; border-bottom: 1px solid var(--vm-border); color: var(--vm-ink); vertical-align: top; }
.tbl .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.tbl .neg { color: var(--vm-danger); }
.tbl .pos { color: var(--vm-green); }
.nowrap { white-space: nowrap; }
.tag { margin-left: 6px; font-size: .68rem; font-weight: 700; padding: 1px 6px; border-radius: 999px; background: var(--vm-surface-soft); color: var(--vm-ink-soft); }

.back { display: inline-flex; align-items: center; gap: 6px; border: 0; background: none; color: var(--vm-primary); font-weight: 600;
  cursor: pointer; padding: 6px 0; min-height: 36px; }
.who { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; flex-wrap: wrap; margin: 8px 0 4px; }
.big { font-size: 2rem; font-weight: 800; color: var(--vm-ink); font-variant-numeric: tabular-nums; }
.adjust-row { display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap; }
.holds ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
.holds li { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 8px 12px; border: 1px solid var(--vm-border);
  border-radius: 10px; font-size: .88rem; color: var(--vm-ink); }
.state.unsettled { color: #b45309; font-weight: 700; }

.cover-sum { display: flex; gap: 10px; align-items: flex-start; padding: 12px 14px; border-radius: 10px; font-size: .9rem; line-height: 1.5; margin-bottom: 14px; }
.cover-sum.bad { color: #b42318; background: rgba(240,68,56,.08); }
.cover-sum.good { color: #047857; background: rgba(18,183,106,.1); }
.cover-sum a { color: inherit; font-weight: 700; }
.cover-sum svg { flex: none; margin-top: 2px; }
.filters { display: flex; gap: 6px; margin-bottom: 10px; }
.chip { min-height: 32px; padding: 4px 12px; border-radius: 999px; border: 1px solid var(--vm-border); background: var(--vm-surface);
  color: var(--vm-ink-soft); font-size: .82rem; font-weight: 600; cursor: pointer; }
.chip.on { background: var(--vm-primary-soft); color: var(--vm-primary); border-color: rgba(37,99,235,.35); }
.pill { font-size: .72rem; font-weight: 700; padding: 2px 8px; border-radius: 999px; }
.pill.priced { color: #047857; background: rgba(18,183,106,.12); }
.pill.missing { color: #b42318; background: rgba(240,68,56,.1); }
.pill.local_free { color: var(--vm-ink-soft); background: var(--vm-surface-soft); }

.days select { min-height: 40px; border-radius: 10px; border: 1px solid var(--vm-border); background: var(--vm-surface); color: var(--vm-ink); padding: 0 10px; }
.kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-top: 14px; }
.kpi { border: 1px solid var(--vm-border); border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 4px; }
.kpi span { color: var(--vm-ink-soft); font-size: .8rem; font-weight: 600; }
.kpi strong { color: var(--vm-ink); font-size: 1.35rem; font-variant-numeric: tabular-nums; }
.kpi small { color: var(--vm-ink-soft); font-size: .76rem; }

.usage-filters { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px 14px; margin-bottom: 8px; }
.usage-filters select { min-height: 42px; border-radius: 10px; border: 1px solid var(--vm-border); background: var(--vm-surface); color: var(--vm-ink); padding: 0 10px; }
.clickable { cursor: pointer; }
.clickable:hover td { background: var(--vm-surface-soft); }
.clickable:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: -2px; }
.detail td { background: var(--vm-surface-soft); }
.trace { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 8px 18px; margin: 0; font-size: .84rem; }
.trace dt { color: var(--vm-ink-soft); font-weight: 600; font-size: .76rem; }
.trace dd { margin: 2px 0 0; color: var(--vm-ink); word-break: break-word; }
.trace code { font-family: var(--vm-font-mono); font-size: .78rem; }
.linkish { border: 0; background: none; color: var(--vm-primary); cursor: pointer; padding: 0 4px; font-weight: 600; }

@media (max-width: 480px) {
  .ab { padding: 16px 14px 48px; }
  .adjust-row .btn { width: 100%; }
}
@media (prefers-reduced-motion: reduce) { .tab, .btn { transition: none; } }

/* Billing workspace: surface hierarchy shared by every tab. */
.ab { max-width: 1440px; padding: 32px 40px 64px; gap: 22px; --billing-accent: #4f46e5; }
.ab-head { display:flex; align-items:center; justify-content:space-between; gap:20px; }
.heading-main { display:flex; align-items:center; gap:16px; min-width:0; }
.page-icon,.section-icon { display:grid; place-items:center; flex:none; color:var(--billing-accent); background:#eeedff; border:1px solid #e0dfff; border-radius:14px; width:52px; height:52px; }
.eyebrow { font-size:11px; letter-spacing:.14em; font-weight:750; color:var(--vm-ink-soft); margin-bottom:5px; }
.ab-head h1 { font-size:27px; letter-spacing:-.7px; font-weight:750; line-height:1.2; }
.ab-head p { font-size:13px; margin-top:8px; }
.context-badge { display:flex; align-items:center; gap:7px; padding:8px 11px; border:1px solid var(--vm-border); border-radius:8px; background:var(--vm-surface); color:var(--vm-ink-soft); font-size:12px; white-space:nowrap; }
.billing-note { display:flex; align-items:center; gap:9px; color:var(--vm-ink-soft); font-size:12px; line-height:1.6; }
.billing-note svg { flex:none; color:var(--billing-accent); }
.tabs { padding:5px; gap:5px; border:1px solid var(--vm-border); border-radius:12px; background:var(--vm-surface); }
.tab { display:inline-flex; align-items:center; justify-content:center; gap:9px; flex:1; padding:10px 15px; border:0; border-radius:8px; font-size:12px; min-height:42px; }
.tab.on { color:var(--billing-accent); background:#eeedff; box-shadow:inset 0 0 0 1px #e4e2ff; }
.workspace-heading { display:flex; align-items:center; justify-content:space-between; gap:16px; margin-top:5px; }
.workspace-heading h2 { margin:0; color:var(--vm-ink); font-size:19px; font-weight:700; letter-spacing:-.3px; }
.workspace-heading p { margin:6px 0 0; font-size:12px; color:var(--vm-ink-soft); line-height:1.6; }
.card { border:0; border-radius:0; padding:0; background:transparent; display:flex; flex-direction:column; gap:22px; min-width:0; }
.surface,.settings-section,.group { background:var(--vm-surface); border:1px solid var(--vm-border); border-radius:13px; overflow:hidden; min-width:0; }
.section-heading { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:20px 22px; color:var(--vm-ink-soft); }
.card .section-heading h3 { margin:0; font-size:14px; font-weight:700; letter-spacing:-.1px; }
.section-heading p { margin:5px 0 0; font-size:12px; color:var(--vm-ink-soft); line-height:1.6; }
.count-label { padding:5px 8px; background:var(--vm-surface-soft); border-radius:6px; font-size:11px; white-space:nowrap; font-weight:600; color:var(--vm-ink-soft); }
.kpis { margin:0; gap:16px; grid-template-columns:repeat(3,minmax(0,1fr)); }
.kpi { min-width:0; padding:21px 22px; border-radius:12px; background:var(--vm-surface); gap:11px; }
.kpi span { display:flex; align-items:center; gap:9px; font-size:12px; font-weight:600; }
.kpi span svg { color:var(--billing-accent); }
.kpi strong { font-size:25px; font-weight:700; letter-spacing:-.8px; overflow-wrap:anywhere; line-height:1.3; }
.kpi small { font-size:11px; line-height:1.5; }
.kpi.accent { border-color:#d6e9df; background:#f3faf6; }
.kpi.accent strong,.kpi.accent span svg { color:#16835c; }
.kpi.warning { border-color:#f3dfbc; background:#fffbf3; }
.kpi.warning strong,.kpi.warning span svg { color:#a76516; }
.usage-filters { grid-template-columns: minmax(180px,1.4fr) repeat(4,minmax(0,1fr)); padding:0 22px 20px; margin:0; gap:16px; }
.field > span { font-size:12px; font-weight:600; }
.field input,.usage-filters select { min-width:0; width:100%; box-sizing:border-box; border-radius:7px; font-size:12px; min-height:40px; background:var(--vm-surface); }
.field input::placeholder { color:var(--vm-ink-soft); opacity:.75; }
.field small { font-size:12px; line-height:1.6; }
.advanced-filters { grid-column:1/-1; border-top:1px solid var(--vm-border); padding-top:14px; }
.advanced-filters summary { display:flex; align-items:center; gap:8px; cursor:pointer; list-style:none; font-size:12px; font-weight:600; color:var(--vm-ink-soft); width:fit-content; }
.advanced-filters summary::-webkit-details-marker { display:none; }
.advanced-filters[open] summary svg { transform:rotate(180deg); }
.advanced-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:16px; margin-top:16px; }
.actions { gap:10px; }
.btn { min-height:38px; border-radius:7px; padding:8px 13px; font-size:12px; font-weight:650; text-decoration:none; white-space:nowrap; }
.btn.primary { background:var(--billing-accent); border:1px solid var(--billing-accent); }
.btn.sm { border-radius:6px; font-size:11px; min-height:32px; }
.btn.more { margin:16px 22px; }
.group-heading { flex-wrap:wrap; }
.filters { gap:3px; margin:0; padding:3px; background:var(--vm-surface-soft); border:1px solid var(--vm-border); border-radius:7px; flex-wrap:wrap; }
.chip { font-size:11px; min-height:29px; padding:4px 10px; border:1px solid transparent; border-radius:5px; background:transparent; }
.chip.on { background:var(--vm-surface); border-color:var(--vm-border); color:var(--billing-accent); box-shadow:0 1px 2px #14213d08; }
.table-wrap { max-width:100%; }
.tbl { font-size:12px; }
.tbl th { background:var(--vm-surface-soft); font-size:10px; letter-spacing:.06em; padding:13px 18px; border-top:1px solid var(--vm-border); }
.tbl td { padding:16px 18px; line-height:1.65; vertical-align:middle; }
.tbl tr:last-child td { border-bottom:0; }
.tbl td:first-child { max-width:320px; overflow-wrap:anywhere; }
.tbl .muted { font-size:11px; line-height:1.7; }
.tbl strong { font-weight:650; }
.loading-line { font-size:12px; color:var(--vm-ink-soft); margin:0 22px 14px; }
.detail td { padding:22px; }
.trace { gap:18px; font-size:12px; }
.trace dt { font-size:11px; }
.grid-form { display:flex; flex-direction:column; gap:20px; }
.settings-section { display:grid; grid-template-columns:260px minmax(0,1fr); }
.settings-intro { padding:24px; border-right:1px solid var(--vm-border); background:var(--vm-surface-soft); }
.section-icon { height:36px; width:36px; border-radius:10px; margin-bottom:16px; }
.card .settings-intro h3 { font-size:14px; margin:0; }
.settings-intro p { margin:8px 0 0; font-size:12px; color:var(--vm-ink-soft); line-height:1.75; }
.settings-fields { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); padding:24px; gap:22px; }
.group { padding:22px 24px 24px; overflow:visible; }
.group legend { font-size:14px; padding:0 8px; }
.group > p { font-size:12px; margin:0 0 22px; }
.group-grid { grid-template-columns:repeat(3,minmax(0,1fr)); gap:22px; }
.save-bar { padding:18px 22px; background:var(--vm-surface); border:1px solid var(--vm-border); border-radius:12px; }
.save-bar .muted { font-size:12px; }
.wallet-toolbar { display:flex; align-items:center; justify-content:space-between; gap:18px; padding:0 22px 20px; }
.search { margin:0; flex:1; max-width:400px; border-radius:7px; }
.search input { font-size:12px; min-height:40px; }
.wallet-toolbar > .muted { font-size:11px; }
.person-cell { display:flex; align-items:center; gap:12px; }
.avatar { width:34px; height:34px; display:grid; place-items:center; flex:none; background:#eeedff; color:var(--billing-accent); border-radius:10px; font-size:12px; font-weight:700; }
.who { padding:25px; margin:0; align-items:center; }
.who h2 { font-size:20px; margin-bottom:7px; }
.who .muted { font-size:12px; }
.balance-label { display:block; font-size:11px; color:var(--vm-ink-soft); margin-bottom:5px; }
.big { font-size:30px; letter-spacing:-1px; }
.adjust-row { padding:0 22px 22px; }
.adjust-row .field:first-child { flex:0 1 240px; }
.holds { padding:22px; }
.card .holds h3 { margin:0 0 16px; }
.holds li { font-size:12px; padding:12px 14px; }
.cover-sum { margin:20px 22px 0; padding:14px; font-size:12px; border:1px solid transparent; }
.cover-sum.bad { background:#fffbf3; color:#985e16; border-color:#f3dfbc; }
.cover-sum.good { background:#f3faf6; color:#16835c; border-color:#d6e9df; }
.pill { display:inline-flex; white-space:nowrap; font-size:10px; padding:3px 8px; }
.period-toolbar { display:flex; align-items:center; justify-content:flex-end; gap:12px; }
.period-toolbar > span { display:flex; align-items:center; gap:8px; font-size:12px; }
.days select { font-size:12px; min-height:36px; border-radius:7px; }
.revenue-kpis { grid-template-columns:repeat(4,minmax(0,1fr)); }
.secondary-kpis { grid-template-columns:repeat(5,minmax(0,1fr)); gap:0; border-top:1px solid var(--vm-border); }
.secondary-kpis .kpi { border:0; border-right:1px solid var(--vm-border); border-radius:0; padding:20px; }
.secondary-kpis .kpi:last-child { border-right:0; }
.secondary-kpis .kpi strong { font-size:19px; }
.usage-chart { display:grid; gap:20px; padding:0 22px 26px; }
.chart-row { display:grid; grid-template-columns:120px minmax(0,1fr) 110px; align-items:center; gap:18px; font-size:12px; color:var(--vm-ink-soft); }
.chart-row strong { text-align:right; font-size:12px; color:var(--vm-ink); overflow-wrap:anywhere; }
.chart-tracks { display:flex; flex-direction:column; gap:4px; }
.chart-bar { height:7px; border-radius:0 3px 3px 0; }
.chart-bar.charged { background:#7269e8; }
.chart-bar.cost { background:#c5c0f9; }
.legend { display:flex; align-items:center; gap:7px; font-size:11px; white-space:nowrap; }
.legend i { width:7px; height:7px; background:#7269e8; border-radius:2px; }
.legend i:nth-of-type(2) { margin-left:7px; background:#c5c0f9; }
@media(min-width:1500px) { .ab { padding-top:40px; } }
@media(max-width:1200px) { .ab { padding:28px 24px 48px; } .usage-filters { grid-template-columns:repeat(3,minmax(0,1fr)); } .settings-section { grid-template-columns:220px minmax(0,1fr); } .kpi strong { font-size:22px; } .secondary-kpis { grid-template-columns:repeat(3,minmax(0,1fr)); } }
@media(max-width:700px) { .ab { padding:22px 16px 40px; gap:18px; } .ab-head { align-items:flex-start; } .page-icon { width:42px; height:42px; border-radius:11px; } .heading-main { gap:12px; } .ab-head h1 { font-size:23px; } .ab-head p { font-size:12px; } .eyebrow { font-size:10px; } .context-badge { display:none; } .billing-note { font-size:11px; align-items:flex-start; } .billing-note svg { margin-top:2px; } .tab { flex:none; padding:9px 12px; min-height:40px; font-size:12px; } .tabs { flex-wrap:nowrap; } .workspace-heading { align-items:flex-start; flex-wrap:wrap; } .workspace-heading h2 { font-size:18px; } .workspace-heading p { font-size:12px; } .kpis { gap:10px; } .kpi { padding:16px; gap:9px; } .kpi strong { font-size:20px; } .kpi span { font-size:11px; gap:6px; } .kpi small { font-size:10px; } .usage-kpis,.coverage-kpis { grid-template-columns:repeat(3,minmax(0,1fr)); } .kpi span svg { display:none; } .usage-filters { grid-template-columns:repeat(2,minmax(0,1fr)); padding:0 16px 16px; gap:14px; } .usage-filters>.field:first-child { grid-column:1/-1; } .advanced-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } .section-heading { padding:18px 16px; flex-wrap:wrap; } .card .section-heading h3 { font-size:13px; } .filters { max-width:100%; } .tbl { min-width:640px; } .tbl th { padding:12px 14px; } .tbl td { padding:14px; } .settings-section { grid-template-columns:1fr; } .settings-intro { border-right:0; border-bottom:1px solid var(--vm-border); padding:20px; } .section-icon { float:left; margin:0 12px 0 0; } .settings-fields { padding:20px; gap:18px; } .group-grid { grid-template-columns:1fr; } .group { padding:18px; } .save-bar { padding:16px; } .wallet-toolbar { padding:0 16px 18px; align-items:stretch; flex-direction:column; gap:10px; } .search { max-width:none; } .who { padding:20px; } .adjust-row { padding:0 16px 18px; } .adjust-row .field { flex:1 1 100%; } .cover-sum { margin:16px 16px 0; } .revenue-kpis { grid-template-columns:repeat(2,minmax(0,1fr)); } .secondary-kpis { grid-template-columns:repeat(2,minmax(0,1fr)); gap:0; } .secondary-kpis .kpi { border-bottom:1px solid var(--vm-border); } .chart-row { grid-template-columns:75px minmax(0,1fr) 85px; gap:10px; font-size:11px; } .chart-row strong { font-size:11px; } .usage-chart { padding:0 16px 22px; } .period-toolbar { justify-content:space-between; } }
@media(max-width:420px) { .usage-kpis,.coverage-kpis { grid-template-columns:1fr; } .usage-kpis .kpi,.coverage-kpis .kpi { display:grid; grid-template-columns:1fr 1fr; gap:5px 10px; } .usage-kpis .kpi strong,.coverage-kpis .kpi strong { grid-column:2; grid-row:1/3; align-self:center; text-align:right; font-size:21px; } .usage-kpis .kpi small,.coverage-kpis .kpi small { grid-column:1; } .settings-fields { grid-template-columns:1fr; } }
@media(max-width:700px) {
  .tabs { flex-wrap:wrap; overflow:visible; }
  .tab { flex:1 0 calc(33.333% - 5px); padding:9px 6px; font-size:11px; }
  .tab svg { display:none; }
}

</style>
