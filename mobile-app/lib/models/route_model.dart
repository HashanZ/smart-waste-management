// Route model for type safety
class RouteModel {
  final String id;
  final String name;
  final List<BinModel> bins;
  final DateTime? scheduledDate;

  RouteModel({
    required this.id,
    required this.name,
    required this.bins,
    this.scheduledDate,
  });

  factory RouteModel.fromJson(Map<String, dynamic> json) {
    return RouteModel(
      id: json['_id'] ?? '',
      name: json['name'] ?? 'Route',
      bins: (json['bins'] as List? ?? [])
          .map((b) => BinModel.fromJson(b))
          .toList(),
      scheduledDate: json['scheduledDate'] != null
          ? DateTime.parse(json['scheduledDate'])
          : null,
    );
  }
}

class BinModel {
  final String id;
  final String binId;
  final double fillLevel;
  final double latitude;
  final double longitude;
  final String? address;
  final bool isCollected;
  final DateTime? collectedAt;

  BinModel({
    required this.id,
    required this.binId,
    required this.fillLevel,
    required this.latitude,
    required this.longitude,
    this.address,
    this.isCollected = false,
    this.collectedAt,
  });

  factory BinModel.fromJson(Map<String, dynamic> json) {
    final location = json['location'] ?? {};
    return BinModel(
      id: json['_id'] ?? json['binId'] ?? '',
      binId: json['binId'] ?? '',
      fillLevel: (json['currentLevel'] ?? 0).toDouble(),
      latitude: (location['latitude'] ?? 0).toDouble(),
      longitude: (location['longitude'] ?? 0).toDouble(),
      address: location['address'],
      isCollected: json['collected'] == true,
      collectedAt: json['collectedAt'] != null
          ? DateTime.parse(json['collectedAt'])
          : null,
    );
  }
}








