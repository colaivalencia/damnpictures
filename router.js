// Fixed router.js - Proper refresh detection and handling
class DamnPicturesRouter {
  constructor() {
    this.currentUser = null
    this.isRedirecting = false
    this.pageLoadTimestamp = Date.now()
    this.init()
  }

  init() {
    window.addEventListener('DOMContentLoaded', () => {
      this.waitForDependencies(() => {
        // Wait a bit for auth state to be determined
        setTimeout(() => {
          this.determineInitialAction();
        }, 500);
      });
    });
    
    // Handle browser back/forward
    window.addEventListener('popstate', () => this.handleRoute());
  }

  async waitForDependencies(callback) {
    // Wait for required dependencies including auth state check
    const checkReady = () => {
      if (window.supabaseHelpers && 
          window.supabase && 
          window.authManager && 
          window.authManager.authStateChecked) {
        callback()
      } else {
        setTimeout(checkReady, 100)
      }
    }
    checkReady()
  }

  async determineInitialAction() {
    const path = window.location.pathname;
    const isUserPage = path.startsWith('/u/');
    const isPageRefresh = this.detectPageRefresh();
    
    console.log('🔍 Initial route determination:', {
      path,
      isUserPage,
      isPageRefresh,
      authState: window.authManager?.isLoggedIn() ? 'logged in' : 'logged out'
    });

    if (isUserPage && isPageRefresh) {
      console.log('🔄 Page refresh detected on user page - redirecting to random user');
      await this.redirectToRandomUser();
    } else if (path === '/' || path === '') {
      console.log('🏠 Root page - redirecting to random user');
      await this.redirectToRandomUser();
    } else if (isUserPage) {
      console.log('👤 Direct user page navigation - loading specific user');
      const username = path.split('/u/')[1];
      if (username) {
        await this.loadUserGallery(username);
      } else {
        await this.redirectToRandomUser();
      }
    } else {
      console.log('❓ Unrecognized path - redirecting to random user');
      await this.redirectToRandomUser();
    }
  }

  detectPageRefresh() {
    // Multiple methods to detect page refresh
    const navigationEntries = performance.getEntriesByType('navigation');
    const isReload = navigationEntries.length > 0 && navigationEntries[0].type === 'reload';
    
    // Check if page was loaded very recently (within 1 second)
    const isQuickLoad = Date.now() - this.pageLoadTimestamp < 1000;
    
    // Check for browser refresh indicators
    const hasRefreshIndicators = document.referrer === window.location.href || 
                                 window.location.hash.includes('reload') ||
                                 sessionStorage.getItem('damn_page_refreshed') === 'true';
    
    // Mark this as a refresh if detected
    if (isReload || hasRefreshIndicators) {
      sessionStorage.setItem('damn_page_refreshed', 'true');
      // Clear the flag after a short delay
      setTimeout(() => {
        sessionStorage.removeItem('damn_page_refreshed');
      }, 2000);
      return true;
    }
    
    return false;
  }

  async handleRoute() {
    const path = window.location.pathname
    console.log('🛣️ Handling route:', path)

    try {
      if (path === '/' || path === '') {
        await this.redirectToRandomUser()
        return
      }

      if (path.startsWith('/u/')) {
        const username = path.split('/u/')[1]
        if (username) {
          await this.loadUserGallery(username)
        } else {
          await this.redirectToRandomUser()
        }
        return
      }

      // Fallback - redirect to random
      await this.redirectToRandomUser()
      
    } catch (error) {
      console.error('Route handling error:', error)
      this.showErrorState()
    }
  }

  async redirectToRandomUser() {
    if (this.isRedirecting) {
      console.log('⏳ Already redirecting, skipping...');
      return;
    }
    
    this.isRedirecting = true
    console.log('🎲 Redirecting to random user...')

    try {
      // Get users who have public photos
      const { data: users, error } = await window.supabaseHelpers.getUsersWithPhotos()
      
      if (error || !users || users.length === 0) {
        console.error('❌ No users with photos found:', error)
        this.showEmptyState()
        return
      }

      // Filter out current user to ensure we get someone different on refresh
      const currentPath = window.location.pathname
      const currentUsername = currentPath.startsWith('/u/') ? currentPath.split('/u/')[1] : null
      const availableUsers = currentUsername ? 
        users.filter(user => user.username !== currentUsername) : users

      // If we filtered out the only user, just use all users
      const usersToChooseFrom = availableUsers.length > 0 ? availableUsers : users

      // Pick random user
      const randomUser = usersToChooseFrom[Math.floor(Math.random() * usersToChooseFrom.length)]
      const targetUrl = `/u/${randomUser.username}`
      
      console.log('🎯 Redirecting to:', targetUrl)
      
      // Update URL without triggering popstate
      window.history.pushState({}, '', targetUrl)
      
      // Load the user gallery
      await this.loadUserGallery(randomUser.username)
      
    } catch (error) {
      console.error('❌ Error redirecting to random user:', error)
      this.showErrorState()
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
      
      // Update header menu to show current viewing user
      if (window.authManager?.headerMenuManager) {
        window.authManager.headerMenuManager.onViewingUserChange(username)
      }

      // Load user's photos
      const { data: photos, error } = await window.supabaseHelpers.getUserPhotos(username)
      
      if (error) {
        console.error('❌ Error loading photos:', error)
        this.showErrorState()
        return
      }

      if (!photos || photos.length === 0) {
        console.log('📭 No photos found for user:', username)
        this.showEmptyUserState(username)
        return
      }

      // Populate gallery
      this.populateGallery(photos)
      console.log(`✅ Successfully loaded ${photos.length} photos for ${username}`)
      
    } catch (error) {
      console.error('❌ Error loading user gallery:', error)
      this.showErrorState()
    }
  }

  getOptimizedImageUrl(photo) {
    if (!photo.drive_file_id) {
      // Fallback to Supabase storage
      if (photo.file_path) {
        const { data } = window.supabase.storage
          .from('photos')
          .getPublicUrl(photo.file_path)
        return data.publicUrl
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
      `https://drive.google.com/file/d/${photo.drive_file_id}/view`
    ]
  }

  populateGallery(photos) {
    const gallery = document.getElementById('gallery')
    if (!gallery) {
      console.error('❌ Gallery element not found')
      return
    }

    // Clear existing content
    gallery.innerHTML = ''

    // Shuffle photos for variety
    const shuffledPhotos = this.shuffleArray([...photos])

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
      img.onerror = () => {
        console.error(`❌ Failed to load image: ${photo.filename}, URL: ${img.src}`)
        
        if (currentFallbackIndex < backupUrls.length) {
          console.log(`🔄 Trying fallback ${currentFallbackIndex + 1}:`, backupUrls[currentFallbackIndex])
          img.src = backupUrls[currentFallbackIndex]
          currentFallbackIndex++
        } else {
          console.error('❌ All fallback URLs failed for:', photo.filename)
          // Show a placeholder
          slide.innerHTML = `
            <div style="
              height: 100vh; 
              display: flex; 
              align-items: center; 
              justify-content: center; 
              background: #222; 
              color: #666;
              flex-direction: column;
              gap: 1rem;
            ">
              <div style="font-size: 4rem;">📷</div>
              <div>Image unavailable</div>
              <div style="font-size: 0.8rem; opacity: 0.6;">${photo.original_name || photo.filename}</div>
            </div>
          `
        }
      }

      // Success handler
      img.onload = () => {
        console.log(`✅ Successfully loaded: ${photo.filename}`)
      }

      slide.appendChild(img)
      gallery.appendChild(slide)
    })

    console.log(`✅ Gallery populated with ${shuffledPhotos.length} photos`)
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

    gallery.innerHTML = `
      <div class="slide" style="display: flex; align-items: center; justify-content: center; color: #666; text-align: center;">
        <div>
          <div style="font-size: 4rem; margin-bottom: 1rem;">📷</div>
          <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">No photos yet</div>
          <div style="font-size: 1rem;">Be the first to upload!</div>
        </div>
      </div>
    `
  }

  showEmptyUserState(username) {
    const gallery = document.getElementById('gallery')
    if (!gallery) return

    gallery.innerHTML = `
      <div class="slide" style="display: flex; align-items: center; justify-content: center; color: #666; text-align: center;">
        <div>
          <div style="font-size: 4rem; margin-bottom: 1rem;">📷</div>
          <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">${username} hasn't shared any photos yet</div>
          <div style="font-size: 1rem;">Check back later!</div>
        </div>
      </div>
    `
  }

  showErrorState() {
    const gallery = document.getElementById('gallery')
    if (!gallery) return

    gallery.innerHTML = `
      <div class="slide" style="display: flex; align-items: center; justify-content: center; color: #ff4757; text-align: center;">
        <div>
          <div style="font-size: 4rem; margin-bottom: 1rem;">⚠️</div>
          <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">Something went wrong</div>
          <div style="font-size: 1rem;">Try refreshing the page</div>
        </div>
      </div>
    `
  }

  // Manual method to trigger random redirect
  async goToRandomUser() {
    await this.redirectToRandomUser()
  }
}

// Initialize router when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Initializing router...')
  window.router = new DamnPicturesRouter()
})

// Make router available globally
window.DamnPicturesRouter = DamnPicturesRouter