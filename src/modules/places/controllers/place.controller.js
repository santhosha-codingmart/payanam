import { searchCities } from "../services/city.service.js";

export const searchPlaces = (req, res) => {
  try {
    const query = req.query.q || "";
    const results = searchCities(query);
    return res.status(200).json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error("Place search error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to search places",
    });
  }
};
