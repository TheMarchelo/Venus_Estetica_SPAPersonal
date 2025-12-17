
// State
let cart = [];
let bootstrapCartModal; // Bootstrap Modal Instance

const BUSINESS_HOURS = {
    // 0 = Sun, 1 = Mon, ...
    0: null, // Closed
    1: null, // Closed
    2: { start: '09:00', end: '17:00' }, // Tue
    3: { start: '09:00', end: '17:00' }, // Wed
    4: { start: '09:00', end: '17:00' }, // Thu
    5: { start: '09:00', end: '17:00' }, // Fri
    6: { start: '09:00', end: '16:00' }  // Sat
};
const BLOCK_DURATION = 90; // minutes

// DOM Elements
const promosContainer = document.getElementById('promos-container');
const servicesContainer = document.getElementById('services-container');
const productsContainer = document.getElementById('products-container');
const cartCount = document.getElementById('cart-count');
const cartItemsContainer = document.getElementById('cart-items');
const cartTotalAmount = document.getElementById('cart-total-amount');

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
    // Init Bootstrap Modals
    bootstrapCartModal = new bootstrap.Modal(document.getElementById('cartModal'));



    // Attempt to fetch content from Firestore, fallback to static data
    await fetchContent();

    // Forms
    const appForm = document.getElementById('appointment-form');
    if (appForm) appForm.addEventListener('submit', handleAppointmentSubmit);

    // Time Slot Logic
    const dateInput = document.getElementById('app-date');
    if (dateInput) {
        dateInput.addEventListener('change', (e) => {
            updateTimeSlots(e.target.value);
        });
    }

    const orderForm = document.getElementById('order-form');
    if (orderForm) orderForm.addEventListener('submit', handleOrderSubmit);
});

// Toast Helper
function showToast(message, type = 'success') {
    const toastContainer = document.getElementById('toast-container');
    const toastEl = document.createElement('div');
    toastEl.className = `toast align-items-center text-white bg-${type === 'success' ? 'success' : 'danger'} border-0`;
    toastEl.setAttribute('role', 'alert');
    toastEl.setAttribute('aria-live', 'assertive');
    toastEl.setAttribute('aria-atomic', 'true');

    toastEl.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                ${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
    `;

    toastContainer.appendChild(toastEl);
    const toast = new bootstrap.Toast(toastEl);
    toast.show();

    toastEl.addEventListener('hidden.bs.toast', () => {
        toastEl.remove();
    });
}

// Fetch Content
async function fetchContent() {
    try {
        if (typeof db !== 'undefined') {
            const promoSnap = await db.collection('promociones').get();
            const serviceSnap = await db.collection('servicios').get();
            const productSnap = await db.collection('productos').get();

            if (!promoSnap.empty) {
                const data = [];
                promoSnap.forEach(d => data.push(d.data()));
                renderPromos(data);
            } else { renderPromos([]); }

            if (!serviceSnap.empty) {
                const data = [];
                serviceSnap.forEach(d => data.push(d.data()));
                renderServices(data);
                populateServiceSelect(data);
            } else {
                renderServices([]);
                populateServiceSelect([]);
            }

            if (!productSnap.empty) {
                const data = [];
                // Use doc.id for products
                productSnap.forEach(d => data.push({ id: d.id, ...d.data() }));
                renderProducts(data);
            } else { renderProducts([]); }

        } else {
            // Firebase not loaded
            console.log("Firebase not loaded, and static data fallback disabled.");
        }
    } catch (e) {
        console.error("Error fetching content:", e);
    }
}

// Render Functions
function renderPromos(data) {
    if (!promosContainer) return;
    promosContainer.innerHTML = '';
    data.forEach(promo => {
        const div = document.createElement('div');
        div.className = 'col-md-4';
        div.innerHTML = `
            <div class="card h-100">
                <img src="${promo.image}" class="card-img-top" alt="${promo.title}" style="height:200px; object-fit:cover;">
                <div class="card-body text-center">
                    <h3 class="fancy-text">${promo.title}</h3>
                    <p class="card-text">${promo.description}</p>
                    <div class="price mb-3" style="font-size:1.5rem;">₡${promo.price.toLocaleString()}</div>
                    <a href="#contact" class="btn btn-outline-gold">Agendar Cita</a>
                </div>
            </div>
        `;
        promosContainer.appendChild(div);
    });
}

function renderServices(data) {
    if (!servicesContainer) return;
    const filter = document.getElementById('service-filter').value;
    servicesContainer.innerHTML = '';

    const filteredServices = filter === 'all'
        ? data
        : data.filter(s => s.category === filter);

    filteredServices.forEach(service => {
        const div = document.createElement('div');
        div.className = 'col-md-6 col-lg-4';
        // Check if service has an image (from new admin panel works) or use fallback icon
        const imgHtml = service.image
            ? `<img src="${service.image}" class="card-img-top" style="height:200px; object-fit:cover;" alt="${service.name}">`
            : `<div class="bg-light d-flex align-items-center justify-content-center" style="height:150px;"><i class="fas fa-spa fa-3x text-gold"></i></div>`;

        div.innerHTML = `
            <div class="card h-100 border-0 shadow-sm hover-elevate">
                ${imgHtml}
                <div class="card-body text-center">
                    <h4 class="fancy-text text-dark">${service.name}</h4>
                    <p class="text-muted small mb-2">${service.category}</p>
                    <div class="price text-gold fw-bold mb-3" style="font-size:1.25rem;">₡${service.price.toLocaleString()}</div>
                    <button class="btn btn-outline-gold w-100" onclick="prefillAppointment('${service.name}')">Agendar Cita</button>
                </div>
            </div>
        `;
        servicesContainer.appendChild(div);
    });
}

function renderProducts(data) {
    if (!productsContainer) return;
    productsContainer.innerHTML = '';
    data.forEach(product => {
        const pId = product.id;
        const isAvailable = (product.status === 'Disponible' || !product.status) && (product.stock > 0 || product.stock === undefined);
        const buttonHtml = isAvailable
            ? `<button class="btn btn-sm btn-gold mt-2" onclick="addToCart('${pId}', '${product.name}', ${product.price})"><i class="fas fa-cart-plus"></i> Agregar</button>`
            : `<button class="btn btn-sm btn-secondary mt-2" disabled>Agotado</button>`;

        const badgeHtml = !isAvailable
            ? `<span class="position-absolute top-0 end-0 badge bg-danger m-2">Agotado</span>`
            : '';

        const div = document.createElement('div');
        div.className = 'col-6 col-md-3';
        div.innerHTML = `
            <div class="card h-100 shadow-sm border-0">
                <div class="position-relative">
                     <img src="${product.image || 'https://via.placeholder.com/150'}" class="card-img-top" alt="${product.name}" style="height:180px; object-fit:cover;">
                     ${badgeHtml}
                </div>
                <div class="card-body d-flex flex-column text-center">
                    <h5 class="card-title fancy-text text-dark" style="font-size:1.1rem;">${product.name}</h5>
                    <p class="text-muted small mb-1">${product.category || ''}</p>
                    <div class="price mt-auto text-gold fw-bold" style="font-size:1.2rem;">₡${product.price.toLocaleString()}</div>
                    ${buttonHtml}
                </div>
            </div>
        `;
        productsContainer.appendChild(div);
    });
}

function populateServiceSelect(data) {
    const appServiceSelect = document.getElementById('app-service');
    if (!appServiceSelect) return;
    // Keep first option
    appServiceSelect.innerHTML = `<option value="">Seleccione un servicio...</option>`;
    data.forEach(s => {
        const option = document.createElement('option');
        option.value = s.name;
        option.textContent = s.name;
        appServiceSelect.appendChild(option);
    });
}

async function updateTimeSlots(dateString) {
    const timeSelect = document.getElementById('app-time');
    if (!timeSelect) return;

    timeSelect.innerHTML = '<option value="">Cargando horas...</option>';

    if (!dateString) {
        timeSelect.innerHTML = '<option value="">Selecciona una hora</option>';
        return;
    }

    const date = new Date(dateString + 'T00:00:00');
    const day = date.getDay();
    // Removed fallback to BUSINESS_HOURS. We now rely fully on 'horarios' collection.


    // Generate all theoretical slots
    // OLD METHOD: const allSlots = generateTimeSlots(schedule.start, schedule.end);

    try {
        // NEW METHOD: Fetch from 'horarios' collection
        // Now checks 'isBooked' field directly. No need to query 'citas' (Permission safe).
        const slotsSnap = await db.collection('horarios').where('date', '==', dateString).get();

        let availableSlots = [];
        slotsSnap.forEach(doc => {
            const d = doc.data();
            // If isBooked is true, it's taken. If undefined or false, it's available.
            if (!d.isBooked) {
                availableSlots.push(d.time);
            }
        });

        if (availableSlots.length === 0 && slotsSnap.empty) {
            // Fallback if administration hasn't generated slots
            timeSelect.innerHTML = '<option value="" disabled>No hay horarios disponibles (Consulte admin)</option>';
            return;
        }

        // Sort slots nicely
        availableSlots.sort((a, b) => {
            return new Date('1970/01/01 ' + a.replace('a. m.', 'AM').replace('p. m.', 'PM')) -
                new Date('1970/01/01 ' + b.replace('a. m.', 'AM').replace('p. m.', 'PM'));
        });

        timeSelect.innerHTML = '<option value="">Selecciona una hora</option>';

        if (availableSlots.length === 0) {
            timeSelect.innerHTML = '<option value="" disabled>Agenda llena para este día</option>';
        } else {
            availableSlots.forEach(time => {
                const option = document.createElement('option');
                option.value = time;
                option.textContent = time;
                timeSelect.appendChild(option);
            });
        }

    } catch (error) {
        console.error("Error checking availability:", error);
        timeSelect.innerHTML = '<option value="">Error al cargar horas</option>';
    }
}

function generateTimeSlots(startStr, endStr) {
    const slots = [];
    const [startH, startM] = startStr.split(':').map(Number);
    const [endH, endM] = endStr.split(':').map(Number);

    let current = new Date();
    current.setHours(startH, startM, 0, 0);

    const end = new Date();
    end.setHours(endH, endM, 0, 0);

    while (true) {
        const nextEnd = new Date(current.getTime() + BLOCK_DURATION * 60000);
        if (nextEnd > end) break;

        const timeString = current.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
        slots.push(timeString);

        current = nextEnd;
    }
    return slots;
}

// Cart Logic
function addToCart(id, name, price) {
    cart.push({ id, name, price });
    updateCartUI();
    showToast("¡Agregado al carrito!");
}

function updateCartUI() {
    if (cartCount) cartCount.textContent = cart.length;

    if (cartItemsContainer) {
        cartItemsContainer.innerHTML = '';
        let total = 0;

        if (cart.length === 0) {
            cartItemsContainer.innerHTML = `<p class="text-center text-muted">Tu carrito está vacío.</p>`;
        } else {
            cart.forEach((item, index) => {
                total += item.price;
                const div = document.createElement('div');
                div.className = 'd-flex justify-content-between align-items-center mb-2 border-bottom pb-2';
                div.innerHTML = `
                    <span>${item.name}</span>
                    <span>₡${item.price.toLocaleString()} <i class="fas fa-trash text-danger ms-2" style="cursor:pointer;" onclick="removeFromCart(${index})"></i></span>
                `;
                cartItemsContainer.appendChild(div);
            });
        }
        if (cartTotalAmount) cartTotalAmount.textContent = total.toLocaleString();
    }
}

function removeFromCart(index) {
    cart.splice(index, 1);
    updateCartUI();
}

function openCartBootstrap() {
    updateCartUI();
    bootstrapCartModal.show();
}

function prefillAppointment(serviceName) {
    const sel = document.getElementById('app-service');
    if (sel) sel.value = serviceName;
    document.getElementById('contact').scrollIntoView({ behavior: 'smooth' });
}

// Handlers
async function handleAppointmentSubmit(e) {
    e.preventDefault();

    // Auth Guard
    const user = firebase.auth().currentUser;
    if (!user) {
        showToast('Debes iniciar sesión para agendar.', 'warning');
        if (typeof loginModal !== 'undefined') loginModal.show();
        return;
    }

    const data = {
        userId: user.uid, // Link to user
        name: document.getElementById('app-name').value,
        email: user.email || '', // Save email
        phone: document.getElementById('app-phone').value,
        date: document.getElementById('app-date').value,
        time: document.getElementById('app-time').value, // Save time
        service: document.getElementById('app-service').value,
        message: document.getElementById('app-message').value,
        status: 'Pendiente',
        timestamp: new Date()
    };

    try {
        if (typeof db !== 'undefined') {
            const batch = db.batch();

            // 1. Add Cita
            const citaRef = db.collection('citas').doc();
            batch.set(citaRef, data);

            // 2. Mark Horario as Booked
            // Securely find the document by Date + Time (works for both Auto-generated and Manual IDs)
            const scheduleQuery = await db.collection('horarios')
                .where('date', '==', data.date)
                .where('time', '==', data.time)
                .limit(1)
                .get();

            if (!scheduleQuery.empty) {
                const scheduleRef = scheduleQuery.docs[0].ref;
                batch.update(scheduleRef, { isBooked: true });
            } else {
                console.warn("Horario doc not found for booking sync. Proceeding anyway.");
            }

            await batch.commit();
            showToast('¡Solicitud enviada con éxito!');
        }
        e.target.reset();
        // Refresh slots if same date selected
        updateTimeSlots(data.date);
    } catch (error) {
        console.error("Error adding document: ", error);
        showToast('Error al enviar la solicitud.', 'danger');
    }
}

async function handleOrderSubmit(e) {
    e.preventDefault();

    // Auth Guard
    const user = firebase.auth().currentUser;
    if (!user) {
        showToast('Debes iniciar sesión para pedir.', 'warning');
        bootstrapCartModal.hide();
        if (typeof loginModal !== 'undefined') loginModal.show();
        return;
    }

    if (cart.length === 0) {
        showToast('Tu carrito está vacío.', 'warning');
        return;
    }

    const data = {
        userId: user.uid, // Link to user
        name: document.getElementById('order-name').value,
        phone: document.getElementById('order-phone').value,
        items: cart.map(i => ({ name: i.name, price: i.price })),
        total: cart.reduce((acc, curr) => acc + curr.price, 0),
        status: 'Pendiente',
        timestamp: new Date()
    };

    try {
        if (typeof db !== 'undefined') {
            await db.collection('pedidos').add(data);
            showToast('¡Pedido enviado con éxito!');
        }
        cart = [];
        updateCartUI();
        bootstrapCartModal.hide();
        e.target.reset();
    } catch (error) {
        console.error("Error adding document: ", error);
        showToast('Error al enviar el pedido.', 'danger');
    }
}
