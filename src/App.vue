<script setup>
import { ref, onMounted, computed } from 'vue'
import { supabase } from './supabase'

const plants = ref([])
const selected = ref(null)
const weather = ref(null)
const currentView = ref('roster')
const modalOpen = ref(false)
const showForm = ref(false)
const scanLoading = ref(false)
const scanResult = ref(null)
const photoPreview = ref(null)
const fileInput = ref(null)

const newName = ref('')
const newSpecies = ref('')
const newLocation = ref('')
const newEmoji = ref('🌱')
const newPlantType = ref('herb')
const speciesSearch = ref('')
const speciesSuggestions = ref([])
const showSuggestions = ref(false)
const selectedSpeciesData = ref(null)

const chatOpen = ref(false)
const chatMessages = ref([
  { role: 'assistant', content: "Hey! I'm Wormy 🐛 Ask me anything about your plants!" }
])
const chatInput = ref('')
const chatLoading = ref(false)

const plantTypes = {
  herb:      { label: 'Herb',      color: '#5F7A3A' },
  flower:    { label: 'Flower',    color: '#C4622D' },
  tree:      { label: 'Tree',      color: '#5F3924' },
  succulent: { label: 'Succulent', color: '#628A81' },
  vegetable: { label: 'Vegetable', color: '#8E2605' },
  vine:      { label: 'Vine',      color: '#3D6B2A' },
}
const typeConfig = (type) => plantTypes[type] || plantTypes.herb

const wormyImage = computed(() => {
  const statuses = plants.value.map(p => computedStatus(p))
  const neglected = statuses.filter(s => s === 'neglected').length
  const thirsty = statuses.filter(s => s === 'thirsty').length
  if (neglected > 0) return '/wormy-worried.png'
  if (thirsty > 1) return '/wormy-thinking.png'
  if (thirsty === 0 && plants.value.length > 0) return '/wormy-happy.png'
  return '/wormy.png'
})

const wormyMessage = computed(() => {
  const thirsty = plants.value.filter(p => computedStatus(p) === 'thirsty')
  const neglected = plants.value.filter(p => computedStatus(p) === 'neglected')
  if (neglected.length > 0) return `${neglected[0].name} needs attention! 😢`
  if (thirsty.length === 0) return 'all plants are happy! 🌱'
  if (thirsty.length === 1) return `${thirsty[0].name} is thirsty! 💧`
  return `${thirsty.length} plants need water! 💧`
})

onMounted(async () => {
  const { data, error } = await supabase.from('plants').select('*').order('id')
  if (!error) {
    plants.value = data
    selected.value = data[0] || null
  }
})

const fetchWeather = async () => {
  const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=38.9072&longitude=-77.0369&current=temperature_2m,relative_humidity_2m,precipitation&temperature_unit=fahrenheit')
  const data = await res.json()
  weather.value = data.current
}
fetchWeather()

const waterHealth = (plant) => {
  if (!plant.last_watered || !plant.water_frequency_days) return 50
  const [y, m, d] = plant.last_watered.split('-').map(Number)
  const last = new Date(y, m - 1, d)
  const today = new Date(); today.setHours(0,0,0,0)
  const days = Math.floor((today - last) / 86400000)
  return Math.max(0, Math.round((1 - days / plant.water_frequency_days) * 100))
}

const computedStatus = (plant) => {
  if (!plant.last_watered) return 'neglected'
  const [y, m, d] = plant.last_watered.split('-').map(Number)
  const last = new Date(y, m - 1, d)
  const today = new Date(); today.setHours(0,0,0,0)
  const daysSince = Math.floor((today - last) / 86400000)
  const temp = weather.value?.temperature_2m
  if (daysSince > 30) return 'neglected'
  if (temp && temp < 40) return 'cold'
  if (temp && temp > 90) return 'hot'
  if (daysSince > 14) return 'hungry'
  const wh = waterHealth(plant)
  if (wh < 30) return 'thirsty'
  if (wh > 70) return 'happy'
  return 'good'
}

const statusConfig = {
  happy:    { color: '#5F7A3A', label: 'Happy 😊' },
  thirsty:  { color: '#628A81', label: 'Thirsty 💧' },
  neglected:{ color: '#8E2605', label: 'Neglected 😢' },
  cold:     { color: '#2980B9', label: 'Cold 🥶' },
  hot:      { color: '#C4622D', label: 'Hot 🥵' },
  hungry:   { color: '#C4622D', label: 'Hungry 🌱' },
  good:     { color: '#5F7A3A', label: 'Good ✅' },
}
const getStatusColor = (s) => statusConfig[s]?.color || '#5F7A3A'
const getStatusLabel = (s) => statusConfig[s]?.label || s
const hpHearts = (score) => score ? Math.round((score / 100) * 5) : 0

const selectPlant = (plant) => {
  selected.value = plant
  scanResult.value = null
  photoPreview.value = null
}

const logWatering = async () => {
  const today = new Date().toISOString().split('T')[0]
  await supabase.from('care_events').insert([{ plant_id: selected.value.id, type: 'watering', date: today }])
  await supabase.from('plants').update({ last_watered: today }).eq('id', selected.value.id)
  selected.value.last_watered = today
  const plant = plants.value.find(p => p.id === selected.value.id)
  if (plant) plant.last_watered = today
}

const addPlant = async () => {
  const { data, error } = await supabase.from('plants').insert([{
    name: newName.value,
    species: newSpecies.value,
    location: newLocation.value,
    status: 'good',
    score: null,
    emoji: newEmoji.value || '🌱',
    plant_type: selectedSpeciesData.value?.plant_type || newPlantType.value,
    water_frequency_days: selectedSpeciesData.value?.water_frequency_days || null,
    sunlight: selectedSpeciesData.value?.sunlight || null
  }]).select()
  if (!error) {
    plants.value.push(data[0])
    newName.value = ''; newSpecies.value = ''; newLocation.value = ''
    newEmoji.value = '🌱'; newPlantType.value = 'herb'
    speciesSearch.value = ''; selectedSpeciesData.value = null
    showForm.value = false
  }
}

const searchSpecies = async (query) => {
  if (query.length < 2) { speciesSuggestions.value = []; showSuggestions.value = false; return }
  const { data, error } = await supabase.from('species').select('*').ilike('common_name', `%${query}%`).limit(5)
  if (!error) { speciesSuggestions.value = data; showSuggestions.value = data.length > 0 }
}

const selectSpecies = (species) => {
  newName.value = species.common_name
  newSpecies.value = species.scientific_name || ''
  speciesSearch.value = species.common_name
  showSuggestions.value = false
  selectedSpeciesData.value = species
  newPlantType.value = species.plant_type || 'herb'
}

const handlePhotoSelect = (event) => {
  const file = event.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (e) => { photoPreview.value = e.target.result }
  reader.readAsDataURL(file)
}

const scanPlant = async () => {
  if (!photoPreview.value || !selected.value) return
  scanLoading.value = true; scanResult.value = null
  try {
    const [header, imageBase64] = photoPreview.value.split(',')
    const mediaType = header.match(/:(.*?);/)[1]
    const fileName = `${selected.value.id}-${Date.now()}.jpg`
    const byteString = atob(imageBase64)
    const byteArray = new Uint8Array(byteString.length)
    for (let i = 0; i < byteString.length; i++) byteArray[i] = byteString.charCodeAt(i)
    const blob = new Blob([byteArray], { type: mediaType })
    const { error: uploadError } = await supabase.storage.from('plant-photos').upload(fileName, blob, { upsert: true })
    if (uploadError) throw uploadError
    const { data: { publicUrl } } = supabase.storage.from('plant-photos').getPublicUrl(fileName)
    const response = await fetch('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64, mediaType, plantName: selected.value.name, plantSpecies: selected.value.species, plantLocation: selected.value.location, sunlight: selected.value.sunlight, waterFrequency: selected.value.water_frequency_days })
    })
    const result = await response.json()
    scanResult.value = result
    await supabase.from('scan_photos').insert({ plant_id: selected.value.id, photo_url: publicUrl, score: result.score, diagnosis: result.summary })
    await supabase.from('plants').update({ photo_url: publicUrl, score: result.score }).eq('id', selected.value.id)
    const plantIndex = plants.value.findIndex(p => p.id === selected.value.id)
    if (plantIndex !== -1) {
      plants.value[plantIndex] = { ...plants.value[plantIndex], photo_url: publicUrl, score: result.score }
      selected.value = plants.value[plantIndex]
    }
  } catch (error) {
    console.error('Scan error:', error)
    scanResult.value = { summary: 'Something went wrong. Try again!', score: null, issues: [], advice: '' }
  } finally { scanLoading.value = false }
}

const sendMessage = async () => {
  if (!chatInput.value.trim()) return
  const userMessage = chatInput.value
  chatMessages.value.push({ role: 'user', content: userMessage })
  chatInput.value = ''; chatLoading.value = true
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: chatMessages.value.filter(m => m.role === 'user' || m.role === 'assistant'), plantName: selected.value?.name, plantSpecies: selected.value?.species, plantLocation: selected.value?.location })
    })
    const data = await response.json()
    chatMessages.value.push({ role: 'assistant', content: data.content[0].text })
  } catch { chatMessages.value.push({ role: 'assistant', content: 'Sorry, something went wrong!' }) }
  finally { chatLoading.value = false }
}

const navigateGarden = (direction) => {
  if (!selected.value) return
  const cols = 4
  const idx = plants.value.findIndex(p => p.id === selected.value.id)
  if (idx === -1) return
  let next = idx
  if (direction === 'east'  && (idx + 1) % cols !== 0 && idx + 1 < plants.value.length) next = idx + 1
  if (direction === 'west'  && idx % cols !== 0) next = idx - 1
  if (direction === 'south' && idx + cols < plants.value.length) next = idx + cols
  if (direction === 'north' && idx - cols >= 0) next = idx - cols
  if (next !== idx) selected.value = plants.value[next]
}

const timeAgo = (dateStr) => {
  if (!dateStr) return 'never'
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const today = new Date(); today.setHours(0,0,0,0)
  const days = Math.floor((today - date) / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days} days ago`
}
</script>

<template>
  <div class="gt-app" style="font-family: 'Rumpelstiltskin', cursive;">

    <!-- FIXED BACKGROUND -->
    <div class="gt-bg"></div>

    <!-- SKY ZONE — scrolls with page -->
    <div class="gt-sky-zone">
      <!-- Weather cloud top-left -->
      <div class="gt-cloud gt-cloud-tl">
        <span class="cloud-icon">{{ weather && weather.temperature_2m >= 90 ? '🌡️' : weather && weather.temperature_2m <= 32 ? '🌨️' : '☀️' }}</span>
        <span class="cloud-text">{{ weather ? weather.temperature_2m + '°F' : '...' }}</span>
      </div>

      <!-- Weather cloud bottom-left -->
      <div class="gt-cloud gt-cloud-bl">
        <span class="cloud-icon">{{ weather && weather.precipitation > 0 ? '🌧️' : weather && weather.relative_humidity_2m > 80 ? '☁️' : '🌤️' }}</span>
        <span class="cloud-text">{{ weather ? (weather.precipitation > 0 ? weather.precipitation + 'mm rain' : weather.relative_humidity_2m > 80 ? 'Cloudy' : 'Clear') : '...' }}</span>
      </div>

      <!-- Logo center -->
      <div class="gt-logo">
        <h1 class="gt-logo-text">the Green Thumb</h1>
        <p class="gt-logo-sub">my garden</p>
      </div>

      <!-- Roster cloud top-right -->
      <div class="gt-cloud gt-cloud-tr gt-cloud-btn" :class="{ active: currentView === 'roster' }" @click="currentView = 'roster'">
        <span class="cloud-text cloud-btn-text">Roster</span>
      </div>

      <!-- Garden cloud bottom-right -->
      <div class="gt-cloud gt-cloud-br gt-cloud-btn" :class="{ active: currentView === 'garden' }" @click="currentView = 'garden'">
        <span class="cloud-text cloud-btn-text">Garden</span>
      </div>
    </div>

    <!-- WORMY at grass line — scrolls with page -->
    <div class="gt-wormy-zone">
      <div class="gt-wormy" @click="chatOpen = !chatOpen">
        <div class="gt-wormy-bubble">{{ wormyMessage }}</div>
        <img :src="wormyImage" class="gt-wormy-img" alt="Wormy" />
      </div>
    </div>

    <!-- SOIL CONTENT -->
    <div class="gt-content">

      <!-- ROSTER VIEW -->
      <div v-if="currentView === 'roster'" class="gt-roster-layout">

        <!-- LEFT: PROFILE CARD -->
        <div v-if="selected" class="gt-profile-card">
          <div class="card-band" :style="{ background: typeConfig(selected.plant_type).color }">
            <span class="band-label">{{ typeConfig(selected.plant_type).label }}</span>
            <span class="band-id">#{{ String(selected.id).padStart(3, '0') }}</span>
          </div>
          <div class="card-art">
            <img v-if="selected.photo_url" :src="selected.photo_url" class="card-photo" />
            <span v-else class="card-emoji">{{ selected.emoji }}</span>
          </div>
          <div class="card-name-block">
            <h2 class="card-name">{{ selected.name }}</h2>
            <p class="card-scientific">{{ selected.species }}</p>
            <p class="card-meta">📍 {{ selected.location }} &nbsp;·&nbsp; ☀️ {{ selected.sunlight || '?' }}</p>
          </div>
          <div class="card-hp">
            <span class="hp-label">HP</span>
            <span v-for="i in 5" :key="i" class="hp-heart" :class="{ filled: i <= hpHearts(selected.score) }">♥</span>
          </div>
          <div class="card-stats">
            <div class="stat-row">
              <span class="stat-icon">💧</span>
              <div class="stat-track"><div class="stat-fill water" :style="{ width: waterHealth(selected) + '%' }"></div></div>
              <span class="stat-pct">{{ waterHealth(selected) }}%</span>
            </div>
            <div class="stat-row">
              <span class="stat-icon">☀️</span>
              <div class="stat-track"><div class="stat-fill sun" style="width:90%"></div></div>
              <span class="stat-pct">90%</span>
            </div>
            <div class="stat-row">
              <span class="stat-icon">♥</span>
              <div class="stat-track"><div class="stat-fill heart" style="width:70%"></div></div>
              <span class="stat-pct">70%</span>
            </div>
          </div>
          <div class="card-info">
            <div class="info-cell">
              <span class="info-label">Last watered</span>
              <span class="info-val">{{ timeAgo(selected.last_watered) }}</span>
            </div>
            <div class="info-cell">
              <span class="info-label">Water every</span>
              <span class="info-val" style="color: #628A81;">{{ selected.water_frequency_days ? selected.water_frequency_days + 'd' : '—' }}</span>
            </div>
            <div class="info-cell">
              <span class="info-label">Last scan</span>
              <span class="info-val">{{ selected.score ? selected.score + '/100' : 'never' }}</span>
            </div>
            <div class="info-cell">
              <span class="info-label">Status</span>
              <span class="info-val" :style="{ color: getStatusColor(computedStatus(selected)) }">{{ getStatusLabel(computedStatus(selected)) }}</span>
            </div>
          </div>
          <div class="card-actions">
            <button class="card-btn water" @click="logWatering">💧 Log Watering</button>
            <input ref="fileInput" type="file" accept="image/*" style="display:none" @change="handlePhotoSelect" />
            <div v-if="photoPreview" class="photo-preview"><img :src="photoPreview" /></div>
            <button class="card-btn scan" @click="photoPreview ? scanPlant() : fileInput.click()" :disabled="scanLoading">
              <span v-if="scanLoading">🔍 Scanning...</span>
              <span v-else-if="photoPreview">🔍 Scan This Photo</span>
              <span v-else>📷 Upload for Scan</span>
            </button>
            <button class="card-btn wormy" @click="chatOpen = !chatOpen">🐛 Ask Wormy</button>
          </div>
          <div v-if="scanResult" class="scan-result">
            <div class="scan-header">
              <span style="font-size:1.3rem">{{ scanResult.emoji }}</span>
              <span class="scan-score">{{ scanResult.score }}/100</span>
            </div>
            <p class="scan-summary">{{ scanResult.summary }}</p>
            <ul class="scan-issues">
              <li v-for="issue in scanResult.issues" :key="issue">⚠️ {{ issue }}</li>
            </ul>
            <p class="scan-advice">💡 {{ scanResult.advice }}</p>
            <p class="scan-fun">🌿 {{ scanResult.extraFun }}</p>
          </div>
        </div>

        <!-- RIGHT: ROSTER LIST -->
        <div class="gt-roster-list">
          <div class="roster-header">
            <span>Plant</span>
            <span>Status</span>
            <span>Score</span>
            <span>Location</span>
            <span>Updated</span>
          </div>
          <div v-for="plant in plants" :key="plant.id"
            class="roster-row"
            :class="{ selected: selected?.id === plant.id }"
            @click="selectPlant(plant)">
            <div class="row-plant">
              <span class="row-emoji">{{ plant.emoji }}</span>
              <div>
                <p class="row-name">{{ plant.name }}</p>
                <p class="row-species">{{ plant.species }}</p>
              </div>
            </div>
            <div>
              <span class="row-status" :style="{ background: getStatusColor(computedStatus(plant)) }">
                {{ getStatusLabel(computedStatus(plant)) }}
              </span>
            </div>
            <span class="row-score">{{ plant.score || '—' }}</span>
            <span class="row-location">{{ plant.location }}</span>
            <span class="row-updated">{{ timeAgo(plant.last_watered) }}</span>
          </div>
          <div class="roster-add" @click="showForm = !showForm">+ add a plant</div>
          <div v-if="showForm" class="add-form">
            <p class="form-title">New Plant</p>
            <div style="position:relative; margin-bottom:10px;">
              <input v-model="speciesSearch" @input="searchSpecies(speciesSearch)" type="text" placeholder="Search species..." class="form-input" />
              <div v-if="showSuggestions" class="suggestions">
                <div v-for="s in speciesSuggestions" :key="s.id" @click="selectSpecies(s)" class="suggestion-item">
                  <p style="font-weight:bold;">{{ s.common_name }}</p>
                  <p style="color:#FDC018; font-size:0.75rem;">{{ s.scientific_name }}</p>
                </div>
              </div>
            </div>
            <div style="display:grid; grid-template-columns:70px 1fr; gap:10px; margin-bottom:10px;">
              <input v-model="newEmoji" type="text" placeholder="🌱" maxlength="2" class="form-input" style="text-align:center; font-size:1.4rem; padding:8px;" />
              <select v-model="newPlantType" class="form-input">
                <option v-for="(cfg, key) in plantTypes" :key="key" :value="key">{{ cfg.label }}</option>
              </select>
            </div>
            <input v-model="newName" type="text" placeholder="Name" class="form-input" style="margin-bottom:10px;" />
            <input v-model="newSpecies" type="text" placeholder="Species" class="form-input" style="margin-bottom:10px;" />
            <input v-model="newLocation" type="text" placeholder="Location" class="form-input" style="margin-bottom:14px;" />
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
              <button @click="addPlant" class="form-btn save">Save</button>
              <button @click="showForm = false" class="form-btn cancel">Cancel</button>
            </div>
          </div>
        </div>
      </div>

      <!-- GARDEN VIEW -->
      <div v-if="currentView === 'garden'" class="gt-garden-layout">
        <div class="garden-toolbar">
          <button class="rock-btn" @click="showForm = !showForm">+ Add Plant</button>
          <button class="rock-btn">↕ Re-arrange</button>
        </div>
        <div class="garden-grid">
          <div v-for="plant in plants" :key="plant.id"
            class="garden-pot"
            :class="{ 'pot-active': selected?.id === plant.id }"
            @click="selected = plant; modalOpen = true">
            <div class="pot-art">
              <span class="pot-emoji">{{ plant.emoji }}</span>
              <span class="pot-base">🪴</span>
            </div>
            <p class="pot-name">{{ plant.name }}</p>
            <span class="pot-status" :style="{ background: getStatusColor(computedStatus(plant)) }">{{ getStatusLabel(computedStatus(plant)) }}</span>
            <div class="pot-bar-track"><div class="pot-bar-fill" :style="{ width: waterHealth(plant) + '%' }"></div></div>
            <div v-if="computedStatus(plant) !== 'happy' && computedStatus(plant) !== 'good'" class="pot-bubble">
              {{ getStatusLabel(computedStatus(plant)) }}
            </div>
          </div>
          <div v-for="n in Math.max(0, 8 - plants.length)" :key="'e'+n" class="garden-pot empty">
            <span style="color:#FDC018; font-size:1.5rem; opacity:0.4">+</span>
          </div>
        </div>
        <div v-if="showForm" class="add-form garden-add-form">
          <p class="form-title">New Plant</p>
          <div style="position:relative; margin-bottom:10px;">
            <input v-model="speciesSearch" @input="searchSpecies(speciesSearch)" type="text" placeholder="Search species..." class="form-input" />
            <div v-if="showSuggestions" class="suggestions">
              <div v-for="s in speciesSuggestions" :key="s.id" @click="selectSpecies(s)" class="suggestion-item">
                <p style="font-weight:bold;">{{ s.common_name }}</p>
                <p style="color:#FDC018; font-size:0.75rem;">{{ s.scientific_name }}</p>
              </div>
            </div>
          </div>
          <div style="display:grid; grid-template-columns:70px 1fr; gap:10px; margin-bottom:10px;">
            <input v-model="newEmoji" type="text" placeholder="🌱" maxlength="2" class="form-input" style="text-align:center; font-size:1.4rem; padding:8px;" />
            <select v-model="newPlantType" class="form-input">
              <option v-for="(cfg, key) in plantTypes" :key="key" :value="key">{{ cfg.label }}</option>
            </select>
          </div>
          <input v-model="newName" type="text" placeholder="Name" class="form-input" style="margin-bottom:10px;" />
          <input v-model="newSpecies" type="text" placeholder="Species" class="form-input" style="margin-bottom:10px;" />
          <input v-model="newLocation" type="text" placeholder="Location" class="form-input" style="margin-bottom:14px;" />
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
            <button @click="addPlant" class="form-btn save">Save</button>
            <button @click="showForm = false" class="form-btn cancel">Cancel</button>
          </div>
        </div>
      </div>
    </div>

    <!-- GARDEN PROFILE MODAL -->
    <div v-if="modalOpen && selected && currentView === 'garden'" class="modal-overlay" @click.self="modalOpen = false">
      <div class="modal-inner">
        <button class="modal-close" @click="modalOpen = false">✕ close</button>
        <div class="modal-nav">
          <button class="nav-btn" @click="navigateGarden('north')">↑</button>
          <div style="display:flex; align-items:center; gap:16px;">
            <button class="nav-btn" @click="navigateGarden('west')">←</button>
            <span class="nav-name">{{ selected.name }}</span>
            <button class="nav-btn" @click="navigateGarden('east')">→</button>
          </div>
          <button class="nav-btn" @click="navigateGarden('south')">↓</button>
        </div>
        <div class="gt-profile-card modal-card">
          <div class="card-band" :style="{ background: typeConfig(selected.plant_type).color }">
            <span class="band-label">{{ typeConfig(selected.plant_type).label }}</span>
            <span class="band-id">#{{ String(selected.id).padStart(3, '0') }}</span>
          </div>
          <div class="card-art">
            <img v-if="selected.photo_url" :src="selected.photo_url" class="card-photo" />
            <span v-else class="card-emoji">{{ selected.emoji }}</span>
          </div>
          <div class="card-name-block">
            <h2 class="card-name">{{ selected.name }}</h2>
            <p class="card-scientific">{{ selected.species }}</p>
            <p class="card-meta">📍 {{ selected.location }}</p>
          </div>
          <div class="card-hp">
            <span class="hp-label">HP</span>
            <span v-for="i in 5" :key="i" class="hp-heart" :class="{ filled: i <= hpHearts(selected.score) }">♥</span>
          </div>
          <div class="card-stats">
            <div class="stat-row">
              <span class="stat-icon">💧</span>
              <div class="stat-track"><div class="stat-fill water" :style="{ width: waterHealth(selected) + '%' }"></div></div>
              <span class="stat-pct">{{ waterHealth(selected) }}%</span>
            </div>
          </div>
          <div class="card-info">
            <div class="info-cell">
              <span class="info-label">Last watered</span>
              <span class="info-val">{{ timeAgo(selected.last_watered) }}</span>
            </div>
            <div class="info-cell">
              <span class="info-label">Last scan</span>
              <span class="info-val">{{ selected.score ? selected.score + '/100' : 'never' }}</span>
            </div>
          </div>
          <div class="card-actions">
            <button class="card-btn water" @click="logWatering">💧 Log Watering</button>
            <button class="card-btn wormy" @click="chatOpen = true; modalOpen = false; currentView = 'roster'">🐛 Ask Wormy</button>
          </div>
        </div>
      </div>
    </div>

    <!-- WORMY CHAT MODAL -->
    <div v-if="chatOpen" class="modal-overlay" @click.self="chatOpen = false">
      <div class="chat-modal">
        <div class="chat-header">
          <div style="display:flex; align-items:center; gap:12px;">
            <img :src="wormyImage" style="height:60px; width:auto;" />
            <span class="chat-title">Wormy</span>
          </div>
          <button class="modal-close" style="position:static;" @click="chatOpen = false">✕</button>
        </div>
        <div class="chat-messages">
          <div v-for="(msg, i) in chatMessages" :key="i" :class="['chat-msg', msg.role === 'user' ? 'user' : 'wormy']">
            {{ msg.content }}
          </div>
          <div v-if="chatLoading" class="chat-msg wormy">Wormy is thinking...</div>
        </div>
        <div class="chat-input-row">
          <input v-model="chatInput" @keyup.enter="sendMessage" type="text" placeholder="Ask about your plants..." class="chat-input" />
          <button @click="sendMessage" class="chat-send">Send</button>
        </div>
      </div>
    </div>

  </div>
</template>
