/**
 * Portfolio Main Logic
 * Single Page Experience, Animations, and Data Orchestration
 */

document.addEventListener('DOMContentLoaded', () => {
    // Prevent default browser scroll jumps for dynamically loaded data
    if (window.history && 'scrollRestoration' in window.history) {
        window.history.scrollRestoration = 'manual';
    }

    // 1. Initial State & Data Fetching
    const state = {
        data: null,
        typingIdx: 0,
        textIdx: 0,
        isDeleting: false
    };

    // Save scroll position before reload to maintain position
    window.addEventListener('beforeunload', () => {
        sessionStorage.setItem('portfolioScrollPosition', window.scrollY);
    });

    bootstrap();

    // 2. Core Functions
    async function bootstrap() {
        initTheme();
        initMobileMenu();
        initScrollEffects();
        
        // Fetch all data
        try {
            const response = await fetch('/api/v1/public/data');
            const result = await response.json();
            if (!result.error) {
                state.data = result.data;
                populatePortfolio(result.data);
                initTypingAnimation();
                
                // Restore scroll position after DOM rendering
                const restoreScroll = () => {
                    const savedScroll = sessionStorage.getItem('portfolioScrollPosition');
                    if (window.location.hash) {
                        const target = document.querySelector(window.location.hash);
                        if (target) {
                            target.scrollIntoView();
                        }
                    } else if (savedScroll) {
                        window.scrollTo(0, parseInt(savedScroll, 10));
                    }
                };
                
                // Fire multiple times to account for reflows when images finish loading
                setTimeout(restoreScroll, 50);
                setTimeout(restoreScroll, 300);
                setTimeout(restoreScroll, 800);
            }
        } catch (err) {
            console.error('Failed to load portfolio data:', err);
        }
    }

    // --- DOM POPULATION ---
    function populatePortfolio(data) {
        const { profile, contacts, skills, experiences, projects, certifications, publications, education, trainings } = data;

        // --- Hero & About ---
        if (profile) {
            document.getElementById('heroName').textContent = profile.firstname + ' ' + (profile.lastname || '');
            document.getElementById('aboutBio').textContent = profile.bio || 'Professional software engineer focusing on cloud and scalable systems.';
            if (profile.profilepicurl) document.getElementById('aboutImage').src = profile.profilepicurl;
            if (profile.resume_url) document.getElementById('downloadResume').href = profile.resume_url;
            
            document.getElementById('statYears').textContent = profile.years_of_experience || '0';
        }

        // Stats
        document.getElementById('statProjects').textContent = projects.length;
        document.getElementById('statCerts').textContent = certifications.length;
        document.getElementById('statPapers').textContent = publications.length;

        // --- Skills Registry ---
        const skillsContainer = document.getElementById('skillsContainer');
        skillsContainer.innerHTML = '';
        skillsContainer.className = 'grid grid-cols-1 md:grid-cols-2 gap-5';

        // Category visual config — maps category name keywords to color theme
        const categoryConfig = {
            'devops':      { color: 'blue',   dot: '#378ADD', icon: 'fas fa-cloud' },
            'cloud':       { color: 'blue',   dot: '#378ADD', icon: 'fas fa-cloud' },
            'ci':          { color: 'green',  dot: '#639922', icon: 'fas fa-infinity' },
            'automation':  { color: 'green',  dot: '#639922', icon: 'fas fa-infinity' },
            'backend':     { color: 'purple', dot: '#7F77DD', icon: 'fas fa-code' },
            'programming': { color: 'purple', dot: '#7F77DD', icon: 'fas fa-code' },
            'infra':       { color: 'amber',  dot: '#BA7517', icon: 'fas fa-database' },
            'database':    { color: 'amber',  dot: '#BA7517', icon: 'fas fa-database' },
            'version':     { color: 'teal',   dot: '#1D9E75', icon: 'fas fa-code-branch' },
            'tools':       { color: 'gray',   dot: '#888780', icon: 'fas fa-wrench' },
        };

        const colorClasses = {
            blue:   { bg: 'bg-blue-50 dark:bg-blue-900/20',   icon: 'text-blue-600 dark:text-blue-400'   },
            green:  { bg: 'bg-green-50 dark:bg-green-900/20', icon: 'text-green-700 dark:text-green-400' },
            purple: { bg: 'bg-purple-50 dark:bg-purple-900/20', icon: 'text-purple-600 dark:text-purple-400' },
            amber:  { bg: 'bg-amber-50 dark:bg-amber-900/20', icon: 'text-amber-700 dark:text-amber-400' },
            teal:   { bg: 'bg-teal-50 dark:bg-teal-900/20',   icon: 'text-teal-600 dark:text-teal-400'  },
            gray:   { bg: 'bg-gray-100 dark:bg-gray-800',     icon: 'text-gray-500 dark:text-gray-400'  },
        };

        function getCategoryConfig(categoryName) {
            const lower = categoryName.toLowerCase();
            for (const [key, val] of Object.entries(categoryConfig)) {
                if (lower.includes(key)) return val;
            }
            return { color: 'gray', dot: '#888780', icon: 'fas fa-layer-group' };
        }

        Object.keys(skills).forEach(category => {
            const cfg = getCategoryConfig(category);
            const colors = colorClasses[cfg.color] || colorClasses.gray;
            const skillList = skills[category];

            const card = document.createElement('div');
            card.className = 'bg-white dark:bg-dark-card border border-gray-100 dark:border-dark-border rounded-2xl p-6 transition-all duration-300 hover:border-gray-200 dark:hover:border-gray-600';

            card.innerHTML = `
                <div class="flex items-center gap-3 mb-5 pb-4 border-b border-gray-100 dark:border-dark-border">
                    <div class="w-9 h-9 rounded-lg ${colors.bg} flex items-center justify-center flex-shrink-0">
                        <i class="${cfg.icon} text-sm ${colors.icon}"></i>
                    </div>
                    <div>
                        <h3 class="text-sm font-bold dark:text-white leading-tight">${category}</h3>
                        <p class="text-[10px] text-gray-400 mt-0.5">${skillList.length} ${skillList.length === 1 ? 'technology' : 'technologies'}</p>
                    </div>
                </div>
                <div class="flex flex-wrap gap-2">
                    ${skillList.map(skill => `
                        <span class="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium
                                    bg-gray-50 dark:bg-gray-800/60
                                    border border-gray-100 dark:border-gray-700
                                    text-gray-600 dark:text-gray-300
                                    rounded-lg transition-colors hover:border-gray-300 dark:hover:border-gray-500">
                            <span class="w-1.5 h-1.5 rounded-full flex-shrink-0" style="background-color: ${cfg.dot}"></span>
                            ${skill.icon_slug ? `<i class="${skill.icon_slug} text-xs"></i>` : ''}
                            ${skill.name}
                        </span>
                    `).join('')}
                </div>
            `;

            skillsContainer.appendChild(card);
        });

        // --- Experience Timeline ---
        const expTimeline = document.getElementById('experienceTimeline');
        expTimeline.innerHTML = '';

        experiences.forEach((exp, idx) => {
            const dateStr = formatDate(exp.start_date) + ' — ' + (exp.end_date ? formatDate(exp.end_date) : 'Present');
            const item = document.createElement('div');
            item.className = 'relative pl-12 md:pl-0';
            item.innerHTML = `
                <div class="md:flex items-start">
                    <div class="hidden md:block w-1/2 text-right pr-12 pt-1 font-mono text-sm text-gray-400">
                        ${dateStr}
                    </div>
                    
                    <!-- Bullet -->
                    <div class="absolute left-0 md:left-1/2 w-4 h-4 rounded-full bg-primary border-4 border-white dark:border-dark-bg -translate-x-1/2 z-10"></div>
                    
                    <div class="md:w-1/2 md:pl-12">
                        <div class="p-6 card-glass">
                            <div class="flex items-center gap-4 mb-4">
                                ${exp.company_logo_url ? `<img src="${exp.company_logo_url}" class="w-10 h-10 rounded-lg object-contain bg-white p-1">` : `<div class="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-primary"><i class="fas fa-briefcase"></i></div>`}
                                <div>
                                    <h4 class="font-bold dark:text-white leading-tight">${exp.role}</h4>
                                    <p class="text-sm text-gray-500">${exp.company} • <span class="md:hidden">${dateStr}</span></p>
                                </div>
                            </div>
                            <div class="text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-line">${exp.description}</div>
                        </div>
                    </div>
                </div>
            `;
            expTimeline.appendChild(item);
        });

        // --- Projects Grid ---
        const projectGrid = document.getElementById('projectGrid');
        const projectFilters = document.getElementById('projectFilters');
        projectGrid.innerHTML = '';
        
        // Dynamic Filters logic
        const categories = [...new Set(projects.map(p => p.category || 'Misc'))];
        projectFilters.innerHTML = '<button data-filter="all" class="filter-btn active">All</button>';
        categories.forEach(cat => {
            const btn = document.createElement('button');
            btn.className = 'filter-btn';
            const slug = cat.toLowerCase().replace(/\s+/g, '-');
            btn.setAttribute('data-filter', slug);
            btn.textContent = cat;
            projectFilters.appendChild(btn);
        });

        projects.forEach(proj => {
            const card = document.createElement('div');
            const categorySlug = (proj.category || 'misc').toLowerCase().replace(/\s+/g, '-');
            card.className = "project-card " + categorySlug;
            const thumbnail = proj.thumbnail_url || 'https://via.placeholder.com/600x400?text=' + encodeURIComponent(proj.title);
            
            card.innerHTML = `
                <div class="card-glass h-full flex flex-col overflow-hidden">
                    <div class="relative group cursor-pointer aspect-video overflow-hidden">
                        <img src="${thumbnail}" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110">
                        ${proj.is_featured ? `
                        <div class="absolute top-4 right-4 z-20">
                            <span class="px-3 py-1 bg-primary text-white text-[10px] font-bold uppercase rounded-full shadow-lg">Featured</span>
                        </div>
                        ` : ''}
                        <div class="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            ${proj.live_url ? `<a href="${proj.live_url}" target="_blank" class="p-2 h-10 w-10 bg-white rounded-full text-primary flex items-center justify-center m-1 shadow-lg"><i class="fas fa-external-link-alt"></i></a>` : ''}
                            ${proj.github_url ? `<a href="${proj.github_url}" target="_blank" class="p-2 h-10 w-10 bg-white rounded-full text-gray-900 flex items-center justify-center m-1 shadow-lg"><i class="fab fa-github"></i></a>` : ''}
                        </div>
                    </div>
                    <div class="p-6 flex-grow flex flex-col">
                        <div class="flex flex-wrap gap-2 mb-4">
                            ${(proj.tags || []).map(tag => `<span class="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-[10px] rounded uppercase font-bold text-gray-500">${tag}</span>`).join('')}
                        </div>
                        <h4 class="text-lg font-bold mb-2 dark:text-white">${proj.title}</h4>
                        <p class="text-sm text-gray-600 dark:text-gray-400 mb-6">${proj.short_description || ''}</p>
                        
                        <div class="mt-auto pt-4 border-t border-gray-100 dark:border-dark-border">
                            <button onclick='window.openProjectModal(${JSON.stringify(proj).replace(/'/g, "&apos;")})' class="text-sm font-bold text-primary hover:text-blue-600 transition-colors flex items-center gap-2">
                                Learn More <i class="fas fa-arrow-right text-xs"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
            projectGrid.appendChild(card);
        });

        // Expose modal function globally for onclick
        window.openProjectModal = openProjectModal;

        // --- Certifications ---
        const certGrid = document.getElementById('certificationsGrid');
        certGrid.innerHTML = '';
        
        certifications.forEach(cert => {
            const card = document.createElement('div');
            card.className = 'card-glass p-5 flex flex-col h-full cursor-pointer hover:border-primary group';
            card.onclick = () => openCertModal(cert);
            
            const statusColor = cert.status === 'active' ? 'bg-green-500' : (cert.status === 'scheduled' ? 'bg-amber-500' : 'bg-red-500');
            
            card.innerHTML = `
                <div class="flex justify-between items-start mb-4">
                    <div class="w-12 h-12 rounded-lg bg-gray-50 dark:bg-gray-800 flex items-center justify-center p-2 border border-gray-100 dark:border-dark-border">
                        ${cert.badge_image_url ? `<img src="${cert.badge_image_url}" class="w-full h-full object-contain">` : `<i class="fas fa-award text-2xl text-primary/30"></i>`}
                    </div>
                    <span class="flex items-center gap-1.5 px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                        <span class="w-1.5 h-1.5 rounded-full ${statusColor}"></span>
                        ${cert.status}
                    </span>
                </div>
                <h4 class="font-bold dark:text-white leading-tight mb-1 group-hover:text-primary transition-colors">${cert.title}</h4>
                <p class="text-xs font-medium text-blue-600 dark:text-blue-400 mb-4">${cert.issuer}</p>
                <div class="mt-auto flex flex-col gap-3">
                    <div class="flex justify-between items-center text-[10px] text-gray-400 font-mono">
                        <span>Issued: ${cert.issued_date ? formatDate(cert.issued_date) : 'N/A'}</span>
                        ${cert.expiry_date ? `<span>Expires: ${formatDate(cert.expiry_date)}</span>` : ''}
                    </div>
                    ${cert.credential_url ? `
                    <a href="${cert.credential_url}" target="_blank" onclick="event.stopPropagation()" class="text-center w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-primary hover:text-white transition-all text-xs font-bold rounded-lg text-gray-600 dark:text-gray-300">
                        View Credential <i class="fas fa-external-link-alt ml-1 text-[10px]"></i>
                    </a>
                    ` : ''}
                </div>
            `;
            certGrid.appendChild(card);
        });

        // --- Publications ---
        const pubContainer = document.getElementById('publicationsContainer');
        pubContainer.innerHTML = '';
        
        publications.forEach(pub => {
            const item = document.createElement('div');
            item.className = 'card-glass p-6 md:p-8 flex flex-col md:flex-row gap-6';
            item.innerHTML = `
                <div class="md:w-32 flex-shrink-0 flex md:flex-col items-center gap-4 text-center">
                    <div class="w-16 h-16 rounded-xl bg-red-50 dark:bg-red-900/10 flex items-center justify-center text-red-500 text-2xl">
                        <i class="far fa-file-pdf"></i>
                    </div>
                    <div class="text-[10px] uppercase font-bold text-gray-400">Published<br>${new Date(pub.published_date).getFullYear()}</div>
                </div>
                <div class="flex-grow">
                    <h4 class="text-xl font-bold mb-2 dark:text-white">${pub.title}</h4>
                    <p class="text-sm text-blue-600 font-medium mb-3">${pub.journal_name} • ${pub.publisher}</p>
                    <p class="text-sm text-gray-500 dark:text-gray-400 mb-6 italic">Authors: ${(pub.authors || []).join(', ')}</p>
                    <div class="flex flex-wrap gap-4">
                        ${pub.pdf_url ? `<a href="${pub.pdf_url}" target="_blank" class="text-xs font-bold flex items-center gap-2 border border-gray-100 dark:border-dark-border px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-bg transition-colors uppercase tracking-widest"><i class="fas fa-book-open"></i> Full Text</a>` : ''}
                        ${pub.doi ? `<a href="https://doi.org/${pub.doi}" target="_blank" class="text-xs font-bold text-gray-400 hover:text-primary transition-colors flex items-center gap-2 uppercase tracking-widest">DOI: ${pub.doi}</a>` : ''}
                    </div>
                </div>
            `;
            pubContainer.appendChild(item);
        });

        // --- Education ---
        const eduContainer = document.getElementById('educationContainer');
        eduContainer.innerHTML = '';

        education.forEach(edu => {
            const div = document.createElement('div');
            div.className = 'bg-white dark:bg-dark-card border border-gray-100 dark:border-dark-border rounded-2xl p-5 flex gap-4 items-start transition-colors hover:border-gray-200 dark:hover:border-gray-600';
            div.innerHTML = `
                <div class="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
                    ${edu.institution_logo_url
                        ? `<img src="${edu.institution_logo_url}" class="w-7 h-7 object-contain">`
                        : `<i class="fas fa-graduation-cap text-blue-500 dark:text-blue-400 text-base"></i>`}
                </div>
                <div class="flex-1 min-w-0">
                    <h4 class="font-bold text-sm dark:text-white leading-snug mb-1">${edu.degree}</h4>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">${edu.field_of_study || ''}</p>
                    <div class="flex flex-wrap items-center gap-2">
                        <span class="text-[11px] text-gray-400 dark:text-gray-500">${edu.institution}</span>
                        <span class="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600"></span>
                        <span class="text-[11px] text-gray-400 dark:text-gray-500 font-mono">${edu.start_year} – ${edu.end_year || 'Present'}</span>
                        ${edu.cgpa ? `
                        <span class="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-full">
                            CGPA ${edu.cgpa}
                        </span>` : ''}
                    </div>
                </div>
            `;
            eduContainer.appendChild(div);
        });

        // --- Trainings ---
        const trainContainer = document.getElementById('trainingsContainer');
        trainContainer.innerHTML = '';

        const trainingAccentColors = [
            { bar: 'bg-purple-500', badge: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20' },
            { bar: 'bg-teal-500',   badge: 'text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20' },
            { bar: 'bg-blue-500',   badge: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20' },
            { bar: 'bg-amber-500',  badge: 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20' },
        ];

        trainings.forEach((tr, idx) => {
            const accent = trainingAccentColors[idx % trainingAccentColors.length];
            const startDate = tr.start_date ? formatDate(tr.start_date) : null;
            const endDate   = tr.end_date   ? formatDate(tr.end_date)   : null;
            const dateStr   = startDate && endDate ? `${startDate} → ${endDate}` : (startDate || endDate || '');

            const div = document.createElement('div');
            div.className = 'bg-white dark:bg-dark-card border border-gray-100 dark:border-dark-border rounded-2xl overflow-hidden transition-colors hover:border-gray-200 dark:hover:border-gray-600 flex';
            div.innerHTML = `
                <div class="w-1 flex-shrink-0 ${accent.bar} rounded-l-2xl"></div>
                <div class="flex-1 p-5">
                    <div class="flex items-start justify-between gap-3 mb-2">
                        <h4 class="font-bold text-sm dark:text-white leading-snug">${tr.program_name}</h4>
                        <span class="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${accent.badge}">
                            ${tr.end_date ? 'Completed' : 'In Progress'}
                        </span>
                    </div>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">${tr.institute}</p>
                    <div class="flex items-center justify-between">
                        ${dateStr ? `<span class="text-[10px] text-gray-400 font-mono">${dateStr}</span>` : '<span></span>'}
                        ${tr.certificate_url ? `
                        <a href="${tr.certificate_url}" target="_blank"
                        class="text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1">
                            View certificate <i class="fas fa-arrow-up-right-from-square text-[9px]"></i>
                        </a>` : ''}
                    </div>
                </div>
            `;
            trainContainer.appendChild(div);
        });

        // --- Contact Info ---
        const socialLinks = document.getElementById('socialLinks');
        socialLinks.innerHTML = '';
        const contactDetails = document.getElementById('contactDetails');
        contactDetails.innerHTML = '';

        contacts.forEach(c => {
            // Treat GitHub/LinkedIn/Docker/Credly special
            const lowerType = c.contacttypetitle.toLowerCase();
            if (['github', 'linkedin', 'docker', 'credly'].includes(lowerType)) {
                let icon = 'fas fa-link';
                if (lowerType === 'github') icon = 'fab fa-github';
                else if (lowerType === 'linkedin') icon = 'fab fa-linkedin';
                else if (lowerType === 'docker') icon = 'fab fa-docker';
                else if (lowerType === 'credly') icon = 'fas fa-award';
                
                const link = document.createElement('a');
                link.href = c.contact;
                link.target = "_blank";
                link.className = "w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all text-xl tooltip-trigger relative";
                link.innerHTML = `<i class="${icon}"></i>
                                  <span class="absolute -top-8 bg-gray-900 text-white text-[10px] py-1 px-2 rounded opacity-0 pointer-events-none transition-opacity whitespace-nowrap">${c.contacttypetitle}</span>`;
                
                // Add simple hover tooltip behavior
                link.addEventListener('mouseenter', () => link.querySelector('span').classList.remove('opacity-0'));
                link.addEventListener('mouseleave', () => link.querySelector('span').classList.add('opacity-0'));
                
                socialLinks.appendChild(link);
            } else if (lowerType === 'email' || lowerType === 'mobile' || lowerType === 'phone') {
                const icon = lowerType === 'email' ? 'far fa-envelope' : 'fas fa-mobile-alt';
                const div = document.createElement('div');
                div.className = "flex items-center gap-4";
                div.innerHTML = `<i class="${icon} text-lg text-blue-200"></i><span class="text-sm font-medium">${c.contactprefix ? c.contactprefix + ' ' : ''}${c.contact}</span>`;
                contactDetails.appendChild(div);
            }
        });

        // --- Setup Elements ---
        initProjectFilters();
        initContactForm();
        document.getElementById('currentYear').textContent = new Date().getFullYear();
    }

    // --- UX HELPERS ---
    function initTheme() {
        const toggle = document.getElementById('themeToggle');
        const applyTheme = (theme) => {
            if (theme === 'dark') {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
            localStorage.setItem('theme', theme);
            window.PORTFOLIO_STATE.theme = theme;
        };

        applyTheme(window.PORTFOLIO_STATE.theme);
        toggle.addEventListener('click', () => {
            const newTheme = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
            applyTheme(newTheme);
        });
    }

    function initMobileMenu() {
        const toggle = document.getElementById('menuToggle');
        const menu = document.getElementById('mobileMenu');
        toggle.addEventListener('click', () => menu.classList.toggle('hidden'));
        menu.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => menu.classList.add('hidden'));
        });
    }

    function initScrollEffects() {
        const navbar = document.getElementById('navbar');
        const sections = document.querySelectorAll('section');
        const navLinks = document.querySelectorAll('.nav-link');

        window.addEventListener('scroll', () => {
            // Navbar glass morph
            if (window.scrollY > 50) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }

            // Scroll Active State
            let current = '';
            sections.forEach(section => {
                const sectionTop = section.offsetTop;
                const sectionHeight = section.clientHeight;
                if (window.pageYOffset >= (sectionTop - 200)) {
                    current = section.getAttribute('id');
                }
            });

            navLinks.forEach(link => {
                link.classList.remove('active');
                if (link.getAttribute('href').slice(1) === current) {
                    link.classList.add('active');
                }
            });
        });

        // Intersection Observer for entry animations
        const observerOptions = { threshold: 0.15 };
        const sectionObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                }
            });
        }, observerOptions);

        sections.forEach(section => {
            if (section.id !== 'hero') sectionObserver.observe(section);
        });
    }

    function initTypingAnimation() {
        const target = document.getElementById('typing-text');
        const words = window.PORTFOLIO_STATE.data.profile.tagline || ["Software Engineer", "DevOps Enthusiast", "Cloud Architect"];
        
        function type() {
            const fullText = words[state.textIdx];
            
            if (state.isDeleting) {
                target.textContent = fullText.substring(0, state.typingIdx - 1);
                state.typingIdx--;
            } else {
                target.textContent = fullText.substring(0, state.typingIdx + 1);
                state.typingIdx++;
            }

            let typeSpeed = state.isDeleting ? 50 : 100;

            if (!state.isDeleting && state.typingIdx === fullText.length) {
                typeSpeed = 2000;
                state.isDeleting = true;
            } else if (state.isDeleting && state.typingIdx === 0) {
                state.isDeleting = false;
                state.textIdx = (state.textIdx + 1) % words.length;
                typeSpeed = 500;
            }

            setTimeout(type, typeSpeed);
        }

        setTimeout(type, 500);
    }

    function initProjectFilters() {
        const filtersContainer = document.getElementById('projectFilters');
        
        filtersContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('.filter-btn');
            if (!btn) return;

            const filter = btn.getAttribute('data-filter');
            const btns = filtersContainer.querySelectorAll('.filter-btn');
            const cards = document.querySelectorAll('.project-card');
            
            btns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            cards.forEach(card => {
                if (filter === 'all' || card.classList.contains(filter)) {
                    card.style.display = 'block';
                    setTimeout(() => card.style.opacity = '1', 10);
                } else {
                    card.style.opacity = '0';
                    setTimeout(() => card.style.display = 'none', 400);
                }
            });
        });
    }

    function openProjectModal(project) {
        const modal = document.getElementById('projectDetailModal');
        
        // Move modal to body to prevent CSS transform containing block issues
        if (modal && modal.parentElement !== document.body) {
            document.body.appendChild(modal);
        }
        
        const title = document.getElementById('projectModalTitle');
        const img = document.getElementById('projectModalImage');
        const tagsContainer = document.getElementById('projectModalTags');
        const desc = document.getElementById('projectModalDescription');
        const linksContainer = document.getElementById('projectModalLinks');

        // Reset & Populate
        title.textContent = project.title;
        img.src = project.thumbnail_url || 'https://via.placeholder.com/1200x800?text=' + encodeURIComponent(project.title);
        desc.textContent = project.long_description || project.short_description || 'No detailed description available.';
        
        tagsContainer.innerHTML = (project.tags || []).map(tag => `
            <span class="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-xs rounded-full font-bold text-gray-500 uppercase">${tag}</span>
        `).join('');

        linksContainer.innerHTML = `
            ${project.live_url ? `
                <a href="${project.live_url}" target="_blank" class="px-6 py-3 bg-primary text-white rounded-xl font-bold flex items-center gap-2 hover:bg-blue-600 transition-all shadow-lg shadow-primary/20">
                    <i class="fas fa-external-link-alt"></i> Live Demo
                </a>
            ` : ''}
            ${project.github_url ? `
                <a href="${project.github_url}" target="_blank" class="px-6 py-3 bg-gray-900 dark:bg-dark-bg border border-gray-800 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-black transition-all">
                    <i class="fab fa-github"></i> Repository
                </a>
            ` : ''}
        `;

        modal.classList.remove('hidden');
        modal.classList.add('flex');
        document.body.style.overflow = 'hidden';
    }

    const closeProjectDetail = () => {
        const modal = document.getElementById('projectDetailModal');
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        document.body.style.overflow = '';
    };

    document.getElementById('closeProjectDetailBtn')?.addEventListener('click', closeProjectDetail);
    document.getElementById('closeProjectDetailModal')?.addEventListener('click', closeProjectDetail);

    function openCertModal(cert) {
        const modal = document.getElementById('certModal');
        
        // Move modal to body to prevent CSS transform containing block issues
        if (modal && modal.parentElement !== document.body) {
            document.body.appendChild(modal);
        }
        
        const frame = document.getElementById('certFrame');
        const imgContainer = document.getElementById('certImageContainer');
        const img = document.getElementById('certImage');
        const noData = document.getElementById('certNoData');
        const title = document.getElementById('certModalTitle');
        
        title.textContent = cert.title + ' — ' + cert.issuer;
        
        // Reset states
        frame.classList.add('hidden');
        imgContainer.classList.add('hidden');
        imgContainer.classList.remove('flex');
        noData.classList.add('hidden');
        noData.classList.remove('flex');
        
        if (cert.pdf_url) {
            frame.src = cert.pdf_url;
            frame.classList.remove('hidden');
        } else if (cert.badge_image_url) {
            img.src = cert.badge_image_url;
            imgContainer.classList.remove('hidden');
            imgContainer.classList.add('flex');
            frame.src = '';
        } else {
            noData.classList.remove('hidden');
            noData.classList.add('flex');
            frame.src = '';
        }
        
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        document.body.style.overflow = 'hidden';
    }

    const closeCert = () => {
        const modal = document.getElementById('certModal');
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        document.body.style.overflow = '';
        
        document.getElementById('certFrame').src = '';
        const img = document.getElementById('certImage');
        if (img) img.src = '';
    };

    document.getElementById('closeCertBtn')?.addEventListener('click', closeCert);
    document.getElementById('closeCertModal')?.addEventListener('click', closeCert);

    function initContactForm() {
        const form = document.getElementById('contactForm');
        const status = document.getElementById('contactStatus');
        const btn = document.getElementById('submitContact');

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            btn.disabled = true;
            btn.innerHTML = 'Sending...';

            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());

            try {
                const res = await fetch('/api/v1/public/contact', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                
                const result = await res.json();
                status.classList.remove('hidden');
                
                if (result.error) {
                    status.className = "text-center text-sm font-medium p-4 rounded-xl mt-4 bg-red-50 text-red-600 dark:bg-red-900/10 dark:text-red-400 border border-red-100 dark:border-red-900/50";
                    status.textContent = result.message || 'Error sending message.';
                } else {
                    status.className = "text-center text-sm font-medium p-4 rounded-xl mt-4 bg-green-50 text-green-600 dark:bg-green-900/10 dark:text-green-400 border border-green-100 dark:border-green-900/50";
                    status.textContent = 'Message received! I will get back to you soon.';
                    form.reset();
                }
            } catch (err) {
                status.classList.remove('hidden');
                status.textContent = 'Network error. Please try again.';
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<span>Send Message</span> <i class="fas fa-paper-plane text-xs"></i>';
                setTimeout(() => status.classList.add('hidden'), 5000);
            }
        });
    }

    function formatDate(date) {
        if (!date) return '';
        const d = new Date(date);
        return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    }
});
