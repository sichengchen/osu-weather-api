CREATE TABLE IF NOT EXISTS weather_history (
  station_id TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  observed_at_display TEXT NOT NULL,
  air_temp_c REAL,
  air_temp_f REAL,
  dew_point_c REAL,
  dew_point_f REAL,
  humidity_percent REAL,
  pressure_hpa REAL,
  pressure_in_hg REAL,
  wind_speed_mps REAL,
  wind_speed_mph REAL,
  wind_gust_mps REAL,
  wind_gust_mph REAL,
  precipitation_day_mm REAL,
  precipitation_day_in REAL,
  precipitation_24h_mm REAL,
  precipitation_24h_in REAL,
  solar_radiation_wm2 REAL,
  soil_temp_c REAL,
  soil_temp_f REAL,
  soil_moisture_percent REAL,
  source TEXT NOT NULL,
  PRIMARY KEY (station_id, captured_at)
);

CREATE INDEX IF NOT EXISTS idx_weather_history_station_observed_at
  ON weather_history (station_id, observed_at);

CREATE INDEX IF NOT EXISTS idx_weather_history_source_captured_at
  ON weather_history (source, captured_at DESC);
