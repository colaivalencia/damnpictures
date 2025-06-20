// Fixed upload-to-drive.js with better permission handling
const crypto = require('crypto');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

exports.handler = async (event, context) => {
  console.log('=== FUNCTION CALLED ===');
  console.log('HTTP Method:', event.httpMethod);
  console.log('Body length:', event.body?.length);

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
    console.log('Parsing request body...');
    const { action, ...data } = JSON.parse(event.body);
    console.log('Action:', action);
    console.log('Data keys:', Object.keys(data));

    switch (action) {
      case 'upload':
        console.log('Processing upload for user:', data.username);
        return await handleUpload(data);
      case 'delete':
        console.log('Processing delete for file:', data.fileId);
        return await handleDelete(data.fileId);
      case 'get-token':
        console.log('Getting access token...');
        return await getAccessToken();
      default:
        console.error('Invalid action:', action);
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid action' })
        };
    }
  } catch (error) {
    console.error('=== FUNCTION ERROR ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Request body:', event.body?.substring(0, 200));
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: error.message,
        details: error.stack,
        timestamp: new Date().toISOString()
      })
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

// Handle upload with improved permissions
async function handleUpload({ fileData, filename, username, mimeType }) {
  try {
    console.log(`=== UPLOAD START FOR ${username} ===`);
    console.log('File:', filename, 'Size:', fileData?.length, 'Type:', mimeType);
    
    // Get access token
    console.log('Getting access token...');
    const tokenResponse = await getAccessToken();
    if (tokenResponse.statusCode !== 200) {
      const errorData = JSON.parse(tokenResponse.body);
      console.error('Token failed:', errorData);
      throw new Error(`Token error: ${errorData.error}`);
    }

    const { access_token } = JSON.parse(tokenResponse.body);
    console.log('Access token obtained successfully');
    
    // Ensure user folder exists
    console.log(`Creating/finding folder for: ${username}`);
    const userFolderId = await ensureUserFolder(username, access_token);
    console.log(`Folder ID obtained: ${userFolderId}`);
    
    // Upload file
    console.log('Starting file upload to Google Drive...');
    const uploadResult = await uploadToGoogleDrive({
      fileData,
      filename,
      mimeType,
      parentFolderId: userFolderId,
      accessToken: access_token
    });
    console.log('Upload result:', uploadResult);

    // CRITICAL: Make file publicly viewable
    console.log(`Making file ${uploadResult.id} publicly accessible...`);
    await makeFilePublic(uploadResult.id, access_token);
    console.log('File permissions updated successfully');

    // Use the most reliable URL format that works with public access
    const publicUrl = `https://lh3.googleusercontent.com/d/${uploadResult.id}=w2000-h2000-rw`;
    console.log(`=== SUCCESS FOR ${username} ===`);
    console.log('Public URL:', publicUrl);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        fileId: uploadResult.id,
        publicUrl,
        path: `${username}/${filename}`,
        success: true
      })
    };

  } catch (error) {
    console.error(`=== FAILED FOR ${username} ===`);
    console.error('Error details:', error);
    console.error('Error stack:', error.stack);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: error.message,
        username: username,
        timestamp: new Date().toISOString()
      })
    };
  }
}

// Handle file deletion
async function handleDelete(fileId) {
  try {
    console.log(`=== DELETE START FOR FILE ${fileId} ===`);
    
    // Get access token
    const tokenResponse = await getAccessToken();
    if (tokenResponse.statusCode !== 200) {
      const errorData = JSON.parse(tokenResponse.body);
      throw new Error(`Token error: ${errorData.error}`);
    }

    const { access_token } = JSON.parse(tokenResponse.body);
    
    // Delete the file
    const deleteResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${access_token}`
      }
    });

    if (!deleteResponse.ok) {
      const errorText = await deleteResponse.text();
      console.error('Delete failed:', errorText);
      throw new Error(`Delete failed: ${deleteResponse.status} - ${errorText}`);
    }

    console.log(`=== DELETE SUCCESS FOR FILE ${fileId} ===`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        fileId: fileId
      })
    };

  } catch (error) {
    console.error(`=== DELETE FAILED FOR FILE ${fileId} ===`);
    console.error('Error details:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: error.message,
        fileId: fileId
      })
    };
  }
}

// Ensure user folder exists with proper permissions
async function ensureUserFolder(username, accessToken) {
  const parentFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  console.log(`Searching for folder '${username}' in parent '${parentFolderId}'`);

  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='${username}' and parents in '${parentFolderId}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  
  const searchResponse = await fetch(searchUrl, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  if (!searchResponse.ok) {
    const errorText = await searchResponse.text();
    console.error('Folder search failed:', errorText);
    throw new Error(`Folder search failed: ${searchResponse.status}`);
  }

  const searchResult = await searchResponse.json();
  console.log('Folder search result:', searchResult);
  
  if (searchResult.files && searchResult.files.length > 0) {
    console.log(`Found existing folder: ${searchResult.files[0].id}`);
    return searchResult.files[0].id;
  }

  // Create new folder
  console.log(`Creating new folder for: ${username}`);
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
    const errorText = await folderResponse.text();
    console.error('Folder creation failed:', errorText);
    throw new Error(`Folder creation failed: ${folderResponse.status}`);
  }

  const newFolder = await folderResponse.json();
  console.log(`Created new folder: ${newFolder.id}`);
  
  // Make folder publicly viewable
  await makeFilePublic(newFolder.id, accessToken);
  
  return newFolder.id;
}

// Upload file to Google Drive
async function uploadToGoogleDrive({ fileData, filename, mimeType, parentFolderId, accessToken }) {
  console.log(`Uploading ${filename} to folder ${parentFolderId}`);
  
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
  console.log(`File buffer size: ${fileBuffer.length} bytes`);

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
    console.error('Upload failed:', errorText);
    throw new Error(`Upload failed: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  console.log(`Upload successful: ${result.id}`);
  return result;
}

// CRITICAL: Improved public permission setting
async function makeFilePublic(fileId, accessToken) {
  try {
    console.log(`Setting public permissions for file/folder ${fileId}...`);
    
    // First, set the file to be publicly readable
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
      console.error('Permission setting failed:', errorText);
      throw new Error(`Permission failed: ${permissionResponse.status} - ${errorText}`);
    }

    const permissionResult = await permissionResponse.json();
    console.log('Permission set result:', permissionResult);

    // Also update the file to ensure it's publicly viewable
    const updateResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,webViewLink,webContentLink`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        viewersCanCopyContent: true,
        writersCanShare: false,
        copyRequiresWriterPermission: false
      })
    });

    if (updateResponse.ok) {
      const updateResult = await updateResponse.json();
      console.log('File update result:', updateResult);
    }

    console.log('✅ File permissions set successfully');
    return true;

  } catch (error) {
    console.error('❌ Error setting file permissions:', error);
    throw error;
  }
}