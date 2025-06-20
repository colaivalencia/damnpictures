// ===== AUTHENTICATION SYSTEM =====

const label = document.getElementById('colaiLabel');
const logoutButton = document.getElementById('logoutButtonInline');

// Modal elements
const loginModal = document.getElementById('loginModal');
const signupModal = document.getElementById('signupModal');
const uploadModal = document.getElementById('uploadModal');

const closeModalBtn = document.getElementById('closeModal');
const closeSignupBtn = document.getElementById('closeSignupModal');
const closeUploadBtn = document.getElementById('closeUploadModal');

const signupLink = document.getElementById('signupLink');
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const loggedInUsername = document.getElementById('loggedInUsername');
const userAvatar = document.getElementById('userAvatar');

// Current user state
let currentUser = null;
let currentUserProfile = null;

// ===== AUTHENTICATION HANDLERS =====

// Check for existing session on page load
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN' && session) {
    handleUserSignedIn(session.user);
  } else if (event === 'SIGNED_OUT') {
    handleUserSignedOut();
  }
});

async function handleUserSignedIn(user) {
  currentUser = user;
  
  // Get user profile
  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error('Error fetching user profile:', error);
    return;
  }

  currentUserProfile = profile;
  
  // Update UI
  loggedInUsername.textContent = profile.username;
  userAvatar.textContent = profile.username[0]?.toUpperCase() || 'U';
  
  // Close any open modals
  loginModal.classList.add('hidden');
  signupModal.classList.add('hidden');
  
  console.log('User signed in:', profile.username);
}

function handleUserSignedOut() {
  currentUser = null;
  currentUserProfile = null;
  uploadModal.classList.add('hidden');
  console.log('User signed out');
}

// ===== LOGIN FORM =====
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  const loginButton = document.getElementById('loginButton');
  
  loginButton.disabled = true;
  loginButton.textContent = 'logging in...';
  
  try {
    const { data, error } = await supabaseHelpers.signIn(email, password);
    
    if (error) {
      alert(`Login failed: ${error.message}`);
      return;
    }
    
    // Success is handled by onAuthStateChange
    loginForm.reset();
    
  } catch (error) {
    console.error('Login error:', error);
    alert('Login failed. Please try again.');
  } finally {
    loginButton.disabled = false;
    loginButton.textContent = 'login';
  }
});

// ===== SIGNUP FORM =====
signupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const email = document.getElementById('signupEmail').value;
  const username = document.getElementById('signupUsername').value;
  const password = document.getElementById('signupPassword').value;
  const signupButton = e.target.querySelector('.primary-btn');
  
  // Basic validation
  if (username.length < 3) {
    alert('Username must be at least 3 characters long');
    return;
  }
  
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    alert('Username can only contain letters, numbers, and underscores');
    return;
  }
  
  signupButton.disabled = true;
  signupButton.textContent = 'creating account...';
  
  try {
    // Check if username is already taken
    const { data: existingUser } = await supabase
      .from('user_profiles')
      .select('username')
      .eq('username', username)
      .single();
    
    if (existingUser) {
      alert('Username is already taken. Please choose another one.');
      return;
    }
    
    // Create account
    const { data, error } = await supabaseHelpers.signUp(email, password, username);
    
    if (error) {
      alert(`Signup failed: ${error.message}`);
      return;
    }
    
    alert('Account created successfully! Please check your email to verify your account.');
    signupModal.classList.add('hidden');
    loginModal.classList.remove('hidden');
    signupForm.reset();
    
  } catch (error) {
    console.error('Signup error:', error);
    alert('Signup failed. Please try again.');
  } finally {
    signupButton.disabled = false;
    signupButton.textContent = 'sign up';
  }
});

// ===== LOGOUT =====
logoutButton.addEventListener('click', async () => {
  try {
    const { error } = await supabaseHelpers.signOut();
    if (error) {
      console.error('Logout error:', error);
    }
  } catch (error) {
    console.error('Logout error:', error);
  }
});

// ===== MODAL CONTROLS =====

// Show login modal when clicking label
label.addEventListener('click', () => {
  if (currentUser) {
    // If logged in, show upload modal
    uploadModal.classList.remove('hidden');
  } else {
    // If not logged in, show login modal
    loginModal.classList.remove('hidden');
    document.getElementById('loginEmail').focus();
  }
});

// Close buttons
closeModalBtn.addEventListener('click', () => {
  loginModal.classList.add('hidden');
  loginForm.reset();
});

closeSignupBtn.addEventListener('click', () => {
  signupModal.classList.add('hidden');
  signupForm.reset();
});

closeUploadBtn.addEventListener('click', () => {
  uploadModal.classList.add('hidden');
});

// Switch to signup
signupLink.addEventListener('click', () => {
  loginModal.classList.add('hidden');
  signupModal.classList.remove('hidden');
  document.getElementById('signupEmail').focus();
});

// Escape key closes modals
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    loginModal.classList.add('hidden');
    signupModal.classList.add('hidden');
    uploadModal.classList.add('hidden');
  }
});

// Add this to your script.js file after the existing label click handler

// FIXED: Ensure photos load when modal opens
label.addEventListener('click', async () => {
  if (currentUser) {
    // If logged in, show upload modal
    uploadModal.classList.remove('hidden');
    
    // MANUALLY trigger photo loading
    console.log('🎯 Modal opened, manually loading photos...');
    if (window.uploadManager && window.uploadManager.loadUserPhotos) {
      await window.uploadManager.loadUserPhotos();
    } else {
      console.warn('⚠️ uploadManager not ready yet');
    }
  } else {
    // If not logged in, show login modal
    loginModal.classList.remove('hidden');
    document.getElementById('loginEmail').focus();
  }
});

// ===== THIRD PARTY AUTH (PLACEHOLDER) =====
document.querySelector('.google').addEventListener('click', async () => {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
    });
    if (error) console.error('Google auth error:', error);
  } catch (error) {
    console.error('Google auth error:', error);
  }
});

// ===== UTILITY FUNCTIONS =====

// Get current user profile
function getCurrentUserProfile() {
  return currentUserProfile;
}

// Check if user is logged in
function isLoggedIn() {
  return !!currentUser;
}

// Make functions available globally for other scripts
window.getCurrentUserProfile = getCurrentUserProfile;
window.isLoggedIn = isLoggedIn;

// ===== DEV SHORTCUTS =====
window.openUploadModal = () => {
  if (currentUser) {
    uploadModal.classList.remove('hidden');
  } else {
    console.log('Please log in first');
  }
};