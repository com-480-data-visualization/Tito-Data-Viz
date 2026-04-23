/* ======================================================================
   Act 2 §.05 — Stadium
   Click on a club from the map drawer: camera tilts from top-down (map)
   into a 3D stadium interior. Players stand at their pitch positions as
   glowing towers; the ball's-eye HUD lets you pivot between them.
   Scoped to #stadium-scene. No external deps beyond what act 2 already
   loads (nothing — pure DOM + CSS transforms + GSAP if present).
   ====================================================================== */

(function () {
    "use strict";

    // 4-2-3-1 formation on a pitch spanning X ∈ [-50, 50] (touchline to
    // touchline) and Y ∈ [-50, 50] (own goal to opposition goal; we are
    // attacking upwards). Each slot lists which sub-position buckets can
    // fill it, in preference order.
    const FORMATION = [
        { id: "GK",  label: "Goalkeeper",       x:   0, y: -44, buckets: ["GK"] },
        { id: "LB",  label: "Left-back",        x: -32, y: -26, buckets: ["FB"] },
        { id: "LCB", label: "Centre-back (L)",  x: -12, y: -30, buckets: ["CB"] },
        { id: "RCB", label: "Centre-back (R)",  x:  12, y: -30, buckets: ["CB"] },
        { id: "RB",  label: "Right-back",       x:  32, y: -26, buckets: ["FB"] },
        { id: "LDM", label: "Defensive mid (L)",x: -14, y:  -6, buckets: ["DM", "CM"] },
        { id: "RDM", label: "Defensive mid (R)",x:  14, y:  -6, buckets: ["DM", "CM"] },
        { id: "LW",  label: "Left winger",      x: -30, y:  18, buckets: ["WG"] },
        { id: "AM",  label: "Attacking mid",    x:   0, y:  14, buckets: ["AM", "CM"] },
        { id: "RW",  label: "Right winger",     x:  30, y:  18, buckets: ["WG"] },
        { id: "ST",  label: "Striker",          x:   0, y:  36, buckets: ["ST"] }
    ];

    let overlay = null;
    let mountedFor = null;   // last club name we built the scene for
    let slotEls = {};        // id -> { disc, tower, card }
    let activeSlot = null;
    let activePlayerIdx = 0; // depth-chart cursor within the active slot
    let keyHandler = null;
    let currentLineup = {};  // id -> [player, ...]
    let currentClub = null;

    // ---------- public API ----------

    window.openAct2Stadium = function (club, opts) {
        if (!club) return;
        opts = opts || {};
        ensureOverlay();
        populate(club);
        overlay.setAttribute("aria-hidden", "false");
        overlay.classList.add("is-open");
        document.body.classList.add("stadium-locked");

        // Resolve a preselected player (from the map) to the slot + depth idx
        // containing them, so the camera lands on the right tower.
        let target = { slot: null, idx: 0 };
        if (opts.preselectPlayer) {
            for (const f of FORMATION) {
                const squad = currentLineup[f.id] || [];
                const i = squad.findIndex(p => p.name === opts.preselectPlayer);
                if (i >= 0) { target = { slot: f.id, idx: i }; break; }
            }
        }

        // Small delay so transitions kick in.
        requestAnimationFrame(() => {
            overlay.classList.add("is-lit");
            // Always start from the centre circle, then fly to either the
            // preselected slot or a default opener.
            focusSlot("AM", { instant: true, silent: true });
            setTimeout(() => {
                if (target.slot) {
                    activePlayerIdx = target.idx;
                    focusSlot(target.slot, { keepIdx: true });
                } else {
                    focusSlot("ST");
                }
            }, 650);
        });
        attachKeys();
    };

    window.closeAct2Stadium = function () {
        if (!overlay) return;
        overlay.classList.remove("is-open", "is-lit");
        overlay.setAttribute("aria-hidden", "true");
        document.body.classList.remove("stadium-locked");
        detachKeys();
    };

    // ---------- DOM construction ----------

    function ensureOverlay() {
        if (overlay) return;
        overlay = document.getElementById("stadium-scene");
        if (!overlay) {
            overlay = document.createElement("div");
            overlay.id = "stadium-scene";
            document.body.appendChild(overlay);
        }
        overlay.className = "stadium-scene";
        overlay.setAttribute("aria-hidden", "true");
        overlay.innerHTML = shellHTML();

        // Wire close.
        overlay.querySelector(".stad-close").addEventListener("click", window.closeAct2Stadium);
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) window.closeAct2Stadium();
        });
    }

    function shellHTML() {
        return (
            '<div class="stad-skyline"></div>' +
            '<div class="stad-haze"></div>' +
            '<div class="stad-rays"></div>' +

            '<div class="stad-world">' +
                bowlSVG() +
                '<div class="stad-stage" data-yaw="0">' +
                    '<div class="stad-pitch">' +
                        pitchMarkingsSVG() +
                        '<div class="stad-positions"></div>' +
                        ballMount() +
                    '</div>' +
                '</div>' +
            '</div>' +

            '<div class="stad-vignette"></div>' +
            '<div class="stad-grain"></div>' +

            '<header class="stad-hud-top">' +
                '<div class="stad-chapter">' +
                    '<span class="stad-kicker">§ 05 &middot; THE CATHEDRAL</span>' +
                    '<h3 class="stad-title"><span class="stad-club-name">—</span></h3>' +
                    '<p class="stad-sub">Step inside. The squad, arranged where they play &mdash; and the gap each one carries.</p>' +
                '</div>' +
                '<button class="stad-close" aria-label="Close stadium">' +
                    '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">' +
                        '<path d="M6 6l12 12M18 6l-12 12"/>' +
                    '</svg>' +
                '</button>' +
            '</header>' +

            '<div class="stad-lower-third">' +
                '<div class="stad-lt-role">—</div>' +
                '<div class="stad-lt-name">—</div>' +
            '</div>' +

            '<aside class="stad-detail" aria-live="polite">' +
                '<div class="stad-detail-inner">—</div>' +
            '</aside>' +

            '<nav class="stad-hud-mini" aria-label="Jump to position">' +
                miniPitchSVG() +
            '</nav>' +

            '<footer class="stad-hud-bottom">' +
                '<span class="stad-hint">&larr; &rarr; pivot &middot; &uarr; &darr; cycle depth &middot; esc to leave</span>' +
            '</footer>'
        );
    }

    function bowlSVG() {
        // Three silhouette layers forming the stadium bowl. Parametric
        // ellipse arcs; the pitch sits in the near pocket.
        return (
            '<svg class="stad-bowl" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" aria-hidden="true">' +
                // far stands (behind pitch, uppermost curve)
                '<path class="stad-bowl-far"  d="M 0 520 C 260 340, 560 270, 800 262 C 1040 270, 1340 340, 1600 520 L 1600 900 L 0 900 Z"/>' +
                // mid bowl
                '<path class="stad-bowl-mid"  d="M 0 620 C 300 460, 580 400, 800 394 C 1020 400, 1300 460, 1600 620 L 1600 900 L 0 900 Z"/>' +
                // near seats + tunnel lip
                '<path class="stad-bowl-near" d="M 0 760 C 340 630, 600 580, 800 574 C 1000 580, 1260 630, 1600 760 L 1600 900 L 0 900 Z"/>' +
                // floodlights (4 suspended over far stand)
                '<g class="stad-floods">' +
                    '<circle cx="180"  cy="260" r="3"/>' +
                    '<circle cx="560"  cy="232" r="3.2"/>' +
                    '<circle cx="1040" cy="232" r="3.2"/>' +
                    '<circle cx="1420" cy="260" r="3"/>' +
                '</g>' +
            '</svg>'
        );
    }

    function pitchMarkingsSVG() {
        // Pitch markings in gold at low opacity. Dimensions chosen to sit
        // on the tilted pitch plane (200×250 logical; long axis vertical
        // because we're behind the near goal looking out).
        return (
            '<svg class="stad-pitch-art" viewBox="-50 -50 100 100" preserveAspectRatio="none" aria-hidden="true">' +
                '<defs>' +
                    '<linearGradient id="pitch-grad" x1="0" y1="1" x2="0" y2="0">' +
                        '<stop offset="0"   stop-color="#0b0f18"/>' +
                        '<stop offset="0.4" stop-color="#0e1420"/>' +
                        '<stop offset="1"   stop-color="#141c2e"/>' +
                    '</linearGradient>' +
                    '<pattern id="pitch-stripes" x="0" y="0" width="100" height="8" patternUnits="userSpaceOnUse">' +
                        '<rect x="0" y="0" width="100" height="4" fill="rgba(255,255,255,0.012)"/>' +
                    '</pattern>' +
                '</defs>' +
                '<rect x="-50" y="-50" width="100" height="100" fill="url(#pitch-grad)"/>' +
                '<rect x="-50" y="-50" width="100" height="100" fill="url(#pitch-stripes)"/>' +
                // outer touchlines
                '<rect x="-48" y="-48" width="96" height="96" fill="none" stroke="rgba(212,175,55,0.22)" stroke-width="0.35"/>' +
                // halfway line
                '<line x1="-48" y1="0" x2="48" y2="0" stroke="rgba(212,175,55,0.18)" stroke-width="0.25"/>' +
                // centre circle
                '<circle cx="0" cy="0" r="9" fill="none" stroke="rgba(212,175,55,0.2)" stroke-width="0.25"/>' +
                '<circle cx="0" cy="0" r="0.8" fill="rgba(212,175,55,0.35)"/>' +
                // near penalty box (bottom, our goal)
                '<rect x="-20" y="-48" width="40" height="16" fill="none" stroke="rgba(212,175,55,0.18)" stroke-width="0.25"/>' +
                '<rect x="-8"  y="-48" width="16" height="6"  fill="none" stroke="rgba(212,175,55,0.18)" stroke-width="0.25"/>' +
                '<circle cx="0" cy="-37" r="0.7" fill="rgba(212,175,55,0.3)"/>' +
                '<path d="M -8 -36 A 9 9 0 0 0 8 -36" fill="none" stroke="rgba(212,175,55,0.14)" stroke-width="0.22"/>' +
                // far penalty box
                '<rect x="-20" y="32" width="40" height="16" fill="none" stroke="rgba(212,175,55,0.18)" stroke-width="0.25"/>' +
                '<rect x="-8"  y="42" width="16" height="6"  fill="none" stroke="rgba(212,175,55,0.18)" stroke-width="0.25"/>' +
                '<circle cx="0" cy="37" r="0.7" fill="rgba(212,175,55,0.3)"/>' +
                '<path d="M -8 36 A 9 9 0 0 1 8 36" fill="none" stroke="rgba(212,175,55,0.14)" stroke-width="0.22"/>' +
                // corner arcs
                '<path d="M -48 -46 A 2 2 0 0 1 -46 -48" fill="none" stroke="rgba(212,175,55,0.18)" stroke-width="0.22"/>' +
                '<path d="M  46 -48 A 2 2 0 0 1  48 -46" fill="none" stroke="rgba(212,175,55,0.18)" stroke-width="0.22"/>' +
                '<path d="M -48  46 A 2 2 0 0 0 -46  48" fill="none" stroke="rgba(212,175,55,0.18)" stroke-width="0.22"/>' +
                '<path d="M  46  48 A 2 2 0 0 0  48  46" fill="none" stroke="rgba(212,175,55,0.18)" stroke-width="0.22"/>' +
            '</svg>'
        );
    }

    function ballMount() {
        // Ball container lives on the pitch plane (so its left/top are in
        // pitch coords). Children counter-rotate to stand world-vertical
        // for the arc animation; the shadow stays flat on the pitch.
        // The ball itself is a CSS-3D sphere — a face-on shaded shell
        // plus a preserve-3d layer of 12 pentagonal patches positioned
        // at dodecahedral angles. Backface-visibility hides patches on
        // the far hemisphere so you only ever see ~5 at once.
        const patches = [];
        for (let i = 0; i < 12; i++) patches.push('<div class="stad-patch stad-p' + (i + 1) + '"></div>');
        return (
            '<div class="stad-ball-mount" aria-hidden="true">' +
                '<div class="stad-ball-shadow"></div>' +
                '<div class="stad-ball-riser">' +
                    '<div class="stad-ball-body">' +
                        '<div class="stad-sphere">' +
                            '<div class="stad-sphere-shell"></div>' +
                            '<div class="stad-sphere-spin">' +
                                patches.join("") +
                                '<div class="stad-sphere-gloss"></div>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
            '</div>'
        );
    }

    function miniPitchSVG() {
        const slots = FORMATION.map(f =>
            '<circle class="mp-slot" data-slot="' + f.id + '" ' +
            'cx="' + (50 + f.x * 0.6) + '" cy="' + (50 - f.y * 0.6) + '" r="2.8">' +
            '<title>' + escapeHtml(f.label) + '</title>' +
            '</circle>'
        ).join("");
        return (
            '<svg viewBox="0 0 100 100" width="150" height="150" aria-hidden="true">' +
                '<rect class="mp-frame" x="2" y="2" width="96" height="96" fill="none" rx="2"/>' +
                '<line class="mp-half" x1="2" y1="50" x2="98" y2="50"/>' +
                '<circle class="mp-centre" cx="50" cy="50" r="10" fill="none"/>' +
                slots +
            '</svg>' +
            '<div class="stad-hud-mini-lbl">FORMATION · 4-2-3-1</div>'
        );
    }

    // ---------- populate for a given club ----------

    function populate(club) {
        if (!overlay) return;

        currentClub = club;
        overlay.querySelector(".stad-club-name").textContent = club.name || "—";

        currentLineup = assignPlayers(club.players || []);

        const host = overlay.querySelector(".stad-positions");
        host.innerHTML = "";
        slotEls = {};

        FORMATION.forEach((slot, i) => {
            const squad = currentLineup[slot.id] || [];
            const node = buildSlotNode(slot, squad, i);
            host.appendChild(node);
        });

        // Wire mini-HUD.
        const mini = overlay.querySelector(".stad-hud-mini svg");
        mini.querySelectorAll(".mp-slot").forEach(el => {
            el.addEventListener("click", () => focusSlot(el.dataset.slot));
        });
        // Remount-safe: clear old click wires on the mini if any.

        mountedFor = club.name;
    }

    function buildSlotNode(slot, squad, order) {
        // Each slot is a flat disc lying on the pitch (via its own 3D
        // transform) plus a "tower" that rises vertically from it.
        const el = document.createElement("div");
        el.className = "stad-slot";
        el.dataset.slot = slot.id;
        el.style.setProperty("--sx", slot.x);
        el.style.setProperty("--sy", slot.y);
        el.style.setProperty("--sd", order * 0.05 + "s");

        // depth factor from pitch Y: back of pitch (y=+50) = small, front
        // (y=-50) = large. Used for sizing the tower & text.
        const depth = 1 - (slot.y + 50) / 100;  // 0..1, 1 = near
        el.style.setProperty("--dp", (0.7 + depth * 0.55).toFixed(3));

        const top = squad[0];
        const extra = squad.length > 1 ? (" +" + (squad.length - 1)) : "";
        const gap = top ? top.gap : null;
        const gapCls = gap == null ? "" : (gap > 1 ? "is-up" : gap < -1 ? "is-dn" : "is-mid");
        const gapTxt = gap == null ? "—" : (gap > 0 ? "+" : "") + gap.toFixed(1);

        el.innerHTML =
            '<div class="stad-slot-disc"><span class="stad-slot-code">' + slot.id + '</span></div>' +
            '<div class="stad-slot-tower">' +
                '<div class="stad-slot-tower-shaft"></div>' +
                '<div class="stad-slot-card ' + gapCls + '">' +
                    photoHTML(top, "stad-card-photo") +
                    '<div class="stad-card-body">' +
                        '<div class="stad-card-name">' + escapeHtml(top ? top.name : "No data") + extra + '</div>' +
                        '<div class="stad-card-role">' + slot.id + ' &middot; ' + escapeHtml(slot.label) + '</div>' +
                    '</div>' +
                    '<div class="stad-card-gap">' + gapTxt + '</div>' +
                '</div>' +
            '</div>';

        el.addEventListener("click", (e) => {
            e.stopPropagation();
            focusSlot(slot.id);
        });

        slotEls[slot.id] = { root: el, squad };
        return el;
    }

    // ---------- assign players to the 11 slots ----------

    function assignPlayers(players) {
        // Group by sub-position bucket. Sort each bucket by minutes
        // descending so starters bubble up.
        const by = {};
        for (const p of players) {
            const b = p.subPos || p.pos || "";
            (by[b] = by[b] || []).push(p);
        }
        for (const k of Object.keys(by)) {
            by[k].sort((a, b) => (b.minutes || 0) - (a.minutes || 0));
        }

        const assignment = {};
        const used = new Set();

        // Pass 1: fill each slot from its first preferred bucket that has
        // an unused player.
        for (const slot of FORMATION) {
            let picked = null;
            for (const bucket of slot.buckets) {
                const pool = by[bucket];
                if (!pool) continue;
                for (const p of pool) {
                    if (!used.has(p.name)) { picked = p; used.add(p.name); break; }
                }
                if (picked) break;
            }
            assignment[slot.id] = picked ? [picked] : [];
        }

        // Pass 2: distribute remaining players onto whichever slot their
        // bucket maps to (depth chart). LB and RB share the FB pool, etc.
        const remainingBy = {};
        for (const b of Object.keys(by)) {
            remainingBy[b] = by[b].filter(p => !used.has(p.name));
        }
        for (const slot of FORMATION) {
            for (const bucket of slot.buckets) {
                const pool = remainingBy[bucket];
                if (!pool) continue;
                // Spread across the slots that list this bucket by
                // popping from the front of the pool.
                const slotsWithBucket = FORMATION.filter(f => f.buckets.includes(bucket));
                // give at most one extra per slot before going around
                for (let round = 0; round < 4 && pool.length; round++) {
                    for (const s of slotsWithBucket) {
                        if (!pool.length) break;
                        const p = pool.shift();
                        used.add(p.name);
                        assignment[s.id] = (assignment[s.id] || []).concat(p);
                    }
                }
            }
        }

        return assignment;
    }

    // ---------- camera / focus ----------

    function focusSlot(id, opts) {
        opts = opts || {};
        const slot = FORMATION.find(f => f.id === id);
        if (!slot) return;
        const prevSlot = activeSlot;
        activeSlot = id;

        // Update mini HUD active ring.
        overlay.querySelectorAll(".mp-slot").forEach(el => {
            el.classList.toggle("is-active", el.dataset.slot === id);
        });
        overlay.querySelectorAll(".stad-slot").forEach(el => {
            el.classList.toggle("is-active", el.dataset.slot === id);
        });

        // Ball: travel from the previous slot to this one with an arc.
        moveBall(slot, prevSlot, !!opts.instant);

        // Camera: translate the stage so the slot sits near the centre
        // of the viewport, and yaw slightly toward it for wide positions.
        const stage = overlay.querySelector(".stad-stage");
        stage.style.setProperty("--cam-yaw", (-slot.x * 0.1).toFixed(2) + "deg");
        stage.style.setProperty("--cam-x",   (-slot.x * 0.28).toFixed(2) + "vw");
        stage.style.setProperty("--cam-y",   (slot.y * 0.08).toFixed(2) + "vh");

        // Reset depth-chart cursor when the slot changes, unless the caller
        // has already pinned a specific player (e.g. preselection from the map).
        if (!opts.keepIdx) activePlayerIdx = 0;
        renderSlotDetail(slot, { silent: !!opts.silent });
    }

    function renderSlotDetail(slot, opts) {
        opts = opts || {};
        const squad = (currentLineup[slot.id] || []);
        const idx = Math.max(0, Math.min(activePlayerIdx, Math.max(0, squad.length - 1)));
        const p = squad[idx];

        const lt = overlay.querySelector(".stad-lower-third");
        lt.querySelector(".stad-lt-role").textContent =
            slot.id + " · " + slot.label + (squad.length > 1 ? (" · " + (idx + 1) + " / " + squad.length) : "");
        lt.querySelector(".stad-lt-name").textContent = p ? p.name : "No player assigned";
        if (!opts.silent) {
            lt.classList.remove("is-showing");
            void lt.offsetWidth;
            lt.classList.add("is-showing");
        }

        const detail = overlay.querySelector(".stad-detail-inner");
        detail.innerHTML = detailCardHTML(slot, squad, idx);
        detail.querySelectorAll(".stad-dc-depth-row").forEach(row => {
            row.addEventListener("click", () => {
                const n = +row.dataset.idx;
                if (Number.isFinite(n) && n !== activePlayerIdx) {
                    activePlayerIdx = n;
                    renderSlotDetail(slot, { silent: true });
                }
            });
        });
    }

    function detailCardHTML(slot, squad, idx) {
        if (!squad.length) {
            return (
                '<div class="stad-dc-empty">' +
                    '<div class="stad-dc-role">' + escapeHtml(slot.label) + '</div>' +
                    '<div class="stad-dc-msg">No qualifying player at this position in this squad.</div>' +
                '</div>'
            );
        }
        const i = Math.max(0, Math.min(idx || 0, squad.length - 1));
        const p = squad[i];
        const gap = p.gap || 0;
        const gapCls = gap > 1 ? "is-up" : gap < -1 ? "is-dn" : "is-mid";
        const gapTxt = (gap > 0 ? "+" : "") + gap.toFixed(2);
        const ovr = (p.ea && p.ea.ovr != null) ? p.ea.ovr : "—";

        return (
            '<div class="stad-dc-head">' +
                photoHTML(p, "stad-dc-photo") +
                '<div class="stad-dc-id">' +
                    '<div class="stad-dc-role">' + slot.id + ' &middot; ' + escapeHtml(slot.label) +
                        (squad.length > 1 ? ' &middot; <span class="stad-dc-depth-idx">' + (i + 1) + ' / ' + squad.length + '</span>' : '') +
                    '</div>' +
                    '<div class="stad-dc-name">' + escapeHtml(p.name) + '</div>' +
                    '<div class="stad-dc-meta">' +
                        escapeHtml(p.subPos || p.pos || "—") +
                        ' &middot; ' + (p.minutes != null ? Math.round(p.minutes) + "'" : "—") +
                        (p.age != null ? ' &middot; ' + p.age + ' yrs' : "") +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<div class="stad-dc-stats">' +
                '<div class="stad-dc-stat"><span class="stad-dc-v">' + ovr + '</span><span class="stad-dc-l">EA OVR</span></div>' +
                '<div class="stad-dc-stat"><span class="stad-dc-v">' + (p.composite != null ? p.composite.toFixed(1) : "—") + '</span><span class="stad-dc-l">Composite</span></div>' +
                '<div class="stad-dc-stat"><span class="stad-dc-v ' + gapCls + '">' + gapTxt + '</span><span class="stad-dc-l">Gap</span></div>' +
            '</div>' +
            (squad.length > 1
                ? '<div class="stad-dc-depth">' +
                    '<div class="stad-dc-depth-lbl">Depth chart &middot; <span class="stad-dc-depth-hint">&uarr; &darr; to cycle</span></div>' +
                    squad.map((d, di) => {
                        const g = d.gap || 0;
                        const c = g > 1 ? "is-up" : g < -1 ? "is-dn" : "is-mid";
                        const t = (g > 0 ? "+" : "") + g.toFixed(1);
                        const active = di === i ? " is-active" : "";
                        return (
                            '<div class="stad-dc-depth-row' + active + '" data-idx="' + di + '">' +
                                '<span class="stad-dc-depth-rank">' + (di + 1) + '</span>' +
                                '<span class="stad-dc-depth-name">' + escapeHtml(d.name) + '</span>' +
                                '<span class="stad-dc-depth-mins">' + (d.minutes != null ? Math.round(d.minutes) + "'" : "—") + '</span>' +
                                '<span class="stad-dc-depth-gap ' + c + '">' + t + '</span>' +
                            '</div>'
                        );
                    }).join("") +
                  '</div>'
                : ''
            )
        );
    }

    // ---------- ball ----------

    function moveBall(slot, prevId, instant) {
        const mount = overlay.querySelector(".stad-ball-mount");
        if (!mount) return;

        // Pitch coords → percentage of the pitch container (same mapping
        // as the slots: X+ right, Y+ attacking direction = smaller top).
        mount.style.setProperty("--bx", slot.x);
        mount.style.setProperty("--by", slot.y);

        if (instant || !prevId || prevId === slot.id) {
            // No jump: just teleport (initial placement).
            mount.classList.remove("is-flying");
            return;
        }

        // Arc height scales with horizontal distance — a longer pass
        // gets a higher arc. Distance in pitch units; max diag ≈ 100.
        const prev = FORMATION.find(f => f.id === prevId);
        const dx = slot.x - (prev ? prev.x : slot.x);
        const dy = slot.y - (prev ? prev.y : slot.y);
        const dist = Math.sqrt(dx * dx + dy * dy);
        const arc = Math.min(240, 60 + dist * 2.2);   // px, world-vertical
        mount.style.setProperty("--arc-h", (-arc).toFixed(0) + "px");

        // Spin: direction based on horizontal travel sign, 1 to 2 rotations.
        const spin = dx >= 0 ? 1 : -1;
        const turns = 1 + Math.min(1.2, dist / 70);
        mount.style.setProperty("--arc-spin", (spin * turns * 360).toFixed(0) + "deg");

        // Re-trigger the arc animation by removing + re-adding the class
        // on next frame (class-remove alone doesn't reset a forwards anim).
        mount.classList.remove("is-flying");
        void mount.offsetWidth;
        mount.classList.add("is-flying");
    }

    // ---------- keyboard ----------

    function attachKeys() {
        if (keyHandler) return;
        keyHandler = (e) => {
            if (!overlay || !overlay.classList.contains("is-open")) return;
            if (e.key === "Escape") { window.closeAct2Stadium(); return; }
            const order = ["GK","LCB","RCB","LB","RB","LDM","RDM","LW","AM","RW","ST"];
            const idx = order.indexOf(activeSlot);
            if (e.key === "ArrowRight") { focusSlot(order[(idx + 1) % order.length]); e.preventDefault(); }
            if (e.key === "ArrowLeft")  { focusSlot(order[(idx - 1 + order.length) % order.length]); e.preventDefault(); }
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                const slot = FORMATION.find(f => f.id === activeSlot);
                const squad = slot ? (currentLineup[slot.id] || []) : [];
                if (slot && squad.length > 1) {
                    const dir = e.key === "ArrowDown" ? 1 : -1;
                    activePlayerIdx = (activePlayerIdx + dir + squad.length) % squad.length;
                    renderSlotDetail(slot, { silent: true });
                }
                e.preventDefault();
            }
        };
        window.addEventListener("keydown", keyHandler);
    }
    function detachKeys() {
        if (!keyHandler) return;
        window.removeEventListener("keydown", keyHandler);
        keyHandler = null;
    }

    // ---------- utils ----------

    function escapeHtml(s) {
        return String(s == null ? "" : s)
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }
    function cssUrl(u) {
        return '"' + String(u).replace(/"/g, '\\"') + '"';
    }

    // Render a square face slot: initials sit behind an <img> whose src points
    // at the Transfermarkt portrait. If the photo is null or the request 404s
    // (timestamps drift, backfill gaps), the img is removed and the initials
    // show through instead of an empty square.
    function photoHTML(player, cls) {
        if (!player) return '<div class="' + cls + '-wrap is-blank"></div>';
        const initials = initialsFor(player.name);
        const img = player.photo
            ? '<img class="' + cls + '" src="' + escapeHtml(player.photo) + '" alt="" loading="lazy" onerror="this.remove()"/>'
            : '';
        return (
            '<div class="' + cls + '-wrap' + (player.photo ? '' : ' is-blank') + '">' +
                '<span class="' + cls + '-initials">' + escapeHtml(initials) + '</span>' +
                img +
            '</div>'
        );
    }
    function initialsFor(name) {
        if (!name) return "?";
        const parts = String(name).trim().split(/\s+/).filter(Boolean);
        if (!parts.length) return "?";
        if (parts.length === 1) return parts[0][0].toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
})();
