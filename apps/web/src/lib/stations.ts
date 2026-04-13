import type { StationCurrent } from "@osu-weather/shared";

export function getDisplayStationName(station: StationCurrent | null | undefined): string {
  if (!station) {
    return "Loading station";
  }

  const suffix = ` - ${station.county} County`;

  if (station.stationName.endsWith(suffix)) {
    return station.stationName.slice(0, -suffix.length);
  }

  return station.stationName;
}

export function sortStations(stations: StationCurrent[]): StationCurrent[] {
  return [...stations].sort((left, right) => {
    const leftCountyPriority = left.county === "Franklin" ? 0 : 1;
    const rightCountyPriority = right.county === "Franklin" ? 0 : 1;

    if (leftCountyPriority !== rightCountyPriority) {
      return leftCountyPriority - rightCountyPriority;
    }

    const countyComparison = left.county.localeCompare(right.county);

    if (countyComparison !== 0) {
      return countyComparison;
    }

    const nameComparison = getDisplayStationName(left).localeCompare(getDisplayStationName(right));

    if (nameComparison !== 0) {
      return nameComparison;
    }

    return left.stationId.localeCompare(right.stationId);
  });
}
