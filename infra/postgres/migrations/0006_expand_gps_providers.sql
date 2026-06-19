alter table gps_devices drop constraint if exists gps_devices_provider_check;

alter table gps_devices
  add constraint gps_devices_provider_check
  check (provider in (
    'traccar',
    'wialon',
    'navixy',
    'gpswox',
    'samsara',
    'geotab',
    'teltonika',
    'ruptela',
    'queclink',
    'concox',
    'motive',
    'fleet_complete',
    'webfleet',
    'verizon_connect',
    'api_webhook',
    'manual'
  ));
