<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="currentRequest" class="hitl-overlay" @click.self="handleOverlayClick">
        <div class="hitl-modal" :class="[`urgency-${currentRequest.urgency}`, `type-${currentRequest.interaction_type}`]">
          <!-- Header -->
          <div class="modal-header">
            <div class="header-left">
              <span class="icon">{{ getIcon(currentRequest.interaction_type) }}</span>
              <div>
                <h3>{{ getTitle(currentRequest.interaction_type) }}</h3>
                <span class="subtitle">Agent Request</span>
              </div>
            </div>
            <div class="header-right">
              <span class="urgency-badge" :class="`urgency-${currentRequest.urgency}`">
                {{ currentRequest.urgency }}
              </span>
              <button v-if="currentRequest.response_type === 'none' || currentRequest.interaction_type === 'credential_setup'" @click="dismiss" class="close-btn">Ã—</button>
            </div>
          </div>

          <!-- Body -->
          <div class="modal-body">
            <p class="summary">{{ currentRequest.summary }}</p>

            <!-- Payload Preview (collapsible) -->
            <details v-if="hasPayloadContent" class="payload-details">
              <summary>View Details</summary>
              <pre class="payload-content">{{ JSON.stringify(currentRequest.payload, null, 2) }}</pre>
            </details>

            <!-- Binary Response (Approve/Reject) -->
            <div v-if="currentRequest.response_type === 'binary'" class="response-section">
              <div class="button-group">
                <button @click="respond(true)" class="btn btn-approve">
                  <span class="btn-icon">âœ“</span>
                  Approve
                </button>
                <button @click="respond(false)" class="btn btn-reject">
                  <span class="btn-icon">âœ—</span>
                  Reject
                </button>
              </div>
            </div>

            <!-- Choice Response (Multiple Options) -->
            <div v-else-if="currentRequest.response_type === 'choice'" class="response-section">
              <div class="choice-options">
                <button
                  v-for="option in currentRequest.options"
                  :key="option.id"
                  @click="respond(option.id)"
                  class="option-button"
                >
                  <span class="option-title">{{ option.title }}</span>
                  <span v-if="option.description" class="option-description">{{ option.description }}</span>
                  <span v-if="option.risk" class="risk-badge" :class="`risk-${option.risk}`">{{ option.risk }} risk</span>
                </button>
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
              <button @click="respond(textResponse)" class="btn btn-submit" :disabled="!textResponse.trim()">
                Submit Answer
              </button>
            </div>

            <!-- Notification Only (No Response Needed) -->
            <div v-else-if="currentRequest.response_type === 'none'" class="response-section">
              <button @click="dismiss" class="btn btn-acknowledge">
                Acknowledge
              </button>
            </div>

            <!-- â”€â”€ Credential Setup (per_item) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ -->
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
                  <span class="cred-icon">{{ svc.icon || 'ðŸ”—' }}</span>
                  <div class="cred-info">
                    <span class="cred-name">{{ svc.name }}</span>
                    <span v-if="svc.already_connected" class="cred-status cred-status--ok">Already connected</span>
                    <span v-else-if="credState[svc.name] === 'connected'" class="cred-status cred-status--ok">âœ“ Connected</span>
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
                  >{{ connectingService === svc.name ? 'Openingâ€¦' : 'Re-auth' }}</button>
                </div>

                <!-- Not-yet-connected: connect / api-key / skip actions -->
                <div v-else class="cred-row-actions">
                  <!-- OAuth -->
                  <template v-if="svc.auth_type === 'oauth2'">
                    <template v-if="credState[svc.name] === 'pending_confirm'">
                      <button @click="confirmConnected(svc.name)" class="cred-btn cred-btn--confirm">âœ“ I connected it</button>
                      <button @click="retryOAuth(svc)" class="cred-btn cred-btn--retry">â†º Retry</button>
                    </template>
                    <button
                      v-else-if="credState[svc.name] !== 'connected' && credState[svc.name] !== 'skipped'"
                      @click="openOAuthPopup(svc)"
                      :disabled="connectingService === svc.name"
                      class="cred-btn cred-btn--connect"
                      :class="{ 'cred-btn--reauth': svc.needs_reauth }"
                    >{{ connectingService === svc.name ? 'Openingâ€¦' : (svc.needs_reauth ? 'Re-authorize' : 'Connect') }}</button>
                    <button
                      v-else-if="credState[svc.name] === 'connected'"
                      @click="retryOAuth(svc)"
                      class="cred-btn cred-btn--retry-small"
                      title="Re-connect"
                    >â†º</button>
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
                          <span v-if="cred.is_default" class="picker-badge picker-badge--default">â˜… Default</span>
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

                  <!-- Skip Ã— -->
                  <button
                    v-if="credState[svc.name] !== 'connected' && credState[svc.name] !== 'skipped'"
                    @click="skipService(svc.name)"
                    class="cred-btn-skip"
                    title="Skip this service"
                  >Ã—</button>
                </div>
              </div>

              <!-- Expandable API key instructions -->
              <div v-if="expandedInstructions" class="instructions-box">
                <pre>{{ getInstructions(expandedInstructions) }}</pre>
                <div class="instructions-footer">
                  ðŸ’¡ To add credentials directly: go to <strong>Settings â†’ Agents â†’ [this agent] â†’ Credentials</strong> and add the API key there, then come back and click <em>Done</em>.
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
                Done â€” resume agent
              </button>
            </div>

            <!-- Optional Feedback (not shown for credential_setup) -->
            <div v-if="currentRequest.response_type !== 'none' && currentRequest.interaction_type !== 'credential_setup'" class="feedback-section">
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
              <span v-if="currentRequest.timeout_at" class="timeout-indicator" :class="{'timeout-warning': isNearTimeout}">
                â± {{ timeRemaining }}
              </span>
              <span v-if="pendingRequests.length > 1" class="queue-indicator">
                {{ pendingRequests.length }} pending requests
              </span>
            </div>
            <div class="footer-right">
              <button v-if="currentRequest.response_type !== 'none'" @click="skip" class="btn-link">
                Skip ({{ pendingRequests.length - 1 }} more)
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

const props = defineProps({
  requests: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['respond', 'dismiss', 'skip']);

// State
const textResponse = ref('');
const feedback = ref('');
const currentTime = ref(Date.now());

// Current request (first in queue)
const currentRequest = computed(() => props.requests[0] || null);
const pendingRequests = computed(() => props.requests);

// Payload has meaningful content
const hasPayloadContent = computed(() => {
  if (!currentRequest.value?.payload) return false;
  return Object.keys(currentRequest.value.payload).length > 0;
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

const isNearTimeout = computed(() => {
  if (!currentRequest.value?.timeout_at) return false;
  const timeout = new Date(currentRequest.value.timeout_at).getTime();
  const remaining = timeout - currentTime.value;
  return remaining < 30000; // Less than 30 seconds
});

// Icon mapping
const getIcon = (type) => {
  const icons = {
    'approval': 'âœ“',
    'choice': 'â˜°',
    'question': '?',
    'clarification': 'ðŸ’¬',
    'validation': 'âœ“',
    'review': 'ðŸ‘',
    'escalation': 'âš ',
    'alert': 'â„¹',
    'progress': 'â³',
    'collaboration': 'ðŸ‘¥',
    'confirmation': 'âœ“',
    'preference': 'âš™',
    'credential_setup': 'ðŸ”‘',
  };
  return icons[type] || 'â€¢';
};

// Title mapping
const getTitle = (type) => {
  const titles = {
    'approval': 'Approval Required',
    'choice': 'Choose an Option',
    'question': 'Question',
    'clarification': 'Clarification Needed',
    'validation': 'Validation Request',
    'review': 'Review Required',
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
const respond = (value) => {
  if (!currentRequest.value) return;
  
  emit('respond', {
    request_id: currentRequest.value.request_id,
    response_value: value,
    feedback: feedback.value
  });
  
  // Reset form
  textResponse.value = '';
  feedback.value = '';
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

// â”€â”€ Credential Setup State â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// All services from payload â€” include both needs-setup and already-connected
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

const openOAuthPopup = async (svc) => {
  const startUrl = svc.auth_url;
  if (!startUrl) return;
  connectingService.value = svc.name;

  let popupUrl = startUrl;
  try {
    const res = await fetch(startUrl, { credentials: 'include' });
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data?.redirect_url) popupUrl = data.redirect_url;
    }
  } catch (e) {
    console.warn('[HITLModal] Could not fetch OAuth start URL, opening directly:', e);
  }

  const popup = window.open(popupUrl, '_blank', 'width=600,height=700,left=200,top=100');
  const poll = setInterval(() => {
    if (!popup || popup.closed) {
      clearInterval(poll);
      connectingService.value = null;
      // Don't auto-mark connected â€” wait for explicit confirmation
      if (credState.value[svc.name] !== 'connected') {
        credState.value = { ...credState.value, [svc.name]: 'pending_confirm' };
      }
    }
  }, 800);
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
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  animation: modalSlideIn 0.3s ease-out;
}

@keyframes modalSlideIn {
  from {
    transform: translateY(-20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
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
  border-bottom: 1px solid #e5e7eb;
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
  background: #f3f4f6;
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
  color: #111827;
}

.subtitle {
  font-size: 12px;
  color: #6b7280;
}

.urgency-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.urgency-badge.urgency-low { background: #d1fae5; color: #065f46; }
.urgency-badge.urgency-medium { background: #fed7aa; color: #92400e; }
.urgency-badge.urgency-high { background: #fecaca; color: #991b1b; }
.urgency-badge.urgency-critical { background: #dc2626; color: white; }

.close-btn {
  background: none;
  border: none;
  font-size: 28px;
  color: #9ca3af;
  cursor: pointer;
  line-height: 1;
  padding: 0;
  margin-left: 12px;
}

.close-btn:hover {
  color: #4b5563;
}

/* Body */
.modal-body {
  padding: 24px;
  overflow-y: auto;
  flex: 1;
}

.summary {
  font-size: 15px;
  color: #374151;
  line-height: 1.6;
  margin: 0 0 20px 0;
}

.payload-details {
  margin-bottom: 20px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 12px;
}

.payload-details summary {
  cursor: pointer;
  font-size: 13px;
  color: #6b7280;
  font-weight: 500;
  user-select: none;
}

.payload-content {
  margin-top: 12px;
  font-size: 12px;
  color: #111827;
  background: white;
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
  transition: all 0.2s;
}

.btn-icon {
  font-size: 16px;
}

.btn-approve {
  background: #10b981;
  color: white;
}

.btn-approve:hover {
  background: #059669;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.btn-reject {
  background: #ef4444;
  color: white;
}

.btn-reject:hover {
  background: #dc2626;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
}

.btn-submit {
  background: #3b82f6;
  color: white;
  width: 100%;
  margin-top: 12px;
}

.btn-submit:hover:not(:disabled) {
  background: #2563eb;
  transform: translateY(-1px);
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
  background: #f9fafb;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s;
}

.option-button:hover {
  border-color: #3b82f6;
  background: #eff6ff;
  transform: translateX(4px);
}

.option-title {
  display: block;
  font-weight: 600;
  color: #111827;
  margin-bottom: 4px;
}

.option-description {
  display: block;
  font-size: 13px;
  color: #6b7280;
  margin-bottom: 8px;
}

.risk-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}

.risk-badge.risk-low { background: #d1fae5; color: #065f46; }
.risk-badge.risk-medium { background: #fed7aa; color: #92400e; }
.risk-badge.risk-high { background: #fecaca; color: #991b1b; }

/* Text Input */
.text-input {
  width: 100%;
  padding: 12px;
  border: 2px solid #e5e7eb;
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
  border-top: 1px solid #e5e7eb;
}

.feedback-section label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: #6b7280;
  margin-bottom: 8px;
}

.feedback-input {
  width: 100%;
  padding: 10px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font-size: 13px;
  font-family: inherit;
  resize: vertical;
}

.feedback-input:focus {
  outline: none;
  border-color: #cbd5e1;
}

/* Footer */
.modal-footer {
  padding: 16px 24px;
  border-top: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #f9fafb;
}

.footer-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.timeout-indicator {
  font-size: 13px;
  color: #6b7280;
  font-weight: 500;
}

.timeout-warning {
  color: #dc2626;
  font-weight: 600;
}

.queue-indicator {
  font-size: 12px;
  color: #9ca3af;
}

.btn-link {
  background: none;
  border: none;
  color: #3b82f6;
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

/* â”€â”€ Credential Setup â”€â”€â”€ */
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
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fff;
  gap: 12px;
  transition: background 0.2s, border-color 0.2s;
}

.cred-row--done {
  border-color: #6ee7b7;
  background: #f0fdf9;
}

.cred-row--skipped {
  border-color: #e5e7eb;
  background: #f9fafb;
  opacity: 0.6;
}

.cred-row--already {
  background: #f0fdf9;
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
  color: #111827;
}

.cred-reason {
  font-size: 12px;
  color: #6b7280;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cred-status {
  font-size: 12px;
  font-weight: 500;
}

.cred-status--ok {
  color: #059669;
}

.cred-status--skip {
  color: #9ca3af;
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
  transition: all 0.15s;
}

.cred-btn--connect {
  background: #eff6ff;
  color: #2563eb;
}

.cred-btn--connect:hover:not(:disabled) {
  background: #dbeafe;
}

.cred-btn--connect:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.cred-btn--reauth {
  background: #fffbeb;
  color: #b45309;
}

.cred-btn--reauth:hover {
  background: #fef3c7;
}

.cred-btn--instructions {
  background: #f3f4f6;
  color: #374151;
}

.cred-btn--instructions:hover {
  background: #e5e7eb;
}

.cred-btn--done {
  background: #f0fdf4;
  color: #15803d;
}

.cred-btn--done:hover {
  background: #dcfce7;
}

.cred-btn-skip {
  background: none;
  border: none;
  color: #9ca3af;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
  transition: color 0.15s;
}

.cred-btn-skip:hover {
  color: #6b7280;
}

.instructions-box {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 12px 16px;
  margin-top: 4px;
}

.instructions-box pre {
  margin: 0;
  font-family: inherit;
  font-size: 13px;
  color: #1e293b;
  line-height: 1.7;
  white-space: pre-wrap;
}

.scope-gap-notice {
  padding: 8px 12px;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  border-radius: 6px;
  font-size: 12px;
  color: #92400e;
}

/* Also prevent Done button while pending confirm */
.cred-done-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cred-status--pending {
  font-size: 12px;
  font-weight: 500;
  color: #b45309;
}

.cred-row--pending {
  border-color: #fcd34d;
  background: #fffbeb;
}

.cred-btn--confirm {
  background: #f0fdf4;
  color: #15803d;
  border: 1px solid #86efac;
}

.cred-btn--confirm:hover {
  background: #dcfce7;
}

.cred-btn--retry {
  background: #eff6ff;
  color: #2563eb;
  border: 1px solid #93c5fd;
}

.cred-btn--retry:hover {
  background: #dbeafe;
}

.cred-btn--retry-small {
  background: none;
  border: none;
  color: #9ca3af;
  font-size: 16px;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  transition: color 0.15s;
}

.cred-btn--retry-small:hover {
  color: #6b7280;
}

.cred-btn--use-existing {
  background: #f0fdfa;
  color: #0d9488;
  border: 1px solid #5eead4;
}
.cred-btn--use-existing:hover { background: #ccfbf1; }

.cred-btn--manual {
  background: #f5f3ff;
  color: #6d28d9;
  border: 1px solid #c4b5fd;
}
.cred-btn--manual:hover { background: #ede9fe; }

.cred-btn--reauth-small {
  background: #fff7ed;
  color: #c2410c;
  border: 1px solid #fed7aa;
  font-size: 11px;
  padding: 3px 8px;
}
.cred-btn--reauth-small:hover { background: #ffedd5; }

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
.cred-key-input:focus { border-color: #6d28d9; }

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

/* Credential chip row â€” matches admin AgentCredential list style */
.existing-cred-label {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11.5px;
  font-weight: 500;
  padding: 2px 8px 2px 6px;
  border-radius: 6px;
  background: #f8fafc;
  color: #334155;
  border: 1px solid #e2e8f0;
  white-space: nowrap;
}

/* "â˜… Default" accent badge inside the chip */
.existing-cred-default {
  font-size: 10px;
  font-weight: 600;
  color: #d97706;
  letter-spacing: 0.02em;
}

/* Agent sub-chip (pill showing which agent owns it) */
.existing-cred-agent {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 999px;
  background: #ede9fe;
  color: #6d28d9;
  border: 1px solid #c4b5fd;
}

/* Credential picker â€” replaces single Use Existing button */
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
  background: #fff;
  cursor: pointer;
  font-size: 13px;
  text-align: left;
  transition: background 0.12s, border-color 0.12s;
}

.cred-picker-row:hover {
  background: #f0fdf4;
  border-color: #16a34a;
}

.picker-cred-name {
  font-weight: 500;
  color: #111827;
}

.picker-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 999px;
  white-space: nowrap;
}

.picker-badge--default {
  background: #fef3c7;
  color: #92400e;
  border: 1px solid #fde68a;
}

.picker-badge--agent {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  background: #ede9fe;
  color: #6d28d9;
  border: 1px solid #c4b5fd;
}
</style>
