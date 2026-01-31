const isDesktop = window.matchMedia("(pointer: fine)").matches;
const hLog = document.getElementById('hero-logo-wrapper'),
    nLog = document.getElementById('nav-logo-wrapper');
const hp = {
    eye: hLog.querySelector('.intero-occhio'),
    pup: hLog.querySelector('.p-mover'),
    brow: hLog.querySelector('.sopracciglio')
};
const np = {
    eye: nLog.querySelector('.intero-occhio'),
    pup: nLog.querySelector('.p-mover'),
    brow: nLog.querySelector('.sopracciglio')
};
const cursor = document.getElementById('custom-cursor'),
    container = document.getElementById('cursor-container');
const menuBtn = document.getElementById('nav-text-menu'),
    labelName = document.getElementById('label-name');

// --- INPUT (Coordinate target) ---
let mX = window.innerWidth / 2,
    mY = window.innerHeight / 2;
let tPX = mX, tPY = mY; // Target per pupille

// --- STATO ATTUALE (Per calcoli di direzione/velocità) ---
let cX = mX, cY = mY;
let cPX = mX, cPY = mY; // Stato attuale pupille
let breathTime = 0;

// --- FLAG DI CONTROLLO ---
let isMenuOpen = false, isSticky = false, gyroActive = false;
let idleTimeout, idleInterval;

// quickSetter è il metodo più veloce per aggiornare la posizione senza animazione
const xSet = gsap.quickSetter(cursor, "x", "px");
const ySet = gsap.quickSetter(cursor, "y", "px");

// Qui usiamo quickTo con una duration minima (0.1) per le trasformazioni, 
// così lo stretch e la rotazione sono fluidi ma non "indietro".
const scaleXTo = gsap.quickTo(cursor, "scaleX", { duration: 0.3, ease: "power2.out" });
const scaleYTo = gsap.quickTo(cursor, "scaleY", { duration: 0.3, ease: "power2.out" });

// Creiamo il motore di rotazione senza una durata fissa, la cambieremo noi
let rotationTo = gsap.quickTo(cursor, "rotation", { duration: 0.1, ease: "power2.out" });

let smoothMX = window.innerWidth / 2;
let smoothMY = window.innerHeight / 2;

// Parametro di Attrito: 
// 1.0 = istantaneo (nessun attrito)
// 0.1 = molto viscoso (ritardo marcato)
// 0.2 = bilanciato
const friction = 0.4;

// 1. NAVIGAZIONE
nLog.addEventListener('click', () => {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
});

// 2. LOGICA MOUSE & CURSORE
let stickyScale = 1; // Variabile di supporto per l'ingrandimento

document.addEventListener('mousemove', (e) => {
    if (gyroActive) return;

    mX = e.clientX;
    mY = e.clientY;
    window.realMX = e.clientX;
    window.realMY = e.clientY;
    tPX = e.clientX;
    tPY = e.clientY;

    const btnRect = menuBtn.getBoundingClientRect();
    const dist = Math.hypot(mX - (btnRect.left + btnRect.width / 2), mY - (btnRect.top + btnRect.height / 2));

    // Soglia dello sticky
    if (dist < 60 && !document.body.classList.contains('use-standard-cursor')) {
        isSticky = true;
        stickyScale = 2.5; // Qui decidi quanto si deve ingrandire (es. 2.5 volte)
        menuBtn.classList.add('sticky-active');
        // Il target del cursore diventa il centro esatto del bottone
        mX = btnRect.left + btnRect.width / 2;
        mY = btnRect.top + btnRect.height / 2;
    } else {
        isSticky = false;
        stickyScale = 1; // Torna alla dimensione normale
        menuBtn.classList.remove('sticky-active');
    }

    resetIdleTimer();
});

function lerpAngle(s, e, a) {
    const d = ((e - s + 180) % 360 + 360) % 360 - 180;
    return s + d * a;
}

function createDrop(x, y, angle) {
    const drop = document.createElement('div');
    drop.className = 'drop';
    drop.innerHTML = `<svg viewBox="0 0 500 465.69"><path d="M440.18,416.13c-59.25,54.74-144.98,53.73-221.98,45.24-36.38-4.01-73.01-9.15-107.35-22.91-34.33-13.76-66.57-36.95-86.47-70.65C5.82,336.36-.83,297.79.08,260.31,2.95,142.22,85.02,31.92,189.74,5.44c44.07-11.14,95.41-4.61,143.77,14.51,60.76,24.02,111.92,71.39,141.42,134.54,8.1,17.33,14.52,35.57,18.9,54.6,16.91,73.35-.95,158.38-53.65,207.04Z"/></svg>`;
    drop.style.left = `${x}px`;
    drop.style.top = `${y}px`;
    container.appendChild(drop);
    drop.animate([{
        transform: `translate(-50%,-50%) scale(1) rotate(${angle}deg)`,
        opacity: 0.6
    }, {
        transform: `translate(-50%,-50%) scale(0) rotate(${angle}deg)`,
        opacity: 0
    }], {
        duration: 600
    }).onfinish = () => drop.remove();
}

function toggleCursorMode() {
    const isChecked = document.getElementById('cursor-toggle').checked;
    if (isChecked) {
        document.body.classList.remove('use-standard-cursor');
        container.style.display = 'block';
    } else {
        document.body.classList.add('use-standard-cursor');
        container.style.display = 'none';
    }
}

// 3. GIROSCOPIO (MOBILE)
function handleOrientation(e) {
    if (!gyroActive) return;
    tPX = window.innerWidth / 2 + ((e.gamma - zeroGamma) * 15);
    tPY = window.innerHeight / 2 + ((e.beta - zeroBeta) * 15);
}

function setupGyro() {
    const init = (e) => {
        zeroBeta = e.beta;
        zeroGamma = e.gamma;
        gyroActive = true;
        window.removeEventListener('deviceorientation', init);
        window.addEventListener('deviceorientation', handleOrientation);
        document.getElementById('gyro-cta').classList.add('hidden');
    };
    window.addEventListener('deviceorientation', init);
    startIdleMovement(); // Avvia subito su mobile/gyro
}

function requestGyroPermission() {
    if (typeof DeviceOrientationEvent?.requestPermission === 'function') DeviceOrientationEvent.requestPermission().then(r => {
        if (r === 'granted') setupGyro();
    });
    else setupGyro();
}

// 4. LOOP DI UPDATE (Cursore & Occhi)
/* Calcola la posizione della pupilla all'interno dell'occhio
 * @param {Element} eye - L'elemento occhio (contenitore)
 * @param {number} radius - Il raggio di movimento consentito
 * @param {number} mouseX - Posizione X del mouse
 * @param {number} mouseY - Posizione Y del mouse
 */
function solve(eye, radius, mouseX, mouseY) {
    const rect = eye.getBoundingClientRect();
    const eyeX = rect.left + rect.width / 2;
    const eyeY = rect.top + rect.height / 2;
    
    const dx = mouseX - eyeX;
    const dy = mouseY - eyeY;
    const dist = Math.hypot(dx, dy);
    
    // Se il mouse è più lontano del raggio, limitiamo la pupilla al bordo
    const angle = Math.atan2(dy, dx);
    const limitedDist = Math.min(dist * 0.1, radius); // Lo 0.1 serve a rendere il movimento più sottile

    return {
        x: Math.cos(angle) * limitedDist,
        y: Math.sin(angle) * limitedDist
    };
}

function update() {
    if (isDesktop && !document.body.classList.contains('use-standard-cursor')) {
        
        // --- STEP 1: APPLICHIAMO L'ATTRITO ALLE COORDINATE ---
        // smoothMX si avvicina a window.realMX con un ritardo calcolato
        const targetX = window.realMX || mX;
        const targetY = window.realMY || mY;
        
        smoothMX += (targetX - smoothMX) * friction;
        smoothMY += (targetY - smoothMY) * friction;

        // --- STEP 2: IL CURSORE INSEGUE LE COORDINATE SMOOTH ---
        const dx = smoothMX - cX;
        const dy = smoothMY - cY;
        const speed = Math.hypot(dx, dy);

        // Manteniamo i tuoi Lerp per lo stato sticky/normal
        cX += dx * (isSticky ? 0.3 : 0.2);
        cY += dy * (isSticky ? 0.3 : 0.2);

        xSet(cX);
        ySet(cY);

        // --- STEP 3: LOGICA STATI (Idle/Movement) ---
        if (speed < 5 || isSticky) {
            rotationTo.tween.duration(1.2); 
            breathTime += 0.05;
            const baseScale = isSticky ? 1.0 : 0.33; 
            
            scaleXTo(baseScale + Math.sin(breathTime) * (isSticky ? 0.05 : 0.02));
            scaleYTo(baseScale + Math.cos(breathTime * 0.8) * (isSticky ? 0.06 : 0.03));
            rotationTo(isSticky ? 0 : Math.sin(breathTime * 0.5) * 5);
        } else {
            rotationTo.tween.duration(0.05);
            const angle = Math.atan2(dy, dx) * (180 / Math.PI);
            const stretch = Math.min(speed / 500, 0.6); 

            scaleXTo(0.33 + stretch);         
            scaleYTo(0.33 - (stretch * 0.2)); 
            rotationTo(angle);            

            if (speed > 20 && Math.random() > 0.8 && !isSticky) {
                createDrop(cX, cY, angle);
            }
        }
    }

    // --- STEP 4: PUPILLE (Sincronizzate con l'attrito) ---
    const posHP = solve(hp.eye, 50, smoothMX, smoothMY);
    const posNP = solve(np.eye, 30, smoothMX, smoothMY);

    hp.pup.style.transform = `translate(${posHP.x}px, ${posHP.y}px)`;
    np.pup.style.transform = `translate(${posNP.x}px, ${posNP.y}px)`;

    requestAnimationFrame(update);
}

// 5. BATTIMENTO OCCHI & IDLE
function triggerBlink() {
    const eyes = [hp.eye, np.eye],
        brows = [hp.brow, np.brow];
    eyes.forEach(e => e.classList.add('blinking'));
    brows.forEach(b => b.classList.add('brow-down'));
    setTimeout(() => {
        eyes.forEach(e => e.classList.remove('blinking'));
        brows.forEach(b => b.classList.remove('brow-down'));
    }, 120);
    setTimeout(triggerBlink, Math.random() * 4000 + 2500);
}

function resetIdleTimer() {
    // Ferma il movimento casuale se era attivo
    clearInterval(idleInterval);
    // Resetta il timer che fa partire l'idle
    clearTimeout(idleTimeout);
    idleTimeout = setTimeout(startIdleMovement, 2000);
}

function startIdleMovement() {
    // Assicuriamoci di non avere intervalli multipli
    clearInterval(idleInterval);
    
    idleInterval = setInterval(() => {
        if (gyroActive) {
            mX = Math.random() * window.innerWidth;
            mY = Math.random() * window.innerHeight;
        } else {
            mX = tPX = Math.random() * window.innerWidth;
            mY = tPY = Math.random() * window.innerHeight;
        }
    }, 2500);
}

// 6. DECODE TEXT EFFECT
const words = ["ART |DIRECTION", "STRATEGY", "DESIGN", "CREATIVITY", "VIDEO|&MOTION", "DIGITAL", "PRINT|&CRAFT", "LEADERSHIP"];
let wIdx = 0;

function decode(txt) {
    const dw = document.getElementById('dynamic-word');
    let it = 0;
    clearInterval(dw.int);
    dw.int = setInterval(() => {
        let currentVisibleLen = Math.floor(3 + it);
        if (currentVisibleLen > txt.length) currentVisibleLen = txt.length;
        let result = "";
        for (let i = 0; i < currentVisibleLen; i++) {
            if (i < it) result += (txt[i] === '|') ? "<br>" : txt[i];
            else result += (txt[i] === '|') ? "" : "ABCDEFGHIJKLMNOPQRSTUVWXYZ!£$%&/_=?123456789^@" [Math.floor(Math.random() * 46)];
        }
        dw.innerHTML = result;
        if (it >= txt.length) clearInterval(dw.int);
        it += 0.25;
    }, 30);
}

// 7. SKILLS FILTERING
const mySkills = [// STRATEGY
            { name: "Art Direction", cat: "strategy" },
            { name: "Creative Leadership", cat: "strategy" },
            { name: "Brand Strategy", cat: "strategy" },
            { name: "Creative Strategy", cat: "strategy" },
            { name: "Brainstorming", cat: "strategy" },
            { name: "Pitch & Speech", cat: "strategy" },
            { name: "Coordinamento Team", cat: "strategy" },
            { name: "Coordinamento Fornitori", cat: "strategy" },
            { name: "Project Management", cat: "strategy" },
            
            // CREATIVE & PRODUCTION
            { name: "Video Production", cat: "creative" },
            { name: "Montaggio Video", cat: "creative" },
            { name: "Motion Graphics", cat: "creative" },
            { name: "Brand Identity", cat: "creative" },
            { name: "Graphic Design", cat: "creative" },
            { name: "Social Media Design", cat: "creative" },
            { name: "Coordinamento Shooting", cat: "creative" },
            { name: "Fotoritocco", cat: "creative" },
            { name: "Amazon A+ & Shop in Shop", cat: "creative" },
            { name: "Eventi & Concorsi", cat: "creative" },
            
            // TECH & ADV
            { name: "Banner HTML5", cat: "tech" },
            { name: "AI Workflows", cat: "tech" },
            { name: "AI Generativa", cat: "tech" },
            { name: "Landing Pages", cat: "tech" },
            { name: "Web Design", cat: "tech" },
            { name: "Meta Ads", cat: "tech" },
            { name: "Display Ads", cat: "tech" },
            { name: "Newsletter & DEM", cat: "tech" },
            { name: "UI/UX", cat: "tech" },
            
            // TOOLS
            { name: "Figma", cat: "tools" },
            { name: "Photoshop", cat: "tools" },
            { name: "After Effects", cat: "tools" },
            { name: "Premiere", cat: "tools" },
            { name: "Illustrator", cat: "tools" },
            { name: "InDesign", cat: "tools" },
            { name: "Canva", cat: "tools" },
            { name: "Capcut", cat: "tools" },
            { name: "HTML5/CSS", cat: "tools" }
];

function initSkillsFilterEvents() {
    const buttons = document.querySelectorAll('.filter-btn');

    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            // 1. Rimuovi 'active' da tutti e mettilo su questo
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // 2. Chiama la tua funzione esistente
            const category = btn.getAttribute('data-filter');
            filterSkills(category);
        });
    });
}

function initSkills() {
    const grid = document.getElementById('skills-grid');
    if (!grid) return;
    grid.innerHTML = '';
    mySkills.forEach(skill => {
        const pill = document.createElement('span');
        pill.className = 'skill-pill';
        pill.dataset.cat = skill.cat;
        pill.innerText = skill.name;
        grid.appendChild(pill);
    });
    filterSkills(window.innerWidth <= 768 ? 'strategy' : 'all');
}

function filterSkills(category) {
    document.querySelectorAll('.skill-pill').forEach(pill => {
        // Usiamo "flex" o "block" a seconda del CSS della griglia
        pill.style.display = (category === 'all' || pill.dataset.cat === category) ? "flex" : "none";
    });
}

 // Utility Menù e Scroll
  function toggleMenu() {
      isMenuOpen = !isMenuOpen;
      const o = document.getElementById('menu-overlay');
      o.classList.toggle('active', isMenuOpen);
      menuBtn.innerText = isMenuOpen ? "Close -" : "Menu +";
  }
 document.getElementById('menu-overlay').addEventListener('click', function(e) {
    if (isMenuOpen) {
        // Chiude se il click NON è avvenuto su una macchia (.spot)
        // e NON è avvenuto dentro l'area dei link (.menu-links)
        if (!e.target.closest('.spot') && !e.target.closest('.menu-links') && !e.target.closest('#menu-content')) {
            toggleMenu();
        }
    }
});

let isScrolling = false;
window.addEventListener('scroll', () => {
    if (!isScrolling) {
        window.requestAnimationFrame(() => {
            const y = window.scrollY;
            if (y > 100) {nLog.classList.add('slide-in'); labelName.classList.add('scrolled'); }
            else {nLog.classList.remove('slide-in'); labelName.classList.remove('scrolled'); }
            isScrolling = false;
        });
        isScrolling = true;
    }
});

// CURSORE SPECIALE PER HOVER
//COPIA LA MAIL NEI CONTATTI
        function copyEmail() {
            const email = "hello@test.it";
            const icon = document.querySelector('.copy-icon');
        
            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(email).then(() => {
                    // Attiva icona 'check', e TOOLTIP
                    icon.innerText = 'check';
                    icon.classList.add('copy-success');
            
                    // Reset dopo 1.5 secondi
                    setTimeout(() => {
                        icon.innerText = 'content_copy';
                        icon.classList.remove('copy-success');
                    }, 1500);
                }).catch(err => console.error('Errore copia:', err));
            } else {
                // Attiva icona 'check', e TOOLTIP
                icon.innerText = 'check';
                icon.classList.add('copy-success');
        
                // Reset dopo 1.5 secondi (un po' più veloce per un effetto "snappy")
                setTimeout(() => {
                    icon.innerText = 'content_copy';
                    icon.classList.remove('copy-success');
                }, 1500);
            }
        }
        
        ////////////////////////////////////////////////////
        //MODIFICA CURSORE SE HOVER SU LINK O ALTRI ELEMENTI
        document.addEventListener('mouseover', (e) => {
            const target = e.target;
        
            // 1. Controlla se è un elemento con cursore pointer
            const hasPointer = window.getComputedStyle(target).cursor === 'pointer';
            
            // 2. Controlla se è un link (<a>)
            const isLink = target.closest('a');
        
            // 3. Esclusioni: non deve avere la classe .menu-link e non deve essere il trigger del menu
            const isMenuElement = target.closest('.menu-link') || target.closest('#nav-text-menu');
        
            // Attiva l'effetto solo se è cliccabile MA non è un elemento del menu
            if ((hasPointer || isLink) && !isMenuElement) {
                document.querySelector('#custom-cursor').classList.add('is-hovering');
            }
        });
        
        document.addEventListener('mouseout', (e) => {
            // Rimuoviamo la classe quando usciamo
            document.querySelector('#custom-cursor').classList.remove('is-hovering');
        });
        //////////////////////////////////////////////////////////

        

// 8. INIZIALIZZAZIONE GLOBALE
document.addEventListener('DOMContentLoaded', () => {
    // 1. REGISTRO PLUGIN
    gsap.registerPlugin(MorphSVGPlugin, ScrollTrigger, ScrollToPlugin, DrawSVGPlugin);
    // 2. MORPHING OCCHIO HERO (Loop Infinito)
    // Questa animazione trasforma il tracciato dell'occhio da ME a MO e viceversa
    const eyeTl = gsap.timeline({
        repeat: -1,
        yoyo: true,
        repeatDelay: 0.5,
    });

    eyeTl.to("#main-morph-path", {
        duration: 1.5,
        morphSVG: "#path-mo-target",
        ease: "expo.inOut"
    });

    // 3. MORPHING FOTO ABOUT (Loop Infinito)
    const photoBlob = document.querySelector(".morph-path");

    if (photoBlob) {
        const photoTl = gsap.timeline({
            repeat: -1,
            defaults: {
                duration: 4,
                ease: "sine.inOut"
            }
        });

        photoTl
            .to(photoBlob, {
                morphSVG: "M 400 380 C 300 450 200 480 120 400 C 40 320 20 200 80 120 C 140 40 300 20 420 90 C 520 160 500 300 400 380 Z",
                rotate: 10,
                scale: 1
            })
            .to(photoBlob, {
                morphSVG: "M480,250C460,350,350,450,250,460C150,470,40,380,20,250C0,120,120,30,250,20C380,10,500,120,480,250Z",
                rotate: -8,
                scale: 0.95
            })
            .to(photoBlob, {
                morphSVG: "M440.5,320.5C407,388,318,431,235.5,423.5C153,416,77,358,54.5,282C32,206,63,112,133,67C203,22,312,26,380.5,77C449,128,474,253,440.5,320.5Z",
                rotate: 0,
                scale: 1
            });
    }

    ////////////////////////////////
    function initCreativeScroll() {
    // 1. RESET: Puliamo tutto prima di ricalcolare (fondamentale per il resize)
    ScrollTrigger.getAll().forEach(st => st.kill(true));
    
    // --- PARTE A: TRANSIZIONE INCHIOSTRO (BEYOND SECTION) ---
    const inkPath = document.querySelector("#ink-path");
    const beyondSection = document.querySelector("#beyond-section");
    const INITIAL_PATH = "M0,0 L100,0 L100,0 C75,0 75,0 50,0 C25,0 25,0 0,0 Z";
    const FINAL_PATH = "M-20,0 L120,0 L120,105 C80,130 70,90 50,120 C30,140 15,90 -20,105 Z";

    if (inkPath) {
        gsap.set(inkPath, { attr: { d: INITIAL_PATH } });
        gsap.to(inkPath, {
            attr: { d: FINAL_PATH },
            ease: "none",
            scrollTrigger: {
                trigger: "#beyond-section",
                start: "top bottom", 
                end: "top top",      
                scrub: 1,
                invalidateOnRefresh: true,
                onLeave: () => {
                    beyondSection.classList.add("is-active");
                    gsap.set(".ink-transition-container", { autoAlpha: 0 });
                },
                onEnterBack: () => {
                    gsap.set(".ink-transition-container", { autoAlpha: 1 });
                    beyondSection.classList.remove("is-active");
                }
            }
        });
    }

    // --- PARTE B: SCROLL ORIZZONTALE (WORKS SECTION) ---
    const wrapper = document.querySelector('.works-wrapper');
    const blobs = document.querySelectorAll('.blob-item');
    
    if (wrapper) {
        // Funzione per calcolare lo spostamento (Larghezza totale - Larghezza schermo)
        const getScrollAmount = () => wrapper.scrollWidth - window.innerWidth;

        let worksTl = gsap.timeline({
            scrollTrigger: {
                id: "WORKS",
                trigger: "#works-section",
                start: "top top",
                end: () => "+=" + getScrollAmount(),
                pin: true,
                scrub: 1,
                invalidateOnRefresh: true,
                refreshPriority: 1, // Calcola questa sezione DOPO quelle sopra
                anticipatePin: 1
            }
        });

        // Muoviamo il wrapper verso sinistra
        worksTl.to(wrapper, {
            x: () => -getScrollAmount(),
            ease: "none"
        }, 0);

        // Muoviamo i blob (Parallasse)
        blobs.forEach((blob, i) => {
            const speeds = [0.5, 0.75, 0.65, 0.9, 0.8];
            worksTl.to(blob, {
                x: () => -(wrapper.scrollWidth * 0.1 * speeds[i]), 
                ease: "none"
            }, 0);
        });
    }
    // --- PARTE C: SEZIONE AMO (VERTICAL REVEAL) ---
    const aboutAmoWrapper = document.getElementById('about-amo-wrapper');
    const amoTarget = document.getElementById('amo-text');
    const amoSection = document.querySelector('#amo-section');
    const heartPath = document.querySelector('#heart-path'); // Selezioniamo il cuore
    
    if (aboutAmoWrapper && amoTarget && amoSection) {
        const parole = [
            " l'arrampicata, ", "il mare, ", "la terra, ", "costruire, ", 
            "imparare, ", "appassionarmi, ", "Marta, ", "Gaia."
        ];

        const colorInizio = "#ffc857";
        const colorFine = "#f76c5e";
        const interpolatore = gsap.utils.interpolate(colorInizio, colorFine);

        // Reset span esistenti
        amoTarget.querySelectorAll('.added-word').forEach(s => s.remove());

        // Creazione span
        parole.forEach((testo, i) => {
            const span = document.createElement('span');
            span.textContent = testo;
            span.classList.add('added-word');
            span.style.color = interpolatore(i / (parole.length - 1));
            gsap.set(span, { opacity: 0, y: 5, display: "inline-block" });
            amoTarget.appendChild(span);
        });

        // --- SETUP SVG ---
        if (heartPath) {
            gsap.set(heartPath, { drawSVG: "0%" });
        }

        // 1. PIN della sezione
        ScrollTrigger.create({
            trigger: "#amo-section",
            start: "top top",
            end: "+=2000",
            pin: true,
            pinSpacing: true,
            id: "amo-pin",
            anticipatePin: 1
        });

        // 2. ANIMAZIONE delle parole
        gsap.to(".added-word", {
            opacity: 1,
            y: 0,
            stagger: 0.5,
            scrollTrigger: {
                trigger: "#amo-section",
                start: "top top", 
                end: "+=2000",
                scrub: 1
            }
        });

        // 3. PIN, COMPARSA PAROLE E CAMBIO SFONDO
        // Usiamo lo stesso trigger così il colore cambia mentre le parole appaiono
        gsap.to(aboutAmoWrapper, {
            backgroundColor: "#2d2926",
            scrollTrigger: {
                trigger: "#amo-section",
                start: "top top", // Inizia quando si pinna
                end: "+=2000",      // Finisce quando si sblocca
                scrub: 1
            }
        });

        // 4. ANIMAZIONE DEL CUORE (SVG)
        if (heartPath) {
            gsap.to(heartPath, {
                drawSVG: "100%",
                scrollTrigger: {
                    trigger: "#amo-section",
                    start: "top top",
                    end: "+=2000",
                    scrub: 1
                }
            });
        }
    }
}
  
  // Utility Debounce per resize
  function debounce(func, wait) {
      let timeout;
      return function(...args) {
          clearTimeout(timeout);
          timeout = setTimeout(() => func.apply(this, args), wait);
      };
  }
  
  // Inizializza e gestisci resize

    function setupAll() {
        initSkills();
        initSkillsFilterEvents();
        initCreativeScroll();
        update();
        triggerBlink();
        resetIdleTimer(); // Inizia il countdown per l'idle

        // Rimuovi CTA Gyro su Desktop o se non supportato
        const gyroCta = document.getElementById('gyro-cta');
        if (isDesktop || !window.DeviceOrientationEvent) {
             if (gyroCta) gyroCta.remove();
        }

        setInterval(() => {
        wIdx = (wIdx + 1) % words.length;
        decode(words[wIdx]);
    }, 4000);
        ScrollTrigger.refresh(); // Forza il ricalcolo immediato
    }

  // Avvio iniziale
  window.addEventListener("load", setupAll);

  // Resize finestra
  window.addEventListener("resize", debounce(() => {
      ScrollTrigger.refresh();
  }, 200));

////////chiusura domcontent loaded
});
