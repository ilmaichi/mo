
        const isDesktop = window.matchMedia("(pointer: fine)").matches;
        const hLog = document.getElementById('hero-logo-wrapper'), nLog = document.getElementById('nav-logo-wrapper');
        const hp = { eye: hLog.querySelector('.intero-occhio'), pup: hLog.querySelector('.p-mover'), brow: hLog.querySelector('.sopracciglio') };
        const np = { eye: nLog.querySelector('.intero-occhio'), pup: nLog.querySelector('.p-mover'), brow: nLog.querySelector('.sopracciglio') };
        const cursor = document.getElementById('custom-cursor'), container = document.getElementById('cursor-container');
        const menuBtn = document.getElementById('nav-text-menu'), labelName = document.getElementById('label-name');

        let mX = window.innerWidth/2, mY = window.innerHeight/2, cX = mX, cY = mY;
        let tPX = mX, tPY = mY, cPX = mX, cPY = mY;
        
        let currentRotation = 0, currentStretchX = 1, currentStretchY = 1, breathTime = 0;
        let isMenuOpen = false, isSticky = false, gyroActive = false;
        let zeroBeta = 0, zeroGamma = 0;
        let idleTimer; // Gestirà l'intervallo del movimento automatico a mousefermo
        
        //ATTIVO LINK DEL LOGO NAV
        nLog.addEventListener('click', () => {
            window.scrollTo({
              top: 0,
              behavior: 'smooth'
            });
        });
        
        document.addEventListener('mousemove', (e) => {
            if (gyroActive) return;
        
            // Ferma l'occhio che vaga da solo
            clearInterval(idleTimer);
        
            mX = e.clientX; 
            mY = e.clientY;

            // Coordinate REALI per il cursore (non vengono mai toccate dall'idle)
            window.realMX = e.clientX;
            window.realMY = e.clientY;
            // Qui il cursore comanda gli occhi
            tPX = e.clientX; 
            tPY = e.clientY; 
        
            const btnRect = menuBtn.getBoundingClientRect();
            const dist = Math.hypot(mX - (btnRect.left + btnRect.width/2), mY - (btnRect.top + btnRect.height/2));
            
            if (dist < 60 && !document.body.classList.contains('use-standard-cursor')) { 
                isSticky = true; 
                cursor.classList.add('expanding'); 
                menuBtn.classList.add('sticky-active'); 
                mX = btnRect.left + btnRect.width/2; 
                mY = btnRect.top + btnRect.height/2; 
            } else { 
                isSticky = false; 
                cursor.classList.remove('expanding'); 
                menuBtn.classList.remove('sticky-active'); 
            }
        
            // Fai ripartire il timer: se smetti di muovere ora, tra 2.5s inizierà a vagare
            startIdleMovement();
        });

        function lerpAngle(s, e, a) { const d = ((e - s + 180) % 360 + 360) % 360 - 180; return s + d * a; }

        function createDrop(x, y, angle) {
            const drop = document.createElement('div'); drop.className = 'drop';
            drop.innerHTML = `<svg viewBox="0 0 500 465.69"><path d="M440.18,416.13c-59.25,54.74-144.98,53.73-221.98,45.24-36.38-4.01-73.01-9.15-107.35-22.91-34.33-13.76-66.57-36.95-86.47-70.65C5.82,336.36-.83,297.79.08,260.31,2.95,142.22,85.02,31.92,189.74,5.44c44.07-11.14,95.41-4.61,143.77,14.51,60.76,24.02,111.92,71.39,141.42,134.54,8.1,17.33,14.52,35.57,18.9,54.6,16.91,73.35-.95,158.38-53.65,207.04Z"/></svg>`;
            drop.style.left = `${x}px`; drop.style.top = `${y}px`; container.appendChild(drop);
            drop.animate([{transform:`translate(-50%,-50%) scale(1) rotate(${angle}deg)`, opacity:0.6},{transform:`translate(-50%,-50%) scale(0) rotate(${angle}deg)`, opacity:0}], {duration:600}).onfinish=()=>drop.remove();
        }

        function toggleCursorMode() {
            const isChecked = document.getElementById('cursor-toggle').checked;
            if (isChecked) { document.body.classList.remove('use-standard-cursor'); container.style.display = 'block'; }
            else { document.body.classList.add('use-standard-cursor'); container.style.display = 'none'; }
        }

        function handleOrientation(e) { if (!gyroActive) return; tPX = window.innerWidth/2 + ((e.gamma - zeroGamma)*15); tPY = window.innerHeight/2 + ((e.beta - zeroBeta)*15); }
        function setupGyro() {
            const init = (e) => { zeroBeta = e.beta; zeroGamma = e.gamma; gyroActive = true; window.removeEventListener('deviceorientation', init); window.addEventListener('deviceorientation', handleOrientation); document.getElementById('gyro-cta').classList.add('hidden'); };
            window.addEventListener('deviceorientation', init);
            startIdleMovement();
        }
        function requestGyroPermission() { if (typeof DeviceOrientationEvent?.requestPermission === 'function') DeviceOrientationEvent.requestPermission().then(r => {if(r==='granted')setupGyro();}); else setupGyro(); }

        function update() {
            // Gestione Cursore Organic (solo Desktop)
            if (isDesktop && !document.body.classList.contains('use-standard-cursor')) {
                // USA realMX e realMY invece di mX e mY per il cursore
                const dx = (window.realMX || mX) - cX, dy = (window.realMY || mY) - cY; 
                cX += dx * (isSticky ? 0.3 : 0.15); 
                cY += dy * (isSticky ? 0.3 : 0.15);
                
                const speed = Math.hypot(dx, dy), angle = Math.atan2(dy, dx) * (180/Math.PI);
                let tRot, tSX, tSY, lF = 0.1;
                
                if (speed < 1 || isSticky) { 
                    breathTime += 0.05; 
                    tSX = 1 + Math.sin(breathTime)*0.1; 
                    tSY = 1 + Math.cos(breathTime*0.8)*0.12; 
                    tRot = isSticky ? 0 : Math.sin(breathTime*0.5)*5; 
                } else { 
                    const s = Math.min(speed/400, 0.6); 
                    tSX = 1+s; tSY = 1-s; tRot = angle; 
                    lF = Math.min(speed/50, 1); 
                }
                
                currentRotation = lerpAngle(currentRotation, tRot, lF);
                currentStretchX += (tSX - currentStretchX) * 0.15; 
                currentStretchY += (tSY - currentStretchY) * 0.15;
                
                cursor.style.transform = `translate(${cX}px, ${cY}px) translate(-50%, -50%) rotate(${currentRotation}deg) scale(${currentStretchX}, ${currentStretchY})`;
                if (speed > 15 && Math.random() > 0.8 && !isSticky) createDrop(cX, cY, angle);
            }
        
            // --- LOGICA OCCHI ---
        
            // 2. HERO: Inseguimento fluido del target principale (tPX/tPY)
            // Su mobile tPX è il giroscopio, su desktop è il mouse
            cPX += (tPX - cPX) * 0.1; 
            cPY += (tPY - cPY) * 0.1;
        
            // 3. NAV: Inseguimento fluido selettivo
            // Se il giroscopio è attivo, forza il target su mX/mY (gestiti dal timer idle)
            // Se spento, segue il puntamento standard
            if (!window.cNX) { window.cNX = mX; window.cNY = mY; }
            
            let targetNX = gyroActive ? mX : tPX;
            let targetNY = gyroActive ? mY : tPY;
        
            window.cNX += (targetNX - window.cNX) * 0.1;
            window.cNY += (targetNY - window.cNY) * 0.1;
        
            // Funzione interna per il calcolo della posizione pupilla
            const solve = (eye, r, x, y) => { 
                const rect = eye.getBoundingClientRect(); 
                const dx = x - (rect.left + rect.width/2), 
                      dy = y - (rect.top + rect.height/2); 
                const a = Math.atan2(dy, dx), 
                      d = Math.min(Math.hypot(dx, dy)/400, 1); 
                return { x: Math.cos(a)*r*d, y: Math.sin(a)*r*d }; 
            };
        
            // Applicazione trasformazioni
            hp.pup.style.transform = `translate(${solve(hp.eye, 50, cPX, cPY).x}px, ${solve(hp.eye, 50, cPX, cPY).y}px)`;
            np.pup.style.transform = `translate(${solve(np.eye, 30, window.cNX, window.cNY).x}px, ${solve(np.eye, 30, window.cNX, window.cNY).y}px)`;
        
            requestAnimationFrame(update);
        }

        function triggerBlink() {
            const eyes = [hp.eye, np.eye], brows = [hp.brow, np.brow];
            eyes.forEach(e => e.classList.add('blinking')); brows.forEach(b => b.classList.add('brow-down'));
            setTimeout(() => { eyes.forEach(e => e.classList.remove('blinking')); brows.forEach(b => b.classList.remove('brow-down')); }, 120);
            setTimeout(triggerBlink, Math.random() * 4000 + 2500);
        }

        document.addEventListener('DOMContentLoaded', () => {
            const observerOptions = { threshold: 0.15 };
        
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        // Aggiunge la classe active per far apparire l'elemento (CSS)
                        entry.target.classList.add('active');
                        // Smette di osservare una volta attivato
                        observer.unobserve(entry.target);
                    }
                });
            }, observerOptions);
        
            // Osserva tutti gli elementi .reveal
            document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
        });

        const words = [
            "ART |DIRECTION",
            "STRATEGY",
            "DESIGN",
            "CREATIVITY",
            "VIDEO|&MOTION",
            "DIGITAL",
            "PRINT|&CRAFT",
            "LEADERSHIP"
        ];
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
                    if (i < it) {
                        // Se il carattere è la nostra pipe, mettiamo un BR invece di glitcharlo
                        if (txt[i] === '|') {
                            result += "<br>";
                        } else {
                            result += txt[i];
                        }
                    } else {
                        // Non glitchiamo la pipe, manteniamola invisibile o saltiamola
                        if (txt[i] === '|') {
                            result += ""; // Salta il glitch per il separatore
                        } else {
                            result += "ABCDEFGHIJKLMNOPQRSTUVWXYZ!£$%&/_=?123456789^@"[Math.floor(Math.random() * 46)];
                        }
                    }
                }
        
                // USIAMO innerHTML per interpretare il <br>
                dw.innerHTML = result;
        
                if (it >= txt.length) {
                    clearInterval(dw.int);
                }
        
                it += 0.25; 
            }, 30);
        }

        function toggleMenu() { isMenuOpen = !isMenuOpen; const o = document.getElementById('menu-overlay'); if (isMenuOpen) { o.classList.add('active'); menuBtn.innerText = "Close -"; } else { o.classList.remove('active'); menuBtn.innerText = "Menu +"; } }
        
        document.getElementById('menu-overlay').addEventListener('click', function(e) {
    if (isMenuOpen) {
        // Chiude se il click NON è avvenuto su una macchia (.spot)
        // e NON è avvenuto dentro l'area dei link (.menu-links)
        if (!e.target.closest('.spot') && !e.target.closest('.menu-links') && !e.target.closest('#menu-content')) {
            toggleMenu();
        }
    }
});
        
        window.addEventListener('scroll', () => {
            const y = window.scrollY;
            if (y > 100) {nLog.classList.add('slide-in'); labelName.classList.add('scrolled'); }
            else {nLog.classList.remove('slide-in'); labelName.classList.remove('scrolled'); }
        });

        if (!isDesktop) { document.body.addEventListener('touchstart', requestGyroPermission, { once: true }); }
        update(); triggerBlink();
        setInterval(() => { wIdx = (wIdx+1)%words.length; decode(words[wIdx]); }, 4000);
        const mySkills = [
            // STRATEGY
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
        
        // Funzione per generare i pill una sola volta
        function initSkills() {
            const grid = document.getElementById('skills-grid');
            const filters = document.querySelectorAll('.filter-btn');
            if (!grid) return;
        
            // 1. Genera tutti i pill (nascosti o visibili lo decide il filtro dopo)
            grid.innerHTML = ''; 
            mySkills.forEach(skill => {
                const pill = document.createElement('span');
                pill.className = 'skill-pill';
                pill.dataset.cat = skill.cat;
                pill.innerText = skill.name;
                grid.appendChild(pill);
            });
        
            // 2. Controllo Mobile (Sotto i 768px)
            if (window.innerWidth <= 768) {
                // Rimuovi active da "All" e mettilo su "Strategy"
                filters.forEach(btn => {
                    btn.classList.remove('active');
                    if (btn.dataset.filter === 'strategy') {
                        btn.classList.add('active');
                    }
                });
                
                // Applica il filtro iniziale solo per mobile
                filterSkills('strategy');
            } else {
                // Su Desktop, assicurati che "All" sia attivo e tutto visibile
                filterSkills('all');
            }
        }
        
        function filterSkills(category) {
            const pills = document.querySelectorAll('.skill-pill');
            
            pills.forEach(pill => {
                if (category === 'all' || pill.dataset.cat === category) {
                    pill.style.display = "inline-flex";
                } else {
                    pill.style.display = "none";
                }
            });
        
            // Refresh specifico del marker "WORKS" per evitare che schizzi in alto
            requestAnimationFrame(() => {
                const st = ScrollTrigger.getById("WORKS");
                if (st) st.refresh();
            });
        }
        
        // Event Listener
        document.getElementById('skills-filters').addEventListener('click', (e) => {
            if (e.target.classList.contains('filter-btn')) {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                filterSkills(e.target.dataset.filter);
            }
        });
        
        // Avvio
        document.addEventListener('DOMContentLoaded', () => {
            initSkills();
        });

        // Toggle testo sezione About
        function initMeMoToggle() {
            const meEl = document.querySelector('.me-svg');
            const moEl = document.querySelector('.mo-svg');
            if (!meEl || !moEl) return;
        
            let showingMe = true;
        
            setInterval(() => {
                if (showingMe) {
                    meEl.classList.remove('active');
                    moEl.classList.add('active');
                } else {
                    moEl.classList.remove('active');
                    meEl.classList.add('active');
                }
                showingMe = !showingMe;
            }, 4000);
        }
        
        initMeMoToggle();

        // Gestione movimento occhio fermo
        function startIdleMovement() {
            if(gyroActive) {
                // Se il giroscopio è attivo, muoviamo solo mX/mY (per la Nav)
                clearInterval(idleTimer);
                idleTimer = setInterval(() => {
                    mX = Math.random() * window.innerWidth;
                    mY = Math.random() * window.innerHeight;
                }, 2500);
            } else {
                // Se siamo su desktop o il giroscopio è spento, muoviamo tutto
                clearInterval(idleTimer);
                idleTimer = setInterval(() => {
                    mX = tPX = Math.random() * window.innerWidth;
                    mY = tPY = Math.random() * window.innerHeight;
                }, 2500);
            }
        }

        // Avvio Occhio fermo
        startIdleMovement();

        // Gestione click sui link del menù con delay
        document.querySelectorAll('.menu-link').forEach(link => {
    link.addEventListener('click', (e) => {
        const targetId = link.getAttribute('href');
        
        // Se il link è un'ancora (inizia con #)
        if (targetId && targetId.startsWith('#')) {
            e.preventDefault();

            // 1. Chiusura menù (se hai la funzione toggleMenu)
            if (typeof isMenuOpen !== 'undefined' && isMenuOpen) {
                toggleMenu();
            }

            // 2. Delay per permettere al menu di iniziare a chiudersi
            setTimeout(() => {
                const targetSection = document.querySelector(targetId);
                
                if (targetSection) {
                    // Cerchiamo se GSAP ha un trigger associato a questa sezione
                    const st = ScrollTrigger.getAll().find(s => s.trigger === targetSection);
                    
                    let targetPosition;

                    if (st) {
                        // Se è una sezione speciale (pinnata/orizzontale), usiamo il valore di GSAP
                        targetPosition = st.start;
                    } else {
                        // Se è una sezione normale, usiamo il calcolo della posizione attuale
                        targetPosition = targetSection.getBoundingClientRect().top + window.pageYOffset;
                    }

                    // Eseguiamo lo scroll fluido nativo (quello che hai testato essere istantaneo)
                    window.scrollTo({
                        top: targetPosition,
                        behavior: 'smooth'
                    });
                }
            }, 350);
        }
    });
});
        
        //COPIA LA MAIL NEI CONTATTI
        function copyEmail() {
            const email = "hello@test.it";
            const icon = document.querySelector('.copy-icon');
        
            const textArea = document.createElement("textarea");
            textArea.value = email;
            document.body.appendChild(textArea);
            textArea.select();
        
            try {
                document.execCommand('copy');
                
                // Attiva icona 'check', e TOOLTIP
                icon.innerText = 'check';
                icon.classList.add('copy-success');
        
                // Reset dopo 1.5 secondi (un po' più veloce per un effetto "snappy")
                setTimeout(() => {
                    icon.innerText = 'content_copy';
                    icon.classList.remove('copy-success');
                }, 1500);
                
            } catch (err) {
                console.error('Errore copia:', err);
            }
        
            document.body.removeChild(textArea);
        }
        
        //MODIFICA CURSORE SE HOVER SU LINK
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
        
   

document.addEventListener("DOMContentLoaded", () => {
    // 1. Registrazione Plugin
    gsap.registerPlugin(MorphSVGPlugin, ScrollTrigger, ScrollToPlugin);

        // 1. Limitiamo gli eventi di refresh automatico
ScrollTrigger.config({ 
    autoRefreshEvents: "visibilitychange,DOMContentLoaded,load" 
});

// 2. Gestiamo manualmente il refresh solo quando serve davvero (cambio larghezza)
let lastWidth = window.innerWidth;
window.addEventListener("resize", () => {
    if (window.innerWidth !== lastWidth) {
        lastWidth = window.innerWidth;
        ScrollTrigger.refresh(); 
    }
});
    
    // 2. Animazione Occhio (Morphing Infinito) - Resta invariata
    const eyeTl = gsap.timeline({
        repeat: -1,
        yoyo: true,
        repeatDelay: 3
    });
    eyeTl.to("#main-morph-path", {
        duration: 1.5,
        morphSVG: "#path-mo-target",
        ease: "expo.inOut"
    });

    // 3. Animazione Macchia Inchiostro (Hero) - Aggiunto ricalcolo
    gsap.to("#ink-path", {
        scrollTrigger: {
            trigger: ".hero-container",
            start: "top top",
            end: "bottom top",
            scrub: 1.5,
            invalidateOnRefresh: true // Importante per la fluidità post-resize
        },
        attr: { 
            d: "M-20,0 L120,0 L120,105 C80,130 70,90 50,120 C30,140 15,90 -20,105 Z" 
        },
        ease: "none"
    });

    // 4. Scroll Orizzontale (Works) + Parallasse Blob
    const wrapper = document.querySelector('.works-wrapper');
    const blobs = document.querySelectorAll('.blob-item');

    if (!wrapper) return;

    // Timeline dedicata allo scroll
    let worksTl = gsap.timeline({
        scrollTrigger: {
            id: "WORKS", // Fondamentale per richiamarlo
            trigger: "#works-section",
            start: "top top",
            pin: true,
            scrub: 1,
            invalidateOnRefresh: true, // Ricalcola i valori della timeline al refresh
            refreshPriority: 1, // Assicura che venga dopo le sezioni precedenti
            end: () => "+=" + (document.querySelector('.works-wrapper').scrollWidth - window.innerWidth),
                markers:true,
        }
    });

    // Animazione spostamento orizzontale
    worksTl.to(wrapper, {
        x: () => -(wrapper.scrollWidth - window.innerWidth),
        ease: "none"
    }, 0);

    // Animazione parallasse blob
    blobs.forEach((blob, i) => {
        const speeds = [0.5, 0.75, 0.65, 0.9, 0.8];
        worksTl.to(blob, {
            x: () => -(wrapper.scrollWidth * 0.1 * speeds[i]), 
            ease: "none"
        }, 0);
    });
    
    //morphing photo about
    const photoBlob = document.querySelector(".morph-path");
    
    if (!photoBlob) return;

    // Timeline infinita slegata dallo ScrollTrigger
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
    
    //COMPARSA PAROLE AMO
    const amoTarget = document.getElementById('amo-text');
    const parole = [
        " l'arrampicata, ", "il mare, ", "la terra, ", "costruire, ", 
        "imparare, ", "appassionarmi, ", "Marta, ", "Gaia."
    ];

    if (!amoTarget) return;

    const colorInizio = "#ffc857"; // Gold
    const colorFine = "#f76c5e";   // Coral
    const interpolatore = gsap.utils.interpolate(colorInizio, colorFine);

    // 1. CREIAMO GLI SPAN UNA VOLTA SOLA
    parole.forEach((testo, i) => {
        const span = document.createElement('span');
        span.textContent = testo;
        span.classList.add('added-word');
        span.style.color = interpolatore(i / (parole.length - 1));
        span.style.opacity = 0; // Partono invisibili
        amoTarget.appendChild(span);
    });

    const spanCreati = amoTarget.querySelectorAll('.added-word');

    // 2. ANIMIAMOLI SINGOLARMENTE CON LO SCROLL
    gsap.to(spanCreati, {
        opacity: 1,
        duration: 1,
        stagger: 1, // Questo permette a GSAP di gestire la sequenza
        ease: "power1.out",
        scrollTrigger: {
            trigger: "#amo-section",
            start: "top 160",
            end: "+=1000",
            pin: true,
            scrub: 0.5, // Scrub dolce per la fluidità
        }
    });
    // 3. SFONDO
    gsap.to("#amo-section", {
        backgroundColor: "#2d2926",
        ease: "none",
        scrollTrigger: {
            trigger: "#amo-section",
            start: "top 160",
            end: "+=1000",
            scrub: 0.5,
        }
    });
    
    // 4. INKPATH CHE MI PORTO DIETRO DALL'Inizio
    // 5. CAMBIO COLORE DINAMICO ALL'ENTRATA/USCITA DI WORKS
    ScrollTrigger.create({
        trigger: "#works-section", // O il selettore della tua sezione Works
        start: "top top",        // Quando la testa di Works entra dal basso
        onEnter: () => {
            // Scendo: diventa dark-blue
            gsap.to("#ink-path", { fill: "#004f5e", duration: 0.3 });
        },
        onLeaveBack: () => {
            // Torno su: riprende il colore dark-text (o quello che avevi prima)
            gsap.to("#ink-path", { fill: "#2d2926", duration: 0.3 });
        }
    });
    
    const aboutTransition = gsap.timeline({
        scrollTrigger: {
            trigger: "#amo-section",
            start: "top 160",
            end: "+=1000",
            scrub: 0.5,
        }
    });
    
    aboutTransition
        .to("#ink-path", { 
            fill: "#2d2926", 
            immediateRender: false, 
            ease: "none" 
        }, 0) // lo 0 indica che iniziano insieme
        .to("#about-section", { 
            backgroundColor: "#2d2926", // O il colore che preferisci per il bg
            immediateRender: false, 
            ease: "none" 
        }, 0);
    
    // Refresh globale di sicurezza al resize della finestra
    window.addEventListener("resize", () => {
        ScrollTrigger.refresh();
        ScrollTrigger.getById("WORKS").refresh();
    });
    
    // Refresh globale di sicurezza al termine del caricamento immagini
    window.addEventListener('load', () => {
        ScrollTrigger.refresh();
    });
});
