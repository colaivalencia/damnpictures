// ===== BULK PHOTO UPLOAD SYSTEM (UP TO 72 PHOTOS) =====

console.log('Bulk upload system loaded');

document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM ready, initializing bulk upload system');
  
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
  const BATCH_SIZE = 6; // Upload 6 files concurrently for speed

  // ===== FILE SELECTION WITH LIMIT =====
  photoInput.addEventListener('change', function() {
    console.log('File input changed!');
    const files = photoInput.files;
    console.log('Files selected:', files.length);
    
    if (files.length > MAX_FILES) {
      alert(`You can upload a maximum of ${MAX_FILES} photos at once. Please select fewer files.`);
      photoInput.value = ''; // Clear selection
      uploadBtn.disabled = true;
      uploadBtn.textContent = 'Select Photos';
      return;
    }
    
    if (files.length > 0) {
      console.log('Enabling upload button');
      uploadBtn.disabled = false;
      uploadBtn.textContent = `Upload ${files.length} photo${files.length > 1 ? 's' : ''}`;
      uploadBtn.style.background = 'linear-gradient(45deg, #667eea, #764ba2)';
      
      // Show file count and estimated time
      const estimatedTime = Math.ceil(files.length / BATCH_SIZE) * 3; // Rough estimate
      console.log(`Estimated upload time: ~${estimatedTime} seconds`);
    } else {
      console.log('Disabling upload button');
      uploadBtn.disabled = true;
      uploadBtn.textContent = 'Select Photos';
    }
  });

  // ===== DRAG & DROP WITH FILE LIMIT =====
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

  // ===== BULK UPLOAD SYSTEM WITH BATCHING =====
  uploadBtn.addEventListener('click', async function() {
    console.log('Bulk upload started!');
    
    const files = Array.from(photoInput.files);
    if (!files.length) {
      console.log('No files selected');
      return;
    }

    console.log(`Starting bulk upload of ${files.length} files`);

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
    let processedCount = 0;

    try {
      console.log(`Processing ${files.length} files in batches of ${BATCH_SIZE}`);

      // Check if supabaseHelpers exists
      if (typeof supabaseHelpers === 'undefined') {
        throw new Error('supabaseHelpers not found');
      }

      // Filter and validate files first
      const validFiles = [];
      for (const file of files) {
        if (validateFile(file)) {
          validFiles.push(file);
        } else {
          failCount++;
        }
      }

      console.log(`${validFiles.length} valid files, ${failCount} invalid files`);

      // Process files in batches for better performance
      for (let i = 0; i < validFiles.length; i += BATCH_SIZE) {
        const batch = validFiles.slice(i, i + BATCH_SIZE);
        console.log(`\n--- Processing batch ${Math.floor(i/BATCH_SIZE) + 1} (${batch.length} files) ---`);

        // Process batch concurrently
        const batchPromises = batch.map(async (file, batchIndex) => {
          const globalIndex = i + batchIndex;
          try {
            console.log(`Uploading ${globalIndex + 1}/${validFiles.length}: ${file.name}`);

            // Upload file to storage
            const uploadResult = await supabaseHelpers.uploadPhoto(file, userProfile.username);
            if (uploadResult.error) {
              throw new Error(`Storage upload failed: ${uploadResult.error.message}`);
            }

            // Save metadata to database
            const photoData = {
              username: userProfile.username,
              filename: uploadResult.data.path.split('/').pop(),
              original_name: file.name,
              file_path: uploadResult.data.path,
              file_size: file.size
            };

            const metadataResult = await supabaseHelpers.savePhotoMetadata(photoData, userProfile);
            if (metadataResult.error) {
              // Clean up orphaned file
              await supabase.storage.from('photos').remove([uploadResult.data.path]);
              throw new Error(`Metadata save failed: ${metadataResult.error.message}`);
            }

            console.log(`✅ Success: ${file.name}`);
            return { success: true, file: file.name };

          } catch (error) {
            console.error(`❌ Failed: ${file.name} - ${error.message}`);
            return { success: false, file: file.name, error: error.message };
          }
        });

        // Wait for batch to complete
        const batchResults = await Promise.all(batchPromises);
        
        // Update counters
        batchResults.forEach(result => {
          if (result.success) {
            successCount++;
          } else {
            failCount++;
          }
          processedCount++;
        });

        // Update progress
        const progressPercent = (processedCount / validFiles.length) * 100;
        uploadBar.style.width = `${progressPercent}%`;
        uploadBtn.textContent = `Uploaded ${processedCount}/${validFiles.length}`;

        console.log(`Batch complete. Progress: ${processedCount}/${validFiles.length}`);

        // Small delay between batches to prevent overwhelming the server
        if (i + BATCH_SIZE < validFiles.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      // Final progress
      uploadBar.style.width = '100%';
      const totalTime = Math.round((Date.now() - startTime) / 1000);
      
      // Show comprehensive results
      let message = `Upload completed in ${totalTime} seconds!\n\n`;
      if (successCount > 0) {
        message += `✅ Successfully uploaded: ${successCount} photos\n`;
      }
      if (failCount > 0) {
        message += `❌ Failed uploads: ${failCount} photos\n`;
      }
      message += `\nTotal processed: ${processedCount} photos`;
      
      alert(message);
      
      // Refresh photo grid
      if (successCount > 0 && typeof loadUserPhotos === 'function') {
        console.log('Refreshing photo grid...');
        await loadUserPhotos();
      }

    } catch (error) {
      console.error('Bulk upload error:', error);
      alert('Upload failed: ' + error.message);
    } finally {
      // Reset UI
      console.log(`\n=== UPLOAD SUMMARY ===`);
      console.log(`Total files: ${files.length}`);
      console.log(`Successful: ${successCount}`);
      console.log(`Failed: ${failCount}`);
      console.log(`======================`);
      
      isUploading = false;
      uploadBtn.disabled = true;
      uploadBtn.textContent = 'Select Photos';
      uploadProgress.style.display = 'none';
      uploadBar.style.width = '0%';
      photoInput.value = '';
    }
  });

  // ===== ENHANCED FILE VALIDATION =====
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

  // ===== LOAD USER PHOTOS (OPTIMIZED FOR LARGE GALLERIES) =====
  window.loadUserPhotos = async function() {
    console.log('Loading user photos...');
    
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
        .select('id, filename, original_name, file_path, created_at')
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

  // ===== OPTIMIZED PHOTO DISPLAY =====
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
      
      const { data } = supabase.storage
        .from('photos')
        .getPublicUrl(photo.file_path);

      photoItem.innerHTML = `
        <img src="${data.publicUrl}" alt="${photo.original_name}" loading="lazy">
        <div class="photo-overlay">
          <button class="delete-btn" onclick="deletePhoto('${photo.id}', '${photo.file_path}')" title="Delete photo">
            ×
          </button>
        </div>
      `;

      photoList.appendChild(photoItem);
    });
  }

  // ===== LOAD PHOTOS WHEN UPLOAD MODAL OPENS =====
  const uploadModal = document.getElementById('uploadModal');
  if (uploadModal) {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          if (!uploadModal.classList.contains('hidden') && typeof isLoggedIn === 'function' && isLoggedIn()) {
            loadUserPhotos();
          }
        }
      });
    });

    observer.observe(uploadModal, { attributes: true });
  }

  console.log(`Bulk upload system ready - supports up to ${MAX_FILES} photos`);
});

// ===== DELETE PHOTO =====
window.deletePhoto = async function(photoId, filePath) {
  console.log('Deleting photo:', photoId);
  
  if (!confirm('Are you sure you want to delete this photo?')) {
    return;
  }

  try {
    const result = await supabaseHelpers.deletePhoto(photoId, filePath);
    
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