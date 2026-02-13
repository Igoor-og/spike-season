const initMain = () => {
    // 1. Remove Loading Screen
    const loadingScreen = document.getElementById('loading-screen');
    const hideLoading = () => {
        if (loadingScreen && loadingScreen.classList.contains('active')) {
            loadingScreen.classList.remove('active');
            setTimeout(() => loadingScreen.classList.add('hidden'), 500);
        }
    };

    // Hide when everything is loaded
    window.addEventListener('load', hideLoading);
    // Safety fallback: if load takes too long, hide anyway
    setTimeout(hideLoading, 2500);

    // 2. Hamburger Menu
    const hamburger = document.getElementById('hamburger');
    const menuOverlay = document.getElementById('menu-overlay');
    const menuClose = document.getElementById('menu-close');
    const menuLinks = document.querySelectorAll('.menu-item');

    const openMenu = () => {
        hamburger?.classList.add('active');
        menuOverlay?.classList.add('active');
        document.body.style.overflow = 'hidden';
    };

    const closeMenu = () => {
        hamburger?.classList.remove('active');
        menuOverlay?.classList.remove('active');
        document.body.style.overflow = 'auto';
    };

    hamburger?.addEventListener('click', openMenu);
    menuClose?.addEventListener('click', closeMenu);

    menuLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            if (link.dataset.scroll === 'top') {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
            closeMenu();
        });
    });

    // 4. Header Scroll Effect
    const header = document.querySelector('.header');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header?.classList.add('scrolled');
        } else {
            header?.classList.remove('scrolled');
        }
    });

    // 5. Scroll Down Button
    const scrollDownBtn = document.getElementById('scroll-to-swiper');
    scrollDownBtn?.addEventListener('click', () => {
        document.getElementById('collection')?.scrollIntoView({ behavior: 'smooth' });
    });

    // 6. Swiper Initialization
    if (typeof Swiper !== 'undefined') {
        new Swiper('.swiper-container', {
            slidesPerView: 'auto',
            centeredSlides: true,
            spaceBetween: 40,
            loop: true,
            autoplay: {
                delay: 3000,
                disableOnInteraction: false,
            },
            speed: 1000,
            grabCursor: true,
            effect: 'coverflow',
            coverflowEffect: {
                rotate: 0,
                stretch: 0,
                depth: 100,
                modifier: 2.5,
                slideShadows: false,
            }
        });
    }
};

// Robust Initialization
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMain);
} else {
    initMain();
}
