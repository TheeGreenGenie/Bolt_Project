// Tavus conversation management
let currentConversationId = null;
let conversationActive = false;

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
    //
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