
let currentUser = null,
    authToken = null,
    currentBusiness = null,
    currentConversation = null;

const API_BASE_URL = 'http://localhost:3002/api';

document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
})

function checkAuth() {
    const savedUser = localStorage.getItem('businessBoomUser'),
          savedToken = localStorage.getItem('businessBoomToken');

    if (savedToken && savedUser) {
        authToken = savedToken;
        currentUser = JSON.parse(savedUser);
        console.log('User logged in:', currentUser)
        updateUIForLoggedInUser();
    } else {
        console.log('No user logged in');
        const protectedPages = ['dashboard.html', 'analysis.html', 'conversation.html'];
        const currentPage = window.location.pathname.split('/').pop();
        if (protectedPages.includes(currentPage)) {
            window.location.href = 'index.html'
        }
    }
}

async function signup(email, password, name) {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password, name })
        });

        const data = await response.json();

        if (!response.ok) {
            alert(data.error || 'Signup failed');
            return false;
        }

        // Auto-login after successful signup
        authToken = data.token;
        currentUser = data.user;
        
        localStorage.setItem('businessBoomToken', authToken);
        localStorage.setItem('businessBoomUser', JSON.stringify(currentUser));
        
        alert('Signup successful! Welcome to Business Boom!');
        closeSignupModal();
        window.location.href = 'dashboard.html';
        return true;

    } catch (error) {
        console.error('Signup error:', error);
        alert('Signup failed. Please try again.');
        return false;
    }
}

async function login(email, password) {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            alert(data.error || 'Login failed');
            return false;
        }

        authToken = data.token;
        currentUser = data.user;
        
        localStorage.setItem('businessBoomToken', authToken);
        localStorage.setItem('businessBoomUser', JSON.stringify(currentUser));
        
        closeLoginModal();
        window.location.href = 'dashboard.html';
        return true;

    } catch (error) {
        console.error('Login error:', error);
        alert('Login failed. Please try again.');
        return false;
    }
}

function logout() {
    console.log(`Before logout (${currentUser})`);
    currentUser = null;
    authToken = null;
    currentBusiness = null;
    currentConversation = null;
    
    localStorage.removeItem('businessBoomToken');
    localStorage.removeItem('businessBoomUser');
    localStorage.removeItem('currentBusiness');
    
    window.location.href = 'index.html';
}

function navigateTo(page) {
    const protectedPages = ['dashboard', 'analysis', 'conversation'];
    if (protectedPages.includes(page) && !currentUser) {
        showLoginModal();
        return;
    }

    window.location.href = page + '.html';
}

function updateUIForLoggedInUser() {
    const welcomeElement = document.querySelector('.welcome h1');
    if (welcomeElement && currentUser) {
        welcomeElement.textContent = `Welcome ${currentUser.name}! Let's start Your Business`;
    }
}

function createLoginModal() {
    const modal = document.createElement('div');
    modal.id ='loginModal';
    modal.className = 'modal';
    modal.style.display = 'none';
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close" onclick="closeLoginModal()">&times;</span>
            <h2>Login to Business Boom</h2>
            <form id="loginForm" onsubumit="handleLogin(event)">
                <input type="email" id="email" placeholder="Email" required>
                <input type="password" id="password" placeholder="Password" required>
                <button type="submit">Login</button>
                <button type="button" onclick="closeLoginModal()">Cancel</button>
            </form>
        </div>
    `;
    document.body.appendChild(modal)
}

function createSignupModal() {
    const modal = document.createElement('div');
    modal.id = 'signupModal';
    modal.className = 'modal';
    modal.style.display = 'none';
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close" onclick="closeSignupModal()">&times;</span>
            <h2>Sign Up for Business Boom</h2>
            <form id="signupForm" onsubmit="handleSignup(event)">
                <input type="text" id="signupName" placeholder="Full Name" required>
                <input type="email" id="signupEmail" placeholder="Email" required>
                <input type="password" id="signupPassword" placeholder="Password" required>
                <button type="submit">Sign Up</button>
                <button type="button" onclick="closeSignupModal()">Cancel</button>
            </form>
        </div>
    `
    document.body.appendChild(modal);
}

function showLoginModal() {
    if (!document.getElementById('loginModal')) {
        createLoginModal();
    }
    document.body.classList.add('modal-open');
    document.getElementById('loginModal').style.display = 'flex';
}

function showSignupModal() {
    if (!document.getElementById('signupModal')) {
        createSignupModal();
    }
    document.body.classList.add('modal-open');
    document.getElementById('signupModal').style.display = 'flex';
}

function closeLoginModal() {
    document.body.classList.remove('modal-open');
    const modal = document.getElementById('loginModal');
    if (modal) {
        modal.remove();
    }
}

function closeSignupModal() {
    document.body.classList.remove('modal-open');
    const modal = document.getElementById('signupModal');
    if (modal) {
        modal.remove();
    }
}

function handleLogin(event) {
    event.preventDefault();

    const email = document.getElementById('email').value,
          password = document.getElementById('password').value;

    if (!email || !password) {
        alert('Please fill in all fields');
        return;
    }

    login(email, password);
}

function handleSignup(event) {
    event.preventDefault();

    const email = document.getElementById('signupEmail').value,
          name = document.getElementById('signupName').value,
          password = document.getElementById('signupPassword').value;

    if (!email || !password || !name) {
        alert('Please fill in all fields');
        return;
    }

    signup(email, password, name);
}

async function loadUserBusinesses() {
    try {
        const response = await fetch(`${API_BASE_URL}/businesses`, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load businesses');
        }

        const data = await response.json();
        return data.businesses;
    } catch (error) {
        console.error('Error loading businesses:', error);
        return [];
    }
}

async function findOrCreateBusiness(businessData) {
    try {
        const response = await fetch(`${API_BASE_URL}/businesses/find-or-create`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(businessData)
        });

        const data = await response.json();

        if (data.action === 'confirm') {
            // Show modal for user to confirm if it's the same business
            return await showBusinessConfirmationModal(data);
        } else if (data.action === 'created') {
            currentBusiness = data.business;
            localStorage.setItem('currentBusiness', JSON.stringify(currentBusiness));
            return data.business;
        }

    } catch (error) {
        console.error('Error finding/creating business:', error);
        throw error;
    }
}

async function createConfirmedBusiness(businessData) {
    try {
        const response = await fetch(`${API_BASE_URL}/businesses/create-confirmed`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(businessData)
        });

        const data = await response.json();
        currentBusiness = data.business;
        localStorage.setItem('currentBusiness', JSON.stringify(currentBusiness));
        return data.business;

    } catch (error) {
        console.error('Error creating confirmed business:', error);
        throw error;
    }
}

function showBusinessConfirmationModal(data) {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        
        const similarBusinessList = data.similarBusinesses.map(business => 
            `<div class="business-option" onclick="selectExistingBusiness('${business.id}')">
                <h4>${business.business_name}</h4>
                <p>Type: ${business.business_type} | Industry: ${business.industry}</p>
                <p>${business.description}</p>
            </div>`
        ).join('');

        modal.innerHTML = `
            <div class="modal-content">
                <h2>Similar Business Found</h2>
                <p>We found businesses similar to "${data.newBusiness.businessName}". 
                Is this the same as one of these existing businesses?</p>
                
                <div class="similar-businesses">
                    ${similarBusinessList}
                </div>
                
                <div class="modal-buttons">
                    <button onclick="selectNewBusiness()">No, Create New Business</button>
                    <button onclick="closeSimilarBusinessModal()">Cancel</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Store data and resolve function globally for button handlers
        window.businessModalData = data;
        window.businessModalResolve = function(business) {
            if (window.pendingChatMode) {
                window.executeChatModeSwitch(business);
            }
            resolve(business);
        };
    });
}

async function selectExistingBusiness(businessId) {
    try {
        // Load the existing business
        const businesses = await loadUserBusinesses();
        currentBusiness = businesses.find(b => b.id === businessId);
        localStorage.setItem('currentBusiness', JSON.stringify(currentBusiness));
        
        closeSimilarBusinessModal();
        window.businessModalResolve(currentBusiness);
    } catch (error) {
        console.error('Error selecting existing business:', error);
    }
}

async function selectNewBusiness() {
   try {
        const business = await createConfirmedBusiness(window.businessModalData.newBusiness);
        closeSimilarBusinessModal();
        window.businessModalResolve(business);
    } catch (error) {
        console.error('Error creating new business:', error);
    }
}

function closeSimilarBusinessModal() {
    const modal = document.querySelector('.modal');
    if (modal) {
        modal.remove();
    }
}

async function promptForBusinessContext() {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        
        modal.innerHTML = `
            <div class="modal-content">
                <h2>Tell us about your business idea</h2>
                <p>Help us understand what you want to discuss so we can save it properly.</p>
                
                <form id="businessContextForm">
                    <input type="text" id="businessName" placeholder="Business Name" required>
                    <select id="businessType" required>
                        <option value="">Select Business Type</option>
                        <option value="startup">Startup</option>
                        <option value="existing">Existing Business</option>
                        <option value="franchise">Franchise</option>
                        <option value="online">Online Business</option>
                        <option value="service">Service Business</option>
                        <option value="retail">Retail</option>
                        <option value="manufacturing">Manufacturing</option>
                        <option value="consulting">Consulting</option>
                        <option value="other">Other</option>
                    </select>
                    <select id="industry" required>
                        <option value="">Select Industry</option>
                        <option value="technology">Technology</option>
                        <option value="healthcare">Healthcare</option>
                        <option value="finance">Finance</option>
                        <option value="education">Education</option>
                        <option value="food_beverage">Food & Beverage</option>
                        <option value="retail">Retail</option>
                        <option value="real_estate">Real Estate</option>
                        <option value="fitness">Fitness & Wellness</option>
                        <option value="entertainment">Entertainment</option>
                        <option value="automotive">Automotive</option>
                        <option value="construction">Construction</option>
                        <option value="other">Other</option>
                    </select>
                    <textarea id="businessDescription" placeholder="Brief description of your business idea..." rows="3"></textarea>
                    
                    <div class="modal-buttons">
                        <button type="submit">Continue</button>
                        <button type="button" onclick="closeBusinessContextModal()">Cancel</button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);

        document.getElementById('businessContextForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const businessData = {
                businessName: document.getElementById('businessName').value,
                businessType: document.getElementById('businessType').value,
                industry: document.getElementById('industry').value,
                description: document.getElementById('businessDescription').value
            };

            try {
                const business = await findOrCreateBusiness(businessData);
                closeBusinessContextModal();
                resolve(business);
            } catch (error) {
                alert('Error setting up business context. Please try again.');
                console.error(error);
            }
        });

        window.closeBusinessContextModal = function() {
            modal.remove();
            resolve(null);
        };
    });
}

async function startNewConversation(conversationType, tavusConversationId = null) {
    try {
        if (!window.currentBusiness) {
            throw new Error('No business selected');
        }

        const response = await fetch(`${API_BASE_URL}/conversations/start`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                businessId: window.currentBusiness.id,
                conversationType,
                tavusConversationId
            })
        });

        const data = await response.json();
        currentConversation = data.conversation;
        return data.conversation;

    } catch (error) {
        console.error('Error starting conversation:', error);
        throw error;
    }
}

async function addMessageToConversation(sender, content, tokensUsed = null, processingTime = null) {
    try {
        if (!currentConversation) {
            throw new Error('No active conversation');
        }

        const response = await fetch(`${API_BASE_URL}/conversations/${currentConversation.id}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                sender,
                content,
                tokensUsed,
                processingTime
            })
        });

        const data = await response.json();
        return data.message;

    } catch (error) {
        console.error('Error adding message:', error);
        throw error;
    }
}

async function uploadAudioFile(audioBlob) {
    try {
        if (!currentConversation) {
            throw new Error('No active conversation');
        }

        const formData = new FormData();
        formData.append('audio', audioBlob, `conversation-${currentConversation.id}.webm`);

        const response = await fetch(`${API_BASE_URL}/conversations/${currentConversation.id}/audio`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            body: formData
        });

        const data = await response.json();
        return data.audioFile;

    } catch (error) {
        console.error('Error uploading audio:', error);
        throw error;
    }
}

async function endCurrentConversation(transcript, duration, insights = null, actionItems = null) {
    try {
        if (!currentConversation) {
            throw new Error('No active conversation');
        }

        const response = await fetch(`${API_BASE_URL}/conversations/${currentConversation.id}/end`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                transcript,
                duration,
                insights,
                actionItems
            })
        });

        const data = await response.json();
        currentConversation = null;
        return data.conversation;

    } catch (error) {
        console.error('Error ending conversation:', error);
        throw error;
    }
}

function navigateTo(page) {
    const protectedPages = ['dashboard', 'analysis', 'conversation'];
    if (protectedPages.includes(page) && !currentUser) {
        showLoginModal();
        return;
    }

    window.location.href = page + '.html';
}

function updateUIForLoggedInUser() {
    const welcomeElement = document.querySelector('.welcome h1');
    if (welcomeElement && currentUser) {
        welcomeElement.textContent = `Welcome ${currentUser.name}! Let's start Your Business`;
    }
}

function getAuthHeaders() {
    return {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
    };
}

window.findOrCreateBusiness = findOrCreateBusiness
window.startNewConversation = startNewConversation
window.addMessageToConversation = addMessageToConversation
window.promptForBusinessContext = promptForBusinessContext