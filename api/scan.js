export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { imageBase64, mediaType, plantName, plantSpecies, plantLocation, sunlight, waterFrequency } = req.body

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType || 'image/jpeg',
                  data: imageBase64
                }
              },
              {
                type: 'text',
                text: `You are Wormy, a friendly and knowledgeable plant care assistant. Analyze this photo of ${plantName} (${plantSpecies}), located at ${plantLocation}. It prefers ${sunlight} light and is watered every ${waterFrequency} days.

When building the health score, systematically assess the following:
- Leaves: color, texture, spots, yellowing, wilting, pests
- Stems: firmness, color, any soft or mushy sections
- Soil: moisture level, mold, compaction, drainage
- Overall shape: symmetry, new growth, whether leaves are unfurling normally

Respond ONLY with a JSON object in this exact format, no markdown, no extra text:
{
  "score": <integer 1-100>,
  "summary": "<one friendly sentence about the plant's overall appearance>",
  "issues": ["<issue 1>", "<issue 2>"],
  "advice": "<one actionable care tip based on what you see>",
  "emoji": "<single emoji that best represents this plant's current mood>",
  "extraFun": "<a fun fact about plants, gardening, or horticulture, or a related quote>"
}`
              }
            ]
          }
        ]
      })
    })

    const anthropicData = await response.json()
    const text = anthropicData.content[0].text
    const result = JSON.parse(text)

    res.status(200).json(result)
  } catch (error) {
    console.error('Scan error:', error)
    res.status(500).json({ error: 'Scan failed' })
  }
}