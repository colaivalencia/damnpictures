// FIXED: Simplified AuthManager with better error handling

console.log('🚀 Starting AuthManager initialization...');

class AuthManager {
  constructor() {
    this.currentUser = null;
    this.currentUserProfile = null;
    this.usernameCheckTimeout = null;
    this.headerMenuManager = null;
    this.isInitializing = true;
    
    console.log('📝 AuthManager constructor called');
    this.init();
  }

  init() {
    try {
      console.log('📝 AuthManager init() called');
      
      this.setupEventListeners();
      this.setupValidation();
      this.initializeHeaderMenu();
      
      // Simplified auth state listener
      if (window.supabase) {
        console.log('✅ Supabase found, setting up auth listener');
        supabase.auth.onAuthStateChange((event, session) => {
          console.log('🔄 Auth state changed:', event, session?.user?.email);
          this.handleAuthStateChange(event, session);
        });
      } else {
        console.error('❌ Supabase not available in init()');
      }
      
      this.isInitializing = false;
      console.log('✅ AuthManager initialization complete');
      
    } catch (error) {
      console.error('❌ Error in AuthManager.init():', error);
      this.isInitializing = false;
    }
  }

  handleAuthStateChange(event, session) {
    try {
      if (event === 'SIGNED_IN' && session) {
        console.log('✅ User signed in, handling...');
        this.handleUserSignedIn(session.user);
      } else if (event === 'SIGNED_OUT') {
        console.log('✅ User signed out, handling...');
        this.handleUserSignedOut();
      }
    } catch (error) {
      console.error('❌ Error in handleAuthStateChange:', error);
    }
  }

  initializeHeaderMenu() {
    try {
      console.log('📝 Initializing header menu...');
      this.headerMenuManager = new HeaderMenuManager();
      console.log('✅ Header menu initialized');
    } catch (error) {
      console.error('❌ Error initializing header menu:', error);
    }
  }

  setupEventListeners() {
    try {
      console.log('📝 Setting up event listeners...');
      
      // Wait for DOM if needed
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
      
      console.log('✅ Event listeners setup complete');
    } catch (error) {
      console.error('❌ Error setting up event listeners:', error);
    }
  }

  attachModalEventListeners() {
    try {
      console.log('📝 Attaching modal event listeners...');
      
      // Login modal close button
      const closeModal = document.getElementById('closeModal');
      if (closeModal) {
        closeModal.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.closeModal('loginModal');
        });
        console.log('✅ Login modal close listener attached');
      }

      // Signup modal close button
      const closeSignupModal = document.getElementById('closeSignupModal');
      if (closeSignupModal) {
        closeSignupModal.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.closeModal('signupModal');
        });
        console.log('✅ Signup modal close listener attached');
      }

      // Upload modal close button
      const closeUploadModal = document.getElementById('closeUploadModal');
      if (closeUploadModal) {
        closeUploadModal.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.closeModal('uploadModal');
        });
        console.log('✅ Upload modal close listener attached');
      }

      this.setupClickOutsideListeners();
      console.log('✅ Modal event listeners attached');
    } catch (error) {
      console.error('❌ Error attaching modal listeners:', error);
    }
  }

  setupFormListeners() {
    try {
      console.log('📝 Setting up form listeners...');
      
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
      
      console.log('✅ Form listeners setup complete');
    } catch (error) {
      console.error('❌ Error setting up form listeners:', error);
    }
  }

  setupClickOutsideListeners() {
    try {
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
    } catch (error) {
      console.error('❌ Error setting up click outside listeners:', error);
    }
  }

  setupValidation() {
    try {
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
    } catch (error) {
      console.error('❌ Error setting up validation:', error);
    }
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

    // Clear any resend buttons
    document.querySelectorAll('.resend-confirmation').forEach(btn => btn.remove());
  }

  // === AUTH HANDLERS ===

  async handleLogin() {
    try {
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

      const { data, error } = await supabaseHelpers.signIn(email, password);

      if (error) {
        // Handle email not confirmed error specially
        if (error.code === 'email_not_confirmed') {
          this.showError('loginError', error.message);
          this.addResendConfirmationToLogin(email);
        } else {
          this.showError('loginError', this.getAuthErrorMessage(error.message));
        }
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
      const loginButton = document.getElementById('loginButton');
      if (loginButton) {
        loginButton.classList.remove('loading');
        loginButton.disabled = false;
        loginButton.textContent = 'sign in';
      }
    }
  }

  async handleSignup() {
    try {
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

      // Create account
      const { data, error, needsConfirmation } = await supabaseHelpers.signUp(email, password, username);

      if (error) {
        this.showError('signupError', this.getAuthErrorMessage(error.message));
        return;
      }

      // Clear form
      const signupForm = document.getElementById('signupForm');
      if (signupForm) {
        signupForm.reset();
      }
      this.clearAllErrors();

      if (needsConfirmation) {
        // Show confirmation message with resend option
        this.showSuccess('signupSuccess', 
          `✅ Account created! Please check your email (${email}) and click the confirmation link to complete your registration.`
        );
        
        // Add resend option
        this.addResendConfirmationOption(email);
        
        console.log('✅ Signup successful, awaiting email confirmation');
      } else {
        // Email was already confirmed (rare case)
        this.showSuccess('signupSuccess', 'Account created and verified! You can now sign in.');
        setTimeout(() => {
          this.switchToLogin();
        }, 2000);
      }

    } catch (error) {
      console.error('Signup error:', error);
      this.showError('signupError', 'Signup failed. Please try again.');
    } finally {
      const signupButton = document.getElementById('signupButton');
      if (signupButton) {
        signupButton.classList.remove('loading');
        signupButton.disabled = false;
        signupButton.textContent = 'create account';
      }
    }
  }

  // SIMPLIFIED: Show welcome message after email confirmation
  showWelcomeMessage(user) {
    console.log('🎉 Showing welcome message for:', user.email);
    
    try {
      // Create welcome toast
      const toast = document.createElement('div');
      toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #ff6b35, #e55a2b);
        color: white;
        padding: 20px 24px;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(255, 107, 53, 0.3);
        z-index: 10000;
        max-width: 400px;
        font-family: 'Helvetica Neue', sans-serif;
        animation: slideInRight 0.4s ease-out;
      `;
      
      toast.innerHTML = `
        <div style="display: flex; align-items: flex-start; gap: 12px;">
          <div style="font-size: 24px;">🎉</div>
          <div>
            <div style="font-weight: 700; font-size: 16px; margin-bottom: 4px;">
              Welcome to damnpictures!
            </div>
            <div style="font-size: 14px; opacity: 0.9; line-height: 1.4;">
              Your email has been confirmed. Start sharing your pictures!
            </div>
          </div>
          <button onclick="this.parentElement.parentElement.remove()" 
                  style="background: none; border: none; color: white; font-size: 18px; cursor: pointer; opacity: 0.7; margin-left: auto;">
            ×
          </button>
        </div>
      `;

      // Add animation styles if not already added
      if (!document.getElementById('toast-animations')) {
        const style = document.createElement('style');
        style.id = 'toast-animations';
        style.textContent = `
          @keyframes slideInRight {
            from {
              transform: translateX(100%);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
        `;
        document.head.appendChild(style);
      }

      document.body.appendChild(toast);

      // Auto remove after 5 seconds
      setTimeout(() => {
        if (toast.parentElement) {
          toast.remove();
        }
      }, 5000);

      // Also open the upload modal after a short delay
      setTimeout(() => {
        const uploadModal = document.getElementById('uploadModal');
        if (uploadModal) {
          uploadModal.classList.remove('hidden');
          // Load photos
          if (window.uploadManager) {
            window.uploadManager.loadUserPhotos();
          }
        }
      }, 1500);
    } catch (error) {
      console.error('❌ Error showing welcome message:', error);
    }
  }

  // Add resend confirmation option
  addResendConfirmationOption(email) {
    const successEl = document.getElementById('signupSuccess');
    if (!successEl || successEl.querySelector('.resend-confirmation')) return;

    const resendButton = document.createElement('button');
    resendButton.className = 'resend-confirmation';
    resendButton.style.cssText = `
      background: transparent;
      color: #ff6b35;
      border: 1px solid #ff6b35;
      padding: 8px 16px;
      border-radius: 4px;
      font-size: 12px;
      cursor: pointer;
      margin-top: 12px;
      transition: all 0.2s ease;
      display: block;
    `;
    resendButton.textContent = 'Resend confirmation email';
    
    resendButton.addEventListener('click', async () => {
      resendButton.disabled = true;
      resendButton.textContent = 'Sending...';
      
      const { error } = await supabaseHelpers.resendConfirmation(email);
      
      if (error) {
        resendButton.textContent = 'Failed to resend';
        setTimeout(() => {
          resendButton.disabled = false;
          resendButton.textContent = 'Resend confirmation email';
        }, 3000);
      } else {
        resendButton.textContent = 'Email sent!';
        setTimeout(() => {
          resendButton.disabled = false;
          resendButton.textContent = 'Resend confirmation email';
        }, 5000);
      }
    });
    
    successEl.appendChild(resendButton);
  }

  // Add resend confirmation option to login modal
  addResendConfirmationToLogin(email) {
    const errorEl = document.getElementById('loginError');
    if (!errorEl || errorEl.querySelector('.resend-confirmation')) return;

    const resendButton = document.createElement('button');
    resendButton.className = 'resend-confirmation';
    resendButton.style.cssText = `
      background: transparent;
      color: #ff6b35;
      border: 1px solid #ff6b35;
      padding: 8px 16px;
      border-radius: 4px;
      font-size: 12px;
      cursor: pointer;
      margin-top: 12px;
      transition: all 0.2s ease;
      display: block;
      width: fit-content;
    `;
    resendButton.textContent = 'Resend confirmation email';
    
    resendButton.addEventListener('click', async () => {
      resendButton.disabled = true;
      resendButton.textContent = 'Sending...';
      
      const { error } = await supabaseHelpers.resendConfirmation(email);
      
      if (error) {
        resendButton.textContent = 'Failed to resend';
        setTimeout(() => {
          resendButton.disabled = false;
          resendButton.textContent = 'Resend confirmation email';
        }, 3000);
      } else {
        resendButton.textContent = 'Confirmation email sent!';
        setTimeout(() => {
          resendButton.disabled = false;
          resendButton.textContent = 'Resend confirmation email';
        }, 5000);
      }
    });
    
    errorEl.appendChild(resendButton);
  }

  getAuthErrorMessage(errorMessage) {
    // Convert Supabase error messages to user-friendly ones
    if (errorMessage.includes('Invalid login credentials')) {
      return 'Invalid email or password. Please try again.';
    }
    if (errorMessage.includes('Email not confirmed')) {
      return 'Please check your email and click the confirmation link first.';
    }
    if (errorMessage.includes('User already registered')) {
      return 'An account with this email already exists. Try signing in instead.';
    }
    if (errorMessage.includes('Username is already taken')) {
      return 'This username is already taken. Please choose another one.';
    }
    if (errorMessage.includes('signup_disabled')) {
      return 'Account creation is temporarily disabled. Please try again later.';
    }
    return errorMessage;
  }

  // === USER STATE HANDLERS ===

  async handleUserSignedIn(user) {
    try {
      console.log('🔄 Handling user sign in for:', user.email);
      this.currentUser = user;

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
      console.log('✅ User profile loaded:', profile.username);

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

      // Close auth modals
      this.closeModal('loginModal');
      this.closeModal('signupModal');

      console.log('✅ User signed in successfully:', profile.username);

    } catch (error) {
      console.error('❌ Error handling sign in:', error);
    }
  }

  handleUserSignedOut() {
    try {
      console.log('🔄 Handling user sign out');
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
      
      console.log('✅ User signed out successfully');
    } catch (error) {
      console.error('❌ Error handling sign out:', error);
    }
  }

  // === MODAL CONTROLS ===

  closeModal(modalId) {
    try {
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
    } catch (error) {
      console.error(`❌ Error closing modal ${modalId}:`, error);
    }
  }

  closeAllModals() {
    try {
      console.log('🔴 Closing all modals');
      this.closeModal('loginModal');
      this.closeModal('signupModal');
      this.closeModal('uploadModal');
      
      // Also close upload confirmation modal
      const confirmModal = document.getElementById('uploadConfirmModal');
      if (confirmModal) {
        confirmModal.classList.add('hidden');
      }
    } catch (error) {
      console.error('❌ Error closing all modals:', error);
    }
  }

  switchToSignup() {
    try {
      this.closeModal('loginModal');
      const signupModal = document.getElementById('signupModal');
      if (signupModal) {
        signupModal.classList.remove('hidden');
        const signupEmail = document.getElementById('signupEmail');
        if (signupEmail) {
          signupEmail.focus();
        }
      }
    } catch (error) {
      console.error('❌ Error switching to signup:', error);
    }
  }

  switchToLogin() {
    try {
      this.closeModal('signupModal');
      const loginModal = document.getElementById('loginModal');
      if (loginModal) {
        loginModal.classList.remove('hidden');
        const loginEmail = document.getElementById('loginEmail');
        if (loginEmail) {
          loginEmail.focus();
        }
      }
    } catch (error) {
      console.error('❌ Error switching to login:', error);
    }
  }

  // === PUBLIC METHODS ===

  showLoginModal() {
    try {
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
    } catch (error) {
      console.error('❌ Error showing login modal:', error);
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

// SIMPLIFIED Header Menu Manager
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
    try {
      console.log('📝 Initializing HeaderMenuManager...');
      
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
      
      console.log('✅ HeaderMenuManager initialized');
    } catch (error) {
      console.error('❌ Error initializing HeaderMenuManager:', error);
    }
  }

  setupEventListeners() {
    try {
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
    } catch (error) {
      console.error('❌ Error setting up header menu listeners:', error);
    }
  }

  handleMenuClick() {
    try {
      if (window.authManager) {
        window.authManager.showLoginModal();
      }
    } catch (error) {
      console.error('❌ Error handling menu click:', error);
    }
  }

  async handleLogout() {
    try {
      if (window.authManager) {
        await window.authManager.logout();
      }
    } catch (error) {
      console.error('❌ Logout error:', error);
    }
  }

  // Update menu state based on authentication and current user
  updateMenuState(isLoggedIn, loggedInUsername) {
    try {
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
    } catch (error) {
      console.error('❌ Error updating menu state:', error);
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

// SIMPLIFIED email confirmation detection
function handleEmailConfirmation() {
  try {
    console.log('🔍 Checking for email confirmation...');
    
    // Check if user came from email confirmation
    const urlParams = new URLSearchParams(window.location.search);
    const fragment = new URLSearchParams(window.location.hash.substring(1));
    
    // Check for confirmation tokens in URL
    const accessToken = urlParams.get('access_token') || fragment.get('access_token');
    const type = urlParams.get('type') || fragment.get('type');
    
    if (accessToken && type === 'signup') {
      console.log('🔗 Detected email confirmation from URL');
      
      // Clean the URL immediately
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, '', cleanUrl);
      
      // Set a flag that we're coming from email confirmation
      sessionStorage.setItem('email_confirmed', 'true');
      
      console.log('✅ Email confirmation detected and URL cleaned');
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('❌ Error handling email confirmation:', error);
    return false;
  }
}

function showSimpleConfirmationMessage() {
  try {
    // Simple confirmation banner
    const banner = document.createElement('div');
    banner.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: linear-gradient(135deg, #2ed573, #26d65c);
      color: white;
      padding: 16px;
      text-align: center;
      font-weight: 600;
      z-index: 10000;
      box-shadow: 0 2px 12px rgba(46, 213, 115, 0.3);
    `;
    
    banner.innerHTML = `
      ✅ Email confirmed! Welcome to damnpictures
      <button onclick="this.parentElement.remove()" 
              style="background: none; border: none; color: white; font-size: 18px; cursor: pointer; margin-left: 16px;">
        ×
      </button>
    `;
    
    document.body.appendChild(banner);
    
    // Auto remove after 4 seconds
    setTimeout(() => {
      if (banner.parentElement) {
        banner.remove();
      }
    }, 4000);
  } catch (error) {
    console.error('❌ Error showing confirmation message:', error);
  }
}

// SIMPLIFIED initialization
function initializeApp() {
  try {
    console.log('🚀 Initializing damnpictures app...');
    
    // Check for email confirmation first
    const wasEmailConfirmed = handleEmailConfirmation();
    
    // Initialize auth manager
    console.log('📝 Creating AuthManager...');
    window.authManager = new AuthManager();

    // Make functions available globally for compatibility
    window.getCurrentUserProfile = () => window.authManager?.getCurrentUserProfile();
    window.isLoggedIn = () => window.authManager?.isLoggedIn();
    
    // Make header menu manager available globally
    window.headerMenuManager = window.authManager?.headerMenuManager;
    
    // If we detected email confirmation, show welcome after auth settles
    if (wasEmailConfirmed) {
      console.log('📧 Email confirmation detected, will show welcome message');
      
      // Check periodically if user is signed in
      let checkCount = 0;
      const checkInterval = setInterval(() => {
        checkCount++;
        
        if (window.authManager?.currentUser) {
          console.log('✅ User found after email confirmation');
          clearInterval(checkInterval);
          
          // Show welcome message
          if (window.authManager.showWelcomeMessage) {
            window.authManager.showWelcomeMessage(window.authManager.currentUser);
          } else {
            showSimpleConfirmationMessage();
          }
          
          // Clear the session flag
          sessionStorage.removeItem('email_confirmed');
        } else if (checkCount > 20) {
          // Stop checking after 10 seconds (20 * 500ms)
          console.log('⏰ Timeout waiting for user after email confirmation');
          clearInterval(checkInterval);
          showSimpleConfirmationMessage();
          sessionStorage.removeItem('email_confirmed');
        }
      }, 500);
    }
    
    console.log('✅ App initialization complete');
    
  } catch (error) {
    console.error('❌ CRITICAL ERROR in app initialization:', error);
    
    // Show error message to user
    document.body.innerHTML = `
      <div style="
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: #1a1a1a;
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        font-family: Arial, sans-serif;
      ">
        <div>
          <h1 style="color: #ff4757; margin-bottom: 1rem;">Something went wrong</h1>
          <p style="margin-bottom: 2rem;">There was an error loading the app. Please refresh the page.</p>
          <button onclick="window.location.reload()" style="
            background: #667eea;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 16px;
          ">Refresh Page</button>
        </div>
      </div>
    `;
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  // DOM is already ready
  initializeApp();
}

// Export for other modules
window.AuthManager = AuthManager;
window.HeaderMenuManager = HeaderMenuManager;

console.log('📄 Script.js loaded successfully');