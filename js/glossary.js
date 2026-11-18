/* Clickable glossary. Any element with class "term" and data-term="key"
   opens a short explainer. Works in the main page and in pop-out windows. */
const GLOSSARY = {
  'magma': ['Magma', 'Molten rock underground, usually with crystals and dissolved gases in it. When it reaches the surface it is called lava.'],
  'lava': ['Lava', 'Molten rock that has reached the surface, and the rock it cools into.'],
  'silica': ['Silica (SiO₂)', 'Silicon dioxide, the most common ingredient in volcanic rocks. It is given as a weight percent of the magma. Silica atoms link into chains and sheets in the melt, and so magma with more silica is stiffer and more viscous.'],
  'viscosity': ['Viscosity', 'How strongly a liquid resists flowing. Water has low viscosity and honey has high viscosity. It is measured in pascal-seconds (Pa·s). Basalt magma is roughly 10 to 100 Pa·s, and rhyolite magma can be more than a million times stiffer.'],
  'volatiles': ['Dissolved gas (volatiles)', 'Water vapor, carbon dioxide and sulfur gases dissolved in magma under pressure, like carbon dioxide in a closed soda bottle. As magma rises and the pressure drops, the gas comes out as bubbles.'],
  'basalt': ['Basalt', 'Dark volcanic rock with low silica, less than about 52 percent. Basalt magma is hot (about 1,100 to 1,200°C) and runny. Hawaii and Iceland are built mostly of basalt.'],
  'andesite': ['Andesite', 'Volcanic rock with medium silica, about 52 to 63 percent. It is common at subduction zones and is named after the Andes Mountains. Mount Rainier and Mount Hood are mostly andesite.'],
  'dacite': ['Dacite', 'Volcanic rock with fairly high silica, about 63 to 69 percent. Dacite magma is stiff and often gas-rich. The 1980 eruption of Mount St. Helens was dacite.'],
  'rhyolite': ['Rhyolite', 'Light-colored volcanic rock with high silica, more than about 69 percent. Rhyolite magma is the stiffest and coolest common magma (about 700 to 850°C) and makes the most explosive eruptions, along with pumice and obsidian.'],
  'effusive': ['Effusive eruption', 'An eruption where lava pours or fountains out and flows away, with little explosive activity. Gas escapes easily from runny magma.'],
  'explosive': ['Explosive eruption', 'An eruption where gas bubbles trapped in stiff magma expand violently and blast the magma into fragments of ash and pumice, making eruption columns and pyroclastic flows.'],
  'shield': ['Shield volcano', 'A broad volcano with gentle slopes, built from many runny lava flows. Seen from the side it looks like a warrior’s shield lying on the ground. Mauna Loa is the largest on Earth.'],
  'stratovolcano': ['Stratovolcano (composite volcano)', 'A steep, cone-shaped volcano built of layers of stiff lava flows, ash and pumice. Most of the Cascade volcanoes are stratovolcanoes.'],
  'caldera': ['Caldera', 'A large basin that forms when the ground collapses into an emptied magma chamber after a very large eruption. Crater Lake in Oregon fills a caldera.'],
  'hotspot': ['Hotspot', 'A place where unusually hot mantle rises and melts, away from plate boundaries. The hotspot stays roughly fixed while the plate above moves, and so it leaves a trail of volcanoes that get older with distance.'],
  'subduction': ['Subduction zone', 'A plate boundary where an ocean plate sinks beneath another plate. Water released from the sinking plate lowers the melting point of the mantle above it, and so a line of volcanoes forms on the upper plate.'],
  'volcanic-arc': ['Volcanic arc', 'A line of volcanoes on the upper plate at a subduction zone, roughly parallel to the trench. The Cascades, the Aleutians and the Andes are volcanic arcs.'],
  'plate': ['Tectonic plate', 'One of the large, rigid pieces of the Earth’s outer shell (the lithosphere). Plates move a few centimeters per year.'],
  'k-ar': ['Radiometric dating (K-Ar)', 'Dating a rock from the slow radioactive decay of potassium-40 into argon-40. The more argon that has built up in a lava since it cooled, the older the lava.'],
  'bulge': ['Bulge (cryptodome)', 'At Mount St. Helens in 1980, magma pushed into the volcano without reaching the surface and swelled the north side outward. A mass of magma like this inside a volcano is called a cryptodome.'],
  'tremor': ['Volcanic tremor', 'A continuous shaking signal on seismometers, different from the sharp start of an ordinary earthquake. It is often linked to magma or gas moving through cracks.'],
  'phreatic': ['Steam (phreatic) explosion', 'An explosion driven by groundwater flashing to steam when it is heated by magma below. It throws out old rock and steam, but not new magma.'],
  'monitoring': ['Volcano monitoring', 'Watching a volcano with instruments: seismometers for earthquakes, GPS and tiltmeters for swelling, gas sensors, cameras and satellites. Changes in these signals are how scientists see a volcano waking up.'],
  'lahar': ['Lahar', 'A volcanic mudflow: a fast-moving slurry of water, rock and ash, like wet concrete, that follows river valleys. Lahars can form when an eruption melts snow and ice, when heavy rain hits loose ash, or when weak rock on a volcano collapses.'],
  'pyroclastic-flow': ['Pyroclastic flow', 'A fast, ground-hugging avalanche of hot gas, ash and rock that rushes down a volcano during an explosive eruption. Pyroclastic flows can be hundreds of degrees Celsius and move faster than 100 km per hour.'],
  'lava-flow': ['Lava flow', 'Molten rock moving over the ground. Most lava flows move slowly enough to walk away from, but they bury and burn everything in their path.'],
  'ash-fall': ['Ash fall (tephra fall)', 'Fragments of rock and glass blown into the air by an explosive eruption that fall back to the ground, sometimes hundreds of kilometers downwind.'],
  'vei': ['Volcanic Explosivity Index (VEI)', 'A scale from 0 to 8 for the size of explosive eruptions, set up by Newhall and Self in 1982. It is based mostly on the volume of ash and pumice erupted and the height of the eruption column. Each step up means about 10 times more material.'],
  'logarithmic': ['Logarithmic scale', 'A scale where each step multiplies by the same amount. On the VEI scale, going up by 1 means about 10 times more erupted material.'],
  'eruption-column': ['Eruption column', 'The rising plume of hot gas and ash above an explosive eruption. Large columns punch more than 25 km up into the stratosphere.']
};

const Glossary = (() => {
  function show(term, anchor) {
    const doc = anchor.ownerDocument;
    const entry = GLOSSARY[term];
    if (!entry) return;
    let pop = doc.getElementById('glossaryPop');
    if (!pop) { pop = doc.createElement('div'); pop.id = 'glossaryPop'; pop.className = 'gloss-pop'; doc.body.appendChild(pop); }
    pop.innerHTML = '';
    const close = doc.createElement('button'); close.className = 'close'; close.type = 'button'; close.textContent = '×';
    close.setAttribute('aria-label', 'Close'); close.onclick = () => { pop.hidden = true; };
    const h = doc.createElement('h4'); h.textContent = entry[0];
    const p = doc.createElement('div'); p.textContent = entry[1];
    pop.append(close, h, p);
    pop.hidden = false;
    const r = anchor.getBoundingClientRect();
    const w = doc.defaultView.innerWidth, hgt = doc.defaultView.innerHeight;
    const pw = Math.min(340, w - 20);
    pop.style.left = Math.max(10, Math.min(r.left, w - pw - 10)) + 'px';
    const below = r.bottom + 8;
    pop.style.top = (below + 160 > hgt ? Math.max(10, r.top - 170) : below) + 'px';
  }
  function attach(doc) {
    doc.addEventListener('click', e => {
      const t = e.target.closest ? e.target.closest('.term') : null;
      const pop = doc.getElementById('glossaryPop');
      if (t) { e.preventDefault(); show(t.dataset.term, t); return; }
      if (pop && !pop.hidden && !pop.contains(e.target)) pop.hidden = true;
    });
    doc.addEventListener('keydown', e => {
      if (e.key === 'Escape') { const pop = doc.getElementById('glossaryPop'); if (pop) pop.hidden = true; }
      if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('term')) { e.preventDefault(); show(e.target.dataset.term, e.target); }
    });
  }
  function listHTML() {
    return '<dl class="gloss-list">' + Object.keys(GLOSSARY).sort((a, b) => GLOSSARY[a][0].localeCompare(GLOSSARY[b][0]))
      .map(k => `<dt>${GLOSSARY[k][0]}</dt><dd>${GLOSSARY[k][1]}</dd>`).join('') + '</dl>';
  }
  return { attach, show, listHTML };
})();
