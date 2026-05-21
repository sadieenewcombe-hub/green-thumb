<script setup>
import { ref, onMounted, computed } from 'vue'
import { supabase } from './supabase'

const scanLoading = ref(false)
const scanResult = ref(null)
const photoPreview = ref(null)
const fileInput = ref(null)
const plants = ref([])
const selected = ref(null)
const weather = ref(null)
const showForm = ref(false)
const newName = ref('')
const newSpecies = ref('')
const newLocation = ref('')
const speciesSearch = ref('')
const speciesSuggestions = ref([])
const showSuggestions = ref(false)
const selectedSpeciesData = ref(null)
const currentView = ref('roster')
const modalOpen = ref(false)
const wormyMessage = computed(() => {
  const thirsty = plants.value.filter(p => computedStatus(p) === 'water')
  if (thirsty.length === 0) return 'all plants are happy! 🌱'
  if (thirsty.length === 1) return `psst... ${thirsty[0].name} is thirsty! 💧`
  return `${thirsty.length} plants need water! 💧`
})
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
    .insert([{
      name: newName.value,
      species: newSpecies.value,
      location: newLocation.value,
      status: 'good',
      score: 8,
      emoji: '🌱',
      water_frequency_days: selectedSpeciesData.value?.water_frequency_days || null,
      sunlight: selectedSpeciesData.value?.sunlight || null
    }])
    .select()
  if (error) {
    console.error('Error adding plant:', error)
    return
  }
  plants.value.push(data[0])
  newName.value = ''
  newSpecies.value = ''
  newLocation.value = ''
  speciesSearch.value = ''
  selectedSpeciesData.value = null
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

const searchSpecies = async (query) => {
  if (query.length < 2) {
    speciesSuggestions.value = []
    showSuggestions.value = false
    return
  }
  const { data, error } = await supabase
    .from('species')
    .select('*')
    .ilike('common_name', `%${query}%`)
    .limit(5)
  if (!error) {
    speciesSuggestions.value = data
    showSuggestions.value = data.length > 0
  }
}

const selectSpecies = (species) => {
  newName.value = species.common_name
  newSpecies.value = species.scientific_name || ''
  speciesSearch.value = species.common_name
  showSuggestions.value = false
  selectedSpeciesData.value = species
}

const logWatering = async () => {
  const today = new Date().toISOString().split('T')[0]

  const { error: eventError } = await supabase
    .from('care_events')
    .insert([{
      plant_id: selected.value.id,
      type: 'watering',
      date: today
    }])

  if (eventError) {
    console.error('Error logging watering:', eventError)
    return
  }

  const { error: updateError } = await supabase
    .from('plants')
    .update({ last_watered: today })
    .eq('id', selected.value.id)

  if (updateError) {
    console.error('Error updating last watered:', updateError)
    return
  }

  selected.value.last_watered = today
  const plant = plants.value.find(p => p.id === selected.value.id)
  if (plant) plant.last_watered = today
}

const waterHealth = (plant) => {
  if (!plant.last_watered || !plant.water_frequency_days) return 50
  const [year, month, day] = plant.last_watered.split('-').map(Number)
  const lastWatered = new Date(year, month - 1, day)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const daysSince = Math.floor((today - lastWatered) / (1000 * 60 * 60 * 24))
  const percent = Math.max(0, Math.round((1 - daysSince / plant.water_frequency_days) * 100))
  return percent
}

const computedStatus = (plant) => {
  if (!plant.last_watered || !plant.water_frequency_days) return plant.status
  const health = waterHealth(plant)
  if (health === 0) return 'water'
  return 'good'
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

const handlePhotoSelect = (event) => {
  const file = event.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (e) => {
    photoPreview.value = e.target.result
  }
  reader.readAsDataURL(file)
}

const scanPlant = async () => {
  if (!photoPreview.value || !selected.value) return
  scanLoading.value = true
  scanResult.value = null
  try {
    const [header, imageBase64] = photoPreview.value.split(',')
    const mediaType = header.match(/:(.*?);/)[1]

    const fileName = `${selected.value.id}-${Date.now()}.jpg`
    const byteString = atob(imageBase64)
    const byteArray = new Uint8Array(byteString.length)
    for (let i = 0; i < byteString.length; i++) {
      byteArray[i] = byteString.charCodeAt(i)
    }
    const blob = new Blob([byteArray], { type: mediaType })

    const { error: uploadError } = await supabase.storage
      .from('plant-photos')
      .upload(fileName, blob, { upsert: true })
    if (uploadError) throw uploadError

    const { data: { publicUrl } } = supabase.storage
      .from('plant-photos')
      .getPublicUrl(fileName)

    const response = await fetch('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64,
        mediaType,
        plantName: selected.value.name,
        plantSpecies: selected.value.species,
        plantLocation: selected.value.location,
        sunlight: selected.value.sunlight,
        waterFrequency: selected.value.water_frequency_days
      })
    })

    const result = await response.json()
    scanResult.value = result

    await supabase.from('scan_photos').insert({
      plant_id: selected.value.id,
      photo_url: publicUrl,
      score: result.score,
      diagnosis: result.summary
    })

    const { data: allScans } = await supabase
      .from('scan_photos')
      .select('id, created_at')
      .eq('plant_id', selected.value.id)
      .order('created_at', { ascending: false })

    if (allScans && allScans.length > 3) {
      const toDelete = allScans.slice(3).map(s => s.id)
      await supabase.from('scan_photos').delete().in('id', toDelete)
    }

    await supabase.from('plants').update({
      photo_url: publicUrl,
      score: result.score
    }).eq('id', selected.value.id)

    const plantIndex = plants.value.findIndex(p => p.id === selected.value.id)
    if (plantIndex !== -1) {
      plants.value[plantIndex] = { ...plants.value[plantIndex], photo_url: publicUrl, score: result.score }
      selected.value = plants.value[plantIndex]
    }

  } catch (error) {
    console.error('Scan error:', error)
    scanResult.value = { summary: 'Something went wrong. Try again!', score: null, issues: [], advice: '' }
  } finally {
    scanLoading.value = false
  }
}

const timeAgo = (dateStr) => {
  if (!dateStr) return 'not logged'
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day) // local midnight, not UTC
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const days = Math.floor((today - date) / (1000 * 60 * 60 * 24))
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days} days ago`
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

      <!-- WORMY IN HEADER -->
      <div class="flex flex-col items-center">
        <div class="text-xs font-bold px-3 py-1 rounded-xl mb-1" style="background: #F5EED8; color: #8B5E2A">
          {{ wormyMessage }}
        </div>
        <div class="text-4xl" style="cursor: pointer" @click="chatOpen = !chatOpen">🐛</div>
      </div>

      <div class="flex gap-3">
        <button @click="currentView = 'roster'"
          class="text-xs font-bold px-4 py-2 rounded-full uppercase tracking-wide"
          :style="currentView === 'roster'
            ? 'background: #F0C040; color: #8B5E2A'
            : 'border: 2px solid #6AAE5A; color: #6AAE5A'">Roster</button>
        <button @click="currentView = 'garden'"
          class="text-xs font-bold px-4 py-2 rounded-full uppercase tracking-wide"
          :style="currentView === 'garden'
            ? 'background: #F0C040; color: #8B5E2A'
            : 'border: 2px solid #6AAE5A; color: #6AAE5A'">Garden</button>
      </div>
    </div>

    <!-- WEATHER STRIP -->
    <div class="px-4 py-2 flex items-center gap-6 text-xs font-bold" style="background: #6AAE5A; color: #F5EED8">
      <span v-if="weather">☀️ {{ weather.temperature_2m }}°F today</span>
      <span v-if="weather">💧 {{ weather.relative_humidity_2m }}% humidity</span>
      <span v-if="weather">🌧 precipitation: {{ weather.precipitation }}mm</span>
      <span class="ml-auto px-3 py-1 rounded-full text-xs text-white" style="background: #5AA8D4">❄️ frost fri — bring plants in!</span>
    </div>

    <!-- ROSTER VIEW -->
    <div v-if="currentView === 'roster'" class="flex flex-1">

      <!-- LEFT: PLANT DETAIL -->
      <div v-if="selected" class="w-80 p-4 flex flex-col gap-4" style="background: #5A8A48">

        <!-- EMOJI / PHOTO -->
        <div class="rounded-xl h-28 flex items-center justify-center overflow-hidden" style="background: #3A6A2A">
          <img v-if="selected.photo_url" :src="selected.photo_url" class="w-full h-full object-cover" />
          <span v-else class="text-6xl">{{ selected.emoji }}</span>
        </div>

        <!-- NAME + SPECIES + SUNLIGHT -->
        <div class="text-center">
          <h2 class="text-2xl font-bold" style="color: #F0C040">{{ selected.name }}</h2>
          <p class="text-xs uppercase tracking-widest mt-1" style="color: #C8E8A0">{{ selected.species }} · {{ selected.location }}</p>
          <p class="text-sm font-bold uppercase mt-2" style="color: #C8E8A0">☀️ {{ selected.sunlight || 'sunlight unknown' }}</p>
        </div>

        <!-- STAT GRID -->
        <div class="grid grid-cols-2 gap-2">
          <div class="rounded-lg p-2" style="background: #3A6A2A">
            <p class="text-xs uppercase tracking-wide" style="color: #8AC870">Last watered</p>
            <p class="text-sm font-bold" style="color: #F0C040">{{ timeAgo(selected.last_watered) }}</p>
          </div>
          <div class="rounded-lg p-2" style="background: #3A6A2A">
            <p class="text-xs uppercase tracking-wide" style="color: #8AC870">Water every</p>
            <p class="text-sm font-bold" style="color: #5AA8D4">{{ selected.water_frequency_days ? selected.water_frequency_days + ' days' : 'unknown' }}</p>
          </div>
        </div>

        <!-- HEALTH BARS -->
        <div class="flex flex-col gap-2">
          <p class="text-xs uppercase tracking-wide" style="color: #8AC870">Plant health</p>
          <div class="flex items-center gap-2">
            <span class="text-sm">💧</span>
            <div class="flex-1 rounded-full h-2" style="background: #3A6A2A">
              <div class="h-2 rounded-full" :style="{ width: waterHealth(selected) + '%', background: '#5AA8D4' }"></div>
            </div>
            <span class="text-xs w-8 text-right" style="color: #C8E8A0">{{ waterHealth(selected) }}%</span>
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
          last scan: {{ selected.score }}/10 · {{ timeAgo(selected.last_watered) }}
        </p>

        <!-- LOG WATERING BUTTON -->
        <button @click="logWatering"
          class="text-xs font-bold uppercase tracking-widest rounded-lg py-2 w-full cursor-pointer" style="background: #5AA8D4; color: white">
          💧 log watering
        </button>

        <!-- UPLOAD BUTTON -->
        <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="handlePhotoSelect" />
        <div v-if="photoPreview" class="rounded-xl overflow-hidden" style="height: 120px">
          <img :src="photoPreview" class="w-full h-full object-cover" />
        </div>
        <button
          @click="photoPreview ? scanPlant() : fileInput.click()"
          class="text-xs font-bold uppercase tracking-widest rounded-lg py-2 w-full cursor-pointer"
          :style="scanLoading ? 'background: #D4C8A0; color: #8B5E2A' : 'background: #F0C040; color: #8B5E2A'">
          <span v-if="scanLoading">🔍 scanning...</span>
          <span v-else-if="photoPreview">🔍 scan this photo</span>
          <span v-else>📷 upload photo for scan</span>
        </button>
        <div v-if="scanResult" class="rounded-xl p-3 flex flex-col gap-2" style="background: #3A6A2A">
          <div class="flex items-center justify-between">
            <span class="text-lg">{{ scanResult.emoji }}</span>
            <span class="text-xs font-bold px-2 py-1 rounded-full" style="background: #F0C040; color: #8B5E2A">
              {{ scanResult.score }}/100
            </span>
          </div>
          <p class="text-xs" style="color: #C8E8A0">{{ scanResult.summary }}</p>
          <ul v-if="scanResult.issues?.length" class="flex flex-col gap-1">
            <li v-for="issue in scanResult.issues" :key="issue"
              class="text-xs px-2 py-1 rounded" style="background: #2A5A1A; color: #F0C040">
              ⚠️ {{ issue }}
            </li>
          </ul>
          <p class="text-xs italic" style="color: #8AC870">💡 {{ scanResult.advice }}</p>
          <p class="text-xs mt-1 px-2 py-1 rounded" style="background: #2A5A1A; color: #C8E8A0">🌿 {{ scanResult.extraFun }}</p>
        </div>

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
              :style="{ background: statusBg(computedStatus(plant)) }">
              {{ computedStatus(plant) }}
            </span>
          </div>
          <p class="text-right font-bold" style="color: #3A2A0A">{{ plant.score }}/100</p>
        </div>

        <div @click="showForm = true"
          class="mt-auto p-4 text-center text-xs font-bold uppercase tracking-widest border-t-2 border-dashed cursor-pointer"
          style="border-color: #D4C8A0; color: #8B6A3A; background: #EDE5C5">
          + add a plant
        </div>

        <!-- ADD PLANT FORM -->
        <div v-if="showForm" class="p-4 border-t-2" style="background: #EDE5C5; border-color: #D4C8A0">
          <p class="text-xs font-bold uppercase tracking-widest mb-3" style="color: #8B5E2A">New plant</p>

          <div class="relative mb-2">
            <input
              v-model="speciesSearch"
              @input="searchSpecies(speciesSearch)"
              type="text"
              placeholder="Search for a plant..."
              class="w-full px-3 py-2 text-sm rounded-lg border" style="border-color: #D4C8A0; background: white; color: #3A2A0A" />
            <div v-if="showSuggestions"
              class="absolute w-full rounded-lg shadow-lg z-10 mt-1 overflow-hidden"
              style="background: white; border: 1px solid #D4C8A0">
              <div v-for="suggestion in speciesSuggestions" :key="suggestion.id"
                @click="selectSpecies(suggestion)"
                class="px-3 py-2 cursor-pointer text-sm hover:bg-amber-50"
                style="color: #3A2A0A; border-bottom: 1px solid #F5EED8">
                <p class="font-bold">{{ suggestion.common_name }}</p>
                <p class="text-xs" style="color: #8B6A3A">{{ suggestion.scientific_name }}</p>
              </div>
            </div>
          </div>

          <input v-model="newName" type="text" placeholder="Name"
            class="w-full mb-2 px-3 py-2 text-sm rounded-lg border" style="border-color: #D4C8A0; background: white; color: #3A2A0A" />
          <input v-model="newSpecies" type="text" placeholder="Species"
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

    <!-- GARDEN VIEW -->
    <div v-if="currentView === 'garden'" class="flex-1 p-6" style="background: #5A8A48">
      <div class="grid grid-cols-4 gap-4">
        <div v-for="plant in plants" :key="plant.id"
          @click="selected = plant; modalOpen = true"
          class="rounded-xl p-4 flex flex-col items-center gap-2 cursor-pointer hover:scale-105 transition-transform"
          style="background: #3A6A2A">
          <div class="text-5xl">{{ plant.emoji }}</div>
          <p class="text-sm font-bold text-center" style="color: #F0C040">{{ plant.name }}</p>
          <span class="text-xs font-bold px-2 py-1 rounded-full text-white"
            :style="{ background: statusBg(computedStatus(plant)) }">
              {{ computedStatus(plant) }}
          </span>
          <div class="w-full flex flex-col gap-1">
            <div class="w-full rounded-full h-1" style="background: #2A5A1A">
              <div class="h-1 rounded-full" :style="{ width: waterHealth(plant) + '%', background: '#5AA8D4' }"></div>
            </div>
            <div class="w-full rounded-full h-1" style="background: #2A5A1A">
              <div class="h-1 rounded-full" style="width:90%; background: #F0C040"></div>
            </div>
            <div class="w-full rounded-full h-1" style="background: #2A5A1A">
              <div class="h-1 rounded-full" style="width:70%; background: #E87EA0"></div>
            </div>
          </div>
        </div>

        <!-- EMPTY SLOTS -->
        <div v-for="n in Math.max(0, 8 - plants.length)" :key="'empty-' + n"
          class="rounded-xl p-4 flex items-center justify-center cursor-pointer"
          style="background: #3A6A2A; opacity: 0.4; min-height: 160px">
          <span style="color: #8AC870; font-size: 24px">+</span>
        </div>
      </div>
    </div>

    <!-- MODAL -->
    <div v-if="modalOpen && selected"
      class="fixed inset-0 flex items-center justify-center z-50"
      style="background: rgba(0,0,0,0.6)"
      @click.self="modalOpen = false">
      <div class="rounded-2xl p-6 flex flex-col gap-4 w-80" style="background: #5A8A48">
        <div class="flex justify-between items-start">
          <div class="text-5xl">{{ selected.emoji }}</div>
          <button @click="modalOpen = false" class="text-xs font-bold px-3 py-1 rounded-full" style="background: #3A6A2A; color: #8AC870">✕ close</button>
        </div>
        <div class="text-center">
          <h2 class="text-2xl font-bold" style="color: #F0C040">{{ selected.name }}</h2>
          <p class="text-xs uppercase tracking-widest mt-1" style="color: #C8E8A0">{{ selected.species }} · {{ selected.location }}</p>
          <p class="text-sm font-bold uppercase mt-2" style="color: #C8E8A0">☀️ {{ selected.sunlight || 'sunlight unknown' }}</p>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div class="rounded-lg p-2" style="background: #3A6A2A">
            <p class="text-xs uppercase tracking-wide" style="color: #8AC870">Last watered</p>
            <p class="text-sm font-bold" style="color: #F0C040">{{ timeAgo(selected.last_watered) }}</p>
          </div>
          <div class="rounded-lg p-2" style="background: #3A6A2A">
            <p class="text-xs uppercase tracking-wide" style="color: #8AC870">Water every</p>
            <p class="text-sm font-bold" style="color: #5AA8D4">{{ selected.water_frequency_days ? selected.water_frequency_days + ' days' : 'unknown' }}</p>
          </div>
        </div>
        <div class="flex flex-col gap-2">
          <p class="text-xs uppercase tracking-wide" style="color: #8AC870">Plant health</p>
          <div class="flex items-center gap-2">
            <span class="text-sm">💧</span>
            <div class="flex-1 rounded-full h-2" style="background: #3A6A2A">
              <div class="h-2 rounded-full" :style="{ width: waterHealth(selected) + '%', background: '#5AA8D4' }"></div>
            </div>
            <span class="text-xs w-8 text-right" style="color: #C8E8A0">{{ waterHealth(selected) }}%</span>
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
        <button class="text-xs font-bold uppercase tracking-widest rounded-lg py-2 w-full cursor-pointer"
          style="background: #E87EA0; color: white"
          @click="modalOpen = false; chatOpen = true; currentView = 'roster'">
          🐛 ask wormy
        </button>
      </div>
    </div>

  </div>
</template>