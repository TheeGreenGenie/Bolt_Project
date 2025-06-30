const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Replace with your actual Gemini API key
const GEMINI_API_KEY = 'AIzaSyB0CycYBxOYyDZ0FqtmcuVwRazbLllny40'; // Replace this with your actual key

app.get('/health', (req, res) => {
    res.json({ 
        status: 'Gemini AI Proxy Running!', 
        timestamp: new Date().toISOString(),
        aiProvider: 'Google Gemini',
        keyConfigured: !!GEMINI_API_KEY && GEMINI_API_KEY.startsWith('AIza')
    });
});

app.post('/api/chat', async (req, res) => {
    try {
        console.log('📡 Gemini AI request received');
        console.log('📡 Request messages:', req.body.messages?.length);
        
        if (!GEMINI_API_KEY || !GEMINI_API_KEY.startsWith('AIza')) {
            return res.status(500).json({ 
                error: 'Invalid Gemini API key configuration'
            });
        }
        
        // Extract the user's message and system prompt
        const messages = req.body.messages || [];
        const systemPrompt = req.body.system || 'You are a helpful AI assistant.';
        const userMessage = messages[messages.length - 1]?.content || '';
        
        // Build the prompt for Gemini
        let fullPrompt = systemPrompt + '\n\n';
        
        // Add conversation history
        messages.forEach(msg => {
            const role = msg.role === 'user' ? 'Human' : 'Assistant';
            fullPrompt += `${role}: ${msg.content}\n`;
        });
        
        fullPrompt += 'Assistant:';
        
        console.log('📡 Sending to Gemini API...');
        
        // Use the correct Gemini API endpoint
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: fullPrompt
                    }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    topP: 0.8,
                    topK: 40,
                    maxOutputTokens: 3000,
                    stopSequences: ["Human:", "User:"]
                },
                safetySettings: [
                    {
                        category: "HARM_CATEGORY_HARASSMENT",
                        threshold: "BLOCK_MEDIUM_AND_ABOVE"
                    },
                    {
                        category: "HARM_CATEGORY_HATE_SPEECH",
                        threshold: "BLOCK_MEDIUM_AND_ABOVE"
                    },
                    {
                        category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                        threshold: "BLOCK_MEDIUM_AND_ABOVE"
                    },
                    {
                        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                        threshold: "BLOCK_MEDIUM_AND_ABOVE"
                    }
                ]
            })
        });
        
        console.log('📡 Gemini API response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Gemini API Error:', errorText);
            return res.status(response.status).json({ 
                error: `Gemini API error: ${response.status}`,
                details: errorText 
            });
        }
        
        const data = await response.json();
        console.log('✅ Gemini API success');
        
        // Extract the AI response
        let aiResponse = '';
        if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
            aiResponse = data.candidates[0].content.parts[0].text;
            
            // Clean up the response (remove "Assistant:" prefix if present)
            aiResponse = aiResponse.replace(/^Assistant:\s*/i, '').trim();
        } else {
            console.error('❌ Unexpected Gemini response format:', data);
            throw new Error('Unexpected response format from Gemini');
        }
        
        // Return in Claude-compatible format for your frontend
        res.json({
            content: [
                {
                    text: aiResponse,
                    type: "text"
                }
            ],
            model: "gemini-1.5-flash",
            usage: {
                input_tokens: fullPrompt.length / 4,
                output_tokens: aiResponse.length / 4
            }
        });
        
    } catch (error) {
        console.error('❌ Proxy server error:', error.message);
        res.status(500).json({ 
            error: 'Proxy server error',
            details: error.message
        });
    }
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`🚀 Gemini AI Proxy running on http://localhost:${PORT}`);
    console.log(`🤖 Using Google Gemini Pro`);
    console.log(`🔑 API Key configured: ${!!GEMINI_API_KEY && GEMINI_API_KEY.startsWith('AIza')}`);
});