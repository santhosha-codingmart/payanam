import re

with open('src/config/swagger.js', 'r') as f:
    content = f.read()

# FlightListResponse
flight_list_data = """data: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    _id: { type: "string" },
                                    operatorId: { type: "string" },
                                    operatorName: { type: "string" },
                                    airlineName: { type: "string" },
                                    registrationNumber: { type: "string" },
                                    manufacturer: { type: "string" },
                                    aircraftModel: { type: "string" },
                                    aircraftType: { type: "string" },
                                    totalSeats: { type: "integer" },
                                    cabinClasses: { type: "array", items: { type: "string" } },
                                    status: { type: "string" }
                                }
                            }
                        }"""
content = content.replace('data: { type: "array", items: { type: "object" } }', flight_list_data, 1)

# FlightRouteResponse
flight_route_data = """data: {
                            type: "object",
                            properties: {
                                _id: { type: "string" },
                                flightId: { type: "string" },
                                source: { $ref: "#/components/schemas/AirportItem" },
                                destination: { $ref: "#/components/schemas/AirportItem" },
                                stops: { type: "array", items: { $ref: "#/components/schemas/FlightStopItem" } },
                                distanceInKm: { type: "number" },
                                estimatedDurationInMinutes: { type: "integer" },
                                status: { type: "string", example: "ACTIVE" },
                                createdAt: { type: "string", format: "date-time" },
                                updatedAt: { type: "string", format: "date-time" }
                            }
                        }"""
content = content.replace('data: { type: "object" }', flight_route_data, 1)

# FlightRouteListResponse
flight_route_list_data = """data: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    _id: { type: "string" },
                                    flightId: { type: "string" },
                                    source: { $ref: "#/components/schemas/AirportItem" },
                                    destination: { $ref: "#/components/schemas/AirportItem" },
                                    stops: { type: "array", items: { $ref: "#/components/schemas/FlightStopItem" } },
                                    distanceInKm: { type: "number" },
                                    estimatedDurationInMinutes: { type: "integer" },
                                    status: { type: "string", example: "ACTIVE" }
                                }
                            }
                        }"""
content = content.replace('data: { type: "array", items: { type: "object" } }', flight_route_list_data, 1)

# FlightScheduleResponse
flight_schedule_data = """data: {
                            type: "object",
                            properties: {
                                _id: { type: "string" },
                                routeId: { type: "string" },
                                flightId: { type: "string" },
                                flightNumber: { type: "string" },
                                operatorId: { type: "string" },
                                departureDate: { type: "string", format: "date-time" },
                                arrivalDate: { type: "string", format: "date-time" },
                                departureTime: { type: "string" },
                                arrivalTime: { type: "string" },
                                baseFare: { type: "number" },
                                departureTerminal: { type: "string" },
                                arrivalTerminal: { type: "string" },
                                mealOptions: { type: "array", items: { type: "string" } },
                                cancellationPolicy: { type: "array", items: { $ref: "#/components/schemas/CancellationTier" } },
                                availableSeats: { type: "integer" },
                                status: { type: "string", example: "SCHEDULED" },
                                createdAt: { type: "string", format: "date-time" },
                                updatedAt: { type: "string", format: "date-time" }
                            }
                        }"""
content = content.replace('data: { type: "object" }', flight_schedule_data, 1)

with open('src/config/swagger.js', 'w') as f:
    f.write(content)
