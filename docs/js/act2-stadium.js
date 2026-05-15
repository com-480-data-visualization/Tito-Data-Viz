(function () {
    let FORMATION = parseFormation("4-2-3-1");

    let overlay = null;
    let activeSlot = null;
    let activePlayerIdx = 0;
    let keyHandler = null;
    let currentLineup = {};

    window.openAct2Stadium = function (club, opts) {
        if (!club) return;
        opts = opts || {};
        ensureOverlay();
        populate(club);
        overlay.setAttribute("aria-hidden", "false");
        overlay.classList.add("is-open");
        document.body.classList.add("stadium-locked");
        document.body.classList.add("stadium-active");

        let target = { slot: null, idx: 0 };
        if (opts.preselectPlayer) {
            for (const f of FORMATION) {
                const squad = currentLineup[f.id] || [];
                const i = squad.findIndex(p => p.name === opts.preselectPlayer);
                if (i >= 0) { target = { slot: f.id, idx: i }; break; }
            }
        }

        requestAnimationFrame(() => {
            overlay.classList.add("is-lit");
            const opener = defaultSlotId();
            focusSlot(opener, { instant: true, silent: true });
            setTimeout(() => {
                if (target.slot) {
                    activePlayerIdx = target.idx;
                    focusSlot(target.slot, { keepIdx: true });
                } else {
                    focusSlot(opener);
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
        document.body.classList.remove("stadium-active");
        detachKeys();
    };

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
                '<button class="stad-close" aria-label="Close stadium">' +
                    '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">' +
                        '<path d="M6 6l12 12M18 6l-12 12"/>' +
                    '</svg>' +
                '</button>' +
            '</header>' +

            '<div class="stad-lower-third">' +
                '<div class="stad-lt-role">-</div>' +
                '<div class="stad-lt-name">-</div>' +
            '</div>' +

            '<aside class="stad-detail" aria-live="polite">' +
                '<header class="stad-rail-head">' +
                    '<span class="stad-kicker">§ 05 &middot; THE CATHEDRAL</span>' +
                    '<h3 class="stad-title"><span class="stad-club-name">-</span></h3>' +
                    '<p class="stad-sub">The squad, arranged where they play.</p>' +
                '</header>' +
                '<div class="stad-detail-inner">-</div>' +
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
        return (
            '<svg class="stad-bowl" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" aria-hidden="true">' +
                '<path class="stad-bowl-far"  d="M 0 520 C 260 340, 560 270, 800 262 C 1040 270, 1340 340, 1600 520 L 1600 900 L 0 900 Z"/>' +
                '<path class="stad-bowl-mid"  d="M 0 620 C 300 460, 580 400, 800 394 C 1020 400, 1300 460, 1600 620 L 1600 900 L 0 900 Z"/>' +
                '<path class="stad-bowl-near" d="M 0 760 C 340 630, 600 580, 800 574 C 1000 580, 1260 630, 1600 760 L 1600 900 L 0 900 Z"/>' +
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
                '<rect x="-48" y="-48" width="96" height="96" fill="none" stroke="rgba(212,175,55,0.22)" stroke-width="0.35"/>' +
                '<line x1="-48" y1="0" x2="48" y2="0" stroke="rgba(212,175,55,0.18)" stroke-width="0.25"/>' +
                '<circle cx="0" cy="0" r="9" fill="none" stroke="rgba(212,175,55,0.2)" stroke-width="0.25"/>' +
                '<circle cx="0" cy="0" r="0.8" fill="rgba(212,175,55,0.35)"/>' +
                '<rect x="-20" y="-48" width="40" height="16" fill="none" stroke="rgba(212,175,55,0.18)" stroke-width="0.25"/>' +
                '<rect x="-8"  y="-48" width="16" height="6"  fill="none" stroke="rgba(212,175,55,0.18)" stroke-width="0.25"/>' +
                '<circle cx="0" cy="-37" r="0.7" fill="rgba(212,175,55,0.3)"/>' +
                '<path d="M -8 -36 A 9 9 0 0 0 8 -36" fill="none" stroke="rgba(212,175,55,0.14)" stroke-width="0.22"/>' +
                '<rect x="-20" y="32" width="40" height="16" fill="none" stroke="rgba(212,175,55,0.18)" stroke-width="0.25"/>' +
                '<rect x="-8"  y="42" width="16" height="6"  fill="none" stroke="rgba(212,175,55,0.18)" stroke-width="0.25"/>' +
                '<circle cx="0" cy="37" r="0.7" fill="rgba(212,175,55,0.3)"/>' +
                '<path d="M -8 36 A 9 9 0 0 1 8 36" fill="none" stroke="rgba(212,175,55,0.14)" stroke-width="0.22"/>' +
                '<path d="M -48 -46 A 2 2 0 0 1 -46 -48" fill="none" stroke="rgba(212,175,55,0.18)" stroke-width="0.22"/>' +
                '<path d="M  46 -48 A 2 2 0 0 1  48 -46" fill="none" stroke="rgba(212,175,55,0.18)" stroke-width="0.22"/>' +
                '<path d="M -48  46 A 2 2 0 0 0 -46  48" fill="none" stroke="rgba(212,175,55,0.18)" stroke-width="0.22"/>' +
                '<path d="M  46  48 A 2 2 0 0 0  48  46" fill="none" stroke="rgba(212,175,55,0.18)" stroke-width="0.22"/>' +
            '</svg>'
        );
    }

    function ballMount() {
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

    function populate(club) {
        if (!overlay) return;

        const clubNameEl = overlay.querySelector(".stad-club-name");
        const logoUrl = club.logo || (club.players && club.players[0] && club.players[0].clubLogo);
        if (logoUrl) {
            clubNameEl.innerHTML = '<img class="stad-club-logo" src="' + logoUrl + '" alt="" />' + escapeHtml(club.name || "-");
        } else {
            clubNameEl.textContent = club.name || "-";
        }

        const formationStr = inferBestFormation(club.players) || clubFormation(club);
        club.formation = formationStr;
        FORMATION = parseFormation(formationStr);
        const miniLbl = overlay.querySelector(".stad-hud-mini-lbl");
        if (miniLbl) miniLbl.textContent = "FORMATION · " + formationStr;
        const miniSvg = overlay.querySelector(".stad-hud-mini svg");
        if (miniSvg) {
            const frame = miniSvg.querySelector(".mp-frame");
            const half = miniSvg.querySelector(".mp-half");
            const centre = miniSvg.querySelector(".mp-centre");
            miniSvg.innerHTML = "";
            if (frame) miniSvg.appendChild(frame);
            if (half) miniSvg.appendChild(half);
            if (centre) miniSvg.appendChild(centre);
            FORMATION.forEach(f => {
                const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                c.setAttribute("class", "mp-slot");
                c.setAttribute("data-slot", f.id);
                c.setAttribute("cx", 50 + f.x * 0.6);
                c.setAttribute("cy", 50 - f.y * 0.6);
                c.setAttribute("r", 2.8);
                const t = document.createElementNS("http://www.w3.org/2000/svg", "title");
                t.textContent = f.label;
                c.appendChild(t);
                miniSvg.appendChild(c);
            });
        }

        currentLineup = assignPlayers(club.players || []);

        const host = overlay.querySelector(".stad-positions");
        host.innerHTML = "";

        FORMATION.forEach((slot, i) => {
            const squad = currentLineup[slot.id] || [];
            const node = buildSlotNode(slot, squad, i);
            host.appendChild(node);
        });

        resolveCardOverlaps(host);
        requestAnimationFrame(() => detectNameOverflow(host));

        const mini = overlay.querySelector(".stad-hud-mini svg");
        mini.querySelectorAll(".mp-slot").forEach(el => {
            el.addEventListener("click", () => focusSlot(el.dataset.slot));
        });
    }

    // long names get a marquee, measured once they mount
    function detectNameOverflow(host) {
        host.querySelectorAll(".stad-card-body").forEach(body => {
            const name = body.querySelector(".stad-card-name");
            if (!name) return;
            const overflow = name.scrollWidth - body.clientWidth;
            if (overflow > 2) {
                body.dataset.overflow = "1";
                name.style.setProperty("--marquee-end", "-" + overflow + "px");
            } else {
                body.dataset.overflow = "0";
                name.style.removeProperty("--marquee-end");
            }
        });
    }

    function resolveCardOverlaps(host) {
        const rows = new Map();
        FORMATION.forEach(slot => {
            const key = Math.round(slot.y / 6) * 6;
            if (!rows.has(key)) rows.set(key, []);
            rows.get(key).push(slot);
        });
        rows.forEach(slots => {
            if (slots.length < 4) return;
            slots.sort((a, b) => a.x - b.x);
            slots.forEach((slot, i) => {
                const node = host.querySelector('[data-slot="' + slot.id + '"]');
                if (!node) return;
                const card = node.querySelector(".stad-slot-card");
                if (!card) return;
                const offset = (i % 2 === 0) ? "-12px" : "12px";
                card.style.setProperty("--card-y-offset", offset);
            });
        });
    }

    function buildSlotNode(slot, squad, order) {
        const el = document.createElement("div");
        el.className = "stad-slot";
        el.dataset.slot = slot.id;
        el.style.setProperty("--sx", slot.x);
        el.style.setProperty("--sy", slot.y);
        if (slot.y <= -40) el.dataset.cardSide = "below";
        el.style.setProperty("--sd", order * 0.05 + "s");

        el.style.setProperty("--dp", "1");

        const top = squad[0];
        const extraN = squad.length > 1 ? (squad.length - 1) : 0;
        const extraHTML = extraN > 0 ? '<span class="stad-card-extra">+' + extraN + '</span>' : "";
        const gap = top ? top.gap : null;
        const gapCls = gap == null ? "" : (gap > 1 ? "is-up" : gap < -1 ? "is-dn" : "is-mid");
        const gapTxt = gap == null ? "-" : (gap > 0 ? "+" : "") + gap.toFixed(1);

        el.innerHTML =
            '<div class="stad-slot-disc"><span class="stad-slot-code">' + slot.id + '</span></div>' +
            '<div class="stad-slot-tower">' +
                '<div class="stad-slot-tower-shaft"></div>' +
                '<div class="stad-slot-card ' + gapCls + '">' +
                    photoHTML(top, "stad-card-photo") +
                    '<div class="stad-card-body">' +
                        '<div class="stad-card-name">' + escapeHtml(top ? top.name : "No data") + '</div>' +
                    '</div>' +
                    '<div class="stad-card-gap">' + gapTxt + '</div>' +
                    extraHTML +
                '</div>' +
            '</div>';

        el.addEventListener("click", (e) => {
            e.stopPropagation();
            focusSlot(slot.id);
        });

        return el;
    }

    function assignPlayers(players) {
        // group by bucket, sort each by minutes
        const by = {};
        for (const p of players) {
            const b = p.subPos || p.pos || "";
            (by[b] = by[b] || []).push(p);
        }
        for (const k of Object.keys(by)) {
            by[k].sort((a, b) => (b.minutes || 0) - (a.minutes || 0));
        }

        // xi = the 11 most-played, not the best positional fit
        const valid = players.filter(p => typeof p.minutes === "number" && p.minutes > 0);
        const sortedAll = valid.slice().sort((a, b) => (b.minutes || 0) - (a.minutes || 0));
        const topGk = sortedAll.find(p => p.subPos === "GK");
        const topOutfield = sortedAll.filter(p => p.subPos !== "GK").slice(0, 10);
        const top11 = new Set([topGk, ...topOutfield].filter(Boolean).map(p => p.name));

        const assignment = {};
        const used = new Set();

        // fill slots down the fallback chain, top-11 first
        const maxLevel = Math.max(...FORMATION.map(s => s.buckets.length));
        const fillSlot = (slot, restrictTop11) => {
            for (const bucket of slot.buckets) {
                const pool = by[bucket];
                if (!pool) continue;
                for (const p of pool) {
                    if (used.has(p.name)) continue;
                    if (restrictTop11 && !top11.has(p.name)) continue;
                    used.add(p.name);
                    return p;
                }
            }
            return null;
        };
        for (let level = 0; level < maxLevel; level++) {
            for (const slot of FORMATION) {
                if (assignment[slot.id]) continue;
                const bucket = slot.buckets[level];
                if (!bucket) continue;
                const pool = by[bucket];
                if (!pool) continue;
                const top = pool.find(p => !used.has(p.name) && top11.has(p.name));
                if (top) {
                    assignment[slot.id] = [top];
                    used.add(top.name);
                }
            }
        }
        // any slot still empty, fill it from anyone
        for (const slot of FORMATION) {
            if (assignment[slot.id]) continue;
            const picked = fillSlot(slot, false);
            assignment[slot.id] = picked ? [picked] : [];
        }

        // spread whoever is left across matching slots as depth
        const remainingBy = {};
        for (const b of Object.keys(by)) {
            remainingBy[b] = by[b].filter(p => !used.has(p.name));
        }
        for (const slot of FORMATION) {
            for (const bucket of slot.buckets) {
                const pool = remainingBy[bucket];
                if (!pool) continue;
                const slotsWithBucket = FORMATION.filter(f => f.buckets.includes(bucket));
                // round-robin, one extra per slot each pass
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

    function focusSlot(id, opts) {
        opts = opts || {};
        const slot = FORMATION.find(f => f.id === id);
        if (!slot) return;
        const prevSlot = activeSlot;
        activeSlot = id;

        overlay.querySelectorAll(".mp-slot").forEach(el => {
            el.classList.toggle("is-active", el.dataset.slot === id);
        });
        overlay.querySelectorAll(".stad-slot").forEach(el => {
            el.classList.toggle("is-active", el.dataset.slot === id);
        });

        moveBall(slot, prevSlot, !!opts.instant);

        const stage = overlay.querySelector(".stad-stage");
        stage.style.setProperty("--cam-yaw", "0deg");
        stage.style.setProperty("--cam-x", "0vw");
        stage.style.setProperty("--cam-y", "0vh");

        if (!opts.keepIdx) activePlayerIdx = 0;
        renderSlotDetail(slot, { silent: !!opts.silent });
    }

    function defaultSlotId() {
        const preferred = ["ST", "AM", "CM", "WG", "DM", "CB", "FB", "GK"];
        for (const bucket of preferred) {
            const slot = FORMATION.find(f => f.buckets.includes(bucket));
            if (slot) return slot.id;
        }
        return FORMATION[0] ? FORMATION[0].id : null;
    }

    function renderSlotDetail(slot, opts) {
        opts = opts || {};
        const squad = (currentLineup[slot.id] || []);
        const idx = Math.max(0, Math.min(activePlayerIdx, Math.max(0, squad.length - 1)));
        const p = squad[idx];

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
        const fullCardBtn = detail.querySelector(".stad-dc-full-btn");
        if (fullCardBtn && p) {
            fullCardBtn.addEventListener("click", () => {
                if (typeof window.openAct2Modal === "function") {
                    window.openAct2Modal(p, window.__playersData || []);
                }
            });
        }
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
        const ovr = (p.ea && p.ea.ovr != null) ? p.ea.ovr : "-";
        const composite = p.composite != null ? p.composite : null;
        const expected = (composite != null) ? composite - gap : null;
        const verdict = gap > 5 ? "Underrated" : gap > 1 ? "Slightly underrated"
                       : gap < -5 ? "Overrated" : gap < -1 ? "Slightly overrated"
                       : "Fairly rated";
        const narrative = gap > 1
            ? "Real output runs ahead of the EA stamp. The pitch reports a stronger profile than the card suggests."
            : gap < -1
                ? "EA's stamp leans on reputation. The numbers from this season undercut the OVR by a clear margin."
                : "EA and the data agree here. The OVR matches what the season actually produced.";

        const playerRoleLabel = labelFor(p.subPos || p.pos) || slot.label;
        return (
            '<div class="stad-dc-head">' +
                photoHTML(p, "stad-dc-photo") +
                '<div class="stad-dc-id">' +
                    '<div class="stad-dc-role">' + slot.id + ' &middot; ' + escapeHtml(playerRoleLabel) +
                        (squad.length > 1 ? ' &middot; <span class="stad-dc-depth-idx">' + (i + 1) + ' / ' + squad.length + '</span>' : '') +
                    '</div>' +
                    '<div class="stad-dc-name">' + escapeHtml(p.name) + '</div>' +
                    '<div class="stad-dc-meta">' +
                        escapeHtml(p.tm_position || p.subPos || p.pos || "-") +
                        ' &middot; ' + (p.minutes != null ? Math.round(p.minutes) + "'" : "-") +
                        (p.age != null ? ' &middot; ' + p.age + ' yrs' : "") +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<div class="stad-dc-hero ' + gapCls + '">' +
                '<span class="stad-dc-hero-lbl">Reputation gap</span>' +
                '<span class="stad-dc-hero-num">' + gapTxt + '</span>' +
                '<span class="stad-dc-hero-verdict">' + verdict + '</span>' +
            '</div>' +
            '<div class="stad-dc-stats">' +
                '<div class="stad-dc-stat"><span class="stad-dc-v">' + ovr + '</span><span class="stad-dc-l">EA OVR</span></div>' +
                '<div class="stad-dc-stat"><span class="stad-dc-v">' + (composite != null ? composite.toFixed(1) : "-") + '</span><span class="stad-dc-l">Composite</span></div>' +
                '<div class="stad-dc-stat"><span class="stad-dc-v">' + (expected != null ? expected.toFixed(1) : "-") + '</span><span class="stad-dc-l">Expected</span></div>' +
            '</div>' +
            '<p class="stad-dc-copy">' + narrative + '</p>' +
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
                                '<span class="stad-dc-depth-mins">' + (d.minutes != null ? Math.round(d.minutes) + "'" : "-") + '</span>' +
                                '<span class="stad-dc-depth-gap ' + c + '">' + t + '</span>' +
                            '</div>'
                        );
                    }).join("") +
                  '</div>'
                : ''
            ) +
            '<dl class="stad-dc-profile">' +
                '<div><dt>Nationality</dt><dd>' + escapeHtml(p.nationality || "-") + '</dd></div>' +
                (p.foot ? '<div><dt>Preferred foot</dt><dd>' + escapeHtml(p.foot) + '</dd></div>' : '') +
                (p.height ? '<div><dt>Height</dt><dd>' + p.height + ' cm</dd></div>' : '') +
                '<div><dt>Market value</dt><dd>' + fmtMV(p.market_value || p.marketValue || p.marketValueLatest) + '</dd></div>' +
                '<div><dt>Minutes 24-25</dt><dd>' + (p.minutes != null ? Math.round(p.minutes) + "'" : "-") + '</dd></div>' +
            '</dl>' +
            '<button class="stad-dc-full-btn" type="button">' +
                '<span>View card detail</span>' +
                '<span class="stad-dc-full-arrow">&rsaquo;</span>' +
            '</button>'
        );
    }

    function moveBall(slot, prevId, instant) {
        const mount = overlay.querySelector(".stad-ball-mount");
        if (!mount) return;

        mount.style.setProperty("--bx", slot.x);
        mount.style.setProperty("--by", slot.y);

        if (instant || !prevId || prevId === slot.id) {
            mount.classList.remove("is-flying");
            return;
        }

        // longer pass, higher arc
        const prev = FORMATION.find(f => f.id === prevId);
        const dx = slot.x - (prev ? prev.x : slot.x);
        const dy = slot.y - (prev ? prev.y : slot.y);
        const dist = Math.sqrt(dx * dx + dy * dy);
        const arc = Math.min(240, 60 + dist * 2.2);
        mount.style.setProperty("--arc-h", (-arc).toFixed(0) + "px");

        const spin = dx >= 0 ? 1 : -1;
        const turns = 1 + Math.min(1.2, dist / 70);
        mount.style.setProperty("--arc-spin", (spin * turns * 360).toFixed(0) + "deg");

        // force a reflow so the arc anim restarts
        mount.classList.remove("is-flying");
        void mount.offsetWidth;
        mount.classList.add("is-flying");
    }

    function attachKeys() {
        if (keyHandler) return;
        keyHandler = (e) => {
            if (!overlay || !overlay.classList.contains("is-open")) return;
            if (e.key === "Escape") { window.closeAct2Stadium(); return; }
            const order = FORMATION.map(f => f.id);
            const idx = order.indexOf(activeSlot);
            const safeIdx = idx >= 0 ? idx : 0;
            if (e.key === "ArrowRight") { focusSlot(order[(safeIdx + 1) % order.length]); e.preventDefault(); }
            if (e.key === "ArrowLeft")  { focusSlot(order[(safeIdx - 1 + order.length) % order.length]); e.preventDefault(); }
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

    function escapeHtml(s) {
        return String(s == null ? "" : s)
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }
    function fmtMV(v) {
        if (v == null || v === "") return "-";
        if (typeof v === "number") {
            if (v >= 1e6) return "\u20ac" + (v / 1e6).toFixed(1) + "M";
            if (v >= 1e3) return "\u20ac" + Math.round(v / 1e3) + "K";
            return "\u20ac" + v;
        }
        return String(v);
    }
    // initials sit behind the img, which removes itself on a 404
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
