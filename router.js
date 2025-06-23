// Ultra-simple router - just works
class DamnPicturesRouter {
  constructor() {
    this.currentUser = null
    this.init()
  }

  init() {
    // Start immediately when ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.start());
    } else {
      this.start();
    }
    
    window.addEventListener('popstate', () => this.handleRoute());
  }

  start() {
    // Simple refresh check
    const isRefresh = performance.getEntriesByType('navigation')[0]?.type === 'reload';
    
    if (isRefresh) {
      this.goToRandomUser();
    } else {
      this.handleRoute();
    }
  }

  async handleRoute() {
    const path = window.location.pathname;
    
    if (path === '/' || path === '') {
      this.goToRandomUser();
    } else if (path.startsWith('/u/')) {
      const username = path.split('/u/')[1];
      if (username) {
        this.loadUser(username);
      } else {
        this.goToRandomUser();
      }
    }
  }

  async goToRandomUser() {
    // Wait for supabase to exist
    while (!window.supabaseHelpers) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    try {
      const { data: users, error } = await window.supabaseHelpers.getUsersWithPhotos();
      
      if (error || !users || users.length === 0) {
        this.showError();
        return;
      }

      const randomUser = users[Math.floor(Math.random() * users.length)];
      const targetUrl = `/u/${randomUser.username}`;
      
      window.history.pushState({}, '', targetUrl);
      this.loadUser(randomUser.username);
      
    } catch (error) {
      console.error('Random user error:', error);
      this.showError();
    }
  }

  async loadUser(username) {
    this.currentUser = username;
    document.title = `${username} - damnpictures`;
    
    // Update header if it exists
    if (window.authManager?.headerMenuManager) {
      window.authManager.headerMenuManager.onViewingUserChange(username);
    }

    try {
      const { data: photos, error } = await window.supabaseHelpers.getUserPhotos(username);
      
      if (error) {
        this.showError();
        return;
      }

      if (!photos || photos.length === 0) {
        this.showEmpty(username);
        return;
      }

      this.showPhotos(photos);
      
    } catch (error) {
      console.error('Load user error:', error);
      this.showError();
    }
  }

  showPhotos(photos) {
    const gallery = document.getElementById('gallery');
    if (!gallery) return;

    gallery.innerHTML = '';

    // Shuffle photos
    const shuffled = [...photos].sort(() => Math.random() - 0.5);

    shuffled.forEach((photo) => {
      const slide = document.createElement('div');
      slide.className = 'slide';

      const img = document.createElement('img');
      img.src = this.getImageUrl(photo);
      img.alt = photo.original_name || photo.filename;
      
      img.onerror = () => {
        slide.innerHTML = `
          <div style="height: 100vh; display: flex; align-items: center; justify-content: center; background: #222; color: #666;">
            <div style="text-align: center;">
              <div style="font-size: 4rem;">📷</div>
              <div>Image unavailable</div>
            </div>
          </div>
        `;
      };

      slide.appendChild(img);
      gallery.appendChild(slide);
    });
  }

  getImageUrl(photo) {
    if (photo.drive_file_id) {
      return `https://lh3.googleusercontent.com/d/${photo.drive_file_id}=w2000-h2000-rw`;
    }
    return photo.file_url;
  }

  showEmpty(username) {
    const gallery = document.getElementById('gallery');
    if (!gallery) return;

    gallery.innerHTML = `
      <div class="slide" style="display: flex; align-items: center; justify-content: center; color: #666; text-align: center;">
        <div>
          <div style="font-size: 4rem; margin-bottom: 1rem;">📷</div>
          <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">${username} hasn't shared any photos yet</div>
        </div>
      </div>
    `;
  }

  showError() {
    const gallery = document.getElementById('gallery');
    if (!gallery) return;

    gallery.innerHTML = `
      <div class="slide" style="display: flex; align-items: center; justify-content: center; color: #ff4757; text-align: center;">
        <div>
          <div style="font-size: 4rem; margin-bottom: 1rem;">⚠️</div>
          <div style="font-size: 1.5rem;">Something went wrong</div>
        </div>
      </div>
    `;
  }
}

// Start when page loads
window.router = new DamnPicturesRouter();
window.DamnPicturesRouter = DamnPicturesRouter;