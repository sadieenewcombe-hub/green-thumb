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
      <span v-if="weather">☀️ {{ weather.temperature_2m }}°F today</span>
      <span v-if="weather">💧 {{ weather.relative_humidity_2m }}% humidity</span>
      <span v-if="weather">🌧 precipitation: {{ weather.precipitation }}mm</span>
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
        <!-- CHAT TOGGLE BUTTON -->
        <button @click="chatOpen = !chatOpen"
          class="bg-green-900 text-green-300 text-xs font-bold uppercase tracking-widest rounded-lg py-2 w-full cursor-pointer hover:bg-green-800">
          🐛 ask wormy
        </button>

        <!-- CHAT PANEL -->
        <div v-if="chatOpen" class="flex flex-col gap-2">
          <div class="bg-green-900 rounded-lg p-3 flex flex-col gap-2 h-48 overflow-y-auto">
            <div v-for="(msg, index) in chatMessages" :key="index"
              :class="msg.role === 'user' ? 'text-right' : 'text-left'">
              <span
                :class="msg.role === 'user'
                  ? 'bg-yellow-400 text-green-900 text-xs px-2 py-1 rounded-lg inline-block max-w-xs'
                  : 'bg-green-700 text-green-100 text-xs px-2 py-1 rounded-lg inline-block max-w-xs'">
                {{ msg.content }}
              </span>
            </div>
            <div v-if="chatLoading" class="text-left">
              <span class="bg-green-700 text-green-400 text-xs px-2 py-1 rounded-lg inline-block">
                Wormy is thinking...
              </span>
            </div>
          </div>
          <div class="flex gap-2">
            <input v-model="chatInput"
              @keyup.enter="sendMessage"
              type="text"
              placeholder="Ask about your plant..."
              class="flex-1 px-3 py-2 text-xs border border-green-600 rounded-lg bg-green-900 text-green-100" />
            <button @click="sendMessage"
              class="bg-yellow-400 text-green-900 text-xs font-bold px-3 py-2 rounded-lg cursor-pointer hover:bg-yellow-300">
              Send
            </button>
          </div>
        </div>
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

        <div @click="showForm = true"
          class="mt-auto p-4 text-center text-xs font-bold text-amber-600 uppercase tracking-widest border-t-2 border-dashed border-amber-300 bg-amber-100 cursor-pointer hover:bg-amber-200">
          + add a plant
        </div>

        <!-- ADD PLANT FORM -->
        <div v-if="showForm" class="p-4 bg-amber-100 border-t-2 border-amber-200">
          <p class="text-xs font-bold text-amber-800 uppercase tracking-widest mb-3">New plant</p>
          <input v-model="newName" type="text" placeholder="Name (e.g. Basil)"
            class="w-full mb-2 px-3 py-2 text-sm border border-amber-300 rounded-lg bg-white text-amber-900" />
          <input v-model="newSpecies" type="text" placeholder="Species (e.g. Ocimum basilicum)"
            class="w-full mb-2 px-3 py-2 text-sm border border-amber-300 rounded-lg bg-white text-amber-900" />
          <input v-model="newLocation" type="text" placeholder="Location (e.g. Herb · patio)"
            class="w-full mb-3 px-3 py-2 text-sm border border-amber-300 rounded-lg bg-white text-amber-900" />
          <div class="flex gap-2">
            <button @click="addPlant"
              class="flex-1 bg-green-700 text-green-100 text-xs font-bold uppercase py-2 rounded-lg cursor-pointer hover:bg-green-600">
              Save
            </button>
            <button @click="showForm = false"
              class="flex-1 bg-amber-200 text-amber-800 text-xs font-bold uppercase py-2 rounded-lg cursor-pointer hover:bg-amber-300">
              Cancel
            </button>
          </div>
        </div>

      </div>

    </div>
  </div>
</template>