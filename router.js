// Enhanced router.js with complete error handling and logging
class DamnPicturesRouter {
  constructor() {
    this.currentUser = null
    this.isRedirecting = false
    this.isInitialized = false
    this.initializationStartTime = Date.now()
    
    console.log('🚀 Router constructor called')
    
    // Show loading immediately
    this.showLoadingState()
    
    // Start safe initialization
    this.safeInit()
  }

  showLoadingState() {
    const gallery = document.getElementById('gallery')
    if (gallery) {
      gallery.innerHTML = `
        <div style="
          display: flex; 
          align-items: center; 
          justify-content: center; 
          height: 100vh; 
          color: #666; 
          text-align: center;
          background: linear-gradient(135deg, #000 0%, #111 100%);
        ">
          <div>
            <div style="
              font-size: 4rem; 
              margin-bottom: 1rem;
              animation: pulse 2s ease-in-out infinite;
            ">📸</div>
            <div style="
              font-size: 1.8rem; 
              margin-bottom: 0.5rem;
              font-weight: 300;
              letter-spacing: 2px;
            ">damnpictures</div>
            <div style="
              font-size: 1rem; 
              opacity: 0.7;
              animation: fade 3s ease-in-out infinite;
            ">loading gallery...</div>
          </div>
        </div>
        <style>
          @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.1); opacity: 0.7; }
          }
          @keyframes fade {
            0%, 100% { opacity: 0.7; }
            50% { opacity: 0.3; }
          }
        </style>
      `
    }
  }

  async safeInit() {
    try {
      console.log('🔧 Starting safe initialization...')
      
      // Wait for dependencies with timeout
      const success = await this.waitForDependencies()
      
      if (!success) {
        throw new Error('Dependencies failed to load within timeout')
      }
      
      console.log('✅ All dependencies ready, initializing router...')
      this.isInitialized = true
      
      // Handle the current route
      await this.handleRoute()
      
      // Set up navigation listeners
      window.addEventListener('popstate', () => {
        console.log('📍 Popstate event fired')
        this.handleRoute()
      })
      
      const initTime = Date.now() - this.initializationStartTime
      console.log(`✅ Router fully initialized in ${initTime}ms`)
      
    } catch (error) {
      console.error('❌ Router initialization failed:', error)
      this.showErrorState('Initialization failed. Please refresh the page.', true)
    }
  }

  async waitForDependencies() {
    const maxAttempts = 100 // 10 seconds
    let attempts = 0
    
    while (attempts < maxAttempts) {
      // Check for required dependencies
      const hasSupabase = window.supabaseHelpers?.isReady()
      const hasAuthManager = window.authManager
      
      console.log(`🔍 Dependency check ${attempts + 1}/${maxAttempts}:`, {
        supabaseHelpers: !!window.supabaseHelpers,
        supabaseReady: hasSupabase,
        authManager: !!hasAuthManager
      })
      
      if (hasSupabase && hasAuthManager) {
        console.log('✅ All dependencies satisfied')
        return true
      }
      
      await new Promise(resolve => setTimeout(resolve, 100))
      attempts++
    }
    
    console.error('❌ Dependencies not ready after 10 seconds')
    return false
  }

  async handleRoute() {
    if (!this.isInitialized) {
      console.log('⏸️ Router not initialized yet, showing loading...')
      this.showLoadingState()
      return
    }

    const path = window.location.pathname
    console.log('🛣️ Handling route:', path)

    try {
      // Root domain - redirect to random user
      if (path === '/' || path === '') {
        console.log('📍 Root path detected, redirecting to random user')
        await this.redirectToRandomUser()
        return
      }

      // User gallery - /u/username
      if (path.startsWith('/u/')) {
        const username = path.split('/u/')[1]
        if (username && username.trim()) {
          console.log('👤 Loading user gallery for:', username)
          await this.loadUserGallery(username.trim())
        } else {
          console.log('⚠️ No valid username found, redirecting to random')
          await this.redirectToRandomUser()
        }
        return
      }

      // Fallback - redirect to random
      console.log('🔄 Fallback: redirecting to random user')
      await this.redirectToRandomUser()
      
    } catch (error) {
      console.error('❌ Route handling error:', error)
      this.showErrorState(`Navigation error: ${error.message}`)
    }
  }

  async redirectToRandomUser() {
    if (this.isRedirecting) {
      console.log('⏸️ Already redirecting, skipping...')
      return
    }
    
    this.isRedirecting = true
    console.log('🎲 Getting random user...')

    try {
      // Show loading state
      this.showLoadingState()
      
      // Get users who have public photos
      const { data: users, error } = await window.supabaseHelpers.getUsersWithPhotos()
      
      if (error) {
        console.error('❌ Error getting users:', error)
        this.showErrorState(`Database error: ${error.message}`)
        return
      }

      if (!users || users.length === 0) {
        console.log('📝 No users with photos found, showing empty state')
        this.showEmptyState()
        return
      }

      // Filter out current user to ensure we get someone different
      const currentPath = window.location.pathname
      const currentUsername = currentPath.startsWith('/u/') ? currentPath.split('/u/')[1] : null
      const availableUsers = currentUsername ? 
        users.filter(user => user.username !== currentUsername) : users

      // If we filtered out the only user, just use all users
      const usersToChooseFrom = availableUsers.length > 0 ? availableUsers : users

      // Pick random user
      const randomUser = usersToChooseFrom[Math.floor(Math.random() * usersToChooseFrom.length)]
      const targetUrl = `/u/${randomUser.username}`
      
      console.log('🎯 Navigating to:', targetUrl)
      
      // Use History API instead of location.href to avoid full page reload
      window.history.pushState({}, '', targetUrl)
      
      // Load the user gallery
      await this.loadUserGallery(randomUser.username)
      
    } catch (error) {
      console.error('❌ Error redirecting to random user:', error)
      this.showErrorState(`Random user error: ${error.message}`)
    } finally {
      this.isRedirecting = false
    }
  }

  async loadUserGallery(username) {
    console.log('📸 Loading gallery for user:', username)
    
    try {
      // Update current user
      this.currentUser = username
      
      // Update page title
      document.title = `${username} - damnpictures`
      
      // Update header menu - WITH COMPREHENSIVE NULL CHECKS
      try {
        if (window.authManager?.headerMenuManager?.onViewingUserChange) {
          window.authManager.headerMenuManager.onViewingUserChange(username)
        } else {
          console.warn('⚠️ headerMenuManager not available for user change notification')
        }
      } catch (headerError) {
        console.warn('⚠️ Header menu update failed:', headerError)
      }

      // Load user's photos
      const { data: photos, error } = await window.supabaseHelpers.getUserPhotos(username)
      
      if (error) {
        console.error('❌ Error loading photos:', error)
        this.showErrorState(`Failed to load photos for ${username}: ${error.message}`)
        return
      }

      if (!photos || photos.length === 0) {
        console.log('📷 No photos found for user:', username)
        this.showEmptyUserState(username)
        return
      }

      console.log(`✅ Found ${photos.length} photos for ${username}`)
      
      // Populate gallery
      this.populateGallery(photos)
      
    } catch (error) {
      console.error('❌ Error loading user gallery:', error)
      this.showErrorState(`Gallery error: ${error.message}`)
    }
  }

  getOptimizedImageUrl(photo) {
    if (!photo.drive_file_id) {
      // Fallback to Supabase storage
      if (photo.file_path && window.supabase) {
        try {
          const { data } = window.supabase.storage
            .from('photos')
            .getPublicUrl(photo.file_path)
          return data.publicUrl
        } catch (error) {
          console.warn('⚠️ Supabase storage URL error:', error)
        }
      }
      return photo.file_url || null
    }

    // For Google Drive, use the most reliable format
    return `https://lh3.googleusercontent.com/d/${photo.drive_file_id}=w2000-h2000-rw`
  }

  getBackupImageUrls(photo) {
    if (!photo.drive_file_id) return []
    
    return [
      `https://drive.google.com/uc?export=view&id=${photo.drive_file_id}`,
      `https://drive.google.com/thumbnail?id=${photo.drive_file_id}&sz=w2000`,
      `https://lh3.googleusercontent.com/d/${photo.drive_file_id}`,
      `https://lh3.googleusercontent.com/d/${photo.drive_file_id}=w1600-h1600-rw`
    ]
  }

  populateGallery(photos) {
    const gallery = document.getElementById('gallery')
    if (!gallery) {
      console.error('❌ Gallery element not found!')
      return
    }

    console.log(`🖼️ Populating gallery with ${photos.length} photos`)

    // Clear existing content
    gallery.innerHTML = ''

    // Shuffle photos for variety
    const shuffledPhotos = this.shuffleArray([...photos])
    let loadedCount = 0
    let errorCount = 0

    shuffledPhotos.forEach((photo, index) => {
      const slide = document.createElement('div')
      slide.className = 'slide'
      slide.id = `slide-${index}`

      const img = document.createElement('img')
      
      // Use optimized URL
      const primaryUrl = this.getOptimizedImageUrl(photo)
      const backupUrls = this.getBackupImageUrls(photo)
      
      if (!primaryUrl) {
        console.error('❌ No valid URL found for photo:', photo)
        return
      }
      
      img.src = primaryUrl
      img.alt = photo.original_name || photo.filename
      
      // Enhanced error handling with multiple fallbacks
      let currentFallbackIndex = 0
      const tryNextFallback = () => {
        if (currentFallbackIndex < backupUrls.length) {
          console.log(`🔄 Trying fallback ${currentFallbackIndex + 1} for: ${photo.filename}`)
          img.src = backupUrls[currentFallbackIndex]
          currentFallbackIndex++
        } else {
          console.error('❌ All fallback URLs failed for:', photo.filename)
          errorCount++
          // Show a placeholder
          slide.innerHTML = `
            <div style="
              height: 100vh; 
              display: flex; 
              align-items: center; 
              justify-content: center; 
              background: linear-gradient(135deg, #222 0%, #111 100%); 
              color: #666;
              flex-direction: column;
              gap: 1rem;
              border: 1px solid #333;
            ">
              <div style="font-size: 4rem; opacity: 0.5;">📷</div>
              <div style="font-size: 1.2rem;">Image unavailable</div>
              <div style="font-size: 0.9rem; opacity: 0.6; max-width: 80%; text-align: center;">${photo.original_name || photo.filename}</div>
            </div>
          `
        }
      }

      img.onerror = tryNextFallback

      // Success handler
      img.onload = () => {
        loadedCount++
        console.log(`✅ Successfully loaded (${loadedCount}/${shuffledPhotos.length}): ${photo.filename}`)
        
        // Log completion
        if (loadedCount + errorCount === shuffledPhotos.length) {
          console.log(`🎯 Gallery load complete: ${loadedCount} loaded, ${errorCount} failed`)
        }
      }

      slide.appendChild(img)
      gallery.appendChild(slide)
    })

    console.log(`📋 Gallery setup complete: ${shuffledPhotos.length} slides created for ${this.currentUser}`)
  }

  shuffleArray(array) {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }

  showEmptyState() {
    const gallery = document.getElementById('gallery')
    if (!gallery) return

    console.log('📝 Showing empty state')
    gallery.innerHTML = `
      <div class="slide" style="
        display: flex; 
        align-items: center; 
        justify-content: center; 
        color: #666; 
        text-align: center;
        background: linear-gradient(135deg, #000 0%, #111 100%);
        height: 100vh;
      ">
        <div>
          <div style="font-size: 4rem; margin-bottom: 1rem; opacity: 0.7;">📷</div>
          <div style="font-size: 1.5rem; margin-bottom: 0.5rem; font-weight: 300;">No photos yet</div>
          <div style="font-size: 1rem; opacity: 0.8;">Be the first to upload!</div>
          <button onclick="window.authManager?.showLoginModal()" style="
            margin-top: 2rem; 
            padding: 12px 24px; 
            background: linear-gradient(135deg, #667eea, #764ba2); 
            color: white; 
            border: none; 
            border-radius: 8px; 
            cursor: pointer;
            font-size: 1rem;
            transition: all 0.3s ease;
          " onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
            Get Started
          </button>
        </div>
      </div>
    `
  }

  showEmptyUserState(username) {
    const gallery = document.getElementById('gallery')
    if (!gallery) return

    console.log(`📝 Showing empty user state for: ${username}`)
    gallery.innerHTML = `
      <div class="slide" style="
        display: flex; 
        align-items: center; 
        justify-content: center; 
        color: #666; 
        text-align: center;
        background: linear-gradient(135deg, #000 0%, #111 100%);
        height: 100vh;
      ">
        <div>
          <div style="font-size: 4rem; margin-bottom: 1rem; opacity: 0.7;">📷</div>
          <div style="font-size: 1.5rem; margin-bottom: 0.5rem; font-weight: 300;">${username} hasn't shared any photos yet</div>
          <div style="font-size: 1rem; opacity: 0.8; margin-bottom: 2rem;">Check back later!</div>
          <button onclick="window.router?.redirectToRandomUser()" style="
            padding: 12px 24px; 
            background: transparent; 
            color: #667eea; 
            border: 2px solid #667eea; 
            border-radius: 8px; 
            cursor: pointer;
            font-size: 1rem;
            transition: all 0.3s ease;
          " onmouseover="this.style.background='rgba(102, 126, 234, 0.1)'" onmouseout="this.style.background='transparent'">
            Discover Other Users
          </button>
        </div>
      </div>
    `
  }

  showErrorState(message, showRefresh = false) {
    const gallery = document.getElementById('gallery')
    if (!gallery) return

    console.log('❌ Showing error state:', message)
    
    const refreshButton = showRefresh ? `
      <button onclick="location.reload()" style="
        padding: 12px 24px; 
        background: #ff4757; 
        color: white; 
        border: none; 
        border-radius: 8px; 
        cursor: pointer;
        font-size: 1rem;
        margin-top: 1rem;
        transition: all 0.3s ease;
      " onmouseover="this.style.background='#ff3742'" onmouseout="this.style.background='#ff4757'">
        Refresh Page
      </button>
    ` : `
      <button onclick="window.router?.handleRoute()" style="
        padding: 12px 24px; 
        background: #667eea; 
        color: white; 
        border: none; 
        border-radius: 8px; 
        cursor: pointer;
        font-size: 1rem;
        margin-top: 1rem;
        transition: all 0.3s ease;
      " onmouseover="this.style.background='#5a67d8'" onmouseout="this.style.background='#667eea'">
        Try Again
      </button>
    `

    gallery.innerHTML = `
      <div class="slide" style="
        display: flex; 
        align-items: center; 
        justify-content: center; 
        color: #ff4757; 
        text-align: center;
        background: linear-gradient(135deg, #000 0%, #111 100%);
        height: 100vh;
      ">
        <div style="max-width: 500px; padding: 2rem;">
          <div style="font-size: 4rem; margin-bottom: 1rem;">⚠️</div>
          <div style="font-size: 1.5rem; margin-bottom: 1rem; font-weight: 300;">Something went wrong</div>
          <div style="font-size: 1rem; opacity: 0.9; margin-bottom: 1rem; line-height: 1.5;">${message}</div>
          <div style="font-size: 0.9rem; opacity: 0.7; margin-bottom: 2rem;">Check the browser console for details</div>
          ${refreshButton}
        </div>
      </div>
    `
  }

  // Manual method to trigger random redirect
  async goToRandomUser() {
    console.log('🎲 Manual redirect to random user triggered')
    await this.redirectToRandomUser()
  }

  // Debug method
  getStatus() {
    return {
      currentUser: this.currentUser,
      isRedirecting: this.isRedirecting,
      isInitialized: this.isInitialized,
      dependencies: {
        supabaseHelpers: !!window.supabaseHelpers,
        supabaseReady: window.supabaseHelpers?.isReady(),
        authManager: !!window.authManager,
        headerMenuManager: !!window.authManager?.headerMenuManager
      }
    }
  }
}

// Simplified initialization with comprehensive error handling
function initializeRouter() {
  console.log('🎬 Router initialization started...')
  
  try {
    if (window.router) {
      console.log('⚠️ Router already exists, skipping initialization')
      return
    }
    
    window.router = new DamnPicturesRouter()
    
    // Add debug method to window
    window.checkRouter = () => {
      console.log('🔍 Router status:', window.router?.getStatus())
    }
    
    console.log('✅ Router instance created successfully')
    console.log('📋 Debug with: window.checkRouter()')
    
  } catch (error) {
    console.error('❌ Router initialization failed:', error)
    
    // Show fallback error in gallery
    const gallery = document.getElementById('gallery')
    if (gallery) {
      gallery.innerHTML = `
        <div style="
          display: flex; 
          align-items: center; 
          justify-content: center; 
          height: 100vh; 
          color: #ff4757; 
          text-align: center;
          background: #000;
        ">
          <div>
            <div style="font-size: 4rem; margin-bottom: 1rem;">💥</div>
            <div style="font-size: 1.5rem; margin-bottom: 1rem;">Router Failed to Start</div>
            <div style="font-size: 1rem; margin-bottom: 2rem;">Critical initialization error</div>
            <button onclick="location.reload()" style="
              padding: 12px 24px; 
              background: #ff4757; 
              color: white; 
              border: none; 
              border-radius: 8px; 
              cursor: pointer;
            ">Reload Page</button>
          </div>
        </div>
      `
    }
  }
}

// Start router initialization when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeRouter)
} else {
  // DOM already loaded, initialize immediately
  initializeRouter()
}

// Make router class available globally
window.DamnPicturesRouter = DamnPicturesRouter

console.log('📦 Enhanced router script loaded successfully')