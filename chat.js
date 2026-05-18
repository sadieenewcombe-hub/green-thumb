export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { messages, plantName, plantSpecies, plantLocation } = req.body

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1024,
        system: `You are a helpful plant care assistant called Wormy. The user is currently viewing their plant: ${plantName} (${plantSpecies}), located at ${plantLocation}. Give specific, practical advice.`,
        messages
      })
    })

    const data = await response.json()
    res.status(200).json(data)
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch from Anthropic' })
  }
}