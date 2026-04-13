import type { StationCurrent } from "@osu-weather/shared";

import type { UnitSystem } from "../lib/units";
import { getDisplayStationName, sortStations } from "../lib/stations";
import { formatRain24h, formatTemperature, formatWindSpeed } from "../lib/units";

type StationTableProps = {
  stations: StationCurrent[];
  selectedStationId: string | null;
  search: string;
  unitSystem: UnitSystem;
  onSearchChange: (value: string) => void;
  onSelect: (stationId: string) => void;
};

export function StationTable({
  stations,
  selectedStationId,
  search,
  unitSystem,
  onSearchChange,
  onSelect
}: StationTableProps) {
  const needle = search.trim().toLowerCase();
  const filteredStations = sortStations(
    stations.filter((station) => {
      if (!needle) {
        return true;
      }

      return [
        station.stationId,
        station.stationName,
        station.county,
        station.location,
        station.networkId
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    })
  );

  return (
    <section className="explorer-shell">
      <div className="explorer-topline">
        <div>
          <p>Stations</p>
          <span>{filteredStations.length} visible stations</span>
        </div>
        <label className="search-shell">
          <span className="sr-only">Search stations</span>
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search county, station, network"
          />
        </label>
      </div>

      <div className="explorer-list" role="list">
        {filteredStations.map((station) => {
          const active = station.stationId === selectedStationId;

          return (
            <button
              key={station.stationId}
              type="button"
              role="listitem"
              className={`explorer-row ${active ? "is-active" : ""}`}
              onClick={() => onSelect(station.stationId)}
            >
              <div className="explorer-row-main">
                <div className="explorer-row-id">{station.stationId}</div>
                <div>
                  <h3>{getDisplayStationName(station)}</h3>
                  <p>
                    {station.county} County · {station.networkId}
                  </p>
                </div>
              </div>
              <dl className="explorer-metrics">
                <div>
                  <dt>Temp</dt>
                  <dd>{formatTemperature(station.conditions, unitSystem)}</dd>
                </div>
                <div>
                  <dt>Wind</dt>
                  <dd>{formatWindSpeed(station.conditions, unitSystem)}</dd>
                </div>
                <div>
                  <dt>24h Rain</dt>
                  <dd>{formatRain24h(station.conditions, unitSystem)}</dd>
                </div>
              </dl>
            </button>
          );
        })}
      </div>
    </section>
  );
}
