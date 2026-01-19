import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageUri } = await req.json();

    if (!imageUri) {
      return new Response(
        JSON.stringify({ error: 'imageUri is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiApiKey = Deno.env.get('ONSPACE_AI_API_KEY')!;
    const aiBaseUrl = Deno.env.get('ONSPACE_AI_BASE_URL')!;

    // Call OnSpace AI for image analysis
    const aiResponse = await fetch(`${aiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${aiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analyze this image and provide: 1) A brief caption (1-2 sentences), 2) Detected objects/people/places as JSON array of strings. Format: {"caption": "...", "tags": ["tag1", "tag2"]}'
              },
              {
                type: 'image_url',
                image_url: { url: imageUri }
              }
            ]
          }
        ],
        temperature: 0.3,
        max_tokens: 300,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API Error:', errorText);
      return new Response(
        JSON.stringify({ error: `AI service error: ${errorText}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices[0]?.message?.content || '{}';
    
    // Try to parse JSON response
    let result;
    try {
      result = JSON.parse(content);
    } catch {
      // Fallback if AI doesn't return valid JSON
      result = {
        caption: content,
        tags: []
      };
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
