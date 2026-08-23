import { auth } from './firebase';

// ⚠️ ضع رابط الـ Worker الحقيقي هنا بعد النشر
export const WORKER_URL = "https://ekhtsasi-upload.<your-subdomain>.workers.dev";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

// R2 Config
const ACCOUNT_ID = "27c3414283f515a8b9227c797020281f";
const ACCESS_KEY = "1aea7854d83695dd42dd0767654947e8";
const SECRET_KEY = "e0552a2d22c30ca79296e5d9772018a7d2634b209db99dda6f6befcfc3d3e648";
// Public Dev URL
export const R2_PUBLIC_URL = "https://pub-00890e85ceae4b9ea6d519704316ea6f.r2.dev";
// Bucket name will be inferred, Cloudflare R2 endpoint URL format:
const ENDPOINT = `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`;

export const s3Client = new S3Client({
  region: "auto",
  endpoint: ENDPOINT,
  credentials: {
    accessKeyId: ACCESS_KEY,
    secretAccessKey: SECRET_KEY,
  },
});

/**
 * Uploads a file to Cloudflare R2
 * @param {File} file 
 * @param {string} bucketName - the name of the R2 bucket (we need to ask the user or assume one)
 * @returns {Promise<string>} The public URL of the uploaded file
 */
export async function uploadToR2_old(file, bucketName = "ekhtsasi-light-files") {
  // Create a unique filename
  let extension = file.name.split('.').pop();
  if (!extension || extension === file.name) {
    extension = file.type.startsWith('image/') ? 'jpg' : 'pdf';
  }
  
  const uniqueFilename = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${extension}`;
  
  // Convert File to Uint8Array to avoid "getReader is not a function" error in browser
  const arrayBuffer = await file.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: uniqueFilename,
    Body: buffer,
    ContentType: file.type || (extension === 'pdf' ? 'application/pdf' : 'application/octet-stream'),
    ContentDisposition: "inline",
  });

  try {
    await s3Client.send(command);
    return `${R2_PUBLIC_URL}/${uniqueFilename}`;
  } catch (error) {
    console.error("Error uploading to R2:", error);
    throw error;
  }
}

/**
 * Deletes a file from Cloudflare R2
 * @param {string} fileUrl 
 * @param {string} bucketName 
 */
export async function deleteFromR2_old(fileUrl, bucketName = "ekhtsasi-light-files") {
  try {
    const filename = fileUrl.split('/').pop();
    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: filename,
    });
    await s3Client.send(command);
  } catch (error) {
    console.error("Error deleting from R2:", error);
    throw error;
  }
}

/**
 * Uploads a file to Cloudflare R2 using the new Cloudflare Worker
 * @param {File} file 
 * @param {string} bucketName - ignored in worker, but kept for signature compatibility
 * @returns {Promise<string>} The public URL of the uploaded file
 */
export async function uploadToR2(file, bucketName = "ekhtsasi-light-files") {
  if (!auth.currentUser) throw new Error("Must be logged in to upload");
  
  const idToken = await auth.currentUser.getIdToken();
  
  let extension = file.name.split('.').pop();
  if (!extension || extension === file.name) {
    extension = file.type.startsWith('image/') ? 'jpg' : 'pdf';
  }
  const uniqueFilename = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${extension}`;

  const arrayBuffer = await file.arrayBuffer();
  
  const response = await fetch(`${WORKER_URL}/upload?key=${uniqueFilename}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${idToken}`,
      "Content-Type": file.type || (extension === 'pdf' ? 'application/pdf' : 'application/octet-stream')
    },
    body: arrayBuffer
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || "Upload failed");
  }

  return `${R2_PUBLIC_URL}/${uniqueFilename}`;
}

/**
 * Deletes a file from Cloudflare R2 using the Cloudflare Worker
 * @param {string} fileUrl 
 * @param {string} bucketName 
 */
export async function deleteFromR2(fileUrl, bucketName = "ekhtsasi-light-files") {
  if (!auth.currentUser) throw new Error("Must be logged in to delete");
  
  const idToken = await auth.currentUser.getIdToken();
  const filename = fileUrl.split('/').pop();
  
  const response = await fetch(`${WORKER_URL}/delete?key=${filename}`, {
    method: "DELETE",
    headers: {
      "Authorization": `Bearer ${idToken}`
    }
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || "Delete failed");
  }
}
