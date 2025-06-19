// Supabase configuration
const SUPABASE_URL = 'https://yxsgedkyoosbauhydtlp.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4c2dlZGt5b29zYmF1aHlkdGxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAxOTIzMTQsImV4cCI6MjA2NTc2ODMxNH0.CBKJa4Q1K1goiQtc8huQcXMLF6OEwFJ3RLlNSixuHAA'

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Helper functions
const supabaseHelpers = {
  // Auth helpers
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

  // Photo helpers
  async uploadPhoto(file, username) {
    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}.${fileExt}`
    const filePath = `${username}/${fileName}`

    const { data, error } = await supabase.storage
      .from('photos')
      .upload(filePath, file)

    if (error) return { error }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('photos')
      .getPublicUrl(filePath)

    return { data: { ...data, publicUrl: urlData.publicUrl, filePath } }
  },

  async savePhotoMetadata(photoData, user) {
    const { data, error } = await supabase
      .from('photos')
      .insert({
        user_id: user.id,
        username: photoData.username,
        filename: photoData.filename,
        original_name: photoData.original_name,
        file_path: photoData.file_path,
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

  async deletePhoto(photoId, filePath) {
    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('photos')
      .remove([filePath])

    if (storageError) return { error: storageError }

    // Delete from database
    const { error: dbError } = await supabase
      .from('photos')
      .delete()
      .eq('id', photoId)

    return { error: dbError }
  }
}

// Make available globally
window.supabaseHelpers = supabaseHelpers