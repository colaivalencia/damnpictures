// Netlify Function for Google Drive uploads with improved private key handling
const { GoogleAuth } = require('google-auth-library');

// CORS headers for browser requests
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

exports.handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { action, ...data } = JSON.parse(event.body);

    switch (action) {
      case 'upload':
        return await handleUpload(data);
      case 'delete':
        return await handleDelete(data);
      case 'get-token':
        return await getAccessToken();
      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid action' })
        };
    }

  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};

// Get Google Drive access token using service account
async function getAccessToken() {
  try {
    console.log('Getting access token...');
    
    // Get and clean the private key
    let privateKey = process.env.GOOGLE_DRIVE_PRIVATE_KEY;
    
    if (!privateKey) {
      throw new Error('GOOGLE_DRIVE_PRIVATE_KEY environment variable not set');
    }
    
    // Handle different private key formats
    if (privateKey.includes('\\n')) {
      console.log('Converting \\n to actual newlines');
      privateKey = privateKey.replace(/\\n/g, '\n');
    }
    
    // Ensure proper formatting
    if (!privateKey.startsWith('-----BEGIN PRIVATE KEY-----')) {
      throw new Error('Private key does not start with BEGIN PRIVATE KEY');
    }
    
    if (!privateKey.endsWith('-----END PRIVATE KEY-----') && !privateKey.endsWith('-----END PRIVATE KEY-----\n')) {
      throw new Error('Private key does not end with END PRIVATE KEY');
    }

    console.log('Private key format looks correct');
    console.log('Private key length:', privateKey.length);
    console.log('Private key starts with:', privateKey.substring(0, 50));
    console.log('Private key ends with:', privateKey.substring(privateKey.length - 50));

    const credentials = {
      type: 'service_account',
      project_id: process.env.GOOGLE_DRIVE_PROJECT_ID,
      private_key_id: '',
      private_key: privateKey,
      client_email: process.env.GOOGLE_DRIVE_CLIENT_EMAIL,
      client_id: '',
      auth_uri: 'https://accounts.google.com/o/oauth2/auth',
      token_uri: 'https://oauth2.googleapis.com/token',
      auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs'
    };

    console.log('Creating GoogleAuth with credentials...');
    console.log('Project ID:', credentials.project_id);
    console.log('Client Email:', credentials.client_email);

    const auth = new GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive.file']
    });

    console.log('Getting auth client...');
    const authClient = await auth.getClient();
    
    console.log('Getting access token...');
    const accessToken = await authClient.getAccessToken();

    console.log('Access token obtained successfully');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        access_token: accessToken.token,
        expires_in: 3600
      })
    };

  } catch (error) {
    console.error('Token error details:', error);
    console.error('Error stack:', error.stack);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to get access token',
        details: error.message,
        type: error.constructor.name
      })
    };
  }
}

// Handle file upload to Google Drive
async function handleUpload({ fileData, filename, username, mimeType }) {
  try {
    console.log(`Starting upload process for ${filename}`);
    
    // Get access token
    const tokenResponse = await getAccessToken();
    if (tokenResponse.statusCode !== 200) {
      const errorData = JSON.parse(tokenResponse.body);
      throw new Error(`Token error: ${errorData.error} - ${errorData.details}`);
    }

    const { access_token } = JSON.parse(tokenResponse.body);
    console.log('Access token obtained for upload');

    // Ensure user folder exists
    const userFolderId = await ensureUserFolder(username, access_token);
    console.log('User folder ID:', userFolderId);

    // Upload file to Google Drive
    const uploadResult = await uploadToGoogleDrive({
      fileData,
      filename,
      mimeType,
      parentFolderId: userFolderId,
      accessToken: access_token
    });

    console.log('File uploaded to Drive:', uploadResult.id);

    // Make file public
    await makeFilePublic(uploadResult.id, access_token);
    console.log('File made public');

    const publicUrl = `https://drive.google.com/uc?id=${uploadResult.id}`;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        fileId: uploadResult.id,
        publicUrl,
        path: `${username}/${filename}`
      })
    };

  } catch (error) {
    console.error('Upload error details:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
}

// Handle file deletion from Google Drive
async function handleDelete({ fileId }) {
  try {
    const tokenResponse = await getAccessToken();
    if (tokenResponse.statusCode !== 200) {
      throw new Error('Failed to get access token');
    }

    const { access_token } = JSON.parse(tokenResponse.body);

    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${access_token}`
      }
    });

    return {
      statusCode: response.ok ? 200 : 500,
      headers,
      body: JSON.stringify({ 
        success: response.ok,
        message: response.ok ? 'File deleted' : 'Delete failed'
      })
    };

  } catch (error) {
    console.error('Delete error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
}

// Ensure user folder exists in Google Drive
async function ensureUserFolder(username, accessToken) {
  const parentFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  // Search for existing folder
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='${username}' and parents in '${parentFolderId}' and mimeType='application/vnd.google-apps.folder'`;
  
  const searchResponse = await fetch(searchUrl, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

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

  const newFolder = await folderResponse.json();
  return newFolder.id;
}

// Upload file to Google Drive
async function uploadToGoogleDrive({ fileData, filename, mimeType, parentFolderId, accessToken }) {
  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const close_delim = `\r\n--${boundary}--`;

  const metadata = {
    name: `${Date.now()}_${filename}`,
    parents: [parentFolderId]
  };

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    `Content-Type: ${mimeType}\r\n\r\n`;

  // Convert base64 to buffer
  const fileBuffer = Buffer.from(fileData, 'base64');

  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary="${boundary}"`
    },
    body: Buffer.concat([
      Buffer.from(multipartRequestBody),
      fileBuffer,
      Buffer.from(close_delim)
    ])
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Upload failed: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

// Make file publicly accessible
async function makeFilePublic(fileId, accessToken) {
  await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      role: 'reader',
      type: 'anyone'
    })
  });
}