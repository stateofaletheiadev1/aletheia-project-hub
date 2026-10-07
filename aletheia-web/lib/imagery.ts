/**
 * Curated photographic library for the Aletheia platform.
 *
 * Every ID below has been verified to resolve on images.unsplash.com and
 * reviewed for suitability: no identifiable public figures, no foreign
 * national flags or banknotes, and no recognisable foreign skylines that
 * could be mistaken for Aletheian territory. Licences: see
 * docs/brand/IMAGE-LICENSES.md (Unsplash Licence — free commercial use).
 */

export const PHOTOS = {
  // Maritime & coast
  oceanWave: '1559827260-dc66d52bef19',
  oceanAerial: '1505118380757-91f5f5632de0',
  coastSunrise: '1507525428034-b723cf961d3e',
  containerPort: '1494412574643-ff11b0a5c1c3',
  containerShip: '1605745341112-85968b19335b',
  logisticsHall: '1586528116311-ad8dd3c8310d',
  coastalVillage: '1516483638261-f4dbaf036963',

  // Landscape & territory
  highlands: '1470071459604-3b5ec3a7fe05',
  mistyValley: '1469474968028-56623f02e42e',
  alpineRange: '1464822759023-fed622ff2c3b',
  cloudSummit: '1506905925346-21bda4d32df4',
  forestPath: '1441974231531-c6227db76b6e',
  alpineLake: '1501785888041-af3ef285b470',
  europeanTown: '1467269204594-9661b134dd2b',

  // Energy
  offshoreWind: '1548337138-e87d889cc369',
  windSunset: '1466611653911-95081537e5b7',
  windMeadow: '1532601224476-15c79f2f7a51',
  solarField: '1509391366360-2e959784a276',
  solarAerial: '1497435334941-8c899ee9e8e9',
  solarSky: '1508514177221-188b1cf16e9d',
  powerGrid: '1473341304170-971dccb5ac1e',

  // Technology & ledger
  earthNight: '1451187580459-43490279c0fa',
  circuit: '1518770660439-4636190af475',
  circuitGlow: '1550751827-4bd374c3f58b',
  sourceCode: '1488590528505-98d2b5aba04b',
  dataMesh: '1590859808308-3d2d9c515b1a',
  ledgerBlocks: '1639762681485-074b7f938ba0',

  // Finance & enterprise
  analytics: '1460925895917-afdab827c52f',
  marketChart: '1518186285589-2f7649de83e0',
  financeDocs: '1554224155-6726b3ff858f',
  cardPayment: '1563013544-824ae1b704d3',
  handshake: '1521791136064-7986c2920216',
  towers: '1486406146926-c627a92ad1ab',
  openOffice: '1504384308090-c894fdcc538d',
  studioOffice: '1559136555-9303baea8ebd',
  teamPitch: '1556761175-5973dc0f32e7',
  teamTable: '1522071820081-009f0129c71c',
  boardroom: '1517048676732-d65bc937f952',
  teamMeeting: '1521737604893-d14cc237f11d',
  paperwork: '1454165804606-c3d57bc86b40',

  // Governance & law
  chamber: '1555848962-6e79363ec58f',
  assembly: '1544531586-fde5298cdd40',
  justice: '1589829545856-d10d557cf95f',
  lawLibrary: '1505664194779-8beaceb93744',

  // Knowledge, health & society
  library: '1481627834876-b7833e8f5570',
  libraryAisle: '1427504494785-3a9ca7044f45',
  bookStack: '1497633762265-9d179a990aa6',
  bookshelf: '1513475382585-d06e58bcb0e0',
  classroom: '1580582932707-520aed937b7b',
  lecture: '1524178232363-1fb2b075b655',
  earlyLearning: '1503676260728-1c00da094a0b',
  laboratory: '1581091226825-a6a2a5aee158',
  hospital: '1519494026892-80bbd2d6fd0d',
  stethoscope: '1584982751601-97dcc096659c',
  clinician: '1576091160550-2173dba999ef',
  pharma: '1576671081837-49000212a370',
  anatomy: '1530026405186-ed1f139313f8',
  friendsSunset: '1511632765486-a01980e01a18',
  homeInterior: '1582719478250-c89cae4dc85b',

  // Travel & communication
  flight: '1436491865332-7a61a109cc05',
  newspaper: '1504711434969-e33886168f5c',
  readingNews: '1495020689067-958852a7765e',
  laptopPhone: '1423666639041-f56000c27a9a',
  remoteWork: '1563986768609-322da13575f3',
  tabletWork: '1573164713714-d95e436ab8d6',
} as const;

export type PhotoKey = keyof typeof PHOTOS;

/** Build an optimised Unsplash CDN URL for a curated photo. */
export function unsplash(key: PhotoKey, width = 1600, quality = 72): string {
  return `https://images.unsplash.com/photo-${PHOTOS[key]}?auto=format&fit=crop&w=${width}&q=${quality}`;
}
