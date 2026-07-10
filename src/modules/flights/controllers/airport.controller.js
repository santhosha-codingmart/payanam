import { searchAirports } from "../services/airport.service.js";

export const searchAirportsController = (req, res) => {
  try {
    const query = req.query.q || "";
    const results = searchAirports(query);
    return res.status(200).json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error("Airport search error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to search airports",
    });
  }
};
