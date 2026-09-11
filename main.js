const designs = {

    desktop: {
        label: "Desktop",

        items: [
            {
                id: "main",
                name: "Main Experience",
                path: "desktop%20mockup/productivity_agent_desktop_mockup.html"
            },
            {
                id: "onboarding",
                name: "Onboarding",
                path: "desktop%20mockup/agent_onboarding_desktop_mockup.html"
            },
            {
                id: "settings",
                name: "Settings",
                path: "desktop%20mockup/agent_settings_desktop_mockup.html"
            },
            {
                id: "review",
                name: "Annotated Review",
                path: "desktop%20mockup/annotated_review_desktop.html"
            }
        ]
    },

    mobile: {
        label: "Mobile",

        items: [
            {
                id: "main",
                name: "Main Experience",
                path: "mobile%20mockup/productivity_agent_mockup.html"
            },
            {
                id: "onboarding",
                name: "Onboarding",
                path: "mobile%20mockup/agent_onboarding_mockup.html"
            },
            {
                id: "settings",
                name: "Settings",
                path: "mobile%20mockup/agent_settings_mockup.html"
            },
            {
                id: "review",
                name: "Annotated Review",
                path: "mobile%20mockup/annotated_review.html"
            }
        ]
    },

    alternatives: {
        label: "Alternatives",

        items: [
            {
                id: "digest",
                name: "Digest",
                path: "alternative%20digest/productivity_agent_digest_mockup.html"
            },
            {
                id: "digest-review",
                name: "Digest Review",
                path: "alternative%20digest/digest_annotated_review.html"
            },
            {
                id: "swiping",
                name: "Swiping",
                path: "alternative%20swiping/productivity_agent_mockup_deck.html"
            },
            {
                id: "swiping-review",
                name: "Swiping Review",
                path: "alternative%20swiping/annotated_review_deck.html"
            },
            {
                id: "texting",
                name: "Texting",
                path: "alternative%20texting/productivity_agent_mockup_chat.html"
            },
            {
                id: "texting-review",
                name: "Texting Review",
                path: "alternative%20texting/annotated_review_chat.html"
            }
        ]
    }
};


/* =========================================================
    ELEMENTS
========================================================= */

const primaryNav = document.getElementById("primary-nav");
const subnav = document.getElementById("subnav");
const iframe = document.getElementById("mockup-frame");
const loading = document.getElementById("loading");
const errorMessage = document.getElementById("error-message");

const openButton = document.getElementById("open-button");
const fullscreenButton = document.getElementById("fullscreen-button");
const fullscreenExitButton = document.getElementById("fullscreen-exit-button");
const themeButton = document.getElementById("theme-button");
const zoomOutButton = document.getElementById("zoom-out-button");
const zoomInButton = document.getElementById("zoom-in-button");
const fitButton = document.getElementById("fit-button");
const zoomValue = document.getElementById("zoom-value");

const backButton = document.getElementById("back-button");
const forwardButton = document.getElementById("forward-button");


/* =========================================================
    STATE
========================================================= */

let currentCategory = "desktop";
let currentDesign = "main";

let currentPath = "";
let viewerDarkMode = localStorage.getItem("productivity-agent-viewer-theme") === "dark";
let previewZoom = 1;
let fitMode = true;


/* =========================================================
    HELPERS
========================================================= */

function getCategory(categoryId) {
    return designs[categoryId];
}


function getDesign(categoryId, designId) {
    const category = getCategory(categoryId);

    if (!category) {
        return null;
    }

    return category.items.find(
        item => item.id === designId
    ) || null;
}


function getCurrentDesign() {
    return getDesign(
        currentCategory,
        currentDesign
    );
}


function getAllDesigns() {
    const all = [];

    Object.entries(designs).forEach(
        ([categoryId, category]) => {

            category.items.forEach(item => {
                all.push({
                    categoryId,
                    ...item
                });
            });

        }
    );

    return all;
}


/* =========================================================
    URL / HASH ROUTING

    Examples:

        #desktop/main
        #desktop/onboarding
        #mobile/settings
        #alternatives/digest
        #alternatives/texting
========================================================= */

function parseHash() {

    const hash = window.location.hash
        .replace(/^#/, "");

    if (!hash) {
        return null;
    }

    const parts = hash.split("/");

    const categoryId = parts[0];
    const designId = parts[1];

    if (
        !designs[categoryId] ||
        !getDesign(categoryId, designId)
    ) {
        return null;
    }

    return {
        categoryId,
        designId
    };
}


function updateHash(
    categoryId,
    designId,
    replace = false
) {

    const hash = `#${categoryId}/${designId}`;

    if (replace) {
        history.replaceState(
            null,
            "",
            hash
        );
    } else {
        history.pushState(
            null,
            "",
            hash
        );
    }
}


/* =========================================================
    PRIMARY NAV
========================================================= */

function renderPrimaryNav() {

    primaryNav.innerHTML = "";

    Object.entries(designs).forEach(
        ([categoryId, category]) => {

            const button =
                document.createElement("button");

            button.type = "button";

            button.className = "nav-button";

            button.textContent =
                category.label;

            button.dataset.category =
                categoryId;

            button.addEventListener(
                "click",
                () => {

                    const firstDesign =
                        category.items[0];

                    navigate(
                        categoryId,
                        firstDesign.id
                    );
                }
            );

            primaryNav.appendChild(button);
        }
    );

    updatePrimaryNav();
}


function updatePrimaryNav() {

    document
        .querySelectorAll(".nav-button")
        .forEach(button => {

            button.classList.toggle(
                "active",
                button.dataset.category ===
                    currentCategory
            );
        });
}


/* =========================================================
    SECONDARY NAV
========================================================= */

function renderSubnav() {

    const category =
        getCategory(currentCategory);

    if (!category) {
        return;
    }

    subnav.innerHTML = "";

    const label =
        document.createElement("span");

    label.className =
        "subnav-label";

    label.textContent =
        category.label;

    subnav.appendChild(label);


    category.items.forEach(item => {

        const button =
            document.createElement("button");

        button.type = "button";

        button.className =
            "design-button";

        button.textContent =
            item.name;

        button.dataset.design =
            item.id;

        button.addEventListener(
            "click",
            () => {

                navigate(
                    currentCategory,
                    item.id
                );
            }
        );

        subnav.appendChild(button);
    });

    updateSubnav();
}


function updateSubnav() {

    document
        .querySelectorAll(".design-button")
        .forEach(button => {

            button.classList.toggle(
                "active",
                button.dataset.design ===
                    currentDesign
            );
        });
}


/* =========================================================
    NAVIGATION
========================================================= */

function navigate(
    categoryId,
    designId,
    options = {}
) {

    const design =
        getDesign(
            categoryId,
            designId
        );

    if (!design) {
        return;
    }

    const {
        updateUrl = true,
        replace = false
    } = options;

    currentCategory =
        categoryId;

    currentDesign =
        designId;

    currentPath =
        design.path;


    updatePrimaryNav();

    renderSubnav();


    if (updateUrl) {
        updateHash(
            categoryId,
            designId,
            replace
        );
    }


    loadDesign(design);
}


/* =========================================================
    LOAD MOCKUP
========================================================= */

function loadDesign(design) {

    errorMessage.hidden = true;

    loading.classList.add("visible");

    iframe.style.opacity = "0";

    iframe.src = design.path;
}


iframe.addEventListener(
    "load",
    () => {

        loading.classList.remove(
            "visible"
        );

        errorMessage.hidden = true;

        requestAnimationFrame(applyDefaultPreviewScale);
        iframe.style.opacity = "1";
    }
);


iframe.addEventListener(
    "error",
    () => {

        loading.classList.remove(
            "visible"
        );

        iframe.style.opacity = "0";

        errorMessage.hidden = false;
    }
);


/* =========================================================
    BROWSER HISTORY
========================================================= */

window.addEventListener(
    "popstate",
    () => {

        const route =
            parseHash();

        if (!route) {
            return;
        }

        navigate(
            route.categoryId,
            route.designId,
            {
                updateUrl: false
            }
        );
    }
);


window.addEventListener(
    "hashchange",
    () => {

        const route =
            parseHash();

        if (!route) {
            return;
        }

        if (
            route.categoryId ===
                currentCategory &&
            route.designId ===
                currentDesign
        ) {
            return;
        }

        navigate(
            route.categoryId,
            route.designId,
            {
                updateUrl: false
            }
        );
    }
);


/* =========================================================
    PREVIOUS / NEXT
========================================================= */

function navigateRelative(direction) {

    const all =
        getAllDesigns();

    const index =
        all.findIndex(item =>
            item.categoryId ===
                currentCategory &&
            item.id ===
                currentDesign
        );

    if (index === -1) {
        return;
    }

    let nextIndex =
        index + direction;

    if (nextIndex < 0) {
        nextIndex =
            all.length - 1;
    }

    if (nextIndex >= all.length) {
        nextIndex = 0;
    }

    const next =
        all[nextIndex];

    navigate(
        next.categoryId,
        next.id
    );
}


backButton.addEventListener(
    "click",
    () => navigateRelative(-1)
);


forwardButton.addEventListener(
    "click",
    () => navigateRelative(1)
);


/* =========================================================
    KEYBOARD NAVIGATION
========================================================= */

document.addEventListener(
    "keydown",
    event => {

        /*
            * Don't intercept keyboard shortcuts while
            * the user is typing into the mockup page.
            *
            * Because the mockup is inside an iframe,
            * this primarily protects the viewer itself.
            */

        if (
            event.target.tagName === "INPUT" ||
            event.target.tagName === "TEXTAREA" ||
            event.target.isContentEditable
        ) {
            return;
        }

        if (event.key === "ArrowLeft") {
            event.preventDefault();

            navigateRelative(-1);
        }

        if (event.key === "ArrowRight") {
            event.preventDefault();

            navigateRelative(1);
        }

        if (event.key === "f") {
            toggleFullscreen();
        }
    }
);


/* =========================================================
    OPEN IN NEW TAB
========================================================= */

openButton.addEventListener(
    "click",
    () => {

        const design =
            getCurrentDesign();

        if (!design) {
            return;
        }

        window.open(
            design.path,
            "_blank",
            "noopener,noreferrer"
        );
    }
);


/* =========================================================
    FULLSCREEN
========================================================= */

function syncViewerTheme() {
    document.body.classList.toggle("viewer-dark-mode", viewerDarkMode);
    themeButton.setAttribute("aria-pressed", String(viewerDarkMode));
    themeButton.textContent = viewerDarkMode ? "☾" : "◐";
    themeButton.title = viewerDarkMode ? "Switch viewer to light mode" : "Switch viewer to dark mode";
    themeButton.setAttribute("aria-label", themeButton.title);
}

function getPreviewDocument() {
    try { return iframe.contentDocument; } catch (error) { return null; }
}

function renderZoom() {
    const label = `${Math.round(previewZoom * 100)}%`;
    zoomValue.value = label;
    zoomValue.textContent = label;
    fitButton.classList.toggle("active", fitMode);
}

function applyPreviewZoom() {
    const previewDocument = getPreviewDocument();
    renderZoom();
    if (!previewDocument || !previewDocument.documentElement) return;
    previewDocument.documentElement.style.zoom = String(previewZoom);
}

function setPreviewZoom(value, fromFit = false) {
    previewZoom = Math.max(.35, Math.min(1.5, Math.round(value * 100) / 100));
    fitMode = fromFit;
    applyPreviewZoom();
}

function isAnnotatedReview(design) {
    return /(?:^|[\/_-])annotated[_-]?review(?:[\/_.-]|$)|review[_-]?annotated/i.test(design?.path || "");
}

function applyDefaultPreviewScale() {
    const design = getCurrentDesign();
    if (isAnnotatedReview(design)) {
        setPreviewZoom(.95, false);
    } else {
        fitPreviewToViewport();
    }
}

function fitPreviewToViewport() {
    const previewDocument = getPreviewDocument();
    if (!previewDocument || !iframe.clientWidth || !iframe.clientHeight) return;
    // Measure at natural scale, then scale the prototype to the iframe's usable area.
    previewDocument.documentElement.style.zoom = "1";
    const deviceFrame = previewDocument.querySelector(".device-frame");
    const contentWidth = Math.max(deviceFrame?.offsetWidth || 0, previewDocument.documentElement.scrollWidth, previewDocument.body?.scrollWidth || 0);
    const contentHeight = Math.max(deviceFrame?.offsetHeight || 0, previewDocument.documentElement.scrollHeight, previewDocument.body?.scrollHeight || 0);
    if (!contentWidth || !contentHeight) return setPreviewZoom(1, true);
    setPreviewZoom(Math.min(1, iframe.clientWidth / contentWidth, iframe.clientHeight / contentHeight), true);
}

themeButton.addEventListener("click", () => {
    viewerDarkMode = !viewerDarkMode;
    localStorage.setItem("productivity-agent-viewer-theme", viewerDarkMode ? "dark" : "light");
    syncViewerTheme();
});
zoomOutButton.addEventListener("click", () => setPreviewZoom(previewZoom - .1));
zoomInButton.addEventListener("click", () => setPreviewZoom(previewZoom + .1));
fitButton.addEventListener("click", fitPreviewToViewport);
window.addEventListener("resize", () => { if (fitMode) requestAnimationFrame(fitPreviewToViewport); });

function syncFullscreenControls() {
    const active = document.body.classList.contains("fullscreen");
    fullscreenButton.textContent = active ? "Exit Fullscreen" : "Fullscreen";
    fullscreenButton.title = active ? "Exit fullscreen" : "Enter fullscreen";
    fullscreenButton.setAttribute("aria-pressed", String(active));
}

async function enterFullscreen() {
    document.body.classList.add("fullscreen");
    syncFullscreenControls();
    try { if (document.body.requestFullscreen && !document.fullscreenElement) await document.body.requestFullscreen(); } catch (error) {}
    if (fitMode && !isAnnotatedReview(getCurrentDesign())) requestAnimationFrame(fitPreviewToViewport);
}
async function exitFullscreen() {
    document.body.classList.remove("fullscreen");
    syncFullscreenControls();
    try { if (document.fullscreenElement) await document.exitFullscreen(); } catch (error) {}
    if (fitMode && !isAnnotatedReview(getCurrentDesign())) requestAnimationFrame(fitPreviewToViewport);
}
function toggleFullscreen() { return document.body.classList.contains("fullscreen") ? exitFullscreen() : enterFullscreen(); }
document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement) document.body.classList.remove("fullscreen");
    syncFullscreenControls();
    if (fitMode && !isAnnotatedReview(getCurrentDesign())) requestAnimationFrame(fitPreviewToViewport);
});
fullscreenButton.addEventListener("click", toggleFullscreen);
fullscreenExitButton.addEventListener("click", exitFullscreen);
document.addEventListener("keydown", event => { if (event.key === "Escape" && document.body.classList.contains("fullscreen")) exitFullscreen(); });


/* =========================================================
    INITIALIZATION
========================================================= */

function initialize() {

    syncViewerTheme();
    renderZoom();
    renderPrimaryNav();

    const route =
        parseHash();

    if (route) {

        navigate(
            route.categoryId,
            route.designId,
            {
                updateUrl: false
            }
        );

        return;
    }


    /*
        * Default view:
        * Desktop → Main Experience
        */

    navigate(
        "desktop",
        "main",
        {
            replace: true
        }
    );
}


initialize();