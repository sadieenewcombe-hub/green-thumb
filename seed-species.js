import https from 'https'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ngvfvyauawahfhkuwgoh.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ndmZ2eWF1YXdhaGZoa3V3Z29oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5NTExNDIsImV4cCI6MjA5NDUyNzE0Mn0.nTJOrp4JwhwpcsbEVXenbOK7vyAubUE1uDzvfUoGt_g'
const perenualKey = 'sk-9Uoy6a0bb72a5ecd117410'

const supabase = createClient(supabaseUrl, supabaseKey)

const fetchPage = (page) => {
  return new Promise((resolve, reject) => {
    const url = `https://perenual.com/api/species-list?key=${perenualKey}&page=${page}`
    https.get(url, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => resolve(JSON.parse(data)))
    }).on('error', reject)
  })
}

const seedSpecies = async () => {
  let page = 1
  let totalInserted = 0

  while (page <= 13) {
    console.log(`Fetching page ${page}...`)
    const data = await fetchPage(page)

    if (!data.data || data.data.length === 0) {
      console.log('No more data')
      break
    }

    const rows = data.data.map(plant => ({
      common_name: plant.common_name || null,
      scientific_name: plant.scientific_name?.[0] || null,
      sunlight: plant.sunlight?.[0] || null,
      care_level: plant.care_level || null,
      description: plant.description || null,
      image_url: plant.default_image?.medium_url || null,
      water_frequency_days: plant.watering === 'Frequent' ? 2 :
                            plant.watering === 'Average' ? 4 :
                            plant.watering === 'Minimum' ? 7 : null
    }))

    const { error } = await supabase.from('species').insert(rows)
    if (error) {
      console.error('Insert error:', error)
    } else {
      totalInserted += rows.length
      console.log(`Page ${page} done — ${rows.length} plants inserted. Total: ${totalInserted}`)
    }

    page++
    await new Promise(r => setTimeout(r, 500))
  }

  console.log(`Seed complete! Total inserted: ${totalInserted}`)
}

seedSpecies()