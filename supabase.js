// Supabase configuration with better initialization
const SUPABASE_URL = 'https://yxsgedkyoosbauhydtlp.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4c2dlZGt5b29zYmF1aHlkdGxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAxOTIzMTQsImV4cCI6MjA2NTc2ODMxNH0.CBKJa4Q1K1goiQtc8huQcXMLF6OEwFJ3RLlNSixuHAA'

// Wait for Supabase library to load
let supabase = null
let initializationAttempts = 0

function initializeSupabase() {
  console.log('🔧 Attempting Supabase initialization...')
  
  if (!window.supabase) {
    initializationAttempts++
    if (initializationAttempts < 50) { // Try for 5 seconds
      console.log(`⏳ Waiting for Supabase library... attempt ${initializationAttempts}`)
      setTimeout(initializeSupabase, 100)
      return
    } else {
      console.error('❌ Supabase library failed to load after 5 seconds')
      return
    }
  }

  try {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    console.log('✅ Supabase client initialized successfully')
    
    // Make globally available
    window.supabase = supabase
    
    // Set up auth state listener
    setupAuthStateListener()
    
    // Mark as ready
    if (window.appState) {
      window.appState.setSupabaseReady()
    }
    
  } catch (error) {
    console.error('❌ Failed to initialize Supabase client:', error)
  }
}

// Start initialization immediately
initializeSupabase()

// Netlify Functions helpers for Google Drive
const netlifyDriveHelpers = {
  async uploadToDrive(file, username) {
    try {
      console.log(`📤 Uploading ${file.name} to Google Drive via Netlify Function`)

      const base64Data = await this.fileToBase64(file)

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
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const result = await response.json()
      console.log('✅ Google Drive upload successful:', result)

      return {
        data: {
          fileId: result.fileId,
          publicUrl: result.publicUrl,
          path: result.path
        }
      }

    } catch (error) {
      console.error('❌ Google Drive upload failed:', error)
      return { error: error.message }
    }
  },

  async deleteFromDrive(fileId) {
    try {
      console.log(`🗑️ Deleting file ${fileId} from Google Drive`)

      const response = await fetch('/.netlify/functions/upload-to-drive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'delete',
          fileId: fileId
        })
      })

      const result = await response.json()
      return { success: result.success }

    } catch (error) {
      console.error('❌ Google Drive delete failed:', error)
      return { error: error.message }
    }
  },

  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => {
        const base64 = reader.result.split(',')[1]
        resolve(base64)
      }
      reader.onerror = error => reject(error)
    })
  }
}

// Enhanced Supabase helpers with better error handling
const supabaseHelpers = {
  // Check if Supabase is ready
  isReady() {
    return supabase !== null
  },

  // Wait for Supabase to be ready
  async waitForReady() {
    let attempts = 0
    while (!this.isReady() && attempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 100))
      attempts++
    }
    if (!this.isReady()) {
      throw new Error('Supabase not ready after 5 seconds')
    }
  },

  async signUp(email, password, username) {
    try {
      await this.waitForReady()
      console.log('🔐 Starting signup process for:', email)
      
      // Check username availability first
      const { data: existingUser } = await supabase
        .from('user_profiles')
        .select('username')
        .eq('username', username)
        .single()

      if (existingUser) {
        return { error: { message: 'Username is already taken' } }
      }

      // Sign up with Supabase
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username,
            display_name: username
          },
          emailRedirectTo: `${window.location.origin}`
        }
      })
      
      if (error) {
        console.error('❌ Signup error:', error)
        return { error }
      }

      console.log('✅ Signup successful, email confirmation needed')
      
      return { 
        data, 
        needsConfirmation: !data.user?.email_confirmed_at 
      }
      
    } catch (error) {
      console.error('❌ Signup exception:', error)
      return { error: { message: error.message } }
    }
  },

  async signIn(email, password) {
    try {
      await this.waitForReady()
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) {
        if (error.message.includes('Email not confirmed')) {
          return { 
            error: { 
              message: 'Please check your email and click the confirmation link first.',
              code: 'email_not_confirmed'
            } 
          }
        }
        return { error }
      }

      return { data }
    } catch (error) {
      return { error: { message: error.message } }
    }
  },

  async resendConfirmation(email) {
    try {
      await this.waitForReady()
      
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email
      })
      return { error }
    } catch (error) {
      return { error: { message: error.message } }
    }
  },

  async signOut() {
    try {
      await this.waitForReady()
      const { error } = await supabase.auth.signOut()
      return { error }
    } catch (error) {
      return { error: { message: error.message } }
    }
  },

  async getCurrentUser() {
    try {
      await this.waitForReady()
      const { data: { user } } = await supabase.auth.getUser()
      return user
    } catch (error) {
      console.error('❌ Get current user error:', error)
      return null
    }
  },

  async uploadPhoto(file, username) {
    try {
      console.log(`📸 Starting upload: ${file.name} for ${username}`)
      
      const driveResult = await netlifyDriveHelpers.uploadToDrive(file, username)
      
      if (driveResult.error) {
        return { error: driveResult.error }
      }

      return {
        data: {
          path: driveResult.data.path,
          publicUrl: driveResult.data.publicUrl,
          fileId: driveResult.data.fileId
        }
      }

    } catch (error) {
      console.error('❌ Upload error:', error)
      return { error: error.message }
    }
  },

  async savePhotoMetadata(photoData, user) {
    try {
      await this.waitForReady()
      
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
    } catch (error) {
      console.error('❌ Save metadata error:', error)
      return { error: { message: error.message } }
    }
  },

  async getPublicPhotos() {
    try {
      await this.waitForReady()
      
      const { data, error } = await supabase
        .from('photos')
        .select('*')
        .eq('is_public', true)
        .order('created_at', { ascending: false })

      return { data, error }
    } catch (error) {
      console.error('❌ Get public photos error:', error)
      return { error: { message: error.message } }
    }
  },

  async getUserPhotos(username) {
    try {
      await this.waitForReady()
      console.log(`📸 Fetching photos for: ${username}`)
      
      const { data, error } = await supabase
        .from('photos')
        .select('*')
        .eq('username', username)
        .eq('is_public', true)
        .order('created_at', { ascending: false })

      console.log(`📸 Found ${data?.length || 0} photos for ${username}`)
      return { data, error }
    } catch (error) {
      console.error('❌ Get user photos error:', error)
      return { error: { message: error.message } }
    }
  },

  async getUsersWithPhotos() {
    try {
      await this.waitForReady()
      console.log('👥 Fetching users with photos...')
      
      const { data, error } = await supabase
        .from('user_profiles')
        .select(`
          username,
          display_name,
          photos!inner(id)
        `)
        .eq('photos.is_public', true)

      console.log(`👥 Found ${data?.length || 0} users with photos`)
      return { data, error }
    } catch (error) {
      console.error('❌ Get users with photos error:', error)
      return { error: { message: error.message } }
    }
  },

  async deletePhoto(photoId, driveFileId) {
    try {
      await this.waitForReady()
      
      // Try to delete from Google Drive first
      const driveResult = await netlifyDriveHelpers.deleteFromDrive(driveFileId)
      
      if (driveResult.error) {
        console.warn('⚠️ Failed to delete from Google Drive:', driveResult.error)
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('photos')
        .delete()
        .eq('id', photoId)

      return { error: dbError }

    } catch (error) {
      console.error('❌ Delete photo error:', error)
      return { error: { message: error.message } }
    }
  }
}

// Auth state listener setup
function setupAuthStateListener() {
  if (!supabase) {
    console.error('❌ Cannot setup auth listener - Supabase not initialized')
    return
  }

  supabase.auth.onAuthStateChange(async (event, session) => {
    console.log('🔄 Auth state changed:', event)
    
    if (event === 'SIGNED_IN' && session) {
      const user = session.user
      
      // Check if this is from email confirmation
      const isFromEmailConfirmation = window.location.search.includes('access_token') || 
                                    window.location.hash.includes('access_token')
      
      if (isFromEmailConfirmation) {
        console.log('✅ User signed in via email confirmation')
        
        // Clean the URL
        const cleanUrl = window.location.pathname
        window.history.replaceState({}, '', cleanUrl)
        
        // Create user profile if needed
        await createUserProfileIfNeeded(user)
        
        // Show welcome message after a brief delay
        setTimeout(() => {
          if (window.authManager) {
            window.authManager.showWelcomeMessage(user)
          }
        }, 500)
      }
      
      // Handle normal sign in
      if (window.authManager) {
        await window.authManager.handleUserSignedIn(user)
      }
      
    } else if (event === 'SIGNED_OUT') {
      if (window.authManager) {
        window.authManager.handleUserSignedOut()
      }
    }
  })
}

// Create user profile if it doesn't exist
async function createUserProfileIfNeeded(user) {
  try {
    if (!supabase) {
      console.error('❌ Cannot create profile - Supabase not initialized')
      return null
    }

    // Check if profile exists
    const { data: existingProfile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (existingProfile) {
      console.log('✅ User profile already exists')
      return existingProfile
    }

    // Create new profile
    const username = user.user_metadata?.username || user.email.split('@')[0]
    const { data: newProfile, error } = await supabase
      .from('user_profiles')
      .insert({
        id: user.id,
        username: username,
        display_name: username,
        email: user.email
      })
      .select()
      .single()

    if (error) {
      console.error('❌ Error creating profile:', error)
      return null
    }

    console.log('✅ Created user profile:', newProfile)
    return newProfile

  } catch (error) {
    console.error('❌ Profile creation error:', error)
    return null
  }
}

// Make available globally
window.supabaseHelpers = supabaseHelpers

// Debug function
window.checkSupabase = function() {
  console.log('🔍 Supabase status:')
  console.log('- window.supabase:', !!window.supabase)
  console.log('- supabase client:', !!supabase)
  console.log('- supabaseHelpers:', !!window.supabaseHelpers)
  console.log('- isReady:', supabaseHelpers.isReady())
}

console.log('🚀 Enhanced Supabase configuration loaded')
console.log('📋 Test with: window.checkSupabase()')