const A3_DIMS = ["scoring", "creation", "progression", "defense", "discipline"];

const A3_SLOTS = [
    { sub: "ST", x: 50, y: 12,  label: "ST",  caption: "Striker" },
    { sub: "WG", x: 18, y: 22,  label: "LW",  caption: "Winger"  },
    { sub: "WG", x: 82, y: 22,  label: "RW",  caption: "Winger"  },
    { sub: "AM", x: 50, y: 32,  label: "CAM", caption: "Att. Mid" },
    { sub: "CM", x: 32, y: 46,  label: "CM",  caption: "Central Mid" },
    { sub: "CM", x: 68, y: 46,  label: "CM",  caption: "Central Mid" },
    { sub: "DM", x: 50, y: 58,  label: "CDM", caption: "Def. Mid" },
    { sub: "FB", x: 14, y: 70,  label: "LB",  caption: "Full-back" },
    { sub: "FB", x: 86, y: 70,  label: "RB",  caption: "Full-back" },
    { sub: "CB", x: 36, y: 76,  label: "CB",  caption: "Centre-back" },
    { sub: "CB", x: 64, y: 76,  label: "CB",  caption: "Centre-back" },
    { sub: "GK", x: 50, y: 91,  label: "GK",  caption: "Keeper" }
];

const A3_PRESETS = {
    ST: {
        ea:        { scoring: 0.55, creation: 0.15, progression: 0.15, defense: 0.05, discipline: 0.10 },
        balanced:  { scoring: 0.20, creation: 0.20, progression: 0.20, defense: 0.20, discipline: 0.20 },
        defensive: { scoring: 0.20, creation: 0.10, progression: 0.20, defense: 0.40, discipline: 0.10 },
        creative:  { scoring: 0.20, creation: 0.45, progression: 0.30, defense: 0.00, discipline: 0.05 }
    },
    WG: {
        ea:        { scoring: 0.35, creation: 0.30, progression: 0.20, defense: 0.05, discipline: 0.10 },
        balanced:  { scoring: 0.20, creation: 0.20, progression: 0.20, defense: 0.20, discipline: 0.20 },
        defensive: { scoring: 0.15, creation: 0.15, progression: 0.20, defense: 0.40, discipline: 0.10 },
        creative:  { scoring: 0.20, creation: 0.45, progression: 0.30, defense: 0.00, discipline: 0.05 }
    },
    AM: {
        ea:        { scoring: 0.25, creation: 0.40, progression: 0.25, defense: 0.05, discipline: 0.05 },
        balanced:  { scoring: 0.20, creation: 0.20, progression: 0.20, defense: 0.20, discipline: 0.20 },
        defensive: { scoring: 0.15, creation: 0.20, progression: 0.20, defense: 0.35, discipline: 0.10 },
        creative:  { scoring: 0.15, creation: 0.50, progression: 0.30, defense: 0.00, discipline: 0.05 }
    },
    CM: {
        ea:        { scoring: 0.15, creation: 0.30, progression: 0.30, defense: 0.20, discipline: 0.05 },
        balanced:  { scoring: 0.20, creation: 0.20, progression: 0.20, defense: 0.20, discipline: 0.20 },
        defensive: { scoring: 0.05, creation: 0.15, progression: 0.20, defense: 0.50, discipline: 0.10 },
        creative:  { scoring: 0.15, creation: 0.45, progression: 0.35, defense: 0.00, discipline: 0.05 }
    },
    DM: {
        ea:        { scoring: 0.05, creation: 0.15, progression: 0.25, defense: 0.45, discipline: 0.10 },
        balanced:  { scoring: 0.20, creation: 0.20, progression: 0.20, defense: 0.20, discipline: 0.20 },
        defensive: { scoring: 0.00, creation: 0.05, progression: 0.15, defense: 0.70, discipline: 0.10 },
        creative:  { scoring: 0.10, creation: 0.35, progression: 0.40, defense: 0.10, discipline: 0.05 }
    },
    FB: {
        ea:        { scoring: 0.05, creation: 0.25, progression: 0.30, defense: 0.30, discipline: 0.10 },
        balanced:  { scoring: 0.20, creation: 0.20, progression: 0.20, defense: 0.20, discipline: 0.20 },
        defensive: { scoring: 0.00, creation: 0.10, progression: 0.15, defense: 0.65, discipline: 0.10 },
        creative:  { scoring: 0.05, creation: 0.45, progression: 0.40, defense: 0.05, discipline: 0.05 }
    },
    CB: {
        ea:        { scoring: 0.05, creation: 0.05, progression: 0.25, defense: 0.55, discipline: 0.10 },
        balanced:  { scoring: 0.20, creation: 0.20, progression: 0.20, defense: 0.20, discipline: 0.20 },
        defensive: { scoring: 0.00, creation: 0.00, progression: 0.10, defense: 0.80, discipline: 0.10 },
        creative:  { scoring: 0.05, creation: 0.20, progression: 0.50, defense: 0.20, discipline: 0.05 }
    },
    GK: {
        ea:        { scoring: 0.65, creation: 0.10, progression: 0.00, defense: 0.25, discipline: 0.00 },
        balanced:  { scoring: 0.33, creation: 0.33, progression: 0.00, defense: 0.34, discipline: 0.00 },
        defensive: { scoring: 0.70, creation: 0.05, progression: 0.00, defense: 0.25, discipline: 0.00 },
        creative:  { scoring: 0.35, creation: 0.35, progression: 0.00, defense: 0.30, discipline: 0.00 }
    }
};

const POS_LORE = {
    ST: "The man at the tip of the arrow. Everything ends with him.",
    WG: "Chaos on the touchline. Either he beats you or he burns you.",
    AM: "The one who sees the pass you didn't.",
    CM: "Box to box, ninety minutes, no fuss.",
    DM: "The anchor. Nothing gets past without his say.",
    FB: "Two jobs, one shirt: lock the flank, feed the attack.",
    CB: "The last word before the keeper.",
    GK: "The only one allowed to panic."
};

const DIM_LABEL_FOR = {
    GK: { scoring: "shot-stopping", creation: "distribution", defense: "sweeping" }
};

function a3DimLabel(sub, d) {
    return (DIM_LABEL_FOR[sub] && DIM_LABEL_FOR[sub][d]) || d;
}

function a3DimsFor(sub) {
    return sub === "GK" ? ["scoring", "creation", "defense"] : A3_DIMS;
}

function a3CrestSVG(sub) {
    const slot = A3_SLOTS.find(s => s.sub === sub) || A3_SLOTS[0];
    return '<svg viewBox="0 0 100 100" preserveAspectRatio="none">' +
        '<rect x="5" y="5" width="90" height="90" rx="6" fill="#0a1a10" stroke="rgba(46,204,113,0.25)"/>' +
        '<line x1="5" y1="50" x2="95" y2="50" stroke="rgba(255,255,255,0.18)"/>' +
        '<circle cx="' + slot.x + '" cy="' + slot.y + '" r="7" fill="var(--gold)"/>' +
        '</svg>';
}

const A3_SLOT_COLORS = [
    { color: "#d4af37", tint: "rgba(212, 175, 55, 0.22)" },
    { color: "#4da6ff", tint: "rgba(77, 166, 255, 0.18)" },
    { color: "#b37aa8", tint: "rgba(179, 122, 168, 0.18)" }
];

const DIM_ICONS = {
    scoring:     '<svg class="a3-q-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2s5 5 5 10a5 5 0 0 1-10 0c0-5 5-10 5-10z"/><path d="M12 22v-4"/></svg>',
    creation:    '<svg class="a3-q-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/></svg>',
    progression: '<svg class="a3-q-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    defense:     '<svg class="a3-q-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 3 6v6c0 5 4 9 9 10 5-1 9-5 9-10V6z"/></svg>',
    discipline:  '<svg class="a3-q-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3v18M18 3v18M3 8l18 0M3 16l18 0"/></svg>'
};

const DIM_NICK = { scoring: "scorer", creation: "creator", progression: "carrier", defense: "destroyer", discipline: "anchor" };

const A3_QUIZ = {
    ST: [
        { prompt: "The striker you'd buy for 100 million:",
          choices: [
              { text: "Scores the scrappy tap-ins. Poacher's instinct.",   dim: "scoring",    w: 0.45 },
              { text: "Makes the others score. Link-up specialist.",        dim: "creation",   w: 0.35 }
          ] },
        { prompt: "One-on-one with the keeper:",
          choices: [
              { text: "Slot it low left. Ice-cold every time.",             dim: "scoring",    w: 0.35 },
              { text: "Lay it off. The open winger is a tap-in.",           dim: "creation",   w: 0.30 }
          ] },
        { prompt: "0-0 away, tough ground:",
          choices: [
              { text: "He drops, drags two defenders, opens space.",        dim: "progression",w: 0.30 },
              { text: "Glued to the last shoulder. One moment is enough.",  dim: "scoring",    w: 0.30 }
          ] },
        { prompt: "Without the ball he should:",
          choices: [
              { text: "Hunt the CBs from the front. 10 km a game.",         dim: "defense",    w: 0.25 },
              { text: "Rest, stay sharp, save the legs for chances.",       dim: "discipline", w: 0.10 }
          ] }
    ],
    WG: [
        { prompt: "Your winger in one word:",
          choices: [
              { text: "Lethal. Cuts inside, shoots, scores 20.",            dim: "scoring",    w: 0.35 },
              { text: "Generous. 15 assists, every cross a threat.",        dim: "creation",   w: 0.35 }
          ] },
        { prompt: "Ball at feet on the touchline:",
          choices: [
              { text: "Burn past the full-back. Speed is the skill.",       dim: "progression",w: 0.35 },
              { text: "One touch, smart pass, keep it moving.",             dim: "creation",   w: 0.30 }
          ] },
        { prompt: "Tracking back when we lose it:",
          choices: [
              { text: "First one back. Tackles like a midfielder.",         dim: "defense",    w: 0.30 },
              { text: "Stay high. Attack starts the moment we win it.",     dim: "scoring",    w: 0.20 }
          ] },
        { prompt: "He shoots from a tight angle:",
          choices: [
              { text: "Good. Chaos at the near post wins games.",           dim: "scoring",    w: 0.25 },
              { text: "Bad. Square to the striker. Easy goal.",             dim: "creation",   w: 0.25 }
          ] }
    ],
    AM: [
        { prompt: "Your number 10 is:",
          choices: [
              { text: "The pass-master. Last ball. Key to everything.",     dim: "creation",   w: 0.45 },
              { text: "The ghost. Arrives late, scores 15 from deep.",      dim: "scoring",    w: 0.35 }
          ] },
        { prompt: "He receives between the lines:",
          choices: [
              { text: "Turns and drives. Breaks the line alone.",           dim: "progression",w: 0.35 },
              { text: "One-touch through-ball. Instant.",                   dim: "creation",   w: 0.35 }
          ] },
        { prompt: "When we don't have the ball:",
          choices: [
              { text: "First to press the CB. Sets the tone high.",         dim: "defense",    w: 0.25 },
              { text: "Waits. Already thinking about the next attack.",     dim: "creation",   w: 0.20 }
          ] },
        { prompt: "At set pieces he:",
          choices: [
              { text: "Delivers every corner and free kick.",               dim: "creation",   w: 0.25 },
              { text: "Attacks the box, hunts second balls.",               dim: "scoring",    w: 0.25 }
          ] }
    ],
    CM: [
        { prompt: "Your ideal central midfielder:",
          choices: [
              { text: "The metronome. Always finds the pass.",              dim: "creation",   w: 0.35 },
              { text: "The engine. Covers every blade of grass.",           dim: "progression",w: 0.35 }
          ] },
        { prompt: "When we lose possession:",
          choices: [
              { text: "Tackles and interceptions, relentless.",             dim: "defense",    w: 0.40 },
              { text: "Reads it before it happens. Pure positioning.",      dim: "discipline", w: 0.20 }
          ] },
        { prompt: "In the final third:",
          choices: [
              { text: "Late runs, 8 goals a season minimum.",               dim: "scoring",    w: 0.30 },
              { text: "Threading balls from 30m. Key pass machine.",        dim: "creation",   w: 0.30 }
          ] },
        { prompt: "Under heavy pressing:",
          choices: [
              { text: "Keeps it. Never panics under pressure.",             dim: "discipline", w: 0.20 },
              { text: "Drives out. Beats the press with a carry.",          dim: "progression",w: 0.25 }
          ] }
    ],
    DM: [
        { prompt: "Your perfect defensive mid:",
          choices: [
              { text: "A wall. Wins every duel, reads every run.",          dim: "defense",    w: 0.50 },
              { text: "A conductor. Dictates rhythm from 30 metres.",       dim: "progression",w: 0.40 }
          ] },
        { prompt: "Tough away game, 0-0, 70 mins:",
          choices: [
              { text: "Sleeves up. 10 tackles, 5 interceptions.",           dim: "defense",    w: 0.40 },
              { text: "Cleanest passer. 95% completion under pressure.",    dim: "progression",w: 0.30 }
          ] },
        { prompt: "When you recover the ball:",
          choices: [
              { text: "Simple first. Recycle, don't risk it.",              dim: "discipline", w: 0.20 },
              { text: "Switch it 40 metres. Break the press in one.",       dim: "progression",w: 0.30 }
          ] },
        { prompt: "Does he push forward?",
          choices: [
              { text: "Rarely. His job is the shield.",                     dim: "defense",    w: 0.25 },
              { text: "A couple of key passes a game.",                     dim: "creation",   w: 0.20 }
          ] }
    ],
    FB: [
        { prompt: "Your ideal full-back:",
          choices: [
              { text: "10 assists, flies up the flank. Pure wing-back.",    dim: "creation",   w: 0.40 },
              { text: "Lockdown. Never beaten, never over-commits.",        dim: "defense",    w: 0.40 }
          ] },
        { prompt: "In build-up:",
          choices: [
              { text: "Inverts into midfield, short and sharp.",            dim: "progression",w: 0.30 },
              { text: "Overlaps the winger, width and pace.",               dim: "creation",   w: 0.30 }
          ] },
        { prompt: "Inside the final third:",
          choices: [
              { text: "Whips it to the back post. Assists matter.",         dim: "creation",   w: 0.30 },
              { text: "Keeps it simple. Recycle cleanly.",                  dim: "discipline", w: 0.15 }
          ] },
        { prompt: "Defending 1v1:",
          choices: [
              { text: "Tight and aggressive. Wins the tackle.",             dim: "defense",    w: 0.35 },
              { text: "Shows inside, calls for the cover.",                 dim: "discipline", w: 0.15 }
          ] }
    ],
    CB: [
        { prompt: "The centre-back you trust most:",
          choices: [
              { text: "Wins every header. Leader, wall, captain.",          dim: "defense",    w: 0.55 },
              { text: "Breaks lines with his feet. Ball-playing CB.",       dim: "progression",w: 0.40 }
          ] },
        { prompt: "At a corner:",
          choices: [
              { text: "Aerial threat. 4-5 goals a season from set pieces.", dim: "scoring",    w: 0.20 },
              { text: "Stays home. Discipline over adventure.",             dim: "defense",    w: 0.30 }
          ] },
        { prompt: "Starting attacks from the back:",
          choices: [
              { text: "Steps out, carries, breaks the first press.",        dim: "progression",w: 0.35 },
              { text: "Safe ball to the full-back. No risks.",              dim: "discipline", w: 0.20 }
          ] },
        { prompt: "Yellow card risk:",
          choices: [
              { text: "Never booked. Reads it, positions perfectly.",       dim: "discipline", w: 0.25 },
              { text: "Takes one to stop the break. Worth it.",             dim: "defense",    w: 0.20 }
          ] }
    ],
    GK: [
        { prompt: "Shot-stopping or sweeping?",
          choices: [
              { text: "Hands first. Saves win points. Born to stop shots.", dim: "scoring",    w: 0.55 },
              { text: "Reads the game, sweeps, claims crosses early.",      dim: "defense",    w: 0.40 }
          ] },
        { prompt: "When the full-back has no option:",
          choices: [
              { text: "Short pass, calm start. The eleventh outfielder.",   dim: "creation",   w: 0.35 },
              { text: "Launches it long. Less risk.",                       dim: "scoring",    w: 0.20 }
          ] },
        { prompt: "1v1 with a striker bearing down:",
          choices: [
              { text: "Off the line fast. Narrow the angle, smother it.",   dim: "defense",    w: 0.35 },
              { text: "Big body, wait for the shot, react.",                dim: "scoring",    w: 0.30 }
          ] },
        { prompt: "His value in build-up:",
          choices: [
              { text: "Launches precise distribution from the back.",       dim: "creation",   w: 0.35 },
              { text: "Safe and short. Let the outfield build.",            dim: "scoring",    w: 0.20 }
          ] }
    ]
};
