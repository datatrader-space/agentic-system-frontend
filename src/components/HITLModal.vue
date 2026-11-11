<template>
  <Teleport to="body" :disabled="inline">
    <Transition name="modal-fade">
      <div v-if="currentRequest" class="hitl-overlay" :class="{ 'hitl-overlay--compact': isDocked, 'hitl-overlay--inline': inline }" @click.self="handleOverlayClick">
        <div class="hitl-modal" :class="[`urgency-${currentRequest.urgency}`, `type-${currentRequest.interaction_type}`, { 'hitl-modal--compact': isDocked, 'hitl-modal--approval': isToolApproval }]">
          <!-- Header -->
          <div class="modal-header">
            <div class="header-left">
              <!-- A step to approve: a small shield, never an emoji. -->
              <svg v-if="isToolApproval" class="approval-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 5 6v5c0 4.4 3 8.3 7 9.5 4-1.2 7-5.1 7-9.5V6l-7-3Z"/><path d="m9 12 2 2 4-4"/></svg>
              <span v-else class="icon">{{ getIcon(currentRequest.interaction_type) }}</span>
              <div>
                <!-- A step to approve reads the same on every surface (owner, 2026-11-11: the card must be friendly
                     inside a chat): "Approve this step", not "Approval Required / Agent Request". -->
                <h3>{{ isToolApproval ? 'Approve this step' : getTitle(currentRequest.interaction_type) }}</h3>
                <span v-if="!inline && !isToolApproval" class="subtitle">Agent Request</span>
              </div>
            </div>
            <div class="header-right">
              <span v-if="inline || isToolApproval" class="urgency-badge studio-wait" data-test="hitl-waiting">Waiting for you</span>
              <span v-else class="urgency-badge" :class="`urgency-${currentRequest.urgency}`">
                {{ currentRequest.urgency }}
              </span>
              <button v-if="currentRequest.response_type === 'none' || currentRequest.interaction_type === 'credential_setup' || isExpired" @click="dismiss" class="close-btn" aria-label="Close">&times;</button>
            </div>
          </div>

          <!-- Body -->
          <div class="modal-body">
            <!-- The Studio card says why in a sentence ("it makes 1 image with ..."); the tool's own name is only the
                 fallback when there is no reason to show. -->
            <p v-if="!(inline && heldBecause)" class="summary">{{ approvalTitle }}</p>
            <!-- WHY IT IS ASKING, when that is more than "this call changes something": the agent's own
                 rule, or a browser signed in to an account. Without it a card for a harmless tool reads
                 as a fault (seen live 2026-10-09, conversation 2667: "Approve ECHO?" and nothing else). -->
            <p v-if="heldBecause" class="held-because" data-test="hitl-held-because">Asked because {{ heldBecause }}.</p>

            <!-- Tool-approval: show EXACTLY what will run before approving -->
            <div v-if="actionPreview" class="action-preview">
              <div class="action-preview__label">
                {{ currentRequest.payload?.tool_label || currentRequest.payload?.tool_name || 'Action' }}
                <span v-if="currentRequest.payload?.risk_summary" class="action-preview__risk">{{ currentRequest.payload.risk_summary }}</span>
              </div>
              <pre class="action-preview__cmd">{{ actionPreview }}</pre>
            </div>

            <!-- Payload Preview (collapsible) -->
            <details v-if="hasPayloadContent" class="payload-details">
              <summary>View raw details</summary>
              <pre class="payload-content">{{ JSON.stringify(currentRequest.payload, null, 2) }}</pre>
            </details>

            <!-- ── In-chat OAuth connect (CONNECT_SERVICE) ─────────────────────
                 The agent needs an account the user hasn't authorized. One click opens the provider's
                 consent screen; the backend's OAuth callback resolves this card and resumes the run, so
                 there is nothing to confirm here afterwards — the card closes itself. -->
            <div v-if="isOAuthConnect" class="response-section oauth-connect">
              <p v-if="currentRequest.payload?.reason" class="oauth-reason">
                {{ currentRequest.payload.reason }}
              </p>
              <a
                :href="safeHref(currentRequest.payload?.authorize_url)"
                target="_blank"
                rel="noopener noreferrer"
                class="btn btn-connect"
                @click="markConnectOpened"
              >
                <svg class="btn-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                {{ currentRequest.payload?.cta || 'Connect' }}
              </a>
              <p v-if="connectOpened" class="oauth-waiting">
                <span class="oauth-spinner" aria-hidden="true"></span>
                Waiting for you to finish authorizing… this closes on its own once you're connected.
              </p>
              <p v-else class="oauth-hint">
                Opens {{ currentRequest.payload?.provider || 'the provider' }} in a new tab. You'll never
                be asked for a password or API key here.
              </p>
              <button @click="respond(false)" class="btn btn-connect-cancel">
                Not now
              </button>
            </div>

            <!-- Binary Response (Approve/Reject) -->
            <div v-else-if="currentRequest.response_type === 'binary'" class="response-section">
              <div class="button-group">
                <button @click="respond(true)" class="btn btn-approve" data-test="hitl-approve">
                  <svg class="btn-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
                  Approve
                </button>
                <button @click="respond(false)" class="btn btn-reject" data-test="hitl-decline">Decline</button>
              </div>
              <!-- Redirect: run something different instead of the proposed call. One field the width of the card,
                   its Send inside it, so a narrow chat never cuts the field to a few letters. -->
              <div v-if="currentRequest.payload?.kind === 'tool_approval'" class="instruction-row">
                <input v-model="instruction" type="text" class="instruction-input"
                       aria-label="Tell the agent what to do instead"
                       placeholder="Or tell the agent what to do instead"
                       @keydown.enter="sendInstruction" />
                <button class="btn-instruct" :disabled="!instruction.trim()" @click="sendInstruction"
                        title="Send this to the agent instead of the step above" data-test="hitl-instead">
                  Send
                </button>
              </div>
              <!-- The rest, quietly: approve this tool for the session, or stop the agent's run altogether. -->
              <div v-if="currentRequest.payload?.session_approval || (isToolApproval && showStop)" class="approval-links">
                <button v-if="currentRequest.payload?.session_approval" @click="respondSession"
                        class="link-btn" data-test="hitl-allow-session"
                        title="Approve now and stop asking for this tool for the rest of this session">
                  Always allow this session
                </button>
                <button v-if="isToolApproval && showStop" @click="stopAgent" class="link-btn link-btn--stop"
                        title="Cancel this request and stop the agent">
                  Stop agent
                </button>
              </div>
            </div>

            <!-- Choice Response (Multiple Options) -->
            <div v-else-if="currentRequest.response_type === 'choice'" class="response-section">
              <!-- Optional guidance the user types BEFORE choosing an option (attached as feedback to
                   whichever option is clicked). Used by the repetition-guard "agent is stuck" pause. -->
              <div v-if="currentRequest.payload?.text_label" class="choice-guidance-row">
                <label class="choice-guidance-label">{{ currentRequest.payload.text_label }}</label>
                <textarea
                  v-model="feedback"
                  class="text-input choice-guidance-input"
                  rows="2"
                  placeholder="e.g. the nav list id is main-nav, not nav"
                ></textarea>
              </div>
              <div class="choice-options">
                <button
                  v-for="option in currentRequest.options"
                  :key="option.id"
                  :disabled="isExpired"
                  @click="respond(option.id)"
                  class="option-button"
                >
                  <span class="option-title">{{ option.title }}</span>
                  <span v-if="option.description" class="option-description">{{ option.description }}</span>
                  <span v-if="option.risk" class="risk-badge" :class="`risk-${option.risk}`">{{ option.risk }} risk</span>
                </button>
              </div>
              <!-- …or type your own answer (when the agent allows free text) -->
              <div v-if="currentRequest.payload?.allow_text" class="choice-text-row">
                <input
                  v-model="textResponse"
                  class="text-input"
                  placeholder="…or type your own answer"
                  :disabled="isExpired"
                  @keydown.enter="textResponse.trim() && respond(textResponse)"
                />
                <button class="btn btn-submit choice-text-send" :disabled="isExpired || !textResponse.trim()" @click="respond(textResponse)">Send</button>
              </div>
              <!-- A question whose time ran out cannot be answered: the request is closed on the server and
                   the run has moved on. Still offering its buttons is how an answer typed minutes later met
                   "Request already timeout" (conv 2118). Say it, and let the card be closed. -->
              <div v-if="isExpired" class="choice-expired" data-test="hitl-expired">
                <span>This question timed out — an answer can no longer reach the agent.</span>
                <button class="btn-link" @click="dismiss">Close</button>
              </div>
            </div>

            <!-- Text Response (Question/Input) -->
            <div v-else-if="currentRequest.response_type === 'text'" class="response-section">
              <textarea
                v-model="textResponse"
                placeholder="Type your answer here..."
                class="text-input"
                rows="4"
                @keydown.ctrl.enter="respond(textResponse)"
              ></textarea>
              <button @click="respond(textResponse)" class="btn btn-submit" :disabled="isExpired || !textResponse.trim()">
                Submit Answer
              </button>
            </div>

            <!-- Notification Only (No Response Needed) -->
            <div v-else-if="currentRequest.response_type === 'none'" class="response-section">
              <button @click="dismiss" class="btn btn-acknowledge">
                Acknowledge
              </button>
            </div>

            <!-- ── Credential Setup (per_item) ──────────────────────────────── -->
            <div v-else-if="currentRequest.interaction_type === 'credential_setup'" class="response-section cred-setup">
              <div
                v-for="svc in credServices"
                :key="svc.name"
                class="cred-row"
                :class="{
                  'cred-row--done': credState[svc.name] === 'connected',
                  'cred-row--skipped': credState[svc.name] === 'skipped',
                  'cred-row--already': svc.already_connected,
                  'cred-row--pending': credState[svc.name] === 'pending_confirm',
                }"
              >
                <div class="cred-row-left">
                  <span class="cred-icon">{{ svc.icon || '🔗' }}</span>
                  <div class="cred-info">
                    <span class="cred-name">{{ svc.name }}</span>
                    <span v-if="svc.already_connected" class="cred-status cred-status--ok">Already connected</span>
                    <span v-else-if="credState[svc.name] === 'connected'" class="cred-status cred-status--ok">✓ Connected</span>
                    <span v-else-if="credState[svc.name] === 'skipped'" class="cred-status cred-status--skip">Skipped</span>
                    <span v-else-if="credState[svc.name] === 'pending_confirm'" class="cred-status cred-status--pending">Did it work?</span>
                    <span v-else class="cred-reason">{{ svc.reason }}</span>
                  </div>
                </div>

                <!-- Already connected: Re-auth button only -->
                <div v-if="svc.already_connected" class="cred-row-actions">
                  <button
                    v-if="svc.auth_type === 'oauth2'"
                    @click="openOAuthPopup(svc)"
                    :disabled="connectingService === svc.name"
                    class="cred-btn cred-btn--reauth-small"
                    title="Re-authorize if this connection isn't working"
                  >{{ connectingService === svc.name ? 'Opening…' : 'Re-auth' }}</button>
                </div>

                <!-- Not-yet-connected: connect / api-key / skip actions -->
                <div v-else class="cred-row-actions">
                  <!-- OAuth -->
                  <template v-if="svc.auth_type === 'oauth2'">
                    <template v-if="credState[svc.name] === 'pending_confirm'">
                      <button @click="confirmConnected(svc.name)" class="cred-btn cred-btn--confirm">✓ I connected it</button>
                      <button @click="retryOAuth(svc)" class="cred-btn cred-btn--retry">↺ Retry</button>
                    </template>
                    <button
                      v-else-if="credState[svc.name] !== 'connected' && credState[svc.name] !== 'skipped'"
                      @click="openOAuthPopup(svc)"
                      :disabled="connectingService === svc.name"
                      class="cred-btn cred-btn--connect"
                      :class="{ 'cred-btn--reauth': svc.needs_reauth }"
                    >{{ connectingService === svc.name ? 'Opening…' : (svc.needs_reauth ? 'Re-authorize' : 'Connect') }}</button>
                    <button
                      v-else-if="credState[svc.name] === 'connected'"
                      @click="retryOAuth(svc)"
                      class="cred-btn cred-btn--retry-small"
                      title="Re-connect"
                    >↺</button>
                  </template><template v-else>
                    <!-- Existing creds: show as selectable rows, one per unique credential -->
                    <template v-if="svc.existing_creds_available && credState[svc.name] !== 'connected'">
                      <div class="cred-picker">
                        <button
                          v-for="cred in svc.existing_cred_labels"
                          :key="cred.name"
                          class="cred-picker-row"
                          @click="useExistingCred(svc.name, cred.name)"
                        >
                          <span class="picker-cred-name">{{ cred.name }}</span>
                          <span v-if="cred.is_default" class="picker-badge picker-badge--default">★ Default</span>
                          <span v-if="cred.agents?.length" class="picker-badge picker-badge--agent">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>
                            {{ cred.agents.join(', ') }}
                          </span>
                        </button>
                      </div>
                    </template>

                    <template v-if="credState[svc.name] !== 'connected' && credState[svc.name] !== 'skipped'">
                      <button
                        @click="toggleInstructions(svc.name)"
                        class="cred-btn cred-btn--instructions"
                      >{{ expandedInstructions === svc.name ? 'Hide' : 'Instructions' }}</button>
                    </template>
                    <button
                      v-if="expandedInstructions === svc.name && credState[svc.name] !== 'connected'"
                      @click="markDone(svc.name)"
                      class="cred-btn cred-btn--done"
                    >Done</button>
                  </template>

                  <!-- Skip × -->
                  <button
                    v-if="credState[svc.name] !== 'connected' && credState[svc.name] !== 'skipped'"
                    @click="skipService(svc.name)"
                    class="cred-btn-skip"
                    title="Skip this service"
                  >×</button>
                </div>
              </div>

              <!-- Expandable API key instructions -->
              <div v-if="expandedInstructions" class="instructions-box">
                <pre>{{ getInstructions(expandedInstructions) }}</pre>
                <div class="instructions-footer">
                  💡 To add credentials directly: go to <strong>Settings → Agents → [this agent] → Credentials</strong> and add the API key there, then come back and click <em>Done</em>.
                </div>
              </div>

              <!-- Scope gap notice -->
              <div v-if="scopeGapService" class="scope-gap-notice">
                <strong>Missing scopes:</strong> {{ scopeGapService.scope_gap?.join(', ') }}
              </div>

              <!-- Done button -->
              <button
                @click="submitCredSetup"
                :disabled="!allServicesResolved"
                class="btn btn-submit cred-done-btn"
              >
                Done — resume agent
              </button>
            </div>

            <!-- Optional Feedback (not shown for credential_setup or compact-ask cards) -->
            <div v-if="currentRequest.response_type !== 'none' && currentRequest.interaction_type !== 'credential_setup' && !isDocked" class="feedback-section">
              <label for="feedback">Optional Comment:</label>
              <textarea
                id="feedback"
                v-model="feedback"
                placeholder="Add any additional context or reasoning..."
                class="feedback-input"
                rows="2"
              ></textarea>
            </div>
          </div>

          <!-- Footer -->
          <div class="modal-footer">
            <div class="footer-left">
              <span v-if="currentRequest.timeout_at && inline" class="timeout-indicator" :class="{'timeout-warning': isNearTimeout}" data-test="hitl-time-left">
                {{ isExpired ? 'This request has expired' : `Answer within ${timeRemaining}` }}
              </span>
              <span v-else-if="currentRequest.timeout_at" class="timeout-indicator" :class="{'timeout-warning': isNearTimeout}">
                ⏱ {{ timeRemaining }}
              </span>
              <span v-if="pendingRequests.length > 1" class="queue-indicator">
                {{ pendingRequests.length }} pending requests
              </span>
            </div>
            <div class="footer-right">
              <button v-if="currentRequest.response_type !== 'none' && pendingRequests.length > 1" @click="skip" class="btn-link">
                Skip to next ({{ pendingRequests.length - 1 }} more)
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { isSafeUrl as _isSafeUrl } from '@/utils/safeMarkdown'
import { useOAuthPopup } from '@/composables/useOAuthPopup'
import { notify } from '@/composables/useNotify'
// Server and agent data can carry a `javascript:` URL; only http(s), mailto, tel and relative links are
// followed (security audit, frontend finding A12).
const safeHref = (u) => (_isSafeUrl(u) ? u : undefined)

const props = defineProps({
  // Studio result feeds host the same approval card in place; all decisions stay in this component.
  inline: { type: Boolean, default: false },
  requests: {
    type: Array,
    default: () => []
  },
  // Show the "Stop agent" control on tool-approval cards. Only enabled on surfaces that actually
  // handle @stop (main chat, emulator) so it's never a dead button.
  showStop: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['respond', 'dismiss', 'skip', 'stop']);

// State
const textResponse = ref('');
const feedback = ref('');
const instruction = ref('');
const currentTime = ref(Date.now());

// Current request (first in queue)
const currentRequest = computed(() => props.requests[0] || null);
const pendingRequests = computed(() => props.requests);

// Compact "ask the user" style card (Claude/ChatGPT AskUserQuestion): short question + option
// buttons + optional free text. No payload dump, no separate comment box.
const isCompactAsk = computed(() =>
  ['choice', 'question', 'clarification'].includes(currentRequest.value?.interaction_type)
);

// A tool-approval card ("Approve SSH_EXEC?") — the command is shown in the action preview.
const isToolApproval = computed(() => currentRequest.value?.payload?.kind === 'tool_approval');

// An in-chat OAuth connect card (CONNECT_SERVICE): one link out to the provider's consent screen.
// Unlike every other card this one is usually resolved by the BACKEND (the OAuth callback completes
// the request and pushes hitl_resolved), not by a button here — "Not now" is the only local answer.
const isOAuthConnect = computed(() => currentRequest.value?.payload?.kind === 'oauth_connect');

// Set once the user opens the authorize link, so the card can switch to a "waiting" state instead of
// looking like it did nothing. Reset whenever the shown request changes.
const connectOpened = ref(false);
const markConnectOpened = () => { connectOpened.value = true; };

// Docked = a small card that sits just above the chat composer (Claude-style) instead of a
// full-screen blocking modal. Used for quick decisions: clarifications, tool approvals, and connects.
const isDocked = computed(() => isCompactAsk.value || isToolApproval.value || isOAuthConnect.value);

// Control-only payload keys that should NOT surface a "View Details" dump to the user.
const CONTROL_PAYLOAD_KEYS = ['allow_text', 'text_label', 'interpretation', 'confidence',
  'original_interpretation', 'ambiguities', 'suggested_plan'];

// Payload has meaningful (user-facing) content worth a "View Details" expander. We DON'T show raw
// JSON for compact asks or tool approvals — a tool approval already shows the exact command in the
// action preview, so the raw payload dump is just noise.
const hasPayloadContent = computed(() => {
  const p = currentRequest.value?.payload;
  if (!p) return false;
  // Never dump the connect payload: it carries the authorize URL (a single-use, state-bearing link).
  if (isCompactAsk.value || isToolApproval.value || isOAuthConnect.value) return false;
  return Object.keys(p).some(k => !CONTROL_PAYLOAD_KEYS.includes(k));
});

// For a tool-approval card: the EXACT command(s)/action that will run if approved. Prefer the
// backend-built `preview`; fall back to the raw commands/args so the user always sees what runs.
const actionPreview = computed(() => {
  const p = currentRequest.value?.payload;
  if (!p || p.kind !== 'tool_approval') return '';
  if (p.preview) return p.preview;
  const a = p.parameters || p.tool_args || {};
  if (Array.isArray(a.commands)) return a.commands.map(c => `$ ${c}`).join('\n');
  for (const k of ['command', 'query', 'sql', 'script', 'code', 'url', 'path']) {
    if (a[k]) return String(a[k]);
  }
  return '';
});

// The reason the platform gave for holding this call (`held_because` on a tool approval), as one clause.
const heldBecause = computed(() => {
  const p = currentRequest.value?.payload;
  if (!p || p.kind !== 'tool_approval') return '';
  return String(p.held_because || '').trim().replace(/\.+$/, '');
});

// Title line — for tool approvals, short, in words: "Approve this step: Running a command", never the tool's name
// ("Approve CODE_RUN_COMMAND?", owner 2026-11-06). The name is only the fallback for a card from an older server.
const approvalTitle = computed(() => {
  const p = currentRequest.value?.payload;
  if (p?.kind === 'tool_approval' && p.tool_label) return `Approve this step: ${p.tool_label}`;
  if (p?.kind === 'tool_approval' && p.tool_name) return `Approve ${p.tool_name}?`;
  if (p?.kind === 'oauth_connect') return `${p.provider || 'This service'} needs your authorization`;
  return currentRequest.value?.summary || '';
});

// Time remaining calculation
const timeRemaining = computed(() => {
  if (!currentRequest.value?.timeout_at) return 'No timeout';
  
  const timeout = new Date(currentRequest.value.timeout_at).getTime();
  const remaining = timeout - currentTime.value;
  
  if (remaining <= 0) return 'Expired';
  
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
});

// Past its deadline: the server has closed the request, so nothing typed here can be delivered.
const isExpired = computed(() => {
  if (!currentRequest.value?.timeout_at) return false;
  return new Date(currentRequest.value.timeout_at).getTime() <= currentTime.value;
});

const isNearTimeout = computed(() => {
  if (!currentRequest.value?.timeout_at) return false;
  const timeout = new Date(currentRequest.value.timeout_at).getTime();
  const remaining = timeout - currentTime.value;
  return remaining < 30000; // Less than 30 seconds
});

// Icon mapping
const getIcon = (type) => {
  if (isOAuthConnect.value) return '🔗';
  const icons = {
    'approval': '✓',
    'choice': '☰',
    'question': '?',
    'clarification': '💬',
    'validation': '✓',
    'review': '👁',
    'escalation': '⚠',
    'alert': 'ℹ',
    'progress': '⏳',
    'collaboration': '👥',
    'confirmation': '✓',
    'preference': '⚙',
    'credential_setup': '🔑',
  };
  return icons[type] || '•';
};

// Title mapping
const getTitle = (type) => {
  if (isOAuthConnect.value) return 'Authorization Required';
  const titles = {
    'approval': 'Approval Required',
    'choice': 'Choose an Option',
    'question': 'Question',
    'clarification': 'Clarification Needed',
    'validation': 'Validation Request',
    'review': '👁',
    'escalation': 'Issue Escalation',
    'alert': 'Notification',
    'progress': 'Progress Update',
    'collaboration': 'Collaboration Request',
    'confirmation': 'Confirmation',
    'preference': 'Preference',
    'credential_setup': 'Connect Services',
  };
  return titles[type] || 'Agent Request';
};

// Actions
const respond = (value, feedbackOverride = null) => {
  if (!currentRequest.value || isExpired.value) return;

  emit('respond', {
    request_id: currentRequest.value.request_id,
    response_value: value,
    feedback: feedbackOverride != null ? feedbackOverride : feedback.value
  });

  // Reset form
  textResponse.value = '';
  feedback.value = '';
  instruction.value = '';
};

// "Run this instead": reject the proposed call but hand the agent a corrected instruction
// (e.g. "only run docker ps"). The agent re-issues the fixed command — which is gated again.
const sendInstruction = () => {
  const t = instruction.value.trim();
  if (t) respond(false, `Do not run that as-is. Instead: ${t}`);
};

// "Approve & don't ask again this session": approve NOW and tell the backend to whitelist this tool
// for the rest of the session (session_approvals) so the same tool won't prompt again this run.
const respondSession = () => respond({ approved: true, scope: 'session' });

// "Stop agent": cancel this request and abort the whole run. The parent handles the actual stop
// (sends stop_execution, which also cancels the server-side approval wait).
const stopAgent = () => {
  emit('stop', currentRequest.value?.request_id);
};

const dismiss = () => {
  if (!currentRequest.value) return;
  emit('dismiss', currentRequest.value.request_id);
};

const skip = () => {
  if (pendingRequests.value.length <= 1) return;
  emit('skip', currentRequest.value.request_id);
};

const handleOverlayClick = () => {
  // Don't close on overlay click for important requests
  if (currentRequest.value?.urgency === 'critical') return;
  if (currentRequest.value?.response_type === 'none' || currentRequest.value?.interaction_type === 'credential_setup') { dismiss(); }
};

// Timer for countdown
let intervalId = null;
onMounted(() => {
  intervalId = setInterval(() => {
    currentTime.value = Date.now();
  }, 1000);
});

onUnmounted(() => {
  if (intervalId) clearInterval(intervalId);
});

// ── Credential Setup State ───────────────────────────────────────────────────

// All services from payload — include both needs-setup and already-connected
const credServices = computed(() => {
  return currentRequest.value?.services ||
    currentRequest.value?.payload?.services || [];
});

const credState = ref({}); // { serviceName: 'connected' | 'skipped' | 'pending_confirm' }
const credKeys = ref({});  // { serviceName: 'raw API key value' } for manual entry
const selectedCreds = ref({}); // { serviceName: 'credentialName' } from Use Existing picker
const manualInputService = ref(null); // name of service with open manual input
const connectingService = ref(null);
const expandedInstructions = ref(null);

const scopeGapService = computed(() =>
  credServices.value.find(s => s.scope_gap?.length && credState.value[s.name] == null)
);

const allServicesResolved = computed(() =>
  credServices.value.every(s => {
    // already_connected services are auto-resolved
    if (s.already_connected) return true;
    const state = credState.value[s.name];
    return state === 'connected' || state === 'skipped';
  })
);

const getInstructions = (serviceName) => {
  const svc = credServices.value.find(s => s.name === serviceName);
  return svc?.setup_instructions || 'Check service documentation for API key setup.';
};

// Shared popup flow (useOAuthPopup): the window opens inside the click (as about:blank, then sent to the
// provider), the start-URL request has a timeout, and the closed-popup watch is removed when this modal
// unmounts. It used to fetch first and open after, which popup blockers treat as unsolicited, and its
// 800 ms poll kept running after the modal was gone.
const OAUTH_START_TIMEOUT_MS = 15000;
const oauthPopup = useOAuthPopup();
const resolveOAuthStartUrl = async (startUrl) => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), OAUTH_START_TIMEOUT_MS);
  try {
    const res = await fetch(startUrl, { credentials: 'include', signal: ctrl.signal });
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data?.redirect_url) return data.redirect_url;
    }
  } catch (e) {
    console.warn('[HITLModal] Could not fetch OAuth start URL, opening directly:', e);
  } finally {
    clearTimeout(timer);
  }
  return startUrl;
};
const openOAuthPopup = async (svc) => {
  const startUrl = svc.auth_url;
  if (!startUrl || connectingService.value) return;
  connectingService.value = svc.name;
  try {
    const result = await oauthPopup.run(() => resolveOAuthStartUrl(startUrl), {
      messageTypes: ['oauth-connection-result', 'oauth_result'],
    });
    if (result.status === 'cancelled') return;
    if (result.status === 'blocked') {
      notify.error('Popup blocked — please allow popups for this site, then try Connect again.');
      return;
    }
    // Don't auto-mark connected — wait for explicit confirmation
    if (credState.value[svc.name] !== 'connected') {
      credState.value = { ...credState.value, [svc.name]: 'pending_confirm' };
    }
  } finally {
    connectingService.value = null;
  }
};

const useExistingCred = (serviceName, credName) => {
  credState.value = { ...credState.value, [serviceName]: 'connected' };
  if (credName) selectedCreds.value[serviceName] = credName; // separate from raw keys
  console.log('[useExistingCred]', serviceName, credName);
};

const saveManualKey = (name) => {
  const val = (credKeys.value[name] || '').trim();
  if (!val) return;
  credState.value = { ...credState.value, [name]: 'connected' };
  manualInputService.value = null;
};

const confirmConnected = (name) => {
  credState.value = { ...credState.value, [name]: 'connected' };
};

const retryOAuth = (svc) => {
  // Reset to undefined so Connect button shows again
  const next = { ...credState.value };
  delete next[svc.name];
  credState.value = next;
  openOAuthPopup(svc);
};


const toggleInstructions = (name) => {
  expandedInstructions.value = expandedInstructions.value === name ? null : name;
};

const markDone = (name) => {
  credState.value = { ...credState.value, [name]: 'connected' };
  expandedInstructions.value = null;
};

const skipService = (name) => {
  credState.value = { ...credState.value, [name]: 'skipped' };
};

const submitCredSetup = () => {
  if (!currentRequest.value) return;
  emit('respond', {
    request_id: currentRequest.value.request_id,
    response_value: {
      per_item_responses: { ...credState.value },
      credentials: { ...credKeys.value },           // raw API keys (manual entry)
      selected_credentials: { ...selectedCreds.value }, // Use Existing picks (cred names)
    },
    feedback: ''
  });
  credState.value = {};
  credKeys.value = {};
  selectedCreds.value = {};
  manualInputService.value = null;
  expandedInstructions.value = null;
};

// Reset credential state when request changes
watch(currentRequest, () => {
  textResponse.value = '';
  feedback.value = '';
  connectOpened.value = false;
  credState.value = {};
  credKeys.value = {};
  selectedCreds.value = {};
  manualInputService.value = null;
  expandedInstructions.value = null;
});
</script>

<style scoped>
.hitl-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 20px;
}

.hitl-modal {
  /* The theme's own surface and text (light and dark): a hard-coded white card under the dark theme's light text
     tokens was unreadable in the Studio (ADM-1170). */
  background: var(--vm-surface);
  color: var(--vm-ink);
  border-radius: 12px;
  box-shadow: var(--vm-shadow-l, 0 20px 60px rgba(0, 0, 0, 0.3));
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  animation: modalSlideIn 0.3s ease-out;
}

/* Every field in the card is drawn on the card's own surface, never a page's global input colours. */
.hitl-modal :is(input, textarea, select) {
  background: var(--vm-surface);
  color: var(--vm-ink);
}
.hitl-modal :is(input, textarea)::placeholder { color: var(--vm-ink-faint); opacity: 1; }

@keyframes modalSlideIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* Compact "ask the user" card — small, focused: short question + option buttons + optional text */
.hitl-modal--compact { max-width: 440px; }
.hitl-modal--compact .modal-header { padding: 13px 18px 6px; border-bottom: none; }
.hitl-modal--compact .icon { display: none; }          /* slim Claude-style header */
.hitl-modal--compact .subtitle { display: none; }
.hitl-modal--compact .modal-header h3 { font-size: 15px; }
.hitl-modal--compact .modal-body { padding: 16px 18px; }
.hitl-modal--compact .summary { font-size: 15px; font-weight: 600; line-height: 1.45; margin-bottom: 14px; color: var(--vm-ink); }
.hitl-modal--compact .response-section { margin-bottom: 0; }
.hitl-modal--compact .choice-options { gap: 8px; }
.hitl-modal--compact .option-button { padding: 11px 14px; }
.hitl-modal--compact .choice-text-row { margin-top: 10px; }
.hitl-modal--compact .modal-footer { padding: 8px 18px; background: transparent; border-top: none; }

/* A step to approve, in a chat (owner, 2026-11-11: "user friendly inside chat"): a card that reads as part of the
   conversation. The theme's surface, a thin amber bar while it waits, one sentence of what happens, Approve as
   the only filled button, Decline quiet beside it, the rest as small links. Same on every surface. */
.hitl-modal--approval {
  max-width: 520px;
  border: 1px solid var(--vm-line-2);
  border-left: 3px solid var(--vm-amber);
  border-radius: 12px;
}
.hitl-modal--approval.urgency-critical,
.hitl-modal--approval.urgency-high { border-left-color: var(--vm-danger); }
.hitl-overlay--compact .hitl-modal.hitl-modal--approval { border-top: 1px solid var(--vm-line-2); }
.hitl-modal--approval .modal-header { padding: 12px 16px 4px; border-bottom: none; background: transparent; }
.hitl-modal--approval .modal-header h3 { font-size: 14px; font-weight: 650; color: var(--vm-ink); }
.hitl-modal--approval .approval-icon { flex: 0 0 auto; color: var(--vm-amber-ink); }
.hitl-modal--approval .modal-body { padding: 4px 16px 12px; }
.hitl-modal--approval .summary { font-size: 14px; font-weight: 500; color: var(--vm-ink); margin-bottom: 8px; }
.held-because { margin: 0 0 12px; font-size: 14px; line-height: 1.55; color: var(--vm-ink); overflow-wrap: anywhere; }
.hitl-modal--approval .action-preview { margin-bottom: 12px; }
.hitl-modal--approval .action-preview__cmd { max-height: 160px; font-size: 12px; }
.hitl-modal--approval .button-group { gap: 8px; }
.hitl-modal--approval .btn { padding: 9px 16px; min-height: 40px; font-size: 14px; }
.hitl-modal--approval .modal-footer { padding: 0 16px 12px; background: transparent; border-top: none; }

/* Approve this tool for the session / stop the agent: quiet links on one row, wrapping when narrow. */
.approval-links { display: flex; flex-wrap: wrap; gap: 4px 16px; margin-top: 10px; }
.link-btn {
  background: none; border: none; padding: 6px 0; min-height: 32px;
  font-size: 13px; font-weight: 600; color: var(--vm-link); cursor: pointer;
}
.link-btn:hover { text-decoration: underline; }
.link-btn:focus-visible { outline: 2px solid var(--vm-primary); outline-offset: 2px; border-radius: 4px; }
.link-btn--stop { color: var(--vm-red-ink); }

/* Compact ask = small card DOCKED at the bottom of the chat (Claude AskUserQuestion style) — NOT a
   full-screen dark overlay. No backdrop, so the conversation stays visible AND interactive behind it. */
.hitl-overlay--compact {
  background: transparent;
  backdrop-filter: none;
  align-items: flex-end;            /* dock to bottom… */
  justify-content: center;          /* …centered over the chat column */
  /* sit just above the message composer — its real height, published by ChatWorkspace; 104px elsewhere */
  padding: 0 16px calc(var(--chat-composer-h, 92px) + 12px);
  pointer-events: none;            /* clicks pass through to the chat */
}
.hitl-overlay--compact .hitl-modal {
  pointer-events: auto;            /* but the card itself is interactive */
  width: auto;
  max-height: 70vh;
  box-shadow: var(--vm-shadow-m, 0 10px 34px rgba(15, 23, 42, 0.18));
  border: 1px solid var(--vm-line-2);
  animation: hitlDockUp 0.22s ease-out;
}
/* Keep the urgency accent visible on the docked card (the 1px border above would hide it). */
.hitl-overlay--compact .hitl-modal.urgency-critical { border-top: 3px solid #dc2626; }
.hitl-overlay--compact .hitl-modal.urgency-high { border-top: 3px solid #ef4444; }
.hitl-overlay--compact .hitl-modal.urgency-medium { border-top: 3px solid #f59e0b; }
@keyframes hitlDockUp {
  from { opacity: 0; }
  to   { opacity: 1; }
}

/* Urgency-based border colors */
.urgency-low { border-top: 4px solid #10b981; }
.urgency-medium { border-top: 4px solid #f59e0b; }
.urgency-high { border-top: 4px solid #ef4444; }
.urgency-critical { 
  border-top: 4px solid #dc2626;
  animation: criticalPulse 2s ease-in-out infinite;
}

@keyframes criticalPulse {
  0%, 100% { box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3); }
  50% { box-shadow: 0 20px 60px rgba(220, 38, 38, 0.5); }
}

/* Header */
.modal-header {
  padding: 20px 24px;
  border-bottom: 1px solid var(--vm-line-2);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--vm-surface-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--vm-ink);
}

.subtitle {
  font-size: 12px;
  color: var(--vm-ink-faint);
}

.urgency-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* "Waiting for you" on a step to approve: the amber of the card's bar. */
.urgency-badge.studio-wait { background: var(--vm-amber-soft); color: var(--vm-amber-ink); text-transform: none; letter-spacing: 0; }
.urgency-badge.urgency-low { background: var(--vm-green-soft); color: var(--vm-green-ink); }
.urgency-badge.urgency-medium { background: var(--vm-amber-soft); color: var(--vm-amber-ink); }
.urgency-badge.urgency-high { background: var(--vm-red-soft); color: var(--vm-red-ink); }
.urgency-badge.urgency-critical { background: #dc2626; color: white; }

.close-btn {
  background: none;
  border: none;
  font-size: 28px;
  color: var(--vm-ink-faint);
  cursor: pointer;
  line-height: 1;
  padding: 0;
  margin-left: 12px;
}

.close-btn:hover {
  color: var(--vm-ink-soft);
}

/* Body */
.modal-body {
  padding: 24px;
  overflow-y: auto;
  flex: 1;
}

.action-preview {
  margin: 0 0 18px 0;
  border: 1px solid var(--vm-line-2);
  background: var(--vm-amber-soft);
  border-radius: 10px;
  overflow: hidden;
}
.action-preview__label {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 700;
  color: var(--vm-amber-ink);
  background: var(--vm-amber-soft);
  border-bottom: 1px solid var(--vm-line-2);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.action-preview__risk {
  margin-left: auto;
  font-weight: 600;
  text-transform: none;
  letter-spacing: 0;
  color: var(--vm-amber-ink);
}
.action-preview__cmd {
  margin: 0;
  padding: 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12.5px;
  line-height: 1.55;
  color: var(--vm-ink);
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 260px;
  overflow-y: auto;
}

.instruction-row {
  position: relative;              /* Send sits inside the field, so the field is always the card's width */
  margin-top: 10px;
}
.instruction-input {
  display: block;
  width: 100%;
  min-width: 0;
  padding: 9px 74px 9px 12px;      /* room for Send */
  min-height: 40px;
  border: 1px solid var(--vm-line-2);
  border-radius: 8px;
  font-size: 13px;
  color: var(--vm-ink);
}
.instruction-input:focus {
  outline: none;
  border-color: var(--vm-primary);
  box-shadow: 0 0 0 3px var(--vm-primary-soft);
}
.btn-instruct {
  position: absolute;
  top: 4px;
  right: 4px;
  bottom: 4px;
  white-space: nowrap;
  background: var(--vm-surface-soft);
  color: var(--vm-link);
  border: 1px solid var(--vm-primary-line);
  padding: 0 12px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.btn-instruct:hover:not(:disabled) { background: var(--vm-blue-soft); }
/* Not ready (nothing typed yet): quiet but readable, never pale text on a pale fill. */
.btn-instruct:disabled { color: var(--vm-ink-faint); border-color: var(--vm-line-2); cursor: not-allowed; }

.summary {
  font-size: 15px;
  color: var(--vm-ink-soft);
  line-height: 1.6;
  margin: 0 0 20px 0;
}

.payload-details {
  margin-bottom: 20px;
  background: var(--vm-surface-soft);
  border: 1px solid var(--vm-line-2);
  border-radius: 6px;
  padding: 12px;
}

.payload-details summary {
  cursor: pointer;
  font-size: 13px;
  color: var(--vm-ink-faint);
  font-weight: 500;
  user-select: none;
}

.payload-content {
  margin-top: 12px;
  font-size: 12px;
  color: var(--vm-ink);
  background: var(--vm-surface);
  padding: 12px;
  border-radius: 4px;
  overflow-x: auto;
}

.response-section {
  margin-bottom: 16px;
}

/* Button Group (Binary) */
.button-group {
  display: flex;
  gap: 12px;
}

.btn {
  flex: 1;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: background-color 0.2s, border-color 0.2s, color 0.2s, opacity 0.2s, box-shadow 0.2s, transform 0.2s;
}

.btn-icon {
  font-size: 16px;
}

.btn-approve {
  background: var(--vm-primary);  /* the brand blue; white text 5.2:1 */
  color: white;
}

.btn-approve:hover { background: var(--vm-primary-d); }

.btn-reject {
  background: transparent;
  color: var(--vm-ink);
  border: 1px solid var(--vm-line-2);
}

.btn-reject:hover { background: var(--vm-surface-soft); border-color: var(--vm-ink-faint); }
.btn-approve:focus-visible, .btn-reject:focus-visible { outline: 2px solid var(--vm-primary); outline-offset: 2px; }


/* ── In-chat OAuth connect card (CONNECT_SERVICE) ─────────────────────────────
   One prominent link out to the provider, then a waiting state. Deliberately NOT green/red like an
   approve/reject pair — this isn't a decision about a risky action, it's a hand-off to the provider. */
.oauth-connect {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.oauth-reason {
  margin: 0;
  font-size: 13px;
  color: var(--vm-ink-soft);
  line-height: 1.5;
}
.btn-connect {
  background: #4f46e5;
  color: #fff;
  text-decoration: none;
  width: 100%;
}
.btn-connect:hover {
  background: #4338ca;
  box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
}
.oauth-hint {
  margin: 0;
  font-size: 12px;
  color: var(--vm-ink-faint);
  line-height: 1.5;
}
.oauth-waiting {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 12.5px;
  font-weight: 500;
  color: var(--vm-link);
  line-height: 1.5;
}
.oauth-spinner {
  width: 13px;
  height: 13px;
  flex-shrink: 0;
  border: 2px solid rgba(79, 70, 229, 0.25);
  border-top-color: #4f46e5;
  border-radius: 50%;
  animation: oauthSpin 0.7s linear infinite;
}
@keyframes oauthSpin { to { transform: rotate(360deg); } }
.btn-connect-cancel {
  width: 100%;
  background: transparent;
  color: var(--vm-ink-faint);
  border: 1px solid var(--vm-line-2);
  font-size: 0.82rem;
}
.btn-connect-cancel:hover {
  background: var(--vm-surface-soft);
  color: var(--vm-ink-soft);
  border-color: var(--vm-ink-faint);
}


.btn-submit {
  background: #3b82f6;
  color: white;
  width: 100%;
  margin-top: 12px;
}

.btn-submit:hover:not(:disabled) {
  background: #2563eb;
}

.btn-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-acknowledge {
  background: #6b7280;
  color: white;
  width: 100%;
}

.btn-acknowledge:hover {
  background: #4b5563;
}

/* Choice Options */
.choice-options {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.option-button {
  background: var(--vm-surface-soft);
  border: 2px solid var(--vm-line-2);
  border-radius: 8px;
  padding: 16px;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.2s, border-color 0.2s, color 0.2s, opacity 0.2s, box-shadow 0.2s, transform 0.2s;
}

.option-button:hover {
  border-color: #3b82f6;
  background: var(--vm-surface-soft);
}

.option-title {
  display: block;
  font-weight: 600;
  color: var(--vm-ink);
  margin-bottom: 4px;
}

.option-description {
  display: block;
  font-size: 13px;
  color: var(--vm-ink-faint);
  margin-bottom: 8px;
}

.risk-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}

.risk-badge.risk-low { background: var(--vm-green-soft); color: var(--vm-green-ink); }
.risk-badge.risk-medium { background: var(--vm-amber-soft); color: var(--vm-amber-ink); }
.risk-badge.risk-high { background: var(--vm-red-soft); color: var(--vm-red-ink); }

/* Optional guidance box shown ABOVE the option buttons (repetition-guard "agent is stuck" pause) */
.choice-guidance-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
}
.choice-guidance-label {
  font-size: 0.85em;
  opacity: 0.8;
}
.choice-guidance-input {
  resize: vertical;
  width: 100%;
}

.choice-expired {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--vm-red-soft);
  color: var(--vm-red-ink);
  font-size: 13px;
}
.option-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* "…or type your own answer" row under the option buttons */
.choice-text-row {
  display: flex;
  gap: 8px;
  align-items: stretch;
  margin-top: 12px;
}
.choice-text-row .text-input {
  flex: 1;
  resize: none;
}
.choice-text-send {
  width: auto;
  margin-top: 0;
  flex-shrink: 0;
  padding: 0 18px;
}

/* Text Input */
.text-input {
  width: 100%;
  padding: 12px;
  border: 2px solid var(--vm-line-2);
  border-radius: 8px;
  font-size: 14px;
  font-family: inherit;
  resize: vertical;
  transition: border-color 0.2s;
}

.text-input:focus {
  outline: none;
  border-color: #3b82f6;
}

/* Feedback Section */
.feedback-section {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid var(--vm-line-2);
}

.feedback-section label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--vm-ink-faint);
  margin-bottom: 8px;
}

.feedback-input {
  width: 100%;
  padding: 10px;
  border: 1px solid var(--vm-line-2);
  border-radius: 6px;
  font-size: 13px;
  font-family: inherit;
  resize: vertical;
}

.feedback-input:focus {
  outline: none;
  border-color: var(--vm-primary);
}

/* Footer */
.modal-footer {
  padding: 16px 24px;
  border-top: 1px solid var(--vm-line-2);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--vm-surface-soft);
}

.footer-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.timeout-indicator {
  font-size: 13px;
  color: var(--vm-ink-faint);
  font-weight: 500;
}

.timeout-warning {
  color: var(--vm-red-ink);
  font-weight: 600;
}

.queue-indicator {
  font-size: 12px;
  color: var(--vm-ink-faint);
}

.btn-link {
  background: none;
  border: none;
  color: var(--vm-link);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  padding: 4px 8px;
}

.btn-link:hover {
  text-decoration: underline;
}

/* Transitions */
.modal-fade-enter-active, .modal-fade-leave-active {
  transition: opacity 0.3s;
}

.modal-fade-enter-from, .modal-fade-leave-to {
  opacity: 0;
}

/* ── Credential Setup ─── */
.hitl-modal.type-credential_setup {
  max-width: 680px;
}

.cred-setup {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cred-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border: 1px solid var(--vm-line-2);
  border-radius: 10px;
  background: var(--vm-surface);
  gap: 12px;
  transition: background 0.2s, border-color 0.2s;
}

.cred-row--done {
  border-color: #6ee7b7;
  background: var(--vm-green-soft);
}

.cred-row--skipped {
  border-color: var(--vm-line-2);
  background: var(--vm-surface-soft);
  opacity: 0.6;
}

.cred-row--already {
  background: var(--vm-green-soft);
  border-color: #6ee7b7;
  opacity: 0.8;
}

.cred-row-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.cred-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.cred-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.cred-name {
  font-weight: 600;
  font-size: 14px;
  color: var(--vm-ink);
}

.cred-reason {
  font-size: 12px;
  color: var(--vm-ink-faint);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cred-status {
  font-size: 12px;
  font-weight: 500;
}

.cred-status--ok {
  color: var(--vm-green-ink);
}

.cred-status--skip {
  color: var(--vm-ink-faint);
}

.cred-row-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.cred-btn {
  padding: 5px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: background-color 0.15s, border-color 0.15s, color 0.15s, opacity 0.15s, box-shadow 0.15s, transform 0.15s;
}

.cred-btn--connect {
  background: var(--vm-surface-soft);
  color: var(--vm-link);
}

.cred-btn--connect:hover:not(:disabled) {
  background: var(--vm-blue-soft);
}

.cred-btn--connect:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.cred-btn--reauth {
  background: var(--vm-amber-soft);
  color: var(--vm-amber-ink);
}

.cred-btn--reauth:hover {
  background: var(--vm-amber-soft);
}

.cred-btn--instructions {
  background: var(--vm-surface-soft);
  color: var(--vm-ink-soft);
}

.cred-btn--instructions:hover {
  background: #e5e7eb;
}

.cred-btn--done {
  background: var(--vm-green-soft);
  color: var(--vm-green-ink);
}

.cred-btn--done:hover {
  background: var(--vm-green-soft);
}

.cred-btn-skip {
  background: none;
  border: none;
  color: var(--vm-ink-faint);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
  transition: color 0.15s;
}

.cred-btn-skip:hover {
  color: var(--vm-ink-faint);
}

.instructions-box {
  background: var(--vm-surface-soft);
  border: 1px solid var(--vm-line-2);
  border-radius: 8px;
  padding: 12px 16px;
  margin-top: 4px;
}

.instructions-box pre {
  margin: 0;
  font-family: inherit;
  font-size: 13px;
  color: var(--vm-ink);
  line-height: 1.7;
  white-space: pre-wrap;
}

.scope-gap-notice {
  padding: 8px 12px;
  background: var(--vm-amber-soft);
  border: 1px solid #fed7aa;
  border-radius: 6px;
  font-size: 12px;
  color: var(--vm-amber-ink);
}

/* Also prevent Done button while pending confirm */
.cred-done-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cred-status--pending {
  font-size: 12px;
  font-weight: 500;
  color: var(--vm-amber-ink);
}

.cred-row--pending {
  border-color: #fcd34d;
  background: var(--vm-amber-soft);
}

.cred-btn--confirm {
  background: var(--vm-green-soft);
  color: var(--vm-green-ink);
  border: 1px solid #86efac;
}

.cred-btn--confirm:hover {
  background: var(--vm-green-soft);
}

.cred-btn--retry {
  background: var(--vm-surface-soft);
  color: var(--vm-link);
  border: 1px solid #93c5fd;
}

.cred-btn--retry:hover {
  background: var(--vm-blue-soft);
}

.cred-btn--retry-small {
  background: none;
  border: none;
  color: var(--vm-ink-faint);
  font-size: 16px;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  transition: color 0.15s;
}

.cred-btn--retry-small:hover {
  color: var(--vm-ink-faint);
}

.cred-btn--use-existing {
  background: var(--vm-surface-soft);
  color: var(--vm-teal-ink);
  border: 1px solid #5eead4;
}
.cred-btn--use-existing:hover { background: var(--vm-teal-soft); }

.cred-btn--manual {
  background: var(--vm-surface-soft);
  color: var(--vm-link);
  border: 1px solid #BFDBFE;
}
.cred-btn--manual:hover { background: var(--vm-blue-soft); }

.cred-btn--reauth-small {
  background: var(--vm-amber-soft);
  color: var(--vm-amber-ink);
  border: 1px solid #fed7aa;
  font-size: 11px;
  padding: 3px 8px;
}
.cred-btn--reauth-small:hover { background: var(--vm-amber-soft); }

.cred-btn--done {
  background: #1d4ed8;
  color: #fff;
  border: none;
}
.cred-btn--done:hover { background: #1e40af; }

.cred-manual-input {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
  margin-top: 4px;
  width: 100%;
}

.cred-key-input {
  flex: 1;
  min-width: 160px;
  padding: 5px 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 13px;
  font-family: monospace;
  outline: none;
  transition: border-color 0.15s;
}
.cred-key-input:focus { border-color: #1D4ED8; }

.cred-done-btn {
  margin-top: 8px;
  width: 100%;
}

.existing-cred-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.existing-cred-labels {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-left: 2px;
}

/* Credential chip row — matches admin AgentCredential list style */
.existing-cred-label {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11.5px;
  font-weight: 500;
  padding: 2px 8px 2px 6px;
  border-radius: 6px;
  background: var(--vm-surface-soft);
  color: var(--vm-ink-soft);
  border: 1px solid var(--vm-line-2);
  white-space: nowrap;
}

/* "★ Default" accent badge inside the chip */
.existing-cred-default {
  font-size: 10px;
  font-weight: 600;
  color: var(--vm-amber-ink);
  letter-spacing: 0.02em;
}

/* Agent sub-chip (pill showing which agent owns it) */
.existing-cred-agent {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--vm-blue-soft);
  color: var(--vm-link);
  border: 1px solid #BFDBFE;
}

/* Credential picker — replaces single Use Existing button */
.cred-picker {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cred-picker-row {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: var(--vm-surface);
  cursor: pointer;
  font-size: 13px;
  text-align: left;
  transition: background 0.12s, border-color 0.12s;
}

.cred-picker-row:hover {
  background: var(--vm-green-soft);
  border-color: #16a34a;
}

.picker-cred-name {
  font-weight: 500;
  color: var(--vm-ink);
}

.picker-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 999px;
  white-space: nowrap;
}

.picker-badge--default {
  background: var(--vm-amber-soft);
  color: var(--vm-amber-ink);
  border: 1px solid #fde68a;
}

.picker-badge--agent {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  background: var(--vm-blue-soft);
  color: var(--vm-link);
  border: 1px solid #BFDBFE;
}
</style>
