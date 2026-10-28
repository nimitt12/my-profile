(() => {
    'use strict';

    const root = document.documentElement;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const hasGSAP = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';

    const $ = (sel, ctx = document) => ctx.querySelector(sel);
    const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

    root.classList.add('is-ready');

    /* ------------------------------------------------------------------
       Text helpers
       ------------------------------------------------------------------ */

    function splitChars(el) {
        const text = el.textContent.trim();
        el.textContent = '';
        return [...text].map((ch) => {
            const span = document.createElement('span');
            span.className = 'char';
            span.textContent = ch === ' ' ? ' ' : ch;
            el.appendChild(span);
            return span;
        });
    }

    // Wraps every word in a clipping mask, keeping inline wrappers like <em>
    function splitWords(el) {
        el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
        const nodes = [...el.childNodes];
        const inners = [];
        el.textContent = '';

        nodes.forEach((node) => {
            const text = node.textContent;
            const words = text.split(/\s+/).filter(Boolean);
            if (/^\s/.test(text) && el.lastChild && words.length) el.appendChild(document.createTextNode(' '));

            words.forEach((word, i) => {
                const mask = document.createElement('span');
                mask.className = 'word';
                mask.setAttribute('aria-hidden', 'true');
                const inner = document.createElement(node.nodeType === 1 ? node.tagName.toLowerCase() : 'span');
                inner.className = 'word-inner';
                inner.textContent = word;
                mask.appendChild(inner);
                el.appendChild(mask);
                inners.push(inner);
                if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
            });

            if (/\s$/.test(text) && words.length) el.appendChild(document.createTextNode(' '));
        });

        return inners;
    }

    const GLYPHS = '!<>-_\\/[]{}=+*^?#░▒▓';

    function scramble(el, to) {
        return new Promise((resolve) => {
            const from = el.textContent;
            const length = Math.max(from.length, to.length);
            const queue = [];
            for (let i = 0; i < length; i++) {
                const start = Math.floor(Math.random() * 10);
                queue.push({ from: from[i] || '', to: to[i] || '', start, end: start + 6 + Math.floor(Math.random() * 16), ch: '' });
            }

            let frame = 0;
            cancelAnimationFrame(el._scrambleRaf);
            const update = () => {
                let out = '';
                let done = 0;
                for (const q of queue) {
                    if (frame >= q.end) {
                        done++;
                        out += q.to;
                    } else if (frame >= q.start) {
                        if (!q.ch || Math.random() < 0.28) q.ch = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
                        out += q.ch;
                    } else {
                        out += q.from;
                    }
                }
                el.textContent = out;
                if (done === queue.length) {
                    resolve();
                } else {
                    frame++;
                    el._scrambleRaf = requestAnimationFrame(update);
                }
            };
            update();
        });
    }

    /* ------------------------------------------------------------------
       Features that work without GSAP
       ------------------------------------------------------------------ */

    // Live Indore clock
    const clockFormat = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
    const tick = () => $$('.js-clock').forEach((el) => { el.textContent = clockFormat.format(new Date()); });
    tick();
    setInterval(tick, 15000);
    $$('.js-year').forEach((el) => { el.textContent = new Date().getFullYear(); });

    // Rolling button labels
    $$('.btn__text').forEach((el) => {
        const span = document.createElement('span');
        span.textContent = el.textContent;
        el.textContent = '';
        el.appendChild(span);
    });

    // Copy email to clipboard
    const toast = $('.toast');
    let toastTimer;
    function showToast(message) {
        toast.textContent = message;
        toast.classList.add('is-visible');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2200);
    }

    $$('[data-copy]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const value = btn.dataset.copy;
            try {
                await navigator.clipboard.writeText(value);
                showToast(`Copied ${value}`);
            } catch {
                window.location.href = `mailto:${value}`;
            }
        });
    });

    // Rotating hero word
    const rotator = $('.hero__rotator');
    const rotatorWords = ['scalable SaaS', 'AI products', 'cloud automation', 'e-commerce', 'integrations'];
    if (rotator && !reduceMotion) {
        let index = 0;
        setInterval(() => {
            index = (index + 1) % rotatorWords.length;
            scramble(rotator, rotatorWords[index]);
        }, 3000);
    }

    // Menu
    const menu = $('.menu');
    const menuBtn = $('.nav__menu');
    const menuText = $('.nav__menu-text');
    let menuOpen = false;
    let lenis = null;

    $$('.menu__link').forEach((link, i) => {
        link.style.setProperty('--d', i);
    });

    let menuCloseTimer;

    function setMenu(open, fromKeyboard = false) {
        menuOpen = open;
        clearTimeout(menuCloseTimer);
        root.classList.toggle('menu-open', open);
        // Keep the overlay visible while the exit animation plays (matches the CSS timings)
        root.classList.toggle('menu-closing', !open);
        if (!open) menuCloseTimer = setTimeout(() => root.classList.remove('menu-closing'), 1050);
        menuBtn.setAttribute('aria-expanded', String(open));
        menu.setAttribute('aria-hidden', String(!open));
        menu.inert = !open;
        scramble(menuText, open ? 'Close' : 'Menu');
        if (open) {
            lenis?.stop();
            $('.nav').classList.remove('is-hidden');
            if (fromKeyboard) setTimeout(() => $('.menu__link')?.focus({ preventScroll: true }), 400);
        } else {
            lenis?.start();
        }
    }

    menu.inert = true;
    // detail === 0 means the click came from the keyboard
    menuBtn.addEventListener('click', (e) => setMenu(!menuOpen, e.detail === 0));
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && menuOpen) {
            setMenu(false);
            menuBtn.focus();
        }
    });

    // In-page anchors (smooth via Lenis when available). Links to section pages
    // carry data-scroll so they scroll in place when that section is on this page.
    document.addEventListener('click', (e) => {
        const link = e.target.closest('a[href^="#"], a[data-scroll]');
        if (!link) return;
        const id = link.dataset.scroll || link.getAttribute('href').slice(1);
        const target = id ? document.getElementById(id) : null;
        if (!target) return;
        e.preventDefault();
        if (menuOpen) setMenu(false);
        if (lenis) {
            lenis.scrollTo(target, { duration: 1.6, easing: (t) => 1 - Math.pow(1 - t, 4) });
        } else {
            target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
        }
        if (id !== 'top') history.replaceState(null, '', `#${id}`);
    });

    /* ------------------------------------------------------------------
       Hero WebGL: flowing aurora + magnifying dot grid
       ------------------------------------------------------------------ */

    const FRAG = `
        precision highp float;
        uniform vec2 u_res;
        uniform vec2 u_mouse;
        uniform float u_time;
        uniform float u_dpr;
        uniform float u_intro;

        vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }

        float snoise(vec2 v) {
            const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
            vec2 i = floor(v + dot(v, C.yy));
            vec2 x0 = v - i + dot(i, C.xx);
            vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
            vec4 x12 = x0.xyxy + C.xxzz;
            x12.xy -= i1;
            i = mod(i, 289.0);
            vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
            vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
            m = m * m;
            m = m * m;
            vec3 x = 2.0 * fract(p * C.www) - 1.0;
            vec3 h = abs(x) - 0.5;
            vec3 ox = floor(x + 0.5);
            vec3 a0 = x - ox;
            m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
            vec3 g;
            g.x = a0.x * x0.x + h.x * x0.y;
            g.yz = a0.yz * x12.xz + h.yz * x12.yw;
            return 130.0 * dot(m, g);
        }

        float fbm(vec2 p) {
            float v = 0.0;
            float a = 0.5;
            for (int i = 0; i < 4; i++) {
                v += a * snoise(p);
                p = p * 2.03 + 17.0;
                a *= 0.5;
            }
            return v;
        }

        void main() {
            vec2 frag = gl_FragCoord.xy;
            vec2 p = (frag - 0.5 * u_res) / u_res.y;
            vec2 m = (u_mouse - 0.5 * u_res) / u_res.y;
            float t = u_time * 0.04;

            vec2 q = vec2(fbm(p * 0.55 + vec2(0.0, t)), fbm(p * 0.55 + vec2(5.2, -t)));
            vec2 r = vec2(fbm(p * 0.7 + 1.2 * q + vec2(1.7, 9.2) + t * 1.5),
                          fbm(p * 0.7 + 1.2 * q + vec2(8.3, 2.8) - t));
            float f = fbm(p * 0.65 + 1.1 * r + (m - p) * 0.12);

            vec3 pink = vec3(1.0, 0.227, 0.51);
            vec3 violet = vec3(0.32, 0.2, 1.0);
            vec3 cyan = vec3(0.133, 0.827, 0.933);

            vec3 col = vec3(0.016, 0.016, 0.03);
            col = mix(col, violet * 0.62, smoothstep(-0.2, 0.8, f));
            col = mix(col, pink * 0.7, smoothstep(0.0, 0.7, r.x) * 0.5);
            col = mix(col, cyan * 0.5, smoothstep(0.2, 0.8, q.y) * 0.28);

            float md = length(p - m);
            col += pink * 0.16 * exp(-md * md * 5.0);

            vec2 uv = frag / u_res;
            float vig = smoothstep(1.2, 0.2, length((uv - vec2(0.62, 0.7)) * vec2(1.0, 1.35)));
            col *= 0.22 + 0.78 * vig;

            vec2 dv = frag - u_mouse;
            float radius = 220.0 * u_dpr;
            float lens = exp(-dot(dv, dv) / (radius * radius));
            vec2 g = frag - dv * lens * 0.32;
            float cell = 28.0 * u_dpr;
            vec2 gv = fract(g / cell) - 0.5;
            float d = length(gv) * cell;
            float rad = (0.85 + lens * 1.7) * u_dpr;
            float dotm = 1.0 - smoothstep(rad - 0.75 * u_dpr, rad + 0.75 * u_dpr, d);
            float bright = 0.05 + 0.6 * lens + 0.2 * smoothstep(0.0, 0.8, f);
            col += dotm * bright * mix(vec3(0.85, 0.86, 1.0), pink, lens * 0.6);

            gl_FragColor = vec4(col * u_intro, 1.0);
        }
    `;

    const VERT = `
        attribute vec2 a_pos;
        void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
    `;

    const heroGL = { intro: reduceMotion ? 1 : 0 };

    function initHeroGL() {
        const canvas = $('.hero__canvas');
        const gl = canvas && canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' });
        if (!gl) {
            root.classList.add('no-webgl');
            return;
        }

        const compile = (type, src) => {
            const shader = gl.createShader(type);
            gl.shaderSource(shader, src);
            gl.compileShader(shader);
            return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
        };
        const vs = compile(gl.VERTEX_SHADER, VERT);
        const fs = compile(gl.FRAGMENT_SHADER, FRAG);
        const program = gl.createProgram();
        if (!vs || !fs) {
            root.classList.add('no-webgl');
            return;
        }
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            root.classList.add('no-webgl');
            return;
        }
        gl.useProgram(program);

        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        const aPos = gl.getAttribLocation(program, 'a_pos');
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

        const u = {};
        ['u_res', 'u_mouse', 'u_time', 'u_dpr', 'u_intro'].forEach((name) => { u[name] = gl.getUniformLocation(program, name); });

        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        const mouse = { x: 0.62, y: 0.55 };
        const target = { x: 0.62, y: 0.55 };
        let width = 0;
        let height = 0;

        const resize = () => {
            width = canvas.clientWidth;
            height = canvas.clientHeight;
            canvas.width = Math.round(width * dpr);
            canvas.height = Math.round(height * dpr);
            gl.viewport(0, 0, canvas.width, canvas.height);
        };
        resize();
        new ResizeObserver(resize).observe(canvas);

        if (finePointer) {
            window.addEventListener('pointermove', (e) => {
                const rect = canvas.getBoundingClientRect();
                target.x = (e.clientX - rect.left) / rect.width;
                target.y = 1 - (e.clientY - rect.top) / rect.height;
            });
        }

        const start = performance.now();
        let visible = true;
        let raf = null;

        const render = (now) => {
            const t = (now - start) / 1000;
            if (!finePointer) {
                target.x = 0.55 + Math.sin(t * 0.35) * 0.25;
                target.y = 0.55 + Math.cos(t * 0.27) * 0.2;
            }
            mouse.x += (target.x - mouse.x) * 0.06;
            mouse.y += (target.y - mouse.y) * 0.06;

            gl.uniform2f(u.u_res, canvas.width, canvas.height);
            gl.uniform2f(u.u_mouse, mouse.x * canvas.width, mouse.y * canvas.height);
            gl.uniform1f(u.u_time, reduceMotion ? 12 : t);
            gl.uniform1f(u.u_dpr, dpr);
            gl.uniform1f(u.u_intro, heroGL.intro);
            gl.drawArrays(gl.TRIANGLES, 0, 3);

            raf = visible && !reduceMotion ? requestAnimationFrame(render) : null;
        };

        const io = new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting;
            if (visible && !raf) raf = requestAnimationFrame(render);
        });
        io.observe(canvas);

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                cancelAnimationFrame(raf);
                raf = null;
            } else if (visible && !raf) {
                raf = requestAnimationFrame(render);
            }
        });

        raf = requestAnimationFrame(render);
    }

    initHeroGL();

    /* ------------------------------------------------------------------
       Without GSAP: show everything and stop here
       ------------------------------------------------------------------ */

    if (!hasGSAP) {
        root.classList.remove('js');
        heroGL.intro = 1;
        $('.preloader')?.remove();
        return;
    }

    const { gsap, ScrollTrigger } = window;
    gsap.registerPlugin(ScrollTrigger);
    // Section pages only carry some of the animated elements
    gsap.config({ nullTargetWarn: false });

    /* ------------------------------------------------------------------
       Smooth scroll
       ------------------------------------------------------------------ */

    if (!reduceMotion && window.Lenis) {
        lenis = new window.Lenis({ lerp: 0.09 });
        lenis.on('scroll', ScrollTrigger.update);
        gsap.ticker.add((time) => lenis.raf(time * 1000));
    }

    /* ------------------------------------------------------------------
       Split text up front
       ------------------------------------------------------------------ */

    const heroChars = $$('[data-hero-chars]').flatMap(splitChars);
    const splitHeadings = $$('[data-split]').map((el) => ({ el, words: splitWords(el) }));
    const footerChars = $$('[data-footer-chars]').flatMap(splitChars);

    const statement = $('[data-words]');
    const statementWords = [];
    if (statement) {
        const words = statement.textContent.trim().split(/\s+/);
        statement.setAttribute('aria-label', words.join(' '));
        statement.textContent = '';
        words.forEach((word, i) => {
            const span = document.createElement('span');
            span.className = 'w';
            span.setAttribute('aria-hidden', 'true');
            span.textContent = word;
            statement.appendChild(span);
            if (i < words.length - 1) statement.appendChild(document.createTextNode(' '));
            statementWords.push(span);
        });
    }

    /* ------------------------------------------------------------------
       Reduced motion: reveal everything, skip choreography
       ------------------------------------------------------------------ */

    if (reduceMotion) {
        $('.preloader')?.remove();
        gsap.set('[data-reveal], [data-hero-fade]', { opacity: 1, y: 0 });
        splitHeadings.forEach(({ el }) => el.classList.add('is-revealed'));
        initNav();
        return;
    }

    /* ------------------------------------------------------------------
       Initial states
       ------------------------------------------------------------------ */

    gsap.set(heroChars, { yPercent: 115 });
    splitHeadings.forEach(({ words }) => gsap.set(words, { yPercent: 115, rotate: 4 }));
    gsap.set(footerChars, { yPercent: 100 });
    $$('[data-count]').forEach((el) => { el.textContent = '0'; });
    gsap.set('.tile', { opacity: 0, y: 24, scale: 0.92 });

    /* ------------------------------------------------------------------
       Preloader → hero intro
       ------------------------------------------------------------------ */

    function runPreloader() {
        const pre = $('.preloader');
        if (!pre) return Promise.resolve();

        if (!location.hash) {
            history.scrollRestoration = 'manual';
            window.scrollTo(0, 0);
        }
        lenis?.stop();

        const count = $('.preloader__count');
        const counter = { v: 0 };

        return new Promise((resolve) => {
            gsap.timeline({
                onComplete: () => {
                    pre.remove();
                    lenis?.start();
                }
            })
                .from('.preloader__name span', { yPercent: 110, duration: 1.1, ease: 'expo.out', stagger: 0.1 })
                .to(counter, {
                    v: 100,
                    duration: 1.6,
                    ease: 'power2.inOut',
                    onUpdate: () => { count.textContent = String(Math.round(counter.v)).padStart(3, '0'); }
                }, 0)
                .to('.preloader__bar span', { scaleX: 1, duration: 1.6, ease: 'power2.inOut' }, 0)
                .to('.preloader__inner', { yPercent: -40, opacity: 0, duration: 0.6, ease: 'power3.in' }, '+=0.1')
                .to(pre, { clipPath: 'inset(0% 0% 100% 0%)', duration: 1.1, ease: 'expo.inOut' }, '-=0.3')
                .call(resolve, null, '-=0.55');
        });
    }

    function heroIntro() {
        gsap.timeline({ defaults: { ease: 'expo.out' } })
            .to(heroGL, { intro: 1, duration: 2.4, ease: 'power2.out' }, 0)
            .to(heroChars, { yPercent: 0, duration: 1.5, stagger: 0.045 }, 0)
            .fromTo('[data-hero-fade]', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 1.4, stagger: 0.12 }, 0.4)
            .fromTo('.nav > *', { y: -30, opacity: 0 }, { y: 0, opacity: 1, duration: 1.2, stagger: 0.08, clearProps: 'transform,opacity' }, 0.5);
    }

    runPreloader().then(heroIntro);

    /* ------------------------------------------------------------------
       Scroll choreography (created in page order so pins are measured first)
       ------------------------------------------------------------------ */

    // Hero parallax out
    if ($('.hero')) {
        gsap.timeline({ scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } })
            .to('.hero__line--1', { xPercent: -14, ease: 'none' }, 0)
            .to('.hero__line--2', { xPercent: 12, ease: 'none' }, 0)
            .to('.hero__content', { yPercent: 22, opacity: 0.15, ease: 'none' }, 0)
            .to('.hero__canvas', { scale: 1.12, opacity: 0.35, ease: 'none' }, 0);
    }

    const mm = gsap.matchMedia();

    // Journey: horizontal scroll on desktop
    if ($('.journey')) mm.add('(min-width: 901px)', () => {
        root.classList.add('js-pin');
        const track = $('.journey__track');
        const bar = $('.journey__progress span');
        const distance = () => track.scrollWidth - window.innerWidth;

        const scroll = gsap.to(track, {
            x: () => -distance(),
            ease: 'none',
            scrollTrigger: {
                trigger: '.journey',
                start: 'top top',
                end: () => `+=${distance()}`,
                pin: true,
                scrub: 1,
                anticipatePin: 1,
                invalidateOnRefresh: true,
                onUpdate: (self) => gsap.set(bar, { scaleX: self.progress })
            }
        });

        $$('.job').forEach((job) => {
            gsap.fromTo($('.job__year', job), { xPercent: 12 }, {
                xPercent: -12,
                ease: 'none',
                scrollTrigger: { trigger: job, containerAnimation: scroll, start: 'left right', end: 'right left', scrub: true }
            });
            gsap.from($('.job__card', job), {
                y: 120,
                rotate: 4,
                opacity: 0,
                ease: 'power2.out',
                scrollTrigger: { trigger: job, containerAnimation: scroll, start: 'left 95%', end: 'left 50%', scrub: true }
            });
        });

        return () => root.classList.remove('js-pin');
    });

    mm.add('(max-width: 900px)', () => {
        $$('.job').forEach((job) => {
            gsap.from(job, {
                y: 60,
                opacity: 0,
                duration: 1.1,
                ease: 'expo.out',
                scrollTrigger: { trigger: job, start: 'top 85%', once: true }
            });
        });
    });

    // Marquee driven by scroll velocity
    const marqueeTweens = [];
    const marqueeInners = [];
    $$('.marquee__row').forEach((row) => {
        const track = $('.marquee__track', row);
        const inner = document.createElement('div');
        inner.style.cssText = 'display:flex;width:max-content;will-change:transform';
        const clone = track.cloneNode(true);
        clone.setAttribute('aria-hidden', 'true');
        row.appendChild(inner);
        inner.append(track, clone);
        const dir = Number(row.dataset.direction) || 1;
        marqueeInners.push(inner);
        marqueeTweens.push({
            dir,
            tween: gsap.fromTo(inner, { xPercent: dir > 0 ? 0 : -50 }, { xPercent: dir > 0 ? -50 : 0, duration: 38, ease: 'none', repeat: -1 })
        });
    });

    const skewTo = gsap.quickTo(marqueeInners, 'skewX', { duration: 0.5, ease: 'power3' });
    let scrollVelocity = 0;
    let scrollDirection = 1;
    lenis?.on('scroll', (e) => {
        scrollVelocity = e.velocity;
        if (e.direction) scrollDirection = e.direction;
    });
    gsap.ticker.add(() => {
        const boost = 1 + Math.min(Math.abs(scrollVelocity) * 0.12, 5);
        marqueeTweens.forEach(({ tween }) => tween.timeScale(scrollDirection * boost));
        skewTo(gsap.utils.clamp(-8, 8, scrollVelocity * -0.25));
        scrollVelocity *= 0.92;
    });

    // Headings
    splitHeadings.forEach(({ el, words }) => {
        ScrollTrigger.create({
            trigger: el,
            start: 'top 85%',
            once: true,
            onEnter: () => gsap.to(words, {
                yPercent: 0,
                rotate: 0,
                duration: 1.3,
                ease: 'expo.out',
                stagger: 0.06,
                // The masks only matter mid-reveal; unclip afterwards so no glyph can be cut
                onComplete: () => el.classList.add('is-revealed')
            })
        });
    });

    // About statement: words light up as you scroll
    if (statementWords.length) {
        gsap.fromTo(statementWords, { opacity: 0.12 }, {
            opacity: 1,
            ease: 'none',
            stagger: 0.1,
            scrollTrigger: { trigger: statement, start: 'top 80%', end: 'bottom 45%', scrub: true }
        });
    }

    // About portrait parallax
    if ($('.about__photo')) {
        gsap.fromTo('.about__photo img', { yPercent: -8, scale: 1.25 }, {
            yPercent: 8,
            scale: 1.25,
            ease: 'none',
            scrollTrigger: { trigger: '.about__photo', start: 'top bottom', end: 'bottom top', scrub: true }
        });
    }

    // Generic reveals
    ScrollTrigger.batch('[data-reveal]', {
        start: 'top 88%',
        once: true,
        onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 1.3, ease: 'expo.out', stagger: 0.1 })
    });

    ScrollTrigger.batch('.tile', {
        start: 'top 92%',
        once: true,
        onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, scale: 1, duration: 0.9, ease: 'back.out(1.7)', stagger: 0.04 })
    });

    // Counters
    $$('[data-count]').forEach((el) => {
        const end = Number(el.dataset.count);
        const obj = { v: 0 };
        ScrollTrigger.create({
            trigger: el,
            start: 'top 90%',
            once: true,
            onEnter: () => gsap.to(obj, {
                v: end,
                duration: 2,
                ease: 'power3.out',
                onUpdate: () => { el.textContent = Math.round(obj.v); }
            })
        });
    });

    // Certificates fan out from a stack
    if ($('.certs')) mm.add('(min-width: 1101px)', () => {
        const cards = $$('.cert');
        gsap.fromTo(cards, {
            x: (i) => (1 - i) * (cards[0].offsetWidth + 20),
            y: (i) => Math.abs(i - 1) * 50,
            rotation: (i) => (i - 1) * 7
        }, {
            x: 0,
            y: 0,
            rotation: 0,
            ease: 'power1.out',
            immediateRender: true,
            scrollTrigger: { trigger: '.certs', start: 'top 90%', end: 'top 30%', scrub: 1, invalidateOnRefresh: true }
        });
    });

    if ($('.certs')) mm.add('(max-width: 1100px)', () => {
        gsap.from('.cert', {
            y: 80,
            opacity: 0,
            duration: 1.2,
            ease: 'expo.out',
            stagger: 0.12,
            scrollTrigger: { trigger: '.certs', start: 'top 85%', once: true }
        });
    });

    // Projects: stacked cards shrink and dim as the next arrives
    const projects = $$('.project');
    projects.forEach((card, i) => {
        if (i === projects.length - 1) return;
        gsap.to(card, {
            scale: 1 - (projects.length - i) * 0.025,
            '--shade': 0.55,
            ease: 'none',
            scrollTrigger: { trigger: projects[i + 1], start: 'top bottom', end: 'top 25%', scrub: true }
        });
    });

    projects.forEach((card) => {
        gsap.fromTo($('.project__icon', card), { y: 60 }, {
            y: -40,
            ease: 'none',
            scrollTrigger: { trigger: card, start: 'top bottom', end: 'bottom top', scrub: true }
        });
    });

    // Footer wordmark rises
    gsap.to(footerChars, {
        yPercent: 0,
        ease: 'none',
        stagger: 0.04,
        scrollTrigger: { trigger: '.footer', start: 'top bottom', end: 'bottom bottom', scrub: 1 }
    });

    // Contact glow follows the scroll a little
    if ($('.contact')) {
        gsap.fromTo('.contact__glow', { yPercent: -20 }, {
            yPercent: 20,
            ease: 'none',
            scrollTrigger: { trigger: '.contact', start: 'top bottom', end: 'bottom top', scrub: true }
        });
    }

    // Page progress
    gsap.to('.progress span', {
        scaleX: 1,
        ease: 'none',
        scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: 0.3 }
    });

    initNav();

    /* ------------------------------------------------------------------
       Nav: hide on scroll down
       ------------------------------------------------------------------ */

    function initNav() {
        const nav = $('.nav');
        ScrollTrigger.create({
            start: 'top -200',
            end: 'max',
            onUpdate: (self) => {
                if (!menuOpen) nav.classList.toggle('is-hidden', self.direction === 1);
            },
            onLeaveBack: () => nav.classList.remove('is-hidden')
        });
    }

    /* ------------------------------------------------------------------
       Pointer effects (desktop only)
       ------------------------------------------------------------------ */

    if (finePointer) {
        // Cursor
        root.classList.add('has-cursor');
        const cursor = $('.cursor');
        const dot = $('.cursor__dot');
        const ring = $('.cursor__ring');
        const label = $('.cursor__label');
        const dotX = gsap.quickTo(dot, 'x', { duration: 0.08, ease: 'none' });
        const dotY = gsap.quickTo(dot, 'y', { duration: 0.08, ease: 'none' });
        const ringX = gsap.quickTo(ring, 'x', { duration: 0.5, ease: 'power3' });
        const ringY = gsap.quickTo(ring, 'y', { duration: 0.5, ease: 'power3' });

        window.addEventListener('pointermove', (e) => {
            dotX(e.clientX);
            dotY(e.clientY);
            ringX(e.clientX);
            ringY(e.clientY);
        });

        document.addEventListener('pointerover', (e) => {
            const target = e.target.closest('a, button, [data-cursor], .tile');
            cursor.classList.toggle('is-label', Boolean(target?.dataset.cursor));
            cursor.classList.toggle('is-hover', Boolean(target && !target.dataset.cursor));
            if (target?.dataset.cursor) label.textContent = target.dataset.cursor;
        });

        document.documentElement.addEventListener('pointerleave', () => cursor.classList.add('is-hidden'));
        document.documentElement.addEventListener('pointerenter', () => cursor.classList.remove('is-hidden'));

        // Magnetic elements
        $$('[data-magnetic]').forEach((el) => {
            const strength = el.classList.contains('contact__cta') ? 0.4 : 0.3;
            const xTo = gsap.quickTo(el, 'x', { duration: 1, ease: 'elastic.out(1, 0.4)' });
            const yTo = gsap.quickTo(el, 'y', { duration: 1, ease: 'elastic.out(1, 0.4)' });
            el.addEventListener('pointermove', (e) => {
                const r = el.getBoundingClientRect();
                xTo((e.clientX - (r.left + r.width / 2)) * strength);
                yTo((e.clientY - (r.top + r.height / 2)) * strength);
            });
            el.addEventListener('pointerleave', () => {
                xTo(0);
                yTo(0);
            });
        });

        // 3D tilt + glare
        $$('[data-tilt]').forEach((el) => {
            gsap.set(el, { transformPerspective: 1000 });
            const rx = gsap.quickTo(el, 'rotationX', { duration: 0.6, ease: 'power3' });
            const ry = gsap.quickTo(el, 'rotationY', { duration: 0.6, ease: 'power3' });
            el.addEventListener('pointermove', (e) => {
                const r = el.getBoundingClientRect();
                const px = (e.clientX - r.left) / r.width;
                const py = (e.clientY - r.top) / r.height;
                rx((0.5 - py) * 14);
                ry((px - 0.5) * 14);
                el.style.setProperty('--mx', `${px * 100}%`);
                el.style.setProperty('--my', `${py * 100}%`);
                el.style.setProperty('--sx', `${px * 100}%`);
                el.style.setProperty('--sy', `${py * 100}%`);
            });
            el.addEventListener('pointerleave', () => {
                rx(0);
                ry(0);
            });
        });

        // Bento spotlight
        const bento = $('.bento');
        const groups = $$('.bento__group');
        bento?.addEventListener('pointermove', (e) => {
            groups.forEach((g) => {
                const r = g.getBoundingClientRect();
                g.style.setProperty('--mx', `${e.clientX - r.left}px`);
                g.style.setProperty('--my', `${e.clientY - r.top}px`);
            });
        });

        // Scrambled nav labels on hover
        $$('.menu__label').forEach((el) => {
            const original = el.textContent;
            el.parentElement.addEventListener('pointerenter', () => scramble(el, original));
        });
    }

    // Re-measure once fonts and images settle
    document.fonts?.ready.then(() => ScrollTrigger.refresh());
    window.addEventListener('load', () => ScrollTrigger.refresh());
})();
