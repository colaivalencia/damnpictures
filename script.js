// Simplified AuthManager with better UX (no social auth)
class AuthManager {
  constructor() {
    this.currentUser = null;
    this.currentUserProfile = null;
    this.usernameCheckTimeout = null;
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.setupValidation();
    
    // Auth state listener
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        this.handleUserSignedIn(session.user);
      } else if (event === 'SIGNED_OUT') {
        this.handleUserSignedOut();
      }
    });
  }

  setupEventListeners() {
    // Login form
    document.getElementById('loginForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleLogin();
    });

    // Signup form
    document.getElementById('signupForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSignup();
    });

    // Modal controls
    document.getElementById('closeModal').addEventListener('click', () => {
      this.closeModal('loginModal');
    });

    document.getElementById('closeSignupModal').addEventListener('click', () => {
      this.closeModal('signupModal');
    });

    document.getElementById('signupLink').addEventListener('click', () => {
      this.switchToSignup();
    });

    // Escape key
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeAllModals();
      }
    });

    // Click outside to close
    document.getElementById('loginModal').addEventListener('click', (e) => {
      if (e.target.id === 'loginModal') {
        this.closeModal('loginModal');
      }
    });

    document.getElementById('signupModal').addEventListener('click', (e) => {
      if (e.target.id === 'signupModal') {
        this.closeModal('signupModal');
      }
    });
  }

  setupValidation() {
    const signupUsername = document.getElementById('signupUsername');
    const signupEmail = document.getElementById('signupEmail');
    const signupPassword = document.getElementById('signupPassword');
    const loginEmail = document.getElementById('loginEmail');

    // Real-time username validation
    signupUsername.addEventListener('input', () => {
      this.validateUsername(signupUsername.value);
    });

    // Email validation
    signupEmail.addEventListener('blur', () => {
      this.validateEmail(signupEmail.value, 'signupEmailError');
    });

    loginEmail.addEventListener('blur', () => {
      this.validateEmail(loginEmail.value, 'loginEmailError');
    });

    // Password validation
    signupPassword.addEventListener('input', () => {
      this.validatePassword(signupPassword.value);
    });

    // Clear errors on input
    [signupUsername, signupEmail, signupPassword, loginEmail].forEach(input => {
      input.addEventListener('input', () => {
        this.clearFieldError(input);
      });
    });
  }

  // === VALIDATION METHODS ===

  validateUsername(username) {
    const statusEl = document.getElementById('usernameStatus');
    const errorEl = document.getElementById('signupUsernameError');
    const inputEl = document.getElementById('signupUsername');

    // Clear previous timeout
    if (this.usernameCheckTimeout) {
      clearTimeout(this.usernameCheckTimeout);
    }

    // Hide status and errors
    statusEl.className = 'validation-status';
    this.hideFieldError('signupUsernameError');
    inputEl.classList.remove('error', 'checking');

    // Basic validation
    if (username.length === 0) return;

    if (username.length < 3) {
      this.showFieldError('signupUsernameError', 'Username must be at least 3 characters');
      inputEl.classList.add('error');
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      this.showFieldError('signupUsernameError', 'Username can only contain letters, numbers, and underscores');
      inputEl.classList.add('error');
      return;
    }

    // Show checking status
    inputEl.classList.add('checking');
    statusEl.textContent = 'Checking availability...';
    statusEl.className = 'validation-status checking';

    // Debounced availability check
    this.usernameCheckTimeout = setTimeout(async () => {
      try {
        const { data: existingUser } = await supabase
          .from('user_profiles')
          .select('username')
          .eq('username', username)
          .single();

        inputEl.classList.remove('checking');

        if (existingUser) {
          statusEl.textContent = 'Username is taken';
          statusEl.className = 'validation-status taken';
          inputEl.classList.add('error');
        } else {
          statusEl.textContent = 'Username is available';
          statusEl.className = 'validation-status available';
        }
      } catch (error) {
        inputEl.classList.remove('checking');
        statusEl.className = 'validation-status';
        console.error('Username check error:', error);
      }
    }, 500);
  }

  validateEmail(email, errorElementId) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (email && !emailRegex.test(email)) {
      this.showFieldError(errorElementId, 'Please enter a valid email address');
      return false;
    }
    
    this.hideFieldError(errorElementId);
    return true;
  }

  validatePassword(password) {
    if (password.length === 0) {
      this.hideFieldError('signupPasswordError');
      return;
    }

    if (password.length < 6) {
      this.showFieldError('signupPasswordError', 'Password must be at least 6 characters');
      return false;
    }

    this.hideFieldError('signupPasswordError');
    return true;
  }

  // === ERROR MESSAGE METHODS ===

  showError(elementId, message) {
    const errorEl = document.getElementById(elementId);
    errorEl.textContent = message;
    errorEl.classList.add('show');
  }

  hideError(elementId) {
    const errorEl = document.getElementById(elementId);
    errorEl.classList.remove('show');
  }

  showSuccess(elementId, message) {
    const successEl = document.getElementById(elementId);
    successEl.textContent = message;
    successEl.classList.add('show');
  }

  hideSuccess(elementId) {
    const successEl = document.getElementById(elementId);
    successEl.classList.remove('show');
  }

  showFieldError(elementId, message) {
    const errorEl = document.getElementById(elementId);
    errorEl.textContent = message;
    errorEl.classList.add('show');
  }

  hideFieldError(elementId) {
    const errorEl = document.getElementById(elementId);
    errorEl.classList.remove('show');
  }

  clearFieldError(inputEl) {
    inputEl.classList.remove('error');
  }

  clearAllErrors() {
    // Clear main error messages
    this.hideError('loginError');
    this.hideError('signupError');
    this.hideSuccess('signupSuccess');

    // Clear field errors
    ['loginEmailError', 'loginPasswordError', 'signupEmailError', 'signupUsernameError', 'signupPasswordError'].forEach(id => {
      this.hideFieldError(id);
    });

    // Clear error states from inputs
    document.querySelectorAll('.form-group input').forEach(input => {
      input.classList.remove('error', 'checking');
    });

    // Clear username status
    document.getElementById('usernameStatus').className = 'validation-status';
  }

  // === AUTH HANDLERS ===

  async handleLogin() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const loginButton = document.getElementById('loginButton');

    // Clear previous errors
    this.hideError('loginError');

    // Validate
    if (!email || !password) {
      this.showError('loginError', 'Please fill in all fields');
      return;
    }

    if (!this.validateEmail(email, 'loginEmailError')) {
      return;
    }

    // Set loading state
    loginButton.classList.add('loading');
    loginButton.disabled = true;
    loginButton.textContent = 'logging in...';

    try {
      const { data, error } = await supabaseHelpers.signIn(email, password);

      if (error) {
        this.showError('loginError', this.getAuthErrorMessage(error.message));
        return;
      }

      // Success is handled by onAuthStateChange
      document.getElementById('loginForm').reset();

    } catch (error) {
      console.error('Login error:', error);
      this.showError('loginError', 'Login failed. Please try again.');
    } finally {
      loginButton.classList.remove('loading');
      loginButton.disabled = false;
      loginButton.textContent = 'login';
    }
  }

  async handleSignup() {
    const email = document.getElementById('signupEmail').value;
    const username = document.getElementById('signupUsername').value;
    const password = document.getElementById('signupPassword').value;
    const signupButton = document.getElementById('signupButton');

    // Clear previous messages
    this.hideError('signupError');
    this.hideSuccess('signupSuccess');

    // Validate all fields
    let hasErrors = false;

    if (!email || !username || !password) {
      this.showError('signupError', 'Please fill in all fields');
      return;
    }

    if (!this.validateEmail(email, 'signupEmailError')) hasErrors = true;
    if (!this.validatePassword(password)) hasErrors = true;

    // Check username
    if (username.length < 3) {
      this.showFieldError('signupUsernameError', 'Username must be at least 3 characters');
      hasErrors = true;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      this.showFieldError('signupUsernameError', 'Username can only contain letters, numbers, and underscores');
      hasErrors = true;
    }

    if (hasErrors) return;

    // Set loading state
    signupButton.classList.add('loading');
    signupButton.disabled = true;
    signupButton.textContent = 'creating account...';

    try {
      // Check username availability one more time
      const { data: existingUser } = await supabase
        .from('user_profiles')
        .select('username')
        .eq('username', username)
        .single();

      if (existingUser) {
        this.showError('signupError', 'Username is already taken. Please choose another one.');
        return;
      }

      // Create account
      const { data, error } = await supabaseHelpers.signUp(email, password, username);

      if (error) {
        this.showError('signupError', this.getAuthErrorMessage(error.message));
        return;
      }

      // Success
      this.showSuccess('signupSuccess', 'Account created! Please check your email to verify your account.');
      document.getElementById('signupForm').reset();
      this.clearAllErrors();

      // Switch to login after delay
      setTimeout(() => {
        this.switchToLogin();
      }, 3000);

    } catch (error) {
      console.error('Signup error:', error);
      this.showError('signupError', 'Signup failed. Please try again.');
    } finally {
      signupButton.classList.remove('loading');
      signupButton.disabled = false;
      signupButton.textContent = 'sign up';
    }
  }

  getAuthErrorMessage(errorMessage) {
    // Convert Supabase error messages to user-friendly ones
    if (errorMessage.includes('Invalid login credentials')) {
      return 'Invalid email or password. Please try again.';
    }
    if (errorMessage.includes('Email not confirmed')) {
      return 'Please check your email and click the verification link before logging in.';
    }
    if (errorMessage.includes('User already registered')) {
      return 'An account with this email already exists. Try logging in instead.';
    }
    return errorMessage;
  }

  // === USER STATE HANDLERS ===

  async handleUserSignedIn(user) {
    this.currentUser = user;

    try {
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

      this.currentUserProfile = profile;

      // Update UI
      document.getElementById('loggedInUsername').textContent = profile.username;
      document.getElementById('userAvatar').textContent = profile.username[0]?.toUpperCase() || 'U';

      // Close modals
      this.closeAllModals();

      console.log('User signed in:', profile.username);

    } catch (error) {
      console.error('Error handling sign in:', error);
    }
  }

  handleUserSignedOut() {
    this.currentUser = null;
    this.currentUserProfile = null;
    document.getElementById('uploadModal').classList.add('hidden');
    console.log('User signed out');
  }

  // === MODAL CONTROLS ===

  closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
    this.clearAllErrors();
    
    // Reset forms
    if (modalId === 'loginModal') {
      document.getElementById('loginForm').reset();
    }
    if (modalId === 'signupModal') {
      document.getElementById('signupForm').reset();
    }
  }

  closeAllModals() {
    this.closeModal('loginModal');
    this.closeModal('signupModal');
    document.getElementById('uploadModal').classList.add('hidden');
  }

  switchToSignup() {
    this.closeModal('loginModal');
    document.getElementById('signupModal').classList.remove('hidden');
    document.getElementById('signupEmail').focus();
  }

  switchToLogin() {
    this.closeModal('signupModal');
    document.getElementById('loginModal').classList.remove('hidden');
    document.getElementById('loginEmail').focus();
  }

  // === PUBLIC METHODS ===

  showLoginModal() {
    if (this.currentUser) {
      document.getElementById('uploadModal').classList.remove('hidden');
      // Load photos after modal opens
      setTimeout(async () => {
        if (window.uploadManager && window.uploadManager.loadUserPhotos) {
          await window.uploadManager.loadUserPhotos();
        }
      }, 100);
    } else {
      document.getElementById('loginModal').classList.remove('hidden');
      document.getElementById('loginEmail').focus();
    }
  }

  getCurrentUserProfile() {
    return this.currentUserProfile;
  }

  isLoggedIn() {
    return !!this.currentUser;
  }

  async logout() {
    try {
      const { error } = await supabaseHelpers.signOut();
      if (error) {
        console.error('Logout error:', error);
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
  }
}

// Initialize auth manager
document.addEventListener('DOMContentLoaded', () => {
  window.authManager = new AuthManager();

  // Update label click handler
  document.getElementById('colaiLabel').addEventListener('click', () => {
    window.authManager.showLoginModal();
  });

  // Update logout button
  document.getElementById('logoutButtonInline').addEventListener('click', () => {
    window.authManager.logout();
  });

  // Make functions available globally for compatibility
  window.getCurrentUserProfile = () => window.authManager.getCurrentUserProfile();
  window.isLoggedIn = () => window.authManager.isLoggedIn();
});

// Export for other modules
window.AuthManager = AuthManager;