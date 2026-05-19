<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from './supabase'

const plants = ref([])
const selected = ref(null)
const weather = ref(null)
const showForm = ref(false)
const newName = ref('')
const newSpecies = ref('')
const newLocation = ref('')

const chatOpen = ref(false)
const chatMessages = ref([
  { role: 'assistant', content: 'Hi! Ask me anything about your plants, or upload a photo for a diagnosis.' }
])
const chatInput = ref('')
const chatLoading = ref(false)

onMounted(async () => {
  const { data, error } = await supabase.from('plants').select('*')
  if (error) {
    console.error('Error fetching plants:', error)
    return
  }
  plants.value = data
  selected.value = data[0]
})

const fetchWeather = async () => {
  const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=38.9072&longitude=-77.0369&current=temperature_2m,relative_humidity_2m,precipitation&temperature_unit=fahrenheit')
  const data = await res.json()
  weather.value = data.current
}

fetchWeather()

const addPlant = async () => {
  const { data, error } = await supabase
    .from('plants')
    .insert([{ name: newName.value, species: newSpecies.value, location: newLocation.value, status: 'good', score: 8, emoji: '🌱' }])
    .select()
  if (error) {
    console.error('Error adding plant:', error)
    return
  }
  plants.value.push(data[0])
  newName.value = ''
  newSpecies.value = ''
  newLocation.value = ''
  showForm.value = false
}

const sendMessage = async () => {
  if (!chatInput.value.trim()) return
  const userMessage = chatInput.value
  chatMessages.value.push({ role: 'user', content: userMessage })
  chatInput.value = ''
  chatLoading.value = true
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: chatMessages.value.filter(m => m.role === 'user' || m.role === 'assistant'),
        plantName: selected.value?.name,
        plantSpecies: selected.value?.species,
        plantLocation: selected.value?.location
      })
    })
    const data = await response.json()
    chatMessages.value.push({ role: 'assistant', content: data.content[0].text })
  } catch (error) {
    console.error('Chat error:', error)
    chatMessages.value.push({ role: 'assistant', content: 'Sorry, something went wrong. Try again!' })
  } finally {
    chatLoading.value = false
  }
}

const statusColor = (status) => {
  if (status === 'water') return 'text-white' 
  if (status === 'repot') return 'text-white'
  if (status === 'frost') return 'text-white'
  return 'text-white'
}

const statusBg = (status) => {
  if (status === 'water') return '#5AA8D4'
  if (status === 'repot') return '#C4622D'
  if (status === 'frost') return '#5AA8D4'
  return '#6AAE5A'
}
</script>

<template>
  <div class="min-h-screen flex flex-col" style="font-family: 'Rumpelstiltskin', cursive; background: #F5EED8">

    <!-- HEADER -->
    <div class="px-4 py-3 flex items-center justify-between border-b-4" style="background: #8B5E2A; border-color: #F0C040">
      <div>
        <h1 class="text-3xl" style="font-family: 'BlobSpongey', cursive; color: #F0C040">Green Thumb</h1>
        <p class="text-xs tracking-widest uppercase" style="color: #D4A870">my garden</p>
      </div>
      <div class="flex gap-3">
        <button class="border-2 text-xs font-bold px-4 py-2 rounded-full uppercase tracking-wide" style="border-color: #6AAE5A; color: #6AAE5A">Roster</button>
        <button class="text-xs font-bold px-4 py-2 rounded-full uppercase tracking-wide" style="background: #F0C040; color: #8B5E2A">Garden</button>
      </div>
    </div>

    <!-- WEATHER STRIP -->
    <div class="px-4 py-2 flex items-center gap-6 text-xs font-bold" style="background: #6AAE5A; color: #F5EED8">
      <span v-if="weather">☀️ {{ weather.temperature_2m }}°F today</span>
      <span v-if="weather">💧 {{ weather.relative_humidity_2m }}% humidity</span>
      <span v-if="weather">🌧 precipitation: {{ weather.precipitation }}mm</span>
      <span class="ml-auto px-3 py-1 rounded-full text-xs text-white" style="background: #5AA8D4">❄️ frost fri — bring plants in!</span>
    </div>

    <!-- MAIN BODY -->
    <div class="flex flex-1">

      <!-- LEFT: PLANT DETAIL -->
      <div v-if="selected" class="w-80 p-4 flex flex-col gap-4" style="background: #5A8A48">

        <!-- EMOJI -->
        <div class="rounded-xl h-28 flex items-center justify-center text-6xl" style="background: #3A6A2A">
          {{ selected.emoji }}
        </div>

        <!-- NAME + SPECIES -->
        <div class="text-center">
          <h2 class="text-2xl font-bold" style="color: #F0C040">{{ selected.name }}</h2>
          <p class="text-xs uppercase tracking-widest mt-1" style="color: #C8E8A0">{{ selected.species }} · {{ selected.location }}</p>
        </div>

        <!-- STAT GRID -->
        <div class="grid grid-cols-2 gap-2">
          <div class="rounded-lg p-2" style="background: #3A6A2A">
            <p class="text-xs uppercase tracking-wide" style="color: #8AC870">Last watered</p>
            <p class="text-sm font-bold" style="color: #F0C040">5 days ago</p>
          </div>
          <div class="rounded-lg p-2" style="background: #3A6A2A">
            <p class="text-xs uppercase tracking-wide" style="color: #8AC870">Next water</p>
            <p class="text-sm font-bold" style="color: #E87070">Today!</p>
          </div>
        </div>

        <!-- HEALTH BARS -->
        <div class="flex flex-col gap-2">
          <p class="text-xs uppercase tracking-wide" style="color: #8AC870">Plant health</p>
          <div class="flex items-center gap-2">
            <span class="text-sm">💧</span>
            <div class="flex-1 rounded-full h-2" style="background: #3A6A2A">
              <div class="h-2 rounded-full" style="width:15%; background: #5AA8D4"></div>
            </div>
            <span class="text-xs w-8 text-right" style="color: #C8E8A0">15%</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-sm">☀️</span>
            <div class="flex-1 rounded-full h-2" style="background: #3A6A2A">
              <div class="h-2 rounded-full" style="width:90%; background: #F0C040"></div>
            </div>
            <span class="text-xs w-8 text-right" style="color: #C8E8A0">90%</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-sm">❤️</span>
            <div class="flex-1 rounded-full h-2" style="background: #3A6A2A">
              <div class="h-2 rounded-full" style="width:70%; background: #E87EA0"></div>
            </div>
            <span class="text-xs w-8 text-right" style="color: #C8E8A0">70%</span>
          </div>
        </div>

        <!-- LAST SCAN -->
        <p class="text-xs font-bold uppercase tracking-wide" style="color: #8AC870">
          last scan: 7/10 · 2 days ago
        </p>

        <!-- UPLOAD BUTTON -->
        <button class="text-xs font-bold uppercase tracking-widest rounded-lg py-2 w-full cursor-pointer" style="background: #F0C040; color: #8B5E2A">
          📷 upload photo for scan
        </button>

        <!-- CHAT TOGGLE BUTTON -->
        <button @click="chatOpen = !chatOpen"
          class="text-xs font-bold uppercase tracking-widest rounded-lg py-2 w-full cursor-pointer" style="background: #E87EA0; color: white">
          🐛 ask wormy
        </button>

        <!-- CHAT PANEL -->
        <div v-if="chatOpen" class="flex flex-col gap-2">
          <div class="rounded-lg p-3 flex flex-col gap-2 h-48 overflow-y-auto" style="background: #3A6A2A">
            <div v-for="(msg, index) in chatMessages" :key="index"
              :class="msg.role === 'user' ? 'text-right' : 'text-left'">
              <span :style="msg.role === 'user'
                ? 'background:#F0C040; color:#8B5E2A; font-size:11px; padding:4px 8px; border-radius:8px; display:inline-block; max-width:200px'
                : 'background:#5A8A48; color:#F5EED8; font-size:11px; padding:4px 8px; border-radius:8px; display:inline-block; max-width:200px'">
                {{ msg.content }}
              </span>
            </div>
            <div v-if="chatLoading" class="text-left">
              <span style="background:#5A8A48; color:#8AC870; font-size:11px; padding:4px 8px; border-radius:8px; display:inline-block">
                Wormy is thinking...
              </span>
            </div>
          </div>
          <div class="flex gap-2">
            <input v-model="chatInput"
              @keyup.enter="sendMessage"
              type="text"
              placeholder="Ask about your plant..."
              class="flex-1 px-3 py-2 text-xs rounded-lg" style="border: 1px solid #6AAE5A; background: #3A6A2A; color: #F5EED8" />
            <button @click="sendMessage"
              class="text-xs font-bold px-3 py-2 rounded-lg cursor-pointer" style="background: #F0C040; color: #8B5E2A">
              Send
            </button>
          </div>
        </div>
      </div>

      <!-- RIGHT: ROSTER LIST -->
      <div class="flex-1 flex flex-col" style="background: #F5EED8">
        <div class="px-4 py-2 grid grid-cols-3 text-xs font-bold uppercase tracking-widest border-b-2" style="background: #EDE5C5; color: #8B5E2A; border-color: #D4C8A0">
          <span>Plant</span>
          <span class="text-center">Status</span>
          <span class="text-right">Score</span>
        </div>
        <div v-for="plant in plants" :key="plant.id"
          @click="selected = plant"
          class="px-4 py-3 border-b grid grid-cols-3 items-center cursor-pointer"
          :style="{
            borderColor: '#D4C8A0',
            background: selected.id === plant.id ? '#E5F0D5' : 'transparent',
            borderLeft: selected.id === plant.id ? '4px solid #6AAE5A' : '4px solid transparent'
          }">
          <div class="flex items-center gap-3">
            <span class="text-2xl">{{ plant.emoji }}</span>
            <div>
              <p class="font-bold text-sm" style="color: #3A2A0A">{{ plant.name }}</p>
              <p class="text-xs" style="color: #8B6A3A">{{ plant.location }}</p>
            </div>
          </div>
          <div class="flex justify-center">
            <span class="text-xs font-bold px-2 py-1 rounded-full uppercase text-white"
              :style="{ background: statusBg(plant.status) }">
              {{ plant.status }}
            </span>
          </div>
          <p class="text-right font-bold" style="color: #3A2A0A">{{ plant.score }}/10</p>
        </div>

        <div @click="showForm = true"
          class="mt-auto p-4 text-center text-xs font-bold uppercase tracking-widest border-t-2 border-dashed cursor-pointer"
          style="border-color: #D4C8A0; color: #8B6A3A; background: #EDE5C5">
          + add a plant
        </div>

        <!-- ADD PLANT FORM -->
        <div v-if="showForm" class="p-4 border-t-2" style="background: #EDE5C5; border-color: #D4C8A0">
          <p class="text-xs font-bold uppercase tracking-widest mb-3" style="color: #8B5E2A">New plant</p>
          <input v-model="newName" type="text" placeholder="Name (e.g. Basil)"
            class="w-full mb-2 px-3 py-2 text-sm rounded-lg border" style="border-color: #D4C8A0; background: white; color: #3A2A0A" />
          <input v-model="newSpecies" type="text" placeholder="Species (e.g. Ocimum basilicum)"
            class="w-full mb-2 px-3 py-2 text-sm rounded-lg border" style="border-color: #D4C8A0; background: white; color: #3A2A0A" />
          <input v-model="newLocation" type="text" placeholder="Location (e.g. Herb · patio)"
            class="w-full mb-3 px-3 py-2 text-sm rounded-lg border" style="border-color: #D4C8A0; background: white; color: #3A2A0A" />
          <div class="flex gap-2">
            <button @click="addPlant"
              class="flex-1 text-xs font-bold uppercase py-2 rounded-lg cursor-pointer" style="background: #6AAE5A; color: white">
              Save
            </button>
            <button @click="showForm = false"
              class="flex-1 text-xs font-bold uppercase py-2 rounded-lg cursor-pointer" style="background: #D4C8A0; color: #8B5E2A">
              Cancel
            </button>
          </div>
        </div>

      </div>

    </div>
  </div>
</template>