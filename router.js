// Router for handling URL navigation and random redirects
class DamnPicturesRouter {
  constructor() {
    this.currentUser = null
    this.isRedirecting = false
    this.lastVisitTime = null
    this.init()
  }

  init() {
    // Handle initial page load
    window.addEventListener('load', () => this.handleRoute())
    
    // Handle browser back/forward
    window.addEventListener('popstate', () => this.handleRoute())
    
    // Set up refresh detection for random redirects
    this.setupRefreshDetection()
  }

  setupRefreshDetection() {
    // Store timestamp when page loads
    const now = Date.now()
    const lastVisit = localStorage.getItem('damn_last_visit')
    const currentPath = window.location.pathname
    const lastPath = localStorage.getItem('damn_last_path')
    
    // If it's been less than 5 seconds since last visit on the same path,
    // consider it a refresh and redirect to random user
    if (lastVisit && lastPath === currentPath) {
      const timeDiff = now - parseInt(lastVisit)
      if (timeDiff < 5000) { // 5 seconds
        console.log('Refresh detected, redirecting to random user')
        this.redirectToRandomUser()
        return
      }
    }
    
    // Store current visit
    localStorage.setItem('damn_last_visit', now.toString())
    localStorage.setItem('damn_last_path', currentPath)
  }

  async handleRoute() {
    const path = window.location.pathname
    
    console.log('Current path:', path)

    // Root domain - redirect to random user
    if (path === '/' || path === '') {
      await this.redirectToRandomUser()
      return
    }

    // User gallery - /u/username
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
  }

  async redirectToRandomUser() {
    if (this.isRedirecting) return
    
    this.isRedirecting = true
    console.log('Redirecting to random user...')

    try {
      // Get users who have public photos
      const { data: users, error } = await supabaseHelpers.getUsersWithPhotos()
      
      if (error || !users || users.length === 0) {
        console.error('No users with photos found:', error)
        this.showEmptyState()
        this.isRedirecting = false
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
      
      // Update localStorage to prevent immediate re-redirect
      localStorage.setItem('damn_last_visit', Date.now().toString())
      localStorage.setItem('damn_last_path', targetUrl)
      
      // Navigate to new user
      window.location.href = targetUrl
      
    } catch (error) {
      console.error('Error redirecting to random user:', error)
      this.showErrorState()
    }
    
    this.isRedirecting = false
  }

  async loadUserGallery(username) {
    console.log('Loading gallery for user:', username)
    
    try {
      // Update current user
      this.currentUser = username
      
      // Update page title
      document.title = `${username} - damnpictures`
      
      // Update label to show current user
      const label = document.getElementById('colaiLabel')
      if (label) {
        label.textContent = `damnpictures / ${username}`
      }

      // Load user's photos
      const { data: photos, error } = await supabaseHelpers.getUserPhotos(username)
      
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
      
      // Get public URL from Supabase Storage
      const { data } = supabase.storage
        .from('photos')
        .getPublicUrl(photo.file_path)
      
      img.src = data.publicUrl
      img.alt = photo.original_name || photo.filename
      
      // Handle image load errors
      img.onerror = () => {
        console.error('Failed to load image:', photo.filename)
        slide.style.display = 'none'
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