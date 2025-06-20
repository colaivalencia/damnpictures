// Simplified Google Drive function using direct JWT creation
const crypto = require('crypto');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

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

// Create JWT manually to avoid the decoder issues
function createJWT() {
  const now = Math.floor(Date.now() / 1000);
  
  const header = {
    alg: 'RS256',
    typ: 'JWT'
  };

  const payload = {
    iss: process.env.GOOGLE_DRIVE_CLIENT_EMAIL,
    scope: 'https://www.googleapis.com/auth/drive.file',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  
  const signData = `${encodedHeader}.${encodedPayload}`;
  
  // Clean the private key
  let privateKey = process.env.GOOGLE_DRIVE_PRIVATE_KEY;
  
  // Handle the \n characters
  if (privateKey.includes('\\n')) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }
  
  console.log('Private key starts with:', privateKey.substring(0, 30));
  console.log('Private key ends with:', privateKey.substring(privateKey.length - 30));
  
  try {
    const signature = crypto.sign('RSA-SHA256', Buffer.from(signData), {
      key: privateKey,
      format: 'pem'
    });
    
    const encodedSignature = signature.toString('base64url');
    return `${signData}.${encodedSignature}`;
    
  } catch (signError) {
    console.error('Signing error:', signError);
    throw new Error(`JWT signing failed: ${signError.message}`);
  }
}

// Get access token using manual JWT
async function getAccessToken() {
  try {
    console.log('Creating JWT manually...');
    const jwt = createJWT();
    
    console.log('JWT created, requesting access token...');
    
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Token response error:', errorText);
      throw new Error(`Token request failed: ${response.status} - ${errorText}`);
    }

    const tokenData = await response.json();
    console.log('Access token obtained successfully');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        access_token: tokenData.access_token,
        expires_in: tokenData.expires_in || 3600
      })
    };

  } catch (error) {
    console.error('Token error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to get access token',
        details: error.message
      })
    };
  }
}

// Handle upload
async function handleUpload({ fileData, filename, username, mimeType }) {
  try {
    console.log(`Starting upload for ${filename}`);
    
    // Get access token
    const tokenResponse = await getAccessToken();
    if (tokenResponse.statusCode !== 200) {
      const errorData = JSON.parse(tokenResponse.body);
      throw new Error(`Token error: ${errorData.error}`);
    }

    const { access_token } = JSON.parse(tokenResponse.body);
    
    // Ensure user folder exists
    const userFolderId = await ensureUserFolder(username, access_token);
    
    // Upload file
    const uploadResult = await uploadToGoogleDrive({
      fileData,
      filename,
      mimeType,
      parentFolderId: userFolderId,
      accessToken: access_token
    });

    // Make file public
    await makeFilePublic(uploadResult.id, access_token);

    // Use the simple direct access format that works best
    const publicUrl = `https://drive.google.com/uc?export=view&id=${uploadResult.id}`;

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

// Ensure user folder exists
async function ensureUserFolder(username, accessToken) {
  const parentFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

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

// Make file publicly accessible with proper error handling
async function makeFilePublic(fileId, accessToken) {
  try {
    console.log(`Setting permissions for file ${fileId}...`);
    
    // Method 1: Set anyone can view permission
    const permissionResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
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

    const permissionResult = await permissionResponse.text();
    console.log('Permission response:', permissionResponse.status, permissionResult);

    if (!permissionResponse.ok) {
      console.error('Permission setting failed:', permissionResult);
      throw new Error(`Permission failed: ${permissionResponse.status} - ${permissionResult}`);
    }

    // Method 2: Also try to update file metadata to make it shareable
    const updateResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        copyRequiresWriterPermission: false,
        writersCanShare: true
      })
    });

    if (updateResponse.ok) {
      console.log('File metadata updated successfully');
    } else {
      console.warn('File metadata update failed, but permissions might still work');
    }

    // Method 3: Verify the permission was set
    const checkResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (checkResponse.ok) {
      const permissions = await checkResponse.json();
      console.log('Current permissions:', permissions);
      
      // Check if we have the 'anyone' permission
      const hasPublicPermission = permissions.permissions?.some(p => p.type === 'anyone');
      if (!hasPublicPermission) {
        throw new Error('Public permission not found after setting');
      }
    }

    console.log('✅ File permissions set successfully');
    return true;

  } catch (error) {
    console.error('❌ Error setting file permissions:', error);
    throw error;
  }
}