import re

with open('src/config/swagger.js', 'r') as f:
    content = f.read()

# RouteResponse
route_data = """data: {
                            type: "object",
                            properties: {
                                _id: { type: "string" },
                                busId: { type: "string" },
                                source: { $ref: "#/components/schemas/LocationItem" },
                                destination: { $ref: "#/components/schemas/LocationItem" },
                                stops: { type: "array", items: { $ref: "#/components/schemas/StopItem" } },
                                distanceInKm: { type: "number" },
                                farePerKm: { type: "number" },
                                estimatedDurationInMinutes: { type: "integer" },
                                status: { type: "string", example: "ACTIVE" },
                                createdAt: { type: "string", format: "date-time" },
                                updatedAt: { type: "string", format: "date-time" }
                            }
                        }"""
content = content.replace('data: { type: "object" }', route_data, 1) # RouteResponse

# RouteListResponse
route_list_data = """data: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    _id: { type: "string" },
                                    busId: { type: "string" },
                                    source: { $ref: "#/components/schemas/LocationItem" },
                                    destination: { $ref: "#/components/schemas/LocationItem" },
                                    stops: { type: "array", items: { $ref: "#/components/schemas/StopItem" } },
                                    distanceInKm: { type: "number" },
                                    farePerKm: { type: "number" },
                                    estimatedDurationInMinutes: { type: "integer" },
                                    status: { type: "string", example: "ACTIVE" }
                                }
                            }
                        }"""
content = content.replace('data: { type: "array", items: { type: "object" } }', route_list_data, 1) # RouteListResponse


# ScheduleResponse
schedule_data = """data: {
                            type: "object",
                            properties: {
                                _id: { type: "string" },
                                routeId: { type: "string" },
                                busId: { type: "string" },
                                operatorId: { type: "string" },
                                departureDate: { type: "string", format: "date-time" },
                                arrivalDate: { type: "string", format: "date-time" },
                                departureTime: { type: "string" },
                                arrivalTime: { type: "string" },
                                baseFare: { type: "number" },
                                availableSeats: { type: "integer" },
                                boardingPoints: { type: "array", items: { $ref: "#/components/schemas/BoardingDroppingPoint" } },
                                droppingPoints: { type: "array", items: { $ref: "#/components/schemas/BoardingDroppingPoint" } },
                                cancellationPolicy: { type: "array", items: { $ref: "#/components/schemas/CancellationTier" } },
                                status: { type: "string", example: "SCHEDULED" },
                                createdAt: { type: "string", format: "date-time" },
                                updatedAt: { type: "string", format: "date-time" }
                            }
                        }"""
content = content.replace('data: { type: "object" }', schedule_data, 1) # ScheduleResponse


# ScheduleListResponse
schedule_list_data = """data: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    _id: { type: "string" },
                                    routeId: {
                                        type: "object",
                                        properties: {
                                            _id: { type: "string" },
                                            source: { $ref: "#/components/schemas/LocationItem" },
                                            destination: { $ref: "#/components/schemas/LocationItem" }
                                        }
                                    },
                                    busId: {
                                        type: "object",
                                        properties: {
                                            _id: { type: "string" },
                                            busName: { type: "string" },
                                            busNumber: { type: "string" },
                                            busType: { type: "string" }
                                        }
                                    },
                                    operatorId: { type: "string" },
                                    departureDate: { type: "string", format: "date-time" },
                                    arrivalDate: { type: "string", format: "date-time" },
                                    departureTime: { type: "string" },
                                    arrivalTime: { type: "string" },
                                    baseFare: { type: "number" },
                                    availableSeats: { type: "integer" },
                                    status: { type: "string", example: "SCHEDULED" }
                                }
                            }
                        }"""
content = content.replace('data: { type: "array", items: { type: "object" } }', schedule_list_data, 1) # ScheduleListResponse


with open('src/config/swagger.js', 'w') as f:
    f.write(content)

print("Batch 1 completed.")
