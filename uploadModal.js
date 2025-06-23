// Fixed uploadModal.js - Better auth state checking
class ImageUploadManager {
  constructor() {
    // Photo limits
    this.MAX_PHOTOS_PER_USER = 72;
    
    // Artwork-friendly compression settings
    this.defaultMaxFileSize = 3 * 1024 * 1024; // 3MB before compression
    this.maxFileSize = this.defaultMaxFileSize;
    this.defaultMaxDimension = 2400; // Higher res for artwork
    this.maxDimension = this.defaultMaxDimension;
    this.compressionQuality = 0.92; // High quality for artwork
    
    // User-specific settings
    this.userUploadLimits = {
      'eldricarpilleda': 50 * 1024 * 1024,
      'colai': 50 * 1024 * 1024,
    };
    
    this.losslessUsers = new Set(['eldricarpilleda', 'colai']);
    this.userResolutionLimits = {
      'eldricarpilleda': null,
      'colai': null,
    };
    
    // Upload optimization settings
    this.UPLOAD_BATCH_SIZE = 3; // Parallel uploads
    this.PHOTO_LOAD_BATCH_SIZE = 24; // Load photos in batches
    
    // State
    this.selectedPhotos = new Set();
    this.pendingFiles = [];
    this.editMode = false;
    this.currentUserIsLossless = false;
    this.totalUserPhotos = 0;
    this.isUploading = false;
    
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
    this.setupModalOpenListener();
  }

  updateUserSettings() {
    // FIXED: Better auth state checking
    if (!window.authManager || !window.authManager.isLoggedIn()) {
      console.log('🔒 User not logged in, skipping user settings update');
      return;
    }

    const userProfile = window.authManager.getCurrentUserProfile();
    if (!userProfile || !userProfile.username) {
      console.log('🔒 No user profile found, skipping user settings update');
      return;
    }

    const username = userProfile.username;
    
    const customLimit = this.userUploadLimits[username];
    this.maxFileSize = customLimit || this.defaultMaxFileSize;
    this.currentUserIsLossless = this.losslessUsers.has(username);
    
    const customResolution = this.userResolutionLimits[username];
    this.maxDimension = customResolution !== undefined ? customResolution : this.defaultMaxDimension;
    
    console.log(`🎛️ User settings for ${username}:`);
    console.log(`   File size limit: ${this.formatFileSize(this.maxFileSize)}`);
    console.log(`   Lossless uploads: ${this.currentUserIsLossless ? 'YES' : 'NO'}`);
    console.log(`   Resolution limit: ${this.maxDimension ? this.maxDimension + 'px' : 'UNLIMITED'}`);
    
    this.updateUploadSectionText();
  }

  updateUploadSectionText() {
    const uploadSubtext = document.querySelector('.upload-subtext');
    if (uploadSubtext && !uploadSubtext.classList.contains('has-files')) {
      const limitText = this.formatFileSize(this.maxFileSize);
      const remainingPhotos = this.MAX_PHOTOS_PER_USER - this.totalUserPhotos;
      
      let text = `Supports JPG, PNG, GIF • `;
      
      if (this.currentUserIsLossless) {
        text += `LOSSLESS uploads up to ${limitText} • ${remainingPhotos} photos remaining`;
      } else {
        text += `Artwork-quality compression • Max ${this.maxDimension}px • ${remainingPhotos} photos remaining`;
      }
      
      uploadSubtext.textContent = text;
    }
  }

  setupModalOpenListener() {
    const uploadModal = document.getElementById('uploadModal');
    if (uploadModal) {
      // Add delay to prevent triggering during page initialization
      setTimeout(() => {
        const observer = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
              const modal = mutation.target;
              if (!modal.classList.contains('hidden')) {
                // FIXED: Better auth state checking with delay
                setTimeout(() => {
                  if (window.authManager && window.authManager.isLoggedIn()) {
                    this.updateUserSettings();
                    this.loadUserPhotos();
                  }
                }, 200); // Small delay to ensure auth state is ready
              }
            }
          });
        });
        
        observer.observe(uploadModal, {
          attributes: true,
          attributeFilter: ['class']
        });
      }, 1000); // Wait 1 second after page load before starting to observe
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
          this.uploadFiles(); // Direct upload, no confirmation modal
        } else if (!this.isUploading) {
          this.fileInput.click();
        }
      });
    }

    this.setupDragAndDrop();
  }

  setupDragAndDrop() {
    if (!this.dropzone) return;

    const preventDefaults = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      this.dropzone.addEventListener(eventName, preventDefaults);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
      this.dropzone.addEventListener(eventName, () => {
        if (this.uploadSection) {
          this.uploadSection.classList.add('drag-over');
        }
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      this.dropzone.addEventListener(eventName, () => {
        if (this.uploadSection) {
          this.uploadSection.classList.remove('drag-over');
        }
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
      this.showError('Please select image files only (JPG, PNG, GIF, WebP)');
      return;
    }

    // Check photo limit
    const remainingSlots = this.MAX_PHOTOS_PER_USER - this.totalUserPhotos;
    if (imageFiles.length > remainingSlots) {
      this.showError(`You can only upload ${remainingSlots} more photos (${this.MAX_PHOTOS_PER_USER} total limit)`);
      return;
    }

    if (imageFiles.length !== fileArray.length) {
      this.showWarning(`${fileArray.length - imageFiles.length} non-image files were ignored`);
    }

    this.validateAndProcessFiles(imageFiles);
  }

  async validateAndProcessFiles(files) {
    console.log(`Processing ${files.length} files for artwork-quality upload...`);
    
    const validFiles = [];
    const oversizedFiles = [];
    
    this.showProgress(true, 'Processing images...');
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      this.updateProgress((i / files.length) * 50); // First 50% for processing
      
      if (this.currentUserIsLossless) {
        // Lossless users: only check file size
        if (file.size > this.maxFileSize) {
          oversizedFiles.push(file);
        } else {
          validFiles.push(file);
        }
      } else {
        // Regular users: smart compression for artwork
        if (file.size > this.maxFileSize) {
          try {
            const processedFile = await this.smartCompressImage(file);
            if (processedFile.size <= this.maxFileSize) {
              validFiles.push(processedFile);
              console.log(`✅ Optimized ${file.name}: ${this.formatFileSize(file.size)} → ${this.formatFileSize(processedFile.size)}`);
            } else {
              oversizedFiles.push(file);
            }
          } catch (error) {
            console.error(`Processing failed for ${file.name}:`, error);
            oversizedFiles.push(file);
          }
        } else {
          // File is small enough, use as-is
          validFiles.push(file);
        }
      }
    }

    this.showProgress(false);

    if (oversizedFiles.length > 0) {
      const oversizedNames = oversizedFiles.map(f => f.name).join(', ');
      const limitText = this.formatFileSize(this.maxFileSize);
      this.showError(`These files exceed the limit of ${limitText}: ${oversizedNames}`);
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

  async smartCompressImage(file) {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        try {
          // Smart resizing: only resize if actually oversized
          let { width, height } = this.calculateOptimalDimensions(img.width, img.height);
          
          canvas.width = width;
          canvas.height = height;
          
          // High-quality drawing for artwork
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);
          
          // Compress with high quality
          canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error('Compression failed'));
              return;
            }

            const compressedFile = new File([blob], file.name, {
              type: file.type,
              lastModified: Date.now()
            });

            resolve(compressedFile);
          }, file.type, this.compressionQuality);
          
        } catch (error) {
          reject(error);
        }
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  }

  calculateOptimalDimensions(originalWidth, originalHeight) {
    // For lossless users or if image is already small enough
    if (!this.maxDimension || (originalWidth <= this.maxDimension && originalHeight <= this.maxDimension)) {
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
    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    
    const uploadText = document.querySelector('.upload-text');
    if (uploadText) {
      let text = `${files.length} photo${files.length > 1 ? 's' : ''} ready`;
      if (this.currentUserIsLossless) {
        text += ` • LOSSLESS (${this.formatFileSize(totalSize)})`;
      } else {
        text += ` • ${this.formatFileSize(totalSize)} total`;
      }
      uploadText.textContent = text;
    }
    
    const uploadSubtext = document.querySelector('.upload-subtext');
    if (uploadSubtext) {
      const fileNames = files.slice(0, 3).map(f => f.name).join(', ');
      const remaining = files.length > 3 ? ` and ${files.length - 3} more...` : '';
      uploadSubtext.textContent = fileNames + remaining;
      uploadSubtext.classList.add('has-files');
    }
  }

  updateUploadButton() {
    const fileCount = this.pendingFiles.length;
    
    if (!this.uploadBtn) return;
    
    if (this.isUploading) {
      this.uploadBtn.textContent = 'Uploading...';
      this.uploadBtn.disabled = true;
    } else if (fileCount > 0) {
      const suffix = this.currentUserIsLossless ? ' (Lossless)' : '';
      this.uploadBtn.textContent = `Upload ${fileCount} Photo${fileCount > 1 ? 's' : ''}${suffix}`;
      this.uploadBtn.disabled = false;
      this.uploadBtn.className = 'upload-btn ready';
    } else {
      this.uploadBtn.textContent = 'Select Photos';
      this.uploadBtn.disabled = true;
      this.uploadBtn.className = 'upload-btn';
    }
  }

  // OPTIMIZED PARALLEL UPLOAD
  async uploadFiles() {
    // FIXED: Better auth checking
    if (!window.authManager || !window.authManager.isLoggedIn() || this.isUploading) {
      console.log('🔒 Cannot upload: not logged in or already uploading');
      return;
    }

    const userProfile = window.authManager.getCurrentUserProfile();
    if (!userProfile) {
      this.showError('User profile not found');
      return;
    }

    const files = this.pendingFiles;
    if (files.length === 0) return;

    this.isUploading = true;
    this.updateUploadButton();
    this.showProgress(true, 'Uploading photos...');

    const results = { successful: [], failed: [] };
    let completed = 0;

    try {
      // Process files in batches for optimal performance
      for (let i = 0; i < files.length; i += this.UPLOAD_BATCH_SIZE) {
        const batch = files.slice(i, i + this.UPLOAD_BATCH_SIZE);
        
        // Upload batch in parallel
        const batchPromises = batch.map(async (file) => {
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

            results.successful.push(file.name);
            
          } catch (error) {
            console.error(`Upload failed for ${file.name}:`, error);
            results.failed.push({ file: file.name, error: error.message });
          } finally {
            completed++;
            this.updateProgress((completed / files.length) * 100);
          }
        });

        // Wait for this batch to complete before starting the next
        await Promise.all(batchPromises);
      }

    } catch (error) {
      console.error('Batch upload error:', error);
    }

    // Cleanup and show results
    this.isUploading = false;
    this.showProgress(false);
    this.updateUploadButton();

    if (results.failed.length > 0) {
      const failedNames = results.failed.map(f => f.file).join(', ');
      this.showError(`Failed to upload: ${failedNames}`);
    }

    if (results.successful.length > 0) {
      this.showSuccess(`Successfully uploaded ${results.successful.length} photo${results.successful.length > 1 ? 's' : ''}!`);
      this.pendingFiles = [];
      if (this.fileInput) this.fileInput.value = '';
      this.resetUploadSection();
    }

    // Reload photos
    await this.loadUserPhotos();
  }

  async loadUserPhotos() {
    // FIXED: Better auth checking
    if (!window.authManager || !window.authManager.isLoggedIn()) {
      console.log('🔒 Cannot load photos: not logged in');
      return;
    }

    const userProfile = window.authManager.getCurrentUserProfile();
    if (!userProfile) {
      console.log('🔒 Cannot load photos: no user profile');
      return;
    }

    try {
      const { data: photos, error } = await supabaseHelpers.getUserPhotos(userProfile.username);
      
      if (error) {
        console.error('Error loading user photos:', error);
        return;
      }

      this.totalUserPhotos = photos?.length || 0;
      this.updateUploadSectionText();
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

    this.selectedPhotos.clear();
    this.editMode = false;

    const userPrivileges = this.currentUserIsLossless ? 
      '<span style="color: #667eea; font-size: 12px; font-weight: normal;">(Lossless uploads enabled)</span>' : '';

    // Clean header design
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
        <div>
          <h3 style="margin: 0; color: #fff; font-size: 18px; font-weight: 600;">
            Your Photos (${photos.length}/${this.MAX_PHOTOS_PER_USER})
          </h3>
          ${userPrivileges}
        </div>
        <button id="editToggleBtn" class="edit-toggle-btn">
          Select Photos
        </button>
      </div>
    `;

    // Modern selection UI (hidden by default)
    const selectionUIHtml = `
      <div class="selection-ui" id="selectionUI" style="
        grid-column: 1 / -1; 
        margin-bottom: 16px; 
        display: none;
        background: rgba(102, 126, 234, 0.1);
        border: 1px solid rgba(102, 126, 234, 0.3);
        border-radius: 8px;
        padding: 12px 16px;
      ">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 16px;">
            <button id="selectAllBtn" style="
              background: none; 
              border: 1px solid #667eea; 
              color: #667eea; 
              padding: 6px 12px; 
              border-radius: 4px; 
              font-size: 12px; 
              cursor: pointer;
            ">Select All</button>
            <span id="selectedCount" style="color: #ccc; font-size: 14px;">
              0 selected
            </span>
          </div>
          <button id="deleteSelectedBtn" class="delete-selected-btn" style="
            background: #ff4757; 
            color: white; 
            border: none; 
            padding: 8px 16px; 
            border-radius: 4px; 
            font-size: 14px; 
            cursor: pointer;
            opacity: 0.5;
            pointer-events: none;
          " disabled>Delete Selected</button>
        </div>
      </div>
    `;

    // Load photos in batches for better performance
    const photosToShow = photos.slice(0, this.PHOTO_LOAD_BATCH_SIZE);
    const photosHtml = photosToShow.map((photo) => {
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
          <div class="photo-selection-indicator"></div>
        </div>
      `;
    }).join('');

    // Show load more button if there are more photos
    const loadMoreHtml = photos.length > this.PHOTO_LOAD_BATCH_SIZE ? `
      <div class="load-more-container" style="grid-column: 1 / -1; text-align: center; margin-top: 16px;">
        <button id="loadMoreBtn" style="
          background: rgba(255,255,255,0.1); 
          border: 1px solid rgba(255,255,255,0.2); 
          color: #ccc; 
          padding: 12px 24px; 
          border-radius: 6px; 
          cursor: pointer;
        ">
          Load ${Math.min(this.PHOTO_LOAD_BATCH_SIZE, photos.length - this.PHOTO_LOAD_BATCH_SIZE)} More Photos
        </button>
      </div>
    ` : '';
    
    this.photoList.innerHTML = headerHtml + selectionUIHtml + photosHtml + loadMoreHtml;
    
    this.setupPhotoInteractions();
    this.setupLoadMore(photos);
  }

  setupPhotoInteractions() {
    const editToggleBtn = document.getElementById('editToggleBtn');
    const selectionUI = document.getElementById('selectionUI');
    const selectAllBtn = document.getElementById('selectAllBtn');
    const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
    
    // Edit mode toggle
    if (editToggleBtn) {
      editToggleBtn.addEventListener('click', () => {
        this.editMode = !this.editMode;
        
        if (this.editMode) {
          editToggleBtn.textContent = 'Cancel';
          editToggleBtn.style.background = '#ff4757';
          editToggleBtn.style.borderColor = '#ff4757';
          editToggleBtn.style.color = 'white';
          selectionUI.style.display = 'block';
          
          // Hide individual delete buttons, enable photo selection
          document.querySelectorAll('.photo-overlay').forEach(overlay => {
            overlay.style.display = 'none';
          });
          
          this.enablePhotoSelection();
          
        } else {
          editToggleBtn.textContent = 'Select Photos';
          editToggleBtn.style.background = 'transparent';
          editToggleBtn.style.borderColor = '#667eea';
          editToggleBtn.style.color = '#667eea';
          selectionUI.style.display = 'none';
          
          // Show individual delete buttons, disable photo selection
          document.querySelectorAll('.photo-overlay').forEach(overlay => {
            overlay.style.display = 'flex';
          });
          
          this.disablePhotoSelection();
        }
      });
    }

    // Select all functionality
    if (selectAllBtn) {
      selectAllBtn.addEventListener('click', () => {
        const photoItems = document.querySelectorAll('.photo-item');
        const allSelected = this.selectedPhotos.size === photoItems.length;
        
        if (allSelected) {
          // Deselect all
          this.selectedPhotos.clear();
          photoItems.forEach(item => item.classList.remove('selected'));
          selectAllBtn.textContent = 'Select All';
        } else {
          // Select all
          photoItems.forEach(item => {
            const photoId = item.dataset.photoId;
            this.selectedPhotos.add(photoId);
            item.classList.add('selected');
          });
          selectAllBtn.textContent = 'Deselect All';
        }
        
        this.updateSelectionUI();
      });
    }

    // Delete selected functionality
    if (deleteSelectedBtn) {
      deleteSelectedBtn.addEventListener('click', () => {
        this.deleteSelectedPhotos();
      });
    }
  }

  enablePhotoSelection() {
    const photoItems = document.querySelectorAll('.photo-item');
    
    photoItems.forEach(item => {
      item.style.cursor = 'pointer';
      item.addEventListener('click', this.handlePhotoSelect.bind(this));
    });
  }

  disablePhotoSelection() {
    const photoItems = document.querySelectorAll('.photo-item');
    
    photoItems.forEach(item => {
      item.style.cursor = 'default';
      item.classList.remove('selected');
      item.removeEventListener('click', this.handlePhotoSelect.bind(this));
    });
    
    this.selectedPhotos.clear();
  }

  handlePhotoSelect(event) {
    const photoItem = event.currentTarget;
    const photoId = photoItem.dataset.photoId;
    
    if (this.selectedPhotos.has(photoId)) {
      this.selectedPhotos.delete(photoId);
      photoItem.classList.remove('selected');
    } else {
      this.selectedPhotos.add(photoId);
      photoItem.classList.add('selected');
    }
    
    this.updateSelectionUI();
  }

  updateSelectionUI() {
    const selectedCount = document.getElementById('selectedCount');
    const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
    const selectAllBtn = document.getElementById('selectAllBtn');
    const count = this.selectedPhotos.size;

    if (selectedCount) {
      selectedCount.textContent = `${count} selected`;
    }

    if (deleteSelectedBtn) {
      if (count > 0) {
        deleteSelectedBtn.disabled = false;
        deleteSelectedBtn.style.opacity = '1';
        deleteSelectedBtn.style.pointerEvents = 'auto';
        deleteSelectedBtn.textContent = `Delete ${count} Photo${count > 1 ? 's' : ''}`;
      } else {
        deleteSelectedBtn.disabled = true;
        deleteSelectedBtn.style.opacity = '0.5';
        deleteSelectedBtn.style.pointerEvents = 'none';
        deleteSelectedBtn.textContent = 'Delete Selected';
      }
    }

    // Update select all button text
    if (selectAllBtn) {
      const totalPhotos = document.querySelectorAll('.photo-item').length;
      selectAllBtn.textContent = count === totalPhotos ? 'Deselect All' : 'Select All';
    }
  }

  setupLoadMore(allPhotos) {
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    let currentlyLoaded = this.PHOTO_LOAD_BATCH_SIZE;
    
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', () => {
        const nextBatch = allPhotos.slice(currentlyLoaded, currentlyLoaded + this.PHOTO_LOAD_BATCH_SIZE);
        
        const photosHtml = nextBatch.map((photo) => {
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
              <div class="photo-selection-indicator"></div>
            </div>
          `;
        }).join('');
        
        // Insert new photos before the load more button
        loadMoreBtn.parentElement.insertAdjacentHTML('beforebegin', photosHtml);
        
        currentlyLoaded += nextBatch.length;
        
        // Update or remove load more button
        if (currentlyLoaded >= allPhotos.length) {
          loadMoreBtn.parentElement.remove();
        } else {
          const remaining = allPhotos.length - currentlyLoaded;
          loadMoreBtn.textContent = `Load ${Math.min(this.PHOTO_LOAD_BATCH_SIZE, remaining)} More Photos`;
        }
        
        // Re-setup interactions for new photos if in edit mode
        if (this.editMode) {
          this.enablePhotoSelection();
        }
      });
    }
  }

  // OPTIMIZED BULK DELETE
  async deleteSelectedPhotos() {
    if (this.selectedPhotos.size === 0) return;

    const count = this.selectedPhotos.size;
    if (!confirm(`Are you sure you want to delete ${count} photo${count > 1 ? 's' : ''}?`)) {
      return;
    }

    const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
    const editToggleBtn = document.getElementById('editToggleBtn');
    
    if (deleteSelectedBtn) {
      deleteSelectedBtn.textContent = 'Deleting...';
      deleteSelectedBtn.disabled = true;
    }
    
    if (editToggleBtn) {
      editToggleBtn.disabled = true;
    }

    const selectedPhotoIds = Array.from(this.selectedPhotos);
    const selectedPhotosData = selectedPhotoIds.map(photoId => {
      const photoElement = document.querySelector(`[data-photo-id="${photoId}"]`);
      return {
        photoId,
        driveFileId: photoElement?.dataset.driveId
      };
    });

    // PARALLEL DELETE - much faster than sequential
    const deletePromises = selectedPhotosData.map(async ({ photoId, driveFileId }) => {
      try {
        const { error } = await supabaseHelpers.deletePhoto(photoId, driveFileId);
        if (error) {
          console.error(`Delete failed for photo ${photoId}:`, error);
          return { success: false, photoId };
        }
        return { success: true, photoId };
      } catch (error) {
        console.error(`Error deleting photo ${photoId}:`, error);
        return { success: false, photoId };
      }
    });

    const results = await Promise.all(deletePromises);
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    // Show results
    if (failed > 0) {
      this.showError(`Deleted ${successful} photos. ${failed} failed to delete.`);
    } else {
      this.showSuccess(`Successfully deleted ${successful} photo${successful > 1 ? 's' : ''}!`);
    }

    // Reset UI and reload
    this.selectedPhotos.clear();
    this.editMode = false;
    await this.loadUserPhotos();
  }

  async deletePhoto(photoId, driveFileId) {
    if (!confirm('Are you sure you want to delete this photo?')) {
      return;
    }

    try {
      const { error } = await supabaseHelpers.deletePhoto(photoId, driveFileId);
      
      if (error) {
        this.showError('Failed to delete photo. Please try again.');
        return;
      }

      // Optimistic update - remove from UI immediately
      const photoElement = document.querySelector(`[data-photo-id="${photoId}"]`);
      if (photoElement) {
        photoElement.style.opacity = '0.5';
        photoElement.style.transform = 'scale(0.8)';
        setTimeout(() => photoElement.remove(), 200);
      }

      this.totalUserPhotos--;
      this.updateUploadSectionText();
      
    } catch (error) {
      console.error('Delete error:', error);
      this.showError('Failed to delete photo. Please try again.');
    }
  }

  getOptimizedImageUrl(photo) {
    if (photo.drive_file_id) {
      // Use thumbnail size for grid view - faster loading
      return `https://lh3.googleusercontent.com/d/${photo.drive_file_id}=w400-h400-c`;
    }
    return photo.file_url;
  }

  handleImageError(imgElement, driveFileId) {
    const fallbackUrls = [
      `https://drive.google.com/uc?export=view&id=${driveFileId}`,
      `https://lh3.googleusercontent.com/d/${driveFileId}=w400`,
      `https://drive.google.com/thumbnail?id=${driveFileId}&sz=w400`,
      `https://lh3.googleusercontent.com/d/${driveFileId}`
    ];

    const currentSrc = imgElement.src;
    const nextFallback = fallbackUrls.find(url => url !== currentSrc);

    if (nextFallback) {
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

  resetUploadSection() {
    const uploadText = document.querySelector('.upload-text');
    const uploadSubtext = document.querySelector('.upload-subtext');
    
    if (uploadText) {
      uploadText.textContent = 'Drop your photos here or click to browse';
    }
    if (uploadSubtext) {
      uploadSubtext.classList.remove('has-files');
      this.updateUploadSectionText();
    }
    
    if (this.uploadSection) {
      this.uploadSection.classList.remove('has-files');
    }
  }

  showProgress(show, message = 'Processing...') {
    if (this.progressBar) {
      if (show) {
        this.progressBar.style.display = 'block';
        // Add progress message
        let progressText = this.progressBar.querySelector('.progress-text');
        if (!progressText) {
          progressText = document.createElement('div');
          progressText.className = 'progress-text';
          progressText.style.cssText = 'color: #ccc; font-size: 12px; text-align: center; margin-top: 8px;';
          this.progressBar.appendChild(progressText);
        }
        progressText.textContent = message;
      } else {
        this.progressBar.style.display = 'none';
        this.updateProgress(0);
      }
    }
  }

  updateProgress(percent) {
    if (this.progressBarFill) {
      this.progressBarFill.style.width = `${Math.round(percent)}%`;
    }
    
    const progressText = this.progressBar?.querySelector('.progress-text');
    if (progressText && percent > 0) {
      progressText.textContent = `${Math.round(percent)}% complete`;
    }
  }

  showError(message) {
    this.showToast(message, 'error');
  }

  showSuccess(message) {
    this.showToast(message, 'success');
  }

  showWarning(message) {
    this.showToast(message, 'warning');
  }

  showToast(message, type = 'info') {
    // Remove any existing toast
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

    // Auto-remove after 4 seconds
    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.animation = 'slideOutRight 0.3s ease-in';
        setTimeout(() => toast.remove(), 300);
      }
    }, 4000);

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

// Initialize upload manager when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.uploadManager = new ImageUploadManager();
});

// Make manager available globally
window.ImageUploadManager = ImageUploadManager;