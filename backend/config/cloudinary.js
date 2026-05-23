// ============================================================
// REVELIO — Cloudinary Configuration
// ============================================================
const cloudinary = require('cloudinary').v2;

// Compression vidéo : max 1280px, H.264, qualité auto (réduit fortement les gros fichiers)
const VIDEO_EAGER_TRANSFORMATION = [
  {
    width: 1280,
    crop: 'limit',
    quality: 'auto:good',
    video_codec: 'h264',
    audio_codec: 'aac',
    fetch_format: 'mp4'
  }
];

// Chaîne pour les uploads signés depuis le navigateur (doit correspondre à VIDEO_EAGER_TRANSFORMATION)
const VIDEO_EAGER_STRING = 'w_1280,c_limit,q_auto:good,vc_h264,ac_aac,f_mp4';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
  timeout: 10 * 60 * 1000
});

function pickVideoUrl(result) {
  if (result?.eager?.length > 0 && result.eager[0].secure_url) {
    console.log('☁️ Vidéo compressée utilisée:', result.eager[0].bytes, 'octets (original:', result.bytes, ')');
    return result.eager[0].secure_url;
  }
  return result.secure_url;
}

async function uploadToCloudinary(filePath, folder = 'revelio') {
  try {
    const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
    const isVideo = videoExtensions.some(ext => filePath.toLowerCase().endsWith(ext));

    const uploadOptions = {
      folder,
      resource_type: isVideo ? 'video' : 'auto',
      chunk_size: 6000000
    };

    if (isVideo) {
      uploadOptions.eager = VIDEO_EAGER_TRANSFORMATION;
      uploadOptions.eager_async = false;
    } else {
      uploadOptions.transformation = [
        { quality: 'auto:good' },
        { fetch_format: 'auto' }
      ];
    }

    const result = isVideo
      ? await cloudinary.uploader.upload_large(filePath, uploadOptions)
      : await cloudinary.uploader.upload(filePath, uploadOptions);

    const url = isVideo ? pickVideoUrl(result) : result.secure_url;
    console.log('☁️ Cloudinary upload success:', url);
    return url;
  } catch (error) {
    console.error('❌ Cloudinary upload error:', error);
    throw error;
  }
}

async function deleteFromCloudinary(publicUrl) {
  try {
    if (!publicUrl) return;

    const isVideo = publicUrl.includes('/video/upload/');
    const match = publicUrl.match(/\/upload\/(?:v\d+\/)?(.+)\.\w+$/);
    const publicId = match?.[1];
    if (!publicId) return;

    await cloudinary.uploader.destroy(publicId, isVideo ? { resource_type: 'video' } : {});
    console.log('🗑️ Cloudinary delete success:', publicId);
  } catch (error) {
    console.error('❌ Cloudinary delete error:', error);
  }
}

module.exports = {
  cloudinary,
  uploadToCloudinary,
  deleteFromCloudinary,
  VIDEO_EAGER_STRING,
  pickVideoUrl
};
