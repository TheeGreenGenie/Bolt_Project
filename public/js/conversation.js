// Tavus conversation management
let currentConversationId = null,
    conversationActive = false,
    comprehensiveRecorder = null,
    websiteAudioContext = null,
    websiteDestination = null,
    capturedElements = new Set(),
    mediaRecorder = null,
    chatMessages = [],
    recordedChunks = [],
    isRecording = false,
    transcriptBuffer = [],
    chatMode = false,
    pendingChatMode = false,
    conversationStartTime = null,
    pendingVideoMode = false,
    whisperPipeline = null,
    isTranscribing = false;
    DEMO_MODE = false;


// Configuration - ONLY CHANGE THESE TWO VALUES
const TAVUS_API_KEY = 'e3415d468b3c4f2e82b8f20c78982994',
      REPLICA_ID = 'r4d9b2288937';

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    setupConversationControls();
    setupRecordingControls();
    initializeWhisper();

    const voiceModeBtn = document.getElementById('voice-mode');
    const textModeBtn = document.getElementById('text-mode');
    
    if (voiceModeBtn) {
        voiceModeBtn.addEventListener('click', switchToVideoMode);
    }
    
    if (textModeBtn) {
        textModeBtn.addEventListener('click', switchToChatMode);
    }
    
    // Chat input handling
    const sendButton = document.getElementById('send-message');
    const messageInput = document.getElementById('message-input');
    
    if (sendButton) {
        sendButton.addEventListener('click', handleChatSubmit);
    }
    
    if (messageInput) {
        messageInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleChatSubmit();
            }
        });
    }

    updateConnectionStatus('Ready to start conversation');

    const savedBusiness = localStorage.getItem('currentBusiness');
    if (savedBusiness) {
        window.currentBusiness = JSON.parse(savedBusiness);
        updateBusinessContextUI();
    }

    const selectPastBtn = document.getElementById('select-past-business');
    if (selectPastBtn) {
        selectPastBtn.addEventListener('click', async function() {
            const business = await window.showPastBusinessModal();
            if (business) {
                alert(`Selected: ${business.business_name}`);
                updateBusinessContextUI();
            }
        });
    }
});

async function initializeWhisper() {
    try {
        isTranscribing = true; // Mark as loading
        updateConnectionStatus('Loading transcription model...');
        console.log('🎤 Initializing Whisper.js...');
        console.log('📦 Importing transformers pipeline...');
        
        // Import the pipeline
        const { pipeline, env } = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.1');
        
        // Configure environment
        env.allowRemoteModels = true;
        env.allowLocalModels = false;
        
        console.log('✅ Transformers imported successfully');
        console.log('🔄 Loading Whisper model (this may take a moment)...');
        
        const modelStartTime = Date.now();
        
        whisperPipeline = await pipeline('automatic-speech-recognition', 'Xenova/whisper-base.en', {
            revision: 'main',
        });
        
        const modelLoadTime = Date.now() - modelStartTime;
        console.log('✅ Whisper.js initialized');
        console.log(`⏱️ Model load time: ${modelLoadTime}ms`);
        console.log('🎯 Model: Xenova/whisper-base.en');
        
        isTranscribing = false; // Mark as ready
        updateConnectionStatus('Ready to start conversation');
        
    } catch (error) {
        console.error('❌ Failed to initialize Whisper.js:', error);
        isTranscribing = false; // Mark as failed but ready
        updateConnectionStatus('Transcription unavailable - conversation still works');
    }
}

async function transcribeAudioBlob(audioBlob) {
    if (!whisperPipeline) {
        console.log('⚠️ Whisper not available, skipping transcription');
        return null;
    }
    
    try {
        isTranscribing = true;
        const startTime = Date.now();
        updateConnectionStatus('Transcribing audio...');
        
        console.log('🎤 Starting Whisper transcription...');
        console.log(`📊 Audio blob size: ${audioBlob.size} bytes`);
        console.log(`📊 Audio blob type: ${audioBlob.type}`);
        
        // Convert WebM to WAV for better compatibility
        const audioBuffer = await convertWebMToWAV(audioBlob);
        
        console.log(`📊 Converted audio buffer length: ${audioBuffer.length} samples`);
        
        // Transcribe with Whisper
        console.log('🔄 Running Whisper inference...');
        const result = await whisperPipeline(audioBuffer, {
            language: 'english',
            task: 'transcribe',
            return_timestamps: false,
            chunk_length_s: 30,
            stride_length_s: 5,
        });
        
        const processingTime = Date.now() - startTime;
        console.log('✅ Whisper transcription completed');
        console.log(`⏱️ Processing time: ${processingTime}ms`);
        console.log(`📝 Transcript length: ${result.text.length} characters`);
        console.log(`📝 Transcript preview: "${result.text.substring(0, 150)}..."`);
        
        updateConnectionStatus('Transcription completed');
        
        return result.text;
        
    } catch (error) {
        console.error('❌ Whisper transcription failed:', error);
        console.error('❌ Error details:', error.message);
        updateConnectionStatus('Transcription failed - audio still saved');
        return null;
    } finally {
        isTranscribing = false;
        console.log('🏁 Transcription process finished');
    }
}

// Helper function to convert WebM to WAV
async function convertWebMToWAV(webmBlob) {
    const arrayBuffer = await webmBlob.arrayBuffer();
    const audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000, // Whisper expects 16kHz
    });
    
    try {
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        // Get mono channel (Whisper expects mono)
        const channelData = audioBuffer.getChannelData(0);
        
        // Resample to 16kHz if needed
        if (audioBuffer.sampleRate !== 16000) {
            return resampleAudio(channelData, audioBuffer.sampleRate, 16000);
        }
        
        return channelData;
        
    } catch (error) {
        console.error('❌ Audio conversion failed:', error);
        throw error;
    } finally {
        audioContext.close();
    }
}

// Simple resampling function
function resampleAudio(audioData, originalSampleRate, targetSampleRate) {
    const ratio = originalSampleRate / targetSampleRate;
    const newLength = Math.round(audioData.length / ratio);
    const result = new Float32Array(newLength);
    
    for (let i = 0; i < newLength; i++) {
        const index = Math.floor(i * ratio);
        result[i] = audioData[index];
    }
    
    return result;
}

function setupConversationControls() {
    const startBtn = document.getElementById('start-conversation');
    if (startBtn) {
        startBtn.addEventListener('click', handleConversationToggle);
    }
}

async function handleConversationToggle() {
    console.log('🔄 Button clicked, conversationActive:', conversationActive);
    const startBtn = document.getElementById('start-conversation');

    if (conversationActive) {
        startBtn.disabled = true;
        startBtn.textContent = 'Ending...';
        await endConversation();
        startBtn.disabled = false;
    } else {
        // Check if Whisper is still loading
        if (isTranscribing) {
            updateConnectionStatus('Please wait for transcription model to finish loading...');
            return;
        }
        
        startBtn.disabled = true;
        startBtn.textContent = 'Starting...';
        
        // First ensure we have business context
        if (!window.currentBusiness) {
            const business = await window.promptForBusinessContext();
            if (!business) {
                startBtn.disabled = false;
                startBtn.textContent = 'Start Conversation';
                return;
            }
        }
        
        await createConversation();
        startBtn.disabled = false;
    }
}

async function sendMessageToGemini(userMessage) {
    const startTime = Date.now();
    
    try {
        console.log('🤖 Sending message to Gemini:', userMessage);
        
        // Add user message to conversation history
        chatMessages.push({
            role: "user",
            content: userMessage
        });

        // Add to database
        await window.addMessageToConversation('user', userMessage, 0, 0);

        const messages = chatMessages.map(msg => ({
            role: msg.role === 'assistant' ? 'assistant' : 'user',
            content: msg.content
        }));
        
        const response = await fetch('http://localhost:3001/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gemini-1.5-flash',
                max_tokens: 50,
                system: `You are an expert business consultant AI helping with "${window.currentBusiness?.business_name || 'a business idea'}" in the ${window.currentBusiness?.industry || 'general'} industry. Your job is to gain neccessary preliminary data from the user you are chatting with ensuring that they tell you their product price, products, projected sales, and costs as well as other key parameters you need to plan a business. keep questions concise and separate as not to bombard the user`,
                messages: messages
            })
        });

        if (!response.ok) {
            throw new Error(`Proxy API error: ${response.status}`);
        }
        
        const data = await response.json();
        let aiResponse = data.content[0].text.trim();

        chatMessages.push({
            role: 'assistant',
            content: aiResponse
        });

        const tokensUsed = parseInt(data.usage?.input_tokens + data.usage?.output_tokens) || 0,
              processingTime = parseInt(Date.now() - startTime);

        await window.addMessageToConversation('ai', aiResponse, tokensUsed, processingTime);

        return aiResponse;

    } catch (error) {
        console.error('❌ Gemini API failed:', error);
        const errorMessage = "I'm having trouble connecting. Could you try rephrasing your question?";
        
        try {
            await window.addMessageToConversation('ai', errorMessage, 0, Date.now() - startTime);
        } catch (dbError) {
            console.error('Failed to log error:', dbError);
        }
        
        return errorMessage;
    }
}

async function switchToChatMode() {
    // Check if business already exists
    const savedBusiness = localStorage.getItem('currentBusiness');
    if (savedBusiness) {
        window.currentBusiness = JSON.parse(savedBusiness);
    }
    
    // Only prompt if still no business
    if (!window.currentBusiness) {
        pendingChatMode = true;
        const business = await window.promptForBusinessContext();
        if (!business) {
            pendingChatMode = false;
            return; // User cancelled
        }
        // executeChatModeSwitch will be called from the modal resolve
    } else {
        // Business exists, directly execute chat mode
        executeChatModeSwitch(window.currentBusiness);
    }
}

async function executeChatModeSwitch(business) {
    pendingChatMode = false;
    chatMode = true;
    window.currentBusiness = business;
    console.log('executeChatModeSwitch called with:', business);

    const dbConversation = await window.startNewConversation('gemini_chat');
    window.currentConversation = dbConversation
    conversationActive = true;

    // Hide video container
    const videoContainer = document.querySelector('.video-container');
    if (videoContainer) {
        videoContainer.style.display = 'none';
    }
    
    // Show text chat interface
    const textInputContainer = document.getElementById('text-input-container');
    if (textInputContainer) {
        textInputContainer.style.display = 'block';
    }
    
    // Hide voice controls
    const voiceControls = document.getElementById('voice-controls');
    if (voiceControls) {
        voiceControls.style.display = 'none';
    }
    
    // Update YOUR existing button states
    const voiceModeBtn = document.getElementById('voice-mode');
    const textModeBtn = document.getElementById('text-mode');
    
    if (voiceModeBtn) voiceModeBtn.classList.remove('active');
    if (textModeBtn) textModeBtn.classList.add('active');
    
    // Add welcome message to chat
    displayChatMessage('ai', "I'm your AI business consultant. Video mode is currently unavailable, but I'm here to help with your business questions via text. What business idea would you like to discuss?");
    
    updateConnectionStatus('Text chat mode active');
    console.log('💬 Switched to chat mode');
};

async function switchToVideoMode() {
    const savedBusiness = localStorage.getItem('currentBusiness');
    if (savedBusiness) {
        window.currentBusiness = JSON.parse(savedBusiness);
    }

    if (!window.currentBusiness) {
        pendingVideoMode = true;
        const business = await window.promptForBusinessContext();
        if (!business) {
            pendingVideoMode = false;
            return;
        }
    } else {
        executeVideoModeSwitch(window.currentBusiness);
    }
};

async function executeVideoModeSwitch(business) {
    pendingVideoMode = false;
    window.currentBusiness = business;

    const dbConversation = await window.startNewConversation('tavus_video');
    window.currentConversation = dbConversation;
    conversationActive = true;
    chatMode = false;

    // Show video container
    const videoContainer = document.querySelector('.video-container');
    if (videoContainer) {
        videoContainer.style.display = 'block';
    }
    
    // Hide text chat interface
    const textInputContainer = document.getElementById('text-input-container');
    if (textInputContainer) {
        textInputContainer.style.display = 'none';
    }
    
    // Show voice controls
    const voiceControls = document.getElementById('voice-controls');
    if (voiceControls) {
        voiceControls.style.display = 'block';
    }
    
    // Update YOUR existing button states
    const voiceModeBtn = document.getElementById('voice-mode');
    const textModeBtn = document.getElementById('text-mode');
    
    if (voiceModeBtn) voiceModeBtn.classList.add('active');
    if (textModeBtn) textModeBtn.classList.remove('active');
    
    updateConnectionStatus('Ready for video conversation');
    console.log('🎥 Switched to video mode');
}

function displayChatMessage(sender, message) {
    const transcriptDisplay = document.getElementById('transcript-display');
    if (transcriptDisplay) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `transcript-line ${sender}`;
        messageDiv.innerHTML = `
            <span class="speaker">${sender.toUpperCase()}:</span>
            <span class="text">${message}</span>
            <span class="timestamp">${new Date().toLocaleTimeString()}</span>
        `;
        transcriptDisplay.appendChild(messageDiv);
        transcriptDisplay.scrollTop = transcriptDisplay.scrollHeight;
        
        // Add to transcript buffer for saving
        transcriptBuffer.push({
            sender,
            message,
            timestamp: new Date().toISOString()
        });
    }
}

async function handleChatSubmit() {
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-message');
    
    if (!messageInput || !messageInput.value.trim()) return;
    
    const userMessage = messageInput.value.trim();
    messageInput.value = '';
    
    // Disable input while processing
    messageInput.disabled = true;
    sendButton.disabled = true;
    sendButton.textContent = 'Thinking...';
    
    // Display user message
    displayChatMessage('user', userMessage);
    
    // Get AI response
    const aiResponse = await sendMessageToGemini(userMessage);
    
    // Display AI response
    displayChatMessage('ai', aiResponse);
    
    // Re-enable input
    messageInput.disabled = false;
    sendButton.disabled = false;
    sendButton.textContent = 'Send';
    messageInput.focus();
}


async function createConversation() {
    try {
        updateConnectionStatus('Creating conversation...');
        updateStartButton('Creating...');

        conversationStartTime = Date.now();

        const conversationType = chatMode ? 'gemini_chat' : 'tavus_video',
              dbConversation = await window.startNewConversation(conversationType, null);
        
        window.currentConversation = dbConversation
        
        // START RECORDING AUTOMATICALLY
        console.log('🎤 Auto-starting recording with conversation...');
        const recordingStarted = await captureAllWebsiteAudio();
        
        if (recordingStarted) {
            console.log('✅ Recording started successfully');
        } else {
            console.log('⚠️ Recording failed, but continuing with conversation');
        }
        
        if (DEMO_MODE) {
            startDemoConversation();
            return;
        } else {
            const response = await fetch('https://tavusapi.com/v2/conversations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': TAVUS_API_KEY
                },
                body: JSON.stringify({
                    replica_id: REPLICA_ID,
                    conversation_name: "Business Consultation",
                    conversational_context: "You are a business consultant helping an entrepreneur analyze their business idea. Provide expert advice on business planning, market analysis, and strategic recommendations.",
                    custom_greeting: "Hello! I'm your AI business consultant. What business idea would you like to discuss today?"
                })
            });
            
            if (!response.ok) {
                throw new Error(`Failed to create conversation: ${response.status}`);
            }
            
            const data = await response.json();
            currentConversationId = data.conversation_id;
            
            // Embed the conversation URL in iframe
            embedConversation(data.conversation_url);
            
            conversationActive = true;
            updateConnectionStatus('Conversation active - you can now talk (Recording in progress)');
            updateStartButton('End Conversation');

            conversationActive = true;
            updateConnectionStatus('Conversation active - you can now talk (Recording in progress)');
            updateStartButton('End Conversation');
        }

    } catch (error) {
        console.error('Error creating conversation:', error);
        updateConnectionStatus('Failed to start conversation');
        updateStartButton('Start Conversation');
        
        // ADDED: Stop recording if it was started but conversation failed
        if (isRecording) {
            stopComprehensiveRecording();
        }
    }
}

async function captureAllWebsiteAudio() {
    try{
        console.log('Setting up comprehensive webite audio capture...');
        websiteAudioContext = new AudioContext();
        websiteDestination = websiteAudioContext.createMediaStreamDestination();
        try {

            const micStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            });
            const micSource = websiteAudioContext.createMediaStreamSource(micStream),
                  micGain = websiteAudioContext.createGain();
            micGain.gain.value = 3.0;

            micSource.connect(micGain);
            micGain.connect(websiteDestination);
            console.log('Microphone captured');
        } catch (e) {
            console.log('Microphone failed:', e.message);
        }

        monitorVideoElements();
        setupSpeechSynthesisCapture();
        comprehensiveRecorder = new MediaRecorder(websiteDestination.stream, {
            mimeType: 'audio/webm;codecs=opus'
        });

        recordedChunks = [];

        comprehensiveRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedChunks.push(event.data);
                console.log('Comprehensive audio chunk:', event.data.size, 'bytes');
            }
        };

        comprehensiveRecorder.onstop = () => {
            const blob = new Blob(recordedChunks, { type: 'audio/webm' });
            downloadAudioRecording(blob, 'comprehensive-audio');
            console.log('Comprehensive recording saved');

            if (websiteAudioContext) {
                websiteAudioContext.close();
                websiteAudioContext = null;
            }
        };

        comprehensiveRecorder.start(1000);
        isRecording = true;
        updateRecordingUI(true);

        console.log('Comprehensive recording started = capturing ALL website audio');
        return true;
    } catch (error) {
        console.error('Comprehensive recording failed:', error);
        return false;
    }
}

function monitorVideoElements() {
    // Monitor existing video elements
    const videoElements = document.querySelectorAll('video');
    videoElements.forEach(captureVideoIfReady);
    
    // Monitor for new video elements
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1) {
                    const videos = node.querySelectorAll ? node.querySelectorAll('video') : [];
                    videos.forEach(captureVideoIfReady);
                    if (node.tagName === 'VIDEO') {
                        captureVideoIfReady(node);
                    }
                }
            });
        });
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
}

function captureVideoIfReady(video) {
    if (capturedElements.has(video)) return;
    
    const checkAndCapture = () => {
        if (video.srcObject || video.src || video.currentSrc) {
            try {
                const source = websiteAudioContext.createMediaElementSource(video);
                const gain = websiteAudioContext.createGain();
                gain.gain.value = 4.0; // Boost video audio
                
                source.connect(gain);
                gain.connect(websiteDestination);
                gain.connect(websiteAudioContext.destination);
                
                capturedElements.add(video);
                console.log('✅ Video element audio captured');
            } catch (e) {
                console.log('❌ Video capture failed:', e.message);
            }
        }
    };
    
    checkAndCapture();
    video.addEventListener('loadstart', checkAndCapture);
    video.addEventListener('canplay', checkAndCapture);
}

function setupSpeechSynthesisCapture() {
    // This will capture demo mode speech synthesis
    const gainNode = websiteAudioContext.createGain();
    gainNode.gain.value = 5.0; // High gain for speech synthesis
    gainNode.connect(websiteDestination);
    
    console.log('✅ Speech synthesis capture ready');
}

function stopComprehensiveRecording() {
    return new Promise((resolve) => {
        if (comprehensiveRecorder && isRecording) {
            comprehensiveRecorder.onstop = () => {
                const blob = new Blob(recordedChunks, { type: 'audio/webm' });
                
                if (websiteAudioContext) {
                    websiteAudioContext.close();
                    websiteAudioContext = null;
                }
                
                resolve(blob);
            };
            
            comprehensiveRecorder.stop();
            isRecording = false;
            updateRecordingUI(false);
        } else {
            resolve(null);
        }
    });
}


function startDemoConversation() {
    embedDemoVideo();
    startDemoAudioSequence();
    conversationActive = true;
    updateConnectionStatus('Demo conversation active');
    updateStartButton('End Demo');
}

function embedDemoVideo() {
    const videoContainer = document.querySelector('.video-container');
    videoContainer.innerHTML = `
        <div style="width: 100%; height: 500px; background: gray;
                    display: flex; align-items: center; justify-content: center; color: white; font-size: 24px">
            DEMO MODE - AI Consultant Simulation
            <br><small>Audio will play automatically for screen recording test</small>
        </div>
    `;
}

function startDemoAudioSequence() {
    const demoScript = [
        { delay: 1000, text: "Hello! I'm your AI business consultant. What business idea would you like to discuss?" },
        { delay: 5000, text: "I can help you analyze market opportunities, startup costs, and create a comprehensive business plan." },
        { delay: 10000, text: "Let's start by discussing your industry and target customers." },
        { delay: 15000, text: "Based on current market trends, here are some key insights for your business sector." },
        { delay: 20000, text: "Would you like me to generate a SWOT analysis for your business concept?" }
    ];

    demoScript.forEach(item => {
        setTimeout(() => {
            if (conversationActive && DEMO_MODE) {
                playDemoAIResponse(item.text);
            }
        }, item.delay);
    });
}


function embedConversation(conversationUrl) {
    const videoContainer = document.querySelector('.video-container');
    videoContainer.innerHTML = `
        <iframe 
            src="${conversationUrl}" 
            width="100%" 
            height="500px" 
            frameborder="0" 
            allow="camera; microphone; autoplay">
        </iframe>
    `;
}

async function startAudioRecording() {
    return await captureAllWebsiteAudio();
}

function stopAudioRecording() {
    stopComprehensiveRecording();
}

function downloadAudioRecording(blob) {
    const url = URL.createObjectURL(blob),
          a = document.createElement('a'),
          timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          
    a.href = url;
    a.download = 'consultation-${timestamp}.webm';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => URL.revokeObjectURL(url), 100);

    console.log('Recording downloaded');
}

function updateRecordingUI(recording) {
    const startBtn = document.querySelector('#start-recording'),
          stopBtn = document.querySelector('#stop-recording'),
          status = document.querySelector('#recording-status');

    if (recording) {
        startBtn.style.display = 'none';
        stopBtn.style.display = 'inline-blovk';
        status.textContent = 'Recording ...';
        status.style.color = 'red';
    } else {
        startBtn.style.display = 'inline-block';
        stopBtn.style.display = 'none';
        status.textContent = '';
    }
}

function setupRecordingControls() {
    const startBtn = document.querySelector('#start-recording'),
          stopBtn = document.querySelector('#stop-recording');

    if (startBtn) {
        startBtn.addEventListener('click', startAudioRecording);
    }

    if (stopBtn) {
        stopBtn.addEventListener('click', stopComprehensiveRecording);
    }
}

/*
Check this function
*/
async function endConversation() {
    if (!currentConversationId) return;
    
    try {
        updateConnectionStatus('Ending conversation...');

        const duration = conversationStartTime ? Math.floor((Date.now() - conversationStartTime) / 1000) : 0;
        const conversationToEnd = window.currentConversation;
        let savedConversationId = window.currentConversation?.id;

        let audioBlob = null;
        let transcriptionText = null;
        
        // Stop recording first
        console.log('🛑 Auto-stopping recording with conversation...');
        if (isRecording) {
            audioBlob = await stopComprehensiveRecording();
            console.log('✅ Recording stopped and saved');
        }
        
        // Transcribe audio with Whisper if available
        if (audioBlob && whisperPipeline) {
            console.log('🎤 Starting audio transcription...');
            transcriptionText = await transcribeAudioBlob(audioBlob);
            
            if (transcriptionText) {
                console.log('✅ Audio transcribed successfully');
                console.log('📝 Transcript preview:', transcriptionText.substring(0, 100) + '...');
            }
        }
        
        // Upload audio file to database
        if (audioBlob && conversationToEnd) {
            try {
                await window.uploadAudioFile(audioBlob);
                console.log('✅ Audio uploaded to database');
            } catch (uploadError) {
                console.error('❌ Audio upload failed:', uploadError);
                downloadAudioRecording(audioBlob, 'backup');
            }
        }

        // Combine chat transcript with audio transcription
        const chatTranscript = transcriptBuffer.map(entry => 
            `[${entry.timestamp}] ${entry.sender.toUpperCase()}: ${entry.message}`
        ).join('\n');
        
        const finalTranscript = transcriptionText 
            ? `=== CHAT MESSAGES ===\n${chatTranscript}\n\n=== AUDIO TRANSCRIPTION ===\n${transcriptionText}`
            : chatTranscript;

        // Save transcript to database
        if (window.currentConversation && transcriptionText) {
            try {
                await window.saveTranscriptToDatabase(transcriptionText);
                console.log('✅ Transcript saved to database');
            } catch (transcriptError) {
                console.error('❌ Failed to save transcript:', transcriptError);
            }
        }

        if (window.currentConversation) {
            await window.endCurrentConversation(finalTranscript, duration, null, null);
            conversationActive = false;
        }
        
        // Rest of cleanup code - REPLACE the problematic line
        if (savedConversationId) {
            try {
                await fetch(`https://tavusapi.com/v2/conversations/${savedConversationId}`, {
                    method: 'DELETE',
                    headers: {
                        'x-api-key': TAVUS_API_KEY
                    }
                });
            } catch (tavusError) {
                console.error('Error ending Tavus conversation:', tavusError);
            }
        }

        // Clear conversation state
        currentConversationId = null;
        conversationActive = false;
        conversationStartTime = null;
        transcriptBuffer = [];
        chatMessages = [];
        savedConversationId = null;
        window.currentConversation = null;
        
        // Clear video container
        const videoContainer = document.querySelector('.video-container');
        videoContainer.innerHTML = '<p>Conversation ended. Recording saved to downloads. Click Start to begin a new conversation.</p>';
        
        updateConnectionStatus('Ready to start conversation');
        updateStartButton('Start Conversation');

        setTimeout(() => {
            if (confirm('Conversation saved! view analysis results?')) {
                window.location.href = 'analysis.html';
            }
        }, 1000);
        
    } catch (error) {
        console.error('Error ending conversation:', error);
        updateConnectionStatus('Error ending conversation');
        
        if (isRecording) {
            stopComprehensiveRecording();
        }
    }
}


function updateConnectionStatus(status) {
    const statusElement = document.getElementById('connection-status');
    if (statusElement) {
        statusElement.textContent = status;
    }
    console.log('Status:', status);
}

function updateStartButton(text) {
    const startBtn = document.getElementById('start-conversation');
    if (startBtn) {
        startBtn.textContent = text;
    }
}

function updateBusinessContextUI() {
    const contextDiv = document.getElementById('business-context');
    if (contextDiv && window.currentBusiness) {
        contextDiv.innerHTML = `
            <h4>Current Discussion:</h4>
            <p><strong>${window.currentBusiness.business_name}</strong></p>
            <p>Type: ${window.currentBusiness.business_type} | Industry: ${window.currentBusiness.industry}</p>
        `;
    }
}

window.executeChatModeSwitch = executeChatModeSwitch;
window.executeVideoModeSwitch = executeVideoModeSwitch;
window.pendingChatMode = pendingChatMode;
window.pendingVideoMode = pendingVideoMode;
