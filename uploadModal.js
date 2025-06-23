// Enhanced uploadModal.js with lossless uploads for eldricarpilleda

class ImageUploadManager {
  constructor() {
    // Default upload limits
    this.defaultMaxFileSize = 2 * 1024 * 1024; // 2MB for regular users
    this.maxFileSize = this.defaultMaxFileSize;
    
    // User-specific upload limits (in bytes)
    this.userUploadLimits = {
      'eldricarpilleda': 50 * 1024 * 1024, // 50MB for eldricarpilleda (lossless)
    };
    
    // User-specific lossless upload permissions
    this.losslessUsers = new Set(['eldricarpilleda']);
    
    // User-specific resolution limits
    this.userResolutionLimits = {
      'eldricarpilleda': null, // null = no resolution limit
      // Other users will use the default 2048px limit
    };
    
    this.defaultMaxDimension = 2048;
    this.maxDimension = this.defaultMaxDimension;
    this.compressionQuality = 0.8;
    this.selectedPhotos = new Set();
    this.pendingFiles = [];
    this.editMode = false;
    this.currentUserIsLossless = false;
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

  // Enhanced method to update all user-specific settings
  updateUserSettings() {
    const userProfile = window.getCurrentUserProfile();
    if (userProfile && userProfile.username) {
      const username = userProfile.username;
      
      // Update file size limit
      const customLimit = this.userUploadLimits[username];
      this.maxFileSize = customLimit || this.defaultMaxFileSize;
      
      // Update lossless permission
      this.currentUserIsLossless = this.losslessUsers.has(username);
      
      // Update resolution limit
      const customResolution = this.userResolutionLimits[username];
      this.maxDimension = customResolution !== undefined ? customResolution : this.defaultMaxDimension;
      
      console.log(`🎛️ User settings for ${username}:`);
      console.log(`   File size limit: ${this.formatFileSize(this.maxFileSize)}`);
      console.log(`   Lossless uploads: ${this.currentUserIsLossless ? 'YES' : 'NO'}`);
      console.log(`   Resolution limit: ${this.maxDimension ? this.maxDimension + 'px' : 'UNLIMITED'}`);
      
      this.updateUploadSectionText();
    }
  }

  // Enhanced upload section text that shows current user capabilities
  updateUploadSectionText() {
    const uploadSubtext = document.querySelector('.upload-subtext');
    if (uploadSubtext && !uploadSubtext.classList.contains('has-files')) {
      const limitText = this.formatFileSize(this.maxFileSize);
      let text = `Supports JPG, PNG, GIF • `;
      
      if (this.currentUserIsLossless) {
        text += `LOSSLESS uploads up to ${limitText} • No resolution limit`;
      } else {
        text += `Auto-compressed to ${limitText} • Max ${this.maxDimension}px`;
      }
      
      uploadSubtext.textContent = text;
    }
  }

  setupModalOpenListener() {
    const uploadModal = document.getElementById('uploadModal');
    if (uploadModal) {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
            const modal = mutation.target;
            if (!modal.classList.contains('hidden') && window.isLoggedIn()) {
              console.log('🎯 Upload modal opened, loading photos...');
              this.updateUserSettings(); // Update user settings when modal opens
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
    this.setupConfirmationModalListeners();
  }

  setupConfirmationModalListeners() {
    console.log('🔗 Setting up confirmation modal listeners...');
    
    // Close button
    const closeConfirmModal = document.getElementById('closeConfirmModal');
    if (closeConfirmModal) {
      closeConfirmModal.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.hideConfirmationModal();
      });
    }

    // Cancel button
    const cancelUploadBtn = document.getElementById('cancelUploadBtn');
    if (cancelUploadBtn) {
      cancelUploadBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.cancelUpload();
      });
    }

    // Proceed button
    const proceedUploadBtn = document.getElementById('proceedUploadBtn');
    if (proceedUploadBtn) {
      proceedUploadBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.proceedWithUpload();
      });
    }

    // Click outside to close
    const confirmModal = document.getElementById('uploadConfirmModal');
    if (confirmModal) {
      confirmModal.addEventListener('click', (e) => {
        if (e.target === confirmModal) {
          this.hideConfirmationModal();
        }
      });

      confirmModal.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          this.hideConfirmationModal();
        }
      });
    }
  }

  setupEventListeners() {
    // File input change
    if (this.fileInput) {
      this.fileInput.addEventListener('change', (e) => {
        this.handleFiles(e.target.files);
        this.updateUploadButton();
      });
    }

    // Upload button click - Show confirmation
    if (this.uploadBtn) {
      this.uploadBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (this.pendingFiles.length > 0) {
          this.showUploadConfirmation();
        } else {
          this.fileInput.click();
        }
      });
    }

    // Drag and drop
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
      alert('Please select image files only (JPG, PNG, GIF, WebP)');
      return;
    }

    if (imageFiles.length !== fileArray.length) {
      alert(`${fileArray.length - imageFiles.length} non-image files were ignored`);
    }

    this.validateAndDisplayFiles(imageFiles);
  }

  // Enhanced file validation that handles lossless uploads
  async validateAndDisplayFiles(files) {
    console.log(`Processing ${files.length} files...`);
    console.log(`User: ${window.getCurrentUserProfile()?.username}`);
    console.log(`Lossless mode: ${this.currentUserIsLossless}`);
    console.log(`File size limit: ${this.formatFileSize(this.maxFileSize)}`);
    
    const validFiles = [];
    const oversizedFiles = [];
    
    for (const file of files) {
      if (this.currentUserIsLossless) {
        // For lossless users, only check file size - no compression
        if (file.size > this.maxFileSize) {
          oversizedFiles.push(file);
        } else {
          validFiles.push(file);
          console.log(`✅ Lossless file accepted: ${file.name} (${this.formatFileSize(file.size)})`);
        }
      } else {
        // For regular users, use compression as before
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
    }

    if (oversizedFiles.length > 0) {
      const oversizedNames = oversizedFiles.map(f => f.name).join(', ');
      const limitText = this.formatFileSize(this.maxFileSize);
      const modeText = this.currentUserIsLossless ? 'lossless upload limit' : 'compressed limit';
      alert(`These files exceed the ${modeText} of ${limitText}: ${oversizedNames}`);
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

  // Modified dimension calculation to respect user-specific limits
  calculateDimensions(originalWidth, originalHeight) {
    // If no resolution limit (lossless user), return original dimensions
    if (!this.maxDimension) {
      return { width: originalWidth, height: originalHeight };
    }
    
    // Apply resolution limit for regular users
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

  // Enhanced file preview that shows lossless status
  showFilePreview(files) {
    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    const fileNames = files.map(f => `${f.name} (${this.formatFileSize(f.size)})`).join(', ');
    
    const uploadText = document.querySelector('.upload-text');
    if (uploadText) {
      let text = `${files.length} file(s) ready to upload`;
      if (this.currentUserIsLossless) {
        text += ` • LOSSLESS (${this.formatFileSize(totalSize)} total)`;
      }
      uploadText.textContent = text;
    }
    
    const uploadSubtext = document.querySelector('.upload-subtext');
    if (uploadSubtext) {
      uploadSubtext.textContent = fileNames;
      uploadSubtext.classList.add('has-files');
    }
  }

  // Enhanced upload button text
  updateUploadButton() {
    const fileCount = this.pendingFiles.length;
    const uploadBtnContainer = this.uploadBtn?.parentElement;
    
    if (!this.uploadBtn || !uploadBtnContainer) return;
    
    if (fileCount > 0) {
      const suffix = this.currentUserIsLossless ? ' (Lossless)' : '';
      this.uploadBtn.textContent = `Review ${fileCount} Photo${fileCount > 1 ? 's' : ''}${suffix}`;
      this.uploadBtn.disabled = false;
      this.uploadBtn.style.background = 'transparent';
      this.uploadBtn.style.border = '2px solid #667eea';
      this.uploadBtn.style.color = '#667eea';
      
      let quickUploadBtn = document.getElementById('quickUploadBtn');
      if (!quickUploadBtn) {
        quickUploadBtn = document.createElement('button');
        quickUploadBtn.id = 'quickUploadBtn';
        quickUploadBtn.className = 'quick-upload-btn';
        quickUploadBtn.addEventListener('click', (e) => {
          e.preventDefault();
          this.proceedWithUpload();
        });
        uploadBtnContainer.appendChild(quickUploadBtn);
      }
      
      quickUploadBtn.textContent = `Quick Upload ${fileCount} Photo${fileCount > 1 ? 's' : ''}${suffix}`;
      quickUploadBtn.disabled = false;
      quickUploadBtn.style.display = 'block';
      
    } else {
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

    if (!confirmModal || !photoGrid || !proceedBtn) return;

    const suffix = this.currentUserIsLossless ? ' (Lossless)' : '';
    proceedBtn.textContent = `Upload ${this.pendingFiles.length} Photo${this.pendingFiles.length > 1 ? 's' : ''}${suffix}`;

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
        
        const losslessIndicator = this.currentUserIsLossless ? 
          '<div style="position: absolute; top: 4px; left: 4px; background: rgba(102, 126, 234, 0.9); color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold;">LOSSLESS</div>' : '';
        
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
            ${losslessIndicator}
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
    if (confirmModal) {
      confirmModal.classList.add('hidden');
    }
  }

  cancelUpload() {
    this.pendingFiles = [];
    if (this.fileInput) {
      this.fileInput.value = '';
    }
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

    if (this.uploadBtn) {
      this.uploadBtn.disabled = true;
      this.uploadBtn.textContent = 'Uploading...';
    }
    this.showProgress(true);

    const results = { successful: [], failed: [] };

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const progress = ((i + 1) / files.length) * 100;
      
      this.updateProgress(progress);
      if (this.uploadBtn) {
        const suffix = this.currentUserIsLossless ? ' (Lossless)' : '';
        this.uploadBtn.textContent = `Uploading${suffix}... (${i + 1}/${files.length})`;
      }

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
    if (this.uploadBtn) {
      this.uploadBtn.disabled = false;
    }
    this.updateUploadButton();

    if (results.failed.length > 0) {
      const failedNames = results.failed.map(f => f.file).join(', ');
      alert(`Failed to upload: ${failedNames}`);
    } else {
      this.pendingFiles = [];
      if (this.fileInput) {
        this.fileInput.value = '';
      }
      this.resetUploadSection();
      
      const quickUploadBtn = document.getElementById('quickUploadBtn');
      if (quickUploadBtn) {
        quickUploadBtn.style.display = 'none';
      }
    }

    await this.loadUserPhotos();
  }

  // Enhanced reset method
  resetUploadSection() {
    const uploadText = document.querySelector('.upload-text');
    const uploadSubtext = document.querySelector('.upload-subtext');
    
    if (uploadText) {
      uploadText.textContent = 'Drop your photos here or click to browse';
    }
    if (uploadSubtext) {
      uploadSubtext.classList.remove('has-files');
      this.updateUploadSectionText(); // This will show the current user's limit
    }
  }

  showProgress(show) {
    if (this.progressBar) {
      if (show) {
        this.progressBar.style.display = 'block';
      } else {
        this.progressBar.style.display = 'none';
        this.updateProgress(0);
      }
    }
  }

  updateProgress(percent) {
    if (this.progressBarFill) {
      this.progressBarFill.style.width = `${percent}%`;
    }
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
    
    // Clear selected photos when reloading
    this.selectedPhotos.clear();
    this.editMode = false;

    // Show user privileges in header
    const userPrivileges = this.currentUserIsLossless ? 
      '<span style="color: #667eea; font-size: 12px; font-weight: normal;">(Lossless uploads enabled)</span>' : '';

    // Create edit/cancel button header
    const editButtonHtml = `
      <div class="edit-controls" style="grid-column: 1 / -1; margin-bottom: 16px;">
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px; background: #222; border-radius: 8px;">
          <div>
            <h3 style="margin: 0; color: #fff; font-size: 18px;">Your Photos</h3>
            ${userPrivileges}
          </div>
          <button id="editToggleBtn" class="edit-toggle-btn" style="
            background: transparent;
            color: #667eea;
            border: 1px solid #667eea;
            padding: 8px 16px;
            border-radius: 6px;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s ease;
          ">Edit</button>
        </div>
      </div>
    `;

    // Bulk actions (hidden by default)
    const bulkActionsHtml = `
      <div class="bulk-actions" id="bulkActions" style="grid-column: 1 / -1; margin-bottom: 16px; display: none;">
        <div style="display: flex; align-items: center; gap: 12px; padding: 12px; background: #333; border-radius: 8px;">
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
            <input type="checkbox" id="selectAllPhotos" style="margin: 0;" />
            <span style="color: #ccc; font-size: 14px;">Select All</span>
          </label>
          <div class="bulk-controls" style="display: flex; align-items: center; gap: 8px; margin-left: auto;">
            <span id="selectedCount" style="color: #999; font-size: 14px;">0 selected</span>
            <button id="deleteSelectedBtn" class="delete-selected-btn" style="
              background: #ff4757; 
              color: white; 
              border: none; 
              padding: 6px 12px; 
              border-radius: 6px; 
              font-size: 12px; 
              cursor: pointer;
              opacity: 0.5;
              pointer-events: none;
            " disabled>Delete Selected</button>
          </div>
        </div>
      </div>
    `;
    
    const photosHtml = photos.map((photo, index) => {
      const imageUrl = this.getOptimizedImageUrl(photo);
      console.log(`Photo ${index + 1}: ${photo.filename} → ${imageUrl}`);
      
      return `
        <div class="photo-item" data-photo-id="${photo.id}">
          <div class="photo-checkbox" style="
            position: absolute;
            top: 8px;
            left: 8px;
            z-index: 10;
            display: none;
          ">
            <input type="checkbox" class="photo-select" data-photo-id="${photo.id}" data-drive-id="${photo.drive_file_id}" style="
              width: 18px;
              height: 18px;
              cursor: pointer;
              accent-color: #667eea;
            " />
          </div>
          <img src="${imageUrl}" alt="${photo.original_name}" loading="lazy" 
               onerror="uploadManager.handleImageError(this, '${photo.drive_file_id}')" />
          <div class="photo-overlay" style="opacity: 0; transition: all 0.2s ease;">
            <button class="delete-btn" onclick="uploadManager.deletePhoto('${photo.id}', '${photo.drive_file_id}')">
              ×
            </button>
          </div>
        </div>
      `;
    }).join('');
    
    console.log('📄 Setting innerHTML...');
    this.photoList.innerHTML = editButtonHtml + bulkActionsHtml + photosHtml;
    
    // Setup edit toggle functionality
    this.setupEditToggle();
    
    console.log('✅ displayUserPhotos complete');
  }

  setupEditToggle() {
    const editToggleBtn = document.getElementById('editToggleBtn');
    const bulkActions = document.getElementById('bulkActions');
    const photoCheckboxes = document.querySelectorAll('.photo-checkbox');
    const photoOverlays = document.querySelectorAll('.photo-overlay');
    
    if (!editToggleBtn) return;
    
    editToggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.editMode = !this.editMode;
      
      if (this.editMode) {
        // Enter edit mode
        editToggleBtn.textContent = 'Cancel';
        editToggleBtn.style.background = '#ff4757';
        editToggleBtn.style.borderColor = '#ff4757';
        editToggleBtn.style.color = 'white';
        
        // Show bulk actions
        if (bulkActions) {
          bulkActions.style.display = 'block';
        }
        
        // Show checkboxes
        photoCheckboxes.forEach(checkbox => {
          checkbox.style.display = 'block';
        });
        
        // Hide individual delete buttons
        photoOverlays.forEach(overlay => {
          overlay.style.display = 'none';
        });
        
        // Setup bulk selection listeners
        this.setupBulkSelectionListeners();
        
      } else {
        // Exit edit mode
        editToggleBtn.textContent = 'Edit';
        editToggleBtn.style.background = 'transparent';
        editToggleBtn.style.borderColor = '#667eea';
        editToggleBtn.style.color = '#667eea';
        
        // Hide bulk actions
        if (bulkActions) {
          bulkActions.style.display = 'none';
        }
        
        // Hide checkboxes
        photoCheckboxes.forEach(checkbox => {
          checkbox.style.display = 'none';
          checkbox.checked = false;
        });
        
        // Show individual delete buttons
        photoOverlays.forEach(overlay => {
          overlay.style.display = 'flex';
        });
        
        // Clear selections
        this.selectedPhotos.clear();
      }
    });
  }

  setupBulkSelectionListeners() {
    const selectAllCheckbox = document.getElementById('selectAllPhotos');
    const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
    const selectedCountSpan = document.getElementById('selectedCount');
    const photoCheckboxes = document.querySelectorAll('.photo-select');

    // Reset selections
    this.selectedPhotos.clear();
    this.updateBulkControls();

    // Select all/none functionality
    if (selectAllCheckbox) {
      selectAllCheckbox.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        photoCheckboxes.forEach(checkbox => {
          checkbox.checked = isChecked;
          if (isChecked) {
            this.selectedPhotos.add(checkbox.dataset.photoId);
          } else {
            this.selectedPhotos.delete(checkbox.dataset.photoId);
          }
        });
        this.updateBulkControls();
      });
    }

    // Individual photo selection
    photoCheckboxes.forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const photoId = e.target.dataset.photoId;
        if (e.target.checked) {
          this.selectedPhotos.add(photoId);
        } else {
          this.selectedPhotos.delete(photoId);
          if (selectAllCheckbox) {
            selectAllCheckbox.checked = false;
          }
        }
        this.updateBulkControls();
      });
    });

    // Delete selected photos
    if (deleteSelectedBtn) {
      deleteSelectedBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.deleteSelectedPhotos();
      });
    }
  }

  updateBulkControls() {
    const selectedCountSpan = document.getElementById('selectedCount');
    const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
    const count = this.selectedPhotos.size;

    if (selectedCountSpan) {
      selectedCountSpan.textContent = `${count} selected`;
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
  }

  async deleteSelectedPhotos() {
    if (this.selectedPhotos.size === 0) return;

    const count = this.selectedPhotos.size;
    if (!confirm(`Are you sure you want to delete ${count} photo${count > 1 ? 's' : ''}?`)) {
      return;
    }

    const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
    const editToggleBtn = document.getElementById('editToggleBtn');
    
    if (editToggleBtn) {
      editToggleBtn.disabled = true;
    }

    const selectedPhotoIds = Array.from(this.selectedPhotos);
    const results = { successful: 0, failed: 0 };

    for (const photoId of selectedPhotoIds) {
      try {
        const checkbox = document.querySelector(`[data-photo-id="${photoId}"]`);
        const driveFileId = checkbox?.dataset.driveId;

        const { error } = await supabaseHelpers.deletePhoto(photoId, driveFileId);
        
        if (error) {
          console.error(`Delete failed for photo ${photoId}:`, error);
          results.failed++;
        } else {
          console.log(`✅ Deleted photo ${photoId}`);
          results.successful++;
        }
      } catch (error) {
        console.error(`Error deleting photo ${photoId}:`, error);
        results.failed++;
      }
    }

    // Show results
    if (results.failed > 0) {
      alert(`Deleted ${results.successful} photos. ${results.failed} failed to delete.`);
    } else {
      console.log(`✅ Successfully deleted ${results.successful} photos`);
    }

    // Clear selection and reload photos
    this.selectedPhotos.clear();
    this.editMode = false;
    await this.loadUserPhotos();
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

console.log('📸 Enhanced upload manager loaded with lossless support for eldricarpilleda');