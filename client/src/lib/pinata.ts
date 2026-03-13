export async function uploadToIPFS(metadata: any): Promise<string> {
  const PINATA_JWT = import.meta.env.VITE_PINATA_JWT;

  console.log("PINATA_JWT available:", !!PINATA_JWT);
  console.log("Environment variables:", {
    VITE_PINATA_JWT: !!import.meta.env.VITE_PINATA_JWT,
    VITE_PINATA_API_KEY: !!import.meta.env.VITE_PINATA_API_KEY,
    VITE_NEXT_PUBLIC_GATEWAY_URL: !!import.meta.env.VITE_NEXT_PUBLIC_GATEWAY_URL
  });

  if (!PINATA_JWT) {
    throw new Error("PINATA_JWT not configured. Please ensure VITE_PINATA_JWT is set in your environment variables and accessible to the client.");
  }

  try {
    const response = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${PINATA_JWT}`,
      },
      body: JSON.stringify({
        pinataContent: metadata,
        pinataMetadata: {
          name: `${metadata.title || 'coin'}-metadata`,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Pinata upload failed: ${response.statusText} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    
    // Use ipfs:// protocol for Zora contract compatibility
    // The Zora contract expects native IPFS URIs, not HTTP gateway URLs
    return `ipfs://${data.IpfsHash}`;
  } catch (error) {
    console.error("IPFS upload error:", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to upload metadata to IPFS");
  }
}

export async function uploadToPinata(file: File): Promise<string> {
  const PINATA_JWT = import.meta.env.VITE_PINATA_JWT;

  if (!PINATA_JWT) {
    throw new Error("PINATA_JWT not configured");
  }

  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('pinataMetadata', JSON.stringify({
      name: file.name,
    }));

    const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PINATA_JWT}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Pinata file upload failed: ${response.statusText} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    return data.IpfsHash;
  } catch (error) {
    console.error("Pinata file upload error:", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to upload file to Pinata");
  }
}