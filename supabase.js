// Direct Google Drive Upload - Replace your supabase.js upload functions

const directDriveHelpers = {
  // Get access token from your Netlify function (just for auth)
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

  // Get or create user folder
  async ensureUserFolder(username, accessToken) {
    const parentFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID || '1NSxPm_mBUYz_exC9dF7zHb1aas6eKbPC';
    
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
      console.log(`✅ Found existing folder: ${searchResult.files[0].id}`);
      return searchResult.files[0].id;
    }

    // Create new folder
    console.log(`🗂️ Creating new folder for: ${username}`);
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
    console.log(`✅ Created new folder: ${newFolder.id}`);
    
    // Make folder publicly viewable
    await this.makeFilePublic(newFolder.id, accessToken);
    
    return newFolder.id;
  },

  // Direct upload to Google Drive (bypasses Netlify limits)
  async uploadToDrive(file, username) {
    try {
      console.log(`🚀 Starting direct upload: ${file.name} (${file.size} bytes)`);
      
      // Get access token
      const accessToken = await this.getAccessToken();
      
      // Get user folder
      const userFolderId = await this.ensureUserFolder(username, accessToken);
      
      // Use resumable upload for large files
      if (file.size > 5 * 1024 * 1024) { // 5MB+
        return await this.resumableUpload(file, userFolderId, accessToken);
      } else {
        return await this.simpleUpload(file, userFolderId, accessToken);
      }
      
    } catch (error) {
      console.error('❌ Direct upload failed:', error);
      throw error;
    }
  },

  // Simple upload for smaller files
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

    // Convert file to ArrayBuffer for direct upload
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
    console.log(`✅ Simple upload successful: ${result.id}`);
    
    // Make file public
    await this.makeFilePublic(result.id, accessToken);
    
    return {
      fileId: result.id,
      publicUrl: `https://lh3.googleusercontent.com/d/${result.id}=w2000-h2000-rw`
    };
  },

  // Resumable upload for large files
  async resumableUpload(file, parentFolderId, accessToken) {
    console.log(`📤 Using resumable upload for large file: ${file.name}`);
    
    // Step 1: Initiate resumable upload
    const metadata = {
      name: `${Date.now()}_${file.name}`,
      parents: [parentFolderId]
    };

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
    console.log('📍 Upload URL obtained:', uploadUrl);

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
    console.log(`✅ Resumable upload successful: ${result.id}`);
    
    // Make file public
    await this.makeFilePublic(result.id, accessToken);
    
    return {
      fileId: result.id,
      publicUrl: `https://lh3.googleusercontent.com/d/${result.id}=w2000-h2000-rw`
    };
  },

  // Make file publicly accessible
  async makeFilePublic(fileId, accessToken) {
    try {
      console.log(`🔓 Making file public: ${fileId}`);
      
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
        const errorText = await permissionResponse.text();
        console.warn(`⚠️ Permission setting failed: ${errorText}`);
        // Don't throw - continue even if permissions fail
      } else {
        console.log('✅ File made public successfully');
      }
    } catch (error) {
      console.warn('⚠️ Permission error (non-fatal):', error);
    }
  },

  // Delete file from Google Drive
  async deleteFromDrive(fileId) {
    try {
      const accessToken = await this.getAccessToken();
      
      const deleteResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!deleteResponse.ok) {
        throw new Error(`Delete failed: ${deleteResponse.status}`);
      }

      console.log(`✅ File deleted: ${fileId}`);
      return { success: true };
      
    } catch (error) {
      console.error('❌ Delete failed:', error);
      return { error: error.message };
    }
  }
};

// Updated supabaseHelpers to use direct uploads
const supabaseHelpers = {
  // ... keep all your existing auth functions ...

  // Updated upload function using direct Drive API
  async uploadPhoto(file, username) {
    try {
      console.log(`🚀 Starting direct upload: ${file.name} for ${username}`);
      
      // Upload directly to Google Drive
      const driveResult = await directDriveHelpers.uploadToDrive(file, username);
      
      return {
        data: {
          fileId: driveResult.fileId,
          publicUrl: driveResult.publicUrl,
          path: `${username}/${file.name}`
        }
      };

    } catch (error) {
      console.error('❌ Upload error:', error);
      return { error: error.message };
    }
  },

  // Updated delete function
  async deletePhoto(photoId, driveFileId) {
    try {
      // Delete from Google Drive first
      const driveResult = await directDriveHelpers.deleteFromDrive(driveFileId);
      
      if (driveResult.error) {
        console.warn('⚠️ Failed to delete from Google Drive:', driveResult.error);
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
  },

  // ... keep all your other existing functions (savePhotoMetadata, getUserPhotos, etc.) ...
};

// Replace the global reference
window.supabaseHelpers = supabaseHelpers;

console.log('🚀 Direct Google Drive upload system loaded - no size limits!');