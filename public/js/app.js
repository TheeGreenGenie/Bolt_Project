
let currentUser = null;
let registeredUsers = [];
const storedUsers = localStorage.getItem('businessBoomUsers');
if (storedUsers && storedUsers.trim() !== '') {
    try {
        registeredUsers = JSON.parse(storedUsers);
    } catch (error) {
        console.log('Error parsing stored users, starting fresh');
        registeredUsers = [];
    }
}

function checkAuth() {
    const savedUser = localStorage.getItem('businessBoomUsers');
    if (savedUser) {
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

function signup(email, password) {
    const existingUser = registeredUsers.find(user => user.email === email);
    if (existingUser) {
        alert('User already exists! Please login instead.');
        return false;
    }

    const newUser = {
        name: email.split('@')[0],
        email: email,
        password: password,
        registeredAt: new Date().toISOString()
    };

    registeredUsers.push(newUser);
    localStorage.setItem('businessBoomUsers', JSON.stringify(registeredUsers));

    alert('Signup successful! Please login.');
    closeSignupModal();
    showLoginModal();
    return true;
}

function login(email, password) {
    console.log(`I'm loading`)
    const user = registeredUsers.find(u => u.email === email && u.password === password);

    if (!user) {
        alert('Invalid email or passowrd!');
        return false;
    }

    currentUser = {
        name: user.name,
        email: user.email,
        loginTime: new Date().toISOString(),
        tier: 'free'
    };

    localStorage.setItem('businessBoomUsers', JSON.stringify(currentUser));
    closeLoginModal();
    window.location.href = 'dashboard.html';
    return true;
}

function logout() {
    console.log(`Before logout (${currentUser})`);
    console.log(`Before logout - localStorage keys: (${Object.keys(localStorage)})`);
    console.log(`businessBoomUsers: (${localStorage.getItem('businessBoomUsers')})`);
    currentUser = null;
    localStorage.removeItem('businessBoomUsers');

    console.log(`After logout - localStorage keys: (${Object.keys(localStorage)})`);
    console.log(`businessBoomUsers: (${localStorage.getItem('businessBoomUsers')})`);

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

    updateNavigation();
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
          password = document.getElementById('signupPassword').value;

    if (!email || !password) {
        alert('Please fill in all fields');
        return;
    }

    signup(email, password);
}