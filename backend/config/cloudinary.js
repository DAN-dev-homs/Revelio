// ============================================================
// REVELIO — Cloudinary Configuration
// ============================================================
const cloudinary = require('cloudinary').v2;

// Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

// Upload file to Cloudinary
async function uploadToCloudinary(filePath, folder = 'revelio') {
  try {
    // Detect if file is video based on extension
    const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
    const isVideo = videoExtensions.some(ext => filePath.toLowerCase().endsWith(ext));
    
    const uploadOptions = {
      folder: folder,
      resource_type: isVideo ? 'video' : 'auto',
      chunk_size: 6000000, // 6MB chunks for large files
      transformation: isVideo ? [] : [
        { quality: 'auto:good' },
        { fetch_format: 'auto' }
      ]
    };

    const result = isVideo
      ? await cloudinary.uploader.upload_large(filePath, uploadOptions)
      : await cloudinary.uploader.upload(filePath, uploadOptions);
    
    console.log('☁️ Cloudinary upload success:', result.secure_url);
    return result.secure_url;
  } catch (error) {
    console.error('❌ Cloudinary upload error:', error);
    throw error;
  }
}

// Delete file from Cloudinary
async function deleteFromCloudinary(publicUrl) {
  try {
    if (!publicUrl) return;
    
    // Extract public_id from URL
    const urlParts = publicUrl.split('/');
    const filename = urlParts[urlParts.length - 1];
    const publicId = `revelio/${filename.split('.')[0]}`;
    
    await cloudinary.uploader.destroy(publicId);
    console.log('🗑️ Cloudinary delete success:', publicId);
  } catch (error) {
    console.error('❌ Cloudinary delete error:', error);
    // Don't throw - deletion failure shouldn't block other operations
  }
}

module.exports = {
  cloudinary,
  uploadToCloudinary,
  deleteFromCloudinary
};
