import re

with open('src/config/swagger.js', 'r') as f:
    content = f.read()

# Add seatLayout to BusResponse
content = content.replace(
    'totalSeats: { type: "integer", example: 36 },\n                        busType: { type: "string", example: "AC_SLEEPER" },',
    'totalSeats: { type: "integer", example: 36 },\n                        busType: { type: "string", example: "AC_SLEEPER" },\n                                seatLayout: {\n                                    type: "array",\n                                    items: { $ref: "#/components/schemas/SeatLayoutItem" }\n                                },'
)

# Add seatLayout to FlightResponse
content = content.replace(
    'totalSeats: { type: "integer", example: 180 },\n                                status: { type: "string", example: "ACTIVE" },',
    'totalSeats: { type: "integer", example: 180 },\n                                seatLayout: {\n                                    type: "array",\n                                    items: { $ref: "#/components/schemas/FlightSeatLayoutItem" }\n                                },\n                                status: { type: "string", example: "ACTIVE" },'
)

with open('src/config/swagger.js', 'w') as f:
    f.write(content)

print("Responses patched successfully.")
