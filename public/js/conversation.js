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
    chatMode = false,
    DEMO_MODE = false;


// Configuration - ONLY CHANGE THESE TWO VALUES
const TAVUS_API_KEY = 'e3415d468b3c4f2e82b8f20c78982994',
      REPLICA_ID = 'r4d9b2288937';

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    setupConversationControls();
    setupRecordingControls();

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
});

function setupConversationControls() {
    const startBtn = document.getElementById('start-conversation');
    if (startBtn) {
        startBtn.addEventListener('click', handleConversationToggle);
    }
}

async function handleConversationToggle() {
    console.log('🔄 Button clicked, conversationActive:', conversationActive);
    console.log('🔄 isRecording:', isRecording);
    
    const startBtn = document.getElementById('start-conversation');
    
    if (conversationActive) {
        // Disable button during process
        startBtn.disabled = true;
        startBtn.textContent = 'Ending...';
        
        await endConversation();
        
        // Re-enable button
        startBtn.disabled = false;
    } else {
        // Disable button during process
        startBtn.disabled = true;
        startBtn.textContent = 'Starting...';
        
        await createConversation();
        
        // Re-enable button
        startBtn.disabled = false;
    }
}

async function sendMessageToOpenAI(userMessage) {
    try {
        console.log('🤖 Sending message to Claude:', userMessage);
        
        // Add user message to conversation history
        chatMessages.push({
            role: "user",
            content: userMessage
        });

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
                model: 'claude-3-haiku-20240307',
                max_tokens: 300,
                system: "You are an expert business consultant AI. Help entrepreneurs with business planning, SWOT analysis, market research, startup costs, financial projections, and strategic recommendations. Be conversational, ask follow-up questions, and provide specific actionable advice.",
                messages: messages
            })
        });

        console.log('📡 Proxy Response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.log('Proxy Error Details:', response.status, errorText);
            throw new Error(`Proxy API error: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Proxy Response Data', data);

        let aiResponse;
        if (data.content && data.content[0] && data.content[0].text) {
            aiResponse = data.content[0].text.trim();
        } else {
            throw new Error('Unexpected response format from Claude');
        }

        chatMessages.push({
            role: 'assistant',
            content: aiResponse
        })

        console.log('Proxy response', aiResponse);
        return aiResponse;

    } catch (error) {
        console.error('❌ Claude API via proxy failed:', error);
            return "I'm having trouble connecting to my AI service right now. Could you try rephrasing your business question?";
    }
}

function switchToChatMode() {
    chatMode = true;
    
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
}

function switchToVideoMode() {
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
        `;
        transcriptDisplay.appendChild(messageDiv);
        transcriptDisplay.scrollTop = transcriptDisplay.scrollHeight;
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
    const aiResponse = await sendMessageToOpenAI(userMessage);
    
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

            startConversationTracking();

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
    if (comprehensiveRecorder && isRecording) {
        comprehensiveRecorder.stop();
        isRecording = false;
        updateRecordingUI(false);
        console.log('⏹️ Comprehensive recording stopped');
    }
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
        
        // ADDED: Stop recording first
        console.log('🛑 Auto-stopping recording with conversation...');
        if (isRecording) {
            stopComprehensiveRecording();
            console.log('✅ Recording stopped and saved');
        }
        
        await fetch(`https://tavusapi.com/v2/conversations/${currentConversationId}`, {
            method: 'DELETE',
            headers: {
                'x-api-key': TAVUS_API_KEY
            }
        });

        // Clear conversation state
        currentConversationId = null;
        conversationActive = false;
        
        // Clear video container
        const videoContainer = document.querySelector('.video-container');
        videoContainer.innerHTML = '<p>Conversation ended. Recording saved to downloads. Click Start to begin a new conversation.</p>';
        
        updateConnectionStatus('Ready to start conversation');
        updateStartButton('Start Conversation');
        
    } catch (error) {
        console.error('Error ending conversation:', error);
        updateConnectionStatus('Error ending conversation');
        
        // ADDED: Still stop recording even if conversation end failed
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

function creaeteDemoAudioOutput() {
    const demoResponses = [
        "Hello! I'm your AI business consultant. What business idea would you like to discuss?",
        "That sounds like an interesting concept. Tell me more about your target market.",
        "Let's analyze the startup costs for your business idea.",
        "Based on what you've told me, here are some key recommendations..."
    ];

    return demoResponses;
}

function playDemoAIResponse(text) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pith = 1.1;
    utterance.volume = 1.0;

    speechSynthesis.speak(utterance);
}
