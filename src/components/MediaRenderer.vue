<template>
    <div class="media-renderer">
        <!-- Single Image -->
        <div v-if="artifacts.length === 1 && artifacts[0].type === 'image'" class="single-media">
            <img 
                :src="artifacts[0].url" 
                :alt="artifacts[0].title || 'Generated image'"
                class="max-w-md rounded-lg shadow-lg hover:shadow-xl transition-shadow cursor-pointer border border-purple-100"
                @click="openLightbox(artifacts[0])"
            />
            <p v-if="artifacts[0].title" class="text-sm text-purple-700 mt-2 font-medium">{{ artifacts[0].title }}</p>
        </div>
        
        <!-- Single Video -->
        <div v-if="artifacts.length === 1 && artifacts[0].type === 'video'" class="single-media">
            <video 
                :src="artifacts[0].url" 
                controls
                class="max-w-md rounded-lg shadow-lg border border-purple-100"
            >
                Your browser does not support the video tag.
            </video>
            <p v-if="artifacts[0].title" class="text-sm text-purple-700 mt-2 font-medium">{{ artifacts[0].title }}</p>
        </div>
        
        <!-- Multiple Media - Carousel -->
        <div v-if="artifacts.length > 1" class="media-carousel">
            <div class="flex gap-3 overflow-x-auto pb-2 scrollbar-custom">
                <div v-for="artifact in artifacts" :key="artifact.id" class="flex-shrink-0">
                    <div class="relative group">
                        <img 
                            v-if="artifact.type === 'image'"
                            :src="artifact.url"
                            :alt="artifact.title"
                            class="h-32 w-auto rounded shadow hover:shadow-md transition cursor-pointer border border-purple-100"
                            @click="openLightbox(artifact)"
                        />
                        <video 
                            v-if="artifact.type === 'video'"
                            :src="artifact.url"
                            class="h-32 w-auto rounded shadow cursor-pointer border border-purple-100"
                            muted
                            @click="openLightbox(artifact)"
                        />
                        <div class="absolute inset-0 bg-black opacity-0 group-hover:opacity-10 transition-opacity rounded pointer-events-none"></div>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Lightbox Modal -->
        <transition name="fade">
            <div 
                v-if="lightboxOpen" 
                @click.self="closeLightbox" 
                class="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
            >
                <div class="max-w-6xl max-h-full relative" @click.stop>
                    <img 
                        v-if="selectedMedia?.type === 'image'"
                        :src="selectedMedia.url"
                        :alt="selectedMedia.title"
                        class="max-w-full max-h-[90vh] rounded-lg shadow-2xl"
                    />
                    <video 
                        v-if="selectedMedia?.type === 'video'"
                        :src="selectedMedia.url"
                        controls
                        autoplay
                        class="max-w-full max-h-[90vh] rounded-lg shadow-2xl"
                    />
                    
                    <!-- Media Info Overlay -->
                    <div v-if="selectedMedia?.title || selectedMedia?.description" 
                         class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 rounded-b-lg">
                        <h3 v-if="selectedMedia.title" class="text-white font-semibold text-lg">{{ selectedMedia.title }}</h3>
                        <p v-if="selectedMedia.description" class="text-white/80 text-sm mt-1">{{ selectedMedia.description }}</p>
                    </div>
                    
                    <!-- Image Counter -->
                    <div v-if="artifacts.length > 1" class="absolute top-4 left-4 bg-black/50 text-white px-3 py-1.5 rounded-full text-sm font-medium">
                        {{ currentMediaIndex + 1 }} / {{ artifacts.length }}
                    </div>
                </div>
                
                <!-- Navigation Arrows (only show if more than 1 artifact) -->
                <button 
                    v-if="artifacts.length > 1"
                    @click="previousMedia" 
                    class="absolute left-4 top-1/2 -translate-y-1/2 text-white bg-black/50 hover:bg-black/70 rounded-full p-3 transition-all"
                    aria-label="Previous"
                >
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                
                <button 
                    v-if="artifacts.length > 1"
                    @click="nextMedia" 
                    class="absolute right-4 top-1/2 -translate-y-1/2 text-white bg-black/50 hover:bg-black/70 rounded-full p-3 transition-all"
                    aria-label="Next"
                >
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                    </svg>
                </button>
                
                <!-- Close Button -->
                <button 
                    @click="closeLightbox" 
                    class="absolute top-4 right-4 text-white text-2xl hover:bg-white/20 rounded-full p-3 transition-colors"
                    aria-label="Close"
                >
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
        </transition>
    </div>
</template>

<script setup>
import { ref } from 'vue';

const props = defineProps({
    artifacts: {
        type: Array,
        required: true,
        validator: (arr) => arr.every(item => 
            item.url && item.type && ['image', 'video', 'audio', 'document', 'other'].includes(item.type)
        )
    }
});

const lightboxOpen = ref(false);
const selectedMedia = ref(null);

// Computed property for current media index
import { computed } from 'vue';
const currentMediaIndex = computed(() => {
    if (!selectedMedia.value) return 0;
    return props.artifacts.findIndex(a => a.id === selectedMedia.value.id);
});

const openLightbox = (artifact) => {
    selectedMedia.value = artifact;
    lightboxOpen.value = true;
    // Prevent body scroll when lightbox is open
    document.body.style.overflow = 'hidden';
};

const closeLightbox = () => {
    lightboxOpen.value = false;
    selectedMedia.value = null;
    // Restore body scroll
    document.body.style.overflow = '';
};

const nextMedia = () => {
    const currentIndex = props.artifacts.findIndex(a => a.id === selectedMedia.value.id);
    const nextIndex = (currentIndex + 1) % props.artifacts.length;
    selectedMedia.value = props.artifacts[nextIndex];
};

const previousMedia = () => {
    const currentIndex = props.artifacts.findIndex(a => a.id === selectedMedia.value.id);
    const prevIndex = (currentIndex - 1 + props.artifacts.length) % props.artifacts.length;
    selectedMedia.value = props.artifacts[prevIndex];
};



// Keyboard navigation
import { onMounted, onUnmounted } from 'vue';

const handleKeydown = (e) => {
    if (!lightboxOpen.value) return;
    
    if (e.key === 'ArrowRight') {
        nextMedia();
    } else if (e.key === 'ArrowLeft') {
        previousMedia();
    } else if (e.key === 'Escape') {
        closeLightbox();
    }
};

onMounted(() => {
    window.addEventListener('keydown', handleKeydown);
});

// Cleanup on unmount
onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown);
    if (lightboxOpen.value) {
        document.body.style.overflow = '';
    }
});

</script>

<style scoped>
.media-carousel::-webkit-scrollbar {
    height: 6px;
}

.media-carousel::-webkit-scrollbar-track {
    background: #f3e8ff;
    border-radius: 3px;
}

.media-carousel::-webkit-scrollbar-thumb {
    background: #9333ea;
    border-radius: 3px;
}

.media-carousel::-webkit-scrollbar-thumb:hover {
    background: #7e22ce;
}

.scrollbar-custom {
    scrollbar-width: thin;
    scrollbar-color: #9333ea #f3e8ff;
}

.fade-enter-active, .fade-leave-active {
    transition: opacity 0.2s ease;
}

.fade-enter-from, .fade-leave-to {
    opacity: 0;
}

.single-media {
    @apply mb-3;
}
</style>
