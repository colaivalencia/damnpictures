// Updated router.js - Minimal fix for blank page issue
class DamnPicturesRouter {
  constructor() {
    this.currentUser = null
    this.isRedirecting = false
    this.init()
  }

  init() {
  // Simple initialization - no complex refresh detection
  window.addEventListener('DOMContentLoaded', () => {
    this.waitForDependencies(() => this.handleRoute())
  })
  
  // Handle browser back/forward
  window.addEventListener('popstate', () => this.handleRoute())
}


  async waitForDependencies(callback) {
    // Simple wait for required dependencies
    const checkReady = () => {
      if (window.supabaseHelpers && window.supabase) {
        callback()
      } else {
        setTimeout(checkReady, 100)
      }
    }
    checkReady()
  }

  async handleRoute() {
    const path = window.location.pathname
    console.log('Current path:', path)

    try {
      // Root domain - redirect to random user
      if (path === '/' || path === '') {
        await this.redirectToRandomUser()
        return
      }

      // User gallery - /u/username  
      // NOTE: This will load the specific user, NOT redirect to random
      // Random redirect only happens on refresh (handled in init())
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
    if (this.isRedirecting) return
    
    this.isRedirecting = true
    console.log('Redirecting to random user...')

    try {
      // Get users who have public photos
      const { data: users, error } = await window.supabaseHelpers.getUsersWithPhotos()
      
      if (error || !users || users.length === 0) {
  console.error('No users with photos found:', error)
  console.log('Falling back to simple reload...')
  window.location.reload()
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
      
      console.log('Redirecting to:', targetUrl)
      
      // Use history.pushState instead of location.href, and mark as intentional
      window.history.pushState({}, '', targetUrl)
      
      // Mark this as intentional navigation
      sessionStorage.setItem('damn_intentional_nav', 'true')
      sessionStorage.setItem('damn_last_path', targetUrl)
      
      // Load the user gallery
      await this.loadUserGallery(randomUser.username)
      
    } catch (error) {
  console.error('Error redirecting to random user:', error)
  // If redirect fails, just reload the current page
  window.location.href = window.location.pathname
} finally {
  this.isRedirecting = false
}
}

  async loadUserGallery(username) {
    console.log('Loading gallery for user:', username)
    
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
        console.error('Error loading photos:', error)
        this.showErrorState()
        return
      }

      if (!photos || photos.length === 0) {
        console.log('No photos found for user:', username)
        this.showEmptyUserState(username)
        return
      }

      // Populate gallery
      this.populateGallery(photos)
      
    } catch (error) {
      console.error('Error loading user gallery:', error)
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
    if (!gallery) return

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
        console.error('No valid URL found for photo:', photo)
        return
      }
      
      img.src = primaryUrl
      img.alt = photo.original_name || photo.filename
      
      // Enhanced error handling with multiple fallbacks
      let currentFallbackIndex = 0
      img.onerror = () => {
        console.error(`Failed to load image: ${photo.filename}, URL: ${img.src}`)
        
        if (currentFallbackIndex < backupUrls.length) {
          console.log(`Trying fallback ${currentFallbackIndex + 1}:`, backupUrls[currentFallbackIndex])
          img.src = backupUrls[currentFallbackIndex]
          currentFallbackIndex++
        } else {
          console.error('All fallback URLs failed for:', photo.filename)
          // Show a placeholder or hide the slide
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

    console.log(`Loaded ${shuffledPhotos.length} photos for ${this.currentUser}`)
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
  window.router = new DamnPicturesRouter()
})

// Make router available globally
window.DamnPicturesRouter = DamnPicturesRouter