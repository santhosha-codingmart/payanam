import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
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

export const uploadFileToS3 = async (
  fileBuffer,
  originalName,
  mimetype,
  folder = "uploads",
) => {
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
  return `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION || "ap-south-1"}.amazonaws.com/${uniqueFileName}`;
};

export const deleteFileFromS3 = async (fileUrl) => {
  try {
    if (!fileUrl.includes("s3.") && !fileUrl.includes("amazonaws.com")) return;
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
