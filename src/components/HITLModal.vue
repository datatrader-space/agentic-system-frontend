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
              <button v-if="currentRequest.response_type === 'none'" @click="dismiss" class="close-btn">×</button>
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
                  <span class="btn-icon">✓</span>
                  Approve
                </button>
                <button @click="respond(false)" class="btn btn-reject">
                  <span class="btn-icon">✗</span>
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

            <!-- Optional Feedback -->
            <div v-if="currentRequest.response_type !== 'none'" class="feedback-section">
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
                ⏱ {{ timeRemaining }}
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
    'preference': '⚙'
  };
  return icons[type] || '•';
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
    'preference': 'Preference'
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
  if (currentRequest.value?.response_type === 'none') {
    dismiss();
  }
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

// Reset form when request changes
watch(currentRequest, () => {
  textResponse.value = '';
  feedback.value = '';
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
</style>
