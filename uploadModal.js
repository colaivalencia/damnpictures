// Clean uploadModal.js with proper structure

class ImageUploadManager {
  constructor() {
    this.maxFileSize = 2 * 1024 * 1024; // 2MB in bytes
    this.compressionQuality = 0.8; // Start with 80% quality
    this.maxDimension = 2048; // Max width/height for compression
    this.selectedPhotos = new Set(); // Track selected photos for bulk delete
    this.pendingFiles = []; // Files ready for upload confirmation
    this.init();
  }

  init() {
    this.fileInput = document.getElementById('photoUpload');
    this.uploadBtn = document.getElementById('uploadBtn');
    this.uploadSection = document.getElementById('uploadSection');
    this.dropzone = document.getElementById('uploadDropzone');
    this.progressBar = document.getElementById('uploadProgress');
    this.progressBarFill = document.getElementById('uploadProgressBar');
    this.photoList = document.getElementById('photoList');

    this.setupEventListeners();
    this.createConfirmationModal();
    this.setupModalOpenListener();
    
    // Load photos when initialized
    this.loadUserPhotos();
  }

  setupModalOpenListener() {
    const uploadModal = document.getElementById('uploadModal');
    if (uploadModal) {
      // Use MutationObserver to detect when modal becomes visible
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
            const modal = mutation.target;
            if (!modal.classList.contains('hidden') && window.isLoggedIn()) {
              console.log('🎯 Upload modal opened, loading photos...');
              this.loadUserPhotos();
            }
          }
        });
      });
      
      observer.observe(uploadModal, {
        attributes: true,
        attributeFilter: ['class']
      });
      
      console.log('📋 Modal open listener setup complete');
    }
  }

  createConfirmationModal() {
    // Create upload confirmation modal if it doesn't exist
    if (document.getElementById('uploadConfirmModal')) return;

    const confirmModal = document.createElement('div');
    confirmModal.id = 'uploadConfirmModal';
    confirmModal.className = 'modal hidden';
    confirmModal.innerHTML = `
      <div class="modal-content" style="width: min(90vw, 700px); max-height: 80vh;">
        <div class="modal-header">
          <h2 class="modal-title">Confirm Upload</h2>
          <button class="close-btn" id="closeConfirmModal">&times;</button>
        </div>
        <div class="modal-body">
          <div style="margin-bottom: 16px;">
            <p style="color: #ccc; margin: 0;">Review your photos before uploading. Click on any photo to remove it.</p>
          </div>
          <div id="confirmPhotoGrid" class="photos-grid" style="max-height: 400px; overflow-y: auto;">
            <!-- Preview photos will be inserted here -->
          </div>
          <div style="display: flex; gap: 12px; margin-top: 24px;">
            <button id="cancelUploadBtn" class="secondary-btn" style="flex: 1;">Cancel</button>
            <button id="proceedUploadBtn" class="primary-btn" style="flex: 2;">Upload Photos</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(confirmModal);

    // Setup event listeners for confirmation modal
    document.getElementById('closeConfirmModal').addEventListener('click', () => {
      this.hideConfirmationModal();
    });

    document.getElementById('cancelUploadBtn').addEventListener('click', () => {
      this.cancelUpload();
    });

    document.getElementById('proceedUploadBtn').addEventListener('click', () => {
      this.proceedWithUpload();
    });

    // Close on escape key
    confirmModal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.hideConfirmationModal();
      }
    });
  }

  setupEventListeners() {
    // File input change
    this.fileInput.addEventListener('change', (e) => {
      this.handleFiles(e.target.files);
      this.updateUploadButton();
    });

    // Upload button click - Show confirmation
    this.uploadBtn.addEventListener('click', () => {
      if (this.pendingFiles.length > 0) {
        this.showUploadConfirmation();
      } else {
        this.fileInput.click();
      }
    });

    // Drag and drop
    this.setupDragAndDrop();
  }

  setupDragAndDrop() {
    const preventDefaults = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      this.dropzone.addEventListener(eventName, preventDefaults);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
      this.dropzone.addEventListener(eventName, () => {
        this.uploadSection.classList.add('drag-over');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      this.dropzone.addEventListener(eventName, () => {
        this.uploadSection.classList.remove('drag-over');
      });
    });

    this.dropzone.addEventListener('drop', (e) => {
      const files = e.dataTransfer.files;
      this.handleFiles(files);
    });
  }

  handleFiles(files) {
    const fileArray = Array.from(files);
    const imageFiles = fileArray.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length === 0) {
      alert('Please select image files only (JPG, PNG, GIF, WebP)');
      return;
    }

    if (imageFiles.length !== fileArray.length) {
      alert(`${fileArray.length - imageFiles.length} non-image files were ignored`);
    }

    this.validateAndDisplayFiles(imageFiles);
  }

  async validateAndDisplayFiles(files) {
    console.log(`Processing ${files.length} files...`);
    
    const validFiles = [];
    const oversizedFiles = [];
    
    for (const file of files) {
      if (file.size > this.maxFileSize) {
        try {
          const compressedFile = await this.compressImage(file);
          if (compressedFile.size <= this.maxFileSize) {
            validFiles.push(compressedFile);
            console.log(`✅ Compressed ${file.name} from ${this.formatFileSize(file.size)} to ${this.formatFileSize(compressedFile.size)}`);
          } else {
            oversizedFiles.push(file);
          }
        } catch (error) {
          console.error(`Compression failed for ${file.name}:`, error);
          oversizedFiles.push(file);
        }
      } else {
        validFiles.push(file);
      }
    }

    if (oversizedFiles.length > 0) {
      const oversizedNames = oversizedFiles.map(f => f.name).join(', ');
      alert(`These files are too large and couldn't be compressed enough: ${oversizedNames}`);
    }

    if (validFiles.length > 0) {
      this.pendingFiles = validFiles;
      this.updateUploadButton();
      this.showFilePreview(validFiles);
    } else {
      this.pendingFiles = [];
      this.updateUploadButton();
    }
  }

  async compressImage(file) {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        try {
          let { width, height } = this.calculateDimensions(img.width, img.height);
          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);
          this.compressWithQuality(canvas, file, resolve, reject);
        } catch (error) {
          reject(error);
        }
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  }

  compressWithQuality(canvas, originalFile, resolve, reject, quality = this.compressionQuality) {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Compression failed'));
        return;
      }

      if (blob.size > this.maxFileSize && quality > 0.1) {
        this.compressWithQuality(canvas, originalFile, resolve, reject, quality - 0.1);
        return;
      }

      const compressedFile = new File([blob], originalFile.name, {
        type: originalFile.type,
        lastModified: Date.now()
      });

      resolve(compressedFile);
    }, originalFile.type, quality);
  }

  calculateDimensions(originalWidth, originalHeight) {
    if (originalWidth <= this.maxDimension && originalHeight <= this.maxDimension) {
      return { width: originalWidth, height: originalHeight };
    }

    const aspectRatio = originalWidth / originalHeight;
    
    if (originalWidth > originalHeight) {
      return {
        width: this.maxDimension,
        height: Math.round(this.maxDimension / aspectRatio)
      };
    } else {
      return {
        width: Math.round(this.maxDimension * aspectRatio),
        height: this.maxDimension
      };
    }
  }

  showFilePreview(files) {
    const fileNames = files.map(f => `${f.name} (${this.formatFileSize(f.size)})`).join(', ');
    const uploadText = document.querySelector('.upload-text');
    if (uploadText) {
      uploadText.textContent = `${files.length} file(s) ready to upload`;
    }
    
    const uploadSubtext = document.querySelector('.upload-subtext');
    if (uploadSubtext) {
      uploadSubtext.textContent = fileNames;
    }
  }

  updateUploadButton() {
    const fileCount = this.pendingFiles.length;
    const uploadBtnContainer = this.uploadBtn.parentElement;
    
    if (fileCount > 0) {
      // Show both Review and Quick Upload buttons
      this.uploadBtn.textContent = `Review ${fileCount} Photo${fileCount > 1 ? 's' : ''}`;
      this.uploadBtn.disabled = false;
      this.uploadBtn.style.background = 'transparent';
      this.uploadBtn.style.border = '2px solid #667eea';
      this.uploadBtn.style.color = '#667eea';
      
      // Create or update quick upload button
      let quickUploadBtn = document.getElementById('quickUploadBtn');
      if (!quickUploadBtn) {
        quickUploadBtn = document.createElement('button');
        quickUploadBtn.id = 'quickUploadBtn';
        quickUploadBtn.className = 'quick-upload-btn';
        quickUploadBtn.addEventListener('click', () => {
          this.proceedWithUpload();
        });
        uploadBtnContainer.appendChild(quickUploadBtn);
      }
      
      quickUploadBtn.textContent = `Quick Upload ${fileCount} Photo${fileCount > 1 ? 's' : ''}`;
      quickUploadBtn.disabled = false;
      quickUploadBtn.style.display = 'block';
      
    } else {
      // Reset to default state
      this.uploadBtn.textContent = 'Select Photos';
      this.uploadBtn.disabled = true;
      this.uploadBtn.style.background = '#555';
      this.uploadBtn.style.border = 'none';
      this.uploadBtn.style.color = 'white';
      
      const quickUploadBtn = document.getElementById('quickUploadBtn');
      if (quickUploadBtn) {
        quickUploadBtn.style.display = 'none';
      }
    }
  }

  async showUploadConfirmation() {
    if (this.pendingFiles.length === 0) return;

    const confirmModal = document.getElementById('uploadConfirmModal');
    const photoGrid = document.getElementById('confirmPhotoGrid');
    const proceedBtn = document.getElementById('proceedUploadBtn');

    proceedBtn.textContent = `Upload ${this.pendingFiles.length} Photo${this.pendingFiles.length > 1 ? 's' : ''}`;

    photoGrid.innerHTML = '';
    
    for (let i = 0; i < this.pendingFiles.length; i++) {
      const file = this.pendingFiles[i];
      const preview = await this.createFilePreview(file, i);
      photoGrid.appendChild(preview);
    }

    confirmModal.classList.remove('hidden');
  }

  createFilePreview(file, index) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const preview = document.createElement('div');
        preview.className = 'preview-item';
        preview.dataset.index = index;
        preview.innerHTML = `
          <div style="
            position: relative;
            aspect-ratio: 1;
            border-radius: 8px;
            overflow: hidden;
            background: #333;
            cursor: pointer;
            transition: all 0.2s ease;
          " onclick="uploadManager.removeFileFromUpload(${index})">
            <img src="${e.target.result}" alt="${file.name}" style="
              width: 100%;
              height: 100%;
              object-fit: cover;
            " />
            <div style="
              position: absolute;
              top: 8px;
              right: 8px;
              background: rgba(255, 71, 87, 0.9);
              color: white;
              border-radius: 50%;
              width: 24px;
              height: 24px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 16px;
              font-weight: bold;
              opacity: 0;
              transition: all 0.2s ease;
            " class="remove-icon">×</div>
            <div style="
              position: absolute;
              bottom: 0;
              left: 0;
              right: 0;
              background: linear-gradient(transparent, rgba(0,0,0,0.8));
              color: white;
              padding: 8px;
              font-size: 12px;
              text-align: center;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            ">${file.name}</div>
          </div>
        `;

        const previewElement = preview.firstElementChild;
        previewElement.addEventListener('mouseenter', () => {
          previewElement.style.transform = 'scale(1.05)';
          previewElement.querySelector('.remove-icon').style.opacity = '1';
        });
        previewElement.addEventListener('mouseleave', () => {
          previewElement.style.transform = 'scale(1)';
          previewElement.querySelector('.remove-icon').style.opacity = '0';
        });

        resolve(preview);
      };
      reader.readAsDataURL(file);
    });
  }

  removeFileFromUpload(index) {
    this.pendingFiles.splice(index, 1);
    
    if (this.pendingFiles.length > 0) {
      this.showUploadConfirmation();
    } else {
      this.hideConfirmationModal();
      this.resetUploadSection();
    }
  }

  hideConfirmationModal() {
    const confirmModal = document.getElementById('uploadConfirmModal');
    confirmModal.classList.add('hidden');
  }

  cancelUpload() {
    this.pendingFiles = [];
    this.fileInput.value = '';
    this.hideConfirmationModal();
    this.resetUploadSection();
    this.updateUploadButton();
    
    const quickUploadBtn = document.getElementById('quickUploadBtn');
    if (quickUploadBtn) {
      quickUploadBtn.style.display = 'none';
    }
  }

  async proceedWithUpload() {
    this.hideConfirmationModal();
    await this.uploadFiles();
  }

  async uploadFiles() {
    if (!window.isLoggedIn()) {
      alert('Please log in to upload photos');
      return;
    }

    const userProfile = window.getCurrentUserProfile();
    if (!userProfile) {
      alert('User profile not found');
      return;
    }

    const files = this.pendingFiles;
    if (files.length === 0) return;

    this.uploadBtn.disabled = true;
    this.uploadBtn.textContent = 'Uploading...';
    this.showProgress(true);

    const results = { successful: [], failed: [] };

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const progress = ((i + 1) / files.length) * 100;
      
      this.updateProgress(progress);
      this.uploadBtn.textContent = `Uploading... (${i + 1}/${files.length})`;

      try {
        const uploadResult = await supabaseHelpers.uploadPhoto(file, userProfile.username);
        
        if (uploadResult.error) {
          results.failed.push({ file: file.name, error: uploadResult.error });
          continue;
        }

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
          results.failed.push({ file: file.name, error: metadataResult.error.message });
        } else {
          results.successful.push(file.name);
        }

      } catch (error) {
        results.failed.push({ file: file.name, error: error.message });
      }
    }

    this.showProgress(false);
    this.uploadBtn.disabled = false;
    this.updateUploadButton();

    if (results.failed.length > 0) {
      const failedNames = results.failed.map(f => f.file).join(', ');
      alert(`Failed to upload: ${failedNames}`);
    } else {
      this.pendingFiles = [];
      this.fileInput.value = '';
      this.resetUploadSection();
      
      const quickUploadBtn = document.getElementById('quickUploadBtn');
      if (quickUploadBtn) {
        quickUploadBtn.style.display = 'none';
      }
    }

    await this.loadUserPhotos();
  }

  resetUploadSection() {
    const uploadText = document.querySelector('.upload-text');
    const uploadSubtext = document.querySelector('.upload-subtext');
    
    if (uploadText) {
      uploadText.textContent = 'Drop your photos here or click to browse';
    }
    if (uploadSubtext) {
      uploadSubtext.textContent = 'Supports JPG, PNG, GIF • Auto-compressed to 2MB • Any size accepted';
    }
  }

  showProgress(show) {
    if (show) {
      this.progressBar.style.display = 'block';
    } else {
      this.progressBar.style.display = 'none';
      this.updateProgress(0);
    }
  }

  updateProgress(percent) {
    this.progressBarFill.style.width = `${percent}%`;
  }

  async loadUserPhotos() {
    console.log('=== loadUserPhotos called ===');
    
    const userProfile = window.getCurrentUserProfile();
    console.log('User profile:', userProfile);
    
    if (!userProfile) {
      console.log('❌ No user profile found');
      return;
    }

    try {
      console.log(`🔍 Fetching photos for username: ${userProfile.username}`);
      
      const { data: photos, error } = await supabaseHelpers.getUserPhotos(userProfile.username);
      
      console.log('Supabase response:', { photos: photos?.length, error });
      
      if (error) {
        console.error('Error loading user photos:', error);
        return;
      }

      console.log(`📸 Found ${photos?.length || 0} photos`);
      
      if (photos && photos.length > 0) {
        console.log('Sample photo:', photos[0]);
      }

      this.displayUserPhotos(photos || []);
      
    } catch (error) {
      console.error('Exception in loadUserPhotos:', error);
    }
  }

  displayUserPhotos(photos) {
    console.log('=== displayUserPhotos called ===');
    console.log('Photos to display:', photos?.length);
    console.log('photoList element:', this.photoList);
    
    if (!this.photoList) {
      console.error('❌ photoList element not found!');
      return;
    }
    
    if (!photos || photos.length === 0) {
      console.log('📝 Showing empty state');
      this.photoList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📷</div>
          <div>No photos uploaded yet</div>
        </div>
      `;
      return;
    }

    console.log('🎨 Generating HTML for photos...');
    
    const photosHtml = photos.map((photo, index) => {
      const imageUrl = this.getOptimizedImageUrl(photo);
      console.log(`Photo ${index + 1}: ${photo.filename} → ${imageUrl}`);
      
      return `
        <div class="photo-item" data-photo-id="${photo.id}">
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
    
    console.log('📄 Setting innerHTML...');
    this.photoList.innerHTML = photosHtml;
    console.log('✅ displayUserPhotos complete');
  }

  getOptimizedImageUrl(photo) {
    if (photo.drive_file_id) {
      return `https://lh3.googleusercontent.com/d/${photo.drive_file_id}=w400-h400-c`;
    }
    return photo.file_url;
  }

  handleImageError(imgElement, driveFileId) {
    console.log(`Image failed to load for drive ID: ${driveFileId}`);
    
    const fallbackUrls = [
      `https://drive.google.com/uc?export=view&id=${driveFileId}`,
      `https://lh3.googleusercontent.com/d/${driveFileId}=w400`,
      `https://drive.google.com/thumbnail?id=${driveFileId}&sz=w400`,
      `https://lh3.googleusercontent.com/d/${driveFileId}`
    ];

    const currentSrc = imgElement.src;
    const nextFallback = fallbackUrls.find(url => url !== currentSrc);

    if (nextFallback) {
      console.log(`Trying fallback URL: ${nextFallback}`);
      imgElement.src = nextFallback;
    } else {
      imgElement.style.display = 'none';
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

  async deletePhoto(photoId, driveFileId) {
    if (!confirm('Are you sure you want to delete this photo?')) {
      return;
    }

    try {
      const { error } = await supabaseHelpers.deletePhoto(photoId, driveFileId);
      
      if (error) {
        alert('Failed to delete photo. Please try again.');
        return;
      }

      const photoElement = document.querySelector(`[data-photo-id="${photoId}"]`);
      if (photoElement) {
        photoElement.remove();
      }

      await this.loadUserPhotos();
      
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete photo. Please try again.');
    }
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Initialize upload manager when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.uploadManager = new ImageUploadManager();
});

// Make manager available globally
window.ImageUploadManager = ImageUploadManager;

// Test function
window.testPhotoLoad = async function() {
  console.log('🧪 Manual test photo load...');
  if (window.uploadManager) {
    await window.uploadManager.loadUserPhotos();
  } else {
    console.error('❌ uploadManager not found');
  }
};

console.log('📸 Upload manager loaded. Test with: window.testPhotoLoad()');