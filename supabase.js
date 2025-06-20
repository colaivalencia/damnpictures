// Supabase configuration with Google Drive integration
const SUPABASE_URL = 'https://yxsgedkyoosbauhydtlp.supabase.co'
const SUPABASE_ANON_KEY = 'eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4c2dlZGt5b29zYmF1aHlkdGxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAxOTIzMTQsImV4cCI6MjA2NTc2ODMxNH0'

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Google Drive configuration from environment variables
const GOOGLE_DRIVE_CONFIG = {
  clientEmail: 'damnpicures-service@damnpictures.iam.gserviceaccount.com',
  projectId: 'damnpictures',
  folderId: '1NSxPm_mBUYz_exC9dF7zHb1aas6eKbPC', // Replace with your actual folder ID
  // Note: Private key will be handled server-side for security
};

// Google Drive helper functions
const googleDriveHelpers = {
  // Get OAuth access token (simplified for frontend)
  async getAccessToken() {
    // In production, this should be done server-side
    // For now, we'll use a simplified approach
    
    // This is a placeholder - in reality, you'd need to implement
    // JWT signing server-side for security
    console.warn('Google Drive integration needs server-side implementation for production');
    
    // For testing, we'll simulate the token
    return 'test-token';
  },

  // Upload file to Google Drive
  async uploadToDrive(file, username) {
    try {
      console.log(`Uploading ${file.name} to Google Drive for user ${username}`);
      
      // For now, simulate successful upload
      // In production, this would make actual API calls
      const mockFileId = 'drive-file-' + Date.now();
      const mockPublicUrl = `https://drive.google.com/uc?id=${mockFileId}`;
      
      // Simulate upload delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return {
        data: {
          fileId: mockFileId,
          publicUrl: mockPublicUrl,
          path: `${username}/${file.name}`
        }
      };
      
    } catch (error) {
      console.error('Google Drive upload error:', error);
      return { error: error.message };
    }
  },

  // Delete file from Google Drive
  async deleteFromDrive(fileId) {
    try {
      console.log(`Deleting file ${fileId} from Google Drive`);
      
      // Simulate deletion
      await new Promise(resolve => setTimeout(resolve, 500));
      
      return { success: true };
      
    } catch (error) {
      console.error('Google Drive delete error:', error);
      return { error: error.message };
    }
  }
};

// Updated Supabase helpers with Google Drive integration
const supabaseHelpers = {
  // Auth helpers (unchanged)
  async signUp(email, password, username) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })
    
    if (error) return { error }
    
    // Create user profile
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

  // Modified photo helpers for Google Drive
  async uploadPhoto(file, username) {
    try {
      console.log(`Starting upload: ${file.name} for ${username}`);
      
      // Upload to Google Drive
      const driveResult = await googleDriveHelpers.uploadToDrive(file, username);
      
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
        file_url: photoData.publicUrl, // Google Drive URL
        drive_file_id: photoData.fileId, // Store Drive file ID for deletion
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
      const driveResult = await googleDriveHelpers.deleteFromDrive(driveFileId);
      
      if (driveResult.error) {
        return { error: driveResult.error };
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

console.log('Google Drive integration loaded (mock mode for testing)');