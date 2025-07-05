// Enhanced AuthManager with FIXED Modal Exit Controls
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
    
    // Auth state listener
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        this.handleUserSignedIn(session.user);
      } else if (event === 'SIGNED_OUT') {
        this.handleUserSignedOut();
      }
    });
  }

  initializeHeaderMenu() {
    // Initialize header menu manager
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

    // Setup form listeners
    this.setupFormListeners();
    
    // Global escape key listener
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeAllModals();
      }
    });
  }

  attachModalEventListeners() {
    console.log('🔗 Attaching modal event listeners...');
    
    // Login modal close button
    const closeModal = document.getElementById('closeModal');
    if (closeModal) {
      console.log('✅ Found login close button');
      closeModal.addEventListener('click', (e) => {
        console.log('🔴 Login close button clicked');
        e.preventDefault();
        e.stopPropagation();
        this.closeModal('loginModal');
      });
    } else {
      console.error('❌ Login close button not found');
    }

    // Signup modal close button
    const closeSignupModal = document.getElementById('closeSignupModal');
    if (closeSignupModal) {
      console.log('✅ Found signup close button');
      closeSignupModal.addEventListener('click', (e) => {
        console.log('🔴 Signup close button clicked');
        e.preventDefault();
        e.stopPropagation();
        this.closeModal('signupModal');
      });
    } else {
      console.error('❌ Signup close button not found');
    }

    // Upload modal close button
    const closeUploadModal = document.getElementById('closeUploadModal');
    if (closeUploadModal) {
      console.log('✅ Found upload close button');
      closeUploadModal.addEventListener('click', (e) => {
        console.log('🔴 Upload close button clicked');
        e.preventDefault();
        e.stopPropagation();
        this.closeModal('uploadModal');
      });
    } else {
      console.error('❌ Upload close button not found');
    }

    // Click outside to close modals
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
    console.log('🎯 Setting up click outside listeners...');

    // Login modal
    const loginModal = document.getElementById('loginModal');
    if (loginModal) {
      loginModal.addEventListener('click', (e) => {
        if (e.target === loginModal) {
          console.log('🔴 Clicked outside login modal');
          this.closeModal('loginModal');
        }
      });
      console.log('✅ Login modal click outside listener added');
    }

    // Signup modal
    const signupModal = document.getElementById('signupModal');
    if (signupModal) {
      signupModal.addEventListener('click', (e) => {
        if (e.target === signupModal) {
          console.log('🔴 Clicked outside signup modal');
          this.closeModal('signupModal');
        }
      });
      console.log('✅ Signup modal click outside listener added');
    }

    // Upload modal
    const uploadModal = document.getElementById('uploadModal');
    if (uploadModal) {
      uploadModal.addEventListener('click', (e) => {
        if (e.target === uploadModal) {
          console.log('🔴 Clicked outside upload modal');
          this.closeModal('uploadModal');
        }
      });
      console.log('✅ Upload modal click outside listener added');
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

  validateUsername(username) {
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
    loginButton.textContent = 'logging in...';

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
      loginButton.textContent = 'login';
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

  // === MODAL CONTROLS (FIXED) ===

  closeModal(modalId) {
    console.log(`🔴 Closing modal: ${modalId}`);
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
      console.log(`✅ Modal ${modalId} closed successfully`);
    } else {
      console.error(`❌ Modal ${modalId} not found`);
    }
  }

  closeAllModals() {
    console.log('🔴 Closing all modals');
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

// Header Menu Manager
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
      this.currentViewingUser = 'anonymous'; // or some default
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

// Initialize auth manager
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Initializing AuthManager...');
  window.authManager = new AuthManager();

  // Make functions available globally for compatibility
  window.getCurrentUserProfile = () => window.authManager.getCurrentUserProfile();
  window.isLoggedIn = () => window.authManager.isLoggedIn();
  
  // Make header menu manager available globally
  window.headerMenuManager = window.authManager.headerMenuManager;
  
  console.log('✅ AuthManager initialized');
});

// Export for other modules
window.AuthManager = AuthManager;
window.HeaderMenuManager = HeaderMenuManager;

// Modal Stability Fixes - Add this to your main script.js or create a separate file

class ModalStabilityManager {
  constructor() {
    this.activeModals = new Set();
    this.isInitialized = false;
    this.sessionCheckInterval = null;
    this.lastActivity = Date.now();
    this.init();
  }

  init() {
    if (this.isInitialized) return;
    
    this.setupGlobalEventHandlers();
    this.setupSessionManagement();
    this.setupActivityTracking();
    this.isInitialized = true;
  }

  setupGlobalEventHandlers() {
    // Prevent accidental modal closure from background clicks
    document.addEventListener('click', (e) => {
      // Only close modal if clicking directly on the modal backdrop, not its children
      if (e.target.classList.contains('modal') && !e.target.closest('.modal-content')) {
        // Add a small delay to prevent accidental closure
        setTimeout(() => {
          if (e.target.classList.contains('modal')) {
            this.closeModal(e.target.id);
          }
        }, 100);
      }
    }, { passive: true });

    // Improved escape key handling
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.activeModals.size > 0) {
        e.preventDefault();
        e.stopPropagation();
        
        // Only close if no input is focused (prevent closing while typing)
        const activeElement = document.activeElement;
        if (!activeElement || !['INPUT', 'TEXTAREA', 'SELECT'].includes(activeElement.tagName)) {
          const lastModal = Array.from(this.activeModals).pop();
          if (lastModal) {
            this.closeModal(lastModal);
          }
        }
      }
    });

    // Prevent form submissions from causing issues
    document.addEventListener('submit', (e) => {
      const form = e.target;
      if (form && form.closest('.modal')) {
        e.preventDefault();
        // Let the specific form handlers deal with it
      }
    });

    // Handle window blur/focus to prevent session issues
    let wasHidden = false;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        wasHidden = true;
      } else if (wasHidden) {
        // Page became visible again - refresh session if needed
        setTimeout(() => {
          this.checkAndRefreshSession();
        }, 1000);
        wasHidden = false;
      }
    });
  }

  setupSessionManagement() {
    // Check session validity every 5 minutes
    this.sessionCheckInterval = setInterval(() => {
      this.checkAndRefreshSession();
    }, 5 * 60 * 1000);

    // Refresh session token every 30 minutes
    setInterval(() => {
      this.refreshSessionToken();
    }, 30 * 60 * 1000);
  }

  setupActivityTracking() {
    // Track user activity to prevent unnecessary logouts
    const activities = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    const updateActivity = () => {
      this.lastActivity = Date.now();
    };

    activities.forEach(event => {
      document.addEventListener(event, updateActivity, { passive: true });
    });
  }

  async checkAndRefreshSession() {
    if (!window.supabase) return;

    try {
      const { data: { session }, error } = await window.supabase.auth.getSession();
      
      if (error) {
        console.warn('Session check error:', error);
        return;
      }

      if (!session) {
        // Session expired - handle gracefully
        this.handleSessionExpired();
        return;
      }

      // Check if session is about to expire (within 5 minutes)
      const expiresAt = new Date(session.expires_at * 1000);
      const now = new Date();
      const minutesUntilExpiry = (expiresAt - now) / (1000 * 60);

      if (minutesUntilExpiry < 5) {
        await this.refreshSessionToken();
      }
    } catch (error) {
      console.warn('Session management error:', error);
    }
  }

  async refreshSessionToken() {
    if (!window.supabase) return;

    try {
      const { data, error } = await window.supabase.auth.refreshSession();
      
      if (error) {
        console.warn('Token refresh error:', error);
        // Don't automatically log out on refresh errors
        return;
      }

      if (data?.session) {
        console.log('Session refreshed successfully');
      }
    } catch (error) {
      console.warn('Token refresh exception:', error);
    }
  }

  handleSessionExpired() {
    // Only handle if user was recently active (within last 30 minutes)
    const timeSinceActivity = Date.now() - this.lastActivity;
    const thirtyMinutes = 30 * 60 * 1000;

    if (timeSinceActivity < thirtyMinutes) {
      // User was recently active - show gentle notification instead of immediate logout
      this.showSessionExpiredNotification();
    } else {
      // User has been inactive - silent logout is okay
      this.performSilentLogout();
    }
  }

  showSessionExpiredNotification() {
    // Close any open modals first
    this.closeAllModals();

    // Show a non-intrusive notification
    const notification = document.createElement('div');
    notification.id = 'sessionExpiredNotification';
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #ff6b6b;
      color: white;
      padding: 16px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 10000;
      font-size: 14px;
      max-width: 300px;
      line-height: 1.4;
    `;
    notification.innerHTML = `
      <div style="margin-bottom: 8px;">Your session has expired</div>
      <button onclick="window.location.reload()" style="
        background: white;
        color: #ff6b6b;
        border: none;
        padding: 6px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        font-weight: bold;
      ">Refresh Page</button>
    `;

    document.body.appendChild(notification);

    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 10000);
  }

  performSilentLogout() {
    // Clear local state
    if (window.supabase) {
      window.supabase.auth.signOut();
    }
    
    // Reset UI state
    this.closeAllModals();
    
    // Trigger UI updates
    if (window.updateLoginState) {
      window.updateLoginState();
    }
  }

  // Modal management methods
  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return false;

    // Prevent the modal from being added multiple times
    if (this.activeModals.has(modalId)) return true;

    this.activeModals.add(modalId);
    modal.classList.remove('hidden');
    
    // Focus management
    setTimeout(() => {
      const firstInput = modal.querySelector('input, button, textarea, select');
      if (firstInput && firstInput.focus) {
        firstInput.focus();
      }
    }, 100);

    return true;
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return false;

    this.activeModals.delete(modalId);
    modal.classList.add('hidden');

    // Clear any form data to prevent state issues
    const forms = modal.querySelectorAll('form');
    forms.forEach(form => {
      if (form.reset) {
        form.reset();
      }
    });

    // Clear error messages
    const errorElements = modal.querySelectorAll('.error-message, .field-error');
    errorElements.forEach(el => {
      el.textContent = '';
      el.style.display = 'none';
    });

    return true;
  }

  closeAllModals() {
    const modals = Array.from(this.activeModals);
    modals.forEach(modalId => {
      this.closeModal(modalId);
    });
  }

  // Method to check if any modal is currently open
  hasOpenModals() {
    return this.activeModals.size > 0;
  }

  // Cleanup method
  destroy() {
    if (this.sessionCheckInterval) {
      clearInterval(this.sessionCheckInterval);
    }
    this.activeModals.clear();
    this.isInitialized = false;
  }
}

// Initialize the modal stability manager
const modalStabilityManager = new ModalStabilityManager();

// Override existing modal functions to use the stability manager
window.openModal = function(modalId) {
  return modalStabilityManager.openModal(modalId);
};

window.closeModal = function(modalId) {
  return modalStabilityManager.closeModal(modalId);
};

// Enhanced click handlers that prevent event bubbling issues
function createSafeClickHandler(callback) {
  return function(e) {
    e.preventDefault();
    e.stopPropagation();
    
    // Debounce rapid clicks
    if (this.lastClick && Date.now() - this.lastClick < 300) {
      return;
    }
    this.lastClick = Date.now();
    
    // Call the original callback
    if (typeof callback === 'function') {
      callback.call(this, e);
    }
  };
}

// Apply safe click handlers to all modal close buttons
document.addEventListener('DOMContentLoaded', () => {
  // Wait a bit for other scripts to load
  setTimeout(() => {
    const closeButtons = document.querySelectorAll('.close-btn, .modal .close-btn');
    closeButtons.forEach(button => {
      const modalId = button.closest('.modal')?.id;
      if (modalId) {
        // Remove existing listeners and add safe one
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
        
        newButton.addEventListener('click', createSafeClickHandler(() => {
          modalStabilityManager.closeModal(modalId);
        }));
      }
    });

    // Apply to specific modal buttons
    const modalButtons = [
      { id: 'closeModal', modal: 'loginModal' },
      { id: 'closeSignupModal', modal: 'signupModal' },
      { id: 'closeUploadModal', modal: 'uploadModal' }
    ];

    modalButtons.forEach(({ id, modal }) => {
      const button = document.getElementById(id);
      if (button) {
        // Remove existing listeners
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
        
        newButton.addEventListener('click', createSafeClickHandler(() => {
          modalStabilityManager.closeModal(modal);
        }));
      }
    });
  }, 1000);
});

// Export for use in other modules
window.modalStabilityManager = modalStabilityManager;

// Enhanced scrolling - arrow keys + smooth mouse wheel
document.addEventListener('DOMContentLoaded', () => {
  const gallery = document.getElementById('gallery');
  
  // Arrow key navigation
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const scrollAmount = e.key === 'ArrowRight' ? 
        window.innerWidth * 0.8 : -window.innerWidth * 0.8;
      gallery.scrollLeft += scrollAmount;
    }
  });

  // Smooth mouse wheel with momentum like touchpad
  let momentum = 0;
  let animationFrame;
  
  gallery.addEventListener('wheel', (e) => {
    // Only if purely vertical scroll
    if (Math.abs(e.deltaX) === 0 && Math.abs(e.deltaY) > 0) {
      e.preventDefault();
      
      // Add to momentum instead of direct scroll
      momentum += e.deltaY * 2;
      
      // Start momentum animation if not running
      if (!animationFrame) {
        const animate = () => {
          if (Math.abs(momentum) > 0.5) {
            gallery.scrollLeft += momentum;
            momentum *= 0.95; // Decay like touchpad
            animationFrame = requestAnimationFrame(animate);
          } else {
            momentum = 0;
            animationFrame = null;
          }
        };
        animate();
      }
    }
  }, { passive: false });
});