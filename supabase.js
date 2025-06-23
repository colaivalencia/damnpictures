// Supabase configuration with Netlify Functions for Google Drive
const SUPABASE_URL = 'https://yxsgedkyoosbauhydtlp.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4c2dlZGt5b29zYmF1aHlkdGxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAxOTIzMTQsImV4cCI6MjA2NTc2ODMxNH0.CBKJa4Q1K1goiQtc8huQcXMLF6OEwFJ3RLlNSixuHAA'

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Netlify Functions helpers for Google Drive
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

// Updated Supabase helpers with Netlify Functions integration
const supabaseHelpers = {
  // Auth helpers (unchanged)
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

  // Google Drive upload via Netlify Functions
  async uploadPhoto(file, username) {
    try {
      console.log(`Starting upload: ${file.name} for ${username}`);
      
      // Upload to Google Drive via Netlify Function
      const driveResult = await netlifyDriveHelpers.uploadToDrive(file, username);
      
      if (driveResult.error) {
        return { error: driveResult.error };
      }

      return {
        data: {
          path: driveResult.data.path,
          publicUrl: driveResult.data.publicUrl,
          fileId: driveResult.data.fileId
        }
      };

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

console.log('Google Drive integration via Netlify Functions loaded');