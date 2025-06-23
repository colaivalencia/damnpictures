// Fixed uploadModal.js - Better auth state checking
// Simple upload manager - just upload photos
class ImageUploadManager {
  constructor() {
    this.MAX_PHOTOS_PER_USER = 72;
    this.MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    this.pendingFiles = [];
    this.isUploading = false;
    this.init();
  }

  init() {
    this.fileInput = document.getElementById('photoUpload');
    this.uploadBtn = document.getElementById('uploadBtn');
    this.uploadSection = document.getElementById('uploadSection');
    this.dropzone = document.getElementById('uploadDropzone');
    this.photoList = document.getElementById('photoList');

    this.setupEventListeners();
    this.setupModalListener();
  }

  setupModalListener() {
    const uploadModal = document.getElementById('uploadModal');
    if (uploadModal) {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
            const modal = mutation.target;
            if (!modal.classList.contains('hidden') && window.isLoggedIn()) {
              setTimeout(() => this.loadUserPhotos(), 200);
            }
          }
        });
      });
      
      observer.observe(uploadModal, {
        attributes: true,
        attributeFilter: ['class']
      });
    }
  }

  setupEventListeners() {
    if (this.fileInput) {
      this.fileInput.addEventListener('change', (e) => {
        this.handleFiles(e.target.files);
      });
    }

    if (this.uploadBtn) {
      this.uploadBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (this.pendingFiles.length > 0 && !this.isUploading) {
          this.uploadFiles();
        } else if (!this.isUploading) {
          this.fileInput.click();
        }
      });
    }

    this.setupDragAndDrop();
  }

  setupDragAndDrop() {
    if (!this.dropzone) return;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      this.dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    });

    ['dragenter', 'dragover'].forEach(eventName => {
      this.dropzone.addEventListener(eventName, () => {
        this.uploadSection?.classList.add('drag-over');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      this.dropzone.addEventListener(eventName, () => {
        this.uploadSection?.classList.remove('drag-over');
      });
    });

    this.dropzone.addEventListener('drop', (e) => {
      this.handleFiles(e.dataTransfer.files);
    });
  }

  handleFiles(files) {
    const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length === 0) {
      this.showToast('Please select image files only', 'error');
      return;
    }

    // Check file sizes
    const oversized = imageFiles.filter(file => file.size > this.MAX_FILE_SIZE);
    if (oversized.length > 0) {
      this.showToast(`Some files are too large (max ${this.formatFileSize(this.MAX_FILE_SIZE)})`, 'error');
      return;
    }

    this.pendingFiles = imageFiles;
    this.updateUploadButton();
    this.showFilePreview(imageFiles);
  }

  showFilePreview(files) {
    const uploadText = document.querySelector('.upload-text');
    const uploadSubtext = document.querySelector('.upload-subtext');
    
    if (uploadText) {
      uploadText.textContent = `${files.length} photo${files.length > 1 ? 's' : ''} ready`;
    }
    
    if (uploadSubtext) {
      const fileNames = files.slice(0, 3).map(f => f.name).join(', ');
      const remaining = files.length > 3 ? ` and ${files.length - 3} more...` : '';
      uploadSubtext.textContent = fileNames + remaining;
      uploadSubtext.classList.add('has-files');
    }

    this.uploadSection?.classList.add('has-files');
  }

  updateUploadButton() {
    if (!this.uploadBtn) return;
    
    const fileCount = this.pendingFiles.length;
    
    if (this.isUploading) {
      this.uploadBtn.textContent = 'Uploading...';
      this.uploadBtn.disabled = true;
    } else if (fileCount > 0) {
      this.uploadBtn.textContent = `Upload ${fileCount} Photo${fileCount > 1 ? 's' : ''}`;
      this.uploadBtn.disabled = false;
      this.uploadBtn.className = 'upload-btn ready';
    } else {
      this.uploadBtn.textContent = 'Select Photos';
      this.uploadBtn.disabled = true;
      this.uploadBtn.className = 'upload-btn';
    }
  }

  async uploadFiles() {
    if (!window.isLoggedIn() || this.isUploading) return;

    const userProfile = window.getCurrentUserProfile();
    if (!userProfile) {
      this.showToast('User profile not found', 'error');
      return;
    }

    const files = this.pendingFiles;
    if (files.length === 0) return;

    this.isUploading = true;
    this.updateUploadButton();

    let successful = 0;
    let failed = 0;

    for (const file of files) {
      try {
        // Upload to Google Drive
        const uploadResult = await supabaseHelpers.uploadPhoto(file, userProfile.username);
        
        if (uploadResult.error) {
          throw new Error(uploadResult.error);
        }

        // Save metadata
        const photoData = {
          username: userProfile.username,
          filename: `${Date.now()}_${file.name}`,
          original_name: file.name,
          publicUrl: uploadResult.data.publicUrl,
          fileId: uploadResult.data.fileId,
          file_size: file.size
        };

        const metadataResult = await supabaseHelpers.savePhotoMetadata(photoData, userProfile);
        
        if (metadataResult.error) {
          throw new Error(metadataResult.error.message);
        }

        successful++;
        
      } catch (error) {
        console.error(`Upload failed for ${file.name}:`, error);
        failed++;
      }
    }

    // Show results
    if (failed > 0) {
      this.showToast(`Uploaded ${successful}, ${failed} failed`, 'warning');
    } else {
      this.showToast(`Successfully uploaded ${successful} photo${successful > 1 ? 's' : ''}!`, 'success');
    }

    // Cleanup
    this.isUploading = false;
    this.pendingFiles = [];
    if (this.fileInput) this.fileInput.value = '';
    this.resetUploadSection();
    this.updateUploadButton();

    // Reload photos
    await this.loadUserPhotos();
  }

  async loadUserPhotos() {
    if (!window.isLoggedIn()) return;

    const userProfile = window.getCurrentUserProfile();
    if (!userProfile) return;

    try {
      const { data: photos, error } = await supabaseHelpers.getUserPhotos(userProfile.username);
      
      if (error) {
        console.error('Error loading user photos:', error);
        return;
      }

      this.displayUserPhotos(photos || []);
      
    } catch (error) {
      console.error('Exception in loadUserPhotos:', error);
    }
  }

  displayUserPhotos(photos) {
    if (!this.photoList) return;
    
    if (!photos || photos.length === 0) {
      this.photoList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📷</div>
          <div>No photos uploaded yet</div>
          <div style="color: #666; font-size: 14px; margin-top: 8px;">
            Upload up to ${this.MAX_PHOTOS_PER_USER} photos
          </div>
        </div>
      `;
      return;
    }

    const headerHtml = `
      <div class="photos-header" style="
        grid-column: 1 / -1; 
        margin-bottom: 20px;
        display: flex; 
        align-items: center; 
        justify-content: space-between;
        padding: 16px 0;
        border-bottom: 1px solid rgba(255,255,255,0.1);
      ">
        <h3 style="margin: 0; color: #fff; font-size: 18px; font-weight: 600;">
          Your Photos (${photos.length}/${this.MAX_PHOTOS_PER_USER})
        </h3>
      </div>
    `;

    const photosHtml = photos.map((photo) => {
      const imageUrl = this.getOptimizedImageUrl(photo);
      
      return `
        <div class="photo-item" data-photo-id="${photo.id}" data-drive-id="${photo.drive_file_id}">
          <img src="${imageUrl}" alt="${photo.original_name}" loading="lazy" 
               onerror="uploadManager.handleImageError(this, '${photo.drive_file_id}')" />
          <div class="photo-overlay">
            <button class="delete-btn" onclick="uploadManager.deletePhoto('${photo.id}', '${photo.drive_file_id}')">
              ×
            </button>
          </div>
        </div>
      `;
    }).join('');
    
    this.photoList.innerHTML = headerHtml + photosHtml;
  }

  async deletePhoto(photoId, driveFileId) {
    if (!confirm('Are you sure you want to delete this photo?')) {
      return;
    }

    try {
      const { error } = await supabaseHelpers.deletePhoto(photoId, driveFileId);
      
      if (error) {
        this.showToast('Failed to delete photo', 'error');
        return;
      }

      // Remove from UI immediately
      const photoElement = document.querySelector(`[data-photo-id="${photoId}"]`);
      if (photoElement) {
        photoElement.remove();
      }

      this.showToast('Photo deleted', 'success');
      
    } catch (error) {
      console.error('Delete error:', error);
      this.showToast('Failed to delete photo', 'error');
    }
  }

  getOptimizedImageUrl(photo) {
    if (photo.drive_file_id) {
      return `https://lh3.googleusercontent.com/d/${photo.drive_file_id}=w400-h400-c`;
    }
    return photo.file_url;
  }

  handleImageError(imgElement, driveFileId) {
    const fallbackUrls = [
      `https://drive.google.com/uc?export=view&id=${driveFileId}`,
      `https://lh3.googleusercontent.com/d/${driveFileId}=w400`,
      `https://lh3.googleusercontent.com/d/${driveFileId}`
    ];

    const currentSrc = imgElement.src;
    const nextFallback = fallbackUrls.find(url => url !== currentSrc);

    if (nextFallback) {
      imgElement.src = nextFallback;
    } else {
      imgElement.parentElement.innerHTML = `
        <div style="
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #333;
          color: #666;
          flex-direction: column;
          gap: 8px;
        ">
          <div style="font-size: 2rem;">📷</div>
          <div style="font-size: 0.8rem;">Image unavailable</div>
        </div>
      `;
    }
  }

  resetUploadSection() {
    const uploadText = document.querySelector('.upload-text');
    const uploadSubtext = document.querySelector('.upload-subtext');
    
    if (uploadText) {
      uploadText.textContent = 'Drop your pictures here or click to browse';
    }
    if (uploadSubtext) {
      uploadSubtext.classList.remove('has-files');
      uploadSubtext.textContent = 'Supports JPG, PNG, GIF • Max 10MB per file';
    }
    
    this.uploadSection?.classList.remove('has-files');
  }

  showToast(message, type = 'info') {
    // Remove existing toast
    const existingToast = document.querySelector('.upload-toast');
    if (existingToast) {
      existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = 'upload-toast';
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 16px;
      border-radius: 6px;
      color: white;
      font-size: 14px;
      font-weight: 500;
      z-index: 10000;
      max-width: 300px;
      animation: slideInRight 0.3s ease-out;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    `;

    const colors = {
      error: '#ff4757',
      success: '#2ed573',
      warning: '#ffa502',
      info: '#667eea'
    };

    toast.style.background = colors[type] || colors.info;
    toast.textContent = message;

    document.body.appendChild(toast);

    // Auto-remove after 3 seconds
    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.animation = 'slideOutRight 0.3s ease-in';
        setTimeout(() => toast.remove(), 300);
      }
    }, 3000);

    // Click to dismiss
    toast.addEventListener('click', () => {
      toast.style.animation = 'slideOutRight 0.3s ease-in';
      setTimeout(() => toast.remove(), 300);
    });
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.uploadManager = new ImageUploadManager();
});

window.ImageUploadManager = ImageUploadManager;

// Initialize upload manager when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.uploadManager = new ImageUploadManager();
});

// Make manager available globally
window.ImageUploadManager = ImageUploadManager;