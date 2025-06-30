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

// Upload audio file
app.post('/api/conversations/:id/audio', authenticateToken, upload.single('audio'), async (req, res) => {
    try {
        const conversationId = req.params.id;
        const file = req.file;
        
        if (!file) {
            return res.status(400).json({ error: 'No audio file provided' });
        }
        
        const result = await pool.query(`
            INSERT INTO audio_files (conversation_id, file_name, file_size, mime_type, storage_url)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [conversationId, file.filename, file.size, file.mimetype, file.path]);
        
        res.json({ audioFile: result.rows[0] });
    } catch (error) {
        console.error('Error uploading audio:', error);
        res.status(500).json({ error: 'Failed to upload audio' });
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