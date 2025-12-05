
const translations = {
    es: {
        nav_home: "Inicio",
        nav_promos: "Promociones",
        nav_services: "Servicios",
        nav_products: "Productos",
        nav_contact: "Citas",
        nav_admin: "Admin",
        nav_login: "Iniciar Sesión",
        welcome_title: "Bienvenida a Venus",
        welcome_subtitle: "Donde la belleza y la relajación se encuentran",
        btn_book: "Agendar Cita",
        section_promos: "Promociones Especiales",
        section_services: "Nuestros Servicios",
        section_products: "Catálogo de Productos",
        section_contact: "Solicitar Cita",
        filter_all: "Todas",
        filter_face: "Faciales",
        filter_body: "Corporales",
        filter_massage: "Masajes",
        filter_depil: "Depilación",
        form_name: "Nombre Completo",
        form_phone: "Teléfono / WhatsApp",
        form_date: "Fecha Deseada",
        form_service: "Servicio de Interés",
        form_message: "Notas Adicionales",
        form_submit_app: "Enviar Solicitud",
        cart_title: "Tu Pedido",
        cart_empty: "Tu carrito está vacío.",
        cart_total: "Total Estimado",
        cart_submit: "Enviar Pedido",
        login_title: "Iniciar Sesión",
        login_email: "Correo Electrónico",
        login_pass: "Contraseña",
        login_btn: "Ingresar",
        login_register_link: "¿No tienes cuenta? Regístrate",
        profile_title: "Mi Perfil",
        profile_role: "Rol:",
        btn_logout: "Cerrar Sesión",
        btn_admin_access: "Panel de Admin",
        btn_make_admin: "Hacerme Admin (Dev)",
        msg_added_cart: "¡Agregado al carrito!",
        msg_app_sent: "¡Solicitud enviada! Te contactaremos pronto.",
        msg_order_sent: "¡Pedido enviado! Te contactaremos pronto.",
        val_select_service: "Seleccione un servicio..."
    },
    en: {
        nav_home: "Home",
        nav_promos: "Specials",
        nav_services: "Services",
        nav_products: "Products",
        nav_contact: "Book",
        nav_admin: "Admin",
        nav_login: "Login",
        welcome_title: "Welcome to Venus",
        welcome_subtitle: "Where beauty meets relaxation",
        btn_book: "Book Now",
        section_promos: "Special Promotions",
        section_services: "Our Services",
        section_products: "Product Catalog",
        section_contact: "Request Appointment",
        filter_all: "All",
        filter_face: "Facials",
        filter_body: "Body",
        filter_massage: "Massages",
        filter_depil: "Depilation",
        form_name: "Full Name",
        form_phone: "Phone / WhatsApp",
        form_date: "Desired Date",
        form_service: "Service of Interest",
        form_message: "Additional Notes",
        form_submit_app: "Send Request",
        cart_title: "Your Order",
        cart_empty: "Your cart is empty.",
        cart_total: "Estimated Total",
        cart_submit: "Place Order",
        login_title: "Login",
        login_email: "Email Address",
        login_pass: "Password",
        login_btn: "SignIn",
        login_register_link: "No account? Register",
        profile_title: "My Profile",
        profile_role: "Role:",
        btn_logout: "Logout",
        btn_admin_access: "Admin Panel",
        btn_make_admin: "Become Admin (Dev)",
        msg_added_cart: "Added to cart!",
        msg_app_sent: "Request sent! We will contact you soon.",
        msg_order_sent: "Order sent! We will contact you soon.",
        val_select_service: "Select a service..."
    }
};

let currentLang = 'es';

function setLanguage(lang) {
    currentLang = lang;
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[lang][key]) {
            el.textContent = translations[lang][key];
        }
    });

    // Update placeholders
    const nameInput = document.getElementById('app-name');
    if (nameInput && lang === 'en') nameInput.placeholder = "Your Name";

    // Update Select default option
    const serviceSelect = document.getElementById('app-service');
    if (serviceSelect && serviceSelect.options.length > 0) {
        serviceSelect.options[0].text = translations[lang].val_select_service;
    }
}

function toggleLanguage() {
    const newLang = currentLang === 'es' ? 'en' : 'es';
    setLanguage(newLang);
    const btn = document.getElementById('lang-toggle');
    if (btn) btn.textContent = newLang.toUpperCase();
}

// Helper to get text safely
function t(key) {
    return translations[currentLang][key] || key;
}
