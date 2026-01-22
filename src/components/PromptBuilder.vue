<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
    <div class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
      
      <!-- Background overlay -->
      <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" @click="close"></div>

      <!-- Modal Panel -->
      <span class="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
      <div class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
        
        <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
          <div class="sm:flex sm:items-start">
            <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
              <h3 class="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                ✨ Agent Prompt Builder
              </h3>
              
              <div class="mt-4">
                <!-- Step 1: Input -->
                <div v-if="!generatedPrompt">
                  <label for="goal" class="block text-sm font-medium text-gray-700">What is your goal?</label>
                  <p class="text-xs text-gray-500 mb-2">Describe what you want the agent to do (e.g., "Scrape prices from Amazon", "Migrate database schema")</p>
                  <textarea
                    id="goal"
                    v-model="goal"
                    rows="4"
                    class="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 mt-1 block w-full sm:text-sm border border-gray-300 rounded-md"
                    placeholder="e.g. I want to build a python script that logs into Instagram..."
                  ></textarea>
                </div>

                <!-- Step 2: Result -->
                <div v-else>
                  <label class="block text-sm font-medium text-gray-700">Generated Task Prompt</label>
                  <div class="mt-1 relative rounded-md shadow-sm">
                    <textarea
                      v-model="generatedPrompt"
                      rows="12"
                      class="font-mono text-xs shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full border-gray-300 rounded-md bg-gray-50"
                    ></textarea>
                  </div>
                </div>

                <!-- Loading State -->
                <div v-if="loading" class="mt-4 flex justify-center">
                   <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span class="text-sm text-gray-500">Optimizing prompt with AI...</span>
                </div>

                <!-- Error Message -->
                <div v-if="error" class="mt-2 text-sm text-red-600">
                  {{ error }}
                </div>

              </div>
            </div>
          </div>
        </div>
        
        <div class="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
          <template v-if="!generatedPrompt">
             <button 
                type="button" 
                @click="generate"
                :disabled="!goal || loading"
                class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50">
                Generate
              </button>
          </template>
          <template v-else>
              <button 
                type="button" 
                @click="usePrompt"
                class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:ml-3 sm:w-auto sm:text-sm">
                Insert into Chat
              </button>
              <button 
                type="button" 
                @click="generatedPrompt = null"
                class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm">
                Try Again
              </button>
          </template>
          
          <button 
            type="button" 
            @click="close"
            class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm">
            Cancel
          </button>
        </div>
        
      </div>
    </div>
  </div>
</template>

<script>
import api from '../services/api' // Assuming standard api service

export default {
  name: 'PromptBuilder',
  data() {
    return {
      isOpen: false,
      goal: '',
      generatedPrompt: null,
      loading: false,
      error: null
    }
  },
  methods: {
    open() {
      this.isOpen = true
      this.goal = ''
      this.generatedPrompt = null
      this.error = null
    },
    close() {
      this.isOpen = false
    },
    async generate() {
      if (!this.goal) return
      
      this.loading = true
      this.error = null
      
      try {
        // Backend API call
        const response = await api.post('/prompt/generate/', {
          goal: this.goal
        })
        
        if (response.data && response.data.prompt) {
          this.generatedPrompt = response.data.prompt
        } else {
             this.error = "No prompt returned from server."
        }
        
      } catch (e) {
        console.error("Prompt generation error:", e)
        this.error = e.response?.data?.error || e.message || "Failed to generate prompt"
      } finally {
        this.loading = false
      }
    },
    usePrompt() {
      this.$emit('insert', this.generatedPrompt)
      this.close()
    }
  }
}
</script>
