// Fixed uploadModal.js with proper file size validation and image compression

class ImageUploadManager {
  constructor() {
    this.maxFileSize = 2 * 1024 * 1024; // 2MB in bytes
    this.compressionQuality = 0.8; // Start with 80% quality
    this.maxDimension = 2048; // Max width/height for compression
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
    this.loadUserPhotos();
  }

  setupEventListeners() {
    // File input change
    this.fileInput.addEventListener('change', (e) => {
      this.handleFiles(e.target.files);
    });

    // Upload button click
    this.uploadBtn.addEventListener('click', () => {
      if (this.fileInput.files.length > 0) {
        this.uploadFiles();
      } else {
        this.fileInput.click();
      }
    });

    // Drag and drop
    this.setupDragAndDrop();

    // Update button state when files selected
    this.fileInput.addEventListener('change', () => {
      this.updateUploadButton();
    });
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

    // Validate and show file info
    this.validateAndDisplayFiles(imageFiles);
  }

  async validateAndDisplayFiles(files) {
    console.log(`Processing ${files.length} files...`);
    
    const validFiles = [];
    const oversizedFiles = [];
    
    for (const file of files) {
      console.log(`Checking file: ${file.name} (${this.formatFileSize(file.size)})`);
      
      if (file.size > this.maxFileSize) {
        console.log(`File ${file.name} is too large, will compress`);
        try {
          const compressedFile = await this.compressImage(file);
          if (compressedFile.size <= this.maxFileSize) {
            validFiles.push(compressedFile);
            console.log(`✅ Compressed ${file.name} from ${this.formatFileSize(file.size)} to ${this.formatFileSize(compressedFile.size)}`);
          } else {
            oversizedFiles.push(file);
            console.log(`❌ Could not compress ${file.name} enough`);
          }
        } catch (error) {
          console.error(`Compression failed for ${file.name}:`, error);
          oversizedFiles.push(file);
        }
      } else {
        validFiles.push(file);
        console.log(`✅ File ${file.name} is acceptable size`);
      }
    }

    // Show results
    if (oversizedFiles.length > 0) {
      const oversizedNames = oversizedFiles.map(f => f.name).join(', ');
      alert(`These files are too large and couldn't be compressed enough: ${oversizedNames}`);
    }

    if (validFiles.length > 0) {
      // Update file input with valid files
      const dt = new DataTransfer();
      validFiles.forEach(file => dt.items.add(file));
      this.fileInput.files = dt.files;
      
      this.updateUploadButton();
      this.showFilePreview(validFiles);
    } else {
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
          // Calculate new dimensions
          let { width, height } = this.calculateDimensions(img.width, img.height);
          
          canvas.width = width;
          canvas.height = height;
          
          // Draw and compress
          ctx.drawImage(img, 0, 0, width, height);
          
          // Try different quality levels until under 2MB
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

      // If still too large and quality can be reduced further
      if (blob.size > this.maxFileSize && quality > 0.1) {
        console.log(`Still ${this.formatFileSize(blob.size)}, reducing quality to ${Math.round((quality - 0.1) * 100)}%`);
        this.compressWithQuality(canvas, originalFile, resolve, reject, quality - 0.1);
        return;
      }

      // Create file with compressed data
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
    const fileCount = this.fileInput.files.length;
    
    if (fileCount > 0) {
      this.uploadBtn.textContent = `Upload ${fileCount} Photo${fileCount > 1 ? 's' : ''}`;
      this.uploadBtn.disabled = false;
      this.uploadBtn.style.background = 'linear-gradient(45deg, #667eea, #764ba2)';
    } else {
      this.uploadBtn.textContent = 'Select Photos';
      this.uploadBtn.disabled = true;
      this.uploadBtn.style.background = '#555';
    }
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

    const files = Array.from(this.fileInput.files);
    if (files.length === 0) return;

    console.log(`Starting upload of ${files.length} files for user: ${userProfile.username}`);

    this.uploadBtn.disabled = true;
    this.uploadBtn.textContent = 'Uploading...';
    this.showProgress(true);

    const results = {
      successful: [],
      failed: []
    };

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const progress = ((i + 1) / files.length) * 100;
      
      this.updateProgress(progress);
      this.uploadBtn.textContent = `Uploading... (${i + 1}/${files.length})`;

      try {
        console.log(`Uploading file ${i + 1}/${files.length}: ${file.name} (${this.formatFileSize(file.size)})`);

        // Upload to Google Drive via Netlify Function
        const uploadResult = await supabaseHelpers.uploadPhoto(file, userProfile.username);
        
        if (uploadResult.error) {
          console.error(`Upload failed for ${file.name}:`, uploadResult.error);
          results.failed.push({ file: file.name, error: uploadResult.error });
          continue;
        }

        // Save metadata to database
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
          console.error(`Metadata save failed for ${file.name}:`, metadataResult.error);
          results.failed.push({ file: file.name, error: metadataResult.error.message });
        } else {
          console.log(`✅ Successfully uploaded: ${file.name}`);
          results.successful.push(file.name);
        }

      } catch (error) {
        console.error(`Unexpected error uploading ${file.name}:`, error);
        results.failed.push({ file: file.name, error: error.message });
      }
    }

    // Upload complete
    this.showProgress(false);
    this.uploadBtn.disabled = false;
    this.updateUploadButton();

    // Show results
    if (results.successful.length > 0) {
      console.log(`✅ Successfully uploaded ${results.successful.length} photos`);
    }

    if (results.failed.length > 0) {
      console.error(`❌ Failed to upload ${results.failed.length} photos:`, results.failed);
      const failedNames = results.failed.map(f => f.file).join(', ');
      alert(`Failed to upload: ${failedNames}`);
    } else {
      // Clear the file input and reset preview
      this.fileInput.value = '';
      this.resetUploadSection();
    }

    // Refresh the photo list
    await this.loadUserPhotos();
  }

  resetUploadSection() {
    const uploadText = document.querySelector('.upload-text');
    const uploadSubtext = document.querySelector('.upload-subtext');
    
    if (uploadText) {
      uploadText.textContent = 'Drop your photos here or click to browse';
    }
    if (uploadSubtext) {
      uploadSubtext.textContent = 'Supports JPG, PNG, GIF up to 2MB (auto-compressed)';
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
      console.error('Error loading user photos:', error);
    }
  }

  displayUserPhotos(photos) {
    if (!photos || photos.length === 0) {
      this.photoList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📷</div>
          <div>No photos uploaded yet</div>
        </div>
      `;
      return;
    }

    this.photoList.innerHTML = photos.map(photo => {
      const imageUrl = this.getOptimizedImageUrl(photo);
      
      return `
        <div class="photo-item" data-photo-id="${photo.id}">
          <img src="${imageUrl}" alt="${photo.original_name}" loading="lazy" />
          <div class="photo-overlay">
            <button class="delete-btn" onclick="uploadManager.deletePhoto('${photo.id}', '${photo.drive_file_id}')">
              ×
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  getOptimizedImageUrl(photo) {
    if (photo.drive_file_id) {
      return `https://lh3.googleusercontent.com/d/${photo.drive_file_id}=w400-h400-c`;
    }
    return photo.file_url;
  }

  async deletePhoto(photoId, driveFileId) {
    if (!confirm('Are you sure you want to delete this photo?')) {
      return;
    }

    try {
      console.log(`Deleting photo: ${photoId}`);
      
      const { error } = await supabaseHelpers.deletePhoto(photoId, driveFileId);
      
      if (error) {
        console.error('Delete error:', error);
        alert('Failed to delete photo. Please try again.');
        return;
      }

      console.log('✅ Photo deleted successfully');
      
      // Remove from UI
      const photoElement = document.querySelector(`[data-photo-id="${photoId}"]`);
      if (photoElement) {
        photoElement.remove();
      }

      // Reload photos to update the list
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