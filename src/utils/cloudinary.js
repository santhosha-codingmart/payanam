import { v2 as cloudinary } from "cloudinary";

function getCloudinary() {
  if (!cloudinary.config().cloud_name) {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    console.log("[Cloudinary] Environment variables:");
    console.log("  CLOUDINARY_CLOUD_NAME:", cloudName);
    console.log(
      "  CLOUDINARY_API_KEY:",
      apiKey ? apiKey.substring(0, 8) + "..." : "MISSING",
    );
    console.log(
      "  CLOUDINARY_API_SECRET:",
      apiSecret
        ? apiSecret.substring(0, 8) +
            "..." +
            " (length: " +
            apiSecret.length +
            ")"
        : "MISSING",
    );
    if (!cloudName || !apiKey || !apiSecret) {
      console.error("[Cloudinary] ERROR: Missing credentials");
      throw new Error(
        "Cloudinary credentials are missing from environment variables",
      );
    }
    console.log(
      "[Cloudinary] API Secret length:",
      apiSecret.length,
      "characters",
    );
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
      timeout: 30000,
    });
    console.log("[Cloudinary] Configuration applied successfully");
    console.log("  cloud_name:", cloudinary.config().cloud_name);
    console.log("  api_key set:", cloudinary.config().api_key ? "YES" : "NO");
    console.log(
      "  api_secret set:",
      cloudinary.config().api_secret ? "YES" : "NO",
    );
  }
  return cloudinary;
}

export const uploadToCloudinary = async (file, folder = "users/profile") => {
  try {
    const cld = getCloudinary();
    const uploadOptions = {
      folder: folder,
      resource_type: "auto",
    };
    if (file && file.mimetype && file.mimetype.startsWith("image/")) {
      uploadOptions.transformation = [
        {
          width: 500,
          height: 500,
          crop: "fill",
          gravity: "face",
        },
        {
          quality: "auto",
          fetch_format: "auto",
        },
      ];
    }
    if (file && file.buffer && Buffer.isBuffer(file.buffer)) {
      const buffer = file.buffer;
      const mimeType = file.mimetype || file.type || "image/jpeg";
      uploadOptions.resource_type = mimeType.startsWith("video/")
        ? "video"
        : "image";
      const base64 = buffer.toString("base64");
      const dataUrl = `data:${mimeType};base64,${base64}`;
      const result = await cld.uploader.upload(dataUrl, uploadOptions);
      return {
        success: true,
        url: result.secure_url,
        public_id: result.public_id,
      };
    } else if (Buffer.isBuffer(file)) {
      const base64 = file.toString("base64");
      const dataUrl = `data:image/jpeg;base64,${base64}`;
      const result = await cld.uploader.upload(dataUrl, uploadOptions);
      return {
        success: true,
        url: result.secure_url,
        public_id: result.public_id,
      };
    } else if (typeof file === "string") {
      const result = await cld.uploader.upload(file, uploadOptions);
      return {
        success: true,
        url: result.secure_url,
        public_id: result.public_id,
      };
    } else {
      throw new Error("Unsupported file type for upload");
    }
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    console.error("Error details:", {
      message: error.message,
      http_code: error.http_code,
      body: error.body,
      name: error.name,
      stack: error.stack,
    });
    return {
      success: false,
      error: error.message || "Failed to upload to Cloudinary",
      details: error.http_code ? `HTTP ${error.http_code}` : undefined,
    };
  }
};

export const deleteFromCloudinary = async (publicId) => {
  try {
    const cld = getCloudinary();
    const result = await cld.uploader.destroy(publicId);
    return {
      success: true,
      result,
    };
  } catch (error) {
    console.error("Cloudinary delete error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};
