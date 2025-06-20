// Netlify Function for Google Drive uploads
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
    // Clean and format the private key properly
    let privateKey = process.env.GOOGLE_DRIVE_PRIVATE_KEY;
    
    // Handle different private key formats
    if (privateKey.includes('\\n')) {
      privateKey = privateKey.replace(/\\n/g, '\n');
    }
    
    // Ensure proper line breaks
    if (!privateKey.includes('\n')) {
      privateKey = privateKey
        .replace('-----BEGIN PRIVATE KEY-----', '-----BEGIN PRIVATE KEY-----\n')
        .replace('-----END PRIVATE KEY-----', '\n-----END PRIVATE KEY-----');
    }

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

    const auth = new GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive.file']
    });

    const authClient = await auth.getClient();
    const accessToken = await authClient.getAccessToken();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        access_token: accessToken.token,
        expires_in: 3600
      })
    };

  } catch (error) {
    console.error('Token error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to get access token' })
    };
  }
}

// Handle file upload to Google Drive
async function handleUpload({ fileData, filename, username, mimeType }) {
  try {
    // Get access token
    const tokenResponse = await getAccessToken();
    if (tokenResponse.statusCode !== 200) {
      throw new Error('Failed to get access token');
    }

    const { access_token } = JSON.parse(tokenResponse.body);

    // Ensure user folder exists
    const userFolderId = await ensureUserFolder(username, access_token);

    // Upload file to Google Drive
    const uploadResult = await uploadToGoogleDrive({
      fileData,
      filename,
      mimeType,
      parentFolderId: userFolderId,
      accessToken: access_token
    });

    // Make file public
    await makeFilePublic(uploadResult.id, access_token);

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
    console.error('Upload error:', error);
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
    throw new Error(`Upload failed: ${response.status}`);
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