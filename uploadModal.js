// Clean uploadModal.js with FIXED UI and edit modes + Pro user support

class ImageUploadManager {
  constructor() {
    this.maxFileSize = 8 * 1024 * 1024; // 8MB for regular users
    this.maxFileSizePro = 50 * 1024 * 1024; // 50MB for pro users
    this.compressionQuality = 0.8;
    this.maxDimension = 2048;
    this.selectedPhotos = new Set();
    this.pendingFiles = [];
    this.editMode = false;
    
    // Pro users who get higher limits and no compression
    this.proUsers = ['eldricarpilleda', 'colai'];
    
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
    this.loadUserPhotos();
  }

  // Check if current user is a pro user
  isProUser() {
    const userProfile = window.getCurrentUserProfile();
    return userProfile && this.proUsers.includes(userProfile.username);
  }

  // Get the appropriate file size limit for current user
  getMaxFileSize() {
    return this.isProUser() ? this.maxFileSizePro : this.maxFileSize;
  }

  setupModalOpenListener() {
    const uploadModal = document.getElementById('uploadModal');
    if (uploadModal) {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
            const modal = mutation.target;
            if (!modal.classList.contains('hidden') && window.isLoggedIn()) {
              this.loadUserPhotos();
              this.updateUploadText(); // Update text when modal opens
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

  // Update upload section text based on user privileges
  updateUploadText() {
    const uploadSubtext = document.querySelector('.upload-subtext');
    if (uploadSubtext) {
      if (this.isProUser()) {
        uploadSubtext.textContent = 'Supports JPG, PNG, GIF • Up to 50MB • No compression';
      } else {
        uploadSubtext.textContent = 'Supports JPG, PNG, GIF • Auto-compressed to 8MB • Any size accepted';
      }
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
    const closeConfirmModal = document.getElementById('closeConfirmModal');
    if (closeConfirmModal) {
      closeConfirmModal.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.hideConfirmationModal();
      });
    }

    const cancelUploadBtn = document.getElementById('cancelUploadBtn');
    if (cancelUploadBtn) {
      cancelUploadBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.cancelUpload();
      });
    }

    const proceedUploadBtn = document.getElementById('proceedUploadBtn');
    if (proceedUploadBtn) {
      proceedUploadBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.proceedWithUpload();
      });
    }

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
    if (this.fileInput) {
      this.fileInput.addEventListener('change', (e) => {
        this.handleFiles(e.target.files);
        this.updateUploadButton();
      });
    }

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

  async validateAndDisplayFiles(files) {
    const validFiles = [];
    const oversizedFiles = [];
    const maxSize = this.getMaxFileSize();
    const isPro = this.isProUser();
    
    for (const file of files) {
      if (file.size > maxSize) {
        // File is over the limit - try compression
        try {
          const targetSize = isPro ? this.maxFileSizePro : this.maxFileSize;
          const compressedFile = await this.compressImage(file, targetSize);
          if (compressedFile.size <= targetSize) {
            validFiles.push(compressedFile);
          } else {
            oversizedFiles.push(file);
          }
        } catch (error) {
          oversizedFiles.push(file);
        }
      } else {
        // File is within limits
        if (isPro) {
          // Pro users get no compression unless over limit
          validFiles.push(file);
        } else {
          // Regular users get compression for consistency
          if (file.size > this.maxFileSize) {
            try {
              const compressedFile = await this.compressImage(file, this.maxFileSize);
              validFiles.push(compressedFile);
            } catch (error) {
              oversizedFiles.push(file);
            }
          } else {
            validFiles.push(file);
          }
        }
      }
    }

    if (oversizedFiles.length > 0) {
      const oversizedNames = oversizedFiles.map(f => f.name).join(', ');
      const limitText = isPro ? '50MB' : '8MB';
      alert(`These files are too large (over ${limitText}): ${oversizedNames}`);
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

  async compressImage(file, targetSize = this.maxFileSize) {
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
          this.compressWithQuality(canvas, file, resolve, reject, this.compressionQuality, targetSize);
        } catch (error) {
          reject(error);
        }
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  }

  compressWithQuality(canvas, originalFile, resolve, reject, quality = this.compressionQuality, targetSize = this.maxFileSize) {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Compression failed'));
        return;
      }

      if (blob.size > targetSize && quality > 0.1) {
        this.compressWithQuality(canvas, originalFile, resolve, reject, quality - 0.1, targetSize);
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
    const uploadBtnContainer = this.uploadBtn?.parentElement;
    
    if (!this.uploadBtn || !uploadBtnContainer) return;
    
    if (fileCount > 0) {
      this.uploadBtn.textContent = `Review ${fileCount} Photo${fileCount > 1 ? 's' : ''}`;
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
      
      quickUploadBtn.textContent = `Quick Upload ${fileCount} Photo${fileCount > 1 ? 's' : ''}`;
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
        this.uploadBtn.textContent = `Uploading... (${i + 1}/${files.length})`;
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

  resetUploadSection() {
    const uploadText = document.querySelector('.upload-text');
    const uploadSubtext = document.querySelector('.upload-subtext');
    
    if (uploadText) {
      uploadText.textContent = 'Drop your photos here or click to browse';
    }
    if (uploadSubtext) {
      uploadSubtext.textContent = 'Supports JPG, PNG, GIF • Auto-compressed to 8MB • Any size accepted';
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
    const userProfile = window.getCurrentUserProfile();
    
    if (!userProfile) {
      return;
    }

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
    if (!this.photoList) {
      return;
    }
    
    if (!photos || photos.length === 0) {
      this.photoList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📷</div>
          <div>No photos uploaded yet</div>
        </div>
      `;
      return;
    }

    // Reset edit mode and selections when loading photos
    this.selectedPhotos.clear();
    this.editMode = false;

    // Create header with edit button
    const editButtonHtml = `
      <div class="edit-controls" style="grid-column: 1 / -1; margin-bottom: 16px;">
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px; background: #222; border-radius: 8px;">
          <h3 style="margin: 0; color: #fff; font-size: 18px;">Your Photos</h3>
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
        <label>
          <input type="checkbox" id="selectAllPhotos" />
          <span>Select All</span>
        </label>
        <div class="bulk-controls">
          <span id="selectedCount">0 selected</span>
          <button id="deleteSelectedBtn" class="delete-selected-btn" disabled>Delete Selected</button>
        </div>
      </div>
    `;
    
    // Generate photo HTML
    const photosHtml = photos.map((photo) => {
      const imageUrl = this.getOptimizedImageUrl(photo);
      
      return `
        <div class="photo-item" data-photo-id="${photo.id}">
          <div class="photo-checkbox">
            <input type="checkbox" class="photo-select" data-photo-id="${photo.id}" data-drive-id="${photo.drive_file_id}" />
          </div>
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
    
    this.photoList.innerHTML = editButtonHtml + bulkActionsHtml + photosHtml;
    this.setupEditToggle();
  }

  setupEditToggle() {
    const editToggleBtn = document.getElementById('editToggleBtn');
    const bulkActions = document.getElementById('bulkActions');
    const photosGrid = document.getElementById('photoList');
    
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
        
        // Add edit-mode class - this shows checkboxes and hides delete buttons
        if (photosGrid) {
          photosGrid.classList.add('edit-mode');
        }
        
        // Show bulk actions
        if (bulkActions) {
          bulkActions.style.display = 'flex';
        }
        
        // Setup selection listeners
        this.setupBulkSelectionListeners();
        
      } else {
        // Exit edit mode
        editToggleBtn.textContent = 'Edit';
        editToggleBtn.style.background = 'transparent';
        editToggleBtn.style.borderColor = '#667eea';
        editToggleBtn.style.color = '#667eea';
        
        // Remove edit-mode class - this hides checkboxes and shows delete buttons
        if (photosGrid) {
          photosGrid.classList.remove('edit-mode');
        }
        
        // Hide bulk actions
        if (bulkActions) {
          bulkActions.style.display = 'none';
        }
        
        // Clear all selections
        const photoCheckboxes = document.querySelectorAll('.photo-select');
        photoCheckboxes.forEach(checkbox => {
          checkbox.checked = false;
        });
        
        // Remove selected class from all photos
        const photoItems = document.querySelectorAll('.photo-item');
        photoItems.forEach(item => {
          item.classList.remove('selected');
        });
        
        this.selectedPhotos.clear();
      }
    });
  }

  setupBulkSelectionListeners() {
    const selectAllCheckbox = document.getElementById('selectAllPhotos');
    const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
    const photoCheckboxes = document.querySelectorAll('.photo-select');

    this.selectedPhotos.clear();
    this.updateBulkControls();

    // Select all functionality
    if (selectAllCheckbox) {
      selectAllCheckbox.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        photoCheckboxes.forEach(checkbox => {
          checkbox.checked = isChecked;
          const photoId = checkbox.dataset.photoId;
          const photoItem = checkbox.closest('.photo-item');
          
          if (isChecked) {
            this.selectedPhotos.add(photoId);
            photoItem.classList.add('selected');
          } else {
            this.selectedPhotos.delete(photoId);
            photoItem.classList.remove('selected');
          }
        });
        this.updateBulkControls();
      });
    }

    // Individual photo selection
    photoCheckboxes.forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const photoId = e.target.dataset.photoId;
        const photoItem = e.target.closest('.photo-item');
        
        if (e.target.checked) {
          this.selectedPhotos.add(photoId);
          photoItem.classList.add('selected');
        } else {
          this.selectedPhotos.delete(photoId);
          photoItem.classList.remove('selected');
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
    const confirmMessage = `Are you sure you want to delete ${count} photo${count > 1 ? 's' : ''}?\n\nThis action cannot be undone.`;
    
    if (!confirm(confirmMessage)) {
      return;
    }

    // Disable controls during deletion
    const editToggleBtn = document.getElementById('editToggleBtn');
    const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
    const selectAllCheckbox = document.getElementById('selectAllPhotos');
    const selectedCountSpan = document.getElementById('selectedCount');
    
    if (editToggleBtn) editToggleBtn.disabled = true;
    if (deleteSelectedBtn) {
      deleteSelectedBtn.disabled = true;
      deleteSelectedBtn.textContent = 'Deleting...';
    }
    if (selectAllCheckbox) selectAllCheckbox.disabled = true;

    const selectedPhotoIds = Array.from(this.selectedPhotos);
    const results = { successful: 0, failed: 0 };
    const total = selectedPhotoIds.length;

    // Process deletions with progress updates
    for (let i = 0; i < selectedPhotoIds.length; i++) {
      const photoId = selectedPhotoIds[i];
      const progress = i + 1;
      
      // Update progress in button text
      if (deleteSelectedBtn) {
        deleteSelectedBtn.textContent = `Deleting... (${progress}/${total})`;
      }
      
      // Update progress in counter
      if (selectedCountSpan) {
        selectedCountSpan.textContent = `Deleting ${progress}/${total}...`;
      }

      try {
        const checkbox = document.querySelector(`[data-photo-id="${photoId}"]`);
        const driveFileId = checkbox?.dataset.driveId;

        const { error } = await supabaseHelpers.deletePhoto(photoId, driveFileId);
        
        if (error) {
          console.error(`Failed to delete photo ${photoId}:`, error);
          results.failed++;
        } else {
          results.successful++;
          
          // Remove the photo item from UI immediately for better UX
          const photoItem = checkbox?.closest('.photo-item');
          if (photoItem) {
            photoItem.style.opacity = '0.5';
            photoItem.style.transform = 'scale(0.95)';
          }
        }
      } catch (error) {
        console.error(`Exception deleting photo ${photoId}:`, error);
        results.failed++;
      }
      
      // Small delay to prevent overwhelming the server
      if (i < selectedPhotoIds.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Show comprehensive results
    let resultMessage = '';
    if (results.successful > 0 && results.failed === 0) {
      resultMessage = `Successfully deleted ${results.successful} photo${results.successful > 1 ? 's' : ''}!`;
    } else if (results.successful > 0 && results.failed > 0) {
      resultMessage = `Deleted ${results.successful} photo${results.successful > 1 ? 's' : ''}. ${results.failed} failed to delete.`;
    } else if (results.failed > 0) {
      resultMessage = `Failed to delete ${results.failed} photo${results.failed > 1 ? 's' : ''}. Please try again.`;
    }
    
    if (resultMessage) {
      alert(resultMessage);
    }

    // Re-enable controls
    if (editToggleBtn) editToggleBtn.disabled = false;
    if (selectAllCheckbox) selectAllCheckbox.disabled = false;

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

// Click-to-select functionality for edit mode
document.addEventListener('click', function(e) {
  const photoItem = e.target.closest('.photo-item');
  if (!photoItem) return;
  
  // Only work in edit mode
  if (!window.uploadManager || !window.uploadManager.editMode) return;
  
  // Don't interfere with existing buttons or checkboxes
  if (e.target.closest('.delete-btn') || e.target.type === 'checkbox') return;
  
  // Find the checkbox for this photo
  const checkbox = photoItem.querySelector('.photo-select');
  if (!checkbox) return;
  
  // Toggle the checkbox
  checkbox.checked = !checkbox.checked;
  
  // Trigger the change event so existing bulk selection logic works
  checkbox.dispatchEvent(new Event('change', { bubbles: true }));
});