/* Data and scenario logic for the volcano lab. Shared by index.html and verify.html. */
const VOLC = (() => {
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Hawaiian-Emperor chain: distance from Kilauea along the chain (km) and best age (millions of years).
  // Clague and Dalrymple (1987, 1989), as tabulated by Seattle Central QELP and NOAA Ocean Exploration.
  const ISLANDS = [
    ['Kilauea', 0, 0.2], ['Mauna Kea', 54, 0.38], ['Kohala', 100, 0.43], ['East Maui', 182, 0.75], ['Kahoolawe', 185, 1.03],
    ['West Maui', 221, 1.32], ['Lanai', 226, 1.28], ['East Molokai', 256, 1.76], ['West Molokai', 280, 1.90],
    ['Koolau (Oahu)', 339, 2.60], ['Waianae (Oahu)', 374, 3.70], ['Kauai', 519, 5.10], ['Niihau', 565, 4.89],
    ['Nihoa', 780, 7.2], ['Necker', 1058, 10.3], ['Gardner Pinnacles', 1435, 12.3], ['Laysan', 1818, 19.9], ['Midway', 2432, 27.7]
  ];

  // Rock name from silica (SiO2, weight percent)
  function rockName(si) { return si < 52 ? 'basalt' : si < 63 ? 'andesite' : si < 69 ? 'dacite' : 'rhyolite'; }
  // VEI from bulk erupted volume (km3), after Newhall and Self (1982)
  function veiOf(v) {
    if (v < 1e-5) return 0; if (v < 1e-3) return 1; if (v < 1e-2) return 2; if (v < 0.1) return 3;
    if (v < 1) return 4; if (v < 10) return 5; if (v < 100) return 6; if (v < 1000) return 7; return 8;
  }

  // Mystery volcanoes for the "Your turn" step. Silica values are typical, rounded.
  const MYSTERY = [
    { name: 'Kilauea, Hawaii', when: 'eruptions most years in recent decades',
      setting: 'hotspot', si: 50, rocks: ['basalt'], style: 'effusive', vei: 0, hazard: 'lava',
      card: 'On the Island of Hawaii, in the middle of the Pacific plate, thousands of kilometers from any plate boundary. A typical eruption: lava fountains tens of meters high and long, runny lava flows. Very little ash - less than 0.00001 km³, with plumes under 100 m.' },
    { name: 'Mauna Loa, Hawaii', when: 'eruption in 2022',
      setting: 'hotspot', si: 51, rocks: ['basalt'], style: 'effusive', vei: 0, hazard: 'lava',
      card: 'On the Island of Hawaii, in the middle of the Pacific plate. In its 2022 eruption, fissures opened on the flank and sent out lava fountains and long lava flows toward a highway. Almost no ash - less than 0.00001 km³, with plumes under 100 m.' },
    { name: 'Krakatau, Indonesia', when: 'August 1883',
      setting: 'subduction', si: 66, rocks: ['dacite'], style: 'explosive', vei: 6, hazard: 'pyro',
      card: 'In the Sunda Strait between Java and Sumatra, in a line of volcanoes above the Indo-Australian plate sinking at the Java trench. In August 1883 explosions were heard thousands of kilometers away, pyroclastic flows swept across the sea, and the island collapsed into a caldera. About 20 km\u00b3 of ash and pumice.' },
    { name: 'Novarupta, Alaska', when: 'June 1912',
      setting: 'subduction', si: 77, rocks: ['rhyolite'], style: 'explosive', vei: 6, hazard: 'pyro',
      card: 'On the Alaska Peninsula, in the Aleutian arc, above the Pacific plate sinking at the Aleutian trench. In June 1912 it erupted for about 60 hours. Pyroclastic flows filled a valley that is now called the Valley of Ten Thousand Smokes. About 30 km³ of ash and pumice.' },
    { name: 'Tambora, Indonesia', when: 'April 1815',
      setting: 'subduction', si: 57, rocks: ['andesite'], style: 'explosive', vei: 7, hazard: 'pyro',
      card: 'On the island of Sumbawa, in the Indonesian arc, above the Indo-Australian plate sinking at the Java trench. In April 1815 it erupted with pyroclastic flows that reached the sea, and ash fell across the region. More than 100 km³ of ash and pumice.' },
    { name: 'Yellowstone, Wyoming (Huckleberry Ridge eruption)', when: 'about 2.1 million years ago',
      setting: 'hotspot', si: 76, rocks: ['rhyolite'], style: 'explosive', vei: 8, hazard: 'pyro',
      card: 'In Wyoming, inside the North American plate, over a hotspot - the same hotspot that left a trail of older volcanic centers across southern Idaho. Here the hot mantle melted thick continental crust. About 2.1 million years ago it erupted about 2,450 km³ of ash and pumice, and the ground collapsed into a caldera.' }
  ];

  function build(seed) {
    const rng = mulberry32(seed * 2654435761 >>> 0);
    const m = Math.floor(rng() * MYSTERY.length);
    return { seed, mystery: m, myst: MYSTERY[m] };
  }

  function verifyCode(name, seed) {
    const s = name.trim().toLowerCase().replace(/\s+/g, ' ') + '|' + seed + '|cascades-volcano-lab-v1';
    let h1 = 0x811c9dc5, h2 = 0x01000193;
    for (let i = 0; i < s.length; i++) {
      h1 = Math.imul(h1 ^ s.charCodeAt(i), 16777619) >>> 0;
      h2 = Math.imul(h2 + s.charCodeAt(i) * 31, 2246822519) >>> 0;
    }
    const str = (h1.toString(36) + h2.toString(36)).toUpperCase().replace(/[^A-Z0-9]/g, '').padEnd(8, 'X');
    return str.slice(0, 4) + '-' + str.slice(4, 8);
  }

  const fitSpeed = (() => { let n = 0, d = 0; ISLANDS.forEach(([, x, a]) => { n += x * a; d += a * a; }); return n / d / 10; })(); // cm/yr

  return { ISLANDS, MYSTERY, rockName, veiOf, build, verifyCode, fitSpeed, mulberry32 };
})();
