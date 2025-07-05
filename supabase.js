// Supabase configuration with Direct Google Drive uploads
const SUPABASE_URL = 'https://yxsgedkyoosbauhydtlp.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4c2dlZGt5b29zYmF1aHlkdGxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAxOTIzMTQsImV4cCI6MjA2NTc2ODMxNH0.CBKJa4Q1K1goiQtc8huQcXMLF6OEwFJ3RLlNSixuHAA'

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Direct Drive helpers for large file uploads
const directDriveHelpers = {
  // Get access token from Netlify function
  async getAccessToken() {
    try {
      const response = await fetch('/.netlify/functions/upload-to-drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get-token' })
      });

      if (!response.ok) {
        throw new Error(`Token request failed: ${response.status}`);
      }

      const data = await response.json();
      return data.access_token;
    } catch (error) {
      console.error('❌ Failed to get access token:', error);
      throw error;
    }
  },

  // Get user folder ID
  async getUserFolder(username, accessToken) {
    const parentFolderId = '1NSxPm_mBUYz_exC9dF7zHb1aas6eKbPC'; // Replace with your actual folder ID
    
    // Search for existing folder
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='${username}' and parents in '${parentFolderId}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    
    const searchResponse = await fetch(searchUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (!searchResponse.ok) {
      throw new Error(`Folder search failed: ${searchResponse.status}`);
    }

    const searchResult = await searchResponse.json();
    
    if (searchResult.files && searchResult.files.length > 0) {
      return searchResult.files[0].id;
    }

    // Create new folder
    const folderResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: username,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentFolderId]
      })
    });

    if (!folderResponse.ok) {
      throw new Error(`Folder creation failed: ${folderResponse.status}`);
    }

    const newFolder = await folderResponse.json();
    
    // Make folder public
    await this.makeFilePublic(newFolder.id, accessToken);
    
    return newFolder.id;
  },

  // Direct upload using resumable API for large files
  async directUpload(file, username) {
    try {
      console.log(`🚀 Direct upload: ${file.name} (${file.size} bytes)`);
      
      const accessToken = await this.getAccessToken();
      const userFolderId = await this.getUserFolder(username, accessToken);
      
      // Use resumable upload for files over 5MB
      if (file.size > 5 * 1024 * 1024) {
        return await this.resumableUpload(file, userFolderId, accessToken);
      } else {
        return await this.simpleUpload(file, userFolderId, accessToken);
      }
      
    } catch (error) {
      console.error('❌ Direct upload failed:', error);
      throw error;
    }
  },

  // Simple multipart upload for smaller files
  async simpleUpload(file, parentFolderId, accessToken) {
    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const close_delim = `\r\n--${boundary}--`;

    const metadata = {
      name: `${Date.now()}_${file.name}`,
      parents: [parentFolderId]
    };

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      `Content-Type: ${file.type}\r\n\r\n`;

    const fileArrayBuffer = await file.arrayBuffer();

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary="${boundary}"`
      },
      body: new Uint8Array([
        ...new TextEncoder().encode(multipartRequestBody),
        ...new Uint8Array(fileArrayBuffer),
        ...new TextEncoder().encode(close_delim)
      ])
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upload failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    await this.makeFilePublic(result.id, accessToken);
    
    return {
      fileId: result.id,
      publicUrl: `https://lh3.googleusercontent.com/d/${result.id}=w2000-h2000-rw`
    };
  },

  // Resumable upload for large files
  async resumableUpload(file, parentFolderId, accessToken) {
    console.log(`📤 Resumable upload: ${file.name}`);
    
    const metadata = {
      name: `${Date.now()}_${file.name}`,
      parents: [parentFolderId]
    };

    // Step 1: Initiate resumable upload
    const initiateResponse = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(metadata)
    });

    if (!initiateResponse.ok) {
      throw new Error(`Resumable initiation failed: ${initiateResponse.status}`);
    }

    const uploadUrl = initiateResponse.headers.get('Location');

    // Step 2: Upload file data
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type
      },
      body: file
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`Resumable upload failed: ${uploadResponse.status} - ${errorText}`);
    }

    const result = await uploadResponse.json();
    await this.makeFilePublic(result.id, accessToken);
    
    return {
      fileId: result.id,
      publicUrl: `https://lh3.googleusercontent.com/d/${result.id}=w2000-h2000-rw`
    };
  },

  // Make file public
  async makeFilePublic(fileId, accessToken) {
    try {
      const permissionResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions?sendNotificationEmail=false`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          role: 'reader',
          type: 'anyone',
          allowFileDiscovery: false
        })
      });

      if (!permissionResponse.ok) {
        console.warn(`⚠️ Permission setting failed for ${fileId}`);
      }
    } catch (error) {
      console.warn('⚠️ Permission error (non-fatal):', error);
    }
  }
};

// Netlify Functions fallback for smaller files
const netlifyDriveHelpers = {
  // Upload file to Google Drive via Netlify Function
  async uploadToDrive(file, username) {
    try {
      console.log(`Uploading ${file.name} to Google Drive via Netlify Function`);

      // Convert file to base64
      const base64Data = await this.fileToBase64(file);

      // Call Netlify Function
      const response = await fetch('/.netlify/functions/upload-to-drive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'upload',
          fileData: base64Data,
          filename: file.name,
          username: username,
          mimeType: file.type
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Google Drive upload successful:', result);

      return {
        data: {
          fileId: result.fileId,
          publicUrl: result.publicUrl,
          path: result.path
        }
      };

    } catch (error) {
      console.error('❌ Google Drive upload failed:', error);
      return { error: error.message };
    }
  },

  // Delete file from Google Drive via Netlify Function
  async deleteFromDrive(fileId) {
    try {
      console.log(`Deleting file ${fileId} from Google Drive`);

      const response = await fetch('/.netlify/functions/upload-to-drive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'delete',
          fileId: fileId
        })
      });

      const result = await response.json();
      return { success: result.success };

    } catch (error) {
      console.error('❌ Google Drive delete failed:', error);
      return { error: error.message };
    }
  },

  // Convert file to base64
  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        // Remove the data:image/jpeg;base64, prefix
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  }
};

// Updated Supabase helpers with smart upload routing
const supabaseHelpers = {
  // Auth helpers
  async signUp(email, password, username) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })
    
    if (error) return { error }
    
    if (data.user) {
      const { error: profileError } = await supabase
        .from('user_profiles')
        .insert({
          id: data.user.id,
          username,
          display_name: username
        })
      
      if (profileError) return { error: profileError }
    }
    
    return { data }
  },

  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    return { data, error }
  },

  async signOut() {
    const { error } = await supabase.auth.signOut()
    return { error }
  },

  async getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser()
    return user
  },

  // Smart upload: Direct for large files, Netlify for small files
  async uploadPhoto(file, username) {
    try {
      console.log(`Starting upload: ${file.name} for ${username} (${file.size} bytes)`);
      
      const maxNetlifySize = 4 * 1024 * 1024; // 4MB base64 limit for Netlify
      
      try {
        // Try direct upload for large files or if Netlify fails
        if (file.size > maxNetlifySize) {
          console.log('🚀 Using direct upload for large file');
          const directResult = await directDriveHelpers.directUpload(file, username);
          
          return {
            data: {
              fileId: directResult.fileId,
              publicUrl: directResult.publicUrl,
              path: `${username}/${file.name}`
            }
          };
        } else {
          console.log('📤 Using Netlify function for small file');
          const netlifyResult = await netlifyDriveHelpers.uploadToDrive(file, username);
          
          if (netlifyResult.error) {
            console.log('⚠️ Netlify failed, trying direct upload...');
            const directResult = await directDriveHelpers.directUpload(file, username);
            
            return {
              data: {
                fileId: directResult.fileId,
                publicUrl: directResult.publicUrl,
                path: `${username}/${file.name}`
              }
            };
          }
          
          return netlifyResult;
        }
      } catch (error) {
        console.error('❌ Both upload methods failed:', error);
        return { error: error.message };
      }

    } catch (error) {
      console.error('Upload error:', error);
      return { error: error.message };
    }
  },

  async savePhotoMetadata(photoData, user) {
    const { data, error } = await supabase
      .from('photos')
      .insert({
        user_id: user.id,
        username: photoData.username,
        filename: photoData.filename,
        original_name: photoData.original_name,
        file_url: photoData.publicUrl,
        drive_file_id: photoData.fileId,
        file_size: photoData.file_size,
        is_public: true
      })

    return { data, error }
  },

  async getPublicPhotos() {
    const { data, error } = await supabase
      .from('photos')
      .select('*')
      .eq('is_public', true)
      .order('created_at', { ascending: false })

    return { data, error }
  },

  async getUserPhotos(username) {
    const { data, error } = await supabase
      .from('photos')
      .select('*')
      .eq('username', username)
      .eq('is_public', true)
      .order('created_at', { ascending: false })

    return { data, error }
  },

  async getUsersWithPhotos() {
    const { data, error } = await supabase
      .from('user_profiles')
      .select(`
        username,
        display_name,
        photos!inner(id)
      `)
      .eq('photos.is_public', true)

    return { data, error }
  },

  async deletePhoto(photoId, driveFileId) {
    try {
      // Delete from Google Drive first
      const driveResult = await netlifyDriveHelpers.deleteFromDrive(driveFileId);
      
      if (driveResult.error) {
        console.warn('Failed to delete from Google Drive:', driveResult.error);
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('photos')
        .delete()
        .eq('id', photoId)

      return { error: dbError }

    } catch (error) {
      return { error: error.message }
    }
  }
}

// Make available globally
window.supabaseHelpers = supabaseHelpers

console.log('🚀 Smart Google Drive upload system loaded - handles any file size!');