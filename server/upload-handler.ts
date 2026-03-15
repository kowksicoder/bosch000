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
    multiples: true,
  });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error("File parse error:", err);
      return res.status(400).json({ error: "Failed to parse file upload" });
    }

    const fileField = (files as any).files ?? (files as any).file;
    const uploadFiles = Array.isArray(fileField)
      ? fileField
      : fileField
        ? [fileField]
        : [];

    if (!uploadFiles.length) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    try {
      const getFieldValue = (field: any): string => {
        if (Array.isArray(field)) return field[0] || '';
        return field || '';
      };

      const title = getFieldValue(fields.title) || `upload-${Date.now()}`;
      const description = getFieldValue(fields.description) || '';
      const author = getFieldValue(fields.author) || '';

      const mediaItems: Array<{
        url: string;
        type: string;
        name: string;
        mimeType: string;
      }> = [];

      for (const file of uploadFiles) {
        if (!file) continue;
        let fileBuffer = fs.readFileSync(file.filepath);
        const fileName = file.originalFilename || `upload-${Date.now()}`;
        let fileMimeType = file.mimetype || 'application/octet-stream';

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
            fileMimeType = 'image/jpeg';
          } catch (compressionError) {
            console.warn('Image compression failed, using original:', compressionError);
          }
        }

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

        mediaItems.push({
          url,
          type: fileMimeType.split('/')[0] || 'file',
          name: fileName,
          mimeType: fileMimeType,
        });

        try {
          fs.unlinkSync(file.filepath);
        } catch {}
      }

      const primaryImage = mediaItems.find((item) => item.type === 'image')?.url || '';
      const primaryAnimation = mediaItems.find((item) => item.type === 'video' || item.type === 'audio')?.url;
      const primaryType = mediaItems[0]?.type || 'file';
      const primaryUrl = primaryImage || primaryAnimation || mediaItems[0]?.url || '';

      const uploadData = {
        url: primaryUrl,
        title,
        description,
        image: primaryImage,
        animation_url: primaryAnimation,
        author,
        publishDate: new Date().toISOString(),
        content: description,
        platform: 'upload',
        type: primaryType,
        metadata: {
          media: mediaItems,
          isCarousel: mediaItems.length > 1,
        },
      };

      console.log('Sending upload response:', { uploadData });

      res.json({
        success: true,
        uploadData,
      });
    } catch (error) {
      console.error("Upload error:", error);

      // Clean up temp files on error
      uploadFiles.forEach((file) => {
        try {
          if (file?.filepath) fs.unlinkSync(file.filepath);
        } catch {}
      });

      res.status(500).json({
        error: "Failed to upload file to IPFS",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });
}
