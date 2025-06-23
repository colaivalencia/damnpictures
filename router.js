// Simple router that actually works
class DamnPicturesRouter {
  constructor() {
    this.currentUser = null
    this.isRedirecting = false
    this.init()
  }

  init() {
    window.addEventListener('DOMContentLoaded', () => {
      this.waitForDependencies(() => {
        // Check if this is a page refresh
        const isRefresh = performance.getEntriesByType('navigation')[0]?.type === 'reload';
        
        if (isRefresh) {
          // Any refresh goes to random user
          console.log('Page refresh - going to random user');
          this.redirectToRandomUser();
        } else {
          // Normal navigation - handle the current route
          this.handleRoute();
        }
      });
    });
    
    window.addEventListener('popstate', () => this.handleRoute());
  }

  async waitForDependencies(callback) {
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
    console.log('Handling route:', path)

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

      await this.redirectToRandomUser()
      
    } catch (error) {
      console.error('Route error:', error)
      this.showErrorState()
    }
  }

  async redirectToRandomUser() {
    if (this.isRedirecting) return
    
    this.isRedirecting = true

    try {
      const { data: users, error } = await window.supabaseHelpers.getUsersWithPhotos()
      
      if (error || !users || users.length === 0) {
        this.showErrorState()
        return
      }

      const randomUser = users[Math.floor(Math.random() * users.length)]
      const targetUrl = `/u/${randomUser.username}`
      
      window.history.pushState({}, '', targetUrl)
      await this.loadUserGallery(randomUser.username)
      
    } catch (error) {
      console.error('Redirect error:', error)
      this.showErrorState()
    } finally {
      this.isRedirecting = false
    }
  }

  async loadUserGallery(username) {
    try {
      this.currentUser = username

      const { data: photos, error } = await window.supabaseHelpers.getUserPhotos(username)
      
      if (error) {
        this.showErrorState()
        return
      }

      if (!photos || photos.length === 0) {
        this.showEmptyUserState(username)
        return
      }

      // Update UI only after photos loaded successfully
      document.title = `${username} - damnpictures`
      
      if (window.authManager?.headerMenuManager) {
        window.authManager.headerMenuManager.onViewingUserChange(username)
      }

      this.populateGallery(photos)
      
    } catch (error) {
      console.error('Load gallery error:', error)
      this.showErrorState()
    }
  }

  getOptimizedImageUrl(photo) {
    if (!photo.drive_file_id) {
      if (photo.file_path) {
        const { data } = window.supabase.storage
          .from('photos')
          .getPublicUrl(photo.file_path)
        return data.publicUrl
      }
      return photo.file_url || null
    }

    return `https://lh3.googleusercontent.com/d/${photo.drive_file_id}=w2000-h2000-rw`
  }

  getBackupImageUrls(photo) {
    if (!photo.drive_file_id) return []
    
    return [
      `https://drive.google.com/uc?export=view&id=${photo.drive_file_id}`,
      `https://drive.google.com/thumbnail?id=${photo.drive_file_id}&sz=w2000`,
      `https://lh3.googleusercontent.com/d/${photo.drive_file_id}`,
    ]
  }

  populateGallery(photos) {
    const gallery = document.getElementById('gallery')
    if (!gallery) return

    gallery.innerHTML = ''

    const shuffledPhotos = this.shuffleArray([...photos])

    shuffledPhotos.forEach((photo, index) => {
      const slide = document.createElement('div')
      slide.className = 'slide'

      const img = document.createElement('img')
      
      const primaryUrl = this.getOptimizedImageUrl(photo)
      const backupUrls = this.getBackupImageUrls(photo)
      
      if (!primaryUrl) return
      
      img.src = primaryUrl
      img.alt = photo.original_name || photo.filename
      
      let currentFallbackIndex = 0
      img.onerror = () => {
        if (currentFallbackIndex < backupUrls.length) {
          img.src = backupUrls[currentFallbackIndex]
          currentFallbackIndex++
        } else {
          slide.innerHTML = `
            <div style="height: 100vh; display: flex; align-items: center; justify-content: center; background: #222; color: #666;">
              <div style="text-align: center;">
                <div style="font-size: 4rem;">📷</div>
                <div>Image unavailable</div>
              </div>
            </div>
          `
        }
      }

      slide.appendChild(img)
      gallery.appendChild(slide)
    })
  }

  shuffleArray(array) {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }

  showEmptyUserState(username) {
    const gallery = document.getElementById('gallery')
    if (!gallery) return

    gallery.innerHTML = `
      <div class="slide" style="display: flex; align-items: center; justify-content: center; color: #666; text-align: center;">
        <div>
          <div style="font-size: 4rem; margin-bottom: 1rem;">📷</div>
          <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">${username} hasn't shared any photos yet</div>
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
          <div style="font-size: 1.5rem;">Something went wrong</div>
        </div>
      </div>
    `
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.router = new DamnPicturesRouter()
})

window.DamnPicturesRouter = DamnPicturesRouter