// Simple AuthManager - Back to Basics
class AuthManager {
  constructor() {
    this.currentUser = null;
    this.currentUserProfile = null;
    this.usernameCheckTimeout = null;
    this.headerMenuManager = null;
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.setupValidation();
    this.initializeHeaderMenu();
    
    // Wait for supabase to be ready before setting up auth listener
    this.setupAuthListener();
  }

  async setupAuthListener() {
    // Wait for supabase to be available
    while (!window.supabase) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Now set up the auth state listener
    window.supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        this.handleUserSignedIn(session.user);
      } else if (event === 'SIGNED_OUT') {
        this.handleUserSignedOut();
      }
    });
  }

  initializeHeaderMenu() {
    this.headerMenuManager = new HeaderMenuManager();
  }

  setupEventListeners() {
    // Wait for DOM to be fully loaded
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.attachModalEventListeners();
      });
    } else {
      this.attachModalEventListeners();
    }

    this.setupFormListeners();
    
    // Global escape key listener
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeAllModals();
      }
    });
  }

  attachModalEventListeners() {
    // Login modal close button
    const closeModal = document.getElementById('closeModal');
    if (closeModal) {
      closeModal.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.closeModal('loginModal');
      });
    }

    // Signup modal close button
    const closeSignupModal = document.getElementById('closeSignupModal');
    if (closeSignupModal) {
      closeSignupModal.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.closeModal('signupModal');
      });
    }

    // Upload modal close button
    const closeUploadModal = document.getElementById('closeUploadModal');
    if (closeUploadModal) {
      closeUploadModal.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.closeModal('uploadModal');
      });
    }

    this.setupClickOutsideListeners();
  }

  setupFormListeners() {
    // Login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleLogin();
      });
    }

    // Signup form
    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
      signupForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleSignup();
      });
    }

    // Signup link
    const signupLink = document.getElementById('signupLink');
    if (signupLink) {
      signupLink.addEventListener('click', (e) => {
        e.preventDefault();
        this.switchToSignup();
      });
    }
  }

  setupClickOutsideListeners() {
    // Login modal
    const loginModal = document.getElementById('loginModal');
    if (loginModal) {
      loginModal.addEventListener('click', (e) => {
        if (e.target === loginModal) {
          this.closeModal('loginModal');
        }
      });
    }

    // Signup modal
    const signupModal = document.getElementById('signupModal');
    if (signupModal) {
      signupModal.addEventListener('click', (e) => {
        if (e.target === signupModal) {
          this.closeModal('signupModal');
        }
      });
    }

    // Upload modal
    const uploadModal = document.getElementById('uploadModal');
    if (uploadModal) {
      uploadModal.addEventListener('click', (e) => {
        if (e.target === uploadModal) {
          this.closeModal('uploadModal');
        }
      });
    }
  }

  setupValidation() {
    const signupUsername = document.getElementById('signupUsername');
    const signupEmail = document.getElementById('signupEmail');
    const signupPassword = document.getElementById('signupPassword');
    const loginEmail = document.getElementById('loginEmail');

    // Real-time username validation
    if (signupUsername) {
      signupUsername.addEventListener('input', () => {
        this.validateUsername(signupUsername.value);
      });
    }

    // Email validation
    if (signupEmail) {
      signupEmail.addEventListener('blur', () => {
        this.validateEmail(signupEmail.value, 'signupEmailError');
      });
    }

    if (loginEmail) {
      loginEmail.addEventListener('blur', () => {
        this.validateEmail(loginEmail.value, 'loginEmailError');
      });
    }

    // Password validation
    if (signupPassword) {
      signupPassword.addEventListener('input', () => {
        this.validatePassword(signupPassword.value);
      });
    }

    // Clear errors on input
    [signupUsername, signupEmail, signupPassword, loginEmail].forEach(input => {
      if (input) {
        input.addEventListener('input', () => {
          this.clearFieldError(input);
        });
      }
    });
  }

  // === VALIDATION METHODS ===

  async validateUsername(username) {
    const statusEl = document.getElementById('usernameStatus');
    const errorEl = document.getElementById('signupUsernameError');
    const inputEl = document.getElementById('signupUsername');

    if (!statusEl || !errorEl || !inputEl) return;

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
        // Wait for supabase to be ready
        while (!window.supabase) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        const { data: existingUser } = await window.supabase
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
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.classList.add('show');
    }
  }

  hideError(elementId) {
    const errorEl = document.getElementById(elementId);
    if (errorEl) {
      errorEl.classList.remove('show');
    }
  }

  showSuccess(elementId, message) {
    const successEl = document.getElementById(elementId);
    if (successEl) {
      successEl.textContent = message;
      successEl.classList.add('show');
    }
  }

  hideSuccess(elementId) {
    const successEl = document.getElementById(elementId);
    if (successEl) {
      successEl.classList.remove('show');
    }
  }

  showFieldError(elementId, message) {
    const errorEl = document.getElementById(elementId);
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.classList.add('show');
    }
  }

  hideFieldError(elementId) {
    const errorEl = document.getElementById(elementId);
    if (errorEl) {
      errorEl.classList.remove('show');
    }
  }

  clearFieldError(inputEl) {
    if (inputEl) {
      inputEl.classList.remove('error');
    }
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
    const usernameStatus = document.getElementById('usernameStatus');
    if (usernameStatus) {
      usernameStatus.className = 'validation-status';
    }
  }

  // === AUTH HANDLERS ===

  async handleLogin() {
    const emailEl = document.getElementById('loginEmail');
    const passwordEl = document.getElementById('loginPassword');
    const loginButton = document.getElementById('loginButton');

    if (!emailEl || !passwordEl || !loginButton) return;

    const email = emailEl.value;
    const password = passwordEl.value;

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
    loginButton.textContent = 'signing in...';

    try {
      const { data, error } = await supabaseHelpers.signIn(email, password);

      if (error) {
        this.showError('loginError', this.getAuthErrorMessage(error.message));
        return;
      }

      // Success is handled by onAuthStateChange
      const loginForm = document.getElementById('loginForm');
      if (loginForm) {
        loginForm.reset();
      }

    } catch (error) {
      console.error('Login error:', error);
      this.showError('loginError', 'Login failed. Please try again.');
    } finally {
      loginButton.classList.remove('loading');
      loginButton.disabled = false;
      loginButton.textContent = 'sign in';
    }
  }

  async handleSignup() {
    const emailEl = document.getElementById('signupEmail');
    const usernameEl = document.getElementById('signupUsername');
    const passwordEl = document.getElementById('signupPassword');
    const signupButton = document.getElementById('signupButton');

    if (!emailEl || !usernameEl || !passwordEl || !signupButton) return;

    const email = emailEl.value;
    const username = usernameEl.value;
    const password = passwordEl.value;

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
      // Wait for supabase to be ready
      while (!window.supabase) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Check username availability one more time
      const { data: existingUser } = await window.supabase
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
      const signupForm = document.getElementById('signupForm');
      if (signupForm) {
        signupForm.reset();
      }
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
      signupButton.textContent = 'create account';
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
      // Wait for supabase to be ready
      while (!window.supabase) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Get user profile
      const { data: profile, error } = await window.supabase
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
      const loggedInUsername = document.getElementById('loggedInUsername');
      const userAvatar = document.getElementById('userAvatar');

      if (loggedInUsername) {
        loggedInUsername.textContent = profile.username;
      }
      if (userAvatar) {
        userAvatar.textContent = profile.username[0]?.toUpperCase() || 'U';
      }

      // Update header menu
      if (this.headerMenuManager) {
        this.headerMenuManager.onUserLogin(profile.username);
      }

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
    const uploadModal = document.getElementById('uploadModal');
    if (uploadModal) {
      uploadModal.classList.add('hidden');
    }
    
    // Update header menu
    if (this.headerMenuManager) {
      this.headerMenuManager.onUserLogout();
    }
    
    console.log('User signed out');
  }

  // === MODAL CONTROLS ===

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('hidden');
      this.clearAllErrors();
      
      // Reset forms
      if (modalId === 'loginModal') {
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
          loginForm.reset();
        }
      }
      if (modalId === 'signupModal') {
        const signupForm = document.getElementById('signupForm');
        if (signupForm) {
          signupForm.reset();
        }
      }
    }
  }

  closeAllModals() {
    this.closeModal('loginModal');
    this.closeModal('signupModal');
    this.closeModal('uploadModal');
    
    // Also close upload confirmation modal
    const confirmModal = document.getElementById('uploadConfirmModal');
    if (confirmModal) {
      confirmModal.classList.add('hidden');
    }
  }

  switchToSignup() {
    this.closeModal('loginModal');
    const signupModal = document.getElementById('signupModal');
    if (signupModal) {
      signupModal.classList.remove('hidden');
      const signupEmail = document.getElementById('signupEmail');
      if (signupEmail) {
        signupEmail.focus();
      }
    }
  }

  switchToLogin() {
    this.closeModal('signupModal');
    const loginModal = document.getElementById('loginModal');
    if (loginModal) {
      loginModal.classList.remove('hidden');
      const loginEmail = document.getElementById('loginEmail');
      if (loginEmail) {
        loginEmail.focus();
      }
    }
  }

  // === PUBLIC METHODS ===

  showLoginModal() {
    if (this.currentUser) {
      const uploadModal = document.getElementById('uploadModal');
      if (uploadModal) {
        uploadModal.classList.remove('hidden');
        // Load photos after modal opens
        setTimeout(async () => {
          if (window.uploadManager && window.uploadManager.loadUserPhotos) {
            await window.uploadManager.loadUserPhotos();
          }
        }, 100);
      }
    } else {
      const loginModal = document.getElementById('loginModal');
      if (loginModal) {
        loginModal.classList.remove('hidden');
        const loginEmail = document.getElementById('loginEmail');
        if (loginEmail) {
          loginEmail.focus();
        }
      }
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

// Header Menu Manager - Simple Version
class HeaderMenuManager {
  constructor() {
    this.headerMenu = null;
    this.primaryLabel = null;
    this.hoverLabel = null;
    this.submenu = null;
    this.logoutMenuItem = null;
    this.isLoggedIn = false;
    this.currentViewingUser = null;
    this.init();
  }

  init() {
    // Get DOM elements
    this.headerMenu = document.getElementById('headerMenu');
    this.primaryLabel = document.getElementById('primaryLabel');
    this.hoverLabel = document.getElementById('hoverLabel');
    this.submenu = document.getElementById('submenu');
    this.logoutMenuItem = document.getElementById('logoutMenuItem');

    // Set up event listeners
    this.setupEventListeners();
    
    // Set initial state (will be updated by router)
    this.updateMenuState(false, null);
  }

  setupEventListeners() {
    // Main menu click
    if (this.headerMenu) {
      this.headerMenu.addEventListener('click', () => {
        this.handleMenuClick();
      });
    }

    // Logout menu item click
    if (this.logoutMenuItem) {
      this.logoutMenuItem.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent menu click from firing
        this.handleLogout();
      });
    }

    // Keyboard navigation
    if (this.headerMenu) {
      this.headerMenu.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.handleMenuClick();
        }
      });
    }
  }

  handleMenuClick() {
    if (window.authManager) {
      window.authManager.showLoginModal();
    }
  }

  async handleLogout() {
    try {
      if (window.authManager) {
        await window.authManager.logout();
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  // Update menu state based on authentication and current user
  updateMenuState(isLoggedIn, loggedInUsername) {
    this.isLoggedIn = isLoggedIn;
    
    // Get current viewing user from router
    const currentPath = window.location.pathname;
    if (currentPath.startsWith('/u/')) {
      this.currentViewingUser = currentPath.split('/u/')[1];
    } else {
      this.currentViewingUser = 'anonymous';
    }

    // Always show whose gallery we're viewing
    if (this.primaryLabel) {
      if (this.currentViewingUser && this.currentViewingUser !== 'anonymous') {
        this.primaryLabel.textContent = `damnpictures / ${this.currentViewingUser}`;
      } else {
        this.primaryLabel.textContent = 'damnpictures';
      }
    }
    
    if (isLoggedIn && loggedInUsername) {
      // Logged in state - can manage pictures
      if (this.headerMenu) {
        this.headerMenu.className = 'header-menu logged-in';
      }
      if (this.hoverLabel) {
        this.hoverLabel.textContent = 'manage pictures';
      }
      if (this.submenu) {
        this.submenu.style.display = '';
      }
    } else {
      // Logged out state - should log in
      if (this.headerMenu) {
        this.headerMenu.className = 'header-menu logged-out';
      }
      if (this.hoverLabel) {
        this.hoverLabel.textContent = 'log in / sign up';
      }
      if (this.submenu) {
        this.submenu.style.display = 'none';
      }
    }
  }

  // Method to be called when user logs in
  onUserLogin(username) {
    this.updateMenuState(true, username);
  }

  // Method to be called when user logs out
  onUserLogout() {
    this.updateMenuState(false, null);
  }

  // Method to be called when viewing user changes (from router)
  onViewingUserChange(username) {
    this.currentViewingUser = username;
    this.updateMenuState(this.isLoggedIn, this.isLoggedIn ? window.authManager?.getCurrentUserProfile()?.username : null);
  }
}

// Initialize auth manager - SIMPLE VERSION
document.addEventListener('DOMContentLoaded', () => {
  window.authManager = new AuthManager();

  // Make functions available globally for compatibility
  window.getCurrentUserProfile = () => window.authManager.getCurrentUserProfile();
  window.isLoggedIn = () => window.authManager.isLoggedIn();
  
  // Make header menu manager available globally
  window.headerMenuManager = window.authManager.headerMenuManager;
});

// Export for other modules
window.AuthManager = AuthManager;
window.HeaderMenuManager = HeaderMenuManager;