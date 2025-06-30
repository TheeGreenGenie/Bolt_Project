// backend-server.js
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs').promises;

const app = express();
app.use(cors());
app.use(express.json());

// Database connection
// const pool = new Pool({
//     connectionString: process.env.DATABASE_URL || 'postgresql://username:password@localhost:5432/business_boom',
//     ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
// });

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'business_boom',
    password: 'S0l0m0ney!',  // Put your real postgres password here
    port: 5432,
    ssl: false
});

// JWT secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/audio/');
    },
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}.webm`;
        cb(null, uniqueName);
    }
});
const upload = multer({ storage });

// Auth middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token' });
        }
        req.user = user;
        next();
    });
}

// ============ AUTH ROUTES ============

// Register new user
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, name } = req.body;
        
        // Check if user exists
        const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existingUser.rows.length > 0) {
            return res.status(400).json({ error: 'User already exists' });
        }
        
        // Hash password
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);
        
        // Create user
        const result = await pool.query(
            'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name, tier, created_at',
            [email, passwordHash, name]
        );
        
        const user = result.rows[0];
        const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
        
        res.status(201).json({
            message: 'User created successfully',
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                tier: user.tier
            },
            token
        });
        
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Login user
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Get user
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const user = result.rows[0];
        
        // Check password
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Create token
        const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
        
        res.json({
            message: 'Login successful',
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                tier: user.tier
            },
            token
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// ============ BUSINESS ROUTES ============

// Get user's businesses
app.get('/api/businesses', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT b.*, 
                   COUNT(c.id) as conversation_count,
                   MAX(c.created_at) as last_conversation_date
            FROM businesses b
            LEFT JOIN conversations c ON b.id = c.business_id
            WHERE b.user_id = $1
            GROUP BY b.id
            ORDER BY b.updated_at DESC
        `, [req.user.userId]);
        
        res.json({ businesses: result.rows });
    } catch (error) {
        console.error('Error fetching businesses:', error);
        res.status(500).json({ error: 'Failed to fetch businesses' });
    }
});

// Create or find existing business
app.post('/api/businesses/find-or-create', authenticateToken, async (req, res) => {
    try {
        const { businessName, businessType, industry, description } = req.body;
        
        // First, check for similar businesses
        const similarBusinesses = await pool.query(`
            SELECT id, business_name, business_type, industry, description,
                   similarity(business_name, $2) as name_similarity
            FROM businesses 
            WHERE user_id = $1 
            AND (
                similarity(business_name, $2) > 0.3
                OR (business_type = $3 AND industry = $4)
            )
            ORDER BY name_similarity DESC
            LIMIT 5
        `, [req.user.userId, businessName, businessType, industry]);
        
        if (similarBusinesses.rows.length > 0) {
            // Return similar businesses for user confirmation
            return res.json({
                action: 'confirm',
                message: 'We found similar businesses. Is this the same as one of these?',
                similarBusinesses: similarBusinesses.rows,
                newBusiness: { businessName, businessType, industry, description }
            });
        } else {
            // Create new business
            const result = await pool.query(`
                INSERT INTO businesses (user_id, business_name, business_type, industry, description)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING *
            `, [req.user.userId, businessName, businessType, industry, description]);
            
            res.json({
                action: 'created',
                business: result.rows[0]
            });
        }
    } catch (error) {
        console.error('Error finding/creating business:', error);
        res.status(500).json({ error: 'Failed to process business' });
    }
});

// Confirm new business creation
app.post('/api/businesses/create-confirmed', authenticateToken, async (req, res) => {
    try {
        const { businessName, businessType, industry, description } = req.body;
        
        const result = await pool.query(`
            INSERT INTO businesses (user_id, business_name, business_type, industry, description)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [req.user.userId, businessName, businessType, industry, description]);
        
        res.json({
            action: 'created',
            business: result.rows[0]
        });
    } catch (error) {
        console.error('Error creating business:', error);
        res.status(500).json({ error: 'Failed to create business' });
    }
});

// ============ CONVERSATION ROUTES ============

// Start new conversation
app.post('/api/conversations/start', authenticateToken, async (req, res) => {
    try {
        const { businessId, conversationType, tavusConversationId } = req.body;
        
        const result = await pool.query(`
            INSERT INTO conversations (business_id, user_id, conversation_type, tavus_conversation_id, status)
            VALUES ($1, $2, $3, $4, 'active')
            RETURNING *
        `, [businessId, req.user.userId, conversationType, tavusConversationId]);
        
        res.json({ conversation: result.rows[0] });
    } catch (error) {
        console.error('Error starting conversation:', error);
        res.status(500).json({ error: 'Failed to start conversation' });
    }
});

// Add message to conversation
app.post('/api/conversations/:id/messages', authenticateToken, async (req, res) => {
    try {
        const { sender, content, tokensUsed, processingTime } = req.body;
        const conversationId = req.params.id;
        
        const result = await pool.query(`
            INSERT INTO messages (conversation_id, sender, content, tokens_used, processing_time_ms)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [conversationId, sender, content, tokensUsed, processingTime]);
        
        res.json({ message: result.rows[0] });
    } catch (error) {
        console.error('Error adding message:', error);
        res.status(500).json({ error: 'Failed to add message' });
    }
});

const { transcribeAudioFile } = require('./transcribe-audio');

app.post('/api/conversations/:id/audio', authenticateToken, upload.single('audio'), async (req, res) => {
    try {
        const conversationId = req.params.id;
        const file = req.file;
        
        if (!file) {
            return res.status(400).json({ error: 'No audio file provided' });
        }
        
        // Save file info
        const result = await pool.query(`
            INSERT INTO audio_files (conversation_id, file_name, file_size, mime_type, storage_url, transcription_status)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [conversationId, file.filename, file.size, file.mimetype, file.path, 'completed']);
        
        res.json({ audioFile: result.rows[0] });
        
    } catch (error) {
        console.error('Error uploading audio:', error);
        res.status(500).json({ error: 'Failed to upload audio' });
    }
});

app.post('/api/conversations/:id/transcript', authenticateToken, async (req, res) => {
    try {
        const { transcript } = req.body;
        await pool.query(
            'UPDATE conversations SET transcript_text = $1 WHERE id = $2',
            [transcript, req.params.id]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to save transcript' });
    }
});

// End conversation
app.patch('/api/conversations/:id/end', authenticateToken, async (req, res) => {
    try {
        const { transcript, duration, insights, actionItems } = req.body;
        const conversationId = req.params.id;
        
        const result = await pool.query(`
            UPDATE conversations 
            SET status = 'completed', 
                completed_at = CURRENT_TIMESTAMP,
                transcript_text = $2,
                duration_seconds = $3,
                insights_generated = $4,
                action_items = $5
            WHERE id = $1 AND user_id = $6
            RETURNING *
        `, [conversationId, transcript, duration, insights, actionItems, req.user.userId]);
        
        res.json({ conversation: result.rows[0] });
    } catch (error) {
        console.error('Error ending conversation:', error);
        res.status(500).json({ error: 'Failed to end conversation' });
    }
});

// Get conversation history
app.get('/api/businesses/:id/conversations', authenticateToken, async (req, res) => {
    try {
        const businessId = req.params.id;
        
        const conversations = await pool.query(`
            SELECT c.*, 
                   CASE 
                       WHEN c.conversation_type = 'gemini_chat' THEN
                           (SELECT json_agg(
                               json_build_object(
                                   'sender', sender,
                                   'content', content,
                                   'timestamp', timestamp
                               ) ORDER BY timestamp
                           ) FROM messages WHERE conversation_id = c.id)
                       ELSE NULL
                   END as messages
            FROM conversations c
            WHERE c.business_id = $1 AND c.user_id = $2
            ORDER BY c.created_at DESC
        `, [businessId, req.user.userId]);
        
        res.json({ conversations: conversations.rows });
    } catch (error) {
        console.error('Error fetching conversations:', error);
        res.status(500).json({ error: 'Failed to fetch conversations' });
    }
});

app.post('/api/businesses/:id/analysis', authenticateToken, async (req, res) => {
    try {
        const businessId = req.params.id;
        
        // Get business details
        const businessResult = await pool.query(
            'SELECT * FROM businesses WHERE id = $1 AND user_id = $2',
            [businessId, req.user.userId]
        );
        
        if (businessResult.rows.length === 0) {
            return res.status(404).json({ error: 'Business not found' });
        }
        
        const business = businessResult.rows[0];
        
        const transcriptsResult = await pool.query(`
            SELECT 
                c.id,
                c.transcript_text,
                c.conversation_type,
                c.created_at,
                COALESCE(c.transcript_text, '') as conversation_transcript,
                COALESCE(af.transcription_text, '') as audio_transcript,
                COALESCE(
                    string_agg(
                        CASE 
                            WHEN m.sender = 'user' THEN 'USER: ' || m.content
                            WHEN m.sender = 'ai' THEN 'AI: ' || m.content
                            ELSE m.sender || ': ' || m.content
                        END, 
                        E'\n' ORDER BY m.timestamp
                    ), 
                    ''
                ) as chat_messages
            FROM conversations c
            LEFT JOIN audio_files af ON c.id = af.conversation_id
            LEFT JOIN messages m ON c.id = m.conversation_id
            WHERE c.business_id = $1 AND c.status in ('active', 'completed')
            GROUP BY c.id, c.transcript_text, c.conversation_type, c.created_at, af.transcription_text
            ORDER BY c.created_at DESC
        `, [businessId]);

        console.log('📊 Found conversations:', transcriptsResult.rows.length);
        transcriptsResult.rows.forEach((row, index) => {
            console.log(`📊 Conversation ${index + 1}:`);
            console.log(`   - ID: ${row.id}`);
            console.log(`   - Type: ${row.conversation_type}`);
            console.log(`   - Conversation transcript length: ${row.conversation_transcript.length}`);
            console.log(`   - Audio transcript length: ${row.audio_transcript.length}`);
            console.log(`   - Chat messages length: ${row.chat_messages.length}`);
        });

        // Combine all transcript sources
        const allTranscripts = transcriptsResult.rows
            .map(row => {
                const parts = [];
                if (row.conversation_transcript) parts.push(row.conversation_transcript);
                if (row.audio_transcript) parts.push(row.audio_transcript);
                if (row.chat_messages) parts.push(row.chat_messages);
                return parts.join('\n\n');
            })
            .join('\n\n---NEW CONVERSATION---\n\n');
        
        console.log(`📊 Analyzing business: ${business.business_name}`);
        console.log(`📊 Total transcript length: ${allTranscripts.length} characters`);
        
        if (allTranscripts.length < 100) {
            return res.status(400).json({ 
                error: 'Not enough conversation data for analysis. Please have more conversations first.' 
            });
        }
        
        // Generate analysis using AI
        const analysis = await generateComprehensiveAnalysis(business, allTranscripts);
        
        // Save analysis to database
        await pool.query(`
            INSERT INTO business_analysis 
            (business_id, user_id, swot_analysis, financial_projections, competitors, 
             licenses_required, market_analysis, action_items, generated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
            ON CONFLICT (business_id) 
            DO UPDATE SET
                swot_analysis = $3,
                financial_projections = $4,
                competitors = $5,
                licenses_required = $6,
                market_analysis = $7,
                action_items = $8,
                generated_at = CURRENT_TIMESTAMP
        `, [
            businessId, 
            req.user.userId,
            JSON.stringify(analysis.swot),
            JSON.stringify(analysis.financial),
            JSON.stringify(analysis.competitors),
            JSON.stringify(analysis.licenses),
            JSON.stringify(analysis.market),
            JSON.stringify(analysis.actionItems)
        ]);
        
        res.json({ 
            success: true, 
            analysis,
            message: 'Business analysis generated successfully'
        });
        
    } catch (error) {
        console.error('Error generating business analysis:', error);
        res.status(500).json({ error: 'Failed to generate analysis' });
    }
});

// Get existing business analysis
app.get('/api/businesses/:id/analysis', authenticateToken, async (req, res) => {
    try {
        const businessId = req.params.id;
        
        const result = await pool.query(`
            SELECT ba.*, b.business_name, b.business_type, b.industry
            FROM business_analysis ba
            JOIN businesses b ON ba.business_id = b.id
            WHERE ba.business_id = $1 AND ba.user_id = $2
        `, [businessId, req.user.userId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'No analysis found for this business' });
        }
        
        const row = result.rows[0];
        const analysis = {
            businessName: row.business_name,
            businessType: row.business_type,
            industry: row.industry,
            generatedAt: row.generated_at,
            swot: row.swot_analysis,
            financial: row.financial_projections,
            competitors: row.competitors,
            licenses: row.licenses_required,
            market: row.market_analysis,
            actionItems: row.action_items
        };
        
        res.json({ analysis });
        
    } catch (error) {
        console.error('Error fetching business analysis:', error);
        res.status(500).json({ error: 'Failed to fetch analysis' });
    }
});

// AI Analysis Function
async function generateComprehensiveAnalysis(business, transcripts) {
    const prompt = `
You are a senior business consultant analyzing "${business.business_name}" - a ${business.business_type} in the ${business.industry} industry.

BUSINESS DETAILS:
- Name: ${business.business_name}
- Type: ${business.business_type}
- Industry: ${business.industry}
- Description: ${business.description}

CONVERSATION DATA:
${transcripts}

INSTRUCTIONS:
1. Extract specific information from the conversations above when available
2. For missing information, use realistic MARKET AVERAGES for ${business.business_type} businesses in ${business.industry}
3. Base financial estimates on typical small-to-medium ${business.industry} businesses
4. Research actual competitor revenue ranges for ${business.industry}
5. Include industry-standard licenses and permits for ${business.industry}

Return ONLY this JSON with realistic market-based estimates:

{
  "swot": {
    "strengths": ["Use conversation insights OR typical ${business.industry} strengths", "Market advantage for ${business.business_type}"],
    "weaknesses": ["From conversations OR common ${business.business_type} challenges", "Industry-typical weakness"],
    "opportunities": ["Market growth opportunity in ${business.industry}", "Specific opportunity for ${business.business_name}"],
    "threats": ["Competition threat in ${business.industry}", "Industry-specific challenge"]
  },
  "financial": {
    "weeklyExpenses": {
      "rent": "Market average commercial rent for ${business.industry}",
      "utilities": "Typical utility costs",
      "supplies": "Industry-standard supply costs",
      "marketing": "Recommended marketing budget (10-15% of revenue)",
      "labor": "Market rate wages for ${business.industry}",
      "insurance": "Standard business insurance costs",
      "other": "Miscellaneous business expenses",
      "total": "Sum of all expenses"
    },
    "weeklyRevenue": {
      "projectedLow": "Conservative estimate for new ${business.business_type}",
      "projectedHigh": "Optimistic but realistic estimate",
      "averageProjected": "Market average for established ${business.business_type}",
      "revenueStreams": ["Primary service/product", "Secondary revenue source"]
    }
  },
  "competitors": [
    {
      "name": "Research actual major ${business.industry} company",
      "annualRevenue": "Look up real revenue figures",
      "marketShare": "Estimated market share percentage",
      "strengths": ["Actual competitive advantages"],
      "weaknesses": ["Real market gaps they leave"]
    }
  ],
  "licenses": [
    {
      "name": "Required business license for ${business.industry}",
      "cost": "Actual government fee",
      "timeToObtain": "Real processing time",
      "authority": "Correct government agency",
      "required": true
    }
  ],
  "market": {
    "size": "Research actual ${business.industry} market size",
    "growthRate": "Real industry growth statistics",
    "targetCustomers": ["Primary customer demographics", "Secondary market"],
    "marketTrends": ["Current ${business.industry} trends", "Emerging opportunities"],
    "barriers": ["Real market entry barriers", "Regulatory requirements"]
  },
  "actionItems": [
    {
      "priority": "High",
      "task": "Most important first step for ${business.business_name}",
      "timeline": "Realistic timeframe",
      "cost": "Actual estimated cost"
    },
    {
      "priority": "Medium",
      "task": "Second priority action",
      "timeline": "Practical timeline",
      "cost": "Market-based cost estimate"
    }
  ]
}

IMPORTANT: Use actual market data and industry averages. Do not use placeholder values or zeros. Research real numbers for the ${business.industry} industry.`;

    try {
        console.log('🤖 Sending market-focused prompt to AI...');
        console.log('📊 Business being analyzed:', business.business_name);
        console.log('📊 Industry:', business.industry);
        console.log('📊 Business type:', business.business_type);
        console.log('📊 Transcript data length:', transcripts.length);
        
        const response = await fetch('http://localhost:3001/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gemini-1.5-flash',
                max_tokens: 4000,
                temperature: 0.3, // Lower for more consistent market data
                messages: [
                    {
                        role: 'system',
                        content: `You are an expert business consultant with access to current market data for the ${business.industry} industry. Always provide realistic market-based estimates, never use zeros or placeholder values. Research actual industry standards.`
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ]
            })
        });

        if (!response.ok) {
            throw new Error(`AI API error: ${response.status}`);
        }

        const data = await response.json();
        let analysisText = data.content[0].text.trim();
        
        console.log('🤖 Raw AI response length:', analysisText.length);
        console.log('🤖 Response preview:', analysisText.substring(0, 200));
        
        // Clean up the response
        analysisText = analysisText
            .replace(/^```json\s*/i, '')
            .replace(/\s*```$/i, '')
            .replace(/^.*?({.*}).*$/s, '$1')
            .trim();
        
        if (!analysisText.startsWith('{') || !analysisText.endsWith('}')) {
            throw new Error(`Response is not valid JSON format`);
        }
        
        const analysis = JSON.parse(analysisText);
        analysis.businessName = business.business_name;
        
        console.log('✅ Market-based analysis generated successfully');
        console.log('📊 Sample data check - Weekly expenses total:', analysis.financial?.weeklyExpenses?.total);
        console.log('📊 Sample data check - Market size:', analysis.market?.size);
        
        return analysis;
        
    } catch (error) {
        console.error('❌ AI analysis failed:', error);
        throw error;
    }
}

app.post('/api/businesses/:id/analysis', authenticateToken, async (req, res) => {
    try {
        const businessId = req.params.id;
        
        // Get business details
        const businessResult = await pool.query(
            'SELECT * FROM businesses WHERE id = $1 AND user_id = $2',
            [businessId, req.user.userId]
        );
        
        if (businessResult.rows.length === 0) {
            return res.status(404).json({ error: 'Business not found' });
        }
        
        const business = businessResult.rows[0];
        
        // For now, return a simple response to test
        res.json({ 
            success: true, 
            analysis: {
                businessName: business.business_name,
                swot: {
                    strengths: ["Test strength"],
                    weaknesses: ["Test weakness"],
                    opportunities: ["Test opportunity"],
                    threats: ["Test threat"]
                },
                financial: {
                    weeklyExpenses: { total: 1000 },
                    weeklyRevenue: { averageProjected: 2000 }
                },
                competitors: [],
                licenses: [],
                market: { size: "Test market", growthRate: "5%" },
                actionItems: []
            },
            message: 'Test analysis generated'
        });
        
    } catch (error) {
        console.error('Error generating business analysis:', error);
        res.status(500).json({ error: 'Failed to generate analysis' });
    }
});

// Get existing business analysis
app.get('/api/businesses/:id/analysis', authenticateToken, async (req, res) => {
    try {
        res.status(404).json({ error: 'No analysis found for this business' });
    } catch (error) {
        console.error('Error fetching business analysis:', error);
        res.status(500).json({ error: 'Failed to fetch analysis' });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'Business Boom Backend Running!', 
        timestamp: new Date().toISOString() 
    });
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
    console.log(`🚀 Business Boom Backend running on port ${PORT}`);
});

module.exports = app;