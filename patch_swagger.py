import re

with open('src/config/swagger.js', 'r') as f:
    content = f.read()

# UpdateBusRequest
content = content.replace(
    'busName: { type: "string", example: "KPN Volvo 9600" },',
    'operatorName: { type: "string", example: "KPN Travels" },\n                        busName: { type: "string", example: "KPN Volvo 9600" },'
)
content = content.replace(
    'busType: {',
    'seatLayoutType: { type: "string", enum: ["2+1_SLEEPER", "2+2_SEATER", "1+1_SLEEPER", "2+1_SEATER"] },\n                        totalSeats: { type: "integer", example: 36 },\n                        busType: {'
)
content = content.replace(
    'status: { type: "string", enum: ["ACTIVE", "INACTIVE", "MAINTENANCE"], example: "ACTIVE" },',
    'isActive: { type: "boolean", example: true },\n                        status: { type: "string", enum: ["ACTIVE", "INACTIVE", "MAINTENANCE", "RETIRED"], example: "ACTIVE" },'
)

# CreateFlightRequest
content = content.replace(
    'totalSeats: { type: "integer", example: 180 },',
    'totalSeats: { type: "integer", example: 180 },\n                        economySeats: { type: "integer", example: 180 },\n                        premiumEconomySeats: { type: "integer", example: 0 },\n                        businessSeats: { type: "integer", example: 0 },\n                        firstClassSeats: { type: "integer", example: 0 },\n                        amenities: { type: "array", items: { type: "string" } },'
)

# UpdateFlightRequest
content = content.replace(
    'airlineName: { type: "string", example: "IndiGo Express" },',
    'operatorName: { type: "string", example: "IndiGo Airlines" },\n                        airlineName: { type: "string", example: "IndiGo Express" },'
)
content = content.replace(
    'cabinClasses: {',
    'totalSeats: { type: "integer", example: 180 },\n                        cabinClasses: {'
)

# CreateScheduleRequest
content = content.replace(
    'departureDate: { type: "string", example: "2026-06-25", description: "YYYY-MM-DD" },',
    'departureDate: { type: "string", example: "2026-06-25", description: "YYYY-MM-DD" },\n                        arrivalDate: { type: "string", example: "2026-06-26", description: "YYYY-MM-DD" },'
)

# CreateFlightScheduleRequest
content = content.replace(
    'departureDate: { type: "string", example: "2026-10-15", description: "YYYY-MM-DD" },',
    'departureDate: { type: "string", example: "2026-10-15", description: "YYYY-MM-DD" },\n                        arrivalDate: { type: "string", example: "2026-10-15", description: "YYYY-MM-DD" },'
)


with open('src/config/swagger.js', 'w') as f:
    f.write(content)

print("swagger.js patched successfully.")
