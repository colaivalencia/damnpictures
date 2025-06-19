// ===== DEBUG VERSION - PHOTO UPLOAD SYSTEM =====

console.log('Upload modal script loaded');

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM ready, initializing upload system');
  
  const photoInput = document.getElementById('photoUpload');
  const uploadBtn = document.getElementById('uploadBtn');
  const photoList = document.getElementById('photoList');
  const uploadProgress = document.getElementById('uploadProgress');
  const uploadBar = document.getElementById('uploadProgressBar');
  const uploadSection = document.getElementById('uploadSection');

  console.log('Elements found:', {
    photoInput: !!photoInput,
    uploadBtn: !!uploadBtn,
    photoList: !!photoList,
    uploadProgress: !!uploadProgress,
    uploadBar: !!uploadBar,
    uploadSection: !!uploadSection
  });

  if (!photoInput || !uploadBtn) {
    console.error('Critical elements not found!');
    return;
  }

  let isUploading = false;

  // ===== FILE SELECTION DEBUG =====
  photoInput.addEventListener('change', function() {
    console.log('File input changed!');
    const files = photoInput.files;
    console.log('Files selected:', files.length);
    
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

  // ===== CLICK ON UPLOAD SECTION =====
  uploadSection.addEventListener('click', function(e) {
    console.log('Upload section clicked');
    if (e.target === uploadSection || e.target.classList.contains('upload-text') || e.target.classList.contains('upload-icon')) {
      photoInput.click();
    }
  });

  // ===== DRAG & DROP DEBUG =====
  uploadSection.addEventListener('dragover', function(e) {
    e.preventDefault();
    console.log('Drag over');
    uploadSection.classList.add('drag-over');
  });

  uploadSection.addEventListener('dragleave', function(e) {
    e.preventDefault();
    console.log('Drag leave');
    uploadSection.classList.remove('drag-over');
  });

  uploadSection.addEventListener('drop', function(e) {
    e.preventDefault();
    console.log('Files dropped');
    uploadSection.classList.remove('drag-over');
    
    const files = e.dataTransfer.files;
    console.log('Dropped files:', files.length);
    
    if (files.length > 0) {
      photoInput.files = files;
      uploadBtn.disabled = false;
      uploadBtn.textContent = `Upload ${files.length} photo${files.length > 1 ? 's' : ''}`;
    }
  });

  // ===== SIMPLE UPLOAD TEST =====
  uploadBtn.addEventListener('click', async function() {
    console.log('Upload button clicked!');
    
    const files = photoInput.files;
    if (!files.length) {
      console.log('No files selected');
      return;
    }

    console.log('Files to upload:', files.length);

    // Check if user is logged in
    if (typeof getCurrentUserProfile !== 'function') {
      console.error('getCurrentUserProfile function not found!');
      alert('Authentication system not loaded. Please refresh the page.');
      return;
    }

    const userProfile = getCurrentUserProfile();
    console.log('User profile:', userProfile);
    
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
    uploadBtn.textContent = 'Uploading...';
    uploadProgress.style.display = 'block';
    uploadBar.style.width = '20%';

    try {
      console.log('Starting upload for user:', userProfile.username);
      
      // Test with first file only
      const file = files[0];
      console.log('Uploading file:', file.name, 'Size:', file.size);

      // Check if supabaseHelpers exists
      if (typeof supabaseHelpers === 'undefined') {
        throw new Error('supabaseHelpers not found');
      }

      uploadBar.style.width = '50%';

      // Upload file to Supabase Storage
      const uploadResult = await supabaseHelpers.uploadPhoto(file, userProfile.username);
      console.log('Upload result:', uploadResult);
      
      if (uploadResult.error) {
        throw new Error('Upload failed: ' + uploadResult.error.message);
      }

      uploadBar.style.width = '80%';

      // Save metadata to database
      const photoData = {
        username: userProfile.username,
        filename: uploadResult.data.path.split('/').pop(),
        original_name: file.name,
        file_path: uploadResult.data.path,
        file_size: file.size
      };

      console.log('Saving metadata:', photoData);

      const metadataResult = await supabaseHelpers.savePhotoMetadata(photoData, userProfile);
      console.log('Metadata result:', metadataResult);
      
      if (metadataResult.error) {
        throw new Error('Metadata save failed: ' + metadataResult.error.message);
      }

      uploadBar.style.width = '100%';
      
      alert('Photo uploaded successfully!');
      
      // Try to refresh photos
      if (typeof loadUserPhotos === 'function') {
        await loadUserPhotos();
      }

    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload failed: ' + error.message);
    } finally {
      // Reset UI
      isUploading = false;
      uploadBtn.disabled = true;
      uploadBtn.textContent = 'Select Photos';
      uploadProgress.style.display = 'none';
      uploadBar.style.width = '0%';
      photoInput.value = '';
    }
  });

  // ===== SIMPLE LOAD USER PHOTOS =====
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
        .select('*')
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

  // ===== DISPLAY PHOTOS =====
  function displayUserPhotos(photos) {
    console.log('Displaying photos:', photos.length);
    
    if (!photos.length) {
      photoList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📷</div>
          <div>No photos uploaded yet</div>
        </div>
      `;
      return;
    }

    photoList.innerHTML = '';

    photos.forEach(photo => {
      const photoItem = document.createElement('div');
      photoItem.className = 'photo-item';
      
      // Get public URL
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

  console.log('Upload system initialized successfully');
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

    await loadUserPhotos();
    alert('Photo deleted successfully!');

  } catch (error) {
    console.error('Error deleting photo:', error);
    alert('Failed to delete photo. Please try again.');
  }
};