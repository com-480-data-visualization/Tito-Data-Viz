(function () {
    let savedScrollY = 0;
    let openCount = 0;

    function lockScroll() {
        if (openCount === 0) {
            savedScrollY = window.scrollY || window.pageYOffset || 0;
            document.body.style.overflow = "hidden";
            document.body.classList.add("modal-scroll-locked");
        }
        openCount++;
    }

    function unlockScroll() {
        openCount = Math.max(0, openCount - 1);
        if (openCount === 0) {
            document.body.style.overflow = "";
            document.body.classList.remove("modal-scroll-locked");
            window.scrollTo(0, savedScrollY);
        }
    }

    // opts: renderBody, onClose, className
    window.createModalOverlay = function (opts) {
        opts = opts || {};
        const overlay = document.createElement("div");
        overlay.className = "shared-modal-overlay " + (opts.className || "");
        overlay.setAttribute("role", "dialog");
        overlay.setAttribute("aria-modal", "true");

        const backdrop = document.createElement("div");
        backdrop.className = "shared-modal-backdrop";

        const panel = document.createElement("div");
        panel.className = "shared-modal-panel";

        const closeBtn = document.createElement("button");
        closeBtn.type = "button";
        closeBtn.className = "shared-modal-close";
        closeBtn.setAttribute("aria-label", "Close");
        closeBtn.innerHTML = "&times;";

        const body = document.createElement("div");
        body.className = "shared-modal-body";

        panel.appendChild(closeBtn);
        panel.appendChild(body);
        overlay.appendChild(backdrop);
        overlay.appendChild(panel);
        document.body.appendChild(overlay);

        lockScroll();

        function close() {
            if (overlay._closed) return;
            overlay._closed = true;
            overlay.classList.remove("is-open");
            document.removeEventListener("keydown", onKey);
            unlockScroll();
            setTimeout(() => {
                if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                if (typeof opts.onClose === "function") opts.onClose();
            }, 200);
        }

        function onKey(e) {
            if (e.key === "Escape") close();
        }

        closeBtn.addEventListener("click", close);
        backdrop.addEventListener("click", close);
        document.addEventListener("keydown", onKey);

        if (typeof opts.renderBody === "function") opts.renderBody(body);

        requestAnimationFrame(() => overlay.classList.add("is-open"));

        return { overlay, body, close };
    };
})();
