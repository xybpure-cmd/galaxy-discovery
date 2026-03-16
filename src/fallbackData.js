export function buildFallbackStars(count = 60) {
  return Array.from({ length: count }, (_, i) => ({
    id: `GD-${String(i + 1).padStart(3, '0')}`,
    x: 8 + ((i * 37) % 84),
    y: 10 + ((i * 19) % 78),
    brightness: (10.2 + (i % 20) * 0.2).toFixed(1),
    temperature: 4700 + (i % 10) * 170,
    radius: (0.7 + (i % 7) * 0.13).toFixed(2),
    signalStrength: 20 + (i % 75),
    candidateUsers: 0,
    discoveryConfirmed: false,
    userClassification: null,
    userNote: '',
  }));
}
