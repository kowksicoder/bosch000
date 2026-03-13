import { Request, Response } from "express";
import formidable from "formidable";
import fs from "fs";
import path from "path";
import sharp from 'sharp';

const PINATA_JWT = process.env.VITE_PINATA_JWT;
const PINATA_API_KEY = process.env.VITE_PINATA_API_KEY;
const PINATA_SECRET_KEY = process.env.VITE_PINATA_SECRET_KEY;

export async function handleFileUpload(req: Request, res: Response) {
  if (!PINATA_JWT && (!PINATA_API_KEY || !PINATA_SECRET_KEY)) {
    return res.status(500).json({
      error: "Pinata credentials not configured"
    });
  }

  const form = formidable({
    maxFileSize: 100 * 1024 * 1024, // 100MB
    keepExtensions: true,
  });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error("File parse error:", err);
      return res.status(400).json({ error: "Failed to parse file upload" });
    }

    const file = Array.isArray(files.file) ? files.file[0] : files.file;

    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    try {
      // Read file
      let fileBuffer = fs.readFileSync(file.filepath);
      const fileName = file.originalFilename || `upload-${Date.now()}`;
      let fileMimeType = file.mimetype || 'application/octet-stream';

      // Compress images aggressively before upload
      if (fileMimeType.startsWith('image/') && fileBuffer.length > 500 * 1024) {
        try {
          const compressedBuffer = await sharp(fileBuffer)
            .resize(1920, 1920, {
              fit: 'inside',
              withoutEnlargement: true
            })
            .jpeg({
              quality: 80,
              progressive: true
            })
            .toBuffer();

          fileBuffer = compressedBuffer;
          fileMimeType = 'image/jpeg'; // Ensure mimetype is updated after compression
        } catch (compressionError) {
          console.warn('Image compression failed, using original:', compressionError);
          // If compression fails, we continue with the original buffer and mimetype
        }
      }


      // Upload to Pinata
      const formData = new FormData();
      const blob = new Blob([fileBuffer], { type: fileMimeType });
      formData.append('file', blob, fileName);

      const pinataMetadata = JSON.stringify({
        name: fileName,
      });
      formData.append('pinataMetadata', pinataMetadata);

      const uploadResponse = await fetch(
        'https://api.pinata.cloud/pinning/pinFileToIPFS',
        {
          method: 'POST',
          headers: PINATA_JWT
            ? { 'Authorization': `Bearer ${PINATA_JWT}` }
            : {
                'pinata_api_key': PINATA_API_KEY!,
                'pinata_secret_api_key': PINATA_SECRET_KEY!,
              },
          body: formData,
        }
      );

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error("Pinata upload error:", errorText);
        throw new Error(`Pinata upload failed: ${errorText}`);
      }

      const result = await uploadResponse.json();
      const ipfsHash = result.IpfsHash;
      const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || 'https://gateway.pinata.cloud';
      const url = `${gatewayUrl}/ipfs/${ipfsHash}`;

      // Clean up temp file
      fs.unlinkSync(file.filepath);

      // Get user-provided metadata (formidable can return arrays or strings)
      const getFieldValue = (field: any): string => {
        if (Array.isArray(field)) return field[0] || '';
        return field || '';
      };

      const title = getFieldValue(fields.title) || fileName;
      const description = getFieldValue(fields.description) || '';
      const author = getFieldValue(fields.author) || '';
      const fileType = fileMimeType.split('/')[0] || 'file';

      // Return upload data directly - no scraping needed for uploads
      // For video/audio files, set animation_url per EIP-7572 standard
      const isVideo = fileMimeType.startsWith('video/');
      const isAudio = fileMimeType.startsWith('audio/');
      const isImage = fileMimeType.startsWith('image/');

      const uploadData = {
        url: url,
        title: title,
        description: description,
        image: isImage ? url : '', // Default to empty if not an image
        animation_url: (isVideo || isAudio) ? url : undefined,
        author: author,
        publishDate: new Date().toISOString(),
        content: description,
        platform: 'upload',
        type: fileType,
      };

      console.log('Sending upload response:', { ipfsHash, url, uploadData });

      res.json({
        success: true,
        ipfsHash,
        url,
        fileName,
        uploadData,
      });
    } catch (error) {
      console.error("Upload error:", error);

      // Clean up temp file on error
      try {
        fs.unlinkSync(file.filepath);
      } catch {}

      res.status(500).json({
        error: "Failed to upload file to IPFS",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });
}