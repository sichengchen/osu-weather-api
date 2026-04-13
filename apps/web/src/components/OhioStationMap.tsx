type OhioStationMapProps = {
  latitude: number | null | undefined;
  longitude: number | null | undefined;
};

const OHIO_POLYGON: Array<[number, number]> = [
  [-80.518598, 41.978802],
  [-80.518598, 40.636951],
  [-80.666475, 40.582182],
  [-80.595275, 40.472643],
  [-80.600752, 40.319289],
  [-80.737675, 40.078303],
  [-80.830783, 39.711348],
  [-81.219646, 39.388209],
  [-81.345616, 39.344393],
  [-81.455155, 39.410117],
  [-81.57017, 39.267716],
  [-81.685186, 39.273193],
  [-81.811156, 39.0815],
  [-81.783771, 38.966484],
  [-81.887833, 38.873376],
  [-82.03571, 39.026731],
  [-82.221926, 38.785745],
  [-82.172634, 38.632391],
  [-82.293127, 38.577622],
  [-82.331465, 38.446175],
  [-82.594358, 38.424267],
  [-82.731282, 38.561191],
  [-82.846298, 38.588575],
  [-82.890113, 38.758361],
  [-83.032514, 38.725499],
  [-83.142052, 38.626914],
  [-83.519961, 38.703591],
  [-83.678792, 38.632391],
  [-83.903347, 38.769315],
  [-84.215533, 38.807653],
  [-84.231963, 38.895284],
  [-84.43461, 39.103408],
  [-84.817996, 39.103408],
  [-84.801565, 40.500028],
  [-84.807042, 41.694001],
  [-83.454238, 41.732339],
  [-83.065375, 41.595416],
  [-82.933929, 41.513262],
  [-82.835344, 41.589939],
  [-82.616266, 41.431108],
  [-82.479343, 41.381815],
  [-82.013803, 41.513262],
  [-81.739956, 41.485877],
  [-81.444201, 41.672093],
  [-81.011523, 41.852832],
  [-80.518598, 41.978802]
];

const MAP_PADDING = 8;
const MAP_WIDTH = 100;
const LONGITUDE_SCALE = Math.cos((averageLatitude(OHIO_POLYGON) * Math.PI) / 180);
const RAW_MAP_POINTS = OHIO_POLYGON.map(([longitude, latitude]) => projectRawPoint(latitude, longitude));
const MAP_BOUNDS = getBounds(RAW_MAP_POINTS);
const MAP_SPAN_X = MAP_BOUNDS.maxX - MAP_BOUNDS.minX;
const MAP_SPAN_Y = MAP_BOUNDS.maxY - MAP_BOUNDS.minY;
const MAP_DRAWABLE_WIDTH = MAP_WIDTH - MAP_PADDING * 2;
const MAP_SCALE = MAP_DRAWABLE_WIDTH / MAP_SPAN_X;
const MAP_HEIGHT = MAP_SPAN_Y * MAP_SCALE + MAP_PADDING * 2;
const MAP_POINTS = RAW_MAP_POINTS.map(projectToCanvas);

export function OhioStationMap({ latitude, longitude }: OhioStationMapProps) {
  const marker = projectStation(latitude, longitude);

  return (
    <div className="ohio-map-shell" aria-hidden="true">
      <svg viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} className="ohio-map">
        <polygon className="ohio-map-shape" points={MAP_POINTS.map(({ x, y }) => `${x},${y}`).join(" ")} />
        {marker ? (
          <>
            <circle className="ohio-map-ping" cx={marker.x} cy={marker.y} r="6.5" />
            <circle className="ohio-map-marker" cx={marker.x} cy={marker.y} r="2.8" />
          </>
        ) : null}
      </svg>
    </div>
  );
}

function projectStation(latitude: number | null | undefined, longitude: number | null | undefined) {
  if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) {
    return null;
  }

  return projectPoint(latitude, longitude);
}

function projectPoint(latitude: number, longitude: number) {
  return projectToCanvas(projectRawPoint(latitude, longitude));
}

function projectRawPoint(latitude: number, longitude: number) {
  return {
    x: longitude * LONGITUDE_SCALE,
    y: -latitude
  };
}

function projectToCanvas(point: { x: number; y: number }) {
  return {
    x: MAP_PADDING + (point.x - MAP_BOUNDS.minX) * MAP_SCALE,
    y: MAP_PADDING + (point.y - MAP_BOUNDS.minY) * MAP_SCALE
  };
}

function getBounds(points: Array<{ x: number; y: number }>) {
  return points.reduce(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point.x),
      maxX: Math.max(bounds.maxX, point.x),
      minY: Math.min(bounds.minY, point.y),
      maxY: Math.max(bounds.maxY, point.y)
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY
    }
  );
}

function averageLatitude(points: Array<[number, number]>) {
  return points.reduce((sum, [, latitude]) => sum + latitude, 0) / points.length;
}
