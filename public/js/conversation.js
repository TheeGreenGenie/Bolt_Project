const { text } = require("body-parser");

// Tavus conversation management
let currentConversationId = null;
let conversationActive = false;
const DEMO_MODE = true;
// Testing mode variable

// Configuration - ONLY CHANGE THESE TWO VALUES
const TAVUS_API_KEY = 'e3415d468b3c4f2e82b8f20c78982994';
const REPLICA_ID = 'r4d9b2288937';

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    setupConversationControls();
    updateConnectionStatus('Ready to start conversation');
});

function setupConversationControls() {
    const startBtn = document.getElementById('start-conversation');
    if (startBtn) {
        startBtn.addEventListener('click', handleConversationToggle);
    }
}

async function handleConversationToggle() {
    console.log('Button clicked, conversationActive:', conversationActive);
    if (conversationActive) {
        await endConversation();
    } else {
        await createConversation();
    }
}


/*
Look Over this function
*/
async function createConversation() {
    try {
        updateConnectionStatus('Creating conversation...');
        updateStartButton('Creating...');
        
        if (DEMO_MODE) {
            const mockData = {
                conversation_id: 'demo_' + Date.now(),
                conversation_url: 'about:blank'
            };

            currentConversationId = mockData.conversation_id;
            embedConversation(mockData.conversation_url);
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
            updateConnectionStatus('Conversation active - you can now talk');
            updateStartButton('End Conversation');
        }

        startConversationTracking();

        conversationActive = true;
        updateConnectionStatus('Conversation actvie - you can now talk');
        updateStartButton('End Conversation');

    } catch (error) {
        console.error('Error creating conversation:', error);
        updateConnectionStatus('Failed to start conversation');
        updateStartButton('Start Conversation');
    }
}


/*
Check this function
*/
function startConversationTracking() {
    currentConversationData = {
        id: currentConversationId,
        startTime: new Date().toISOString(),
        endTime: null,
        duration: 0,
        userInputs: [],
        businessTopic: prompt("What business topic are you discussing?") || "General consultation",
        status: 'active'
    }

    if (recognition && !DEMO_MODE) {
        recognition.start();
        console.log('Speech recognition started');
    }

    if (!DEMO_MODE) {
        setupAndStartRecording();
    } else {
        simulateUserInputs();
    }
}

/*
Check this function
*/
async function setupAndStartRecording() {
    try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                sampleRate: 16000
            },
            video: false
        });

        const micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                sampleRate: 16000
            }
        });

        const audioContext = new AudioContext();
        const destination = audioContext.createMediaStreamDestination();

        const systemSource = audioContext.createMediaStreamSource();
        micSource.connect(destination);

        mediaRecorder = new MediaRecorder(destination.stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = function(event) {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = function() {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm'});
            currentConversationData.audioRecording = audioBlob;
            console.log('Full conversation audio recorded (user + AI)');

            displayStream.getTracks().forEach(track => track.stop());
            micStream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start(1000);
        console.log('Recording both user and AI aduio');

    } catch (error) {
        console.error('Error setting up audio recording:', error);

        await setupMicrophoneOnlyRecording();
    }
};


/*
Check this function
*/
async function setupMicrophoneOnlyRecording() {
    try {
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });

        mediaRecorder = new MediaRecorder(micStream);
        audioChunks = [];

        mediaRecorder.ondataavailable = function(event) {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = function() {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            currentConversationData.audioRecording = audioBlob;
            console.log('Microphone-only audio recorded');

            micStream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start(1000);
        console.log('Recording microphone audio only (fallback mode)');
    } catch (error) {
        console.error('Failed to setup any aduir recording:', error);
    }
}


/*
Check this function
*/
function saveConversationHistory() {
    if (!currentConversationData) return;

    const existingConversations = JSON.parse(localStorage.getItem('conversationHistory') || '[]');

    existingConversations.push({
        ...currentConversationData,
        audioRecording: null
    });

    localStorage.setItem('conversationHistory', JSON.stringify(existingConversations));

    console.log('Conversation saved to history');
}

/*
Check this function
*/
function getConversationHistory() {
    return JSON.parse(localStorage.getItem('conversationHistory') || '[]');
}

/*
Check this function
*/
function captureUserInput(transcript) {
    if (currentConversationData) {
        currentConversationData.userInputs.push({
            timestamp: new Date().toISOString(),
            speaker: 'user',
            text: transcript
        });

        updateTranscriptDisplay('user', transcript);
        console.log('User said:', transcript);
    }
}

/*
Check this function
*/
function simulateUserInputs() {
    const demoConversation = [
        { speaker: 'user', text: "I want to start a food truck business", delay: 2000 },
        { speaker: 'ai', text: "That's exciting! Food trucks can be very profitable. What type of cuisine are you considering?", delay: 4000 },
        { speaker: 'user', text: "I'm thinking about Mexican tacos", delay: 6000 },
        { speaker: 'ai', text: "Excellent choice! Mexican food has broad appeal. Let's discuss your target market and startup costs.", delay: 8000 },
        { speaker: 'user', text: "What about the startup costs?", delay: 10000 },
        { speaker: 'ai', text: "Food truck startup costs typically range from $40,000 to $200,000. This includes the truck, equipment, permits, and initial inventory.", delay: 12000 }
    ];

    demoConversation.forEach(item => {
        setTimeout(() => {
            if (conversationActive) {
                if (item.speaker === 'user') {
                    captureUserInput(item.text);
                } else {
                    captureAIResponse(item.text);
                }
            }
        }, item.delay);
    });
}

/*
Check this function
*/
function captureAIResponse(transcript) {
    if (currentConversationData) {
        currentConversationData.userInputs.push({
            timestamp: new Date().toISOString(),
            speaker: 'ai',
            text: transcript
        });

        updateTranscriptDisplay('ai', transcript);

        if (DEMO_MODE) {
            const utterance = new SpeechSynthesisUtterance(transcript);
            utterance.rate = 0.9;
            utterance.pitch = 1.1;
            speechSynthesis.speak(utterance);
        }
        
        console.log('AI said:', transcript);
    }
}

/*
Check this function
*/
function updateTranscriptDisplay(speaker, text) {
    const transcriptDisplay = document.getElementById('transcript-display');
    if (transcriptDisplay) {
        const transcriptLine = document.createElement('div');
        transcriptLine.className = `transcript-line ${speaker}`;
        transcriptLine.innerHTML = `
        <span class="speaker">${speaker.toUpperCase()}:</span>
        <span class="text">${text}</span>
        `;
        transcriptDisplay.appendChild(transcriptLine);
        transcriptDisplay.scrollTop = transcriptDisplay.scrollHeight;
    }
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

/*
Check this function
*/
async function endConversation() {
    if (!currentConversationId) return;
    
    try {
        updateConnectionStatus('Ending conversation...');
        
        await fetch(`https://tavusapi.com/v2/conversations/${currentConversationId}`, {
            method: 'DELETE',
            headers: {
                'x-api-key': TAVUS_API_KEY
            }
        });

        if (currentConversationData) {
            currentConversationData.endTime = new Date().toISOString();
            currentConversationData.duration = Math.floor((new Date() - new Date(currentConversationData.startTime)) / 1000);
            currentConversationData.status = 'completed';

            if (recognition) recognition.stop();
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                mediaRecorder.stop();
            }

            saveConversationHistory();
        }        
        
        // Clear conversation state
        currentConversationId = null;
        conversationActive = false;
        
        // Clear video container
        const videoContainer = document.querySelector('.video-container');
        videoContainer.innerHTML = '<p>Conversation ended. Click Start to begin a new conversation.</p>';
        
        updateConnectionStatus('Ready to start conversation');
        updateStartButton('Start Conversation');
        
    } catch (error) {
        console.error('Error ending conversation:', error);
        updateConnectionStatus('Error ending conversation');
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