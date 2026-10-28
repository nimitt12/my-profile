// Builds one crawlable page per homepage section (/about, /experience, ...) so search
// engines can index and list them as sitelinks. index.html is the single source of
// truth: edit it, then run `node scripts/build-pages.mjs` (also runs on `firebase deploy`).

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PUBLIC = fileURLToPath(new URL('../public/', import.meta.url));
const SITE = 'https://nimittajmera.com';
const MODIFIED = new Date().toISOString().slice(0, 10);

const pages = [
    {
        slug: 'about',
        section: 'about',
        type: 'AboutPage',
        crumb: 'About',
        title: 'About Nimitt Ajmera | Development Manager in Indore, India',
        description: 'About Nimitt Ajmera: Development Manager at TaskUs and full stack developer in Indore, India, leading agile teams that build AI SaaS, cloud and automation products.',
        heading: 'About <em>Nimitt Ajmera</em>',
        lede: 'Development Manager at TaskUs and full stack developer based in Indore, India, with 8+ years of building SaaS, cloud and automation products for clients across five regions.'
    },
    {
        slug: 'experience',
        section: 'journey',
        type: 'WebPage',
        crumb: 'Experience',
        title: 'Experience | Nimitt Ajmera, Development Manager at TaskUs',
        description: 'Career of Nimitt Ajmera, from intern at Prashuk Infotech Ventures and developer at Mango IT Solutions to Agile Development Supervisor and Development Manager at TaskUs.',
        heading: 'Experience &amp; <em>career</em>',
        lede: 'From an internship at Prashuk Infotech Ventures in 2018 to Development Manager at TaskUs: eight years of shipping software and growing the teams behind it.'
    },
    {
        slug: 'skills',
        section: 'toolkit',
        type: 'WebPage',
        crumb: 'Skills',
        title: 'Skills & Tech Stack | Nimitt Ajmera',
        description: 'Tech stack of Nimitt Ajmera: Node.js, NestJS, React, Python, PHP, Laravel, Java, AWS, GCP, Docker, Jenkins, MongoDB, PostgreSQL, MySQL, Supabase, Magento and Workato.',
        heading: 'Skills &amp; <em>tech stack</em>',
        lede: 'The languages, frameworks, cloud platforms, databases and automation tools behind the work, from Node.js, NestJS, React and Python to AWS, GCP, Docker and Workato.'
    },
    {
        slug: 'certifications',
        section: 'credentials',
        type: 'WebPage',
        crumb: 'Certifications',
        title: 'Certifications & Education | Nimitt Ajmera',
        description: 'Certifications of Nimitt Ajmera: Workato Automation Pro III and II, AWS Knowledge: Cloud Essentials, and a B.E. in Electronics & Communication from SAIT Indore.',
        heading: 'Certifications &amp; <em>education</em>',
        lede: 'Workato Automation Pro III and II, AWS Knowledge: Cloud Essentials, and a B.E. in Electronics &amp; Communication from Sri Aurobindo Institute of Technology, Indore.'
    },
    {
        slug: 'projects',
        section: 'work',
        type: 'CollectionPage',
        crumb: 'Projects',
        title: 'Projects & Case Studies | Nimitt Ajmera',
        description: 'Projects by Nimitt Ajmera: AI-powered call analysis SaaS, auto evaluation SaaS, Craftcart and Sessions Cannabis e-commerce, Utah Valley University NFC IDs and GEDIH Global.',
        heading: 'Projects &amp; <em>case studies</em>',
        lede: 'Six flagship products delivered for clients in the USA, Canada, India, the Philippines, Europe and the Americas, from AI call analysis to e-commerce and NFC campus IDs.'
    },
    {
        slug: 'contact',
        section: 'contact',
        type: 'ContactPage',
        crumb: 'Contact',
        title: 'Contact | Nimitt Ajmera',
        description: 'Contact Nimitt Ajmera, Development Manager and full stack developer in Indore, India, by email, contact form, LinkedIn or GitHub for projects, roles and collaborations.',
        heading: 'Get in <em>touch</em>',
        lede: 'Have a project, role or idea in mind? Email, use the form, or connect on LinkedIn. Based in Indore, India (IST) and working with teams worldwide.'
    }
];

const src = readFileSync(`${PUBLIC}index.html`, 'utf8');

const between = (str, start, end, from = 0) => {
    const a = str.indexOf(start, from);
    const b = str.indexOf(end, a + start.length);
    if (a < 0 || b < 0) throw new Error(`Marker not found: ${start} … ${end}`);
    return [a, b + end.length];
};

const escAttr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const stripTags = (s) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

function extractSection(id) {
    const at = src.indexOf(`id="${id}"`);
    const start = src.lastIndexOf('        <section', at);
    const end = src.indexOf('</section>', at) + '</section>'.length;
    if (at < 0 || start < 0) throw new Error(`Section #${id} not found`);
    return src.slice(start, end);
}

function setMeta(head, attr, key, value) {
    const re = new RegExp(`(<meta ${attr}="${key}" content=")[^"]*(">)`);
    if (!re.test(head)) throw new Error(`Meta ${key} not found`);
    return head.replace(re, `$1${escAttr(value)}$2`);
}

function jsonLd(page, url, sectionHtml) {
    const graph = [
        {
            '@type': page.type,
            '@id': `${url}#webpage`,
            url,
            name: page.title,
            description: page.description,
            isPartOf: { '@type': 'WebSite', '@id': `${SITE}/#website`, url: `${SITE}/`, name: 'Nimitt Ajmera' },
            about: { '@id': `${SITE}/#person` },
            breadcrumb: { '@id': `${url}#breadcrumb` },
            dateModified: MODIFIED,
            inLanguage: 'en'
        },
        {
            '@type': 'BreadcrumbList',
            '@id': `${url}#breadcrumb`,
            itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
                { '@type': 'ListItem', position: 2, name: page.crumb, item: url }
            ]
        },
        {
            '@type': 'Person',
            '@id': `${SITE}/#person`,
            name: 'Nimitt Ajmera',
            url: `${SITE}/`,
            jobTitle: 'Development Manager',
            worksFor: { '@type': 'Organization', name: 'TaskUs', url: 'https://www.taskus.com/' }
        }
    ];

    if (page.slug === 'projects') {
        const titles = [...sectionHtml.matchAll(/class="project__title">([\s\S]*?)<\/h3>/g)].map((m) => stripTags(m[1]));
        const descs = [...sectionHtml.matchAll(/class="project__desc">([\s\S]*?)<\/p>/g)].map((m) => stripTags(m[1]));
        graph[0].mainEntity = {
            '@type': 'ItemList',
            itemListElement: titles.map((name, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                item: { '@type': 'CreativeWork', name, description: descs[i], creator: { '@id': `${SITE}/#person` } }
            }))
        };
    }

    const json = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 4)
        .split('\n').map((line) => `        ${line}`).join('\n');
    return `    <script type="application/ld+json">\n${json}\n    </script>`;
}

const [headStart, headEnd] = between(src, '<head>', '</head>');
const baseHead = src.slice(headStart, headEnd);
const [, bodyOpenEnd] = between(src, '<body>', '\n');
const [mainOpen] = between(src, '    <main id="main">', '\n');
const chrome = src.slice(bodyOpenEnd, mainOpen)
    .replace(/ *<!-- Preloader -->[\s\S]*?(?= *<!-- Cursor -->)/, '');
const [footerStart] = between(src, '    <!-- ============ FOOTER', '\n');
const tail = src.slice(footerStart).replace(/ aria-current="page"/g, '');

pages.forEach((page, i) => {
    const url = `${SITE}/${page.slug}`;
    const next = pages[i + 1] || { slug: '', crumb: 'Home' };
    const section = extractSection(page.section);

    let head = baseHead
        .replace(/<title>[\s\S]*?<\/title>/, `<title>${page.title.replace(/&/g, '&amp;')}</title>`)
        .replace(/(<link rel="canonical" href=")[^"]*(">)/, `$1${url}$2`)
        .replace(/ *<meta property="profile:[^>]*>\n/g, '')
        .replace(/ *<script type="application\/ld\+json">[\s\S]*?<\/script>/, jsonLd(page, url, section));
    head = setMeta(head, 'name', 'description', page.description);
    head = setMeta(head, 'property', 'og:type', 'website');
    head = setMeta(head, 'property', 'og:url', url);
    head = setMeta(head, 'property', 'og:title', page.title);
    head = setMeta(head, 'property', 'og:description', page.description);
    head = setMeta(head, 'name', 'twitter:title', page.title);
    head = setMeta(head, 'name', 'twitter:description', page.description);

    const nav = chrome.replace(
        `href="/${page.slug}" data-scroll="${page.section}" class="menu__link"`,
        `href="/${page.slug}" data-scroll="${page.section}" class="menu__link" aria-current="page"`
    );

    const footer = tail
        .replace(`<a href="/${page.slug}">`, `<a href="/${page.slug}" aria-current="page">`)
        .replace('href="#top" class="footer__top"', 'href="#page-top" class="footer__top"');

    const html = `<!DOCTYPE html>
<!-- Generated from index.html by scripts/build-pages.mjs. Edit index.html, then run: node scripts/build-pages.mjs -->
<html lang="en">

${head}

<body>${nav}    <main id="main" class="page">
        <header class="page-hero" id="page-top">
            <div class="page-hero__glow" aria-hidden="true"></div>
            <div class="container">
                <nav aria-label="Breadcrumb" data-hero-fade>
                    <ol class="crumbs">
                        <li><a href="/">Home</a></li>
                        <li><span aria-current="page">${page.crumb}</span></li>
                    </ol>
                </nav>
                <h1 class="display" data-split>${page.heading}</h1>
                <p class="page-hero__lede" data-hero-fade>${page.lede}</p>
            </div>
        </header>

${section}

        <nav class="page-next" aria-label="Next page">
            <div class="container">
                <a href="/${next.slug}" class="page-next__link" data-cursor="Next">
                    <span class="page-next__label">Next</span>
                    <span class="page-next__title">${next.crumb}<i class="fa-solid fa-arrow-right" aria-hidden="true"></i></span>
                </a>
            </div>
        </nav>
    </main>

${footer}`;

    writeFileSync(`${PUBLIC}${page.slug}.html`, html);
    console.log(`✓ ${page.slug}.html`);
});

// Sitemap
const urls = [{ loc: `${SITE}/`, priority: '1.0', image: true }, ...pages.map((p) => ({ loc: `${SITE}/${p.slug}`, priority: '0.8' }))];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.map((u) => `    <url>
        <loc>${u.loc}</loc>
        <lastmod>${MODIFIED}</lastmod>
        <priority>${u.priority}</priority>${u.image ? `
        <image:image>
            <image:loc>${SITE}/img/nimitt-ajmera.png</image:loc>
        </image:image>` : ''}
    </url>`).join('\n')}
</urlset>
`;
writeFileSync(`${PUBLIC}sitemap.xml`, sitemap);
console.log('✓ sitemap.xml');
