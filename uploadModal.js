// ===== GOOGLE DRIVE PHOTO UPLOAD SYSTEM (UP TO 72 PHOTOS) =====

console.log('Google Drive upload system loaded');

document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM ready, initializing Google Drive upload system');
  
  const photoInput = document.getElementById('photoUpload');
  const uploadBtn = document.getElementById('uploadBtn');
  const photoList = document.getElementById('photoList');
  const uploadProgress = document.getElementById('uploadProgress');
  const uploadBar = document.getElementById('uploadProgressBar');
  const uploadSection = document.getElementById('uploadSection');

  if (!photoInput || !uploadBtn) {
    console.error('Critical elements not found!');
    return;
  }

  let isUploading = false;
  const MAX_FILES = 72;

  // ===== FILE SELECTION WITH LIMIT =====
  photoInput.addEventListener('change', function() {
    console.log('File input changed!');
    const files = photoInput.files;
    console.log('Files selected:', files.length);
    
    if (files.length > MAX_FILES) {
      alert(`You can upload a maximum of ${MAX_FILES} photos at once. Please select fewer files.`);
      photoInput.value = '';
      uploadBtn.disabled = true;
      uploadBtn.textContent = 'Select Photos';
      return;
    }
    
    if (files.length > 0) {
      console.log('Enabling upload button');
      uploadBtn.disabled = false;
      uploadBtn.textContent = `Upload ${files.length} photo${files.length > 1 ? 's' : ''}`;
      uploadBtn.style.background = 'linear-gradient(45deg, #667eea, #764ba2)';
    } else {
      console.log('Disabling upload button');
      uploadBtn.disabled = true;
      uploadBtn.textContent = 'Select Photos';
    }
  });

  // ===== DRAG & DROP =====
  uploadSection.addEventListener('click', function(e) {
    if (e.target === uploadSection || e.target.classList.contains('upload-text') || e.target.classList.contains('upload-icon') || e.target.classList.contains('upload-subtext')) {
      photoInput.click();
    }
  });

  uploadSection.addEventListener('dragover', function(e) {
    e.preventDefault();
    uploadSection.classList.add('drag-over');
  });

  uploadSection.addEventListener('dragleave', function(e) {
    e.preventDefault();
    uploadSection.classList.remove('drag-over');
  });

  uploadSection.addEventListener('drop', function(e) {
    e.preventDefault();
    uploadSection.classList.remove('drag-over');
    
    const files = e.dataTransfer.files;
    console.log('Dropped files:', files.length);
    
    if (files.length > MAX_FILES) {
      alert(`You can upload a maximum of ${MAX_FILES} photos at once. Please select fewer files.`);
      return;
    }
    
    if (files.length > 0) {
      photoInput.files = files;
      uploadBtn.disabled = false;
      uploadBtn.textContent = `Upload ${files.length} photo${files.length > 1 ? 's' : ''}`;
    }
  });

  // ===== SEQUENTIAL GOOGLE DRIVE UPLOAD SYSTEM =====
  uploadBtn.addEventListener('click', async function() {
    console.log('Google Drive upload started!');
    
    const files = Array.from(photoInput.files);
    if (!files.length) {
      console.log('No files selected');
      return;
    }

    console.log(`Starting sequential upload of ${files.length} files to Google Drive`);

    // Check if user is logged in
    if (typeof getCurrentUserProfile !== 'function') {
      console.error('getCurrentUserProfile function not found!');
      alert('Authentication system not loaded. Please refresh the page.');
      return;
    }

    const userProfile = getCurrentUserProfile();
    if (!userProfile) {
      alert('Please log in to upload photos');
      return;
    }

    if (isUploading) {
      console.log('Already uploading...');
      return;
    }

    // Start upload process
    isUploading = true;
    uploadBtn.disabled = true;
    uploadProgress.style.display = 'block';
    uploadBar.style.width = '0%';

    const startTime = Date.now();
    let successCount = 0;
    let failCount = 0;

    try {
      console.log(`Processing ${files.length} files sequentially via Google Drive`);

      // Check if supabaseHelpers exists
      if (typeof supabaseHelpers === 'undefined') {
        throw new Error('supabaseHelpers not found');
      }

      // Get existing photos to check for duplicates
      console.log('Checking for existing photos...');
      const { data: existingPhotos, error: existingError } = await supabase
        .from('photos')
        .select('original_name, filename')
        .eq('user_id', userProfile.id);

      if (existingError) {
        console.error('Error fetching existing photos:', existingError);
      }

      const existingNames = new Set();
      if (existingPhotos) {
        existingPhotos.forEach(photo => {
          existingNames.add(photo.original_name);
          existingNames.add(photo.filename);
        });
      }

      console.log(`Found ${existingNames.size} existing photo names`);

      // Filter and validate files first
      const validFiles = [];
      const duplicateFiles = [];
      
      for (const file of files) {
        if (!validateFile(file)) {
          failCount++;
          continue;
        }

        // Check for duplicates
        if (existingNames.has(file.name)) {
          console.log(`⚠️ Duplicate detected: ${file.name}`);
          duplicateFiles.push(file.name);
          failCount++;
          continue;
        }

        validFiles.push(file);
      }

      // Show duplicate warning if any found
      if (duplicateFiles.length > 0) {
        const duplicateList = duplicateFiles.slice(0, 5).join(', ');
        const moreText = duplicateFiles.length > 5 ? ` and ${duplicateFiles.length - 5} more` : '';
        alert(`⚠️ Skipping ${duplicateFiles.length} duplicate photo${duplicateFiles.length > 1 ? 's' : ''}:\n${duplicateList}${moreText}\n\nUploading remaining photos...`);
      }

      console.log(`${validFiles.length} valid files, ${failCount} invalid/duplicate files`);

      // Process files ONE BY ONE to Google Drive
      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];
        console.log(`\n--- Uploading file ${i + 1}/${validFiles.length}: ${file.name} to Google Drive ---`);

        // Update progress
        const progressPercent = (i / validFiles.length) * 100;
        uploadBar.style.width = `${progressPercent}%`;
        uploadBtn.textContent = `Uploading ${i + 1}/${validFiles.length}: ${file.name.substring(0, 20)}...`;

        try {
          // Upload file to Google Drive
          console.log(`Uploading ${file.name} to Google Drive...`);
          const uploadResult = await supabaseHelpers.uploadPhoto(file, userProfile.username);
          
          if (uploadResult.error) {
            throw new Error(`Google Drive upload failed: ${uploadResult.error.message}`);
          }

          console.log(`Google Drive upload successful for ${file.name}`);

          // Save metadata to database
          const photoData = {
            username: userProfile.username,
            filename: uploadResult.data.path.split('/').pop(),
            original_name: file.name,
            publicUrl: uploadResult.data.publicUrl,
            fileId: uploadResult.data.fileId,
            path: uploadResult.data.path,
            file_size: file.size
          };

          console.log(`Saving metadata for ${file.name}:`, photoData);
          const metadataResult = await supabaseHelpers.savePhotoMetadata(photoData, userProfile);
          
          if (metadataResult.error) {
            console.error(`Metadata save failed for ${file.name}:`, metadataResult.error);
            throw new Error(`Metadata save failed: ${metadataResult.error.message}`);
          }

          console.log(`✅ Successfully uploaded: ${file.name}`);
          successCount++;

          // Add to existing names to prevent duplicates in this session
          existingNames.add(file.name);

        } catch (error) {
          console.error(`❌ Failed to upload ${file.name}:`, error.message);
          failCount++;
        }

        // Small delay between uploads to prevent overwhelming the server
        if (i < validFiles.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      // Final progress
      uploadBar.style.width = '100%';
      const totalTime = Math.round((Date.now() - startTime) / 1000);
      
      // Show comprehensive results
      let message = `Google Drive upload completed in ${totalTime} seconds!\n\n`;
      if (successCount > 0) {
        message += `✅ Successfully uploaded: ${successCount} photos\n`;
      }
      if (failCount > 0) {
        const duplicateCount = duplicateFiles.length;
        const otherFailures = failCount - duplicateCount;
        if (duplicateCount > 0) {
          message += `⚠️ Skipped duplicates: ${duplicateCount} photos\n`;
        }
        if (otherFailures > 0) {
          message += `❌ Failed uploads: ${otherFailures} photos\n`;
        }
      }
      message += `\nTotal processed: ${successCount + failCount} photos`;
      
      alert(message);
      
      // Refresh photo grid
      if (successCount > 0 && typeof loadUserPhotos === 'function') {
        console.log('Refreshing photo grid...');
        await loadUserPhotos();
      }

    } catch (error) {
      console.error('Upload process error:', error);
      alert('Upload failed: ' + error.message);
    } finally {
      // Reset UI
      console.log(`\n=== GOOGLE DRIVE UPLOAD SUMMARY ===`);
      console.log(`Total files: ${files.length}`);
      console.log(`Successful: ${successCount}`);
      console.log(`Failed: ${failCount}`);
      console.log(`=====================================`);
      
      isUploading = false;
      uploadBtn.disabled = true;
      uploadBtn.textContent = 'Select Photos';
      uploadProgress.style.display = 'none';
      uploadBar.style.width = '0%';
      photoInput.value = '';
    }
  });

  // ===== FILE VALIDATION =====
  function validateFile(file) {
    // Check file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type.toLowerCase())) {
      console.log(`❌ Invalid type: ${file.name} (${file.type})`);
      return false;
    }

    // Check file size (10MB max)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      console.log(`❌ Too large: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
      return false;
    }

    // Check for minimum size (avoid corrupted files)
    if (file.size < 1024) {
      console.log(`❌ Too small: ${file.name} (${file.size} bytes)`);
      return false;
    }

    return true;
  }

  // ===== LOAD USER PHOTOS (GOOGLE DRIVE COMPATIBLE) =====
  window.loadUserPhotos = async function() {
    console.log('Loading user photos from Google Drive...');
    
    if (typeof getCurrentUserProfile !== 'function') {
      console.error('getCurrentUserProfile not available');
      return;
    }
    
    const userProfile = getCurrentUserProfile();
    if (!userProfile) {
      console.log('No user profile');
      return;
    }

    try {
      const { data: photos, error } = await supabase
        .from('photos')
        .select('id, filename, original_name, file_url, file_path, drive_file_id, storage_type, created_at')
        .eq('user_id', userProfile.id)
        .order('created_at', { ascending: false });

      console.log('User photos loaded:', photos?.length || 0);

      if (error) {
        console.error('Error loading photos:', error);
        return;
      }

      displayUserPhotos(photos || []);

    } catch (error) {
      console.error('Error loading user photos:', error);
    }
  };

  // ===== DISPLAY PHOTOS (GOOGLE DRIVE COMPATIBLE) =====
  function displayUserPhotos(photos) {
    if (!photos.length) {
      photoList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📷</div>
          <div>No photos uploaded yet</div>
          <div style="font-size: 12px; color: #888; margin-top: 8px;">You can upload up to ${MAX_FILES} photos at once</div>
        </div>
      `;
      return;
    }

    photoList.innerHTML = '';

    // Add photo count header
    const header = document.createElement('div');
    header.style.gridColumn = '1 / -1';
    header.style.marginBottom = '16px';
    header.style.color = '#ccc';
    header.style.fontSize = '14px';
    header.innerHTML = `${photos.length} photo${photos.length !== 1 ? 's' : ''} uploaded`;
    photoList.appendChild(header);

    photos.forEach(photo => {
      const photoItem = document.createElement('div');
      photoItem.className = 'photo-item';
      
      // Use file_url if available (Google Drive), otherwise use Supabase storage
      let imageUrl;
      let deleteId;
      
      if (photo.file_url) {
        // Google Drive
        imageUrl = photo.file_url;
        deleteId = photo.drive_file_id;
      } else if (photo.file_path) {
        // Supabase Storage fallback
        const { data } = supabase.storage
          .from('photos')
          .getPublicUrl(photo.file_path);
        imageUrl = data.publicUrl;
        deleteId = photo.file_path;
      }

      photoItem.innerHTML = `
        <img src="${imageUrl}" alt="${photo.original_name}" loading="lazy" 
             onerror="this.onerror=null; if(this.src.includes('uc?export=view')) { 
               this.src='https://drive.google.com/thumbnail?id=${photo.drive_file_id}&sz=w200'; 
             } else { 
               this.style.display='none'; 
             }">
        <div class="photo-overlay">
          <button class="delete-btn" onclick="deletePhoto('${photo.id}', '${deleteId}', '${photo.storage_type || 'googledrive'}')" title="Delete photo">
            ×
          </button>
        </div>
      `;

      photoList.appendChild(photoItem);
    });
  }

  // ===== LOAD PHOTOS WHEN MODAL OPENS =====
  const uploadModal = document.getElementById('uploadModal');
  if (uploadModal) {
    // Method 1: Use MutationObserver
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          if (!uploadModal.classList.contains('hidden')) {
            console.log('Upload modal opened, loading user photos...');
            if (typeof isLoggedIn === 'function' && isLoggedIn()) {
              setTimeout(() => {
                loadUserPhotos();
              }, 100); // Small delay to ensure DOM is ready
            }
          }
        }
      });
    });

    observer.observe(uploadModal, { attributes: true });

    // Method 2: Also add click listener to the label (backup)
    const label = document.getElementById('colaiLabel');
    if (label) {
      label.addEventListener('click', () => {
        if (isLoggedIn()) {
          setTimeout(() => {
            loadUserPhotos();
          }, 200);
        }
      });
    }
  }

  console.log(`Google Drive upload system ready - supports up to ${MAX_FILES} photos`);
}); // ← This closing brace and parenthesis was missing!

// ===== DELETE PHOTO (GOOGLE DRIVE COMPATIBLE) =====
window.deletePhoto = async function(photoId, fileId, storageType = 'googledrive') {
  console.log('Deleting photo:', photoId, 'from', storageType);
  
  if (!confirm('Are you sure you want to delete this photo?')) {
    return;
  }

  try {
    const result = await supabaseHelpers.deletePhoto(photoId, fileId, storageType);
    
    if (result.error) {
      alert('Failed to delete photo. Please try again.');
      console.error('Delete error:', result.error);
      return;
    }

    // Refresh photo grid
    if (typeof loadUserPhotos === 'function') {
      await loadUserPhotos();
    }

  } catch (error) {
    console.error('Error deleting photo:', error);
    alert('Failed to delete photo. Please try again.');
  }
};