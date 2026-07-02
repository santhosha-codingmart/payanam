import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const s3Client = new S3Client({
    region: process.env.AWS_REGION || "ap-south-1",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    },
});

/**
 * Uploads a file buffer to S3 and returns the public URL.
 * @param {Buffer} fileBuffer - The file buffer
 * @param {string} originalName - Original filename
 * @param {string} mimetype - File mime type (e.g., image/jpeg)
 * @param {string} folder - S3 folder name (e.g., "hotels")
 * @returns {Promise<string>} - Public URL of the uploaded file
 */
export const uploadFileToS3 = async (fileBuffer, originalName, mimetype, folder = "uploads") => {
    // Generate a unique file name to avoid overwriting
    const ext = path.extname(originalName);
    const uniqueFileName = `${folder}/${uuidv4()}${ext}`;

    const params = {
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: uniqueFileName,
        Body: fileBuffer,
        ContentType: mimetype,
    };

    const command = new PutObjectCommand(params);
    await s3Client.send(command);

    // Return the public URL
    // Note: This assumes the bucket is public-read or you are serving through CloudFront
    return `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION || "ap-south-1"}.amazonaws.com/${uniqueFileName}`;
};

/**
 * Deletes a file from S3 given its full URL.
 * @param {string} fileUrl - The full S3 URL of the file
 */
export const deleteFileFromS3 = async (fileUrl) => {
    try {
        if (!fileUrl.includes("s3.") && !fileUrl.includes("amazonaws.com")) return;
        
        // Extract the key from the URL
        const urlParts = fileUrl.split(".com/");
        if (urlParts.length !== 2) return;
        
        const key = urlParts[1];

        const params = {
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            Key: key,
        };

        const command = new DeleteObjectCommand(params);
        await s3Client.send(command);
    } catch (error) {
        console.error("Failed to delete file from S3:", error);
    }
};
