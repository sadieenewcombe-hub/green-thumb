<script setup>
import { onMounted } from 'vue'
import { supabase } from './supabase'

onMounted(async () => {
  const { data, error } = await supabase.from('plants').select('*')
  console.log('plants:', data)
  console.log('error:', error)
})
</script>

<template>
  <div>
    <h1>Green Thumb</h1>
    <p>Check the browser console for Supabase connection test</p>
  </div>
</template>