// Simple auth - just login and upload
class AuthManager {
  constructor() {
    this.currentUser = null;
    this.currentUserProfile = null;
    this.headerMenuManager = null;
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.initializeHeaderMenu();
    this.checkAuthState();
  }

  async checkAuthState() {
    // Wait for supabase
    while (!window.supabase) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Check if user is logged in
    const { data: { session } } = await window.supabase.auth.getSession();
    
    if (session && session.user) {
      this.handleUserSignedIn(session.user);
    } else {
      this.handleUserSignedOut();
    }

    // Listen for auth changes
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
    // Wait for DOM
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.attachEventListeners();
      });
    } else {
      this.attachEventListeners();
    }

    // Global escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeAllModals();
      }
    });
  }

  attachEventListeners() {
    // Modal close buttons
    const closeModal = document.getElementById('closeModal');
    if (closeModal) {
      closeModal.addEventListener('click', () => this.closeModal('loginModal'));
    }

    const closeSignupModal = document.getElementById('closeSignupModal');
    if (closeSignupModal) {
      closeSignupModal.addEventListener('click', () => this.closeModal('signupModal'));
    }

    const closeUploadModal = document.getElementById('closeUploadModal');
    if (closeUploadModal) {
      closeUploadModal.addEventListener('click', () => this.closeModal('uploadModal'));
    }

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

    // Click outside to close
    this.setupClickOutside();
  }

  setupClickOutside() {
    ['loginModal', 'signupModal', 'uploadModal'].forEach(modalId => {
      const modal = document.getElementById(modalId);
      if (modal) {
        modal.addEventListener('click', (e) => {
          if (e.target === modal) {
            this.closeModal(modalId);
          }
        });
      }
    });
  }

  // === AUTH HANDLERS ===

  async handleLogin() {
    const email = document.getElementById('loginEmail')?.value;
    const password = document.getElementById('loginPassword')?.value;
    const loginButton = document.getElementById('loginButton');

    if (!email || !password) {
      this.showError('loginError', 'Please fill in all fields');
      return;
    }

    // Set loading state
    if (loginButton) {
      loginButton.disabled = true;
      loginButton.textContent = 'signing in...';
    }

    try {
      const { data, error } = await supabaseHelpers.signIn(email, password);

      if (error) {
        this.showError('loginError', error.message);
        return;
      }

      // Success - auth listener will handle the rest
      document.getElementById('loginForm')?.reset();

    } catch (error) {
      console.error('Login error:', error);
      this.showError('loginError', 'Login failed. Please try again.');
    } finally {
      if (loginButton) {
        loginButton.disabled = false;
        loginButton.textContent = 'sign in';
      }
    }
  }

  async handleSignup() {
    const email = document.getElementById('signupEmail')?.value;
    const username = document.getElementById('signupUsername')?.value;
    const password = document.getElementById('signupPassword')?.value;
    const signupButton = document.getElementById('signupButton');

    if (!email || !username || !password) {
      this.showError('signupError', 'Please fill in all fields');
      return;
    }

    if (username.length < 3) {
      this.showError('signupError', 'Username must be at least 3 characters');
      return;
    }

    if (password.length < 6) {
      this.showError('signupError', 'Password must be at least 6 characters');
      return;
    }

    // Set loading state
    if (signupButton) {
      signupButton.disabled = true;
      signupButton.textContent = 'creating account...';
    }

    try {
      const { data, error } = await supabaseHelpers.signUp(email, password, username);

      if (error) {
        this.showError('signupError', error.message);
        return;
      }

      // Success
      this.showSuccess('signupSuccess', 'Account created! Please check your email to verify your account.');
      document.getElementById('signupForm')?.reset();

      // Switch to login after delay
      setTimeout(() => {
        this.switchToLogin();
      }, 3000);

    } catch (error) {
      console.error('Signup error:', error);
      this.showError('signupError', 'Signup failed. Please try again.');
    } finally {
      if (signupButton) {
        signupButton.disabled = false;
        signupButton.textContent = 'create account';
      }
    }
  }

  async handleUserSignedIn(user) {
    this.currentUser = user;

    try {
      // Get user profile
      const { data: profile } = await window.supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      this.currentUserProfile = profile;

      // Update UI
      const loggedInUsername = document.getElementById('loggedInUsername');
      const userAvatar = document.getElementById('userAvatar');

      if (loggedInUsername && profile) {
        loggedInUsername.textContent = profile.username;
      }
      if (userAvatar && profile) {
        userAvatar.textContent = profile.username[0]?.toUpperCase() || 'U';
      }

      // Update header menu
      if (this.headerMenuManager && profile) {
        this.headerMenuManager.onUserLogin(profile.username);
      }

      // Close modals
      this.closeAllModals();

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
  }

  // === MODAL CONTROLS ===

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('hidden');
      this.clearAllErrors();
      
      // Reset forms
      if (modalId === 'loginModal') {
        document.getElementById('loginForm')?.reset();
      }
      if (modalId === 'signupModal') {
        document.getElementById('signupForm')?.reset();
      }
    }
  }

  closeAllModals() {
    this.closeModal('loginModal');
    this.closeModal('signupModal');
    this.closeModal('uploadModal');
  }

  switchToSignup() {
    this.closeModal('loginModal');
    const signupModal = document.getElementById('signupModal');
    if (signupModal) {
      signupModal.classList.remove('hidden');
    }
  }

  switchToLogin() {
    this.closeModal('signupModal');
    const loginModal = document.getElementById('loginModal');
    if (loginModal) {
      loginModal.classList.remove('hidden');
    }
  }

  // === PUBLIC METHODS ===

  showLoginModal() {
    if (this.currentUser) {
      const uploadModal = document.getElementById('uploadModal');
      if (uploadModal) {
        uploadModal.classList.remove('hidden');
        // Load photos after modal opens
        setTimeout(() => {
          if (window.uploadManager && window.uploadManager.loadUserPhotos) {
            window.uploadManager.loadUserPhotos();
          }
        }, 100);
      }
    } else {
      const loginModal = document.getElementById('loginModal');
      if (loginModal) {
        loginModal.classList.remove('hidden');
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
      await supabaseHelpers.signOut();
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  // === UTILITY METHODS ===

  showError(elementId, message) {
    const errorEl = document.getElementById(elementId);
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.classList.add('show');
    }
  }

  showSuccess(elementId, message) {
    const successEl = document.getElementById(elementId);
    if (successEl) {
      successEl.textContent = message;
      successEl.classList.add('show');
    }
  }

  clearAllErrors() {
    ['loginError', 'signupError', 'signupSuccess'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.classList.remove('show');
      }
    });
  }
}

// Simple Header Menu Manager - keep the UI
class HeaderMenuManager {
  constructor() {
    this.headerMenu = null;
    this.primaryLabel = null;
    this.hoverLabel = null;
    this.submenu = null;
    this.logoutMenuItem = null;
    this.isLoggedIn = false;
    this.init();
  }

  init() {
    this.headerMenu = document.getElementById('headerMenu');
    this.primaryLabel = document.getElementById('primaryLabel');
    this.hoverLabel = document.getElementById('hoverLabel');
    this.submenu = document.getElementById('submenu');
    this.logoutMenuItem = document.getElementById('logoutMenuItem');

    this.setupEventListeners();
    this.updateMenuState(false, null);
  }

  setupEventListeners() {
    if (this.headerMenu) {
      this.headerMenu.addEventListener('click', () => {
        if (window.authManager) {
          window.authManager.showLoginModal();
        }
      });
    }

    if (this.logoutMenuItem) {
      this.logoutMenuItem.addEventListener('click', (e) => {
        e.stopPropagation();
        if (window.authManager) {
          window.authManager.logout();
        }
      });
    }
  }

  updateMenuState(isLoggedIn, loggedInUsername) {
    this.isLoggedIn = isLoggedIn;
    
    // Show current viewing user
    const currentPath = window.location.pathname;
    const currentViewingUser = currentPath.startsWith('/u/') ? currentPath.split('/u/')[1] : 'anonymous';

    if (this.primaryLabel) {
      if (currentViewingUser && currentViewingUser !== 'anonymous') {
        this.primaryLabel.textContent = `damnpictures / ${currentViewingUser}`;
      } else {
        this.primaryLabel.textContent = 'damnpictures';
      }
    }
    
    if (isLoggedIn && loggedInUsername) {
      // Logged in state
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
      // Logged out state
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

  onUserLogin(username) {
    this.updateMenuState(true, username);
  }

  onUserLogout() {
    this.updateMenuState(false, null);
  }

  onViewingUserChange(username) {
    this.updateMenuState(this.isLoggedIn, this.isLoggedIn ? window.authManager?.getCurrentUserProfile()?.username : null);
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  window.authManager = new AuthManager();
  window.getCurrentUserProfile = () => window.authManager.getCurrentUserProfile();
  window.isLoggedIn = () => window.authManager.isLoggedIn();
  window.headerMenuManager = window.authManager.headerMenuManager;
});

window.AuthManager = AuthManager;
window.HeaderMenuManager = HeaderMenuManager;