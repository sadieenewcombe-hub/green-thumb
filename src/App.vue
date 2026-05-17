<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from './supabase'

const plants = ref([])
const selected = ref(null)

onMounted(async () => {
  const { data, error } = await supabase.from('plants').select('*')
  if (error) {
    console.error('Error fetching plants:', error)
    return
  }
  console.log('plants from supabase:', data)
  plants.value = data
  selected.value = data[0]
})

const statusColor = (status) => {
  if (status === 'water') return 'bg-blue-500 text-blue-100'
  if (status === 'repot') return 'bg-orange-500 text-orange-100'
  if (status === 'frost') return 'bg-sky-400 text-sky-100'
  return 'bg-green-600 text-green-100'
}
</script>

<template>
  <div class="bg-green-900 min-h-screen flex flex-col">

    <!-- HEADER -->
    <div class="bg-green-900 border-b-4 border-yellow-400 px-4 py-3 flex items-center justify-between">
      <div>
        <h1 class="text-yellow-400 text-3xl font-bold">Green Thumb</h1>
        <p class="text-green-400 text-xs tracking-widest uppercase">my garden</p>
      </div>
      <div class="flex gap-3">
        <button class="border-2 border-green-600 text-green-400 text-xs font-bold px-4 py-2 rounded-full uppercase tracking-wide">Roster</button>
        <button class="bg-yellow-400 border-2 border-yellow-600 text-green-900 text-xs font-bold px-4 py-2 rounded-full uppercase tracking-wide">Garden</button>
      </div>
    </div>

    <!-- WEATHER STRIP -->
    <div class="bg-green-800 px-4 py-2 flex items-center gap-6 text-green-300 text-xs font-bold">
      <span>☀️ 84°F today</span>
      <span>💧 12% humidity</span>
      <span>🌧 rain thu</span>
      <span class="ml-auto bg-blue-500 text-blue-100 px-3 py-1 rounded-full text-xs">❄️ frost fri — bring plants in!</span>
    </div>

    <!-- MAIN BODY -->
    <div class="flex flex-1">

      <!-- LEFT: PLANT DETAIL -->
        <div v-if="selected" class="w-80 bg-green-700 p-4 flex flex-col gap-4">

        <!-- EMOJI -->
        <div class="bg-green-900 rounded-xl h-28 flex items-center justify-center text-6xl">
          {{ selected.emoji }}
        </div>

        <!-- NAME + SPECIES -->
        <div>
          <h2 class="text-yellow-400 text-2xl font-bold">{{ selected.name }}</h2>
          <p class="text-green-400 text-xs uppercase tracking-widest mt-1">{{ selected.species }} · {{ selected.location }}</p>
        </div>

        <!-- STAT GRID -->
        <div class="grid grid-cols-2 gap-2">
          <div class="bg-green-900 rounded-lg p-2">
            <p class="text-green-500 text-xs uppercase tracking-wide">Last watered</p>
            <p class="text-yellow-400 text-sm font-bold">5 days ago</p>
          </div>
          <div class="bg-green-900 rounded-lg p-2">
            <p class="text-green-500 text-xs uppercase tracking-wide">Next water</p>
            <p class="text-red-400 text-sm font-bold">Today!</p>
          </div>
        </div>

        <!-- HEALTH BARS -->
        <div class="flex flex-col gap-2">
          <p class="text-green-500 text-xs uppercase tracking-wide">Plant health</p>
          <div class="flex items-center gap-2">
            <span class="text-sm">💧</span>
            <div class="flex-1 bg-green-900 rounded-full h-2">
              <div class="bg-blue-400 h-2 rounded-full" style="width:15%"></div>
            </div>
            <span class="text-green-400 text-xs w-8 text-right">15%</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-sm">☀️</span>
            <div class="flex-1 bg-green-900 rounded-full h-2">
              <div class="bg-yellow-400 h-2 rounded-full" style="width:90%"></div>
            </div>
            <span class="text-green-400 text-xs w-8 text-right">90%</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-sm">❤️</span>
            <div class="flex-1 bg-green-900 rounded-full h-2">
              <div class="bg-red-400 h-2 rounded-full" style="width:70%"></div>
            </div>
            <span class="text-green-400 text-xs w-8 text-right">70%</span>
          </div>
        </div>

        <!-- LAST SCAN -->
        <p class="text-green-500 text-xs font-bold uppercase tracking-wide">
          last scan: 7/10 · 2 days ago
        </p>

        <!-- UPLOAD BUTTON -->
        <button class="bg-yellow-400 text-green-900 text-xs font-bold uppercase tracking-widest rounded-lg py-2 w-full cursor-pointer hover:bg-yellow-300">
          📷 upload photo for scan
        </button>

      </div>

      <!-- RIGHT: ROSTER LIST -->
      <div class="flex-1 bg-amber-50 flex flex-col">
        <div class="bg-amber-100 px-4 py-2 grid grid-cols-3 text-xs font-bold text-amber-800 uppercase tracking-widest border-b-2 border-amber-200">
          <span>Plant</span>
          <span class="text-center">Status</span>
          <span class="text-right">Score</span>
        </div>
        <div v-for="plant in plants" :key="plant.id"
          @click="selected = plant"
          class="px-4 py-3 border-b border-amber-200 grid grid-cols-3 items-center cursor-pointer hover:bg-amber-100"
          :class="selected.id === plant.id ? 'bg-green-100 border-l-4 border-l-green-500' : ''">
          <div class="flex items-center gap-3">
            <span class="text-2xl">{{ plant.emoji }}</span>
            <div>
              <p class="font-bold text-sm text-amber-900">{{ plant.name }}</p>
              <p class="text-xs text-amber-600">{{ plant.location }}</p>
            </div>
          </div>
          <div class="flex justify-center">
            <span class="text-xs font-bold px-2 py-1 rounded-full uppercase" :class="statusColor(plant.status)">{{ plant.status }}</span>
          </div>
          <p class="text-right font-bold text-amber-900">{{ plant.score }}/10</p>
        </div>
        <div class="mt-auto p-4 text-center text-xs font-bold text-amber-600 uppercase tracking-widest border-t-2 border-dashed border-amber-300 bg-amber-100 cursor-pointer hover:bg-amber-200">
          + add a plant
        </div>
      </div>

    </div>
  </div>
</template>