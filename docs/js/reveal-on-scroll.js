(function() {
    const DEFAULTS = { threshold: 0.16, rootMargin: "0px 0px -10% 0px", stagger: 70 };

    function init(opts) {
        const cfg = Object.assign({}, DEFAULTS, opts || {});
        const io = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const idx = parseInt(entry.target.dataset.revealIdx, 10) || 0;
                    const delay = (cfg.stagger || 0) * idx;
                    setTimeout(() => entry.target.classList.add("is-revealed"), delay);
                    io.unobserve(entry.target);
                }
            });
        }, { threshold: cfg.threshold, rootMargin: cfg.rootMargin });
        const groupCounts = {};
        document.querySelectorAll("[data-reveal]").forEach((el) => {
            const group = el.dataset.revealGroup || "page";
            const idx = groupCounts[group] || 0;
            groupCounts[group] = idx + 1;
            el.dataset.revealIdx = idx;
            io.observe(el);
        });
    }

    window.revealOnScroll = init;

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => init());
    } else {
        init();
    }
})();
