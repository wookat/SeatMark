<script setup lang="ts">
import AppFooter from '@/components/ui/AppFooter.vue'
import AppHeader from '@/components/ui/AppHeader.vue'
import LoadingOverlay from '@/components/ui/LoadingOverlay.vue'
import ToastHost from '@/components/ui/ToastHost.vue'
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <AppHeader />
    <main class="flex-1">
      <RouterView />
    </main>
    <AppFooter />
    <ToastHost />
    <LoadingOverlay />
  </div>
</template>
